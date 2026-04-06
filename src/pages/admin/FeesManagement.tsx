import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useAuth } from '@/hooks/useAuth';
import { apiClient } from '@/lib/apiClient';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { adminSidebarItems } from '@/config/adminSidebar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Search, CreditCard, DollarSign, AlertCircle, CheckCircle, Download, Plus, Settings, Edit2, Trash2, FileText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import StatCard from '@/components/StatCard';
import { BackButton } from '@/components/ui/back-button';
import ClassSummaryView from '@/components/fees/ClassSummaryView';
import StudentFeeDetailDialog from '@/components/fees/StudentFeeDetailDialog';
import { generateFeeReceipt } from '@/components/fees/FeeReceiptGenerator';
import CreateFeeDialog from '@/components/fees/CreateFeeDialog';
import RecordPaymentDialog from '@/components/fees/RecordPaymentDialog';
import ReceiptTemplateSettings, { loadReceiptTemplate, type ReceiptTemplate } from '@/components/fees/ReceiptTemplateSettings';
import EditFeeDialog from '@/components/fees/EditFeeDialog';
import DeleteFeeDialog from '@/components/fees/DeleteFeeDialog';

interface FeeRecord {
  id: string;
  student_id: string;
  fee_type: string;
  amount: number;
  discount: number | null;
  paid_amount: number | null;
  due_date: string;
  payment_status: string;
  paid_at: string | null;
  receipt_number: string | null;
  students?: { full_name: string; admission_number: string; login_id?: string | null; classes?: { name: string; section: string; id?: string } | null } | null;
}

interface FeesManagementDataResponse {
  fees: FeeRecord[];
  classes: { id: string; name: string; section: string }[];
}

