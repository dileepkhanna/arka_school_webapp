import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { apiClient } from '@/lib/apiClient';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import StatCard from '@/components/StatCard';
import AttendanceSummary from '@/components/AttendanceSummary';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  User,
  GraduationCap,
  BookOpen,
  Calendar,
  Bell,
  FileText,
  Clock,
  Loader2,
  CreditCard,
  FlaskConical,
} from 'lucide-react';
import { format } from 'date-fns';
import { parentSidebarItems } from '@/config/parentSidebar';

interface ChildData {
  id: string;
  full_name: string;
  admission_number: string;
  photo_url: string | null;
  status: string | null;
  class_id: string | null;
  classes: { name: string; section: string } | null;
}

interface UpcomingCompExam {
  id: string;
  exam_title: string;
  exam_date: string;
  exam_time: string;
  total_marks: number;
  exam_type_label: string | null;
  classes?: { name: string; section: string } | null;
  subjects?: { name: string } | null;
}

interface TodayScheduleExam {
  id: string;
  name: string;
  exam_date: string | null;
  exam_time: string | null;
  max_marks: number | null;
  classes?: { name: string; section: string } | null;
  subjects?: { name: string } | null;
}

interface DashboardAnnouncement {
  id: string;
  title: string;
  created_at: string;
}

interface ParentDashboardResponse {
  children: ChildData[];
  announcements: DashboardAnnouncement[];
  upcomingCompExams: UpcomingCompExam[];
  todayExams: TodayScheduleExam[];
  pendingHomework: number;
  upcomingExamCount: number;
  pendingFees: number;
}

