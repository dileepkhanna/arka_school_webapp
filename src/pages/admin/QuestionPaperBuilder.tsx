import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { apiClient } from '@/lib/apiClient';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { adminSidebarItems } from '@/config/adminSidebar';
import { BackButton } from '@/components/ui/back-button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Loader2, Plus, Search, FileText, Pencil, Trash2, ChevronLeft, CheckCircle2, HelpCircle, AlignLeft, ChevronDown, ChevronUp, Zap } from 'lucide-react';
import { toast } from 'sonner';

interface WeeklyExam {
  id: string;
  exam_title: string;
  class_id: string;
  total_marks: number;
  status: string;
  classes?: { name: string; section: string } | null;
}

interface ClassOption { id: string; name: string; section: string; }

interface QuestionPaper {
  id: string;
  exam_id: string;
  class_id: string;
  total_questions: number;
  total_marks: number;
  uploaded_by: string | null;
  created_at: string | null;
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

interface QuestionPaperBuilderData {
  exams: WeeklyExam[];
  classes: ClassOption[];
  papers: QuestionPaper[];
  questions: Question[];
}

const emptyQForm = {
  question_type: 'mcq',
  question_text: '',
  option_a: '',
  option_b: '',
  option_c: '',
  option_d: '',
  correct_answer: '',
  explanation: '',
  marks: '1',
};

export default function QuestionPaperBuilder() {
  const { user, userRole, loading } = useAuth();
  const navigate = useNavigate();

  const [exams, setExams] = useState<WeeklyExam[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [papers, setPapers] = useState<QuestionPaper[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [saving, setSaving] = useState(false);

  const [selectedPaper, setSelectedPaper] = useState<QuestionPaper | null>(null);
  const [selectedExam, setSelectedExam] = useState<WeeklyExam | null>(null);

  const [createPaperOpen, setCreatePaperOpen] = useState(false);
  const [paperForm, setPaperForm] = useState({ exam_id: '', class_id: '' });

  // Question form
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [qForm, setQForm] = useState({ ...emptyQForm });

  // Rapid entry mode — inline form always visible
  const [rapidMode, setRapidMode] = useState(true);
  const [rapidDefaults, setRapidDefaults] = useState({ question_type: 'mcq', marks: '1' });
  const questionTextRef = useRef<HTMLTextAreaElement>(null);

  // Collapsed question list for performance with 120+ questions
  const [collapsedQuestions, setCollapsedQuestions] = useState(true);
  const [showCount, setShowCount] = useState(20);

  useEffect(() => {
    if (!loading && (!user || userRole !== 'admin')) navigate('/auth');
  }, [user, userRole, loading, navigate]);

  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    setLoadingData(true);
    try {
      const data = await apiClient.get<QuestionPaperBuilderData>('/admin/question-papers/data');
      setExams(data.exams || []);
      setClasses(data.classes || []);
      setPapers(data.papers || []);
      setQuestions(data.questions || []);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load question paper data');
    } finally {
      setLoadingData(false);
    }
  }

  // Optimized: only refetch questions for current paper
  async function fetchQuestionsOnly() {
    if (!selectedPaper) return;
    try {
      const data = await apiClient.get<Question[]>(`/admin/question-papers/${selectedPaper.id}/questions`);
      setQuestions(prev => {
        const otherPaperQs = prev.filter(q => q.question_paper_id !== selectedPaper.id);
        return [...otherPaperQs, ...(data || [])];
      });
    } catch (error: any) {
      toast.error(error.message || 'Failed to refresh questions');
    }
  }

  const getExamForPaper = (examId: string) => exams.find(e => e.id === examId);
  const getClassLabel = (classId: string) => {
    const c = classes.find(cl => cl.id === classId);
    return c ? (c.section ? `${c.name}-${c.section}` : c.name) : '—';
  };
  const getQuestionsForPaper = useCallback((paperId: string) => questions.filter(q => q.question_paper_id === paperId), [questions]);

  const filteredPapers = useMemo(() => {
    if (!searchQuery) return papers;
    const q = searchQuery.toLowerCase();
    return papers.filter(p => {
      const exam = getExamForPaper(p.exam_id);
      return exam?.exam_title?.toLowerCase().includes(q) || getClassLabel(p.class_id).toLowerCase().includes(q);
    });
  }, [papers, searchQuery, exams, classes]);

  const availableExams = useMemo(() => exams.filter(e => !papers.some(p => p.exam_id === e.id)), [exams, papers]);

  async function handleCreatePaper(e: React.FormEvent) {
    e.preventDefault();
    if (!paperForm.exam_id) { toast.error('Select an exam'); return; }
    const exam = exams.find(ex => ex.id === paperForm.exam_id);
    const classId = paperForm.class_id || exam?.class_id;
    if (!classId) { toast.error('Class is required'); return; }

    try {
      const created = await apiClient.post<{ id: string }>('/admin/question-papers', {
        exam_id: Number(paperForm.exam_id),
        class_id: Number(classId),
      });
      toast.success('Question paper created');
      setCreatePaperOpen(false);
      setPaperForm({ exam_id: '', class_id: '' });
      await fetchData();
      setSelectedPaper({
        id: created.id,
        exam_id: paperForm.exam_id,
        class_id: String(classId),
        total_questions: 0,
        total_marks: 0,
        uploaded_by: null,
        created_at: null,
      });
      setSelectedExam(exam || null);
    } catch (error: any) {
      toast.error(error.message);
    }
  }

  function openPaper(paper: QuestionPaper) {
    setSelectedPaper(paper);
    setSelectedExam(getExamForPaper(paper.exam_id) || null);
    setShowCount(20);
    setCollapsedQuestions(true);
  }

  async function handleDeletePaper(id: string) {
    try {
      await apiClient.delete(`/admin/question-papers/${id}`);
    } catch (error: any) { toast.error(error.message); return; }
    toast.success('Question paper deleted');
    if (selectedPaper?.id === id) { setSelectedPaper(null); setSelectedExam(null); }
    fetchData();
  }

  function resetQForm(keepDefaults = true) {
    setQForm({
      ...emptyQForm,
      question_type: keepDefaults ? rapidDefaults.question_type : 'mcq',
      marks: keepDefaults ? rapidDefaults.marks : '1',
    });
    setEditingQuestion(null);
  }

  // RAPID ADD: saves and immediately clears for next question
  async function handleRapidAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedPaper) return;
    if (!qForm.question_text.trim()) { toast.error('Question text is required'); return; }
    if (qForm.question_type === 'mcq' && (!qForm.option_a || !qForm.option_b)) {
      toast.error('MCQ needs at least options A and B'); return;
    }

    setSaving(true);
    const paperQuestions = getQuestionsForPaper(selectedPaper.id);
    const nextNum = paperQuestions.length + 1;

    try {
      await apiClient.post(`/admin/question-papers/${selectedPaper.id}/questions`, {
        question_number: nextNum,
        question_text: qForm.question_text,
        question_type: qForm.question_type,
        option_a: qForm.question_type === 'mcq' ? qForm.option_a || null : null,
        option_b: qForm.question_type === 'mcq' ? qForm.option_b || null : null,
        option_c: qForm.question_type === 'mcq' ? qForm.option_c || null : null,
        option_d: qForm.question_type === 'mcq' ? qForm.option_d || null : null,
        correct_answer: qForm.correct_answer || null,
        explanation: qForm.explanation || null,
        marks: parseInt(qForm.marks) || 1,
      });
    } catch (error: any) {
      toast.error(error.message);
      setSaving(false);
      return;
    }

    await fetchQuestionsOnly();
    await fetchData();
    setSaving(false);

    // Clear form but keep type & marks defaults
    setRapidDefaults({ question_type: qForm.question_type, marks: qForm.marks });
    resetQForm(true);

    toast.success(`Q${nextNum} added`, { duration: 1500 });

    // Auto-focus question text for next entry
    setTimeout(() => questionTextRef.current?.focus(), 100);
  }

