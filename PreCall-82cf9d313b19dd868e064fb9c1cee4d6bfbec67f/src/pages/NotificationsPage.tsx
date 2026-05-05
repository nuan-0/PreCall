import { useNotifications } from '../hooks/useData';
import { useAuth } from '../contexts/AuthContext';
import { Card, Badge } from '../components/UI';
import { Bell, Info, AlertTriangle, Sparkles, Clock, Crown } from 'lucide-react';
import { cn } from '../lib/utils';

export function NotificationsPage() {
  const { user, isAdmin } = useAuth();
  const { notifications, loading } = useNotifications(user?.uid, isAdmin);

  const getIcon = (type: string) => {
    switch (type) {
      case 'update': return <Info className="h-5 w-5 text-blue-600" />;
      case 'alert': return <AlertTriangle className="h-5 w-5 text-amber-600" />;
      case 'welcome': return <Sparkles className="h-5 w-5 text-violet-600" />;
      case 'premium': return <Crown className="h-5 w-5 text-amber-500" />;
      default: return <Bell className="h-5 w-5 text-slate-600" />;
    }
  };

  const getBgColor = (type: string) => {
    switch (type) {
      case 'update': return 'bg-blue-50 border-blue-100';
      case 'alert': return 'bg-amber-50 border-amber-100';
      case 'welcome': return 'bg-violet-50 border-violet-100';
      case 'premium': return 'bg-amber-50/30 border-amber-200';
      default: return 'bg-slate-50 border-slate-100';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-violet-600" />
      </div>
    );
  }

  return (
    <div className="container-narrow py-16">
      <header className="mb-12">
        <div className="flex items-center gap-4 mb-4">
          <div className="p-3 rounded-2xl bg-violet-600 text-white shadow-lg shadow-violet-200">
            <Bell className="h-6 w-6" />
          </div>
          <h1 className="text-4xl font-black text-violet-950 tracking-tight">Notifications</h1>
        </div>
        <p className="text-lg text-slate-500 font-medium text-balance">Stay updated with the latest topics, app features, and important alerts.</p>
      </header>

      <div className="space-y-6">
        {notifications.length > 0 ? (
          notifications.map((notification) => (
            <Card key={notification.id} className={cn("p-8 border transition-all hover:shadow-xl hover:shadow-slate-100/50", getBgColor(notification.type))}>
              <div className="flex gap-6">
                <div className="shrink-0">
                  <div className="p-3 rounded-xl bg-white shadow-sm border border-inherit">
                    {getIcon(notification.type)}
                  </div>
                </div>
                <div className="flex-1">
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <h3 className="text-xl font-black text-slate-900 leading-tight">{notification.title}</h3>
                    <Badge variant="live" className="bg-white/50 backdrop-blur-sm border-inherit text-[10px] font-black uppercase tracking-widest text-slate-400">
                      {notification.type}
                    </Badge>
                  </div>
                  <p className="text-slate-600 font-medium leading-relaxed mb-4">{notification.message}</p>
                  <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    <Clock className="h-3 w-3" />
                    {new Date(notification.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            </Card>
          ))
        ) : (
          <div className="text-center py-20 bg-slate-50 rounded-[2rem] border-2 border-dashed border-slate-200">
            <div className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-white shadow-sm mb-6">
              <Bell className="h-10 w-10 text-slate-300" />
            </div>
            <h3 className="text-xl font-black text-slate-900 mb-2">All caught up!</h3>
            <p className="text-slate-500 font-medium">No new notifications at the moment. Check back later.</p>
          </div>
        )}
      </div>
    </div>
  );
}
