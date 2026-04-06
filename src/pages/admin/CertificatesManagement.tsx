import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { apiClient } from '@/lib/apiClient';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Award, CheckCircle2, XCircle, Clock, FileText, Download } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { adminSidebarItems } from '@/config/adminSidebar';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface CertificateRequest {
  id: number;
  certificate_type: string;
  status: string;
  created_at: string;
  student_id: number;
  requested_by: number | null;
  student?: {
    full_name: string;
    admission_number: string;
    classes?: {
      name: string;
      section: string;
    };
  };
  requester_name?: string;
}

export default function CertificatesManagement() {
  const { user, userRole, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [requests, setRequests] = useState<CertificateRequest[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [remarks, setRemarks] = useState<Record<number, string>>({});

  useEffect(() => {
    if (!loading && (!user || userRole !== 'admin')) {
      navigate('/auth');
    }
  }, [user, userRole, loading, navigate]);

  useEffect(() => {
    fetchRequests();
  }, []);

  async function fetchRequests() {
    setLoadingData(true);
    try {
      const data = await apiClient.get<CertificateRequest[]>('/certificates/requests');

      if (data) setRequests(data);
    } catch (error) {
      console.error('Error fetching certificate requests:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to load certificate requests' });
    } finally {
      setLoadingData(false);
    }
  }

  const handleUpdateStatus = async (id: number, newStatus: 'approved' | 'rejected') => {
    if (!user) return;
    
    setProcessingId(id);
    try {
      await apiClient.put(`/certificates/requests/${id}`, {
        status: newStatus,
        approved_by: user.id,
        admin_remarks: remarks[id]?.trim() || null,
      });

      toast({ 
        title: 'Success', 
        description: `Certificate request ${newStatus}` 
      });
      fetchRequests();
    } catch (error) {
      console.error('Error updating status:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to update request' });
    } finally {
      setProcessingId(null);
    }
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'approved':
        return { icon: <CheckCircle2 className="h-4 w-4" />, class: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' };
      case 'rejected':
        return { icon: <XCircle className="h-4 w-4" />, class: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' };
      default:
        return { icon: <Clock className="h-4 w-4" />, class: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' };
    }
  };

  const filterByStatus = (status: string) => {
    if (status === 'all') return requests;
    return requests.filter(r => r.status === status);
  };

  if (loading || loadingData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const pendingCount = requests.filter(r => r.status === 'pending').length;

  return (
    <DashboardLayout sidebarItems={adminSidebarItems} roleColor="admin">
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold">Certificate Requests</h1>
            <p className="text-muted-foreground">Manage certificate requests from parents</p>
          </div>
          {pendingCount > 0 && (
            <Badge variant="secondary" className="text-sm">
              {pendingCount} pending
            </Badge>
          )}
        </div>

        <Tabs defaultValue="pending" className="w-full">
          <TabsList>
            <TabsTrigger value="pending">
              Pending ({requests.filter(r => r.status === 'pending').length})
            </TabsTrigger>
            <TabsTrigger value="approved">
              Approved ({requests.filter(r => r.status === 'approved').length})
            </TabsTrigger>
            <TabsTrigger value="rejected">
              Rejected ({requests.filter(r => r.status === 'rejected').length})
            </TabsTrigger>
            <TabsTrigger value="all">All</TabsTrigger>
          </TabsList>

          {['pending', 'approved', 'rejected', 'all'].map(tab => (
            <TabsContent key={tab} value={tab}>
              {filterByStatus(tab).length === 0 ? (
                <Card className="card-elevated">
                  <CardContent className="py-12 text-center">
                    <Award className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No {tab === 'all' ? '' : tab} requests</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4">
                  {filterByStatus(tab).map((request) => {
                    const style = getStatusStyle(request.status);
                    const isProcessing = processingId === request.id;
                    
                    return (
                      <Card key={request.id} className="card-elevated">
                        <CardContent className="pt-6">
                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="flex items-start gap-4">
                              <div className="p-3 rounded-lg bg-primary/10">
                                <FileText className="h-6 w-6 text-primary" />
                              </div>
                              <div>
                                <h3 className="font-semibold">{request.certificate_type}</h3>
                                <p className="text-sm text-muted-foreground">
                                  Student: {request.student?.full_name || 'Unknown'} 
                                  {request.student?.classes && ` (${request.student.classes.section ? `${request.student.classes.name}-${request.student.classes.section}` : request.student.classes.name})`}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  Admission: {request.student?.admission_number || 'N/A'}
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  Requested by: {request.requester_name || 'Parent'} • {new Date(request.created_at).toLocaleDateString()}
                                </p>
                                {(request as any).description && (
                                  <p className="text-sm mt-1"><span className="font-medium">Parent's note:</span> {(request as any).description}</p>
                                )}
                                {(request as any).admin_remarks && request.status !== 'pending' && (
                                  <p className="text-sm mt-1"><span className="font-medium">Admin remarks:</span> {(request as any).admin_remarks}</p>
                                )}
                                {(request as any).attachment_url && (
                                  <a href={(request as any).attachment_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1">
                                    <Download className="h-3 w-3" /> Download Attachment
                                  </a>
                                )}
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-3">
                              <Badge className={`${style.class} flex items-center gap-1`}>
                                {style.icon}
                                {request.status}
                              </Badge>
                              
                              {request.status === 'pending' && (
                                <div className="flex flex-col gap-2 w-full md:w-auto">
                                  <Textarea
                                    placeholder="Add remarks (optional)..."
                                    value={remarks[request.id] || ''}
                                    onChange={(e) => setRemarks(prev => ({ ...prev, [request.id]: e.target.value }))}
                                    rows={2}
                                    className="text-sm min-w-[200px]"
                                  />
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="text-green-600 border-green-600 hover:bg-green-50 dark:hover:bg-green-900/20"
                                    onClick={() => handleUpdateStatus(request.id, 'approved')}
                                    disabled={isProcessing}
                                  >
                                    {isProcessing ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <>
                                        <CheckCircle2 className="h-4 w-4 mr-1" />
                                        Approve
                                      </>
                                    )}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="text-red-600 border-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                                    onClick={() => handleUpdateStatus(request.id, 'rejected')}
                                    disabled={isProcessing}
                                  >
                                    {isProcessing ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <>
                                        <XCircle className="h-4 w-4 mr-1" />
                                        Reject
                                      </>
                                    )}
                                  </Button>
                                </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
