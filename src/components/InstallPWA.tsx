import { Download, X, Share, PlusSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useEffect, useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export function InstallPWA() {
  const { isInstallable, installApp } = usePWAInstall();
  const [isVisible, setIsVisible] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isDismissed, setIsDismissed] = useState(() => {
    return localStorage.getItem('pwa_prompt_dismissed') === 'true';
  });

  useEffect(() => {
    // Check if it's iOS
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(isIOSDevice);

    // Check if already installed
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    
    if (isStandalone || isDismissed) {
      setIsVisible(false);
      return;
    }

    // Show for iOS after a delay
    if (isIOSDevice) {
      const timer = setTimeout(() => setIsVisible(true), 5000);
      return () => clearTimeout(timer);
    }

    // Show for Android/Desktop when installable
    if (isInstallable) {
      setIsVisible(true);
    }
  }, [isInstallable, isDismissed]);

  const handleDismiss = () => {
    setIsVisible(false);
    setIsDismissed(true);
    localStorage.setItem('pwa_prompt_dismissed', 'true');
  };

  const handleInstall = async () => {
    await installApp();
    // The hook handles the rest, but we can hide the prompt
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        className="fixed bottom-6 left-4 right-4 z-[100] md:left-auto md:right-6 md:w-96"
      >
        <div className="bg-slate-900 text-white p-5 rounded-[2rem] shadow-2xl border border-slate-800 relative overflow-hidden">
          {/* Decorative background */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-violet-600/20 rounded-full blur-3xl -mr-16 -mt-16" />
          
          <button 
            onClick={handleDismiss}
            className="absolute top-4 right-4 p-1 text-slate-400 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-2xl bg-violet-600 flex items-center justify-center shrink-0 shadow-lg shadow-violet-900/50">
              <Download className="h-6 w-6 text-white" />
            </div>
            <div className="flex-1 pr-6">
              <h3 className="font-black text-lg tracking-tight">Install PreCall App</h3>
              <p className="text-sm text-slate-400 font-medium leading-snug mt-1">
                {isIOS 
                  ? "Tap the share icon below and then 'Add to Home Screen' for an app-like experience." 
                  : "Add PreCall to your home screen for faster access and offline revision."}
              </p>
            </div>
          </div>

          <div className="mt-6 flex items-center gap-3">
            {isIOS ? (
              <div className="flex items-center gap-4 w-full bg-slate-800/50 p-3 rounded-xl border border-slate-700/50">
                <div className="flex flex-col items-center gap-1">
                  <Share className="h-5 w-5 text-blue-400" />
                  <span className="text-[10px] font-bold uppercase text-slate-500">Share</span>
                </div>
                <div className="h-8 w-px bg-slate-700" />
                <div className="flex flex-col items-center gap-1">
                  <PlusSquare className="h-5 w-5 text-slate-300" />
                  <span className="text-[10px] font-bold uppercase text-slate-500">Add to Home</span>
                </div>
                <div className="ml-auto text-[10px] font-black text-violet-400 uppercase tracking-widest">
                  iOS Guide
                </div>
              </div>
            ) : (
              <button
                onClick={handleInstall}
                className="w-full py-3.5 bg-violet-600 hover:bg-violet-500 text-white rounded-xl font-black text-sm uppercase tracking-widest transition-all shadow-lg shadow-violet-900/20 flex items-center justify-center gap-2"
              >
                <Download className="h-4 w-4" />
                Install Now
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
