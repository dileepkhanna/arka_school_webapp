import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

// Admin Pages
import AdminDashboard from "./pages/admin/AdminDashboard";
import TeachersManagement from "./pages/admin/TeachersManagement";
import StudentsManagement from "./pages/admin/StudentsManagement";
import ClassesManagement from "./pages/admin/ClassesManagement";
import SubjectsManagement from "./pages/admin/SubjectsManagement";
import TimetableManagement from "./pages/admin/TimetableManagement";
import AttendanceManagement from "./pages/admin/AttendanceManagement";
import ExamsManagement from "./pages/admin/ExamsManagement";
import AnnouncementsManagement from "./pages/admin/AnnouncementsManagement";
import LeaveManagement from "./pages/admin/LeaveManagement";
import ComplaintsManagement from "./pages/admin/ComplaintsManagement";
import FeesManagement from "./pages/admin/FeesManagement";
import CertificatesManagement from "./pages/admin/CertificatesManagement";
import AdminMessages from "./pages/admin/AdminMessages";
import SettingsPage from "./pages/admin/SettingsPage";
import LeadsManagement from "./pages/admin/LeadsManagement";
import GalleryManagement from "./pages/admin/GalleryManagement";
import SyllabusManagement from "./pages/admin/SyllabusManagement";
import AdminNotifications from "./pages/admin/AdminNotifications";
import WeeklyExamsManagement from "./pages/admin/WeeklyExamsManagement";
import AcademicCalendar from "./pages/admin/AcademicCalendar";
import StudentPromotion from "./pages/admin/StudentPromotion";
import StudentHistory from "./pages/admin/StudentHistory";
import TeacherAcademicCalendar from "./pages/teacher/TeacherAcademicCalendar";
import ParentAcademicCalendar from "./pages/parent/ParentAcademicCalendar";


