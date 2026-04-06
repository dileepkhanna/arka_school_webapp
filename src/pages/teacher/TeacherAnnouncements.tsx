import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { apiClient } from '@/lib/apiClient';
import { format } from 'date-fns';
import { toast } from 'sonner';
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
  Plus,
  Megaphone,
} from 'lucide-react';
import { BackButton } from '@/components/ui/back-button';

// Sidebar items from shared config with permission check
import { useTeacherSidebar } from '@/hooks/useTeacherSidebar';

interface Announcement {
  id: string;
  title: string;
  content: string;
  target_audience: string[];
  created_at: string;
}

interface ClassOption {
  id: string;
  name: string;
  section: string;
}

interface TeacherStudentsDataResponse {
  classes: ClassOption[];
  students: unknown[];
}

export default function TeacherAnnouncements() {
  const teacherSidebarItems = useTeacherSidebar();
  const { user, userRole, loading } = useAuth();
  const navigate = useNavigate();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    selectedClasses: [] as string[],
  });

  useEffect(() => {
    if (!loading && (!user || userRole !== 'teacher')) {
      navigate('/auth');
    }
  }, [user, userRole, loading, navigate]);

  useEffect(() => {
    async function fetchData() {
      if (!user) return;

      try {
        const [teacherData, announcementData] = await Promise.all([
          apiClient.get<TeacherStudentsDataResponse>('/teacher/students-data'),
          apiClient.get<Announcement[]>('/announcements'),
        ]);

        const classData = teacherData?.classes || [];
        setClasses(classData);

        const classIdentifiers = classData.map(c => c.section ? `class:${c.name}-${c.section}` : `class:${c.name}`);
        const filtered = (announcementData || []).filter((announcement) => {
          const audiences = announcement.target_audience || ['all'];
          return audiences.some((audience) =>
            audience === 'all' ||
            audience === 'teachers' ||
            classIdentifiers.includes(audience)
          );
        });

        setAnnouncements(filtered);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoadingData(false);
      }
    }

    fetchData();
  }, [user]);

  const toggleClassSelection = (classId: string) => {
    setFormData(prev => ({
      ...prev,
      selectedClasses: prev.selectedClasses.includes(classId)
        ? prev.selectedClasses.filter(id => id !== classId)
        : [...prev.selectedClasses, classId]
    }));
  };

  const handleSubmit = async () => {
    if (!formData.title || !formData.content) {
      toast.error('Please fill in all fields');
      return;
    }

    try {
      // Build target audience based on selected classes
      const targetAudience = formData.selectedClasses.length > 0
        ? formData.selectedClasses.map(classId => {
          const cls = classes.find(c => c.id === classId);
          return cls ? `class:${cls.name}${cls.section ? `-${cls.section}` : ''}` : '';
        }).filter(Boolean)
        : ['all'];

      await apiClient.post('/announcements', {
        title: formData.title,
        content: formData.content,
        target_audience: targetAudience,
      });

      toast.success('Announcement created successfully');
      setDialogOpen(false);
      setFormData({ title: '', content: '', selectedClasses: [] });

      // Refresh
      const announcementData = await apiClient.get<Announcement[]>('/announcements');
      const classIdentifiers = classes.map(c => c.section ? `class:${c.name}-${c.section}` : `class:${c.name}`);
      const filtered = (announcementData || []).filter((announcement) => {
        const audiences = announcement.target_audience || ['all'];
        return audiences.some((audience) =>
          audience === 'all' ||
          audience === 'teachers' ||
          classIdentifiers.includes(audience)
        );
      });
      setAnnouncements(filtered);
    } catch (error) {
      console.error('Error creating announcement:', error);
      toast.error('Failed to create announcement');
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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h1 className="font-display text-2xl font-bold">Announcements</h1>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="w-full sm:w-auto">
                <Plus className="h-4 w-4 mr-2" />
                New Announcement
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Announcement</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Title</Label>
                  <Input
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Announcement title"
                  />
                </div>
                <div>
                  <Label>Content</Label>
                  <Textarea
                    value={formData.content}
                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                    placeholder="Announcement content..."
                    rows={5}
                  />
                </div>
                <div>
                  <Label>Target Classes (leave empty for all)</Label>
                  <div className="mt-2 space-y-2 max-h-32 overflow-y-auto border rounded-md p-2">
                    {classes.length > 0 ? (
                      classes.map((cls) => (
                        <div key={cls.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={cls.id}
                            checked={formData.selectedClasses.includes(cls.id)}
                            onCheckedChange={() => toggleClassSelection(cls.id)}
                          />
                          <label
                            htmlFor={cls.id}
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                          >
                            {cls.section ? `${cls.name} - ${cls.section}` : cls.name}
                          </label>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">No classes assigned</p>
                    )}
                  </div>
                </div>
                <Button onClick={handleSubmit} className="w-full">
                  Publish Announcement
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {loadingData ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : announcements.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Megaphone className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No announcements yet.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {announcements.map((announcement) => (
              <Card key={announcement.id} className="card-elevated">
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-secondary/10 flex items-center justify-center">
                      <Megaphone className="h-5 w-5 text-secondary" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold">{announcement.title}</h3>
                      <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">
                        {announcement.content}
                      </p>
                      <div className="flex items-center gap-2 mt-3">
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(announcement.created_at), 'PPP')}
                        </span>
                        {announcement.target_audience?.map((audience) => (
                          <Badge key={audience} variant="secondary" className="text-xs">
                            {audience}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
