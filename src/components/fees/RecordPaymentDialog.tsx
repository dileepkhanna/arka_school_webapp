import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { IndianRupee } from 'lucide-react';
import { apiClient } from '@/lib/apiClient';
import { useToast } from '@/hooks/use-toast';

interface FeeRecord {
  id: string;
  student_id?: string;
  fee_type: string;
  amount: number;
  discount?: number | null;
  paid_amount: number | null;
  due_date: string;
  payment_status: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fee: FeeRecord | null;
  onSuccess: () => void;
}

export default function RecordPaymentDialog({ open, onOpenChange, fee, onSuccess }: Props) {
  const { toast } = useToast();
  const [amount, setAmount] = useState('');
  const [saving, setSaving] = useState(false);

  if (!fee) return null;

  const netAmount = fee.amount - (fee.discount || 0);
  const alreadyPaid = fee.paid_amount || 0;
  const remaining = netAmount - alreadyPaid;
  const enteredAmount = parseFloat(amount) || 0;

  const handleOpen = (isOpen: boolean) => {
    if (isOpen) {
      setAmount(remaining.toString());
    } else {
      setAmount('');
    }
    onOpenChange(isOpen);
  };

  const handleSubmit = async () => {
    if (enteredAmount <= 0) {
      toast({ variant: 'destructive', title: 'Invalid amount', description: 'Amount must be greater than 0' });
      return;
    }
    if (enteredAmount > remaining) {
      toast({ variant: 'destructive', title: 'Invalid amount', description: `Amount cannot exceed remaining balance ₹${remaining.toLocaleString()}` });
      return;
    }

    setSaving(true);
    const newTotalPaid = alreadyPaid + enteredAmount;
    const newStatus = newTotalPaid >= netAmount ? 'paid' : 'partial';
    try {
      await apiClient.post(`/fees/${fee.id}/record-payment`, {
        amount: enteredAmount,
        payment_method: 'cash',
      });
      toast({ title: 'Payment recorded', description: `₹${enteredAmount.toLocaleString()} recorded. ${newStatus === 'paid' ? 'Fully paid!' : `Balance: ₹${(remaining - enteredAmount).toLocaleString()}`}` });
      onOpenChange(false);
      setAmount('');
      onSuccess();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">Record Payment</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-muted p-3 text-center">
              <p className="text-xs text-muted-foreground">Fee Type</p>
              <p className="font-medium capitalize">{fee.fee_type}</p>
            </div>
            <div className="rounded-lg bg-muted p-3 text-center">
              <p className="text-xs text-muted-foreground">Total Amount</p>
              <p className="font-bold flex items-center justify-center"><IndianRupee className="h-3.5 w-3.5" />{fee.amount.toLocaleString()}</p>
            </div>
            {(fee.discount || 0) > 0 && (
              <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 p-3 text-center">
                <p className="text-xs text-muted-foreground">Discount</p>
                <p className="font-bold text-blue-600 flex items-center justify-center">-<IndianRupee className="h-3.5 w-3.5" />{(fee.discount || 0).toLocaleString()}</p>
              </div>
            )}
            <div className="rounded-lg bg-green-50 dark:bg-green-900/20 p-3 text-center">
              <p className="text-xs text-muted-foreground">Already Paid</p>
              <p className="font-bold text-green-600 flex items-center justify-center"><IndianRupee className="h-3.5 w-3.5" />{alreadyPaid.toLocaleString()}</p>
            </div>
            <div className="rounded-lg bg-red-50 dark:bg-red-900/20 p-3 text-center col-span-2">
              <p className="text-xs text-muted-foreground">Remaining Balance</p>
              <p className="text-xl font-bold text-red-600 flex items-center justify-center"><IndianRupee className="h-4 w-4" />{remaining.toLocaleString()}</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="paymentAmount">Payment Amount</Label>
            <div className="relative">
              <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="paymentAmount"
                type="number"
                min={1}
                max={remaining}
                step="0.01"
                className="pl-9"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={`Max: ${remaining.toLocaleString()}`}
              />
            </div>
            {enteredAmount > 0 && enteredAmount <= remaining && (
              <p className="text-xs text-muted-foreground">
                After payment: Balance will be <span className="font-semibold text-foreground">₹{(remaining - enteredAmount).toLocaleString()}</span>
                {enteredAmount >= remaining && <span className="ml-1 text-green-600 font-semibold">• Fully Paid</span>}
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving || enteredAmount <= 0 || enteredAmount > remaining}>
            {saving ? 'Saving...' : `Record ₹${enteredAmount.toLocaleString()}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
