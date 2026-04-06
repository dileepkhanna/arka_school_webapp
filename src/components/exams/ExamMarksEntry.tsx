import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Save, CheckCircle2, BookOpen, Users } from 'lucide-react';
import { apiClient } from '@/lib/apiClient';
import { toast } from 'sonner';

interface Exam {
  id: string;
  name: string;
  max_marks: number;
  class_id: string;
  subject_id: string | null;
  exam_date: string | null;
  classes?: { name: string; section: string };
  subjects?: { name: string };
}

interface Student {
  id: string;
  full_name: string;
  admission_number: string;
  photo_url: string | null;
}

interface Props {
  exams: Exam[];
  onMarksUpdated?: () => void;
}

export default function ExamMarksEntry({ exams, onMarksUpdated }: Props) {
  const [selectedExam, setSelectedExam] = useState<Exam | null>(null);
  const [selectedExamName, setSelectedExamName] = useState<string>('');
  const [students, setStudents] = useState<Student[]>([]);
  const [marks, setMarks] = useState<Record<string, { marks: string; grade: string; remarks: string }>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [selectedClassFilter, setSelectedClassFilter] = useState<string>('all');

  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState<string>('all');

  // Get unique exam names
  const examNames = [...new Set(exams.map(e => e.name))];
  
  // Cascading: classes filtered by selected exam name
  const classOptions = [...new Map(exams
    .filter(e => e.classes)
    .filter(e => !selectedExamName || e.name === selectedExamName)
    .map(e => [e.class_id, { id: e.class_id, name: e.classes!.name, section: e.classes!.section }])
  ).values()];

  // Cascading: subjects filtered by selected exam name + class
  const subjectOptions = [...new Map(exams
    .filter(e => e.subjects)
    .filter(e => !selectedExamName || e.name === selectedExamName)
    .filter(e => selectedClassFilter === 'all' || e.class_id === selectedClassFilter)
    .map(e => [e.subject_id!, { id: e.subject_id!, name: e.subjects!.name }])
  ).values()];

  // Filter exams by selected name, class, and subject
  const filteredExams = exams.filter(e => {
    if (selectedExamName && e.name !== selectedExamName) return false;
    if (selectedClassFilter !== 'all' && e.class_id !== selectedClassFilter) return false;
    if (selectedSubjectFilter !== 'all' && e.subject_id !== selectedSubjectFilter) return false;
    return true;
  });

  const loadStudentsAndMarks = async (exam: Exam) => {
    setLoading(true);
    setSelectedExam(exam);
    
    try {
      const payload = await apiClient.get<{
        students: Student[];
        marks: Array<{ student_id: string; marks_obtained: number | null; grade: string | null; remarks: string | null }>;
      }>(`/exams/${exam.id}/marks-data`);

      const studentData = payload.students || [];
      const marksData = payload.marks || [];

      if (studentData) {
        setStudents(studentData);

        const marksMap: Record<string, { marks: string; grade: string; remarks: string }> = {};
        if (marksData) {
          marksData.forEach(m => {
            marksMap[m.student_id] = {
              marks: m.marks_obtained?.toString() || '',
              grade: m.grade || '',
              remarks: m.remarks || ''
            };
          });
        }
        studentData.forEach(s => {
          if (!marksMap[s.id]) {
            marksMap[s.id] = { marks: '', grade: '', remarks: '' };
          }
        });
        setMarks(marksMap);
      }
    } catch (error) {
      console.error('Error loading students:', error);
      toast.error('Failed to load students');
    } finally {
      setLoading(false);
    }
  };

  const updateMark = (studentId: string, field: 'marks' | 'grade' | 'remarks', value: string) => {
    setMarks(prev => ({
      ...prev,
      [studentId]: { ...prev[studentId], [field]: value }
    }));
  };

  const autoCalculateGrade = (studentId: string, marksValue: string) => {
    if (!selectedExam || !marksValue) return;
    
    const numMarks = parseFloat(marksValue);
    const maxMarks = selectedExam.max_marks || 100;
    const percentage = (numMarks / maxMarks) * 100;
    
    let grade = '';
    if (percentage >= 90) grade = 'A+';
    else if (percentage >= 80) grade = 'A';
    else if (percentage >= 70) grade = 'B+';
    else if (percentage >= 60) grade = 'B';
    else if (percentage >= 50) grade = 'C+';
    else if (percentage >= 40) grade = 'C';
    else if (percentage >= 33) grade = 'D';
    else grade = 'F';
    
    setMarks(prev => ({
      ...prev,
      [studentId]: { ...prev[studentId], marks: marksValue, grade }
    }));
  };

  const saveMarks = async () => {
    if (!selectedExam) return;
    
    setSaving(true);
    try {
      const records = students
        .filter(s => marks[s.id]?.marks)
        .map(student => ({
          student_id: student.id,
          marks_obtained: parseFloat(marks[student.id].marks) || null,
          grade: marks[student.id].grade || null,
          remarks: marks[student.id].remarks || null,
        }));

      await apiClient.put(`/exams/${selectedExam.id}/marks`, { records });

      toast.success(`Saved marks for ${records.length} students`);
      onMarksUpdated?.();
    } catch (error: any) {
      console.error('Error saving marks:', error);
      toast.error(error.message || 'Failed to save marks');
    } finally {
      setSaving(false);
    }
  };

  const getFilledCount = () => {
    return Object.values(marks).filter(m => m.marks).length;
  };

  return (
    <div className="space-y-4">
      {/* Exam Selection */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-primary" />
            Select Exam to Enter Marks
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
            {/* Step 1: Exam Name */}
            <Select value={selectedExamName || 'all'} onValueChange={(v) => { setSelectedExamName(v === 'all' ? '' : v); setSelectedClassFilter('all'); setSelectedSubjectFilter('all'); }}>
              <SelectTrigger className="w-full text-xs sm:text-sm h-9 sm:h-10">
                <SelectValue placeholder="All Exams" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Exams</SelectItem>
                {examNames.map((name) => (
                  <SelectItem key={name} value={name}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Step 2: Class (filtered by exam) */}
            <Select value={selectedClassFilter} onValueChange={v => { setSelectedClassFilter(v); setSelectedSubjectFilter('all'); }}>
              <SelectTrigger className="w-full text-xs sm:text-sm h-9 sm:h-10">
                <SelectValue placeholder="All Classes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Classes</SelectItem>
                {classOptions.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.section ? `${c.name} - ${c.section.toUpperCase()}` : c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Step 3: Subject (filtered by exam + class) */}
            <Select value={selectedSubjectFilter} onValueChange={setSelectedSubjectFilter}>
              <SelectTrigger className="w-full text-xs sm:text-sm h-9 sm:h-10">
                <SelectValue placeholder="All Subjects" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Subjects</SelectItem>
                {subjectOptions.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {!selectedExamName && selectedClassFilter === 'all' ? (
            <div className="text-center py-8">
              <BookOpen className="h-10 w-10 mx-auto text-muted-foreground mb-2 opacity-50" />
              <p className="text-muted-foreground text-sm font-medium">Select an exam and class to view</p>
              <p className="text-xs text-muted-foreground mt-1">Use the filters above to find exams.</p>
            </div>
          ) : filteredExams.length === 0 ? (
            <p className="text-muted-foreground text-sm">No exams found for the selected filters.</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
              {filteredExams.map((exam) => (
                <Button
                  key={exam.id}
                  variant={selectedExam?.id === exam.id ? 'default' : 'outline'}
                  className="h-auto py-3 flex flex-col items-start text-left"
                  onClick={() => loadStudentsAndMarks(exam)}
                >
                  <span className="font-medium text-xs truncate w-full">
                    {exam.classes?.section ? `${exam.classes.name} - ${exam.classes.section.toUpperCase()}` : exam.classes?.name}
                  </span>
                  <span className="text-xs opacity-80 truncate w-full capitalize">
                    {exam.subjects?.name || 'All Subjects'}
                  </span>
                  {!selectedExamName && (
                    <span className="text-[10px] opacity-60 truncate w-full">{exam.name}</span>
                  )}
                </Button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Marks Entry Table */}
      {loading && (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {selectedExam && !loading && (
        <Card>
          <CardHeader className="pb-3 px-3 sm:px-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <CardTitle className="text-sm sm:text-base flex flex-wrap items-center gap-1.5">
                <Users className="h-4 w-4 text-primary flex-shrink-0" />
                <span className="truncate">{selectedExam.name} - {selectedExam.classes?.section ? `${selectedExam.classes.name} - ${selectedExam.classes.section.toUpperCase()}` : selectedExam.classes?.name}</span>
                {selectedExam.subjects && (
                  <Badge variant="secondary" className="capitalize text-xs">
                    {selectedExam.subjects.name}
                  </Badge>
                )}
              </CardTitle>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <Badge variant="outline" className="text-xs">
                  {getFilledCount()}/{students.length} filled
                </Badge>
                <Badge variant="outline" className="text-xs">
                  Max: {selectedExam.max_marks}
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
                    <TableHead className="w-[80px] text-xs sm:text-sm">Marks</TableHead>
                    <TableHead className="w-[65px] text-xs sm:text-sm">Grade</TableHead>
                    <TableHead className="hidden sm:table-cell text-xs sm:text-sm">Remarks</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {students.map((student) => (
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
                          value={marks[student.id]?.marks || ''}
                          onChange={(e) => autoCalculateGrade(student.id, e.target.value)}
                          placeholder="0"
                          max={selectedExam.max_marks}
                          min={0}
                          className="h-8 w-16 sm:w-20 text-sm"
                        />
                      </TableCell>
                      <TableCell className="py-2">
                        <Select
                          value={marks[student.id]?.grade || 'none'}
                          onValueChange={(v) => updateMark(student.id, 'grade', v === 'none' ? '' : v)}
                        >
                          <SelectTrigger className="h-8 w-14 sm:w-16 text-xs">
                            <SelectValue placeholder="-" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">-</SelectItem>
                            <SelectItem value="A+">A+</SelectItem>
                            <SelectItem value="A">A</SelectItem>
                            <SelectItem value="B+">B+</SelectItem>
                            <SelectItem value="B">B</SelectItem>
                            <SelectItem value="C+">C+</SelectItem>
                            <SelectItem value="C">C</SelectItem>
                            <SelectItem value="D">D</SelectItem>
                            <SelectItem value="F">F</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell py-2">
                        <Input
                          value={marks[student.id]?.remarks || ''}
                          onChange={(e) => updateMark(student.id, 'remarks', e.target.value)}
                          placeholder="Optional remarks"
                          className="h-8"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>

            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mt-4 pt-4 border-t">
              <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                Grades auto-calculate based on marks
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
