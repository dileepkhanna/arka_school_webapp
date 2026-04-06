import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Wand2, Grid3X3, Sparkles, MousePointer2 } from 'lucide-react';
import { ExamFormData } from './types';

interface Props {
  formData: ExamFormData;
  setFormData: React.Dispatch<React.SetStateAction<ExamFormData>>;
  onModeSelect: (mode: 'auto' | 'manual') => void;
}

export default function ExamWizardStep3({ formData, setFormData, onModeSelect }: Props) {
  return (
    <div className="space-y-5">
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-3">
          <Wand2 className="h-6 w-6 text-primary" />
        </div>
        <h3 className="font-semibold text-lg">Schedule Mode</h3>
        <p className="text-sm text-muted-foreground">Choose how you want to schedule exams</p>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <Card 
          className={`cursor-pointer transition-all hover:shadow-md ${
            formData.mode === 'auto' 
              ? 'ring-2 ring-primary bg-primary/5' 
              : 'hover:bg-muted/30'
          }`}
          onClick={() => {
            setFormData(prev => ({ ...prev, mode: 'auto' }));
            onModeSelect('auto');
          }}
        >
          <CardContent className="p-5">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-xl bg-gradient-to-br from-violet-500/20 to-purple-500/20">
                <Sparkles className="h-6 w-6 text-violet-600" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-semibold">Quick Auto Schedule</h4>
                  <span className="text-xs bg-green-500/20 text-green-600 px-2 py-0.5 rounded-full font-medium">
                    Recommended
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Automatically distribute subjects across dates. Just select subjects per class and we'll create an optimal schedule.
                </p>
                <ul className="mt-3 space-y-1.5 text-xs text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                    Auto-fills dates avoiding subject clashes
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                    Perfect for standard examinations
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                    Quick setup in minutes
                  </li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card 
          className={`cursor-pointer transition-all hover:shadow-md ${
            formData.mode === 'manual' 
              ? 'ring-2 ring-primary bg-primary/5' 
              : 'hover:bg-muted/30'
          }`}
          onClick={() => {
            setFormData(prev => ({ ...prev, mode: 'manual' }));
            onModeSelect('manual');
          }}
        >
          <CardContent className="p-5">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20">
                <Grid3X3 className="h-6 w-6 text-amber-600" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-semibold">Manual Grid Builder</h4>
                  <span className="text-xs bg-amber-500/20 text-amber-600 px-2 py-0.5 rounded-full font-medium">
                    Advanced
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Full control over the schedule. Drag and drop subjects into specific date slots for each class.
                </p>
                <ul className="mt-3 space-y-1.5 text-xs text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                    Visual calendar grid interface
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                    Custom timing per subject
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                    Best for complex schedules
                  </li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
