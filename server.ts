import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
// @ts-ignore
import RazorpayPkg from 'razorpay';
const Razorpay = (RazorpayPkg as any).default || RazorpayPkg;

import crypto from 'crypto';
// @ts-ignore
import admin from 'firebase-admin';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import fs from 'fs';
import fetch from 'node-fetch';

import multer from 'multer';
const upload = multer({ storage: multer.memoryStorage() });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

  // Initialize Firebase Admin
  let firestoreDatabaseId: string | undefined;
  
  try {
    if (admin.apps.length === 0) {
      const configPath = path.join(__dirname, 'firebase-applet-config.json');
      let config: any = {};
      
      if (fs.existsSync(configPath)) {
        try {
          config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
          firestoreDatabaseId = config.firestoreDatabaseId;
        } catch (e) {
          console.error('Failed to parse firebase-applet-config.json:', e);
        }
      }

      // Priority 1: Service Account
      if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        try {
          const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
          admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            databaseURL: `https://${serviceAccount.project_id}.firebaseio.com`,
            storageBucket: config.storageBucket || `${serviceAccount.project_id}.firebasestorage.app`
          });
          console.log('✅ Firebase Admin initialized via Service Account');
        } catch (parseError) {
          console.error('❌ Failed to parse FIREBASE_SERVICE_ACCOUNT:', parseError);
          admin.initializeApp();
        }
      } 
      // Priority 2: Local Config (for development)
      else if (config.projectId) {
        admin.initializeApp({
          projectId: config.projectId,
          storageBucket: config.storageBucket
        });
        console.log('✅ Firebase Admin initialized via local config');
      } 
      // Priority 3: Default Environment (Cloud/AI Studio)
      else {
        admin.initializeApp();
        console.log('✅ Firebase Admin initialized via default credentials');
      }
    }
  } catch (error) {
    console.error('Firebase Admin initialization error:', error);
  }

  // Use the specific database ID if available, otherwise default
  // We wrap db to be able to fallback if permission denied
  let db = firestoreDatabaseId ? getFirestore(admin.app(), firestoreDatabaseId) : getFirestore(admin.app());
  console.log(`✅ Firestore initialized (Database: ${firestoreDatabaseId || '(default)'})`);

  // Help function for Telegram Notifications
  const sendTelegramNotification = async (message: string) => {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    
    if (!token || !chatId) {
      console.log('⚠️ Telegram notification skipped: TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not found in environment.');
      return;
    }

    try {
      const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: 'HTML'
        })
      });

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
    
    const adminEmails = ['precall.admin@gmail.com', 'precall.founder@gmail.com'];

    // Part A: Firestore Check
    const tryFirestoreCheck = async (dbInstance: any, label: string) => {
      try {
        const userDoc = await dbInstance.collection('users').doc(userId).get();
        if (userDoc.exists) {
          const userData = userDoc.data();
          console.log(`[Admin Check ${label}] Found user profile. Role: ${userData?.role}, Email: ${userData?.email}`);
          if (userData?.role === 'admin' || adminEmails.includes(userData?.email)) return true;
        }
      } catch (err: any) {
        console.warn(`[Admin Check ${label}] Failed for ${userId}:`, err.message || err);
      }
      return false;
    };

    // 1. Try with primary db
    if (await tryFirestoreCheck(db, 'Primary')) return true;

    // 2. If primary db failed or didn't find, try default db (if primary was specific)
    if (firestoreDatabaseId) {
      const defaultDb = getFirestore(admin.app());
      if (await tryFirestoreCheck(defaultDb, 'Default')) return true;
    }

    // Part B: Firebase Auth (Fallback)
    try {
      const user = await admin.auth().getUser(userId);
      console.log(`[Admin Check Auth] Email: ${user.email}`);
      if (adminEmails.includes(user.email)) return true;
    } catch (authErr: any) {
      console.warn(`[Admin Check Auth] Failed for ${userId}:`, authErr.message || authErr);
      // NOTE: Identity Toolkit API might be disabled, causing this to fail
    }
    
    console.warn(`[Admin Check] Denying access for ${userId} - no admin verification succeeded.`);
    return false;
  };

  // Seed Razorpay Test Account
  const seedRazorpayTestAccount = async () => {
    // Skip seeding on Vercel/Production to prevent timeouts and unnecessary writes
    if (process.env.NODE_ENV === 'production' || !process.env.VITE) {
      return;
    }
    
    const testEmail = 'razorpaytest.precall@gmail.com';
    const testPassword = 'razorpay999';
    const logPath = path.join(__dirname, 'seed-log.txt');
    
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
          await db.collection('users').doc(userRecord.uid).set({
            uid: userRecord.uid,
            email: testEmail,
            displayName: 'Razorpay Tester',
            role: 'user',
            isPremium: false,
            createdAt: new Date().toISOString()
          }, { merge: true });
          
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

  app.use(express.json());

  // API: Health Check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', env: process.env.NODE_ENV });
  });

  // API: Report Client-Side Error
  app.post('/api/report-error', async (req, res) => {
    const { message, stack, url, userAgent, userId } = req.body;
    
    await sendTelegramNotification(
      `🚨 <b>Client-Side Crash Detected</b>\n\n` +
      `👤 <b>User:</b> <code>${userId || 'Guest'}</code>\n` +
      `🛑 <b>Error:</b> <i>${message || 'Unknown'}</i>\n` +
      `🌐 <b>URL:</b> <code>${url || 'Unknown'}</code>\n` +
      `📱 <b>UA:</b> <code>${userAgent || 'Unknown'}</code>\n\n` +
      `<b>Trace:</b>\n<pre>${(stack || '').substring(0, 500)}...</pre>`
    ).catch(() => {});

    res.json({ status: 'ok' });
  });

  // API: Validate Coupon
  app.post('/api/validate-coupon', async (req, res) => {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: 'Coupon code is required' });

    try {
      const couponSnap = await db.collection('coupons')
        .where('code', '==', code.toUpperCase())
        .where('isActive', '==', true)
        .limit(1)
        .get();

      if (couponSnap.empty) {
        return res.status(404).json({ error: 'Invalid or inactive coupon code' });
      }

      const couponData = couponSnap.docs[0].data();
      if (couponData.expiresAt && new Date(couponData.expiresAt) < new Date()) {
        return res.status(400).json({ error: 'Coupon has expired' });
      }
      if (couponData.maxUsage && couponData.usageCount >= couponData.maxUsage) {
        return res.status(400).json({ error: 'Coupon usage limit reached' });
      }

      res.json({
        valid: true,
        code: couponData.code,
        type: couponData.type,
        discountAmount: couponData.discountAmount,
        discountPercentage: couponData.discountPercentage
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to validate coupon' });
    }
  });

  // API: Get Coupons (Admin only)
  app.get('/api/admin/coupons', async (req: any, res) => {
    const { userId } = req.query;
    const authHeader = req.headers.authorization;
    try {
      let isAdmin = false;
      const adminEmails = ['precall.admin@gmail.com', 'precall.founder@gmail.com'];

      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split('Bearer ')[1];
        try {
          const decodedToken = await admin.auth().verifyIdToken(token);
          if (adminEmails.includes(decodedToken.email || '')) isAdmin = true;
        } catch (e) {}
      }

      if (!isAdmin && userId) {
        isAdmin = await checkIsAdmin(userId as string);
      }

      if (!isAdmin) {
        return res.status(403).json({ error: 'Unauthorized: Admin access required' });
      }

      const couponsSnap = await db.collection('coupons').orderBy('createdAt', 'desc').get();
      const coupons = couponsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      res.json(coupons);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch coupons' });
    }
  });

  // API: Upsert Coupon (Admin only)
  app.post('/api/admin/coupons', async (req, res) => {
    const { userId, coupon } = req.body;
    const authHeader = req.headers.authorization;
    try {
      let isAdmin = false;
      const adminEmails = ['precall.admin@gmail.com', 'precall.founder@gmail.com'];

      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split('Bearer ')[1];
        try {
          const decodedToken = await admin.auth().verifyIdToken(token);
          if (adminEmails.includes(decodedToken.email || '')) isAdmin = true;
        } catch (e) {}
      }

      if (!isAdmin && userId) {
        isAdmin = await checkIsAdmin(userId);
      }

      if (!isAdmin) {
        return res.status(403).json({ error: 'Unauthorized: Admin access required' });
      }

      const couponId = coupon.id || db.collection('coupons').doc().id;
      const data = {
        ...coupon,
        code: coupon.code.toUpperCase(),
        updatedAt: new Date().toISOString(),
        createdAt: coupon.createdAt || new Date().toISOString(),
        usageCount: coupon.usageCount || 0
      };
      delete data.id;

      await db.collection('coupons').doc(couponId).set(data, { merge: true });
      res.json({ id: couponId, ...data });
    } catch (error) {
      res.status(500).json({ error: 'Failed to save coupon' });
    }
  });

  // API: Config
  app.get('/api/config', (req, res) => {
    const keyId = process.env.VITE_RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID || process.env.RAZORPAY_LIVE_KEY_ID;
    console.log(`[Config] Serving Razorpay Key ID: ${keyId ? keyId.substring(0, 8) + '...' : 'MISSING'}`);
    res.json({
      razorpayKeyId: keyId
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
      const adminEmails = ['precall.admin@gmail.com', 'precall.founder@gmail.com'];

      // Priority 1: Token verification
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split('Bearer ')[1];
        try {
          const decodedToken = await admin.auth().verifyIdToken(token);
          if (adminEmails.includes(decodedToken.email || '')) {
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
    const { amount, couponCode, productType, productSlugs } = req.body;
    let finalAmount = amount; // default to what client sent, but we will verify for PDFs

    // Verify Amount for PDF/Bundle to prevent manipulation
    if (productType === 'pdf' || productType === 'pdf_bundle') {
      try {
        const settingsSnap = await db.collection('settings').doc('global').get();
        const settingsData = settingsSnap.data();
        const serverUnitPrice = parseInt(settingsData?.pdfPrice || '199');
        
        const count = productType === 'pdf' ? 1 : (productSlugs?.length || 0);
        if (count === 0) return res.status(400).json({ error: 'No items selected' });
        
        // Base amount in paise
        finalAmount = count * serverUnitPrice * 100;
        console.log(`[Payment] Server-calculated amount for ${count} PDFs: ${finalAmount} paise`);
      } catch (err) {
        console.error('Price fetch error:', err);
      }
    } else if (productType === 'premium') {
      try {
        const settingsSnap = await db.collection('settings').doc('global').get();
        const settingsData = settingsSnap.data();
        const serverPremiumPrice = parseInt(settingsData?.price?.replace(/,/g, '') || '999');
        finalAmount = serverPremiumPrice * 100;
      } catch (err) {}
    }

    // Strict rule: No coupon discounts for PDF bundles
    const isBundle = productType === 'pdf_bundle';

    if (couponCode && !isBundle) {
      try {
        const couponSnap = await db.collection('coupons')
          .where('code', '==', couponCode.toUpperCase())
          .where('isActive', '==', true)
          .limit(1)
          .get();

        if (!couponSnap.empty) {
          const couponData = couponSnap.docs[0].data();
          const isValid = !couponData.expiresAt || new Date(couponData.expiresAt) > new Date();
          const underLimit = !couponData.maxUsage || couponData.usageCount < couponData.maxUsage;

          if (isValid && underLimit) {
            if (couponData.type === 'flat') {
              const discountPaise = (couponData.discountAmount || 0) * 100;
              finalAmount = Math.max(0, finalAmount - discountPaise);
            } else if (couponData.type === 'percentage') {
              const multiplier = (100 - (couponData.discountPercentage || 0)) / 100;
              finalAmount = Math.round(finalAmount * multiplier);
            }
          }
        }
      } catch (err) {
        console.error('Coupon apply error:', err);
      }
    }

    const keyId = process.env.VITE_RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID || process.env.RAZORPAY_LIVE_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET || process.env.RAZORPAY_LIVE_KEY_SECRET;

    console.log(`[Payment] Attempting to create order for amount: ${amount}`);

    if (!keyId || !keySecret) {
      console.error('[Payment] Razorpay keys missing in environment');
      return res.status(500).json({ error: 'Payment system not configured on server' });
    }

    try {
      const razorpay = new Razorpay({
        key_id: keyId,
        key_secret: keySecret,
      });

      console.log('[Payment] Razorpay instance initialized. Calling razorpay.orders.create...');

      const order = await razorpay.orders.create({
        amount: amount, // already in paise
        currency: "INR",
        receipt: `receipt_${Date.now()}`,
      });

      console.log(`[Payment] Order created successfully: ${order.id}`);
      res.json(order);
    } catch (error: any) {
      console.error('[Payment] Error creating Razorpay order:', error);
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

    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keySecret) {
      console.error('RAZORPAY_KEY_SECRET missing');
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
        
        const userRef = db.collection('users').doc(userId);
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
        await userRef.set(updateData, { merge: true });

        // Increment coupon usage if provided
        const { couponCode } = req.body;
        if (couponCode) {
          try {
            const couponSnap = await db.collection('coupons')
              .where('code', '==', couponCode.toUpperCase())
              .limit(1)
              .get();
            
            if (!couponSnap.empty) {
              const couponRef = couponSnap.docs[0].ref;
              await couponRef.update({
                usageCount: FieldValue.increment(1),
                updatedAt: new Date().toISOString()
              });
              console.log(`[Payment] Coupon ${couponCode} usage incremented.`);
            }
          } catch (err) {
            console.error('[Payment] Error incrementing coupon usage:', err);
          }
        }

        // Add notification
        await db.collection('notifications').add({
          userId: userId,
          title: notificationTitle,
          message: notificationMessage,
          type: productType === 'premium' ? 'premium' : 'welcome',
          createdAt: new Date().toISOString()
        });

        // Get Summary for Telegram Update
        const premiumSnap = await db.collection('users').where('isPremium', '==', true).count().get();
        const totalPremium = premiumSnap.data().count;

        // Notify via Telegram
        await sendTelegramNotification(
          `💰 <b>New ${productType === 'premium' ? 'Premium' : 'PDF'} Purchase!</b>\n\n` +
          `👤 <b>User ID:</b> <code>${escapeHTML(userId)}</code>\n` +
          `📄 <b>Item:</b> ${productType === 'premium' ? 'Full Access' : `PDF: ${escapeHTML(productSlug || '')}`}\n` +
          `💳 <b>Order:</b> <code>${escapeHTML(razorpay_order_id)}</code>\n` +
          `📈 <b>Total Premium:</b> ${totalPremium}\n\n` +
          `<i>App: PreCall Revision</i>`
        );

        res.json({ status: 'ok', message: 'Payment verified and status updated' });
      } catch (error) {
        console.error('Error updating premium status:', error);
        res.status(500).json({ error: 'Failed to update premium status' });
      }
    } else {
      res.status(400).json({ error: 'Invalid signature' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

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
    const settingsSnap = await db.collection('settings').doc('general').get();
    const appName = settingsSnap.exists ? settingsSnap.data()?.appName : 'PreCall';
    
    sendTelegramNotification(`🚀 <b>${escapeHTML(appName || 'PreCall')} Server Started</b>\nEnvironment: <code>${process.env.NODE_ENV || 'development'}</code>`).catch(() => {});
  } catch (err) {
    console.error('Failed to send startup notification:', err);
    sendTelegramNotification(`🚀 <b>PreCall Server Started</b>\nEnvironment: <code>${process.env.NODE_ENV || 'development'}</code>`).catch(() => {});
  }

  return app;
}

// For Vercel, we need to export the app directly if possible, 
// but since we have async setup, we use this wrapper.
let cachedApp: any;
export default async (req: any, res: any) => {
  if (!cachedApp) {
    cachedApp = await startServer();
  }
  return cachedApp(req, res);
};

// Start the server immediately if not in production
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  startServer().catch(err => {
    console.error("Critical error during server startup:", err);
  });
}
