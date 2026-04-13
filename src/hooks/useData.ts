import { collection, doc, onSnapshot, query, where, orderBy, or } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Subject, Topic, AppSettings, UserProfile, AppNotification } from '../types';

const CACHE_PREFIX = 'precall_cache_';

function getCache<T>(key: string): T | null {
  const cached = localStorage.getItem(CACHE_PREFIX + key);
  if (!cached) return null;
  try {
    return JSON.parse(cached);
  } catch {
    return null;
  }
}

function setCache<T>(key: string, data: T) {
  localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(data));
}

export function useSubjects() {
  const [subjects, setSubjects] = useState<Subject[]>(() => getCache<Subject[]>('subjects') || []);
  const [loading, setLoading] = useState(!subjects.length);

  useEffect(() => {
    const path = 'subjects';
    const q = query(collection(db, path), orderBy('order', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (snapshot.empty) {
        const defaultSubjects = [{
          id: 'polity',
          slug: 'polity',
          title: 'Polity',
          description: 'Master the Constitution, Fundamental Rights, and Governance with high-yield topics.',
          order: 1,
          status: 'live',
          pdfVisible: true
        } as Subject];
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
      if (snapshot.empty && subjectSlug === 'polity') {
        const defaultTopics = [{
          id: 'article-21-right-to-life',
          slug: 'article-21-right-to-life',
          subjectSlug: 'polity',
          chapter: 'Fundamental Rights',
          title: 'Article 21 – Right to Life and Personal Liberty',
          teaser: 'The "Heart of Fundamental Rights". A single sentence that has been expanded by the Supreme Court to cover everything from Privacy to Sleep.',
          status: 'free',
          order: 1,
          estimatedTime: '10 mins'
        } as Topic];
        setTopics(defaultTopics);
        setCache(cacheKey, defaultTopics);
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
