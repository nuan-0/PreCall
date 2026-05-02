import express from 'express';
import path from 'path';
import { fileURLToPath } from 'node:url';
// @ts-ignore
import RazorpayPkg from 'razorpay';
const Razorpay = (RazorpayPkg as any).default || RazorpayPkg;

import crypto from 'crypto';
// @ts-ignore
import admin from 'firebase-admin';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import fs from 'fs';
// import fetch from 'node-fetch'; // No longer needed in Node 18+

import multer from 'multer';
const upload = multer({ storage: multer.memoryStorage() });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ADMIN_EMAILS = ['precall.admin@gmail.com', 'precall.founder@gmail.com'];

// Helper to check Razorpay keys
const checkRazorpayConfig = () => {
  const keyId = process.env.VITE_RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID || process.env.RAZORPAY_LIVE_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET || process.env.RAZORPAY_LIVE_KEY_SECRET;
  
  if (!keyId || !keySecret) {
    console.warn('⚠️ RAZORPAY CONFIGURATION MISSING:');
    if (!keyId) console.warn(' - Key ID (VITE_RAZORPAY_KEY_ID, RAZORPAY_KEY_ID, or RAZORPAY_LIVE_KEY_ID) is not set');
    if (!keySecret) console.warn(' - Key Secret (RAZORPAY_KEY_SECRET or RAZORPAY_LIVE_KEY_SECRET) is not set');
    console.warn('Payments will fail until these are added to environment variables.');
    return false;
  }
  console.log(`✅ Razorpay configuration detected (Key ID starts with: ${keyId.substring(0, 8)}...)`);
  return true;
};

