import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, BookOpen, Clock3, CreditCard, History, Loader2, Search, UserRound } from 'lucide-react';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { adminSidebarItems } from '@/config/adminSidebar';
import { useAuth } from '@/hooks/useAuth';
import { apiClient } from '@/lib/apiClient';
import { useToast } from '@/hooks/use-toast';
import { BackButton } from '@/components/ui/back-button';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';

interface StudentDirectoryItem {
    id: number;
    admission_number: string;
    login_id?: string | null;
    full_name: string;
    date_of_birth: string | null;
    address: string | null;
    photo_url: string | null;
    status: string;
    class_id: number | null;
    blood_group: string | null;
    parent_name: string | null;
    parent_phone: string | null;
    emergency_contact: string | null;
    emergency_contact_name: string | null;
    classes: { name: string; section: string } | null;
    class_teacher?: { id: number; full_name: string | null } | null;
}

interface AttendanceRecord {
    id: number;
    date: string;
    status: 'present' | 'absent' | 'late';
    class_id_snapshot?: number | null;
    classes?: { id?: number | null; name: string; section: string } | null;
}

interface ExamMark {
    id: string;
    marks_obtained: number | null;
    grade: string | null;
    remarks: string | null;
    exams: {
        name: string;
        exam_date: string | null;
        max_marks: number | null;
        class_id?: number | null;
        classes?: { id?: number | null; name: string; section: string } | null;
        subjects: { name: string } | null;
    } | null;
}

interface FeeRecord {
    id: string;
    student_id: string;
    assigned_class_id?: number | null;
    assigned_class?: { id: number; name: string; section: string } | null;
    fee_type: string;
    amount: number;
    discount: number | null;
    paid_amount: number | null;
    due_date: string;
    payment_status: string;
    paid_at: string | null;
    receipt_number: string | null;
    students?: {
        full_name: string;
        admission_number: string;
        login_id?: string | null;
        classes?: { name: string; section: string; id?: string } | null;
    } | null;
}

interface PromotionRecord {
    id: number;
    student: { id: number; full_name: string; admission_number: string; login_id?: string | null } | null;
    from_class: { id: number; name: string; section: string } | null;
    to_class: { id: number; name: string; section: string } | null;
    from_admission_number?: string | null;
    to_admission_number?: string | null;
    from_login_id?: string | null;
    to_login_id?: string | null;
    academic_year: string;
    created_at: string;
}

interface StudentHistoryResponse {
    student: StudentDirectoryItem;
    attendance: AttendanceRecord[];
    exam_marks: ExamMark[];
    fees: FeeRecord[];
    promotion_history: PromotionRecord[];
}

const formatClassName = (classes: { name: string; section: string } | null | undefined) => {
    if (!classes) return 'Not assigned';
    return classes.section ? `${classes.name} - ${classes.section}` : classes.name;
};

