import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { apiClient } from '@/lib/apiClient';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { adminSidebarItems } from '@/config/adminSidebar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Plus, Search, Loader2, MoreHorizontal, Trash2, Calendar, FileText, ClipboardList, BarChart3, Clock, RotateCcw, FlaskConical } from 'lucide-react';
import { toast } from 'sonner';
import ExamCreationWizard from '@/components/exams/ExamCreationWizard';
import ExamMarksEntry from '@/components/exams/ExamMarksEntry';
import ExamResultsView from '@/components/exams/ExamResultsView';
import WeeklyExamsSection from '@/components/exams/WeeklyExamsSection';
import WeeklyExamMarksEntry from '@/components/exams/WeeklyExamMarksEntry';
import { Exam, ClassItem, SubjectItem } from '@/components/exams/types';
import { BackButton } from '@/components/ui/back-button';

const formatClassLabel = (exam: Exam) => exam.classes
  ? (exam.classes.section ? `${exam.classes.name} - ${exam.classes.section.toUpperCase()}` : exam.classes.name)
  : 'All';

export default function ExamsManagement() {
  const { user, userRole, loading } = useAuth();
  const navigate = useNavigate();

  const [exams, setExams] = useState<Exam[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('schedule');

  useEffect(() => {
    if (!loading && (!user || userRole !== 'admin')) {
      navigate('/auth');
    }
  }, [user, userRole, loading, navigate]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoadingData(true);
    try {
      const data = await apiClient.get<{ exams: Exam[]; classes: ClassItem[]; subjects: SubjectItem[] }>('/exams/data');
      setExams((data.exams || []) as Exam[]);
      setClasses(data.classes || []);
      setSubjects(data.subjects || []);
    } catch (error) {
      console.error('Failed to fetch exam data', error);
      setExams([]);
      setClasses([]);
      setSubjects([]);
    }

    setLoadingData(false);
  };

  const handleDeleteExam = async (id: string) => {
    try {
      await apiClient.delete(`/exams/${id}`);
      toast.success('Exam deleted successfully');
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete exam');
    }
  };

  const handleDeleteExamGroup = async (examName: string) => {
    const examIds = exams.filter(e => e.name === examName).map(e => e.id);
    for (const id of examIds) {
      await apiClient.delete(`/exams/${id}`);
    }
    toast.success(`Deleted all ${examIds.length} entries`);
    fetchData();
  };

  const filteredExams = exams.filter((e) =>
    e.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Group exams by name for better display
  const groupedExams = filteredExams.reduce((acc, exam) => {
    if (!acc[exam.name]) acc[exam.name] = [];
    acc[exam.name].push(exam);
    return acc;
  }, {} as Record<string, Exam[]>);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <DashboardLayout sidebarItems={adminSidebarItems} roleColor="admin">
      <div className="space-y-3 sm:space-y-6 animate-fade-in px-0">
        <BackButton to="/admin" />
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-display text-lg sm:text-2xl font-bold">Exams Management</h1>
            <p className="text-xs sm:text-sm text-muted-foreground">Create, schedule, and manage examinations</p>
          </div>

          <Button size="sm" className="gradient-admin sm:size-default" onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Exam
          </Button>
        </div>

        {/* Tabs for different views */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-5 h-8 sm:h-10 lg:w-[650px]">
            <TabsTrigger value="schedule" className="flex items-center gap-0.5 sm:gap-1 text-[9px] sm:text-sm px-1 sm:px-3">
              <Calendar className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="truncate">Schedule</span>
            </TabsTrigger>
            <TabsTrigger value="weekly" className="flex items-center gap-0.5 sm:gap-1 text-[9px] sm:text-sm px-1 sm:px-3">
              <RotateCcw className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="truncate">Weekly</span>
            </TabsTrigger>
            <TabsTrigger value="marks" className="flex items-center gap-0.5 sm:gap-1 text-[9px] sm:text-sm px-1 sm:px-3">
              <ClipboardList className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="truncate">Marks</span>
            </TabsTrigger>
            <TabsTrigger value="weekly-marks" className="flex items-center gap-0.5 sm:gap-1 text-[9px] sm:text-sm px-1 sm:px-3">
              <FlaskConical className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="truncate">W.Marks</span>
            </TabsTrigger>
            <TabsTrigger value="results" className="flex items-center gap-0.5 sm:gap-1 text-[9px] sm:text-sm px-1 sm:px-3">
              <BarChart3 className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="truncate">Results</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="schedule" className="space-y-4 mt-4">
            {/* Search */}
            <Card className="card-elevated">
              <CardContent className="pt-6">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Search exams..." 
                    className="pl-10" 
                    value={searchQuery} 
                    onChange={(e) => setSearchQuery(e.target.value)} 
                  />
                </div>
              </CardContent>
            </Card>

            {/* Grouped Exams Display */}
            <div className="space-y-4">
              {Object.entries(groupedExams).map(([examName, examList]) => (
                <Card key={examName} className="card-elevated overflow-hidden">
                  <CardHeader className="pb-3 bg-muted/30">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-primary/10">
                          <FileText className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="font-display text-lg">{examName}</CardTitle>
                          <CardDescription>
                            {examList.length} entries • {new Set(examList.map(e => e.class_id)).size} class(es)
                          </CardDescription>
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => handleDeleteExamGroup(examName)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete All
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    {/* Mobile Cards */}
                    <div className="space-y-2 p-3 sm:hidden">
                      {examList.map((exam) => (
                        <div key={exam.id} className="p-3 rounded-xl border bg-muted/10 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="space-y-1">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <Badge variant="outline" className="text-[10px]">
                                  {formatClassLabel(exam)}
                                </Badge>
                                <Badge variant="secondary" className="text-[10px] capitalize">{exam.subjects?.name || 'All'}</Badge>
                              </div>
                              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                {exam.exam_date && (
                                  <span className="flex items-center gap-1">
                                    <Calendar className="h-3 w-3" />
                                    {new Date(exam.exam_date).toLocaleDateString()}
                                  </span>
                                )}
                                {exam.exam_time && (
                                  <span className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {exam.exam_time}
                                  </span>
                                )}
                                <span>Max: {exam.max_marks}</span>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive shrink-0"
                              onClick={() => handleDeleteExam(exam.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Desktop Table */}
                    <div className="overflow-x-auto hidden sm:block">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Class</TableHead>
                            <TableHead>Subject</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>Time</TableHead>
                            <TableHead>Max Marks</TableHead>
                            <TableHead className="w-[50px]"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {examList.map((exam) => (
                            <TableRow key={exam.id}>
                              <TableCell>
                                <Badge variant="outline">
                                  {formatClassLabel(exam)}
                                </Badge>
                              </TableCell>
                              <TableCell className="capitalize">{exam.subjects?.name || 'All'}</TableCell>
                              <TableCell>
                                {exam.exam_date ? (
                                  <div className="flex items-center gap-2 text-sm">
                                    <Calendar className="h-3 w-3 text-muted-foreground" />
                                    {new Date(exam.exam_date).toLocaleDateString()}
                                  </div>
                                ) : '-'}
                              </TableCell>
                              <TableCell>
                                {exam.exam_time ? (
                                  <div className="flex items-center gap-2 text-sm">
                                    <Clock className="h-3 w-3 text-muted-foreground" />
                                    {exam.exam_time}
                                  </div>
                                ) : '-'}
                              </TableCell>
                              <TableCell>{exam.max_marks}</TableCell>
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive hover:text-destructive"
                                  onClick={() => handleDeleteExam(exam.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {Object.keys(groupedExams).length === 0 && !loadingData && (
                <Card className="card-elevated">
                  <CardContent className="py-12 text-center text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p className="font-medium">No exams created yet</p>
                    <p className="text-sm">Click "Create Exam" to get started</p>
                  </CardContent>
                </Card>
              )}

              {loadingData && (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="weekly" className="mt-4">
            <WeeklyExamsSection />
          </TabsContent>

          <TabsContent value="marks" className="mt-4">
            <ExamMarksEntry exams={exams as any} onMarksUpdated={fetchData} />
          </TabsContent>

          <TabsContent value="weekly-marks" className="mt-4">
            <WeeklyExamMarksEntry />
          </TabsContent>

          <TabsContent value="results" className="mt-4">
            <ExamResultsView />
          </TabsContent>
        </Tabs>

        {/* Exam Creation Wizard */}
        <ExamCreationWizard
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          classes={classes}
          subjects={subjects.filter(s => s.category !== 'competitive')}
          onSuccess={fetchData}
        />
      </div>
    </DashboardLayout>
  );
}
