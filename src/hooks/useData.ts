import { collection, doc, onSnapshot, query, where, orderBy, limit, getDocs, getDoc } from 'firebase/firestore';
import { useEffect, useState, useCallback, useRef } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Subject, Topic, AppSettings, UserProfile, AppNotification } from '../types';
import { getQuotaStatus, setQuotaStatus } from '../lib/quota';
import { LOCAL_SUBJECTS, LOCAL_TOPICS } from '../data/localData';

const CACHE_PREFIX = 'precall_cache_';
const USE_LOCAL_DATA = import.meta.env.VITE_USE_LOCAL_DATA === 'true';
const PROD_PROXY_URL = 'https://ais-pre-zrknvlbi3unsupzgxzsmyg-796328902813.asia-southeast1.run.app';
const memoryCache: Record<string, { data: any, timestamp: number, lastUpdated?: number }> = {};

let pendingContentRequest: Promise<any> | null = null;
async function fetchContentOptimized(lastUpdated: number) {
  if (pendingContentRequest) return pendingContentRequest;
  
  pendingContentRequest = (async () => {
    try {
      const isDev = window.location.hostname.includes('ais-dev') || window.location.hostname === 'localhost';
      const apiBase = ''; // Always use relative path so it hits the local Express server
      
      const response = await fetch(`${apiBase}/api/content/all?lastUpdated=${lastUpdated}`);
      const contentType = response.headers.get('content-type');
      
      if (!response.ok) {
        if (response.status === 503 || response.status === 429) {
          setQuotaStatus(true);
          throw new Error('QUOTA_EXCEEDED');
        }
        throw new Error('CONTENT_LOAD_FAILED');
      }
      
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        // Silent log for developers
        if (isDev) console.error('API Error:', response.status, text.substring(0, 100));
        
        throw new Error('UNEXPECTED_DATA_FORMAT');
      }

      const data = await response.json();
      
      // If server explicitly says local_mode, we should inform the hooks regardless of client settings
      if (data.status === 'local_mode') {
        return { status: 'local_mode' };
      }
      
      // Data Cleaning: Fix duplications and mixed-up topics
      if (data.subjects && Array.isArray(data.subjects)) {
        // De-duplicate subjects by ID
        const seenIds = new Set();
        data.subjects = data.subjects.filter((s: any) => {
          if (!s.id || seenIds.has(s.id)) return false;
          seenIds.add(s.id);
          return true;
        });
      }

      if (data.topics && Array.isArray(data.topics)) {
        // De-duplicate topics by ID
        const seenTopicIds = new Set();
        data.topics = data.topics.filter((t: any) => {
          if (!t.id || seenTopicIds.has(t.id)) return false;
          // Ensure topic has a valid subjectSlug related to an existing subject
          // This prevents "mixed up" topics if the server sends orphans
          seenTopicIds.add(t.id);
          return true;
        });
      }
      
      return data;
    } catch (e: any) {
      if (e.message === 'SERVICE_BUSY') throw e;
      const isDev = window.location.hostname.includes('ais-dev') || window.location.hostname === 'localhost';
      if (isDev) console.warn('Fetch detail:', e);
      return { status: 'error' };
    } finally {
      pendingContentRequest = null;
    }
  })();
  
  return pendingContentRequest;
}

