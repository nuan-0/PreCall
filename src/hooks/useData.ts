import { collection, doc, onSnapshot, query, where, orderBy, getDocs, getDoc } from 'firebase/firestore';
import { useEffect, useState, useCallback } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Subject, Topic, AppSettings, UserProfile, AppNotification } from '../types';
import { getQuotaStatus } from '../lib/quota';

const CACHE_PREFIX = 'precall_cache_';
const memoryCache: Record<string, { data: any, timestamp: number }> = {};
const DEFAULT_TTL = 1000 * 60 * 15; // 15 minutes TTL for most data

function getCache<T>(key: string, ttl = DEFAULT_TTL): T | null {
  // Check memory cache first
  if (memoryCache[key]) {
    const { data, timestamp } = memoryCache[key];
    if (Date.now() - timestamp < ttl) {
      return data;
    }
  }

  // Check localStorage
  const cached = localStorage.getItem(CACHE_PREFIX + key);
  if (!cached) return null;

  try {
    const parsed = JSON.parse(cached);
    if (Date.now() - parsed.timestamp < ttl) {
      memoryCache[key] = parsed;
      return parsed.data;
    }
    // Expired
    localStorage.removeItem(CACHE_PREFIX + key);
    delete memoryCache[key];
    return null;
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

async function reportUsage(reads: number) {
  try {
    fetch('/api/report-usage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reads })
    });
  } catch (e) {
    // Ignore reporting errors to not affect UX
  }
}

async function reportError(error: any) {
  try {
    const errObj = error instanceof Error ? { message: error.message, stack: error.stack } : { message: String(error) };
    fetch('/api/report-error', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        ...errObj,
        userId: (window as any)._userId,
        url: window.location.href,
        userAgent: navigator.userAgent
      })
    });
  } catch (e) {
    // Ignore
  }
}

export function useSubjects() {
  const [subjects, setSubjects] = useState<Subject[]>(() => getCache<Subject[]>('subjects') || []);
  const [loading, setLoading] = useState(subjects.length === 0);

  useEffect(() => {
    // If we have valid cache, don't fetch from network
    const cached = getCache<Subject[]>('subjects');
    if (cached) {
      setSubjects(cached);
      setLoading(false);
      return;
    }

    if (getQuotaStatus()) {
      setLoading(false);
      return;
    }

    const fetchSubjects = async () => {
      try {
        // Try bundle first
        const bundleRef = doc(db, 'bundles', 'subjects');
        const bundleSnap = await getDoc(bundleRef);
        
        if (bundleSnap.exists()) {
          const bundleData = bundleSnap.data();
          if (bundleData.data) {
            const sortedData = [...bundleData.data].sort((a, b) => (a.order || 0) - (b.order || 0));
            setSubjects(sortedData);
            setCache('subjects', sortedData);
            setLoading(false);
            reportUsage(1);
            return;
          }
        }

        // Fallback to collection
        const q = query(collection(db, 'subjects'), orderBy('order', 'asc'));
        const snapshot = await getDocs(q);
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Subject));
        setSubjects(data);
        setCache('subjects', data);
        reportUsage(snapshot.size || 1);
      } catch (error: any) {
        console.error("Error fetching subjects:", error);
        if (error.message?.includes('quota')) reportError(error);
      } finally {
        setLoading(false);
      }
    };

    fetchSubjects();
  }, []);

  return { subjects, loading };
}

export function useDashboardData() {
  const [data, setData] = useState<{ subjects: Subject[], topics: Topic[] }>(() => ({
    subjects: getCache<Subject[]>('subjects') || [],
    topics: getCache<Topic[]>('topics_all') || []
  }));
  const [loading, setLoading] = useState(data.subjects.length === 0 || data.topics.length === 0);

  useEffect(() => {
    // Check if we have both in cache
    const cachedSubjects = getCache<Subject[]>('subjects');
    const cachedTopics = getCache<Topic[]>('topics_all');
    
    if (cachedSubjects && cachedTopics) {
      setData({ subjects: cachedSubjects, topics: cachedTopics });
      setLoading(false);
      return;
    }

    if (getQuotaStatus()) {
      setLoading(false);
      return;
    }

    const fetchAll = async () => {
      try {
        // Parallel fetches using getDocs instead of onSnapshot
        const [subjectsBundle, topicsSnap] = await Promise.all([
          getDoc(doc(db, 'bundles', 'subjects')),
          getDocs(query(collection(db, 'topics'), orderBy('order', 'asc')))
        ]);

        let subjectsData: Subject[] = [];
        if (subjectsBundle.exists() && subjectsBundle.data().data) {
          subjectsData = subjectsBundle.data().data;
        } else {
          // Fallback if bundle fails
          const subjectsSnap = await getDocs(query(collection(db, 'subjects'), orderBy('order', 'asc')));
          subjectsData = subjectsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Subject));
        }

        const topicsData = topicsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Topic));

        const newData = { subjects: subjectsData, topics: topicsData };
        setData(newData);
        setCache('subjects', subjectsData);
        setCache('topics_all', topicsData);
        reportUsage(1 + topicsSnap.size);
      } catch (error: any) {
        console.error("Error fetching dashboard data:", error);
        handleFirestoreError(error, OperationType.LIST, 'dashboard_data');
        if (error.message?.includes('quota')) reportError(error);
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, []);

  return { ...data, loading };
}

