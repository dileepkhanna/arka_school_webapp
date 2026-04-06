import { useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { BookOpen, Copy, CheckCircle2 } from 'lucide-react';
import { ExamFormData, ClassItem, SubjectItem } from './types';

interface Props {
  formData: ExamFormData;
  setFormData: React.Dispatch<React.SetStateAction<ExamFormData>>;
  classes: ClassItem[];
  subjects: SubjectItem[];
}

export default function ExamWizardStep5({ formData, setFormData, classes, subjects }: Props) {
  // Initialize classSubjects for selected classes
  useEffect(() => {
    const newClassSubjects = { ...formData.classSubjects };
    formData.selectedClasses.forEach(classId => {
      if (!newClassSubjects[classId]) {
        newClassSubjects[classId] = subjects.map(s => s.id); // Default: all subjects selected
      }
    });
    setFormData(prev => ({ ...prev, classSubjects: newClassSubjects }));
  }, [formData.selectedClasses, subjects]);

  const toggleSubject = (classId: string, subjectId: string) => {
    setFormData(prev => {
      const current = prev.classSubjects[classId] || [];
      const updated = current.includes(subjectId)
        ? current.filter(id => id !== subjectId)
        : [...current, subjectId];
      return {
        ...prev,
        classSubjects: { ...prev.classSubjects, [classId]: updated }
      };
    });
  };

  const copySubjectsFrom = (fromClassId: string, toClassId: string) => {
    setFormData(prev => ({
      ...prev,
      classSubjects: {
        ...prev.classSubjects,
        [toClassId]: [...(prev.classSubjects[fromClassId] || [])]
      }
    }));
  };

  const selectAllForClass = (classId: string) => {
    const current = formData.classSubjects[classId] || [];
    const allSelected = current.length === subjects.length;

    setFormData(prev => ({
      ...prev,
      classSubjects: {
        ...prev.classSubjects,
        [classId]: allSelected ? [] : subjects.map(s => s.id)
      }
    }));
  };

  const selectedClassData = formData.selectedClasses.map(id =>
    classes.find(c => c.id === id)
  ).filter(Boolean) as ClassItem[];

  return (
    <div className="space-y-5">
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-3">
          <BookOpen className="h-6 w-6 text-primary" />
        </div>
        <h3 className="font-semibold text-lg">Subjects by Class</h3>
        <p className="text-sm text-muted-foreground">Select subjects for each class</p>
      </div>

      <ScrollArea className="h-[320px]">
        <div className="space-y-4 pr-4">
          {selectedClassData.map((cls, index) => (
            <Card key={cls.id} className="border-l-4 border-l-primary">
              <CardHeader className="py-3 px-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Badge variant="default">{cls.section ? `Class ${cls.name} - ${cls.section.toUpperCase()}` : `Class ${cls.name}`}</Badge>
                    <span className="text-xs text-muted-foreground">
                      ({(formData.classSubjects[cls.id] || []).length} subjects)
                    </span>
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    {index > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => copySubjectsFrom(selectedClassData[index - 1].id, cls.id)}
                      >
                        <Copy className="h-3 w-3 mr-1" />
                        Copy from {selectedClassData[index - 1].section ? `${selectedClassData[index - 1].name} - ${selectedClassData[index - 1].section.toUpperCase()}` : selectedClassData[index - 1].name}
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => selectAllForClass(cls.id)}
                    >
                      Toggle All
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0 px-4 pb-4">
                <div className="flex flex-wrap gap-2">
                  {subjects.map((subject) => {
                    const isSelected = (formData.classSubjects[cls.id] || []).includes(subject.id);
                    return (
                      <Badge
                        key={subject.id}
                        variant={isSelected ? 'default' : 'outline'}
                        className="cursor-pointer capitalize transition-all"
                        onClick={() => toggleSubject(cls.id, subject.id)}
                      >
                        {isSelected && <CheckCircle2 className="h-3 w-3 mr-1" />}
                        {subject.name}
                      </Badge>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </ScrollArea>

      {/* Summary */}
      <Card className="bg-green-500/10 border-green-500/30">
        <CardContent className="py-3">
          <div className="flex items-center gap-2 text-green-600">
            <CheckCircle2 className="h-4 w-4" />
            <span className="text-sm font-medium">
              {Object.values(formData.classSubjects).reduce((sum, arr) => sum + arr.length, 0)} total exam entries will be created
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
