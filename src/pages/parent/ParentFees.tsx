import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { apiClient } from '@/lib/apiClient';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, CreditCard, Calendar, CheckCircle2, Clock, AlertCircle, IndianRupee, Download, History } from 'lucide-react';
import { parentSidebarItems } from '@/config/parentSidebar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BackButton } from '@/components/ui/back-button';
import { generateFeeReceipt } from '@/components/fees/FeeReceiptGenerator';
import { defaultTemplate, loadReceiptTemplate, type ReceiptTemplate } from '@/components/fees/ReceiptTemplateSettings';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface Fee {
  id: string;
  fee_type: string;
  amount: number;
  paid_amount: number | null;
  due_date: string;
  payment_status: string;
  paid_at: string | null;
  receipt_number: string | null;
  discount: number | null;
}

interface Child {
  id: string;
  name: string;
  admission_number?: string;
  login_id?: string;
  class_name?: string | null;
  class_section?: string | null;
  fees: Fee[];
  payments: FeePayment[];
}

interface FeePayment {
  id: string;
  amount: number;
  payment_method: string;
  receipt_number: string;
  paid_at: string;
  fee_id: string;
}

interface ParentFeesResponse {
  children: Child[];
}

interface PaymentGatewayConfigResponse {
  provider: 'razorpay';
  configured: boolean;
  key_id: string;
}

interface RazorpayOrderResponse {
  provider: 'razorpay';
  key_id: string;
  order_id: string;
  amount: number;
  amount_paise: number;
  currency: string;
  student_name: string;
  description: string;
  fee_id: number;
}

declare global {
  interface Window {
    Razorpay?: any;
  }
}

