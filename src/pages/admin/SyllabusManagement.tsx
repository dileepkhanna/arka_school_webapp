import { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { apiClient } from '@/lib/apiClient';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { adminSidebarItems } from '@/config/adminSidebar';
import { BackButton } from '@/components/ui/back-button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Plus, BookOpen, FlaskConical, Search, MoreVertical, Pencil, Trash2, Calendar, Clock, Users, ChevronDown, ChevronUp, UserPlus, X, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface SyllabusItem {
  id: string;
  class_id: string;
  subject_id: string;
  syllabus_type: string;
  exam_type: string | null;
  chapter_name: string;
  topic_name: string;
  week_number: number | null;
  schedule_date: string | null;
  schedule_time: string | null;
  start_date: string | null;
  end_date: string | null;
  completed_at: string | null;
  completed_by: string | null;
  classes?: { name: string; section: string } | null;
  subjects?: { name: string } | null;
}

interface ClassOption { id: string; name: string; section: string; academic_type: string; }
interface SubjectOption { id: string; name: string; category: string; exam_type: string | null; }
interface TeacherOption { id: string; user_id: string; fullName?: string; }
interface TeacherMapping { id: string; teacher_id: string; syllabus_id: string; role_type: string; teacherName?: string; }

interface SyllabusManagementData {
  syllabus: SyllabusItem[];
  classes: ClassOption[];
  subjects: SubjectOption[];
  teachers: TeacherOption[];
  teacherMappings: TeacherMapping[];
  completedByNames: Record<string, string>;
}

const COMPETITIVE_EXAM_TYPES = ['JEE', 'NEET', 'BITSAT'];
const GENERAL_EXAM_TYPES = [
  'Unit Test 1', 'Unit Test 2', 'Quarterly Exam', 'Mid-Term Exam',
  'Half Yearly Exam', 'Pre-Final Exam', 'Annual Exam',
];
const ROLE_TYPES = [
  { value: 'lead', label: 'Lead Faculty' },
  { value: 'practice', label: 'Practice Faculty' },
  { value: 'doubt', label: 'Doubt Faculty' },
];

const roleTypeLabel = (roleType: string) => ROLE_TYPES.find((role) => role.value === roleType)?.label || roleType;

