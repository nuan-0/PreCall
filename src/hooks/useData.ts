import { useEffect, useState } from 'react';
import { Subject, Topic, AppSettings, UserProfile, AppNotification } from '../types';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { doc, onSnapshot } from 'firebase/firestore';

const CACHE_PREFIX = 'precall_cache_';
// Add in-memory cache to prevent multiple renders
let memoryCache: Record<string, any> = {};
let globalFetchPromise: Promise<void> | null = null;
let eventTarget = new EventTarget();

export function getCache<T>(key: string): T | null {
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

export function setCache<T>(key: string, data: T) {
  memoryCache[key] = data;
  localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(data));
}

export async function fetchGlobalData(force = false) {
  if (globalFetchPromise && !force) return globalFetchPromise;
  
  globalFetchPromise = (async () => {
    try {
      const hostname = window.location.hostname;
      // 5. Dev Environment Shield
      const isDev = hostname === 'localhost' || hostname.includes('ais-dev') || hostname.includes('run.app');
      
      let data: any;

      if (isDev) {
        console.log('[Dev Shield] Bypassing Firestore. Loading local mock_data.json...');
        const res = await fetch('/mock_data.json');
        if (!res.ok) throw new Error('mock_data.json not found');
        data = await res.json();
      } else {
        // 1 & 3. PWA Local Storage & Edge Caching
        const lastUpdated = localStorage.getItem(CACHE_PREFIX + 'lastUpdated') || '0';
        console.log('[Prod Data] Fetching via Edge API endpoint...');
        
        const res = await fetch(`/api/content/all?lastUpdated=${lastUpdated}`);
        if (!res.ok) throw new Error('Failed to fetch from API');
        
        const json = await res.json();
        if (json.status === 'unchanged') {
          console.log('[Prod Data] API returned unchanged. Returning from Zero-Read PWA Cache!');
          return;
        }
        data = json;
      }

      if (data && data.subjects) {
        setCache('subjects', data.subjects);
        
        let allTopics: Topic[] = [];
        
        // Always derive allTopics from subjects as the single source of truth
        data.subjects.forEach((subj: Subject) => {
          if (subj.topics && subj.topics.length > 0) {
            allTopics = [...allTopics, ...subj.topics];
          }
        });
        
        setCache('topics_all', allTopics);
        if (data.settings) setCache('settings', data.settings);
        if (data.notifications) setCache('notifications_all', data.notifications);
        if (data.lastUpdated) localStorage.setItem(CACHE_PREFIX + 'lastUpdated', data.lastUpdated.toString());
        
        eventTarget.dispatchEvent(new Event('data_updated'));
      }
    } catch (err: any) {
      console.error('[Data Fetch] Error:', err.message);
    }
  })();
  
  return globalFetchPromise;
}

export function useGlobalDataSync() {
  const [synced, setSynced] = useState(false);
  useEffect(() => {
    fetchGlobalData().finally(() => setSynced(true));
  }, []);
  return synced;
}

export function useSubjects() {
  const [subjects, setSubjects] = useState<Subject[]>(() => getCache<Subject[]>('subjects') || []);
  const [loading, setLoading] = useState(!subjects.length);

  useEffect(() => {
    const handler = () => {
      setSubjects(getCache<Subject[]>('subjects') || []);
      setLoading(false);
    };
    eventTarget.addEventListener('data_updated', handler);
    if (!subjects.length) {
      fetchGlobalData().finally(() => setLoading(false));
    }
    return () => eventTarget.removeEventListener('data_updated', handler);
  }, [subjects.length]);

  return { subjects, loading };
}

export function useDashboardData() {
  const [data, setData] = useState<{ subjects: Subject[], topics: Topic[] }>(() => ({
    subjects: getCache<Subject[]>('subjects') || [],
    topics: getCache<Topic[]>('topics_all') || []
  }));
  const [loading, setLoading] = useState(!data.subjects.length || !data.topics.length);

  useEffect(() => {
    const handler = () => {
      setData({
        subjects: getCache<Subject[]>('subjects') || [],
        topics: getCache<Topic[]>('topics_all') || []
      });
      setLoading(false);
    };
    eventTarget.addEventListener('data_updated', handler);
    if (!data.subjects.length) {
      fetchGlobalData().finally(() => setLoading(false));
    }
    return () => eventTarget.removeEventListener('data_updated', handler);
  }, [data.subjects.length]);

  return { ...data, loading };
}

