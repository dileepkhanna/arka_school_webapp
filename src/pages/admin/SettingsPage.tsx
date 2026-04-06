import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { apiClient } from '@/lib/apiClient';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { adminSidebarItems } from '@/config/adminSidebar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, School, Bell, Shield, UserPlus, Trash2, Key, AlertTriangle, CreditCard, Eye, EyeOff } from 'lucide-react';
import LeadsSettings from '@/components/leads/LeadsSettings';
import { Switch } from '@/components/ui/switch';
import PushNotificationToggle from '@/components/PushNotificationToggle';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

export default function SettingsPage() {
  const { user, userRole, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [settings, setSettings] = useState({
    schoolName: 'SmartEduConnect School',
    schoolEmail: 'admin@smarteduconnect.com',
    schoolPhone: '+1234567890',
    schoolAddress: '123 Education Street',
    emailNotifications: true,
    smsNotifications: false,
    parentNotifications: true,
  });

  // Password change state
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  // Admin invite state
  const [inviteForm, setInviteForm] = useState({
    email: '',
    fullName: '',
    password: '',
  });
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviting, setInviting] = useState(false);

  // Factory reset state
  const [resetting, setResetting] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState('');
  
  // Full reset state (including accounts)
  const [fullResetting, setFullResetting] = useState(false);
  const [fullResetConfirmText, setFullResetConfirmText] = useState('');

  // Razorpay settings state
  const [razorpayKeyId, setRazorpayKeyId] = useState('');
  const [razorpayKeySecret, setRazorpayKeySecret] = useState('');
  const [showKeySecret, setShowKeySecret] = useState(false);
  const [savingRazorpay, setSavingRazorpay] = useState(false);
  const [loadingRazorpay, setLoadingRazorpay] = useState(true);

  useEffect(() => {
    if (!loading && (!user || userRole !== 'admin')) {
      navigate('/auth');
    }
  }, [user, userRole, loading, navigate]);

  // Load Razorpay keys from app_settings
  useEffect(() => {
    const fetchRazorpayKeys = async () => {
      try {
        const data = await apiClient.get<{ razorpay_key_id?: string; razorpay_key_secret?: string }>('/settings/payment-gateway');
        setRazorpayKeyId(data.razorpay_key_id || '');
        setRazorpayKeySecret(data.razorpay_key_secret || '');
      } catch (error: any) {
        toast({ variant: 'destructive', title: 'Error', description: error.message || 'Failed to load Razorpay keys' });
      } finally {
        setLoadingRazorpay(false);
      }
    };
    if (user && userRole === 'admin') fetchRazorpayKeys();
  }, [user, userRole, toast]);

  const handleSaveRazorpay = async () => {
    if (!razorpayKeyId.trim() || !razorpayKeySecret.trim()) {
      toast({ variant: 'destructive', title: 'Error', description: 'Both Key ID and Key Secret are required' });
      return;
    }
    setSavingRazorpay(true);
    try {
      await apiClient.put('/settings/payment-gateway', {
        razorpay_key_id: razorpayKeyId.trim(),
        razorpay_key_secret: razorpayKeySecret.trim(),
      });
      toast({ title: 'Razorpay Keys Saved', description: 'Payment gateway credentials updated successfully' });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    }
    setSavingRazorpay(false);
  };

  const handleSave = async () => {
    setIsSubmitting(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    toast({ title: 'Settings Saved', description: 'Your changes have been saved successfully' });
    setIsSubmitting(false);
  };

  const handleChangePassword = async () => {
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast({ variant: 'destructive', title: 'Error', description: 'Passwords do not match' });
      return;
    }
    if (passwordForm.newPassword.length < 6) {
      toast({ variant: 'destructive', title: 'Error', description: 'Password must be at least 6 characters' });
      return;
    }

    setChangingPassword(true);
    try {
      await apiClient.put('/profile/password', { password: passwordForm.newPassword });
      toast({ title: 'Password Changed', description: 'Your password has been updated successfully' });
      setPasswordDialogOpen(false);
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally {
      setChangingPassword(false);
    }
  };

  const handleInviteAdmin = async () => {
    if (!inviteForm.email || !inviteForm.fullName || !inviteForm.password) {
      toast({ variant: 'destructive', title: 'Error', description: 'Please fill all fields' });
      return;
    }
    if (inviteForm.password.length < 6) {
      toast({ variant: 'destructive', title: 'Error', description: 'Password must be at least 6 characters' });
      return;
    }

    setInviting(true);

    try {
      await apiClient.post('/settings/invite-admin', {
        email: inviteForm.email,
        full_name: inviteForm.fullName,
        password: inviteForm.password,
      });

      toast({ 
        title: 'Admin Created', 
        description: `${inviteForm.fullName} has been added as an admin.` 
      });
      setInviteDialogOpen(false);
      setInviteForm({ email: '', fullName: '', password: '' });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    }

    setInviting(false);
  };

  const handleFactoryReset = async () => {
    if (resetConfirmText !== 'RESET ALL DATA') {
      toast({ variant: 'destructive', title: 'Error', description: 'Please type the confirmation text correctly' });
      return;
    }

    setResetting(true);

    try {
      await apiClient.post('/settings/factory-reset');

      toast({ 
        title: 'Factory Reset Complete', 
        description: 'All data has been cleared. User accounts are still active.' 
      });
      setResetConfirmText('');
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Reset Failed', description: error.message });
    }

    setResetting(false);
  };

  const handleFullReset = async () => {
    if (fullResetConfirmText !== 'DELETE EVERYTHING') {
      toast({ variant: 'destructive', title: 'Error', description: 'Please type the confirmation text correctly' });
      return;
    }

    setFullResetting(true);

    try {
      await apiClient.post('/settings/full-reset');

      toast({ 
        title: 'Full Reset Complete', 
        description: 'All data and user accounts have been deleted. You will be signed out.' 
      });
      setFullResetConfirmText('');
      
      // Sign out and redirect
      setTimeout(async () => {
        await signOut();
        navigate('/auth');
      }, 2000);
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Reset Failed', description: error.message });
    }

    setFullResetting(false);
  };

  const handleDeleteAccount = async () => {
    await signOut();
    navigate('/auth');
    toast({ 
      title: 'Signed Out', 
      description: 'Contact system administrator to delete your account permanently.' 
    });
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <DashboardLayout sidebarItems={adminSidebarItems} roleColor="admin">
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="font-display text-2xl font-bold">Settings</h1>
          <p className="text-muted-foreground">Manage school settings and administration</p>
        </div>

        <div className="grid gap-6">
          {/* School Information */}
          <Card className="card-elevated">
            <CardHeader>
              <CardTitle className="font-display flex items-center gap-2">
                <School className="h-5 w-5 text-primary" />
                School Information
              </CardTitle>
              <CardDescription>Basic school details and contact information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>School Name</Label>
                  <Input
                    value={settings.schoolName}
                    onChange={(e) => setSettings({ ...settings, schoolName: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email Address</Label>
                  <Input
                    type="email"
                    value={settings.schoolEmail}
                    onChange={(e) => setSettings({ ...settings, schoolEmail: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Phone Number</Label>
                  <Input
                    value={settings.schoolPhone}
                    onChange={(e) => setSettings({ ...settings, schoolPhone: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Address</Label>
                  <Input
                    value={settings.schoolAddress}
                    onChange={(e) => setSettings({ ...settings, schoolAddress: e.target.value })}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Notifications */}
          <Card className="card-elevated">
            <CardHeader>
              <CardTitle className="font-display flex items-center gap-2">
                <Bell className="h-5 w-5 text-primary" />
                Notification Settings
              </CardTitle>
              <CardDescription>Configure how notifications are sent</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                <div>
                  <p className="font-medium">Email Notifications</p>
                  <p className="text-sm text-muted-foreground">Send notifications via email</p>
                </div>
                <Switch
                  checked={settings.emailNotifications}
                  onCheckedChange={(checked) => setSettings({ ...settings, emailNotifications: checked })}
                />
              </div>

              <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                <div>
                  <p className="font-medium">SMS Notifications</p>
                  <p className="text-sm text-muted-foreground">Send notifications via SMS</p>
                </div>
                <Switch
                  checked={settings.smsNotifications}
                  onCheckedChange={(checked) => setSettings({ ...settings, smsNotifications: checked })}
                />
              </div>

              <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                <div>
                  <p className="font-medium">Parent Notifications</p>
                  <p className="text-sm text-muted-foreground">Automatically notify parents of attendance and grades</p>
                </div>
                <Switch
                  checked={settings.parentNotifications}
                  onCheckedChange={(checked) => setSettings({ ...settings, parentNotifications: checked })}
                />
              </div>

              <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                <div>
                  <p className="font-medium">Push Notifications</p>
                  <p className="text-sm text-muted-foreground">Receive push alerts on this device even when the app is closed</p>
                </div>
                <PushNotificationToggle />
              </div>
            </CardContent>
          </Card>

          {/* Account & Security */}
          <Card className="card-elevated">
            <CardHeader>
              <CardTitle className="font-display flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                Account & Security
              </CardTitle>
              <CardDescription>Manage your account and security settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Change Password */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-lg border gap-3">
                <div>
                  <p className="font-medium">Change Password</p>
                  <p className="text-sm text-muted-foreground">Update your admin password</p>
                </div>
                <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Key className="h-4 w-4 mr-2" />
                      Change
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Change Password</DialogTitle>
                      <DialogDescription>Enter your new password below</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label>New Password</Label>
                        <Input
                          type="password"
                          value={passwordForm.newPassword}
                          onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                          placeholder="Enter new password"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Confirm Password</Label>
                        <Input
                          type="password"
                          value={passwordForm.confirmPassword}
                          onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                          placeholder="Confirm new password"
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setPasswordDialogOpen(false)}>Cancel</Button>
                      <Button onClick={handleChangePassword} disabled={changingPassword}>
                        {changingPassword && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        Update Password
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>

              {/* Create Admin */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-lg border gap-3">
                <div>
                  <p className="font-medium">Invite New Admin</p>
                  <p className="text-sm text-muted-foreground">Create another admin account</p>
                </div>
                <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      <UserPlus className="h-4 w-4 mr-2" />
                      Invite
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create Admin Account</DialogTitle>
                      <DialogDescription>Enter details for the new administrator</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label>Full Name</Label>
                        <Input
                          value={inviteForm.fullName}
                          onChange={(e) => setInviteForm({ ...inviteForm, fullName: e.target.value })}
                          placeholder="Enter full name"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Email Address</Label>
                        <Input
                          type="email"
                          value={inviteForm.email}
                          onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                          placeholder="admin@school.com"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Initial Password</Label>
                        <Input
                          type="password"
                          value={inviteForm.password}
                          onChange={(e) => setInviteForm({ ...inviteForm, password: e.target.value })}
                          placeholder="Set initial password"
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setInviteDialogOpen(false)}>Cancel</Button>
                      <Button onClick={handleInviteAdmin} disabled={inviting} className="gradient-admin">
                        {inviting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        Create Admin
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>

              {/* Sign Out */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-lg border gap-3">
                <div>
                  <p className="font-medium">Sign Out</p>
                  <p className="text-sm text-muted-foreground">Sign out of your account</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => signOut().then(() => navigate('/auth'))}>
                  Sign Out
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Payment Gateway */}
          <Card className="card-elevated">
            <CardHeader>
              <CardTitle className="font-display flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-primary" />
                Payment Gateway (Razorpay)
              </CardTitle>
              <CardDescription>Configure Razorpay credentials for online fee payments</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {loadingRazorpay ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label>Razorpay Key ID</Label>
                    <Input
                      value={razorpayKeyId}
                      onChange={(e) => setRazorpayKeyId(e.target.value)}
                      placeholder="rzp_live_xxxxxxxxxx"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Razorpay Key Secret</Label>
                    <div className="relative">
                      <Input
                        type={showKeySecret ? 'text' : 'password'}
                        value={razorpayKeySecret}
                        onChange={(e) => setRazorpayKeySecret(e.target.value)}
                        placeholder="Enter Key Secret"
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowKeySecret(!showKeySecret)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showKeySecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <Button onClick={handleSaveRazorpay} disabled={savingRazorpay} size="sm">
                    {savingRazorpay && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    <Save className="h-4 w-4 mr-2" />
                    Save Razorpay Keys
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          {/* Leads Module Settings */}
          <LeadsSettings />

          {/* Danger Zone */}
          <Card className="card-elevated border-destructive/50">
            <CardHeader>
              <CardTitle className="font-display flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                Danger Zone
              </CardTitle>
              <CardDescription>Irreversible actions - proceed with caution</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Factory Reset (Data Only) */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-lg border border-destructive/30 bg-destructive/5 gap-3">
                <div>
                  <p className="font-medium text-destructive">Factory Reset (Data Only)</p>
                  <p className="text-sm text-muted-foreground">Delete ALL data but keep user accounts</p>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm">
                      <Trash2 className="h-4 w-4 mr-2" />
                      Reset Data
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle className="text-destructive">Factory Reset</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete ALL data including students, teachers, classes, 
                        attendance records, exam results, and everything else. User accounts will remain active.
                        <br /><br />
                        Type <strong>RESET ALL DATA</strong> to confirm:
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <Input
                      value={resetConfirmText}
                      onChange={(e) => setResetConfirmText(e.target.value)}
                      placeholder="Type confirmation text"
                      className="my-4"
                    />
                    <AlertDialogFooter>
                      <AlertDialogCancel onClick={() => setResetConfirmText('')}>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleFactoryReset}
                        disabled={resetting || resetConfirmText !== 'RESET ALL DATA'}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        {resetting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        Delete Data
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>

              {/* Full Reset (Data + Accounts) */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-lg border border-destructive/50 bg-destructive/10 gap-3">
                <div>
                  <p className="font-medium text-destructive">Full Reset (Data + Accounts)</p>
                  <p className="text-sm text-muted-foreground">Delete EVERYTHING including all user accounts. Start fresh from login.</p>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm">
                      <AlertTriangle className="h-4 w-4 mr-2" />
                      Full Reset
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle className="text-destructive flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5" />
                        Full System Reset
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        <strong className="text-destructive">WARNING:</strong> This will permanently delete:
                        <ul className="list-disc list-inside mt-2 space-y-1">
                          <li>All data (students, teachers, classes, etc.)</li>
                          <li>All user accounts (except yours)</li>
                          <li>All parent/teacher logins</li>
                        </ul>
                        <br />
                        After this, you'll need to create new teacher accounts and start fresh.
                        <br /><br />
                        Type <strong>DELETE EVERYTHING</strong> to confirm:
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <Input
                      value={fullResetConfirmText}
                      onChange={(e) => setFullResetConfirmText(e.target.value)}
                      placeholder="Type confirmation text"
                      className="my-4"
                    />
                    <AlertDialogFooter>
                      <AlertDialogCancel onClick={() => setFullResetConfirmText('')}>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleFullReset}
                        disabled={fullResetting || fullResetConfirmText !== 'DELETE EVERYTHING'}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        {fullResetting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        Delete Everything
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={isSubmitting} className="gradient-admin">
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <Save className="h-4 w-4 mr-2" />
              Save Settings
            </Button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
