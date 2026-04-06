import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileText, Calendar, Clock } from 'lucide-react';
import { ExamFormData } from './types';
import { useState } from 'react';

interface Props {
  formData: ExamFormData;
  setFormData: React.Dispatch<React.SetStateAction<ExamFormData>>;
}

const examTypes = [
  'Unit Test 1',
  'Unit Test 2',
  'Quarterly Exam',
  'Mid-Term Exam',
  'Half Yearly Exam',
  'Pre-Final Exam',
  'Annual Exam',
  'Custom',
];

const terms = [
  '2024-25',
  '2025-26',
  '2026-27',
];

export default function ExamWizardStep1({ formData, setFormData }: Props) {
  const [isCustom, setIsCustom] = useState(!examTypes.includes(formData.name) && formData.name !== '');

  return (
    <div className="space-y-5">
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-3">
          <FileText className="h-6 w-6 text-primary" />
        </div>
        <h3 className="font-semibold text-lg">Create Examination</h3>
        <p className="text-sm text-muted-foreground">Basic exam details and schedule</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Exam Type *</Label>
          {isCustom ? (
            <div className="flex gap-2">
              <Input
                className="flex-1"
                placeholder="Enter custom exam name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              />
              <Button type="button" variant="outline" size="sm" className="h-10 text-xs" onClick={() => { setIsCustom(false); setFormData(prev => ({ ...prev, name: '' })); }}>
                Cancel
              </Button>
            </div>
          ) : (
            <Select
              value={formData.name}
              onValueChange={(v) => {
                if (v === '__custom__') {
                  setIsCustom(true);
                  setFormData(prev => ({ ...prev, name: '' }));
                } else {
                  setFormData(prev => ({ ...prev, name: v }));
                }
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select exam type" />
              </SelectTrigger>
              <SelectContent>
                {examTypes.filter(t => t !== 'Custom').map((type) => (
                  <SelectItem key={type} value={type}>{type}</SelectItem>
                ))}
                <SelectItem value="__custom__">+ Custom Name</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>

        <div className="space-y-2">
          <Label>Academic Term *</Label>
          <Select
            value={formData.term}
            onValueChange={(v) => setFormData(prev => ({ ...prev, term: v }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select term" />
            </SelectTrigger>
            <SelectContent>
              {terms.map((term) => (
                <SelectItem key={term} value={term}>{term}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            Start Date *
          </Label>
          <Input
            type="date"
            value={formData.startDate}
            onChange={(e) => setFormData(prev => ({ ...prev, startDate: e.target.value }))}
          />
        </div>
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            End Date *
          </Label>
          <Input
            type="date"
            value={formData.endDate}
            onChange={(e) => setFormData(prev => ({ ...prev, endDate: e.target.value }))}
            min={formData.startDate}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Max Marks per Subject</Label>
          <Input
            type="number"
            value={formData.maxMarks}
            onChange={(e) => setFormData(prev => ({ ...prev, maxMarks: e.target.value }))}
            placeholder="100"
          />
        </div>
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            Default Duration (hrs)
          </Label>
          <Input
            type="number"
            value={formData.duration}
            onChange={(e) => setFormData(prev => ({ ...prev, duration: e.target.value }))}
            placeholder="2"
            step="0.5"
          />
        </div>
      </div>

      {/* Preview Card */}
      {formData.name && formData.startDate && formData.endDate && (
        <Card className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/20">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-semibold">{formData.name} ({formData.term})</p>
                <p className="text-sm text-muted-foreground">
                  {new Date(formData.startDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} - {new Date(formData.endDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