  function openEditQuestion(q: Question) {
    setEditingQuestion(q);
    setQForm({
      question_type: q.question_type,
      question_text: q.question_text,
      option_a: q.option_a || '', option_b: q.option_b || '',
      option_c: q.option_c || '', option_d: q.option_d || '',
      correct_answer: q.correct_answer || '',
      explanation: q.explanation || '',
      marks: q.marks.toString(),
    });
    setEditDialogOpen(true);
  }

  async function handleEditSave(e: React.FormEvent) {
    e.preventDefault();
    if (!editingQuestion) return;
    if (!qForm.question_text.trim()) { toast.error('Question text is required'); return; }

    setSaving(true);
    try {
      await apiClient.put(`/admin/questions/${editingQuestion.id}`, {
        question_text: qForm.question_text,
        question_type: qForm.question_type,
        option_a: qForm.question_type === 'mcq' ? qForm.option_a || null : null,
        option_b: qForm.question_type === 'mcq' ? qForm.option_b || null : null,
        option_c: qForm.question_type === 'mcq' ? qForm.option_c || null : null,
        option_d: qForm.question_type === 'mcq' ? qForm.option_d || null : null,
        correct_answer: qForm.correct_answer || null,
        explanation: qForm.explanation || null,
        marks: parseInt(qForm.marks) || 1,
      });
    } catch (error: any) { toast.error(error.message); setSaving(false); return; }

    await fetchQuestionsOnly();
    await fetchData();
    setSaving(false);
    setEditDialogOpen(false);
    resetQForm();
    toast.success('Question updated');
  }

