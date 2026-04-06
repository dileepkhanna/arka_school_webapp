import { useLeadPermissions } from '@/hooks/useLeadPermissions';
import { getTeacherSidebarItems } from '@/config/teacherSidebar';

export function useTeacherSidebar() {
  const { hasAccess } = useLeadPermissions();
  return getTeacherSidebarItems(hasAccess);
}
