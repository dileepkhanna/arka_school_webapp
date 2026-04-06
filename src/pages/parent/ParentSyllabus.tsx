import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { apiClient } from '@/lib/apiClient';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { parentSidebarItems } from '@/config/parentSidebar';
import { BackButton } from '@/components/ui/back-button';
import { Loader2, BookOpen, Filter, FlaskConical, User, ChevronDown, CheckCircle2, Calendar, Clock, GraduationCap } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface SyllabusItem {
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
  subjects: { name: string } | null;
  classes: { name: string; section: string } | null;
}

interface ParentSyllabusResponse {
  childName: string;
  syllabus: SyllabusItem[];
  teacherMap: Record<string, { name: string; role: string }[]>;
  completedByNames: Record<string, string>;
}

export default function ParentSyllabus() {
  const { user, userRole, loading } = useAuth();
  const navigate = useNavigate();
  const [syllabus, setSyllabus] = useState<SyllabusItem[]>([]);
  const [childName, setChildName] = useState('');
  const [loadingData, setLoadingData] = useState(true);
  const [typeTab, setTypeTab] = useState('general');
  const [statusFilter, setStatusFilter] = useState('running');
  const [timeFilter] = useState('all');
  const [selectedSubject, setSelectedSubject] = useState('all');
  const [selectedExam, setSelectedExam] = useState('all');
  const [teacherMap, setTeacherMap] = useState<Record<string, { name: string; role: string }[]>>({});
  const [completedByNames, setCompletedByNames] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!loading && (!user || userRole !== 'parent')) {
      navigate('/auth');
    }
  }, [user, userRole, loading, navigate]);

  useEffect(() => {
    async function fetchData() {
      if (!user) return;
      setLoadingData(true);
      try {
        const data = await apiClient.get<ParentSyllabusResponse>('/parent/syllabus-data');
        setChildName(data.childName || '');
        setSyllabus(data.syllabus || []);
        setTeacherMap(data.teacherMap || {});
        setCompletedByNames(data.completedByNames || {});
      } catch (error) {
        console.error('Error loading parent syllabus:', error);
        setChildName('');
        setSyllabus([]);
        setTeacherMap({});
        setCompletedByNames({});
      } finally {
        setLoadingData(false);
      }
    }
    fetchData();
  }, [user]);

  const today = new Date().toISOString().split('T')[0];

  const filteredItems = useMemo(() => {
    let result = syllabus.filter(s => s.syllabus_type === typeTab);
    if (selectedSubject !== 'all') result = result.filter(s => s.subjects?.name === selectedSubject);
    if (selectedExam !== 'all') result = result.filter(s => s.exam_type === selectedExam);

    // Status filter
    if (statusFilter === 'running') result = result.filter(s => !s.completed_at);
    else if (statusFilter === 'completed') result = result.filter(s => !!s.completed_at);

    // Time filter
    if (timeFilter === 'current') {
      result = result.filter(s => {
        if (s.start_date && s.end_date) return s.start_date <= today && s.end_date >= today;
        if (s.schedule_date) return s.schedule_date === today;
        return true;
      });
    } else if (timeFilter === 'past') {
      result = result.filter(s => {
        if (s.end_date) return s.end_date < today;
        if (s.schedule_date) return s.schedule_date < today;
        return false;
      });
    } else if (timeFilter === 'future') {
      result = result.filter(s => {
        if (s.start_date) return s.start_date > today;
        if (s.schedule_date) return s.schedule_date > today;
        return false;
      });
    }

    return result;
  }, [syllabus, typeTab, selectedSubject, selectedExam, statusFilter, timeFilter, today]);

  const subjects = useMemo(() =>
    [...new Set(syllabus.filter(s => s.syllabus_type === typeTab).map(s => s.subjects?.name).filter(Boolean))] as string[],
    [syllabus, typeTab]
  );

  const examOptions = useMemo(() =>
    [...new Set(syllabus.filter(s => s.syllabus_type === typeTab).map(s => s.exam_type).filter(Boolean))] as string[],
    [syllabus, typeTab]
  );

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  const SyllabusGrouped = ({ items }: { items: SyllabusItem[] }) => {
    const grouped = items.reduce<Record<string, SyllabusItem[]>>((acc, item) => {
      const subject = item.subjects?.name || 'Other';
      if (!acc[subject]) acc[subject] = [];
      acc[subject].push(item);
      return acc;
    }, {});

    if (Object.keys(grouped).length === 0) {
      return <Card><CardContent className="py-10 text-center text-muted-foreground">No syllabus topics found for the selected filters.</CardContent></Card>;
    }

    return (
      <div className="space-y-3 sm:space-y-4">
        {Object.entries(grouped).map(([subject, items]) => (
          <Collapsible key={subject} asChild>
            <Card className="overflow-hidden">
              <CollapsibleTrigger className="w-full text-left">
                <CardHeader className="py-3 px-3 sm:px-6 sm:pb-3">
                  <CardTitle className="text-sm sm:text-lg flex items-center gap-1.5 sm:gap-2">
                    <BookOpen className="h-4 w-4 sm:h-5 sm:w-5 text-primary shrink-0" />
                    <span className="truncate">{subject}</span>
                    <Badge variant="secondary" className="ml-auto mr-1 sm:mr-2 text-[10px] sm:text-xs shrink-0">{items.length}</Badge>
                    <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200" />
                  </CardTitle>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="px-2 sm:px-6 pb-3 sm:pb-6 pt-0">
                  <div className="space-y-1.5 sm:space-y-2">
                    {items.map((item, idx) => (
                      <div key={item.id} className="flex items-start gap-2 sm:gap-3 p-2 sm:p-3 rounded-lg bg-muted/50">
                        <span className="flex-shrink-0 w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-primary/10 text-primary text-[10px] sm:text-xs font-bold flex items-center justify-center">
                          {idx + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-xs sm:text-sm leading-tight">{item.chapter_name}</p>
                          <p className="text-[11px] sm:text-xs text-muted-foreground leading-tight mt-0.5">{item.topic_name}</p>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {item.exam_type && <Badge variant="outline" className="text-[9px] sm:text-[10px] px-1 py-0">{item.exam_type}</Badge>}
                            {item.week_number && <Badge variant="outline" className="text-[9px] sm:text-[10px] px-1 py-0">W{item.week_number}</Badge>}
                          </div>
                          {teacherMap[item.id] && teacherMap[item.id].length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {teacherMap[item.id].map((t, i) => (
                                <Badge key={i} variant="outline" className="text-[9px] sm:text-[10px] px-1 py-0 gap-0.5">
                                  <User className="h-2 w-2 sm:h-2.5 sm:w-2.5" />{t.name} ({t.role})
                                </Badge>
                              ))}
                            </div>
                          )}
                          {(item.start_date || item.schedule_date) && (
                            <div className="flex items-center gap-1 sm:gap-2 text-[10px] sm:text-xs text-muted-foreground mt-1">
                              <Calendar className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                              {item.start_date && item.end_date
                                ? `${new Date(item.start_date).toLocaleDateString()} – ${new Date(item.end_date).toLocaleDateString()}`
                                : item.schedule_date
                                  ? new Date(item.schedule_date).toLocaleDateString()
                                  : ''
                              }
                              {item.schedule_time && <><Clock className="h-2.5 w-2.5 sm:h-3 sm:w-3" />{item.schedule_time}</>}
                            </div>
                          )}
                          {item.completed_at && (
                            <div className="flex items-center gap-1.5 mt-1.5 text-[10px] sm:text-xs text-green-700 bg-green-50 rounded-md px-2 py-1 w-fit">
                              <CheckCircle2 className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                              Completed {new Date(item.completed_at).toLocaleDateString()} by {item.completed_by ? (completedByNames[item.completed_by] || 'Teacher') : '—'}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        ))}
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
            <h1 className="font-display text-lg sm:text-2xl font-bold flex items-center gap-1.5 sm:gap-2">
              <BookOpen className="h-4 w-4 sm:h-6 sm:w-6 text-primary" /> Syllabus
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground">{childName ? `${childName}'s` : "Your child's"} curriculum & topics</p>
          </div>

          {/* General / Competitive Tabs */}
          <Tabs value={typeTab} onValueChange={(v) => { setTypeTab(v); setSelectedSubject('all'); setSelectedExam('all'); }}>
            <TabsList className="grid w-full grid-cols-2 h-10">
              <TabsTrigger value="general" className="flex items-center justify-center gap-1.5 text-xs sm:text-sm">
                <GraduationCap className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" /> General
              </TabsTrigger>
              <TabsTrigger value="competitive" className="flex items-center justify-center gap-1.5 text-xs sm:text-sm">
                <FlaskConical className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" /> Competitive
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Filters - stacked on mobile */}
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[140px] text-xs sm:text-sm h-9 sm:h-10">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="running">Running</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
            <Select value={selectedSubject} onValueChange={setSelectedSubject}>
              <SelectTrigger className="w-full sm:w-[140px] text-xs sm:text-sm h-9 sm:h-10">
                <Filter className="h-3 w-3 sm:h-3.5 sm:w-3.5 mr-1 shrink-0" />
                <SelectValue placeholder="Subject" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Subjects</SelectItem>
                {subjects.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            {examOptions.length > 0 && (
              <Select value={selectedExam} onValueChange={setSelectedExam}>
                <SelectTrigger className="w-full sm:w-[140px] text-xs sm:text-sm h-9 sm:h-10 col-span-2 sm:col-span-1">
                  <SelectValue placeholder="Exam Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Exams</SelectItem>
                  {examOptions.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </div>

          <SyllabusGrouped items={filteredItems} />
        </div>
      )}
    </DashboardLayout>
  );
}
