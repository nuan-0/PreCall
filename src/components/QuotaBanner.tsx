import { motion, AnimatePresence } from 'motion/react';
import { WifiOff, X } from 'lucide-react';
import { useQuotaStatus } from '../hooks/useData';
import { useState } from 'react';

export function QuotaBanner() {
  const isQuotaExceeded = useQuotaStatus();
  const [isVisible, setIsVisible] = useState(true);

  if (!isQuotaExceeded || !isVisible) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: 'auto', opacity: 1 }}
        exit={{ height: 0, opacity: 0 }}
        className="bg-amber-500 text-white overflow-hidden relative"
      >
        <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between text-xs sm:text-sm font-medium">
          <div className="flex items-center gap-2">
            <WifiOff className="w-4 h-4" />
            <span>High traffic mode: showing cached content. New updates may be delayed.</span>
          </div>
          <button 
            onClick={() => setIsVisible(false)}
            className="p-1 hover:bg-white/20 rounded-full transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
