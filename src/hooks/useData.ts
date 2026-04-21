import { collection, doc, onSnapshot, query, where, orderBy, getDocs, getDoc } from 'firebase/firestore';
import { useEffect, useState, useCallback } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Subject, Topic, AppSettings, UserProfile, AppNotification } from '../types';

const CACHE_PREFIX = 'precall_cache_';
const memoryCache: Record<string, any> = {};

function getCache<T>(key: string): T | null {
  if (memoryCache[key]) return memoryCache[key];
  const cached = localStorage.getItem(CACHE_PREFIX + key);
  if (!cached) return null;
  try {
    const parsed = JSON.parse(cached);
    memoryCache[key] = parsed;
    return parsed;
  } catch {
    return null;
  }
}

function setCache<T>(key: string, data: T) {
  memoryCache[key] = data;
  localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(data));
}

export function useSubjects() {
  const [subjects, setSubjects] = useState<Subject[]>(() => getCache<Subject[]>('subjects') || []);
  const [loading, setLoading] = useState(!subjects.length);

  useEffect(() => {
    const path = 'subjects';
    const q = query(collection(db, path), orderBy('order', 'asc'));
    
    // SWR: Initial fetch using Promise.all if needed, but onSnapshot is already async
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (snapshot.empty) {
        const defaultSubjects = [
          {
            id: 'polity',
            slug: 'polity',
            title: 'Polity',
            description: 'Master the Constitution, Fundamental Rights, and Governance with high-yield topics.',
            order: 1,
            status: 'live',
            pdfVisible: true,
            pdfTitle: 'High-Yield Polity PDF',
            pdfAccessType: 'premium'
          },
          {
            id: 'modern-history',
            slug: 'modern-history',
            title: 'Modern Indian History',
            description: 'From European arrival to Independence. Master movements, leaders, and constitutional evolution.',
            order: 2,
            status: 'live',
            pdfVisible: true,
            pdfTitle: 'Modern History Compendium',
            pdfAccessType: 'premium'
          }
        ] as Subject[];
        setSubjects(defaultSubjects);
        setCache('subjects', defaultSubjects);
      } else {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Subject));
        setSubjects(data);
        setCache('subjects', data);
      }
      setLoading(false);
    }, (error) => {
      setLoading(false);
      handleFirestoreError(error, OperationType.LIST, path);
    });
    return unsubscribe;
  }, []);

  return { subjects, loading };
}

export function useDashboardData() {
  const [data, setData] = useState<{ subjects: Subject[], topics: Topic[] }>(() => ({
    subjects: getCache<Subject[]>('subjects') || [],
    topics: getCache<Topic[]>('topics_all') || []
  }));
  const [loading, setLoading] = useState(!data.subjects.length || !data.topics.length);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const subjectsQuery = query(collection(db, 'subjects'), orderBy('order', 'asc'));
        const topicsQuery = query(collection(db, 'topics'), orderBy('order', 'asc'));

        // Combine fetches into a single Promise.all() call for speed
        const [subjectsSnap, topicsSnap] = await Promise.all([
          getDocs(subjectsQuery),
          getDocs(topicsQuery)
        ]);

        const subjectsData = subjectsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Subject));
        const topicsData = topicsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Topic));

        const newData = { subjects: subjectsData, topics: topicsData };
        setData(newData);
        setCache('subjects', subjectsData);
        setCache('topics_all', topicsData);
        setLoading(false);
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
        setLoading(false);
      }
    };

    fetchAll();

    // Still use listeners for "seamless" real-time updates
    const subjectsUnsub = onSnapshot(query(collection(db, 'subjects'), orderBy('order', 'asc')), (snap) => {
      const d = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Subject));
      setData(prev => ({ ...prev, subjects: d }));
      setCache('subjects', d);
    });

    const topicsUnsub = onSnapshot(query(collection(db, 'topics'), orderBy('order', 'asc')), (snap) => {
      const d = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Topic));
      setData(prev => ({ ...prev, topics: d }));
      setCache('topics_all', d);
    });

    return () => {
      subjectsUnsub();
      topicsUnsub();
    };
  }, []);

  return { ...data, loading };
}

