import { Check, Crown, ShieldCheck, Zap, FileText, ArrowRight, PartyPopper, ShoppingCart, Info, Lock } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Button, Card, Badge, Skeleton } from '../components/UI';
import { useSettings, useSubjects } from '../hooks/useData';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';
import confetti from 'canvas-confetti';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { Coupon } from '../types';

declare global {
  interface Window {
    Razorpay: any;
  }
}

export function PdfStorePage() {
  const { settings } = useSettings();
  const { subjects, loading: subjectsLoading } = useSubjects();
  const { user, profile, isPremium, isAdmin, openAuthModal } = useAuth();
  const location = useLocation();
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [selectedPdfSlugs, setSelectedPdfSlugs] = useState<string[]>([]);
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<any>(null);
  const [isValidatingCoupon, setIsValidatingCoupon] = useState(false);
  const processingRef = useRef(false);

  // Handle URL param selection
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const select = params.get('select');
    if (select && subjects.length > 0) {
      const subject = subjects.find(s => s.slug === select);
      if (subject && subject.pdfVisible && subject.pdfUrl) {
        setSelectedPdfSlugs(prev => prev.includes(select) ? prev : [...prev, select]);
      }
    }
  }, [location.search, subjects]);
  
  const unitPrice = parseInt(settings?.pdfPrice || '199');
  const premiumPrice = parseInt(settings?.price?.replace(/,/g, '') || '999');

  const loadRazorpayScript = () => {
    return new Promise((resolve) => {
      if (window.Razorpay) {
        resolve(true);
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      script.crossOrigin = 'anonymous';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  // Only subjects with PDFs actually uploaded and visible
  const validPdfs = subjects.filter(s => s.status === 'live' && s.pdfVisible && s.pdfUrl);

  const togglePdfSelection = (slug: string) => {
    // Check if owned - users can still toggle for "simulation/testing" if they want to see the UI,
    // but handlePurchase will handle the actual logic.
    // However, if we want them to "scout" the store, we should let them select.
    if (profile?.ownedPdfs?.includes(slug) || isPremium || isAdmin) {
      // Just a toast for premium/admin to know why they can't "buy" technically
      if (!isAdmin) {
        toast.info("You already have access to this PDF.");
        return;
      }
    }
    
    setSelectedPdfSlugs(prev => 
      prev.includes(slug) ? prev.filter(s => s !== slug) : [...prev, slug]
    );
  };

  const selectAllPdfs = () => {
    if (validPdfs.length === 0) return;
    const slugs = validPdfs.map(s => s.slug);
    setSelectedPdfSlugs(slugs);
  };

  useEffect(() => {
    if (selectedPdfSlugs.length > 1 && appliedCoupon) {
      setAppliedCoupon(null);
      setCouponCode('');
      toast.info("Coupons only apply to single PDF purchases.");
    }
  }, [selectedPdfSlugs.length]);

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return;
    if (selectedPdfSlugs.length > 1) {
      toast.error("Coupons cannot be applied to PDF bundles.");
      return;
    }
    setIsValidatingCoupon(true);
    try {
      const res = await fetch('/api/validate-coupon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: couponCode.trim() })
      });
      const data = await res.json();
      if (res.ok) {
        setAppliedCoupon(data);
        toast.success(`Coupon applied: ${data.code}`);
      } else {
        setAppliedCoupon(null);
        toast.error(data.error || 'Invalid coupon');
      }
    } catch (err) {
      toast.error('Failed to validate coupon');
    } finally {
      setIsValidatingCoupon(false);
    }
  };

  const handlePurchase = async () => {
    if (processingRef.current) return;
    if (selectedPdfSlugs.length === 0) {
      toast.error("Please select at least one PDF.");
      return;
    }
    
    if (!user) {
      openAuthModal();
      return;
    }

    // Special logic for bundle suggested by user: > 6 subjects
    if (selectedPdfSlugs.length > 6) {
      // We don't block yet, but we will show a strong recommendation.
      // Or maybe the user wants it blocked? "if >6 subjects tell them to upgrade"
      // I'll show a toast first.
      toast.info("Smart Choice: Buying 7+ PDFs individually is more expensive than Premium access!");
    }

    processingRef.current = true;
    setIsProcessing(true);
    
    const isScriptLoaded = await loadRazorpayScript();
    if (!isScriptLoaded) {
      toast.error("Failed to load payment gateway.");
      setIsProcessing(false);
      processingRef.current = false;
      return;
    }

    let razorpayKey = import.meta.env.VITE_RAZORPAY_KEY_ID;
    try {
      const configRes = await fetch('/api/config');
      if (configRes.ok) {
        const configData = await configRes.json();
        if (configData.razorpayKeyId) razorpayKey = configData.razorpayKeyId;
      }
    } catch (err) {}
    
    if (!razorpayKey) {
      toast.error("Payment configuration missing.");
      setIsProcessing(false);
      processingRef.current = false;
      return;
    }

    try {
      const totalAmount = selectedPdfSlugs.length * unitPrice;
      const amountInPaise = totalAmount * 100;
      
      const orderRes = await fetch('/api/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          amount: amountInPaise,
          couponCode: appliedCoupon?.code,
          productType: selectedPdfSlugs.length > 1 ? 'pdf_bundle' : 'pdf',
          productSlugs: selectedPdfSlugs
        })
      });
      
      if (!orderRes.ok) {
        let errorMsg = 'Failed to create order';
        try {
          const errData = await orderRes.json();
          errorMsg = errData.details || errData.error || errorMsg;
        } catch (e) {}
        throw new Error(errorMsg);
      }
      const orderData = await orderRes.json();

      const options = {
        key: razorpayKey,
        amount: orderData.amount,
        currency: orderData.currency,
        name: settings?.appName || "PreCall",
        description: selectedPdfSlugs.length === 1 
          ? `Individual PDF: ${selectedPdfSlugs[0]}`
          : `PDF Bundle: ${selectedPdfSlugs.length} Subjects`,
        image: "/icon.svg",
        order_id: orderData.id,
        handler: async function (response: any) {
          try {
            toast.loading("Verifying payment...", { id: 'payment-verify' });
            
            const verifyRes = await fetch('/api/verify-payment', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_signature: response.razorpay_signature,
                userId: user.uid,
                couponCode: appliedCoupon?.code,
                productType: selectedPdfSlugs.length === 1 ? 'pdf' : 'pdf_bundle',
                productSlug: selectedPdfSlugs.length === 1 ? selectedPdfSlugs[0] : null,
                productSlugs: selectedPdfSlugs.length > 1 ? selectedPdfSlugs : []
              })
            });

            if (!verifyRes.ok) throw new Error('Verification failed');
            
            toast.success("Payment verified!", { id: 'payment-verify' });
            confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });

            setShowSuccessModal(true);
            setIsProcessing(false);
            processingRef.current = false;
          } catch (error: any) {
            toast.error("Payment verification failed.", { id: 'payment-verify' });
            setIsProcessing(false);
            processingRef.current = false;
          }
        },
        prefill: { name: user.displayName || "", email: user.email || "" },
        theme: { color: "#7c3aed" },
        modal: { ondismiss: () => { setIsProcessing(false); processingRef.current = false; } }
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (error: any) {
      toast.error(error.message || "Payment initialization failed.");
      setIsProcessing(false);
      processingRef.current = false;
    }
  };

  const totalPrice = selectedPdfSlugs.length * unitPrice;
  const isBetterThanPremium = selectedPdfSlugs.length > 6 || totalPrice > premiumPrice;

  return (
    <div className="container-wide py-16 lg:py-24 pb-32">
      <div className="text-center mb-16 max-w-4xl mx-auto">
        <Badge variant="new" className="mb-6 h-7 px-4 shadow-sm bg-blue-100 text-blue-700 uppercase">Official PDF Store</Badge>
        <h1 className="text-4xl font-bold text-violet-950 mb-6 tracking-tight sm:text-5xl text-balance">
          High-Yield Revision <span className="text-violet-600">Compendiums</span>
        </h1>
        <p className="text-lg text-slate-500 font-medium max-w-2xl mx-auto leading-relaxed">
          The exact same high-yield content from our platform, optimized for tablets and printing. Master subjects in hours, not weeks.
        </p>
      </div>

      <div className="grid gap-12 lg:grid-cols-3">
        {/* Selection Area */}
        <div className="lg:col-span-2 space-y-8">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-violet-950 flex items-center gap-2">
              <FileText className="h-5 w-5 text-violet-600" />
              Available Subjects
            </h3>
            {!isPremium && !isAdmin && (
              <Button variant="ghost" size="sm" className="text-violet-600 font-bold" onClick={selectAllPdfs}>
                Select All
              </Button>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {subjectsLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-40 rounded-3xl" />
              ))
            ) : validPdfs.map((subject) => {
              const isOwned = (profile?.ownedPdfs?.includes(subject.slug) || isPremium || isAdmin);
              const isSelected = selectedPdfSlugs.includes(subject.slug);

              return (
                <Card 
                  key={subject.slug}
                  onClick={() => togglePdfSelection(subject.slug)}
                  className={cn(
                    "p-6 h-full border-slate-100 transition-all cursor-pointer relative group overflow-hidden",
                    isSelected ? "border-violet-500 bg-violet-50/50 ring-1 ring-violet-500 shadow-xl shadow-violet-100" : "hover:border-violet-200",
                    isOwned && "cursor-default opacity-80 bg-emerald-50/20"
                  )}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className={cn(
                      "h-12 w-12 rounded-2xl flex items-center justify-center transition-colors",
                      isSelected ? "bg-violet-600 text-white" : "bg-slate-50 text-slate-400 group-hover:bg-violet-100 group-hover:text-violet-600"
                    )}>
                      <FileText className="h-6 w-6" />
                    </div>
                    {isOwned ? (
                      <Badge variant="live" className="bg-emerald-100 text-emerald-700 border-emerald-200">
                        Unlocked
                      </Badge>
                    ) : (
                      <div className={cn(
                        "h-6 w-6 rounded-full border-2 flex items-center justify-center transition-all",
                        isSelected ? "bg-violet-600 border-violet-600 text-white" : "border-slate-200"
                      )}>
                        {isSelected && <Check className="h-4 w-4" />}
                      </div>
                    )}
                  </div>
                  
                  <h4 className="text-lg font-bold text-violet-950 mb-1">{subject.title}</h4>
                  <p className="text-slate-500 text-xs font-medium leading-relaxed mb-4 line-clamp-2">
                    {subject.description}
                  </p>
                  
                  <div className="flex items-center justify-between mt-auto">
                    <span className="text-sm font-black text-violet-900 italic">₹{unitPrice}</span>
                    {!isOwned && !isSelected && (
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest group-hover:text-violet-600 transition-colors">Select for Bundle</span>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Cart/Summary Area */}
        <div className="lg:col-span-1">
          <Card className="sticky top-24 p-8 border-violet-100 bg-white shadow-2xl shadow-violet-100 rounded-[2.5rem] overflow-hidden">
            <div className="absolute top-0 right-0 p-8">
              <ShoppingCart className="h-10 w-10 text-violet-50 blur-sm" />
            </div>
            
            <div className="relative z-10">
              <h3 className="text-2xl font-bold text-violet-950 mb-6 flex items-center gap-3">
                Order Summary
                {selectedPdfSlugs.length > 0 && (
                  <Badge variant="live" className="bg-violet-600 text-white border-violet-500">{selectedPdfSlugs.length}</Badge>
                )}
              </h3>

              {selectedPdfSlugs.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed border-slate-100 rounded-3xl mb-6">
                  <div className="h-12 w-12 bg-slate-50 text-slate-300 rounded-2xl mx-auto flex items-center justify-center mb-4">
                    <ShoppingCart className="h-6 w-6" />
                  </div>
                  <p className="text-sm font-bold text-slate-400">Your bundle is empty</p>
                  <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-widest">Select subjects to get started</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {(isPremium || isAdmin) && (
                    <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 mb-4">
                      <div className="flex items-start gap-3">
                        <ShieldCheck className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs font-bold text-emerald-900">Premium/Admin Preview</p>
                          <p className="text-[10px] text-emerald-700 font-medium leading-relaxed mt-1">
                            You have unlimited access! This view shows what a regular user would see.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="space-y-3 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                    {selectedPdfSlugs.map(slug => {
                      const s = subjects.find(sub => sub.slug === slug);
                      return (
                        <div key={slug} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0 text-sm">
                          <span className="font-bold text-slate-600 truncate max-w-[150px]">{s?.title}</span>
                          <span className="text-violet-900 font-bold">₹{unitPrice}</span>
                        </div>
                      );
                    })}
                  </div>

                  {isBetterThanPremium && (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="p-4 rounded-2xl bg-amber-50 border border-amber-200"
                    >
                      <div className="flex items-start gap-3">
                        <Crown className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs font-bold text-amber-900">Wait! Smart Recommendation</p>
                          <p className="text-[10px] text-amber-700 font-medium leading-relaxed mt-1">
                            Buying {selectedPdfSlugs.length} PDFs individually costs ₹{totalPrice}. Get <b>Season Premium Access for ₹{premiumPrice}</b> instead to unlock everything including this bundle!
                          </p>
                        </div>
                      </div>
                      <a href="/premium" className="block mt-3">
                        <Button size="sm" className="w-full bg-amber-600 hover:bg-amber-700 text-[10px] h-8">
                          Get Premium Instead
                        </Button>
                      </a>
                    </motion.div>
                  )}

                  {/* Coupon Section */}
                  <div className="py-4 border-t border-slate-100">
                    {selectedPdfSlugs.length > 1 ? (
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-center">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed">
                          Coupons only apply to single PDF purchases.<br/>
                          <span className="text-violet-400">Bundle pricing already includes a natural discount.</span>
                        </p>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-2 mb-2">
                          <div className="relative flex-1">
                            <input
                              type="text"
                              placeholder="ENTER COUPON CODE"
                              className="w-full h-10 pl-4 pr-10 text-[10px] font-black uppercase tracking-widest bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                              value={couponCode}
                              onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                              disabled={!!appliedCoupon}
                            />
                            {appliedCoupon && (
                              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-500">
                                <Check className="h-4 w-4" />
                              </div>
                            )}
                          </div>
                          {appliedCoupon ? (
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="text-rose-500 hover:text-rose-600 font-bold text-[10px]"
                              onClick={() => { setAppliedCoupon(null); setCouponCode(''); }}
                            >
                              Remove
                            </Button>
                          ) : (
                            <Button 
                              size="sm" 
                              className="h-10 text-[10px] font-black px-4"
                              onClick={handleApplyCoupon}
                              loading={isValidatingCoupon}
                            >
                              Apply
                            </Button>
                          )}
                        </div>
                        {appliedCoupon && (
                          <p className="text-[10px] text-emerald-600 font-bold px-1">
                            Applied: {appliedCoupon.type === 'percentage' ? `${appliedCoupon.discountPercentage}% Off` : `₹${appliedCoupon.discountAmount} Off`}
                          </p>
                        )}
                      </>
                    )}
                  </div>

                  <div className="pt-4 border-t border-slate-100">
                    <div className="space-y-2 mb-6">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">Subtotal</span>
                        <span className="text-sm font-bold text-slate-600 italic">₹{totalPrice}</span>
                      </div>
                      {appliedCoupon && (
                        <div className="flex items-center justify-between text-emerald-600">
                          <span className="font-bold uppercase tracking-widest text-[10px]">Discount</span>
                          <span className="text-sm font-bold italic">-₹{
                            appliedCoupon.type === 'flat' 
                              ? appliedCoupon.discountAmount 
                              : Math.round(totalPrice * (appliedCoupon.discountPercentage || 0) / 100)
                          }</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between pt-2">
                        <span className="text-slate-900 font-bold uppercase tracking-widest text-[10px]">Total Amount</span>
                        <span className="text-3xl font-black text-violet-950">₹{
                          appliedCoupon 
                            ? Math.max(0, appliedCoupon.type === 'flat' 
                                ? totalPrice - (appliedCoupon.discountAmount || 0)
                                : totalPrice - Math.round(totalPrice * (appliedCoupon.discountPercentage || 0) / 100))
                            : totalPrice
                        }</span>
                      </div>
                    </div>

                    <Button 
                      className="w-full h-16 text-lg font-bold shadow-xl shadow-violet-200 rounded-2xl group"
                      onClick={handlePurchase}
                      loading={isProcessing}
                    >
                      Complete Purchase
                      <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
                    </Button>
                    
                    <p className="text-[10px] text-center text-slate-400 font-bold uppercase tracking-widest mt-6 flex items-center justify-center gap-2">
                      <Lock className="h-3 w-3" />
                      Secure Checkout via Razorpay
                    </p>
                  </div>
                </div>
              )}
            </div>
          </Card>
          
          <div className="mt-8 p-6 rounded-3xl bg-slate-50 border border-slate-100 flex gap-4">
            <div className="h-10 w-10 bg-white rounded-xl shadow-sm flex items-center justify-center shrink-0">
              <Info className="h-5 w-5 text-violet-400" />
            </div>
            <div>
              <h5 className="text-xs font-black text-slate-900 uppercase tracking-widest mb-1">Instant Download</h5>
              <p className="text-[10px] text-slate-500 font-medium leading-relaxed">Purchased PDFs are automatically unlocked on their respective subject dashboards. Simply sign in and click "Download PDF".</p>
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showSuccessModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm px-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-[2.5rem] p-8 max-w-md w-full text-center shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-violet-600 via-amber-400 to-emerald-500" />
              
              <div className="mb-6 inline-flex h-20 w-20 items-center justify-center rounded-3xl bg-emerald-50 text-emerald-600 shadow-inner">
                <PartyPopper className="h-10 w-10" />
              </div>
              
              <h2 className="text-2xl font-bold text-violet-950 mb-3 tracking-tight">PDFs Unlocked! 📄</h2>
              <p className="text-slate-600 text-sm font-medium mb-8 leading-relaxed">
                Your purchase was successful. You now have lifetime access to the selected subject PDFs.
              </p>
              
              <Button 
                className="w-full h-14 text-base rounded-2xl shadow-lg shadow-violet-200"
                onClick={() => window.location.reload()}
              >
                Go to Dashboard
              </Button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
