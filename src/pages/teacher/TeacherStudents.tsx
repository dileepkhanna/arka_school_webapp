import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { apiClient } from '@/lib/apiClient';
import { toast } from 'sonner';
import AttendanceSummary from '@/components/AttendanceSummary';
import {
  Users,
  GraduationCap,
  BookOpen,
  Calendar,
  Bell,
  FileText,
  MessageSquare,
  Clock,
  LayoutDashboard,
  Loader2,
  ClipboardList,
  Search,
  Eye,
  Edit,
  Phone,
  MapPin,
  Heart,
  AlertCircle,
  User,
  Plus,
  Upload,
  Copy,
  Check,
} from 'lucide-react';
import { BackButton } from '@/components/ui/back-button';

// Sidebar items from shared config with permission check
import { useTeacherSidebar } from '@/hooks/useTeacherSidebar';

interface Student {
  id: string;
  full_name: string;
  admission_number: string;
  photo_url: string | null;
  date_of_birth: string | null;
  address: string | null;
  status: string | null;
  blood_group: string | null;
  emergency_contact: string | null;
  emergency_contact_name: string | null;
  parent_name: string | null;
  parent_phone: string | null;
  class_id: string | null;
  classes?: { name: string; section: string } | null;
}

interface ClassOption {
  id: string;
  name: string;
  section: string;
}

interface TeacherStudentsDataResponse {
  classes: ClassOption[];
  students: Student[];
}

