import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';

const rawSa = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!rawSa) {
  console.log('NO FIREBASE_SERVICE_ACCOUNT ENV VAR!');
  process.exit(1);
}
const sa = JSON.parse(rawSa);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(sa)
  });
}
const db = getFirestore();

async function check() {
  const meta = await db.collection("bundles").doc("subjects").get();
  if (meta.exists) {
    console.log(`Subjects Bundle: ${meta.data()?.data.length}`);
  } else {
    console.log("No subjects bundle");
  }
}

check().catch(console.error);
