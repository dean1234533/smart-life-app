import { useAuth } from '@/lib/AuthContext';

export function useCurrentUid() {
  return useAuth()?.user?.uid || null;
}
