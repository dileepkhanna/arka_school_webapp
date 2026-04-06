import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { apiClient } from '@/lib/apiClient';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Calendar, FileText, RotateCcw, FlaskConical, Award, BookOpen } from 'lucide-react';
import { parentSidebarItems } from '@/config/parentSidebar';
import StudentProgressView from '@/components/exams/StudentProgressView';
import ExamScheduleView from '@/components/exams/ExamScheduleView';
import WeeklyExamCalendarView from '@/components/exams/WeeklyExamCalendarView';
import { BackButton } from '@/components/ui/back-button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface ExamMark {
  id: string;
  marks_obtained: number | null;
  grade: string | null;
  remarks: string | null;
  exams: {
    name: string;
    exam_date: string | null;
    max_marks: number | null;
    class_id?: string | null;
    classes?: { id?: string | null; name: string; section: string } | null;
    subjects: { name: string } | null;
  } | null;
}

interface WeeklyResult {
  id: string;
  obtained_marks: number;
  total_marks: number;
  percentage: number | null;
  rank: number | null;
  exam_id: string;
  weekly_exams: {
    exam_title: string;
    exam_date: string;
    total_marks: number;
    syllabus_type: string;
    exam_type_label: string | null;
    subjects: { name: string } | null;
    classes: { name: string; section: string } | null;
  } | null;
}

interface ParentExamsResponse {
  childName: string;
  childClassIds: string[];
  marks: ExamMark[];
  weeklyResults: WeeklyResult[];
}

