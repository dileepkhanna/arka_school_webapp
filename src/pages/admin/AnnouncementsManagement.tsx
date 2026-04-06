import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { apiClient } from '@/lib/apiClient';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { adminSidebarItems } from '@/config/adminSidebar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import { Plus, Search, Loader2, MoreHorizontal, Edit, Trash2, Bell, Megaphone } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { BackButton } from '@/components/ui/back-button';

interface Announcement {
  id: string;
  title: string;
  content: string;
  target_audience: string[] | null;
  created_at: string;
  created_by: string | null;
}

export default function AnnouncementsManagement() {
  const { user, userRole, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    content: '',
    targetAudience: 'all',
  });

  useEffect(() => {
    if (!loading && (!user || userRole !== 'admin')) {
      navigate('/auth');
    }
  }, [user, userRole, loading, navigate]);

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const fetchAnnouncements = async () => {
    setLoadingData(true);
    try {
      const data = await apiClient.get<Announcement[]>('/announcements');
      setAnnouncements(data || []);
    } catch (error) {
      console.error('Failed to fetch announcements', error);
      setAnnouncements([]);
    }

    setLoadingData(false);
  };

  const handleCreateAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.content) {
      toast({ variant: 'destructive', title: 'Error', description: 'Title and content are required' });
      return;
    }

    setIsSubmitting(true);

    try {
      await apiClient.post('/announcements', {
        title: formData.title,
        content: formData.content,
        target_audience: [formData.targetAudience],
        created_by: user?.id,
      });

      toast({ title: 'Success', description: 'Announcement published' });
      setDialogOpen(false);
      setFormData({ title: '', content: '', targetAudience: 'all' });
      fetchAnnouncements();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    }

    setIsSubmitting(false);
  };

  const handleDeleteAnnouncement = async (id: string) => {
    try {
      await apiClient.delete(`/announcements/${id}`);

      toast({ title: 'Deleted', description: 'Announcement removed' });
      fetchAnnouncements();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message || 'Delete failed' });
    }
  };

  const filteredAnnouncements = announcements.filter((a) =>
    a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    a.content.toLowerCase().includes(searchQuery.toLowerCase())
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
            <h1 className="font-display text-2xl font-bold">Announcements</h1>
            <p className="text-muted-foreground">Manage school announcements</p>
          </div>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gradient-admin"><Plus className="h-4 w-4 mr-2" />New Announcement</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle className="font-display">Create Announcement</DialogTitle>
                <DialogDescription>Publish a new announcement</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateAnnouncement} className="space-y-4">
                <div className="space-y-2">
                  <Label>Title *</Label>
                  <Input placeholder="Announcement title" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} />
                </div>

                <div className="space-y-2">
                  <Label>Content *</Label>
                  <Textarea placeholder="Announcement content..." rows={5} value={formData.content} onChange={(e) => setFormData({ ...formData, content: e.target.value })} />
                </div>

                <div className="space-y-2">
                  <Label>Target Audience</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={formData.targetAudience}
                    onChange={(e) => setFormData({ ...formData, targetAudience: e.target.value })}
                  >
                    <option value="all">All</option>
                    <option value="teachers">Teachers Only</option>
                    <option value="parents">Parents Only</option>
                    <option value="students">Students Only</option>
                  </select>
                </div>

                <DialogFooter>
                  <Button type="submit" disabled={isSubmitting} className="w-full gradient-admin">
                    {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Publish Announcement
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
              <Input placeholder="Search announcements..." className="pl-10" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            </div>
          </CardContent>
        </Card>

        <Card className="card-elevated">
          <CardHeader><CardTitle className="font-display">All Announcements ({filteredAnnouncements.length})</CardTitle></CardHeader>
          <CardContent>
            {loadingData ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            ) : filteredAnnouncements.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">{searchQuery ? 'No announcements found' : 'No announcements yet'}</div>
            ) : (
              <div className="space-y-4">
                {filteredAnnouncements.map((announcement) => (
                  <div key={announcement.id} className="p-4 rounded-xl border bg-muted/30 hover:bg-muted/50 transition-colors">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Megaphone className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-medium">{announcement.title}</h3>
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{announcement.content}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <Badge variant="outline" className="text-xs">
                              {announcement.target_audience?.[0] || 'all'}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {new Date(announcement.created_at).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem><Edit className="h-4 w-4 mr-2" />Edit</DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={() => handleDeleteAnnouncement(announcement.id)}><Trash2 className="h-4 w-4 mr-2" />Delete</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
