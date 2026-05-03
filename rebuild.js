import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, getDocs, collection, query, where, writeBatch } from "firebase/firestore";
import fs from 'fs';

const fbConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(fbConfig);
const db = getFirestore(app, fbConfig.firestoreDatabaseId || '(default)');

async function rebuild() {
  console.log("Rebuilding subjects...");
  const subjectsSnap = await getDocs(collection(db, 'subjects'));
  const subjects = subjectsSnap.docs.map(d => ({ ...d.data(), id: d.id }));
  subjects.sort((a, b) => (a.order || 0) - (b.order || 0));

  const sanitize = (obj) => JSON.parse(JSON.stringify(obj, (k, v) => v === undefined ? null : v));
  
  await setDoc(doc(db, 'bundles', 'subjects'), sanitize({
    updatedAt: new Date().toISOString(),
    data: subjects
  }));
  console.log("Subjects bundled:", subjects.length);

  for (const sub of subjects) {
    const ts = await getDocs(query(collection(db, 'topics'), where('subjectSlug', '==', sub.slug)));
    const topics = ts.docs.map(d => ({...d.data(), id: d.id}));
    topics.sort((a, b) => (a.order || 0) - (b.order || 0));

    const metadata = topics.map(t => ({
      id: t.id || '',
      slug: t.slug || '',
      title: t.title || '',
      teaser: t.teaser || '',
      status: t.status || 'free',
      order: t.order ?? 0,
      subjectSlug: t.subjectSlug || '',
      chapter: t.chapter || ''
    }));

    const freeContent = topics.filter(t => t.status === 'free');
    const premiumContent = topics.filter(t => t.status === 'premium');

    const batch = writeBatch(db);
    batch.set(doc(db, 'bundles', `${sub.slug}_metadata`), sanitize({ updatedAt: new Date().toISOString(), data: metadata }));
    batch.set(doc(db, 'bundles', `${sub.slug}_free`), sanitize({ updatedAt: new Date().toISOString(), data: freeContent }));
    batch.set(doc(db, 'bundles', `${sub.slug}_premium`), sanitize({ updatedAt: new Date().toISOString(), data: premiumContent }));
    await batch.commit();

    console.log(`Rebuilt ${sub.slug}: ${topics.length} topics`);
  }
}

rebuild().catch(console.error);