function getCache<T>(key: string): T | null {
  // Check memory cache first
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

function getStaleCache<T>(key: string): T | null {
  const mem = memoryCache[key];
  if (mem) return mem.data;

  const cached = localStorage.getItem(CACHE_PREFIX + key);
  if (!cached) return null;
  try {
    const parsed = JSON.parse(cached);
    return parsed.data;
  } catch {
    return null;
  }
}

function getCacheMetadata(key: string) {
  const cached = localStorage.getItem(CACHE_PREFIX + key);
  if (!cached) return { timestamp: 0, lastUpdated: 0 };
  try {
    const parsed = JSON.parse(cached);
    return { 
      timestamp: parsed.timestamp || 0, 
      lastUpdated: parsed.lastUpdated || 0 
    };
  } catch {
    return { timestamp: 0, lastUpdated: 0 };
  }
}

function setCache<T>(key: string, data: T, lastUpdated?: number) {
  const cacheObj = { data, timestamp: Date.now(), lastUpdated };
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
    const message = error instanceof Error ? error.message : String(error);
    
    // Don't report API errors to the API itself (prevents infinite loop if API is down)
    if (message.includes('API_') || message.includes('fetch')) {
      return;
    }

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
  const [subjects, setSubjects] = useState<Subject[]>(() => getStaleCache<Subject[]>('subjects') || []);
  const [loading, setLoading] = useState(subjects.length === 0);

  const fetchInitiated = useRef(false);

  useEffect(() => {
    if (fetchInitiated.current) return;

    // Check freshness to mark as loaded instantly, but still fetch to revalidate
    const meta = getCacheMetadata('subjects');
    
    if (subjects.length > 0) {
      setLoading(false);
    }

    if (getQuotaStatus()) {
      setLoading(false);
      return;
    }

    fetchInitiated.current = true;
    
    const fetchSubjects = async () => {
      try {
        const lastUpdatedCurrent = meta.lastUpdated || 0;
        const content = await fetchContentOptimized(lastUpdatedCurrent);
        
        if (content.status === 'local_mode' || (content.status === 'error' && USE_LOCAL_DATA) || (Array.isArray(content.subjects) && content.subjects.length === 0 && USE_LOCAL_DATA)) {
          setSubjects(LOCAL_SUBJECTS);
          setLoading(false);
          return;
        }

        if (content.status === 'unchanged') {
          // Just update the timestamp to prolong "freshness"
          const currentSubjects = getStaleCache<Subject[]>('subjects') || [];
          setCache('subjects', currentSubjects, content.lastUpdated);
          setLoading(false);
          return;
        }

        const sortedSubjects = [...content.subjects].sort((a, b) => (a.order || 0) - (b.order || 0));
        setSubjects(sortedSubjects);
        setCache('subjects', sortedSubjects, content.lastUpdated);
        setCache('topics_all', content.topics, content.lastUpdated);
        if (content.settings) setCache('settings', content.settings, content.lastUpdated);
        
      } catch (error: any) {
        if (window.location.hostname.includes('ais-dev')) console.error("Subjects sync error:", error);
        // Fallback removed to save reads as per user request
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
    subjects: getStaleCache<Subject[]>('subjects') || [],
    topics: getStaleCache<Topic[]>('topics_all') || []
  }));
  const [loading, setLoading] = useState(data.subjects.length === 0 || data.topics.length === 0);

  const fetchInitiated = useRef(false);

  useEffect(() => {
    if (fetchInitiated.current) return;

    const meta = getCacheMetadata('subjects');

    if (data.subjects.length > 0 && data.topics.length > 0) {
      setLoading(false);
    }

    if (getQuotaStatus()) {
      setLoading(false);
      return;
    }

    fetchInitiated.current = true;

    const fetchAll = async () => {
      try {
        const lastUpdatedCurrent = meta.lastUpdated || 0;
        const content = await fetchContentOptimized(lastUpdatedCurrent);

        if (content.status === 'local_mode' || (content.status === 'error' && USE_LOCAL_DATA) || (Array.isArray(content.subjects) && content.subjects.length === 0 && USE_LOCAL_DATA)) {
          console.log('[useDashboardData] Falling back to hardcoded local data');
          setData({ subjects: LOCAL_SUBJECTS, topics: LOCAL_TOPICS });
          setLoading(false);
          return;
        }

        if (content.status === 'unchanged') {
          setCache('subjects', data.subjects, content.lastUpdated);
          setCache('topics_all', data.topics, content.lastUpdated);
          setLoading(false);
          return;
        }

        const subjectsData = [...content.subjects].sort((a, b) => (a.order || 0) - (b.order || 0));
        const topicsData = content.topics;

        const newData = { subjects: subjectsData, topics: topicsData };
        setData(newData);
        setCache('subjects', subjectsData, content.lastUpdated);
        setCache('topics_all', topicsData, content.lastUpdated);
        if (content.settings) setCache('settings', content.settings, content.lastUpdated);
        if (content.adminEmails) setCache('admin_emails', content.adminEmails, content.lastUpdated);
      } catch (error: any) {
        if (window.location.hostname.includes('ais-dev')) console.error("Dashboard sync error:", error);
        // Fallback removed to save reads
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
  const [topics, setTopics] = useState<Topic[]>(() => getStaleCache<Topic[]>(cacheKey) || []);
  const [loading, setLoading] = useState(topics.length === 0);

  const fetchInitiated = useRef(false);

  useEffect(() => {
    if (fetchInitiated.current) return;

    const meta = getCacheMetadata('subjects');

    if (topics.length > 0) {
      setLoading(false);
    }

    if (getQuotaStatus()) {
      setLoading(false);
      return;
    }

    fetchInitiated.current = true;

    const fetchTopics = async () => {
      try {
        const metaLocal = getCacheMetadata('subjects');
        const lastUpdatedCurrent = metaLocal.lastUpdated || 0;
        const content = await fetchContentOptimized(lastUpdatedCurrent);
        
        if (content.status === 'local_mode' || (content.status === 'error' && USE_LOCAL_DATA)) {
          const filtered = subjectSlug 
             ? LOCAL_TOPICS.filter((t: any) => t.subjectSlug === subjectSlug)
             : LOCAL_TOPICS;
          setTopics(filtered);
          setLoading(false);
          return;
        }

        if (content.status === 'unchanged') {
          // Prolong subjects cache too
          const currentSubjects = getStaleCache<Subject[]>('subjects') || [];
          setCache('subjects', currentSubjects, content.lastUpdated);
          setCache('topics_all', getStaleCache<Topic[]>('topics_all') || [], content.lastUpdated);
          setLoading(false);
          return;
        }

        let allTopics = content.topics;
        setCache('topics_all', allTopics, content.lastUpdated);
        setCache('subjects', content.subjects, content.lastUpdated);
        if (content.settings) setCache('settings', content.settings, content.lastUpdated);

        if (subjectSlug) {
          const filtered = allTopics.filter((t: Topic) => t.subjectSlug === subjectSlug)
            .sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
          setTopics(filtered);
          setCache(cacheKey, filtered, content.lastUpdated);
        } else {
          setTopics(allTopics);
          setCache(cacheKey, allTopics, content.lastUpdated);
        }
      } catch (error: any) {
        if (window.location.hostname.includes('ais-dev')) console.error("Topics sync error:", error);
        // Fallback removed to save reads
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

  const fetchInitiated = useRef(false);

  useEffect(() => {
    if (!slug || fetchInitiated.current) return;
    
    const cached = getCache<Topic>(cacheKey);
    const stale = getStaleCache<Topic>(cacheKey);
    if (cached || stale) {
      setTopic(cached || stale || null);
      setLoading(false);
      if (cached) {
         // It's fully fresh in memory, but we'll still silently revalidate
      }
    }

    fetchInitiated.current = true;

    const fetchTopic = async () => {
      try {
        const metaLocal = getCacheMetadata('subjects');
        // Try searching our existing cache first (topics_all)
        const allTopics = getStaleCache<Topic[]>('topics_all');
        if (allTopics) {
          const found = allTopics.find(t => t.slug === slug);
          if (found) {
            setTopic(found);
            setCache(cacheKey, found);
            setLoading(false);
          }
        }

        // Check API
        const lastUpdatedCurrent = metaLocal.lastUpdated || 0;
        const content = await fetchContentOptimized(lastUpdatedCurrent);
        
        if (content.status === 'local_mode' || (content.status === 'error' && USE_LOCAL_DATA)) {
          console.log('[useTopic] Falling back to hardcoded local data');
          const found = LOCAL_TOPICS.find((t: any) => t.slug === slug);
          setTopic(found || null);
          setLoading(false);
          return;
        }

        if (content.status === 'unchanged') {
          // Cache verified as current
          setCache('topics_all', allTopics || [], content.lastUpdated);
          setLoading(false);
          return;
        }
        
        setCache('topics_all', content.topics, content.lastUpdated);
        setCache('subjects', content.subjects, content.lastUpdated);
        if (content.settings) setCache('settings', content.settings, content.lastUpdated);

        const found = content.topics.find((t: Topic) => t.slug === slug);
        if (found) {
          setTopic(found);
          setCache(cacheKey, found, content.lastUpdated);
        } else {
          setTopic(null);
        }
      } catch (error: any) {
        if (window.location.hostname.includes('ais-dev')) console.error("Content API sync error:", error);
        
        // Final fallback to direct Firestore (Disabled in Zero-Read mode)
        if (!topic && error.message !== 'SERVICE_BUSY' && !USE_LOCAL_DATA) {
          try {
            const q = query(collection(db, 'topics'), where('slug', '==', slug));
            const snapshot = await getDocs(q);
            if (!snapshot.empty) {
              const data = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Topic;
              setTopic(data);
              setCache(cacheKey, data);
            } else {
              setTopic(null);
            }
          } catch (fbError: any) {
            if (fbError.message?.includes('quota')) reportError(fbError);
          }
        }
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

  const fetchInitiated = useRef(false);

  useEffect(() => {
    if (fetchInitiated.current) return;

    const cached = getCache<AppSettings>('settings');
    const stale = getStaleCache<AppSettings>('settings');
    if (cached || stale) {
      setSettings((cached || stale) as AppSettings);
      setLoading(false);
      // Removed early return to allow stale-while-revalidate for settings
    }

    if (getQuotaStatus()) {
      setLoading(false);
      return;
    }

    fetchInitiated.current = true;

    if (USE_LOCAL_DATA) {
      setSettings({ 
        appName: 'PreCall Dev', 
        contactEmail: 'dev@example.com',
        heroTagline: 'High-Yield Revision for UPSC',
        sponsorName: 'PreCall',
        sponsorText: 'Master the core concepts.',
        pricingText: 'Unlock Premium',
        pdfPrice: '199',
        lastUpdated: Date.now()
      } as any);
      setLoading(false);
      return;
    }

    const fetchSettings = async () => {
      try {
        const metaLocal = getCacheMetadata('subjects');
        const lastUpdatedCurrent = metaLocal.lastUpdated || 0;
        const content = await fetchContentOptimized(lastUpdatedCurrent);
        
        if (content.status === 'local_mode' || (content.status === 'error' && USE_LOCAL_DATA)) {
          setSettings({ 
            appName: 'PreCall Dev', 
            contactEmail: 'dev@example.com',
            heroTagline: 'High-Yield Revision for UPSC',
            sponsorName: 'PreCall',
            sponsorText: 'Master the core concepts.',
            pricingText: 'Unlock Premium',
            pdfPrice: '199',
            lastUpdated: Date.now()
          } as any);
          setLoading(false);
          return;
        }

        if (content.status === 'unchanged') {
          setLoading(false);
          return;
        }

        if (content.settings) {
          setSettings(content.settings);
          setCache('settings', content.settings, content.lastUpdated);
          setCache('subjects', content.subjects, content.lastUpdated);
          setCache('topics_all', content.topics, content.lastUpdated);
          setLoading(false);
          return;
        }

        // Fallback to direct Firestore if API fails or doesn't have settings
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
  const [profile, setProfile] = useState<UserProfile | null>(() => uid ? getCache<UserProfile>(cacheKey) : null);
  const [loading, setLoading] = useState(uid ? !profile : false);

  const fetchInitiated = useRef(false);

  useEffect(() => {
    if (!uid || fetchInitiated.current) {
      if (!uid) {
        setProfile(null);
        setLoading(false);
      }
      return;
    }

    const cached = getCache<UserProfile>(cacheKey);
    if (cached) {
      setProfile(cached);
      setLoading(false);
      return;
    }

    fetchInitiated.current = true;
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
  const [notifications, setNotifications] = useState<AppNotification[]>(() => getCache<AppNotification[]>(cacheKey) || []);
  const [loading, setLoading] = useState(notifications.length === 0);

  const fetchInitiated = useRef(false);

  useEffect(() => {
    if ((!uid && !isAdmin) || fetchInitiated.current) {
      if (!uid && !isAdmin) {
        setNotifications([]);
        setLoading(false);
      }
      return;
    }

    const cached = getCache<AppNotification[]>(cacheKey);
    if (cached) {
      setNotifications(cached);
      setLoading(false);
      return;
    }

    fetchInitiated.current = true;
    const fetchNotifications = async () => {
      try {
        // 1. Try to get global notifications from consolidated API first to save reads
        const metaLocal = getCacheMetadata('subjects');
        const content = await fetchContentOptimized(metaLocal.lastUpdated || 0);
        
        if (content && content.notifications && Array.isArray(content.notifications)) {
          // These are global notifications from the bundle
          setNotifications(content.notifications);
          setCache(cacheKey, content.notifications);
          setLoading(false);
          // If we also need private notifications, we'd fetch them separately here
          // For now, most things are global announcements
          return;
        }

        // 2. Fallback to direct Firestore only if API is unavailable
        const path = 'notifications';
        let q;
        if (isAdmin) {
            q = query(collection(db, path), orderBy('createdAt', 'desc'), limit(50));
        } else {
            q = query(
              collection(db, path), 
              where('userId', 'in', [uid || 'guest', 'all']),
              orderBy('createdAt', 'desc'),
              limit(50)
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

export function useAdminEmails() {
  const [adminEmails, setAdminEmails] = useState<string[]>(() => getStaleCache<string[]>('admin_emails') || []);
  const [loading, setLoading] = useState(adminEmails.length === 0);

  const fetchInitiated = useRef(false);

  useEffect(() => {
    if (fetchInitiated.current) return;
    fetchInitiated.current = true;

    const fetchAdmins = async () => {
      try {
        const metaLocal = getCacheMetadata('subjects');
        const content = await fetchContentOptimized(metaLocal.lastUpdated || 0);
        
        if (content.adminEmails) {
          setAdminEmails(content.adminEmails);
          setCache('admin_emails', content.adminEmails, content.lastUpdated);
        }
      } catch (error) {
        // Silent fail
      } finally {
        setLoading(false);
      }
    };

    fetchAdmins();
  }, []);

  return { adminEmails, loading };
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
