import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { apiClient } from '@/lib/apiClient';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { adminSidebarItems } from '@/config/adminSidebar';
import StatCard from '@/components/StatCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Users,
  GraduationCap,
  BookOpen,
  Bell,
  Shield,
  Clock,
  Loader2,
  TrendingUp,
  FileText,
  FlaskConical,
  Calendar,
} from 'lucide-react';
import { format } from 'date-fns';

interface DashboardStats {
  totalStudents: number;
  totalTeachers: number;
  totalClasses: number;
  todayAttendanceRate: number;
  pendingLeaves: number;
  pendingCertificates: number;
  openComplaints: number;
}

interface DashboardApiResponse {
  students: number;
  teachers: number;
  classes: number;
  today_attendance_rate: number;
  pending_leave_requests: number;
  pending_certificate_requests: number;
  open_complaints: number;
  latest_announcements: Array<{ title: string; created_at: string }>;
}

interface UpcomingCompExam {
  id: string;
  exam_title: string;
  exam_date: string;
  exam_time: string;
  duration_minutes: number;
  total_marks: number;
  status: string;
  exam_type_label: string | null;
  classes?: { name: string; section: string } | null;
  subjects?: { name: string } | null;
}

interface TodayExam {
  id: string;
  name: string;
  exam_date: string | null;
  exam_time: string | null;
  max_marks: number | null;
  classes?: { name: string; section: string } | null;
  subjects?: { name: string } | null;
}