async function startServer() {
  const app = express();
  const PORT = 3000;

  checkRazorpayConfig();

  // Use a persistent (for the life of the process) tracker for usage
  const usageTracker = {
    reads: 0,
    lastNotifiedThreshold: 0,
    startTime: Date.now()
  };

  const checkAndNotifyUsage = async () => {
    const dailyLimit = 50000;
    const currentPercent = (usageTracker.reads / dailyLimit) * 100;
    
    // Find the current threshold (multiple of 20)
    const threshold = Math.floor(currentPercent / 20) * 20;

    if (threshold > usageTracker.lastNotifiedThreshold && threshold <= 100 && threshold % 20 === 0) {
      const notifiedThreshold = threshold;
      usageTracker.lastNotifiedThreshold = threshold;
      
      const emoji = notifiedThreshold >= 80 ? '⚠️' : notifiedThreshold >= 40 ? '📊' : 'ℹ️';
      await sendTelegramNotification(
        `${emoji} <b>Firestore Usage Update</b>\n\n` +
        `📉 <b>Estimated Reads:</b> <code>${usageTracker.reads.toLocaleString()}</code>\n` +
        `📈 <b>Capacity:</b> <code>${notifiedThreshold}%</code> used\n` +
        `⏳ <b>Uptime:</b> <code>${Math.floor((Date.now() - usageTracker.startTime) / (1000 * 60 * 60))}h</code>`
      ).catch(console.error);
    }
  };

  // Initialize Firebase Admin
  let firestoreDatabaseId: string | undefined;
  let configProjectId: string | undefined;
  let config: any = {};
  
  try {
    const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
    if (fs.existsSync(configPath)) {
      config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      firestoreDatabaseId = config.firestoreDatabaseId;
      configProjectId = config.projectId;
      console.log(`[Firebase] Config loaded: Project=${configProjectId}, Database=${firestoreDatabaseId}`);
    } else {
      console.warn('[Firebase] Config file NOT found at:', configPath);
    }

    if (admin.apps.length === 0) {
      if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        console.log('[Firebase] Initializing via Service Account... (found FIREBASE_SERVICE_ACCOUNT)');
        try {
          const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
          console.log('[Firebase] SA Client Email:', sa.client_email);
          console.log('[Firebase] SA Project ID:', sa.project_id);
          
          if (configProjectId && sa.project_id && sa.project_id !== configProjectId) {
            console.warn(`[Firebase] ⚠️ PROJECT ID MISMATCH! Config project is "${configProjectId}" but Service Account is for "${sa.project_id}". This will cause PERMISSION_DENIED.`);
          }

          admin.initializeApp({
            credential: admin.credential.cert(sa),
            projectId: sa.project_id || configProjectId,
            storageBucket: config.storageBucket || (sa.project_id ? `${sa.project_id}.firebasestorage.app` : undefined)
          });
          console.log('✅ Firebase Admin initialized via Service Account. Project:', admin.app().options.projectId);
        } catch (err: any) {
          console.error('❌ CRITICAL: Failed to parse FIREBASE_SERVICE_ACCOUNT JSON:', err.message);
          console.error('⚠️ NOTE: It looks like you pasted the JavaScript snippet instead of the Service Account JSON!');
          console.error('⚠️ Your secret starts with: ', process.env.FIREBASE_SERVICE_ACCOUNT.slice(0, 50));
          console.error('⚠️ Please open the downloaded .json file and paste its contents directly.');
          throw new Error('Invalid FIREBASE_SERVICE_ACCOUNT JSON. Please check settings.');
        }
      } else {
        console.log('[Firebase] RED ALERT: FIREBASE_SERVICE_ACCOUNT not found. Falling back to default credentials.');
        console.log('[Firebase] Project ID from config:', configProjectId);
        // Explicitly set the project ID even when using ADC
        admin.initializeApp({
          projectId: configProjectId || undefined
        });
        console.log('✅ Firebase Admin initialized. Project:', admin.app().options.projectId);
      }
    } else {
      console.log('[Firebase] Already initialized. Project:', admin.app().options.projectId);
    }
  } catch (error) {
    console.error('[Firebase] Init Error:', error);
  }

  // Define DB with explicit database ID if present
  let db: admin.firestore.Firestore;
  try {
    const app = admin.app();
    if (firestoreDatabaseId) {
      console.log(`[Firebase] Accessing specific database: ${firestoreDatabaseId}`);
      db = getFirestore(app, firestoreDatabaseId);
    } else {
      console.log('[Firebase] Accessing default database');
      db = getFirestore(app);
    }
    // Simple verification check (lazy, will fail on first access if permission denied)
    console.log('✅ Firestore instance acquired');
  } catch (err: any) {
    console.error('❌ Failed to acquire Firestore instance:', err.message);
    // Fallback to default
    db = admin.firestore();
  }


  // Direct and simple helper for Firestore operations
  const runFirestoreOp = async (op: (dbInstance: admin.firestore.Firestore) => Promise<any>, label: string): Promise<any> => {
    try {
      return await op(db);
    } catch (err: any) {
      const dbId = (db as any)._settings?.databaseId || (db as any).databaseId || 'default';
      const projId = admin.app().options.projectId || 'Unknown';
      
      if (err.message?.includes('PERMISSION_DENIED') || err.code === 7) {
        console.error(`❌ CRITICAL: Firestore [${label}] failed with PERMISSION_DENIED.`);
        console.error(`   Project: ${projId}, Database: ${dbId}`);
        console.error(`   Identity: ${admin.app()?.options?.credential ? 'Has Credentials' : 'NO CREDENTIALS'}`);
        
        // Notify via Telegram if possible
        notifyFailure('Firestore Permission Denied', err, { 
          label, 
          project: projId,
          database: dbId,
          hasServiceAccount: !!process.env.FIREBASE_SERVICE_ACCOUNT
        }).catch(() => {});
      } else {
        console.error(`[Firestore ${label}] Operation failed (code: ${err.code}):`, err.message);
      }
      throw err;
    }
  };

  // Help function for Telegram Notifications
  const sendTelegramNotification = async (message: string) => {
    const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
    const chatId = process.env.TELEGRAM_CHAT_ID?.trim();
    
    if (!token || !chatId) {
      console.log(`⚠️ Telegram notification skipped: ${!token ? 'BOT_TOKEN missing' : ''} ${!chatId ? 'CHAT_ID missing' : ''}`);
      return;
    }

    console.log(`📡 Sending Telegram notification... (ChatID: ${chatId})`);

    try {
      // Using global fetch (Node 18+) with timeout to prevent hanging the request
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

      const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: 'HTML'
        })
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        console.error('❌ Telegram API error:', response.status, errData);
      } else {
        console.log('✅ Telegram notification sent successfully.');
      }
    } catch (err) {
      console.error('❌ Failed to send Telegram notification:', err);
    }
  };

  const notifyFailure = async (title: string, error: any, context?: any) => {
    const contextStr = context ? `\n\n<b>Context:</b>\n<pre>${escapeHTML(JSON.stringify(context, null, 2)).substring(0, 500)}</pre>` : '';
    await sendTelegramNotification(
      `🚨 <b>${escapeHTML(title)}</b>\n\n` +
      `🛑 <b>Error:</b> <i>${escapeHTML(error.message || error)}</i>\n` +
      `💻 <b>Env:</b> <code>${escapeHTML(process.env.NODE_ENV || 'dev')}</code>` +
      contextStr
    ).catch(() => {});
  };

  // help handle escaping for Telegram HTML mode
  const escapeHTML = (text: string) => {
    if (!text) return '';
    return text.toString()
               .replace(/&/g, '&amp;')
               .replace(/</g, '&lt;')
               .replace(/>/g, '&gt;');
  };
  const checkIsAdmin = async (userId: string): Promise<boolean> => {
    if (!userId) return false;
    
    console.log(`[Admin Check] Verifying admin status for userId: ${userId}`);
    
    // Part A: Firestore Check (Robust)
    try {
      const userDoc = await runFirestoreOp(async (dbInstance) => {
        return await dbInstance.collection('users').doc(userId).get();
      }, 'AdminCheck');
      
      if (userDoc.exists) {
        const userData = userDoc.data();
        console.log(`[Admin Check] Found user profile. Role: ${userData?.role}, Email: ${userData?.email}`);
        if (userData?.role === 'admin' || ADMIN_EMAILS.includes(userData?.email)) return true;
      }
    } catch (err: any) {
      console.warn(`[Admin Check] Firestore check failed for ${userId}:`, err.message || err);
    }

    // Part B: Firebase Auth (Fallback)
    try {
      const user = await admin.auth().getUser(userId);
      console.log(`[Admin Check Auth] Email: ${user.email}`);
      if (ADMIN_EMAILS.includes(user.email || '')) return true;
    } catch (authErr: any) {
      console.warn(`[Admin Check Auth] Failed for ${userId}:`, authErr.message || authErr);
    }
    
    console.warn(`[Admin Check] Denying access for ${userId} - no admin verification succeeded.`);
    return false;
  };

  // Seed Razorpay Test Account
  const seedRazorpayTestAccount = async () => {
    // Skip seeding on Vercel to prevent timeouts
    if (process.env.VERCEL) {
      return;
    }
    
    const testEmail = 'razorpaytest.precall@gmail.com';
    const testPassword = 'razorpay999';
    const logPath = path.join(process.cwd(), 'seed-log.txt');
    
    const log = (msg: string) => {
      console.log(`[Seed] ${msg}`);
    };

    try {
      log('Starting Razorpay test account seeding...');
      // Check if user exists
      try {
        const user = await admin.auth().getUserByEmail(testEmail);
        log(`User found: ${user.uid}. Updating password...`);
        // Always update password to ensure it matches
        await admin.auth().updateUser(user.uid, {
          password: testPassword,
          emailVerified: true
        });
        log('Razorpay test account updated with correct password');
      } catch (error: any) {
        if (error.code === 'auth/user-not-found') {
          log('User not found. Creating new user...');
          // Create user
          const userRecord = await admin.auth().createUser({
            email: testEmail,
            password: testPassword,
            emailVerified: true,
            displayName: 'Razorpay Tester'
          });
          
          log(`User created: ${userRecord.uid}. Creating Firestore profile...`);
          // Create profile in Firestore
          await runFirestoreOp(dbInstance => dbInstance.collection('users').doc(userRecord.uid).set({
            uid: userRecord.uid,
            email: testEmail,
            displayName: 'Razorpay Tester',
            role: 'user',
            isPremium: false,
            createdAt: new Date().toISOString()
          }, { merge: true }), 'SeedUserProfile');
          
          log('Razorpay test account seeded successfully');
        } else {
          log(`Auth error: ${error.code} - ${error.message}`);
          throw error;
        }
      }
    } catch (error: any) {
      log(`Seeding failed: ${error.message}`);
      console.error('Error seeding Razorpay test account:', error);
    }
  };

  seedRazorpayTestAccount();

  // --- CONTENT CACHE LOGIC ---
  const contentCache = {
    subjects: [] as any[],
    topics: [] as any[],
    lastUpdated: 0,
    isRefreshing: false
  };

  let activeRefreshPromise: Promise<void> | null = null;

  const refreshContentCache = async () => {
    if (activeRefreshPromise) return activeRefreshPromise;
    contentCache.isRefreshing = true;
    
    activeRefreshPromise = (async () => {
      console.log('[Cache] Refreshing content cache from Firestore...');
      try {
        // Parallel fetch to be faster
        const [subjectsSnap, topicsSnap] = await Promise.all([
          runFirestoreOp(dbInstance => dbInstance.collection('subjects').orderBy('order', 'asc').get(), 'CacheSubjects'),
          runFirestoreOp(dbInstance => dbInstance.collection('topics').orderBy('order', 'asc').get(), 'CacheTopics')
        ]);

        const subjects = subjectsSnap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
        const topics = topicsSnap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));

        contentCache.subjects = subjects;
        contentCache.topics = topics;
        contentCache.lastUpdated = Date.now();
        
        console.log(`[Cache] Successfully cached ${subjects.length} subjects and ${topics.length} topics. (Reads: ${subjects.length + topics.length})`);
        
        // Update global usage tracker with these reads
        usageTracker.reads += (subjects.length + topics.length);
      } catch (err: any) {
        console.error('[Cache] Failed to refresh content cache:', err.message);
      } finally {
        contentCache.isRefreshing = false;
        activeRefreshPromise = null;
      }
    })();
    return activeRefreshPromise;
  };

  // Initial refresh
  refreshContentCache().catch(console.error);
  
  // Refresh every 10 minutes
  setInterval(refreshContentCache, 1000 * 60 * 10);

  // Startup verification
  const startupTest = async () => {
    try {
      console.log('[Startup] Testing Firestore connection...');
      await runFirestoreOp(dbInstance => dbInstance.collection('_health').doc('startup').set({
        timestamp: new Date().toISOString(),
        env: process.env.NODE_ENV
      }), 'StartupTest');
      console.log('✅ [Startup] Firestore write test passed.');
    } catch (err: any) {
      console.error('❌ [Startup] Firestore connection test failed:', err.message);
    }
  };
  startupTest();

  app.use(express.json());

  // API: Get all cached content
  app.get('/api/content/all', async (req, res) => {
    const clientLastUpdated = parseInt(req.query.lastUpdated as string || '0');

    // Wait if cache is currently refreshing
    if (activeRefreshPromise) {
      await activeRefreshPromise;
    }

    // If cache is empty, try to refresh once before responding
    if (contentCache.subjects.length === 0) {
      try {
        await refreshContentCache();
      } catch (err) {
        return res.status(500).json({ error: 'Cache is empty and refresh failed' });
      }
    }

    // Check if client version is still valid
    if (clientLastUpdated >= contentCache.lastUpdated && contentCache.lastUpdated > 0) {
      return res.json({ status: 'unchanged', lastUpdated: contentCache.lastUpdated });
    }

    res.json({
      subjects: contentCache.subjects,
      topics: contentCache.topics,
      lastUpdated: contentCache.lastUpdated
    });
  });

  // API: Force refresh content cache (Admin only)
  app.post('/api/admin/refresh-cache', async (req, res) => {
    const { userId } = req.body;
    const isAdmin = await checkIsAdmin(userId);
    if (!isAdmin) return res.status(403).json({ error: 'Unauthorized' });

    try {
      await refreshContentCache();
      res.json({ 
        success: true, 
        subjectsCount: contentCache.subjects.length, 
        topicsCount: contentCache.topics.length,
        lastUpdated: contentCache.lastUpdated
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to refresh cache' });
    }
  });
  // ---------------------------

  // API: Health Check
  app.get('/api/health', async (req, res) => {
    let firebaseStatus = 'unknown';
    let databaseId = 'unknown';
    let projectId = 'unknown';
    let saEmail = 'unknown';
    
    try {
      projectId = admin.app().options.projectId || 'none';
      databaseId = (db as any)._settings?.databaseId || (db as any).databaseId || 'default';
      
      const sa = process.env.FIREBASE_SERVICE_ACCOUNT ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT) : null;
      saEmail = sa ? sa.client_email : 'none';

      // Small check to see if Firestore is responsive
      const testSnap = await db.collection('_health').limit(1).get().catch((e) => {
        console.error('[Health Check] Firestore test failed:', e.message);
        return { error: e.message };
      });
      
      if ((testSnap as any).error) {
        firebaseStatus = `error: ${(testSnap as any).error}`;
      } else {
        firebaseStatus = 'connected';
      }
    } catch (e: any) {
      firebaseStatus = `init_error: ${e.message}`;
    }

    res.json({ 
      status: 'ok', 
      env: process.env.NODE_ENV,
      firebase: firebaseStatus,
      project: projectId,
      database: databaseId,
      serviceAccount: saEmail,
      hasServiceAccountInEnv: !!process.env.FIREBASE_SERVICE_ACCOUNT,
      uptime: Math.floor((Date.now() - usageTracker.startTime) / 1000) + 's'
    });
  });

  app.post('/api/report-usage', (req, res) => {
    const { reads = 0 } = req.body;
    usageTracker.reads += reads;
    
    // Asynchronously check threshold
    checkAndNotifyUsage().catch(console.error);
    
    res.json({ status: 'ok', tracked: usageTracker.reads });
  });

  // API: Report Client-Side Error
  app.post('/api/report-error', async (req, res) => {
    const { message, stack, url, userAgent, userId, source, lineno, colno, type } = req.body;
    
    const isQuotaError = message?.toLowerCase().includes('quota') || message?.toLowerCase().includes('insufficient permissions');
    
    await sendTelegramNotification(
      `${isQuotaError ? '🚨 <b>CRITICAL: FIREBASE QUOTA' : '🚨 <b>Client-Side Crash'} Detected</b>\n\n` +
      `👤 <b>User:</b> <code>${escapeHTML(userId) || 'Guest'}</code>\n` +
      `🛑 <b>Error:</b> <i>${escapeHTML(message) || 'Unknown'}</i>\n` +
      `🌐 <b>URL:</b> <code>${escapeHTML(url) || 'Unknown'}</code>\n` +
      `📱 <b>UA:</b> <code>${escapeHTML(userAgent) || 'Unknown'}</code>\n` +
      (source ? `📍 <b>Source:</b> <code>${escapeHTML(source)}:${lineno}:${colno}</code>\n` : '') +
      (type ? `🏷️ <b>Type:</b> <code>${escapeHTML(type)}</code>\n` : '') +
      `\n<b>Trace:</b>\n<pre>${escapeHTML((stack || '').substring(0, 500))}...</pre>`
    ).catch(() => {});

    res.json({ status: 'ok' });
  });

  // Helper to validate coupon
  const validateCoupon = async (code: string, productType: string) => {
    const normalizedCode = code.toUpperCase().trim();

    // HARDCODED VALIDATION FOR PRECALL10
    if (normalizedCode === 'PRECALL10') {
      if (productType !== 'premium') {
        return { valid: false, error: 'This coupon code is valid only for Premium Upgrade' };
      }
      return {
        valid: true,
        code: 'PRECALL10',
        type: 'percentage',
        discountPercentage: 10,
        description: 'Hardcoded 10% Discount'
      };
    }

    try {
      const couponSnap = await runFirestoreOp(dbInstance => dbInstance.collection('coupons')
        .where('code', '==', normalizedCode)
        .where('isActive', '==', true)
        .limit(1)
        .get(), 'ValidateCoupon');

      if (couponSnap.empty) {
        return { valid: false, error: 'Invalid or inactive coupon code' };
      }

      const couponData = couponSnap.docs[0].data();
      if (couponData.expiresAt && new Date(couponData.expiresAt) < new Date()) {
        return { valid: false, error: 'Coupon has expired' };
      }
      if (couponData.maxUsage && (couponData.usageCount || 0) >= couponData.maxUsage) {
        return { valid: false, error: 'Coupon usage limit reached' };
      }

      return {
        valid: true,
        code: couponData.code,
        type: couponData.type,
        discountAmount: couponData.discountAmount,
        discountPercentage: couponData.discountPercentage
      };
    } catch (error) {
      return { valid: false, error: 'Failed to validate coupon' };
    }
  };

  // API: Validate Coupon
  app.post('/api/validate-coupon', async (req, res) => {
    const { code, productType } = req.body;
    if (!code) return res.status(400).json({ error: 'Coupon code is required' });

    const result = await validateCoupon(code, productType);
    if (!result.valid) {
      return res.status(400).json({ error: result.error });
    }
    res.json(result);
  });

  // API: Config
  app.get('/api/config', (req, res) => {
    const keyId = process.env.VITE_RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID || process.env.RAZORPAY_LIVE_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET || process.env.RAZORPAY_LIVE_KEY_SECRET;
    
    console.log(`[Config] Serving Razorpay Key ID: ${keyId ? keyId.substring(0, 8) + '...' : 'MISSING'}`);
    res.json({
      razorpayKeyId: keyId,
      hasKeySecret: !!keySecret,
      env: process.env.NODE_ENV || 'development'
    });
  });

  // API: Proxy Upload to Storage (Bypass CORS issues)
  app.post('/api/upload', upload.single('file'), async (req: any, res) => {
    try {
      const { userId, folder = 'uploads' } = req.body;
      const file = req.file;
      const authHeader = req.headers.authorization;

      if (!file) {
        console.error('[Upload Proxy] No file received');
        return res.status(400).json({ error: 'No file uploaded' });
      }

      console.log(`[Upload Proxy] Request starting for userId: ${userId}, file: ${file.originalname}`);

      // Admin verification
      let isAdmin = false;

      // Priority 1: Token verification
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split('Bearer ')[1];
        try {
          const decodedToken = await admin.auth().verifyIdToken(token);
          if (ADMIN_EMAILS.includes(decodedToken.email || '')) {
            console.log(`[Upload Proxy] Admin verified via ID token: ${decodedToken.email}`);
            isAdmin = true;
          }
        } catch (tokenErr: any) {
          console.warn('[Upload Proxy] Token verification failed:', tokenErr.message);
        }
      }

      // Priority 2: Fallback to UID check
      if (!isAdmin && userId) {
        isAdmin = await checkIsAdmin(userId);
      }

      if (!isAdmin) {
        console.warn(`[Upload Proxy] Permission denied for ${userId}. Identity Toolkit API might be disabled.`);
        return res.status(403).json({ error: 'Only authorized admins can upload files' });
      }

      const configBucket = (admin.app().options as any).storageBucket;
      const bucket = admin.storage().bucket(configBucket);
      
      if (!bucket.name) {
        console.error('[Upload Proxy] Storage bucket name is missing');
        return res.status(500).json({ error: 'Storage not configured properly on server' });
      }

      const fileName = `${folder}/${Date.now()}-${file.originalname.replace(/\s+/g, '_')}`;
      const blob = bucket.file(fileName);

      console.log(`[Upload Proxy] Uploading to bucket: ${bucket.name}, path: ${fileName}`);

      // Using blob.save instead of createWriteStream for more reliability
      await blob.save(file.buffer, {
        metadata: {
          contentType: file.mimetype,
        },
        resumable: false
      });

      console.log(`[Upload Proxy] File saved. Attempting to get public URL...`);

      try {
        // Attempt to make public, ignore if it fails (bucket might be Uniform bucket-level access)
        await blob.makePublic();
      } catch (pubErr) {
        console.warn('[Upload Proxy] makePublic failed, likely Uniform access or permission restriction');
      }

      const publicUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;
      console.log(`[Upload Proxy] FINAL SUCCESS: ${publicUrl}`);
      res.json({ url: publicUrl });

    } catch (err: any) {
      console.error('[Upload Proxy] FATAL ERROR:', err);
      res.status(500).json({ 
        error: 'Upload proxy failed', 
        details: err.message,
        code: err.code 
      });
    }
  });

  // API: Create Order
  app.post('/api/create-order', async (req, res) => {
    console.log('[Order] Request received:', JSON.stringify(req.body));
    const { amount, couponCode, productType, productSlugs, productSlug, userId } = req.body;
    let finalAmount = amount; // default to what client sent, but we will verify for PDFs

    // Normalizing slugs if single one sent
    const actualSlugs = productSlugs || (productSlug ? [productSlug] : []);

    // Verify Amount for PDF/Bundle to prevent manipulation
    if (productType === 'pdf' || productType === 'pdf_bundle') {
      try {
        const settingsSnap = await runFirestoreOp(dbInstance => dbInstance.collection('settings').doc('global').get(), 'GetPriceSettings');
        const settingsData = settingsSnap.data();
        const serverUnitPrice = parseInt(settingsData?.pdfPrice || '199');
        
        const count = productType === 'pdf' ? 1 : (actualSlugs?.length || 0);
        if (count === 0 && productType === 'pdf_bundle') return res.status(400).json({ error: 'No items selected' });
        
        // Base amount in paise
        const unitPrice = isNaN(serverUnitPrice) ? 199 : serverUnitPrice;
        finalAmount = count * unitPrice * 100;
        console.log(`[Payment] Server-calculated amount for ${count} PDFs: ${finalAmount} paise`);
      } catch (err) {
        console.error('Price fetch error:', err);
      }
    } else if (productType === 'premium') {
      try {
        const settingsSnap = await runFirestoreOp(dbInstance => dbInstance.collection('settings').doc('global').get(), 'GetPremiumPrice');
        const settingsData = settingsSnap.data();
        const priceStr = settingsData?.price || '999';
        const serverPremiumPrice = parseInt(priceStr.toString().replace(/,/g, ''));
        
        const premiumPrice = isNaN(serverPremiumPrice) ? 999 : serverPremiumPrice;
        finalAmount = premiumPrice * 100;
        console.log(`[Payment] Server-calculated premium amount: ${finalAmount} paise`);
      } catch (err) {
        console.error('[Payment] Error fetching premium price:', err);
        finalAmount = 99900; // fallback to 999 INR
      }
    }

    // Fallback if finalAmount is still NaN or invalid
    if (isNaN(finalAmount) || finalAmount <= 0) {
      finalAmount = amount || 99900;
      console.warn(`[Payment] finalAmount was invalid (${finalAmount}), using client amount or fallback`);
    }

    // Strict rule: No coupon discounts for PDF bundles
    const isBundle = productType === 'pdf_bundle';

    // --- COUPON LOGIC ---
    if (couponCode) {
      const couponResult = await validateCoupon(couponCode, productType);
      
      if (couponResult.valid) {
        console.log(`[Payment] Applying coupon ${couponCode} for ${productType} (User: ${userId})`);
        const amountInRupees = finalAmount / 100;
        let discountedRupees = amountInRupees;

        if (couponResult.type === 'percentage') {
          discountedRupees = Math.round(amountInRupees * (1 - (couponResult.discountPercentage || 0) / 100));
        } else if (couponResult.type === 'flat') {
          discountedRupees = Math.max(0, amountInRupees - (couponResult.discountAmount || 0));
        }

        finalAmount = discountedRupees * 100;
        console.log(`[Payment] Original: ${amountInRupees} INR -> Discounted: ${discountedRupees} INR`);
      } else {
        console.warn(`[Payment] Coupon validation failed for ${couponCode}: ${couponResult.error}`);
        // Proceed with full price if coupon is invalid (as per user preference not to break flow)
      }
    }
    // ------------------------------

    const keyId = (process.env.VITE_RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID || process.env.RAZORPAY_LIVE_KEY_ID)?.trim();
    const keySecret = (process.env.RAZORPAY_KEY_SECRET || process.env.RAZORPAY_LIVE_KEY_SECRET)?.trim();

    console.log(`[Payment] Final calculated amount: ${finalAmount} paise`);
    let integerAmount = Math.round(finalAmount);
    
    if (isNaN(integerAmount)) {
      console.error('[Payment] Amount is NaN, using fallback');
      integerAmount = 99900;
    }

    if (!keyId || !keySecret) {
      console.error('[Payment] Razorpay keys missing in environment');
      return res.status(500).json({ error: 'Payment system not configured on server' });
    }

    try {
      const razorpay = new Razorpay({
        key_id: keyId,
        key_secret: keySecret,
      });

      console.log(`[Payment] Razorpay instance initialized. Calling razorpay.orders.create for amount: ${integerAmount}...`);

      const order = await razorpay.orders.create({
        amount: integerAmount, // MUST be integer
        currency: "INR",
        receipt: `receipt_${Date.now()}`,
      });

      console.log(`[Payment] Order created successfully: ${order.id}`);
      res.json(order);
    } catch (error: any) {
      console.error('[Payment] Error creating Razorpay order:', error);
      
      // Notify admin of payment failure
      await notifyFailure('Order Creation Failed', error, {
        amount,
        finalAmount,
        productType,
        couponCode,
        keyId: keyId.substring(0, 8) + '...'
      });

      res.status(500).json({ 
        error: 'Failed to create order', 
        details: error.message,
        code: error.code 
      });
    }
  });

  // API: Verify Payment
  app.post('/api/verify-payment', async (req, res) => {
    const { 
      razorpay_payment_id, 
      razorpay_order_id, 
      razorpay_signature,
      userId,
      productType = 'premium', // 'premium', 'pdf', or 'pdf_bundle'
      productSlug = null,      // if productType is 'pdf'
      productSlugs = []        // if productType is 'pdf_bundle'
    } = req.body;

    const keySecret = process.env.RAZORPAY_KEY_SECRET || process.env.RAZORPAY_LIVE_KEY_SECRET;

    if (!keySecret) {
      console.error('RAZORPAY_KEY_SECRET missing during verification');
      return res.status(500).json({ error: 'Payment verification not configured on server' });
    }

    // Verify signature
    const generated_signature = crypto
      .createHmac('sha256', keySecret)
      .update(razorpay_order_id + "|" + razorpay_payment_id)
      .digest('hex');

    if (generated_signature === razorpay_signature) {
      try {
        console.log(`[Payment] Signature verified for user: ${userId}. Product: ${productType} ${productSlug || productSlugs.join(',')}. Updating Firestore...`);
        
        const updateData: any = {
          premiumPaymentId: razorpay_payment_id,
          premiumOrderId: razorpay_order_id,
          lastPaymentAt: new Date().toISOString()
        };

        let notificationTitle = 'Payment Verified! ✅';
        let notificationMessage = 'Your payment was verified. Access granted!';

        if (productType === 'premium') {
          updateData.isPremium = true;
          updateData.premiumActivatedAt = new Date().toISOString();
          notificationTitle = 'Premium Activated! 👑';
          notificationMessage = 'Your payment was verified. You now have full access to everything!';
        } else if (productType === 'pdf' && productSlug) {
          updateData.ownedPdfs = FieldValue.arrayUnion(productSlug);
          notificationTitle = 'PDF Unlocked! 📄';
          notificationMessage = `You have successfully purchased the high-yield PDF for ${productSlug}.`;
        } else if (productType === 'pdf_bundle' && productSlugs.length > 0) {
          updateData.ownedPdfs = FieldValue.arrayUnion(...productSlugs);
          notificationTitle = 'PDF Bundle Unlocked! 📚';
          notificationMessage = `You have successfully purchased ${productSlugs.length} high-yield PDFs.`;
        }

        // Update user status in Firestore
        await runFirestoreOp(dbInstance => dbInstance.collection('users').doc(userId).set(updateData, { merge: true }), 'UpdateUserPaymentStatus');

        // Increment coupon usage if provided
        const { couponCode } = req.body;
        if (couponCode) {
          try {
            const couponSnap = await runFirestoreOp(dbInstance => dbInstance.collection('coupons')
              .where('code', '==', couponCode.toUpperCase())
              .limit(1)
              .get(), 'GetCouponForIncrement');
            
            if (!couponSnap.empty) {
              const couponDoc = couponSnap.docs[0];
              await runFirestoreOp(_ => couponDoc.ref.update({
                usageCount: FieldValue.increment(1),
                updatedAt: new Date().toISOString()
              }), 'IncrementCoupon');
              console.log(`[Payment] Coupon ${couponCode} usage incremented.`);
            }
          } catch (err) {
            console.error('[Payment] Error incrementing coupon usage:', err);
          }
        }

        // Add notification
        await runFirestoreOp(dbInstance => dbInstance.collection('notifications').add({
          userId: userId,
          title: notificationTitle,
          message: notificationMessage,
          type: productType === 'premium' ? 'premium' : 'welcome',
          createdAt: new Date().toISOString()
        }), 'AddPaymentNotification');

        // Get Summary for Telegram Update
        const premiumSnap = await runFirestoreOp(dbInstance => dbInstance.collection('users').where('isPremium', '==', true).count().get(), 'GetTotalPremiumCount');
        const totalPremium = premiumSnap.data().count;

        // Notify via Telegram
        await sendTelegramNotification(
          `💰 <b>New ${productType === 'premium' ? 'Premium' : 'PDF'} Purchase!</b>\n\n` +
          `👤 <b>User ID:</b> <code>${escapeHTML(userId)}</code>\n` +
          `📄 <b>Item:</b> ${productType === 'premium' ? 'Full Access' : `PDF: ${escapeHTML(productSlug || String(productSlugs))}`}\n` +
          `💳 <b>Order:</b> <code>${escapeHTML(razorpay_order_id)}</code>\n` +
          `📈 <b>Total Premium:</b> ${totalPremium}\n\n` +
          `<i>App: PreCall Revision</i>`
        );

        res.json({ status: 'ok', message: 'Payment verified and status updated' });
      } catch (error) {
        console.error('Error updating premium status:', error);
        
        await notifyFailure('Payment Verification Update Failed', error, {
          userId,
          paymentId: razorpay_payment_id,
          productType
        });

        res.status(500).json({ error: 'Failed to update premium status' });
      }
    } else {
      await notifyFailure('Invalid Payment Signature', 'Verification failed', {
        orderId: razorpay_order_id,
        paymentId: razorpay_payment_id
      });
      res.status(400).json({ error: 'Invalid signature' });
    }
  });

    // Vite middleware for development
    if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
      console.log('🚀 Starting Vite in middleware mode...');
      const { createServer: createViteServer } = await import('vite');
      const vite = await createViteServer({
        root: process.cwd(),
        server: { middlewareMode: true },
        appType: 'spa',
      });
      app.use(vite.middlewares);

      // Final catch-all for SPA fallback (Express 5 compatible)
      app.get('*all', async (req, res, next) => {
        // Skip if path starts with /api
        if (req.path.startsWith('/api')) return next();

        try {
          const url = req.url || '/';
          console.log(`[SPA Fallback] Serving index.html (Dev) for: ${url}`);
          let template = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf-8');
          template = await vite.transformIndexHtml(url, template);
          res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
        } catch (e) {
          vite.ssrFixStacktrace(e as Error);
          next(e);
        }
      });
    } else {
      console.log('📦 Serving production assets from dist...');
      const distPath = path.join(process.cwd(), 'dist');
      app.use(express.static(distPath));
      
      app.get('*all', (req, res) => {
        if (req.path.startsWith('/api')) return res.status(404).json({ error: 'API route not found' });
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }

  if (!process.env.VERCEL) {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  }

  // Global Error Handler
  app.use((err: any, req: any, res: any, next: any) => {
    console.error('[Global Error]', err);
    
    // Notify via Telegram on critical errors
    sendTelegramNotification(
      `⚠️ <b>Server Error Detected</b>\n\n` +
      `📌 <b>Path:</b> <code>${escapeHTML(req.path)}</code>\n` +
      `🛑 <b>Error:</b> <i>${escapeHTML(err.message || 'Unknown error')}</i>\n\n` +
      `🚀 <i>Check context logs for details.</i>`
    ).catch(() => {});

    res.status(500).json({
      error: 'Internal Server Error',
      details: err.message || 'Unknown error'
    });
  });

  // help handle escaping for Telegram HTML mode
  // (Moved up)

  // Test Telegram on Startup
  try {
    const settingsSnap = await runFirestoreOp(dbInstance => dbInstance.collection('settings').doc('global').get(), 'StartupSettings');
    const appName = settingsSnap.exists ? settingsSnap.data()?.appName : 'PreCall';
    
    sendTelegramNotification(`🚀 <b>${escapeHTML(appName || 'PreCall')} Server Started</b>\nEnvironment: <code>${process.env.NODE_ENV || 'development'}</code>`).catch(() => {});
  } catch (err) {
    console.error('Failed to send startup notification:', err);
    sendTelegramNotification(`🚀 <b>PreCall Server Started</b>\nEnvironment: <code>${process.env.NODE_ENV || 'development'}</code>`).catch(() => {});
  }

  return app;
}

// Vercel Serverless Function Handler
let cachedApp: any;
export default async function handler(req: any, res: any) {
  const requestId = Date.now().toString(36);
  console.log(`[${requestId}] [Vercel] Incoming request: ${req.method} ${req.url}`);
  
  try {
    if (!cachedApp) {
      console.log(`[${requestId}] [Vercel] Initializing app instance...`);
      cachedApp = await startServer();
      console.log(`[${requestId}] [Vercel] App initialization complete.`);
    }
    
    // Check if we are running in a state where we can handle requests
    if (!cachedApp) {
      throw new Error('Express app failed to initialize');
    }

    // Direct handle via Express instance
    return cachedApp(req, res);
  } catch (error: any) {
    console.error(`[${requestId}] [Vercel] Critical Handler Error:`, error);
    res.status(500).json({ 
      error: 'Server failed to start or handle request', 
      details: error.message,
      requestId 
    });
  }
}

// Start the server immediately if not in production
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  startServer().catch(err => {
    console.error("Critical error during server startup:", err);
  });
}
