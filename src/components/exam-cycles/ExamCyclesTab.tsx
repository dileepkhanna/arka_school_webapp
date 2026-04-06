import { useEffect, useState, useMemo } from 'react';
import { apiClient } from '@/lib/apiClient';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { Loader2, Plus, RotateCcw, Calendar, Play, Pause, Trash2, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';

interface ExamCycle {
  id: string;
  exam_type: string;
  cycle_number: number;
  start_date: string;
  end_date: string;
  is_active: boolean;
  created_at: string;
}

const EXAM_TYPES = ['JEE', 'NEET', 'BITSAT'];
const ROTATION_ORDER = ['JEE', 'NEET', 'BITSAT'];

function getNextExamType(lastType: string | null): string {
  if (!lastType) return ROTATION_ORDER[0];
  const idx = ROTATION_ORDER.indexOf(lastType);
  return ROTATION_ORDER[(idx + 1) % ROTATION_ORDER.length];
}

function getCycleWeek(startDate: string): number {
  const start = new Date(startDate);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return 0;
  return Math.min(Math.floor(diffDays / 7) + 1, 3);
}

function getCycleProgress(startDate: string, endDate: string): number {
  const start = new Date(startDate).getTime();
  const end = new Date(endDate).getTime();
  const now = Date.now();
  if (now <= start) return 0;
  if (now >= end) return 100;
  return Math.round(((now - start) / (end - start)) * 100);
}

export default function ExamCyclesTab() {
  const [cycles, setCycles] = useState<ExamCycle[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    exam_type: '',
    cycle_number: '1',
    start_date: '',
    end_date: '',
  });

  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    setLoadingData(true);
    try {
      const data = await apiClient.get<ExamCycle[]>('/admin/exam-cycles');
      setCycles(data || []);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load exam cycles');
    } finally {
      setLoadingData(false);
    }
  }

  function openCreateDialog() {
    const lastCycle = cycles.length > 0 ? cycles[0] : null;
    const nextType = getNextExamType(lastCycle?.exam_type || null);
    const nextNumber = lastCycle && lastCycle.exam_type === nextType
      ? lastCycle.cycle_number + 1
      : (cycles.filter(c => c.exam_type === nextType).length + 1);

    let startDate = new Date().toISOString().split('T')[0];
    if (lastCycle?.end_date) {
      const d = new Date(lastCycle.end_date);
      d.setDate(d.getDate() + 1);
      startDate = d.toISOString().split('T')[0];
    }
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 20);

    setFormData({
      exam_type: nextType,
      cycle_number: nextNumber.toString(),
      start_date: startDate,
      end_date: endDate.toISOString().split('T')[0],
    });
    setDialogOpen(true);
  }

  function handleStartDateChange(date: string) {
    const end = new Date(date);
    end.setDate(end.getDate() + 20);
    setFormData(f => ({ ...f, start_date: date, end_date: end.toISOString().split('T')[0] }));
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.exam_type || !formData.start_date || !formData.end_date) {
      toast.error('Please fill all fields');
      return;
    }
    try {
      await apiClient.post('/admin/exam-cycles', {
        exam_type: formData.exam_type,
        cycle_number: parseInt(formData.cycle_number),
        start_date: formData.start_date,
        end_date: formData.end_date,
      });
    } catch (error: any) { toast.error(error.message); return; }
    toast.success('Exam cycle created');
    setDialogOpen(false);
    fetchData();
  }

  async function toggleActive(cycle: ExamCycle) {
    try {
      await apiClient.put(`/admin/exam-cycles/${cycle.id}/toggle-active`);
    } catch (error: any) { toast.error(error.message); return; }
    toast.success(cycle.is_active ? 'Cycle deactivated' : 'Cycle activated');
    fetchData();
  }

  async function handleDelete(id: string) {
    try {
      await apiClient.delete(`/admin/exam-cycles/${id}`);
    } catch (error: any) { toast.error(error.message); return; }
    toast.success('Cycle deleted');
    fetchData();
  }

  const activeCycles = useMemo(() => cycles.filter(c => c.is_active), [cycles]);
  const inactiveCycles = useMemo(() => cycles.filter(c => !c.is_active), [cycles]);

  if (loadingData) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button onClick={openCreateDialog}>
          <Plus className="h-4 w-4 mr-2" />New Cycle
        </Button>
      </div>

      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <span className="text-sm text-muted-foreground mr-2">Rotation:</span>
            {ROTATION_ORDER.map((type, i) => {
              const isActive = activeCycles.some(c => c.exam_type === type);
              return (
                <div key={type} className="flex items-center gap-2">
                  <Badge variant={isActive ? 'default' : 'outline'} className="text-xs">{type}</Badge>
                  {i < ROTATION_ORDER.length - 1 && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
                </div>
              );
            })}
            <ChevronRight className="h-3 w-3 text-muted-foreground" />
            <RotateCcw className="h-3 w-3 text-muted-foreground" />
          </div>
        </CardContent>
      </Card>

      {activeCycles.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Play className="h-4 w-4 text-primary" /> Active Cycles
          </h2>
          {activeCycles.map(cycle => (
            <CycleCard key={cycle.id} cycle={cycle} onToggle={toggleActive} onDelete={handleDelete} />
          ))}
        </div>
      )}

      {inactiveCycles.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Pause className="h-4 w-4 text-muted-foreground" /> Upcoming & Past Cycles
          </h2>
          {inactiveCycles.map(cycle => (
            <CycleCard key={cycle.id} cycle={cycle} onToggle={toggleActive} onDelete={handleDelete} />
          ))}
        </div>
      )}

      {cycles.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No exam cycles yet. Click "New Cycle" to start the first JEE→NEET→BITSAT rotation.
          </CardContent>
        </Card>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create Exam Cycle</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <Label>Exam Type</Label>
              <Select value={formData.exam_type} onValueChange={v => setFormData(f => ({ ...f, exam_type: v }))}>
                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  {EXAM_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Cycle Number</Label>
              <Input type="number" value={formData.cycle_number} onChange={e => setFormData(f => ({ ...f, cycle_number: e.target.value }))} min="1" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Input type="date" value={formData.start_date} onChange={e => handleStartDateChange(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>End Date (3 weeks)</Label>
                <Input type="date" value={formData.end_date} onChange={e => setFormData(f => ({ ...f, end_date: e.target.value }))} />
              </div>
            </div>
            <div className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
              <strong>3-Week Structure:</strong>
              <ul className="mt-1 space-y-0.5 list-disc list-inside">
                <li>Week 1: Syllabus topics assigned</li>
                <li>Week 2: Syllabus topics assigned</li>
                <li>Week 3: Syllabus topics + Exam</li>
              </ul>
            </div>
            <Button type="submit" className="w-full">Create Cycle</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CycleCard({ cycle, onToggle, onDelete }: {
  cycle: ExamCycle;
  onToggle: (c: ExamCycle) => void;
  onDelete: (id: string) => void;
}) {
  const progress = getCycleProgress(cycle.start_date, cycle.end_date);
  const currentWeek = getCycleWeek(cycle.start_date);
  const isCompleted = progress >= 100;
  const isUpcoming = progress === 0 && !cycle.is_active;

  return (
    <Card className={cycle.is_active ? 'border-primary/50' : ''}>
      <CardContent className="py-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            <Badge variant={cycle.is_active ? 'default' : 'secondary'} className="text-xs">{cycle.exam_type}</Badge>
            <span className="font-medium text-sm">Cycle #{cycle.cycle_number}</span>
            {cycle.is_active && <Badge variant="outline" className="text-xs">Week {currentWeek}/3</Badge>}
            {isCompleted && !cycle.is_active && <Badge variant="outline" className="text-xs text-muted-foreground">Completed</Badge>}
            {isUpcoming && <Badge variant="outline" className="text-xs">Upcoming</Badge>}
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              <Label htmlFor={`active-${cycle.id}`} className="text-xs text-muted-foreground">Active</Label>
              <Switch id={`active-${cycle.id}`} checked={cycle.is_active} onCheckedChange={() => onToggle(cycle)} />
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onDelete(cycle.id)}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {new Date(cycle.start_date).toLocaleDateString()} — {new Date(cycle.end_date).toLocaleDateString()}
          </span>
          <span>{progress}% complete</span>
        </div>
        {cycle.is_active && <Progress value={progress} className="h-2" />}
        {cycle.is_active && (
          <div className="grid grid-cols-3 gap-2">
            {[1, 2, 3].map(week => {
              const isCurrentWeek = currentWeek === week;
              const isPastWeek = currentWeek > week;
              return (
                <div key={week} className={`rounded-md border p-2 text-center text-xs ${isCurrentWeek ? 'border-primary bg-primary/5 font-medium' : isPastWeek ? 'bg-muted text-muted-foreground' : ''}`}>
                  <div>Week {week}</div>
                  <div className="text-muted-foreground mt-0.5">{isPastWeek ? '✓ Done' : isCurrentWeek ? '● Active' : 'Upcoming'}</div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
