import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/apiClient';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';

interface FeeRecord {
  id: string;
  fee_type: string;
  amount: number;
  discount: number | null;
  due_date: string;
  payment_status: string;
  paid_amount: number | null;
}

interface EditFeeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fee: FeeRecord | null;
  onSuccess: () => void;
}

export default function EditFeeDialog({ open, onOpenChange, fee, onSuccess }: EditFeeDialogProps) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [feeType, setFeeType] = useState('');
  const [amount, setAmount] = useState('');
  const [discount, setDiscount] = useState('');
  const [dueDate, setDueDate] = useState('');

  const isPaid = fee?.payment_status === 'paid';

  useEffect(() => {
    if (fee) {
      setFeeType(fee.fee_type);
      setAmount(fee.amount.toString());
      setDiscount((fee.discount || 0).toString());
      setDueDate(fee.due_date);
    }
  }, [fee]);

  const handleSave = async () => {
    if (!fee) return;
    const newAmount = parseFloat(amount);
    const newDiscount = parseFloat(discount) || 0;
    if (isNaN(newAmount) || newAmount <= 0) {
      toast({ variant: 'destructive', title: 'Invalid amount' });
      return;
    }
    if (newDiscount < 0 || newDiscount > newAmount) {
      toast({ variant: 'destructive', title: 'Invalid discount' });
      return;
    }

    setSaving(true);
    const updateData: Record<string, unknown> = { due_date: dueDate };
    if (!isPaid) {
      updateData.fee_type = feeType;
      updateData.amount = newAmount;
      updateData.discount = newDiscount;
    }

    try {
      await apiClient.put(`/fees/${fee.id}`, updateData);
      toast({ title: 'Fee updated successfully' });
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally {
      setSaving(false);
    }
  };

  if (!fee) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Fee</DialogTitle>
          <DialogDescription>
            {isPaid ? 'This fee is fully paid. Only due date can be changed.' : 'Update the fee details below.'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Fee Type</Label>
            <Input value={feeType} onChange={e => setFeeType(e.target.value)} disabled={isPaid} />
          </div>
          <div>
            <Label>Amount (₹)</Label>
            <Input type="number" value={amount} onChange={e => setAmount(e.target.value)} disabled={isPaid} min="0" />
          </div>
          <div>
            <Label>Discount (₹)</Label>
            <Input type="number" value={discount} onChange={e => setDiscount(e.target.value)} disabled={isPaid} min="0" />
          </div>
          <div>
            <Label>Due Date</Label>
            <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
