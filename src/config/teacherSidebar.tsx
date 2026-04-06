import {
  LayoutDashboard,
  GraduationCap,
  Users,
  Clock,
  BookOpen,
  FileText,
  ClipboardList,
  Bell,
  Calendar,
  MessageSquare,
  UserPlus,
  Image,
  LibraryBig,
  Settings,
  CalendarDays,
} from 'lucide-react';

interface SidebarItem {
  icon: React.ReactNode;
  label: string;
  path: string;
}

const baseTeacherSidebarItems: SidebarItem[] = [
  { icon: <LayoutDashboard className="h-5 w-5" />, label: 'Dashboard', path: '/teacher' },
  { icon: <GraduationCap className="h-5 w-5" />, label: 'My Classes', path: '/teacher/classes' },
  { icon: <Users className="h-5 w-5" />, label: 'Students', path: '/teacher/students' },
  { icon: <Clock className="h-5 w-5" />, label: 'Attendance', path: '/teacher/attendance' },
  { icon: <BookOpen className="h-5 w-5" />, label: 'Homework', path: '/teacher/homework' },
  { icon: <FileText className="h-5 w-5" />, label: 'Exam Marks', path: '/teacher/exams' },
  { icon: <LibraryBig className="h-5 w-5" />, label: 'Syllabus', path: '/teacher/syllabus' },
  { icon: <Calendar className="h-5 w-5" />, label: 'Weekly Exams', path: '/teacher/weekly-exams' },
  { icon: <ClipboardList className="h-5 w-5" />, label: 'Reports', path: '/teacher/reports' },
  { icon: <Bell className="h-5 w-5" />, label: 'Announcements', path: '/teacher/announcements' },
  { icon: <Clock className="h-5 w-5" />, label: 'Timetable', path: '/teacher/timetable' },
  { icon: <Calendar className="h-5 w-5" />, label: 'Leave Request', path: '/teacher/leave' },
  { icon: <Image className="h-5 w-5" />, label: 'Gallery', path: '/teacher/gallery' },
  { icon: <CalendarDays className="h-5 w-5" />, label: 'Academic Calendar', path: '/teacher/academic-calendar' },
  { icon: <Bell className="h-5 w-5" />, label: 'Notifications', path: '/teacher/notifications' },
  { icon: <MessageSquare className="h-5 w-5" />, label: 'Messages', path: '/teacher/messages' },
  { icon: <Settings className="h-5 w-5" />, label: 'Settings', path: '/teacher/settings' },
];

const leadsItem: SidebarItem = {
  icon: <UserPlus className="h-5 w-5" />,
  label: 'Leads',
  path: '/teacher/leads',
};

export function getTeacherSidebarItems(showLeads: boolean): SidebarItem[] {
  if (!showLeads) return baseTeacherSidebarItems;

  // Insert leads before Messages
  const items = [...baseTeacherSidebarItems];
  const messagesIndex = items.findIndex(i => i.path === '/teacher/messages');
  if (messagesIndex !== -1) {
    items.splice(messagesIndex, 0, leadsItem);
  } else {
    items.push(leadsItem);
  }
  return items;
}

// Default export for backward compatibility (includes leads)
export const teacherSidebarItems = baseTeacherSidebarItems;
