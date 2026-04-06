import { useState, useEffect, useMemo } from 'react';
import { apiClient } from '@/lib/apiClient';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { CalendarIcon, Loader2, Users, User, CreditCard, Bell, X, Percent } from 'lucide-react';

const FEE_TYPES = [
  'Tuition', 'Transport', 'Lab', 'Exam', 'Library', 'Sports',
  'Uniform', 'Admission', 'Unit 1 Fees', 'Unit 2 Fees',
  'Unit 3 Fees', 'Unit 4 Fees',
];

interface FeeEntry {
  type: string;
  amount: string;
}

interface StudentInfo {
  id: string;
  full_name: string;
  admission_number: string;
}

interface ClassInfo {
  id: string;
  name: string;
  section: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export default function CreateFeeDialog({ open, onOpenChange, onSuccess }: Props) {
  const { toast } = useToast();
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [students, setStudents] = useState<StudentInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingStudents, setLoadingStudents] = useState(false);

  const [assignMode, setAssignMode] = useState<'class' | 'student'>('class');
  const [selectedClassName, setSelectedClassName] = useState('');
  const [selectedSectionIds, setSelectedSectionIds] = useState<string[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [feeEntries, setFeeEntries] = useState<FeeEntry[]>([]);
  const [customFeeType, setCustomFeeType] = useState('');
  const [customFeeAmount, setCustomFeeAmount] = useState('');
  const [dueDate, setDueDate] = useState<Date>();
  const [enableReminder, setEnableReminder] = useState(true);
  const [reminderDays, setReminderDays] = useState('3');

  // Discount state
  const [enableDiscount, setEnableDiscount] = useState(false);
  const [discountMode, setDiscountMode] = useState<'flat' | 'per-student'>('flat');
  const [flatDiscount, setFlatDiscount] = useState('');
  const [studentDiscounts, setStudentDiscounts] = useState<Record<string, { enabled: boolean; amount: string }>>({});

  // Derived: unique class names
  const classNames = useMemo(() => {
    const names = [...new Set(classes.map(c => c.name))];
    names.sort((a, b) => {
      const numA = parseInt(a.replace(/\D/g, '')) || 0;
      const numB = parseInt(b.replace(/\D/g, '')) || 0;
      return numA - numB || a.localeCompare(b);
    });
    return names;
  }, [classes]);

  // Derived: sections for selected class name
  const availableSections = useMemo(() => {
    return classes.filter(c => c.name === selectedClassName);
  }, [classes, selectedClassName]);

  useEffect(() => {
    if (open) {
      fetchClasses();
      resetForm();
    }
  }, [open]);

  // When class name changes, auto-select all sections
  useEffect(() => {
    if (selectedClassName) {
      const sectionIds = availableSections.map(c => c.id);
      setSelectedSectionIds(sectionIds);
    } else {
      setSelectedSectionIds([]);
    }
  }, [selectedClassName, availableSections]);

  // Fetch students when selected sections change
  useEffect(() => {
    if (selectedSectionIds.length > 0) {
      fetchStudentsBySections(selectedSectionIds);
    } else {
      setStudents([]);
    }
  }, [selectedSectionIds]);

  // Initialize student discounts when students change
  useEffect(() => {
    const discounts: Record<string, { enabled: boolean; amount: string }> = {};
    students.forEach(s => {
      discounts[s.id] = studentDiscounts[s.id] || { enabled: false, amount: '' };
    });
    setStudentDiscounts(discounts);
  }, [students]);

  const resetForm = () => {
    setAssignMode('class');
    setSelectedClassName('');
    setSelectedSectionIds([]);
    setSelectedStudentId('');
    setFeeEntries([]);
    setCustomFeeType('');
    setCustomFeeAmount('');
    setDueDate(undefined);
    setEnableReminder(true);
    setReminderDays('3');
    setEnableDiscount(false);
    setDiscountMode('flat');
    setFlatDiscount('');
    setStudentDiscounts({});
  };

  const fetchClasses = async () => {
    try {
      const data = await apiClient.get<ClassInfo[]>('/classes');
      setClasses((data || []).map(c => ({ id: String(c.id), name: c.name, section: c.section })));
    } catch (error) {
      console.error('Error loading classes:', error);
      setClasses([]);
    }
  };

  const fetchStudentsBySections = async (classIds: string[]) => {
    setLoadingStudents(true);
    try {
      const data = await apiClient.post<{ students: StudentInfo[] }>('/fees/class-students', { class_ids: classIds });
      setStudents(data.students || []);
    } catch (error) {
      console.error('Error loading students:', error);
      setStudents([]);
    }
    setLoadingStudents(false);
  };

  const toggleSection = (classId: string) => {
    setSelectedSectionIds(prev =>
      prev.includes(classId)
        ? prev.filter(id => id !== classId)
        : [...prev, classId]
    );
  };

  const toggleFeeType = (type: string) => {
    setFeeEntries(prev => {
      const exists = prev.find(e => e.type === type);
      if (exists) return prev.filter(e => e.type !== type);
      return [...prev, { type, amount: '' }];
    });
  };

  const updateFeeAmount = (type: string, amount: string) => {
    setFeeEntries(prev => prev.map(e => e.type === type ? { ...e, amount } : e));
  };

  const addCustomFee = () => {
    const name = customFeeType.trim();
    if (!name) return;
    if (feeEntries.find(e => e.type === name)) {
      toast({ variant: 'destructive', title: 'Duplicate', description: 'This fee type is already added' });
      return;
    }
    setFeeEntries(prev => [...prev, { type: name, amount: customFeeAmount }]);
    setCustomFeeType('');
    setCustomFeeAmount('');
  };

  const removeFeeEntry = (type: string) => {
    setFeeEntries(prev => prev.filter(e => e.type !== type));
  };

  const toggleStudentDiscount = (studentId: string, checked: boolean) => {
    setStudentDiscounts(prev => ({
      ...prev,
      [studentId]: { ...prev[studentId], enabled: checked },
    }));
  };

  const updateStudentDiscount = (studentId: string, amount: string) => {
    setStudentDiscounts(prev => ({
      ...prev,
      [studentId]: { ...prev[studentId], amount },
    }));
  };

  const getDiscountForStudent = (studentId: string, feeAmount: number): number => {
    if (!enableDiscount) return 0;
    if (discountMode === 'flat') {
      const pct = parseFloat(flatDiscount) || 0;
      return Math.round((pct / 100) * feeAmount * 100) / 100;
    }
    const sd = studentDiscounts[studentId];
    if (sd?.enabled) {
      const pct = parseFloat(sd.amount) || 0;
      return Math.round((pct / 100) * feeAmount * 100) / 100;
    }
    return 0;
  };

  const totalAmount = feeEntries.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);

