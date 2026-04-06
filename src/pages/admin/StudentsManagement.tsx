import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { apiClient } from '@/lib/apiClient';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { adminSidebarItems } from '@/config/adminSidebar';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Search, Loader2, Eye, User, Calendar, MapPin, Phone, Heart, AlertCircle, GraduationCap } from 'lucide-react';
import AttendanceSummary from '@/components/AttendanceSummary';
import { BackButton } from '@/components/ui/back-button';

interface Student {
  id: number;
  admission_number: string;
  full_name: string;
  date_of_birth: string | null;
  address: string | null;
  photo_url: string | null;
  status: string;
  class_id: number | null;
  blood_group: string | null;
  parent_name: string | null;
  parent_phone: string | null;
  emergency_contact: string | null;
  emergency_contact_name: string | null;
  classes: { name: string; section: string } | null;
}

interface ClassItem {
  id: number;
  name: string;
  section: string;
}

export default function StudentsManagement() {
  const { user, userRole, loading } = useAuth();
  const navigate = useNavigate();

  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClass, setSelectedClass] = useState('all');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

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
      const [studentsRes, classesRes] = await Promise.all([
        apiClient.get<Student[]>('/students/directory'),
        apiClient.get<ClassItem[]>('/classes'),
      ]);

      if (studentsRes) setStudents(studentsRes);
      if (classesRes) setClasses(classesRes);
    } catch (error) {
      console.error('Failed to fetch students data', error);
      setStudents([]);
      setClasses([]);
    }
    
    setLoadingData(false);
  };

  const openStudentDetails = (student: Student) => {
    setSelectedStudent(student);
    setDetailsOpen(true);
  };

  const filteredStudents = students.filter((s) => {
    const matchesSearch = s.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.admission_number.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesClass = selectedClass === 'all' || String(s.class_id) === selectedClass;
    return matchesSearch && matchesClass;
  });

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <DashboardLayout sidebarItems={adminSidebarItems} roleColor="admin">
      <div className="space-y-6 animate-fade-in">
        <BackButton to="/admin" />
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold">Students Directory</h1>
            <p className="text-muted-foreground">View all student records (Teachers manage student admissions)</p>
          </div>
        </div>

        <Card className="card-elevated">
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search students..." className="pl-10" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
              </div>
              <Select value={selectedClass} onValueChange={setSelectedClass}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Filter by class" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Classes</SelectItem>
                  {classes.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.section ? `${c.name} - ${c.section}` : c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card className="card-elevated">
          <CardHeader><CardTitle className="font-display">All Students ({filteredStudents.length})</CardTitle></CardHeader>
          <CardContent>
            {loadingData ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            ) : filteredStudents.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">{searchQuery ? 'No students found' : 'No students added yet'}</div>
            ) : (
              <>
                {/* Mobile Cards */}
                <div className="space-y-3 sm:hidden">
                  {filteredStudents.map((student) => (
                    <div key={student.id} className="p-3 rounded-xl border bg-muted/10 space-y-2.5" onClick={() => openStudentDetails(student)}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-3 min-w-0">
                          <Avatar className="h-10 w-10 shrink-0">
                            <AvatarImage src={student.photo_url || ''} />
                            <AvatarFallback className="gradient-primary text-white text-sm">{student.full_name[0]}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="font-medium text-sm truncate">{student.full_name}</p>
                            <Badge variant="secondary" className="font-mono text-[10px] font-semibold bg-primary/10 text-primary border-primary/20 mt-0.5">
                              {student.admission_number}
                            </Badge>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <Badge className={`text-[10px] ${student.status === 'active' ? 'status-active' : 'status-inactive'}`}>{student.status}</Badge>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); openStudentDetails(student); }}>
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-1 text-xs">
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <GraduationCap className="h-3 w-3 shrink-0" />
                          <span>{student.classes ? (student.classes.section ? `${student.classes.name} - ${student.classes.section}` : student.classes.name) : 'N/A'}</span>
                        </div>
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <User className="h-3 w-3 shrink-0" />
                          <span>{student.parent_name || 'No parent'}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop Table */}
                <div className="overflow-x-auto hidden sm:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Student</TableHead>
                        <TableHead>Admission No</TableHead>
                        <TableHead>Class</TableHead>
                        <TableHead>Parent</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="w-[80px]">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredStudents.map((student) => (
                        <TableRow key={student.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar>
                                <AvatarImage src={student.photo_url || ''} />
                                <AvatarFallback className="gradient-primary text-white">{student.full_name[0]}</AvatarFallback>
                              </Avatar>
                              <span className="font-medium">{student.full_name}</span>
                            </div>
                          </TableCell>
                          <TableCell className="font-mono text-sm">{student.admission_number}</TableCell>
                          <TableCell>{student.classes ? (student.classes.section ? `${student.classes.name} - ${student.classes.section}` : student.classes.name) : 'N/A'}</TableCell>
                          <TableCell>{student.parent_name || 'N/A'}</TableCell>
                          <TableCell><Badge className={student.status === 'active' ? 'status-active' : 'status-inactive'}>{student.status}</Badge></TableCell>
                          <TableCell>
                            <Button variant="ghost" size="icon" onClick={() => openStudentDetails(student)}>
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Student Details Dialog */}
        <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Student Profile
              </DialogTitle>
            </DialogHeader>
            {selectedStudent && (
              <div className="space-y-6">
                {/* Header Section */}
                <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-xl">
                  <Avatar className="h-20 w-20">
                    <AvatarImage src={selectedStudent.photo_url || ''} />
                    <AvatarFallback className="gradient-primary text-white text-xl">
                      {selectedStudent.full_name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h2 className="text-xl font-bold">{selectedStudent.full_name}</h2>
                    <p className="text-muted-foreground font-mono">{selectedStudent.admission_number}</p>
                    {selectedStudent.classes && (
                      <Badge className="mt-1">
                        <GraduationCap className="h-3 w-3 mr-1" />
                        {selectedStudent.classes.section ? `${selectedStudent.classes.name} - ${selectedStudent.classes.section}` : selectedStudent.classes.name}
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        Personal Information
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center gap-3">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-xs text-muted-foreground">Date of Birth</p>
                          <p className="font-medium">
                            {selectedStudent.date_of_birth 
                              ? new Date(selectedStudent.date_of_birth).toLocaleDateString() 
                              : 'Not specified'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Heart className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-xs text-muted-foreground">Blood Group</p>
                          <p className="font-medium">{selectedStudent.blood_group || 'Not specified'}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                        <div>
                          <p className="text-xs text-muted-foreground">Address</p>
                          <p className="font-medium">{selectedStudent.address || 'Not specified'}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        Parent / Guardian
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center gap-3">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-xs text-muted-foreground">Parent Name</p>
                          <p className="font-medium">{selectedStudent.parent_name || 'Not specified'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-xs text-muted-foreground">Parent Phone</p>
                          <p className="font-medium">{selectedStudent.parent_phone || 'Not specified'}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="md:col-span-2">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-destructive" />
                        Emergency Contact
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-col sm:flex-row gap-4">
                        <div className="flex items-center gap-3 flex-1">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-xs text-muted-foreground">Contact Name</p>
                            <p className="font-medium">{selectedStudent.emergency_contact_name || 'Not specified'}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 flex-1">
                          <Phone className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-xs text-muted-foreground">Contact Number</p>
                            <p className="font-medium">{selectedStudent.emergency_contact || 'Not specified'}</p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Attendance Summary */}
                  <Card className="md:col-span-2">
                    <CardContent className="p-0">
                      <AttendanceSummary studentId={selectedStudent.id} />
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
