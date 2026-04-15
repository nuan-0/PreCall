import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
// @ts-ignore
import Razorpay from 'razorpay';
import crypto from 'crypto';
// @ts-ignore
import admin from 'firebase-admin';
import fs from 'fs';

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
  try {
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
    } else {
      const configPath = path.join(__dirname, 'firebase-applet-config.json');
      if (fs.existsSync(configPath)) {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        admin.initializeApp({
          projectId: config.projectId
        });
      } else {
        admin.initializeApp();
      }
    }
  } catch (error) {
    console.error('Firebase Admin initialization error:', error);
  }

  const db = admin.firestore();

  // Seed Razorpay Test Account
  const seedRazorpayTestAccount = async () => {
    const testEmail = 'razorpaytest.precall@gmail.com';
    const testPassword = 'razorpay999';
    const logPath = path.join(__dirname, 'seed-log.txt');
    
    const log = (msg: string) => {
      const entry = `${new Date().toISOString()}: ${msg}\n`;
      fs.appendFileSync(logPath, entry);
      console.log(msg);
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

  // API: Config
  app.get('/api/config', (req, res) => {
    const keyId = process.env.VITE_RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID || process.env.RAZORPAY_LIVE_KEY_ID;
    console.log(`[Config] Serving Razorpay Key ID: ${keyId ? keyId.substring(0, 8) + '...' : 'MISSING'}`);
    res.json({
      razorpayKeyId: keyId
    });
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
      userId 
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
        // Update user status in Firestore
        await db.collection('users').doc(userId).set({
          isPremium: true,
          premiumPaymentId: razorpay_payment_id,
          premiumOrderId: razorpay_order_id,
          premiumActivatedAt: new Date().toISOString()
        }, { merge: true });

        // Add notification
        await db.collection('notifications').add({
          userId: userId,
          title: 'Premium Activated! 👑',
          message: 'Your payment was verified by our server. You now have full access!',
          type: 'premium',
          createdAt: new Date().toISOString()
        });

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
  if (process.env.NODE_ENV !== 'production') {
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
}

startServer();
