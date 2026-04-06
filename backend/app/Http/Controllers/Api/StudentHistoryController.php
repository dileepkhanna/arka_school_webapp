<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PromotionHistory;
use App\Models\Student;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class StudentHistoryController extends Controller
{
    public function show(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'admission_number' => ['required', 'string', 'max:255'],
        ]);

        $user = $request->user();
        if ($user->role?->role !== 'admin') {
            return response()->json(['message' => 'Insufficient privileges.'], 403);
        }

        $admissionNumber = trim($validated['admission_number']);

        $historyStudentId = null;
        if (Schema::hasTable('promotion_history') && Schema::hasColumn('promotion_history', 'from_admission_number')) {
            $historyStudentId = DB::table('promotion_history')
                ->whereRaw('LOWER(from_admission_number) = ?', [mb_strtolower($admissionNumber)])
                ->orWhereRaw('LOWER(to_admission_number) = ?', [mb_strtolower($admissionNumber)])
                ->orWhereRaw('LOWER(from_login_id) = ?', [mb_strtolower($admissionNumber)])
                ->orWhereRaw('LOWER(to_login_id) = ?', [mb_strtolower($admissionNumber)])
                ->value('student_id');
        }

        $student = Student::query()
            ->leftJoin('classes', 'classes.id', '=', 'students.class_id')
            ->leftJoin('teachers', 'teachers.id', '=', 'classes.class_teacher_id')
            ->leftJoin('profiles', 'profiles.user_id', '=', 'teachers.user_id')
            ->where(function ($query) use ($admissionNumber, $historyStudentId) {
                $query->whereRaw('LOWER(students.admission_number) = ?', [mb_strtolower($admissionNumber)])
                    ->orWhereRaw('LOWER(students.login_id) = ?', [mb_strtolower($admissionNumber)]);

                if ($historyStudentId) {
                    $query->orWhere('students.id', $historyStudentId);
                }
            })
            ->select(
                'students.id',
                'students.admission_number',
                'students.login_id',
                'students.full_name',
                'students.date_of_birth',
                'students.address',
                'students.photo_url',
                'students.status',
                'students.class_id',
                'students.blood_group',
                'students.parent_name',
                'students.parent_phone',
                'students.emergency_contact',
                'students.emergency_contact_name',
                'classes.name as class_name',
                'classes.section as class_section',
                'teachers.id as class_teacher_id',
                'profiles.full_name as class_teacher_name'
            )
            ->first();

        if (! $student) {
            return response()->json(['message' => 'Student not found.'], 404);
        }

        $attendance = Schema::hasTable('attendance')
            ? DB::table('attendance')
                ->select(
                    'id',
                    'date',
                    'status',
                    'class_id_snapshot',
                    'class_name_snapshot',
                    'class_section_snapshot'
                )
                ->where('student_id', $student->id)
                ->orderByDesc('date')
                ->limit(100)
                ->get()
                ->map(fn ($row) => [
                    'id' => (int) $row->id,
                    'date' => $row->date,
                    'status' => $row->status,
                    'class_id_snapshot' => $row->class_id_snapshot !== null ? (int) $row->class_id_snapshot : null,
                    'classes' => $row->class_name_snapshot ? [
                        'id' => $row->class_id_snapshot !== null ? (int) $row->class_id_snapshot : null,
                        'name' => $row->class_name_snapshot,
                        'section' => $row->class_section_snapshot,
                    ] : null,
                ])
                ->values()
            : collect();

        $examMarks = Schema::hasTable('exam_marks')
            ? DB::table('exam_marks')
                ->leftJoin('exams', 'exams.id', '=', 'exam_marks.exam_id')
                ->leftJoin('subjects', 'subjects.id', '=', 'exams.subject_id')
                ->leftJoin('classes', 'classes.id', '=', 'exam_marks.class_id_snapshot')
                ->where('exam_marks.student_id', $student->id)
                ->select(
                    'exam_marks.id',
                    'exam_marks.marks_obtained',
                    'exam_marks.grade',
                    'exam_marks.remarks',
                    'exams.name as exam_name',
                    'exams.exam_date',
                    'exams.max_marks',
                    'subjects.name as subject_name',
                    'exam_marks.class_id_snapshot',
                    'exam_marks.class_name_snapshot',
                    'exam_marks.class_section_snapshot',
                    'classes.name as fallback_class_name',
                    'classes.section as fallback_class_section'
                )
                ->orderByDesc('exam_marks.created_at')
                ->get()
                ->map(fn ($row) => [
                    'id' => (string) $row->id,
                    'marks_obtained' => $row->marks_obtained,
                    'grade' => $row->grade,
                    'remarks' => $row->remarks,
                    'exams' => $row->exam_name ? [
                        'name' => $row->exam_name,
                        'exam_date' => $row->exam_date,
                        'max_marks' => $row->max_marks,
                        'class_id' => $row->class_id_snapshot !== null ? (int) $row->class_id_snapshot : null,
                        'classes' => ($row->class_name_snapshot || $row->fallback_class_name) ? [
                            'id' => $row->class_id_snapshot !== null ? (int) $row->class_id_snapshot : null,
                            'name' => $row->class_name_snapshot ?: $row->fallback_class_name,
                            'section' => $row->class_section_snapshot ?: $row->fallback_class_section,
                        ] : null,
                        'subjects' => $row->subject_name ? ['name' => $row->subject_name] : null,
                    ] : null,
                ])
                ->values()
            : collect();

        $fees = Schema::hasTable('fees')
            ? DB::table('fees')
                ->leftJoin('classes as assigned_classes', 'assigned_classes.id', '=', 'fees.assigned_class_id')
                ->where('student_id', $student->id)
                ->select(
                    'fees.id',
                    'fees.student_id',
                    'fees.assigned_class_id',
                    'fees.fee_type',
                    'fees.amount',
                    'fees.discount',
                    'fees.paid_amount',
                    'fees.due_date',
                    'fees.payment_status',
                    'fees.paid_at',
                    'fees.receipt_number',
                    'assigned_classes.name as assigned_class_name',
                    'assigned_classes.section as assigned_class_section'
                )
                ->orderByDesc('due_date')
                ->get()
                ->map(fn ($row) => [
                    'id' => (string) $row->id,
                    'student_id' => (string) $row->student_id,
                    'assigned_class_id' => $row->assigned_class_id !== null ? (int) $row->assigned_class_id : null,
                    'fee_type' => $row->fee_type,
                    'amount' => (float) $row->amount,
                    'discount' => $row->discount !== null ? (float) $row->discount : null,
                    'paid_amount' => $row->paid_amount !== null ? (float) $row->paid_amount : null,
                    'due_date' => $row->due_date,
                    'payment_status' => $row->payment_status,
                    'paid_at' => $row->paid_at,
                    'receipt_number' => $row->receipt_number,
                    'assigned_class' => $row->assigned_class_name ? [
                        'id' => (int) $row->assigned_class_id,
                        'name' => $row->assigned_class_name,
                        'section' => $row->assigned_class_section,
                    ] : null,
                ])
                ->values()
            : collect();

        $promotionHistory = PromotionHistory::with([
            'student:id,full_name,admission_number,login_id',
            'fromClass:id,name,section',
            'toClass:id,name,section',
        ])
            ->where('student_id', $student->id)
            ->orderByDesc('created_at')
            ->get()
            ->map(fn (PromotionHistory $history) => [
                'id' => $history->id,
                'student' => $history->student ? [
                    'id' => $history->student->id,
                    'full_name' => $history->student->full_name,
                    'admission_number' => $history->student->admission_number,
                    'login_id' => $history->student->login_id,
                ] : null,
                'from_class' => $history->fromClass ? [
                    'id' => $history->fromClass->id,
                    'name' => $history->fromClass->name,
                    'section' => $history->fromClass->section,
                ] : null,
                'to_class' => $history->toClass ? [
                    'id' => $history->toClass->id,
                    'name' => $history->toClass->name,
                    'section' => $history->toClass->section,
                ] : null,
                'academic_year' => $history->academic_year,
                'from_admission_number' => $history->from_admission_number,
                'to_admission_number' => $history->to_admission_number,
                'from_login_id' => $history->from_login_id,
                'to_login_id' => $history->to_login_id,
                'created_at' => $history->created_at,
            ])
            ->values();

        return response()->json([
            'student' => [
                'id' => (int) $student->id,
                'admission_number' => $student->admission_number,
                'login_id' => $student->login_id,
                'full_name' => $student->full_name,
                'date_of_birth' => $student->date_of_birth,
                'address' => $student->address,
                'photo_url' => $student->photo_url,
                'status' => $student->status,
                'class_id' => $student->class_id,
                'blood_group' => $student->blood_group,
                'parent_name' => $student->parent_name,
                'parent_phone' => $student->parent_phone,
                'emergency_contact' => $student->emergency_contact,
                'emergency_contact_name' => $student->emergency_contact_name,
                'classes' => $student->class_name ? [
                    'name' => $student->class_name,
                    'section' => $student->class_section,
                ] : null,
                'class_teacher' => $student->class_teacher_id ? [
                    'id' => (int) $student->class_teacher_id,
                    'full_name' => $student->class_teacher_name,
                ] : null,
            ],
            'attendance' => $attendance,
            'exam_marks' => $examMarks,
            'fees' => $fees,
            'promotion_history' => $promotionHistory,
        ]);
    }
}
