import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, Clock, BookOpen, CheckCircle2, Sparkles } from 'lucide-react';
import { ExamFormData, ClassItem, SubjectItem } from './types';
import { format, eachDayOfInterval, parseISO } from 'date-fns';

interface Props {
  formData: ExamFormData;
  setFormData: React.Dispatch<React.SetStateAction<ExamFormData>>;
  classes: ClassItem[];
  subjects: SubjectItem[];
}

export default function ExamScheduleBuilder({ formData, setFormData, classes, subjects }: Props) {
  // Generate dates between start and end
  const examDates = useMemo(() => {
    if (!formData.startDate || !formData.endDate) return [];
    try {
      return eachDayOfInterval({
        start: parseISO(formData.startDate),
        end: parseISO(formData.endDate)
      });
    } catch {
      return [];
    }
  }, [formData.startDate, formData.endDate]);

  const selectedClassData = useMemo(() =>
    formData.selectedClasses.map(id => classes.find(c => c.id === id)).filter(Boolean) as ClassItem[],
    [formData.selectedClasses, classes]
  );

  // Auto-schedule function
  const autoSchedule = () => {
    const newSchedule: typeof formData.schedule = [];

    // Get all subjects that need to be scheduled
    const classSubjectPairs: { classId: string; subjectId: string; className: string; subjectName: string }[] = [];

    Object.entries(formData.classSubjects).forEach(([classId, subjectIds]) => {
      const cls = classes.find(c => c.id === classId);
      subjectIds.forEach(subjectId => {
        const sub = subjects.find(s => s.id === subjectId);
        if (cls && sub) {
          classSubjectPairs.push({
            classId,
            subjectId,
            className: cls.section ? `${cls.name} - ${cls.section}` : cls.name,
            subjectName: sub.name
          });
        }
      });
    });

    // Get unique subjects to determine how many days we need
    const uniqueSubjectIds = [...new Set(Object.values(formData.classSubjects).flat())];

    // Assign one subject per day per slot
    let dateIndex = 0;
    let slotIndex = 0;

    uniqueSubjectIds.forEach(subjectId => {
      const sub = subjects.find(s => s.id === subjectId);
      if (!sub || dateIndex >= examDates.length) return;

      const slot = formData.slots[slotIndex % formData.slots.length];
      const date = format(examDates[dateIndex], 'yyyy-MM-dd');

      // Add this subject for all classes that have it
      Object.entries(formData.classSubjects).forEach(([classId, subjectIds]) => {
        if (subjectIds.includes(subjectId)) {
          const cls = classes.find(c => c.id === classId);
          if (cls) {
            newSchedule.push({
              date,
              slotId: slot.id,
              classId,
              subjectId,
              className: cls.section ? `${cls.name} - ${cls.section}` : cls.name,
              subjectName: sub.name
            });
          }
        }
      });

      dateIndex++;
    });

    setFormData(prev => ({ ...prev, schedule: newSchedule }));
  };

  // Manual assignment
  const assignSubject = (date: string, slotId: string, classId: string, subjectId: string) => {
    const cls = classes.find(c => c.id === classId);
    const sub = subjects.find(s => s.id === subjectId);

    if (!cls || !sub) return;

    setFormData(prev => {
      // Remove existing entry for this date/slot/class combo
      const filtered = prev.schedule.filter(
        s => !(s.date === date && s.slotId === slotId && s.classId === classId)
      );

      // Add new entry
      return {
        ...prev,
        schedule: [...filtered, {
          date,
          slotId,
          classId,
          subjectId,
          className: cls.section ? `${cls.name} - ${cls.section}` : cls.name,
          subjectName: sub.name
        }]
      };
    });
  };

  const getAssignedSubject = (date: string, slotId: string, classId: string) => {
    return formData.schedule.find(
      s => s.date === date && s.slotId === slotId && s.classId === classId
    );
  };

  const getAvailableSubjects = (classId: string) => {
    return (formData.classSubjects[classId] || [])
      .map(id => subjects.find(s => s.id === id))
      .filter(Boolean) as SubjectItem[];
  };

  return (
    <div className="space-y-5">
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-3">
          <Calendar className="h-6 w-6 text-primary" />
        </div>
        <h3 className="font-semibold text-lg">Exam Schedule Builder</h3>
        <p className="text-sm text-muted-foreground">
          {formData.mode === 'auto' ? 'Auto-generated schedule' : 'Assign subjects to dates and slots'}
        </p>
      </div>

      {formData.mode === 'auto' && (
        <Button onClick={autoSchedule} className="w-full bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-600 hover:to-purple-600">
          <Sparkles className="h-4 w-4 mr-2" />
          Generate Schedule Automatically
        </Button>
      )}

      <ScrollArea className="h-[300px] border rounded-xl">
        <div className="p-4 space-y-4">
          {examDates.map((date, dateIdx) => (
            <Card key={dateIdx} className="overflow-hidden">
              <CardHeader className="py-2 px-4 bg-muted/50">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  {format(date, 'EEEE, dd MMM yyyy')}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3">
                {formData.slots.map((slot) => (
                  <div key={slot.id} className="mb-3 last:mb-0">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                      <Clock className="h-3 w-3" />
                      <span className="font-medium">{slot.label}</span>
                      <span className="font-mono">({slot.startTime} - {slot.endTime})</span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {selectedClassData.map((cls) => {
                        const assigned = getAssignedSubject(format(date, 'yyyy-MM-dd'), slot.id, cls.id);
                        const availableSubjects = getAvailableSubjects(cls.id);

                        return (
                          <div key={cls.id} className="border rounded-lg p-2">
                            <div className="text-xs font-medium text-muted-foreground mb-1">
                              {cls.section ? `${cls.name} - ${cls.section.toUpperCase()}` : cls.name}
                            </div>
                            <Select
                              value={assigned?.subjectId || ''}
                              onValueChange={(val) => assignSubject(format(date, 'yyyy-MM-dd'), slot.id, cls.id, val)}
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue placeholder="Select subject" />
                              </SelectTrigger>
                              <SelectContent>
                                {availableSubjects.map((sub) => (
                                  <SelectItem key={sub.id} value={sub.id} className="capitalize">
                                    {sub.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      </ScrollArea>

      {/* Schedule Summary */}
      {formData.schedule.length > 0 && (
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="py-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">
                {formData.schedule.length} exam entries scheduled
              </span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