export function useTopics(subjectSlug?: string) {
  const cacheKey = `topics_${subjectSlug || 'all'}`;
  const [topics, setTopics] = useState<Topic[]>(() => getCache<Topic[]>(cacheKey) || []);
  const [loading, setLoading] = useState(!topics.length);

  useEffect(() => {
    const path = 'topics';
    let q;
    
    if (subjectSlug) {
      q = query(
        collection(db, path),
        where('subjectSlug', '==', subjectSlug),
        orderBy('order', 'asc')
      );
    } else {
      q = query(
        collection(db, path),
        orderBy('order', 'asc')
      );
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (snapshot.empty) {
        let defaultTopics: Topic[] = [];
        
        if (subjectSlug === 'polity') {
          defaultTopics = [
            {
              id: 'article-21-right-to-life',
              slug: 'article-21-right-to-life',
              subjectSlug: 'polity',
              chapter: 'Fundamental Rights',
              title: 'Article 21 – Right to Life',
              teaser: 'The "Heart of FR". Expanded by the SC to cover everything from Privacy to Sleep.',
              status: 'free',
              order: 1,
              estimatedTime: '10 mins'
            },
            {
              id: 'preamble-identity-card',
              slug: 'preamble-identity-card',
              subjectSlug: 'polity',
              chapter: 'Preamble',
              title: 'The Preamble: Identity Card',
              teaser: 'Sovereign, Socialist, Secular, Democratic, Republic. Key to the Constitution.',
              status: 'premium',
              order: 2,
              estimatedTime: '8 mins'
            }
          ] as Topic[];
        } else if (subjectSlug === 'modern-history') {
          defaultTopics = [
            {
              id: 'european-penetration',
              slug: 'european-penetration',
              subjectSlug: 'modern-history',
              chapter: 'Advent of Europeans',
              title: 'European Penetration into India',
              teaser: 'From "God, Gold and Glory" to systematic shifts in trade and naval strategy.',
              status: 'free',
              order: 1,
              estimatedTime: '12 mins'
            },
            {
              id: 'revolt-of-1857',
              slug: 'revolt-of-1857',
              subjectSlug: 'modern-history',
              chapter: 'Revolts',
              title: 'The Great Revolt of 1857',
              teaser: 'The "First War of Independence" and the end of EIC Company rule.',
              status: 'premium',
              order: 2,
              estimatedTime: '15 mins'
            }
          ] as Topic[];
        }

        if (defaultTopics.length > 0) {
          setTopics(defaultTopics);
          setCache(cacheKey, defaultTopics);
        } else {
          setTopics([]);
        }
      } else {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Topic));
        setTopics(data);
        setCache(cacheKey, data);
      }
      setLoading(false);
    }, (error) => {
      setLoading(false);
      handleFirestoreError(error, OperationType.LIST, path);
    });
    return unsubscribe;
  }, [subjectSlug]);

  return { topics, loading };
}

export function useTopic(slug?: string) {
  const cacheKey = `topic_${slug}`;
  const [topic, setTopic] = useState<Topic | null>(() => getCache<Topic>(cacheKey));
  const [loading, setLoading] = useState(!topic);

  useEffect(() => {
    if (!slug) return;
    const path = 'topics';
    const q = query(collection(db, path), where('slug', '==', slug));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const data = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Topic;
        setTopic(data);
        setCache(cacheKey, data);
      } else {
        setTopic(null);
      }
      setLoading(false);
    }, (error) => {
      setLoading(false);
      handleFirestoreError(error, OperationType.GET, path);
    });
    return unsubscribe;
  }, [slug]);

  return { topic, loading };
}

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings | null>(() => getCache<AppSettings>('settings'));
  const [loading, setLoading] = useState(!settings);

  useEffect(() => {
    const path = 'settings/global';
    const docRef = doc(db, 'settings', 'global');
    const unsubscribe = onSnapshot(docRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data() as AppSettings;
        setSettings(data);
        setCache('settings', data);
      }
      setLoading(false);
    }, (error) => {
      setLoading(false);
      handleFirestoreError(error, OperationType.GET, path);
    });
    return unsubscribe;
  }, []);

  return { settings, loading };
}

export function useUserProfile(uid?: string) {
  const cacheKey = `profile_${uid}`;
  const [profile, setProfile] = useState<UserProfile | null>(() => uid ? getCache<UserProfile>(cacheKey) : null);
  const [loading, setLoading] = useState(uid ? !profile : false);

  useEffect(() => {
    if (!uid) {
      setProfile(null);
      setLoading(false);
      return;
    }

    const path = `users/${uid}`;
    const docRef = doc(db, 'users', uid);
    const unsubscribe = onSnapshot(docRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data() as UserProfile;
        setProfile(data);
        setCache(cacheKey, data);
      } else {
        setProfile(null);
      }
      setLoading(false);
    }, (error) => {
      setLoading(false);
      handleFirestoreError(error, OperationType.GET, path);
    });
    return unsubscribe;
  }, [uid]);

  return { profile, loading };
}

export function useNotifications(uid?: string, isAdmin?: boolean) {
  const cacheKey = `notifications_${uid || 'guest'}_${isAdmin ? 'admin' : 'user'}`;
  const [notifications, setNotifications] = useState<AppNotification[]>(() => getCache<AppNotification[]>(cacheKey) || []);
  const [loading, setLoading] = useState(!notifications.length);

  useEffect(() => {
    if (!uid && !isAdmin) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    const path = 'notifications';
    let q;
    
    if (isAdmin) {
      q = query(collection(db, path), orderBy('createdAt', 'desc'));
    } else {
      q = query(
        collection(db, path), 
        where('userId', 'in', [uid || 'guest', 'all']),
        orderBy('createdAt', 'desc')
      );
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      setNotifications(data as AppNotification[]);
      setCache(cacheKey, data);
      setLoading(false);
    }, (error) => {
      setLoading(false);
      handleFirestoreError(error, OperationType.LIST, path);
    });
    return unsubscribe;
  }, [uid, isAdmin]);

  return { notifications, loading };
}

export function useAvatarUnlock(uid?: string) {
  const cacheKey = `avatar_unlocked_${uid || 'guest'}`;
  const [isUnlocked, setIsUnlocked] = useState(() => {
    return localStorage.getItem(cacheKey) === 'true';
  });

  const unlockAvatar = () => {
    setIsUnlocked(true);
    localStorage.setItem(cacheKey, 'true');
  };

  return { isUnlocked, unlockAvatar };
}