export function useTopics(subjectSlug?: string) {
  const cacheKey = `topics_${subjectSlug || 'all'}`;
  const [topics, setTopics] = useState<Topic[]>(() => getCache<Topic[]>(cacheKey) || []);
  const [loading, setLoading] = useState(topics.length === 0);

  useEffect(() => {
    const cached = getCache<Topic[]>(cacheKey);
    if (cached) {
      setTopics(cached);
      setLoading(false);
      return;
    }

    if (getQuotaStatus()) {
      setLoading(false);
      return;
    }

    const fetchTopics = async () => {
      try {
        if (subjectSlug) {
          const metaRef = doc(db, 'bundles', `topics_${subjectSlug}_metadata`);
          const metaSnap = await getDoc(metaRef);
          
          if (metaSnap.exists()) {
            const metaList = metaSnap.data().data as Topic[];
            setTopics(metaList);
            setCache(cacheKey, metaList);
            setLoading(false);
            reportUsage(1);
            return;
          }

          // Fallback
          const q = query(
            collection(db, 'topics'),
            where('subjectSlug', '==', subjectSlug),
            orderBy('order', 'asc')
          );
          const snap = await getDocs(q);
          const d = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Topic));
          setTopics(d);
          setCache(cacheKey, d);
          reportUsage(snap.size || 1);
        } else {
          const q = query(collection(db, 'topics'), orderBy('order', 'asc'));
          const snap = await getDocs(q);
          const d = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Topic));
          setTopics(d);
          setCache(cacheKey, d);
          reportUsage(snap.size || 1);
        }
      } catch (error: any) {
        console.error("Error fetching topics:", error);
        if (error.message?.includes('quota')) reportError(error);
      } finally {
        setLoading(false);
      }
    };

    fetchTopics();
  }, [subjectSlug]);

  return { topics, loading };
}

export function useTopic(slug?: string) {
  const cacheKey = `topic_${slug}`;
  const [topic, setTopic] = useState<Topic | null>(() => getCache<Topic>(cacheKey));
  const [loading, setLoading] = useState(!topic);

  useEffect(() => {
    if (!slug) return;
    
    const cached = getCache<Topic>(cacheKey);
    if (cached) {
      setTopic(cached);
      setLoading(false);
      return;
    }

    const fetchTopic = async () => {
      try {
        // Check in loaded content bundles first (already in memory cache logic)
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

        const q = query(collection(db, 'topics'), where('slug', '==', slug));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          const data = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Topic;
          setTopic(data);
          setCache(cacheKey, data);
          reportUsage(1);
        } else {
          setTopic(null);
        }
      } catch (error: any) {
        console.error("Error fetching topic:", error);
        if (error.message?.includes('quota')) reportError(error);
      } finally {
        setLoading(false);
      }
    };

    fetchTopic();
  }, [slug]);

  return { topic, loading };
}

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings | null>(() => getCache<AppSettings>('settings'));
  const [loading, setLoading] = useState(!settings);

  useEffect(() => {
    const cached = getCache<AppSettings>('settings');
    if (cached) {
      setSettings(cached);
      setLoading(false);
      return;
    }

    if (getQuotaStatus()) {
      setLoading(false);
      return;
    }

    const fetchSettings = async () => {
      try {
        const docRef = doc(db, 'settings', 'global');
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const data = snap.data() as AppSettings;
          setSettings(data);
          setCache('settings', data);
          reportUsage(1);
        }
      } catch (error: any) {
        console.error("Error fetching settings:", error);
        if (error.message?.includes('quota')) reportError(error);
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, []);

  return { settings, loading };
}

export function useUserProfile(uid?: string) {
  const cacheKey = `profile_${uid}`;
  const [profile, setProfile] = useState<UserProfile | null>(() => uid ? getCache<UserProfile>(cacheKey, 1000 * 60 * 5) : null); // Profile TTL 5 mins
  const [loading, setLoading] = useState(uid ? !profile : false);

  useEffect(() => {
    if (!uid) {
      setProfile(null);
      setLoading(false);
      return;
    }

    const cached = getCache<UserProfile>(cacheKey, 1000 * 60 * 5);
    if (cached) {
      setProfile(cached);
      setLoading(false);
      return;
    }

    const fetchProfile = async () => {
      try {
        const docRef = doc(db, 'users', uid);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const data = snap.data() as UserProfile;
          setProfile(data);
          setCache(cacheKey, data);
          reportUsage(1);
        } else {
          setProfile(null);
        }
      } catch (error: any) {
        console.error("Error fetching profile:", error);
        if (error.message?.includes('quota')) reportError(error);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [uid]);

  return { profile, loading };
}

export function useNotifications(uid?: string, isAdmin?: boolean) {
  const cacheKey = `notifications_${uid || 'guest'}_${isAdmin ? 'admin' : 'user'}`;
  const [notifications, setNotifications] = useState<AppNotification[]>(() => getCache<AppNotification[]>(cacheKey, 1000 * 60 * 5) || []);
  const [loading, setLoading] = useState(notifications.length === 0);

  useEffect(() => {
    if (!uid && !isAdmin) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    const cached = getCache<AppNotification[]>(cacheKey, 1000 * 60 * 5);
    if (cached) {
      setNotifications(cached);
      setLoading(false);
      return;
    }

    const fetchNotifications = async () => {
      try {
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
        const snap = await getDocs(q);
        const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
        setNotifications(data);
        setCache(cacheKey, data);
        reportUsage(snap.size || 1);
      } catch (error: any) {
        console.error("Error fetching notifications:", error);
        if (error.message?.includes('quota')) reportError(error);
      } finally {
        setLoading(false);
      }
    };

    fetchNotifications();
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
