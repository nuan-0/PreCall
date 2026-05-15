import { ArrowLeft, ArrowRight, Check, Copy, HelpCircle, Info, Lightbulb, Target, Zap, ChevronLeft, ChevronRight, Lock, Sparkles, BookOpen, Clock, Calendar, Star, AlertTriangle, ListChecks, Quote } from 'lucide-react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { Badge, Button, Card, Skeleton } from '../components/UI';
import { useTopic, useSubjects } from '../hooks/useData';
import { useAuth } from '../contexts/AuthContext';
import { cn, convertDriveUrlToDirectStream } from '../lib/utils';
import ReactMarkdown from 'react-markdown';
import remarkBreaks from 'remark-breaks';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import remarkGfm from 'remark-gfm';
import 'katex/dist/katex.min.css';

export function TopicPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { topic: fetchedTopic, loading } = useTopic(slug || '');
  const { subjects } = useSubjects();
  const { user, profile, isAdmin, isPremium, openAuthModal, toggleTopicCompletion } = useAuth();
  const [isCompleting, setIsCompleting] = useState(false);

  const topic: any = fetchedTopic;

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <Skeleton className="h-4 w-32 mb-10" />
        <Skeleton className="h-12 w-3/4 mb-6" />
        <Skeleton className="h-6 w-full mb-16" />
        <div className="space-y-12">
          <Skeleton className="h-80 w-full rounded-[2.5rem]" />
          <Skeleton className="h-64 w-full rounded-[2.5rem]" />
          <Skeleton className="h-64 w-full rounded-[2.5rem]" />
        </div>
      </div>
    );
  }

  if (!loading && !topic) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center p-4 text-center">
        <div className="mb-6 rounded-3xl bg-slate-50 p-6 text-slate-400 border border-slate-100 shadow-inner">
          <BookOpen className="h-12 w-12" />
        </div>
        <h2 className="text-3xl font-black text-violet-950 mb-3">Topic Not Found</h2>
        <p className="text-slate-500 mb-8 max-w-xs font-medium">The topic you are looking for might have been moved or doesn't exist.</p>
        <Link to="/dashboard">
          <Button size="lg" className="px-10 h-14 text-base shadow-xl shadow-violet-200/50">
            Back to Dashboard
          </Button>
        </Link>
      </div>
    );
  }

  const subject = subjects.find(s => s.slug === topic.subjectSlug);
  const isLocked = topic.status === 'premium' && !isPremium && !isAdmin;
  const hasPdfAccess = isPremium || isAdmin || subject?.pdfAccessType === 'free' || profile?.ownedPdfs?.includes(subject?.slug || '');

  const isCompleted = profile?.completedTopics?.includes(topic.id);

  const handleToggleCompletion = async () => {
    if (!topic?.id) return;
    setIsCompleting(true);
    try {
      await toggleTopicCompletion(topic.id);
      toast.success(isCompleted ? 'Marked as incomplete' : 'Marked as completed!');
    } catch (error) {
      toast.error('Failed to update progress');
    } finally {
      setIsCompleting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFCFE]">
      <div className="container-narrow py-12 pb-40">
        <nav className="mb-12">
          <Link to={subject ? `/subject/${subject.slug}` : '/dashboard'} className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-violet-600 transition-all hover:-translate-x-1 group">
            <ChevronLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-1" />
            Back to {subject?.title || 'Dashboard'}
          </Link>
        </nav>

        <header className="mb-16">
          <div className="mb-8 flex flex-wrap items-center gap-4">
            <Badge variant={topic.status}>{topic.status}</Badge>
            {subject && (
              <div className="flex items-center gap-2 text-xs font-black text-slate-400 uppercase tracking-widest">
                <BookOpen className="h-3.5 w-3.5" />
                {subject.title}
              </div>
            )}
          </div>
          <h1 className="text-5xl font-black text-violet-950 leading-[1.1] sm:text-6xl tracking-tight mb-8 text-balance">{topic.title}</h1>
          <p className="text-xl text-slate-600 font-medium leading-relaxed max-w-3xl mb-10 text-balance">{topic.teaser || "High-yield revision topic focused on core concepts and UPSC patterns."}</p>
          
          <div className="flex flex-wrap gap-4 pt-8 border-t border-slate-100">
            <div className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-violet-50 border border-violet-100 shadow-sm">
              <Star className="h-4 w-4 text-violet-600" />
              <span className="text-xs font-bold text-violet-900 uppercase tracking-wider">{topic.examRelevance || 'High Relevance'}</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-slate-50 border border-slate-100">
              <Clock className="h-4 w-4 text-slate-400" />
              <span className="text-xs font-bold text-slate-600">{topic.estimatedTime || '5 mins'}</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-slate-50 border border-slate-100">
              <Calendar className="h-4 w-4 text-slate-400" />
              <span className="text-xs font-bold text-slate-600">Updated: {topic.lastUpdated || 'Recently'}</span>
            </div>
          </div>
        </header>

        <div className="space-y-12 relative">
          {isLocked && (
            <div className="absolute inset-x-0 top-0 z-20 flex flex-col items-center justify-center bg-white/60 backdrop-blur-md rounded-[2.5rem] p-12 text-center border-2 border-violet-200 shadow-2xl shadow-violet-200/50 py-32">
              <div className="mb-8 rounded-3xl bg-violet-100 p-6 text-violet-600 shadow-inner border border-violet-200 animate-bounce">
                <Lock className="h-12 w-12" />
              </div>
              <h2 className="text-4xl font-black text-violet-950 mb-4 tracking-tight">Premium Topic Locked</h2>
              <p className="text-slate-600 text-lg font-medium mb-10 max-w-md leading-relaxed">
                This high-yield topic is reserved for premium members. Upgrade now to unlock all 100+ topics and advanced elimination logic.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 w-full max-w-sm">
                <Link to="/premium" className="flex-1">
                  <Button className="w-full h-16 text-lg font-black shadow-xl shadow-violet-200 rounded-2xl">
                    Unlock Now
                  </Button>
                </Link>
                {!user && (
                  <Button variant="outline" onClick={openAuthModal} className="flex-1 h-16 text-lg font-black border-2 rounded-2xl">
                    Sign In
                  </Button>
                )}
              </div>
            </div>
          )}

          <div className={cn("space-y-12 transition-all duration-500", isLocked && "blur-md pointer-events-none select-none opacity-40")}>
            {/* Structured Sections */}
            <ContentSection 
              title="Why this matters" 
              icon={Info} 
              content={topic.whyThisMatters || topic.whyUpscAsksThis} 
              color="blue" 
              isMarkdown 
            />
            
            <ContentSection 
              title="Core Concept" 
              icon={Zap} 
              content={topic.coreConcept || topic.coreRecall} 
              color="violet" 
              isMarkdown 
            />

            <ContentSection 
              title="UPSC Gold Point" 
              icon={Star} 
              content={topic.upscGoldPoint || topic.pyqPattern} 
              color="orange" 
              isHighlight
              isMarkdown 
            />

            <ContentSection 
              title="Deep Understanding" 
              icon={Lightbulb} 
              content={topic.deepUnderstanding || topic.deepLink} 
              color="amber" 
              isMarkdown 
            />

            <ContentSection 
              title="Linked Facts / Dimensions" 
              icon={ListChecks} 
              content={topic.linkedFacts} 
              color="indigo" 
              isMarkdown 
            />

            <ContentSection 
              title="Trap Zone" 
              icon={AlertTriangle} 
              content={topic.trapZone} 
              color="orange" 
              isHighlight
              isMarkdown 
            />

            <ContentSection 
              title="Memory Trick" 
              icon={Sparkles} 
              content={topic.memoryTrick} 
              color="green" 
              isMarkdown 
              canCopy
            />

            <ContentSection 
              title="Prelims Snapshot" 
              icon={Target} 
              content={topic.prelimsSnapshot || topic.quickEliminationLogic} 
              color="blue" 
              isMarkdown 
            />

            <ContentSection 
              title="MCQs" 
              icon={HelpCircle} 
              content={topic.mcqs || (topic.miniMcqQuestion ? `${topic.miniMcqQuestion}\n\n**Answer:** ${topic.miniMcqAnswer}` : null)} 
              color="indigo" 
              isMarkdown 
            />

            <ContentSection 
              title="One-Line Revision" 
              icon={Quote} 
              content={topic.oneLineRevision} 
              color="violet" 
              isMarkdown 
              canCopy
            />

            <ContentSection 
              title="Linked Topics" 
              icon={ArrowRight} 
              content={topic.linkedTopics} 
              color="slate" 
              isMarkdown 
            />

            {topic.infographicUrl && (
              <div className="pt-8">
                <div className="mb-6 flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-100 text-orange-600 shadow-inner">
                    <Sparkles className="h-6 w-6" />
                  </div>
                  <h2 className="text-2xl font-black text-violet-950 tracking-tight">Topic Infographic</h2>
                </div>
                
                {topic.infographicStatus === 'free' || isPremium || isAdmin ? (
                  <div className="rounded-[2rem] overflow-hidden border border-slate-100 shadow-xl shadow-slate-200/50 bg-white">
                    <img 
                      src={convertDriveUrlToDirectStream(topic.infographicUrl) || topic.infographicUrl} 
                      alt={`${topic.title} Infographic`} 
                      className="w-full h-auto object-contain"
                      referrerPolicy="no-referrer"
                    />
                    <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end">
                      <a 
                        href={convertDriveUrlToDirectStream(topic.infographicUrl) || topic.infographicUrl} 
                        download={`${topic.slug}-infographic.jpg`}
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-6 py-3 rounded-xl bg-violet-600 text-white font-bold hover:bg-violet-700 transition-colors shadow-md shadow-violet-200"
                      >
                        <BookOpen className="h-4 w-4" />
                        Save Infographic
                      </a>
                    </div>
                  </div>
                ) : (
                  <div className="relative overflow-hidden rounded-[2rem] bg-violet-950 p-10 text-center text-white shadow-2xl shadow-violet-200/50">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-violet-800/20 rounded-full blur-[80px] -mr-32 -mt-32" />
                    <div className="mb-6 inline-flex rounded-3xl bg-white/10 p-5 backdrop-blur-md border border-white/10 shadow-inner">
                      <Lock className="h-10 w-10 text-orange-400" />
                    </div>
                    <h3 className="text-2xl font-black mb-3 tracking-tight">Premium Infographic Locked</h3>
                    <p className="text-violet-200 font-medium max-w-md mx-auto mb-8">Upgrade to Premium to view and download high-quality visual summaries for this topic.</p>
                    <Link to="/premium">
                      <Button variant="secondary" size="lg" className="px-10 h-14 text-base shadow-xl shadow-orange-500/20">
                        Unlock Premium
                      </Button>
                    </Link>
                  </div>
                )}
              </div>
            )}

            {topic.pdfUrl && hasPdfAccess && (
              <div className="pt-8 space-y-3">
                <a 
                  href={topic.pdfUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-3 w-full p-6 rounded-[2rem] bg-violet-600 text-white font-black text-xl shadow-xl shadow-violet-200 hover:bg-violet-700 transition-all active:scale-[0.98]"
                >
                  <BookOpen className="h-6 w-6" />
                  Download Topic PDF
                </a>
                {topic.pdfPassword && (
                  <div className="flex items-center justify-center gap-2 py-3 px-6 rounded-2xl bg-violet-50 border border-violet-100 text-violet-700 shadow-sm animate-in fade-in slide-in-from-top-1 duration-500">
                    <Lock className="h-4 w-4" />
                    <span className="text-xs font-black uppercase tracking-widest">Password:</span>
                    <span className="text-lg font-black font-mono">{topic.pdfPassword}</span>
                  </div>
                )}
              </div>
            )}

            {topic.pdfUrl && !hasPdfAccess && (
              <div className="pt-8">
                <Link to={`/pdf-store?select=${subject?.slug}`}>
                  <Button variant="outline" icon={Lock} className="w-full h-16 text-lg font-black border-amber-200 text-amber-700 bg-amber-50/30 hover:bg-amber-50 rounded-[2rem]">
                    Unlock Topic PDF
                  </Button>
                </Link>
              </div>
            )}

            {isPremium && (
              <div className="pt-8 flex justify-center">
                <Button 
                  size="lg" 
                  onClick={handleToggleCompletion}
                  disabled={isCompleting}
                  className={cn(
                    "w-full sm:w-auto h-16 px-10 text-lg font-black rounded-[2rem] shadow-xl transition-all",
                    isCompleted 
                      ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 shadow-emerald-100/50" 
                      : "bg-violet-600 text-white hover:bg-violet-700 shadow-violet-200"
                  )}
                >
                  {isCompleting ? (
                    <span className="flex items-center gap-2">
                      <div className="h-5 w-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      Updating...
                    </span>
                  ) : isCompleted ? (
                    <span className="flex items-center gap-2">
                      <Check className="h-6 w-6" />
                      Completed
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <Check className="h-6 w-6 opacity-50" />
                      Mark as Completed
                    </span>
                  )}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ContentSection({ title, icon: Icon, content, color, isHighlight, isMarkdown, canCopy }: any) {
  const [copied, setCopied] = useState(false);
  const isMounted = useRef(true);
  useEffect(() => {
    return () => { isMounted.current = false; };
  }, []);
  
  if (!content) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    toast.success('Copied to clipboard');
    setTimeout(() => {
      if (isMounted.current) setCopied(false);
    }, 2000);
  };

  const colors: any = {
    violet: 'bg-violet-50 text-violet-600 border-violet-100 shadow-violet-100/20',
    blue: 'bg-blue-50 text-blue-600 border-blue-100 shadow-blue-100/20',
    orange: 'bg-orange-50 text-orange-600 border-orange-100 shadow-orange-100/20',
    amber: 'bg-amber-50 text-amber-600 border-amber-100 shadow-amber-100/20',
    indigo: 'bg-indigo-50 text-indigo-600 border-indigo-100 shadow-indigo-100/20',
    green: 'bg-green-50 text-green-600 border-green-100 shadow-green-100/20',
    slate: 'bg-slate-50 text-slate-600 border-slate-100 shadow-slate-100/20',
  };

  return (
    <div className={cn(
      'brutalist-card p-6 sm:p-10 transition-all duration-300',
      isHighlight && 'border-orange-500 bg-orange-50/20'
    )}>
      <div className="mb-6 sm:mb-8 flex items-center justify-between">
        <div className="flex items-center gap-4 sm:gap-5">
          <div className={cn('rounded-xl sm:rounded-2xl p-3 sm:p-4 shadow-sm border', colors[color])}>
            <Icon className="h-5 w-5 sm:h-7 sm:h-7" />
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-violet-950 tracking-tight">{title}</h2>
        </div>
        {(canCopy || copied) && (
          <button
            onClick={handleCopy}
            className="rounded-xl p-2 sm:p-3 text-slate-300 transition-all hover:bg-slate-50 hover:text-violet-600 active:scale-90 border border-transparent hover:border-slate-100"
            title="Copy to clipboard"
          >
            {copied ? <Check className="h-5 w-5 sm:h-6 sm:h-6 text-emerald-500" /> : <Copy className="h-5 w-5 sm:h-6 sm:h-6" />}
          </button>
        )}
      </div>
      <div className="prose prose-violet max-w-none text-slate-600 font-medium leading-relaxed text-base sm:text-lg">
        {isMarkdown ? (
          <div className="markdown-body">
            <ReactMarkdown 
              remarkPlugins={[remarkBreaks, remarkMath, remarkGfm]} 
              rehypePlugins={[rehypeKatex]}
            >
              {content}
            </ReactMarkdown>
          </div>
        ) : (
          <p className="whitespace-pre-line">{content}</p>
        )}
      </div>
    </div>
  );
}

function McqAnswer({ answer }: { answer: string }) {
  const [show, setShow] = useState(false);

  return (
    <div>
      {!show ? (
        <button
          onClick={() => setShow(true)}
          className="group flex items-center gap-3 text-sm font-black uppercase tracking-widest text-violet-400 hover:text-violet-300 transition-all"
        >
          Reveal Correct Answer <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-2" />
        </button>
      ) : (
        <div className="rounded-3xl bg-slate-900 border border-slate-800 p-8 animate-in fade-in zoom-in-95 duration-500 shadow-2xl">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-1.5 w-1.5 rounded-full bg-violet-400 animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-widest text-violet-400">Correct Answer</span>
          </div>
          <p className="text-2xl font-black text-white tracking-tight">{answer}</p>
          <button
            onClick={() => setShow(false)}
            className="mt-6 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-300 transition-colors border-b border-transparent hover:border-slate-400"
          >
            Hide Answer
          </button>
        </div>
      )}
    </div>
  );
}
