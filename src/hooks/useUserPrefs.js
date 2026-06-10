import { useState, useEffect } from 'react';
import { getOrCreateUser, updateUserDoc } from '@/lib/firestoreService';
import { useCurrentUid } from './useCurrentUid';

export function useUserPrefs() {
  const uid = useCurrentUid();
  const [prefs, setPrefs] = useState({ autoScan: false, apiKey: '' });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) return;
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

  return { prefs, loading, setPref };
}
