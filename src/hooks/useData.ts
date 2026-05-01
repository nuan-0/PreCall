import { collection, doc, onSnapshot, query, where, orderBy, getDocs, getDoc } from 'firebase/firestore';
import { useEffect, useState, useCallback } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Subject, Topic, AppSettings, UserProfile, AppNotification } from '../types';
import { getQuotaStatus } from '../lib/quota';

const CACHE_PREFIX = 'precall_cache_';
const memoryCache: Record<string, { data: any, timestamp: number }> = {};
const DEFAULT_TTL = 1000 * 60 * 60; // 1 hour

function getCache<T>(key: string): T | null {
  // Always return from memory cache first for speed
  if (memoryCache[key]) {
    return memoryCache[key].data;
  }

  // Check localStorage
  const cached = localStorage.getItem(CACHE_PREFIX + key);
  if (!cached) return null;

  try {
    const parsed = JSON.parse(cached);
    memoryCache[key] = parsed;
    return parsed.data;
  } catch {
    return null;
  }
}

function setCache<T>(key: string, data: T) {
  const cacheObj = { data, timestamp: Date.now() };
  memoryCache[key] = cacheObj;
  localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(cacheObj));
}

export function useQuotaStatus() {
  const [isExceeded, setIsExceeded] = useState(getQuotaStatus());

  useEffect(() => {
    const handler = (e: any) => {
      setIsExceeded(e.detail);
    };
    window.addEventListener('precall_quota_change', handler);
    return () => window.removeEventListener('precall_quota_change', handler);
  }, []);

  return isExceeded;
}

export function useSubjects() {
  const [subjects, setSubjects] = useState<Subject[]>(() => getCache<Subject[]>('subjects') || []);
  const [loading, setLoading] = useState(!subjects.length);

  useEffect(() => {
    const path = 'subjects';
    const q = query(collection(db, path), orderBy('order', 'asc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (snapshot.empty) {
        // Only set defaults if we have absolutely nothing
        if (subjects.length === 0) {
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
        }
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
        handleFirestoreError(error, OperationType.LIST, 'dashboard_data');
      }
    };

    fetchAll();

    // Still use listeners for "seamless" real-time updates
    const subjectsUnsub = onSnapshot(query(collection(db, 'subjects'), orderBy('order', 'asc')), (snap) => {
      const d = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Subject));
      setData(prev => ({ ...prev, subjects: d }));
      setCache('subjects', d);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'subjects'));

    const topicsUnsub = onSnapshot(query(collection(db, 'topics'), orderBy('order', 'asc')), (snap) => {
      const d = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Topic));
      setData(prev => ({ ...prev, topics: d }));
      setCache('topics_all', d);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'topics'));

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
        // Defaults removed for brevity but they could be here if needed
        // Only set if we have absolutely nothing
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
