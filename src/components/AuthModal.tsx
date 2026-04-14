import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Modal, Button } from './UI';
import { Sparkles, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

export function AuthModal() {
  const { isAuthModalOpen, closeAuthModal, login } = useAuth();
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleGoogleLogin = async () => {
    setIsLoggingIn(true);
    try {
      await login();
      toast.success('Welcome to PreCall!');
    } catch (error: any) {
      console.error('Login error:', error);
      let errorMessage = 'Failed to sign in. Please try again.';
      
      if (error.code === 'auth/popup-blocked') {
        errorMessage = 'Popup blocked! Please allow popups for this site in your browser settings.';
      } else if (error.code === 'auth/unauthorized-domain') {
        errorMessage = 'This domain is not authorized for sign-in. Please contact support.';
      } else if (error.code === 'auth/cancelled-popup-request') {
        errorMessage = 'Sign-in was cancelled. Please try again.';
      } else if (error.code) {
        errorMessage = `Sign-in error: ${error.code}. Please try again.`;
      }
      
      toast.error(errorMessage);
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <Modal
      isOpen={isAuthModalOpen}
      onClose={closeAuthModal}
      title="Continue your journey"
    >
      <div className="space-y-8">
        <div className="space-y-4">
          <p className="text-slate-500 font-medium leading-relaxed">
            Join thousands of UPSC aspirants using high-yield revision to master the Prelims.
          </p>
          
          <div className="space-y-3">
            <div className="flex items-center gap-3 text-sm font-bold text-slate-700">
              <div className="p-1.5 rounded-lg bg-violet-50 text-violet-600">
                <Sparkles className="h-4 w-4" />
              </div>
              <span>Unlock 100+ High-Yield Topics</span>
            </div>
            <div className="flex items-center gap-3 text-sm font-bold text-slate-700">
              <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <span>Save your progress & bookmarks</span>
            </div>
          </div>
        </div>

        <div className="pt-4">
          <Button
            onClick={handleGoogleLogin}
            loading={isLoggingIn}
            className="w-full h-14 text-base bg-white border-2 border-slate-100 text-slate-700 hover:bg-slate-50 hover:border-violet-200 shadow-none"
          >
            {!isLoggingIn && (
              <svg className="mr-3 h-5 w-5" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
            )}
            Continue with Google
          </Button>
          
          <p className="mt-6 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">
            Simple. Secure. No Passwords.
          </p>
        </div>
      </div>
    </Modal>
  );
}
