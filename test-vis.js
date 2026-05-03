import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";
import fs from 'fs';

const fbConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(fbConfig);
const db = getFirestore(app, fbConfig.firestoreDatabaseId || '(default)');

async function check() {
  const snaps = await getDocs(collection(db, "subjects"));
  snaps.docs.forEach(d => {
     if (d.data().pdfUrl) {
        console.log(`${d.id}: pdfVisible = ${d.data().pdfVisible}, url = ${d.data().pdfUrl}`);
     }
  });
  process.exit(0);
}

check().catch(console.error);
