import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import config from './firebase-applet-config.json' assert { type: 'json' };

const run = async () => {
  try {
    const rawSa = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!rawSa) {
      console.log('NO FIREBASE_SERVICE_ACCOUNT ENV VAR!');
      process.exit(1);
    }
    const sa = JSON.parse(rawSa);
    console.log('Parsed SA for:', sa.client_email);

    admin.initializeApp({
      credential: admin.credential.cert(sa),
      projectId: sa.project_id
    });
    
    console.log('Testing specific db ID:', config.firestoreDatabaseId);
    const db = getFirestore(admin.app(), config.firestoreDatabaseId);
    
    const snap = await db.collection('_health').limit(1).get();
    console.log('SUCCESS! Read docs:', snap.size);
    
  } catch (e) {
    console.log('ERROR:', e.message);
    if (e.code) console.log('CODE:', e.code);
  }
};

run();