function PaymentHistorySection({ payments, studentName, admissionNumber, className, template }: { payments: FeePayment[]; studentName: string; admissionNumber?: string; className?: string; template?: ReceiptTemplate | null }) {
  if (payments.length === 0) return null;

  return (
    <Card className="card-elevated">
      <CardHeader className="pb-3">
        <CardTitle className="font-display flex items-center gap-2 text-base sm:text-lg">
          <History className="h-5 w-5 text-primary" />
          Payment History ({payments.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {payments.map((p) => (
            <div key={p.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 gap-3">
              <div className="min-w-0 flex-1">
                <p className="font-medium flex items-center gap-1 flex-wrap">
                  <IndianRupee className="h-3 w-3 shrink-0" />{Number(p.amount).toLocaleString()}
                  <Badge variant="outline" className="text-xs capitalize">{p.payment_method}</Badge>
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {new Date(p.paid_at).toLocaleString()} · {p.receipt_number}
                </p>
              </div>
              <Button size="sm" variant="outline" className="shrink-0" onClick={() => {
                generateFeeReceipt({
                  receiptNumber: p.receipt_number,
                  studentName,
                  admissionNumber,
                  className,
                  feeType: 'Payment',
                  amount: Number(p.amount),
                  paidAmount: Number(p.amount),
                  paidAt: p.paid_at,
                  template: template || undefined,
                });
              }}>
                <Download className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default function ParentFees() {
  const { user, userRole, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [children, setChildren] = useState<Child[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string>('');
  const [loadingData, setLoadingData] = useState(true);
  const [payingFeeId, setPayingFeeId] = useState<string | null>(null);
  const [paymentDialogFee, setPaymentDialogFee] = useState<Fee | null>(null);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [receiptTemplate, setReceiptTemplate] = useState<ReceiptTemplate | null>(null);
  const [paymentConfig, setPaymentConfig] = useState<PaymentGatewayConfigResponse | null>(null);

  useEffect(() => {
    if (!user || userRole !== 'parent') return;

    loadReceiptTemplate()
      .then(setReceiptTemplate)
      .catch(() => setReceiptTemplate(defaultTemplate));
  }, [user, userRole]);

  useEffect(() => {
    if (!loading && (!user || userRole !== 'parent')) {
      navigate('/auth');
    }
  }, [user, userRole, loading, navigate]);

  const fetchFees = async () => {
    if (!user) return;
    setLoadingData(true);

    try {
      const data = await apiClient.get<ParentFeesResponse>('/parent/fees-data');
      const childrenData = data.children || [];
      setChildren(childrenData);
      if (!selectedChildId && childrenData.length > 0) setSelectedChildId(childrenData[0].id);
    } catch (error) {
      console.error('Error loading parent fees:', error);
      setChildren([]);
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    fetchFees();
  }, [user]);

  useEffect(() => {
    const fetchPaymentConfig = async () => {
      if (!user) return;

      try {
        const data = await apiClient.get<PaymentGatewayConfigResponse>('/parent/fees/payment-gateway-config');
        setPaymentConfig(data);
      } catch (error) {
        console.error('Error loading payment gateway config:', error);
        setPaymentConfig({ provider: 'razorpay', configured: false, key_id: '' });
      }
    };

    fetchPaymentConfig();
  }, [user]);

  const ensureRazorpayScript = async (): Promise<boolean> => {
    if (window.Razorpay) return true;

    return new Promise((resolve) => {
      const existingScript = document.getElementById('razorpay-checkout-script') as HTMLScriptElement | null;
      if (existingScript) {
        existingScript.addEventListener('load', () => resolve(Boolean(window.Razorpay)), { once: true });
        existingScript.addEventListener('error', () => resolve(false), { once: true });
        return;
      }

      const script = document.createElement('script');
      script.id = 'razorpay-checkout-script';
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      script.onload = () => resolve(Boolean(window.Razorpay));
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const selectedChild = children.find(c => c.id === selectedChildId);
  const selectedChildClassName = selectedChild?.class_name
    ? (selectedChild.class_section ? `${selectedChild.class_name} - ${selectedChild.class_section}` : selectedChild.class_name)
    : undefined;

  const openPaymentDialog = (fee: Fee) => {
    const netAmount = fee.amount - (fee.discount || 0);
    const remaining = netAmount - (fee.paid_amount || 0);
    setCustomAmount(remaining.toString());
    setPaymentDialogFee(fee);
  };

  const handlePayNow = async (fee: Fee, payAmount: number) => {
    if (!user || !selectedChild) return;
    setPaymentDialogFee(null);
    setPayingFeeId(fee.id);

    try {
      if (!paymentConfig?.configured || !paymentConfig.key_id) {
        toast({ variant: 'destructive', title: 'Payment Gateway Not Configured', description: 'Please contact admin to configure Razorpay.' });
        return;
      }

      const scriptLoaded = await ensureRazorpayScript();
      if (!scriptLoaded || !window.Razorpay) {
        toast({ variant: 'destructive', title: 'Payment SDK Error', description: 'Unable to load Razorpay checkout.' });
        return;
      }

      const order = await apiClient.post<RazorpayOrderResponse>(`/parent/fees/${fee.id}/create-order`, {
        amount: payAmount,
      });

      const checkout = new window.Razorpay({
        key: order.key_id,
        amount: order.amount_paise,
        currency: order.currency,
        name: 'SmartEduConnect',
        description: order.description,
        order_id: order.order_id,
        prefill: {
          name: selectedChild.name,
          email: user.email,
        },
        theme: {
          color: '#1a5c3a',
        },
        modal: {
          ondismiss: () => {
            toast({ title: 'Payment Cancelled', description: 'You can retry anytime.' });
          },
        },
        handler: async (response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
          try {
            const data = await apiClient.post<{ receipt_number: string }>(`/parent/fees/${fee.id}/verify-payment`, {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });

            toast({ title: 'Payment Successful!', description: `Receipt: ${data.receipt_number}` });
            fetchFees();
          } catch (verifyError: any) {
            toast({ variant: 'destructive', title: 'Payment Verification Failed', description: verifyError.message });
          } finally {
            setPayingFeeId(null);
          }
        },
      });

      checkout.open();
      return;
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Payment Error', description: err.message });
    } finally {
      setPayingFeeId(null);
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }
  const fees = selectedChild?.fees || [];
  const totalDue = fees.filter(f => f.payment_status !== 'paid').reduce((sum, f) => sum + (f.amount - (f.discount || 0) - (f.paid_amount || 0)), 0);
  const totalPaid = fees.filter(f => f.payment_status === 'paid').reduce((sum, f) => sum + (f.paid_amount || f.amount), 0);
  const paidFees = fees.filter(f => f.payment_status === 'paid' && f.paid_at);
  const unpaidFees = fees.filter(f => f.payment_status !== 'paid');

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'paid': return { icon: <CheckCircle2 className="h-4 w-4" />, class: 'bg-success/10 text-success' };
      case 'partial': return { icon: <Clock className="h-4 w-4" />, class: 'bg-warning/10 text-warning' };
      default: return { icon: <AlertCircle className="h-4 w-4" />, class: 'bg-destructive/10 text-destructive' };
    }
  };

  const handleDownloadReceipt = (fee: Fee) => {
    if (!fee.receipt_number || !fee.paid_at) return;
    generateFeeReceipt({
      receiptNumber: fee.receipt_number,
      studentName: selectedChild?.name || '',
      admissionNumber: selectedChild?.login_id || selectedChild?.admission_number,
      className: selectedChildClassName,
      feeType: fee.fee_type,
      amount: fee.amount,
      discount: fee.discount || 0,
      paidAmount: fee.paid_amount || 0,
      paidAt: fee.paid_at,
      template: receiptTemplate || undefined,
    });
  };

  return (
    <DashboardLayout sidebarItems={parentSidebarItems} roleColor="parent">
      {loadingData ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : (
      <div className="space-y-4 sm:space-y-6 animate-fade-in">
        <BackButton to="/parent" />
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="font-display text-xl sm:text-2xl font-bold">Fee Payment</h1>
            <p className="text-sm text-muted-foreground">{selectedChild?.name}'s fee details</p>
          </div>
          {children.length > 1 && (
            <Select value={selectedChildId} onValueChange={setSelectedChildId}>
              <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="Select child" /></SelectTrigger>
              <SelectContent>
                {children.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Summary - compact row on mobile, cards on desktop */}
        <div className="sm:hidden">
          <Card className="card-elevated">
            <CardContent className="p-3">
              <div className="flex items-center justify-between divide-x divide-border">
                <div className="flex-1 text-center px-2">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Due</p>
                  <p className="text-base font-bold text-destructive">₹{totalDue.toLocaleString()}</p>
                </div>
                <div className="flex-1 text-center px-2">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Paid</p>
                  <p className="text-base font-bold text-success">₹{totalPaid.toLocaleString()}</p>
                </div>
                <div className="flex-1 text-center px-2">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Total</p>
                  <p className="text-base font-bold text-foreground">₹{fees.reduce((s, f) => s + f.amount, 0).toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        <div className="hidden sm:grid sm:grid-cols-3 gap-4">
          <Card className="card-elevated border-l-4 border-l-destructive">
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Total Due</p>
              <p className="text-2xl font-bold text-destructive flex items-center mt-1">
                <IndianRupee className="h-5 w-5" />{totalDue.toLocaleString()}
              </p>
            </CardContent>
          </Card>
          <Card className="card-elevated border-l-4 border-l-success">
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Total Paid</p>
              <p className="text-2xl font-bold text-success flex items-center mt-1">
                <IndianRupee className="h-5 w-5" />{totalPaid.toLocaleString()}
              </p>
            </CardContent>
          </Card>
          <Card className="card-elevated border-l-4 border-l-primary">
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Total Fees</p>
              <p className="text-2xl font-bold flex items-center mt-1">
                <IndianRupee className="h-5 w-5" />{fees.reduce((s, f) => s + f.amount, 0).toLocaleString()}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Fee Details */}
        <Card className="card-elevated">
          <CardHeader className="pb-3">
            <CardTitle className="font-display flex items-center gap-2 text-base sm:text-lg">
              <CreditCard className="h-5 w-5 text-primary" />
              Fee Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            {fees.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground text-sm">No fee records found.</p>
            ) : (
              <>
                {/* Desktop Table */}
                <div className="hidden md:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fee Type</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Discount</TableHead>
                        <TableHead>Net Amount</TableHead>
                        <TableHead>Paid</TableHead>
                        <TableHead>Due Date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {fees.map((fee) => {
                        const style = getStatusStyle(fee.payment_status);
                        const isOverdue = fee.payment_status !== 'paid' && new Date(fee.due_date) < new Date();
                        return (
                          <TableRow key={fee.id}>
                            <TableCell className="font-medium">{fee.fee_type}</TableCell>
                            <TableCell><span className="flex items-center"><IndianRupee className="h-3 w-3" />{fee.amount.toLocaleString()}</span></TableCell>
                            <TableCell>
                              {(fee.discount || 0) > 0 ? (
                                <span className="flex items-center text-success">-<IndianRupee className="h-3 w-3" />{(fee.discount || 0).toLocaleString()}</span>
                              ) : '-'}
                            </TableCell>
                            <TableCell><span className="flex items-center font-medium"><IndianRupee className="h-3 w-3" />{(fee.amount - (fee.discount || 0)).toLocaleString()}</span></TableCell>
                            <TableCell><span className="flex items-center"><IndianRupee className="h-3 w-3" />{(fee.paid_amount || 0).toLocaleString()}</span></TableCell>
                            <TableCell>
                              <div className={`flex items-center gap-1 text-sm ${isOverdue ? 'text-destructive' : ''}`}>
                                <Calendar className="h-3 w-3" />
                                {new Date(fee.due_date).toLocaleDateString()}
                                {isOverdue && <Badge variant="destructive" className="ml-1 text-xs">Overdue</Badge>}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge className={`${style.class} flex items-center gap-1 w-fit`}>
                                {style.icon}
                                {fee.payment_status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {fee.payment_status !== 'paid' ? (
                                <Button
                                  size="sm"
                                  className="gradient-parent"
                                  onClick={() => openPaymentDialog(fee)}
                                  disabled={payingFeeId === fee.id}
                                >
                                  {payingFeeId === fee.id ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <CreditCard className="h-3 w-3 mr-1" />}
                                  Pay Now
                                </Button>
                              ) : fee.receipt_number ? (
                                <Button size="sm" variant="ghost" onClick={() => handleDownloadReceipt(fee)}>
                                  <Download className="h-3 w-3 mr-1" />Receipt
                                </Button>
                              ) : '-'}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile Cards */}
                <div className="md:hidden space-y-3">
                  {fees.map((fee) => {
                    const style = getStatusStyle(fee.payment_status);
                    const isOverdue = fee.payment_status !== 'paid' && new Date(fee.due_date) < new Date();
                    const net = fee.amount - (fee.discount || 0);
                    const balance = net - (fee.paid_amount || 0);
                    return (
                      <Card key={fee.id} className="border">
                        <CardContent className="p-4 space-y-3">
                          {/* Header */}
                          <div className="flex items-center justify-between">
                            <span className="font-medium capitalize">{fee.fee_type}</span>
                            <Badge className={`${style.class} flex items-center gap-1`}>
                              {style.icon}
                              {fee.payment_status}
                            </Badge>
                          </div>

                          {/* Details - aligned row layout */}
                          <div className="text-sm">
                            <div className="flex justify-between py-1.5 border-b border-border/50">
                              <span className="text-muted-foreground">Amount</span>
                              <span className="flex items-center"><IndianRupee className="h-3 w-3" />{fee.amount.toLocaleString()}</span>
                            </div>
                            {(fee.discount || 0) > 0 && (
                              <div className="flex justify-between py-1.5 border-b border-border/50">
                                <span className="text-muted-foreground">Discount</span>
                                <span className="flex items-center text-success">-<IndianRupee className="h-3 w-3" />{(fee.discount || 0).toLocaleString()}</span>
                              </div>
                            )}
                            <div className="flex justify-between py-1.5 border-b border-border/50">
                              <span className="text-muted-foreground">Net</span>
                              <span className="flex items-center font-semibold"><IndianRupee className="h-3 w-3" />{net.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between py-1.5 border-b border-border/50">
                              <span className="text-muted-foreground">Paid</span>
                              <span className="flex items-center text-success"><IndianRupee className="h-3 w-3" />{(fee.paid_amount || 0).toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between py-1.5 border-b border-border/50">
                              <span className="text-muted-foreground">Balance</span>
                              <span className="flex items-center font-semibold text-destructive"><IndianRupee className="h-3 w-3" />{balance.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between py-1.5">
                              <span className={`text-muted-foreground ${isOverdue ? 'text-destructive' : ''}`}>Due Date</span>
                              <span className={`flex items-center gap-1 ${isOverdue ? 'text-destructive' : ''}`}>
                                <Calendar className="h-3 w-3" />
                                {new Date(fee.due_date).toLocaleDateString()}
                              </span>
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="pt-2 border-t space-y-2">
                            {fee.payment_status !== 'paid' ? (
                              <Button
                                size="sm"
                                className="gradient-parent w-full"
                                onClick={() => openPaymentDialog(fee)}
                                disabled={payingFeeId === fee.id}
                              >
                                {payingFeeId === fee.id ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <CreditCard className="h-3 w-3 mr-1" />}
                                Pay Now
                              </Button>
                            ) : null}
                            {fee.receipt_number && (
                              <Button size="sm" variant="outline" className="w-full" onClick={() => handleDownloadReceipt(fee)}>
                                <Download className="h-3 w-3 mr-1" />Download Receipt
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

        {/* Payment History */}
        <PaymentHistorySection
          payments={selectedChild?.payments || []}
          studentName={selectedChild?.name || ''}
          admissionNumber={selectedChild?.login_id || selectedChild?.admission_number}
          className={selectedChildClassName}
          template={receiptTemplate}
        />

        {unpaidFees.length > 0 && (
          <Card className="card-elevated bg-primary/5 border-primary/20">
            <CardContent className="p-4 sm:pt-6 sm:p-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-sm sm:text-base">Pay all dues at once</p>
                  <p className="text-xs sm:text-sm text-muted-foreground">Total due: ₹{totalDue.toLocaleString()}</p>
                </div>
                <Button className="gradient-parent w-full sm:w-auto" onClick={() => unpaidFees[0] && openPaymentDialog(unpaidFees[0])}>
                  <CreditCard className="h-4 w-4 mr-2" />
                  Pay ₹{totalDue.toLocaleString()}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
      )}

      {/* Custom Payment Amount Dialog */}
      <Dialog open={!!paymentDialogFee} onOpenChange={(open) => { if (!open) setPaymentDialogFee(null); }}>
        <DialogContent className="max-w-[95vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" />
              Enter Payment Amount
            </DialogTitle>
          </DialogHeader>
          {paymentDialogFee && (() => {
            const fee = paymentDialogFee;
            const netAmount = fee.amount - (fee.discount || 0);
            const alreadyPaid = fee.paid_amount || 0;
            const remaining = netAmount - alreadyPaid;
            const enteredAmount = parseFloat(customAmount) || 0;
            const isValid = enteredAmount > 0 && enteredAmount <= remaining;

            return (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="text-muted-foreground">Fee Type</div>
                  <div className="font-medium capitalize">{fee.fee_type}</div>
                  <div className="text-muted-foreground">Total Amount</div>
                  <div className="flex items-center"><IndianRupee className="h-3 w-3" />{fee.amount.toLocaleString()}</div>
                  {(fee.discount || 0) > 0 && <>
                    <div className="text-muted-foreground">Discount</div>
                    <div className="flex items-center text-success">-<IndianRupee className="h-3 w-3" />{(fee.discount || 0).toLocaleString()}</div>
                  </>}
                  <div className="text-muted-foreground">Already Paid</div>
                  <div className="flex items-center"><IndianRupee className="h-3 w-3" />{alreadyPaid.toLocaleString()}</div>
                  <div className="text-muted-foreground font-semibold">Remaining</div>
                  <div className="flex items-center font-bold text-destructive"><IndianRupee className="h-3 w-3" />{remaining.toLocaleString()}</div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="payAmount">Amount to Pay (₹)</Label>
                  <Input
                    id="payAmount"
                    type="number"
                    min={1}
                    max={remaining}
                    value={customAmount}
                    onChange={(e) => setCustomAmount(e.target.value)}
                    placeholder={`Max ₹${remaining.toLocaleString()}`}
                  />
                  {enteredAmount > remaining && (
                    <p className="text-xs text-destructive">Amount cannot exceed ₹{remaining.toLocaleString()}</p>
                  )}
                </div>

                <DialogFooter className="flex-col sm:flex-row gap-2">
                  <Button variant="outline" onClick={() => setPaymentDialogFee(null)} className="w-full sm:w-auto">Cancel</Button>
                  <Button
                    className="gradient-parent w-full sm:w-auto"
                    disabled={!isValid || !paymentConfig?.configured}
                    onClick={() => handlePayNow(fee, enteredAmount)}
                  >
                    <CreditCard className="h-4 w-4 mr-1" />
                    {paymentConfig?.configured ? `Pay via Razorpay ₹${isValid ? enteredAmount.toLocaleString() : '0'}` : 'Razorpay Not Configured'}
                  </Button>
                </DialogFooter>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
