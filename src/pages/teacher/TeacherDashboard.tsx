import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { apiClient } from '@/lib/apiClient';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import StatCard from '@/components/StatCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Users,
  GraduationCap,
  BookOpen,
  Calendar,
  Bell,
  FileText,
  MessageSquare,
  Clock,
  LayoutDashboard,
  Loader2,
  ClipboardList,
  CheckSquare,
  AlertCircle,
  FlaskConical,
} from 'lucide-react';

// Sidebar items from shared config with permission check
import { useTeacherSidebar } from '@/hooks/useTeacherSidebar';

interface DashboardStats {
  myClasses: number;
  totalStudents: number;
  pendingHomework: number;
  pendingAttendance: boolean;
}

interface TimetableEntry {
  id: number;
  start_time: string;
  end_time: string;
  day_of_week: string;
  classes: { name: string; section: string } | null;
  subjects: { name: string } | null;
}

interface UpcomingExam {
  id: number;
  name: string;
  exam_date: string;
  exam_time: string | null;
  max_marks: number | null;
  classes: { name: string; section: string } | null;
  subjects: { name: string } | null;
}

interface CompExam {
  id: number;
  exam_title: string;
  exam_date: string;
  exam_time: string;
  total_marks: number;
  exam_type_label: string | null;
  classes: { name: string; section: string } | null;
  subjects: { name: string } | null;
}

interface TeacherDashboardResponse {
  profileName: string;
  stats: DashboardStats;
  todaySchedule: TimetableEntry[];
  upcomingExams: UpcomingExam[];
  compExams: CompExam[];
}

