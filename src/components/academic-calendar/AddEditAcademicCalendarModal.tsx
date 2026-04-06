import React, { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Upload, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { ApiValidationError } from '@/lib/apiClient';
import {
  createAcademicCalendarEntry,
  fetchAcademicCalendarClasses,
  fetchAcademicCalendarUsers,
  updateAcademicCalendarEntry,
} from './academicCalendarApi';
import {
  ACADEMIC_CALENDAR_CATEGORY_LABELS,
  ACADEMIC_CALENDAR_ROLE_LABELS,
  REMINDER_DAY_OPTIONS,
  normalizeReminderOffsets,
  type AcademicCalendarClassOption,
  type AcademicCalendarAudienceType,
  type AcademicCalendarCategory,
  type AcademicCalendarEntry,
  type AcademicCalendarRole,
  type AcademicCalendarStatus,
  type AcademicCalendarUserOption,
} from './types';

interface AddEditAcademicCalendarModalProps {
  open: boolean;
  entry: AcademicCalendarEntry | null;
  onClose: () => void;
  onSaved: (entry: AcademicCalendarEntry) => void;
}

interface FormState {
  title: string;
  category: AcademicCalendarCategory;
  subcategory: string;
  start_date: string;
  end_date: string;
  all_day: boolean;
  start_time: string;
  end_time: string;
  description: string;
  location: string;
  is_recurring: boolean;
  audience_type: AcademicCalendarAudienceType;
  audience_roles: AcademicCalendarRole[];
  audience_class_ids: number[];
  audience_user_ids: number[];
  notify_enabled: boolean;
  notify_offsets_days: number[];
  status: AcademicCalendarStatus;
}

const CATEGORY_OPTIONS = Object.entries(ACADEMIC_CALENDAR_CATEGORY_LABELS) as [AcademicCalendarCategory, string][];
const ROLE_OPTIONS = Object.entries(ACADEMIC_CALENDAR_ROLE_LABELS) as [AcademicCalendarRole, string][];

const emptyForm: FormState = {
  title: '',
  category: 'holiday',
  subcategory: '',
  start_date: '',
  end_date: '',
  all_day: true,
  start_time: '',
  end_time: '',
  description: '',
  location: '',
  is_recurring: false,
  audience_type: 'all',
  audience_roles: ['teacher', 'parent'],
  audience_class_ids: [],
  audience_user_ids: [],
  notify_enabled: true,
  notify_offsets_days: [3, 2, 1],
  status: 'published',
};

export default function AddEditAcademicCalendarModal({ open, entry, onClose, onSaved }: AddEditAcademicCalendarModalProps) {
  const isEdit = entry !== null;
  const [form, setForm] = useState<FormState>(emptyForm);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [classOptions, setClassOptions] = useState<AcademicCalendarClassOption[]>([]);
  const [userOptions, setUserOptions] = useState<AcademicCalendarUserOption[]>([]);
  const [userRoleFilter, setUserRoleFilter] = useState<AcademicCalendarRole | 'all'>('all');
  const [userSearch, setUserSearch] = useState('');
  const [loadingClassOptions, setLoadingClassOptions] = useState(false);
  const [loadingUserOptions, setLoadingUserOptions] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previousBlobUrl = useRef<string | null>(null);

  useEffect(() => {
    if (!open) return;

    if (entry) {
      setForm({
        title: entry.title,
        category: entry.category,
        subcategory: entry.subcategory ?? '',
        start_date: entry.start_date,
        end_date: entry.end_date ?? '',
        all_day: entry.all_day,
        start_time: entry.start_time ? entry.start_time.slice(0, 5) : '',
        end_time: entry.end_time ? entry.end_time.slice(0, 5) : '',
        description: entry.description ?? '',
        location: entry.location ?? '',
        is_recurring: entry.is_recurring,
        audience_type: entry.audience_type,
        audience_roles: entry.audience_roles ?? [],
        audience_class_ids: entry.audience_class_ids ?? [],
        audience_user_ids: entry.audience_user_ids ?? [],
        notify_enabled: entry.notify_enabled,
        notify_offsets_days: entry.notify_offsets_days?.length ? normalizeReminderOffsets(entry.notify_offsets_days) : [3, 2, 1],
        status: entry.status,
      });
      setImagePreview(entry.image_url ?? null);
    } else {
      setForm(emptyForm);
      setImagePreview(null);
    }

    setImageFile(null);
    setFieldErrors({});
    setUserRoleFilter('all');
    setUserSearch('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [open, entry]);

  useEffect(() => {
    if (!open) return;

    let active = true;
    setLoadingClassOptions(true);
    fetchAcademicCalendarClasses()
      .then((options) => {
        if (active) setClassOptions(options ?? []);
      })
      .catch(() => {
        if (active) setClassOptions([]);
      })
      .finally(() => {
        if (active) setLoadingClassOptions(false);
      });

    return () => {
      active = false;
    };
  }, [open]);

  useEffect(() => {
    if (!open || (form.audience_type !== 'users' && form.audience_user_ids.length === 0)) return;

    let active = true;
    setLoadingUserOptions(true);
    const timeoutId = window.setTimeout(() => {
      fetchAcademicCalendarUsers({
        role: userRoleFilter,
        search: userSearch,
        limit: 50,
        ids: form.audience_user_ids,
      })
        .then((options) => {
          if (!active) return;
          setUserOptions((current) => {
            const merged = [...options, ...current].reduce<AcademicCalendarUserOption[]>((acc, item) => {
              if (!acc.some((existing) => existing.id === item.id)) acc.push(item);
              return acc;
            }, []);
            return merged;
          });
        })
        .catch(() => {
          if (active) setUserOptions([]);
        })
        .finally(() => {
          if (active) setLoadingUserOptions(false);
        });
    }, 250);

    return () => {
      active = false;
      window.clearTimeout(timeoutId);
    };
  }, [open, form.audience_type, form.audience_user_ids, userRoleFilter, userSearch]);

  useEffect(() => () => {
    if (previousBlobUrl.current) {
      URL.revokeObjectURL(previousBlobUrl.current);
    }
  }, []);

  function handleField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => {
      const next = { ...current };
      delete next[key as string];
      return next;
    });
  }

  function toggleRole(role: AcademicCalendarRole, checked: boolean) {
    handleField(
      'audience_roles',
      checked ? [...new Set([...form.audience_roles, role])] : form.audience_roles.filter((item) => item !== role),
    );
  }

  function toggleReminder(day: number, checked: boolean) {
    handleField(
      'notify_offsets_days',
      normalizeReminderOffsets(checked ? [...form.notify_offsets_days, day] : form.notify_offsets_days.filter((item) => item !== day)),
    );
  }

  function toggleClass(classId: number, checked: boolean) {
    handleField(
      'audience_class_ids',
      checked ? [...new Set([...form.audience_class_ids, classId])] : form.audience_class_ids.filter((item) => item !== classId),
    );
  }

  function toggleUser(userId: number, checked: boolean) {
    handleField(
      'audience_user_ids',
      checked ? [...new Set([...form.audience_user_ids, userId])] : form.audience_user_ids.filter((item) => item !== userId),
    );
  }

  function handleImageChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    if (previousBlobUrl.current) {
      URL.revokeObjectURL(previousBlobUrl.current);
      previousBlobUrl.current = null;
    }

    if (!file) {
      setImageFile(null);
      setImagePreview(isEdit ? entry?.image_url ?? null : null);
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    previousBlobUrl.current = objectUrl;
    setImageFile(file);
    setImagePreview(objectUrl);
  }

  function clearImage() {
    if (previousBlobUrl.current) {
      URL.revokeObjectURL(previousBlobUrl.current);
      previousBlobUrl.current = null;
    }
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFieldErrors({});

    const localErrors: Record<string, string> = {};
    if (!form.title.trim()) localErrors.title = 'Title is required.';
    if (!form.start_date) localErrors.start_date = 'Start date is required.';
    if (form.end_date && form.end_date < form.start_date) localErrors.end_date = 'End date must be on or after start date.';
    if (!form.all_day && (!form.start_time || !form.end_time)) localErrors.start_time = 'Start and end time are required for timed entries.';
    if (form.audience_type === 'roles' && form.audience_roles.length === 0) localErrors.audience_roles = 'Select at least one role.';
    if (form.audience_type === 'classes' && form.audience_class_ids.length === 0) localErrors.audience_class_ids = 'Select at least one class.';
    if (form.audience_type === 'users' && form.audience_user_ids.length === 0) localErrors.audience_user_ids = 'Select at least one user.';
    if (form.notify_enabled && form.notify_offsets_days.length === 0) localErrors.notify_offsets_days = 'Select at least one reminder day.';

    if (Object.keys(localErrors).length > 0) {
      setFieldErrors(localErrors);
      return;
    }

    const payload = new FormData();
    payload.set('title', form.title.trim());
    payload.set('category', form.category);
    if (form.subcategory.trim()) payload.set('subcategory', form.subcategory.trim());
    payload.set('start_date', form.start_date);
    if (form.end_date) payload.set('end_date', form.end_date);
    payload.set('all_day', form.all_day ? '1' : '0');
    if (!form.all_day && form.start_time) payload.set('start_time', form.start_time);
    if (!form.all_day && form.end_time) payload.set('end_time', form.end_time);
    if (form.description.trim()) payload.set('description', form.description.trim());
    if (form.location.trim()) payload.set('location', form.location.trim());
    payload.set('is_recurring', form.is_recurring ? '1' : '0');
    payload.set('audience_type', form.audience_type);
    payload.set('audience_roles', JSON.stringify(form.audience_roles));
    payload.set('audience_class_ids', JSON.stringify(form.audience_class_ids));
    payload.set('audience_user_ids', JSON.stringify(form.audience_user_ids));
    payload.set('notify_enabled', form.notify_enabled ? '1' : '0');
    payload.set('notify_offsets_days', JSON.stringify(form.notify_offsets_days));
    payload.set('status', form.status);
    if (imageFile) payload.set('image', imageFile);

    setSubmitting(true);
    try {
      const saved = isEdit
        ? await updateAcademicCalendarEntry(entry!.id, payload)
        : await createAcademicCalendarEntry(payload);

      toast.success(isEdit ? 'Academic calendar entry updated' : 'Academic calendar entry created');
      onSaved(saved);
    } catch (error: unknown) {
      if (error instanceof ApiValidationError) {
        const nextErrors: Record<string, string> = {};
        for (const [field, messages] of Object.entries(error.errors)) {
          nextErrors[field] = Array.isArray(messages) ? messages[0] : String(messages);
        }
        setFieldErrors(nextErrors);
        toast.error('Please fix the validation errors.');
      } else {
        toast.error((error as Error).message || 'Something went wrong.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) onClose(); }}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display">{isEdit ? 'Edit Academic Calendar Entry' : 'Add Academic Calendar Entry'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 py-2">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="ac-title">Title <span className="text-destructive">*</span></Label>
              <Input id="ac-title" placeholder="Annual Day, PTA Meeting, Winter Break..." value={form.title} onChange={(event) => handleField('title', event.target.value)} />
              {fieldErrors.title ? <p className="text-sm text-destructive">{fieldErrors.title}</p> : null}
            </div>

            <div className="space-y-1.5">
              <Label>Category <span className="text-destructive">*</span></Label>
              <Select value={form.category} onValueChange={(value) => handleField('category', value as AcademicCalendarCategory)}>
                <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>
                  {CATEGORY_OPTIONS.map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fieldErrors.category ? <p className="text-sm text-destructive">{fieldErrors.category}</p> : null}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ac-subcategory">Subtype</Label>
              <Input id="ac-subcategory" placeholder="Optional finer classification" value={form.subcategory} onChange={(event) => handleField('subcategory', event.target.value)} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ac-start-date">Start Date <span className="text-destructive">*</span></Label>
              <Input id="ac-start-date" type="date" value={form.start_date} onChange={(event) => handleField('start_date', event.target.value)} />
              {fieldErrors.start_date ? <p className="text-sm text-destructive">{fieldErrors.start_date}</p> : null}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ac-end-date">End Date</Label>
              <Input id="ac-end-date" type="date" min={form.start_date || undefined} value={form.end_date} onChange={(event) => handleField('end_date', event.target.value)} />
              {fieldErrors.end_date ? <p className="text-sm text-destructive">{fieldErrors.end_date}</p> : null}
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <div className="flex items-center gap-3 rounded-xl border border-border/70 px-3 py-3">
                <Switch id="ac-all-day" checked={form.all_day} onCheckedChange={(value) => handleField('all_day', value)} />
                <Label htmlFor="ac-all-day" className="cursor-pointer">All-day entry</Label>
              </div>
            </div>

            {!form.all_day ? (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="ac-start-time">Start Time</Label>
                  <Input id="ac-start-time" type="time" value={form.start_time} onChange={(event) => handleField('start_time', event.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ac-end-time">End Time</Label>
                  <Input id="ac-end-time" type="time" value={form.end_time} onChange={(event) => handleField('end_time', event.target.value)} />
                </div>
              </>
            ) : null}
            {fieldErrors.start_time ? <p className="text-sm text-destructive md:col-span-2">{fieldErrors.start_time}</p> : null}

            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="ac-location">Location</Label>
              <Input id="ac-location" placeholder="Auditorium, Meeting Room, School Campus..." value={form.location} onChange={(event) => handleField('location', event.target.value)} />
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="ac-description">Description</Label>
              <Textarea id="ac-description" rows={4} placeholder="Add context, agenda, preparation details, or special instructions" value={form.description} onChange={(event) => handleField('description', event.target.value)} />
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <Label>Image</Label>
              {imagePreview ? (
                <div className="relative overflow-hidden rounded-xl border border-border bg-muted/20">
                  <img src={imagePreview} alt="Preview" className="max-h-72 w-full object-contain" onError={() => setImagePreview(null)} />
                  <button type="button" onClick={clearImage} className="absolute right-2 top-2 rounded-full bg-black/60 p-1 text-white transition-colors hover:bg-black/80" aria-label="Remove image">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <label htmlFor="ac-image" className="flex h-28 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 text-sm text-slate-500 transition-colors hover:border-primary/50 hover:bg-slate-50">
                  <Upload className="h-5 w-5" />
                  <span>Upload optional entry image</span>
                  <span className="text-xs">PNG, JPG, GIF up to 10 MB</span>
                </label>
              )}
              <input id="ac-image" ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
            </div>

            <div className="space-y-3 md:col-span-2">
              <Label>Audience</Label>
              <Select value={form.audience_type} onValueChange={(value) => handleField('audience_type', value as AcademicCalendarAudienceType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All users</SelectItem>
                  <SelectItem value="roles">Selected roles</SelectItem>
                  <SelectItem value="classes">Selected classes</SelectItem>
                  <SelectItem value="users">Specific users</SelectItem>
                </SelectContent>
              </Select>
              {form.audience_type === 'roles' ? (
                <div className="grid gap-2 rounded-xl border border-border/70 p-3 sm:grid-cols-3">
                  {ROLE_OPTIONS.map(([role, label]) => (
                    <label key={role} className="flex items-center gap-2 text-sm text-slate-700">
                      <Checkbox checked={form.audience_roles.includes(role)} onCheckedChange={(checked) => toggleRole(role, checked === true)} />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
              ) : null}
              {fieldErrors.audience_roles ? <p className="text-sm text-destructive">{fieldErrors.audience_roles}</p> : null}

              {form.audience_type === 'classes' ? (
                <div className="space-y-2 rounded-xl border border-border/70 p-3">
                  <div className="text-sm text-slate-500">Choose the classes that should see this entry.</div>
                  <div className="grid max-h-52 gap-2 overflow-y-auto sm:grid-cols-2">
                    {classOptions.map((option) => (
                      <label key={option.id} className="flex items-center gap-2 rounded-lg border border-slate-100 px-3 py-2 text-sm text-slate-700">
                        <Checkbox checked={form.audience_class_ids.includes(option.id)} onCheckedChange={(checked) => toggleClass(option.id, checked === true)} />
                        <span>{option.name}{option.section ? ` - ${option.section}` : ''}</span>
                      </label>
                    ))}
                  </div>
                  {loadingClassOptions ? <p className="text-sm text-slate-500">Loading classes...</p> : null}
                </div>
              ) : null}
              {fieldErrors.audience_class_ids ? <p className="text-sm text-destructive">{fieldErrors.audience_class_ids}</p> : null}

              {form.audience_type === 'users' ? (
                <div className="space-y-3 rounded-xl border border-border/70 p-3">
                  <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
                    <Select value={userRoleFilter} onValueChange={(value) => setUserRoleFilter(value as AcademicCalendarRole | 'all')}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All roles</SelectItem>
                        {ROLE_OPTIONS.map(([role, label]) => (
                          <SelectItem key={role} value={role}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input placeholder="Search name or email" value={userSearch} onChange={(event) => setUserSearch(event.target.value)} />
                  </div>
                  <div className="max-h-56 space-y-2 overflow-y-auto">
                    {userOptions.map((option) => (
                      <label key={option.id} className="flex items-start gap-2 rounded-lg border border-slate-100 px-3 py-2 text-sm text-slate-700">
                        <Checkbox checked={form.audience_user_ids.includes(option.id)} onCheckedChange={(checked) => toggleUser(option.id, checked === true)} />
                        <span>
                          <span className="block font-medium">{option.full_name}</span>
                          <span className="block text-xs text-slate-500">{ACADEMIC_CALENDAR_ROLE_LABELS[option.role]}{option.email ? ` - ${option.email}` : ''}</span>
                        </span>
                      </label>
                    ))}
                    {!loadingUserOptions && userOptions.length === 0 ? <p className="text-sm text-slate-500">No users found.</p> : null}
                  </div>
                  {loadingUserOptions ? <p className="text-sm text-slate-500">Loading users...</p> : null}
                </div>
              ) : null}
              {fieldErrors.audience_user_ids ? <p className="text-sm text-destructive">{fieldErrors.audience_user_ids}</p> : null}
            </div>

            <div className="space-y-3 md:col-span-2">
              <div className="flex items-center gap-3 rounded-xl border border-border/70 px-3 py-3">
                <Switch id="ac-recurring" checked={form.is_recurring} onCheckedChange={(value) => handleField('is_recurring', value)} />
                <Label htmlFor="ac-recurring" className="cursor-pointer">Repeat every year on the same date</Label>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(value) => handleField('status', value as AcademicCalendarStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="published">Published</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-3 rounded-xl border border-border/70 px-3 py-3">
                <Switch id="ac-notify" checked={form.notify_enabled} onCheckedChange={(value) => handleField('notify_enabled', value)} />
                <Label htmlFor="ac-notify" className="cursor-pointer">Send in-app and push reminders</Label>
              </div>
            </div>

            {form.notify_enabled ? (
              <div className="space-y-3 md:col-span-2">
                <Label>Reminder schedule</Label>
                <div className="flex flex-wrap gap-3 rounded-xl border border-border/70 p-3">
                  {REMINDER_DAY_OPTIONS.map((day) => (
                    <label key={day} className="flex items-center gap-2 text-sm text-slate-700">
                      <Checkbox checked={form.notify_offsets_days.includes(day)} onCheckedChange={(checked) => toggleReminder(day, checked === true)} />
                      <span>{day} day{day === 1 ? '' : 's'} before</span>
                    </label>
                  ))}
                </div>
                {fieldErrors.notify_offsets_days ? <p className="text-sm text-destructive">{fieldErrors.notify_offsets_days}</p> : null}
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>Cancel</Button>
            <Button type="submit" disabled={submitting}>{submitting ? 'Saving...' : isEdit ? 'Save Changes' : 'Add Entry'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
