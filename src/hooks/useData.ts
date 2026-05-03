import { collection, doc, onSnapshot, query, where, orderBy, limit, getDocs, getDoc } from 'firebase/firestore';
import { useEffect, useState, useCallback, useRef } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Subject, Topic, AppSettings, UserProfile, AppNotification } from '../types';
import { getQuotaStatus } from '../lib/quota';
import { LOCAL_SUBJECTS, LOCAL_TOPICS } from '../data/localData';

const CACHE_PREFIX = 'precall_cache_';
const USE_LOCAL_DATA = import.meta.env.VITE_USE_LOCAL_DATA === 'true';
const memoryCache: Record<string, { data: any, timestamp: number, lastUpdated?: number }> = {};
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
    // Expired - but we might still return it if requested by the hook as "stale"
    return null;
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
    const isFresh = Date.now() - meta.timestamp < DEFAULT_TTL;
    
    if (isFresh && subjects.length > 0) {
      setLoading(false);
      // We no longer return here. Stale-while-revalidate ensures instant admin updates!
    }

    if (getQuotaStatus()) {
      setLoading(false);
      return;
    }

    fetchInitiated.current = true;
    
    if (USE_LOCAL_DATA) {
      console.log('[useSubjects] Using static local data (Bypassing Firestore)');
      setSubjects(LOCAL_SUBJECTS);
      setLoading(false);
      return;
    }

    const fetchSubjects = async () => {
      try {
        const lastUpdatedCurrent = meta.lastUpdated || 0;
        const response = await fetch(`/api/content/all?lastUpdated=${lastUpdatedCurrent}`);
        if (!response.ok) {
           if (response.status === 503) {
             setQuotaStatus(true);
             throw new Error('QUOTA_EXCEEDED');
           }
           throw new Error('Failed to fetch from content API');
        }
        
        const content = await response.json();
        
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
        console.error("Error fetching subjects from API:", error);
        
        // Fallback to Firestore only if API fails and no cache exists
        if (subjects.length === 0 && error.message !== 'QUOTA_EXCEEDED') {
          try {
            const bundleRef = doc(db, 'bundles', 'subjects');
            const bundleSnap = await getDoc(bundleRef);
            
            if (bundleSnap.exists()) {
              const bundleData = bundleSnap.data();
              if (bundleData.data) {
                const sortedData = [...bundleData.data].sort((a, b) => (a.order || 0) - (b.order || 0));
                setSubjects(sortedData);
                setCache('subjects', sortedData);
                reportUsage(1);
                return;
              }
            }
          } catch (fbError: any) {
            if (fbError.message?.includes('quota')) reportError(fbError);
          }
        }
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
    const isFresh = Date.now() - meta.timestamp < DEFAULT_TTL;

    if (isFresh && data.subjects.length > 0 && data.topics.length > 0) {
      setLoading(false);
      // Removed return for stale-while-revalidate
    }

    if (getQuotaStatus()) {
      setLoading(false);
      return;
    }

    fetchInitiated.current = true;

    if (USE_LOCAL_DATA) {
      console.log('[useDashboardData] Using static local data (Bypassing Firestore)');
      setData({ subjects: LOCAL_SUBJECTS, topics: LOCAL_TOPICS });
      setLoading(false);
      return;
    }

    const fetchAll = async () => {
      try {
        const lastUpdatedCurrent = meta.lastUpdated || 0;
        const response = await fetch(`/api/content/all?lastUpdated=${lastUpdatedCurrent}`);
        if (!response.ok) {
           if (response.status === 503) {
             setQuotaStatus(true);
             throw new Error('QUOTA_EXCEEDED');
           }
           throw new Error('Failed to fetch from content API');
        }
        const content = await response.json();

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
      } catch (error: any) {
        console.error("Error fetching dashboard data from API:", error);
        
        if (data.subjects.length === 0 && error.message !== 'QUOTA_EXCEEDED') {
          try {
            const bundlesSnap = await getDocs(collection(db, 'bundles'));
            let subjectsData: Subject[] = [];
            let topicsData: Topic[] = [];
            let metadataTopics: Topic[] = [];

            bundlesSnap.docs.forEach(doc => {
              const bundleData = doc.data().data;
              if (!bundleData) return;
              if (doc.id === 'subjects') {
                subjectsData = bundleData;
              } else if (doc.id.includes('_free') || doc.id.includes('_premium')) {
                topicsData = topicsData.concat(bundleData);
              } else if (doc.id.includes('_metadata')) {
                metadataTopics = metadataTopics.concat(bundleData);
              }
            });
            
            // Add topics that are ONLY in metadata (e.g. coming_soon)
            const existingTopicIds = new Set(topicsData.map(t => t.id));
            for (const metaT of metadataTopics) {
              if (!existingTopicIds.has(metaT.id)) {
                topicsData.push(metaT);
              }
            }

            subjectsData.sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
            topicsData.sort((a: any, b: any) => (a.order || 0) - (b.order || 0));

            const newData = { subjects: subjectsData, topics: topicsData };
            setData(newData);
            setCache('subjects', subjectsData);
            setCache('topics_all', topicsData);
            reportUsage(bundlesSnap.size);
          } catch (fbError: any) {
            handleFirestoreError(fbError, OperationType.LIST, 'dashboard_data');
            if (fbError.message?.includes('quota')) reportError(fbError);
          }
        }
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
    const isFresh = Date.now() - meta.timestamp < DEFAULT_TTL;

    if (isFresh && topics.length > 0) {
      setLoading(false);
      // Removed return for stale-while-revalidate
    }

    if (getQuotaStatus()) {
      setLoading(false);
      return;
    }

    fetchInitiated.current = true;

    if (USE_LOCAL_DATA) {
      const filtered = subjectSlug 
        ? LOCAL_TOPICS.filter((t: any) => t.subjectSlug === subjectSlug)
        : LOCAL_TOPICS;
      setTopics(filtered);
      setLoading(false);
      return;
    }

    const fetchTopics = async () => {
      try {
        const lastUpdatedCurrent = meta.lastUpdated || 0;
        const response = await fetch(`/api/content/all?lastUpdated=${lastUpdatedCurrent}`);
        if (!response.ok) {
           if (response.status === 503) {
             setQuotaStatus(true);
             throw new Error('QUOTA_EXCEEDED');
           }
           throw new Error('Failed to fetch from content API');
        }
        const content = await response.json();
        
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
        console.error("Error fetching topics from API:", error);
        
        if (topics.length === 0 && error.message !== 'QUOTA_EXCEEDED') {
          // Fallback to Firestore
          try {
            const bundlesSnap = await getDocs(collection(db, 'bundles'));
            let allTopics: Topic[] = [];
            let metadataTopics: Topic[] = [];

            bundlesSnap.docs.forEach(doc => {
              const bundleData = doc.data().data;
              if (!bundleData) return;
              if (doc.id.includes('_free') || doc.id.includes('_premium')) {
                allTopics = allTopics.concat(bundleData);
              } else if (doc.id.includes('_metadata')) {
                metadataTopics = metadataTopics.concat(bundleData);
              }
            });
            
            // Add topics that are ONLY in metadata (e.g. coming_soon)
            const existingTopicIds = new Set(allTopics.map(t => t.id));
            for (const metaT of metadataTopics) {
              if (!existingTopicIds.has(metaT.id)) {
                allTopics.push(metaT);
              }
            }

            allTopics.sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
            setCache('topics_all', allTopics);
            reportUsage(bundlesSnap.size);

            if (subjectSlug) {
              const filtered = allTopics.filter((t: Topic) => t.subjectSlug === subjectSlug);
              setTopics(filtered);
              setCache(cacheKey, filtered);
            } else {
              setTopics(allTopics);
              setCache(cacheKey, allTopics);
            }
          } catch (fbError: any) {
            handleFirestoreError(fbError, OperationType.LIST, 'topics_bundles');
            if (fbError.message?.includes('quota')) reportError(fbError);
          }
        }
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

    if (USE_LOCAL_DATA) {
      const found = LOCAL_TOPICS.find((t: any) => t.slug === slug);
      setTopic(found || null);
      setLoading(false);
      return;
    }

    const fetchTopic = async () => {
      try {
        // Try searching our existing cache first (topics_all)
        const allTopics = getStaleCache<Topic[]>('topics_all');
        if (allTopics) {
          const found = allTopics.find(t => t.slug === slug);
          if (found) {
            setTopic(found);
            setCache(cacheKey, found);
            setLoading(false);
            
            // Still check for updates if stale
            const meta = getCacheMetadata('subjects');
            if (Date.now() - meta.timestamp < DEFAULT_TTL) return;
          }
        }

        // If not in cache or stale, check API
        const meta = getCacheMetadata('subjects');
        const lastUpdatedCurrent = meta.lastUpdated || 0;
        const response = await fetch(`/api/content/all?lastUpdated=${lastUpdatedCurrent}`);
        if (!response.ok) {
           if (response.status === 503) {
             setQuotaStatus(true);
             throw new Error('QUOTA_EXCEEDED');
           }
           throw new Error('Failed to fetch from content API');
        }
        const content = await response.json();
        
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
        console.error("Error fetching topic from API:", error);
        
        // Final fallback to direct Firestore
        if (!topic && error.message !== 'QUOTA_EXCEEDED') {
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
      setSettings(null); // Or provide static settings
      setLoading(false);
      return;
    }

    const fetchSettings = async () => {
      try {
        const lastUpdatedCurrent = meta.lastUpdated || 0;
        const response = await fetch(`/api/content/all?lastUpdated=${lastUpdatedCurrent}`);
        
        if (response.ok) {
           const content = await response.json();
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
  const [profile, setProfile] = useState<UserProfile | null>(() => uid ? getCache<UserProfile>(cacheKey, 1000 * 60 * 5) : null); // Profile TTL 5 mins
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

    const cached = getCache<UserProfile>(cacheKey, 1000 * 60 * 5);
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
  const [notifications, setNotifications] = useState<AppNotification[]>(() => getCache<AppNotification[]>(cacheKey, 1000 * 60 * 5) || []);
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

    const cached = getCache<AppNotification[]>(cacheKey, 1000 * 60 * 5);
    if (cached) {
      setNotifications(cached);
      setLoading(false);
      return;
    }

    fetchInitiated.current = true;
    const fetchNotifications = async () => {
      try {
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