// Teacher Pages
import TeacherDashboard from "./pages/teacher/TeacherDashboard";
import TeacherClasses from "./pages/teacher/TeacherClasses";
import TeacherStudents from "./pages/teacher/TeacherStudents";
import TeacherAttendance from "./pages/teacher/TeacherAttendance";
import TeacherHomework from "./pages/teacher/TeacherHomework";
import TeacherExams from "./pages/teacher/TeacherExams";
import TeacherReports from "./pages/teacher/TeacherReports";
import TeacherAnnouncements from "./pages/teacher/TeacherAnnouncements";
import TeacherLeave from "./pages/teacher/TeacherLeave";
import TeacherMessages from "./pages/teacher/TeacherMessages";
import TeacherTimetable from "./pages/teacher/TeacherTimetable";
import TeacherLeads from "./pages/teacher/TeacherLeads";
import TeacherGallery from "./pages/teacher/TeacherGallery";
import TeacherSyllabus from "./pages/teacher/TeacherSyllabus";
import TeacherWeeklyExams from "./pages/teacher/TeacherWeeklyExams";
import TeacherNotifications from "./pages/teacher/TeacherNotifications";
import TeacherSettings from "./pages/teacher/TeacherSettings";
// Parent Pages
import ParentDashboard from "./pages/parent/ParentDashboard";
import ParentChild from "./pages/parent/ParentChild";
import ParentAttendance from "./pages/parent/ParentAttendance";
import ParentTimetable from "./pages/parent/ParentTimetable";
import ParentHomework from "./pages/parent/ParentHomework";
import ParentSyllabus from "./pages/parent/ParentSyllabus";
import ParentExams from "./pages/parent/ParentExams";
import ParentProgress from "./pages/parent/ParentProgress";
import ParentAnnouncements from "./pages/parent/ParentAnnouncements";
import ParentLeave from "./pages/parent/ParentLeave";
import ParentMessages from "./pages/parent/ParentMessages";
import ParentCertificates from "./pages/parent/ParentCertificates";
import ParentFees from "./pages/parent/ParentFees";
import ParentGallery from "./pages/parent/ParentGallery";
import ParentNotifications from "./pages/parent/ParentNotifications";
import ParentSettings from "./pages/parent/ParentSettings";
import ParentComplaints from "./pages/parent/ParentComplaints";
import TermsAndConditions from "./pages/TermsAndConditions";
import PrivacyPolicy from "./pages/PrivacyPolicy";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />

            {/* Admin Routes */}
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/teachers" element={<TeachersManagement />} />
            <Route path="/admin/students" element={<StudentsManagement />} />
            <Route path="/admin/student-history" element={<StudentHistory />} />
            <Route path="/admin/promotion" element={<StudentPromotion />} />
            <Route path="/admin/classes" element={<ClassesManagement />} />
            <Route path="/admin/subjects" element={<SubjectsManagement />} />
            <Route path="/admin/timetable" element={<TimetableManagement />} />
            <Route path="/admin/attendance" element={<AttendanceManagement />} />
            <Route path="/admin/exams" element={<ExamsManagement />} />
            <Route path="/admin/syllabus" element={<SyllabusManagement />} />

            <Route path="/admin/announcements" element={<AnnouncementsManagement />} />
            <Route path="/admin/leave" element={<LeaveManagement />} />
            <Route path="/admin/complaints" element={<ComplaintsManagement />} />
            <Route path="/admin/fees" element={<FeesManagement />} />
            <Route path="/admin/certificates" element={<CertificatesManagement />} />
            <Route path="/admin/messages" element={<AdminMessages />} />
            <Route path="/admin/leads" element={<LeadsManagement />} />
            <Route path="/admin/gallery" element={<GalleryManagement />} />
            <Route path="/admin/notifications" element={<AdminNotifications />} />
            <Route path="/admin/weekly-exams" element={<WeeklyExamsManagement />} />
            <Route path="/admin/academic-calendar" element={<AcademicCalendar />} />
            <Route path="/admin/holiday-calendar" element={<AcademicCalendar />} />
            <Route path="/admin/settings" element={<SettingsPage />} />

            {/* Teacher Routes */}
            <Route path="/teacher" element={<TeacherDashboard />} />
            <Route path="/teacher/classes" element={<TeacherClasses />} />
            <Route path="/teacher/students" element={<TeacherStudents />} />
            <Route path="/teacher/attendance" element={<TeacherAttendance />} />
            <Route path="/teacher/homework" element={<TeacherHomework />} />
            <Route path="/teacher/exams" element={<TeacherExams />} />
            <Route path="/teacher/reports" element={<TeacherReports />} />
            <Route path="/teacher/announcements" element={<TeacherAnnouncements />} />
            <Route path="/teacher/leave" element={<TeacherLeave />} />
            <Route path="/teacher/timetable" element={<TeacherTimetable />} />
            <Route path="/teacher/leads" element={<TeacherLeads />} />
            <Route path="/teacher/gallery" element={<TeacherGallery />} />
            <Route path="/teacher/syllabus" element={<TeacherSyllabus />} />
            <Route path="/teacher/weekly-exams" element={<TeacherWeeklyExams />} />
            <Route path="/teacher/notifications" element={<TeacherNotifications />} />
            <Route path="/teacher/messages" element={<TeacherMessages />} />
            <Route path="/teacher/settings" element={<TeacherSettings />} />
            <Route path="/teacher/academic-calendar" element={<TeacherAcademicCalendar />} />
            <Route path="/teacher/holiday-calendar" element={<TeacherAcademicCalendar />} />

            {/* Parent Routes */}
            <Route path="/parent" element={<ParentDashboard />} />
            <Route path="/parent/child" element={<ParentChild />} />
            <Route path="/parent/attendance" element={<ParentAttendance />} />
            <Route path="/parent/timetable" element={<ParentTimetable />} />
            <Route path="/parent/homework" element={<ParentHomework />} />
            <Route path="/parent/syllabus" element={<ParentSyllabus />} />
            <Route path="/parent/exams" element={<ParentExams />} />
            <Route path="/parent/progress" element={<ParentProgress />} />
            <Route path="/parent/announcements" element={<ParentAnnouncements />} />
            <Route path="/parent/leave" element={<ParentLeave />} />
            <Route path="/parent/messages" element={<ParentMessages />} />
            <Route path="/parent/certificates" element={<ParentCertificates />} />
            <Route path="/parent/gallery" element={<ParentGallery />} />
            <Route path="/parent/notifications" element={<ParentNotifications />} />
            <Route path="/parent/fees" element={<ParentFees />} />
            <Route path="/parent/complaints" element={<ParentComplaints />} />
            <Route path="/parent/settings" element={<ParentSettings />} />
            <Route path="/parent/academic-calendar" element={<ParentAcademicCalendar />} />
            <Route path="/parent/holiday-calendar" element={<ParentAcademicCalendar />} />

            {/* Public Routes */}
            <Route path="/terms-and-conditions" element={<TermsAndConditions />} />
            <Route path="/privacy-policy" element={<PrivacyPolicy />} />

            {/* Catch-all */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