export default function StudentHistory() {
    const { user, userRole, loading } = useAuth();
    const navigate = useNavigate();
    const { toast } = useToast();

    const [admissionNumber, setAdmissionNumber] = useState('');
    const [selectedStudent, setSelectedStudent] = useState<StudentDirectoryItem | null>(null);
    const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
    const [examMarks, setExamMarks] = useState<ExamMark[]>([]);
    const [fees, setFees] = useState<FeeRecord[]>([]);
    const [promotionHistory, setPromotionHistory] = useState<PromotionRecord[]>([]);
    const [searchLoading, setSearchLoading] = useState(false);

    useEffect(() => {
        if (!loading && (!user || userRole !== 'admin')) {
            navigate('/auth');
        }
    }, [loading, navigate, user, userRole]);

    const attendanceStats = useMemo(() => {
        const total = attendance.length;
        const present = attendance.filter((item) => item.status === 'present').length;
        const absent = attendance.filter((item) => item.status === 'absent').length;
        const late = attendance.filter((item) => item.status === 'late').length;
        return {
            total,
            present,
            absent,
            late,
            percentage: total > 0 ? Math.round(((present + late) / total) * 100) : 0,
        };
    }, [attendance]);

    const feeStats = useMemo(() => {
        const total = fees.reduce((sum, item) => sum + item.amount, 0);
        const discount = fees.reduce((sum, item) => sum + (item.discount || 0), 0);
        const paid = fees.reduce((sum, item) => sum + (item.paid_amount || 0), 0);
        return {
            total,
            discount,
            paid,
            balance: total - discount - paid,
        };
    }, [fees]);

    const handleSearch = async () => {
        const normalizedAdmission = admissionNumber.trim().toLowerCase();
        if (!normalizedAdmission) {
            toast({ variant: 'destructive', title: 'Admission number required', description: 'Enter an admission number to load student history.' });
            return;
        }

        setSearchLoading(true);
        try {
            const data = await apiClient.get<StudentHistoryResponse>(`/students/history?admission_number=${encodeURIComponent(admissionNumber.trim())}`);

            setSelectedStudent(data.student || null);
            setAttendance(data.attendance || []);
            setExamMarks(data.exam_marks || []);
            setFees(data.fees || []);
            setPromotionHistory(data.promotion_history || []);
        } catch (error: any) {
            setSelectedStudent(null);
            setAttendance([]);
            setExamMarks([]);
            setFees([]);
            setPromotionHistory([]);
            toast({
                variant: 'destructive',
                title: 'History load failed',
                description: error.message || 'Unable to load the full student history.',
            });
        } finally {
            setSearchLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <DashboardLayout sidebarItems={adminSidebarItems} roleColor="admin">
            <div className="space-y-6 animate-fade-in">
                <BackButton to="/admin" />

                <div>
                    <h1 className="font-display text-2xl font-bold">Student History</h1>
                    <p className="text-muted-foreground">Search by admission number or login ID and view full student history on one page.</p>
                </div>

                <Card className="card-elevated">
                    <CardContent className="pt-6">
                        <div className="flex flex-col gap-3 md:flex-row">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                    value={admissionNumber}
                                    onChange={(event) => setAdmissionNumber(event.target.value)}
                                    onKeyDown={(event) => {
                                        if (event.key === 'Enter') {
                                            handleSearch();
                                        }
                                    }}
                                    placeholder="Enter admission number or login ID"
                                    className="pl-10"
                                />
                            </div>
                            <Button onClick={handleSearch} disabled={searchLoading} className="gradient-admin">
                                {searchLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Search History
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {!selectedStudent ? (
                    <Card className="card-elevated">
                        <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center text-muted-foreground">
                            <History className="h-12 w-12" />
                            <div>
                                <p className="font-medium">No student selected</p>
                                <p className="text-sm">Search by admission number to view profile, attendance, exam, fee, and promotion history.</p>
                            </div>
                        </CardContent>
                    </Card>
                ) : (
                    <>
                        <Card className="card-elevated">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2"><UserRound className="h-5 w-5" />Student Profile</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                                    <div>
                                        <p className="text-sm text-muted-foreground">Full Name</p>
                                        <p className="font-semibold">{selectedStudent.full_name}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">Admission Number</p>
                                        <p className="font-mono font-semibold">{selectedStudent.admission_number}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">Login ID</p>
                                        <p className="font-mono font-semibold">{selectedStudent.login_id || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">Current Class</p>
                                        <p className="font-semibold">{formatClassName(selectedStudent.classes)}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">Current Class ID</p>
                                        <p className="font-semibold">{selectedStudent.class_id ?? 'N/A'}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">Status</p>
                                        <Badge className={selectedStudent.status === 'active' ? 'status-active' : 'status-inactive'}>{selectedStudent.status}</Badge>
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">Parent</p>
                                        <p className="font-semibold">{selectedStudent.parent_name || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">Parent Phone</p>
                                        <p className="font-semibold">{selectedStudent.parent_phone || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">Current Class Teacher</p>
                                        <p className="font-semibold">{selectedStudent.class_teacher?.full_name || 'N/A'}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
                            <Card className="card-elevated">
                                <CardContent className="pt-6">
                                    <p className="text-sm text-muted-foreground">Attendance Rate</p>
                                    <p className="text-2xl font-bold">{attendanceStats.percentage}%</p>
                                </CardContent>
                            </Card>
                            <Card className="card-elevated">
                                <CardContent className="pt-6">
                                    <p className="text-sm text-muted-foreground">Exam Records</p>
                                    <p className="text-2xl font-bold">{examMarks.length}</p>
                                </CardContent>
                            </Card>
                            <Card className="card-elevated">
                                <CardContent className="pt-6">
                                    <p className="text-sm text-muted-foreground">Fee Balance</p>
                                    <p className="text-2xl font-bold">₹{feeStats.balance.toLocaleString()}</p>
                                </CardContent>
                            </Card>
                            <Card className="card-elevated">
                                <CardContent className="pt-6">
                                    <p className="text-sm text-muted-foreground">Promotion Entries</p>
                                    <p className="text-2xl font-bold">{promotionHistory.length}</p>
                                </CardContent>
                            </Card>
                        </div>

                        <Card className="card-elevated">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2"><Clock3 className="h-5 w-5" />Attendance History</CardTitle>
                            </CardHeader>
                            <CardContent>
                                {attendance.length === 0 ? (
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground"><AlertCircle className="h-4 w-4" />No attendance records found.</div>
                                ) : (
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Date</TableHead>
                                                <TableHead>Record Class</TableHead>
                                                <TableHead>Status</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {attendance.map((record) => (
                                                <TableRow key={record.id}>
                                                    <TableCell>{new Date(record.date).toLocaleDateString()}</TableCell>
                                                    <TableCell>
                                                        <div className="text-xs">
                                                            <div>{formatClassName(record.classes)}</div>
                                                            <div className="text-muted-foreground">Class ID: {record.class_id_snapshot ?? 'N/A'}</div>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="capitalize">{record.status}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                )}
                            </CardContent>
                        </Card>

                        <Card className="card-elevated">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2"><BookOpen className="h-5 w-5" />Exam History</CardTitle>
                            </CardHeader>
                            <CardContent>
                                {examMarks.length === 0 ? (
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground"><AlertCircle className="h-4 w-4" />No exam records found.</div>
                                ) : (
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Exam</TableHead>
                                                <TableHead>Subject</TableHead>
                                                <TableHead>Exam Class</TableHead>
                                                <TableHead>Marks</TableHead>
                                                <TableHead>Grade</TableHead>
                                                <TableHead>Date</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {examMarks.map((mark) => (
                                                <TableRow key={mark.id}>
                                                    <TableCell>{mark.exams?.name || 'N/A'}</TableCell>
                                                    <TableCell>{mark.exams?.subjects?.name || 'N/A'}</TableCell>
                                                    <TableCell>
                                                        <div className="text-xs">
                                                            <div>{formatClassName(mark.exams?.classes)}</div>
                                                            <div className="text-muted-foreground">Class ID: {mark.exams?.class_id ?? 'N/A'}</div>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>{mark.marks_obtained ?? '-'} / {mark.exams?.max_marks ?? '-'}</TableCell>
                                                    <TableCell>{mark.grade || '-'}</TableCell>
                                                    <TableCell>{mark.exams?.exam_date ? new Date(mark.exams.exam_date).toLocaleDateString() : 'N/A'}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                )}
                            </CardContent>
                        </Card>

                        <Card className="card-elevated">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2"><CreditCard className="h-5 w-5" />Fee History</CardTitle>
                            </CardHeader>
                            <CardContent>
                                {fees.length === 0 ? (
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground"><AlertCircle className="h-4 w-4" />No fee records found.</div>
                                ) : (
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Fee Type</TableHead>
                                                <TableHead>Fee Class</TableHead>
                                                <TableHead>Amount</TableHead>
                                                <TableHead>Paid</TableHead>
                                                <TableHead>Balance</TableHead>
                                                <TableHead>Status</TableHead>
                                                <TableHead>Due Date</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {fees.map((fee) => (
                                                <TableRow key={fee.id}>
                                                    <TableCell>{fee.fee_type}</TableCell>
                                                    <TableCell>
                                                        <div className="text-xs">
                                                            <div>{formatClassName(fee.assigned_class)}</div>
                                                            <div className="text-muted-foreground">Class ID: {fee.assigned_class_id ?? 'N/A'}</div>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>₹{fee.amount.toLocaleString()}</TableCell>
                                                    <TableCell>₹{(fee.paid_amount || 0).toLocaleString()}</TableCell>
                                                    <TableCell>₹{(fee.amount - (fee.discount || 0) - (fee.paid_amount || 0)).toLocaleString()}</TableCell>
                                                    <TableCell className="capitalize">{fee.payment_status}</TableCell>
                                                    <TableCell>{new Date(fee.due_date).toLocaleDateString()}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                )}
                            </CardContent>
                        </Card>

                        <Card className="card-elevated">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2"><History className="h-5 w-5" />Promotion History</CardTitle>
                            </CardHeader>
                            <CardContent>
                                {promotionHistory.length === 0 ? (
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground"><AlertCircle className="h-4 w-4" />No promotion history found.</div>
                                ) : (
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>From Class</TableHead>
                                                <TableHead>To Class</TableHead>
                                                <TableHead>Class IDs</TableHead>
                                                <TableHead>Admission / Login Change</TableHead>
                                                <TableHead>Academic Year</TableHead>
                                                <TableHead>Promoted On</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {promotionHistory.map((record) => (
                                                <TableRow key={record.id}>
                                                    <TableCell>{record.from_class ? formatClassName(record.from_class) : 'N/A'}</TableCell>
                                                    <TableCell>{record.to_class ? formatClassName(record.to_class) : 'N/A'}</TableCell>
                                                    <TableCell>
                                                        <div className="text-xs">
                                                            <div>Old: {record.from_class?.id ?? 'N/A'}</div>
                                                            <div className="text-muted-foreground">Current: {record.to_class?.id ?? selectedStudent.class_id ?? 'N/A'}</div>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="text-xs">
                                                            <div>{record.from_admission_number || record.student?.admission_number || 'N/A'} {'->'} {record.to_admission_number || record.student?.admission_number || 'N/A'}</div>
                                                            <div className="text-muted-foreground">{record.from_login_id || record.student?.login_id || 'N/A'} {'->'} {record.to_login_id || record.student?.login_id || 'N/A'}</div>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>{record.academic_year}</TableCell>
                                                    <TableCell>{new Date(record.created_at).toLocaleString()}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                )}
                            </CardContent>
                        </Card>
                    </>
                )}
            </div>
        </DashboardLayout>
    );
}
