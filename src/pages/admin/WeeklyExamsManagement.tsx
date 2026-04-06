import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { apiClient } from '@/lib/apiClient';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { adminSidebarItems } from '@/config/adminSidebar';
import { BackButton } from '@/components/ui/back-button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Loader2, Plus, Search, Calendar, Clock, BookOpen, MoreVertical, Pencil, Trash2, Bell, FileText, FlaskConical } from 'lucide-react';
import { toast } from 'sonner';

interface WeeklyExam {
  id: string;
  class_id: string;
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
  created_at: string;
  classes?: { name: string; section: string } | null;
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

interface ExamSyllabusLink {
  id: string;
  exam_id: string;
  syllabus_id: string;
}

interface ClassOption { id: string; name: string; section: string; }
interface CycleOption { id: string; exam_type: string; cycle_number: number; is_active: boolean; }

export default function WeeklyExamsManagement() {
  const { user, userRole, loading } = useAuth();
  const navigate = useNavigate();
  const [exams, setExams] = useState<WeeklyExam[]>([]);
  const [syllabus, setSyllabus] = useState<SyllabusItem[]>([]);
  const [examSyllabusLinks, setExamSyllabusLinks] = useState<ExamSyllabusLink[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [cycles, setCycles] = useState<CycleOption[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [activeTab, setActiveTab] = useState('general');
  const [searchQuery, setSearchQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [syllabusDialogOpen, setSyllabusDialogOpen] = useState(false);
  const [selectedExam, setSelectedExam] = useState<WeeklyExam | null>(null);
  const [selectedSyllabusIds, setSelectedSyllabusIds] = useState<string[]>([]);

  const [formData, setFormData] = useState({
    class_id: '',
    cycle_id: '',
    week_number: '',
    exam_title: '',
    exam_date: '',
    exam_time: '09:00',
    duration_minutes: '60',
    total_marks: '100',
    negative_marking: false,
    negative_marks_value: '0',
    reminder_enabled: true,
  });

  useEffect(() => {
    if (!loading && (!user || userRole !== 'admin')) navigate('/auth');
  }, [user, userRole, loading, navigate]);

  useEffect(() => { fetchData(); }, []);

async function fetchData() {
    setLoadingData(true);
    try {
      const data = await apiClient.get<{
        exams: WeeklyExam[];
        syllabus: SyllabusItem[];
        links: ExamSyllabusLink[];
        classes: ClassOption[];
        cycles: CycleOption[];
      }>('/weekly-exams/data');
      setExams((data.exams || []) as WeeklyExam[]);
      setSyllabus((data.syllabus || []) as SyllabusItem[]);
      setExamSyllabusLinks((data.links || []) as ExamSyllabusLink[]);
      setClasses((data.classes || []) as ClassOption[]);
      setCycles((data.cycles || []) as CycleOption[]);
    } catch (error) {
      console.error('Failed to fetch weekly exam data', error);
      setExams([]);
      setSyllabus([]);
      setExamSyllabusLinks([]);
      setClasses([]);
      setCycles([]);
    }

    setLoadingData(false);
  }

  const resetForm = () => setFormData({
    class_id: '', cycle_id: '', week_number: '', exam_title: '', exam_date: '',
    exam_time: '09:00', duration_minutes: '60', total_marks: '100',
    negative_marking: false, negative_marks_value: '0', reminder_enabled: true,
  });

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.class_id || !formData.exam_title || !formData.exam_date) {
      toast.error('Please fill all required fields');
      return;
    }
    const syllabusType = activeTab === 'general' ? 'general' : 'competitive';
    try {
      await apiClient.post('/weekly-exams', {
      class_id: formData.class_id,
      subject_id: null,
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
      status: 'scheduled',
      created_by: user?.id,
    });
    } catch (error: any) {
      toast.error(error.message || 'Failed to create exam');
      return;
    }

    toast.success('Weekly exam created');
    setDialogOpen(false);
    resetForm();
    fetchData();
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedExam) return;
    const syllabusType = activeTab === 'general' ? 'general' : 'competitive';
    try {
      await apiClient.put(`/weekly-exams/${selectedExam.id}`, {
      class_id: formData.class_id,
      subject_id: null,
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
    });
    } catch (error: any) {
      toast.error(error.message || 'Failed to update exam');
      return;
    }

    toast.success('Exam updated');
    setEditDialogOpen(false);
    setSelectedExam(null);
    resetForm();
    fetchData();
  }

  async function handleDelete(id: string) {
    try {
      await apiClient.delete(`/weekly-exams/${id}`);
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete exam');
      return;
    }

    toast.success('Exam deleted');
    fetchData();
  }

  async function handleStatusChange(id: string, status: string) {
    try {
      await apiClient.put(`/weekly-exams/${id}/status`, { status });
    } catch (error: any) {
      toast.error(error.message || 'Failed to update status');
      return;
    }

    toast.success(`Exam marked as ${status}`);
    fetchData();
  }

  function openEdit(exam: WeeklyExam) {
    setSelectedExam(exam);
    setFormData({
      class_id: exam.class_id,
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
      await apiClient.put(`/weekly-exams/${selectedExam.id}/syllabus-links`, {
        syllabus_ids: selectedSyllabusIds,
      });
    } catch (error: any) {
      toast.error(error.message || 'Failed to save syllabus links');
      return;
    }

    toast.success('Syllabus topics linked');
    setSyllabusDialogOpen(false);
    setSelectedExam(null);
    fetchData();
  }

  function toggleSyllabusSelection(id: string) {
    setSelectedSyllabusIds(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  }

  const filteredExams = useMemo(() => {
    return exams.filter(e => {
      if (e.syllabus_type !== (activeTab === 'general' ? 'general' : 'competitive')) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return e.exam_title.toLowerCase().includes(q) ||
               e.classes?.name?.toLowerCase().includes(q) || false;
      }
      return true;
    });
  }, [exams, activeTab, searchQuery]);

  // Get syllabus for a specific exam's class & type
  const getClassSyllabus = (classId: string, syllabusType: string) =>
    syllabus.filter(s => s.class_id === classId && s.syllabus_type === syllabusType);

  const getLinkedSyllabus = (examId: string) => {
    const linkedIds = examSyllabusLinks.filter(l => l.exam_id === examId).map(l => l.syllabus_id);
    return syllabus.filter(s => linkedIds.includes(s.id));
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  const renderExamForm = (onSubmit: (e: React.FormEvent) => void, submitLabel: string) => (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Class *</Label>
          <Select value={formData.class_id} onValueChange={v => setFormData(f => ({ ...f, class_id: v }))}>
            <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
            <SelectContent>
              {classes.map(c => <SelectItem key={c.id} value={c.id}>{c.section ? `${c.name} - ${c.section}` : c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Exam Title *</Label>
          <Input value={formData.exam_title} onChange={e => setFormData(f => ({ ...f, exam_title: e.target.value }))} placeholder="e.g. Week 1 Physics Test" />
        </div>
      </div>

      {activeTab === 'competitive' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Exam Cycle</Label>
            <Select value={formData.cycle_id} onValueChange={v => setFormData(f => ({ ...f, cycle_id: v }))}>
              <SelectTrigger><SelectValue placeholder="Select cycle" /></SelectTrigger>
              <SelectContent>
                {cycles.map(c => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.exam_type} - Cycle #{c.cycle_number} {c.is_active ? '(Active)' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Week Number</Label>
            <Select value={formData.week_number} onValueChange={v => setFormData(f => ({ ...f, week_number: v }))}>
              <SelectTrigger><SelectValue placeholder="Select week" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Week 1</SelectItem>
                <SelectItem value="2">Week 2</SelectItem>
                <SelectItem value="3">Week 3</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>Exam Date *</Label>
          <Input type="date" value={formData.exam_date} onChange={e => setFormData(f => ({ ...f, exam_date: e.target.value }))} />
        </div>
        <div className="space-y-2">
          <Label>Exam Time</Label>
          <Input type="time" value={formData.exam_time} onChange={e => setFormData(f => ({ ...f, exam_time: e.target.value }))} />
        </div>
        <div className="space-y-2">
          <Label>Duration (min)</Label>
          <Input type="number" value={formData.duration_minutes} onChange={e => setFormData(f => ({ ...f, duration_minutes: e.target.value }))} min="10" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Total Marks</Label>
          <Input type="number" value={formData.total_marks} onChange={e => setFormData(f => ({ ...f, total_marks: e.target.value }))} min="1" />
        </div>
        <div className="space-y-3 pt-1">
          <div className="flex items-center gap-2">
            <Switch checked={formData.negative_marking} onCheckedChange={v => setFormData(f => ({ ...f, negative_marking: v }))} />
            <Label>Negative Marking</Label>
          </div>
          {formData.negative_marking && (
            <Input type="number" step="0.25" value={formData.negative_marks_value} onChange={e => setFormData(f => ({ ...f, negative_marks_value: e.target.value }))} placeholder="e.g. 0.25" />
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Switch checked={formData.reminder_enabled} onCheckedChange={v => setFormData(f => ({ ...f, reminder_enabled: v }))} />
        <Label>Enable Reminder</Label>
        {formData.reminder_enabled && <Bell className="h-4 w-4 text-primary" />}
      </div>

      <Button type="submit" className="w-full">{submitLabel}</Button>
    </form>
  );

  return (
    <DashboardLayout sidebarItems={adminSidebarItems} roleColor="admin">
      {loadingData ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : (
        <div className="space-y-6 animate-fade-in">
          <BackButton to="/admin" />
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="font-display text-2xl font-bold">Weekly Exams</h1>
              <p className="text-muted-foreground">Create and manage weekly exams with syllabus</p>
            </div>
            <Button onClick={() => { resetForm(); setDialogOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" />Create Exam
            </Button>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="general" className="flex items-center gap-1.5">
                <BookOpen className="h-4 w-4" />General
              </TabsTrigger>
              <TabsTrigger value="competitive" className="flex items-center gap-1.5">
                <FlaskConical className="h-4 w-4" />Competitive
              </TabsTrigger>
            </TabsList>

            <div className="relative mt-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search exams..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9" />
            </div>

            <TabsContent value="general" className="mt-4">
              <ExamList exams={filteredExams} getLinkedSyllabus={getLinkedSyllabus} onEdit={openEdit} onDelete={handleDelete} onStatusChange={handleStatusChange} onAttachSyllabus={openSyllabusAttach} />
            </TabsContent>
            <TabsContent value="competitive" className="mt-4">
              <ExamList exams={filteredExams} getLinkedSyllabus={getLinkedSyllabus} onEdit={openEdit} onDelete={handleDelete} onStatusChange={handleStatusChange} onAttachSyllabus={openSyllabusAttach} showCycleInfo />
            </TabsContent>
          </Tabs>

          {/* Create Dialog */}
          <Dialog open={dialogOpen} onOpenChange={v => { setDialogOpen(v); if (!v) resetForm(); }}>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create {activeTab === 'general' ? 'General' : 'Competitive'} Weekly Exam</DialogTitle>
              </DialogHeader>
              {renderExamForm(handleCreate, "Create Exam")}
            </DialogContent>
          </Dialog>

          {/* Edit Dialog */}
          <Dialog open={editDialogOpen} onOpenChange={v => { setEditDialogOpen(v); if (!v) { setSelectedExam(null); resetForm(); } }}>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Edit Exam</DialogTitle>
              </DialogHeader>
              {renderExamForm(handleEdit, "Save Changes")}
            </DialogContent>
          </Dialog>

          {/* Syllabus Attachment Dialog */}
          <Dialog open={syllabusDialogOpen} onOpenChange={v => { setSyllabusDialogOpen(v); if (!v) setSelectedExam(null); }}>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Attach Syllabus Topics</DialogTitle>
              </DialogHeader>
              {selectedExam && (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Select syllabus topics covered in <strong>{selectedExam.exam_title}</strong>
                  </p>
                  <div className="space-y-2 max-h-[50vh] overflow-y-auto">
                    {getClassSyllabus(selectedExam.class_id, selectedExam.syllabus_type).length === 0 ? (
                      <p className="text-sm text-muted-foreground py-4 text-center">No syllabus topics found for this class. Add topics in Syllabus Management first.</p>
                    ) : (
                      getClassSyllabus(selectedExam.class_id, selectedExam.syllabus_type).map(s => (
                        <label key={s.id} className="flex items-start gap-3 p-3 rounded-md border cursor-pointer hover:bg-muted/50 transition-colors">
                          <Checkbox
                            checked={selectedSyllabusIds.includes(s.id)}
                            onCheckedChange={() => toggleSyllabusSelection(s.id)}
                            className="mt-0.5"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">{s.chapter_name}</p>
                            <p className="text-xs text-muted-foreground">{s.topic_name}</p>
                            <div className="flex gap-1.5 mt-1">
                              <Badge variant="secondary" className="text-xs">{s.subjects?.name}</Badge>
                              {s.exam_type && <Badge variant="outline" className="text-xs">{s.exam_type}</Badge>}
                            </div>
                          </div>
                        </label>
                      ))
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">{selectedSyllabusIds.length} topics selected</span>
                    <Button onClick={handleSaveSyllabusLinks}>Save</Button>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>
      )}
    </DashboardLayout>
  );
}

function ExamList({ exams, getLinkedSyllabus, onEdit, onDelete, onStatusChange, onAttachSyllabus, showCycleInfo = false }: {
  exams: WeeklyExam[];
  getLinkedSyllabus: (examId: string) => SyllabusItem[];
  onEdit: (e: WeeklyExam) => void;
  onDelete: (id: string) => void;
  onStatusChange: (id: string, status: string) => void;
  onAttachSyllabus: (e: WeeklyExam) => void;
  showCycleInfo?: boolean;
}) {
  if (exams.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          No exams found. Click "Create Exam" to get started.
        </CardContent>
      </Card>
    );
  }

const statusColors: Record<string, string> = {
    scheduled: 'bg-muted text-muted-foreground',
    live: 'bg-primary/10 text-primary',
    completed: 'bg-secondary text-secondary-foreground',
};

const formatClassLabel = (exam: { classes?: { name: string; section: string } | null }) => exam.classes
  ? (exam.classes.section ? `${exam.classes.name} - ${exam.classes.section}` : exam.classes.name)
  : '—';

  return (
    <div className="space-y-3">
      {exams.map(exam => {
        const linked = getLinkedSyllabus(exam.id);
        return (
          <Card key={exam.id}>
            <CardContent className="py-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-medium text-sm">{exam.exam_title}</h3>
                    <Badge className={`text-xs ${statusColors[exam.status] || ''}`}>
                      {exam.status}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-xs">
                      {formatClassLabel(exam)}
                    </Badge>
                    {exam.week_number && (
                      <Badge variant="secondary" className="text-xs">Week {exam.week_number}</Badge>
                    )}
                    {exam.reminder_enabled && (
                      <Bell className="h-3 w-3 text-primary" />
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                    <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{new Date(exam.exam_date).toLocaleDateString()}</span>
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{exam.exam_time}</span>
                    <span>{exam.duration_minutes} min</span>
                    <span>Max: {exam.total_marks}</span>
                    {exam.negative_marking && <span>-{exam.negative_marks_value} per wrong</span>}
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onAttachSyllabus(exam)}>
                      <BookOpen className="h-4 w-4 mr-2" />Attach Syllabus
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onEdit(exam)}>
                      <Pencil className="h-4 w-4 mr-2" />Edit
                    </DropdownMenuItem>
                    {exam.status === 'scheduled' && (
                      <DropdownMenuItem onClick={() => onStatusChange(exam.id, 'live')}>
                        <FileText className="h-4 w-4 mr-2" />Mark Live
                      </DropdownMenuItem>
                    )}
                    {exam.status === 'live' && (
                      <DropdownMenuItem onClick={() => onStatusChange(exam.id, 'completed')}>
                        <FileText className="h-4 w-4 mr-2" />Mark Completed
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={() => onDelete(exam.id)} className="text-destructive">
                      <Trash2 className="h-4 w-4 mr-2" />Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Linked syllabus topics */}
              {linked.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Syllabus Coverage:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {linked.map(s => (
                      <Badge key={s.id} variant="outline" className="text-xs">
                        {s.subjects?.name}: {s.topic_name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
