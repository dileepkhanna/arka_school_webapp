import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { apiClient } from '@/lib/apiClient';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { parentSidebarItems } from '@/config/parentSidebar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BackButton } from '@/components/ui/back-button';
import { useToast } from '@/hooks/use-toast';
import { Plus, Loader2, MessageSquare, Clock, CheckCircle2, AlertCircle } from 'lucide-react';

interface Complaint {
  id: string;
  subject: string;
  description: string;
  status: string;
  response: string | null;
  created_at: string;
  visible_to: string[];
}

interface CreateComplaintPayload {
  subject: string;
  description: string;
  visible_to: string[];
}

export default function ParentComplaints() {
  const { user, userRole, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    subject: '',
    description: '',
    visibleToAdmin: true,
    visibleToTeacher: false,
  });

  useEffect(() => {
    if (!loading && (!user || userRole !== 'parent')) {
      navigate('/auth');
    }
  }, [user, userRole, loading, navigate]);

  useEffect(() => {
    fetchComplaints();
  }, [user]);

  const fetchComplaints = async () => {
    if (!user) return;
    setLoadingData(true);
    try {
      const data = await apiClient.get<Complaint[]>('/parent/complaints');
      setComplaints(data || []);
    } catch (error) {
      console.error('Error loading complaints:', error);
      setComplaints([]);
    } finally {
      setLoadingData(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.subject || !formData.description) {
      toast({ variant: 'destructive', title: 'Error', description: 'Subject and description are required' });
      return;
    }
    if (!formData.visibleToAdmin && !formData.visibleToTeacher) {
      toast({ variant: 'destructive', title: 'Error', description: 'Please select at least one visibility option' });
      return;
    }

    setIsSubmitting(true);
    const visibleTo: string[] = [];
    if (formData.visibleToAdmin) visibleTo.push('admin');
    if (formData.visibleToTeacher) visibleTo.push('teacher');

    try {
      const payload: CreateComplaintPayload = {
        subject: formData.subject,
        description: formData.description,
        visible_to: visibleTo,
      };
      await apiClient.post('/parent/complaints', payload);
      toast({ title: 'Submitted', description: 'Your complaint has been submitted' });
      setDialogOpen(false);
      setFormData({ subject: '', description: '', visibleToAdmin: true, visibleToTeacher: false });
      fetchComplaints();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message || 'Failed to submit complaint' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'resolved': return <CheckCircle2 className="h-4 w-4 text-success" />;
      case 'in_progress': return <Clock className="h-4 w-4 text-primary" />;
      default: return <AlertCircle className="h-4 w-4 text-destructive" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'resolved': return <Badge className="bg-success/10 text-success border-success/20 text-[10px] sm:text-xs">Resolved</Badge>;
      case 'in_progress': return <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px] sm:text-xs">In Progress</Badge>;
      default: return <Badge className="bg-destructive/10 text-destructive border-destructive/20 text-[10px] sm:text-xs">Open</Badge>;
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <DashboardLayout sidebarItems={parentSidebarItems} roleColor="parent">
      <div className="space-y-4 sm:space-y-6 animate-fade-in">
        <BackButton to="/parent" />
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="font-display text-lg sm:text-2xl font-bold flex items-center gap-2">
              <MessageSquare className="h-5 w-5 sm:h-6 sm:w-6 text-primary" /> Complaints
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground">Submit and track your complaints</p>
          </div>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gradient-parent"><Plus className="h-4 w-4 mr-2" />New Complaint</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle className="font-display">Submit Complaint</DialogTitle>
                <DialogDescription>Describe your concern and choose who should see it</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Subject *</Label>
                  <Input
                    placeholder="Brief subject of your complaint"
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description *</Label>
                  <Textarea
                    placeholder="Describe your complaint in detail..."
                    rows={5}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>
                <div className="space-y-3">
                  <Label>Who can see this complaint? *</Label>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="visible-admin"
                        checked={formData.visibleToAdmin}
                        onCheckedChange={(checked) => setFormData({ ...formData, visibleToAdmin: !!checked })}
                      />
                      <label htmlFor="visible-admin" className="text-sm font-medium cursor-pointer">
                        Admin / Principal
                      </label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="visible-teacher"
                        checked={formData.visibleToTeacher}
                        onCheckedChange={(checked) => setFormData({ ...formData, visibleToTeacher: !!checked })}
                      />
                      <label htmlFor="visible-teacher" className="text-sm font-medium cursor-pointer">
                        Class Teacher
                      </label>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={isSubmitting} className="w-full gradient-parent">
                    {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Submit Complaint
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Complaints List */}
        <Card className="card-elevated">
          <CardHeader>
            <CardTitle className="font-display text-sm sm:text-base">Your Complaints ({complaints.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingData ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            ) : complaints.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <MessageSquare className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p className="text-sm">No complaints submitted yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {complaints.map((complaint) => (
                  <div key={complaint.id} className="p-3 sm:p-4 rounded-xl border bg-muted/30 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2 min-w-0">
                        {getStatusIcon(complaint.status)}
                        <div className="min-w-0">
                          <h4 className="font-medium text-sm truncate">{complaint.subject}</h4>
                          <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{complaint.description}</p>
                        </div>
                      </div>
                      {getStatusBadge(complaint.status)}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] sm:text-xs text-muted-foreground">
                        {new Date(complaint.created_at).toLocaleDateString()}
                      </span>
                      <div className="flex gap-1">
                        {(complaint.visible_to || ['admin']).map(v => (
                          <Badge key={v} variant="outline" className="text-[9px] sm:text-[10px] px-1.5 py-0 capitalize">{v}</Badge>
                        ))}
                      </div>
                    </div>
                    {complaint.response && (
                      <div className="p-2 sm:p-3 bg-primary/5 border-l-2 border-primary rounded-md mt-1">
                        <p className="text-[10px] sm:text-xs text-muted-foreground mb-0.5">Response:</p>
                        <p className="text-xs sm:text-sm">{complaint.response}</p>
                      </div>
                    )}
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
