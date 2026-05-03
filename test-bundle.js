import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc } from "firebase/firestore";
import fs from 'fs';

const fbConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(fbConfig);
const db = getFirestore(app, fbConfig.firestoreDatabaseId || '(default)');

async function check() {
  const snap = await getDoc(doc(db, "bundles", "subjects"));
  if (snap.exists()) {
    const data = snap.data().data;
    data.forEach(d => {
       if (d.pdfUrl) {
          console.log(`[Bundle] ${d.id}: pdfVisible = ${d.pdfVisible}, url = ${d.pdfUrl}`);
       }
    });
  } else {
    console.log("No subjects bundle found!");
  }
  process.exit(0);
}

check().catch(console.error);
