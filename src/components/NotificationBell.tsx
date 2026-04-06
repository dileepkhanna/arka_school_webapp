import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '@/lib/apiClient';
import { useAuth } from '@/hooks/useAuth';
import { subscribeToNotificationStream } from '@/lib/notificationStream';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Bell, Clock, FileText, Award, CheckCircle, CalendarCheck, FlaskConical, BookOpen, Megaphone, Wallet, MessageSquareWarning } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Notification {
  id: number;
  title: string;
  message: string;
  type: string;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

const NOTIFICATION_POLL_INTERVAL_MS = 60000;
const TIME_LABEL_REFRESH_MS = 1000;

export default function NotificationBell() {
  const { user, userRole } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const [, setClockTick] = useState(0);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  // Rewrite notification link to match user's role panel
  const getRoleLink = (link: string | null): string | null => {
    if (!link || !userRole) return link;
    let rewritten = link.replace(/^\/(admin|teacher|parent)\//, `/${userRole}/`);
    // Parents don't have a weekly-exams page; redirect to exams
    if (userRole === 'parent' && rewritten.includes('/parent/weekly-exams')) {
      rewritten = rewritten.replace('/parent/weekly-exams', '/parent/exams');
    }
    return rewritten;
  };

  useEffect(() => {
    if (!user) return;
    fetchNotifications();

    const unsubscribe = subscribeToNotificationStream(() => {
      void fetchNotifications();
    });
    const intervalId = window.setInterval(fetchNotifications, NOTIFICATION_POLL_INTERVAL_MS);
    const focusHandler = () => { void fetchNotifications(); };
    window.addEventListener('focus', focusHandler);

    return () => {
      unsubscribe();
      window.clearInterval(intervalId);
      window.removeEventListener('focus', focusHandler);
    };
  }, [user]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setClockTick((tick) => tick + 1);
    }, TIME_LABEL_REFRESH_MS);

    return () => window.clearInterval(intervalId);
  }, []);

  const fetchNotifications = async () => {
    if (!user) return;
    try {
      const data = await apiClient.get<Notification[]>('/notifications?limit=20');
      setNotifications(data || []);
    } catch (error) {
      console.error('Failed to fetch notifications', error);
    }
  };

  const markAsRead = async (id: number) => {
    await apiClient.post('/notifications/mark-read', { id });
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
  };

  const markAllRead = async () => {
    if (!user) return;
    const unreadIds = notifications.filter(n => !n.is_read).map(n => n.id);
    if (unreadIds.length === 0) return;
    await apiClient.post('/notifications/mark-all-read', { ids: unreadIds });
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  };

  const handleClick = (n: Notification) => {
    if (!n.is_read) markAsRead(n.id);
    const roleLink = getRoleLink(n.link);
    if (roleLink) {
      setOpen(false);
      navigate(roleLink);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'leave': return <Clock className="h-4 w-4 text-orange-500" />;
      case 'certificate': return <Award className="h-4 w-4 text-blue-500" />;
      case 'attendance': return <CalendarCheck className="h-4 w-4 text-green-500" />;
      case 'result': return <FileText className="h-4 w-4 text-purple-500" />;
      case 'competitive_exam': return <FlaskConical className="h-4 w-4 text-red-500" />;
      case 'exam_schedule': return <FileText className="h-4 w-4 text-indigo-500" />;
      case 'homework': return <BookOpen className="h-4 w-4 text-yellow-600" />;
      case 'announcement': return <Megaphone className="h-4 w-4 text-teal-500" />;
      case 'fee': return <Wallet className="h-4 w-4 text-emerald-600" />;
      case 'complaint': return <MessageSquareWarning className="h-4 w-4 text-rose-600" />;
      default: return <Bell className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const timeAgo = (dateStr: string) => {
    const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (seconds < 5) return 'Just now';
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-[10px] bg-destructive text-destructive-foreground">
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[calc(100vw-2rem)] sm:w-80 max-w-sm p-0" align="end" sideOffset={8}>
        <div className="flex items-center justify-between px-3 sm:px-4 py-2.5 sm:py-3 border-b">
          <h4 className="font-semibold text-sm">Notifications</h4>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" className="text-xs h-7" onClick={markAllRead}>
              <CheckCircle className="h-3 w-3 mr-1" /> Mark all read
            </Button>
          )}
        </div>
        <div className="max-h-[60vh] sm:max-h-80 overflow-y-auto notification-scroll">
          {notifications.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground text-sm">
              <Bell className="h-8 w-8 mx-auto mb-2 opacity-30" />
              No notifications yet
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map(n => (
                <button
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={cn(
                    "w-full text-left px-3 sm:px-4 py-3 hover:bg-muted/50 transition-colors flex gap-3",
                    !n.is_read && "bg-primary/5"
                  )}
                >
                  <div className="mt-0.5 shrink-0">{getIcon(n.type)}</div>
                  <div className="min-w-0 flex-1">
                    <p className={cn("text-sm leading-snug", !n.is_read && "font-semibold")}>{n.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">{timeAgo(n.created_at)}</p>
                  </div>
                  {!n.is_read && <div className="mt-2 w-2 h-2 rounded-full bg-primary shrink-0" />}
                </button>
              ))}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
