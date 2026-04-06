import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { apiClient } from '@/lib/apiClient';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { useTeacherSidebar } from '@/hooks/useTeacherSidebar';
import { BackButton } from '@/components/ui/back-button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Search, BookOpen, FlaskConical, Calendar, Clock, ChevronDown, CheckCircle2, GraduationCap } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { toast } from 'sonner';

interface SyllabusEntry {
  id: string;
  chapter_name: string;
  topic_name: string;
  syllabus_type: string;
  exam_type: string | null;
  week_number: number | null;
  schedule_date: string | null;
  schedule_time: string | null;
  start_date: string | null;
  end_date: string | null;
  completed_at: string | null;
  completed_by: string | null;
  class_id: string;
  subject_id: string;
  classes?: { name: string; section: string } | null;
  subjects?: { name: string } | null;
}

interface TeacherMapping {
  id: string;
  syllabus_id: string;
  teacher_id: string;
  role_type: string;
}

interface TeacherSyllabusResponse {
  teacherName: string;
  mappings: TeacherMapping[];
  syllabus: SyllabusEntry[];
  completedByNames: Record<string, string>;
}

export default function TeacherSyllabus() {
  const teacherSidebarItems = useTeacherSidebar();
  const { user, userRole, loading } = useAuth();
  const navigate = useNavigate();

  const [syllabus, setSyllabus] = useState<SyllabusEntry[]>([]);
  const [mappings, setMappings] = useState<TeacherMapping[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [typeTab, setTypeTab] = useState('general');
  const [statusFilter, setStatusFilter] = useState('running');
  const [timeFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterClass, setFilterClass] = useState('all');
  const [filterSubject, setFilterSubject] = useState('all');
  const [filterExam, setFilterExam] = useState('all');
  const [teacherName, setTeacherName] = useState('');
  const [completedByNames, setCompletedByNames] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!loading && (!user || userRole !== 'teacher')) navigate('/auth');
  }, [user, userRole, loading, navigate]);

  useEffect(() => {
    if (user) fetchData();
  }, [user]);

  async function fetchData() {
    setLoadingData(true);
    try {
      const data = await apiClient.get<TeacherSyllabusResponse>('/teacher/syllabus-data');
      setTeacherName(data.teacherName || 'Teacher');
      setMappings(data.mappings || []);
      setSyllabus(data.syllabus || []);
      setCompletedByNames(data.completedByNames || {});
    } catch (error) {
      console.error('Error loading teacher syllabus:', error);
      setTeacherName('Teacher');
      setMappings([]);
      setSyllabus([]);
      setCompletedByNames({});
    } finally {
      setLoadingData(false);
    }
  }

  const assignedSyllabusIds = useMemo(() => new Set(mappings.map(m => m.syllabus_id)), [mappings]);
  const assignedSyllabus = useMemo(() => syllabus.filter(s => assignedSyllabusIds.has(s.id)), [syllabus, assignedSyllabusIds]);

  const roleForSyllabus = (syllabusId: string) => {
    const m = mappings.find(m => m.syllabus_id === syllabusId);
    return m?.role_type || '';
  };

  const today = new Date().toISOString().split('T')[0];

  const filteredItems = useMemo(() => {
    let items = assignedSyllabus.filter(s => s.syllabus_type === typeTab);

    if (filterClass !== 'all') items = items.filter(s => s.class_id === filterClass);
    if (filterSubject !== 'all') items = items.filter(s => s.subjects?.name === filterSubject);
    if (filterExam !== 'all') items = items.filter(s => s.exam_type === filterExam);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      items = items.filter(s =>
        s.chapter_name.toLowerCase().includes(q) ||
        s.topic_name.toLowerCase().includes(q) ||
        s.subjects?.name?.toLowerCase().includes(q)
      );
    }

    // Status filter
    if (statusFilter === 'running') items = items.filter(s => !s.completed_at);
    else if (statusFilter === 'completed') items = items.filter(s => !!s.completed_at);

    // Time filter
    if (timeFilter === 'current') {
      items = items.filter(s => {
        if (s.start_date && s.end_date) return s.start_date <= today && s.end_date >= today;
        if (s.schedule_date) return s.schedule_date === today;
        return true; // no date = show in current
      });
    } else if (timeFilter === 'past') {
      items = items.filter(s => {
        if (s.end_date) return s.end_date < today;
        if (s.schedule_date) return s.schedule_date < today;
        return false;
      });
    } else if (timeFilter === 'future') {
      items = items.filter(s => {
        if (s.start_date) return s.start_date > today;
        if (s.schedule_date) return s.schedule_date > today;
        return false;
      });
    }

    return items;
  }, [assignedSyllabus, typeTab, filterClass, filterSubject, filterExam, searchQuery, statusFilter, timeFilter, today]);

  const subjectOptions = useMemo(() =>
    [...new Set(assignedSyllabus.filter(s => s.syllabus_type === typeTab).map(s => s.subjects?.name).filter(Boolean))] as string[],
    [assignedSyllabus, typeTab]
  );

  const examOptions = useMemo(() =>
    [...new Set(assignedSyllabus.filter(s => s.syllabus_type === typeTab).map(s => s.exam_type).filter(Boolean))] as string[],
    [assignedSyllabus, typeTab]
  );

  const classOptions = useMemo(() => {
    const map = new Map<string, string>();
    assignedSyllabus.filter(s => s.syllabus_type === typeTab).forEach(s => {
      if (s.classes) map.set(s.class_id, s.classes.section ? `${s.classes.name}-${s.classes.section}` : s.classes.name);
    });
    return Array.from(map.entries());
  }, [assignedSyllabus, typeTab]);

  const roleColors: Record<string, string> = {
    lead: 'bg-primary/10 text-primary',
    practice: 'bg-secondary text-secondary-foreground',
    doubt: 'bg-accent text-accent-foreground',
  };

  async function handleMarkCompleted(syllabusId: string) {
    if (!user) return;
    try {
      const completedAt = new Date().toISOString();
      await apiClient.put(`/teacher/syllabus/${syllabusId}/complete`, {});
      toast.success('Marked as completed!');
      setSyllabus(prev => prev.map(s =>
        s.id === syllabusId ? { ...s, completed_at: completedAt, completed_by: user.id } : s
      ));
      setCompletedByNames(prev => ({ ...prev, [user.id]: teacherName }));
    } catch (error) {
      console.error('Failed to mark syllabus as completed:', error);
      toast.error('Failed to mark as completed');
    }
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  const SyllabusList = ({ items, showComplete }: { items: SyllabusEntry[]; showComplete: boolean }) => (
    items.length === 0 ? (
      <Card><CardContent className="py-12 text-center text-muted-foreground">No syllabus topics found for the selected filters.</CardContent></Card>
    ) : (
      <div className="space-y-3">
        {Object.entries(
          items.reduce<Record<string, SyllabusEntry[]>>((acc, s) => {
            const key = s.subjects?.name || 'Other';
            if (!acc[key]) acc[key] = [];
            acc[key].push(s);
            return acc;
          }, {})
        ).map(([subject, subItems]) => (
          <Collapsible key={subject} asChild>
            <Card>
              <CollapsibleTrigger className="w-full text-left">
                <CardHeader className="pb-2 py-3 px-3 sm:px-6">
                  <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-primary" />
                    <span className="truncate">{subject}</span>
                    <Badge variant="secondary" className="ml-auto mr-2 text-[10px] sm:text-xs">{subItems.length}</Badge>
                    <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200" />
                  </CardTitle>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="space-y-2 px-2 sm:px-6 pb-3 sm:pb-6 pt-0">
                  {subItems.map((s, idx) => (
                    <div key={s.id} className="flex items-start gap-2 sm:gap-3 p-2 sm:p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                      <span className="flex-shrink-0 w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-primary/10 text-primary text-[10px] sm:text-xs font-bold flex items-center justify-center">
                        {idx + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-xs sm:text-sm">{s.chapter_name}</p>
                        <p className="text-[11px] sm:text-xs text-muted-foreground">{s.topic_name}</p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          <Badge variant="outline" className="text-[9px] sm:text-[10px] px-1 py-0">
                            {s.classes ? (s.classes.section ? `${s.classes.name}-${s.classes.section}` : s.classes.name) : '—'}
                          </Badge>
                          {s.exam_type && <Badge variant="outline" className="text-[9px] sm:text-[10px] px-1 py-0">{s.exam_type}</Badge>}
                          {s.week_number && <Badge variant="outline" className="text-[9px] sm:text-[10px] px-1 py-0">W{s.week_number}</Badge>}
                          {roleForSyllabus(s.id) && (
                            <Badge className={`text-[9px] sm:text-[10px] px-1 py-0 ${roleColors[roleForSyllabus(s.id)] || ''}`}>
                              {roleForSyllabus(s.id)} faculty
                            </Badge>
                          )}
                        </div>
                        {(s.start_date || s.schedule_date) && (
                          <div className="flex items-center gap-1 sm:gap-2 text-[10px] sm:text-xs text-muted-foreground mt-1">
                            <Calendar className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                            {s.start_date && s.end_date
                              ? `${new Date(s.start_date).toLocaleDateString()} – ${new Date(s.end_date).toLocaleDateString()}`
                              : s.schedule_date
                                ? new Date(s.schedule_date).toLocaleDateString()
                                : ''
                            }
                            {s.schedule_time && <><Clock className="h-2.5 w-2.5 sm:h-3 sm:w-3" />{s.schedule_time}</>}
                          </div>
                        )}
                        {s.completed_at && (
                          <div className="flex items-center gap-1.5 mt-1.5 text-[10px] sm:text-xs text-green-700 bg-green-50 rounded-md px-2 py-1 w-fit">
                            <CheckCircle2 className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                            Completed {new Date(s.completed_at).toLocaleDateString()} by {s.completed_by ? (completedByNames[s.completed_by] || 'Teacher') : '—'}
                          </div>
                        )}
                        {showComplete && !s.completed_at && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="mt-2 h-7 text-xs gap-1 text-green-700 border-green-300 hover:bg-green-50"
                            onClick={() => handleMarkCompleted(s.id)}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Mark Completed
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        ))}
      </div>
    )
  );

  return (
    <DashboardLayout sidebarItems={teacherSidebarItems} roleColor="teacher">
      {loadingData ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : (
        <div className="space-y-3 sm:space-y-6 animate-fade-in px-0">
          <BackButton to="/teacher" />
          <div>
            <h1 className="font-display text-lg sm:text-2xl font-bold flex items-center gap-1.5 sm:gap-2">
              <BookOpen className="h-4 w-4 sm:h-6 sm:w-6 text-primary" /> My Syllabus
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground">View your assigned topics</p>
          </div>

          {/* General / Competitive Tabs */}
          <Tabs value={typeTab} onValueChange={(v) => { setTypeTab(v); setFilterSubject('all'); setFilterExam('all'); setFilterClass('all'); }}>
            <TabsList className="grid w-full grid-cols-2 h-8 sm:h-10">
              <TabsTrigger value="general" className="flex items-center gap-1 text-[10px] sm:text-sm">
                <GraduationCap className="h-3 w-3 sm:h-4 sm:w-4" /> General
              </TabsTrigger>
              <TabsTrigger value="competitive" className="flex items-center gap-1 text-[10px] sm:text-sm">
                <FlaskConical className="h-3 w-3 sm:h-4 sm:w-4" /> Competitive
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Filters */}
          <div className="flex flex-wrap gap-1.5 sm:gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[calc(50%-4px)] sm:w-[140px] text-[10px] sm:text-xs h-7 sm:h-9">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="running">Running / Present</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterClass} onValueChange={setFilterClass}>
              <SelectTrigger className="w-[calc(50%-4px)] sm:w-[140px] text-[10px] sm:text-xs h-7 sm:h-9">
                <SelectValue placeholder="Class" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Classes</SelectItem>
                {classOptions.map(([id, label]) => <SelectItem key={id} value={id}>{label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterSubject} onValueChange={setFilterSubject}>
              <SelectTrigger className="w-[calc(50%-4px)] sm:w-[140px] text-[10px] sm:text-xs h-7 sm:h-9">
                <SelectValue placeholder="Subject" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Subjects</SelectItem>
                {subjectOptions.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterExam} onValueChange={setFilterExam}>
              <SelectTrigger className="w-[calc(50%-4px)] sm:w-[140px] text-[10px] sm:text-xs h-7 sm:h-9">
                <SelectValue placeholder="Exam" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Exams</SelectItem>
                {examOptions.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input placeholder="Search topics..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9 h-7 sm:h-9 text-[10px] sm:text-sm" />
          </div>

          <SyllabusList items={filteredItems} showComplete={statusFilter !== 'completed'} />
        </div>
      )}
    </DashboardLayout>
  );
}
