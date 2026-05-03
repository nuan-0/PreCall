import fs from 'fs';
import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || fs.readFileSync('/tmp/sa.json', 'utf8') || '{}');
const fbConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}
const db = getFirestore(admin.apps[0], fbConfig.firestoreDatabaseId);

async function rebuild() {
  console.log("Rebuilding subjects...");
  const subjectsSnap = await db.collection('subjects').get();
  const subjects = subjectsSnap.docs.map(d => ({ ...d.data(), id: d.id }));
  subjects.sort((a, b) => (a.order || 0) - (b.order || 0));

  const sanitize = (obj) => JSON.parse(JSON.stringify(obj, (k, v) => v === undefined ? null : v));

  await db.collection('bundles').doc('subjects').set(sanitize({
    updatedAt: new Date().toISOString(),
    data: subjects
  }));
  console.log("Subjects bundled:", subjects.length);

  for (const sub of subjects) {
    const ts = await db.collection('topics').where('subjectSlug', '==', sub.slug).get();
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

    const batch = db.batch();
    batch.set(db.collection('bundles').doc(`${sub.slug}_metadata`), sanitize({ updatedAt: new Date().toISOString(), data: metadata }));
    batch.set(db.collection('bundles').doc(`${sub.slug}_free`), sanitize({ updatedAt: new Date().toISOString(), data: freeContent }));
    batch.set(db.collection('bundles').doc(`${sub.slug}_premium`), sanitize({ updatedAt: new Date().toISOString(), data: premiumContent }));
    await batch.commit();

    console.log(`Rebuilt ${sub.slug}: ${topics.length} topics`);
  }
}

rebuild().catch(console.error);
