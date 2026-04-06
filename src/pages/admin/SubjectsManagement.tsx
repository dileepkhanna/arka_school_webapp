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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Plus, Search, Loader2, MoreHorizontal, Edit, Trash2, BookOpen, FlaskConical, Filter } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { BackButton } from '@/components/ui/back-button';

interface Subject {
  id: number;
  name: string;
  code: string | null;
  category: string | null;
  created_at: string;
}

export default function SubjectsManagement() {
  const { user, userRole, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);

  const [categoryFilter, setCategoryFilter] = useState('all');
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    category: 'general',
  });

  useEffect(() => {
    if (!loading && (!user || userRole !== 'admin')) {
      navigate('/auth');
    }
  }, [user, userRole, loading, navigate]);

  useEffect(() => {
    fetchSubjects();
  }, []);

  const fetchSubjects = async () => {
    setLoadingData(true);
    try {
      const data = await apiClient.get<Subject[]>('/subjects');
      setSubjects(data || []);
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to fetch subjects' });
    }

    setLoadingData(false);
  };

  const handleCreateSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast({ variant: 'destructive', title: 'Error', description: 'Subject name is required' });
      return;
    }

    setIsSubmitting(true);

    try {
      await apiClient.post('/subjects', {
        name: formData.name.trim(),
        code: formData.code.trim() || null,
        category: formData.category,
      });

      toast({ title: 'Success', description: 'Subject created successfully' });
      setDialogOpen(false);
      setFormData({ name: '', code: '', category: 'general' });
      fetchSubjects();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    }

    setIsSubmitting(false);
  };

  const handleEditSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSubject || !formData.name.trim()) {
      toast({ variant: 'destructive', title: 'Error', description: 'Subject name is required' });
      return;
    }

    setIsSubmitting(true);

    try {
      await apiClient.put(`/subjects/${editingSubject.id}`, {
        name: formData.name.trim(),
        code: formData.code.trim() || null,
        category: formData.category,
      });

      toast({ title: 'Success', description: 'Subject updated successfully' });
      setEditDialogOpen(false);
      setEditingSubject(null);
      setFormData({ name: '', code: '', category: 'general' });
      fetchSubjects();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    }

    setIsSubmitting(false);
  };

  const handleDeleteSubject = async (id: number) => {
    try {
      await apiClient.delete(`/subjects/${id}`);
      toast({ title: 'Deleted', description: 'Subject removed successfully' });
      fetchSubjects();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    }
  };

  const openEditDialog = (subject: Subject) => {
    setEditingSubject(subject);
    setFormData({ name: subject.name, code: subject.code || '', category: subject.category || 'general' });
    setEditDialogOpen(true);
  };

  const filteredSubjects = subjects.filter((s) => {
    const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.code && s.code.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory = categoryFilter === 'all' || (s.category || 'general') === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <DashboardLayout sidebarItems={adminSidebarItems} roleColor="admin">
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold">Subjects Management</h1>
            <p className="text-muted-foreground">Manage all subjects taught in school</p>
          </div>

          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (open) setFormData({ name: '', code: '', category: 'general' }); }}>
            <DialogTrigger asChild>
              <Button className="gradient-admin"><Plus className="h-4 w-4 mr-2" />Add Subject</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="font-display">Add New Subject</DialogTitle>
                <DialogDescription>Create a new subject for the curriculum</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateSubject} className="space-y-4">
                <div className="space-y-2">
                  <Label>Subject Name *</Label>
                  <Input 
                    placeholder="e.g., Mathematics" 
                    value={formData.name} 
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })} 
                  />
                </div>

                <div className="space-y-2">
                  <Label>Subject Code (optional)</Label>
                  <Input 
                    placeholder="e.g., MATH101" 
                    value={formData.code} 
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })} 
                  />
                </div>

                <div className="space-y-2">
                  <Label>Category *</Label>
                  <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="general">General</SelectItem>
                      <SelectItem value="competitive">Competitive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <DialogFooter>
                  <Button type="submit" disabled={isSubmitting} className="w-full gradient-admin">
                    {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Create Subject
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          {/* Edit Dialog */}
          <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="font-display">Edit Subject</DialogTitle>
                <DialogDescription>Update subject details</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleEditSubject} className="space-y-4">
                <div className="space-y-2">
                  <Label>Subject Name *</Label>
                  <Input 
                    placeholder="e.g., Mathematics" 
                    value={formData.name} 
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })} 
                  />
                </div>

                <div className="space-y-2">
                  <Label>Subject Code (optional)</Label>
                  <Input 
                    placeholder="e.g., MATH101" 
                    value={formData.code} 
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })} 
                  />
                </div>

                <div className="space-y-2">
                  <Label>Category *</Label>
                  <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="general">General</SelectItem>
                      <SelectItem value="competitive">Competitive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <DialogFooter>
                  <Button type="submit" disabled={isSubmitting} className="w-full gradient-admin">
                    {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Update Subject
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card className="card-elevated">
          <CardContent className="pt-6 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search subjects by name or code..." 
                className="pl-10" 
                value={searchQuery} 
                onChange={(e) => setSearchQuery(e.target.value)} 
              />
            </div>
            <Tabs value={categoryFilter} onValueChange={setCategoryFilter}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="general" className="flex items-center gap-1">
                  <BookOpen className="h-3.5 w-3.5" /> General
                </TabsTrigger>
                <TabsTrigger value="competitive" className="flex items-center gap-1">
                  <FlaskConical className="h-3.5 w-3.5" /> Competitive
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </CardContent>
        </Card>

        <Card className="card-elevated">
          <CardHeader>
            <CardTitle className="font-display flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              All Subjects ({filteredSubjects.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingData ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            ) : filteredSubjects.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                {searchQuery ? 'No subjects found matching your search' : 'No subjects added yet. Click "Add Subject" to get started.'}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Subject Name</TableHead>
                      <TableHead>Code</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSubjects.map((subject) => (
                      <TableRow key={subject.id}>
                        <TableCell className="font-medium">{subject.name}</TableCell>
                        <TableCell className="font-mono text-sm text-muted-foreground">
                          {subject.code || '-'}
                        </TableCell>
                        <TableCell>
                          <Badge variant={(subject.category || 'general') === 'competitive' ? 'default' : 'secondary'} className="text-xs">
                            {(subject.category || 'general') === 'competitive' ? (
                              <><FlaskConical className="h-3 w-3 mr-1" />Competitive</>
                            ) : 'General'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(subject.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openEditDialog(subject)}>
                                <Edit className="h-4 w-4 mr-2" />Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                className="text-destructive" 
                                onClick={() => handleDeleteSubject(subject.id)}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
