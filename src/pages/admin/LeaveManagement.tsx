import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { apiClient } from '@/lib/apiClient';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { adminSidebarItems } from '@/config/adminSidebar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { Loader2, Search, CheckCircle, XCircle, Clock, Calendar, Download, Paperclip } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import StatCard from '@/components/StatCard';
import { BackButton } from '@/components/ui/back-button';

interface LeaveRequest {
  id: number;
  request_type: string;
  from_date: string;
  to_date: string;
  reason: string;
  status: string;
  created_at: string;
  student_id: number | null;
  teacher_id: number | null;
  students?: { full_name: string } | null;
  teachers?: { profiles?: { full_name: string } | null } | null;
}

export default function LeaveManagement() {
  const { user, userRole, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const [stats, setStats] = useState({ pending: 0, approved: 0, rejected: 0 });

  useEffect(() => {
    if (!loading && (!user || userRole !== 'admin')) {
      navigate('/auth');
    }
  }, [user, userRole, loading, navigate]);

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    setLoadingData(true);

    try {
      const data = await apiClient.get<LeaveRequest[]>('/leave/requests');
      const list = data || [];
      setRequests(list);

      const pending = list.filter(r => r.status === 'pending').length;
      const approved = list.filter(r => r.status === 'approved').length;
      const rejected = list.filter(r => r.status === 'rejected').length;
      setStats({ pending, approved, rejected });
    } catch (error) {
      console.error('Failed to fetch leave requests', error);
      setRequests([]);
      setStats({ pending: 0, approved: 0, rejected: 0 });
    }

    setLoadingData(false);
  };

  const handleUpdateStatus = async (id: number, status: string) => {
    try {
      await apiClient.put(`/leave/requests/${id}`, { status });
      toast({ title: 'Updated', description: `Leave request ${status}` });
      fetchRequests();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved': return <Badge className="bg-success/10 text-success border-success/20">Approved</Badge>;
      case 'rejected': return <Badge className="bg-destructive/10 text-destructive border-destructive/20">Rejected</Badge>;
      default: return <Badge className="bg-warning/10 text-warning border-warning/20">Pending</Badge>;
    }
  };

  const filteredRequests = requests.filter((r) => {
    const matchesSearch = r.reason.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.students?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.teachers?.profiles?.full_name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <DashboardLayout sidebarItems={adminSidebarItems} roleColor="admin">
      <div className="space-y-6 animate-fade-in">
        <BackButton to="/admin" />
        <div>
          <h1 className="font-display text-2xl font-bold">Leave Requests</h1>
          <p className="text-muted-foreground">Manage leave and permission requests</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard title="Pending" value={stats.pending.toString()} icon={<Clock className="h-6 w-6" />} />
          <StatCard title="Approved" value={stats.approved.toString()} icon={<CheckCircle className="h-6 w-6" />} variant="primary" />
          <StatCard title="Rejected" value={stats.rejected.toString()} icon={<XCircle className="h-6 w-6" />} />
        </div>

        {/* Filters */}
        <Card className="card-elevated">
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search requests..." className="pl-10" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card className="card-elevated">
          <CardHeader><CardTitle className="font-display">All Requests ({filteredRequests.length})</CardTitle></CardHeader>
          <CardContent>
            {loadingData ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            ) : filteredRequests.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">No leave requests found</div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Requester</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Attachment</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRequests.map((request) => (
                      <TableRow key={request.id}>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">{request.request_type}</Badge>
                        </TableCell>
                        <TableCell className="font-medium">
                          {request.request_type === 'student' 
                            ? request.students?.full_name 
                            : request.teachers?.profiles?.full_name || 'N/A'}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm">
                            <Calendar className="h-3 w-3" />
                            {new Date(request.from_date).toLocaleDateString()} - {new Date(request.to_date).toLocaleDateString()}
                          </div>
                        </TableCell>
                        <TableCell className="max-w-xs truncate">{request.reason}</TableCell>
                        <TableCell>
                          {(request as any).attachment_url ? (
                            <a href={(request as any).attachment_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline text-sm">
                              <Download className="h-3 w-3" /> Download
                            </a>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </TableCell>
                        <TableCell>{getStatusBadge(request.status)}</TableCell>
                        <TableCell>
                          {request.status === 'pending' && (
                            <div className="flex gap-2">
                              <Button size="sm" variant="outline" className="h-8 text-success border-success/50" onClick={() => handleUpdateStatus(request.id, 'approved')}>
                                <CheckCircle className="h-3 w-3 mr-1" />Approve
                              </Button>
                              <Button size="sm" variant="outline" className="h-8 text-destructive border-destructive/50" onClick={() => handleUpdateStatus(request.id, 'rejected')}>
                                <XCircle className="h-3 w-3 mr-1" />Reject
                              </Button>
                            </div>
                          )}
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
