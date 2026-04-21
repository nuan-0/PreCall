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
        config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        firestoreDatabaseId = config.firestoreDatabaseId;
      }

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
      } else if (config.projectId) {
        admin.initializeApp({
          projectId: config.projectId,
          storageBucket: config.storageBucket
        });
        console.log('✅ Firebase Admin initialized via local config');
      } else {
        admin.initializeApp();
        console.log('✅ Firebase Admin initialized via default credentials');
      }
    }
  } catch (error) {
    console.error('Firebase Admin initialization error:', error);
  }

  // Use the specific database ID if available, otherwise default
  const db = firestoreDatabaseId ? getFirestore(admin.app(), firestoreDatabaseId) : getFirestore(admin.app());
  console.log(`✅ Firestore initialized (Database: ${firestoreDatabaseId || '(default)'})`);

  // Help function for Telegram Notifications
  const sendTelegramNotification = async (message: string) => {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    
    if (!token || !chatId) return;

    try {
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: 'HTML'
        })
      });
    } catch (err) {
      console.error('Failed to send Telegram notification:', err);
    }
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

      if (!file) {
        console.error('[Upload Proxy] No file received');
        return res.status(400).json({ error: 'No file uploaded' });
      }

      console.log(`[Upload Proxy] Received ${file.originalname} (${file.size} bytes) for user: ${userId}`);

      // Basic Admin Check
      const user = await admin.auth().getUser(userId);
      if (user.email !== 'precall.admin@gmail.com') {
        console.warn(`[Upload Proxy] Permission denied for ${user.email}`);
        return res.status(403).json({ error: 'Only authorized admins can upload files' });
      }

      const bucketName = (admin.app().options as any).storageBucket;
      const bucket = admin.storage().bucket(bucketName);
      const fileName = `${folder}/${Date.now()}-${file.originalname.replace(/\s+/g, '_')}`;
      const blob = bucket.file(fileName);

      console.log(`[Upload Proxy] Target bucket: ${bucket.name}, File: ${fileName}`);

      // Using blob.save instead of createWriteStream for more reliability
      await blob.save(file.buffer, {
        metadata: {
          contentType: file.mimetype,
        }
      });

      try {
        // Attempt to make public, ignore if it fails (bucket might be Uniform bucket-level access)
        await blob.makePublic();
      } catch (pubErr) {
        console.warn('[Upload Proxy] makePublic failed, likely Uniform access or permission restriction');
      }

      const publicUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;
      console.log(`[Upload Proxy] Upload successfully processed: ${publicUrl}`);
      res.json({ url: publicUrl });

    } catch (err: any) {
      console.error('[Upload Proxy] Catch error:', err);
      res.status(500).json({ error: 'Upload proxy failed', details: err.message });
    }
  });

  // API: Create Order
  app.post('/api/create-order', async (req, res) => {
    const { amount } = req.body;
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
          `👤 <b>User ID:</b> <code>${userId}</code>\n` +
          `📄 <b>Item:</b> ${productType === 'premium' ? 'Full Access' : `PDF: ${productSlug}`}\n` +
          `💳 <b>Order:</b> <code>${razorpay_order_id}</code>\n` +
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
      `📌 <b>Path:</b> <code>${req.path}</code>\n` +
      `🛑 <b>Error:</b> <i>${err.message || 'Unknown error'}</i>\n\n` +
      `🚀 <i>Check Vercel logs for details.</i>`
    ).catch(() => {});

    res.status(500).json({
      error: 'Internal Server Error',
      details: err.message || 'Unknown error'
    });
  });

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
