import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc } from "firebase/firestore";
import fs from 'fs';

const fbConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(fbConfig);
const db = getFirestore(app, fbConfig.firestoreDatabaseId || '(default)');

async function check() {
  const meta = await getDoc(doc(db, "bundles", "polity_metadata"));
  if (meta.exists()) {
    console.log(`Polity Topics: ${meta.data().data.length}`);
  } else {
    console.log("No polity metadata");
  }
  process.exit(0);
}

check().catch(console.error);
