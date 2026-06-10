import { createContext, useContext, useState, useEffect } from 'react';
import { getOrCreateUser, updateUserDoc } from '@/lib/firestoreService';
import { useCurrentUid } from '@/hooks/useCurrentUid';

const UserPrefsContext = createContext(null);

export function UserPrefsProvider({ children }) {
  const uid = useCurrentUid();
  const [prefs, setPrefs] = useState({ autoScan: false, apiKey: '', background: 'hexagons' });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) { setLoading(false); return; }
    setLoading(true);
    getOrCreateUser(uid)
      .then((profile) => {
        setPrefs({
          autoScan: profile?.autoScan ?? false,
          apiKey: profile?.apiKey ?? '',
          background: profile?.background ?? 'hexagons',
        });
      })
      .finally(() => setLoading(false));
  }, [uid]);

  const setPref = async (key, value) => {
    if (!uid) return;
    setPrefs((prev) => ({ ...prev, [key]: value }));
    await updateUserDoc(uid, { [key]: value });
  };

  return (
    <UserPrefsContext.Provider value={{ prefs, loading, setPref }}>
      {children}
    </UserPrefsContext.Provider>
  );
}

export function useUserPrefs() {
  const ctx = useContext(UserPrefsContext);
  if (!ctx) throw new Error('useUserPrefs must be used inside UserPrefsProvider');
  return ctx;
}
