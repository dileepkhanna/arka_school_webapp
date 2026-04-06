import { useState, useEffect, useMemo } from 'react';
import { apiClient } from '@/lib/apiClient';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, Clock, FileText, Loader2, CheckCircle2, Play, ArrowRight } from 'lucide-react';

const getExamStatus = (examDate: string | null): { label: string; color: string; icon: React.ReactNode } => {
  if (!examDate) return { label: 'No Date', color: 'bg-muted text-muted-foreground', icon: null };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const date = new Date(examDate);
  date.setHours(0, 0, 0, 0);
  if (date > today) return { label: 'Upcoming', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300', icon: <ArrowRight className="h-3 w-3" /> };
  if (date.getTime() === today.getTime()) return { label: 'Running', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300', icon: <Play className="h-3 w-3" /> };
  return { label: 'Completed', color: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300', icon: <CheckCircle2 className="h-3 w-3" /> };
};

const getGroupStatus = (exams: Exam[]): { label: string; color: string; icon: React.ReactNode } => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dates = exams.filter(e => e.exam_date).map(e => new Date(e.exam_date!));
  if (dates.length === 0) return { label: 'No Date', color: 'bg-muted text-muted-foreground', icon: null };
  const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
  const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));
  minDate.setHours(0, 0, 0, 0);
  maxDate.setHours(0, 0, 0, 0);
  if (today > maxDate) return { label: 'Completed', color: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300', icon: <CheckCircle2 className="h-3 w-3" /> };
  if (today < minDate) return { label: 'Upcoming', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300', icon: <ArrowRight className="h-3 w-3" /> };
  return { label: 'Running', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300', icon: <Play className="h-3 w-3" /> };
};

interface Exam {
  id: string;
  name: string;
  max_marks: number | null;
  exam_date: string | null;
  exam_time: string | null;
  class_id: string | null;
  subject_id: string | null;
  classes?: { name: string; section: string } | null;
  subjects?: { name: string } | null;
}

interface ExamScheduleViewProps {
  /** Optional: filter exams to specific class IDs (e.g. parent's child class) */
  filterClassIds?: string[];
}

interface ExamsDataResponse {
  exams: Exam[];
}

export default function ExamScheduleView({ filterClassIds }: ExamScheduleViewProps) {
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedExamName, setSelectedExamName] = useState('all');

  useEffect(() => {
    async function fetchExams() {
      setLoading(true);
      try {
        const data = await apiClient.get<ExamsDataResponse>('/teacher/exams-data');
        let filtered = data.exams || [];
        if (filterClassIds && filterClassIds.length > 0) {
          filtered = filtered.filter(e => e.class_id && filterClassIds.includes(e.class_id));
        }
        setExams(filtered);
      } catch {
        setExams([]);
      }
      setLoading(false);
    }
    fetchExams();
  }, [filterClassIds]);

  const examNames = useMemo(
    () => [...new Set(exams.map(e => e.name))],
    [exams]
  );

  const filteredExams = useMemo(() => {
    if (selectedExamName === 'all') return exams;
    return exams.filter(e => e.name === selectedExamName);
  }, [exams, selectedExamName]);

  const groupedExams = useMemo(() => {
    return filteredExams.reduce((acc, exam) => {
      if (!acc[exam.name]) acc[exam.name] = [];
      acc[exam.name].push(exam);
      return acc;
    }, {} as Record<string, Exam[]>);
  }, [filteredExams]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (exams.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p className="font-medium">No exam schedule available</p>
          <p className="text-sm">Exam schedules will appear here once created by admin.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3 sm:space-y-4">
      {examNames.length > 1 && (
        <div className="flex justify-end">
          <Select value={selectedExamName} onValueChange={setSelectedExamName}>
            <SelectTrigger className="w-[150px] sm:w-[200px] h-7 sm:h-9 text-[10px] sm:text-sm">
              <SelectValue placeholder="Filter by exam" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Exams</SelectItem>
              {examNames.map(name => (
                <SelectItem key={name} value={name}>{name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {Object.entries(groupedExams).map(([examName, examList]) => (
        <Card key={examName} className="card-elevated overflow-hidden">
          <CardHeader className="pb-2 sm:pb-3 bg-muted/30 px-3 sm:px-6 py-2.5 sm:py-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-1.5 sm:p-2 rounded-lg bg-primary/10">
                <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <CardTitle className="font-display text-sm sm:text-lg truncate">{examName}</CardTitle>
                <CardDescription className="text-[10px] sm:text-sm">
                  {examList.length} subject(s) • {new Set(examList.map(e => e.class_id)).size} class(es)
                </CardDescription>
              </div>
              {(() => {
                const status = getGroupStatus(examList);
                return (
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] sm:text-xs font-semibold ${status.color}`}>
                    {status.icon}{status.label}
                  </span>
                );
              })()}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {examList.map(exam => (
                <div key={exam.id} className="px-3 sm:px-4 py-2.5 sm:py-3 space-y-1.5">
                  <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                    <Badge variant="outline" className="text-[10px] sm:text-xs px-1.5 py-0">
                      {exam.classes ? (exam.classes.section ? `${exam.classes.name} - ${exam.classes.section.toUpperCase()}` : exam.classes.name) : 'All'}
                    </Badge>
                    <Badge variant="secondary" className="text-[10px] sm:text-xs px-1.5 py-0 capitalize">
                      {exam.subjects?.name || 'All Subjects'}
                    </Badge>
                    {(() => {
                      const s = getExamStatus(exam.exam_date);
                      return (
                        <span className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0 text-[10px] sm:text-xs font-medium ${s.color}`}>
                          {s.icon}{s.label}
                        </span>
                      );
                    })()}
                    <Badge variant="outline" className="text-[10px] sm:text-xs px-1.5 py-0 ml-auto font-semibold">
                      Max: {exam.max_marks}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 sm:gap-3 flex-wrap text-[10px] sm:text-xs text-muted-foreground">
                    {exam.exam_date && (
                      <span className="flex items-center gap-0.5 sm:gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(exam.exam_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </span>
                    )}
                    {exam.exam_time && (
                      <span className="flex items-center gap-0.5 sm:gap-1">
                        <Clock className="h-3 w-3" />
                        {exam.exam_time}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
