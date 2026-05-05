const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Initialize Firebase Admin
try {
  let config = {};
  const configPath = path.join(__dirname, 'firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  }

  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({
      credential: admin.credential.cert(sa),
      projectId: sa.project_id || config.projectId
    });
  } else {
    admin.initializeApp({ projectId: config.projectId });
  }
} catch (e) {
  console.error('Failed to init firebase admin', e);
  process.exit(1);
}

const db = admin.firestore();

async function migrateData() {
  console.log('Starting migration to Bundle Architecture (Subjects with embedded Topics)...');
  
  try {
    const subjectsSnap = await db.collection('subjects').get();
    const topicsSnap = await db.collection('topics').get();
    
    if (subjectsSnap.empty || topicsSnap.empty) {
      console.log('No data to migrate.');
      return;
    }
    
    const topicsBySubject = {};
    topicsSnap.forEach(tDoc => {
      const topic = { id: tDoc.id, ...tDoc.data() };
      const slug = topic.subjectSlug;
      if (slug) {
        if (!topicsBySubject[slug]) topicsBySubject[slug] = [];
        topicsBySubject[slug].push(topic);
      }
    });
    
    const batch = db.batch();
    
    subjectsSnap.forEach(sDoc => {
      const subject = sDoc.data();
      const slug = subject.slug;
      
      const subjectTopics = topicsBySubject[slug] || [];
      // Assigning topics array into subject document
      batch.update(sDoc.ref, { topics: subjectTopics });
      console.log(`Attached ${subjectTopics.length} topics to subject ${slug}`);
    });
    
    await batch.commit();
    console.log('Migration completed successfully. Subjects now contain topics arrays.');
    
    // Save to mock_data.json for local use
    const allSubjects = [];
    const subjectsSnapNew = await db.collection('subjects').get();
    subjectsSnapNew.forEach(sDoc => {
      allSubjects.push({ id: sDoc.id, ...sDoc.data() });
    });
    
    const mockData = {
      subjects: allSubjects,
      topics: [], // Empty as topics are nested
      settings: (await db.collection('settings').doc('global').get()).data() || {},
      notifications: (await db.collection('notifications').get()).docs.map(d => ({id: d.id, ...d.data()})) || []
    };
    
    fs.writeFileSync(path.join(__dirname, 'public', 'mock_data.json'), JSON.stringify(mockData, null, 2));
    console.log('Generated public/mock_data.json for Dev Environment Shield');
    
  } catch(e) {
    console.error('Migration failed:', e);
  }
}

migrateData();
