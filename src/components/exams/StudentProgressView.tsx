import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { TrendingUp, TrendingDown, Award, BookOpen, BarChart3, Download } from 'lucide-react';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ExamMark {
  id: string;
  marks_obtained: number | null;
  grade: string | null;
  remarks: string | null;
  exams: {
    name: string;
    exam_date: string | null;
    max_marks: number | null;
    class_id?: string | number | null;
    classes?: { id?: string | number | null; name: string; section: string } | null;
    subjects: { name: string } | null;
  } | null;
}

interface Props {
  marks: ExamMark[];
  studentName: string;
  showAnalytics?: boolean;
}

export default function StudentProgressView({ marks, studentName, showAnalytics = true }: Props) {
  
  const analytics = useMemo(() => {
    const validMarks = marks.filter(m => m.marks_obtained !== null && m.exams?.max_marks);
    
    if (validMarks.length === 0) return null;

    const percentages = validMarks.map(m => 
      (m.marks_obtained! / (m.exams?.max_marks || 100)) * 100
    );
    
    const average = percentages.reduce((a, b) => a + b, 0) / percentages.length;
    
    const gradeCount = { 'A+': 0, 'A': 0, 'B+': 0, 'B': 0, 'C+': 0, 'C': 0, 'D': 0, 'F': 0 };
    validMarks.forEach(m => {
      if (m.grade && gradeCount.hasOwnProperty(m.grade)) {
        gradeCount[m.grade as keyof typeof gradeCount]++;
      }
    });
    
    const bestSubject = validMarks.reduce((best, current) => {
      const currentPct = (current.marks_obtained! / (current.exams?.max_marks || 100)) * 100;
      const bestPct = best ? (best.marks_obtained! / (best.exams?.max_marks || 100)) * 100 : 0;
      return currentPct > bestPct ? current : best;
    }, null as ExamMark | null);
    
    const weakestSubject = validMarks.reduce((worst, current) => {
      const currentPct = (current.marks_obtained! / (current.exams?.max_marks || 100)) * 100;
      const worstPct = worst ? (worst.marks_obtained! / (worst.exams?.max_marks || 100)) * 100 : 100;
      return currentPct < worstPct ? current : worst;
    }, null as ExamMark | null);

    return {
      average,
      totalExams: validMarks.length,
      gradeCount,
      bestSubject: bestSubject?.exams?.subjects?.name || 'N/A',
      weakestSubject: weakestSubject?.exams?.subjects?.name || 'N/A',
      trend: average >= 70 ? 'up' : average >= 50 ? 'stable' : 'down'
    };
  }, [marks]);

  const getGradeColor = (grade: string | null) => {
    if (!grade) return 'bg-muted text-muted-foreground';
    const g = grade.toUpperCase();
    if (g === 'A+' || g === 'A') return 'bg-emerald-500 text-white';
    if (g === 'B+' || g === 'B') return 'bg-blue-500 text-white';
    if (g === 'C+' || g === 'C') return 'bg-amber-500 text-white';
    return 'bg-red-500 text-white';
  };

  const getPercentageColor = (pct: number) => {
    if (pct >= 80) return 'text-emerald-600';
    if (pct >= 60) return 'text-blue-600';
    if (pct >= 40) return 'text-amber-600';
    return 'text-red-600';
  };

  // Group marks by exam name
  const groupedByExam = marks.reduce((acc, mark) => {
    const examName = mark.exams?.name || 'Unknown';
    if (!acc[examName]) acc[examName] = [];
    acc[examName].push(mark);
    return acc;
  }, {} as Record<string, ExamMark[]>);

  const handleDownloadPDF = () => {
    const rows = marks.map(m => {
      const pct = m.marks_obtained && m.exams?.max_marks ? ((m.marks_obtained / m.exams.max_marks) * 100).toFixed(1) : '0';
      return [
        m.exams?.name || '-',
        m.exams?.subjects?.name || '-',
        m.exams?.classes ? (m.exams.classes.section ? `${m.exams.classes.name} - ${m.exams.classes.section}` : m.exams.classes.name) : '-',
        String(m.marks_obtained ?? 0),
        String(m.exams?.max_marks ?? 100),
        `${pct}%`,
        m.grade || '-',
        m.remarks || '-',
      ];
    });

    if (rows.length === 0) { toast.error('No data to download'); return; }

    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text(`${studentName} - Exam Results`, 14, 18);
    doc.setFontSize(9);
    doc.text(`Generated: ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}`, 14, 25);

    autoTable(doc, {
      startY: 30,
      head: [['Exam', 'Subject', 'Class', 'Marks', 'Max', '%', 'Grade', 'Remarks']],
      body: rows,
      styles: { fontSize: 7 },
      headStyles: { fillColor: [59, 130, 246] },
    });

    doc.save(`${studentName.replace(/\s+/g, '_')}_Exam_Results.pdf`);
    toast.success('PDF downloaded!');
  };

  return (
    <div className="space-y-3 sm:space-y-6">
      {/* Download Button */}
      {marks.length > 0 && (
        <div className="flex justify-end">
          <Button variant="outline" size="sm" className="h-7 sm:h-9 text-[10px] sm:text-sm" onClick={handleDownloadPDF}>
            <Download className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" /> Download PDF
          </Button>
        </div>
      )}

      {/* Analytics Cards */}
      {showAnalytics && analytics && (
        <div className="grid grid-cols-2 gap-3">
          <Card className="bg-gradient-to-br from-primary/10 to-primary/5">
            <CardContent className="p-3 sm:pt-4 sm:p-4">
              <div className="flex items-center justify-between gap-1">
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm text-muted-foreground">Average Score</p>
                  <p className={`text-xl sm:text-2xl font-bold ${getPercentageColor(analytics.average)}`}>
                    {analytics.average.toFixed(1)}%
                  </p>
                </div>
                <BarChart3 className="h-6 w-6 sm:h-8 sm:w-8 text-primary/50 flex-shrink-0" />
              </div>
              <Progress value={analytics.average} className="mt-2 h-2" />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-3 sm:pt-4 sm:p-4">
              <div className="flex items-center justify-between gap-1">
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm text-muted-foreground">Total Exams</p>
                  <p className="text-xl sm:text-2xl font-bold">{analytics.totalExams}</p>
                </div>
                <BookOpen className="h-6 w-6 sm:h-8 sm:w-8 text-muted-foreground/50 flex-shrink-0" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-emerald-500/10">
            <CardContent className="p-3 sm:pt-4 sm:p-4">
              <div className="flex items-center justify-between gap-1">
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm text-muted-foreground">Best Subject</p>
                  <p className="text-sm sm:text-lg font-bold text-emerald-600 capitalize truncate">{analytics.bestSubject}</p>
                </div>
                <TrendingUp className="h-6 w-6 sm:h-8 sm:w-8 text-emerald-500/50 flex-shrink-0" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-amber-500/10">
            <CardContent className="p-3 sm:pt-4 sm:p-4">
              <div className="flex items-center justify-between gap-1">
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm text-muted-foreground">Needs Work</p>
                  <p className="text-sm sm:text-lg font-bold text-amber-600 capitalize truncate">{analytics.weakestSubject}</p>
                </div>
                <TrendingDown className="h-6 w-6 sm:h-8 sm:w-8 text-amber-500/50 flex-shrink-0" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Results by Exam */}
      {Object.entries(groupedByExam).map(([examName, examMarks]) => (
        <Card key={examName} className="overflow-hidden">
          <CardHeader className="pb-2 sm:pb-3 bg-muted/30 px-3 sm:px-6 py-2.5 sm:py-4">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-xs sm:text-base flex items-center gap-1.5 sm:gap-2 min-w-0">
                <Award className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary flex-shrink-0" />
                <span className="truncate">{examName}</span>
              </CardTitle>
              <Badge variant="outline" className="flex-shrink-0 text-[10px] sm:text-xs px-1.5 py-0">
                {examMarks.length} subject{examMarks.length > 1 ? 's' : ''}
              </Badge>
            </div>
            {examMarks[0]?.exams?.exam_date && (
              <CardDescription className="text-xs">
                {new Date(examMarks[0].exams.exam_date).toLocaleDateString('en-IN', { 
                  day: 'numeric', month: 'long', year: 'numeric' 
                })}
                {examMarks[0]?.exams?.classes ? ` • ${examMarks[0].exams.classes.section ? `${examMarks[0].exams.classes.name} - ${examMarks[0].exams.classes.section}` : examMarks[0].exams.classes.name}` : ''}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="w-full">
              <Table>
                <TableHeader>
                    <TableRow className="bg-muted/20">
                      <TableHead className="min-w-[80px] text-xs sm:text-sm">Subject</TableHead>
                      <TableHead className="min-w-[90px] text-xs sm:text-sm hidden sm:table-cell">Class</TableHead>
                      <TableHead className="text-center min-w-[70px] text-xs sm:text-sm">Marks</TableHead>
                    <TableHead className="text-center min-w-[50px] text-xs sm:text-sm">%</TableHead>
                    <TableHead className="text-center min-w-[50px] text-xs sm:text-sm">Grade</TableHead>
                    <TableHead className="min-w-[100px] hidden sm:table-cell text-xs sm:text-sm">Remarks</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {examMarks.map((mark) => {
                    const pct = mark.marks_obtained && mark.exams?.max_marks 
                      ? (mark.marks_obtained / mark.exams.max_marks) * 100 
                      : 0;
                    return (
                      <TableRow key={mark.id}>
                        <TableCell className="font-medium capitalize text-xs sm:text-sm py-2">
                          {mark.exams?.subjects?.name || '-'}
                        </TableCell>
                        <TableCell className="text-xs hidden sm:table-cell py-2">
                          {mark.exams?.classes ? (mark.exams.classes.section ? `${mark.exams.classes.name} - ${mark.exams.classes.section}` : mark.exams.classes.name) : '-'}
                        </TableCell>
                        <TableCell className="text-center text-xs sm:text-sm py-2">
                          <span className="font-semibold">{mark.marks_obtained ?? '-'}</span>
                          <span className="text-muted-foreground text-[10px] sm:text-xs">/{mark.exams?.max_marks ?? 100}</span>
                        </TableCell>
                        <TableCell className="text-center py-2">
                          <span className={`font-semibold text-xs sm:text-sm ${getPercentageColor(pct)}`}>
                            {pct.toFixed(0)}%
                          </span>
                        </TableCell>
                        <TableCell className="text-center py-2">
                          <Badge className={`text-[10px] sm:text-xs ${getGradeColor(mark.grade)}`}>
                            {mark.grade || '-'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground hidden sm:table-cell py-2">
                          {mark.remarks || '-'}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      ))}

      {marks.length === 0 && (
        <Card>
          <CardContent className="py-8 sm:py-12 text-center">
            <Award className="h-8 w-8 sm:h-12 sm:w-12 mx-auto text-muted-foreground mb-3 sm:mb-4" />
            <p className="text-xs sm:text-sm text-muted-foreground">No exam results available yet.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
