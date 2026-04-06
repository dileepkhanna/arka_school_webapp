import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { IndianRupee, Download, CheckCircle2, Clock, AlertCircle, History } from 'lucide-react';
import { generateFeeReceipt } from './FeeReceiptGenerator';
import { loadReceiptTemplate, type ReceiptTemplate } from './ReceiptTemplateSettings';
import { apiClient } from '@/lib/apiClient';

interface FeeRecord {
  id: string;
  fee_type: string;
  amount: number;
  discount?: number | null;
  paid_amount: number | null;
  due_date: string;
  payment_status: string;
  paid_at: string | null;
  receipt_number: string | null;
}

interface PaymentRecord {
  id: string;
  amount: number;
  payment_method: string;
  receipt_number: string;
  paid_at: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentName: string;
  admissionNumber: string;
  className: string;
  fees: FeeRecord[];
}

export default function StudentFeeDetailDialog({ open, onOpenChange, studentName, admissionNumber, className, fees }: Props) {
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [template, setTemplate] = useState<ReceiptTemplate | null>(null);

  const feeIds = fees.map(f => f.id);

  useEffect(() => {
    if (open) {
      loadReceiptTemplate().then(setTemplate);
    }
  }, [open]);

  useEffect(() => {
    if (open && feeIds.length > 0) {
      setLoadingPayments(true);
      apiClient
        .post<{ payments: PaymentRecord[] }>('/fees/payments', { fee_ids: feeIds })
        .then((data) => {
          setPayments((data.payments as PaymentRecord[]) || []);
          setLoadingPayments(false);
        })
        .catch(() => {
          setPayments([]);
          setLoadingPayments(false);
        });
    }
  }, [open, JSON.stringify(feeIds)]);

  const totalFees = fees.reduce((s, f) => s + f.amount, 0);
  const totalDiscount = fees.reduce((s, f) => s + (f.discount || 0), 0);
  const totalPaid = fees.reduce((s, f) => s + (f.paid_amount || 0), 0);
  const balance = totalFees - totalDiscount - totalPaid;

  const getStatusBadge = (status: string) => {
    if (status === 'paid') return <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 flex items-center gap-1 w-fit"><CheckCircle2 className="h-3 w-3" />Paid</Badge>;
    if (status === 'partial') return <Badge className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 flex items-center gap-1 w-fit"><Clock className="h-3 w-3" />Partial</Badge>;
    return <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 flex items-center gap-1 w-fit"><AlertCircle className="h-3 w-3" />Unpaid</Badge>;
  };

  const handleDownloadReceipt = (receiptNumber: string, paidAt: string, feeType?: string, amount?: number, paidAmount?: number, discount?: number) => {
    generateFeeReceipt({
      receiptNumber,
      studentName,
      admissionNumber,
      className,
      feeType: feeType || 'Payment',
      amount: amount || 0,
      discount: discount || 0,
      paidAmount: paidAmount || 0,
      paidAt,
      template: template || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">{studentName}'s Fee Details</DialogTitle>
        </DialogHeader>

        <div className="text-sm text-muted-foreground mb-2">
          Admission: <span className="font-mono">{admissionNumber}</span> · Class: {className}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <div className="rounded-lg bg-muted p-3 text-center">
            <p className="text-xs text-muted-foreground">Total Fees</p>
            <p className="text-lg font-bold flex items-center justify-center"><IndianRupee className="h-4 w-4" />{totalFees.toLocaleString()}</p>
          </div>
          {totalDiscount > 0 && (
            <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 p-3 text-center">
              <p className="text-xs text-muted-foreground">Discount</p>
              <p className="text-lg font-bold text-blue-600 flex items-center justify-center">-<IndianRupee className="h-4 w-4" />{totalDiscount.toLocaleString()}</p>
            </div>
          )}
          <div className="rounded-lg bg-green-50 dark:bg-green-900/20 p-3 text-center">
            <p className="text-xs text-muted-foreground">Paid</p>
            <p className="text-lg font-bold text-green-600 flex items-center justify-center"><IndianRupee className="h-4 w-4" />{totalPaid.toLocaleString()}</p>
          </div>
          <div className="rounded-lg bg-red-50 dark:bg-red-900/20 p-3 text-center">
            <p className="text-xs text-muted-foreground">Balance</p>
            <p className="text-lg font-bold text-red-600 flex items-center justify-center"><IndianRupee className="h-4 w-4" />{balance.toLocaleString()}</p>
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
             <TableHead>Fee Type</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Discount</TableHead>
              <TableHead>Net</TableHead>
              <TableHead>Paid</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead>Balance</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Receipt</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {fees.map(fee => (
              <TableRow key={fee.id}>
                <TableCell className="capitalize">{fee.fee_type}</TableCell>
                <TableCell>₹{fee.amount.toLocaleString()}</TableCell>
                <TableCell>{(fee.discount || 0) > 0 ? <span className="text-success">₹{(fee.discount || 0).toLocaleString()}</span> : '-'}</TableCell>
                <TableCell className="font-medium">₹{(fee.amount - (fee.discount || 0)).toLocaleString()}</TableCell>
                <TableCell>₹{(fee.paid_amount || 0).toLocaleString()}</TableCell>
                <TableCell>{new Date(fee.due_date).toLocaleDateString()}</TableCell>
                <TableCell className="font-medium text-destructive">₹{(fee.amount - (fee.discount || 0) - (fee.paid_amount || 0)).toLocaleString()}</TableCell>
                <TableCell>{getStatusBadge(fee.payment_status)}</TableCell>
                <TableCell>
                  {fee.receipt_number ? (
                    <Button size="sm" variant="ghost" onClick={() => handleDownloadReceipt(fee.receipt_number!, fee.paid_at!, fee.fee_type, fee.amount, fee.paid_amount || 0, fee.discount || 0)}>
                      <Download className="h-3 w-3 mr-1" />
                      {fee.receipt_number}
                    </Button>
                  ) : '-'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {/* Payment History */}
        {payments.length > 0 && (
          <div className="mt-6">
            <h3 className="font-display text-sm font-semibold flex items-center gap-2 mb-3">
              <History className="h-4 w-4 text-primary" />
              Payment History ({payments.length} transactions)
            </h3>
            <div className="space-y-2">
              {payments.map(p => (
                <div key={p.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 text-sm">
                  <div>
                    <p className="font-medium flex items-center gap-1">
                      <IndianRupee className="h-3 w-3" />{p.amount.toLocaleString()}
                      <Badge variant="outline" className="ml-2 text-xs capitalize">{p.payment_method}</Badge>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(p.paid_at).toLocaleString()} · Receipt: {p.receipt_number}
                    </p>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => handleDownloadReceipt(p.receipt_number, p.paid_at, 'Payment', p.amount, p.amount)}>
                    <Download className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
