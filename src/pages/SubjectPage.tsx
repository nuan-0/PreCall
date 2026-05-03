import { ArrowLeft, FileText, Lock, ChevronRight, BookOpen, CheckCircle2, Download, Clock } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { Badge, Button, Card, Skeleton } from '../components/UI';
import { useSubjects, useTopics, useSettings } from '../hooks/useData';
import { useAuth } from '../contexts/AuthContext';
import { cn } from '../lib/utils';

export function SubjectPage() {
  const { slug } = useParams();
  const { subjects } = useSubjects();
  const { settings } = useSettings();
  const subject = subjects.find(s => s.slug === slug);
  const { user, profile, isAdmin, isPremium: userIsPremium, openAuthModal } = useAuth();

  const { topics, loading } = useTopics(subject?.slug || '');
  
  const hasPdfAccess = userIsPremium || isAdmin || subject?.pdfAccessType === 'free' || profile?.ownedPdfs?.includes(subject?.slug || '');

  const handlePdfClick = (e: React.MouseEvent) => {
    if (!user) {
      e.preventDefault();
      openAuthModal();
    }
  };
  
  const displayTopics = topics;

  if (!subject) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center p-4 text-center">
        <div className="mb-6 rounded-3xl bg-slate-50 p-6 text-slate-400 border border-slate-100 shadow-inner">
          <BookOpen className="h-12 w-12" />
        </div>
        <h2 className="text-3xl font-black text-violet-950 mb-3">Subject Not Found</h2>
        <p className="text-slate-500 mb-8 max-w-xs font-medium">The subject you are looking for might have been moved or is under maintenance.</p>
        <Link to="/dashboard">
          <Button size="lg" className="px-10 h-14 text-base shadow-xl shadow-violet-200/50">
            Back to Dashboard
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="container-narrow py-12">
      <nav className="mb-12">
        <Link to="/dashboard" className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-violet-600 transition-all hover:-translate-x-1 group">
          <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-1" />
          Back to Dashboard
        </Link>
      </nav>

      <div className="mb-16 flex flex-col items-start justify-between gap-12 md:flex-row md:items-center">
        <div className="flex-1">
          <div className="mb-6 flex flex-wrap items-center gap-4">
            <h1 className="text-5xl font-black text-violet-950 tracking-tight leading-none">{subject.title}</h1>
            <Badge variant={subject.status === 'live' ? 'live' : 'coming_soon'} className="px-4 py-1.5 text-[10px]">
              {subject.status === 'live' ? 'Live' : 'Rolling Out'}
            </Badge>
          </div>
          <p className="text-xl text-slate-500 font-medium leading-relaxed max-w-2xl text-balance">{subject.description}</p>
        </div>
        
        {subject.pdfVisible && subject.pdfUrl ? (
          hasPdfAccess ? (
            <div className="w-full md:w-auto flex flex-col gap-3">
              <a href={subject.pdfUrl} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" icon={Download} className="w-full h-16 px-10 text-base shadow-xl shadow-slate-200/20 bg-white border-slate-200 hover:border-violet-300 hover:text-violet-600">
                  {subject.pdfTitle || 'Download PDF'}
                </Button>
              </a>
              {subject.pdfPassword && (
                <div className="flex items-center justify-center gap-2 py-2 px-4 rounded-xl bg-violet-50 border border-violet-100 text-violet-700 animate-in fade-in slide-in-from-top-1 duration-500">
                  <Lock className="h-3.5 w-3.5" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Password:</span>
                  <span className="text-sm font-black font-mono">{subject.pdfPassword}</span>
                </div>
              )}
            </div>
          ) : (
            <Link to={`/pdf-store?select=${subject.slug}`} onClick={handlePdfClick} className="w-full md:w-auto">
              <Button variant="outline" icon={Lock} className="w-full h-16 px-10 text-base shadow-xl shadow-amber-100/20 bg-amber-50/30 border-amber-200 text-amber-700 hover:bg-amber-50">
                Unlock PDF (₹{settings?.pdfPrice || '199'})
              </Button>
            </Link>
          )
        ) : subject.pdfVisible ? (
          <div className="w-full md:w-auto flex items-center gap-4 px-8 py-5 rounded-2xl bg-slate-50 border border-slate-100 text-slate-400 shadow-inner">
            <FileText className="h-6 w-6" />
            <div className="flex flex-col">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Resource</span>
              <span className="text-sm font-bold uppercase tracking-widest">PDF Coming Soon</span>
            </div>
          </div>
        ) : null}
      </div>

      <div className="mb-10 flex items-center justify-between border-b border-slate-100 pb-6">
        <div className="flex items-center gap-3">
          <h2 className="text-xs font-black uppercase tracking-widest text-slate-400">Revision Topics</h2>
          <Badge variant="new">New</Badge>
        </div>
        <span className="text-xs font-black text-violet-600 uppercase tracking-widest">{displayTopics.length} Total</span>
      </div>

      <div className="space-y-5">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <Card key={i} className="p-8">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                <div className="flex-1">
                  <Skeleton className="h-8 w-1/2 mb-4" />
                  <Skeleton className="h-4 w-full" />
                </div>
                <Skeleton className="h-12 w-32 rounded-xl" />
              </div>
            </Card>
          ))
        ) : displayTopics.length > 0 ? (
          displayTopics.map((topic) => (
            <TopicCard key={topic.slug} topic={topic} />
          ))
        ) : (
          <Card className="p-16 text-center border-dashed bg-slate-50/50">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
              <Clock className="h-8 w-8" />
            </div>
            <h3 className="text-xl font-black text-violet-950 mb-2">No Topics Available Yet</h3>
            <p className="text-slate-500 font-medium max-w-xs mx-auto">We are currently curating the most important topics for {subject.title}.</p>
          </Card>
        )}
      </div>

      {subject.status === 'coming_soon' && (
        <div className="mt-16 relative overflow-hidden rounded-[2rem] bg-amber-50 border border-amber-100 p-10 text-center shadow-xl shadow-amber-100/50">
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-200/20 rounded-full blur-2xl -mr-16 -mt-16" />
          <h3 className="text-2xl font-black text-amber-900 mb-3 tracking-tight">More topics rolling out progressively</h3>
          <p className="text-amber-700 text-base font-medium max-w-xl mx-auto leading-relaxed">We are currently curating high-yield revision cards for this subject. Check back weekly for new updates.</p>
        </div>
      )}
    </div>
  );
}

