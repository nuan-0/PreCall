import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore/lite';
import { readFileSync } from 'fs';

async function test() {
  const config = JSON.parse(readFileSync('firebase-applet-config.json', 'utf8'));
  const app = initializeApp(config);
  const db = getFirestore(app, config.firestoreDatabaseId !== '(default)' ? config.firestoreDatabaseId : undefined);
  
  try {
    const snap = await getDoc(doc(db, 'bundles', 'subjects'));
    if (snap.exists()) {
      console.log('Got subjects bundle, data array length:', snap.data().data?.length);
    } else {
      console.log('Bundle does not exist');
    }
  } catch(e: any) {
    console.error('Error:', e.message);
  }
}
test();
