import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { apiClient } from '@/lib/apiClient';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { toast } from '@/hooks/use-toast';
import { Calendar, User, Phone, GraduationCap, Briefcase, School } from 'lucide-react';
import { differenceInYears, parse } from 'date-fns';

const leadSchema = z.object({
  student_name: z.string().min(1, 'Student name is required').max(100),
  gender: z.string().optional(),
  date_of_birth: z.string().optional(),
  current_class: z.string().optional(),
  class_applying_for: z.string().optional(),
  academic_year: z.string().optional(),
  father_name: z.string().optional(),
  mother_name: z.string().optional(),
  primary_contact_person: z.string().optional(),
  primary_mobile: z.string().min(10, 'Valid mobile number required').max(15),
  alternate_mobile: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  address: z.string().optional(),
  area_city: z.string().optional(),
  father_education: z.string().optional(),
  mother_education: z.string().optional(),
  father_occupation: z.string().optional(),
  mother_occupation: z.string().optional(),
  annual_income_range: z.string().optional(),
  previous_school: z.string().optional(),
  education_board: z.string().optional(),
  medium_of_instruction: z.string().optional(),
  last_class_passed: z.string().optional(),
  academic_performance: z.string().optional(),
  remarks: z.string().optional(),
});

type LeadFormData = z.infer<typeof leadSchema>;

interface LeadEntryFormProps {
  onSuccess?: () => void;
  initialData?: any;
  isEdit?: boolean;
}

const CLASS_OPTIONS = [
  'Nursery', 'LKG', 'UKG',
  'Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5',
  'Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10',
  'Class 11', 'Class 12',
];

const EDUCATION_OPTIONS = [
  'Below 10th', '10th Pass', '12th Pass', 'Graduate', 'Post Graduate', 'Doctorate', 'Other',
];

const INCOME_RANGES = [
  'Below ₹1,00,000', '₹1,00,000 - ₹3,00,000', '₹3,00,000 - ₹5,00,000',
  '₹5,00,000 - ₹10,00,000', '₹10,00,000 - ₹20,00,000', 'Above ₹20,00,000',
];

const BOARD_OPTIONS = ['CBSE', 'ICSE', 'State Board', 'IB', 'Other'];

