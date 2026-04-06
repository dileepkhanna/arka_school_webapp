import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { apiClient } from '@/lib/apiClient';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { useTeacherSidebar } from '@/hooks/useTeacherSidebar';
import { BackButton } from '@/components/ui/back-button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Search, Calendar, Clock, FileText, BookOpen, CheckCircle2, HelpCircle, AlignLeft, Tag, Play, ArrowRight } from 'lucide-react';

const getExamDateStatus = (examDate: string): { status: 'upcoming' | 'running' | 'completed'; label: string; color: string; icon: React.ReactNode } => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [year, month, day] = examDate.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  date.setHours(0, 0, 0, 0);
  if (date > today) return { status: 'upcoming', label: 'Upcoming', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300', icon: <ArrowRight className="h-3 w-3" /> };
  if (date.getTime() === today.getTime()) return { status: 'running', label: 'Running', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300', icon: <Play className="h-3 w-3" /> };
  return { status: 'completed', label: 'Completed', color: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300', icon: <CheckCircle2 className="h-3 w-3" /> };
};

interface WeeklyExam {
  id: string;
  exam_title: string;
  exam_date: string;
  exam_time: string;
  duration_minutes: number;
  total_marks: number;
  negative_marking: boolean;
  negative_marks_value: number;
  status: string;
  syllabus_type: string;
  week_number: number | null;
  class_id: string;
  subject_id: string | null;
  description: string | null;
  exam_type_label: string | null;
  classes?: { name: string; section: string } | null;
  subjects?: { name: string } | null;
}

interface SyllabusItem {
  id: string;
  chapter_name: string;
  topic_name: string;
  subjects?: { name: string } | null;
}

interface ExamSyllabusLink {
  exam_id: string;
  syllabus_id: string;
}

interface QuestionPaper {
  id: string;
  exam_id: string;
  total_questions: number;
  total_marks: number;
}

interface Question {
  id: string;
  question_paper_id: string;
  question_number: number;
  question_text: string;
  question_type: string;
  option_a: string | null;
  option_b: string | null;
  option_c: string | null;
  option_d: string | null;
  correct_answer: string | null;
  explanation: string | null;
  marks: number;
}

interface StudentResult {
  id: string;
  student_id: string;
  exam_id: string;
  obtained_marks: number;
  total_marks: number;
  percentage: number | null;
  rank: number | null;
  students?: { full_name: string; admission_number: string } | null;
}

interface TeacherWeeklyExamsResponse {
  exams: WeeklyExam[];
  links: ExamSyllabusLink[];
  syllabus: SyllabusItem[];
  papers: QuestionPaper[];
  questions: Question[];
  results: StudentResult[];
}

export default function TeacherWeeklyExams() {
  const teacherSidebarItems = useTeacherSidebar();
  const { user, userRole, loading } = useAuth();
  const navigate = useNavigate();

  const [exams, setExams] = useState<WeeklyExam[]>([]);
  const [syllabusLinks, setSyllabusLinks] = useState<ExamSyllabusLink[]>([]);
  const [syllabus, setSyllabus] = useState<SyllabusItem[]>([]);
  const [papers, setPapers] = useState<QuestionPaper[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [results, setResults] = useState<StudentResult[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [activeTab, setActiveTab] = useState('schedule');
  const [searchQuery, setSearchQuery] = useState('');

  // Expanded exam for viewing questions/results
  const [expandedExam, setExpandedExam] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && (!user || userRole !== 'teacher')) navigate('/auth');
  }, [user, userRole, loading, navigate]);

  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    setLoadingData(true);
    try {
      const data = await apiClient.get<TeacherWeeklyExamsResponse>('/teacher/weekly-exams-data');
      setExams(data.exams || []);
      setSyllabusLinks(data.links || []);
      setSyllabus(data.syllabus || []);
      setPapers(data.papers || []);
      setQuestions(data.questions || []);
      setResults(data.results || []);
    } catch (error) {
      console.error('Error loading weekly exams data:', error);
      setExams([]);
      setSyllabusLinks([]);
      setSyllabus([]);
      setPapers([]);
      setQuestions([]);
      setResults([]);
    } finally {
      setLoadingData(false);
    }
  }

  const getLinkedSyllabus = (examId: string) => {
    const ids = syllabusLinks.filter(l => l.exam_id === examId).map(l => l.syllabus_id);
    return syllabus.filter(s => ids.includes(s.id));
  };

  const getPaper = (examId: string) => papers.find(p => p.exam_id === examId);
  const getQuestions = (paperId: string) => questions.filter(q => q.question_paper_id === paperId);
  const getResults = (examId: string) => results.filter(r => r.exam_id === examId);

  const filteredExams = useMemo(() => {
    if (!searchQuery) return exams;
    const q = searchQuery.toLowerCase();
    return exams.filter(e => e.exam_title.toLowerCase().includes(q) || e.classes?.name?.toLowerCase().includes(q));
  }, [exams, searchQuery]);

  const scheduledExams = filteredExams.filter(e => getExamDateStatus(e.exam_date).status === 'upcoming');
  const liveExams = filteredExams.filter(e => getExamDateStatus(e.exam_date).status === 'running');
  const completedExams = filteredExams.filter(e => getExamDateStatus(e.exam_date).status === 'completed');

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  const typeColors: Record<string, string> = {
    JEE: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    NEET: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    BITSAT: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
    General: 'bg-muted text-muted-foreground',
  };

  const ExamCard = ({ exam }: { exam: WeeklyExam }) => {
    const linked = getLinkedSyllabus(exam.id);
    const paper = getPaper(exam.id);
    const examQuestions = paper ? getQuestions(paper.id) : [];
    const examResults = getResults(exam.id);
    const isExpanded = expandedExam === exam.id;

    return (
      <Card>
        <CardContent className="py-3 px-3 sm:px-4 space-y-2.5">
          <div className="flex items-start justify-between gap-2 cursor-pointer" onClick={() => setExpandedExam(isExpanded ? null : exam.id)}>
            <div className="space-y-1.5 flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h3 className="font-semibold text-sm">{exam.exam_title}</h3>
                {(() => {
                  const ds = getExamDateStatus(exam.exam_date);
                  return (
                    <span className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0 text-[10px] font-semibold ${ds.color}`}>
                      {ds.icon}{ds.label}
                    </span>
                  );
                })()}
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                {exam.exam_type_label && exam.exam_type_label !== 'General' && (
                  <Badge className={`text-[10px] px-1.5 py-0 ${typeColors[exam.exam_type_label] || typeColors['General']}`}>
                    <Tag className="h-2.5 w-2.5 mr-0.5" />{exam.exam_type_label}
                  </Badge>
                )}
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                  {exam.classes ? (exam.classes.section ? `${exam.classes.name}-${exam.classes.section}` : exam.classes.name) : '—'}
                </Badge>
                {exam.subjects && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{exam.subjects.name}</Badge>
                )}
                {exam.week_number && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">W{exam.week_number}</Badge>}
                {paper && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{paper.total_questions}Q</Badge>}
              </div>
              <div className="flex items-center gap-2.5 text-[11px] text-muted-foreground flex-wrap">
                <span className="flex items-center gap-0.5"><Calendar className="h-3 w-3" />{new Date(exam.exam_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</span>
                <span className="flex items-center gap-0.5"><Clock className="h-3 w-3" />{exam.exam_time}</span>
                <span>{exam.duration_minutes}min</span>
                <span>Max: {exam.total_marks}</span>
                {exam.negative_marking && <span className="text-destructive">-{exam.negative_marks_value}</span>}
              </div>
            </div>
          </div>

          {linked.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {linked.map(s => (
                <Badge key={s.id} variant="outline" className="text-[10px] px-1.5 py-0">{s.subjects?.name}: {s.topic_name}</Badge>
              ))}
            </div>
          )}

          {/* Description */}
          {exam.description && (
            <div className="bg-muted/40 rounded-md p-2">
              <p className="text-[11px] text-muted-foreground">{exam.description}</p>
            </div>
          )}

          {isExpanded && (
            <div className="space-y-4 pt-2 border-t">
              {/* Questions */}
              {examQuestions.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase">Questions ({examQuestions.length})</h4>
                  {examQuestions.map(q => (
                    <div key={q.id} className="p-3 rounded-md border space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-primary">Q{q.question_number}</span>
                        <Badge variant={q.question_type === 'mcq' ? 'secondary' : 'outline'} className="text-xs">
                          {q.question_type === 'mcq' ? <><HelpCircle className="h-3 w-3 mr-0.5" />MCQ</> : <><AlignLeft className="h-3 w-3 mr-0.5" />Desc</>}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{q.marks}m</span>
                      </div>
                      <p className="text-sm">{q.question_text}</p>
                      {q.question_type === 'mcq' && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-xs">
                          {['A', 'B', 'C', 'D'].map(opt => {
                            const val = q[`option_${opt.toLowerCase()}` as keyof Question] as string | null;
                            if (!val) return null;
                            const isCorrect = q.correct_answer?.toUpperCase() === opt;
                            return (
                              <div key={opt} className={`flex items-center gap-1 p-1 rounded ${isCorrect ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground'}`}>
                                {isCorrect && <CheckCircle2 className="h-3 w-3 shrink-0" />}
                                <span>{opt}. {val}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Results */}
              {examResults.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase">Results ({examResults.length} students)</h4>
                  <div className="space-y-1.5">
                    {examResults.map(r => (
                      <div key={r.id} className="flex items-center justify-between p-2 rounded-md border text-sm">
                        <div className="flex items-center gap-2">
                          {r.rank && <span className="text-xs font-bold text-primary">#{r.rank}</span>}
                          <span>{r.students?.full_name || '—'}</span>
                          <span className="text-xs text-muted-foreground">({r.students?.admission_number})</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{r.obtained_marks}/{r.total_marks}</span>
                          {r.percentage !== null && <Badge variant="secondary" className="text-xs">{r.percentage}%</Badge>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {examQuestions.length === 0 && examResults.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">No question paper or results available yet.</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <DashboardLayout sidebarItems={teacherSidebarItems} roleColor="teacher">
      {loadingData ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : (
        <div className="space-y-6 animate-fade-in">
          <BackButton to="/teacher" />
          <div>
            <h1 className="font-display text-2xl font-bold">Weekly Exams</h1>
            <p className="text-muted-foreground">View exam schedules, question papers, and results</p>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search exams..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9" />
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="schedule" className="flex items-center gap-1.5 text-xs sm:text-sm">
                <Calendar className="h-4 w-4" />Upcoming ({scheduledExams.length})
              </TabsTrigger>
              <TabsTrigger value="live" className="flex items-center gap-1.5 text-xs sm:text-sm">
                <BookOpen className="h-4 w-4" />Live ({liveExams.length})
              </TabsTrigger>
              <TabsTrigger value="completed" className="flex items-center gap-1.5 text-xs sm:text-sm">
                <FileText className="h-4 w-4" />Done ({completedExams.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="schedule" className="mt-4">
              {scheduledExams.length === 0 ? (
                <Card><CardContent className="py-12 text-center text-muted-foreground">No upcoming exams.</CardContent></Card>
              ) : (
                <div className="space-y-3">{scheduledExams.map(e => <ExamCard key={e.id} exam={e} />)}</div>
              )}
            </TabsContent>
            <TabsContent value="live" className="mt-4">
              {liveExams.length === 0 ? (
                <Card><CardContent className="py-12 text-center text-muted-foreground">No live exams.</CardContent></Card>
              ) : (
                <div className="space-y-3">{liveExams.map(e => <ExamCard key={e.id} exam={e} />)}</div>
              )}
            </TabsContent>
            <TabsContent value="completed" className="mt-4">
              {completedExams.length === 0 ? (
                <Card><CardContent className="py-12 text-center text-muted-foreground">No completed exams.</CardContent></Card>
              ) : (
                <div className="space-y-3">{completedExams.map(e => <ExamCard key={e.id} exam={e} />)}</div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      )}
    </DashboardLayout>
  );
}
