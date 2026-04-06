import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Users, IndianRupee, AlertCircle, User } from 'lucide-react';

interface FeeRecord {
  id: string;
  student_id: string;
  fee_type: string;
  amount: number;
  discount: number | null;
  paid_amount: number | null;
  due_date: string;
  payment_status: string;
  students?: { full_name: string; admission_number: string; login_id?: string | null; classes?: { name: string; section: string; id?: string } | null } | null;
}

interface ClassInfo {
  id: string;
  name: string;
  section: string;
}

interface Props {
  fees: FeeRecord[];
  classes: ClassInfo[];
  onClassSelect: (classId: string) => void;
}

export default function ClassSummaryView({ fees, classes, onClassSelect }: Props) {
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedStudent, setSelectedStudent] = useState('');

  // Fees for selected class
  const classFees = useMemo(() => {
    if (!selectedClass) return [];
    return fees.filter(f => (f.students?.classes as any)?.id === selectedClass);
  }, [fees, selectedClass]);

  // Unique students in selected class
  const studentOptions = useMemo(() => {
    const map = new Map<string, { id: string; name: string; loginId: string }>();
    classFees.forEach(f => {
      if (!f.students) return;
      if (!map.has(f.student_id)) {
        map.set(f.student_id, {
          id: f.student_id,
          name: f.students.full_name,
          loginId: f.students.login_id || f.students.admission_number,
        });
      }
    });
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [classFees]);

  // All classes summary (when no class selected)
  const classSummaries = useMemo(() => {
    return classes.map((cls) => {
      const cFees = fees.filter(f => (f.students?.classes as any)?.id === cls.id);
      const uniqueStudents = new Set(cFees.map(f => f.student_id)).size;
      const totalFees = cFees.reduce((s, f) => s + f.amount, 0);
      const totalDiscount = cFees.reduce((s, f) => s + (f.discount || 0), 0);
      const totalCollected = cFees.reduce((s, f) => s + (f.paid_amount || 0), 0);
      const totalDue = totalFees - totalDiscount - totalCollected;
      const overdueCount = cFees.filter(f => f.payment_status !== 'paid' && new Date(f.due_date) < new Date()).length;
      return { cls, uniqueStudents, totalFees, totalCollected, totalDue, overdueCount };
    }).filter(s => s.uniqueStudents > 0);
  }, [fees, classes]);

  // Per-student summaries for selected class
  const studentSummaries = useMemo(() => {
    const targetFees = selectedStudent
      ? classFees.filter(f => f.student_id === selectedStudent)
      : classFees;

    const map = new Map<string, { name: string; loginId: string; totalFees: number; collected: number; due: number; overdue: number }>();
    targetFees.forEach(f => {
      if (!f.students) return;
      const existing = map.get(f.student_id) || {
        name: f.students.full_name,
        loginId: f.students.login_id || f.students.admission_number,
        totalFees: 0, collected: 0, due: 0, overdue: 0,
      };
      existing.totalFees += f.amount;
      existing.collected += f.paid_amount || 0;
      existing.due += f.amount - (f.discount || 0) - (f.paid_amount || 0);
      if (f.payment_status !== 'paid' && new Date(f.due_date) < new Date()) existing.overdue++;
      map.set(f.student_id, existing);
    });
    return [...map.entries()].sort((a, b) => a[1].name.localeCompare(b[1].name));
  }, [classFees, selectedStudent]);

  // Class-level totals
  const classTotals = useMemo(() => {
    const targetFees = selectedStudent
      ? classFees.filter(f => f.student_id === selectedStudent)
      : classFees;
    return {
      totalFees: targetFees.reduce((s, f) => s + f.amount, 0),
      collected: targetFees.reduce((s, f) => s + (f.paid_amount || 0), 0),
      due: targetFees.reduce((s, f) => s + (f.amount - (f.discount || 0) - (f.paid_amount || 0)), 0),
      students: new Set(targetFees.map(f => f.student_id)).size,
    };
  }, [classFees, selectedStudent]);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card className="card-elevated">
        <CardContent className="pt-4 pb-4 sm:pt-6 sm:pb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select value={selectedClass} onValueChange={(v) => { setSelectedClass(v); setSelectedStudent(''); }}>
              <SelectTrigger><SelectValue placeholder="Select Class" /></SelectTrigger>
              <SelectContent>
                {classes.map(c => <SelectItem key={c.id} value={c.id}>{c.section ? `${c.name} - ${c.section}` : c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={selectedStudent} onValueChange={setSelectedStudent} disabled={!selectedClass}>
              <SelectTrigger><SelectValue placeholder="All Students" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Students</SelectItem>
                {studentOptions.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* No class selected: show all class cards */}
      {!selectedClass && (
        <>
          {classSummaries.length === 0 ? (
            <p className="text-center py-12 text-muted-foreground text-sm">No fee data available.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {classSummaries.map(({ cls, uniqueStudents, totalFees, totalCollected, totalDue, overdueCount }) => (
                <Card
                  key={cls.id}
                  className="card-elevated cursor-pointer hover:ring-2 hover:ring-primary/40 transition-all"
                  onClick={() => { setSelectedClass(cls.id); onClassSelect(cls.id); }}
                >
                  <CardHeader className="pb-2 p-4 sm:p-6 sm:pb-2">
                    <CardTitle className="font-display text-base sm:text-lg flex items-center justify-between">
                      {cls.section ? `${cls.name} - ${cls.section}` : cls.name}
                      <Badge variant="secondary" className="flex items-center gap-1 text-xs">
                        <Users className="h-3 w-3" /> {uniqueStudents}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm p-4 pt-0 sm:p-6 sm:pt-0">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total Fees</span>
                      <span className="font-medium flex items-center"><IndianRupee className="h-3 w-3" />{totalFees.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Collected</span>
                      <span className="font-medium text-success flex items-center"><IndianRupee className="h-3 w-3" />{totalCollected.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Due</span>
                      <span className="font-medium text-destructive flex items-center"><IndianRupee className="h-3 w-3" />{totalDue.toLocaleString()}</span>
                    </div>
                    {overdueCount > 0 && (
                      <div className="flex items-center gap-1 text-destructive text-xs pt-1">
                        <AlertCircle className="h-3 w-3" /> {overdueCount} overdue
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {/* Class selected: show totals + student breakdown */}
      {selectedClass && (
        <>
          {/* Totals banner */}
          <Card className="card-elevated border-l-4 border-l-primary">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-display font-semibold text-sm sm:text-base">
                  {classes.find(c => c.id === selectedClass)?.name} - {classes.find(c => c.id === selectedClass)?.section}
                  {selectedStudent && selectedStudent !== 'all' && (
                    <span className="text-muted-foreground font-normal ml-2">
                      · {studentOptions.find(s => s.id === selectedStudent)?.name}
                    </span>
                  )}
                </h3>
                <Badge variant="secondary" className="text-xs flex items-center gap-1">
                  <Users className="h-3 w-3" /> {classTotals.students}
                </Badge>
              </div>
              <div className="grid grid-cols-3 divide-x divide-border text-center">
                <div className="px-2">
                  <p className="text-[10px] sm:text-xs uppercase tracking-wide text-muted-foreground">Total</p>
                  <p className="text-sm sm:text-lg font-bold">₹{classTotals.totalFees.toLocaleString()}</p>
                </div>
                <div className="px-2">
                  <p className="text-[10px] sm:text-xs uppercase tracking-wide text-muted-foreground">Collected</p>
                  <p className="text-sm sm:text-lg font-bold text-success">₹{classTotals.collected.toLocaleString()}</p>
                </div>
                <div className="px-2">
                  <p className="text-[10px] sm:text-xs uppercase tracking-wide text-muted-foreground">Due</p>
                  <p className="text-sm sm:text-lg font-bold text-destructive">₹{classTotals.due.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Student-wise breakdown */}
          {studentSummaries.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground text-sm">No fee records for this selection.</p>
          ) : (
            <div className="space-y-2">
              {studentSummaries.map(([studentId, s]) => (
                <Card key={studentId} className="card-elevated">
                  <CardContent className="p-3 sm:p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <User className="h-4 w-4 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">{s.name}</p>
                          <p className="text-xs text-muted-foreground font-mono">{s.loginId}</p>
                        </div>
                      </div>
                      {s.overdue > 0 && (
                        <Badge variant="destructive" className="text-[10px] shrink-0">{s.overdue} overdue</Badge>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-2 mt-3 text-center">
                      <div className="bg-muted/50 rounded-lg p-2">
                        <p className="text-[10px] text-muted-foreground uppercase">Total</p>
                        <p className="text-xs sm:text-sm font-semibold">₹{s.totalFees.toLocaleString()}</p>
                      </div>
                      <div className="bg-success/5 rounded-lg p-2">
                        <p className="text-[10px] text-muted-foreground uppercase">Paid</p>
                        <p className="text-xs sm:text-sm font-semibold text-success">₹{s.collected.toLocaleString()}</p>
                      </div>
                      <div className="bg-destructive/5 rounded-lg p-2">
                        <p className="text-[10px] text-muted-foreground uppercase">Due</p>
                        <p className="text-xs sm:text-sm font-semibold text-destructive">₹{s.due.toLocaleString()}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
