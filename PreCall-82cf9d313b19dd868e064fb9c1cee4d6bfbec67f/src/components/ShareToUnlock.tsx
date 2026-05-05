import { Share2, Send, MessageCircle, Link as LinkIcon, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useState } from 'react';
import { Button } from './UI';
import { useAvatarUnlock } from '../hooks/useData';
import { toast } from 'sonner';

interface ShareToUnlockProps {
  uid?: string;
  onUnlock?: () => void;
}

export function ShareToUnlock({ uid, onUnlock }: ShareToUnlockProps) {
  const { isUnlocked, unlockAvatar } = useAvatarUnlock(uid);
  const [isSharing, setIsSharing] = useState(false);

  const shareUrl = window.location.origin;
  const shareText = "Check out PreCall - High-yield UPSC Prelims Revision App! 🚀";

  const handleShare = (platform: 'whatsapp' | 'telegram' | 'link') => {
    let url = '';
    if (platform === 'whatsapp') {
      url = `https://wa.me/?text=${encodeURIComponent(shareText + ' ' + shareUrl)}`;
    } else if (platform === 'telegram') {
      url = `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`;
    } else if (platform === 'link') {
      navigator.clipboard.writeText(shareUrl);
      toast.success('Link copied to clipboard!');
      unlockAvatar();
      if (onUnlock) onUnlock();
      return;
    }

    window.open(url, '_blank');
    
    // We assume they shared if they clicked the button
    setTimeout(() => {
      unlockAvatar();
      if (onUnlock) onUnlock();
      toast.success('Avatar unlocked! 🎉');
    }, 2000);
  };

  if (isUnlocked) return null;

  return (
    <div className="p-6 rounded-[2rem] bg-violet-50 border border-violet-100 shadow-inner">
      <div className="flex items-center gap-4 mb-6">
        <div className="h-12 w-12 rounded-2xl bg-violet-600 text-white flex items-center justify-center shadow-lg shadow-violet-200">
          <Share2 className="h-6 w-6" />
        </div>
        <div>
          <h4 className="text-lg font-black text-violet-950 tracking-tight">Unlock Your Avatar</h4>
          <p className="text-xs font-medium text-slate-500">Share PreCall with fellow aspirants to generate your unique avatar.</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <button
          onClick={() => handleShare('whatsapp')}
          className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-white border border-slate-100 hover:border-emerald-200 hover:bg-emerald-50 transition-all group"
        >
          <MessageCircle className="h-6 w-6 text-emerald-500 group-hover:scale-110 transition-transform" />
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover:text-emerald-600">WhatsApp</span>
        </button>
        
        <button
          onClick={() => handleShare('telegram')}
          className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-white border border-slate-100 hover:border-blue-200 hover:bg-blue-50 transition-all group"
        >
          <Send className="h-6 w-6 text-blue-500 group-hover:scale-110 transition-transform" />
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover:text-blue-600">Telegram</span>
        </button>

        <button
          onClick={() => handleShare('link')}
          className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-white border border-slate-100 hover:border-violet-200 hover:bg-violet-50 transition-all group"
        >
          <LinkIcon className="h-6 w-6 text-violet-500 group-hover:scale-110 transition-transform" />
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover:text-violet-600">Copy Link</span>
        </button>
      </div>
    </div>
  );
}
