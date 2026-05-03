import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";
import fs from 'fs';

const fbConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(fbConfig);
const db = getFirestore(app, fbConfig.firestoreDatabaseId || '(default)');

async function check() {
  const snaps = await getDocs(collection(db, "topics"));
  console.log(`Raw Topics Count: ${snaps.docs.length}`);
  process.exit(0);
}

check().catch(console.error);
