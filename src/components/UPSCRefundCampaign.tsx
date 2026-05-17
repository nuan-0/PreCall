import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Button } from './UI';
import { Gift, X } from 'lucide-react';
import { toast } from 'sonner';

export const UPSCRefundCampaign = () => {
  const { user, profile, isPremium } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  const [formData, setFormData] = useState({
    realName: '',
    mobileNo: '',
    upscRollNumber: ''
  });

  // Zero-Read Dual-Check
  useEffect(() => {
    const isSubmitted = localStorage.getItem('upscRefundSubmitted');
    if (isSubmitted === 'true') {
      setIsDismissed(true);
      return;
    }
    
    if (profile?.upscRollNumber) {
      localStorage.setItem('upscRefundSubmitted', 'true');
      setIsDismissed(true);
      return;
    }
    
    // Auto-open logic
    if (isPremium && !isSubmitted && !profile?.upscRollNumber) {
      setIsOpen(true);
    }
  }, [profile, isPremium]);

  if (!isPremium || isDismissed) {
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    setSubmitting(true);
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/submit-prelims-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });
      
      if (!response.ok) {
        throw new Error('Failed to submit data');
      }
      
      localStorage.setItem('upscRefundSubmitted', 'true');
      toast.success('Successfully registered for refund campaign!');
      setIsDismissed(true);
      setIsOpen(false);
      
    } catch (error) {
      console.error('Error submitting prelims data:', error);
      toast.error('Failed to submit. Please try again later.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {/* Floating FAB */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex items-center justify-center p-4 bg-violet-600 text-white rounded-full shadow-lg shadow-violet-200 hover:bg-violet-700 transition"
        >
          <Gift className="h-6 w-6" />
        </button>
      )}

      {/* Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-[2rem] w-full max-w-md shadow-2xl relative">
            <button
              onClick={() => setIsOpen(false)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 rounded-full transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="h-12 w-12 rounded-2xl bg-violet-100 text-violet-600 flex items-center justify-center shadow-inner">
                  <Gift className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-violet-950">Premium Refund</h3>
                  <p className="text-sm font-bold text-slate-500">UPSC Prelims Campaign</p>
                </div>
              </div>
              
              <p className="text-slate-600 mb-6 text-sm">
                Enter your details to register for the Premium refund campaign. If you clear Prelims, we refund your fee!
              </p>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-2">Full Name</label>
                  <input
                    type="text"
                    required
                    value={formData.realName}
                    onChange={(e) => setFormData(prev => ({...prev, realName: e.target.value}))}
                    className="w-full h-12 rounded-xl border-slate-200 text-sm font-medium focus:ring-violet-500 focus:border-violet-500 bg-slate-50 px-4"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-2">Mobile Number</label>
                  <input
                    type="tel"
                    required
                    value={formData.mobileNo}
                    onChange={(e) => setFormData(prev => ({...prev, mobileNo: e.target.value}))}
                    className="w-full h-12 rounded-xl border-slate-200 text-sm font-medium focus:ring-violet-500 focus:border-violet-500 bg-slate-50 px-4"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-2">UPSC Roll Number</label>
                  <input
                    type="text"
                    required
                    value={formData.upscRollNumber}
                    onChange={(e) => setFormData(prev => ({...prev, upscRollNumber: e.target.value}))}
                    className="w-full h-12 rounded-xl border-slate-200 text-sm font-medium focus:ring-violet-500 focus:border-violet-500 bg-slate-50 px-4"
                  />
                </div>
                <div className="pt-2">
                  <Button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-4 text-sm font-bold"
                  >
                    {submitting ? 'Submitting...' : 'Register for Refund'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
