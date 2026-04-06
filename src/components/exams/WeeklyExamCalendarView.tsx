import { useEffect, useState, useMemo } from 'react';
import { apiClient } from '@/lib/apiClient';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, Calendar as CalendarIcon, Clock, BookOpen, Tag, AlignLeft, ChevronLeft, ChevronRight, CheckCircle2, Play, ArrowRight } from 'lucide-react';
import { format, isSameDay, startOfMonth, endOfMonth, addMonths, subMonths } from 'date-fns';
import { cn } from '@/lib/utils';

const getExamDateStatus = (examDate: string): { label: string; color: string } => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const date = new Date(examDate);
  date.setHours(0, 0, 0, 0);
  if (date > today) return { label: 'Upcoming', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' };
  if (date.getTime() === today.getTime()) return { label: 'Running', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300' };
  return { label: 'Completed', color: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' };
};

interface WeeklyExam {
  id: string;
  exam_title: string;
  exam_date: string;
  exam_time: string;
  duration_minutes: number;
  total_marks: number;
  negative_marking: boolean;
  negative_marks_value: number;
  status: string;
  syllabus_type: string;
  week_number: number | null;
  class_id: string;
  subject_id: string | null;
  description: string | null;
  exam_type_label: string | null;
  classes?: { name: string; section: string } | null;
  subjects?: { name: string } | null;
}

interface SyllabusItem {
  id: string;
  chapter_name: string;
  topic_name: string;
  subjects?: { name: string } | null;
}

interface ExamSyllabusLink {
  exam_id: string;
  syllabus_id: string;
}

interface WeeklyDataResponse {
  exams: WeeklyExam[];
  syllabus: SyllabusItem[];
  links: ExamSyllabusLink[];
}

interface WeeklyExamCalendarViewProps {
  filterClassIds?: string[];
}

export default function WeeklyExamCalendarView({ filterClassIds }: WeeklyExamCalendarViewProps) {
  const [exams, setExams] = useState<WeeklyExam[]>([]);
  const [syllabusLinks, setSyllabusLinks] = useState<ExamSyllabusLink[]>([]);
  const [syllabus, setSyllabus] = useState<SyllabusItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [detailExam, setDetailExam] = useState<WeeklyExam | null>(null);

  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const data = await apiClient.get<WeeklyDataResponse>('/weekly-exams/data');
      setExams(data.exams || []);
      setSyllabusLinks(data.links || []);
      setSyllabus(data.syllabus || []);
    } finally {
      setLoading(false);
    }
  }

  const filteredExams = useMemo(() => {
    if (!filterClassIds || filterClassIds.length === 0) return exams;
    return exams.filter(e => filterClassIds.includes(e.class_id));
  }, [exams, filterClassIds]);

  const examDates = useMemo(() => {
    const dates = new Map<string, WeeklyExam[]>();
    filteredExams.forEach(e => {
      const key = e.exam_date;
      if (!dates.has(key)) dates.set(key, []);
      dates.get(key)!.push(e);
    });
    return dates;
  }, [filteredExams]);

  const getLinkedSyllabus = (examId: string) => {
    const ids = syllabusLinks.filter(l => l.exam_id === examId).map(l => l.syllabus_id);
    return syllabus.filter(s => ids.includes(s.id));
  };

  const selectedDateExams = useMemo(() => {
    if (!selectedDate) return [];
    const key = format(selectedDate, 'yyyy-MM-dd');
    return examDates.get(key) || [];
  }, [selectedDate, examDates]);

  // Upcoming exams (next 5)
  const upcomingExams = useMemo(() => {
    const today = format(new Date(), 'yyyy-MM-dd');
    return filteredExams.filter(e => e.exam_date >= today).slice(0, 5);
  }, [filteredExams]);

  const typeColors: Record<string, string> = {
    JEE: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    NEET: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    BITSAT: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
    CET: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
    General: 'bg-muted text-muted-foreground',
  };

  const statusColors: Record<string, string> = {
    scheduled: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
    live: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
    completed: 'bg-muted text-muted-foreground',
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  const ExamDetailCard = ({ exam }: { exam: WeeklyExam }) => {
    const linked = getLinkedSyllabus(exam.id);
    return (
      <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setDetailExam(exam)}>
        <CardContent className="p-3 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-1 flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h4 className="font-semibold text-sm">{exam.exam_title}</h4>
                {(() => {
                  const ds = getExamDateStatus(exam.exam_date);
                  return <Badge className={`text-[10px] px-1.5 py-0 ${ds.color}`}>{ds.label}</Badge>;
                })()}
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                {exam.exam_type_label && exam.exam_type_label !== 'General' && (
                  <Badge className={`text-[10px] px-1.5 py-0 ${typeColors[exam.exam_type_label] || typeColors['General']}`}>
                    {exam.exam_type_label}
                  </Badge>
                )}
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                  {exam.classes ? (exam.classes.section ? `${exam.classes.name} - ${exam.classes.section}` : exam.classes.name) : '—'}
                </Badge>
                {exam.subjects && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{exam.subjects.name}</Badge>
                )}
              </div>
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground flex-wrap">
                <span className="flex items-center gap-0.5"><Clock className="h-3 w-3" />{exam.exam_time}</span>
                <span>{exam.duration_minutes}min</span>
                <span>Marks: {exam.total_marks}</span>
                {exam.negative_marking && <span className="text-destructive">-{exam.negative_marks_value}</span>}
              </div>
            </div>
          </div>

          {linked.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {linked.slice(0, 3).map(s => (
                <Badge key={s.id} variant="outline" className="text-[10px] px-1.5 py-0 bg-background">
                  {s.subjects?.name}: {s.topic_name}
                </Badge>
              ))}
              {linked.length > 3 && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">+{linked.length - 3} more</Badge>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  // Custom day render for calendar to show dots on exam dates
  const hasExam = (date: Date) => {
    const key = format(date, 'yyyy-MM-dd');
    return examDates.has(key);
  };

  return (
    <div className="flex flex-col md:grid md:grid-cols-[auto_1fr] gap-3 sm:gap-4">
      {/* Calendar */}
      <Card className="w-fit mx-auto md:mx-0">
        <CardContent className="p-1.5 sm:p-3 flex flex-col items-center">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={setSelectedDate}
            month={currentMonth}
            onMonthChange={setCurrentMonth}
            className={cn("p-0 pointer-events-auto [&_.rdp-cell]:h-8 [&_.rdp-cell]:w-8 sm:[&_.rdp-cell]:h-9 sm:[&_.rdp-cell]:w-9 [&_.rdp-day]:h-8 [&_.rdp-day]:w-8 sm:[&_.rdp-day]:h-9 sm:[&_.rdp-day]:w-9 [&_.rdp-head_cell]:w-8 sm:[&_.rdp-head_cell]:w-9")}
            modifiers={{ hasExam: (date) => hasExam(date) }}
            modifiersClassNames={{ hasExam: 'bg-primary/15 font-bold text-primary rounded-md' }}
          />
          <div className="flex items-center gap-2 mt-1.5 sm:mt-2 text-[10px] sm:text-xs text-muted-foreground self-start px-1">
            <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded bg-primary/15" />
            <span>Exam scheduled</span>
          </div>
        </CardContent>
      </Card>

      {/* Exam List */}
      <div className="space-y-2 min-w-0">
        {selectedDate && (
          <div className="space-y-2">
            <h3 className="text-xs sm:text-sm font-semibold flex items-center gap-1.5">
              <CalendarIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary" />
              {format(selectedDate, 'dd MMM yyyy')} — {selectedDateExams.length} exam{selectedDateExams.length !== 1 ? 's' : ''}
            </h3>
            {selectedDateExams.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">No exams on this date</p>
            ) : (
              <div className="space-y-2">
                {selectedDateExams.map(exam => <ExamDetailCard key={exam.id} exam={exam} />)}
              </div>
            )}
          </div>
        )}

        {/* Upcoming exams if no date selected */}
        {!selectedDate && upcomingExams.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-xs sm:text-sm font-semibold flex items-center gap-1.5">
              <CalendarIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary" />
              Upcoming Exams
            </h3>
            <div className="space-y-2">
              {upcomingExams.map(exam => <ExamDetailCard key={exam.id} exam={exam} />)}
            </div>
          </div>
        )}

        {!selectedDate && upcomingExams.length === 0 && (
          <Card><CardContent className="py-8 text-center text-muted-foreground">
            <BookOpen className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">No upcoming weekly exams</p>
          </CardContent></Card>
        )}
      </div>

      {/* Exam Detail Dialog */}
      <Dialog open={!!detailExam} onOpenChange={v => { if (!v) setDetailExam(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">{detailExam?.exam_title}</DialogTitle>
          </DialogHeader>
          {detailExam && (
            <div className="space-y-4">
              {/* Badges */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {(() => {
                  const ds = getExamDateStatus(detailExam.exam_date);
                  return <Badge className={`text-xs ${ds.color}`}>{ds.label}</Badge>;
                })()}
                {detailExam.exam_type_label && detailExam.exam_type_label !== 'General' && (
                  <Badge className={`text-xs ${typeColors[detailExam.exam_type_label] || ''}`}>
                    <Tag className="h-3 w-3 mr-0.5" />{detailExam.exam_type_label}
                  </Badge>
                )}
                <Badge variant="outline" className="text-xs">
                  {detailExam.classes ? (detailExam.classes.section ? `${detailExam.classes.name} - ${detailExam.classes.section}` : detailExam.classes.name) : '—'}
                </Badge>
                {detailExam.subjects && (
                  <Badge variant="secondary" className="text-xs">{detailExam.subjects.name}</Badge>
                )}
              </div>

              {/* Details Grid */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="space-y-0.5">
                  <p className="text-xs text-muted-foreground">Date</p>
                  <p className="font-medium flex items-center gap-1">
                    <CalendarIcon className="h-3.5 w-3.5" />
                    {new Date(detailExam.exam_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </p>
                </div>
                <div className="space-y-0.5">
                  <p className="text-xs text-muted-foreground">Time</p>
                  <p className="font-medium flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{detailExam.exam_time}</p>
                </div>
                <div className="space-y-0.5">
                  <p className="text-xs text-muted-foreground">Duration</p>
                  <p className="font-medium">{detailExam.duration_minutes} minutes</p>
                </div>
                <div className="space-y-0.5">
                  <p className="text-xs text-muted-foreground">Total Marks</p>
                  <p className="font-medium">{detailExam.total_marks}</p>
                </div>
                {detailExam.negative_marking && (
                  <div className="space-y-0.5 col-span-2">
                    <p className="text-xs text-muted-foreground">Negative Marking</p>
                    <p className="font-medium text-destructive">-{detailExam.negative_marks_value} per wrong answer</p>
                  </div>
                )}
              </div>

              {/* Description */}
              {detailExam.description && (
                <div className="bg-muted/40 rounded-lg p-3">
                  <p className="text-xs font-semibold text-muted-foreground mb-1 flex items-center gap-1">
                    <AlignLeft className="h-3 w-3" />Instructions
                  </p>
                  <p className="text-sm">{detailExam.description}</p>
                </div>
              )}

              {/* Syllabus Topics */}
              {(() => {
                const linked = getLinkedSyllabus(detailExam.id);
                if (linked.length === 0) return null;
                return (
                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                      <BookOpen className="h-3 w-3" />Syllabus Topics
                    </p>
                    <div className="space-y-1">
                      {linked.map(s => (
                        <div key={s.id} className="flex items-center gap-2 p-2 rounded-md border text-sm">
                          <Badge variant="secondary" className="text-[10px] shrink-0">{s.subjects?.name}</Badge>
                          <div className="min-w-0">
                            <p className="font-medium text-xs">{s.chapter_name}</p>
                            <p className="text-xs text-muted-foreground truncate">{s.topic_name}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
