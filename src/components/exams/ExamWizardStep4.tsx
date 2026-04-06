import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Clock, Plus, Trash2 } from 'lucide-react';
import { ExamFormData, ExamSlot } from './types';

interface Props {
  formData: ExamFormData;
  setFormData: React.Dispatch<React.SetStateAction<ExamFormData>>;
}

const defaultSlots: ExamSlot[] = [
  { id: '1', label: 'Morning Session', startTime: '09:30', endTime: '11:30' },
  { id: '2', label: 'Afternoon Session', startTime: '13:00', endTime: '15:00' },
];

export default function ExamWizardStep4({ formData, setFormData }: Props) {
  const [customSlot, setCustomSlot] = useState({ label: '', startTime: '', endTime: '' });

  const slots = formData.slots.length > 0 ? formData.slots : defaultSlots;

  const addSlot = () => {
    if (!customSlot.startTime || !customSlot.endTime) return;
    
    const newSlot: ExamSlot = {
      id: Date.now().toString(),
      label: customSlot.label || `Slot ${slots.length + 1}`,
      startTime: customSlot.startTime,
      endTime: customSlot.endTime,
    };
    
    setFormData(prev => ({
      ...prev,
      slots: [...(prev.slots.length > 0 ? prev.slots : defaultSlots), newSlot]
    }));
    setCustomSlot({ label: '', startTime: '', endTime: '' });
  };

  const removeSlot = (slotId: string) => {
    setFormData(prev => ({
      ...prev,
      slots: prev.slots.filter(s => s.id !== slotId)
    }));
  };

  const usePreset = (preset: 'single' | 'double') => {
    if (preset === 'single') {
      setFormData(prev => ({
        ...prev,
        slots: [{ id: '1', label: 'Full Day', startTime: '09:30', endTime: '12:30' }]
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        slots: defaultSlots
      }));
    }
  };

  // Initialize slots if empty
  if (formData.slots.length === 0) {
    setFormData(prev => ({ ...prev, slots: defaultSlots }));
  }

  return (
    <div className="space-y-5">
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-3">
          <Clock className="h-6 w-6 text-primary" />
        </div>
        <h3 className="font-semibold text-lg">Time Slots</h3>
        <p className="text-sm text-muted-foreground">Define exam time slots per day</p>
      </div>

      {/* Quick Presets */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Quick setup:</span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => usePreset('single')}
          className={formData.slots.length === 1 ? 'border-primary' : ''}
        >
          1 Slot/Day
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => usePreset('double')}
          className={formData.slots.length === 2 ? 'border-primary' : ''}
        >
          2 Slots/Day
        </Button>
      </div>

      {/* Current Slots */}
      <ScrollArea className="h-[180px]">
        <div className="space-y-3">
          {slots.map((slot, index) => (
            <Card key={slot.id} className="border-l-4 border-l-primary">
              <CardContent className="py-3 px-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="font-mono">
                      Slot {index + 1}
                    </Badge>
                    <span className="font-medium">{slot.label}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-mono bg-muted px-2 py-1 rounded">
                      {slot.startTime} - {slot.endTime}
                    </span>
                    {slots.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive"
                        onClick={() => removeSlot(slot.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </ScrollArea>

      {/* Add Custom Slot */}
      <Card className="bg-muted/30">
        <CardContent className="pt-4">
          <Label className="text-sm font-medium mb-3 block">Add Custom Slot</Label>
          <div className="grid grid-cols-4 gap-2">
            <Input
              placeholder="Label (optional)"
              value={customSlot.label}
              onChange={(e) => setCustomSlot(prev => ({ ...prev, label: e.target.value }))}
              className="col-span-2"
            />
            <Input
              type="time"
              value={customSlot.startTime}
              onChange={(e) => setCustomSlot(prev => ({ ...prev, startTime: e.target.value }))}
            />
            <Input
              type="time"
              value={customSlot.endTime}
              onChange={(e) => setCustomSlot(prev => ({ ...prev, endTime: e.target.value }))}
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            className="mt-2 w-full"
            onClick={addSlot}
            disabled={!customSlot.startTime || !customSlot.endTime}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Slot
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
