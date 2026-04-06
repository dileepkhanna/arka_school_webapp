import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Save, CheckCircle2, FlaskConical, BookOpen, Users, Calendar, Clock } from 'lucide-react';
import { apiClient } from '@/lib/apiClient';
import { toast } from 'sonner';

interface WeeklyExam {
  id: string;
  exam_title: string;
  exam_date: string;
  exam_time: string;
  total_marks: number;
  class_id: string;
  subject_id: string | null;
  syllabus_type: string;
  status: string;
  exam_type_label: string | null;
  classes?: { name: string; section: string } | null;
  subjects?: { name: string } | null;
}

interface Student {
  id: string;
  full_name: string;
  admission_number: string;
  photo_url: string | null;
}

interface ClassOption {
  id: string;
  name: string;
  section: string;
}

interface WeeklyDataResponse {
  exams: WeeklyExam[];
  classes: ClassOption[];
}

interface WeeklyMarksDataResponse {
  students: Student[];
  marks: { student_id: string; obtained_marks: number | null; percentage: number | null }[];
}

export default function WeeklyExamMarksEntry() {
  const [exams, setExams] = useState<WeeklyExam[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadingStudents, setLoadingStudents] = useState(false);

  const [selectedClassId, setSelectedClassId] = useState('all');
  const [examTypeFilter, setExamTypeFilter] = useState<'all' | 'competitive' | 'general'>('all');
  const [examTypeLabelFilter, setExamTypeLabelFilter] = useState('all');
  const [selectedExam, setSelectedExam] = useState<WeeklyExam | null>(null);
  const [marks, setMarks] = useState<Record<string, { obtained: string; percentage: string }>>({});

  useEffect(() => {
    fetchExamsAndClasses();
  }, []);

  const fetchExamsAndClasses = async () => {
    setLoading(true);
    try {
      const data = await apiClient.get<WeeklyDataResponse>('/weekly-exams/data');
      setExams(data.exams || []);
      setClasses(data.classes || []);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load exams');
    } finally {
      setLoading(false);
    }
  };

  const filteredExams = useMemo(() => {
    return exams.filter(e => {
      if (selectedClassId !== 'all' && e.class_id !== selectedClassId) return false;
      if (examTypeFilter !== 'all' && e.syllabus_type !== examTypeFilter) return false;
      if (examTypeLabelFilter !== 'all' && e.exam_type_label !== examTypeLabelFilter) return false;
      return true;
    });
  }, [exams, selectedClassId, examTypeFilter, examTypeLabelFilter]);

  // Get unique exam type labels
  const examTypeLabels = useMemo(() => 
    [...new Set(exams.map(e => e.exam_type_label).filter(Boolean))] as string[]
  , [exams]);

  const isFilterActive = selectedClassId !== 'all' || examTypeFilter !== 'all' || examTypeLabelFilter !== 'all';

  const loadStudentsAndMarks = async (exam: WeeklyExam) => {
    setLoadingStudents(true);
    setSelectedExam(exam);

    try {
      const data = await apiClient.get<WeeklyMarksDataResponse>(`/weekly-exams/${exam.id}/marks-data`);
      const studentData = data.students || [];

      if (studentData) {
        setStudents(studentData);

        const marksMap: Record<string, { obtained: string; percentage: string }> = {};
        if (data.marks) {
          data.marks.forEach(r => {
            marksMap[r.student_id] = {
              obtained: r.obtained_marks != null ? r.obtained_marks.toString() : '',
              percentage: r.percentage != null ? r.percentage.toString() : '',
            };
          });
        }
        studentData.forEach(s => {
          if (!marksMap[s.id]) {
            marksMap[s.id] = { obtained: '', percentage: '' };
          }
        });
        setMarks(marksMap);
      }
    } catch (error) {
      console.error('Error loading students:', error);
      toast.error('Failed to load students');
    } finally {
      setLoadingStudents(false);
    }
  };

  const updateMark = (studentId: string, value: string) => {
    const numVal = parseFloat(value);
    const totalMarks = selectedExam?.total_marks || 100;
    const pct = !isNaN(numVal) ? ((numVal / totalMarks) * 100).toFixed(1) : '';
    setMarks(prev => ({
      ...prev,
      [studentId]: { obtained: value, percentage: pct },
    }));
  };

  const saveMarks = async () => {
    if (!selectedExam) return;
    setSaving(true);

    try {
      const records = students
        .filter(s => marks[s.id]?.obtained)
        .map(student => ({
          student_id: student.id,
          obtained_marks: parseFloat(marks[student.id].obtained) || 0,
          total_marks: selectedExam.total_marks,
          percentage: parseFloat(marks[student.id].percentage) || 0,
        }));

      await apiClient.put(`/weekly-exams/${selectedExam.id}/marks`, { records });

      toast.success(`Saved marks for ${records.length} students`);
    } catch (error: any) {
      console.error('Error saving marks:', error);
      toast.error(error.message || 'Failed to save marks');
    } finally {
      setSaving(false);
    }
  };

  const getFilledCount = () => Object.values(marks).filter(m => m.obtained).length;

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FlaskConical className="h-4 w-4 text-primary" />
            Weekly / Competitive Exam Marks Entry
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <Select value={selectedClassId} onValueChange={setSelectedClassId}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Filter by class" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Classes</SelectItem>
                {classes.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.section ? `${c.name} - ${c.section.toUpperCase()}` : c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={examTypeFilter} onValueChange={(v) => setExamTypeFilter(v as any)}>
              <SelectTrigger className="w-full sm:w-[160px]">
                <SelectValue placeholder="Exam type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="competitive">Competitive</SelectItem>
                <SelectItem value="general">General</SelectItem>
              </SelectContent>
            </Select>

            {examTypeLabels.length > 0 && (
              <Select value={examTypeLabelFilter} onValueChange={setExamTypeLabelFilter}>
                <SelectTrigger className="w-full sm:w-[160px]">
                  <SelectValue placeholder="Exam Label" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Labels</SelectItem>
                  {examTypeLabels.map(label => (
                    <SelectItem key={label} value={label}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {!isFilterActive ? (
            <div className="text-center py-8">
              <FlaskConical className="h-10 w-10 mx-auto text-muted-foreground mb-2 opacity-50" />
              <p className="text-muted-foreground text-sm font-medium">Select filters to view exams</p>
              <p className="text-xs text-muted-foreground mt-1">Choose a class or exam type to find exams.</p>
            </div>
          ) : filteredExams.length === 0 ? (
            <p className="text-muted-foreground text-sm">No weekly exams found for the selected filters.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {filteredExams.map(exam => (
                <Button
                  key={exam.id}
                  variant={selectedExam?.id === exam.id ? 'default' : 'outline'}
                  className="h-auto py-3 flex flex-col items-start text-left gap-1"
                  onClick={() => loadStudentsAndMarks(exam)}
                >
                  <span className="font-medium text-xs truncate w-full">{exam.exam_title}</span>
                  <div className="flex items-center gap-1.5 w-full">
                    <Badge variant="secondary" className="text-[10px]">
                      {exam.classes?.section ? `${exam.classes.name} - ${exam.classes.section.toUpperCase()}` : exam.classes?.name}
                    </Badge>
                    {exam.exam_type_label && (
                      <Badge variant="outline" className="text-[10px]">{exam.exam_type_label}</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-[10px] opacity-70">
                    <span className="flex items-center gap-0.5"><Calendar className="h-2.5 w-2.5" />{new Date(exam.exam_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</span>
                    <span>Max: {exam.total_marks}</span>
                    <span className="capitalize">{exam.syllabus_type}</span>
                  </div>
                </Button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Marks Entry Table */}
      {loadingStudents && (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {selectedExam && !loadingStudents && (
        <Card>
          <CardHeader className="pb-3 px-3 sm:px-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <CardTitle className="text-sm sm:text-base flex flex-wrap items-center gap-1.5">
                <Users className="h-4 w-4 text-primary flex-shrink-0" />
                <span className="truncate">{selectedExam.exam_title}</span>
                <Badge variant="secondary" className="text-xs">
                  {selectedExam.classes?.section ? `${selectedExam.classes.name} - ${selectedExam.classes.section.toUpperCase()}` : selectedExam.classes?.name}
                </Badge>
                {selectedExam.subjects && (
                  <Badge variant="outline" className="capitalize text-xs">{selectedExam.subjects.name}</Badge>
                )}
              </CardTitle>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <Badge variant="outline" className="text-xs">
                  {getFilledCount()}/{students.length} filled
                </Badge>
                <Badge variant="outline" className="text-xs">
                  Max: {selectedExam.total_marks}
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-2 sm:px-6">
            <ScrollArea className="h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[120px] text-xs sm:text-sm">Student</TableHead>
                    <TableHead className="w-[90px] text-xs sm:text-sm">Marks</TableHead>
                    <TableHead className="w-[80px] text-xs sm:text-sm">%</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {students.map(student => (
                    <TableRow key={student.id}>
                      <TableCell className="py-2">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-7 w-7 flex-shrink-0">
                            <AvatarImage src={student.photo_url || ''} />
                            <AvatarFallback className="text-[10px]">
                              {student.full_name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="font-medium text-xs sm:text-sm truncate">{student.full_name}</p>
                            <p className="text-[10px] text-muted-foreground">{student.admission_number}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="py-2">
                        <Input
                          type="number"
                          value={marks[student.id]?.obtained || ''}
                          onChange={(e) => updateMark(student.id, e.target.value)}
                          placeholder="0"
                          max={selectedExam.total_marks}
                          min={0}
                          className="h-8 w-20 text-sm"
                        />
                      </TableCell>
                      <TableCell className="py-2 text-sm font-medium">
                        {marks[student.id]?.percentage ? `${marks[student.id].percentage}%` : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>

            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mt-4 pt-4 border-t">
              <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                Percentage auto-calculates. Results visible to parents immediately.
              </div>
              <Button onClick={saveMarks} disabled={saving} className="w-full sm:w-auto">
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save All Marks
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
