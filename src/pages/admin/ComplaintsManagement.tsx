import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { apiClient } from '@/lib/apiClient';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { adminSidebarItems } from '@/config/adminSidebar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
import { useToast } from '@/hooks/use-toast';
import { Loader2, Search, MessageSquare, Send } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import StatCard from '@/components/StatCard';

interface Complaint {
  id: number;
  subject: string;
  description: string;
  status: string;
  response: string | null;
  created_at: string;
  submitted_by: number;
  visible_to: string[];
}

export default function ComplaintsManagement() {
  const { user, userRole, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);
  const [response, setResponse] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [stats, setStats] = useState({ open: 0, inProgress: 0, resolved: 0 });

  useEffect(() => {
    if (!loading && (!user || userRole !== 'admin')) {
      navigate('/auth');
    }
  }, [user, userRole, loading, navigate]);

  useEffect(() => {
    fetchComplaints();
  }, []);

  const fetchComplaints = async () => {
    setLoadingData(true);
    try {
      const data = await apiClient.get<Complaint[]>('/complaints/management');
      const list = data || [];
      setComplaints(list);
      const open = list.filter(c => c.status === 'open').length;
      const inProgress = list.filter(c => c.status === 'in_progress').length;
      const resolved = list.filter(c => c.status === 'resolved').length;
      setStats({ open, inProgress, resolved });
    } catch (error) {
      console.error('Failed to fetch complaints', error);
      setComplaints([]);
      setStats({ open: 0, inProgress: 0, resolved: 0 });
    }

    setLoadingData(false);
  };

  const handleRespond = async () => {
    if (!selectedComplaint || !response) return;
    
    setIsSubmitting(true);
    try {
      await apiClient.put(`/complaints/${selectedComplaint.id}`, { response, status: 'resolved' });
      toast({ title: 'Success', description: 'Response sent successfully' });
      setSelectedComplaint(null);
      setResponse('');
      fetchComplaints();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    }

    setIsSubmitting(false);
  };

  const handleUpdateStatus = async (id: number, status: string) => {
    try {
      await apiClient.put(`/complaints/${id}`, { status });
      toast({ title: 'Updated', description: `Status changed to ${status}` });
      fetchComplaints();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'resolved': return <Badge className="bg-success/10 text-success border-success/20">Resolved</Badge>;
      case 'in_progress': return <Badge className="bg-primary/10 text-primary border-primary/20">In Progress</Badge>;
      default: return <Badge className="bg-destructive/10 text-destructive border-destructive/20">Open</Badge>;
    }
  };

  const filteredComplaints = complaints.filter((c) => {
    const matchesSearch = c.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <DashboardLayout sidebarItems={adminSidebarItems} roleColor="admin">
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="font-display text-2xl font-bold">Complaints Management</h1>
          <p className="text-muted-foreground">Handle complaints and grievances</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard title="Open" value={stats.open.toString()} icon={<MessageSquare className="h-6 w-6" />} />
          <StatCard title="In Progress" value={stats.inProgress.toString()} icon={<MessageSquare className="h-6 w-6" />} variant="primary" />
          <StatCard title="Resolved" value={stats.resolved.toString()} icon={<MessageSquare className="h-6 w-6" />} />
        </div>

        <Card className="card-elevated">
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search complaints..." className="pl-10" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="card-elevated">
            <CardHeader><CardTitle className="font-display">Complaints ({filteredComplaints.length})</CardTitle></CardHeader>
            <CardContent>
              {loadingData ? (
                <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
              ) : filteredComplaints.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">No complaints found</div>
              ) : (
                <div className="space-y-3 max-h-[500px] overflow-y-auto">
                  {filteredComplaints.map((complaint) => (
                    <div
                      key={complaint.id}
                      className={`p-4 rounded-lg border cursor-pointer transition-colors ${selectedComplaint?.id === complaint.id ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'}`}
                      onClick={() => setSelectedComplaint(complaint)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <h4 className="font-medium text-sm">{complaint.subject}</h4>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{complaint.description}</p>
                        </div>
                        {getStatusBadge(complaint.status)}
                      </div>
                      <p className="text-xs text-muted-foreground mt-2 flex items-center gap-2">
                        {new Date(complaint.created_at).toLocaleDateString()}
                        {complaint.visible_to && complaint.visible_to.map(v => (
                          <Badge key={v} variant="outline" className="text-[9px] capitalize">{v}</Badge>
                        ))}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="card-elevated">
            <CardHeader><CardTitle className="font-display">Complaint Details</CardTitle></CardHeader>
            <CardContent>
              {selectedComplaint ? (
                <div className="space-y-4">
                  <div>
                    <h3 className="font-medium">{selectedComplaint.subject}</h3>
                    <p className="text-sm text-muted-foreground mt-1">{new Date(selectedComplaint.created_at).toLocaleDateString()}</p>
                  </div>

                  <div className="p-4 bg-muted/50 rounded-lg">
                    <p className="text-sm">{selectedComplaint.description}</p>
                  </div>

                  {selectedComplaint.response && (
                    <div className="p-4 bg-primary/5 border-l-4 border-primary rounded-lg">
                      <p className="text-xs text-muted-foreground mb-1">Response:</p>
                      <p className="text-sm">{selectedComplaint.response}</p>
                    </div>
                  )}

                  {selectedComplaint.status !== 'resolved' && (
                    <>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => handleUpdateStatus(selectedComplaint.id, 'in_progress')}>
                          Mark In Progress
                        </Button>
                      </div>

                      <div className="space-y-2">
                        <Textarea
                          placeholder="Type your response..."
                          value={response}
                          onChange={(e) => setResponse(e.target.value)}
                          rows={4}
                        />
                        <Button onClick={handleRespond} disabled={isSubmitting || !response} className="w-full gradient-admin">
                          {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                          <Send className="h-4 w-4 mr-2" />
                          Send Response & Resolve
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  Select a complaint to view details
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
