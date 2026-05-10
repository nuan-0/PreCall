import { useEffect, useState } from 'react';
import { Subject, Topic, AppSettings, UserProfile, AppNotification } from '../types';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { doc, onSnapshot, collection, query, where, orderBy, getDocs } from 'firebase/firestore';

const CACHE_PREFIX = 'precall_cache_v5_';
// Add in-memory cache to prevent multiple renders
let memoryCache: Record<string, any> = {};
let globalFetchPromise: Promise<void> | null = null;
let eventTarget = new EventTarget();
let sessionNetworkAttempts = 0;

export function getCache<T>(key: string): T | null {
  if (memoryCache[key]) return memoryCache[key];
  const cached = localStorage.getItem(CACHE_PREFIX + key);
  if (!cached) return null;
  try {
    const parsed = JSON.parse(cached);
    // Explicit array guard for known collections
    if (['subjects', 'topics_all', 'notifications_all'].includes(key) && !Array.isArray(parsed)) {
      const normalized = normalizeArray(parsed);
      memoryCache[key] = normalized;
      return normalized as unknown as T;
    }
    memoryCache[key] = parsed;
    return parsed;
  } catch {
    return null;
  }
}

export function setCache<T>(key: string, data: T) {
  memoryCache[key] = data;
  try {
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(data));
  } catch (e: any) {
    console.warn(`[Cache] Storage quota exceeded when writing ${key}. Running in memory only.`);
  }
}

const normalizeArray = (input: any, debugLabel = 'Array'): any[] => {
  if (!input) {
    console.error(`[Normalizer:${debugLabel}] Input is falsy:`, input);
    return [];
  }
  if (Array.isArray(input)) return input;
  
  console.error(`[Normalizer:${debugLabel}] Object Input detected. Keys:`, Object.keys(input), 'Type:', typeof input, 'IsHTML:', typeof input === 'string' && input.trim().toLowerCase().startsWith('<!doctype'));

  if (typeof input === 'object' && input !== null) {
    const keys = Object.keys(input).filter(k => k.trim() !== '' && !isNaN(Number(k)));
    if (keys.length > 0) {
      console.log(`[Normalizer:${debugLabel}] Using Priority 1 (Numeric Keys). Found ${keys.length} ordered keys.`);
      return keys.sort((a, b) => Number(a) - Number(b)).map(k => input[k]);
    }
    const values = Object.values(input);
    if (values.length > 0 && typeof values[0] === 'object' && values[0] !== null) {
      if (!(input.slug || input.id)) {
        console.log(`[Normalizer:${debugLabel}] Using Priority 2 (Direct Object Values). Returning ${values.length} items.`);
        return values;
      }
    }
    if (input.slug || input.id) {
      console.log(`[Normalizer:${debugLabel}] Using Priority 3 (Single Item).`);
      return [input];
    }
  }
  
  console.error(`[Normalizer:${debugLabel}] Failed to normalize! Returning []. Original input:`, input);
  return [];
};