export default function ParentDashboard() {
  const { user, userRole, loading } = useAuth();
  const navigate = useNavigate();
  const [children, setChildren] = useState<ChildData[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [announcements, setAnnouncements] = useState<DashboardAnnouncement[]>([]);
  const [upcomingCompExams, setUpcomingCompExams] = useState<UpcomingCompExam[]>([]);
  const [todayExams, setTodayExams] = useState<TodayScheduleExam[]>([]);
  const [pendingHomework, setPendingHomework] = useState(0);
  const [upcomingExamCount, setUpcomingExamCount] = useState(0);
  const [pendingFees, setPendingFees] = useState(0);

  useEffect(() => {
    if (!loading && (!user || userRole !== 'parent')) {
      navigate('/auth');
    }
  }, [user, userRole, loading, navigate]);

  useEffect(() => {
    async function fetchData() {
      if (!user) return;
      setLoadingData(true);

      try {
        const data = await apiClient.get<ParentDashboardResponse>('/parent/dashboard');
        setChildren(data.children || []);
        setAnnouncements(data.announcements || []);
        setUpcomingCompExams(data.upcomingCompExams || []);
        setTodayExams(data.todayExams || []);
        setPendingHomework(data.pendingHomework || 0);
        setUpcomingExamCount(data.upcomingExamCount || 0);
        setPendingFees(data.pendingFees || 0);

      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoadingData(false);
      }
    }

    fetchData();
  }, [user]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  const isLoadingContent = loadingData;

  return (
    <DashboardLayout sidebarItems={parentSidebarItems} roleColor="parent">
      {isLoadingContent ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : (
        <div className="space-y-4 sm:space-y-6 animate-fade-in">
          {/* Welcome Section */}
          <div className="gradient-parent rounded-xl sm:rounded-2xl p-4 sm:p-6 text-white">
            <h1 className="font-display text-lg sm:text-2xl font-bold">Welcome, Parent!</h1>
            <p className="text-white/80 mt-1 text-xs sm:text-base">Stay connected with your child's educational journey.</p>
          </div>

          {/* Children Profiles */}
          {children.length === 0 ? (
            <Card className="card-elevated">
              <CardContent className="py-8 sm:py-12 text-center">
                <User className="h-10 w-10 sm:h-12 sm:w-12 mx-auto text-muted-foreground mb-3 sm:mb-4" />
                <p className="text-muted-foreground text-sm">No children linked to your account yet.</p>
                <p className="text-xs text-muted-foreground mt-1">Please contact the school administration.</p>
              </CardContent>
            </Card>
          ) : (
            children.map((child) => (
              <div key={child.id} className="space-y-4">
                {/* Child Profile Card */}
                <Card className="card-elevated">
                  <CardContent className="p-4 sm:pt-6 sm:p-6">
                    <div className="flex items-center gap-4 sm:flex-row sm:gap-6">
                      <Avatar className="h-16 w-16 sm:h-24 sm:w-24 ring-4 ring-accent/20 ring-offset-2 shrink-0">
                        <AvatarImage src={child.photo_url || ''} />
                        <AvatarFallback className="gradient-parent text-white text-lg sm:text-2xl">
                          {child.full_name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <h2 className="font-display text-base sm:text-xl font-bold truncate">{child.full_name}</h2>
                        <p className="text-xs sm:text-sm text-muted-foreground">
                          {child.classes ? (child.classes.section ? `Class ${child.classes.name} - ${child.classes.section}` : `Class ${child.classes.name}`) : 'No class assigned'}
                        </p>
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          <Badge className={`text-[10px] sm:text-xs ${child.status === 'active' ? 'status-active' : 'status-inactive'}`}>
                            {child.status || 'Active'}
                          </Badge>
                          <Badge variant="outline" className="text-[10px] sm:text-xs">
                            <GraduationCap className="h-3 w-3 mr-1" />
                            {child.admission_number}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <AttendanceSummary studentId={child.id} />
              </div>
            ))
          )}

          {/* Stats Grid - compact on mobile */}
          <div className="sm:hidden">
            <Card className="card-elevated">
              <CardContent className="p-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="text-center p-2 rounded-lg bg-muted/50">
                    <p className="text-lg font-bold">{children.length}</p>
                    <p className="text-[10px] text-muted-foreground uppercase">Children</p>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-muted/50">
                    <p className="text-lg font-bold">{pendingHomework}</p>
                    <p className="text-[10px] text-muted-foreground uppercase">Homework</p>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-muted/50">
                    <p className="text-lg font-bold">{upcomingExamCount}</p>
                    <p className="text-[10px] text-muted-foreground uppercase">Exams</p>
                  </div>
                  <div className={`text-center p-2 rounded-lg ${pendingFees > 0 ? 'bg-destructive/10' : 'bg-muted/50'}`}>
                    <p className={`text-lg font-bold ${pendingFees > 0 ? 'text-destructive' : ''}`}>{pendingFees}</p>
                    <p className="text-[10px] text-muted-foreground uppercase">Unpaid Fees</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          <div className="hidden sm:grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard title="Children" value={children.length.toString()} icon={<User className="h-6 w-6" />} />
            <StatCard title="Pending Homework" value={pendingHomework.toString()} icon={<BookOpen className="h-6 w-6" />} />
            <StatCard title="Upcoming Exams" value={upcomingExamCount.toString()} icon={<FileText className="h-6 w-6" />} />
            <StatCard title="Unpaid Fees" value={pendingFees.toString()} icon={<CreditCard className="h-6 w-6" />} variant={pendingFees > 0 ? 'accent' : 'default'} />
          </div>

          {/* Today's Exam Schedule & Upcoming Competitive Exams */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Today's Exam Schedule */}
            <Card className="card-elevated">
              <CardHeader className="pb-3">
                <CardTitle className="font-display flex items-center gap-2 text-base">
                  <Calendar className="h-5 w-5 text-primary" />
                  Upcoming Exam Schedule
                </CardTitle>
              </CardHeader>
              <CardContent>
                {todayExams.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground">
                    <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No upcoming exams</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {todayExams.map(exam => (
                      <div key={exam.id} className="p-3 rounded-lg border bg-muted/20 space-y-1.5">
                        <p className="font-semibold text-sm">{exam.name}</p>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {exam.classes && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                              {exam.classes.section ? `${exam.classes.name}-${exam.classes.section}` : exam.classes.name}
                            </Badge>
                          )}
                          {exam.subjects && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 capitalize">
                              {exam.subjects.name}
                            </Badge>
                          )}
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 ml-auto">Max: {exam.max_marks}</Badge>
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
              <CardHeader className="pb-3">
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

          {/* Announcements */}
          <Card className="card-elevated">
            <CardHeader>
              <CardTitle className="font-display flex items-center gap-2">
                <Bell className="h-5 w-5 text-accent" />
                Recent Announcements
              </CardTitle>
            </CardHeader>
            <CardContent>
              {announcements.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">No announcements yet.</p>
              ) : (
                <div className="space-y-4">
                  {announcements.map((announcement) => (
                    <div
                      key={announcement.id}
                      className="flex items-start gap-3 p-3 rounded-xl bg-muted/50"
                    >
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-accent/10 text-accent">
                        <Bell className="h-4 w-4" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-sm">{announcement.title}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(announcement.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </DashboardLayout>
  );
}
