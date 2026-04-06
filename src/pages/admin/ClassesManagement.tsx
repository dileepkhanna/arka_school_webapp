import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { apiClient } from '@/lib/apiClient';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { adminSidebarItems } from '@/config/adminSidebar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Plus, Search, Loader2, MoreHorizontal, Edit, Trash2, Users } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { BackButton } from '@/components/ui/back-button';

interface ClassItem {
  id: number;
  name: string;
  section: string;
  academic_year: string;
  class_teacher_id: number | null;
  class_teacher?: { id: number; profiles: { full_name: string } | null } | null;
  student_count?: number;
}

interface Teacher {
  id: number;
  user_id: number;
  profiles: { full_name: string } | null;
}

export default function ClassesManagement() {
  const { user, userRole, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<ClassItem | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    section: '',
    academicYear: '2024-2025',
    classTeacherId: '',
  });

  const [editFormData, setEditFormData] = useState({
    name: '',
    section: '',
    academicYear: '',
    classTeacherId: '',
  });

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
      const [classesData, teachersData] = await Promise.all([
        apiClient.get<ClassItem[]>('/classes/management'),
        apiClient.get<Teacher[]>('/teachers/basic'),
      ]);

      setClasses(classesData || []);
      setTeachers(teachersData || []);
    } catch (error) {
      console.error('Failed to fetch classes data', error);
      setClasses([]);
      setTeachers([]);
    }

    setLoadingData(false);
  };

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) {
      toast({ variant: 'destructive', title: 'Error', description: 'Name is required' });
      return;
    }

    setIsSubmitting(true);

    try {
      await apiClient.post('/classes', {
        name: formData.name,
        section: formData.section,
        academic_year: formData.academicYear,
        class_teacher_id: formData.classTeacherId ? Number(formData.classTeacherId) : null,
      });

      toast({ title: 'Success', description: 'Class created successfully' });
      setDialogOpen(false);
      setFormData({ name: '', section: '', academicYear: '2024-2025', classTeacherId: '' });
      fetchData();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    }

    setIsSubmitting(false);
  };

  const handleDeleteClass = async (id: number) => {
    try {
      await apiClient.delete(`/classes/${id}`);
      toast({ title: 'Deleted', description: 'Class removed successfully' });
      fetchData();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    }
  };

  const openEditDialog = (cls: ClassItem) => {
    setEditingClass(cls);
    setEditFormData({
      name: cls.name,
      section: cls.section,
      academicYear: cls.academic_year,
      classTeacherId: cls.class_teacher_id || '',
    });
    setEditDialogOpen(true);
  };

  const handleEditClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClass) return;

    if (!editFormData.name) {
      toast({ variant: 'destructive', title: 'Error', description: 'Name is required' });
      return;
    }

    setIsSubmitting(true);

    try {
      await apiClient.put(`/classes/${editingClass.id}`, {
        name: editFormData.name,
        section: editFormData.section,
        academic_year: editFormData.academicYear,
        class_teacher_id: editFormData.classTeacherId ? Number(editFormData.classTeacherId) : null,
      });

      toast({ title: 'Success', description: 'Class updated successfully' });
      setEditDialogOpen(false);
      setEditingClass(null);
      fetchData();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    }

    setIsSubmitting(false);
  };

  const filteredClasses = classes.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.section.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <DashboardLayout sidebarItems={adminSidebarItems} roleColor="admin">
      <div className="space-y-6 animate-fade-in">
        <BackButton to="/admin" />
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold">Classes Management</h1>
            <p className="text-muted-foreground">Manage classes and sections</p>
          </div>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gradient-admin"><Plus className="h-4 w-4 mr-2" />Add Class</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="font-display">Add New Class</DialogTitle>
                <DialogDescription>Create a new class with section</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateClass} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Class Name *</Label>
                    <Input placeholder="e.g., Class 10" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
                  </div>

                  <div className="space-y-2">
                    <Label>Section</Label>
                    <Input placeholder="e.g., A" value={formData.section} onChange={(e) => setFormData({ ...formData, section: e.target.value })} />
                  </div>

                  <div className="space-y-2">
                    <Label>Academic Year</Label>
                    <Input value={formData.academicYear} onChange={(e) => setFormData({ ...formData, academicYear: e.target.value })} />
                  </div>

                  <div className="space-y-2">
                    <Label>Class Teacher</Label>
                    <Select value={formData.classTeacherId} onValueChange={(v) => setFormData({ ...formData, classTeacherId: v })}>
                      <SelectTrigger><SelectValue placeholder="Select teacher" /></SelectTrigger>
                      <SelectContent>
                        {teachers.map((t) => (
                          <SelectItem key={t.id} value={String(t.id)}>{t.profiles?.full_name || 'Unknown'}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <DialogFooter>
                  <Button type="submit" disabled={isSubmitting} className="w-full gradient-admin">
                    {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Create Class
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card className="card-elevated">
          <CardContent className="pt-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search classes..." className="pl-10" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            </div>
          </CardContent>
        </Card>

        <Card className="card-elevated">
          <CardHeader><CardTitle className="font-display">All Classes ({filteredClasses.length})</CardTitle></CardHeader>
          <CardContent>
            {loadingData ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            ) : filteredClasses.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">{searchQuery ? 'No classes found' : 'No classes added yet'}</div>
            ) : (
              <>
                {/* Mobile Cards */}
                <div className="space-y-3 sm:hidden">
                  {filteredClasses.map((cls) => (
                    <div key={cls.id} className="p-3 rounded-xl border bg-muted/10 space-y-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium text-sm">{cls.section ? `${cls.name} - ${cls.section}` : cls.name}</p>
                          <Badge variant="secondary" className="text-[10px] mt-0.5">{cls.academic_year}</Badge>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openEditDialog(cls)}><Edit className="h-4 w-4 mr-2" />Edit</DropdownMenuItem>
                              <DropdownMenuItem className="text-destructive" onClick={() => handleDeleteClass(cls.id)}><Trash2 className="h-4 w-4 mr-2" />Delete</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                      <div className="space-y-1 text-xs">
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Users className="h-3 w-3 shrink-0" />
                          <span>{cls.student_count} Students</span>
                        </div>
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <span className="font-medium">Teacher:</span>
                          <span>{cls.class_teacher?.profiles?.full_name || 'Not assigned'}</span>
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
                        <TableHead>Class</TableHead>
                        <TableHead>Section</TableHead>
                        <TableHead>Academic Year</TableHead>
                        <TableHead>Class Teacher</TableHead>
                        <TableHead>Students</TableHead>
                        <TableHead className="w-[50px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredClasses.map((cls) => (
                        <TableRow key={cls.id}>
                          <TableCell className="font-medium">{cls.section ? `${cls.name} - ${cls.section}` : cls.name}</TableCell>
                          <TableCell>{cls.section || '-'}</TableCell>
                          <TableCell>{cls.academic_year}</TableCell>
                          <TableCell>{cls.class_teacher?.profiles?.full_name || 'Not assigned'}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Users className="h-4 w-4 text-muted-foreground" />
                              {cls.student_count}
                            </div>
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => openEditDialog(cls)}><Edit className="h-4 w-4 mr-2" />Edit</DropdownMenuItem>
                                <DropdownMenuItem className="text-destructive" onClick={() => handleDeleteClass(cls.id)}><Trash2 className="h-4 w-4 mr-2" />Delete</DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
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

        {/* Edit Class Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="font-display">Edit Class</DialogTitle>
              <DialogDescription>Update class details</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleEditClass} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Class Name *</Label>
                  <Input placeholder="e.g., Class 10" value={editFormData.name} onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })} />
                </div>

                <div className="space-y-2">
                  <Label>Section</Label>
                  <Input placeholder="e.g., A" value={editFormData.section} onChange={(e) => setEditFormData({ ...editFormData, section: e.target.value })} />
                </div>

                <div className="space-y-2">
                  <Label>Academic Year</Label>
                  <Input value={editFormData.academicYear} onChange={(e) => setEditFormData({ ...editFormData, academicYear: e.target.value })} />
                </div>

                <div className="space-y-2">
                  <Label>Class Teacher</Label>
                  <Select value={editFormData.classTeacherId || 'none'} onValueChange={(v) => setEditFormData({ ...editFormData, classTeacherId: v === 'none' ? '' : v })}>
                    <SelectTrigger><SelectValue placeholder="Select teacher" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {teachers.map((t) => (
                        <SelectItem key={t.id} value={String(t.id)}>{t.profiles?.full_name || 'Unknown'}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditDialogOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={isSubmitting} className="gradient-admin">
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
