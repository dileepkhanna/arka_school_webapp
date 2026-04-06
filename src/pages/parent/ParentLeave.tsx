import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { apiClient } from '@/lib/apiClient';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Loader2, Calendar, Plus, Clock, CheckCircle2, XCircle, Paperclip, Download } from 'lucide-react';
import { parentSidebarItems } from '@/config/parentSidebar';
import { useToast } from '@/hooks/use-toast';

interface LeaveRequest {
  id: string;
  from_date: string;
  to_date: string;
  reason: string;
  status: string;
  created_at: string;
  attachment_url: string | null;
}

interface ParentLeaveResponse {
  studentId: string | null;
  childName: string;
  leaves: LeaveRequest[];
}

export default function ParentLeave() {
  const { user, userRole, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [studentId, setStudentId] = useState<string | null>(null);
  const [childName, setChildName] = useState('');
  const [loadingData, setLoadingData] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({ fromDate: '', toDate: '', reason: '' });
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);

  useEffect(() => {
    if (!loading && (!user || userRole !== 'parent')) {
      navigate('/auth');
    }
  }, [user, userRole, loading, navigate]);

  useEffect(() => {
    fetchData();
  }, [user]);

  async function fetchData() {
    if (!user) return;
    setLoadingData(true);

    try {
      const data = await apiClient.get<ParentLeaveResponse>('/parent/leave-requests');
      setStudentId(data.studentId);
      setChildName(data.childName || '');
      setLeaves(data.leaves || []);
    } catch (error) {
      console.error('Error loading leave requests:', error);
      setStudentId(null);
      setChildName('');
      setLeaves([]);
    } finally {
      setLoadingData(false);
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentId || !formData.fromDate || !formData.toDate || !formData.reason) {
      toast({ variant: 'destructive', title: 'Error', description: 'Please fill all required fields' });
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = new FormData();
      payload.append('from_date', formData.fromDate);
      payload.append('to_date', formData.toDate);
      payload.append('reason', formData.reason);
      if (attachmentFile) {
        payload.append('attachment', attachmentFile);
      }

      await apiClient.postForm('/parent/leave-requests', payload);
      toast({ title: 'Success', description: 'Leave request submitted successfully' });
      setDialogOpen(false);
      setFormData({ fromDate: '', toDate: '', reason: '' });
      setAttachmentFile(null);
      fetchData();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message || 'Failed to submit leave request' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'approved': return { icon: <CheckCircle2 className="h-4 w-4" />, class: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' };
      case 'rejected': return { icon: <XCircle className="h-4 w-4" />, class: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' };
      default: return { icon: <Clock className="h-4 w-4" />, class: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' };
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  const isLoadingContent = loadingData;

  return (
    <DashboardLayout sidebarItems={parentSidebarItems} roleColor="parent">
      {isLoadingContent ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold">Leave Requests</h1>
            <p className="text-muted-foreground">Submit and track leave requests for {childName}</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gradient-parent"><Plus className="h-4 w-4 mr-2" />New Request</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="font-display">Submit Leave Request</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>From Date</Label>
                    <Input type="date" value={formData.fromDate} onChange={(e) => setFormData({ ...formData, fromDate: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>To Date</Label>
                    <Input type="date" value={formData.toDate} onChange={(e) => setFormData({ ...formData, toDate: e.target.value })} min={formData.fromDate} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Reason</Label>
                  <Textarea placeholder="Reason for leave..." value={formData.reason} onChange={(e) => setFormData({ ...formData, reason: e.target.value })} rows={4} />
                </div>
                <div className="space-y-2">
                  <Label>Attachment (Optional)</Label>
                  <Input type="file" accept="image/*,.pdf,.doc,.docx" onChange={(e) => setAttachmentFile(e.target.files?.[0] || null)} />
                  <p className="text-xs text-muted-foreground">Upload a document or image (optional)</p>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={isSubmitting} className="w-full gradient-parent">
                    {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Submit Request
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {leaves.length === 0 ? (
          <Card className="card-elevated">
            <CardContent className="py-12 text-center">
              <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No leave requests submitted yet.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {leaves.map((leave) => {
              const style = getStatusStyle(leave.status);
              return (
                <Card key={leave.id} className="card-elevated">
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">
                            {new Date(leave.from_date).toLocaleDateString()} - {new Date(leave.to_date).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">{leave.reason}</p>
                        {leave.attachment_url && (
                          <a href={leave.attachment_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                            <Paperclip className="h-3 w-3" /> View Attachment
                          </a>
                        )}
                        <p className="text-xs text-muted-foreground">
                          Submitted: {new Date(leave.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <Badge className={`${style.class} flex items-center gap-1`}>
                        {style.icon}
                        {leave.status}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
      )}
    </DashboardLayout>
  );
}