export default function AdminDashboard() {
  const { user, userRole, loading } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats>({
    totalStudents: 0,
    totalTeachers: 0,
    totalClasses: 0,
    todayAttendanceRate: 0,
    pendingLeaves: 0,
    pendingCertificates: 0,
    openComplaints: 0,
  });
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [upcomingCompExams, setUpcomingCompExams] = useState<UpcomingCompExam[]>([]);
  const [todayExams, setTodayExams] = useState<TodayExam[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);
  const [profileName, setProfileName] = useState('Principal');

  useEffect(() => {
    if (!loading && (!user || userRole !== 'admin')) {
      navigate('/auth');
    }
  }, [user, userRole, loading, navigate]);

  useEffect(() => {
    async function fetchDashboardData() {
      if (!user) return;
      setLoadingStats(true);

      try {
        if (user?.profile?.full_name) {
          setProfileName(user.profile.full_name.split(' ')[0]);
        }

        const data = await apiClient.get<DashboardApiResponse>('/dashboard/stats');

        setStats({
          totalStudents: data.students || 0,
          totalTeachers: data.teachers || 0,
          totalClasses: data.classes || 0,
          todayAttendanceRate: data.today_attendance_rate || 0,
          pendingLeaves: data.pending_leave_requests || 0,
          pendingCertificates: data.pending_certificate_requests || 0,
          openComplaints: data.open_complaints || 0,
        });

        setUpcomingCompExams([]);
        setTodayExams([]);

        const activities = (data.latest_announcements || []).map((a) => ({
          title: a.title,
          time: getTimeAgo(new Date(a.created_at)),
          type: 'info',
        }));
        setRecentActivity(activities);

      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoadingStats(false);
      }
    }

    fetchDashboardData();
  }, [user]);

  const getTimeAgo = (date: Date) => {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
    return `${Math.floor(seconds / 86400)} days ago`;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <DashboardLayout sidebarItems={adminSidebarItems} roleColor="admin">
      <div className="space-y-4 sm:space-y-6 animate-fade-in">
        {/* Welcome Section */}
        <div className="gradient-admin rounded-xl sm:rounded-2xl p-4 sm:p-6 text-white">
          <h1 className="font-display text-lg sm:text-2xl font-bold">Welcome back, {profileName}!</h1>
          <p className="text-white/80 mt-1 text-xs sm:text-base">Here's what's happening at your school today.</p>
        </div>

        {/* Stats Grid - compact on mobile */}
        <div className="sm:hidden">
          <Card className="card-elevated">
            <CardContent className="p-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="text-center p-2 rounded-lg bg-muted/50">
                  <GraduationCap className="h-4 w-4 mx-auto text-primary mb-1" />
                  <p className="text-lg font-bold">{loadingStats ? '...' : stats.totalStudents}</p>
                  <p className="text-[10px] text-muted-foreground uppercase">Students</p>
                </div>
                <div className="text-center p-2 rounded-lg bg-muted/50">
                  <Users className="h-4 w-4 mx-auto text-primary mb-1" />
                  <p className="text-lg font-bold">{loadingStats ? '...' : stats.totalTeachers}</p>
                  <p className="text-[10px] text-muted-foreground uppercase">Teachers</p>
                </div>
                <div className="text-center p-2 rounded-lg bg-muted/50">
                  <BookOpen className="h-4 w-4 mx-auto text-primary mb-1" />
                  <p className="text-lg font-bold">{loadingStats ? '...' : stats.totalClasses}</p>
                  <p className="text-[10px] text-muted-foreground uppercase">Classes</p>
                </div>
                <div className="text-center p-2 rounded-lg bg-primary/10">
                  <Clock className="h-4 w-4 mx-auto text-primary mb-1" />
                  <p className="text-lg font-bold text-primary">{loadingStats ? '...' : `${stats.todayAttendanceRate}%`}</p>
                  <p className="text-[10px] text-muted-foreground uppercase">Attendance</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        <div className="hidden sm:grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard title="Total Students" value={loadingStats ? '...' : stats.totalStudents.toString()} icon={<GraduationCap className="h-6 w-6" />} />
          <StatCard title="Total Teachers" value={loadingStats ? '...' : stats.totalTeachers.toString()} icon={<Users className="h-6 w-6" />} />
          <StatCard title="Classes" value={loadingStats ? '...' : stats.totalClasses.toString()} icon={<BookOpen className="h-6 w-6" />} />
          <StatCard title="Today's Attendance" value={loadingStats ? '...' : `${stats.todayAttendanceRate}%`} icon={<Clock className="h-6 w-6" />} variant="primary" />
        </div>

        {/* Quick Actions & Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="card-elevated">
            <CardHeader>
              <CardTitle className="font-display flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2 sm:gap-3">
                {[
                  { icon: <Users />, label: 'Add Teacher', path: '/admin/teachers' },
                  { icon: <GraduationCap />, label: 'View Students', path: '/admin/students' },
                  { icon: <Bell />, label: 'Announcement', path: '/admin/announcements' },
                  { icon: <FileText />, label: 'View Reports', path: '/admin/attendance' },
                ].map((action, index) => (
                  <button
                    key={index}
                    onClick={() => navigate(action.path)}
                    className="flex items-center gap-2 sm:gap-3 p-3 sm:p-4 rounded-xl bg-muted/50 hover:bg-muted transition-colors text-left"
                  >
                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                      {action.icon}
                    </div>
                    <span className="font-medium text-xs sm:text-sm">{action.label}</span>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="card-elevated">
            <CardHeader>
              <CardTitle className="font-display flex items-center gap-2">
                <Bell className="h-5 w-5 text-primary" />
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              {recentActivity.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No recent activity</p>
                  <p className="text-sm">Start by adding teachers and creating classes</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {recentActivity.map((activity, index) => (
                    <div key={index} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                      <div className="w-2 h-2 rounded-full bg-primary" />
                      <div className="flex-1">
                        <p className="text-sm font-medium">{activity.title}</p>
                        <p className="text-xs text-muted-foreground">{activity.time}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Pending Approvals */}
        <Card className="card-elevated">
          <CardHeader>
            <CardTitle className="font-display flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Pending Approvals
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
              <div className="p-3 sm:p-4 rounded-xl border bg-warning/5 border-warning/20">
                <div className="flex items-center justify-between mb-1 sm:mb-2">
                  <span className="text-xs sm:text-sm font-medium text-warning">Leave Requests</span>
                  <span className="text-xl sm:text-2xl font-bold text-warning">{stats.pendingLeaves}</span>
                </div>
                <p className="text-[10px] sm:text-xs text-muted-foreground">Pending approval</p>
              </div>
              <div className="p-3 sm:p-4 rounded-xl border bg-primary/5 border-primary/20">
                <div className="flex items-center justify-between mb-1 sm:mb-2">
                  <span className="text-xs sm:text-sm font-medium text-primary">Certificates</span>
                  <span className="text-xl sm:text-2xl font-bold text-primary">{stats.pendingCertificates}</span>
                </div>
                <p className="text-[10px] sm:text-xs text-muted-foreground">Pending approval</p>
              </div>
              <div className="p-3 sm:p-4 rounded-xl border bg-destructive/5 border-destructive/20">
                <div className="flex items-center justify-between mb-1 sm:mb-2">
                  <span className="text-xs sm:text-sm font-medium text-destructive">Complaints</span>
                  <span className="text-xl sm:text-2xl font-bold text-destructive">{stats.openComplaints}</span>
                </div>
                <p className="text-[10px] sm:text-xs text-muted-foreground">Unresolved</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Today's Exam Timetable & Upcoming Competitive Exams */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Today's Exam Timetable */}
          <Card className="card-elevated">
            <CardHeader>
              <CardTitle className="font-display flex items-center gap-2 text-base">
                <Calendar className="h-5 w-5 text-primary" />
                Upcoming Exam Schedule
              </CardTitle>
            </CardHeader>
            <CardContent>
              {todayExams.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No upcoming exams scheduled</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {todayExams.map(exam => (
                    <div key={exam.id} className="p-3 rounded-lg border bg-muted/20 space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-semibold text-sm truncate">{exam.name}</p>
                        <Badge variant="outline" className="text-xs shrink-0">Max: {exam.max_marks}</Badge>
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {exam.classes && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                            {exam.classes.name}-{exam.classes.section}
                          </Badge>
                        )}
                        {exam.subjects && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 capitalize">
                            {exam.subjects.name}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        {exam.exam_date && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(exam.exam_date + 'T00:00:00'), 'dd MMM yyyy')}
                          </span>
                        )}
                        {exam.exam_time && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" /> {exam.exam_time}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Upcoming Competitive Exams */}
          <Card className="card-elevated">
            <CardHeader>
              <CardTitle className="font-display flex items-center gap-2 text-base">
                <FlaskConical className="h-5 w-5 text-primary" />
                Upcoming Competitive Exams
              </CardTitle>
            </CardHeader>
            <CardContent>
              {upcomingCompExams.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  <FlaskConical className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No upcoming competitive exams</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {upcomingCompExams.map(exam => {
                    const examDate = new Date(exam.exam_date);
                    const daysLeft = Math.ceil((examDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                    return (
                      <div key={exam.id} className="p-3 rounded-lg border bg-muted/20 space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-semibold text-sm truncate">{exam.exam_title}</p>
                          <Badge
                            variant={daysLeft <= 3 ? 'destructive' : daysLeft <= 7 ? 'default' : 'secondary'}
                            className="text-[10px] px-1.5 py-0 shrink-0"
                          >
                            {daysLeft === 0 ? 'Today' : daysLeft === 1 ? 'Tomorrow' : `${daysLeft} days`}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {exam.exam_type_label && (
                            <Badge className="text-[10px] px-1.5 py-0 bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400">
                              {exam.exam_type_label}
                            </Badge>
                          )}
                          {exam.classes && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                              {exam.classes.name}-{exam.classes.section}
                            </Badge>
                          )}
                          {exam.subjects && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 capitalize">
                              {exam.subjects.name}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {format(examDate, 'dd MMM yyyy')}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" /> {exam.exam_time}
                          </span>
                          <span>Marks: {exam.total_marks}</span>
                        </div>
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