export default function TeacherStudents() {
  const teacherSidebarItems = useTeacherSidebar();
  const { user, userRole, loading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [selectedClass, setSelectedClass] = useState(searchParams.get('class') || '');
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingData, setLoadingData] = useState(true);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [createdStudentId, setCreatedStudentId] = useState<string | null>(null);
  const [createdPassword, setCreatedPassword] = useState<string | null>(null);
  const [successDialogOpen, setSuccessDialogOpen] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string>('');

  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    password: '',
    date_of_birth: '',
    class_id: '',
    address: '',
    blood_group: '',
    parent_name: '',
    parent_phone: '',
    emergency_contact: '',
    emergency_contact_name: '',
  });

  const [editFormData, setEditFormData] = useState({
    full_name: '',
    date_of_birth: '',
    address: '',
    blood_group: '',
    parent_name: '',
    parent_phone: '',
    emergency_contact: '',
    emergency_contact_name: '',
    password: '',
    status: '',
  });

  useEffect(() => {
    if (!loading && (!user || userRole !== 'teacher')) {
      navigate('/auth');
    }
  }, [user, userRole, loading, navigate]);

  const fetchStudentsData = async (classId?: string) => {
    if (!user) return;

    setLoadingData(true);
    try {
      const query = classId ? `?class_id=${encodeURIComponent(classId)}` : '';
      const data = await apiClient.get<TeacherStudentsDataResponse>(`/teacher/students-data${query}`);

      const classList = data?.classes || [];
      const studentList = data?.students || [];

      setClasses(classList);
      setStudents(studentList);

      if (!classId && !selectedClass && classList.length > 0) {
        setSelectedClass(classList[0].id);
      }
    } catch (error) {
      console.error('Error fetching teacher students data:', error);
      setClasses([]);
      setStudents([]);
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    fetchStudentsData(selectedClass || undefined);
  }, [user, selectedClass]);

  const filteredStudents = students.filter(s =>
    s.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.admission_number.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const openStudentDetails = (student: Student) => {
    setSelectedStudent(student);
    setDetailsOpen(true);
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoFile(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  // Generate student ID based on name, class, and section
  const generateStudentId = (name: string, className: string, section: string): string => {
    // Get first name (uppercase, cleaned)
    const namePart = name.split(' ')[0].toUpperCase().replace(/[^A-Z]/g, '');
    // Get class name
    const classPart = className.toUpperCase().replace(/[^A-Z0-9]/g, '');
    // Get section letter
    const sectionPart = section.toUpperCase().replace(/[^A-Z]/g, '');

    // Only add section if it exists
    return sectionPart ? `${namePart}-${classPart}-${sectionPart}` : `${namePart}-${classPart}`;
  };

  // Update preview ID when name or class changes
  const updatePreviewId = (name: string, classId: string) => {
    if (name && classId) {
      const classData = classes.find(c => c.id === classId);
      if (classData) {
        const id = generateStudentId(name, classData.name, classData.section);
        setPreviewId(id);
      }
    } else {
      setPreviewId('');
    }
  };

  const generatePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let password = '';
    for (let i = 0; i < 10; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setFormData({ ...formData, password });
  };

  const copyToClipboard = async (text: string, field: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.full_name || !formData.class_id) {
      toast.error('Please fill in the required fields (Name and Class)');
      return;
    }

    if (!formData.password || formData.password.length < 4) {
      toast.error('Please set a password (minimum 4 characters) for parent login');
      return;
    }

    setIsSubmitting(true);

    try {
      // Get class details for ID generation
      const selectedClassData = classes.find(c => c.id === formData.class_id);
      if (!selectedClassData) {
        toast.error('Invalid class selected');
        setIsSubmitting(false);
        return;
      }

      const payload = new FormData();
      payload.append('full_name', formData.full_name);
      payload.append('class_id', formData.class_id);
      payload.append('password', formData.password);
      if (formData.email) payload.append('email', formData.email);
      if (formData.date_of_birth) payload.append('date_of_birth', formData.date_of_birth);
      if (formData.address) payload.append('address', formData.address);
      if (formData.blood_group) payload.append('blood_group', formData.blood_group);
      if (formData.parent_name) payload.append('parent_name', formData.parent_name);
      if (formData.parent_phone) payload.append('parent_phone', formData.parent_phone);
      if (formData.emergency_contact) payload.append('emergency_contact', formData.emergency_contact);
      if (formData.emergency_contact_name) payload.append('emergency_contact_name', formData.emergency_contact_name);
      if (photoFile) payload.append('photo', photoFile);

      const result = await apiClient.postForm<{ student_id: string }>('/teacher/students', payload);

      // Show success dialog with student ID and password
      setCreatedStudentId(result.student_id);
      setCreatedPassword(formData.password);
      setAddDialogOpen(false);
      setSuccessDialogOpen(true);

      // Reset form
      setFormData({
        full_name: '',
        email: '',
        password: '',
        date_of_birth: '',
        class_id: selectedClass,
        address: '',
        blood_group: '',
        parent_name: '',
        parent_phone: '',
        emergency_contact: '',
        emergency_contact_name: '',
      });
      setPhotoFile(null);
      setPhotoPreview('');
      setPreviewId('');

      await fetchStudentsData(selectedClass || formData.class_id);

      toast.success('Student and parent account created successfully');
    } catch (error: any) {
      console.error('Error creating student:', error);
      toast.error(error.message || 'Failed to create student');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditStudent = (student: Student) => {
    setSelectedStudent(student);
    setEditFormData({
      full_name: student.full_name,
      date_of_birth: student.date_of_birth || '',
      address: student.address || '',
      blood_group: student.blood_group || '',
      parent_name: student.parent_name || '',
      parent_phone: student.parent_phone || '',
      emergency_contact: student.emergency_contact || '',
      emergency_contact_name: student.emergency_contact_name || '',
      password: '',
      status: student.status || 'active',
    });
    setEditDialogOpen(true);
  };

  const handleEditStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent) return;

    if (editFormData.password && editFormData.password.length < 4) {
      toast.error('Password must be at least 4 characters');
      return;
    }

    setIsSubmitting(true);

    try {
      const payload: any = {
        full_name: editFormData.full_name,
        date_of_birth: editFormData.date_of_birth || null,
        address: editFormData.address || null,
        blood_group: editFormData.blood_group || null,
        parent_name: editFormData.parent_name || null,
        parent_phone: editFormData.parent_phone || null,
        emergency_contact: editFormData.emergency_contact || null,
        emergency_contact_name: editFormData.emergency_contact_name || null,
        status: editFormData.status,
      };

      if (editFormData.password) {
        payload.password = editFormData.password;
      }

      await apiClient.put(`/teacher/students/${selectedStudent.id}`, {
        ...payload,
      });

      toast.success(editFormData.password ? 'Student updated and password changed' : 'Student updated successfully');
      setEditDialogOpen(false);

      await fetchStudentsData(selectedClass || undefined);
    } catch (error: any) {
      toast.error(error.message || 'Failed to update student');
    } finally {
      setIsSubmitting(false);
    }
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
        <BackButton to="/teacher" />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h1 className="font-display text-2xl font-bold">Students</h1>
          <div className="flex flex-col sm:flex-row gap-3">
            <Select value={selectedClass} onValueChange={setSelectedClass}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Select Class" />
              </SelectTrigger>
              <SelectContent>
                {classes.map((cls) => (
                  <SelectItem key={cls.id} value={cls.id}>
                    {cls.section ? `${cls.name} - ${cls.section}` : cls.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search students..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 w-full sm:w-[250px]"
              />
            </div>
            <Button onClick={() => {
              setFormData({ ...formData, class_id: selectedClass });
              setAddDialogOpen(true);
            }} disabled={!selectedClass}>
              <Plus className="h-4 w-4 mr-2" />
              Add Student
            </Button>
          </div>
        </div>

        {loadingData ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : classes.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No classes assigned to you yet.</p>
            </CardContent>
          </Card>
        ) : filteredStudents.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No students found.</p>
              <Button className="mt-4" onClick={() => {
                setFormData({ ...formData, class_id: selectedClass });
                setAddDialogOpen(true);
              }}>
                <Plus className="h-4 w-4 mr-2" />
                Add First Student
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredStudents.map((student) => (
              <Card key={student.id} className="card-elevated">
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <Avatar className="h-16 w-16">
                      <AvatarImage src={student.photo_url || ''} />
                      <AvatarFallback className="gradient-teacher text-white text-lg">
                        {student.full_name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold truncate">{student.full_name}</h3>
                      <p className="text-sm text-muted-foreground font-mono">{student.admission_number}</p>
                      <Badge variant={student.status === 'active' ? 'default' : 'secondary'} className="mt-1">
                        {student.status || 'Active'}
                      </Badge>
                    </div>
                    <div className="flex flex-col gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openStudentDetails(student)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => openEditStudent(student)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Add Student Dialog */}
        <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add New Student</DialogTitle>
              <DialogDescription>Enter student details. Student ID will be generated automatically.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddStudent} className="space-y-4">
              {/* Photo Upload */}
              <div className="flex justify-center">
                <label className="cursor-pointer">
                  <div className="w-24 h-24 rounded-full border-2 border-dashed border-muted-foreground/50 flex items-center justify-center overflow-hidden hover:border-primary transition-colors">
                    {photoPreview ? (
                      <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <Upload className="h-8 w-8 text-muted-foreground" />
                    )}
                  </div>
                  <input type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" />
                </label>
              </div>

              {/* Preview Student ID */}
              {previewId && (
                <div className="p-3 bg-primary/10 border border-primary/20 rounded-lg text-center">
                  <Label className="text-xs text-muted-foreground">Generated Student ID (Preview)</Label>
                  <p className="font-mono text-lg font-bold text-primary">{previewId}</p>
                </div>
              )}

              {/* Basic Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <Label>Full Name *</Label>
                  <Input
                    value={formData.full_name}
                    onChange={(e) => {
                      const newName = e.target.value;
                      setFormData({ ...formData, full_name: newName });
                      updatePreviewId(newName, formData.class_id);
                    }}
                    placeholder="Enter full name"
                    required
                  />
                </div>
                <div>
                  <Label>Class *</Label>
                  <Select
                    value={formData.class_id}
                    onValueChange={(v) => {
                      setFormData({ ...formData, class_id: v });
                      updatePreviewId(formData.full_name, v);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select class" />
                    </SelectTrigger>
                    <SelectContent>
                      {classes.map((cls) => (
                        <SelectItem key={cls.id} value={cls.id}>
                          {cls.section ? `${cls.name} - ${cls.section}` : cls.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Password (for Parent Login) *</Label>
                  <div className="flex gap-2">
                    <Input
                      type="text"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      placeholder="Enter password"
                      required
                    />
                    <Button type="button" variant="outline" size="sm" onClick={generatePassword}>
                      Generate
                    </Button>
                  </div>
                </div>
                <div>
                  <Label>Date of Birth</Label>
                  <Input
                    type="date"
                    value={formData.date_of_birth}
                    onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Email (Optional)</Label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="student@school.edu"
                  />
                </div>
                <div>
                  <Label>Blood Group</Label>
                  <Select value={formData.blood_group} onValueChange={(v) => setFormData({ ...formData, blood_group: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select blood group" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="A+">A+</SelectItem>
                      <SelectItem value="A-">A-</SelectItem>
                      <SelectItem value="B+">B+</SelectItem>
                      <SelectItem value="B-">B-</SelectItem>
                      <SelectItem value="AB+">AB+</SelectItem>
                      <SelectItem value="AB-">AB-</SelectItem>
                      <SelectItem value="O+">O+</SelectItem>
                      <SelectItem value="O-">O-</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-2">
                  <Label>Address</Label>
                  <Textarea
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder="Enter address"
                    rows={2}
                  />
                </div>
              </div>

              {/* Parent Information */}
              <div className="space-y-2">
                <h4 className="font-medium flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Parent/Guardian Information
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Parent's Full Name</Label>
                    <Input
                      value={formData.parent_name}
                      onChange={(e) => setFormData({ ...formData, parent_name: e.target.value })}
                      placeholder="Parent's full name"
                    />
                  </div>
                  <div>
                    <Label>Parent's Phone</Label>
                    <Input
                      value={formData.parent_phone}
                      onChange={(e) => setFormData({ ...formData, parent_phone: e.target.value })}
                      placeholder="Parent's phone number"
                    />
                  </div>
                </div>
              </div>

              {/* Emergency Contact */}
              <div className="space-y-2">
                <h4 className="font-medium flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  Emergency Contact
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Contact Name</Label>
                    <Input
                      value={formData.emergency_contact_name}
                      onChange={(e) => setFormData({ ...formData, emergency_contact_name: e.target.value })}
                      placeholder="Emergency contact name"
                    />
                  </div>
                  <div>
                    <Label>Contact Phone</Label>
                    <Input
                      value={formData.emergency_contact}
                      onChange={(e) => setFormData({ ...formData, emergency_contact: e.target.value })}
                      placeholder="Emergency phone number"
                    />
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setAddDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create Student
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Success Dialog with Student ID and Password */}
        <Dialog open={successDialogOpen} onOpenChange={setSuccessDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-primary">
                <Check className="h-5 w-5" />
                Student Created Successfully
              </DialogTitle>
              <DialogDescription>
                Here are the student's credentials. Please save them for your records.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="p-4 bg-muted rounded-lg">
                <Label className="text-xs text-muted-foreground">Student ID</Label>
                <div className="flex items-center gap-2 mt-1">
                  <span className="font-mono text-lg font-bold">{createdStudentId}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => copyToClipboard(createdStudentId || '', 'id')}
                  >
                    {copiedField === 'id' ? (
                      <Check className="h-4 w-4 text-primary" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
              {createdPassword && (
                <div className="p-4 bg-muted rounded-lg">
                  <Label className="text-xs text-muted-foreground">Password</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="font-mono text-lg font-bold">{createdPassword}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => copyToClipboard(createdPassword || '', 'password')}
                    >
                      {copiedField === 'password' ? (
                        <Check className="h-4 w-4 text-primary" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button onClick={() => setSuccessDialogOpen(false)}>Done</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Student Details Dialog */}
        <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-display">Student Profile</DialogTitle>
            </DialogHeader>
            {selectedStudent && (
              <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center gap-4">
                  <Avatar className="h-20 w-20">
                    <AvatarImage src={selectedStudent.photo_url || ''} />
                    <AvatarFallback className="gradient-teacher text-white text-2xl">
                      {selectedStudent.full_name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h2 className="text-xl font-bold">{selectedStudent.full_name}</h2>
                    <p className="text-muted-foreground font-mono">{selectedStudent.admission_number}</p>
                    <Badge variant={selectedStudent.status === 'active' ? 'default' : 'secondary'}>
                      {selectedStudent.status || 'Active'}
                    </Badge>
                  </div>
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground flex items-center gap-1">
                      <GraduationCap className="h-3 w-3" /> Class & Section
                    </Label>
                    <p className="font-medium">
                      {selectedStudent.classes ? (selectedStudent.classes.section ? `${selectedStudent.classes.name} - ${selectedStudent.classes.section}` : selectedStudent.classes.name) : 'N/A'}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-3 w-3" /> Date of Birth
                    </Label>
                    <p className="font-medium">
                      {selectedStudent.date_of_birth ? new Date(selectedStudent.date_of_birth).toLocaleDateString() : 'N/A'}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground flex items-center gap-1">
                      <Heart className="h-3 w-3" /> Blood Group
                    </Label>
                    <p className="font-medium">{selectedStudent.blood_group || 'N/A'}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground flex items-center gap-1">
                      <MapPin className="h-3 w-3" /> Address
                    </Label>
                    <p className="font-medium">{selectedStudent.address || 'N/A'}</p>
                  </div>
                </div>

                {/* Parent Information */}
                <div className="border-t pt-4">
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Parent/Guardian Information
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Parent Name</Label>
                      <p className="font-medium">{selectedStudent.parent_name || 'N/A'}</p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground flex items-center gap-1">
                        <Phone className="h-3 w-3" /> Parent Phone
                      </Label>
                      <p className="font-medium">{selectedStudent.parent_phone || 'N/A'}</p>
                    </div>
                  </div>
                </div>

                {/* Emergency Contact */}
                <div className="border-t pt-4">
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    Emergency Contact
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Contact Name</Label>
                      <p className="font-medium">{selectedStudent.emergency_contact_name || 'N/A'}</p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground flex items-center gap-1">
                        <Phone className="h-3 w-3" /> Contact Phone
                      </Label>
                      <p className="font-medium">{selectedStudent.emergency_contact || 'N/A'}</p>
                    </div>
                  </div>
                </div>

                {/* Attendance Summary */}
                <div className="border-t pt-4">
                  <AttendanceSummary studentId={Number(selectedStudent.id)} />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setDetailsOpen(false)}>Close</Button>
              <Button onClick={() => { setDetailsOpen(false); openEditStudent(selectedStudent!); }}>
                <Edit className="h-4 w-4 mr-2" />Edit
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Student Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-display">Edit Student</DialogTitle>
              <DialogDescription>Update student details</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleEditStudent} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <Label>Full Name *</Label>
                  <Input
                    value={editFormData.full_name}
                    onChange={(e) => setEditFormData({ ...editFormData, full_name: e.target.value })}
                    placeholder="Enter full name"
                    required
                  />
                </div>

                <div>
                  <Label>Date of Birth</Label>
                  <Input
                    type="date"
                    value={editFormData.date_of_birth}
                    onChange={(e) => setEditFormData({ ...editFormData, date_of_birth: e.target.value })}
                  />
                </div>

                <div>
                  <Label>Blood Group</Label>
                  <Select value={editFormData.blood_group} onValueChange={(v) => setEditFormData({ ...editFormData, blood_group: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select blood group" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="A+">A+</SelectItem>
                      <SelectItem value="A-">A-</SelectItem>
                      <SelectItem value="B+">B+</SelectItem>
                      <SelectItem value="B-">B-</SelectItem>
                      <SelectItem value="AB+">AB+</SelectItem>
                      <SelectItem value="AB-">AB-</SelectItem>
                      <SelectItem value="O+">O+</SelectItem>
                      <SelectItem value="O-">O-</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Status</Label>
                  <Select value={editFormData.status} onValueChange={(v) => setEditFormData({ ...editFormData, status: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Password (optional)</Label>
                  <Input
                    type="password"
                    value={editFormData.password}
                    onChange={(e) => setEditFormData({ ...editFormData, password: e.target.value })}
                    placeholder="Leave blank to keep current"
                  />
                </div>

                <div className="md:col-span-2">
                  <Label>Address</Label>
                  <Textarea
                    value={editFormData.address}
                    onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })}
                    placeholder="Enter address"
                    rows={2}
                  />
                </div>

                <div>
                  <Label>Parent's Full Name</Label>
                  <Input
                    value={editFormData.parent_name}
                    onChange={(e) => setEditFormData({ ...editFormData, parent_name: e.target.value })}
                    placeholder="Parent's full name"
                  />
                </div>

                <div>
                  <Label>Parent's Phone</Label>
                  <Input
                    value={editFormData.parent_phone}
                    onChange={(e) => setEditFormData({ ...editFormData, parent_phone: e.target.value })}
                    placeholder="Parent's phone number"
                  />
                </div>

                <div>
                  <Label>Emergency Contact Name</Label>
                  <Input
                    value={editFormData.emergency_contact_name}
                    onChange={(e) => setEditFormData({ ...editFormData, emergency_contact_name: e.target.value })}
                    placeholder="Emergency contact name"
                  />
                </div>

                <div>
                  <Label>Emergency Contact Phone</Label>
                  <Input
                    value={editFormData.emergency_contact}
                    onChange={(e) => setEditFormData({ ...editFormData, emergency_contact: e.target.value })}
                    placeholder="Emergency contact phone"
                  />
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditDialogOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Save Changes
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