export default function FeesManagement() {
  const { user, userRole, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [fees, setFees] = useState<FeeRecord[]>([]);
  const [classes, setClasses] = useState<{ id: string; name: string; section: string }[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [classFilter, setClassFilter] = useState('');
  const [studentFilter, setStudentFilter] = useState('');
  const [stats, setStats] = useState({ totalDue: 0, totalPaid: 0, overdue: 0 });

  // Dialogs
  const [selectedStudent, setSelectedStudent] = useState<{ name: string; admission: string; className: string; fees: FeeRecord[] } | null>(null);
  const [showCreateFee, setShowCreateFee] = useState(false);
  const [paymentFee, setPaymentFee] = useState<FeeRecord | null>(null);
  const [showReceiptSettings, setShowReceiptSettings] = useState(false);
  const [receiptTemplate, setReceiptTemplate] = useState<ReceiptTemplate | null>(null);
  const [editFee, setEditFee] = useState<FeeRecord | null>(null);
  const [deleteFeeIds, setDeleteFeeIds] = useState<string[]>([]);
  const [deleteMode, setDeleteMode] = useState<'single' | 'class'>('single');

  useEffect(() => {
    loadReceiptTemplate().then(setReceiptTemplate);
  }, [showReceiptSettings]);

  useEffect(() => {
    if (!loading && (!user || userRole !== 'admin')) {
      navigate('/auth');
    }
  }, [user, userRole, loading, navigate]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoadingData(true);
    try {
      const data = await apiClient.get<FeesManagementDataResponse>('/fees/management-data');
      const feeRows = data.fees || [];
      setFees(feeRows);
      const totalDue = feeRows.reduce((sum, f) => sum + (f.amount - (f.discount || 0) - (f.paid_amount || 0)), 0);
      const totalPaid = feeRows.reduce((sum, f) => sum + (f.paid_amount || 0), 0);
      const overdue = feeRows.filter(f => f.payment_status === 'unpaid' && new Date(f.due_date) < new Date()).length;
      setStats({ totalDue, totalPaid, overdue });
      setClasses(data.classes || []);
    } catch (error) {
      console.error('Error loading fees management data:', error);
      setFees([]);
      setClasses([]);
      setStats({ totalDue: 0, totalPaid: 0, overdue: 0 });
    } finally {
      setLoadingData(false);
    }
  };

  const handleMarkPaid = async (id: string, amount: number) => {
    try {
      await apiClient.post(`/fees/${id}/record-payment`, { amount, payment_method: 'cash' });
      toast({ title: 'Success', description: 'Payment recorded' });
      fetchData();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    }
  };

  const handleDownloadReceipt = (fee: FeeRecord) => {
    if (!fee.receipt_number || !fee.paid_at) return;
    generateFeeReceipt({
      receiptNumber: fee.receipt_number,
      studentName: fee.students?.full_name || 'N/A',
      admissionNumber: fee.students?.login_id || fee.students?.admission_number,
      className: fee.students?.classes ? (fee.students.classes.section ? `${fee.students.classes.name} - ${fee.students.classes.section}` : fee.students.classes.name) : undefined,
      feeType: fee.fee_type,
      amount: fee.amount,
      discount: fee.discount || 0,
      paidAmount: fee.paid_amount || 0,
      paidAt: fee.paid_at,
      template: receiptTemplate || undefined,
    });
  };

  const openStudentDetail = (studentId: string) => {
    const studentFees = fees.filter(f => f.student_id === studentId);
    const first = studentFees[0];
    if (!first?.students) return;
    setSelectedStudent({
      name: first.students.full_name,
      admission: first.students.login_id || first.students.admission_number,
      className: first.students.classes ? (first.students.classes.section ? `${first.students.classes.name} - ${first.students.classes.section}` : first.students.classes.name) : 'N/A',
      fees: studentFees,
    });
  };

  const getStatusBadge = (status: string, dueDate: string) => {
    if (status === 'paid') return <Badge className="bg-success/10 text-success border-success/20">Paid</Badge>;
    if (status === 'partial') return <Badge className="bg-warning/10 text-warning border-warning/20">Partial</Badge>;
    if (new Date(dueDate) < new Date()) return <Badge className="bg-destructive/10 text-destructive border-destructive/20">Overdue</Badge>;
    return <Badge className="bg-primary/10 text-primary border-primary/20">Unpaid</Badge>;
  };

  // Unique students for filter, scoped to selected class
  const studentOptions = (() => {
    if (!classFilter) return [];
    const map = new Map<string, { id: string; name: string }>();
    fees.forEach(f => {
      if (!f.students) return;
      if ((f.students.classes as any)?.id !== classFilter) return;
      if (!map.has(f.student_id)) {
        map.set(f.student_id, { id: f.student_id, name: f.students.full_name });
      }
    });
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  })();

  // Reset student filter when class filter changes
  useEffect(() => {
    setStudentFilter('');
  }, [classFilter]);

  // Only show data when both class and student are selected
  const filteredFees = (!classFilter || !studentFilter) ? [] : fees.filter((f) => {
    const matchesSearch = f.students?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.students?.admission_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.fee_type.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || f.payment_status === statusFilter;
    const matchesClass = (f.students?.classes as any)?.id === classFilter;
    const matchesStudent = f.student_id === studentFilter;
    return matchesSearch && matchesStatus && matchesClass && matchesStudent;
  });

  const classFeeCount = classFilter ? fees.filter(f => (f.students?.classes as any)?.id === classFilter).length : 0;

  const handleExportReport = () => {
    const dataToExport = filteredFees.length > 0 ? filteredFees : fees;
    if (dataToExport.length === 0) {
      toast({ variant: 'destructive', title: 'No Data', description: 'No fee records to export.' });
      return;
    }

    const doc = new jsPDF({ orientation: 'landscape' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const now = format(new Date(), 'PPP');

    // Title
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Fee Collection Report', 14, 18);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Generated: ${now}`, 14, 24);

    // Summary stats
    const totalAmount = dataToExport.reduce((s, f) => s + f.amount, 0);
    const totalDiscount = dataToExport.reduce((s, f) => s + (f.discount || 0), 0);
    const totalPaidAmt = dataToExport.reduce((s, f) => s + (f.paid_amount || 0), 0);
    const totalBalance = totalAmount - totalDiscount - totalPaidAmt;
    const paidCount = dataToExport.filter(f => f.payment_status === 'paid').length;
    const unpaidCount = dataToExport.filter(f => f.payment_status === 'unpaid').length;
    const partialCount = dataToExport.filter(f => f.payment_status === 'partial').length;
    const overdueCount = dataToExport.filter(f => f.payment_status !== 'paid' && new Date(f.due_date) < new Date()).length;

    // Summary box
    doc.setFillColor(245, 247, 250);
    doc.setDrawColor(200);
    doc.roundedRect(14, 28, pageWidth - 28, 20, 2, 2, 'FD');
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(`Total Records: ${dataToExport.length}`, 20, 36);
    doc.text(`Total Amount: Rs.${totalAmount.toLocaleString()}`, 70, 36);
    doc.text(`Discount: Rs.${totalDiscount.toLocaleString()}`, 130, 36);
    doc.text(`Collected: Rs.${totalPaidAmt.toLocaleString()}`, 180, 36);
    doc.text(`Balance: Rs.${totalBalance.toLocaleString()}`, 230, 36);
    doc.setFont('helvetica', 'normal');
    doc.text(`Paid: ${paidCount}  |  Unpaid: ${unpaidCount}  |  Partial: ${partialCount}  |  Overdue: ${overdueCount}`, 20, 44);

    // Table
    autoTable(doc, {
      startY: 54,
      head: [['#', 'Student Name', 'ID', 'Class', 'Fee Type', 'Amount (Rs.)', 'Discount (Rs.)', 'Net (Rs.)', 'Paid (Rs.)', 'Balance (Rs.)', 'Due Date', 'Status']],
      body: dataToExport.map((f, i) => {
        const net = f.amount - (f.discount || 0);
        const balance = net - (f.paid_amount || 0);
        const status = f.payment_status === 'paid' ? 'Paid'
          : f.payment_status === 'partial' ? 'Partial'
            : new Date(f.due_date) < new Date() ? 'Overdue' : 'Unpaid';
        return [
          i + 1,
          f.students?.full_name || 'N/A',
          f.students?.login_id || f.students?.admission_number || '-',
          f.students?.classes ? (f.students.classes.section ? `${f.students.classes.name}-${f.students.classes.section}` : f.students.classes.name) : '-',
          f.fee_type,
          f.amount.toLocaleString(),
          (f.discount || 0).toLocaleString(),
          net.toLocaleString(),
          (f.paid_amount || 0).toLocaleString(),
          balance.toLocaleString(),
          new Date(f.due_date).toLocaleDateString(),
          status,
        ];
      }),
      styles: { fontSize: 7, cellPadding: 2 },
      headStyles: { fillColor: [41, 128, 185], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7 },
      columnStyles: {
        0: { halign: 'center', cellWidth: 8 },
        5: { halign: 'right' },
        6: { halign: 'right' },
        7: { halign: 'right' },
        8: { halign: 'right' },
        9: { halign: 'right' },
        11: { halign: 'center' },
      },
      didParseCell: (data: any) => {
        if (data.section === 'body' && data.column.index === 11) {
          const val = data.cell.raw;
          if (val === 'Paid') data.cell.styles.textColor = [39, 174, 96];
          else if (val === 'Overdue') data.cell.styles.textColor = [231, 76, 60];
          else if (val === 'Partial') data.cell.styles.textColor = [243, 156, 18];
        }
      },
    });

    // Footer totals
    const finalY = (doc as any).lastAutoTable.finalY + 10;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(`Grand Total: Rs.${totalAmount.toLocaleString()}  |  Total Collected: Rs.${totalPaidAmt.toLocaleString()}  |  Outstanding Balance: Rs.${totalBalance.toLocaleString()}`, 14, finalY);

    const pdfBlob = doc.output('blob');
    const blobUrl = URL.createObjectURL(pdfBlob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = `Fee-Report-${format(new Date(), 'yyyy-MM-dd')}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);

    toast({ title: 'Report Downloaded', description: `Exported ${dataToExport.length} records` });
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <DashboardLayout sidebarItems={adminSidebarItems} roleColor="admin">
      <div className="space-y-4 sm:space-y-6 animate-fade-in">
        <BackButton to="/admin" />

        {/* Header */}
        <div className="flex flex-col gap-3">
          <div>
            <h1 className="font-display text-xl sm:text-2xl font-bold">Fees Management</h1>
            <p className="text-sm text-muted-foreground">Track and manage student fees</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" onClick={() => setShowCreateFee(true)}>
              <Plus className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Create Fee</span>
              <span className="sm:hidden">Create</span>
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowReceiptSettings(true)}>
              <Settings className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Receipt Settings</span>
              <span className="sm:hidden">Receipt</span>
            </Button>
            <Button size="sm" variant="outline" onClick={handleExportReport}>
              <FileText className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Export Report</span>
              <span className="sm:hidden">Export</span>
            </Button>
          </div>
        </div>

        {/* Stat Cards - compact row on mobile, grid on desktop */}
        <div className="sm:hidden">
          <Card className="card-elevated">
            <CardContent className="p-3">
              <div className="flex items-center justify-between divide-x divide-border">
                <div className="flex-1 text-center px-2">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Due</p>
                  <p className="text-base font-bold text-destructive">₹{stats.totalDue.toLocaleString()}</p>
                </div>
                <div className="flex-1 text-center px-2">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Collected</p>
                  <p className="text-base font-bold text-primary">₹{stats.totalPaid.toLocaleString()}</p>
                </div>
                <div className="flex-1 text-center px-2">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Overdue</p>
                  <p className="text-base font-bold text-foreground">{stats.overdue}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        <div className="hidden sm:grid sm:grid-cols-3 gap-4">
          <StatCard title="Total Due" value={`₹${stats.totalDue.toLocaleString()}`} icon={<AlertCircle className="h-6 w-6" />} />
          <StatCard title="Total Collected" value={`₹${stats.totalPaid.toLocaleString()}`} icon={<CheckCircle className="h-6 w-6" />} variant="primary" />
          <StatCard title="Overdue" value={stats.overdue.toString()} icon={<CreditCard className="h-6 w-6" />} />
        </div>

        <Tabs defaultValue="all-records">
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="all-records" className="flex-1 sm:flex-none">All Records</TabsTrigger>
            <TabsTrigger value="class-summary" className="flex-1 sm:flex-none">Class Summary</TabsTrigger>
          </TabsList>

          <TabsContent value="all-records" className="space-y-4">
            {/* Filters */}
            <Card className="card-elevated">
              <CardContent className="pt-4 pb-4 sm:pt-6 sm:pb-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="relative sm:col-span-2 lg:col-span-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Search..." className="pl-10" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                  </div>
                  <Select value={classFilter} onValueChange={setClassFilter}>
                    <SelectTrigger><SelectValue placeholder="Select Class" /></SelectTrigger>
                    <SelectContent>
                      {classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.section ? `${c.name} - ${c.section}` : c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={studentFilter} onValueChange={setStudentFilter} disabled={!classFilter}>
                    <SelectTrigger><SelectValue placeholder="Select Student" /></SelectTrigger>
                    <SelectContent>
                      {studentOptions.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="paid">Paid</SelectItem>
                      <SelectItem value="unpaid">Unpaid</SelectItem>
                      <SelectItem value="partial">Partial</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {classFilter && classFeeCount > 0 && (
                  <div className="mt-3 flex justify-end">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => {
                        const classFeeIds = fees
                          .filter(f => (f.students?.classes as any)?.id === classFilter)
                          .map(f => f.id);
                        setDeleteMode('class');
                        setDeleteFeeIds(classFeeIds);
                      }}
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Delete Class Fees ({classFeeCount})
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Fee Records */}
            <Card className="card-elevated">
              <CardHeader className="pb-3">
                <CardTitle className="font-display text-base sm:text-lg">Fee Records ({filteredFees.length})</CardTitle>
              </CardHeader>
              <CardContent>
                {loadingData ? (
                  <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
                ) : filteredFees.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground text-sm">
                    {!classFilter ? 'Please select a class to begin' : !studentFilter ? 'Please select a student to view fee records' : 'No fee records found'}
                  </div>
                ) : (
                  <>
                    {/* Desktop Table */}
                    <div className="hidden lg:block overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Student</TableHead>
                            <TableHead>Class</TableHead>
                            <TableHead>Fee Type</TableHead>
                            <TableHead>Amount</TableHead>
                            <TableHead>Discount</TableHead>
                            <TableHead>Net</TableHead>
                            <TableHead>Paid</TableHead>
                            <TableHead>Balance</TableHead>
                            <TableHead>Due Date</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredFees.map((fee) => (
                            <TableRow key={fee.id}>
                              <TableCell>
                                <button className="text-left hover:underline" onClick={() => openStudentDetail(fee.student_id)}>
                                  <div className="font-medium">{fee.students?.full_name || 'N/A'}</div>
                                  <div className="text-xs text-muted-foreground font-mono">{fee.students?.login_id || fee.students?.admission_number}</div>
                                </button>
                              </TableCell>
                              <TableCell>{fee.students?.classes ? (fee.students.classes.section ? `${fee.students.classes.name} - ${fee.students.classes.section}` : fee.students.classes.name) : 'N/A'}</TableCell>
                              <TableCell className="capitalize">{fee.fee_type}</TableCell>
                              <TableCell className="font-medium">₹{fee.amount.toLocaleString()}</TableCell>
                              <TableCell>{(fee.discount || 0) > 0 ? <span className="text-success">₹{(fee.discount || 0).toLocaleString()}</span> : '-'}</TableCell>
                              <TableCell className="font-medium">₹{(fee.amount - (fee.discount || 0)).toLocaleString()}</TableCell>
                              <TableCell className="text-success">₹{(fee.paid_amount || 0).toLocaleString()}</TableCell>
                              <TableCell className="font-medium text-destructive">₹{(fee.amount - (fee.discount || 0) - (fee.paid_amount || 0)).toLocaleString()}</TableCell>
                              <TableCell>{new Date(fee.due_date).toLocaleDateString()}</TableCell>
                              <TableCell>{getStatusBadge(fee.payment_status, fee.due_date)}</TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1">
                                  <Button size="sm" variant="ghost" onClick={() => setEditFee(fee)} title="Edit">
                                    <Edit2 className="h-3 w-3" />
                                  </Button>
                                  <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => { setDeleteMode('single'); setDeleteFeeIds([fee.id]); }} title="Delete">
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                  {fee.payment_status !== 'paid' && (
                                    <Button size="sm" variant="outline" onClick={() => setPaymentFee(fee)}>
                                      <DollarSign className="h-3 w-3 mr-1" />Record
                                    </Button>
                                  )}
                                  {fee.receipt_number && (
                                    <Button size="sm" variant="ghost" onClick={() => handleDownloadReceipt(fee)}>
                                      <Download className="h-3 w-3 mr-1" />Receipt
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    {/* Mobile Cards */}
                    <div className="lg:hidden space-y-3">
                      {filteredFees.map((fee) => {
                        const net = fee.amount - (fee.discount || 0);
                        const balance = net - (fee.paid_amount || 0);
                        return (
                          <Card key={fee.id} className="border">
                            <CardContent className="p-4 space-y-3">
                              {/* Header: Student + Status */}
                              <div className="flex items-start justify-between gap-2">
                                <button className="text-left" onClick={() => openStudentDetail(fee.student_id)}>
                                  <div className="font-medium text-sm">{fee.students?.full_name || 'N/A'}</div>
                                  <div className="text-xs text-muted-foreground font-mono">{fee.students?.login_id || fee.students?.admission_number}</div>
                                </button>
                                {getStatusBadge(fee.payment_status, fee.due_date)}
                              </div>

                              {/* Fee details - aligned table layout */}
                              <div className="text-sm">
                                <div className="flex justify-between py-1.5 border-b border-border/50">
                                  <span className="text-muted-foreground">Fee Type</span>
                                  <span className="capitalize font-medium text-right">{fee.fee_type}</span>
                                </div>
                                <div className="flex justify-between py-1.5 border-b border-border/50">
                                  <span className="text-muted-foreground">Amount</span>
                                  <span className="font-medium text-right">₹{fee.amount.toLocaleString()}</span>
                                </div>
                                {(fee.discount || 0) > 0 && (
                                  <div className="flex justify-between py-1.5 border-b border-border/50">
                                    <span className="text-muted-foreground">Discount</span>
                                    <span className="text-success text-right">₹{(fee.discount || 0).toLocaleString()}</span>
                                  </div>
                                )}
                                <div className="flex justify-between py-1.5 border-b border-border/50">
                                  <span className="text-muted-foreground">Net</span>
                                  <span className="font-semibold text-right">₹{net.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between py-1.5 border-b border-border/50">
                                  <span className="text-muted-foreground">Paid</span>
                                  <span className="text-success text-right">₹{(fee.paid_amount || 0).toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between py-1.5 border-b border-border/50">
                                  <span className="text-muted-foreground">Balance</span>
                                  <span className="font-semibold text-destructive text-right">₹{balance.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between py-1.5">
                                  <span className="text-muted-foreground">Due Date</span>
                                  <span className="text-right">{new Date(fee.due_date).toLocaleDateString()}</span>
                                </div>
                              </div>

                              {/* Actions - stacked rows to prevent overflow */}
                              <div className="pt-2 border-t space-y-2">
                                <div className="grid grid-cols-3 gap-2">
                                  <Button size="sm" variant="ghost" className="h-9 text-xs px-2" onClick={() => setEditFee(fee)}>
                                    <Edit2 className="h-3.5 w-3.5 mr-1" /> Edit
                                  </Button>
                                  <Button size="sm" variant="ghost" className="h-9 text-xs px-2 text-destructive hover:text-destructive" onClick={() => { setDeleteMode('single'); setDeleteFeeIds([fee.id]); }}>
                                    <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
                                  </Button>
                                  {fee.payment_status !== 'paid' ? (
                                    <Button size="sm" variant="default" className="h-9 text-xs px-2" onClick={() => setPaymentFee(fee)}>
                                      <DollarSign className="h-3.5 w-3.5 mr-1" /> Record
                                    </Button>
                                  ) : (
                                    <div />
                                  )}
                                </div>
                                {fee.receipt_number && (
                                  <Button size="sm" variant="outline" className="w-full h-9 text-xs" onClick={() => handleDownloadReceipt(fee)}>
                                    <Download className="h-3.5 w-3.5 mr-1" /> Download Receipt
                                  </Button>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="class-summary">
            <ClassSummaryView
              fees={fees}
              classes={classes}
              onClassSelect={(classId) => {
                setClassFilter(classId);
              }}
            />
          </TabsContent>
        </Tabs>
      </div>

      {selectedStudent && (
        <StudentFeeDetailDialog
          open={!!selectedStudent}
          onOpenChange={(open) => !open && setSelectedStudent(null)}
          studentName={selectedStudent.name}
          admissionNumber={selectedStudent.admission}
          className={selectedStudent.className}
          fees={selectedStudent.fees}
        />
      )}

      <CreateFeeDialog
        open={showCreateFee}
        onOpenChange={setShowCreateFee}
        onSuccess={fetchData}
      />

      <RecordPaymentDialog
        open={!!paymentFee}
        onOpenChange={(open) => !open && setPaymentFee(null)}
        fee={paymentFee}
        onSuccess={fetchData}
      />

      <ReceiptTemplateSettings
        open={showReceiptSettings}
        onOpenChange={setShowReceiptSettings}
      />

      <EditFeeDialog
        open={!!editFee}
        onOpenChange={(open) => !open && setEditFee(null)}
        fee={editFee}
        onSuccess={fetchData}
      />

      <DeleteFeeDialog
        open={deleteFeeIds.length > 0}
        onOpenChange={(open) => !open && setDeleteFeeIds([])}
        mode={deleteMode}
        feeIds={deleteFeeIds}
        recordCount={deleteFeeIds.length}
        onSuccess={fetchData}
      />
    </DashboardLayout>
  );
}
