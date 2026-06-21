import { createContext, useContext, useState, useEffect } from 'react';
import { onAuthStateChanged, getRedirectResult } from 'firebase/auth';
import { firebaseAuth } from '@/lib/firebase';

const ADMIN_UID = import.meta.env.VITE_ADMIN_UID || '';
const WORKER_URL = import.meta.env.VITE_CALENDAR_WORKER_URL || '';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);

  useEffect(() => {
    // Handle Google redirect result (iOS PWA fallback from signInWithRedirect)
    getRedirectResult(firebaseAuth).catch(() => {});
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebaseAuth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        try {
          const { getOrCreateUser } = await import('@/lib/firestoreService');
          const p = await getOrCreateUser(firebaseUser.uid);
          setProfile(p);

          // If no plan stored yet, check Worker for subscription status
          if (!p?.plan && WORKER_URL) {
            const idToken = await firebaseUser.getIdToken();
            const resp = await fetch(`${WORKER_URL}/stripe/subscription`, {
              headers: { Authorization: `Firebase ${idToken}` },
            });
            if (resp.ok) {
              const sub = await resp.json();
              if (sub?.plan) {
                const { updateUserDoc } = await import('@/lib/firestoreService');
                await updateUserDoc(firebaseUser.uid, { plan: sub.plan, subscriptionStatus: sub.status });
                setProfile(prev => ({ ...prev, plan: sub.plan, subscriptionStatus: sub.status }));
              }
            }
          }
        } catch {
          setProfile(null);
        }
      } else {
        setProfile(null);
      }
      setIsLoadingAuth(false);
    });
    return unsubscribe;
  }, []);

  const plan = user?.uid === ADMIN_UID ? 'pro' : (profile?.plan || null);
  const isPro = plan === 'pro';
  const isSubscribed = !!plan && profile?.subscriptionStatus !== 'cancelled';

  const refreshPlan = async () => {
    if (!user || !WORKER_URL) return;
    try {
      const idToken = await user.getIdToken(true);
      const resp = await fetch(`${WORKER_URL}/stripe/subscription`, {
        headers: { Authorization: `Firebase ${idToken}` },
      });
      if (resp.ok) {
        const sub = await resp.json();
        if (sub?.plan) {
          const { updateUserDoc } = await import('@/lib/firestoreService');
          await updateUserDoc(user.uid, { plan: sub.plan, subscriptionStatus: sub.status });
          setProfile(prev => ({ ...prev, plan: sub.plan, subscriptionStatus: sub.status }));
        }
      }
    } catch {}
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, isLoadingAuth, profile, plan, isPro, isSubscribed, refreshPlan }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
