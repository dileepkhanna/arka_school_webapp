import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { apiClient } from '@/lib/apiClient';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import {
  Loader2, Plus, Search, Calendar, Clock, BookOpen, MoreVertical,
  Pencil, Trash2, Bell, FileText, FlaskConical, GraduationCap, Tag, AlignLeft,
  CheckCircle2, Play, ArrowRight
} from 'lucide-react';

const getExamDateStatus = (examDate: string): { status: 'upcoming' | 'running' | 'completed'; label: string; color: string } => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [year, month, day] = examDate.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  date.setHours(0, 0, 0, 0);
  if (date > today) return { status: 'upcoming', label: 'Upcoming', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' };
  if (date.getTime() === today.getTime()) return { status: 'running', label: 'Running', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300' };
  return { status: 'completed', label: 'Completed', color: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' };
};
import { toast } from 'sonner';

interface WeeklyExam {
  id: string;
  class_id: string;
  subject_id: string | null;
  syllabus_type: string;
  cycle_id: string | null;
  week_number: number | null;
  exam_title: string;
  exam_date: string;
  exam_time: string;
  duration_minutes: number;
  total_marks: number;
  negative_marking: boolean;
  negative_marks_value: number;
  reminder_enabled: boolean;
  status: string;
  description: string | null;
  exam_type_label: string | null;
  created_at: string;
  classes?: { name: string; section: string } | null;
  subjects?: { name: string } | null;
}

interface SyllabusItem {
  id: string;
  chapter_name: string;
  topic_name: string;
  class_id: string;
  syllabus_type: string;
  exam_type: string | null;
  subjects?: { name: string } | null;
}

interface ExamSyllabusLink { id: string; exam_id: string; syllabus_id: string; }
interface ClassOption { id: string; name: string; section: string; }
interface SubjectOption { id: string; name: string; category: string | null; }
interface CycleOption { id: string; exam_type: string; cycle_number: number; is_active: boolean; }

export default function WeeklyExamsSection() {
  const { user } = useAuth();
  const [exams, setExams] = useState<WeeklyExam[]>([]);
  const [syllabus, setSyllabus] = useState<SyllabusItem[]>([]);
  const [examSyllabusLinks, setExamSyllabusLinks] = useState<ExamSyllabusLink[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [allSubjects, setAllSubjects] = useState<SubjectOption[]>([]);
  const [cycles, setCycles] = useState<CycleOption[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [examTypeTab, setExamTypeTab] = useState('competitive');
  const [searchQuery, setSearchQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [syllabusDialogOpen, setSyllabusDialogOpen] = useState(false);
  const [selectedExam, setSelectedExam] = useState<WeeklyExam | null>(null);
  const [selectedSyllabusIds, setSelectedSyllabusIds] = useState<string[]>([]);
  const [filterClass, setFilterClass] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  const [formData, setFormData] = useState({
    class_id: '', subject_id: '', cycle_id: '', week_number: '',
    exam_title: '', exam_date: '', exam_time: '09:00',
    duration_minutes: '60', total_marks: '100',
    negative_marking: false, negative_marks_value: '0',
    reminder_enabled: true, description: '', exam_type_label: 'General',
  });

  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    setLoadingData(true);
    try {
      const data = await apiClient.get<{
        exams: WeeklyExam[];
        syllabus: SyllabusItem[];
        links: ExamSyllabusLink[];
        classes: ClassOption[];
        subjects: SubjectOption[];
        cycles: CycleOption[];
      }>('/weekly-exams/data');

      setExams((data.exams || []) as WeeklyExam[]);
      setSyllabus((data.syllabus || []) as SyllabusItem[]);
      setExamSyllabusLinks((data.links || []) as ExamSyllabusLink[]);
      setClasses((data.classes || []) as ClassOption[]);
      setAllSubjects((data.subjects || []) as SubjectOption[]);
      setCycles((data.cycles || []) as CycleOption[]);
    } catch (error) {
      console.error('Failed to fetch weekly exams data', error);
      setExams([]);
      setSyllabus([]);
      setExamSyllabusLinks([]);
      setClasses([]);
      setAllSubjects([]);
      setCycles([]);
    }

    setLoadingData(false);
  }

  // Filter subjects based on exam type tab
  const filteredSubjects = useMemo(() => {
    return allSubjects.filter(s =>
      examTypeTab === 'general' ? s.category === 'general' : s.category === 'competitive'
    );
  }, [allSubjects, examTypeTab]);

  const resetForm = () => setFormData({
    class_id: '', subject_id: '', cycle_id: '', week_number: '',
    exam_title: '', exam_date: '', exam_time: '09:00',
    duration_minutes: '60', total_marks: '100',
    negative_marking: false, negative_marks_value: '0',
    reminder_enabled: true, description: '', exam_type_label: examTypeTab === 'competitive' ? 'JEE' : 'General',
  });

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.class_id || !formData.exam_title || !formData.exam_date) {
      toast.error('Please fill all required fields'); return;
    }
    const syllabusType = examTypeTab === 'general' ? 'general' : 'competitive';
    try {
      await apiClient.post('/weekly-exams', {
        class_id: formData.class_id,
        subject_id: formData.subject_id || null,
        syllabus_type: syllabusType,
        cycle_id: syllabusType === 'competitive' && formData.cycle_id ? formData.cycle_id : null,
        week_number: formData.week_number ? parseInt(formData.week_number) : null,
        exam_title: formData.exam_title,
        exam_date: formData.exam_date,
        exam_time: formData.exam_time,
        duration_minutes: parseInt(formData.duration_minutes),
        total_marks: parseInt(formData.total_marks),
        negative_marking: formData.negative_marking,
        negative_marks_value: formData.negative_marking ? parseFloat(formData.negative_marks_value) : 0,
        reminder_enabled: formData.reminder_enabled,
        description: formData.description || null,
        exam_type_label: formData.exam_type_label || null,
        status: 'scheduled',
        created_by: user?.id,
      });
    } catch (error: any) { toast.error(error.message || 'Failed to create exam'); return; }
    toast.success('Weekly exam created');
    setDialogOpen(false); resetForm(); fetchData();
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedExam) return;
    const syllabusType = examTypeTab === 'general' ? 'general' : 'competitive';
    try {
      await apiClient.put(`/weekly-exams/${selectedExam.id}`, {
        class_id: formData.class_id,
        subject_id: formData.subject_id || null,
        syllabus_type: syllabusType,
        cycle_id: syllabusType === 'competitive' && formData.cycle_id ? formData.cycle_id : null,
        week_number: formData.week_number ? parseInt(formData.week_number) : null,
        exam_title: formData.exam_title,
        exam_date: formData.exam_date,
        exam_time: formData.exam_time,
        duration_minutes: parseInt(formData.duration_minutes),
        total_marks: parseInt(formData.total_marks),
        negative_marking: formData.negative_marking,
        negative_marks_value: formData.negative_marking ? parseFloat(formData.negative_marks_value) : 0,
        reminder_enabled: formData.reminder_enabled,
        description: formData.description || null,
        exam_type_label: formData.exam_type_label || null,
      });
    } catch (error: any) { toast.error(error.message || 'Failed to update exam'); return; }
    toast.success('Exam updated');
    setEditDialogOpen(false); setSelectedExam(null); resetForm(); fetchData();
  }

  async function handleDelete(id: string) {
    try {
      await apiClient.delete(`/weekly-exams/${id}`);
    } catch (error: any) { toast.error(error.message || 'Failed to delete exam'); return; }
    toast.success('Exam deleted'); fetchData();
  }

  async function handleStatusChange(id: string, status: string) {
    try {
      await apiClient.put(`/weekly-exams/${id}/status`, { status });
    } catch (error: any) { toast.error(error.message || 'Failed to update status'); return; }
    toast.success(`Exam marked as ${status}`); fetchData();
  }

  function openEdit(exam: WeeklyExam) {
    setSelectedExam(exam);
    setFormData({
      class_id: exam.class_id,
      subject_id: exam.subject_id || '',
      cycle_id: exam.cycle_id || '',
      week_number: exam.week_number?.toString() || '',
      exam_title: exam.exam_title,
      exam_date: exam.exam_date,
      exam_time: exam.exam_time,
      duration_minutes: exam.duration_minutes.toString(),
      total_marks: exam.total_marks.toString(),
      negative_marking: exam.negative_marking,
      negative_marks_value: exam.negative_marks_value.toString(),
      reminder_enabled: exam.reminder_enabled,
      description: exam.description || '',
      exam_type_label: exam.exam_type_label || 'General',
    });
    setEditDialogOpen(true);
  }

  function openSyllabusAttach(exam: WeeklyExam) {
    setSelectedExam(exam);
    const linkedIds = examSyllabusLinks.filter(l => l.exam_id === exam.id).map(l => l.syllabus_id);
    setSelectedSyllabusIds(linkedIds);
    setSyllabusDialogOpen(true);
  }

  async function handleSaveSyllabusLinks() {
    if (!selectedExam) return;
    try {
      await apiClient.put(`/weekly-exams/${selectedExam.id}/syllabus-links`, { syllabus_ids: selectedSyllabusIds });
    } catch (error: any) { toast.error(error.message || 'Failed to save syllabus links'); return; }
    toast.success('Syllabus topics linked');
    setSyllabusDialogOpen(false); setSelectedExam(null); fetchData();
  }

  function toggleSyllabusSelection(id: string) {
    setSelectedSyllabusIds(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);
  }

  const filteredExams = useMemo(() => {
    return exams.filter(e => {
      if (e.syllabus_type !== (examTypeTab === 'general' ? 'general' : 'competitive')) return false;
      if (filterClass !== 'all' && e.class_id !== filterClass) return false;
      if (filterStatus !== 'all' && getExamDateStatus(e.exam_date).status !== filterStatus) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return e.exam_title.toLowerCase().includes(q) ||
          e.classes?.name?.toLowerCase().includes(q) ||
          e.subjects?.name?.toLowerCase().includes(q) || false;
      }
      return true;
    });
  }, [exams, examTypeTab, searchQuery, filterClass, filterStatus]);

  const getClassSyllabus = (classId: string, syllabusType: string) =>
    syllabus.filter(s => s.class_id === classId && s.syllabus_type === syllabusType);

  const getLinkedSyllabus = (examId: string) => {
    const linkedIds = examSyllabusLinks.filter(l => l.exam_id === examId).map(l => l.syllabus_id);
    return syllabus.filter(s => linkedIds.includes(s.id));
  };

  if (loadingData) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  const examTypeLabels = ['General', 'JEE', 'NEET', 'BITSAT', 'CET', 'OLYMPIAD'];

  const statusColors: Record<string, string> = {
    scheduled: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
    live: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
    completed: 'bg-muted text-muted-foreground',
  };

  const typeColors: Record<string, string> = {
    JEE: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    NEET: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    BITSAT: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
    CET: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
    OLYMPIAD: 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400',
    General: 'bg-muted text-muted-foreground',
  };

  const renderExamForm = (onSubmit: (e: React.FormEvent) => void, submitLabel: string) => (
    <form onSubmit={onSubmit} className="space-y-4">
      {/* Row 1: Class & Subject */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Class *</Label>
          <Select value={formData.class_id} onValueChange={v => setFormData(f => ({ ...f, class_id: v }))}>
            <SelectTrigger className="h-9"><SelectValue placeholder="Select class" /></SelectTrigger>
            <SelectContent>{classes.map(c => <SelectItem key={c.id} value={c.id}>{c.section ? `${c.name} - ${c.section}` : c.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Subject</Label>
          <Select value={formData.subject_id || 'none'} onValueChange={v => setFormData(f => ({ ...f, subject_id: v === 'none' ? '' : v }))}>
            <SelectTrigger className="h-9"><SelectValue placeholder="Select subject" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              {filteredSubjects.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Row 2: Exam Title & Type Label */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Exam Title *</Label>
          <Input className="h-9" value={formData.exam_title} onChange={e => setFormData(f => ({ ...f, exam_title: e.target.value }))} placeholder="e.g. Week 1 Physics Test" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Exam Type Label</Label>
          {(formData.exam_type_label === '__custom__' || (!examTypeLabels.includes(formData.exam_type_label) && formData.exam_type_label !== '')) ? (
            <div className="flex gap-2">
              <Input
                className="h-9 flex-1"
                value={formData.exam_type_label === '__custom__' ? '' : formData.exam_type_label}
                onChange={e => setFormData(f => ({ ...f, exam_type_label: e.target.value }))}
                placeholder="Enter custom name"

              />
              <Button type="button" variant="outline" size="sm" className="h-9 text-xs" onClick={() => setFormData(f => ({ ...f, exam_type_label: 'General' }))}>
                Cancel
              </Button>
            </div>
          ) : (
            <Select value={formData.exam_type_label} onValueChange={v => setFormData(f => ({ ...f, exam_type_label: v }))}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Select type" /></SelectTrigger>
              <SelectContent>
                {examTypeLabels.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                <SelectItem value="__custom__">+ Custom Name</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>
      </div>


      {/* Row 3: Date, Time, Duration */}
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Date *</Label>
          <Input className="h-9" type="date" value={formData.exam_date} onChange={e => setFormData(f => ({ ...f, exam_date: e.target.value }))} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Time</Label>
          <Input className="h-9" type="time" value={formData.exam_time} onChange={e => setFormData(f => ({ ...f, exam_time: e.target.value }))} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Duration</Label>
          <Input className="h-9" type="number" value={formData.duration_minutes} onChange={e => setFormData(f => ({ ...f, duration_minutes: e.target.value }))} min="10" placeholder="min" />
        </div>
      </div>

      {/* Row 4: Total Marks & Negative Marking */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Total Marks</Label>
          <Input className="h-9" type="number" value={formData.total_marks} onChange={e => setFormData(f => ({ ...f, total_marks: e.target.value }))} min="1" />
        </div>
        <div className="space-y-2 pt-1">
          <div className="flex items-center gap-2">
            <Switch checked={formData.negative_marking} onCheckedChange={v => setFormData(f => ({ ...f, negative_marking: v }))} />
            <Label className="text-xs">Negative Marking</Label>
          </div>
          {formData.negative_marking && (
            <Input className="h-9" type="number" step="0.25" value={formData.negative_marks_value} onChange={e => setFormData(f => ({ ...f, negative_marks_value: e.target.value }))} placeholder="e.g. 0.25" />
          )}
        </div>
      </div>

      {/* Description */}
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">Instructions / Description</Label>
        <Textarea
          value={formData.description}
          onChange={e => setFormData(f => ({ ...f, description: e.target.value }))}
          placeholder="Exam instructions, topics covered, or any notes for students..."
          rows={3}
          className="text-sm"
        />
      </div>

      {/* Reminder */}
      <div className="flex items-center gap-2">
        <Switch checked={formData.reminder_enabled} onCheckedChange={v => setFormData(f => ({ ...f, reminder_enabled: v }))} />
        <Label className="text-xs">Enable Reminder</Label>
        {formData.reminder_enabled && <Bell className="h-3.5 w-3.5 text-primary" />}
      </div>

      <Button type="submit" className="w-full">{submitLabel}</Button>
    </form>
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Create and manage weekly exams for competitive & general</p>
        <Button size="sm" onClick={() => { resetForm(); setDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-1.5" />Create Exam
        </Button>
      </div>

      {/* Type Tabs */}
      <Tabs value={examTypeTab} onValueChange={setExamTypeTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="general" className="flex items-center gap-1.5 text-xs sm:text-sm">
            <BookOpen className="h-4 w-4" />General
          </TabsTrigger>
          <TabsTrigger value="competitive" className="flex items-center gap-1.5 text-xs sm:text-sm">
            <FlaskConical className="h-4 w-4" />Competitive
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search exams..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9 h-9" />
        </div>
        <Select value={filterClass} onValueChange={setFilterClass}>
          <SelectTrigger className="w-full sm:w-[140px] h-9"><SelectValue placeholder="All Classes" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Classes</SelectItem>
            {classes.map(c => <SelectItem key={c.id} value={c.id}>{c.section ? `${c.name} - ${c.section}` : c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-full sm:w-[130px] h-9"><SelectValue placeholder="All Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="upcoming">Upcoming</SelectItem>
            <SelectItem value="running">Running</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Exam Cards */}
      {filteredExams.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          <GraduationCap className="h-10 w-10 mx-auto mb-2 opacity-40" />
          <p className="font-medium">No exams found</p>
          <p className="text-xs mt-1">Click "Create Exam" to get started</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-3">
          {filteredExams.map(exam => {
            const linked = getLinkedSyllabus(exam.id);
            return (
              <Card key={exam.id} className="overflow-hidden">
                <CardContent className="p-0">
                  {/* Colored top bar based on exam type */}
                  <div className="px-4 pt-3 pb-3 space-y-2.5">
                    {/* Title row */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h3 className="font-semibold text-sm leading-tight">{exam.exam_title}</h3>
                          {(() => {
                            const ds = getExamDateStatus(exam.exam_date);
                            return <Badge className={`text-[10px] px-1.5 py-0 ${ds.color}`}>{ds.label}</Badge>;
                          })()}
                        </div>

                        {/* Tags row */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {exam.exam_type_label && exam.exam_type_label !== 'General' && (
                            <Badge className={`text-[10px] px-1.5 py-0 ${typeColors[exam.exam_type_label] || typeColors['General']}`}>
                              <Tag className="h-2.5 w-2.5 mr-0.5" />{exam.exam_type_label}
                            </Badge>
                          )}
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                            {exam.classes ? (exam.classes.section ? `${exam.classes.name} - ${exam.classes.section}` : exam.classes.name) : '—'}
                          </Badge>
                          {exam.subjects && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                              {exam.subjects.name}
                            </Badge>
                          )}
                          {exam.week_number && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">W{exam.week_number}</Badge>
                          )}
                        </div>

                        {/* Info row */}
                        <div className="flex items-center gap-2.5 text-[11px] text-muted-foreground flex-wrap">
                          <span className="flex items-center gap-0.5">
                            <Calendar className="h-3 w-3" />
                            {new Date(exam.exam_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </span>
                          <span className="flex items-center gap-0.5">
                            <Clock className="h-3 w-3" />{exam.exam_time}
                          </span>
                          <span>{exam.duration_minutes}min</span>
                          <span>Marks: {exam.total_marks}</span>
                          {exam.negative_marking && <span className="text-destructive">-{exam.negative_marks_value}/wrong</span>}
                          {exam.reminder_enabled && <Bell className="h-3 w-3 text-primary" />}
                        </div>
                      </div>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0"><MoreVertical className="h-3.5 w-3.5" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openSyllabusAttach(exam)}><BookOpen className="h-4 w-4 mr-2" />Attach Syllabus</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openEdit(exam)}><Pencil className="h-4 w-4 mr-2" />Edit</DropdownMenuItem>
                          {exam.status === 'scheduled' && <DropdownMenuItem onClick={() => handleStatusChange(exam.id, 'live')}><FileText className="h-4 w-4 mr-2" />Mark Live</DropdownMenuItem>}
                          {exam.status === 'live' && <DropdownMenuItem onClick={() => handleStatusChange(exam.id, 'completed')}><FileText className="h-4 w-4 mr-2" />Mark Completed</DropdownMenuItem>}
                          <DropdownMenuItem onClick={() => handleDelete(exam.id)} className="text-destructive"><Trash2 className="h-4 w-4 mr-2" />Delete</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    {/* Description */}
                    {exam.description && (
                      <div className="bg-muted/40 rounded-md p-2.5">
                        <p className="text-xs text-muted-foreground flex items-start gap-1.5">
                          <AlignLeft className="h-3 w-3 mt-0.5 shrink-0" />
                          {exam.description}
                        </p>
                      </div>
                    )}

                    {/* Linked syllabus */}
                    {linked.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Syllabus Topics</p>
                        <div className="flex flex-wrap gap-1">
                          {linked.map(s => (
                            <Badge key={s.id} variant="outline" className="text-[10px] px-1.5 py-0 bg-background">
                              {s.subjects?.name}: {s.topic_name}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={dialogOpen} onOpenChange={v => { setDialogOpen(v); if (!v) resetForm(); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base">Create {examTypeTab === 'general' ? 'General' : 'Competitive'} Weekly Exam</DialogTitle>
          </DialogHeader>
          {renderExamForm(handleCreate, "Create Exam")}
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={v => { setEditDialogOpen(v); if (!v) { setSelectedExam(null); resetForm(); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base">Edit Exam</DialogTitle>
          </DialogHeader>
          {renderExamForm(handleEdit, "Save Changes")}
        </DialogContent>
      </Dialog>

      {/* Syllabus Attachment Dialog */}
      <Dialog open={syllabusDialogOpen} onOpenChange={v => { setSyllabusDialogOpen(v); if (!v) setSelectedExam(null); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base">Attach Syllabus Topics</DialogTitle>
          </DialogHeader>
          {selectedExam && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Select topics for <strong>{selectedExam.exam_title}</strong>
              </p>
              <div className="space-y-2 max-h-[50vh] overflow-y-auto">
                {getClassSyllabus(selectedExam.class_id, selectedExam.syllabus_type).length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">No syllabus topics found. Add topics in Syllabus Management first.</p>
                ) : (
                  getClassSyllabus(selectedExam.class_id, selectedExam.syllabus_type).map(s => (
                    <label key={s.id} className="flex items-start gap-3 p-2.5 rounded-md border cursor-pointer hover:bg-muted/50 transition-colors">
                      <Checkbox
                        checked={selectedSyllabusIds.includes(s.id)}
                        onCheckedChange={() => toggleSyllabusSelection(s.id)}
                        className="mt-0.5"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{s.chapter_name}</p>
                        <p className="text-xs text-muted-foreground">{s.topic_name}</p>
                        <div className="flex gap-1 mt-1">
                          <Badge variant="secondary" className="text-[10px]">{s.subjects?.name}</Badge>
                          {s.exam_type && <Badge variant="outline" className="text-[10px]">{s.exam_type}</Badge>}
                        </div>
                      </div>
                    </label>
                  ))
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{selectedSyllabusIds.length} selected</span>
                <Button size="sm" onClick={handleSaveSyllabusLinks}>Save</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
