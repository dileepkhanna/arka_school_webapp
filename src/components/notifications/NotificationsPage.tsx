import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '@/lib/apiClient';
import { useAuth } from '@/hooks/useAuth';
import { subscribeToNotificationStream } from '@/lib/notificationStream';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Bell, Clock, FileText, Award, CheckCircle, CalendarCheck,
  FlaskConical, BookOpen, Trash2, CalendarIcon, X, Megaphone, Wallet, MessageSquareWarning,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, isSameDay, isToday, isBefore, isAfter, startOfDay } from 'date-fns';
import { toast } from 'sonner';

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

const getIcon = (type: string) => {
  switch (type) {
    case 'leave': return <Clock className="h-5 w-5 text-orange-500" />;
    case 'certificate': return <Award className="h-5 w-5 text-blue-500" />;
    case 'attendance': return <CalendarCheck className="h-5 w-5 text-green-500" />;
    case 'result': return <FileText className="h-5 w-5 text-purple-500" />;
    case 'competitive_exam': return <FlaskConical className="h-5 w-5 text-red-500" />;
    case 'exam_schedule': return <FileText className="h-5 w-5 text-indigo-500" />;
    case 'homework': return <BookOpen className="h-5 w-5 text-yellow-600" />;
    case 'announcement': return <Megaphone className="h-5 w-5 text-teal-500" />;
    case 'fee': return <Wallet className="h-5 w-5 text-emerald-600" />;
    case 'complaint': return <MessageSquareWarning className="h-5 w-5 text-rose-600" />;
    default: return <Bell className="h-5 w-5 text-muted-foreground" />;
  }
};

export default function NotificationsPage() {
  const { user, userRole } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [, setClockTick] = useState(0);

  // Rewrite notification link to match user's role panel
  const getRoleLink = (link: string | null): string | null => {
    if (!link || !userRole) return link;
    return link.replace(/^\/(admin|teacher|parent)\//, `/${userRole}/`);
  };
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);

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
    setLoading(true);
    try {
      const data = await apiClient.get<Notification[]>('/notifications?limit=100');
      if (data) setNotifications(data);
    } catch (error) {
      console.error('Failed to fetch notifications', error);
    }

    setLoading(false);
  };

  const filteredNotifications = selectedDate
    ? notifications.filter(n => isSameDay(new Date(n.created_at), selectedDate))
    : notifications;

  const unreadCount = filteredNotifications.filter(n => !n.is_read).length;

  const markAsRead = async (id: number) => {
    await apiClient.post('/notifications/mark-read', { id });
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
  };

  const markAllRead = async () => {
    if (!user) return;
    const unreadIds = filteredNotifications.filter(n => !n.is_read).map(n => n.id);
    if (unreadIds.length === 0) return;
    await apiClient.post('/notifications/mark-all-read', { ids: unreadIds });
    setNotifications(prev => prev.map(n => unreadIds.includes(n.id) ? { ...n, is_read: true } : n));
    toast.success('All marked as read');
  };

  const deleteNotification = async (id: number) => {
    await apiClient.delete(`/notifications/${id}`);
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const deleteAllRead = async () => {
    const readIds = filteredNotifications.filter(n => n.is_read).map(n => n.id);
    if (readIds.length === 0) return;
    await apiClient.post('/notifications/delete-read', { ids: readIds });
    setNotifications(prev => prev.filter(n => !readIds.includes(n.id)));
    toast.success('Deleted all read notifications');
  };

  const handleClick = (n: Notification) => {
    if (!n.is_read) markAsRead(n.id);
    const roleLink = getRoleLink(n.link);
    if (roleLink) navigate(roleLink);
  };

  const getDateLabel = () => {
    if (!selectedDate) return null;
    const today = startOfDay(new Date());
    if (isToday(selectedDate)) return 'Today';
    if (isBefore(selectedDate, today)) return 'Previous';
    if (isAfter(selectedDate, today)) return 'Upcoming';
    return null;
  };

  const timeAgo = (dateStr: string) => {
    const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (seconds < 5) return 'Just now';
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return format(new Date(dateStr), 'dd MMM yyyy, hh:mm a');
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-display font-bold">Notifications</h1>
          <p className="text-sm text-muted-foreground">
            {filteredNotifications.length} notification{filteredNotifications.length !== 1 ? 's' : ''}
            {unreadCount > 0 && ` · ${unreadCount} unread`}
            {selectedDate && (
              <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
                {getDateLabel()} · {format(selectedDate, 'dd MMM yyyy')}
              </span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Date filter */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className={cn(selectedDate && "border-primary text-primary")}>
                <CalendarIcon className="h-4 w-4 mr-1" />
                {selectedDate ? format(selectedDate, 'dd MMM') : 'Filter by date'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                className="p-3 pointer-events-auto"
              />
            </PopoverContent>
          </Popover>

          {selectedDate && (
            <Button variant="ghost" size="sm" onClick={() => setSelectedDate(undefined)}>
              <X className="h-4 w-4 mr-1" /> Clear
            </Button>
          )}

          {/* Quick filters */}
          <Button
            variant={isToday(selectedDate || new Date(0)) ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedDate(isToday(selectedDate || new Date(0)) ? undefined : new Date())}
          >
            Today
          </Button>

          {unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={markAllRead}>
              <CheckCircle className="h-4 w-4 mr-1" /> Mark All Read
            </Button>
          )}

          {filteredNotifications.some(n => n.is_read) && (
            <Button variant="outline" size="sm" onClick={deleteAllRead} className="text-destructive hover:text-destructive">
              <Trash2 className="h-4 w-4 mr-1" /> Delete Read
            </Button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : filteredNotifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Bell className="h-12 w-12 mb-3 opacity-30" />
          <p className="font-medium">No notifications</p>
          <p className="text-sm">{selectedDate ? `No notifications on ${format(selectedDate, 'dd MMM yyyy')}` : "You're all caught up!"}</p>
        </div>
      ) : (
        <div className="rounded-xl border bg-card divide-y">
          {filteredNotifications.map(n => (
            <div
              key={n.id}
              className={cn(
                "flex items-start gap-3 p-4 hover:bg-muted/50 transition-colors group",
                !n.is_read && "bg-primary/5"
              )}
            >
              <div className="mt-0.5 shrink-0">{getIcon(n.type)}</div>
              <button
                onClick={() => handleClick(n)}
                className="flex-1 min-w-0 text-left"
              >
                <p className={cn("text-sm", !n.is_read && "font-semibold")}>{n.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{n.message}</p>
                <p className="text-[11px] text-muted-foreground mt-1">{timeAgo(n.created_at)}</p>
              </button>
              <div className="flex items-center gap-2 shrink-0">
                {!n.is_read && <div className="w-2 h-2 rounded-full bg-primary" />}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                  onClick={(e) => { e.stopPropagation(); deleteNotification(n.id); }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