export default function SyllabusManagement() {
  const { user, userRole, loading } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('general');
  const [syllabus, setSyllabus] = useState<SyllabusItem[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [teachers, setTeachers] = useState<TeacherOption[]>([]);
  const [teacherMappings, setTeacherMappings] = useState<TeacherMapping[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterClass, setFilterClass] = useState('all');
  const [filterSubject, setFilterSubject] = useState('all');
  const [filterExam, setFilterExam] = useState('all');
  const [customExamGeneral, setCustomExamGeneral] = useState('');
  const [customExamCompetitive, setCustomExamCompetitive] = useState('');
  const [useCustomExam, setUseCustomExam] = useState(false);
  const [completedByNames, setCompletedByNames] = useState<Record<string, string>>({});

  // Inline add form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    class_id: '', subject_id: '', exam_type: '', chapter_name: '', topic_name: '',
    week_number: '', schedule_date: '', schedule_time: '', start_date: '', end_date: '',
  });
  // Teacher assignments during creation
  const [pendingTeachers, setPendingTeachers] = useState<{ teacher_id: string; role_type: string }[]>([]);

  // Edit & teacher dialog
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [teacherDialogOpen, setTeacherDialogOpen] = useState(false);
  const [selectedSyllabus, setSelectedSyllabus] = useState<SyllabusItem | null>(null);
  const [teacherForm, setTeacherForm] = useState({ teacher_id: '', role_type: 'lead' });

  // Bulk add mode
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkTopics, setBulkTopics] = useState('');

  useEffect(() => {
    if (!loading && (!user || userRole !== 'admin')) navigate('/auth');
  }, [user, userRole, loading, navigate]);

  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    setLoadingData(true);
    try {
      const data = await apiClient.get<SyllabusManagementData>('/admin/syllabus/data');
      setSyllabus(data.syllabus || []);
      setClasses(data.classes || []);
      setSubjects(data.subjects || []);
      setTeachers(data.teachers || []);
      setTeacherMappings(data.teacherMappings || []);
      setCompletedByNames(data.completedByNames || {});
    } catch (error: any) {
      toast.error(error.message || 'Failed to load syllabus data');
    } finally {
      setLoadingData(false);
    }
  }

  const resetForm = useCallback(() => {
    setFormData({ class_id: '', subject_id: '', exam_type: '', chapter_name: '', topic_name: '', week_number: '', schedule_date: '', schedule_time: '', start_date: '', end_date: '' });
    setPendingTeachers([]);
    setBulkTopics('');
    setBulkMode(false);
  }, []);

  // Add a pending teacher to the inline form
  function addPendingTeacher() {
    if (!teacherForm.teacher_id) return;
    if (pendingTeachers.some(pt => pt.teacher_id === teacherForm.teacher_id && pt.role_type === teacherForm.role_type)) {
      toast.error('Teacher already added with this role');
      return;
    }
    setPendingTeachers(prev => [...prev, { teacher_id: teacherForm.teacher_id, role_type: teacherForm.role_type }]);
    setTeacherForm({ teacher_id: '', role_type: 'lead' });
  }

  function removePendingTeacher(idx: number) {
    setPendingTeachers(prev => prev.filter((_, i) => i !== idx));
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.class_id || !formData.subject_id) {
      toast.error('Please fill Class and Subject');
      return;
    }

    setSaving(true);
    const syllabusType = activeTab === 'general' ? 'general' : 'competitive';

    try {
      if (bulkMode) {
        // Bulk: each line is a topic
        const topics = bulkTopics.split('\n').map(t => t.trim()).filter(Boolean);
        if (topics.length === 0) { toast.error('Enter at least one topic'); setSaving(false); return; }

        const rows = topics.map((topic, idx) => ({
          class_id: formData.class_id,
          subject_id: formData.subject_id,
          syllabus_type: syllabusType,
          exam_type: formData.exam_type || null,
          chapter_name: formData.chapter_name,
          topic_name: topic,
          week_number: formData.week_number ? parseInt(formData.week_number) + idx : null,
          schedule_date: formData.schedule_date || null,
          schedule_time: formData.schedule_time || null,
          start_date: formData.start_date || null,
          end_date: formData.end_date || null,
        }));

        await apiClient.post('/admin/syllabus/bulk', {
          rows: rows.map((row) => ({
            ...row,
            class_id: Number(row.class_id),
            subject_id: Number(row.subject_id),
          })),
          pending_teachers: pendingTeachers.map((pt) => ({
            teacher_id: Number(pt.teacher_id),
            role_type: pt.role_type,
          })),
        });

        toast.success(`${topics.length} topics added!`);
      } else {
        if (!formData.topic_name) { toast.error('Enter topic name'); setSaving(false); return; }

        await apiClient.post('/admin/syllabus', {
          class_id: Number(formData.class_id),
          subject_id: Number(formData.subject_id),
          syllabus_type: syllabusType,
          exam_type: formData.exam_type || null,
          chapter_name: formData.chapter_name,
          topic_name: formData.topic_name,
          week_number: formData.week_number ? parseInt(formData.week_number) : null,
          schedule_date: formData.schedule_date || null,
          schedule_time: formData.schedule_time || null,
          start_date: formData.start_date || null,
          end_date: formData.end_date || null,
          pending_teachers: pendingTeachers.map((pt) => ({
            teacher_id: Number(pt.teacher_id),
            role_type: pt.role_type,
          })),
        });

        toast.success('Topic added!');
      }

      // Keep class & subject for next entry, clear topic
      setFormData(f => ({ ...f, chapter_name: f.chapter_name, topic_name: '', week_number: f.week_number ? String(Number(f.week_number) + (bulkMode ? bulkTopics.split('\n').filter(Boolean).length : 1)) : '' }));
      setPendingTeachers([]);
      setBulkTopics('');

      // Auto-focus filters to newly added context for immediate visibility
      setFilterClass(formData.class_id);
      setFilterSubject(formData.subject_id);
      setFilterExam(formData.exam_type || 'all');

      await fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to add syllabus');
    } finally {
      setSaving(false);
    }
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedSyllabus) return;
    const syllabusType = activeTab === 'general' ? 'general' : 'competitive';
    try {
      await apiClient.put(`/admin/syllabus/${selectedSyllabus.id}`, {
      class_id: Number(formData.class_id), subject_id: Number(formData.subject_id),
      syllabus_type: syllabusType,
      exam_type: formData.exam_type || null,
      chapter_name: formData.chapter_name, topic_name: formData.topic_name,
      week_number: formData.week_number ? parseInt(formData.week_number) : null,
      schedule_date: formData.schedule_date || null, schedule_time: formData.schedule_time || null,
      start_date: formData.start_date || null, end_date: formData.end_date || null,
      });
    } catch (error: any) { toast.error(error.message); return; }
    toast.success('Syllabus updated');
    setEditDialogOpen(false); setSelectedSyllabus(null); resetForm(); fetchData();
  }

  async function handleDelete(id: string) {
    try {
      await apiClient.delete(`/admin/syllabus/${id}`);
    } catch (error: any) { toast.error(error.message); return; }
    toast.success('Topic deleted');
    fetchData();
  }

  function openEdit(item: SyllabusItem) {
    setSelectedSyllabus(item);
    setFormData({
      class_id: item.class_id, subject_id: item.subject_id, exam_type: item.exam_type || '',
      chapter_name: item.chapter_name, topic_name: item.topic_name,
      week_number: item.week_number?.toString() || '', schedule_date: item.schedule_date || '',
      schedule_time: item.schedule_time || '', start_date: item.start_date || '', end_date: item.end_date || '',
    });
    setEditDialogOpen(true);
  }

  function openTeacherMapping(item: SyllabusItem) {
    setSelectedSyllabus(item);
    setTeacherForm({ teacher_id: '', role_type: 'lead' });
    setTeacherDialogOpen(true);
  }

  async function handleAssignTeacher(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedSyllabus || !teacherForm.teacher_id) { toast.error('Select a teacher'); return; }
    try {
      await apiClient.post(`/admin/syllabus/${selectedSyllabus.id}/teachers`, {
        teacher_id: Number(teacherForm.teacher_id),
        role_type: teacherForm.role_type,
      });
    } catch (error: any) { toast.error(error.message); return; }
    toast.success('Teacher assigned'); fetchData();
    setTeacherForm({ teacher_id: '', role_type: 'lead' });
  }

  async function handleRemoveTeacher(mappingId: string) {
    try {
      await apiClient.delete(`/admin/syllabus/teachers/${mappingId}`);
    } catch (error: any) { toast.error(error.message); return; }
    toast.success('Teacher removed'); fetchData();
  }

  const examTypeOptions = useMemo(() => {
    const types = new Set<string>();
    syllabus.forEach(s => { if (s.exam_type) types.add(s.exam_type); });
    return [...types].sort();
  }, [syllabus]);

  const filteredSyllabus = useMemo(() => {
    return syllabus.filter(s => {
      if (s.syllabus_type !== (activeTab === 'general' ? 'general' : 'competitive')) return false;
      if (filterClass !== 'all' && s.class_id !== filterClass) return false;
      if (filterSubject !== 'all' && s.subject_id !== filterSubject) return false;
      if (filterExam !== 'all' && s.exam_type !== filterExam) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const mappingText = teacherMappings
          .filter(m => m.syllabus_id === s.id)
          .map(m => `${m.teacherName || ''} ${m.role_type} ${roleTypeLabel(m.role_type)}`.toLowerCase())
          .join(' ');

        return s.chapter_name.toLowerCase().includes(q)
          || s.topic_name.toLowerCase().includes(q)
          || s.subjects?.name?.toLowerCase().includes(q)
          || s.classes?.name?.toLowerCase().includes(q)
          || s.classes?.section?.toLowerCase().includes(q)
          || (s.exam_type || '').toLowerCase().includes(q)
          || mappingText.includes(q)
          || false;
      }
      return true;
    });
  }, [syllabus, activeTab, filterClass, filterSubject, filterExam, searchQuery, teacherMappings]);

  const filteredSubjects = useMemo(() => {
    if (activeTab === 'general') return subjects.filter(s => s.category === 'general' || !s.category);
    return subjects.filter(s => s.category === 'competitive');
  }, [subjects, activeTab]);

  const groupedSyllabus = useMemo(() => {
    const groups: Record<string, SyllabusItem[]> = {};
    filteredSyllabus.forEach(s => {
      const classLabel = s.classes?.section ? `${s.classes.name}-${s.classes.section}` : (s.classes?.name || '');
      const key = `${classLabel} | ${s.subjects?.name || ''} | ${s.exam_type || 'Unassigned'} | ${s.chapter_name}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(s);
    });
    return groups;
  }, [filteredSyllabus]);

  const getTeacherName = useCallback((teacherId: string) => {
    return teachers.find(t => t.id === teacherId)?.fullName || 'Unknown';
  }, [teachers]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <DashboardLayout sidebarItems={adminSidebarItems} roleColor="admin">
      {loadingData ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : (
        <div className="space-y-3 sm:space-y-6 animate-fade-in px-0">
          <BackButton to="/admin" />
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="font-display text-lg sm:text-2xl font-bold flex items-center gap-1.5 sm:gap-2">
                <BookOpen className="h-4 w-4 sm:h-6 sm:w-6 text-primary" /> Syllabus Management
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground">Manage general & competitive syllabus like a timetable</p>
            </div>
            <Button size="sm" className="sm:size-default" onClick={() => { setShowAddForm(!showAddForm); if (!showAddForm) resetForm(); }}>
              {showAddForm ? <X className="h-4 w-4 mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
              {showAddForm ? 'Close' : 'Add Syllabus'}
            </Button>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2 h-8 sm:h-10">
              <TabsTrigger value="general" className="flex items-center gap-1 text-[10px] sm:text-sm">
                <BookOpen className="h-3 w-3 sm:h-4 sm:w-4" />General
              </TabsTrigger>
              <TabsTrigger value="competitive" className="flex items-center gap-1 text-[10px] sm:text-sm">
                <FlaskConical className="h-3 w-3 sm:h-4 sm:w-4" />Competitive
              </TabsTrigger>
            </TabsList>

            {/* ---- INLINE ADD FORM ---- */}
            {showAddForm && (
              <Card className="mt-4 border-primary/30 bg-primary/5">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Plus className="h-4 w-4 text-primary" />
                    Quick Add {activeTab === 'general' ? 'General' : 'Competitive'} Syllabus
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleCreate} className="space-y-4">
                    {/* Step 1: Class & Subject */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Class *</Label>
                        <Select value={formData.class_id} onValueChange={v => setFormData(f => ({ ...f, class_id: v }))}>
                          <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
                          <SelectContent>
                            {classes.map(c => <SelectItem key={c.id} value={c.id}>{c.section ? `${c.name} - ${c.section}` : c.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Subject *</Label>
                        <Select value={formData.subject_id} onValueChange={v => setFormData(f => ({ ...f, subject_id: v }))}>
                          <SelectTrigger><SelectValue placeholder="Select subject" /></SelectTrigger>
                          <SelectContent>
                            {filteredSubjects.map(s => (
                              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                     {activeTab === 'general' && (
                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Exam *</Label>
                          {useCustomExam ? (
                            <div className="flex gap-2">
                              <Input
                                value={customExamGeneral}
                                onChange={e => { setCustomExamGeneral(e.target.value); setFormData(f => ({ ...f, exam_type: e.target.value })); }}
                                placeholder="Enter custom exam name"
                              />
                              <Button type="button" variant="ghost" size="sm" onClick={() => { setUseCustomExam(false); setCustomExamGeneral(''); setFormData(f => ({ ...f, exam_type: '' })); }}>
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ) : (
                            <div className="flex gap-2">
                              <Select value={formData.exam_type} onValueChange={v => setFormData(f => ({ ...f, exam_type: v }))}>
                                <SelectTrigger><SelectValue placeholder="Select exam" /></SelectTrigger>
                                <SelectContent>
                                  {GENERAL_EXAM_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                                </SelectContent>
                              </Select>
                              <Button type="button" variant="outline" size="sm" className="shrink-0 text-xs" onClick={() => setUseCustomExam(true)}>
                                Custom
                              </Button>
                            </div>
                          )}
                        </div>
                      )}
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Start Date</Label>
                        <Input type="date" value={formData.start_date} onChange={e => setFormData(f => ({ ...f, start_date: e.target.value }))} />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">End Date</Label>
                        <Input type="date" value={formData.end_date} onChange={e => setFormData(f => ({ ...f, end_date: e.target.value }))} min={formData.start_date} />
                      </div>
                      {activeTab === 'competitive' && (
                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Exam Type</Label>
                          {useCustomExam ? (
                            <div className="flex gap-2">
                              <Input
                                value={customExamCompetitive}
                                onChange={e => { setCustomExamCompetitive(e.target.value); setFormData(f => ({ ...f, exam_type: e.target.value })); }}
                                placeholder="Enter custom exam name"
                              />
                              <Button type="button" variant="ghost" size="sm" onClick={() => { setUseCustomExam(false); setCustomExamCompetitive(''); setFormData(f => ({ ...f, exam_type: '' })); }}>
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ) : (
                            <div className="flex gap-2">
                              <Select value={formData.exam_type} onValueChange={v => setFormData(f => ({ ...f, exam_type: v }))}>
                                <SelectTrigger><SelectValue placeholder="Select exam" /></SelectTrigger>
                                <SelectContent>
                                  {COMPETITIVE_EXAM_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                                </SelectContent>
                              </Select>
                              <Button type="button" variant="outline" size="sm" className="shrink-0 text-xs" onClick={() => setUseCustomExam(true)}>
                                Custom
                              </Button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Step 2: Chapter & Topics */}
                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Chapter Name</Label>
                        <Input value={formData.chapter_name} onChange={e => setFormData(f => ({ ...f, chapter_name: e.target.value }))} placeholder="e.g. Kinematics" />
                      </div>

                      <div className="flex items-center gap-2">
                        <Checkbox id="bulkMode" checked={bulkMode} onCheckedChange={v => setBulkMode(!!v)} />
                        <label htmlFor="bulkMode" className="text-sm font-medium cursor-pointer">Bulk add multiple topics (one per line)</label>
                      </div>

                      {bulkMode ? (
                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            Topics (one per line) *
                          </Label>
                          <textarea
                            className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            value={bulkTopics}
                            onChange={e => setBulkTopics(e.target.value)}
                            placeholder={"Introduction to Vectors\nScalar & Vector Quantities\nVector Addition\nProjectile Motion\nRelative Motion"}
                          />
                          <p className="text-xs text-muted-foreground">
                            {bulkTopics.split('\n').filter(Boolean).length} topics ready to add
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Topic Name *</Label>
                          <Input value={formData.topic_name} onChange={e => setFormData(f => ({ ...f, topic_name: e.target.value }))} placeholder="e.g. Projectile Motion" />
                        </div>
                      )}
                    </div>

                    {/* Step 3: Schedule (optional) */}
                    <Collapsible>
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" type="button" size="sm" className="text-xs text-muted-foreground gap-1">
                          <Calendar className="h-3 w-3" /> Schedule (optional)
                          <ChevronDown className="h-3 w-3" />
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="mt-2">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          {activeTab !== 'general' && (
                            <div className="space-y-1.5">
                              <Label className="text-xs text-muted-foreground">Week Number</Label>
                              <Input type="number" value={formData.week_number} onChange={e => setFormData(f => ({ ...f, week_number: e.target.value }))} placeholder="1" />
                            </div>
                          )}
                          <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">Schedule Date</Label>
                            <Input type="date" value={formData.schedule_date} onChange={e => setFormData(f => ({ ...f, schedule_date: e.target.value }))} />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">Schedule Time</Label>
                            <Input type="time" value={formData.schedule_time} onChange={e => setFormData(f => ({ ...f, schedule_time: e.target.value }))} />
                          </div>
                        </div>
                      </CollapsibleContent>
                    </Collapsible>

                    {/* Step 4: Assign Teachers (inline) */}
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                        <Users className="h-3 w-3" /> Assign Teachers
                      </Label>

                      {/* Assigned teachers list */}
                      {pendingTeachers.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {pendingTeachers.map((pt, idx) => (
                            <Badge key={idx} variant="secondary" className="pl-2 pr-1 py-1 gap-1">
                              {getTeacherName(pt.teacher_id)}
                              <span className="text-[10px] text-muted-foreground">({roleTypeLabel(pt.role_type)})</span>
                              <button type="button" onClick={() => removePendingTeacher(idx)} className="ml-1 hover:text-destructive">
                                <X className="h-3 w-3" />
                              </button>
                            </Badge>
                          ))}
                        </div>
                      )}

                      {/* Add teacher inline */}
                      <div className="flex flex-wrap items-end gap-2">
                        <div className="flex-1 min-w-[150px]">
                          <Select value={teacherForm.teacher_id} onValueChange={v => setTeacherForm(f => ({ ...f, teacher_id: v }))}>
                            <SelectTrigger className="h-9">
                              <SelectValue placeholder="Select teacher" />
                            </SelectTrigger>
                            <SelectContent>
                              {teachers.map(t => <SelectItem key={t.id} value={t.id}>{t.fullName}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="min-w-[140px]">
                          <Select value={teacherForm.role_type} onValueChange={v => setTeacherForm(f => ({ ...f, role_type: v }))}>
                            <SelectTrigger className="h-9">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ROLE_TYPES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <Button type="button" variant="outline" size="sm" onClick={addPendingTeacher} className="h-9">
                          <UserPlus className="h-4 w-4 mr-1" /> Add
                        </Button>
                      </div>
                    </div>

                    <div className="flex gap-2 pt-2">
                      <Button type="submit" disabled={saving} className="flex-1">
                        {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                        {bulkMode ? `Add ${bulkTopics.split('\n').filter(Boolean).length} Topics` : 'Add Topic'}
                      </Button>
                      <Button type="button" variant="outline" onClick={() => { setShowAddForm(false); resetForm(); }}>
                        Cancel
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            )}

            {/* Stepwise Filters */}
            <div className="flex flex-wrap gap-1.5 sm:gap-2 mt-4">
              {/* Step 1: Class */}
              <Select value={filterClass} onValueChange={v => { setFilterClass(v); setFilterSubject('all'); setFilterExam('all'); }}>
                <SelectTrigger className="w-[calc(50%-4px)] sm:w-[140px] text-[10px] sm:text-xs h-7 sm:h-9">
                  <SelectValue placeholder="Class" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Classes</SelectItem>
                  {classes.map(c => <SelectItem key={c.id} value={c.id}>{c.section ? `${c.name} - ${c.section}` : c.name}</SelectItem>)}
                </SelectContent>
              </Select>
              {/* Step 2: Subject (filtered by class) */}
              <Select value={filterSubject} onValueChange={v => { setFilterSubject(v); setFilterExam('all'); }}>
                <SelectTrigger className="w-[calc(50%-4px)] sm:w-[140px] text-[10px] sm:text-xs h-7 sm:h-9">
                  <SelectValue placeholder="Subject" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Subjects</SelectItem>
                  {(() => {
                    const relevantSubjectIds = new Set(
                      syllabus
                        .filter(s => s.syllabus_type === (activeTab === 'general' ? 'general' : 'competitive'))
                        .filter(s => filterClass === 'all' || s.class_id === filterClass)
                        .map(s => s.subject_id)
                    );
                    return filteredSubjects
                      .filter(s => relevantSubjectIds.has(s.id))
                      .map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>);
                  })()}
                </SelectContent>
              </Select>
              {/* Step 3: Exam (filtered by class + subject) */}
              <Select value={filterExam} onValueChange={setFilterExam}>
                <SelectTrigger className="w-[calc(50%-4px)] sm:w-[140px] text-[10px] sm:text-xs h-7 sm:h-9">
                  <SelectValue placeholder="Exam" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Exams</SelectItem>
                  {(() => {
                    const relevantExams = new Set(
                      syllabus
                        .filter(s => s.syllabus_type === (activeTab === 'general' ? 'general' : 'competitive'))
                        .filter(s => filterClass === 'all' || s.class_id === filterClass)
                        .filter(s => filterSubject === 'all' || s.subject_id === filterSubject)
                        .map(s => s.exam_type)
                        .filter(Boolean)
                    );
                    return [...relevantExams].sort().map(t => <SelectItem key={t!} value={t!}>{t}</SelectItem>);
                  })()}
                </SelectContent>
              </Select>
            </div>
            <div className="relative mt-1.5 sm:mt-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input placeholder="Search chapters, topics..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9 h-7 sm:h-9 text-[10px] sm:text-sm" />
            </div>

            {/* Summary & Data */}
            {(
              <>
                <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                  <Badge variant="outline" className="text-[10px] sm:text-xs">{filteredSyllabus.length} topics</Badge>
                  <Badge variant="outline" className="text-[10px] sm:text-xs">{Object.keys(groupedSyllabus).length} chapters</Badge>
                </div>

                <TabsContent value="general" className="mt-4">
                  <SyllabusList groupedSyllabus={groupedSyllabus} teacherMappings={teacherMappings} onEdit={openEdit} onDelete={handleDelete} onAssignTeacher={openTeacherMapping} showExamType completedByNames={completedByNames} />
                </TabsContent>
                <TabsContent value="competitive" className="mt-4">
                  <SyllabusList groupedSyllabus={groupedSyllabus} teacherMappings={teacherMappings} onEdit={openEdit} onDelete={handleDelete} onAssignTeacher={openTeacherMapping} showExamType completedByNames={completedByNames} />
                </TabsContent>
              </>
            )}
          </Tabs>

          {/* Edit Dialog */}
          <Dialog open={editDialogOpen} onOpenChange={v => { setEditDialogOpen(v); if (!v) { setSelectedSyllabus(null); resetForm(); } }}>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Edit Syllabus Topic</DialogTitle></DialogHeader>
              <form onSubmit={handleEdit} className="space-y-4">
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
                    <Label>Subject *</Label>
                    <Select value={formData.subject_id} onValueChange={v => setFormData(f => ({ ...f, subject_id: v }))}>
                      <SelectTrigger><SelectValue placeholder="Select subject" /></SelectTrigger>
                      <SelectContent>
                        {filteredSubjects.map(s => (
                          <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {activeTab === 'general' && (
                  <div className="space-y-2">
                    <Label>Exam *</Label>
                    <Select value={formData.exam_type} onValueChange={v => setFormData(f => ({ ...f, exam_type: v }))}>
                      <SelectTrigger><SelectValue placeholder="Select exam" /></SelectTrigger>
                      <SelectContent>{GENERAL_EXAM_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                )}
                {activeTab === 'competitive' && (
                  <div className="space-y-2">
                    <Label>Exam Type</Label>
                    <Select value={formData.exam_type} onValueChange={v => setFormData(f => ({ ...f, exam_type: v }))}>
                      <SelectTrigger><SelectValue placeholder="Select exam type" /></SelectTrigger>
                      <SelectContent>{COMPETITIVE_EXAM_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Chapter</Label>
                    <Input value={formData.chapter_name} onChange={e => setFormData(f => ({ ...f, chapter_name: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Topic *</Label>
                    <Input value={formData.topic_name} onChange={e => setFormData(f => ({ ...f, topic_name: e.target.value }))} />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Start Date</Label>
                    <Input type="date" value={formData.start_date} onChange={e => setFormData(f => ({ ...f, start_date: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>End Date</Label>
                    <Input type="date" value={formData.end_date} onChange={e => setFormData(f => ({ ...f, end_date: e.target.value }))} min={formData.start_date} />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Week</Label>
                    <Input type="number" value={formData.week_number} onChange={e => setFormData(f => ({ ...f, week_number: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Date</Label>
                    <Input type="date" value={formData.schedule_date} onChange={e => setFormData(f => ({ ...f, schedule_date: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Time</Label>
                    <Input type="time" value={formData.schedule_time} onChange={e => setFormData(f => ({ ...f, schedule_time: e.target.value }))} />
                  </div>
                </div>
                <Button type="submit" className="w-full">Save Changes</Button>
              </form>
            </DialogContent>
          </Dialog>

          {/* Teacher Mapping Dialog */}
          <Dialog open={teacherDialogOpen} onOpenChange={v => { setTeacherDialogOpen(v); if (!v) setSelectedSyllabus(null); }}>
            <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Assign Teachers</DialogTitle></DialogHeader>
              {selectedSyllabus && (
                <div className="space-y-4">
                  <div className="text-sm p-3 rounded-lg bg-muted">
                    <p className="font-medium">{selectedSyllabus.chapter_name}</p>
                    <p className="text-muted-foreground">{selectedSyllabus.topic_name}</p>
                  </div>
                  <div className="space-y-2">
                    {teacherMappings
                      .filter(m => m.syllabus_id === selectedSyllabus.id)
                      .map(m => (
                        <div key={m.id} className="flex items-center justify-between p-2 rounded-md border">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{m.teacherName}</span>
                            <Badge variant="outline" className="text-xs">{roleTypeLabel(m.role_type)}</Badge>
                          </div>
                          <Button variant="ghost" size="icon" onClick={() => handleRemoveTeacher(m.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      ))}
                  </div>
                  <form onSubmit={handleAssignTeacher} className="space-y-3">
                    <div className="space-y-2">
                      <Label>Teacher</Label>
                      <Select value={teacherForm.teacher_id} onValueChange={v => setTeacherForm(f => ({ ...f, teacher_id: v }))}>
                        <SelectTrigger><SelectValue placeholder="Select teacher" /></SelectTrigger>
                        <SelectContent>
                          {teachers.map(t => <SelectItem key={t.id} value={t.id}>{t.fullName}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Role</Label>
                      <Select value={teacherForm.role_type} onValueChange={v => setTeacherForm(f => ({ ...f, role_type: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {ROLE_TYPES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button type="submit" className="w-full">Assign Teacher</Button>
                  </form>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>
      )}
    </DashboardLayout>
  );
}

function SyllabusList({
  groupedSyllabus, teacherMappings, onEdit, onDelete, onAssignTeacher, showExamType = false, completedByNames = {},
}: {
  groupedSyllabus: Record<string, SyllabusItem[]>;
  teacherMappings: TeacherMapping[];
  onEdit: (item: SyllabusItem) => void;
  onDelete: (id: string) => void;
  onAssignTeacher: (item: SyllabusItem) => void;
  showExamType?: boolean;
  completedByNames?: Record<string, string>;
}) {
  const entries = Object.entries(groupedSyllabus);
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(new Set());

  const toggleChapter = (key: string) => {
    setExpandedChapters(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  if (entries.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          No syllabus topics found. Click "Add Syllabus" to get started.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {entries.map(([key, topics]) => {
        const parts = key.split(' | ');
        const isExpanded = expandedChapters.has(key);
        const chapterTeachers = Array.from(new Map(
          topics
            .flatMap(topic => teacherMappings.filter(m => m.syllabus_id === topic.id))
            .map(mapping => [`${mapping.teacher_id}-${mapping.role_type}`, mapping])
        ).values());

        return (
          <Card key={key} className="overflow-hidden">
            <button
              type="button"
              onClick={() => toggleChapter(key)}
              className="w-full px-4 py-3 flex items-center justify-between hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-2 text-left">
                <BookOpen className="h-4 w-4 text-primary shrink-0" />
                <span className="font-medium text-sm">{parts[3]}</span>
                <div className="flex flex-wrap gap-1">
                  <Badge variant="outline" className="text-[10px]">{parts[0]}</Badge>
                  <Badge variant="secondary" className="text-[10px]">{parts[1]}</Badge>
                  {showExamType && parts[2] && parts[2] !== 'Unassigned' && <Badge className="text-[10px]">{parts[2]}</Badge>}
                  {chapterTeachers.map(mapping => (
                    <Badge key={mapping.id} variant="outline" className="text-[10px]">
                      {mapping.teacherName} ({roleTypeLabel(mapping.role_type)})
                    </Badge>
                  ))}
                </div>
                <Badge variant="outline" className="text-[10px]">{topics.length} topics</Badge>
              </div>
              {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </button>
            {isExpanded && (
              <CardContent className="p-0 border-t">
                <div className="divide-y">
                  {topics.map((topic, idx) => {
                    const assignedTeachers = teacherMappings.filter(m => m.syllabus_id === topic.id);
                    return (
                      <div key={topic.id} className="px-4 py-3 hover:bg-muted/30 transition-colors">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-3 flex-1 min-w-0">
                            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center mt-0.5">
                              {idx + 1}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm">{topic.topic_name}</p>
                              <div className="flex flex-wrap items-center gap-2 mt-1">
                                {topic.start_date && topic.end_date && (
                                  <Badge variant="outline" className="text-[10px]">
                                    <Calendar className="h-3 w-3 mr-0.5" />
                                    {new Date(topic.start_date).toLocaleDateString()} - {new Date(topic.end_date).toLocaleDateString()}
                                  </Badge>
                                )}
                                {topic.start_date && !topic.end_date && (
                                  <Badge variant="outline" className="text-[10px]">
                                    <Calendar className="h-3 w-3 mr-0.5" />From {new Date(topic.start_date).toLocaleDateString()}
                                  </Badge>
                                )}
                                {topic.week_number && <Badge variant="outline" className="text-[10px]">Week {topic.week_number}</Badge>}
                                {topic.schedule_date && (
                                  <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                                    <Calendar className="h-3 w-3" />
                                    {new Date(topic.schedule_date).toLocaleDateString()}
                                  </span>
                                )}
                                {topic.schedule_time && (
                                  <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                                    <Clock className="h-3 w-3" />
                                    {topic.schedule_time}
                                  </span>
                                )}
                              </div>
                              {assignedTeachers.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1.5">
                                  {assignedTeachers.map(m => (
                                    <Badge key={m.id} variant="secondary" className="text-[10px]">
                                      {m.teacherName} <span className="text-muted-foreground ml-0.5">({roleTypeLabel(m.role_type)})</span>
                                    </Badge>
                                  ))}
                                </div>
                               )}
                              {topic.completed_at && (
                                <div className="flex items-center gap-1.5 mt-1.5 text-[10px] sm:text-xs text-green-700 bg-green-50 rounded-md px-2 py-1 w-fit">
                                  <CheckCircle2 className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                                  Completed {new Date(topic.completed_at).toLocaleDateString()} by {topic.completed_by ? (completedByNames[topic.completed_by] || 'Teacher') : '—'}
                                </div>
                              )}
                            </div>
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => onEdit(topic)}>
                                <Pencil className="h-4 w-4 mr-2" />Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => onAssignTeacher(topic)}>
                                <Users className="h-4 w-4 mr-2" />Assign Teachers
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => onDelete(topic.id)} className="text-destructive">
                                <Trash2 className="h-4 w-4 mr-2" />Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
}