export default function LeadEntryForm({ onSuccess, initialData, isEdit }: LeadEntryFormProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [calculatedAge, setCalculatedAge] = useState<number | null>(null);

  const form = useForm<LeadFormData>({
    resolver: zodResolver(leadSchema),
    defaultValues: initialData ? {
      ...initialData,
      date_of_birth: initialData.date_of_birth || '',
    } : {
      student_name: '',
      gender: '',
      date_of_birth: '',
      current_class: '',
      class_applying_for: '',
      academic_year: new Date().getFullYear() + '-' + (new Date().getFullYear() + 1),
      father_name: '',
      mother_name: '',
      primary_contact_person: 'father',
      primary_mobile: '',
      alternate_mobile: '',
      email: '',
      address: '',
      area_city: '',
      father_education: '',
      mother_education: '',
      father_occupation: '',
      mother_occupation: '',
      annual_income_range: '',
      previous_school: '',
      education_board: '',
      medium_of_instruction: '',
      last_class_passed: '',
      academic_performance: '',
      remarks: '',
    },
  });

  const dob = form.watch('date_of_birth');

  useEffect(() => {
    if (dob) {
      try {
        const birthDate = new Date(dob);
        const age = differenceInYears(new Date(), birthDate);
        setCalculatedAge(age >= 0 ? age : null);
      } catch {
        setCalculatedAge(null);
      }
    } else {
      setCalculatedAge(null);
    }
  }, [dob]);

  const onSubmit = async (data: LeadFormData) => {
    if (!user) return;
    setLoading(true);
    try {
      const payload = {
        ...data,
        date_of_birth: data.date_of_birth || null,
        email: data.email || null,
        created_by: user.id,
      };

      if (isEdit && initialData?.id) {
        const { created_by, ...updatePayload } = payload;
        await apiClient.put(`/leads/${initialData.id}`, updatePayload);
        toast({ title: 'Lead updated successfully' });
      } else {
        await apiClient.post('/leads', payload);
        toast({ title: 'Lead created successfully' });
        form.reset();
      }
      onSuccess?.();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Student Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <GraduationCap className="h-5 w-5 text-primary" />
              Student Details
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <FormField control={form.control} name="student_name" render={({ field }) => (
              <FormItem>
                <FormLabel>Student Full Name *</FormLabel>
                <FormControl><Input placeholder="Enter student name" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="gender" render={({ field }) => (
              <FormItem>
                <FormLabel>Gender</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Select gender" /></SelectTrigger></FormControl>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="date_of_birth" render={({ field }) => (
              <FormItem>
                <FormLabel>Date of Birth</FormLabel>
                <FormControl><Input type="date" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <div className="space-y-2">
              <Label>Age (Auto-calculated)</Label>
              <Input value={calculatedAge !== null ? `${calculatedAge} years` : '—'} disabled />
            </div>

            <FormField control={form.control} name="current_class" render={({ field }) => (
              <FormItem>
                <FormLabel>Current Class</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger></FormControl>
                  <SelectContent>
                    {CLASS_OPTIONS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="class_applying_for" render={({ field }) => (
              <FormItem>
                <FormLabel>Class Applying For</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger></FormControl>
                  <SelectContent>
                    {CLASS_OPTIONS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="academic_year" render={({ field }) => (
              <FormItem>
                <FormLabel>Academic Year Applying For</FormLabel>
                <FormControl><Input placeholder="e.g. 2026-2027" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
          </CardContent>
        </Card>

        {/* Parent / Guardian Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <User className="h-5 w-5 text-primary" />
              Parent / Guardian Details
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <FormField control={form.control} name="father_name" render={({ field }) => (
              <FormItem>
                <FormLabel>Father's Name</FormLabel>
                <FormControl><Input placeholder="Father's full name" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="mother_name" render={({ field }) => (
              <FormItem>
                <FormLabel>Mother's Name</FormLabel>
                <FormControl><Input placeholder="Mother's full name" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="primary_contact_person" render={({ field }) => (
              <FormItem>
                <FormLabel>Primary Contact Person</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger></FormControl>
                  <SelectContent>
                    <SelectItem value="father">Father</SelectItem>
                    <SelectItem value="mother">Mother</SelectItem>
                    <SelectItem value="guardian">Guardian</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="primary_mobile" render={({ field }) => (
              <FormItem>
                <FormLabel>Primary Mobile Number *</FormLabel>
                <FormControl>
                  <div className="flex gap-2">
                    <Input placeholder="Enter mobile number" {...field} className="flex-1" />
                    <a href={`tel:${field.value}`} className="inline-flex items-center justify-center h-10 w-10 rounded-md border border-input bg-background hover:bg-accent">
                      <Phone className="h-4 w-4 text-green-600" />
                    </a>
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="alternate_mobile" render={({ field }) => (
              <FormItem>
                <FormLabel>Alternate Mobile Number</FormLabel>
                <FormControl>
                  <div className="flex gap-2">
                    <Input placeholder="Alternate number" {...field} className="flex-1" />
                    {field.value && (
                      <a href={`tel:${field.value}`} className="inline-flex items-center justify-center h-10 w-10 rounded-md border border-input bg-background hover:bg-accent">
                        <Phone className="h-4 w-4 text-green-600" />
                      </a>
                    )}
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="email" render={({ field }) => (
              <FormItem>
                <FormLabel>Email Address</FormLabel>
                <FormControl><Input type="email" placeholder="Email (optional)" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="address" render={({ field }) => (
              <FormItem className="md:col-span-2">
                <FormLabel>Residential Address</FormLabel>
                <FormControl><Textarea placeholder="Full address" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="area_city" render={({ field }) => (
              <FormItem>
                <FormLabel>Area / City</FormLabel>
                <FormControl><Input placeholder="Area or city" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
          </CardContent>
        </Card>

        {/* Parent Education & Occupation */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Briefcase className="h-5 w-5 text-primary" />
              Parent Education & Occupation
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <FormField control={form.control} name="father_education" render={({ field }) => (
              <FormItem>
                <FormLabel>Father's Education</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Select education" /></SelectTrigger></FormControl>
                  <SelectContent>
                    {EDUCATION_OPTIONS.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="mother_education" render={({ field }) => (
              <FormItem>
                <FormLabel>Mother's Education</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Select education" /></SelectTrigger></FormControl>
                  <SelectContent>
                    {EDUCATION_OPTIONS.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="father_occupation" render={({ field }) => (
              <FormItem>
                <FormLabel>Father's Occupation</FormLabel>
                <FormControl><Input placeholder="Occupation" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="mother_occupation" render={({ field }) => (
              <FormItem>
                <FormLabel>Mother's Occupation</FormLabel>
                <FormControl><Input placeholder="Occupation" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="annual_income_range" render={({ field }) => (
              <FormItem>
                <FormLabel>Annual Family Income Range</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Select range" /></SelectTrigger></FormControl>
                  <SelectContent>
                    {INCOME_RANGES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
          </CardContent>
        </Card>

        {/* Previous Academic Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <School className="h-5 w-5 text-primary" />
              Previous Academic Information
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <FormField control={form.control} name="previous_school" render={({ field }) => (
              <FormItem>
                <FormLabel>Previous School Name</FormLabel>
                <FormControl><Input placeholder="School name" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="education_board" render={({ field }) => (
              <FormItem>
                <FormLabel>Education Board</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Select board" /></SelectTrigger></FormControl>
                  <SelectContent>
                    {BOARD_OPTIONS.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="medium_of_instruction" render={({ field }) => (
              <FormItem>
                <FormLabel>Medium of Instruction</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Select medium" /></SelectTrigger></FormControl>
                  <SelectContent>
                    <SelectItem value="English">English</SelectItem>
                    <SelectItem value="Hindi">Hindi</SelectItem>
                    <SelectItem value="Regional">Regional Language</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="last_class_passed" render={({ field }) => (
              <FormItem>
                <FormLabel>Last Class Passed</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger></FormControl>
                  <SelectContent>
                    {CLASS_OPTIONS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="academic_performance" render={({ field }) => (
              <FormItem className="md:col-span-2">
                <FormLabel>Academic Performance / Remarks</FormLabel>
                <FormControl><Textarea placeholder="Performance details, grades, etc." {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
          </CardContent>
        </Card>

        {/* Remarks */}
        <Card>
          <CardContent className="pt-6">
            <FormField control={form.control} name="remarks" render={({ field }) => (
              <FormItem>
                <FormLabel>Additional Remarks / Notes</FormLabel>
                <FormControl><Textarea placeholder="Any additional notes about this lead..." {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button type="submit" disabled={loading}>
            {loading ? 'Saving...' : isEdit ? 'Update Lead' : 'Create Lead'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
