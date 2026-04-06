import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export const LEAD_STATUSES = [
  { value: 'new_lead', label: 'New Lead', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  { value: 'contacted', label: 'Contacted', color: 'bg-cyan-100 text-cyan-800 border-cyan-200' },
  { value: 'interested', label: 'Interested', color: 'bg-green-100 text-green-800 border-green-200' },
  { value: 'follow_up_required', label: 'Follow-up Required', color: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  { value: 'waiting', label: 'Waiting / On Hold', color: 'bg-orange-100 text-orange-800 border-orange-200' },
  { value: 'in_process', label: 'In Process', color: 'bg-purple-100 text-purple-800 border-purple-200' },
  { value: 'converted', label: 'Converted', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  { value: 'rejected', label: 'Rejected / Not Interested', color: 'bg-red-100 text-red-800 border-red-200' },
];

export function getStatusLabel(status: string) {
  return LEAD_STATUSES.find(s => s.value === status)?.label || status;
}

export function LeadStatusBadge({ status }: { status: string }) {
  const statusConfig = LEAD_STATUSES.find(s => s.value === status);
  return (
    <Badge
      variant="outline"
      className={cn('font-medium', statusConfig?.color || 'bg-muted text-muted-foreground')}
    >
      {statusConfig?.label || status}
    </Badge>
  );
}