export default function TeacherDashboard() {
  const teacherSidebarItems = useTeacherSidebar();
  const { user, userRole, loading } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats>({
    myClasses: 0,
    totalStudents: 0,
    pendingHomework: 0,
    pendingAttendance: true,
  });
  const [todaySchedule, setTodaySchedule] = useState<TimetableEntry[]>([]);
  const [upcomingExams, setUpcomingExams] = useState<UpcomingExam[]>([]);
  const [compExams, setCompExams] = useState<CompExam[]>([]);
  const [profileName, setProfileName] = useState('Teacher');
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    if (!loading && (!user || userRole !== 'teacher')) {
      navigate('/auth');
    }
  }, [user, userRole, loading, navigate]);

  useEffect(() => {
    async function fetchDashboardData() {
      if (!user) return;
      setLoadingStats(true);

      try {
        const data = await apiClient.get<TeacherDashboardResponse>('/teacher/dashboard');
        setProfileName(data.profileName || 'Teacher');
        setStats(data.stats || { myClasses: 0, totalStudents: 0, pendingHomework: 0, pendingAttendance: true });
        setTodaySchedule(data.todaySchedule || []);
        setUpcomingExams(data.upcomingExams || []);
        setCompExams(data.compExams || []);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoadingStats(false);
      }
    }

    fetchDashboardData();
  }, [user]);

  const formatTime = (time: string) => {
    if (!time) return '';
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <DashboardLayout sidebarItems={teacherSidebarItems} roleColor="teacher">
      <div className="space-y-4 sm:space-y-6 animate-fade-in">
        {/* Welcome Section */}
        <div className="rounded-xl sm:rounded-2xl p-4 sm:p-6 text-white" style={{ background: 'linear-gradient(135deg, #1a3628, #2a5040)' }}>
          <h1 className="font-display text-lg sm:text-2xl font-bold">
            {new Date().getHours() < 12 ? 'Good Morning' : new Date().getHours() < 17 ? 'Good Afternoon' : 'Good Evening'}, {profileName}!
          </h1>
          <p className="text-white/80 mt-1 text-xs sm:text-base">Ready for another day of inspiring young minds.</p>
        </div>

        {/* Stats Grid - compact on mobile */}
        <div className="sm:hidden">
          <Card className="card-elevated">
            <CardContent className="p-3">
              <div className="grid grid-cols-3 gap-2">
                <div className="text-center p-2 rounded-lg bg-muted/50">
                  <p className="text-lg font-bold">{loadingStats ? '...' : stats.myClasses}</p>
                  <p className="text-[10px] text-muted-foreground">Classes</p>
                </div>
                <div className="text-center p-2 rounded-lg bg-muted/50">
                  <p className="text-lg font-bold">{loadingStats ? '...' : stats.totalStudents}</p>
                  <p className="text-[10px] text-muted-foreground">Students</p>
                </div>
                <div className="text-center p-2 rounded-lg bg-muted/50">
                  <p className="text-lg font-bold">{loadingStats ? '...' : todaySchedule.length}</p>
                  <p className="text-[10px] text-muted-foreground">Today</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <div className="text-center p-2 rounded-lg bg-muted/50">
                  <p className="text-lg font-bold">{loadingStats ? '...' : stats.pendingHomework}</p>
                  <p className="text-[10px] text-muted-foreground">Homework</p>
                </div>
                <div className={`text-center p-2 rounded-lg ${stats.pendingAttendance ? 'bg-warning/10' : 'bg-success/10'}`}>
                  <p className="text-lg font-bold">{loadingStats ? '...' : (stats.pendingAttendance ? 'Pending' : 'Done')}</p>
                  <p className="text-[10px] text-muted-foreground">Attendance</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        <div className="hidden sm:grid sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <StatCard title="My Classes" value={loadingStats ? '...' : stats.myClasses.toString()} icon={<BookOpen className="h-6 w-6" />} />
          <StatCard title="Total Students" value={loadingStats ? '...' : stats.totalStudents.toString()} icon={<Users className="h-6 w-6" />} />
          <StatCard title="Today's Classes" value={loadingStats ? '...' : todaySchedule.length.toString()} icon={<Calendar className="h-6 w-6" />} />
          <StatCard title="Pending Homework" value={loadingStats ? '...' : stats.pendingHomework.toString()} icon={<FileText className="h-6 w-6" />} />
          <StatCard title="Attendance" value={loadingStats ? '...' : (stats.pendingAttendance ? 'Pending' : 'Done')} icon={<CheckSquare className="h-6 w-6" />} variant={stats.pendingAttendance ? 'secondary' : 'primary'} />
        </div>

        {/* Today's Schedule & Quick Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="card-elevated">
            <CardHeader>
              <CardTitle className="font-display flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                Today's Schedule
              </CardTitle>
            </CardHeader>
            <CardContent>
              {todaySchedule.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No classes scheduled for today</p>
                  <p className="text-sm mt-1">Check your timetable or contact admin</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {todaySchedule.map((schedule) => (
                    <div
                      key={schedule.id}
                      className="flex items-center gap-4 p-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors"
                    >
                      <div className="text-sm font-medium text-muted-foreground w-28">
                        {formatTime(schedule.start_time)} - {formatTime(schedule.end_time)}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">{schedule.subjects?.name || 'Subject'}</p>
                        <p className="text-sm text-muted-foreground">
                          {schedule.classes ? (schedule.classes.section ? `Class ${schedule.classes.name} - ${schedule.classes.section}` : `Class ${schedule.classes.name}`) : 'Class'}
                        </p>
                      </div>
                      <div className="w-2 h-2 rounded-full bg-primary" />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="card-elevated">
            <CardHeader>
              <CardTitle className="font-display flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-primary" />
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { icon: <Clock className="h-5 w-5" />, label: 'Mark Attendance', path: '/teacher/attendance' },
                  { icon: <BookOpen className="h-5 w-5" />, label: 'Add Homework', path: '/teacher/homework' },
                  { icon: <FileText className="h-5 w-5" />, label: 'Enter Marks', path: '/teacher/exams' },
                  { icon: <ClipboardList className="h-5 w-5" />, label: 'Student Report', path: '/teacher/reports' },
                  { icon: <Users className="h-5 w-5" />, label: 'Add Student', path: '/teacher/students' },
                  { icon: <MessageSquare className="h-5 w-5" />, label: 'Messages', path: '/teacher/messages' },
                ].map((action, index) => (
                  <button
                    key={index}
                    onClick={() => navigate(action.path)}
                    className="flex flex-col items-center gap-2 p-4 rounded-xl bg-muted/50 hover:bg-primary/10 hover:text-primary transition-colors"
                  >
                    {action.icon}
                    <span className="text-sm font-medium text-center">{action.label}</span>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Exam Timetable & Competitive Exam Reminders */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="card-elevated">
            <CardHeader>
              <CardTitle className="font-display flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                Upcoming Exam Timetable
              </CardTitle>
            </CardHeader>
            <CardContent>
              {upcomingExams.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No upcoming exams scheduled</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {upcomingExams.map((exam) => (
                    <div key={exam.id} className="flex items-center justify-between p-3 rounded-xl bg-muted/50">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{exam.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {exam.classes ? (exam.classes.section ? `Class ${exam.classes.name}-${exam.classes.section}` : `Class ${exam.classes.name}`) : ''} • {exam.subjects?.name || ''}
                        </p>
                      </div>
                      <div className="text-right ml-2 shrink-0">
                        <p className="text-xs font-medium">{new Date(exam.exam_date + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                        {exam.exam_time && <p className="text-xs text-muted-foreground">{exam.exam_time}</p>}
                        {exam.max_marks && <p className="text-[10px] text-muted-foreground">Max: {exam.max_marks}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="card-elevated">
            <CardHeader>
              <CardTitle className="font-display flex items-center gap-2">
                <FlaskConical className="h-5 w-5 text-primary" />
                Competitive Exam Reminders
              </CardTitle>
            </CardHeader>
            <CardContent>
              {compExams.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FlaskConical className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No upcoming competitive exams</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {compExams.map((exam) => {
                    const daysLeft = Math.ceil((new Date(exam.exam_date + 'T00:00:00').getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                    return (
                      <div key={exam.id} className="flex items-center justify-between p-3 rounded-xl bg-muted/50">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{exam.exam_title}</p>
                          <p className="text-xs text-muted-foreground">
                            {exam.exam_type_label?.toUpperCase()} • {exam.subjects?.name || ''} • {exam.classes ? (exam.classes.section ? `Class ${exam.classes.name}-${exam.classes.section}` : `Class ${exam.classes.name}`) : ''}
                          </p>
                        </div>
                        <Badge variant={daysLeft <= 3 ? 'destructive' : daysLeft <= 7 ? 'default' : 'secondary'} className="ml-2 shrink-0">
                          {daysLeft <= 0 ? 'Today' : `${daysLeft}d left`}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
