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
    // 1. First, try to get from the bundle for efficiency (1 read)
    const bundleRef = doc(db, 'bundles', 'subjects');
    const unsubscribeBundle = onSnapshot(bundleRef, (bundleSnap) => {
      if (bundleSnap.exists()) {
        const bundleData = bundleSnap.data();
        if (bundleData.data) {
          const sortedData = [...bundleData.data].sort((a, b) => (a.order || 0) - (b.order || 0));
          setSubjects(sortedData);
          setCache('subjects', sortedData);
          setLoading(false);
          return;
        }
      }
      
      // 2. Fallback to collection if bundle missing (only happens once during setup)
      const path = 'subjects';
      const q = query(collection(db, path), orderBy('order', 'asc'));
      
      getDocs(q).then((snapshot) => {
        if (!snapshot.empty) {
          const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Subject));
          setSubjects(data);
          setCache('subjects', data);
        }
        setLoading(false);
      }).catch((error) => {
        setLoading(false);
        handleFirestoreError(error, OperationType.LIST, path);
      });
    }, (error) => {
      console.warn("Bundle not accessible or missing:", error);
    });

    return unsubscribeBundle;
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
        // Try to get subjects from bundle first
        const subjectsBundle = await getDoc(doc(db, 'bundles', 'subjects'));
        let subjectsData: Subject[] = [];
        
        if (subjectsBundle.exists() && subjectsBundle.data().data) {
          subjectsData = subjectsBundle.data().data;
        } else {
          const subjectsSnap = await getDocs(query(collection(db, 'subjects'), orderBy('order', 'asc')));
          subjectsData = subjectsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Subject));
        }

        const topicsSnap = await getDocs(query(collection(db, 'topics'), orderBy('order', 'asc')));
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
    // 1. If subject specific, try topic metadata bundle first (fast list)
    if (subjectSlug) {
      const metaRef = doc(db, 'bundles', `topics_${subjectSlug}_metadata`);
      const freeRef = doc(db, 'bundles', `topics_${subjectSlug}_free`);
      const premRef = doc(db, 'bundles', `topics_${subjectSlug}_premium`);

      const unsubscribe = onSnapshot(metaRef, async (metaSnap) => {
        if (metaSnap.exists()) {
          const metaList = metaSnap.data().data as Topic[];
          setTopics(metaList);
          setCache(cacheKey, metaList);
          setLoading(false);

          // Proactively try to load full content bundles to cache for instant page loads
          try {
            const [freeSnap, premSnap] = await Promise.allSettled([
              getDoc(freeRef),
              getDoc(premRef)
            ]);

            if (freeSnap.status === 'fulfilled' && freeSnap.value.exists()) {
              setCache(`bundle_content_free_${subjectSlug}`, freeSnap.value.data().data);
            }
            if (premSnap.status === 'fulfilled' && premSnap.value.exists()) {
               setCache(`bundle_content_premium_${subjectSlug}`, premSnap.value.data().data);
            }
          } catch (e) {
            console.log("Full bundle content load failed or restricted");
          }
        } else {
           // Fallback to collection query
           const q = query(
            collection(db, 'topics'),
            where('subjectSlug', '==', subjectSlug),
            orderBy('order', 'asc')
          );
          const snap = await getDocs(q);
          const d = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Topic));
          setTopics(d);
          setCache(cacheKey, d);
          setLoading(false);
        }
      });
      return unsubscribe;
    }

    // 2. For "all" topics (admin panel)
    const q = query(collection(db, 'topics'), orderBy('order', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Topic));
      setTopics(data);
      setCache(cacheKey, data);
      setLoading(false);
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
    
    // 1. Check if topic exists in any loaded bundle in memory cache
    // We scan all cached bundle contents
    const cachedBundles = Object.keys(memoryCache).filter(k => k.startsWith('bundle_content_'));
    for (const key of cachedBundles) {
      const bundleData = memoryCache[key].data as Topic[];
      const found = bundleData.find(t => t.slug === slug);
      if (found) {
        setTopic(found);
        setCache(cacheKey, found);
        setLoading(false);
        return;
      }
    }

    // 2. Otherwise fetch individually
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
