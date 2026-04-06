import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { apiClient } from '@/lib/apiClient';
import { format } from 'date-fns';
import { toast } from 'sonner';
import {
  Users,
  Calendar as CalendarIcon,
  Loader2,
  Check,
  X,
  Save,
  Download,
  FileSpreadsheet,
  FileText,
  Clock,
  CheckCircle2,
  XCircle,
  TrendingUp,
  Search,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { downloadAttendanceCSV, downloadAttendancePDF } from '@/utils/attendanceDownload';
import { BackButton } from '@/components/ui/back-button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { useTeacherSidebar } from '@/hooks/useTeacherSidebar';

interface Student {
  id: string;
  full_name: string;
  admission_number: string;
  photo_url: string | null;
}

interface ClassOption {
  id: string;
  name: string;
  section: string;
}

export default function TeacherAttendance() {
  const teacherSidebarItems = useTeacherSidebar();
  const { user, userRole, loading } = useAuth();
  const navigate = useNavigate();
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [students, setStudents] = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<Record<string, 'present' | 'absent' | 'late'>>({});
  const [confirmed, setConfirmed] = useState<Set<string>>(new Set());
  const [loadingData, setLoadingData] = useState(true);
  const [saving, setSaving] = useState(false);
  const [teacherId, setTeacherId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!loading && (!user || userRole !== 'teacher')) {
      navigate('/auth');
    }
  }, [user, userRole, loading, navigate]);

  useEffect(() => {
    async function fetchClasses() {
      if (!user) return;

      try {
        const data = await apiClient.get<{
          teacher_id: string | null;
          classes: ClassOption[];
          students: Student[];
          attendance: Array<{ student_id: string; status: 'present' | 'absent' | 'late' }>;
        }>('/teacher/attendance-data');

        setTeacherId(data.teacher_id);
        setClasses(data.classes || []);
        if ((data.classes || []).length > 0 && !selectedClass) {
          setSelectedClass(data.classes[0].id);
        }
      } catch (error) {
        console.error('Error fetching classes:', error);
      } finally {
        setLoadingData(false);
      }
    }

    fetchClasses();
  }, [user]);

  useEffect(() => {
    async function fetchStudentsAndAttendance() {
      if (!selectedClass) return;

      setLoadingData(true);
      try {
        const dateStr = format(selectedDate, 'yyyy-MM-dd');
        const data = await apiClient.get<{
          students: Student[];
          attendance: Array<{ student_id: string; status: 'present' | 'absent' | 'late' }>;
        }>(`/teacher/attendance-data?class_id=${selectedClass}&date=${dateStr}`);

        const studentData = data.students || [];
        setStudents(studentData);

        const attendanceMap: Record<string, 'present' | 'absent' | 'late'> = {};
        const confirmedSet = new Set<string>();
        (data.attendance || []).forEach((a) => {
          attendanceMap[a.student_id] = a.status;
          confirmedSet.add(a.student_id);
        });
        studentData.forEach(s => {
          if (!attendanceMap[s.id]) {
            attendanceMap[s.id] = 'present';
          }
        });
        setAttendance(attendanceMap);
        setConfirmed(confirmedSet);
      } catch (error) {
        console.error('Error fetching students:', error);
      } finally {
        setLoadingData(false);
      }
    }

    fetchStudentsAndAttendance();
  }, [selectedClass, selectedDate]);

  const setStatus = async (studentId: string, status: 'present' | 'absent' | 'late') => {
    setAttendance(prev => ({ ...prev, [studentId]: status }));
    setConfirmed(prev => new Set(prev).add(studentId));
  };

  const markAllAs = (status: 'present' | 'absent' | 'late') => {
    const newAttendance: Record<string, 'present' | 'absent' | 'late'> = {};
    students.forEach(s => { newAttendance[s.id] = status; });
    setAttendance(newAttendance);
  };

  const saveAttendance = async () => {
    if (!teacherId) return;

    setSaving(true);
    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const records = students.map(student => ({
        student_id: student.id,
        status: attendance[student.id] || 'present',
      }));

      await apiClient.put('/teacher/attendance', { date: dateStr, records });
      toast.success('Attendance saved successfully');
    } catch (error) {
      console.error('Error saving attendance:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to save attendance');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const presentCount = Object.values(attendance).filter(s => s === 'present').length;
  const absentCount = Object.values(attendance).filter(s => s === 'absent').length;
  const lateCount = Object.values(attendance).filter(s => s === 'late').length;
  const totalStudents = students.length;
  const attendanceRate = totalStudents > 0 ? Math.round(((presentCount + lateCount) / totalStudents) * 100) : 0;

  const filteredStudents = searchQuery
    ? students.filter(s =>
      s.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.admission_number.toLowerCase().includes(searchQuery.toLowerCase())
    )
    : students;

  const handleExportCSV = () => {
    const currentClass = classes.find(c => c.id === selectedClass);
    const className = currentClass ? (currentClass.section ? `${currentClass.name}-${currentClass.section}` : currentClass.name) : 'Class';
    const records = students.map(student => ({
      studentName: student.full_name,
      admissionNumber: student.admission_number,
      className: className,
      date: format(selectedDate, 'MMM d, yyyy'),
      status: attendance[student.id] || 'present',
    }));
    downloadAttendanceCSV(records, `attendance-${className}-${format(selectedDate, 'yyyy-MM-dd')}`);
    toast.success('CSV downloaded');
  };

  const handleExportPDF = () => {
    const currentClass = classes.find(c => c.id === selectedClass);
    const className = currentClass ? (currentClass.section ? `${currentClass.name}-${currentClass.section}` : currentClass.name) : 'Class';
    const records = students.map(student => ({
      studentName: student.full_name,
      admissionNumber: student.admission_number,
      className: className,
      date: format(selectedDate, 'MMM d, yyyy'),
      status: attendance[student.id] || 'present',
    }));
    downloadAttendancePDF(records, `Attendance Report - ${className}`, format(selectedDate, 'MMMM d, yyyy'));
    toast.success('PDF downloaded');
  };

  return (
    <DashboardLayout sidebarItems={teacherSidebarItems} roleColor="teacher">
      <div className="space-y-6 animate-fade-in">
        <BackButton to="/teacher" />

        {/* Header */}
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-2xl font-bold">Mark Attendance</h1>
          <p className="text-muted-foreground text-sm">Select a class and date, then mark each student's status</p>
        </div>

        {/* Controls Bar */}
        <Card className="card-elevated">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <Select value={selectedClass} onValueChange={setSelectedClass}>
                <SelectTrigger className="sm:w-[200px]">
                  <SelectValue placeholder="Select Class" />
                </SelectTrigger>
                <SelectContent>
                  {classes.map((cls) => (
                    <SelectItem key={cls.id} value={cls.id}>
                      {cls.section ? `${cls.name} - ${cls.section}` : cls.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="sm:w-[200px] justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(selectedDate, 'PPP')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(date) => date && setSelectedDate(date)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <div className="relative flex-1 min-w-[180px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search student..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-5 gap-2 sm:gap-3">
          <Card className="card-elevated">
            <CardContent className="p-2 sm:p-4 flex flex-col items-center justify-center gap-0.5 sm:gap-1">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
              </div>
              <p className="text-lg sm:text-2xl font-bold text-primary">{attendanceRate}%</p>
              <p className="text-[9px] sm:text-xs text-muted-foreground font-medium">Rate</p>
            </CardContent>
          </Card>
          <Card className="card-elevated">
            <CardContent className="p-2 sm:p-4 flex flex-col items-center justify-center gap-0.5 sm:gap-1">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-muted flex items-center justify-center">
                <Users className="h-4 w-4 sm:h-5 sm:w-5 text-foreground" />
              </div>
              <p className="text-lg sm:text-2xl font-bold">{totalStudents}</p>
              <p className="text-[9px] sm:text-xs text-muted-foreground font-medium">Total</p>
            </CardContent>
          </Card>
          <Card className="card-elevated">
            <CardContent className="p-2 sm:p-4 flex flex-col items-center justify-center gap-0.5 sm:gap-1">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-success/10 flex items-center justify-center">
                <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-success" />
              </div>
              <p className="text-lg sm:text-2xl font-bold text-success">{presentCount}</p>
              <p className="text-[9px] sm:text-xs text-muted-foreground font-medium">Present</p>
            </CardContent>
          </Card>
          <Card className="card-elevated">
            <CardContent className="p-2 sm:p-4 flex flex-col items-center justify-center gap-0.5 sm:gap-1">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-destructive/10 flex items-center justify-center">
                <XCircle className="h-4 w-4 sm:h-5 sm:w-5 text-destructive" />
              </div>
              <p className="text-lg sm:text-2xl font-bold text-destructive">{absentCount}</p>
              <p className="text-[9px] sm:text-xs text-muted-foreground font-medium">Absent</p>
            </CardContent>
          </Card>
          <Card className="card-elevated">
            <CardContent className="p-2 sm:p-4 flex flex-col items-center justify-center gap-0.5 sm:gap-1">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-warning/10 flex items-center justify-center">
                <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-warning" />
              </div>
              <p className="text-lg sm:text-2xl font-bold text-warning">{lateCount}</p>
              <p className="text-[9px] sm:text-xs text-muted-foreground font-medium">Late</p>
            </CardContent>
          </Card>
        </div>

        {loadingData ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Loading students...</p>
          </div>
        ) : students.length === 0 ? (
          <Card className="card-elevated">
            <CardContent className="py-16 text-center space-y-3">
              <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto">
                <Users className="h-8 w-8 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium text-foreground">No students found</p>
                <p className="text-sm text-muted-foreground mt-1">No students are enrolled in this class yet.</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Quick Actions + Summary + Actions - all in one bar */}
            <Card className="card-elevated">
              <CardContent className="p-3 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">Quick mark all:</span>
                  <div className="flex items-center gap-1.5">
                    <Button size="sm" variant="outline" className="gap-1 h-8 px-2.5 text-xs text-success border-success/30 hover:bg-success/10" onClick={() => markAllAs('present')}>
                      <Check className="h-3 w-3" /> Present
                    </Button>
                    <Button size="sm" variant="outline" className="gap-1 h-8 px-2.5 text-xs text-destructive border-destructive/30 hover:bg-destructive/10" onClick={() => markAllAs('absent')}>
                      <X className="h-3 w-3" /> Absent
                    </Button>
                    <Button size="sm" variant="outline" className="gap-1 h-8 px-2.5 text-xs text-warning border-warning/30 hover:bg-warning/10" onClick={() => markAllAs('late')}>
                      <Clock className="h-3 w-3" /> Late
                    </Button>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2 pt-1 border-t">
                  <div className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{totalStudents}</span> students · <span className="text-success font-medium">{presentCount}</span> present · <span className="text-destructive font-medium">{absentCount}</span> absent · <span className="text-warning font-medium">{lateCount}</span> late
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="h-8 px-2.5" disabled={students.length === 0}>
                          <Download className="h-3.5 w-3.5 mr-1" />
                          <span className="text-xs">Export</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={handleExportCSV}>
                          <FileSpreadsheet className="h-4 w-4 mr-2" /> CSV
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={handleExportPDF}>
                          <FileText className="h-4 w-4 mr-2" /> PDF
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <Button onClick={saveAttendance} disabled={saving} size="sm" className="h-8 px-3 gap-1.5">
                      {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                      <span className="text-xs">Save</span>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Student List */}
            <Card className="card-elevated">
              <CardHeader className="pb-2">
                <CardTitle className="font-display text-lg flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  Students
                  <Badge variant="secondary" className="ml-1 text-xs">{filteredStudents.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3">
                <div className="space-y-1.5">
                  {filteredStudents.map((student, idx) => (
                    <div
                      key={student.id}
                      className={cn(
                        "flex items-center justify-between p-3 rounded-xl transition-all duration-200",
                        "hover:bg-muted/40",
                        idx % 2 === 0 ? "bg-muted/10" : ""
                      )}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar className="h-10 w-10 shrink-0">
                          <AvatarImage src={student.photo_url || ''} />
                          <AvatarFallback className="gradient-teacher text-white text-xs font-semibold">
                            {student.full_name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">{student.full_name}</p>
                          <p className="text-xs text-muted-foreground">{student.admission_number}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {confirmed.has(student.id) && attendance[student.id] !== 'present' ? null : (
                          <button
                            onClick={() => setStatus(student.id, 'present')}
                            className={cn(
                              "flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 border",
                              attendance[student.id] === 'present'
                                ? "bg-success/15 text-success border-success/30 shadow-sm"
                                : "bg-background text-muted-foreground border-border hover:bg-success/5 hover:text-success hover:border-success/20"
                            )}
                          >
                            <Check className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">Present</span>
                          </button>
                        )}
                        {confirmed.has(student.id) && attendance[student.id] !== 'absent' ? null : (
                          <button
                            onClick={() => setStatus(student.id, 'absent')}
                            className={cn(
                              "flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 border",
                              attendance[student.id] === 'absent'
                                ? "bg-destructive/15 text-destructive border-destructive/30 shadow-sm"
                                : "bg-background text-muted-foreground border-border hover:bg-destructive/5 hover:text-destructive hover:border-destructive/20"
                            )}
                          >
                            <X className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">Absent</span>
                          </button>
                        )}
                        {confirmed.has(student.id) && attendance[student.id] !== 'late' ? null : (
                          <button
                            onClick={() => setStatus(student.id, 'late')}
                            className={cn(
                              "flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 border",
                              attendance[student.id] === 'late'
                                ? "bg-warning/15 text-warning border-warning/30 shadow-sm"
                                : "bg-background text-muted-foreground border-border hover:bg-warning/5 hover:text-warning hover:border-warning/20"
                            )}
                          >
                            <Clock className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">Late</span>
                          </button>
                        )}
                        {confirmed.has(student.id) && (
                          <button
                            onClick={() => setConfirmed(prev => { const n = new Set(prev); n.delete(student.id); return n; })}
                            className="text-[10px] text-muted-foreground hover:text-foreground underline ml-1"
                          >
                            Change
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

          </>
        )}
      </div>
    </DashboardLayout>
  );
}
