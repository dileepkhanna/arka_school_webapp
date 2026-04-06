import { useState } from 'react';
import { apiClient } from '@/lib/apiClient';
import { useAuth } from '@/hooks/useAuth';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { Phone } from 'lucide-react';

const CALL_OUTCOMES = [
  { value: 'connected', label: 'Connected' },
  { value: 'not_answered', label: 'Not Answered' },
  { value: 'busy', label: 'Busy' },
  { value: 'switched_off', label: 'Switched Off' },
  { value: 'wrong_number', label: 'Wrong Number' },
];

interface LeadCallLogDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId: string;
  phoneNumber: string;
  studentName: string;
  onSuccess?: () => void;
}

export default function LeadCallLogDialog({
  open,
  onOpenChange,
  leadId,
  phoneNumber,
  studentName,
  onSuccess,
}: LeadCallLogDialogProps) {
  const { user } = useAuth();
  const [outcome, setOutcome] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!user || !outcome) return;
    setSaving(true);
    try {
      await apiClient.post(`/leads/${leadId}/call-logs`, {
        call_outcome: outcome,
        notes: notes || null,
      });
      toast({ title: 'Call logged successfully' });
      setOutcome('');
      setNotes('');
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5 text-green-600" />
            Log Call - {studentName}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="text-sm text-muted-foreground">Phone Number</Label>
            <a href={`tel:${phoneNumber}`} className="block text-lg font-semibold text-primary hover:underline">
              {phoneNumber}
            </a>
          </div>

          <div className="space-y-2">
            <Label>Call Outcome *</Label>
            <Select value={outcome} onValueChange={setOutcome}>
              <SelectTrigger><SelectValue placeholder="Select outcome" /></SelectTrigger>
              <SelectContent>
                {CALL_OUTCOMES.map(o => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Notes (optional)</Label>
            <Textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Add any notes about the call..."
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={!outcome || saving}>
              {saving ? 'Saving...' : 'Log Call'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
