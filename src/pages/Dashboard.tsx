import { AlertCircle, ArrowRight, BookOpen, FileText, Lock, Sparkles, ChevronRight, Target, CheckCircle2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Badge, Card, Skeleton, Button } from '../components/UI';
import { useSubjects, useTopics } from '../hooks/useData';
import { useAuth } from '../contexts/AuthContext';
import { cn } from '../lib/utils';

export function Dashboard() {
  const { subjects, loading: subjectsLoading } = useSubjects();
  const { topics } = useTopics();
  const { isAdmin, isPremium, profile } = useAuth();
  const navigate = useNavigate();

  const completedCount = profile?.completedTopics?.length || 0;
  const totalTopics = topics.length || 1; // Prevent division by zero
  const progressPercentage = Math.min(100, Math.round((completedCount / totalTopics) * 100));

  return (
    <div className="container-wide py-12">
      <header className="mb-12 flex flex-col sm:flex-row sm:items-end justify-between gap-8">
        <div>
          <div className="flex items-center gap-3 mb-4">
            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Revision Session Active</span>
          </div>
          <h1 className="text-4xl font-black text-violet-950 sm:text-5xl tracking-tight">Revision Dashboard</h1>
          <p className="mt-3 text-lg text-slate-500 font-medium max-w-xl text-balance">Master high-yield UPSC topics with precision. Select a subject to begin your focused revision.</p>
        </div>
        
        <div className="flex items-center gap-5 p-5 rounded-2xl bg-white border border-slate-100 shadow-sm">
          <div className="text-right">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Daily Goal</p>
            <p className="text-sm font-black text-violet-950">10 Topics</p>
            <p className="text-[10px] font-medium text-slate-400">Master one topic at a time.</p>
          </div>
          <div className="h-12 w-12 rounded-xl bg-violet-50 flex items-center justify-center text-violet-600 shadow-inner">
            <Target className="h-6 w-6" />
          </div>
        </div>
      </header>

      {/* Premium Teaser Strip */}
      {(!isAdmin && !isPremium) && (
        <div className="mb-12 relative overflow-hidden rounded-[2rem] bg-violet-950 p-8 md:p-10 text-white shadow-2xl shadow-violet-200/50">
          <div className="absolute top-0 right-0 w-96 h-96 bg-violet-800/20 rounded-full blur-[100px] -mr-48 -mt-48" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-orange-500/10 rounded-full blur-[80px] -ml-32 -mb-32" />
          
          <div className="relative flex flex-col items-center justify-between gap-8 md:flex-row">
            <div className="flex items-center gap-6">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white/10 backdrop-blur-md border border-white/10 shadow-inner">
                <Sparkles className="h-8 w-8 text-orange-400" />
              </div>
              <div>
                <h3 className="text-2xl font-black tracking-tight">PreCall Premium</h3>
                <p className="text-sm text-violet-200 font-medium mt-1 max-w-md">Unlock one season access (valid till 25th May 2026) to all 100+ high-yield topics, trap zones, and premium PDF summaries.</p>
              </div>
            </div>
            <Link to="/premium" className="w-full md:w-auto">
              <Button variant="secondary" size="lg" className="w-full md:w-auto px-10 h-14 text-base shadow-xl shadow-orange-500/20">
                Upgrade Now
              </Button>
            </Link>
          </div>
        </div>
      )}

      {/* Premium Progress Tracker */}
      {isPremium && (
        <div className="mb-12 p-8 rounded-[2rem] bg-white border border-slate-100 shadow-sm relative overflow-hidden">
          <div className="absolute right-0 top-0 w-64 h-64 bg-emerald-50 rounded-full blur-[80px] -mr-32 -mt-32" />
          <div className="relative flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="flex items-center gap-6 w-full md:w-auto">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600 shadow-inner">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <div className="flex-1">
                <h3 className="text-2xl font-black text-violet-950 tracking-tight">Your Progress</h3>
                <p className="text-sm text-slate-500 font-medium mt-1">You've mastered {completedCount} out of {topics.length} topics.</p>
              </div>
            </div>
            
            <div className="w-full md:w-1/2 flex flex-col gap-3">
              <div className="flex justify-between items-end">
                <span className="text-sm font-bold text-slate-600">Completion</span>
                <span className="text-2xl font-black text-emerald-600">{progressPercentage}%</span>
              </div>
              <div className="h-4 w-full bg-slate-100 rounded-full overflow-hidden shadow-inner">
                <div 
                  className="h-full bg-emerald-500 rounded-full transition-all duration-1000 ease-out"
                  style={{ width: `${progressPercentage}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      <section>
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-black text-violet-950">Study Topics</h2>
            <Badge variant="new">Updated</Badge>
          </div>
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-50 border border-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-400">
            <AlertCircle className="h-3 w-3" />
            <span>New content added weekly</span>
          </div>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {subjectsLoading ? (
            Array.from({ length: 8 }).map((_, i) => (
              <Card key={i} className="h-64 flex flex-col justify-between p-6">
                <div>
                  <Skeleton className="h-12 w-12 mb-6" />
                  <Skeleton className="h-6 w-3/4 mb-3" />
                  <Skeleton className="h-4 w-full mb-2" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
                <Skeleton className="h-10 w-full" />
              </Card>
            ))
          ) : subjects.length > 0 ? (
            subjects.map((subject: any) => (
              <Card
                key={subject.slug}
                onClick={() => subject.status === 'live' && navigate(`/subject/${subject.slug}`)}
                className={cn(
                  'group flex flex-col justify-between h-full p-7 transition-all duration-300 border-slate-100',
                  subject.status === 'coming_soon' ? 'opacity-60 grayscale-[0.5] cursor-not-allowed' : 'hover:border-violet-300 hover:shadow-xl hover:shadow-violet-100/50'
                )}
              >
                <div>
                  <div className="mb-8 flex items-start justify-between">
                    <div className={cn(
                      "rounded-2xl p-3.5 transition-all duration-300",
                      subject.status === 'live' 
                        ? "bg-violet-50 text-violet-600 group-hover:bg-violet-600 group-hover:text-white group-hover:scale-110" 
                        : "bg-slate-50 text-slate-400"
                    )}>
                      <BookOpen className="h-6 w-6" />
                    </div>
                    <Badge variant={subject.status === 'live' ? 'live' : 'coming_soon'}>
                      {subject.status === 'live' ? 'Live' : 'Soon'}
                    </Badge>
                  </div>
                  <h3 className="text-xl font-black text-violet-950 group-hover:text-violet-600 transition-colors leading-tight">{subject.title}</h3>
                  <p className="mt-3 text-sm text-slate-500 font-medium leading-relaxed line-clamp-2">{subject.description}</p>
                </div>

                <div className="mt-10 flex items-center justify-between pt-6 border-t border-slate-50">
                  <div className="flex items-center gap-4">
                    {subject.pdfVisible && (
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black uppercase tracking-widest text-violet-400">Resource</span>
                        <div className="flex items-center gap-1 text-sm font-bold text-violet-600">
                          <FileText className="h-3 w-3" />
                          PDF
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {subject.status === 'live' ? (
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-50 text-slate-400 transition-all group-hover:bg-violet-600 group-hover:text-white group-hover:shadow-lg group-hover:shadow-violet-200">
                      <ChevronRight className="h-5 w-5" />
                    </div>
                  ) : (
                    <div className="h-11 w-11 flex items-center justify-center text-slate-200">
                      <Lock className="h-5 w-5" />
                    </div>
                  )}
                </div>
              </Card>
            ))
          ) : (
            <div className="col-span-full py-20 text-center">
              <p className="text-slate-400 font-bold uppercase tracking-widest">No subjects available yet.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