export async function fetchGlobalData(force = false) {
  if (globalFetchPromise && !force) return globalFetchPromise;
  
  sessionNetworkAttempts++;
  if (sessionNetworkAttempts > 3) {
      console.error("CRITICAL: Network kill-switch activated. Halting all requests.");
      return; // Forcefully abort without modifying state or promises
  }
  
  globalFetchPromise = (async () => {
    try {
      const hostname = window.location.hostname;
      // Refined Dev Shield: Only use mock data on localhost to allow live data on AIS previews and shared links
      const isDev = hostname === 'localhost'; 
      
      let data: any;

      if (isDev) {
        console.log('[Dev Shield] Bypassing Firestore. Loading local mock_data.json...');
        const res = await fetch('/mock_data.json');
        if (!res.ok) throw new Error('mock_data.json not found');
        data = await res.json();
      } else {
        // 1 & 3. PWA Local Storage & Edge Caching
        const lastUpdated = force ? '0' : (localStorage.getItem(CACHE_PREFIX + 'lastUpdated') || '0');
        const cacheBuster = force ? `&cb=${Date.now()}` : '';
        console.log(`[Prod Data] Fetching via Edge API endpoint (Force Refresh: ${force})...`);
        
        const res = await fetch(`/api/content/all?lastUpdated=${lastUpdated}${cacheBuster}`);
        const rawText = await res.text();
        if (rawText.includes('<!DOCTYPE html>') || !res.ok) {
            throw new Error('API routing or HTML error intercepted');
        }
        
        let json;
        try {
          json = JSON.parse(rawText);
        } catch (e: any) {
          console.error('[Diagnostic] Failed to parse JSON. Raw Data preview:', typeof rawText, rawText.substring(0, 500));
          throw e;
        }
        if (json.status === 'unchanged') {
          console.log('[Prod Data] API returned unchanged. Returning from Zero-Read PWA Cache!');
          const cachedSubjects = getCache<any[]>('subjects');
          const cachedTopics = getCache<any[]>('topics_all');
          
          if (!cachedSubjects || !cachedTopics || cachedSubjects.length === 0 || cachedTopics.length === 0) {
            localStorage.removeItem(CACHE_PREFIX + 'lastUpdated');
            console.warn('[Deadlock Failsafe] Missing or corrupted cache despite UNCHANGED status. Forcing clean network pull.');
            globalFetchPromise = null;
            await fetchGlobalData(true);
            return;
          } else {
            eventTarget.dispatchEvent(new Event('data_updated'));
            return;
          }
        }
        if (json.status === 'error') {
          console.error('[Prod Data] API returned error:', json.error);
          throw new Error('API Error: ' + json.error);
        }
        data = json;
      }

      if (data) {
        // Deeply normalize subjects and their nested topics
        const rawSubjects = data.subjects || data.data;
        const subjectsArray = normalizeArray(rawSubjects, 'SubjectsRoot');
        
        const normalizedSubjects = subjectsArray.map((subj: any) => ({
          ...subj,
          topics: normalizeArray(subj.topics, `TopicsList[${subj.slug || subj.id}]`)
        }));

        const normalizedSettings = data.settings || {};
        const normalizedNotifications = normalizeArray(data.notifications, 'NotificationsRoot');
        
        setCache('subjects', normalizedSubjects);
        
        const allTopics = normalizeArray(data.topics || [], 'TopicsRoot');
        setCache('topics_all', allTopics);
        if (normalizedSettings) setCache('settings', normalizedSettings);
        if (normalizedNotifications.length > 0) setCache('notifications_all', normalizedNotifications);
        
        // Only trigger update and save timestamp if we actually got data or if it's explicitly cleared
        if (normalizedSubjects.length > 0 || data.lastUpdated) {
          if (data.lastUpdated) {
            try {
              localStorage.setItem(CACHE_PREFIX + 'lastUpdated', data.lastUpdated.toString());
            } catch (e: any) {
              console.warn(`[Cache] Storage quota exceeded when writing lastUpdated.`);
            }
          }
          eventTarget.dispatchEvent(new Event('data_updated'));
        }
      }
    } catch (err: any) {
      console.error('[Data Fetch] Error:', err.message);
    } finally {
      if (sessionNetworkAttempts <= 3) {
        globalFetchPromise = null;
      }
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
    const filtered = subjectSlug ? all.filter(t => t.subjectSlug === subjectSlug) : all;
    return filtered
      .filter(t => t !== null && typeof t === 'object')
      .sort((a, b) => (a?.order || 0) - (b?.order || 0));
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
  const [globalNotifs, setGlobalNotifs] = useState<AppNotification[]>(() => getCache<AppNotification[]>('notifications_all') || []);
  const [userNotifs, setUserNotifs] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const handler = () => {
      const all = getCache<AppNotification[]>('notifications_all') || [];
      if (isAdmin) {
        setGlobalNotifs(all);
      } else {
        setGlobalNotifs(all.filter(n => !n.userId || n.userId === 'all'));
      }
      if (!uid) setLoading(false);
    };
    eventTarget.addEventListener('data_updated', handler);
    if (!globalNotifs.length) {
      fetchGlobalData().finally(() => { if (!uid) setLoading(false); });
    }
    return () => eventTarget.removeEventListener('data_updated', handler);
  }, [isAdmin, uid]);

  useEffect(() => {
    if (!uid || typeof uid !== 'string' || uid.trim() === '') {
      setUserNotifs([]);
      return;
    }
    
    // Fetch user-specific notifications dynamically
    const q = query(collection(db, 'users', uid, 'notifications'));
    
    const unsub = onSnapshot(q, (snapshot) => {
      const updated = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as AppNotification));
      setUserNotifs(updated);
      setLoading(false);
    }, (err) => {
      console.warn('Notification snapshot err:', err);
      setLoading(false);
    });
    
    return () => unsub();
  }, [uid]);

  const notifications = [...userNotifs, ...globalNotifs].sort((a, b) => 
    new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
  );

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
    try {
        localStorage.setItem(cacheKey, 'true');
    } catch(e: any) {
        console.warn(`[Avatar] Storage quota exceeded.`);
    }
  };

  return { isUnlocked, unlockAvatar };
}