  const handleSubmit = async () => {
    if (feeEntries.length === 0) {
      toast({ variant: 'destructive', title: 'No Fee Types', description: 'Please select at least one fee type' });
      return;
    }
    if (!dueDate || selectedSectionIds.length === 0) {
      toast({ variant: 'destructive', title: 'Validation Error', description: 'Please select class, sections and due date' });
      return;
    }

    for (const entry of feeEntries) {
      const amt = entry.amount ? parseFloat(entry.amount) : 0;
      if (entry.amount && (isNaN(amt) || amt < 0)) {
        toast({ variant: 'destructive', title: 'Invalid Amount', description: `Invalid amount for ${entry.type}` });
        return;
      }
    }

    setLoading(true);
    try {
      let studentIds: string[] = [];

      if (assignMode === 'student') {
        if (!selectedStudentId) {
          toast({ variant: 'destructive', title: 'Error', description: 'Please select a student' });
          setLoading(false);
          return;
        }
        studentIds = [selectedStudentId];
      } else {
        const classStudentsRes = await apiClient.post<{ students: StudentInfo[] }>('/fees/class-students', { class_ids: selectedSectionIds });
        const classStudents = classStudentsRes.students || [];

        if (!classStudents || classStudents.length === 0) {
          toast({ variant: 'destructive', title: 'No Students', description: 'No active students found in selected sections' });
          setLoading(false);
          return;
        }
        studentIds = classStudents.map(s => s.id);
      }

      const dueDateStr = format(dueDate, 'yyyy-MM-dd');
      const reminderDaysBefore = enableReminder ? parseInt(reminderDays) || 3 : 0;

      const feeRecords = studentIds.flatMap(sid =>
        feeEntries.map(entry => {
          const feeAmount = parseFloat(entry.amount) || 0;
          return {
            student_id: sid,
            fee_type: entry.type,
            amount: feeAmount,
            discount: getDiscountForStudent(sid, feeAmount),
            due_date: dueDateStr,
            reminder_days_before: reminderDaysBefore,
          };
        })
      );

      await apiClient.post('/fees/bulk-create', { records: feeRecords });

      toast({
        title: 'Fees Created',
        description: `${feeEntries.length} fee type(s) assigned to ${studentIds.length} student(s)`,
      });

      onOpenChange(false);
      onSuccess();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    } finally {
      setLoading(false);
    }
  };

  const selectedSectionsLabel = availableSections
    .filter(c => selectedSectionIds.includes(c.id))
    .map(c => c.section || 'No section')
    .join(', ');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">Create Fee</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Assign Mode */}
          <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/50">
            <Button
              variant={assignMode === 'class' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => { setAssignMode('class'); setSelectedStudentId(''); }}
              className="flex items-center gap-1"
            >
              <Users className="h-4 w-4" /> Entire Class
            </Button>
            <Button
              variant={assignMode === 'student' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setAssignMode('student')}
              className="flex items-center gap-1"
            >
              <User className="h-4 w-4" /> Individual Student
            </Button>
          </div>

