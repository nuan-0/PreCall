import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useUserProfile, useAvatarUnlock } from '../hooks/useData';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { doc, setDoc } from 'firebase/firestore';
import { toast } from 'sonner';
import { Button, Card, Badge } from '../components/UI';
import { User, Mail, ShieldCheck, Crown, Save, RefreshCw, UserCircle, Venus, Mars, Transgender, Image as ImageIcon, Lock as LockIcon } from 'lucide-react';
import { cn } from '../lib/utils';
import { ShareToUnlock } from '../components/ShareToUnlock';

export function ProfilePage() {
  const { user } = useAuth();
  const { profile, loading } = useUserProfile(user?.uid);
  const { isUnlocked } = useAvatarUnlock(user?.uid);
  const [isSaving, setIsSaving] = useState(false);
  const [avatarError, setAvatarError] = useState(false);
  const [formData, setFormData] = useState({
    displayName: '',
    gender: '' as 'male' | 'female' | 'other' | '',
    avatarUrl: ''
  });

  useEffect(() => {
    if (profile) {
      setFormData({
        displayName: profile.displayName || '',
        gender: profile.gender || '',
        avatarUrl: isUnlocked ? (profile.avatarUrl || profile.photoURL || '') : ''
      });
      setAvatarError(false);
    }
  }, [profile, isUnlocked]);

  useEffect(() => {
    setAvatarError(false);
  }, [formData.avatarUrl]);

  const generateAvatar = (gender: string) => {
    if (!isUnlocked) {
      toast.error('Please share the app to unlock avatar generation!');
      return;
    }
    const seed = Math.random().toString(36).substring(7);
    let url = `https://api.dicebear.com/9.x/avataaars/svg?seed=${seed}`;
    
    setFormData(prev => ({ ...prev, avatarUrl: url }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsSaving(true);
    try {
      const userRef = doc(db, 'users', user.uid);
      await setDoc(userRef, {
        displayName: formData.displayName,
        gender: formData.gender,
        avatarUrl: isUnlocked ? formData.avatarUrl : ''
      }, { merge: true });
      toast.success('Profile updated successfully!');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`);
      toast.error('Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-violet-600" />
      </div>
    );
  }

  const defaultAvatar = isUnlocked ? (user?.photoURL || (user?.uid ? `https://api.dicebear.com/9.x/avataaars/svg?seed=${user.uid}` : '')) : '';
  const displayAvatar = formData.avatarUrl || defaultAvatar;

  return (
    <div className="container-narrow py-16">
      <div className="mb-12">
        <h1 className="text-4xl font-black text-violet-950 mb-4 tracking-tight">Your Profile</h1>
        <p className="text-lg text-slate-500 font-medium text-balance">Manage your personal details and how you appear to others.</p>
      </div>

      <div className="grid gap-8 lg:grid-cols-3 items-start">
        {/* Profile Card */}
        <div className="lg:col-span-1 lg:sticky lg:top-24">
          <Card className="p-8 text-center border-slate-200 shadow-xl shadow-slate-100/50 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-24 bg-violet-600" />
            
            <div className="relative z-10">
              <div className="mb-6 inline-block p-1.5 rounded-full bg-white shadow-lg">
                <div className="h-32 w-32 rounded-full bg-slate-100 overflow-hidden border-4 border-white relative">
                  {!isUnlocked ? (
                    <div className="h-full w-full flex flex-col items-center justify-center bg-slate-50 text-slate-300">
                      <LockIcon className="h-8 w-8 mb-1" />
                      <span className="text-[8px] font-black uppercase tracking-widest">Locked</span>
                    </div>
                  ) : !avatarError && displayAvatar ? (
                    <img 
                      src={displayAvatar} 
                      alt="Avatar" 
                      className="h-full w-full object-cover" 
                      referrerPolicy="no-referrer"
                      onError={() => setAvatarError(true)}
                    />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-slate-300">
                      <UserCircle className="h-20 w-20" />
                    </div>
                  )}
                </div>
              </div>

              <h3 className="text-2xl font-black text-violet-950 mb-2 tracking-tight">
                {formData.displayName || 'Aspirant'}
              </h3>
              <p className="text-sm font-bold text-slate-400 mb-6">{user?.email}</p>

              <div className="flex flex-wrap justify-center gap-2 mb-8">
                {profile?.role === 'admin' && (
                  <Badge variant="live" className="bg-amber-100 text-amber-700 border-amber-200">
                    <ShieldCheck className="h-3 w-3 mr-1" />
                    Admin
                  </Badge>
                )}
                {profile?.isPremium ? (
                  <div className="mt-4">
                    <Badge variant="live" className="bg-violet-100 text-violet-700 border-violet-200">
                      <Crown className="h-3 w-3 mr-1" />
                      Premium
                    </Badge>
                    {profile.premiumExpiry && (
                      <p className="text-[10px] font-black text-slate-400 mt-2 uppercase tracking-widest">
                        Valid until: {new Date(profile.premiumExpiry).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                    )}
                  </div>
                ) : (
                  <Badge variant="free" className="bg-emerald-100 text-emerald-700 border-emerald-200">
                    Free Plan
                  </Badge>
                )}
              </div>

              {isUnlocked ? (
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full rounded-xl"
                  onClick={() => generateAvatar(formData.gender)}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Randomize Avatar
                </Button>
              ) : (
                <div className="text-xs font-bold text-violet-600 bg-violet-50 p-3 rounded-xl border border-violet-100">
                  Share to unlock avatar generation
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Edit Form */}
        <div className="lg:col-span-2 space-y-8">
          {!isUnlocked && (
            <ShareToUnlock uid={user?.uid} />
          )}

          <Card className="p-10 border-slate-200 shadow-xl shadow-slate-100/50">
            <form onSubmit={handleSave} className="space-y-8">
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-400">Display Name</label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                    <input 
                      type="text" 
                      className="w-full h-14 pl-12 rounded-2xl border-slate-200 font-bold focus:ring-violet-500 focus:border-violet-500"
                      value={formData.displayName}
                      onChange={e => setFormData(prev => ({ ...prev, displayName: e.target.value }))}
                      placeholder="Your name"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-400">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                    <input 
                      type="email" 
                      className="w-full h-14 pl-12 rounded-2xl border-slate-200 font-bold bg-slate-50 text-slate-400 cursor-not-allowed"
                      value={user?.email || ''}
                      disabled
                    />
                  </div>
                  <p className="text-[10px] font-medium text-slate-400 italic">Email cannot be changed as it is linked to your Google account.</p>
                </div>

                <div className="space-y-4">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-400">Gender</label>
                  <div className="grid grid-cols-3 gap-4">
                    {[
                      { id: 'male', label: 'Male', icon: Mars, color: 'text-blue-600 bg-blue-50 border-blue-100' },
                      { id: 'female', label: 'Female', icon: Venus, color: 'text-rose-600 bg-rose-50 border-rose-100' },
                      { id: 'other', label: 'Other', icon: Transgender, color: 'text-violet-600 bg-violet-50 border-violet-100' }
                    ].map((g) => (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => {
                          setFormData(prev => ({ ...prev, gender: g.id as any }));
                          if (isUnlocked && (!formData.avatarUrl || formData.avatarUrl.includes('dicebear'))) {
                            generateAvatar(g.id);
                          }
                        }}
                        className={cn(
                          "flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all",
                          formData.gender === g.id 
                            ? cn("border-violet-600 shadow-lg shadow-violet-100", g.color)
                            : "border-slate-100 hover:border-slate-200 text-slate-400"
                        )}
                      >
                        <g.icon className="h-6 w-6 mb-2" />
                        <span className="text-xs font-black uppercase tracking-widest">{g.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-400">Avatar URL (Optional)</label>
                  <div className="relative">
                    <ImageIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                    <input 
                      type="text" 
                      className="w-full h-14 pl-12 rounded-2xl border-slate-200 font-bold focus:ring-violet-500 focus:border-violet-500 disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed"
                      value={formData.avatarUrl}
                      onChange={e => setFormData(prev => ({ ...prev, avatarUrl: e.target.value }))}
                      placeholder={isUnlocked ? "https://example.com/avatar.png" : "Share to unlock"}
                      disabled={!isUnlocked}
                    />
                    {!isUnlocked && <LockIcon className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />}
                  </div>
                  <p className="text-[10px] font-medium text-slate-400 italic">
                    {isUnlocked 
                      ? "Paste a link to an image or use the \"Randomize Avatar\" button on the left."
                      : "Avatar editing is locked until you share the app."}
                  </p>
                </div>
              </div>

              <div className="pt-6 border-t border-slate-100">
                <Button 
                  type="submit" 
                  className="w-full h-14 text-lg shadow-xl shadow-violet-200"
                  loading={isSaving}
                >
                  <Save className="h-5 w-5 mr-2" />
                  Save Profile Changes
                </Button>
              </div>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}
