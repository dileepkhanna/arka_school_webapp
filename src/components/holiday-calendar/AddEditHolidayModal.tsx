import React, { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Upload, X } from 'lucide-react';

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { ApiValidationError } from '@/lib/apiClient';

import { createHoliday, updateHoliday } from './holidayApi';
import type { Holiday, HolidayType } from './types';

interface AddEditHolidayModalProps {
    open: boolean;
    holiday: Holiday | null;
    onClose: () => void;
    onSaved: (holiday: Holiday) => void;
}

interface FormState {
    name: string;
    start_date: string;
    end_date: string;
    type: HolidayType | '';
    description: string;
    is_recurring: boolean;
}

const HOLIDAY_TYPE_OPTIONS: { value: HolidayType; label: string }[] = [
    { value: 'national', label: 'National Holiday' },
    { value: 'religious', label: 'Religious Holiday' },
    { value: 'school', label: 'School Holiday' },
    { value: 'optional', label: 'Optional Holiday' },
];

const emptyForm: FormState = {
    name: '',
    start_date: '',
    end_date: '',
    type: '',
    description: '',
    is_recurring: false,
};

export default function AddEditHolidayModal({
    open,
    holiday,
    onClose,
    onSaved,
}: AddEditHolidayModalProps) {
    const isEdit = holiday !== null;

    const [form, setForm] = useState<FormState>(emptyForm);
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
    const [submitting, setSubmitting] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const prevBlobUrl = useRef<string | null>(null);

    useEffect(() => {
        if (open) {
            if (holiday) {
                setForm({
                    name: holiday.name,
                    start_date: holiday.start_date,
                    end_date: holiday.end_date ?? '',
                    type: holiday.type,
                    description: holiday.description ?? '',
                    is_recurring: holiday.is_recurring,
                });
                setImagePreview(holiday.image_url ?? null);
            } else {
                setForm(emptyForm);
                setImagePreview(null);
            }
            setImageFile(null);
            setFieldErrors({});
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    }, [open, holiday]);

    function handleField<K extends keyof FormState>(key: K, value: FormState[K]) {
        setForm((prev) => ({ ...prev, [key]: value }));
        setFieldErrors((prev) => { const n = { ...prev }; delete n[key]; return n; });
    }

    function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0] ?? null;
        if (prevBlobUrl.current) { URL.revokeObjectURL(prevBlobUrl.current); prevBlobUrl.current = null; }
        if (file) {
            const url = URL.createObjectURL(file);
            prevBlobUrl.current = url;
            setImageFile(file);
            setImagePreview(url);
        } else {
            setImageFile(null);
            setImagePreview(isEdit ? (holiday?.image_url ?? null) : null);
        }
    }

    function clearImage() {
        if (prevBlobUrl.current) { URL.revokeObjectURL(prevBlobUrl.current); prevBlobUrl.current = null; }
        setImageFile(null);
        setImagePreview(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setFieldErrors({});

        const errors: Record<string, string> = {};
        if (!form.name.trim()) errors.name = 'Holiday name is required.';
        if (!form.start_date) errors.start_date = 'Start date is required.';
        if (!form.type) errors.type = 'Holiday type is required.';
        if (form.end_date && form.start_date && form.end_date < form.start_date) {
            errors.end_date = 'End date must be on or after start date.';
        }
        if (Object.keys(errors).length > 0) { setFieldErrors(errors); return; }

        const payload = new FormData();
        payload.set('name', form.name.trim());
        payload.set('start_date', form.start_date);
        if (form.end_date) payload.set('end_date', form.end_date);
        payload.set('type', form.type as string);
        if (form.description.trim()) payload.set('description', form.description.trim());
        payload.set('is_recurring', form.is_recurring ? '1' : '0');
        if (imageFile) payload.set('image', imageFile);

        setSubmitting(true);
        try {
            let saved: Holiday;
            if (isEdit) {
                await updateHoliday(holiday!.id, payload);
                saved = {
                    ...holiday!,
                    name: form.name.trim(),
                    start_date: form.start_date,
                    end_date: form.end_date || null,
                    type: form.type as HolidayType,
                    description: form.description.trim() || null,
                    is_recurring: form.is_recurring,
                    image_url: imageFile ? imagePreview : (imagePreview ?? holiday!.image_url),
                };
                toast.success('Holiday updated successfully');
            } else {
                const result = await createHoliday(payload) as unknown as Holiday & { id: number };
                saved = {
                    id: result.id,
                    name: form.name.trim(),
                    start_date: form.start_date,
                    end_date: form.end_date || null,
                    type: form.type as HolidayType,
                    description: form.description.trim() || null,
                    is_recurring: form.is_recurring,
                    image_url: result.image_url ?? null,
                    created_at: result.created_at ?? new Date().toISOString(),
                };
                toast.success('Holiday created successfully');
            }
            onSaved(saved);
        } catch (err: unknown) {
            if (err instanceof ApiValidationError) {
                const flat: Record<string, string> = {};
                for (const [field, msgs] of Object.entries(err.errors)) {
                    flat[field] = Array.isArray(msgs) ? msgs[0] : String(msgs);
                }
                setFieldErrors(flat);
                toast.error('Please fix the validation errors.');
            } else {
                toast.error((err as Error).message || 'Something went wrong.');
            }
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{isEdit ? 'Edit Holiday' : 'Add Holiday'}</DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4 py-2">
                    {/* Holiday Name */}
                    <div className="space-y-1">
                        <Label htmlFor="hc-name">Holiday Name <span className="text-destructive">*</span></Label>
                        <Input
                            id="hc-name"
                            placeholder="e.g. Independence Day"
                            value={form.name}
                            onChange={(e) => handleField('name', e.target.value)}
                        />
                        {fieldErrors.name && <p className="text-sm text-destructive">{fieldErrors.name}</p>}
                    </div>

                    {/* Start Date / End Date */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                            <Label htmlFor="hc-start">Start Date <span className="text-destructive">*</span></Label>
                            <Input
                                id="hc-start"
                                type="date"
                                value={form.start_date}
                                onChange={(e) => handleField('start_date', e.target.value)}
                            />
                            {fieldErrors.start_date && <p className="text-sm text-destructive">{fieldErrors.start_date}</p>}
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="hc-end">End Date</Label>
                            <Input
                                id="hc-end"
                                type="date"
                                value={form.end_date}
                                min={form.start_date || undefined}
                                onChange={(e) => handleField('end_date', e.target.value)}
                            />
                            {fieldErrors.end_date && <p className="text-sm text-destructive">{fieldErrors.end_date}</p>}
                        </div>
                    </div>

                    {/* Holiday Type */}
                    <div className="space-y-1">
                        <Label>Holiday Type <span className="text-destructive">*</span></Label>
                        <Select value={form.type} onValueChange={(v) => handleField('type', v as HolidayType)}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select type…" />
                            </SelectTrigger>
                            <SelectContent>
                                {HOLIDAY_TYPE_OPTIONS.map((opt) => (
                                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {fieldErrors.type && <p className="text-sm text-destructive">{fieldErrors.type}</p>}
                    </div>

                    {/* Description */}
                    <div className="space-y-1">
                        <Label htmlFor="hc-desc">Description</Label>
                        <Textarea
                            id="hc-desc"
                            placeholder="Optional description…"
                            rows={3}
                            value={form.description}
                            onChange={(e) => handleField('description', e.target.value)}
                        />
                        {fieldErrors.description && <p className="text-sm text-destructive">{fieldErrors.description}</p>}
                    </div>

                    {/* Holiday Image */}
                    <div className="space-y-1">
                        <Label>Holiday Image</Label>
                        {imagePreview ? (
                            <div className="relative w-full rounded-md border bg-muted/20">
                                <img
                                    src={imagePreview}
                                    alt="Preview"
                                    className="w-full max-h-64 rounded-md object-contain"
                                    onError={() => setImagePreview(null)}
                                />
                                <button
                                    type="button"
                                    onClick={clearImage}
                                    className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-1 hover:bg-black/80 transition-colors"
                                    aria-label="Remove image"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            </div>
                        ) : (
                            <label
                                htmlFor="hc-image-input"
                                className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-muted-foreground/30 rounded-md hover:border-primary/50 hover:bg-muted/30 transition-colors text-muted-foreground gap-2 cursor-pointer"
                            >
                                <Upload className="h-6 w-6" />
                                <span className="text-sm">Click to upload image</span>
                                <span className="text-xs">PNG, JPG, GIF up to 10 MB</span>
                            </label>
                        )}
                        <input
                            id="hc-image-input"
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleImageChange}
                        />
                        {fieldErrors.image && <p className="text-sm text-destructive">{fieldErrors.image}</p>}
                    </div>

                    {/* Recurring Toggle */}
                    <div className="flex items-center gap-3">
                        <Switch
                            id="hc-recurring"
                            checked={form.is_recurring}
                            onCheckedChange={(v) => handleField('is_recurring', v)}
                        />
                        <Label htmlFor="hc-recurring" className="cursor-pointer">
                            Repeats every year on the same date
                        </Label>
                    </div>

                    <DialogFooter className="pt-2">
                        <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={submitting}>
                            {submitting ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Holiday'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
