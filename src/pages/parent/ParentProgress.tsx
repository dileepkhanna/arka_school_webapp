import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { apiClient } from '@/lib/apiClient';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Loader2, TrendingUp, AlertCircle, Star, MessageSquare, Award, BookOpen, BarChart3 } from 'lucide-react';
import { parentSidebarItems } from '@/config/parentSidebar';
import StudentProgressView from '@/components/exams/StudentProgressView';

interface Report {
  id: string;
  category: string;
  description: string;
  severity: string | null;
  created_at: string;
}

interface ExamMark {
  id: string;
  marks_obtained: number | null;
  grade: string | null;
  remarks: string | null;
  exams: {
    name: string;
    exam_date: string | null;
    max_marks: number | null;
    subjects: { name: string } | null;
  } | null;
}

interface AttendanceSummary {
  total: number;
  present: number;
  absent: number;
  late: number;
}

interface ParentProgressResponse {
  childName: string;
  reports: Report[];
  marks: ExamMark[];
  attendance: AttendanceSummary;
}

export default function ParentProgress() {
  const { user, userRole, loading } = useAuth();
  const navigate = useNavigate();
  const [reports, setReports] = useState<Report[]>([]);
  const [marks, setMarks] = useState<ExamMark[]>([]);
  const [attendance, setAttendance] = useState<AttendanceSummary>({ total: 0, present: 0, absent: 0, late: 0 });
  const [childName, setChildName] = useState('');
  const [loadingData, setLoadingData] = useState(true);

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
        const data = await apiClient.get<ParentProgressResponse>('/parent/progress-data');
        setChildName(data.childName || '');
        setReports(data.reports || []);
        setMarks(data.marks || []);
        setAttendance(data.attendance || { total: 0, present: 0, absent: 0, late: 0 });
      } catch (error) {
        console.error('Error loading parent progress:', error);
        setChildName('');
        setReports([]);
        setMarks([]);
        setAttendance({ total: 0, present: 0, absent: 0, late: 0 });
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

  const attendancePercentage = attendance.total > 0 
    ? Math.round((attendance.present / attendance.total) * 100) 
    : 0;

  const getSeverityStyle = (severity: string | null) => {
    switch (severity?.toLowerCase()) {
      case 'positive': return { icon: <Star className="h-5 w-5 text-emerald-500" />, bg: 'bg-emerald-50 dark:bg-emerald-900/20', border: 'border-emerald-200 dark:border-emerald-800' };
      case 'negative': return { icon: <AlertCircle className="h-5 w-5 text-red-500" />, bg: 'bg-red-50 dark:bg-red-900/20', border: 'border-red-200 dark:border-red-800' };
      case 'concern': return { icon: <AlertCircle className="h-5 w-5 text-amber-500" />, bg: 'bg-amber-50 dark:bg-amber-900/20', border: 'border-amber-200 dark:border-amber-800' };
      default: return { icon: <MessageSquare className="h-5 w-5 text-blue-500" />, bg: 'bg-blue-50 dark:bg-blue-900/20', border: 'border-blue-200 dark:border-blue-800' };
    }
  };

  return (
    <DashboardLayout sidebarItems={parentSidebarItems} roleColor="parent">
      {isLoadingContent ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : (
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="font-display text-2xl font-bold">Progress Report</h1>
          <p className="text-muted-foreground">{childName}'s overall academic progress</p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-gradient-to-br from-primary/10 to-primary/5">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Attendance Rate</p>
                  <p className="text-2xl font-bold">{attendancePercentage}%</p>
                </div>
                <BarChart3 className="h-8 w-8 text-primary/50" />
              </div>
              <Progress value={attendancePercentage} className="mt-2 h-2" />
              <div className="flex justify-between text-xs text-muted-foreground mt-2">
                <span>Present: {attendance.present}</span>
                <span>Absent: {attendance.absent}</span>
                <span>Late: {attendance.late}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Exams Taken</p>
                  <p className="text-2xl font-bold">{marks.length}</p>
                </div>
                <BookOpen className="h-8 w-8 text-muted-foreground/50" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Teacher Reports</p>
                  <p className="text-2xl font-bold">{reports.length}</p>
                </div>
                <AlertCircle className="h-8 w-8 text-muted-foreground/50" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Teacher Reports */}
        {reports.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-primary" />
                Teacher Reports & Observations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {reports.slice(0, 5).map((report) => {
                  const style = getSeverityStyle(report.severity);
                  return (
                    <div key={report.id} className={`flex items-start gap-4 p-3 rounded-lg border ${style.bg} ${style.border}`}>
                      <div className="p-2 rounded-lg bg-background/80">{style.icon}</div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className="capitalize">{report.category}</Badge>
                          {report.severity && (
                            <Badge variant="secondary" className="capitalize">{report.severity}</Badge>
                          )}
                        </div>
                        <p className="text-sm">{report.description}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(report.created_at).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric'
                          })}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Exam Results */}
        <Card>
          <CardHeader className="px-3 sm:px-6">
            <CardTitle className="text-sm sm:text-base flex items-center gap-2">
              <Award className="h-4 w-4 text-primary" />
              Exam Results
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">Detailed examination performance</CardDescription>
          </CardHeader>
          <CardContent className="px-2 sm:px-6">
            <StudentProgressView marks={marks} studentName={childName} showAnalytics={true} />
          </CardContent>
        </Card>
      </div>
      )}
    </DashboardLayout>
  );
}
