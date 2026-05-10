import { db } from '../../src/firebase';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';

async function run() {
  const q = collection(db, 'subjects');
  const snap = await getDocs(q);
  for (const d of snap.docs) {
    if (d.data().slug === 'polity') {
       let topics = d.data().topics || [];
       let modified = false;
       for (let i = 0; i < topics.length; i++) {
         if (topics[i].slug === 'preamble' || topics[i].title?.toLowerCase().includes('preamble')) {
           topics[i].order = -10; // set very low
           topics[i].status = 'free';
           modified = true;
         }
       }
       if (modified) {
         topics.sort((a, b) => (a.order || 0) - (b.order || 0));
         await updateDoc(doc(db, 'subjects', d.id), { topics });
         console.log('Updated polity topics!');
       }
    }
  }
  process.exit(0);
}
run().catch(console.error);
