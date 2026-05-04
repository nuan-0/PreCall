import { collection, doc, getDocs, setDoc, writeBatch, query, where, orderBy, limit } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Subject, Topic } from '../types';

export const bundleService = {
  /**
   * Rebuilds the global subjects bundle
   */
  async rebuildSubjectsBundle() {
    try {
      const subjectsSnap = await getDocs(collection(db, 'subjects'));
      const subjects = subjectsSnap.docs.map(d => ({ ...d.data(), id: d.id })) as Subject[];
      
      // Sort in memory to avoid missing field index exclusions
      subjects.sort((a, b) => (a.order || 0) - (b.order || 0));
      
      const sanitize = (obj: any): any => {
        return JSON.parse(JSON.stringify(obj, (key, value) => 
          value === undefined ? null : value
        ));
      };
      
      await setDoc(doc(db, 'bundles', 'subjects'), sanitize({
        updatedAt: new Date().toISOString(),
        data: subjects
      }));
      console.log('Subjects bundle rebuilt successfully');
      return subjects;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'bundles/subjects');
      throw error;
    }
  },

  /**
   * Rebuilds topic bundles for a specific subject (DEPRECATED - Use rebuildAllBundles for consolidated docs)
   */
  async rebuildTopicBundle(subjectSlug: string) {
    // We still keep this for backward compatibility if needed, but it should be moved to consolidated strategy
    return this.rebuildAllBundles();
  },

  /**
   * Rebuilds all bundles (optimizing for minimal read counts)
   * This creates consolidated bundles for all subjects and topics.
   */
  async rebuildAllBundles() {
    try {
      // 1. Fetch all subjects and topics
      const subjectsSnap = await getDocs(collection(db, 'subjects'));
      const topicsSnap = await getDocs(collection(db, 'topics'));
      
      const subjects = subjectsSnap.docs.map(d => ({ ...d.data(), id: d.id })) as Subject[];
      const topics = topicsSnap.docs.map(d => ({ ...d.data(), id: d.id })) as Topic[];
      
      subjects.sort((a, b) => (a.order || 0) - (b.order || 0));
      topics.sort((a, b) => (a.order || 0) - (b.order || 0));
      
      const sanitize = (obj: any): any => {
        return JSON.parse(JSON.stringify(obj, (key, value) => 
          value === undefined ? null : value
        ));
      };

      const updatedAt = new Date().toISOString();
      const batch = writeBatch(db);

      // A. Subjects Bundle
      batch.set(doc(db, 'bundles', 'subjects'), sanitize({ updatedAt, data: subjects }));

      // A2. Settings & Notifications Bundle
      const [settingsSnap, notificationsSnap] = await Promise.all([
        getDocs(collection(db, 'settings')),
        getDocs(query(collection(db, 'notifications'), orderBy('timestamp', 'desc'), limit(10)))
      ]);
      
      const settingsMap: any = {};
      settingsSnap.docs.forEach(d => { settingsMap[d.id] = d.data(); });
      
      const notifications = notificationsSnap.docs.map(d => ({ ...d.data(), id: d.id }));
      
      batch.set(doc(db, 'bundles', 'app_config'), sanitize({ 
        updatedAt, 
        settings: settingsMap,
        notifications
      }));

      // B. Metadata Bundle (all topics, small size)
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
      batch.set(doc(db, 'bundles', 'topics_all_metadata'), sanitize({ updatedAt, data: metadata }));

      // C. Consolidated Free Content (Full)
      const freeContent = topics.filter(t => t.status === 'free');
      batch.set(doc(db, 'bundles', 'topics_all_free'), sanitize({ updatedAt, data: freeContent }));

      // D. Consolidated Premium Content (Full)
      const premiumContent = topics.filter(t => t.status === 'premium');
      batch.set(doc(db, 'bundles', 'topics_all_premium'), sanitize({ updatedAt, data: premiumContent }));

      // E. Cleanup old subject-specific bundles
      const oldBundlesSnap = await getDocs(collection(db, 'bundles'));
      oldBundlesSnap.docs.forEach(d => {
        // Delete subject-specific bundles but KEEP consolidated ones
        if (d.id.startsWith('topics_') && !d.id.includes('_all_')) {
          batch.delete(d.ref);
        }
        // Also cleanup old separate subjects bundle if it's mirrored in config (optional)
      });

      await batch.commit();
      console.log('✅ Consolidated bundles rebuilt successfully (Subjects, Metadata, Free, Premium)');
      return { success: true };
    } catch (error: any) {
      console.error('Failed to rebuild all bundles:', error);
      handleFirestoreError(error, OperationType.WRITE, 'bundles/all');
      throw error;
    }
  }
};
