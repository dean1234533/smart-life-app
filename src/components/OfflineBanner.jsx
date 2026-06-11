import { WifiOff, Wifi } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';

export default function OfflineBanner() {
  const online = useNetworkStatus();
  // Show a brief "back online" flash when reconnecting
  const [justReconnected, setJustReconnected] = useState(false);

  useEffect(() => {
    if (online) {
      setJustReconnected(true);
      const t = setTimeout(() => setJustReconnected(false), 3000);
      return () => clearTimeout(t);
    }
  }, [online]);

  const show = !online || justReconnected;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key={online ? 'online' : 'offline'}
          initial={{ y: -48 }}
          animate={{ y: 0 }}
          exit={{ y: -48 }}
          transition={{ type: 'spring', stiffness: 400, damping: 32 }}
          className={`fixed top-0 inset-x-0 z-[200] flex items-center justify-center gap-2 py-2.5 px-4 text-xs font-medium text-white backdrop-blur-sm ${
            online ? 'bg-emerald-600/90' : 'bg-amber-600/90'
          }`}
          style={{ paddingTop: 'max(0.625rem, env(safe-area-inset-top))' }}
        >
          {online
            ? <><Wifi className="w-3.5 h-3.5" /> Back online — syncing your data</>
            : <><WifiOff className="w-3.5 h-3.5" /> Offline — app still works, changes will sync when reconnected</>
          }
        </motion.div>
      )}
    </AnimatePresence>
  );
}
