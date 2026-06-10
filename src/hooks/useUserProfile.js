import { useState, useEffect, useCallback } from 'react';
import { getOrCreateUser, updateUserDoc } from '@/lib/firestoreService';

const ADMIN_UID = import.meta.env.VITE_ADMIN_UID || '';

export function useUserProfile(uid) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const isAdmin = uid === ADMIN_UID;

  const load = useCallback(async () => {
    if (!uid) { setLoading(false); return; }
    try {
      const data = await getOrCreateUser(uid);
      setProfile(data);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [uid]);

  useEffect(() => { load(); }, [load]);

  const update = useCallback(async (data) => {
    if (!uid) return;
    await updateUserDoc(uid, data);
    setProfile((prev) => ({ ...prev, ...data }));
  }, [uid]);

  return { profile, loading, error, isAdmin, refetch: load, update };
}
