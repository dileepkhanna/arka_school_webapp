import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { apiClient } from '@/lib/apiClient';
import { toast } from 'sonner';
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
  FlaskConical,
} from 'lucide-react';
import ExamMarksEntry from '@/components/exams/ExamMarksEntry';
import WeeklyExamMarksEntry from '@/components/exams/WeeklyExamMarksEntry';
import ExamScheduleView from '@/components/exams/ExamScheduleView';
import ExamResultsView from '@/components/exams/ExamResultsView';
import StudentProgressView from '@/components/exams/StudentProgressView';
import { BackButton } from '@/components/ui/back-button';

// Sidebar items from shared config with permission check
import { useTeacherSidebar } from '@/hooks/useTeacherSidebar';

interface Exam {
  id: string;
  name: string;
  max_marks: number;
  class_id: string;
  subject_id: string | null;
  exam_date: string | null;
  classes?: { name: string; section: string };
  subjects?: { name: string };
}

interface TeacherExamsDataResponse {
  exams: Exam[];
  classes: ClassOption[];
  students: Student[];
}

interface ClassOption {
  id: string;
  name: string;
  section: string;
}

interface Student {
  id: string;
  full_name: string;
  admission_number: string;
  class_id: string;
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

export default function TeacherExams() {
  const teacherSidebarItems = useTeacherSidebar();
  const { user, userRole, loading } = useAuth();
  const navigate = useNavigate();
  const [exams, setExams] = useState<Exam[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [activeTab, setActiveTab] = useState('enter');

  // View results state
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [selectedStudent, setSelectedStudent] = useState<string>('');
  const [studentMarks, setStudentMarks] = useState<ExamMark[]>([]);
  const [loadingMarks, setLoadingMarks] = useState(false);

  useEffect(() => {
    if (!loading && (!user || userRole !== 'teacher')) {
      navigate('/auth');
    }
  }, [user, userRole, loading, navigate]);

  const fetchData = async () => {
    if (!user) return;
    setLoadingData(true);

    try {
      const data = await apiClient.get<TeacherExamsDataResponse>('/teacher/exams-data');
      setClasses(data.classes || []);
      setExams((data.exams || []) as Exam[]);
      setStudents(data.students || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  const fetchStudentMarks = async (studentId: string) => {
    setLoadingMarks(true);
    try {
      const data = await apiClient.get<ExamMark[]>(`/students/${studentId}/exam-marks`);

      if (data) setStudentMarks(data as ExamMark[]);
    } catch (error) {
      console.error('Error fetching marks:', error);
      toast.error('Failed to load student marks');
    } finally {
      setLoadingMarks(false);
    }
  };

  const handleStudentSelect = (studentId: string) => {
    setSelectedStudent(studentId);
    if (studentId) {
      fetchStudentMarks(studentId);
    } else {
      setStudentMarks([]);
    }
  };

  const filteredStudents = selectedClass
    ? students.filter(s => s.class_id === selectedClass)
    : students;

  const selectedStudentData = students.find(s => s.id === selectedStudent);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <DashboardLayout sidebarItems={teacherSidebarItems} roleColor="teacher">
      <div className="space-y-3 sm:space-y-6 animate-fade-in px-0">
        <BackButton to="/teacher" />
        <div>
          <h1 className="font-display text-lg sm:text-2xl font-bold">Exam Marks</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">Enter and view student exam results</p>
        </div>

        {loadingData ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : exams.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No exams found.</p>
              <p className="text-sm text-muted-foreground mt-1">Please ask admin to create exams first.</p>
            </CardContent>
          </Card>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-5 h-10 sm:h-10 p-1">
              <TabsTrigger value="schedule" className="flex items-center justify-center gap-1.5 text-[11px] sm:text-sm px-1 sm:px-3 data-[state=active]:shadow-sm">
                <Calendar className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                <span className="hidden sm:inline">Schedule</span>
              </TabsTrigger>
              <TabsTrigger value="enter" className="flex items-center justify-center gap-1.5 text-[11px] sm:text-sm px-1 sm:px-3 data-[state=active]:shadow-sm">
                <ClipboardList className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                <span className="hidden sm:inline">Marks</span>
              </TabsTrigger>
              <TabsTrigger value="weekly-marks" className="flex items-center justify-center gap-1.5 text-[11px] sm:text-sm px-1 sm:px-3 data-[state=active]:shadow-sm">
                <FlaskConical className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                <span className="hidden sm:inline">W.Marks</span>
              </TabsTrigger>
              <TabsTrigger value="results" className="flex items-center justify-center gap-1.5 text-[11px] sm:text-sm px-1 sm:px-3 data-[state=active]:shadow-sm">
                <FileText className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                <span className="hidden sm:inline">Results</span>
              </TabsTrigger>
              <TabsTrigger value="view" className="flex items-center justify-center gap-1.5 text-[11px] sm:text-sm px-1 sm:px-3 data-[state=active]:shadow-sm">
                <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                <span className="hidden sm:inline">Student</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="schedule" className="mt-3 sm:mt-4">
              <ExamScheduleView />
            </TabsContent>

            <TabsContent value="enter" className="mt-3 sm:mt-4">
              <ExamMarksEntry exams={exams} onMarksUpdated={fetchData} />
            </TabsContent>

            <TabsContent value="weekly-marks" className="mt-3 sm:mt-4">
              <WeeklyExamMarksEntry />
            </TabsContent>

            <TabsContent value="results" className="mt-3 sm:mt-4">
              <ExamResultsView />
            </TabsContent>

            <TabsContent value="view" className="mt-3 sm:mt-4 space-y-3 sm:space-y-4">
              {/* Student Selection */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">View Student Progress</CardTitle>
                  <CardDescription>Select a student to view their exam results</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Filter by Class</label>
                      <Select value={selectedClass || 'all'} onValueChange={(v) => setSelectedClass(v === 'all' ? '' : v)}>
                        <SelectTrigger>
                          <SelectValue placeholder="All classes" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Classes</SelectItem>
                          {classes.map((cls) => (
                            <SelectItem key={cls.id} value={cls.id}>
                              {cls.section ? `Class ${cls.name}-${cls.section.toUpperCase()}` : `Class ${cls.name}`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Select Student</label>
                      <Select value={selectedStudent} onValueChange={handleStudentSelect}>
                        <SelectTrigger>
                          <SelectValue placeholder="Choose a student" />
                        </SelectTrigger>
                        <SelectContent>
                          {filteredStudents.map((student) => (
                            <SelectItem key={student.id} value={student.id}>
                              {student.full_name} ({student.admission_number})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Student Progress */}
              {loadingMarks ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : selectedStudent ? (
                <StudentProgressView
                  marks={studentMarks}
                  studentName={selectedStudentData?.full_name || ''}
                />
              ) : (
                <Card>
                  <CardContent className="py-12 text-center">
                    <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">Select a student to view their results</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>
    </DashboardLayout>
  );
}
