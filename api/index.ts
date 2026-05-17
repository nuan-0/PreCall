import 'dotenv/config';
import express from 'express';
import cors from 'cors';
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
// 

import { initializeApp } from 'firebase/app';
import { getFirestore as getLiteFirestore, collection as liteCollection, getDocs as liteGetDocs, doc as liteDoc, getDoc as liteGetDoc } from 'firebase/firestore/lite';
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

  const dailyLimit = 50000; // Spark plan read limit

  const checkAndNotifyUsage = async () => {
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
  let clientDb: any = null;

  async function runLiteOp(op: () => Promise<any>, name: string) {
    try {
      const start = Date.now();
      const result = await op();
      console.log(`[Cache] Lite op ${name} took ${Date.now() - start}ms`);
      return result;
    } catch(err) { throw err; }
  }

  let adminSdkReady = false;

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

    if (Object.keys(config).length > 0) {
      const clientApp = initializeApp(config);
      // Ensure specific database ID is used for Lite client too
      clientDb = getLiteFirestore(clientApp, config.firestoreDatabaseId && config.firestoreDatabaseId !== '(default)' ? config.firestoreDatabaseId : undefined);
      console.log(`[Firebase] Lite Client initialized. Database: ${config.firestoreDatabaseId || '(default)'}`);
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
          adminSdkReady = true;
          console.log('✅ Firebase Admin initialized via Service Account. Project:', admin.app().options.projectId);
        } catch (err: any) {
          console.error('❌ CRITICAL: Failed to parse FIREBASE_SERVICE_ACCOUNT JSON:', err.message);
          console.error('⚠️ NOTE: It looks like you pasted the JavaScript snippet instead of the Service Account JSON!');
          console.error('⚠️ Your secret starts with: ', process.env.FIREBASE_SERVICE_ACCOUNT.slice(0, 50));
          console.error('⚠️ Please open the downloaded .json file and paste its contents directly.');
          throw new Error('Invalid FIREBASE_SERVICE_ACCOUNT JSON. Please check settings.');
        }
      } else {
        console.log('[Firebase] RED ALERT: FIREBASE_SERVICE_ACCOUNT not found. Using ONLY Lite Client to avoid timeout.');
        adminSdkReady = false;
      }
    } else {
      adminSdkReady = true;
      console.log('[Firebase] Already initialized. Project:', admin.app().options.projectId);
    }
  } catch (error) {
    console.error('[Firebase] Init Error:', error);
  }

  // Define DB with explicit database ID if present
  let db: admin.firestore.Firestore | null = null;
  try {
    if (adminSdkReady) {
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
    }
  } catch (err: any) {
    console.error('❌ Failed to acquire Firestore instance:', err.message);
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
    
    // 1. Check RAM Cache (The Water Tank) first - Instant and 0 reads
    if (contentCache.admins.includes(userId)) {
      return true;
    }
    
    // 2. Extra safety: check hardcoded list before hitting APIs
    try {
      const user = await admin.auth().getUser(userId);
      if (ADMIN_EMAILS.includes(user.email || '')) {
        if (!contentCache.admins.includes(userId)) contentCache.admins.push(userId);
        return true;
      }
      
      // Check dynamic email list from cache
      if (contentCache.adminEmails.includes(user.email?.toLowerCase() || '')) {
        if (!contentCache.admins.includes(userId)) contentCache.admins.push(userId);
        return true;
      }
    } catch (authErr) {
      // Don't crash if Auth API fails
    }

    // 3. Fallback to live Firestore check if still not found
    try {
      const userDoc = await db.collection('users').doc(userId).get();
      if (userDoc.exists && (userDoc.data()?.role === 'admin' || userDoc.data()?.isAdmin === true)) {
        if (!contentCache.admins.includes(userId)) contentCache.admins.push(userId);
        return true;
      }
    } catch (err) {
      // Don't crash
    }
    
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
  const normalizeArray = (input: any, debugLabel = 'Array'): any[] => {
    if (!input) {
      console.error(`[API Normalizer:${debugLabel}] Input is falsy:`, input);
      return [];
    }
    if (Array.isArray(input)) return input;
    
    console.error(`[API Normalizer:${debugLabel}] Object Input detected. Keys:`, Object.keys(input), 'Type:', typeof input);
    console.log(`[API Normalizer:${debugLabel}] Object Input detected. Keys:${Object.keys(input)} Type:${typeof input}\n`);

    if (typeof input === 'object' && input !== null) {
      const entries = Object.entries(input).filter(([k]) => k.trim() !== '' && !isNaN(Number(k)));
      if (entries.length > 0) {
        console.log(`[API Normalizer:${debugLabel}] Using Priority 1 (Numeric Keys). Found ${entries.length} items.`);
        return entries.sort((a, b) => Number(a[0]) - Number(b[0])).map(e => e[1]);
      }
      const values = Object.values(input);
      if (values.length > 0 && typeof values[0] === 'object' && values[0] !== null) {
        if (!(input.slug || input.id)) {
          console.log(`[API Normalizer:${debugLabel}] Using Priority 2 (Object Values). Found ${values.length} items.`);
          return values;
        }
      }
      if (input.slug || input.id) {
          console.log(`[API Normalizer:${debugLabel}] Using Priority 3 (Single Item).`);
          return [input];
      }
    }
    console.error(`[API Normalizer:${debugLabel}] Failed to normalize! Returning empty array. Original input keys:`, Object.keys(input));
    return [];
  };

  const contentCache = {
    subjects: [] as any[],
    topics: [] as any[],
    admins: [] as string[], // Cached admin UIDs
    adminEmails: [] as string[], // Cached admin Emails
    settings: null as any,
    notifications: [] as any[],
    lastUpdated: 0,
    isRefreshing: false,
    isQuotaExceeded: false,
    hasLoadedFirstTime: false as boolean
  };

  let activeRefreshPromise: Promise<void> | null = null;

  let errorCooldownUntil = 0;

  const refreshContentCache = async (forceRebuild = false, bypassFirstTimeCheck = false) => {
    if (Date.now() < errorCooldownUntil) {
      console.error('[Cache] Backend build is in a 60s cooldown due to a previous crash.');
      return {
          success: false,
          status: 'cooldown',
          subjects: [],
          topics: [],
          lastUpdated: Date.now()
      } as any;
    }
    if (activeRefreshPromise && !forceRebuild) return activeRefreshPromise;
    
    // Strict Server-Side Caching: ONLY fetch from Firebase if cold boot or manually forced.
    if (!forceRebuild && !bypassFirstTimeCheck && contentCache.hasLoadedFirstTime) {
      console.log('[Cache] Using persistent RAM cache. No auto-refresh.');
      return;
    }

    contentCache.isRefreshing = true;
    
    activeRefreshPromise = (async () => {
      console.log(`[Cache] Refreshing content cache (Force: ${forceRebuild})...`);
      try {
        let subjects: any[] = [];
        let topics: any[] = [];
        let settings: any = null;
        let notifications: any[] = [];
        let adminEmails: string[] = [];
        let admins: string[] = [];

        const fetchDocWithFallback = async (collectionName: string, docId: string) => {
          try {
            if (!db) throw new Error("Admin SDK DB not acquired");
            const adminDoc = await db.collection(collectionName).doc(docId).get();
            if (adminDoc.exists) return { exists: true, data: () => adminDoc.data(), id: adminDoc.id };
          } catch (e: any) {
            
            if (clientDb) {
               try {
                  const clientDoc = await runLiteOp(() => liteGetDoc(liteDoc(clientDb, collectionName, docId)), `${collectionName}/${docId}`);
                  if (clientDoc.exists()) {
                     
                     return { exists: true, data: () => clientDoc.data(), id: clientDoc.id };
                  }
               } catch (e2: any) {
                  
               }
            }
          }
          return null;
        };

        const fetchColWithFallback = async (collectionName: string): Promise<any[] | null> => {
          try {
            if (!db) throw new Error("Admin SDK DB not acquired");
            const adminSnap = await db.collection(collectionName).get();
            if (adminSnap && !adminSnap.empty) {
               const result: any[] = [];
               adminSnap.forEach(doc => result.push({ id: doc.id, ...doc.data(), data: () => doc.data() }));
               return result;
            }
            return []; // Actually return empty if it worked but had no items
          } catch (e: any) {
            
            if (clientDb) {
               try {
                  const clientSnap = await runLiteOp(() => liteGetDocs(liteCollection(clientDb, collectionName)), collectionName);
                  if (clientSnap && !clientSnap.empty) {
                    
                    const result: any[] = [];
                    clientSnap.forEach((doc: any) => result.push({ id: doc.id, ...doc.data(), data: () => doc.data() }));
                    return result;
                  }
                  return [];
               } catch (e2: any) {
                  
               }
            }
            return null; // Return null on absolute failure
          }
        };

        let shouldForceRebuild = forceRebuild;

        try {
          if (!shouldForceRebuild) {
             const metaDoc = await fetchDocWithFallback('bundles', 'catalog_meta');
             if (metaDoc && metaDoc.exists) {
                const data = metaDoc.data() || {};
                subjects = data.subjects || [];
                settings = data.settings || null;
                notifications = data.notifications || [];
                adminEmails = data.adminEmails || [];
                admins = data.admins || [];
                contentCache.lastUpdated = data.lastUpdated || Date.now();
                
                let allTopics: any[] = [];
                const totalChunks = data.totalChunks || 0;
                
                try {
                  const chunkPromises = [];
                  for (let i = 0; i < totalChunks; i++) {
                      chunkPromises.push(fetchDocWithFallback('bundles', `catalog_topics_${i}`));
                  }
                  const chunkDocs = await Promise.all(chunkPromises);
                  chunkDocs.forEach((doc: any) => {
                      if (doc && doc.exists) allTopics = allTopics.concat(doc.data()?.topics || []);
                  });
                  const mergedTopics = allTopics.flat();
                  mergedTopics.sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
                  topics = mergedTopics;
                } catch (e: any) {
                  console.error('[Cache] Sharded array compilation failed, rejecting.', e);
                  throw e;
                }

                if (!subjects || subjects.length === 0) {
                   console.log('[Cache] bundles/catalog_meta exists, but subjects array is corrupted/empty. Forcing rebuild from raw collections.');
                   shouldForceRebuild = true;
                }
             } else {
                const bundleDoc = await fetchDocWithFallback('bundles', 'master_catalog');
                if (bundleDoc && bundleDoc.exists) {
                   const data = bundleDoc.data() || {};
                   subjects = data.subjects || [];
                   topics = data.topics || [];
                   settings = data.settings || null;
                   notifications = data.notifications || [];
                   adminEmails = data.adminEmails || [];
                   admins = data.admins || [];
                   contentCache.lastUpdated = data.lastUpdated || Date.now();
                   
                   if (!subjects || subjects.length === 0) {
                      console.log('[Cache] bundles/master_catalog exists, but subjects array is corrupted/empty. Forcing rebuild from raw collections.');
                      shouldForceRebuild = true;
                   }
                } else {
                   console.warn('[Cache] Master catalog not found! Falling back to raw collections...');
                   shouldForceRebuild = true;
                }
             }

          }
          
          if (shouldForceRebuild) {
            // Fetch raw collections directly to ensure freshness (skip stale bundles)
            const [rawSubjectsSnap, rawTopicsSnap, rawSettingsSnap, rawNotificationsSnap, adminsSnap, adminEmailsDoc] = await Promise.all([
              fetchColWithFallback('subjects'),
              fetchColWithFallback('topics'),
              fetchDocWithFallback('settings', 'global'),
              db ? db.collection('notifications').where('userId', '==', 'all').get().then(snap => {
                const res: any[] = [];
                snap.forEach(d => res.push({ id: d.id, ...d.data() }));
                return res;
              }).catch(() => []) : Promise.resolve([]),
              fetchColWithFallback('admins'),
              fetchDocWithFallback('settings', 'admins')
            ]);

            if (rawSubjectsSnap && rawSubjectsSnap.length > 0) {
              rawSubjectsSnap.forEach(docData => {
                subjects.push({ id: docData.id, slug: docData.slug || docData.id, ...docData.data() });
              });
              // We no longer read topics from the subjects array
              subjects.forEach(s => {
                s.topics = [];
              });
            }

            if (rawTopicsSnap && rawTopicsSnap.length > 0) {
              const uniqueTopicSlugs = new Set();
              rawTopicsSnap.forEach(docData => {
                const topic = { id: docData.id, slug: docData.slug || docData.id, ...docData.data() };
                if (!uniqueTopicSlugs.has(topic.slug)) {
                   uniqueTopicSlugs.add(topic.slug);
                   topics.push(topic);
                }
              });
              topics.sort((a,b) => (a.order||0) - (b.order||0));
            }

            if (rawSettingsSnap?.exists) settings = rawSettingsSnap.data();
            if (rawNotificationsSnap && rawNotificationsSnap.length > 0) {
              rawNotificationsSnap.forEach(docData => {
                const data = docData.data ? docData.data() : docData;
                if (!data.userId || data.userId === 'all') {
                  notifications.push({ id: docData.id, ...data });
                }
              });
            }

            if (adminsSnap && adminsSnap.length > 0) {
              adminsSnap.forEach(docData => admins.push(docData.id));
            }
            if (adminEmailsDoc?.exists) {
              adminEmails = adminEmailsDoc.data()?.emails || [];
            }
          }
        } catch (fallbackErr: any) {
          console.error('[Cache] Fetch failed:', fallbackErr.message);
          
          if (subjects.length === 0 && !contentCache.hasLoadedFirstTime) throw fallbackErr;
        }

        

        subjects.sort((a: any, b: any) => (a.order || 0) - (b.order || 0));

        contentCache.subjects = subjects;
        contentCache.topics = topics;
        contentCache.settings = settings;
        contentCache.notifications = notifications;
        contentCache.admins = admins;
        contentCache.adminEmails = adminEmails;
        if (shouldForceRebuild || contentCache.lastUpdated === 0) {
          contentCache.lastUpdated = Date.now();
        }

        if (shouldForceRebuild) {
           const topicsArray = JSON.parse(JSON.stringify(contentCache.topics, (k, v) => v === '' ? null : v));
           const subjectsArray = JSON.parse(JSON.stringify(contentCache.subjects, (k, v) => v === '' ? null : v));
           const totalChunks = Math.ceil(topicsArray.length / 35);
           await db.collection('bundles').doc('catalog_meta').set({
               lastUpdated: contentCache.lastUpdated,
               subjects: subjectsArray,
               admins: contentCache.admins,
               adminEmails: contentCache.adminEmails,
               settings: JSON.parse(JSON.stringify(contentCache.settings || null)),
               notifications: JSON.parse(JSON.stringify(contentCache.notifications || [])),
               totalChunks: totalChunks
           });

           const batch = db.batch();
           for (let i = 0; i < totalChunks; i++) {
               const chunk = topicsArray.slice(i * 35, (i + 1) * 35);
               batch.set(db.collection('bundles').doc(`catalog_topics_${i}`), { topics: chunk });
           }
           await batch.commit();
        }

        contentCache.hasLoadedFirstTime = true;
        contentCache.isQuotaExceeded = false;

        console.log(`[Cache] Success: ${subjects.length} subjects cached.`);
      } catch (err: any) {
        if (err.code === 'resource-exhausted' || err.message?.includes('quota')) {
           contentCache.isQuotaExceeded = true;
           console.error('[Cache] CRITICAL: FIREBASE QUOTA EXHAUSTED');
        } else {
           console.error('[Cache] Refresh failed:', err);
        }
        
        errorCooldownUntil = Date.now() + 60000;
        activeRefreshPromise = null;

        if (forceRebuild) throw err;
      } finally {
        contentCache.isRefreshing = false;
        activeRefreshPromise = null;
      }
    })();
    return activeRefreshPromise;
  };

  const syncRamToFirestoreChunks = async (updatedTopics?: any[], updatedSubjects?: any[], updatedSettings?: any, updatedNotifications?: any[], updatedAdminEmails?: string[], explicitWrites?: { collection: string, id: string, data: any | null }[]) => {
     if (!db) { throw new Error('Firestore DB not available'); }
     
     if (!contentCache.hasLoadedFirstTime) {
       console.log('[CRITICAL] syncRamToFirestoreChunks called but memory cache unhydrated. Run inline recovery.');
       await autoHydratePreflight();
       if ((updatedTopics && updatedTopics.length < contentCache.topics.length / 2) || 
           (updatedSubjects && updatedSubjects.length < contentCache.subjects.length / 2)) {
          throw new Error('Arguments safely rejected. The arrays passed to syncRamToFirestoreChunks were generated from an empty state.');
       }
     }
     
     const sanitize = (obj: any) => JSON.parse(JSON.stringify(obj, (k, v) => v === '' ? null : v));

     const topicsArray = sanitize(updatedTopics ? updatedTopics : contentCache.topics);
     const subjectsArray = sanitize(updatedSubjects ? updatedSubjects : contentCache.subjects);
     const settingsObj = sanitize(updatedSettings ? updatedSettings : contentCache.settings);
     const notificationsArray = sanitize(updatedNotifications ? updatedNotifications : contentCache.notifications);
     const emailsArray = sanitize(updatedAdminEmails ? updatedAdminEmails : contentCache.adminEmails);

     topicsArray.sort((a: any,b: any) => (a.order||0) - (b.order||0));
     subjectsArray.sort((a: any,b: any) => (a.order||0) - (b.order||0));
     const newTimestamp = Date.now();
     
     const totalChunks = Math.ceil(topicsArray.length / 35);
     
     const batch = db.batch();
     batch.set(db.collection('bundles').doc('catalog_meta'), {
         lastUpdated: newTimestamp,
         subjects: subjectsArray,
         admins: contentCache.admins || [],
         adminEmails: emailsArray || [],
         settings: settingsObj || null,
         notifications: notificationsArray || [],
         totalChunks: totalChunks
     });

     for (let i = 0; i < totalChunks; i++) {
         const chunk = topicsArray.slice(i * 35, (i + 1) * 35);
         // TARGETED BATCH WRITE: Only update the chunk if its contents actually changed!
         const oldChunk = contentCache.topics ? contentCache.topics.slice(i * 35, (i + 1) * 35) : [];
         if (JSON.stringify(chunk) !== JSON.stringify(oldChunk)) {
             batch.set(db.collection('bundles').doc(`catalog_topics_${i}`), { topics: chunk });
         }
     }

     if (explicitWrites && explicitWrites.length > 0) {
         for (const write of explicitWrites) {
             const ref = db.collection(write.collection).doc(write.id);
             if (write.data === null) {
                 batch.delete(ref);
             } else {
                 batch.set(ref, sanitize(write.data), { merge: true });
             }
         }
     }

     await batch.commit();

     // Apply to global cache ONLY on success
     contentCache.topics = topicsArray;
     contentCache.subjects = subjectsArray;
     contentCache.settings = settingsObj;
     contentCache.notifications = notificationsArray;
     contentCache.adminEmails = emailsArray;
     contentCache.lastUpdated = newTimestamp;
  };

  // Startup refresh
  if (process.env.VITE_USE_LOCAL_DATA === 'true') {
    console.log('[Cache] LOCAL MODE: Skipping active Firestore cache refresh.');
  } else {
    refreshContentCache().catch(err => {
      console.warn('[Cache] Initial refresh failed (might be quota):', err.message);
    });
    // No auto-refresh logic. Admin must manually trigger deployment via /api/admin/refresh-bundle
  }

  // Startup verification
  const startupTest = async () => {
    if (process.env.VITE_USE_LOCAL_DATA === 'true' || !process.env.FIREBASE_SERVICE_ACCOUNT) {
      return; // Skip write test in local mode
    }
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

  app.use(cors());
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // Prevent caching for all admin routes to ensure instant updates
  app.use('/api/admin', (req, res, next) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    next();
  });

  app.get('/api/test1234', (req, res) => res.json({ test: 1234 }));
  // API: Get all cached content
  app.get('/api/content/all', async (req, res) => {
    
    try {
      res.set('Cache-Control', 'private, no-cache, no-store, must-revalidate, max-age=0');

      const clientLastUpdated = parseInt(req.query.lastUpdated as string || '0');

      // Wait for initial load if necessary
      if (!contentCache.hasLoadedFirstTime || !contentCache.subjects || contentCache.subjects.length === 0 || !contentCache.topics || contentCache.topics.length === 0) {
        console.log(`[API] Cold boot or empty cache detected, ensuring cache is fully loaded...`);
        if (activeRefreshPromise) {
          await activeRefreshPromise;
        } else {
          await refreshContentCache(false, true);
        }
      } else {
        // ALWAYS check live Firestore to ensure this Serverless instance RAM isn't stale
        try {
          const metaSnap = await db.collection('bundles').doc('catalog_meta').get();
          if (metaSnap.exists) {
            const liveData = metaSnap.data();
            if (liveData && liveData.lastUpdated && liveData.lastUpdated > contentCache.lastUpdated) {
              console.log(`[API] Live DB is fresh (${liveData.lastUpdated}) vs RAM (${contentCache.lastUpdated}). Forcing validation update...`);
              if (activeRefreshPromise) {
                await activeRefreshPromise;
              } else {
                await refreshContentCache(false, true);
              }
            }
          }
        } catch (e) {
             console.warn('[API] Could not fetch catalog_meta for freshness validation', e);
        }
      }

      // Check if client version is still valid
      if (clientLastUpdated >= contentCache.lastUpdated && contentCache.lastUpdated > 0 && !contentCache.isRefreshing) {
        return res.json({ status: 'unchanged', lastUpdated: contentCache.lastUpdated });
      }

      
      res.json({
        MARKER: "AI_STUDIO_SERVER_123",
        subjects: contentCache.subjects || [],
        topics: contentCache.topics || [],
        settings: contentCache.settings,
        notifications: contentCache.notifications || [],
        adminEmails: contentCache.adminEmails || [],
        lastUpdated: contentCache.lastUpdated
      });
    } catch (err: any) {
      console.error('[API Content] Error:', err);
      // Return 200 with error status so client hooks can handle it gracefully instead of crashing the fetch
      res.json({ status: 'error', error: err.message });
    }
  });

  // API: Force refresh content cache (Admin only)
  app.post('/api/admin/refresh-bundle', async (req, res) => {
    const { userId, rebuild = true } = req.body || {};
    const isAdmin = await checkIsAdmin(userId);
    if (!isAdmin) return res.status(403).json({ error: 'Unauthorized' });

    try {
      console.log(`[Admin] Cache Rebuild triggered by ${userId}`);
      await refreshContentCache(true);
      res.json({ 
        success: true, 
        message: 'Cache updated successfully from Firebase',
        subjectsCount: contentCache.subjects.length, 
        topicsCount: (contentCache.topics || []).length,
        lastUpdated: contentCache.lastUpdated
      });
    } catch (error: any) {
      console.error('[Admin API] Rebuild failed:', error);
      res.status(500).json({ error: error.message || 'Failed to rebuild cache' });
    }
  });

  const autoHydratePreflight = async () => {
    if (!contentCache.hasLoadedFirstTime || !contentCache.topics || contentCache.topics.length === 0 || !contentCache.subjects || contentCache.subjects.length === 0) {
      console.log('[API] Cold Boot / Cache Unhydrated. Executing inline recovery...');
      if (activeRefreshPromise) {
        await activeRefreshPromise;
      } else {
        await refreshContentCache(false, true);
      }
      if (!contentCache.topics || contentCache.topics.length === 0 || !contentCache.subjects || contentCache.subjects.length === 0) {
        throw new Error('Memory cache hydration failed. Cannot safely perform write.');
      }
    }
  };

  // API: Admin Topic Save
  app.post('/api/admin/save-topic', async (req, res) => {
    const { userId, topic } = req.body || {};
    const isAdmin = await checkIsAdmin(userId);
    if (!isAdmin) return res.status(403).json({ error: 'Unauthorized' });

    try {
      await autoHydratePreflight();
      let finalTopic = { ...topic };
      if (finalTopic.id) {
        const existingTopic = contentCache.topics.find((t: any) => t.id === finalTopic.id);
        if (existingTopic) {
          // Remove null/undefined from incoming edits so existing values are preserved
          const cleanEdits = Object.fromEntries(Object.entries(finalTopic).filter(([_, v]) => v != null));
          finalTopic = { ...existingTopic, ...cleanEdits };
        }
      }

      let subjectSlug = finalTopic.subjectSlug;
      let subjectId = finalTopic.subjectId;

      // Fallback binding between slug and id
      if (!subjectSlug && subjectId) {
        const subj = contentCache.subjects.find((s: any) => s.id === subjectId || s.slug === subjectId);
        if (subj) subjectSlug = subj.slug;
      } else if (!subjectId && subjectSlug) {
        const subj = contentCache.subjects.find((s: any) => s.slug === subjectSlug || s.id === subjectSlug);
        if (subj) subjectId = subj.id || subj.slug;
      }

      // If still missing subjectId, fallback to slug just in case
      if (!subjectId && subjectSlug) {
        subjectId = subjectSlug;
      }

      if (!subjectSlug || !subjectId) {
        return res.status(400).json({ error: 'Topic must map to a valid subject (missing subjectSlug or subjectId)' });
      }

      const topicId = finalTopic.id || (subjectSlug && finalTopic.slug ? `${subjectSlug}-${finalTopic.slug}` : `topic-${Date.now()}`);
      
      const topicData = { 
        ...finalTopic, 
        id: topicId, 
        subjectSlug,
        subjectId,
        lastUpdated: new Date().toISOString() 
      };

      const updatedTopics = JSON.parse(JSON.stringify(contentCache.topics));
      const index = updatedTopics.findIndex((t: any) => t.id === topicId);
      if (index > -1) {
          updatedTopics[index] = { ...updatedTopics[index], ...topicData };
      } else {
          updatedTopics.push(topicData);
      }
      await syncRamToFirestoreChunks(
          updatedTopics, 
          undefined, 
          undefined, 
          undefined, 
          undefined, 
          [{ collection: 'topics', id: topicId, data: updatedTopics[index > -1 ? index : updatedTopics.length - 1] }]
      );
      
      res.json({ success: true, topicId, lastUpdated: contentCache.lastUpdated });
    } catch (err: any) {
      console.error('[LIVE RUNTIME TRACE] Save execution failed:', err);
      res.status(500).json({ 
        error: err.name || 'Error', 
        message: err.message || 'Unknown server error',
        stack: err.stack,
        details: err.toString()
      });
    }
  });

  // API: Admin Topic Delete
  app.post('/api/admin/delete-topic', async (req, res) => {
    const { userId, topicId } = req.body || {};
    const isAdmin = await checkIsAdmin(userId);
    if (!isAdmin) return res.status(403).json({ error: 'Unauthorized' });

    try {
      await autoHydratePreflight();
      const updatedTopics = contentCache.topics.filter(t => t.id !== topicId);
      await syncRamToFirestoreChunks(
          updatedTopics,
          undefined,
          undefined,
          undefined,
          undefined,
          [{ collection: 'topics', id: topicId, data: null }]
      );
      
      res.json({ success: true, lastUpdated: contentCache.lastUpdated });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });


  // API: Run Migration for Topics to Subjects
  app.get('/api/admin/run-migration', async (req, res) => {
    try {
      console.log('Starting migration via API trigger...');
      const subjectsSnap = await db.collection('subjects').get();
      const topicsSnap = await db.collection('topics').get();
      
      if (subjectsSnap.empty || topicsSnap.empty) {
        return res.json({ success: true, message: 'No data to migrate or subjects/topics are empty.' });
      }

      const topicsBySubject: Record<string, any[]> = {};
      topicsSnap.forEach((tDoc: any) => {
        const topic = { id: tDoc.id, ...tDoc.data() };
        const slug = topic.subjectSlug;
        if (slug) {
          if (!topicsBySubject[slug]) topicsBySubject[slug] = [];
          topicsBySubject[slug].push(topic);
        }
      });

      const batch = db.batch();
      let count = 0;
      
      subjectsSnap.forEach((sDoc: any) => {
        const subject = sDoc.data();
        const slug = subject.slug;
        const subjectTopics = topicsBySubject[slug] || [];
        batch.update(sDoc.ref, { topics: subjectTopics });
        count++;
      });
      
      await batch.commit();

      // Force cache rebuild now that it's migrated
      await refreshContentCache(true);
      
      res.json({ success: true, message: `Migrated ${count} subjects.` });
    } catch (e: any) {
      console.error('Migration failed:', e);
      res.status(500).json({ error: e.message });
    }
  });

  // API: UPSCRefundCampaign - Submit Prelims Data
  app.post('/api/submit-prelims-data', async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing or invalid authorization header' });
      }

      const token = authHeader.split('Bearer ')[1];
      const decodedToken = await admin.auth().verifyIdToken(token);
      const userId = decodedToken.uid;

      const { realName, mobileNo, upscRollNumber } = req.body;
      
      if (!realName || !mobileNo || !upscRollNumber) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const userDoc = await db.collection('users').doc(userId).get();
      if (!userDoc.exists || !userDoc.data()?.isPremium) {
        return res.status(403).json({ error: 'Premium status required' });
      }

      const updateData = {
        realName,
        mobileNo,
        upscRollNumber,
        prelimsDataSubmittedAt: new Date().toISOString()
      };

      await db.collection('users').doc(userId).update(updateData);
      
      return res.json({ success: true });
    } catch (error) {
      console.error('[API] Error in /api/submit-prelims-data:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  // API: UPSCRefundCampaign - Export CSV
  app.get('/api/admin/export-prelims-csv', async (req, res) => {
    try {
      const userId = req.query.userId as string;
      const isAdmin = await checkIsAdmin(userId);
      
      if (!isAdmin) {
        return res.status(403).json({ error: 'Unauthorized' });
      }

      const usersSnap = await db.collection('users').where('upscRollNumber', '!=', null).get();
      
      const rows = [['Name', 'Mobile', 'Roll Number', 'Email', 'Submitted At']];
      
      usersSnap.forEach(doc => {
        const data = doc.data();
        if (data.upscRollNumber) {
          rows.push([
             `"${String(data.realName || '').replace(/"/g, '""')}"`,
             `"${String(data.mobileNo || '').replace(/"/g, '""')}"`,
             `"${String(data.upscRollNumber || '').replace(/"/g, '""')}"`,
             `"${String(data.email || '').replace(/"/g, '""')}"`,
             `"${String(data.prelimsDataSubmittedAt || '').replace(/"/g, '""')}"`
          ]);
        }
      });
      
      const csvString = rows.map(r => r.join(',')).join('\n');
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="prelims_achievers.csv"');
      res.send(csvString);
    } catch (err: any) {
      console.error('CSV Export Error:', err);
      res.status(500).json({ error: 'Failed to generate CSV' });
    }
  });

  // API: Admin Bulk Delete Topics
  app.post('/api/admin/bulk-delete-topics', async (req, res) => {
    const { userId, topicIds } = req.body || {};
    const isAdmin = await checkIsAdmin(userId);
    if (!isAdmin) return res.status(403).json({ error: 'Unauthorized' });

    try {
      await autoHydratePreflight();
      const updatedTopics = contentCache.topics.filter(t => !topicIds.includes(t.id));
      const explicitWrites = topicIds.map((id: string) => ({ collection: 'topics', id, data: null }));
      await syncRamToFirestoreChunks(
          updatedTopics,
          undefined,
          undefined,
          undefined,
          undefined,
          explicitWrites
      );
      res.json({ success: true, lastUpdated: contentCache.lastUpdated });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // API: Admin Bulk Update Status
  app.post('/api/admin/bulk-update-topic-status', async (req, res) => {
    const { userId, topicIds, status } = req.body || {};
    const isAdmin = await checkIsAdmin(userId);
    if (!isAdmin) return res.status(403).json({ error: 'Unauthorized' });

    try {
      await autoHydratePreflight();
      const updatedTopics = JSON.parse(JSON.stringify(contentCache.topics));
      const explicitWrites: any[] = [];
      updatedTopics.forEach((t: any) => {
         if (topicIds.includes(t.id)) {
             t.status = status;
             explicitWrites.push({ collection: 'topics', id: t.id, data: t });
         }
      });
      await syncRamToFirestoreChunks(
          updatedTopics,
          undefined,
          undefined,
          undefined,
          undefined,
          explicitWrites
      );
      res.json({ success: true, lastUpdated: contentCache.lastUpdated });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // API: Admin Subject Save
  app.post('/api/admin/save-subject', async (req, res) => {
    const { userId, subject } = req.body || {};
    const isAdmin = await checkIsAdmin(userId);
    if (!isAdmin) return res.status(403).json({ error: 'Unauthorized' });

    try {
      await autoHydratePreflight();
      const subjectId = subject.id || subject.slug;
      const subjectData = { ...subject };
      delete subjectData.id;

      const updatedSubjects = JSON.parse(JSON.stringify(contentCache.subjects));
      const subjectIndex = updatedSubjects.findIndex((s: any) => s.id === subjectId);
      if (subjectIndex > -1) updatedSubjects[subjectIndex] = { ...updatedSubjects[subjectIndex], ...subjectData, id: subjectId };
      else updatedSubjects.push({ ...subjectData, id: subjectId });
      
      await syncRamToFirestoreChunks(
          undefined, 
          updatedSubjects,
          undefined,
          undefined,
          undefined,
          [{ collection: 'subjects', id: subjectId, data: updatedSubjects[subjectIndex > -1 ? subjectIndex : updatedSubjects.length - 1] }]
      );
      
      res.json({ success: true, subjectId, lastUpdated: contentCache.lastUpdated });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // API: Admin Subject Delete
  app.post('/api/admin/delete-subject', async (req, res) => {
    const { userId, subjectId } = req.body || {};
    const isAdmin = await checkIsAdmin(userId);
    if (!isAdmin) return res.status(403).json({ error: 'Unauthorized' });

    try {
      await autoHydratePreflight();
      const updatedSubjects = contentCache.subjects.filter(s => s.id !== subjectId);
      await syncRamToFirestoreChunks(
          undefined, 
          updatedSubjects,
          undefined,
          undefined,
          undefined,
          [{ collection: 'subjects', id: subjectId, data: null }]
      );
      
      res.json({ success: true, lastUpdated: contentCache.lastUpdated });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // API: Admin Settings Save
  app.post('/api/admin/save-settings', async (req, res) => {
    const { userId, settings } = req.body || {};
    const isAdmin = await checkIsAdmin(userId);
    if (!isAdmin) return res.status(403).json({ error: 'Unauthorized' });

    try {
      await autoHydratePreflight();
      const updatedSettings = { ...contentCache.settings, ...settings };
      await syncRamToFirestoreChunks(undefined, undefined, updatedSettings);
      
      res.json({ success: true, lastUpdated: contentCache.lastUpdated });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // API: Admin Notifications
  app.post('/api/admin/notifications', async (req, res) => {
    const { userId, notification, action } = req.body || {};
    const isAdmin = await checkIsAdmin(userId);
    if (!isAdmin) return res.status(403).json({ error: 'Unauthorized' });

    try {
      await autoHydratePreflight();
      let updatedNotifications = [...contentCache.notifications];
      if (action === 'delete') {
        updatedNotifications = updatedNotifications.filter(n => n.id !== notification.id);
      } else {
        const notifId = notification.id || db.collection('notifications').doc().id;
        const newNotif = { ...notification, id: notifId, createdAt: new Date().toISOString() };
        updatedNotifications.push(newNotif);
      }
      
      await syncRamToFirestoreChunks(undefined, undefined, undefined, updatedNotifications);

      res.json({ success: true, lastUpdated: contentCache.lastUpdated });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });
  // ---------------------------

  // API: Admin Admins Save
  app.post('/api/admin/save-admins', async (req, res) => {
    const { userId, emails } = req.body || {};
    const isAdmin = await checkIsAdmin(userId);
    if (!isAdmin) return res.status(403).json({ error: 'Unauthorized' });
    
    try {
      await syncRamToFirestoreChunks(undefined, undefined, undefined, undefined, emails);

      res.json({ success: true, lastUpdated: contentCache.lastUpdated });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

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

  // API: Upload Infographic and seamlessly update RAM cache and Firestore without active locks
  app.post('/api/admin/upload-topic-infographic', upload.single('file'), async (req: any, res) => {
    try {
      await autoHydratePreflight();
      const { userId, topicId, folder = 'infographics' } = req.body;
      const file = req.file;
      const authHeader = req.headers.authorization;

      if (!file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      let isAdmin = false;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split('Bearer ')[1];
        try {
          const decodedToken = await admin.auth().verifyIdToken(token);
          if (ADMIN_EMAILS.includes(decodedToken.email || '')) {
            isAdmin = true;
          }
        } catch (e) {}
      }
      if (!isAdmin && userId) {
        isAdmin = await checkIsAdmin(userId);
      }
      if (!isAdmin) {
        return res.status(403).json({ error: 'Unauthorized: Only admins can upload' });
      }

      const configBucket = (admin.app().options as any).storageBucket;
      const bucket = admin.storage().bucket(configBucket);
      
      if (!bucket.name) {
        return res.status(500).json({ error: 'Storage not configured properly on server' });
      }

      const fileName = `${folder}/${Date.now()}-${file.originalname.replace(/\s+/g, '_')}`;
      const blob = bucket.file(fileName);

      await blob.save(file.buffer, {
        metadata: { contentType: file.mimetype },
        resumable: false
      });

      try {
        await blob.makePublic();
      } catch (pubErr) {}

      const publicUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;

      if (!topicId) {
        return res.json({ url: publicUrl, message: 'Uploaded without topic binding' });
      }

      // Quick RAM patch targeting array index only!
      const updatedTopics = JSON.parse(JSON.stringify(contentCache.topics || []));
      const index = updatedTopics.findIndex((t: any) => t.id === topicId);
      
      if (index === -1) {
        return res.status(404).json({ error: 'Topic not found in cache' });
      }
      
      updatedTopics[index].infographicUrl = publicUrl;
      updatedTopics[index].lastUpdated = new Date().toISOString();

      // No activeRefreshPromise lock! Clean direct sync.
      await syncRamToFirestoreChunks(
          updatedTopics,
          undefined,
          undefined,
          undefined,
          undefined,
          [{ collection: 'topics', id: topicId, data: updatedTopics[index] }]
      );

      res.json({ success: true, url: publicUrl, topicId, message: 'Upload and cache patch complete' });
    } catch (err: any) {
      console.error('[Upload Infographic] ERROR:', err);
      res.status(500).json({ error: 'Upload failed: ' + (err.message || err.toString()) });
    }
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
    res.set('Cache-Control', 'no-store');
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
    res.set('Cache-Control', 'no-store');
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

  // Catch-all for missing API routes to prevent falling through to SPA HTML
  app.all('/api/*', (req, res) => {
    res.status(404).json({ error: 'API route not found', path: req.path });
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
      app.get('*', async (req, res, next) => {
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
      
      // Safety for API routes
      app.all('/api/*', (req, res) => {
        res.status(404).json({ error: `API route not found: ${req.method} ${req.url}` });
      });

      app.get('*', (req, res) => {
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
    const isLocalMode = process.env.VITE_USE_LOCAL_DATA === 'true' || !process.env.FIREBASE_SERVICE_ACCOUNT;
    
    if (isLocalMode) {
      sendTelegramNotification(`🚀 <b>Local Dev Server Started</b>\nEnvironment: <code>${process.env.NODE_ENV || 'development'}</code>`).catch(() => {});
    } else {
      const startupOp = async (dbInstance: any) => {
        const snap = await dbInstance.collection('settings').doc('global').get();
        return snap.exists ? snap.data()?.appName : 'PreCall';
      };

      const appName = await runFirestoreOp(startupOp, 'StartupSettings').catch((e: any) => {
          if (e.message?.includes('quota') || e.message?.includes('RESOURCE_EXHAUSTED')) {
             return 'PreCall (Quota)';
          }
          return 'PreCall';
      });
      
      sendTelegramNotification(`🚀 <b>${escapeHTML(appName)} Server Started</b>\nEnvironment: <code>${process.env.NODE_ENV || 'development'}</code>`).catch(() => {});
    }
  } catch (err) {
    console.error('Failed to send startup notification:', err);
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
