import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { apiClient } from '@/lib/apiClient';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { adminSidebarItems } from '@/config/adminSidebar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Download, Users, CheckCircle2, XCircle, Clock, FileText, FileSpreadsheet, TrendingUp, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { downloadAttendanceCSV, downloadAttendancePDF } from '@/utils/attendanceDownload';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, addMonths, subMonths, isSameDay, isToday } from 'date-fns';
import { BackButton } from '@/components/ui/back-button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

interface AttendanceRecord {
  id: number;
  student_id: number;
  date: string;
  status: string;
  session: string | null;
  reason: string | null;
  students?: { full_name: string; admission_number: string; classes?: { name: string; section: string } | null } | null;
}

export default function AttendanceManagement() {
  const { user, userRole, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [classes, setClasses] = useState<{ id: number; name: string; section: string }[]>([]);
  const [selectedClass, setSelectedClass] = useState<string>('all');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [loadingData, setLoadingData] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!loading && (!user || userRole !== 'admin')) {
      navigate('/auth');
    }
  }, [user, userRole, loading, navigate]);

  useEffect(() => { fetchClasses(); }, []);

  useEffect(() => {
    fetchMonthAttendance();
  }, [selectedClass, currentMonth]);

  const fetchClasses = async () => {
    try {
      const data = await apiClient.get<Array<{ id: number; name: string; section: string }>>('/classes');
      if (data) setClasses(data);
    } catch (error) {
      console.error('Failed to fetch classes', error);
    }
  };

  const fetchMonthAttendance = async () => {
    setLoadingData(true);
    const monthStart = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
    const monthEnd = format(endOfMonth(currentMonth), 'yyyy-MM-dd');

    try {
      const query = new URLSearchParams({ start: monthStart, end: monthEnd });
      if (selectedClass !== 'all') {
        query.set('class_id', selectedClass);
      }

      const data = await apiClient.get<AttendanceRecord[]>(`/attendance/report?${query.toString()}`);
      setAttendance(data || []);
    } catch (error) {
      console.error('Failed to fetch attendance report', error);
      setAttendance([]);
    }

    setLoadingData(false);
  };

  // Calendar data
  const monthDays = useMemo(() => {
    return eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) });
  }, [currentMonth]);

  const firstDayOffset = getDay(startOfMonth(currentMonth));

  const daySummaryMap = useMemo(() => {
    const map = new Map<string, { present: number; absent: number; late: number; total: number }>();
    attendance.forEach(a => {
      const existing = map.get(a.date) || { present: 0, absent: 0, late: 0, total: 0 };
      existing.total++;
      if (a.status === 'present') existing.present++;
      else if (a.status === 'absent') existing.absent++;
      else if (a.status === 'late') existing.late++;
      map.set(a.date, existing);
    });
    return map;
  }, [attendance]);

  const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');
  const dayRecords = useMemo(() => {
    let records = attendance.filter(a => a.date === selectedDateStr);
    if (searchQuery) {
      records = records.filter(a =>
        a.students?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.students?.admission_number?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    return records;
  }, [attendance, selectedDateStr, searchQuery]);

  const dayStats = useMemo(() => {
    const records = attendance.filter(a => a.date === selectedDateStr);
    return {
      total: records.length,
      present: records.filter(a => a.status === 'present').length,
      absent: records.filter(a => a.status === 'absent').length,
      late: records.filter(a => a.status === 'late').length,
    };
  }, [attendance, selectedDateStr]);

  const attendanceRate = dayStats.total > 0 ? Math.round(((dayStats.present + dayStats.late) / dayStats.total) * 100) : 0;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'present': return <Badge className="bg-success/10 text-success border-success/20 gap-1"><CheckCircle2 className="h-3 w-3" /> Present</Badge>;
      case 'absent': return <Badge className="bg-destructive/10 text-destructive border-destructive/20 gap-1"><XCircle className="h-3 w-3" /> Absent</Badge>;
      case 'late': return <Badge className="bg-warning/10 text-warning border-warning/20 gap-1"><Clock className="h-3 w-3" /> Late</Badge>;
      case 'half-day': return <Badge className="bg-primary/10 text-primary border-primary/20 gap-1">Half Day</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getDayColor = (day: Date) => {
    const dateStr = format(day, 'yyyy-MM-dd');
    const summary = daySummaryMap.get(dateStr);
    if (!summary || summary.total === 0) return 'bg-muted/20 text-muted-foreground';
    const rate = (summary.present + summary.late) / summary.total;
    if (rate >= 0.9) return 'bg-emerald-500 text-white';
    if (rate >= 0.7) return 'bg-amber-500 text-white';
    return 'bg-red-500 text-white';
  };

  const handleExportCSV = () => {
    const records = dayRecords.map(record => ({
      studentName: record.students?.full_name || 'N/A',
      admissionNumber: record.students?.admission_number || 'N/A',
      className: record.students?.classes ? (record.students.classes.section ? `${record.students.classes.name} - ${record.students.classes.section}` : record.students.classes.name) : 'N/A',
      date: format(new Date(record.date), 'MMM d, yyyy'),
      status: record.status,
      session: record.session || undefined,
      reason: record.reason || undefined,
    }));
    downloadAttendanceCSV(records, `attendance-${selectedDateStr}`);
    toast({ title: 'CSV downloaded', description: 'Attendance report saved.' });
  };

  const handleExportPDF = () => {
    const records = dayRecords.map(record => ({
      studentName: record.students?.full_name || 'N/A',
      admissionNumber: record.students?.admission_number || 'N/A',
      className: record.students?.classes ? (record.students.classes.section ? `${record.students.classes.name} - ${record.students.classes.section}` : record.students.classes.name) : 'N/A',
      date: format(new Date(record.date), 'MMM d, yyyy'),
      status: record.status,
      session: record.session || undefined,
      reason: record.reason || undefined,
    }));
    downloadAttendancePDF(records, `Attendance Report`, format(selectedDate, 'MMMM d, yyyy'));
    toast({ title: 'PDF downloaded', description: 'Attendance report with summary saved.' });
  };

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <DashboardLayout sidebarItems={adminSidebarItems} roleColor="admin">
      <div className="space-y-6 animate-fade-in">
        <BackButton to="/admin" />

        <div className="flex flex-col gap-1">
          <h1 className="font-display text-xl sm:text-2xl font-bold">Attendance Reports</h1>
          <p className="text-muted-foreground text-xs sm:text-sm">Click any date on the calendar to view attendance</p>
        </div>

        {/* Class Filter */}
        <Select value={selectedClass} onValueChange={setSelectedClass}>
          <SelectTrigger className="w-full sm:w-[220px]"><SelectValue placeholder="Select class" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Classes</SelectItem>
            {classes.map((c) => (
              <SelectItem key={c.id} value={String(c.id)}>{c.section ? `${c.name} - ${c.section}` : c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Calendar */}
          <Card className="card-elevated lg:col-span-1">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}><ChevronLeft className="h-4 w-4" /></Button>
                <CardTitle className="text-lg font-display">{format(currentMonth, 'MMMM yyyy')}</CardTitle>
                <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}><ChevronRight className="h-4 w-4" /></Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-7 gap-1">
                {weekDays.map(day => (
                  <div key={day} className="text-center text-xs font-medium text-muted-foreground py-2">{day}</div>
                ))}
                {Array.from({ length: firstDayOffset }).map((_, i) => (
                  <div key={`empty-${i}`} />
                ))}
                {monthDays.map(day => {
                  const dateStr = format(day, 'yyyy-MM-dd');
                  const summary = daySummaryMap.get(dateStr);
                  const isSelected = isSameDay(day, selectedDate);
                  const isTodayDate = isToday(day);
                  return (
                    <button
                      key={dateStr}
                      onClick={() => setSelectedDate(day)}
                      className={cn(
                        "aspect-square rounded-lg flex flex-col items-center justify-center text-sm transition-all",
                        getDayColor(day),
                        summary && summary.total > 0 ? 'cursor-pointer hover:opacity-80 shadow-sm' : '',
                        isSelected && 'ring-2 ring-primary ring-offset-2',
                        isTodayDate && !summary?.total && 'ring-2 ring-primary/50',
                      )}
                    >
                      <span className="font-medium">{format(day, 'd')}</span>
                      {summary && summary.total > 0 && (
                        <span className="text-[9px] opacity-80">{summary.total}</span>
                      )}
                    </button>
                  );
                })}
              </div>
              {/* Legend */}
              <div className="flex flex-wrap items-center gap-3 mt-4 pt-3 border-t">
                <div className="flex items-center gap-1.5 text-xs"><div className="w-3 h-3 rounded bg-emerald-500" /> ≥90%</div>
                <div className="flex items-center gap-1.5 text-xs"><div className="w-3 h-3 rounded bg-amber-500" /> 70-89%</div>
                <div className="flex items-center gap-1.5 text-xs"><div className="w-3 h-3 rounded bg-red-500" /> &lt;70%</div>
                <div className="flex items-center gap-1.5 text-xs"><div className="w-3 h-3 rounded bg-muted/40" /> No Data</div>
              </div>
            </CardContent>
          </Card>

          {/* Day Details Panel */}
          <div className="lg:col-span-2 space-y-4">
            {/* Day Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <Card className="card-elevated col-span-2 sm:col-span-1">
                <CardContent className="p-3 flex flex-col items-center gap-1">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  <p className="text-xl font-bold text-primary">{attendanceRate}%</p>
                  <p className="text-[10px] text-muted-foreground">Rate</p>
                </CardContent>
              </Card>
              <Card className="card-elevated">
                <CardContent className="p-3 flex flex-col items-center gap-1">
                  <Users className="h-4 w-4 text-foreground" />
                  <p className="text-xl font-bold">{dayStats.total}</p>
                  <p className="text-[10px] text-muted-foreground">Total</p>
                </CardContent>
              </Card>
              <Card className="card-elevated">
                <CardContent className="p-3 flex flex-col items-center gap-1">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  <p className="text-xl font-bold text-success">{dayStats.present}</p>
                  <p className="text-[10px] text-muted-foreground">Present</p>
                </CardContent>
              </Card>
              <Card className="card-elevated">
                <CardContent className="p-3 flex flex-col items-center gap-1">
                  <XCircle className="h-4 w-4 text-destructive" />
                  <p className="text-xl font-bold text-destructive">{dayStats.absent}</p>
                  <p className="text-[10px] text-muted-foreground">Absent</p>
                </CardContent>
              </Card>
              <Card className="card-elevated">
                <CardContent className="p-3 flex flex-col items-center gap-1">
                  <Clock className="h-4 w-4 text-warning" />
                  <p className="text-xl font-bold text-warning">{dayStats.late}</p>
                  <p className="text-[10px] text-muted-foreground">Late</p>
                </CardContent>
              </Card>
            </div>

            {/* Records Table */}
            <Card className="card-elevated">
              <CardHeader className="pb-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <CardTitle className="font-display text-lg flex items-center gap-2">
                    {format(selectedDate, 'EEEE, MMM d, yyyy')}
                    <Badge variant="secondary" className="text-xs">{dayRecords.length}</Badge>
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9 h-9 w-[180px]" />
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" disabled={dayRecords.length === 0}><Download className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={handleExportCSV}><FileSpreadsheet className="h-4 w-4 mr-2" /> CSV</DropdownMenuItem>
                        <DropdownMenuItem onClick={handleExportPDF}><FileText className="h-4 w-4 mr-2" /> PDF</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {loadingData ? (
                  <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
                ) : dayRecords.length === 0 ? (
                  <div className="text-center py-12 space-y-2">
                    <p className="font-medium text-foreground">No records</p>
                    <p className="text-sm text-muted-foreground">No attendance data for this date</p>
                  </div>
                ) : (
                  <>
                    {/* Mobile Cards */}
                    <div className="space-y-2 sm:hidden">
                      {dayRecords.map((record) => (
                        <div key={record.id} className="p-3 rounded-lg border bg-muted/10 flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-medium text-sm truncate">{record.students?.full_name || 'N/A'}</p>
                            <p className="text-[10px] text-muted-foreground font-mono">{record.students?.admission_number || 'N/A'}</p>
                            {record.students?.classes && (
                              <Badge variant="outline" className="text-[10px] mt-0.5">{record.students.classes.section ? `${record.students.classes.name}-${record.students.classes.section}` : record.students.classes.name}</Badge>
                            )}
                          </div>
                          <div className="shrink-0 flex flex-col items-end gap-1">
                            {getStatusBadge(record.status)}
                            {record.reason && <span className="text-[10px] text-muted-foreground">{record.reason}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                    {/* Desktop Table */}
                    <div className="overflow-x-auto rounded-lg border hidden sm:block">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/30">
                            <TableHead className="font-semibold">Student</TableHead>
                            <TableHead className="font-semibold">Adm No</TableHead>
                            <TableHead className="font-semibold">Class</TableHead>
                            <TableHead className="font-semibold">Status</TableHead>
                            <TableHead className="font-semibold">Reason</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {dayRecords.map((record) => (
                            <TableRow key={record.id} className="hover:bg-muted/20 transition-colors">
                              <TableCell className="font-medium">{record.students?.full_name || 'N/A'}</TableCell>
                              <TableCell className="font-mono text-sm text-muted-foreground">{record.students?.admission_number || 'N/A'}</TableCell>
                              <TableCell>
                                {record.students?.classes ? (
                                  <Badge variant="outline" className="font-normal">{record.students.classes.section ? `${record.students.classes.name}-${record.students.classes.section}` : record.students.classes.name}</Badge>
                                ) : 'N/A'}
                              </TableCell>
                              <TableCell>{getStatusBadge(record.status)}</TableCell>
                              <TableCell className="text-muted-foreground text-sm">{record.reason || '—'}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
