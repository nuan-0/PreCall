import { collection, doc, getDocs, setDoc, writeBatch, query, where, orderBy } from 'firebase/firestore';
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
   * Rebuilds topic bundles for a specific subject (Metadata, Free Content, Premium Content)
   */
  async rebuildTopicBundle(subjectSlug: string) {
    try {
      const topicsSnap = await getDocs(
        query(
          collection(db, 'topics'),
          where('subjectSlug', '==', subjectSlug)
        )
      );
      const allTopics = topicsSnap.docs.map(d => ({ ...d.data(), id: d.id })) as Topic[];
      allTopics.sort((a, b) => (a.order || 0) - (b.order || 0));
      
      // Helper to remove undefined values (Firestore rejects them)
      const sanitize = (obj: any): any => {
        return JSON.parse(JSON.stringify(obj, (key, value) => 
          value === undefined ? null : value
        ));
      };

      // 1. Metadata bundle (all topics, but no full content) - for SubjectPage list
      const metadata = allTopics.map(t => ({
        id: t.id || '',
        slug: t.slug || '',
        title: t.title || '',
        teaser: t.teaser || '',
        status: t.status || 'free',
        order: t.order ?? 0,
        subjectSlug: t.subjectSlug || '',
        chapter: t.chapter || ''
      }));

      // 2. Free content bundle - full content for free topics
      const freeContent = sanitize(allTopics.filter(t => t.status === 'free'));

      // 3. Premium content bundle - full content for premium topics
      const premiumContent = sanitize(allTopics.filter(t => t.status === 'premium'));

      // Write bundles
      const batch = writeBatch(db);
      const updatedAt = new Date().toISOString();

      batch.set(doc(db, 'bundles', `topics_${subjectSlug}_metadata`), sanitize({ updatedAt, data: metadata }));
      batch.set(doc(db, 'bundles', `topics_${subjectSlug}_free`), sanitize({ updatedAt, data: freeContent }));
      batch.set(doc(db, 'bundles', `topics_${subjectSlug}_premium`), sanitize({ updatedAt, data: premiumContent }));

      await batch.commit();
      console.log(`Split topic bundles for ${subjectSlug} rebuilt successfully`);
      return allTopics;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `bundles/topics_${subjectSlug}`);
      throw error;
    }
  },

  /**
   * Rebuilds all bundles (useful for a full refresh)
   */
  async rebuildAllBundles() {
    try {
      const subjects = await this.rebuildSubjectsBundle();
      for (const subject of subjects) {
        await this.rebuildTopicBundle(subject.slug);
      }
      return { success: true };
    } catch (error) {
      console.error('Failed to rebuild all bundles:', error);
      throw error;
    }
  }
};