          {/* Class Name Selector */}
          <div className="space-y-1.5">
            <Label>Class *</Label>
            <Select value={selectedClassName} onValueChange={setSelectedClassName}>
              <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
              <SelectContent>
                {classNames.map(name => (
                  <SelectItem key={name} value={name}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Section Multi-Select */}
          {selectedClassName && availableSections.length > 0 && (
            <div className="space-y-1.5">
              <Label>Sections {availableSections.some(c => c.section) ? <span className="text-muted-foreground text-xs">(auto-selected all)</span> : <span className="text-muted-foreground text-xs">(no sections)</span>}</Label>
              {availableSections.some(c => c.section) ? (
                <>
                  <div className="flex flex-wrap gap-2">
                    {availableSections.map(c => (
                      <Button
                        key={c.id}
                        type="button"
                        variant={selectedSectionIds.includes(c.id) ? 'default' : 'outline'}
                        size="sm"
                        className="min-w-[48px]"
                        onClick={() => toggleSection(c.id)}
                      >
                        {c.section}
                      </Button>
                    ))}
                  </div>
                  {selectedSectionIds.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      Selected: {selectedSectionsLabel} ({students.length} students)
                    </p>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Class selected ({students.length} students)
                </p>
              )}
            </div>
          )}

          {/* Student (individual mode) */}
          {assignMode === 'student' && selectedSectionIds.length > 0 && (
            <div className="space-y-1.5">
              <Label>Student *</Label>
              {loadingStudents ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading students...
                </div>
              ) : (
                <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
                  <SelectTrigger><SelectValue placeholder="Select student" /></SelectTrigger>
                  <SelectContent>
                    {students.map(s => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.full_name} ({s.admission_number})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          {/* Fee Type Buttons */}
          <div className="space-y-1.5">
            <Label>Select Fee Types * <span className="text-muted-foreground text-xs">(click to add)</span></Label>
            <div className="grid grid-cols-3 gap-2">
              {FEE_TYPES.map(t => (
                <Button
                  key={t}
                  type="button"
                  variant={feeEntries.some(e => e.type === t) ? 'default' : 'outline'}
                  size="sm"
                  className="text-xs"
                  onClick={() => toggleFeeType(t)}
                >
                  {t}
                </Button>
              ))}
            </div>
          </div>

          {/* Custom Fee Type */}
          <div className="space-y-1.5">
            <Label>Add Custom Fee Type</Label>
            <div className="flex gap-2">
              <Input
                placeholder="Custom name"
                value={customFeeType}
                onChange={(e) => setCustomFeeType(e.target.value)}
                maxLength={50}
                className="flex-1"
              />
              <Input
                type="number"
                placeholder="₹ Amount"
                value={customFeeAmount}
                onChange={(e) => setCustomFeeAmount(e.target.value)}
                min="0"
                className="w-28"
              />
              <Button type="button" size="sm" onClick={addCustomFee} disabled={!customFeeType.trim()}>
                Add
              </Button>
            </div>
          </div>

          {/* Selected Fee Entries with Individual Amounts */}
          {feeEntries.length > 0 && (
            <div className="space-y-2">
              <Label>Fee Amounts <span className="text-muted-foreground text-xs">(optional per type)</span></Label>
              {feeEntries.map(entry => (
                <div key={entry.type} className="flex items-center gap-2 p-2 rounded-md bg-muted/30 border">
                  <span className="text-sm font-medium flex-1 truncate">{entry.type}</span>
                  <Input
                    type="number"
                    placeholder="₹ Amount"
                    value={entry.amount}
                    onChange={(e) => updateFeeAmount(entry.type, e.target.value)}
                    min="0"
                    className="w-28 h-8 text-sm"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                    onClick={() => removeFeeEntry(entry.type)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              {totalAmount > 0 && (
                <div className="text-sm font-medium text-right text-primary">
                  Total: ₹{totalAmount.toLocaleString()}
                </div>
              )}
            </div>
          )}

          {/* Discount Section */}
          {selectedSectionIds.length > 0 && feeEntries.length > 0 && (
            <div className="p-3 rounded-lg bg-muted/50 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Percent className="h-4 w-4 text-primary" />
                  <Label className="cursor-pointer">Enable Discount</Label>
                </div>
                <Switch checked={enableDiscount} onCheckedChange={setEnableDiscount} />
              </div>

              {enableDiscount && (
                <div className="space-y-3">
                  {/* Discount mode toggle */}
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant={discountMode === 'flat' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setDiscountMode('flat')}
                    >
                      Same for all
                    </Button>
                    <Button
                      type="button"
                      variant={discountMode === 'per-student' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setDiscountMode('per-student')}
                    >
                      Per student
                    </Button>
                  </div>

                  {discountMode === 'flat' && (
                    <div className="flex items-center gap-2">
                      <Label className="text-sm whitespace-nowrap">Discount %</Label>
                      <Input
                        type="number"
                        placeholder="0"
                        value={flatDiscount}
                        onChange={(e) => setFlatDiscount(e.target.value)}
                        min="0"
                        max="100"
                        className="w-32"
                      />
                      {parseFloat(flatDiscount) > 0 && totalAmount > 0 && (
                        <span className="text-xs text-muted-foreground">
                          = ₹{Math.round((parseFloat(flatDiscount) / 100) * totalAmount).toLocaleString()} off
                        </span>
                      )}
                    </div>
                  )}

                  {discountMode === 'per-student' && (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {loadingStudents ? (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                          <Loader2 className="h-4 w-4 animate-spin" /> Loading students...
                        </div>
                      ) : students.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No students in selected sections</p>
                      ) : (
                        students.map(s => {
                          const sd = studentDiscounts[s.id] || { enabled: false, amount: '' };
                          return (
                            <div key={s.id} className="flex items-center gap-2 p-2 rounded-md bg-background border">
                              <Checkbox
                                checked={sd.enabled}
                                onCheckedChange={(checked) => toggleStudentDiscount(s.id, !!checked)}
                              />
                              <span className="text-sm flex-1 truncate">{s.full_name}</span>
                              {sd.enabled && (
                                <div className="flex items-center gap-1">
                                  <Input
                                    type="number"
                                    placeholder="% Discount"
                                    value={sd.amount}
                                    onChange={(e) => updateStudentDiscount(s.id, e.target.value)}
                                    min="0"
                                    max="100"
                                    className="w-24 h-8 text-sm"
                                  />
                                  <span className="text-xs text-muted-foreground">%</span>
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Due Date */}
          <div className="space-y-1.5">
            <Label>Due Date *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn("w-full justify-start text-left font-normal", !dueDate && "text-muted-foreground")}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dueDate ? format(dueDate, 'PPP') : 'Pick a due date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dueDate}
                  onSelect={setDueDate}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Reminder */}
          <div className="p-3 rounded-lg bg-muted/50 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-primary" />
                <Label className="cursor-pointer">Send reminder to parents</Label>
              </div>
              <Switch checked={enableReminder} onCheckedChange={setEnableReminder} />
            </div>
            {enableReminder && (
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={reminderDays}
                  onChange={(e) => setReminderDays(e.target.value)}
                  min="1"
                  max="30"
                  className="w-20"
                />
                <span className="text-sm text-muted-foreground">days before due date</span>
              </div>
            )}
          </div>

          {/* Summary */}
          {selectedSectionIds.length > 0 && feeEntries.length > 0 && (
            <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 text-sm space-y-1">
              <p className="font-medium">Summary:</p>
              <p className="text-muted-foreground">
                {feeEntries.length} fee type(s){totalAmount > 0 ? ` totalling ₹${totalAmount.toLocaleString()}` : ''} →{' '}
                {assignMode === 'class'
                  ? `all students in ${selectedClassName}${selectedSectionsLabel && availableSections.some(c => c.section) ? ` (${selectedSectionsLabel})` : ''}`
                  : students.find(s => s.id === selectedStudentId)?.full_name || 'selected student'
                }
              </p>
              <p className="text-xs text-muted-foreground">
                {feeEntries.map(e => `${e.type}${e.amount ? `: ₹${parseFloat(e.amount).toLocaleString()}` : ''}`).join(' • ')}
              </p>
              {enableDiscount && discountMode === 'flat' && parseFloat(flatDiscount) > 0 && (
                <p className="text-xs text-success">💰 Discount: {parseFloat(flatDiscount)}% {totalAmount > 0 ? `(₹${Math.round((parseFloat(flatDiscount) / 100) * totalAmount).toLocaleString()} per fee type)` : ''}</p>
              )}
              {enableDiscount && discountMode === 'per-student' && (
                <p className="text-xs text-success">
                  💰 Per-student discounts: {Object.values(studentDiscounts).filter(d => d.enabled && parseFloat(d.amount) > 0).length} student(s)
                </p>
              )}
              {enableReminder && (
                <p className="text-xs text-muted-foreground">📢 Reminder {reminderDays} days before due date</p>
              )}
            </div>
          )}

          <Button onClick={handleSubmit} disabled={loading} className="w-full">
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CreditCard className="h-4 w-4 mr-2" />}
            {assignMode === 'class' ? 'Assign to Entire Class' : 'Assign to Student'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
