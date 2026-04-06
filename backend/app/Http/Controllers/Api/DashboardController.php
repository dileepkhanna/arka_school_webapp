<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CertificateRequest;
use App\Models\ClassroomAnnouncement;
use App\Models\Complaint;
use App\Models\LeaveRequest;
use App\Models\SchoolClass;
use App\Models\Student;
use App\Models\Teacher;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class DashboardController extends Controller
{
    public function stats(): JsonResponse
    {
        $today = now()->toDateString();
        
        // Calculate today's attendance rate
        $totalStudents = Student::count();
        $todayAttendance = DB::table('attendance')
            ->where('date', $today)
            ->where('status', 'present')
            ->count();
        
        $todayAttendanceRate = $totalStudents > 0
            ? round(($todayAttendance / $totalStudents) * 100, 1)
            : 0;

        return response()->json([
            'students' => $totalStudents,
            'teachers' => Teacher::count(),
            'classes' => SchoolClass::count(),
            'today_attendance_rate' => $todayAttendanceRate,
            'pending_leave_requests' => LeaveRequest::where('status', 'pending')->count(),
            'pending_certificate_requests' => CertificateRequest::where('status', 'pending')->count(),
            'open_complaints' => Complaint::where('status', 'open')->count(),
            'latest_announcements' => ClassroomAnnouncement::orderByDesc('created_at')->limit(4)->get(),
        ]);
    }
}
