import { ArrowLeft, ArrowRight, Check, Copy, HelpCircle, Info, Lightbulb, Target, Zap, ChevronLeft, ChevronRight, Lock, Sparkles, BookOpen, Clock, Calendar, Star, AlertTriangle, ListChecks, Quote } from 'lucide-react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Badge, Button, Card, Skeleton } from '../components/UI';
import { useTopic, useSubjects } from '../hooks/useData';
import { useAuth } from '../contexts/AuthContext';
import { cn } from '../lib/utils';
import ReactMarkdown from 'react-markdown';
import remarkBreaks from 'remark-breaks';

export function TopicPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { topic: fetchedTopic, loading } = useTopic(slug || '');
  const { subjects } = useSubjects();
  const { user, profile, isAdmin, isPremium, openAuthModal, toggleTopicCompletion } = useAuth();
  const [isCompleting, setIsCompleting] = useState(false);

  const defaultTopic: any = {
    id: 'article-21-right-to-life',
    slug: 'article-21-right-to-life',
    subjectSlug: 'polity',
    chapter: 'Fundamental Rights',
    title: 'Article 21 – Right to Life and Personal Liberty',
    teaser: 'The "Heart of Fundamental Rights". A single sentence that has been expanded by the Supreme Court to cover everything from Privacy to Sleep.',
    status: 'free',
    order: 1,
    examRelevance: 'Critical - Highest frequency in both Prelims & Mains',
    estimatedTime: '10 mins',
    lastUpdated: new Date().toLocaleDateString(),
    whyThisMatters: 'Article 21 is the most evolved article in the Constitution. UPSC loves testing the "Judicial Activism" aspect and the specific rights that have been included under its umbrella over the years.',
    coreConcept: `**The Bare Text:**
“No person shall be deprived of his life or personal liberty except according to **procedure established by law**.”

**The Evolution:**
1. **A.K. Gopalan Case (1950):** Narrow interpretation. Only protected against arbitrary *executive* action, not *legislative* action.
2. **Maneka Gandhi Case (1978):** Revolutionary shift. Introduced the concept of **"Due Process of Law"**. Now, the law itself must be "just, fair, and reasonable".`,
    upscGoldPoint: `**Who is covered?**
- **Citizens:** YES
- **Foreigners:** YES (except enemy aliens)
- **Legal Persons (Corporations):** NO (Article 21 is for natural human beings only).

**Key Doctrine:**
The "Golden Triangle" of the Constitution consists of **Articles 14, 19, and 21**. They are not mutually exclusive but form a single protective layer.`,
    deepUnderstanding: `**Procedure Established by Law vs. Due Process of Law**
- **Procedure Established by Law (British Origin):** If a law is validly passed, the court won't check if the law is "fair".
- **Due Process of Law (American Origin):** The court checks if the law is "fair, just, and non-arbitrary".
- **Current Indian Status:** Though the text says "Procedure Established by Law", the Supreme Court (since Maneka Gandhi) interprets it as "Due Process".`,
    linkedFacts: `**Rights declared as part of Article 21 by SC:**
- **Right to Privacy** (K.S. Puttaswamy Case, 2017)
- **Right to Livelihood** (Olga Tellis Case)
- **Right to Shelter**
- **Right to Clean Environment** (M.C. Mehta Cases)
- **Right to Free Legal Aid**
- **Right to Speedy Trial**
- **Right to Sleep** (Ramlila Maidan Case)
- **Right to Marriage of Choice** (Hadiya Case/Shakti Vahini Case)`,
    trapZone: `**Trap 1:** "Article 21 can be suspended during Emergency." → **WRONG.** After the 44th Amendment (1978), Articles 20 and 21 **cannot** be suspended even during a National Emergency.
**Trap 2:** "Right to Property is part of Article 21." → **WRONG.** It was a FR (Art 31) but is now only a Constitutional Right (Art 300A).
**Trap 3:** "Article 21 protects against private individuals." → **WRONG.** Fundamental Rights are generally enforceable against the **State**, not private citizens (with some exceptions like Art 17).`,
    memoryTrick: 'Think of Article 21 as an **"Expanding Umbrella"**. Every time a new human need arises (Privacy, Environment, Internet), the Supreme Court puts it under this umbrella.',
    prelimsSnapshot: `**Quick Check for Prelims:**
- **Scope:** All persons (Citizens + Foreigners).
- **Emergency Status:** Non-suspendable (Art 359).
- **Nature:** Negative obligation on the State.
- **Key Case:** Maneka Gandhi (1978) - shifted from "Procedure" to "Due Process".`,
    mcqs: `**Q1. Which of the following is NOT protected under Article 21?**
A. Right to a speedy trial
B. Right to travel abroad
C. Right to strike
D. Right to privacy

**Answer:** C. Right to strike (It is a legal/statutory right, not a Fundamental Right under Art 21).

**Q2. The "Due Process of Law" is a characteristic of which Article?**
A. Article 14
B. Article 19
C. Article 21
D. Article 22

**Answer:** C. Article 21 (as interpreted by SC in Maneka Gandhi case).`,
    oneLineRevision: 'Article 21 is the bedrock of individual dignity, protecting life and liberty against arbitrary state action through the "just, fair, and reasonable" test.',
    linkedTopics: 'Article 14 (Equality), Article 19 (Freedoms), Emergency Provisions, Judicial Review'
  };

  const topic: any = fetchedTopic || defaultTopic;
  const subject = subjects.find(s => s.slug === topic.subjectSlug);
  const isLocked = topic.status === 'premium' && !isPremium && !isAdmin;

  const isCompleted = profile?.completedTopics?.includes(topic.id);

  const handleToggleCompletion = async () => {
    if (!topic.id) return;
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
                
                {isPremium || isAdmin ? (
                  <div className="rounded-[2rem] overflow-hidden border border-slate-100 shadow-xl shadow-slate-200/50 bg-white">
                    <img 
                      src={topic.infographicUrl} 
                      alt={`${topic.title} Infographic`} 
                      className="w-full h-auto object-contain"
                      referrerPolicy="no-referrer"
                    />
                    <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end">
                      <a 
                        href={topic.infographicUrl} 
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

            {topic.pdfLink && (
              <div className="pt-8">
                <a 
                  href={topic.pdfLink} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-3 w-full p-6 rounded-[2rem] bg-violet-600 text-white font-black text-xl shadow-xl shadow-violet-200 hover:bg-violet-700 transition-all active:scale-[0.98]"
                >
                  <BookOpen className="h-6 w-6" />
                  Download Topic PDF
                </a>
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
  if (!content) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
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
      'rounded-[2rem] sm:rounded-[2.5rem] border p-6 sm:p-10 transition-all duration-300',
      isHighlight 
        ? 'border-orange-200 bg-orange-50/40 shadow-xl shadow-orange-100/20' 
        : 'border-slate-100 bg-white shadow-xl shadow-slate-100/30 hover:shadow-2xl hover:shadow-slate-200/40 hover:border-violet-200'
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
            <ReactMarkdown remarkPlugins={[remarkBreaks]}>{content}</ReactMarkdown>
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
