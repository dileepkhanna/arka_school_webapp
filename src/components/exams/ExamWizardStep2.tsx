import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Users, X, CheckCircle2 } from 'lucide-react';
import { ExamFormData, ClassItem } from './types';

interface Props {
  formData: ExamFormData;
  setFormData: React.Dispatch<React.SetStateAction<ExamFormData>>;
  classes: ClassItem[];
}

export default function ExamWizardStep2({ formData, setFormData, classes }: Props) {
  const toggleClass = (classId: string) => {
    setFormData(prev => ({
      ...prev,
      selectedClasses: prev.selectedClasses.includes(classId)
        ? prev.selectedClasses.filter(id => id !== classId)
        : [...prev.selectedClasses, classId]
    }));
  };

  const selectAllClasses = () => {
    if (formData.selectedClasses.length === classes.length) {
      setFormData(prev => ({ ...prev, selectedClasses: [] }));
    } else {
      setFormData(prev => ({ ...prev, selectedClasses: classes.map(c => c.id) }));
    }
  };

  // Group classes by name for better organization
  const groupedClasses = classes.reduce((acc, cls) => {
    if (!acc[cls.name]) acc[cls.name] = [];
    acc[cls.name].push(cls);
    return acc;
  }, {} as Record<string, ClassItem[]>);

  return (
    <div className="space-y-5">
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-3">
          <Users className="h-6 w-6 text-primary" />
        </div>
        <h3 className="font-semibold text-lg">Select Classes</h3>
        <p className="text-sm text-muted-foreground">Choose classes for this examination</p>
      </div>

      <div className="flex items-center justify-between">
        <Badge variant="secondary" className="text-sm">
          {formData.selectedClasses.length} of {classes.length} selected
        </Badge>
        <Button variant="outline" size="sm" onClick={selectAllClasses}>
          {formData.selectedClasses.length === classes.length ? 'Deselect All' : 'Select All'}
        </Button>
      </div>

      <ScrollArea className="h-[280px] border rounded-xl p-4">
        <div className="space-y-4">
          {Object.entries(groupedClasses).map(([className, sections]) => (
            <div key={className} className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">Class {className}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs"
                  onClick={() => {
                    const sectionIds = sections.map(s => s.id);
                    const allSelected = sectionIds.every(id => formData.selectedClasses.includes(id));
                    if (allSelected) {
                      setFormData(prev => ({
                        ...prev,
                        selectedClasses: prev.selectedClasses.filter(id => !sectionIds.includes(id))
                      }));
                    } else {
                      setFormData(prev => ({
                        ...prev,
                        selectedClasses: [...new Set([...prev.selectedClasses, ...sectionIds])]
                      }));
                    }
                  }}
                >
                  Toggle All
                </Button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {sections.map((cls) => (
                  <div
                    key={cls.id}
                    onClick={() => toggleClass(cls.id)}
                    className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-all ${formData.selectedClasses.includes(cls.id)
                      ? 'bg-primary/10 border-primary shadow-sm'
                      : 'hover:bg-muted/50 border-border'
                      }`}
                  >
                    <Checkbox checked={formData.selectedClasses.includes(cls.id)} />
                    <span className="font-medium text-sm">{cls.section ? `${cls.name} - ${cls.section.toUpperCase()}` : cls.name}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      {formData.selectedClasses.length > 0 && (
        <div className="space-y-2">
          <span className="text-sm font-medium">Selected Classes:</span>
          <div className="flex flex-wrap gap-2">
            {formData.selectedClasses.slice(0, 10).map(id => {
              const cls = classes.find(c => c.id === id);
              return cls && (
                <Badge key={id} variant="default" className="gap-1">
                  {cls.section ? `${cls.name} - ${cls.section.toUpperCase()}` : cls.name}
                  <X className="h-3 w-3 cursor-pointer hover:text-destructive" onClick={(e) => {
                    e.stopPropagation();
                    toggleClass(id);
                  }} />
                </Badge>
              );
            })}
            {formData.selectedClasses.length > 10 && (
              <Badge variant="outline">+{formData.selectedClasses.length - 10} more</Badge>
            )}
          </div>
        </div>
      )}

      {formData.selectedClasses.length > 0 && (
        <Card className="bg-green-500/10 border-green-500/30">
          <CardContent className="py-3">
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="h-4 w-4" />
              <span className="text-sm font-medium">
                {formData.selectedClasses.length} class{formData.selectedClasses.length > 1 ? 'es' : ''} selected for examination
              </span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
