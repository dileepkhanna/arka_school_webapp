import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, Loader2, RotateCcw, TrendingUp } from 'lucide-react';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { adminSidebarItems } from '@/config/adminSidebar';
import { useAuth } from '@/hooks/useAuth';
import { apiClient } from '@/lib/apiClient';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { BackButton } from '@/components/ui/back-button';

interface Class {
    id: number;
    name: string;
    section: string;
    academic_year: string;
}

interface StudentDirectoryItem {
    id: number;
    admission_number: string;
    login_id?: string | null;
    full_name: string;
    class_id: number | null;
    status: string;
    classes?: { name: string; section: string } | null;
}

interface PromotionRecord {
    id: number;
    student: { id: number; full_name: string; admission_number: string; login_id?: string | null };
    from_class: { id: number; name: string; section: string } | null;
    to_class: { id: number; name: string; section: string } | null;
    from_admission_number?: string | null;
    to_admission_number?: string | null;
    from_login_id?: string | null;
    to_login_id?: string | null;
    academic_year: string;
    batch_key: string;
    created_at: string;
}

interface PromotionHistoryApiRecord {
    id: number;
    student: { id: number; full_name: string; admission_number: string; login_id?: string | null };
    from_class: { id: number; name: string; section: string } | null;
    to_class: { id: number; name: string; section: string } | null;
    from_admission_number?: string | null;
    to_admission_number?: string | null;
    from_login_id?: string | null;
    to_login_id?: string | null;
    academic_year: string;
    batch_key: string;
    created_at: string;
}

interface PromotionHistoryResponse {
    data: PromotionHistoryApiRecord[];
}

interface RollbackTarget {
    record: PromotionRecord;
    mode: 'single' | 'batch';
    batchRecords?: PromotionRecord[];
}

const formatClassName = (item: Pick<Class, 'name' | 'section'> | null | undefined) => {
    if (!item) return 'Unknown class';
    return item.section ? `${item.name} - ${item.section}` : item.name;
};