  async function handleDeleteQuestion(qId: string) {
    if (!selectedPaper) return;
    try {
      await apiClient.delete(`/admin/questions/${qId}`);
    } catch (error: any) { toast.error(error.message); return; }
    await fetchQuestionsOnly();
    await fetchData();
    toast.success('Question deleted');
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  // ============ QUESTION BUILDER VIEW ============
  if (selectedPaper && selectedExam) {
    const paperQuestions = getQuestionsForPaper(selectedPaper.id).sort((a, b) => a.question_number - b.question_number);
    const totalMarks = paperQuestions.reduce((s, q) => s + q.marks, 0);
    const mcqCount = paperQuestions.filter(q => q.question_type === 'mcq').length;
    const descCount = paperQuestions.filter(q => q.question_type === 'descriptive').length;
    const visibleQuestions = collapsedQuestions ? paperQuestions.slice(-showCount) : paperQuestions;
    const hiddenCount = collapsedQuestions ? Math.max(0, paperQuestions.length - showCount) : 0;

    const QuestionForm = ({ onSubmit, submitLabel, showSaveNext = false }: { onSubmit: (e: React.FormEvent) => void; submitLabel: string; showSaveNext?: boolean }) => (
      <form onSubmit={onSubmit} className="space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Label className="text-xs whitespace-nowrap">Type</Label>
            <Select value={qForm.question_type} onValueChange={v => setQForm(f => ({ ...f, question_type: v }))}>
              <SelectTrigger className="h-8 w-28 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="mcq">MCQ</SelectItem>
                <SelectItem value="descriptive">Descriptive</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-xs whitespace-nowrap">Marks</Label>
            <Input type="number" value={qForm.marks} onChange={e => setQForm(f => ({ ...f, marks: e.target.value }))} min="1" className="h-8 w-16 text-xs" />
          </div>
          {showSaveNext && (
            <Badge variant="secondary" className="text-xs ml-auto">
              Next: Q{paperQuestions.length + 1}
            </Badge>
          )}
        </div>

        <Textarea
          ref={showSaveNext ? questionTextRef : undefined}
          value={qForm.question_text}
          onChange={e => setQForm(f => ({ ...f, question_text: e.target.value }))}
          rows={2}
          placeholder="Enter question text... (press Ctrl+Enter to save)"
          className="text-sm"
          onKeyDown={e => {
            if (e.ctrlKey && e.key === 'Enter') { e.preventDefault(); onSubmit(e); }
          }}
        />

        {qForm.question_type === 'mcq' && (
          <div className="space-y-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {['A', 'B', 'C', 'D'].map(opt => (
                <div key={opt} className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setQForm(f => ({ ...f, correct_answer: opt }))}
                    className={`text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center shrink-0 border transition-colors ${
                      qForm.correct_answer === opt
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'border-input hover:border-primary/50'
                    }`}
                  >
                    {opt}
                  </button>
                  <Input
                    value={qForm[`option_${opt.toLowerCase()}` as keyof typeof qForm] as string}
                    onChange={e => setQForm(f => ({ ...f, [`option_${opt.toLowerCase()}`]: e.target.value }))}
                    placeholder={`Option ${opt}${opt <= 'B' ? ' *' : ''}`}
                    className="h-8 text-xs"
                  />
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">Click the letter circle to mark correct answer</p>
          </div>
        )}

        {qForm.question_type === 'descriptive' && (
          <Input
            value={qForm.correct_answer}
            onChange={e => setQForm(f => ({ ...f, correct_answer: e.target.value }))}
            placeholder="Model answer (optional)"
            className="h-8 text-xs"
          />
        )}

        <div className="flex gap-2">
          <Button type="submit" size="sm" className="flex-1" disabled={saving}>
            {saving && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
            {submitLabel}
          </Button>
        </div>
      </form>
    );

    return (
      <DashboardLayout sidebarItems={adminSidebarItems} roleColor="admin">
        <div className="space-y-4 animate-fade-in">
          <Button variant="ghost" size="sm" onClick={() => { setSelectedPaper(null); setSelectedExam(null); fetchData(); }}>
            <ChevronLeft className="h-4 w-4 mr-1" />Back to Papers
          </Button>

          {/* Header with stats */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h1 className="font-display text-xl font-bold">{selectedExam.exam_title}</h1>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <Badge variant="outline" className="text-xs">{getClassLabel(selectedPaper.class_id)}</Badge>
                <Badge variant="secondary" className="text-xs">{paperQuestions.length} questions</Badge>
                <Badge variant="secondary" className="text-xs">{totalMarks} marks</Badge>
                <Badge variant="outline" className="text-xs">{mcqCount} MCQ</Badge>
                <Badge variant="outline" className="text-xs">{descCount} Desc</Badge>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-xs">Rapid Mode</Label>
              <Switch checked={rapidMode} onCheckedChange={setRapidMode} />
              {rapidMode && <Zap className="h-4 w-4 text-primary" />}
            </div>
          </div>

          {/* Rapid entry form — always visible at top */}
          {rapidMode && (
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="py-4">
                <div className="flex items-center gap-2 mb-3">
                  <Zap className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">Quick Add</span>
                  <span className="text-xs text-muted-foreground">— Ctrl+Enter to save instantly</span>
                </div>
                <QuestionForm onSubmit={handleRapidAdd} submitLabel={`Save Q${paperQuestions.length + 1} & Next`} showSaveNext />
              </CardContent>
            </Card>
          )}

          {!rapidMode && (
            <Button onClick={() => { resetQForm(true); setEditDialogOpen(false); setRapidMode(true); }}>
              <Plus className="h-4 w-4 mr-2" />Add Question
            </Button>
          )}

          {/* Question list */}
          {paperQuestions.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground text-sm">
                No questions yet. {rapidMode ? 'Use the quick add form above.' : 'Click "Add Question" to start.'}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {/* Show hidden count */}
              {hiddenCount > 0 && (
                <Button variant="outline" size="sm" className="w-full text-xs" onClick={() => setCollapsedQuestions(false)}>
                  <ChevronUp className="h-3 w-3 mr-1" />Show all {paperQuestions.length} questions ({hiddenCount} hidden)
                </Button>
              )}
              {!collapsedQuestions && paperQuestions.length > 20 && (
                <Button variant="outline" size="sm" className="w-full text-xs" onClick={() => { setCollapsedQuestions(true); setShowCount(20); }}>
                  <ChevronDown className="h-3 w-3 mr-1" />Show only latest 20
                </Button>
              )}

              {visibleQuestions.map(q => (
                <div key={q.id} className="flex items-start gap-2 p-2.5 rounded-md border bg-card text-sm group hover:border-primary/30 transition-colors">
                  <span className="text-xs font-bold text-primary mt-0.5 w-8 shrink-0">Q{q.question_number}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm leading-snug">{q.question_text}</p>
                    {q.question_type === 'mcq' && (
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-xs text-muted-foreground">
                        {['A', 'B', 'C', 'D'].map(opt => {
                          const val = q[`option_${opt.toLowerCase()}` as keyof Question] as string | null;
                          if (!val) return null;
                          const isCorrect = q.correct_answer?.toUpperCase() === opt;
                          return (
                            <span key={opt} className={isCorrect ? 'text-primary font-semibold' : ''}>
                              {isCorrect && '✓'}{opt}. {val}
                            </span>
                          );
                        })}
                      </div>
                    )}
                    {q.correct_answer && q.question_type === 'descriptive' && (
                      <p className="text-xs text-muted-foreground mt-0.5">Ans: {q.correct_answer}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Badge variant={q.question_type === 'mcq' ? 'secondary' : 'outline'} className="text-[10px] h-5">{q.marks}m</Badge>
                    <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => openEditQuestion(q)}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-destructive" onClick={() => handleDeleteQuestion(q.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Edit Question Dialog */}
          <Dialog open={editDialogOpen} onOpenChange={v => { setEditDialogOpen(v); if (!v) resetQForm(); }}>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Edit Question {editingQuestion ? `#${editingQuestion.question_number}` : ''}</DialogTitle>
              </DialogHeader>
              <QuestionForm onSubmit={handleEditSave} submitLabel="Save Changes" />
            </DialogContent>
          </Dialog>
        </div>
      </DashboardLayout>
    );
  }

  // ============ PAPER LIST VIEW ============
  return (
    <DashboardLayout sidebarItems={adminSidebarItems} roleColor="admin">
      {loadingData ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : (
        <div className="space-y-6 animate-fade-in">
          <BackButton to="/admin" />
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="font-display text-2xl font-bold">Question Papers</h1>
              <p className="text-muted-foreground">Build question papers for weekly exams</p>
            </div>
            <Button onClick={() => { setPaperForm({ exam_id: '', class_id: '' }); setCreatePaperOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" />New Paper
            </Button>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search papers..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9" />
          </div>

          {filteredPapers.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                No question papers yet. Click "New Paper" to create one.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredPapers.map(paper => {
                const exam = getExamForPaper(paper.exam_id);
                const pQuestions = getQuestionsForPaper(paper.id);
                const mcqCount = pQuestions.filter(q => q.question_type === 'mcq').length;
                const descCount = pQuestions.filter(q => q.question_type === 'descriptive').length;
                return (
                  <Card key={paper.id} className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => openPaper(paper)}>
                    <CardContent className="py-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0 space-y-1.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <FileText className="h-4 w-4 text-primary shrink-0" />
                            <h3 className="font-medium text-sm">{exam?.exam_title || 'Unknown Exam'}</h3>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className="text-xs">{getClassLabel(paper.class_id)}</Badge>
                            <Badge variant="secondary" className="text-xs">{paper.total_questions} Q</Badge>
                            <Badge variant="secondary" className="text-xs">{paper.total_marks} marks</Badge>
                            {mcqCount > 0 && <Badge variant="outline" className="text-xs">{mcqCount} MCQ</Badge>}
                            {descCount > 0 && <Badge variant="outline" className="text-xs">{descCount} Desc</Badge>}
                          </div>
                        </div>
                        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-destructive" onClick={(e) => { e.stopPropagation(); handleDeletePaper(paper.id); }}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          <Dialog open={createPaperOpen} onOpenChange={setCreatePaperOpen}>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>New Question Paper</DialogTitle></DialogHeader>
              <form onSubmit={handleCreatePaper} className="space-y-4">
                <div className="space-y-2">
                  <Label>Select Exam *</Label>
                  <Select value={paperForm.exam_id} onValueChange={v => {
                    const exam = exams.find(e => e.id === v);
                    setPaperForm({ exam_id: v, class_id: exam?.class_id || '' });
                  }}>
                    <SelectTrigger><SelectValue placeholder="Choose a weekly exam" /></SelectTrigger>
                    <SelectContent>
                      {availableExams.length === 0 ? (
                        <SelectItem value="_none" disabled>All exams have papers</SelectItem>
                      ) : (
                        availableExams.map(e => (
                          <SelectItem key={e.id} value={e.id}>
                            {e.exam_title} ({e.classes ? (e.classes.section ? `${e.classes.name}-${e.classes.section}` : e.classes.name) : '—'})
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit" className="w-full" disabled={!paperForm.exam_id}>Create Paper</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      )}
    </DashboardLayout>
  );
}
