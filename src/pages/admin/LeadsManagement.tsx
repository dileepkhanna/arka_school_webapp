import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/apiClient';
import { useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { adminSidebarItems } from '@/config/adminSidebar';
import LeadEntryForm from '@/components/leads/LeadEntryForm';
import LeadCallLogDialog from '@/components/leads/LeadCallLogDialog';
import LeadExcelImport from '@/components/leads/LeadExcelImport';
import { LeadStatusBadge, LEAD_STATUSES, getStatusLabel } from '@/components/leads/LeadStatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import {
  Plus, Search, Phone, Edit, Eye, Trash2, FileSpreadsheet,
  Calendar, MessageSquare, Download, BarChart3, Users, TrendingUp,
  UserPlus, Filter, PieChart, Info,
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { format } from 'date-fns';
import * as XLSX from 'xlsx';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart as RPieChart, Pie, Cell, Legend } from 'recharts';

const CHART_COLORS = ['#3b82f6', '#22c55e', '#eab308', '#f97316', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899'];

export default function LeadsManagement() {
  const { user } = useAuth();
  const [leads, setLeads] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [teacherFilter, setTeacherFilter] = useState('all');
  const [classFilter, setClassFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingLead, setEditingLead] = useState<any | null>(null);
  const [viewingLead, setViewingLead] = useState<any | null>(null);
  const [callLogLead, setCallLogLead] = useState<any | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [statusUpdateLead, setStatusUpdateLead] = useState<any | null>(null);
  const [newStatus, setNewStatus] = useState('');
  const [statusRemarks, setStatusRemarks] = useState('');
  const [callLogs, setCallLogs] = useState<any[]>([]);
  const [statusHistory, setStatusHistory] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState('leads');
  const [moduleEnabled, setModuleEnabled] = useState<boolean | null>(null);

  const fetchLeads = async () => {
    setLoading(true);
    try {
      const data = await apiClient.get<any[]>('/leads');
      setLeads(data || []);
    } catch (error) {
      console.error('Error fetching leads:', error);
      setLeads([]);
    }
    setLoading(false);
  };

  const fetchTeachers = async () => {
    try {
      const data = await apiClient.get<any[]>('/leads/teachers');
      setTeachers(data || []);
    } catch (error) {
      console.error('Error fetching teachers:', error);
      setTeachers([]);
    }
  };

  const fetchModuleStatus = async () => {
    try {
      const data = await apiClient.get<{ enabled: boolean }>('/leads/module-status');
      setModuleEnabled(!!data.enabled);
    } catch (error) {
      console.error('Error fetching module status:', error);
      setModuleEnabled(false);
    }
  };

  useEffect(() => { fetchLeads(); fetchTeachers(); fetchModuleStatus(); }, []);

  const filteredLeads = leads.filter(lead => {
    const matchesSearch = !searchQuery ||
      lead.student_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.primary_mobile?.includes(searchQuery) ||
      lead.father_name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || lead.status === statusFilter;
    // Support filtering by created_by (user_id) or assigned_teacher_id
    const matchesTeacher = teacherFilter === 'all' || 
      lead.created_by === teacherFilter || 
      (lead.assigned_teacher_id && teachers.some(t => t.user_id === teacherFilter && t.id === lead.assigned_teacher_id));
    const matchesClass = classFilter === 'all' || lead.class_applying_for === classFilter;
    const matchesDateFrom = !dateFrom || new Date(lead.created_at) >= new Date(dateFrom);
    const matchesDateTo = !dateTo || new Date(lead.created_at) <= new Date(dateTo + 'T23:59:59');
    return matchesSearch && matchesStatus && matchesTeacher && matchesClass && matchesDateFrom && matchesDateTo;
  });

  // Dashboard stats
  const totalLeads = leads.length;
  const newLeads = leads.filter(l => l.status === 'new_lead').length;
  const convertedLeads = leads.filter(l => l.status === 'converted').length;
  const pendingFollowups = leads.filter(l => l.next_followup_date && new Date(l.next_followup_date) <= new Date()).length;
  const conversionRate = totalLeads > 0 ? ((convertedLeads / totalLeads) * 100).toFixed(1) : '0';

  // Chart data
  const statusChartData = LEAD_STATUSES.map(s => ({
    name: s.label.length > 15 ? s.label.substring(0, 15) + '...' : s.label,
    value: leads.filter(l => l.status === s.value).length,
  })).filter(d => d.value > 0);

  const classChartData = [...new Set(leads.map(l => l.class_applying_for).filter(Boolean))].map(cls => ({
    name: cls,
    value: leads.filter(l => l.class_applying_for === cls).length,
  })).sort((a, b) => b.value - a.value);

  const uniqueClasses = [...new Set(leads.map(l => l.class_applying_for).filter(Boolean))];

  const handleDelete = async (leadId: string) => {
    if (!confirm('Are you sure you want to delete this lead?')) return;
    try {
      await apiClient.delete(`/leads/${leadId}`);
      toast({ title: 'Lead deleted' });
      fetchLeads();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleStatusUpdate = async () => {
    if (!statusUpdateLead || !newStatus || !user) return;
    try {
      await apiClient.put(`/leads/${statusUpdateLead.id}/status`, {
        status: newStatus,
        remarks: statusRemarks || statusUpdateLead.remarks || null,
      });

      toast({ title: 'Status updated successfully' });
      setStatusUpdateLead(null);
      setNewStatus('');
      setStatusRemarks('');
      fetchLeads();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const exportLeads = () => {
    const exportData = filteredLeads.map(l => ({
      'Student Name': l.student_name,
      'Gender': l.gender || '',
      'DOB': l.date_of_birth || '',
      'Current Class': l.current_class || '',
      'Class Applying For': l.class_applying_for || '',
      'Academic Year': l.academic_year || '',
      'Father Name': l.father_name || '',
      'Mother Name': l.mother_name || '',
      'Primary Mobile': l.primary_mobile,
      'Alternate Mobile': l.alternate_mobile || '',
      'Email': l.email || '',
      'Address': l.address || '',
      'Area/City': l.area_city || '',
      'Previous School': l.previous_school || '',
      'Board': l.education_board || '',
      'Status': getStatusLabel(l.status),
      'Follow-up Date': l.next_followup_date || '',
      'Remarks': l.remarks || '',
      'Created At': format(new Date(l.created_at), 'dd MMM yyyy'),
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Leads');
    XLSX.writeFile(wb, `leads_export_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  const fetchLeadDetails = async (lead: any) => {
    setViewingLead(lead);
    try {
      const data = await apiClient.get<{ callLogs: any[]; statusHistory: any[] }>(`/leads/${lead.id}/details`);
      setCallLogs(data.callLogs || []);
      setStatusHistory(data.statusHistory || []);
    } catch (error) {
      console.error('Error fetching lead details:', error);
      setCallLogs([]);
      setStatusHistory([]);
    }
  };

  return (
    <DashboardLayout sidebarItems={adminSidebarItems} roleColor="admin">
      <div className="space-y-6 animate-fade-in">
        {moduleEnabled === false && (
          <Alert className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
            <Info className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-800 dark:text-amber-200">
              The Leads module is currently <strong>disabled</strong> for teachers. Teachers cannot see or manage leads.
              You (Admin) still have full access. Enable it from <a href="/admin/settings" className="underline font-medium">Settings</a>.
            </AlertDescription>
          </Alert>
        )}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Leads Management</h1>
            <p className="text-muted-foreground">Manage all admission leads, reports & analytics</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" onClick={exportLeads}>
              <Download className="h-4 w-4 mr-2" /> Export
            </Button>
            <Button variant="outline" onClick={() => setShowImport(true)}>
              <FileSpreadsheet className="h-4 w-4 mr-2" /> Import
            </Button>
            <Button onClick={() => { setEditingLead(null); setShowForm(true); }}>
              <Plus className="h-4 w-4 mr-2" /> New Lead
            </Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="leads">All Leads</TabsTrigger>
            <TabsTrigger value="dashboard">Dashboard & Reports</TabsTrigger>
          </TabsList>

          <TabsContent value="leads" className="space-y-4">
            {/* Filters */}
            <Card>
              <CardContent className="pt-4 space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search name, phone, parent..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      {LEAD_STATUSES.map(s => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={classFilter} onValueChange={setClassFilter}>
                    <SelectTrigger><SelectValue placeholder="Class" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Classes</SelectItem>
                      {uniqueClasses.map(c => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={teacherFilter} onValueChange={setTeacherFilter}>
                    <SelectTrigger><SelectValue placeholder="Teacher" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Teachers</SelectItem>
                      {teachers.map(t => (
                        <SelectItem key={t.user_id} value={t.user_id}>{t.full_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5 min-w-0">
                    <Label className="text-xs font-medium text-muted-foreground">From</Label>
                    <Input type="date" className="w-full h-10" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
                  </div>
                  <div className="space-y-1.5 min-w-0">
                    <Label className="text-xs font-medium text-muted-foreground">To</Label>
                    <Input type="date" className="w-full h-10" value={dateTo} onChange={e => setDateTo(e.target.value)} />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Leads List */}
            <Card>
              <CardContent className="p-0">
                {/* Mobile Cards */}
                <div className="space-y-3 p-3 sm:hidden">
                  {loading ? (
                    <div className="text-center py-8 text-muted-foreground">Loading...</div>
                  ) : filteredLeads.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">No leads found</div>
                  ) : (
                    filteredLeads.map(lead => {
                      const assignedTeacher = teachers.find(t => t.id === lead.assigned_teacher_id);
                      const createdByTeacher = teachers.find(t => t.user_id === lead.created_by);
                      const teacherName = assignedTeacher?.full_name || createdByTeacher?.full_name || '—';
                      return (
                        <div key={lead.id} className="p-3 rounded-xl border bg-muted/10 space-y-2.5">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="font-medium text-sm">{lead.student_name}</p>
                              <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                <LeadStatusBadge status={lead.status} />
                                {lead.class_applying_for && (
                                  <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{lead.class_applying_for}</span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => fetchLeadDetails(lead)}><Eye className="h-3.5 w-3.5" /></Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditingLead(lead); setShowForm(true); }}><Edit className="h-3.5 w-3.5" /></Button>
                            </div>
                          </div>
                          <div className="space-y-1 text-xs">
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <Phone className="h-3 w-3 shrink-0" />
                              <a href={`tel:${lead.primary_mobile}`} className="text-primary hover:underline">{lead.primary_mobile}</a>
                            </div>
                            {lead.father_name && (
                              <div className="flex items-center gap-1 text-muted-foreground">
                                <UserPlus className="h-3 w-3 shrink-0" />
                                <span>{lead.father_name}</span>
                              </div>
                            )}
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <Users className="h-3 w-3 shrink-0" />
                              <span>{teacherName}</span>
                            </div>
                          </div>
                          <div className="flex items-center justify-between pt-1 border-t">
                            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                              {lead.next_followup_date && (
                                <span className="flex items-center gap-0.5">
                                  <Calendar className="h-3 w-3" />
                                  {format(new Date(lead.next_followup_date), 'dd MMM')}
                                </span>
                              )}
                              <span>{format(new Date(lead.created_at), 'dd MMM yyyy')}</span>
                            </div>
                            <div className="flex items-center gap-0.5">
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCallLogLead(lead)}>
                                <Phone className="h-3.5 w-3.5 text-green-600" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setStatusUpdateLead(lead); setNewStatus(lead.status); }}>
                                <MessageSquare className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDelete(lead.id)}>
                                <Trash2 className="h-3.5 w-3.5 text-destructive" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Desktop Table */}
                <div className="overflow-x-auto hidden sm:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Student Name</TableHead>
                        <TableHead>Class Applying</TableHead>
                        <TableHead>Primary Mobile</TableHead>
                        <TableHead>Father's Name</TableHead>
                        <TableHead>Teacher</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Follow-up</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loading ? (
                        <TableRow><TableCell colSpan={9} className="text-center py-8">Loading...</TableCell></TableRow>
                      ) : filteredLeads.length === 0 ? (
                        <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">No leads found</TableCell></TableRow>
                      ) : (
                        filteredLeads.map(lead => {
                          const assignedTeacher = teachers.find(t => t.id === lead.assigned_teacher_id);
                          const createdByTeacher = teachers.find(t => t.user_id === lead.created_by);
                          const teacherName = assignedTeacher?.full_name || createdByTeacher?.full_name || '—';
                          return (
                          <TableRow key={lead.id}>
                            <TableCell className="font-medium">{lead.student_name}</TableCell>
                            <TableCell>{lead.class_applying_for || '—'}</TableCell>
                            <TableCell>
                              <a href={`tel:${lead.primary_mobile}`} className="flex items-center gap-1 text-primary hover:underline">
                                <Phone className="h-3 w-3" /> {lead.primary_mobile}
                              </a>
                            </TableCell>
                            <TableCell>{lead.father_name || '—'}</TableCell>
                            <TableCell className="text-sm">{teacherName}</TableCell>
                            <TableCell>
                              <Select
                                value={lead.status}
                                onValueChange={async (value) => {
                                  if (value === lead.status || !user) return;
                                  try {
                                    await apiClient.put(`/leads/${lead.id}/status`, { status: value });
                                    toast({ title: 'Status updated' });
                                    fetchLeads();
                                  } catch (error: any) {
                                    toast({ title: 'Error', description: error.message, variant: 'destructive' });
                                  }
                                }}
                              >
                                <SelectTrigger className="h-8 w-[180px] text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {LEAD_STATUSES.map(s => (
                                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              {lead.next_followup_date ? format(new Date(lead.next_followup_date), 'dd MMM') : '—'}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {format(new Date(lead.created_at), 'dd MMM yyyy')}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Button variant="ghost" size="icon" onClick={() => fetchLeadDetails(lead)} title="View"><Eye className="h-4 w-4" /></Button>
                                <Button variant="ghost" size="icon" onClick={() => { setEditingLead(lead); setShowForm(true); }} title="Edit"><Edit className="h-4 w-4" /></Button>
                                <Button variant="ghost" size="icon" onClick={() => setCallLogLead(lead)} title="Call"><Phone className="h-4 w-4 text-green-600" /></Button>
                                <Button variant="ghost" size="icon" onClick={() => { setStatusUpdateLead(lead); setNewStatus(lead.status); }} title="Status"><MessageSquare className="h-4 w-4" /></Button>
                                <Button variant="ghost" size="icon" onClick={() => handleDelete(lead.id)} title="Delete"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                              </div>
                            </TableCell>
                          </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="dashboard" className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Total Leads</p>
                      <p className="text-2xl font-bold">{totalLeads}</p>
                    </div>
                    <Users className="h-8 w-8 text-primary/30" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">New Leads</p>
                      <p className="text-2xl font-bold text-blue-600">{newLeads}</p>
                    </div>
                    <UserPlus className="h-8 w-8 text-blue-600/30" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Converted</p>
                      <p className="text-2xl font-bold text-green-600">{convertedLeads}</p>
                    </div>
                    <TrendingUp className="h-8 w-8 text-green-600/30" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Conversion Rate</p>
                      <p className="text-2xl font-bold">{conversionRate}%</p>
                    </div>
                    <BarChart3 className="h-8 w-8 text-purple-600/30" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Pending Follow-ups</p>
                      <p className="text-2xl font-bold text-orange-600">{pendingFollowups}</p>
                    </div>
                    <Calendar className="h-8 w-8 text-orange-600/30" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader><CardTitle className="text-lg">Leads by Status</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <RPieChart>
                      <Pie data={statusChartData} cx="50%" cy="50%" outerRadius={100} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                        {statusChartData.map((_, idx) => (
                          <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </RPieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-lg">Class-wise Demand</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={classChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" fontSize={12} />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* Dialogs - same as teacher but with delete capability */}
        <Dialog open={showForm} onOpenChange={setShowForm}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingLead ? 'Edit Lead' : 'Create New Lead'}</DialogTitle>
            </DialogHeader>
            <LeadEntryForm
              initialData={editingLead}
              isEdit={!!editingLead}
              onSuccess={() => { setShowForm(false); fetchLeads(); }}
            />
          </DialogContent>
        </Dialog>

        {callLogLead && (
          <LeadCallLogDialog
            open={!!callLogLead}
            onOpenChange={() => setCallLogLead(null)}
            leadId={callLogLead.id}
            phoneNumber={callLogLead.primary_mobile}
            studentName={callLogLead.student_name}
            onSuccess={fetchLeads}
          />
        )}

        <LeadExcelImport open={showImport} onOpenChange={setShowImport} onSuccess={fetchLeads} />

        <Dialog open={!!statusUpdateLead} onOpenChange={() => setStatusUpdateLead(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Update Lead Status</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Lead: <strong>{statusUpdateLead?.student_name}</strong></p>
              <div className="space-y-2">
                <Label>New Status</Label>
                <Select value={newStatus} onValueChange={setNewStatus}>
                  <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
                  <SelectContent>
                    {LEAD_STATUSES.map(s => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Next Follow-up Date</Label>
                <Input
                  type="date"
                  onChange={async (e) => {
                    if (statusUpdateLead) {
                      await apiClient.put(`/leads/${statusUpdateLead.id}`, { next_followup_date: e.target.value || null });
                    }
                  }}
                  defaultValue={statusUpdateLead?.next_followup_date || ''}
                />
              </div>
              <div className="space-y-2">
                <Label>Remarks</Label>
                <Textarea value={statusRemarks} onChange={e => setStatusRemarks(e.target.value)} placeholder="Add remarks..." />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setStatusUpdateLead(null)}>Cancel</Button>
                <Button onClick={handleStatusUpdate}>Update Status</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={!!viewingLead} onOpenChange={() => setViewingLead(null)}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Lead Details - {viewingLead?.student_name}</DialogTitle>
            </DialogHeader>
            {viewingLead && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div><span className="text-muted-foreground">Gender:</span> {viewingLead.gender || '—'}</div>
                  <div><span className="text-muted-foreground">DOB:</span> {viewingLead.date_of_birth || '—'}</div>
                  <div><span className="text-muted-foreground">Current Class:</span> {viewingLead.current_class || '—'}</div>
                  <div><span className="text-muted-foreground">Applying For:</span> {viewingLead.class_applying_for || '—'}</div>
                  <div><span className="text-muted-foreground">Father:</span> {viewingLead.father_name || '—'}</div>
                  <div><span className="text-muted-foreground">Mother:</span> {viewingLead.mother_name || '—'}</div>
                  <div>
                    <span className="text-muted-foreground">Primary Mobile:</span>{' '}
                    <a href={`tel:${viewingLead.primary_mobile}`} className="text-primary hover:underline">{viewingLead.primary_mobile}</a>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Alt Mobile:</span>{' '}
                    {viewingLead.alternate_mobile ? (
                      <a href={`tel:${viewingLead.alternate_mobile}`} className="text-primary hover:underline">{viewingLead.alternate_mobile}</a>
                    ) : '—'}
                  </div>
                  <div><span className="text-muted-foreground">Email:</span> {viewingLead.email || '—'}</div>
                  <div><span className="text-muted-foreground">Area:</span> {viewingLead.area_city || '—'}</div>
                  <div><span className="text-muted-foreground">Previous School:</span> {viewingLead.previous_school || '—'}</div>
                  <div><span className="text-muted-foreground">Board:</span> {viewingLead.education_board || '—'}</div>
                  <div className="md:col-span-2"><span className="text-muted-foreground">Remarks:</span> {viewingLead.remarks || '—'}</div>
                </div>

                <div>
                  <h3 className="font-semibold mb-2 flex items-center gap-2"><Phone className="h-4 w-4" /> Call History</h3>
                  {callLogs.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No calls logged yet</p>
                  ) : (
                    <div className="space-y-2">
                      {callLogs.map(log => (
                        <div key={log.id} className="text-sm border rounded-lg p-3">
                          <div className="flex justify-between">
                            <span className="font-medium capitalize">{log.call_outcome?.replace('_', ' ')}</span>
                            <span className="text-muted-foreground">{format(new Date(log.created_at), 'dd MMM yyyy, hh:mm a')}</span>
                          </div>
                          {log.notes && <p className="text-muted-foreground mt-1">{log.notes}</p>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <h3 className="font-semibold mb-2 flex items-center gap-2"><Calendar className="h-4 w-4" /> Status History</h3>
                  {statusHistory.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No status changes yet</p>
                  ) : (
                    <div className="space-y-2">
                      {statusHistory.map(hist => (
                        <div key={hist.id} className="text-sm border rounded-lg p-3">
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                              {hist.old_status && <LeadStatusBadge status={hist.old_status} />}
                              {hist.old_status && <span>→</span>}
                              <LeadStatusBadge status={hist.new_status} />
                            </div>
                            <span className="text-muted-foreground">{format(new Date(hist.created_at), 'dd MMM yyyy, hh:mm a')}</span>
                          </div>
                          {hist.remarks && <p className="text-muted-foreground mt-1">{hist.remarks}</p>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
