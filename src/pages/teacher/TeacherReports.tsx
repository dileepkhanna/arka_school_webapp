import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { apiClient } from '@/lib/apiClient';
import { format } from 'date-fns';
import { toast } from 'sonner';
import {
  Loader2,
  ClipboardList,
  Plus,
  Eye,
  EyeOff,
  AlertTriangle,
  MessageSquare,
} from 'lucide-react';
import { useTeacherSidebar } from '@/hooks/useTeacherSidebar';

interface Report {
  id: string;
  category: string;
  description: string;
  severity: string | null;
  parent_visible: boolean;
  created_at: string;
  students?: { full_name: string; admission_number: string };
}

interface Complaint {
  id: string;
  subject: string;
  description: string;
  status: string | null;
  response: string | null;
  visible_to: string[];
  created_at: string;
  submitted_by: string;
}

interface Student {
  id: string;
  full_name: string;
  admission_number: string;
}

interface ClassOption {
  id: string;
  name: string;
  section: string;
}

interface TeacherReportsDataResponse {
  classes: ClassOption[];
  reports: Report[];
  complaints: Complaint[];
}

interface TeacherClassStudentsResponse {
  students: Student[];
}

export default function TeacherReports() {
  const teacherSidebarItems = useTeacherSidebar();
  const { user, userRole, loading } = useAuth();
  const navigate = useNavigate();
  const [reports, setReports] = useState<Report[]>([]);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [loadingComplaints, setLoadingComplaints] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [respondDialogOpen, setRespondDialogOpen] = useState(false);
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);
  const [responseText, setResponseText] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [formData, setFormData] = useState({
    student_id: '',
    category: '',
    description: '',
    severity: 'info',
    parent_visible: true,
  });

  useEffect(() => {
    if (!loading && (!user || userRole !== 'teacher')) {
      navigate('/auth');
    }
  }, [user, userRole, loading, navigate]);

  // Fetch reports data
  useEffect(() => {
    async function fetchData() {
      if (!user) return;
      try {
        const data = await apiClient.get<TeacherReportsDataResponse>('/teacher/reports-data');
        setClasses(data.classes || []);
        setReports(data.reports || []);
        setComplaints(data.complaints || []);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoadingData(false);
        setLoadingComplaints(false);
      }
    }
    fetchData();
  }, [user]);

  useEffect(() => {
    async function fetchStudents() {
      if (!selectedClass) { setStudents([]); return; }

      try {
        const data = await apiClient.get<TeacherClassStudentsResponse>(`/teacher/class-students?class_id=${encodeURIComponent(selectedClass)}`);
        setStudents(data.students || []);
      } catch (error) {
        console.error('Error loading class students:', error);
        setStudents([]);
      }
    }
    fetchStudents();
  }, [selectedClass]);

  const handleSubmit = async () => {
    if (!formData.student_id || !formData.category || !formData.description) {
      toast.error('Please fill in all required fields');
      return;
    }
    try {
      await apiClient.post('/teacher/reports', {
        student_id: formData.student_id,
        category: formData.category,
        description: formData.description,
        severity: formData.severity,
        parent_visible: formData.parent_visible,
      });

      toast.success('Report created successfully');
      setDialogOpen(false);
      setFormData({ student_id: '', category: '', description: '', severity: 'info', parent_visible: true });
      setSelectedClass('');

      const data = await apiClient.get<TeacherReportsDataResponse>('/teacher/reports-data');
      setClasses(data.classes || []);
      setReports(data.reports || []);
      setComplaints(data.complaints || []);
    } catch (error) {
      console.error('Error creating report:', error);
      toast.error('Failed to create report');
    }
  };

  const handleRespondToComplaint = async (status: string) => {
    if (!selectedComplaint) return;
    try {
      await apiClient.put(`/teacher/complaints/${selectedComplaint.id}`, {
        response: responseText || selectedComplaint.response,
        status,
      });

      toast.success(status === 'resolved' ? 'Complaint resolved' : 'Response sent');
      setRespondDialogOpen(false);
      setSelectedComplaint(null);
      setResponseText('');

      const data = await apiClient.get<TeacherReportsDataResponse>('/teacher/reports-data');
      setComplaints(data.complaints || []);
    } catch (error) {
      console.error('Error responding:', error);
      toast.error('Failed to respond to complaint');
    }
  };

  const severityColors = {
    info: 'bg-blue-100 text-blue-700',
    warning: 'bg-yellow-100 text-yellow-700',
    critical: 'bg-red-100 text-red-700',
  };

  const statusColors: Record<string, string> = {
    open: 'bg-yellow-100 text-yellow-700',
    in_progress: 'bg-blue-100 text-blue-700',
    resolved: 'bg-green-100 text-green-700',
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <DashboardLayout sidebarItems={teacherSidebarItems} roleColor="teacher">
      <div className="space-y-6 animate-fade-in">
        <h1 className="font-display text-2xl font-bold">Reports & Complaints</h1>

        <Tabs defaultValue="reports">
          <TabsList className="w-full grid grid-cols-2">
            <TabsTrigger value="reports" className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4" />
              Student Reports
            </TabsTrigger>
            <TabsTrigger value="complaints" className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Complaints
              {complaints.filter(c => c.status === 'open').length > 0 && (
                <Badge variant="destructive" className="ml-1 text-xs px-1.5 py-0">
                  {complaints.filter(c => c.status === 'open').length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Student Reports Tab */}
          <TabsContent value="reports">
            <div className="space-y-4">
              <div className="flex justify-end">
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                  <DialogTrigger asChild>
                    <Button><Plus className="h-4 w-4 mr-2" />Add Report</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Create Student Report</DialogTitle></DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label>Class *</Label>
                        <Select value={selectedClass} onValueChange={setSelectedClass}>
                          <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
                          <SelectContent>
                            {classes.map((cls) => (
                              <SelectItem key={cls.id} value={cls.id}>{cls.section ? `${cls.name} - ${cls.section}` : cls.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Student *</Label>
                        <Select value={formData.student_id} onValueChange={(v) => setFormData({ ...formData, student_id: v })} disabled={!selectedClass}>
                          <SelectTrigger><SelectValue placeholder="Select student" /></SelectTrigger>
                          <SelectContent>
                            {students.map((student) => (
                              <SelectItem key={student.id} value={student.id}>{student.full_name} ({student.admission_number})</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Category *</Label>
                          <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
                            <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="academic">Academic</SelectItem>
                              <SelectItem value="behavior">Behavior</SelectItem>
                              <SelectItem value="attendance">Attendance</SelectItem>
                              <SelectItem value="health">Health</SelectItem>
                              <SelectItem value="achievement">Achievement</SelectItem>
                              <SelectItem value="other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>Severity</Label>
                          <Select value={formData.severity} onValueChange={(v) => setFormData({ ...formData, severity: v })}>
                            <SelectTrigger><SelectValue placeholder="Select severity" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="info">Info</SelectItem>
                              <SelectItem value="warning">Warning</SelectItem>
                              <SelectItem value="critical">Critical</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div>
                        <Label>Description *</Label>
                        <Textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="Describe the report..." rows={4} />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label>Visible to Parents</Label>
                        <Switch checked={formData.parent_visible} onCheckedChange={(checked) => setFormData({ ...formData, parent_visible: checked })} />
                      </div>
                      <Button onClick={handleSubmit} className="w-full">Create Report</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              {loadingData ? (
                <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
              ) : reports.length === 0 ? (
                <Card><CardContent className="py-12 text-center">
                  <ClipboardList className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No reports created yet.</p>
                </CardContent></Card>
              ) : (
                <div className="space-y-4">
                  {reports.map((report) => (
                    <Card key={report.id} className="card-elevated">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                              <h3 className="font-semibold">{report.students?.full_name}</h3>
                              <Badge variant="outline">{report.category}</Badge>
                              {report.severity && (
                                <span className={`px-2 py-0.5 rounded text-xs font-medium ${severityColors[report.severity as keyof typeof severityColors]}`}>
                                  {report.severity}
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground mb-2">{report.description}</p>
                            <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                              <span>{format(new Date(report.created_at), 'PPP')}</span>
                              <span className="flex items-center gap-1">
                                {report.parent_visible ? (<><Eye className="h-3 w-3" /> Visible to parents</>) : (<><EyeOff className="h-3 w-3" /> Hidden from parents</>)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          {/* Complaints Tab */}
          <TabsContent value="complaints">
            {loadingComplaints ? (
              <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            ) : complaints.length === 0 ? (
              <Card><CardContent className="py-12 text-center">
                <AlertTriangle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No complaints directed to teachers yet.</p>
              </CardContent></Card>
            ) : (
              <div className="space-y-4">
                {complaints.map((complaint) => (
                  <Card key={complaint.id} className="card-elevated">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <h3 className="font-semibold truncate">{complaint.subject}</h3>
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColors[complaint.status || 'open']}`}>
                              {complaint.status || 'open'}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">{complaint.description}</p>
                          {complaint.response && (
                            <div className="bg-muted rounded-md p-3 mb-2">
                              <p className="text-xs font-medium text-muted-foreground mb-1">Response:</p>
                              <p className="text-sm">{complaint.response}</p>
                            </div>
                          )}
                          <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                            <span>{format(new Date(complaint.created_at), 'PPP')}</span>
                            <div className="flex gap-1">
                              {complaint.visible_to.map(v => (
                                <Badge key={v} variant="outline" className="text-xs">{v}</Badge>
                              ))}
                            </div>
                          </div>
                        </div>
                        {complaint.status !== 'resolved' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedComplaint(complaint);
                              setResponseText(complaint.response || '');
                              setRespondDialogOpen(true);
                            }}
                          >
                            <MessageSquare className="h-4 w-4 mr-1" />
                            Respond
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Respond to complaint dialog */}
        <Dialog open={respondDialogOpen} onOpenChange={setRespondDialogOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Respond to Complaint</DialogTitle></DialogHeader>
            {selectedComplaint && (
              <div className="space-y-4">
                <div>
                  <Label className="text-muted-foreground text-xs">Subject</Label>
                  <p className="font-medium">{selectedComplaint.subject}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Description</Label>
                  <p className="text-sm">{selectedComplaint.description}</p>
                </div>
                <div>
                  <Label>Your Response</Label>
                  <Textarea value={responseText} onChange={(e) => setResponseText(e.target.value)} placeholder="Type your response..." rows={4} />
                </div>
                <div className="flex gap-2">
                  <Button className="flex-1" onClick={() => handleRespondToComplaint('in_progress')}>
                    Send Response
                  </Button>
                  <Button variant="outline" className="flex-1" onClick={() => handleRespondToComplaint('resolved')}>
                    Resolve
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
