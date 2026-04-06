import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/apiClient';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { UserPlus, History, Loader2, Users, Shield } from 'lucide-react';
import { format } from 'date-fns';

interface Teacher {
  id: string;
  user_id: string;
  teacher_id: string;
  full_name: string;
  enabled: boolean;
}

interface AuditEntry {
  id: string;
  setting_key: string;
  old_value: string | null;
  new_value: string;
  changed_by: string;
  created_at: string;
  changer_name?: string;
}

interface LeadsSettingsResponse {
  moduleEnabled: boolean;
  permissionMode: 'all' | 'selected';
  teachers: Teacher[];
  auditLog: AuditEntry[];
}

export default function LeadsSettings() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [moduleEnabled, setModuleEnabled] = useState(false);
  const [permissionMode, setPermissionMode] = useState<'all' | 'selected'>('all');
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [showAudit, setShowAudit] = useState(false);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const data = await apiClient.get<LeadsSettingsResponse>('/leads/settings');
      setModuleEnabled(!!data.moduleEnabled);
      setPermissionMode(data.permissionMode === 'selected' ? 'selected' : 'all');
      setTeachers(data.teachers || []);
      setAuditLog(data.auditLog || []);
    } catch (error) {
      console.error('Error fetching leads settings:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSettings(); }, []);

  const handleToggleModule = async (enabled: boolean) => {
    if (!user) return;
    setSaving(true);
    try {
      await apiClient.put('/leads/settings/module', { enabled });
      setModuleEnabled(enabled);
      toast({ title: `Leads module ${enabled ? 'enabled' : 'disabled'}` });
      fetchSettings(); // Refresh audit log
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleModeChange = async (mode: 'all' | 'selected') => {
    if (!user) return;
    setSaving(true);
    try {
      await apiClient.put('/leads/settings/mode', { mode });
      setPermissionMode(mode);
      toast({ title: `Permission mode set to "${mode === 'all' ? 'All Teachers' : 'Selected Teachers'}"` });
      fetchSettings();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleTeacher = async (teacherId: string, enabled: boolean) => {
    if (!user) return;
    try {
      await apiClient.put(`/leads/settings/teacher/${teacherId}`, { enabled });
      const teacher = teachers.find(t => t.id === teacherId);
      setTeachers(prev => prev.map(t =>
        t.id === teacherId ? { ...t, enabled } : t
      ));
      toast({ title: `${teacher?.full_name} leads access ${enabled ? 'enabled' : 'disabled'}` });
      fetchSettings();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleEnableAll = async () => {
    for (const teacher of teachers) {
      if (!teacher.enabled) {
        await handleToggleTeacher(teacher.id, true);
      }
    }
  };

  const handleDisableAll = async () => {
    for (const teacher of teachers) {
      if (teacher.enabled) {
        await handleToggleTeacher(teacher.id, false);
      }
    }
  };

  if (loading) {
    return (
      <Card className="card-elevated">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Global Toggle */}
      <Card className="card-elevated">
        <CardHeader>
          <CardTitle className="font-display flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            Leads Module Settings
          </CardTitle>
          <CardDescription>Control the Leads module visibility and access for teachers</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Master Toggle */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-lg bg-muted/50 border">
            <div className="min-w-0">
              <p className="font-medium">Enable Leads Module for Teachers</p>
              <p className="text-sm text-muted-foreground">
                When OFF, the Leads button is completely hidden from all teacher panels.
              </p>
              <span className="text-xs font-medium text-primary">Admin access is always available regardless of this setting.</span>
            </div>
            <Switch
              className="shrink-0"
              checked={moduleEnabled}
              onCheckedChange={handleToggleModule}
              disabled={saving}
            />
          </div>

          {moduleEnabled && (
            <>
              {/* Permission Mode */}
              <div className="space-y-3">
                <Label className="text-base font-medium">Teacher Access Mode</Label>
                <Select value={permissionMode} onValueChange={(v) => handleModeChange(v as 'all' | 'selected')}>
                  <SelectTrigger className="w-full sm:w-[300px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Enable for All Teachers
                      </div>
                    </SelectItem>
                    <SelectItem value="selected">
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4" />
                        Selected Teachers Only
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  {permissionMode === 'all'
                    ? 'All active teachers will have access to the Leads module'
                    : 'Only teachers you individually enable below will have access'}
                </p>
              </div>

              {/* Per-teacher permissions */}
              {permissionMode === 'selected' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-medium">Teacher-wise Permission</Label>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={handleEnableAll}>Enable All</Button>
                      <Button variant="outline" size="sm" onClick={handleDisableAll}>Disable All</Button>
                    </div>
                  </div>
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Teacher</TableHead>
                          <TableHead>Teacher ID</TableHead>
                          <TableHead className="text-center">Leads Access</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {teachers.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                              No active teachers found
                            </TableCell>
                          </TableRow>
                        ) : (
                          teachers.map(teacher => (
                            <TableRow key={teacher.id}>
                              <TableCell className="font-medium">{teacher.full_name}</TableCell>
                              <TableCell className="text-muted-foreground">{teacher.teacher_id}</TableCell>
                              <TableCell className="text-center">
                                <Switch
                                  checked={teacher.enabled}
                                  onCheckedChange={(checked) => handleToggleTeacher(teacher.id, checked)}
                                />
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Audit Log */}
      <Card className="card-elevated">
        <CardHeader className="cursor-pointer" onClick={() => setShowAudit(!showAudit)}>
          <CardTitle className="font-display flex items-center gap-2 text-base">
            <History className="h-5 w-5 text-primary" />
            Settings Change Log
            <Badge variant="secondary" className="ml-2">{auditLog.length}</Badge>
          </CardTitle>
          <CardDescription>Track who enabled/disabled the Leads module and when</CardDescription>
        </CardHeader>
        {showAudit && (
          <CardContent>
            {auditLog.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No changes logged yet</p>
            ) : (
              <div className="space-y-2">
                {auditLog.map(entry => (
                  <div key={entry.id} className="flex items-start justify-between p-3 rounded-lg bg-muted/30 border text-sm">
                    <div>
                      <p className="font-medium">
                        {entry.setting_key.startsWith('teacher_lead_permission:')
                          ? `Teacher: ${entry.setting_key.split(':')[1]}`
                          : entry.setting_key === 'leads_module_enabled'
                            ? 'Leads Module'
                            : 'Permission Mode'}
                      </p>
                      <p className="text-muted-foreground">
                        {entry.old_value != null && (
                          <><span className="line-through">{entry.old_value}</span> → </>
                        )}
                        <span className="font-medium">{entry.new_value}</span>
                      </p>
                    </div>
                    <div className="text-right text-muted-foreground">
                      <p>{entry.changer_name}</p>
                      <p className="text-xs">{format(new Date(entry.created_at), 'dd MMM yyyy, hh:mm a')}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        )}
      </Card>
    </div>
  );
}
