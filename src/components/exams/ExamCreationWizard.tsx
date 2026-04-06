import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { apiClient } from '@/lib/apiClient';
import { toast } from 'sonner';
import { ExamFormData, ClassItem, SubjectItem, ExamSlot } from './types';
import ExamWizardStep1 from './ExamWizardStep1';
import ExamWizardStep2 from './ExamWizardStep2';
import ExamWizardStep3 from './ExamWizardStep3';
import ExamWizardStep4 from './ExamWizardStep4';
import ExamWizardStep5 from './ExamWizardStep5';
import ExamScheduleBuilder from './ExamScheduleBuilder';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classes: ClassItem[];
  subjects: SubjectItem[];
  onSuccess: () => void;
}

const defaultSlots: ExamSlot[] = [
  { id: '1', label: 'Morning Session', startTime: '09:30', endTime: '11:30' },
  { id: '2', label: 'Afternoon Session', startTime: '13:00', endTime: '15:00' },
];

const initialFormData: ExamFormData = {
  name: '',
  term: '2025-26',
  startDate: '',
  endDate: '',
  maxMarks: '100',
  duration: '2',
  selectedClasses: [],
  slots: [],
  classSubjects: {},
  schedule: [],
  mode: null,
};

export default function ExamCreationWizard({ open, onOpenChange, classes, subjects, onSuccess }: Props) {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<ExamFormData>(initialFormData);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const totalSteps = 6;

  const resetForm = () => {
    setCurrentStep(1);
    setFormData(initialFormData);
  };

  const handleClose = (open: boolean) => {
    if (!open) resetForm();
    onOpenChange(open);
  };

  const handleModeSelect = (mode: 'auto' | 'manual') => {
    setFormData(prev => ({ ...prev, mode }));
    // Initialize slots if empty
    if (formData.slots.length === 0) {
      setFormData(prev => ({ ...prev, slots: defaultSlots }));
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1: return formData.name && formData.term && formData.startDate && formData.endDate;
      case 2: return formData.selectedClasses.length > 0;
      case 3: return formData.mode !== null;
      case 4: return formData.slots.length > 0;
      case 5: return Object.values(formData.classSubjects).some(arr => arr.length > 0);
      case 6: return formData.schedule.length > 0;
      default: return false;
    }
  };

  const handleCreateExams = async () => {
    if (formData.schedule.length === 0) {
      toast.error('Please schedule at least one exam');
      return;
    }

    setIsSubmitting(true);

    try {
      const examsToCreate = formData.schedule.map(entry => {
        const slot = formData.slots.find(s => s.id === entry.slotId);
        return {
          name: `${formData.name} (${formData.term})`,
          exam_date: entry.date,
          exam_time: slot ? `${slot.startTime} - ${slot.endTime}` : null,
          max_marks: parseInt(formData.maxMarks) || 100,
          class_id: entry.classId,
          subject_id: entry.subjectId,
        };
      });

      await apiClient.post('/exams/bulk', { records: examsToCreate });

      toast.success(`Created ${examsToCreate.length} exam entries successfully!`);
      handleClose(false);
      onSuccess();
    } catch (error: any) {
      toast.error(error.message || 'Failed to create exams');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStepIndicator = () => (
    <div className="flex items-center justify-center gap-1 mb-6">
      {[1, 2, 3, 4, 5, 6].map((step) => (
        <div key={step} className="flex items-center">
          <div 
            className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium transition-all ${
              currentStep > step 
                ? 'bg-primary text-primary-foreground' 
                : currentStep === step 
                  ? 'bg-primary text-primary-foreground ring-4 ring-primary/20' 
                  : 'bg-muted text-muted-foreground'
            }`}
          >
            {currentStep > step ? <CheckCircle2 className="h-4 w-4" /> : step}
          </div>
          {step < 6 && (
            <div className={`w-6 h-0.5 ${currentStep > step ? 'bg-primary' : 'bg-muted'}`} />
          )}
        </div>
      ))}
    </div>
  );

  const getStepTitle = () => {
    switch (currentStep) {
      case 1: return 'Basic Details';
      case 2: return 'Select Classes';
      case 3: return 'Schedule Mode';
      case 4: return 'Time Slots';
      case 5: return 'Subjects';
      case 6: return 'Build Schedule';
      default: return '';
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">
            Create Examination
            <span className="text-sm font-normal text-muted-foreground ml-2">
              Step {currentStep} of {totalSteps}: {getStepTitle()}
            </span>
          </DialogTitle>
        </DialogHeader>

        {renderStepIndicator()}

        <div className="min-h-[400px]">
          {currentStep === 1 && (
            <ExamWizardStep1 formData={formData} setFormData={setFormData} />
          )}
          {currentStep === 2 && (
            <ExamWizardStep2 formData={formData} setFormData={setFormData} classes={classes} />
          )}
          {currentStep === 3 && (
            <ExamWizardStep3 formData={formData} setFormData={setFormData} onModeSelect={handleModeSelect} />
          )}
          {currentStep === 4 && (
            <ExamWizardStep4 formData={formData} setFormData={setFormData} />
          )}
          {currentStep === 5 && (
            <ExamWizardStep5 formData={formData} setFormData={setFormData} classes={classes} subjects={subjects} />
          )}
          {currentStep === 6 && (
            <ExamScheduleBuilder formData={formData} setFormData={setFormData} classes={classes} subjects={subjects} />
          )}
        </div>

        <DialogFooter className="flex gap-2 mt-4">
          {currentStep > 1 && (
            <Button variant="outline" onClick={() => setCurrentStep(prev => prev - 1)}>
              Back
            </Button>
          )}
          {currentStep < totalSteps ? (
            <Button
              onClick={() => setCurrentStep(prev => prev + 1)}
              disabled={!canProceed()}
              className="flex-1 gradient-admin"
            >
              Continue
            </Button>
          ) : (
            <Button
              onClick={handleCreateExams}
              disabled={isSubmitting || formData.schedule.length === 0}
              className="flex-1 gradient-admin"
            >
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create {formData.schedule.length} Exams
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
