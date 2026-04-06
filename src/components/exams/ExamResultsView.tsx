import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Search, Download, Users, Award, BarChart3, BookOpen, FlaskConical } from 'lucide-react';
import { apiClient } from '@/lib/apiClient';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ExamResult {
  id: string;
  marks_obtained: number | null;
  grade: string | null;
  remarks: string | null;
  student_id: string;
  exam_id: string;
  students: { full_name: string; admission_number: string; class_id: string | null } | null;
  exams: { name: string; exam_date: string | null; max_marks: number | null; class_id: string | null; subjects: { name: string } | null; classes: { name: string; section: string } | null } | null;
}

interface WeeklyExamResult {
  id: string;
  obtained_marks: number;
  total_marks: number;
  percentage: number | null;
  rank: number | null;
  student_id: string;
  exam_id: string;
  students: { full_name: string; admission_number: string; class_id: string | null } | null;
  weekly_exams: {
    exam_title: string;
    exam_date: string;
    total_marks: number;
    syllabus_type: string;
    exam_type_label: string | null;
    class_id: string;
    subjects: { name: string } | null;
    classes: { name: string; section: string } | null;
  } | null;
}

interface ClassOption { id: string; name: string; section: string }

export default function ExamResultsView() {
  const [results, setResults] = useState<ExamResult[]>([]);
  const [weeklyResults, setWeeklyResults] = useState<WeeklyExamResult[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedExamName, setSelectedExamName] = useState('all');
  const [selectedClass, setSelectedClass] = useState('all');
  const [selectedStudent, setSelectedStudent] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'report'>('table');
  const [resultsTab, setResultsTab] = useState('regular');

  // Weekly filters
  const [weeklyClassFilter, setWeeklyClassFilter] = useState('all');
  const [weeklyTypeFilter, setWeeklyTypeFilter] = useState('all');
  const [weeklySearchQuery, setWeeklySearchQuery] = useState('');
  const [weeklyExamNameFilter, setWeeklyExamNameFilter] = useState('all');
  const [weeklyDateFilter, setWeeklyDateFilter] = useState('all');
  const [allWeeklyExams, setAllWeeklyExams] = useState<{ id: string; exam_title: string; syllabus_type: string; class_id: string; exam_type_label: string | null }[]>([]);
  const [weeklyExamTypeLabelFilter, setWeeklyExamTypeLabelFilter] = useState('all');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const data = await apiClient.get<{
        results: ExamResult[];
        weeklyResults: WeeklyExamResult[];
        classes: ClassOption[];
        allWeeklyExams: { id: string; exam_title: string; syllabus_type: string; class_id: string; exam_type_label: string | null }[];
      }>('/exams/results-data');

      setResults((data.results || []) as unknown as ExamResult[]);
      setWeeklyResults((data.weeklyResults || []) as unknown as WeeklyExamResult[]);
      setClasses(data.classes || []);
      setAllWeeklyExams(data.allWeeklyExams || []);
    } catch (error) {
      console.error('Failed to fetch exam results data', error);
      setResults([]);
      setWeeklyResults([]);
      setClasses([]);
      setAllWeeklyExams([]);
    }

    setLoading(false);
  };

  // === Regular exam logic ===
  const examNames = useMemo(() => [...new Set(results.map(r => r.exams?.name).filter(Boolean))], [results]);

  // Show results only when all filters are selected
  const isRegularFilterActive = selectedExamName !== 'all' && selectedClass !== 'all' && (selectedStudent !== 'all' || searchQuery.trim() !== '');
  const isWeeklyFilterActive = weeklyExamNameFilter !== 'all' && weeklyClassFilter !== 'all' && (weeklyDateFilter !== 'all' || weeklySearchQuery.trim() !== '');

  const filteredResults = useMemo(() => {
    return results.filter(r => {
      const matchesExam = selectedExamName === 'all' || r.exams?.name === selectedExamName;
      const matchesClass = selectedClass === 'all' || r.exams?.class_id === selectedClass;
      const matchesStudent = selectedStudent === 'all' || r.student_id === selectedStudent;
      const matchesSearch = !searchQuery ||
        r.students?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.students?.admission_number?.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesExam && matchesClass && matchesStudent && matchesSearch;
    });
  }, [results, selectedExamName, selectedClass, selectedStudent, searchQuery]);

  const uniqueStudents = useMemo(() => {
    const studentMap = new Map<string, { id: string; name: string; admission: string }>();
    const filtered = results.filter(r => {
      const matchesClass = selectedClass === 'all' || r.exams?.class_id === selectedClass;
      return matchesClass && r.students;
    });
    filtered.forEach(r => {
      if (r.students && !studentMap.has(r.student_id)) {
        studentMap.set(r.student_id, { id: r.student_id, name: r.students.full_name, admission: r.students.admission_number });
      }
    });
    return Array.from(studentMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [results, selectedClass]);

  const reportCardData = useMemo(() => {
    if (selectedStudent === 'all') return null;
    const studentResults = filteredResults.filter(r => r.student_id === selectedStudent);
    const grouped: Record<string, ExamResult[]> = {};
    studentResults.forEach(r => {
      const examName = r.exams?.name || 'Unknown';
      if (!grouped[examName]) grouped[examName] = [];
      grouped[examName].push(r);
    });

    const student = studentResults[0]?.students;
    const totalMarks = studentResults.reduce((sum, r) => sum + (r.marks_obtained || 0), 0);
    const totalMax = studentResults.reduce((sum, r) => sum + (r.exams?.max_marks || 100), 0);
    const overallPct = totalMax > 0 ? (totalMarks / totalMax) * 100 : 0;

    return { grouped, student, totalMarks, totalMax, overallPct, count: studentResults.length };
  }, [filteredResults, selectedStudent]);

  // === Weekly/Competitive exam logic ===
  const filteredWeeklyResults = useMemo(() => {
    return weeklyResults.filter(r => {
      if (weeklyTypeFilter !== 'all' && r.weekly_exams?.syllabus_type !== weeklyTypeFilter) return false;
      if (weeklyClassFilter !== 'all' && r.weekly_exams?.class_id !== weeklyClassFilter) return false;
      if (weeklyExamNameFilter !== 'all' && r.weekly_exams?.exam_title !== weeklyExamNameFilter) return false;
      if (weeklyExamTypeLabelFilter !== 'all' && r.weekly_exams?.exam_type_label !== weeklyExamTypeLabelFilter) return false;
      if (weeklyDateFilter !== 'all' && r.weekly_exams?.exam_date !== weeklyDateFilter) return false;
      if (weeklySearchQuery) {
        const q = weeklySearchQuery.toLowerCase();
        const matchName = r.students?.full_name?.toLowerCase().includes(q);
        const matchAdm = r.students?.admission_number?.toLowerCase().includes(q);
        const matchExam = r.weekly_exams?.exam_title?.toLowerCase().includes(q);
        if (!matchName && !matchAdm && !matchExam) return false;
      }
      return true;
    });
  }, [weeklyResults, weeklyTypeFilter, weeklyClassFilter, weeklySearchQuery, weeklyExamNameFilter, weeklyDateFilter, weeklyExamTypeLabelFilter]);

  const weeklyExamDates = useMemo(() => [...new Set(weeklyResults.map(r => r.weekly_exams?.exam_date).filter(Boolean))].sort(), [weeklyResults]);

  // === Shared helpers ===
  const getGradeColor = (grade: string | null) => {
    if (!grade) return 'bg-muted text-muted-foreground';
    const g = grade.toUpperCase();
    if (g === 'A+' || g === 'A') return 'bg-emerald-500 text-white';
    if (g === 'B+' || g === 'B') return 'bg-blue-500 text-white';
    if (g === 'C+' || g === 'C') return 'bg-amber-500 text-white';
    return 'bg-red-500 text-white';
  };

  const getPctColor = (pct: number) => {
    if (pct >= 80) return 'text-emerald-600';
    if (pct >= 60) return 'text-blue-600';
    if (pct >= 40) return 'text-amber-600';
    return 'text-red-600';
  };

  const handleDownload = (dataType: 'regular' | 'weekly', typeResultsData?: WeeklyExamResult[]) => {
    let sheetData: Record<string, string | number>[] = [];
    let filename = '';

    if (dataType === 'regular') {
      filename = 'Exam_Results';
      sheetData = filteredResults.map(r => {
        const pct = r.marks_obtained && r.exams?.max_marks ? ((r.marks_obtained / r.exams.max_marks) * 100).toFixed(1) : '0';
        const cls = r.exams?.classes ? (r.exams.classes.section ? `${r.exams.classes.name} - ${r.exams.classes.section.toUpperCase()}` : r.exams.classes.name) : '-';
        return {
          'Student': r.students?.full_name || '-',
          'Adm No': r.students?.admission_number || '-',
          'Exam': r.exams?.name || '-',
          'Subject': r.exams?.subjects?.name || '-',
          'Class': cls,
          'Marks Obtained': r.marks_obtained ?? 0,
          'Max Marks': r.exams?.max_marks ?? 100,
          'Percentage': `${pct}%`,
          'Grade': r.grade || '-',
        };
      });
    } else {
      const data = typeResultsData || [];
      filename = 'Weekly_Exam_Results';
      sheetData = data.map(r => {
        const pct = r.percentage?.toFixed(1) || '0';
        const cls = r.weekly_exams?.classes ? (r.weekly_exams.classes.section ? `${r.weekly_exams.classes.name} - ${r.weekly_exams.classes.section.toUpperCase()}` : r.weekly_exams.classes.name) : '-';
        return {
          'Student': r.students?.full_name || '-',
          'Adm No': r.students?.admission_number || '-',
          'Exam': r.weekly_exams?.exam_title || '-',
          'Subject': r.weekly_exams?.subjects?.name || '-',
          'Class': cls,
          'Marks Obtained': r.obtained_marks,
          'Total Marks': r.total_marks,
          'Percentage': `${pct}%`,
          'Rank': r.rank || '-',
        };
      });
    }

    if (sheetData.length === 0) { toast.error('No data to download'); return; }

    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text(filename.replace(/_/g, ' '), 14, 18);
    doc.setFontSize(9);
    doc.text(`Generated: ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}`, 14, 25);

    const headers = Object.keys(sheetData[0]);
    autoTable(doc, {
      startY: 30,
      head: [headers],
      body: sheetData.map(row => headers.map(h => String(row[h] ?? '-'))),
      styles: { fontSize: 7 },
      headStyles: { fillColor: [59, 130, 246] },
    });

    doc.save(`${filename}_${new Date().toISOString().split('T')[0]}.pdf`);
    toast.success('PDF downloaded!');
  };

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-4">
      {/* Results Type Tabs */}
      <Tabs value={resultsTab} onValueChange={(v) => { setResultsTab(v); }}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="regular" className="flex items-center gap-1.5 text-xs sm:text-sm">
            <BookOpen className="h-4 w-4" />
            Regular Exams
          </TabsTrigger>
          <TabsTrigger value="weekly" className="flex items-center gap-1.5 text-xs sm:text-sm">
            <BarChart3 className="h-4 w-4" />
            Weekly Exams
          </TabsTrigger>
          <TabsTrigger value="competitive" className="flex items-center gap-1.5 text-xs sm:text-sm">
            <FlaskConical className="h-4 w-4" />
            Competitive
          </TabsTrigger>
        </TabsList>

        {/* Regular Exam Results */}
        <TabsContent value="regular" className="space-y-4 mt-4">
          {/* Filters */}
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex flex-col gap-3">
                <div className="flex flex-col sm:flex-row flex-1 gap-2">
                  <Select value={selectedExamName} onValueChange={setSelectedExamName}>
                    <SelectTrigger className="w-full sm:w-[150px] h-9 text-sm"><SelectValue placeholder="Exam / Unit" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Exams</SelectItem>
                      {examNames.map(name => <SelectItem key={name} value={name!}>{name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={selectedClass} onValueChange={(v) => { setSelectedClass(v); setSelectedStudent('all'); }}>
                    <SelectTrigger className="w-full sm:w-[130px] h-9 text-sm"><SelectValue placeholder="Class" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Classes</SelectItem>
                      {classes.map(c => <SelectItem key={c.id} value={c.id}>{c.section ? `${c.name} - ${c.section.toUpperCase()}` : c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={selectedStudent} onValueChange={setSelectedStudent}>
                    <SelectTrigger className="w-full sm:w-[160px] h-9 text-sm"><SelectValue placeholder="Student" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Students</SelectItem>
                      {uniqueStudents.map(s => <SelectItem key={s.id} value={s.id}>{s.name} ({s.admission})</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <div className="relative w-full sm:w-[150px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Search..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9 h-9 text-sm" />
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Button variant={viewMode === 'table' ? 'default' : 'outline'} size="sm" className="h-8 text-xs" onClick={() => setViewMode('table')}>
                    <BarChart3 className="h-3.5 w-3.5 mr-1" /> Table
                  </Button>
                  <Button variant={viewMode === 'report' ? 'default' : 'outline'} size="sm" className="h-8 text-xs" onClick={() => setViewMode('report')} disabled={selectedStudent === 'all'}>
                    <Award className="h-3.5 w-3.5 mr-1" /> Report
                  </Button>
                  <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleDownload('regular')} disabled={filteredResults.length === 0} title="Download">
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Report Card View */}
          {viewMode === 'report' && reportCardData && selectedStudent !== 'all' ? (
            <div className="space-y-4">
              <Card className="border-2 border-primary/20">
                <CardHeader className="bg-primary/5 pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-xl flex items-center gap-2">
                        <Award className="h-5 w-5 text-primary" />
                        Progress Report Card
                      </CardTitle>
                      <CardDescription className="mt-1">
                        {reportCardData.student?.full_name} • {reportCardData.student?.admission_number}
                      </CardDescription>
                    </div>
                    <div className="text-right">
                      <p className={`text-3xl font-bold ${getPctColor(reportCardData.overallPct)}`}>{reportCardData.overallPct.toFixed(1)}%</p>
                      <p className="text-xs text-muted-foreground">Overall Average</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div className="text-center p-3 bg-muted/30 rounded-lg">
                      <p className="text-2xl font-bold">{reportCardData.count}</p>
                      <p className="text-xs text-muted-foreground">Total Exams</p>
                    </div>
                    <div className="text-center p-3 bg-emerald-500/10 rounded-lg">
                      <p className="text-2xl font-bold text-emerald-600">{reportCardData.totalMarks}</p>
                      <p className="text-xs text-muted-foreground">Marks Obtained</p>
                    </div>
                    <div className="text-center p-3 bg-blue-500/10 rounded-lg">
                      <p className="text-2xl font-bold text-blue-600">{reportCardData.totalMax}</p>
                      <p className="text-xs text-muted-foreground">Total Max Marks</p>
                    </div>
                  </div>
                  <Progress value={reportCardData.overallPct} className="h-3" />
                </CardContent>
              </Card>

              {Object.entries(reportCardData.grouped).map(([examName, marks]) => {
                const examTotal = marks.reduce((s, m) => s + (m.marks_obtained || 0), 0);
                const examMax = marks.reduce((s, m) => s + (m.exams?.max_marks || 100), 0);
                const examPct = examMax > 0 ? (examTotal / examMax) * 100 : 0;
                return (
                  <Card key={examName} className="overflow-hidden">
                    <CardHeader className="pb-3 bg-muted/30">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base flex items-center gap-2">
                          <BookOpen className="h-4 w-4 text-primary" />
                          {examName}
                        </CardTitle>
                        <div className="flex items-center gap-3">
                          <Badge variant="outline">{marks.length} subject{marks.length > 1 ? 's' : ''}</Badge>
                          <span className={`font-bold ${getPctColor(examPct)}`}>{examPct.toFixed(1)}%</span>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="p-0">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/20">
                            <TableHead>Subject</TableHead>
                            <TableHead className="text-center">Marks</TableHead>
                            <TableHead className="text-center">%</TableHead>
                            <TableHead className="text-center">Grade</TableHead>
                            <TableHead className="hidden sm:table-cell">Remarks</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {marks.map(mark => {
                            const pct = mark.marks_obtained && mark.exams?.max_marks ? (mark.marks_obtained / mark.exams.max_marks) * 100 : 0;
                            return (
                              <TableRow key={mark.id}>
                                <TableCell className="font-medium capitalize">{mark.exams?.subjects?.name || '-'}</TableCell>
                                <TableCell className="text-center">
                                  <span className="font-semibold">{mark.marks_obtained ?? '-'}</span>
                                  <span className="text-muted-foreground text-xs">/{mark.exams?.max_marks ?? 100}</span>
                                </TableCell>
                                <TableCell className="text-center"><span className={`font-semibold ${getPctColor(pct)}`}>{pct.toFixed(0)}%</span></TableCell>
                                <TableCell className="text-center"><Badge className={`text-xs ${getGradeColor(mark.grade)}`}>{mark.grade || '-'}</Badge></TableCell>
                                <TableCell className="text-xs text-muted-foreground hidden sm:table-cell">{mark.remarks || '-'}</TableCell>
                              </TableRow>
                            );
                          })}
                          <TableRow className="bg-muted/20 font-semibold">
                            <TableCell>Total</TableCell>
                            <TableCell className="text-center">{examTotal}/{examMax}</TableCell>
                            <TableCell className="text-center"><span className={getPctColor(examPct)}>{examPct.toFixed(1)}%</span></TableCell>
                            <TableCell colSpan={2}></TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            /* Table View */
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  Results
                  {isRegularFilterActive && <Badge variant="secondary" className="ml-1">{filteredResults.length} records</Badge>}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!isRegularFilterActive ? (
                  <div className="text-center py-12">
                    <Search className="h-12 w-12 mx-auto text-muted-foreground mb-3 opacity-50" />
                    <p className="text-muted-foreground font-medium">Select filters to view results</p>
                    <p className="text-sm text-muted-foreground mt-1">Choose an Exam, Class, and Student/Search to display results.</p>
                  </div>
                ) : filteredResults.length === 0 ? (
                  <div className="text-center py-12">
                    <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground mb-3 opacity-50" />
                    <p className="text-muted-foreground">No results found. Adjust filters or enter marks first.</p>
                  </div>
                ) : (
                  <ScrollArea className="h-[500px]">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/20">
                          <TableHead className="text-xs sm:text-sm min-w-[80px]">Student</TableHead>
                          <TableHead className="text-xs sm:text-sm hidden sm:table-cell">Adm No</TableHead>
                          <TableHead className="text-xs sm:text-sm">Exam</TableHead>
                          <TableHead className="text-xs sm:text-sm">Subject</TableHead>
                          <TableHead className="text-xs sm:text-sm hidden md:table-cell">Class</TableHead>
                          <TableHead className="text-center text-xs sm:text-sm">Marks</TableHead>
                          <TableHead className="text-center text-xs sm:text-sm">%</TableHead>
                          <TableHead className="text-center text-xs sm:text-sm">Grade</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredResults.map(r => {
                          const pct = r.marks_obtained && r.exams?.max_marks ? (r.marks_obtained / r.exams.max_marks) * 100 : 0;
                          return (
                            <TableRow key={r.id}>
                              <TableCell className="font-medium text-xs sm:text-sm py-2">{r.students?.full_name || '-'}</TableCell>
                              <TableCell className="text-xs text-muted-foreground hidden sm:table-cell py-2">{r.students?.admission_number || '-'}</TableCell>
                              <TableCell className="text-xs sm:text-sm py-2">{r.exams?.name || '-'}</TableCell>
                              <TableCell className="capitalize text-xs sm:text-sm py-2">{r.exams?.subjects?.name || '-'}</TableCell>
                              <TableCell className="hidden md:table-cell py-2">
                                {r.exams?.classes ? <Badge variant="outline" className="text-xs">{r.exams.classes.section ? `${r.exams.classes.name} - ${r.exams.classes.section.toUpperCase()}` : r.exams.classes.name}</Badge> : '-'}
                              </TableCell>
                              <TableCell className="text-center text-xs sm:text-sm py-2">
                                <span className="font-semibold">{r.marks_obtained ?? '-'}</span>
                                <span className="text-[10px] sm:text-xs text-muted-foreground">/{r.exams?.max_marks ?? 100}</span>
                              </TableCell>
                              <TableCell className="text-center py-2"><span className={`font-semibold text-xs sm:text-sm ${getPctColor(pct)}`}>{pct.toFixed(0)}%</span></TableCell>
                              <TableCell className="text-center py-2"><Badge className={`text-[10px] sm:text-xs ${getGradeColor(r.grade)}`}>{r.grade || '-'}</Badge></TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Weekly Exam Results */}
        <TabsContent value="weekly" className="space-y-4 mt-4">
          {renderWeeklyResultsContent('general')}
        </TabsContent>

        {/* Competitive Exam Results */}
        <TabsContent value="competitive" className="space-y-4 mt-4">
          {renderWeeklyResultsContent('competitive')}
        </TabsContent>
      </Tabs>
    </div>
  );

  function renderWeeklyResultsContent(type: 'general' | 'competitive') {
    const typeResults = type === 'general'
      ? filteredWeeklyResults.filter(r => r.weekly_exams?.syllabus_type !== 'competitive')
      : filteredWeeklyResults.filter(r => r.weekly_exams?.syllabus_type === 'competitive');

    // Get unique exam names from all weekly exams (not just results)
    const typeExamNames = [...new Set(
      allWeeklyExams
        .filter(e => type === 'general' ? e.syllabus_type !== 'competitive' : e.syllabus_type === 'competitive')
        .map(e => e.exam_title)
        .filter(Boolean)
    )];

    // Get unique dates for this type
    const typeExamDates = [...new Set(
      weeklyResults
        .filter(r => type === 'general' ? r.weekly_exams?.syllabus_type !== 'competitive' : r.weekly_exams?.syllabus_type === 'competitive')
        .map(r => r.weekly_exams?.exam_date)
        .filter(Boolean)
    )].sort();

    // Get unique exam type labels from all weekly exams
    const typeExamTypeLabels = [...new Set(
      allWeeklyExams
        .filter(e => type === 'general' ? e.syllabus_type !== 'competitive' : e.syllabus_type === 'competitive')
        .map(e => e.exam_type_label)
        .filter(Boolean)
    )] as string[];

    return (
      <>
        {/* Filters */}
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex flex-col sm:flex-row gap-2 flex-wrap">
              <Select value={weeklyExamNameFilter} onValueChange={setWeeklyExamNameFilter}>
                <SelectTrigger className="w-full sm:w-[160px] h-9 text-sm"><SelectValue placeholder="Exam Name" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Exams</SelectItem>
                  {typeExamNames.map(name => <SelectItem key={name} value={name!}>{name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={weeklyClassFilter} onValueChange={setWeeklyClassFilter}>
                <SelectTrigger className="w-full sm:w-[150px] h-9 text-sm"><SelectValue placeholder="Class" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Classes</SelectItem>
                  {classes.map(c => <SelectItem key={c.id} value={c.id}>{c.section ? `${c.name} - ${c.section.toUpperCase()}` : c.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={weeklyExamTypeLabelFilter} onValueChange={setWeeklyExamTypeLabelFilter}>
                <SelectTrigger className="w-full sm:w-[150px] h-9 text-sm"><SelectValue placeholder="Exam Type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {typeExamTypeLabels.map(label => <SelectItem key={label} value={label}>{label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={weeklyDateFilter} onValueChange={setWeeklyDateFilter}>
                <SelectTrigger className="w-full sm:w-[150px] h-9 text-sm"><SelectValue placeholder="Date" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Dates</SelectItem>
                  {typeExamDates.map(d => <SelectItem key={d} value={d!}>{new Date(d!).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</SelectItem>)}
                </SelectContent>
              </Select>
              <div className="relative w-full sm:w-[180px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search student/exam..." value={weeklySearchQuery} onChange={e => setWeeklySearchQuery(e.target.value)} className="pl-9 h-9 text-sm" />
              </div>
              <div className="flex items-center gap-1.5 ml-auto">
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleDownload('weekly', typeResults)} disabled={typeResults.length === 0} title="Download">
                  <Download className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Show results only when filter is active */}
        {!isWeeklyFilterActive ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Search className="h-12 w-12 mx-auto text-muted-foreground mb-3 opacity-50" />
              <p className="text-muted-foreground font-medium">Select filters to view results</p>
              <p className="text-sm text-muted-foreground mt-1">Choose an Exam Name, Class, and Date/Search to display results.</p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Summary Stats */}
            {typeResults.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Card>
                  <CardContent className="py-3 text-center">
                    <p className="text-2xl font-bold">{typeResults.length}</p>
                    <p className="text-xs text-muted-foreground">Total Records</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="py-3 text-center">
                    <p className="text-2xl font-bold">{new Set(typeResults.map(r => r.student_id)).size}</p>
                    <p className="text-xs text-muted-foreground">Students</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="py-3 text-center">
                    {(() => {
                      const avg = typeResults.reduce((s, r) => s + (r.percentage || 0), 0) / typeResults.length;
                      return <p className={`text-2xl font-bold ${getPctColor(avg)}`}>{avg.toFixed(1)}%</p>;
                    })()}
                    <p className="text-xs text-muted-foreground">Avg Percentage</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="py-3 text-center">
                    {(() => {
                      const max = Math.max(...typeResults.map(r => r.percentage || 0));
                      return <p className={`text-2xl font-bold ${getPctColor(max)}`}>{max.toFixed(1)}%</p>;
                    })()}
                    <p className="text-xs text-muted-foreground">Highest %</p>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Results Table */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  {type === 'competitive' ? <FlaskConical className="h-4 w-4 text-primary" /> : <BarChart3 className="h-4 w-4 text-primary" />}
                  {type === 'competitive' ? 'Competitive' : 'Weekly'} Exam Results
                  <Badge variant="secondary" className="ml-1">{typeResults.length} records</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {typeResults.length === 0 ? (
                  <div className="text-center py-12">
                    {type === 'competitive' ? <FlaskConical className="h-12 w-12 mx-auto text-muted-foreground mb-3 opacity-50" /> : <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground mb-3 opacity-50" />}
                    <p className="text-muted-foreground">No {type} exam results found.</p>
                    <p className="text-sm text-muted-foreground mt-1">Enter marks in the W.Marks tab first.</p>
                  </div>
                ) : (
                  <ScrollArea className="h-[500px]">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/20">
                          <TableHead className="text-xs sm:text-sm min-w-[80px]">Student</TableHead>
                          <TableHead className="text-xs sm:text-sm hidden sm:table-cell">Adm No</TableHead>
                          <TableHead className="text-xs sm:text-sm">Exam</TableHead>
                          <TableHead className="text-xs sm:text-sm hidden md:table-cell">Subject</TableHead>
                          <TableHead className="text-xs sm:text-sm hidden md:table-cell">Class</TableHead>
                          {type === 'competitive' && <TableHead className="text-xs sm:text-sm hidden lg:table-cell">Type</TableHead>}
                          <TableHead className="text-center text-xs sm:text-sm">Marks</TableHead>
                          <TableHead className="text-center text-xs sm:text-sm">%</TableHead>
                          <TableHead className="text-center text-xs sm:text-sm">Rank</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {typeResults.map(r => {
                          const pct = r.percentage ?? (r.total_marks > 0 ? (r.obtained_marks / r.total_marks) * 100 : 0);
                          return (
                            <TableRow key={r.id}>
                              <TableCell className="font-medium text-xs sm:text-sm py-2">{r.students?.full_name || '-'}</TableCell>
                              <TableCell className="text-xs text-muted-foreground hidden sm:table-cell py-2">{r.students?.admission_number || '-'}</TableCell>
                              <TableCell className="py-2">
                                <div>
                                  <p className="text-xs sm:text-sm font-medium">{r.weekly_exams?.exam_title || '-'}</p>
                                  <p className="text-[10px] text-muted-foreground">
                                    {r.weekly_exams?.exam_date ? new Date(r.weekly_exams.exam_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : ''}
                                  </p>
                                </div>
                              </TableCell>
                              <TableCell className="capitalize text-xs sm:text-sm hidden md:table-cell py-2">{r.weekly_exams?.subjects?.name || '-'}</TableCell>
                              <TableCell className="hidden md:table-cell py-2">
                                {r.weekly_exams?.classes ? <Badge variant="outline" className="text-xs">{r.weekly_exams.classes.section ? `${r.weekly_exams.classes.name} - ${r.weekly_exams.classes.section.toUpperCase()}` : r.weekly_exams.classes.name}</Badge> : '-'}
                              </TableCell>
                              {type === 'competitive' && (
                                <TableCell className="hidden lg:table-cell py-2">
                                  <Badge variant="secondary" className="text-[10px]">{r.weekly_exams?.exam_type_label || r.weekly_exams?.syllabus_type}</Badge>
                                </TableCell>
                              )}
                              <TableCell className="text-center text-xs sm:text-sm py-2">
                                <span className="font-semibold">{r.obtained_marks}</span>
                                <span className="text-[10px] sm:text-xs text-muted-foreground">/{r.total_marks}</span>
                              </TableCell>
                              <TableCell className="text-center py-2">
                                <span className={`font-semibold text-xs sm:text-sm ${getPctColor(pct)}`}>{pct.toFixed(0)}%</span>
                              </TableCell>
                              <TableCell className="text-center text-xs sm:text-sm py-2 font-medium">{r.rank || '-'}</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </>
    );
  }
}