export function useTopics(subjectSlug?: string) {
  const getFilteredTopics = () => {
    const all = getCache<Topic[]>('topics_all') || [];
    return subjectSlug ? all.filter(t => t.subjectSlug === subjectSlug) : all;
  };
  
  const [topics, setTopics] = useState<Topic[]>(getFilteredTopics);
  const [loading, setLoading] = useState(!topics.length);

  useEffect(() => {
    const handler = () => {
      setTopics(getFilteredTopics());
      setLoading(false);
    };
    eventTarget.addEventListener('data_updated', handler);
    if (!topics.length) {
      fetchGlobalData().finally(() => setLoading(false));
    }
    return () => eventTarget.removeEventListener('data_updated', handler);
  }, [subjectSlug, topics.length]);

  return { topics, loading };
}

export function useTopic(slug?: string) {
  const getTopic = () => {
    const all = getCache<Topic[]>('topics_all') || [];
    return all.find(t => t.slug === slug) || null;
  };

  const [topic, setTopic] = useState<Topic | null>(getTopic);
  const [loading, setLoading] = useState(!topic);

  useEffect(() => {
    const handler = () => {
      setTopic(getTopic());
      setLoading(false);
    };
    eventTarget.addEventListener('data_updated', handler);
    if (!topic) {
      fetchGlobalData().finally(() => setLoading(false));
    }
    return () => eventTarget.removeEventListener('data_updated', handler);
  }, [slug, topic]);

  return { topic, loading };
}

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings | null>(() => getCache<AppSettings>('settings'));
  const [loading, setLoading] = useState(!settings);

  useEffect(() => {
    const handler = () => {
      setSettings(getCache<AppSettings>('settings'));
      setLoading(false);
    };
    eventTarget.addEventListener('data_updated', handler);
    if (!settings) {
      fetchGlobalData().finally(() => setLoading(false));
    }
    return () => eventTarget.removeEventListener('data_updated', handler);
  }, [settings]);

  return { settings, loading };
}

export function useNotifications(uid?: string, isAdmin?: boolean) {
  const [notifications, setNotifications] = useState<AppNotification[]>(() => getCache<AppNotification[]>('notifications_all') || []);
  const [loading, setLoading] = useState(!notifications.length);

  useEffect(() => {
    const handler = () => {
      const all = getCache<AppNotification[]>('notifications_all') || [];
      if (isAdmin) {
        setNotifications(all);
      } else {
        setNotifications(all.filter(n => !n.userId || n.userId === uid || n.userId === 'all'));
      }
      setLoading(false);
    };
    eventTarget.addEventListener('data_updated', handler);
    if (!notifications.length) {
      fetchGlobalData().finally(() => setLoading(false));
    }
    return () => eventTarget.removeEventListener('data_updated', handler);
  }, [uid, isAdmin, notifications.length]);

  return { notifications, loading };
}

export function useUserProfile(uid?: string) {
  // Profiles must remain dynamic and read from direct Firestore
  // because user data is unique to the logged-in user and private
  const cacheKey = `profile_${uid}`;
  const [profile, setProfile] = useState<UserProfile | null>(() => uid ? getCache<UserProfile>(cacheKey) : null);
  const [loading, setLoading] = useState(uid ? !profile : false);

  useEffect(() => {
    if (!uid) {
      setProfile(null);
      setLoading(false);
      return;
    }
    
    // Dev Shield check for profiles
    const hostname = window.location.hostname;
    const isDev = hostname === 'localhost' || hostname.includes('ais-dev') || hostname.includes('run.app');
    
    if (isDev) {
      const mockProfile: UserProfile = {
        uid,
        email: 'dev_user@example.com',
        displayName: 'Dev User',
        role: 'admin',
        isPremium: true,
        lastLogin: new Date().toISOString()
      };
      setProfile(mockProfile);
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