export default function ParentExams() {
  const { user, userRole, loading } = useAuth();
  const navigate = useNavigate();
  const [marks, setMarks] = useState<ExamMark[]>([]);
  const [weeklyResults, setWeeklyResults] = useState<WeeklyResult[]>([]);
  const [childName, setChildName] = useState('');
  const [childClassIds, setChildClassIds] = useState<string[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [selectedExam, setSelectedExam] = useState('all');
  const [activeTab, setActiveTab] = useState('schedule');
  const [competitiveExamFilter, setCompetitiveExamFilter] = useState('all');
  const [competitiveLabelFilter, setCompetitiveLabelFilter] = useState('all');

  useEffect(() => {
    if (!loading && (!user || userRole !== 'parent')) {
      navigate('/auth');
    }
  }, [user, userRole, loading, navigate]);

  useEffect(() => {
    async function fetchMarks() {
      if (!user) return;
      setLoadingData(true);
      try {
        const data = await apiClient.get<ParentExamsResponse>('/parent/exams-data');
        setChildName(data.childName || '');
        setChildClassIds(data.childClassIds || []);
        setMarks(data.marks || []);
        setWeeklyResults(data.weeklyResults || []);
      } catch (error) {
        console.error('Error fetching parent exams:', error);
        setChildName('');
        setChildClassIds([]);
        setMarks([]);
        setWeeklyResults([]);
      } finally {
        setLoadingData(false);
      }
    }
    fetchMarks();
  }, [user]);

  const examNames = useMemo(() => 
    [...new Set(marks.map(m => m.exams?.name).filter(Boolean))] as string[],
    [marks]
  );

  const filteredMarks = useMemo(() => {
    if (selectedExam === 'all') return marks;
    return marks.filter(m => m.exams?.name === selectedExam);
  }, [marks, selectedExam]);

  // Group weekly results by type
  const competitiveResults = useMemo(() => weeklyResults.filter(r => r.weekly_exams?.syllabus_type === 'competitive'), [weeklyResults]);
  const generalWeeklyResults = useMemo(() => weeklyResults.filter(r => r.weekly_exams?.syllabus_type === 'general'), [weeklyResults]);

  // Competitive filter options
  const competitiveExamNames = useMemo(() =>
    [...new Set(competitiveResults.map(r => r.weekly_exams?.exam_title).filter(Boolean))] as string[],
    [competitiveResults]
  );
  const competitiveLabels = useMemo(() =>
    [...new Set(competitiveResults.map(r => r.weekly_exams?.exam_type_label).filter(Boolean))] as string[],
    [competitiveResults]
  );
  const filteredCompetitiveResults = useMemo(() => {
    return competitiveResults.filter(r => {
      if (competitiveExamFilter !== 'all' && r.weekly_exams?.exam_title !== competitiveExamFilter) return false;
      if (competitiveLabelFilter !== 'all' && r.weekly_exams?.exam_type_label !== competitiveLabelFilter) return false;
      return true;
    });
  }, [competitiveResults, competitiveExamFilter, competitiveLabelFilter]);

  const getPctColor = (pct: number) => {
    if (pct >= 80) return 'text-emerald-600';
    if (pct >= 60) return 'text-blue-600';
    if (pct >= 40) return 'text-amber-600';
    return 'text-red-600';
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  const WeeklyResultsSection = ({ results, title, icon }: { results: WeeklyResult[]; title: string; icon: React.ReactNode }) => {
    if (results.length === 0) {
      return (
        <Card>
          <CardContent className="py-6 sm:py-8 text-center text-muted-foreground text-xs sm:text-sm">
            <p>No {title.toLowerCase()} results yet.</p>
          </CardContent>
        </Card>
      );
    }

    const totalObtained = results.reduce((s, r) => s + r.obtained_marks, 0);
    const totalMax = results.reduce((s, r) => s + r.total_marks, 0);
    const overallPct = totalMax > 0 ? (totalObtained / totalMax) * 100 : 0;

    return (
      <div className="space-y-3 sm:space-y-4">
        {/* Summary card */}
        <Card className="border-primary/20">
          <CardHeader className="pb-2 sm:pb-3 bg-primary/5 px-3 sm:px-6 py-2.5 sm:py-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs sm:text-base flex items-center gap-1.5 sm:gap-2">
                {icon}
                {title}
              </CardTitle>
              <div className="text-right">
                <p className={`text-lg sm:text-2xl font-bold ${getPctColor(overallPct)}`}>{overallPct.toFixed(1)}%</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground">Overall</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-2 sm:pt-3 px-3 sm:px-6">
            <Progress value={overallPct} className="h-2 sm:h-2.5" />
            <p className="text-[10px] sm:text-xs text-muted-foreground mt-1.5 sm:mt-2">{results.length} exams • {totalObtained}/{totalMax} marks</p>
          </CardContent>
        </Card>

        {/* Mobile: Card list, Desktop: Table */}
        <div className="hidden sm:block">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Exam</TableHead>
                    <TableHead className="text-xs">Subject</TableHead>
                    <TableHead className="text-xs text-center">Marks</TableHead>
                    <TableHead className="text-xs text-center">%</TableHead>
                    {results.some(r => r.rank) && <TableHead className="text-xs text-center">Rank</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.map(r => {
                    const pct = r.percentage ?? (r.total_marks > 0 ? (r.obtained_marks / r.total_marks) * 100 : 0);
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="py-2">
                          <div>
                            <p className="font-medium text-xs">{r.weekly_exams?.exam_title}</p>
                            <p className="text-[10px] text-muted-foreground">
                              {new Date(r.weekly_exams?.exam_date || '').toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                              {r.weekly_exams?.exam_type_label && ` • ${r.weekly_exams.exam_type_label}`}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="capitalize text-xs">{r.weekly_exams?.subjects?.name || '-'}</TableCell>
                        <TableCell className="text-center text-xs">
                          <span className="font-semibold">{r.obtained_marks}</span>
                          <span className="text-muted-foreground">/{r.total_marks}</span>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className={`font-semibold text-xs ${getPctColor(pct)}`}>{pct.toFixed(0)}%</span>
                        </TableCell>
                        {results.some(r2 => r2.rank) && (
                          <TableCell className="text-center text-xs font-medium">{r.rank || '-'}</TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        {/* Mobile card list */}
        <div className="sm:hidden space-y-2">
          {results.map(r => {
            const pct = r.percentage ?? (r.total_marks > 0 ? (r.obtained_marks / r.total_marks) * 100 : 0);
            return (
              <Card key={r.id}>
                <CardContent className="p-2.5 space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-xs truncate">{r.weekly_exams?.exam_title}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {new Date(r.weekly_exams?.exam_date || '').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        {r.weekly_exams?.exam_type_label && ` • ${r.weekly_exams.exam_type_label}`}
                      </p>
                    </div>
                    <span className={`font-bold text-sm ${getPctColor(pct)}`}>{pct.toFixed(0)}%</span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="secondary" className="text-[9px] px-1.5 py-0 capitalize">{r.weekly_exams?.subjects?.name || '-'}</Badge>
                    <span className="text-[10px] text-muted-foreground">
                      <span className="font-semibold text-foreground">{r.obtained_marks}</span>/{r.total_marks}
                    </span>
                    {r.rank && <Badge variant="outline" className="text-[9px] px-1.5 py-0">Rank: {r.rank}</Badge>}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <DashboardLayout sidebarItems={parentSidebarItems} roleColor="parent">
      {loadingData ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : (
      <div className="space-y-3 sm:space-y-6 animate-fade-in px-0">
        <BackButton to="/parent" />
        <div>
          <h1 className="font-display text-lg sm:text-2xl font-bold">Exams</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">{childName}'s exam schedule & results</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4 h-8 sm:h-10">
            <TabsTrigger value="schedule" className="flex items-center gap-0.5 sm:gap-1 text-[9px] sm:text-sm px-1 sm:px-3">
              <Calendar className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="truncate">Schedule</span>
            </TabsTrigger>
            <TabsTrigger value="weekly" className="flex items-center gap-0.5 sm:gap-1 text-[9px] sm:text-sm px-1 sm:px-3">
              <RotateCcw className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="truncate">Weekly</span>
            </TabsTrigger>
            <TabsTrigger value="results" className="flex items-center gap-0.5 sm:gap-1 text-[9px] sm:text-sm px-1 sm:px-3">
              <FileText className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="truncate">Results</span>
            </TabsTrigger>
            <TabsTrigger value="competitive" className="flex items-center gap-0.5 sm:gap-1 text-[9px] sm:text-sm px-1 sm:px-3">
              <FlaskConical className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="truncate">Comp.</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="schedule" className="mt-3 sm:mt-4">
            <ExamScheduleView filterClassIds={childClassIds} />
          </TabsContent>

          <TabsContent value="weekly" className="mt-3 sm:mt-4">
            <WeeklyExamCalendarView filterClassIds={childClassIds} />
          </TabsContent>

          <TabsContent value="results" className="mt-3 sm:mt-4 space-y-3 sm:space-y-4">
              <div className="flex justify-end">
                <Select value={selectedExam} onValueChange={setSelectedExam}>
                  <SelectTrigger className="w-[150px] sm:w-[180px] text-[10px] sm:text-xs h-7 sm:h-9">
                    <SelectValue placeholder="Filter by Exam" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Exams</SelectItem>
                    {examNames.map(name => (
                      <SelectItem key={name} value={name}>{name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            <StudentProgressView marks={filteredMarks} studentName={childName} showAnalytics={true} />

            {/* General Weekly Results */}
            {generalWeeklyResults.length > 0 && (
              <WeeklyResultsSection 
                results={generalWeeklyResults} 
                title="Weekly Exam Results" 
                icon={<BookOpen className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary" />} 
              />
            )}
          </TabsContent>

          <TabsContent value="competitive" className="mt-3 sm:mt-4 space-y-3 sm:space-y-4">
            <div className="flex flex-wrap gap-1.5 sm:gap-2">
              {competitiveExamNames.length > 0 && (
                <Select value={competitiveExamFilter} onValueChange={setCompetitiveExamFilter}>
                  <SelectTrigger className="w-[calc(50%-4px)] sm:w-[170px] text-[10px] sm:text-xs h-7 sm:h-9">
                    <SelectValue placeholder="Filter by Exam" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Exams</SelectItem>
                    {competitiveExamNames.map(name => (
                      <SelectItem key={name} value={name}>{name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {competitiveLabels.length > 0 && (
                <Select value={competitiveLabelFilter} onValueChange={setCompetitiveLabelFilter}>
                  <SelectTrigger className="w-[calc(50%-4px)] sm:w-[170px] text-[10px] sm:text-xs h-7 sm:h-9">
                    <SelectValue placeholder="Exam Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    {competitiveLabels.map(label => (
                      <SelectItem key={label} value={label}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <WeeklyResultsSection 
              results={filteredCompetitiveResults} 
              title="Competitive Exam Results" 
              icon={<FlaskConical className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary" />} 
            />
          </TabsContent>
        </Tabs>
      </div>
      )}
    </DashboardLayout>
  );
}
