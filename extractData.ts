import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore/lite';
import fs from 'fs';
import path from 'path';

const configStr = fs.readFileSync(path.join(process.cwd(), 'firebase-applet-config.json'), 'utf8');
const config = JSON.parse(configStr);

const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId && config.firestoreDatabaseId !== '(default)' ? config.firestoreDatabaseId : undefined);

async function extractDocs() {
  try {
    console.log('Fetching subjects...');
    const subjectsSnap = await getDocs(collection(db, 'subjects'));
    const subjects: any[] = [];
    subjectsSnap.forEach(doc => subjects.push({ id: doc.id, ...doc.data() }));

    console.log('Fetching topics...');
    const topicsSnap = await getDocs(collection(db, 'topics'));
    const topicsBySubject: Record<string, any[]> = {};
    topicsSnap.forEach(doc => {
      const topic = { id: doc.id, ...doc.data() };
      const slug = topic.subjectSlug;
      if (slug) {
        if (!topicsBySubject[slug]) topicsBySubject[slug] = [];
        topicsBySubject[slug].push(topic);
      }
    });

    console.log('Fetching settings...');
    let settings = {};
    try {
      const { doc, getDoc } = require('firebase/firestore/lite');
      const settingsSnap = await getDoc(doc(db, 'settings', 'global'));
      if (settingsSnap.exists()) settings = settingsSnap.data();
    } catch (e) {
      console.warn('Could not read settings:', e);
    }

    console.log('Fetching notifications...');
    const notifications: any[] = [];
    try {
      const notifSnap = await getDocs(collection(db, 'notifications'));
      notifSnap.forEach(row => notifications.push({ id: row.id, ...row.data() }));
    } catch(e) {}

    // Merge topics into subjects for new architecture
    subjects.forEach(subject => {
      subject.topics = topicsBySubject[subject.slug] || [];
    });

    const mockData = {
      subjects,
      topics: [], // Topics are now inside subjects
      settings,
      notifications
    };

    fs.writeFileSync(path.join(process.cwd(), 'public', 'mock_data.json'), JSON.stringify(mockData, null, 2));
    console.log('mock_data.json successfully updated with bundled data!');
  } catch (error) {
    console.error('Error fetching data:', error);
  }
}

extractDocs();