function TopicCard({ topic }: { topic: any }) {
  const isComingSoon = topic.status === 'coming_soon';
  const isTopicPremium = topic.status === 'premium';
  const { user, profile, isAdmin, isPremium: userIsPremium, openAuthModal } = useAuth();

  const handlePremiumClick = (e: React.MouseEvent) => {
    if (!user) {
      e.preventDefault();
      openAuthModal();
    }
  };

  const isLocked = isTopicPremium && !userIsPremium && !isAdmin;
  const isCompleted = profile?.completedTopics?.includes(topic.id);

  return (
    <Card className={cn(
      'group relative p-8 transition-all duration-300 border-slate-100',
      isComingSoon ? 'opacity-60 grayscale-[0.5] cursor-not-allowed' : 'hover:border-violet-300 hover:shadow-xl hover:shadow-violet-100/50',
      isCompleted && 'border-emerald-200 bg-emerald-50/30'
    )}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-8">
        <div className="flex-1">
          <div className="mb-3 flex flex-wrap items-center gap-3">
            {isCompleted && (
              <div className="flex items-center justify-center h-8 w-8 rounded-full bg-emerald-100 text-emerald-600 shrink-0">
                <CheckCircle2 className="h-5 w-5" />
              </div>
            )}
            <h3 className="text-2xl font-black text-violet-950 group-hover:text-violet-600 transition-colors tracking-tight leading-tight">{topic.title}</h3>
            <Badge variant={topic.status}>{topic.status}</Badge>
          </div>
          <p className="text-slate-500 font-medium text-base leading-relaxed max-w-2xl line-clamp-2">{topic.teaser}</p>
        </div>
        
        <div className="flex items-center shrink-0">
          {isComingSoon ? (
            <div className="flex items-center gap-3 px-6 py-3 rounded-xl bg-slate-50 text-slate-400 text-xs font-black uppercase tracking-widest border border-slate-100 shadow-inner">
              <Lock className="h-4 w-4" />
              Soon
            </div>
          ) : isLocked ? (
            <Link to="/premium" onClick={handlePremiumClick} className="w-full sm:w-auto">
              <Button variant="outline" size="lg" icon={Lock} className="w-full border-amber-200 text-amber-700 hover:bg-amber-50 hover:border-amber-300 h-14 px-8 text-base shadow-lg shadow-amber-100/20">
                Unlock Premium
              </Button>
            </Link>
          ) : (
            <Link to={`/topic/${topic.slug}`} className="w-full sm:w-auto">
              <Button size="lg" className="w-full px-10 h-14 text-base group-hover:shadow-xl group-hover:shadow-violet-200/50">
                Start Revision
              </Button>
            </Link>
          )}
        </div>
      </div>
    </Card>
  );
}
