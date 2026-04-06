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
  CalendarDays,
  Paperclip,
} from 'lucide-react';

// Sidebar items from shared config with permission check
import { useTeacherSidebar } from '@/hooks/useTeacherSidebar';

interface LeaveRequest {
  id: string;
  from_date: string;
  to_date: string;
  reason: string;
  status: string;
  created_at: string;
  attachment_url?: string | null;
}

interface TeacherLeaveResponse {
  teacherId: string | null;
  leaveRequests: LeaveRequest[];
}

export default function TeacherLeave() {
  const teacherSidebarItems = useTeacherSidebar();
  const { user, userRole, loading } = useAuth();
  const navigate = useNavigate();
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [teacherId, setTeacherId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    from_date: format(new Date(), 'yyyy-MM-dd'),
    to_date: format(new Date(), 'yyyy-MM-dd'),
    reason: '',
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
        const data = await apiClient.get<TeacherLeaveResponse>('/teacher/leave-requests');
        setTeacherId(data.teacherId);
        setLeaveRequests(data.leaveRequests || []);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoadingData(false);
      }
    }

    fetchData();
  }, [user]);

  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!formData.from_date || !formData.to_date || !formData.reason) {
      toast.error('Please fill in all fields');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = new FormData();
      payload.append('from_date', formData.from_date);
      payload.append('to_date', formData.to_date);
      payload.append('reason', formData.reason);
      if (attachmentFile) {
        payload.append('attachment', attachmentFile);
      }

      await apiClient.postForm('/teacher/leave-requests', payload);

      toast.success('Leave request submitted successfully');
      setDialogOpen(false);
      setFormData({ from_date: format(new Date(), 'yyyy-MM-dd'), to_date: format(new Date(), 'yyyy-MM-dd'), reason: '' });
      setAttachmentFile(null);

      const leaveData = await apiClient.get<TeacherLeaveResponse>('/teacher/leave-requests');
      setTeacherId(leaveData.teacherId);
      setLeaveRequests(leaveData.leaveRequests || []);
    } catch (error) {
      console.error('Error submitting leave request:', error);
      toast.error('Failed to submit leave request');
    } finally {
      setIsSubmitting(false);
    }
  };

  const statusColors = {
    pending: 'bg-yellow-100 text-yellow-700',
    approved: 'bg-green-100 text-green-700',
    rejected: 'bg-red-100 text-red-700',
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
        <div className="flex items-center justify-between">
          <h1 className="font-display text-2xl font-bold">Leave Requests</h1>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Request Leave
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Request Leave</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>From Date</Label>
                    <Input
                      type="date"
                      value={formData.from_date}
                      onChange={(e) => setFormData({ ...formData, from_date: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>To Date</Label>
                    <Input
                      type="date"
                      value={formData.to_date}
                      onChange={(e) => setFormData({ ...formData, to_date: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <Label>Reason</Label>
                  <Textarea
                    value={formData.reason}
                    onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                    placeholder="Reason for leave..."
                    rows={4}
                  />
                </div>
                <div>
                  <Label>Attachment (Optional)</Label>
                  <Input type="file" accept="image/*,.pdf,.doc,.docx" onChange={(e) => setAttachmentFile(e.target.files?.[0] || null)} />
                  <p className="text-xs text-muted-foreground mt-1">Upload a document or image (optional)</p>
                </div>
                <Button onClick={handleSubmit} disabled={isSubmitting} className="w-full">
                  {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Submit Request
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {loadingData ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : leaveRequests.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <CalendarDays className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No leave requests yet.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {leaveRequests.map((leave) => (
              <Card key={leave.id} className="card-elevated">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <CalendarDays className="h-5 w-5 text-secondary" />
                        <span className="font-semibold">
                          {format(new Date(leave.from_date), 'PPP')} - {format(new Date(leave.to_date), 'PPP')}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColors[leave.status as keyof typeof statusColors]}`}>
                          {leave.status}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">{leave.reason}</p>
                      {leave.attachment_url && (
                        <a href={leave.attachment_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1">
                          <Paperclip className="h-3 w-3" /> View Attachment
                        </a>
                      )}
                      <p className="text-xs text-muted-foreground mt-2">
                        Submitted: {format(new Date(leave.created_at), 'PPP')}
                      </p>
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
