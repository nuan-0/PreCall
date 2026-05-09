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
   * (DEPRECATED) No longer rebuilds bundles.
   */
  async rebuildAllBundles() {
    return { success: true };
  }
};
