import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User, signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { doc, setDoc, onSnapshot, getDoc, collection, addDoc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { isEmailAdmin, FOUNDER_EMAIL } from '../config/admins';
import { UserProfile } from '../types';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  isAdmin: boolean;
  isPremium: boolean;
  adminEmails: string[];
  isAuthModalOpen: boolean;
  openAuthModal: () => void;
  closeAuthModal: () => void;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  toggleTopicCompletion: (topicId: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [dynamicAdmins, setDynamicAdmins] = useState<string[]>([]);
  const [isPremium, setIsPremium] = useState(false);

  // Fetch dynamic admins from Firestore
  useEffect(() => {
    if (!user) {
      setDynamicAdmins([]);
      return;
    }

    const unsubscribe = onSnapshot(doc(db, 'settings', 'admins'), (snapshot) => {
      if (snapshot.exists()) {
        setDynamicAdmins(snapshot.data().emails || []);
      } else {
        setDynamicAdmins([]);
      }
    }, (error) => {
      console.error("Error fetching admins:", error);
      setDynamicAdmins([]);
    });

    return unsubscribe;
  }, [user]);

  const allAdminEmails = Array.from(new Set([FOUNDER_EMAIL, ...dynamicAdmins]));
  const isAdmin = !!user && (isEmailAdmin(user.email) || dynamicAdmins.includes(user.email?.toLowerCase() || '')) && (user.emailVerified || user.email === FOUNDER_EMAIL);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      
      if (firebaseUser) {
        // Close modal on successful login
        setIsAuthModalOpen(false);

        // Sync user profile to Firestore
        try {
          const userRef = doc(db, 'users', firebaseUser.uid);
          const isAdminUser = (isEmailAdmin(firebaseUser.email) || dynamicAdmins.includes(firebaseUser.email?.toLowerCase() || '')) && (firebaseUser.emailVerified || firebaseUser.email === FOUNDER_EMAIL);
          
          // Fetch existing profile to check premium status
          const userSnap = await getDoc(userRef);
          const isNewUser = !userSnap.exists();
          const existingData = userSnap.exists() ? userSnap.data() : {};
          const isPremiumUser = existingData.isPremium || false;
          
          setIsPremium(isPremiumUser || isAdminUser);

          // If it's a new user, send a welcome notification
          if (isNewUser) {
            await addDoc(collection(db, 'notifications'), {
              userId: firebaseUser.uid,
              title: 'Welcome to PreCall!',
              message: `Hi ${firebaseUser.displayName?.split(' ')[0] || 'Aspirant'}, we're excited to help you master UPSC Prelims. Start by exploring the Polity topics!`,
              type: 'welcome',
              createdAt: new Date().toISOString()
            });
          }

          await setDoc(userRef, {
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            displayName: existingData.displayName || firebaseUser.displayName,
            photoURL: existingData.photoURL || firebaseUser.photoURL,
            lastLogin: new Date().toISOString(),
            role: isAdminUser ? 'admin' : 'user',
            isPremium: isPremiumUser || isAdminUser,
            premiumExpiry: isAdminUser ? '2099-12-31' : (existingData.premiumExpiry || null)
          }, { merge: true });
        } catch (error) {
          console.error("Error syncing user profile:", error);
        }
      } else {
        setIsPremium(false);
      }
      
      setLoading(false);
    });

    return unsubscribe;
  }, [dynamicAdmins]);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      return;
    }

    const unsubscribe = onSnapshot(doc(db, 'users', user.uid), (snapshot) => {
      if (snapshot.exists()) {
        setProfile(snapshot.data() as UserProfile);
      } else {
        setProfile(null);
      }
    }, (error) => {
      console.error("Error fetching user profile:", error);
    });

    return unsubscribe;
  }, [user]);

  const toggleTopicCompletion = async (topicId: string) => {
    if (!user || !profile) return;
    
    const userRef = doc(db, 'users', user.uid);
    const isCompleted = profile.completedTopics?.includes(topicId);
    
    try {
      if (isCompleted) {
        await updateDoc(userRef, {
          completedTopics: arrayRemove(topicId)
        });
      } else {
        await updateDoc(userRef, {
          completedTopics: arrayUnion(topicId)
        });
      }
    } catch (error) {
      console.error("Error toggling topic completion:", error);
      throw error;
    }
  };

  const openAuthModal = () => setIsAuthModalOpen(true);
  const closeAuthModal = () => setIsAuthModalOpen(false);

  const login = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Logout failed:', error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      profile,
      loading, 
      isAdmin, 
      isPremium,
      adminEmails: allAdminEmails,
      isAuthModalOpen, 
      openAuthModal, 
      closeAuthModal, 
      login, 
      logout,
      toggleTopicCompletion
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
