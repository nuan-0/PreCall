import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { initializeApp } from 'firebase/app';
import { getFirestore as getLiteFirestore, doc as liteDoc, getDoc as liteGetDoc } from 'firebase/firestore/lite';

async function test() {
  const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const clientApp = initializeApp(config);
  const clientDb = getLiteFirestore(clientApp, config.firestoreDatabaseId && config.firestoreDatabaseId !== '(default)' ? config.firestoreDatabaseId : undefined);

  const clientDoc = await liteGetDoc(liteDoc(clientDb, 'bundles', 'subjects'));
  const rawData = clientDoc.data();
  console.log(JSON.stringify(rawData).substring(0, 500));
}
test();
