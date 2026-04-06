import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { apiClient } from '@/lib/apiClient';

interface LeadPermissions {
  isAdmin: boolean;
  moduleEnabled: boolean;
  permissionMode: 'all' | 'selected';
  teacherEnabled: boolean;
  loading: boolean;
  hasAccess: boolean;
}

export function useLeadPermissions(): LeadPermissions {
  const { user, userRole } = useAuth();
  const [moduleEnabled, setModuleEnabled] = useState(false);
  const [permissionMode, setPermissionMode] = useState<'all' | 'selected'>('all');
  const [teacherEnabled, setTeacherEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  const isAdmin = userRole === 'admin';

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const fetchPermissions = async () => {
      try {
        const settings = await apiClient.get<{
          moduleEnabled: boolean;
          permissionMode: 'all' | 'selected';
          teachers: { id: string; user_id: string; enabled?: boolean }[];
        }>('/leads/settings');

        const enabled = settings.moduleEnabled;
        const mode = settings.permissionMode || 'all';

        setModuleEnabled(enabled);
        setPermissionMode(mode as 'all' | 'selected');

        if (userRole === 'teacher' && enabled && mode === 'selected') {
          const teacher = (settings.teachers || []).find((t) => String(t.user_id) === String(user.id));
          if (teacher) {
            setTeacherEnabled(Boolean(teacher.enabled));
          } else {
            setTeacherEnabled(false);
          }
        } else if (userRole === 'teacher' && enabled && mode === 'all') {
          setTeacherEnabled(true);
        } else {
          setTeacherEnabled(false);
        }
      } catch (error) {
        console.error('Error fetching lead permissions:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPermissions();
  }, [user, userRole]);

  // Admin always has access
  const hasAccess = isAdmin || (moduleEnabled && teacherEnabled);

  return {
    isAdmin,
    moduleEnabled,
    permissionMode,
    teacherEnabled,
    loading,
    hasAccess,
  };
}