export default function StudentPromotion() {
    const { user, userRole, loading } = useAuth();
    const navigate = useNavigate();
    const { toast } = useToast();

    const [classes, setClasses] = useState<Class[]>([]);
    const [students, setStudents] = useState<StudentDirectoryItem[]>([]);
    const [studentId, setStudentId] = useState('');
    const [sourceClassId, setSourceClassId] = useState('');
    const [targetClassId, setTargetClassId] = useState('');
    const [individualTargetClassId, setIndividualTargetClassId] = useState('');
    const [academicYear, setAcademicYear] = useState('');
    const [previewCount, setPreviewCount] = useState<number | null>(null);
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [initialLoading, setInitialLoading] = useState(true);
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [history, setHistory] = useState<PromotionRecord[]>([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [rollbackTarget, setRollbackTarget] = useState<RollbackTarget | null>(null);
    const [rollbackLoading, setRollbackLoading] = useState(false);

    const fetchPromotionData = async () => {
        const [classData, studentData] = await Promise.all([
            apiClient.get<Class[]>('/classes'),
            apiClient.get<StudentDirectoryItem[]>('/students/directory'),
        ]);

        setClasses(classData || []);
        setStudents(studentData || []);
        if ((classData || []).length > 0 && !academicYear.trim()) {
            setAcademicYear(classData[0].academic_year || '');
        }
    };

    const fetchHistory = async () => {
        const response = await apiClient.get<PromotionHistoryResponse>('/promotion/history');
        const mappedHistory = (response.data || []).map((record) => ({
            id: record.id,
            student: record.student,
            from_class: record.from_class,
            to_class: record.to_class,
            from_admission_number: record.from_admission_number,
            to_admission_number: record.to_admission_number,
            from_login_id: record.from_login_id,
            to_login_id: record.to_login_id,
            academic_year: record.academic_year,
            batch_key: record.batch_key,
            created_at: record.created_at,
        }));
        setHistory(mappedHistory);
        return mappedHistory;
    };

    useEffect(() => {
        if (!loading && (!user || userRole !== 'admin')) {
            navigate('/auth');
        }
    }, [loading, navigate, user, userRole]);

    useEffect(() => {
        const fetchData = async () => {
            setInitialLoading(true);
            try {
                await fetchPromotionData();
            } catch (error: any) {
                console.error('Failed to load promotion data', error);
                setClasses([]);
                setStudents([]);
                toast({
                    variant: 'destructive',
                    title: 'Error',
                    description: error.message || 'Failed to load promotion data.',
                });
            } finally {
                setInitialLoading(false);
            }
        };

        fetchData();
    }, [toast]);

    useEffect(() => {
        if (!sourceClassId) {
            setPreviewCount(null);
            return;
        }

        const count = students.filter(
            (student) => String(student.class_id) === sourceClassId && student.status === 'active',
        ).length;
        setPreviewCount(count);
    }, [sourceClassId, students]);

    const sourceClass = useMemo(
        () => classes.find((item) => String(item.id) === sourceClassId) || null,
        [classes, sourceClassId],
    );

    const targetClass = useMemo(
        () => classes.find((item) => String(item.id) === targetClassId) || null,
        [classes, targetClassId],
    );

    const selectedStudent = useMemo(
        () => students.find((item) => String(item.id) === studentId) || null,
        [studentId, students],
    );

    const individualTargetClass = useMemo(
        () => classes.find((item) => String(item.id) === individualTargetClassId) || null,
        [classes, individualTargetClassId],
    );

    const isPromoteDisabled =
        !sourceClassId || !targetClassId || !academicYear.trim() || sourceClassId === targetClassId;

    const isIndividualPromoteDisabled =
        !studentId ||
        !individualTargetClassId ||
        !academicYear.trim() ||
        String(selectedStudent?.class_id || '') === individualTargetClassId ||
        selectedStudent?.status !== 'active';

    const handleOpenConfirm = () => {
        if (isPromoteDisabled) return;
        setIsConfirmOpen(true);
    };

    const handlePromote = async () => {
        setIsLoading(true);
        try {
            const response = await apiClient.post<{ message: string; promoted_count: number }>('/promotion/execute', {
                source_class_id: Number(sourceClassId),
                target_class_id: Number(targetClassId),
                academic_year: academicYear.trim(),
            });

            toast({
                title: 'Success',
                description: response.message || 'Promotion completed successfully.',
            });

            await fetchPromotionData();
            if (isHistoryOpen) {
                await fetchHistory();
            }
            setIsConfirmOpen(false);
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Promotion failed',
                description: error.message || 'Unable to promote students.',
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handlePromoteSingle = async () => {
        if (!selectedStudent) {
            return;
        }

        setIsLoading(true);
        try {
            const response = await apiClient.post<{ message: string; admission_number?: string; login_id?: string }>('/promotion/execute-single', {
                student_id: selectedStudent.id,
                target_class_id: Number(individualTargetClassId),
                academic_year: academicYear.trim(),
            });

            toast({
                title: 'Success',
                description: response.message || 'Student promoted successfully.',
            });

            await fetchPromotionData();
            if (isHistoryOpen) {
                await fetchHistory();
            }
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Promotion failed',
                description: error.message || 'Unable to promote the selected student.',
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleViewHistory = async () => {
        setIsHistoryOpen(true);
        setHistoryLoading(true);
        try {
            await fetchHistory();
        } catch (error: any) {
            setHistory([]);
            toast({
                variant: 'destructive',
                title: 'History unavailable',
                description: error.message || 'Failed to load promotion history.',
            });
        } finally {
            setHistoryLoading(false);
        }
    };

    const handleRollback = async () => {
        if (!rollbackTarget?.record) {
            return;
        }

        const rollbackRecord = rollbackTarget.record;

        setRollbackLoading(true);
        try {
            const response = rollbackTarget.mode === 'single'
                ? await apiClient.post<{ message: string }>('/promotion/rollback-single', {
                    promotion_history_id: rollbackRecord.id,
                })
                : await apiClient.post<{ message: string; restored_count: number }>('/promotion/rollback', {
                    batch_academic_year: rollbackRecord.academic_year,
                    source_class_id: rollbackRecord.from_class?.id,
                    target_class_id: rollbackRecord.to_class?.id,
                });

            toast({
                title: 'Rollback completed',
                description: response.message || 'Students restored to the original class successfully.',
            });

            await fetchPromotionData();
            if (isHistoryOpen) {
                await fetchHistory();
            }

            setRollbackTarget(null);
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Rollback failed',
                description: error.message || 'Unable to revert the promotion batch.',
            });
        } finally {
            setRollbackLoading(false);
        }
    };

    if (loading || initialLoading) {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    const historyBatchGroups = history.reduce<PromotionRecord[][]>((groups, record) => {
        const existing = groups.find((group) => group[0]?.batch_key === record.batch_key);
        if (existing) {
            existing.push(record);
        } else {
            groups.push([record]);
        }
        return groups;
    }, []);

    return (
        <DashboardLayout sidebarItems={adminSidebarItems} roleColor="admin">
            <div className="space-y-6 animate-fade-in">
                <BackButton to="/admin" />

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="font-display text-2xl font-bold">Student Promotion</h1>
                        <p className="text-muted-foreground">Promote active students to the next class while preserving all historical records.</p>
                    </div>
                    <Button variant="outline" onClick={handleViewHistory} disabled={historyLoading}>
                        {historyLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <TrendingUp className="mr-2 h-4 w-4" />}
                        View History
                    </Button>
                </div>

                <div className="flex items-start gap-2 rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>
                        <strong>In-Place Update:</strong> Promoting students updates their active class record directly.
                        {' '}All attendance logs, fee invoices, and exam marks remain attached to each student's profile.
                        {' '}Ensure all grades and fees for the current year are finalised before promoting.
                    </span>
                </div>

                <Card className="card-elevated">
                    <CardHeader>
                        <CardTitle className="font-display">Bulk Promotion</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                            <div className="space-y-2">
                                <p className="text-sm font-medium">From Class</p>
                                <Select value={sourceClassId} onValueChange={setSourceClassId}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select source class" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {classes.map((item) => (
                                            <SelectItem key={item.id} value={String(item.id)}>
                                                {formatClassName(item)}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <p className="text-sm font-medium">To Class</p>
                                <Select value={targetClassId} onValueChange={setTargetClassId}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select target class" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {classes.map((item) => (
                                            <SelectItem key={item.id} value={String(item.id)}>
                                                {formatClassName(item)}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <p className="text-sm font-medium">Academic Year</p>
                                <Input
                                    value={academicYear}
                                    onChange={(event) => setAcademicYear(event.target.value)}
                                    placeholder="e.g. 2025-2026"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                            <div className="rounded-lg border bg-muted/20 p-4">
                                <p className="text-sm text-muted-foreground">Selected source</p>
                                <p className="mt-1 font-semibold">{formatClassName(sourceClass)}</p>
                            </div>
                            <div className="rounded-lg border bg-muted/20 p-4">
                                <p className="text-sm text-muted-foreground">Selected target</p>
                                <p className="mt-1 font-semibold">{formatClassName(targetClass)}</p>
                            </div>
                            <div className="rounded-lg border bg-muted/20 p-4">
                                <p className="text-sm text-muted-foreground">Active students to promote</p>
                                <p className="mt-1 text-2xl font-bold">{previewCount ?? 0}</p>
                            </div>
                        </div>

                        <div className="flex justify-end">
                            <Button onClick={handleOpenConfirm} disabled={isPromoteDisabled} className="gradient-admin">
                                Promote
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                <Card className="card-elevated">
                    <CardHeader>
                        <CardTitle className="font-display">Individual Student Promotion</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                                <p className="text-sm font-medium">Student</p>
                                <Select value={studentId} onValueChange={setStudentId}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select student" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {students
                                            .filter((student) => student.status === 'active')
                                            .map((student) => (
                                                <SelectItem key={student.id} value={String(student.id)}>
                                                    {student.full_name} ({student.admission_number})
                                                </SelectItem>
                                            ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <p className="text-sm font-medium">To Class</p>
                                <Select value={individualTargetClassId} onValueChange={setIndividualTargetClassId}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select target class" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {classes.map((item) => (
                                            <SelectItem key={item.id} value={String(item.id)}>
                                                {formatClassName(item)}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                            <div className="rounded-lg border bg-muted/20 p-4">
                                <p className="text-sm text-muted-foreground">Selected student</p>
                                <p className="mt-1 font-semibold">{selectedStudent ? `${selectedStudent.full_name} (${selectedStudent.admission_number})` : 'No student selected'}</p>
                            </div>
                            <div className="rounded-lg border bg-muted/20 p-4">
                                <p className="text-sm text-muted-foreground">Current class</p>
                                <p className="mt-1 font-semibold">{selectedStudent ? formatClassName(selectedStudent.classes) : 'N/A'}</p>
                            </div>
                            <div className="rounded-lg border bg-muted/20 p-4">
                                <p className="text-sm text-muted-foreground">New class</p>
                                <p className="mt-1 font-semibold">{formatClassName(individualTargetClass)}</p>
                            </div>
                        </div>

                        <div className="flex justify-end">
                            <Button onClick={handlePromoteSingle} disabled={isIndividualPromoteDisabled || isLoading} className="gradient-admin">
                                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Promote Student
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                <Dialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Confirm Student Promotion</DialogTitle>
                            <DialogDescription>
                                You are about to promote <strong>{previewCount ?? 0} students</strong> from <strong>{formatClassName(sourceClass)}</strong> to <strong>{formatClassName(targetClass)}</strong> for academic year <strong>{academicYear || 'N/A'}</strong>. Their existing attendance, fee, and exam records will remain linked to their profiles. Do you wish to continue?
                            </DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setIsConfirmOpen(false)} disabled={isLoading}>
                                Cancel
                            </Button>
                            <Button type="button" onClick={handlePromote} disabled={isLoading}>
                                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Confirm Promotion
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
                    <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>Promotion History</DialogTitle>
                            <DialogDescription>Every promotion remains auditable even though the student stays on the same profile.</DialogDescription>
                        </DialogHeader>

                        {historyLoading ? (
                            <div className="flex items-center justify-center py-12">
                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            </div>
                        ) : history.length === 0 ? (
                            <div className="flex flex-col items-center justify-center gap-2 py-12 text-center text-muted-foreground">
                                <AlertCircle className="h-10 w-10" />
                                <p>No promotion history found.</p>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {historyBatchGroups.map((group) => {
                                    const batch = group[0];
                                    return (
                                        <div key={batch.batch_key} className="rounded-lg border">
                                            <div className="flex flex-col gap-3 border-b bg-muted/20 p-4 md:flex-row md:items-center md:justify-between">
                                                <div className="text-sm">
                                                    <div className="font-semibold">{formatClassName(batch.from_class)} to {formatClassName(batch.to_class)}</div>
                                                    <div className="text-muted-foreground">Academic Year {batch.academic_year} - {group.length} student{group.length === 1 ? '' : 's'} - {new Date(batch.created_at).toLocaleString()}</div>
                                                </div>
                                                <Button
                                                    type="button"
                                                    variant="destructive"
                                                    size="sm"
                                                    onClick={() => setRollbackTarget({ record: batch, mode: 'batch', batchRecords: group })}
                                                    disabled={!batch.from_class || !batch.to_class}
                                                >
                                                    <RotateCcw className="mr-1 h-3.5 w-3.5" />
                                                    Revert Batch
                                                </Button>
                                            </div>
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead>Student</TableHead>
                                                        <TableHead>Admission / Login</TableHead>
                                                        <TableHead>From Class</TableHead>
                                                        <TableHead>To Class</TableHead>
                                                        <TableHead>Academic Year</TableHead>
                                                        <TableHead>Promoted On</TableHead>
                                                        <TableHead>Action</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {group.map((record) => (
                                                        <TableRow key={record.id}>
                                                            <TableCell className="font-medium">{record.student?.full_name || 'Unknown'}</TableCell>
                                                            <TableCell>
                                                                <div className="text-xs">
                                                                    <div>{record.from_admission_number || record.student?.admission_number || 'N/A'} {'->'} {record.to_admission_number || record.student?.admission_number || 'N/A'}</div>
                                                                    <div className="text-muted-foreground">{record.from_login_id || record.student?.login_id || 'N/A'} {'->'} {record.to_login_id || record.student?.login_id || 'N/A'}</div>
                                                                </div>
                                                            </TableCell>
                                                            <TableCell>{formatClassName(record.from_class)}</TableCell>
                                                            <TableCell>{formatClassName(record.to_class)}</TableCell>
                                                            <TableCell>{record.academic_year}</TableCell>
                                                            <TableCell>{new Date(record.created_at).toLocaleString()}</TableCell>
                                                            <TableCell>
                                                                <Button
                                                                    type="button"
                                                                    variant="outline"
                                                                    size="sm"
                                                                    onClick={() => setRollbackTarget({ record, mode: 'single' })}
                                                                    disabled={!record.from_class || !record.to_class}
                                                                >
                                                                    <RotateCcw className="mr-1 h-3.5 w-3.5" />
                                                                    Revert Student
                                                                </Button>
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </DialogContent>
                </Dialog>

                <Dialog open={!!rollbackTarget} onOpenChange={(open) => !open && setRollbackTarget(null)}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>{rollbackTarget?.mode === 'single' ? 'Revert Student Promotion' : 'Revert Promotion Batch'}</DialogTitle>
                            <DialogDescription>
                                {rollbackTarget?.mode === 'single'
                                    ? <>This will move <strong>{rollbackTarget?.record?.student?.full_name || 'the selected student'}</strong> back from <strong>{formatClassName(rollbackTarget?.record?.to_class)}</strong> to <strong>{formatClassName(rollbackTarget?.record?.from_class)}</strong> for academic year <strong>{rollbackTarget?.record?.academic_year || 'N/A'}</strong>.</>
                                    : <>This will move <strong>{rollbackTarget?.batchRecords?.length || 0} students</strong> back from <strong>{formatClassName(rollbackTarget?.record?.to_class)}</strong> to <strong>{formatClassName(rollbackTarget?.record?.from_class)}</strong> for academic year <strong>{rollbackTarget?.record?.academic_year || 'N/A'}</strong>.</>}
                            </DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setRollbackTarget(null)} disabled={rollbackLoading}>
                                Cancel
                            </Button>
                            <Button type="button" variant="destructive" onClick={handleRollback} disabled={rollbackLoading}>
                                {rollbackLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Confirm Revert
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </DashboardLayout>
    );
}
