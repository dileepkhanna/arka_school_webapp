import { ReactNode, useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import MobileBottomNav from './MobileBottomNav';
import { useAuth } from '@/hooks/useAuth';
import { apiClient } from '@/lib/apiClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  LogOut,
  User,
  Bell,
  ChevronRight,
  Mail,
  Phone,
  Calendar,
  BookOpen,
  GraduationCap,
  Shield,
  Camera,
  Pencil,
  Save,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import NotificationBell from '@/components/NotificationBell';
import InstallAppBanner from '@/components/InstallAppBanner';


interface SidebarItem {
  icon: ReactNode;
  label: string;
  path: string;
}

interface DashboardLayoutProps {
  children: ReactNode;
  sidebarItems: SidebarItem[];
  roleColor: 'admin' | 'teacher' | 'parent';
}

interface ProfileDetails {
  full_name: string;
  email: string;
  phone: string;
  photo_url: string;
  role: string;
  // Teacher-specific
  teacherId?: string;
  qualification?: string;
  subjects?: string[];
  joiningDate?: string;
  status?: string;
  assignedClasses?: string[];
  // Parent-specific
  childrenNames?: string[];
}

export default function DashboardLayout({ children, sidebarItems, roleColor }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [displayName, setDisplayName] = useState<string>('');
  const [photoUrl, setPhotoUrl] = useState<string>('');
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileDetails, setProfileDetails] = useState<ProfileDetails | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [editPhone, setEditPhone] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user, userRole, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    async function fetchProfile() {
      if (!user) return;

      setDisplayName(user.profile?.full_name || user.name || '');
      setPhotoUrl(user.profile?.photo_url || '');
    }
    fetchProfile();
  }, [user]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const openProfile = async () => {
    if (!user) return;
    setProfileOpen(true);
    setLoadingProfile(true);

    try {
      const details = await apiClient.get<ProfileDetails>('/profile');
      setProfileDetails(details);
      setDisplayName(details.full_name || displayName);
      setPhotoUrl(details.photo_url || photoUrl);
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoadingProfile(false);
    }
  };

  const roleGradient = {
    admin: 'gradient-admin',
    teacher: 'gradient-teacher',
    parent: 'gradient-parent',
  }[roleColor];

  const roleLabel = {
    admin: 'Administrator',
    teacher: 'Teacher',
    parent: 'Parent',
  }[roleColor];

  const getInitials = () => {
    if (displayName) {
      return displayName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
    }
    return user?.email?.[0].toUpperCase() || 'U';
  };

  return (
    <div className="h-screen flex w-full bg-background overflow-hidden">
      {/* Desktop Sidebar */}
      <aside
        className={cn(
          "hidden lg:flex flex-col bg-sidebar text-sidebar-foreground transition-all duration-300 ease-in-out overflow-hidden relative h-screen flex-shrink-0",
          sidebarOpen ? "w-64" : "w-20",
          roleColor === 'teacher' && "sidebar-teacher",
          roleColor === 'parent' && "sidebar-parent"
        )}
      >
        {/* Logo */}
        <div className="h-16 flex items-center px-3 border-b border-sidebar-border">
          <div className={cn("flex items-center gap-2 min-w-0", !sidebarOpen && "justify-center w-full")}>
            <div className="h-9 w-9 flex-shrink-0 rounded-lg bg-primary/10 flex items-center justify-center">
              <GraduationCap className="h-5 w-5 text-primary" />
            </div>
            {sidebarOpen && (
              <div className="min-w-0">
                <h1 className="font-display font-bold text-base leading-tight truncate">SmartEduConnect</h1>
                <p className="text-[10px] text-sidebar-foreground/60 truncate">{roleLabel}</p>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar Toggle */}
        <div className="flex justify-end pr-2 pt-2">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="w-7 h-7 bg-sidebar-accent border border-sidebar-border rounded-full flex items-center justify-center hover:bg-sidebar-accent/80 transition-colors"
          >
            <ChevronRight className={cn("h-4 w-4 text-sidebar-foreground transition-transform", sidebarOpen && "rotate-180")} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
          {sidebarItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-primary font-medium"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground",
                  !sidebarOpen && "justify-center px-2"
                )}
              >
                <span className="flex-shrink-0 flex items-center justify-center">{item.icon}</span>
                {sidebarOpen && <span>{item.label}</span>}
              </button>
            );
          })}
        </nav>

        {/* User Info */}
        <div className="p-4 border-t border-sidebar-border">
          <div className={cn("flex items-center gap-3", !sidebarOpen && "justify-center")}>
            <Avatar className="h-9 w-9">
              <AvatarImage src={photoUrl} />
              <AvatarFallback className={roleGradient}>
                {getInitials()}
              </AvatarFallback>
            </Avatar>
            {sidebarOpen && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{displayName || 'User'}</p>
                <p className="text-xs text-sidebar-foreground/60 capitalize">{userRole}</p>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-card border-b flex items-center justify-between px-4 lg:px-6">
          <div className="flex items-center gap-4">
            {/* Mobile: Logo + Name */}
            <div className="flex items-center gap-2 lg:hidden">
              <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <GraduationCap className="h-5 w-5 text-primary" />
              </div>
              <h1 className="font-display font-bold text-base leading-tight">SmartEduConnect</h1>
            </div>
            {/* Desktop: Page title */}
            <div className="hidden lg:block">
              <h2 className="font-display font-semibold text-lg">
                {sidebarItems.find(item => item.path === location.pathname)?.label || 'Dashboard'}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <NotificationBell />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-2 px-2">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={photoUrl} />
                    <AvatarFallback className={roleGradient}>
                      {getInitials()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden sm:block text-sm font-medium">{displayName || 'User'}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>My Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={openProfile}>
                  <User className="mr-2 h-4 w-4" />
                  Profile
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Install Banner */}
        <InstallAppBanner />

        {/* Page Content */}
        <main
          className="flex-1 p-4 lg:p-6 pb-20 lg:pb-6 overflow-y-auto"
          style={roleColor === 'teacher' ? {
            '--primary': '152 35% 16%',
            '--primary-foreground': '0 0% 100%',
            '--ring': '152 35% 16%',
          } as React.CSSProperties : roleColor === 'parent' ? {
            '--primary': '210 8% 45%',
            '--primary-foreground': '0 0% 100%',
            '--ring': '210 8% 45%',
          } as React.CSSProperties : undefined}
        >
          {children}
        </main>
      </div>

      {/* Profile Dialog */}
      <Dialog open={profileOpen} onOpenChange={(open) => { setProfileOpen(open); if (!open) setEditingProfile(false); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center justify-between">
              My Profile
              {profileDetails && !editingProfile && (
                <Button variant="ghost" size="sm" onClick={() => { setEditingProfile(true); setEditPhone(profileDetails.phone || ''); }}>
                  <Pencil className="h-4 w-4 mr-1" /> Edit
                </Button>
              )}
            </DialogTitle>
          </DialogHeader>

          <input type="file" ref={fileInputRef} accept="image/*" className="hidden" onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file || !user) return;
            setUploadingPhoto(true);
            try {
              const formData = new FormData();
              formData.append('photo', file);
              const result = await apiClient.postForm<{ photo_url: string }>('/profile/photo', formData);
              const photoUrlNew = `${result.photo_url}?t=${Date.now()}`;
              setPhotoUrl(photoUrlNew);
              if (profileDetails) setProfileDetails({ ...profileDetails, photo_url: photoUrlNew });
              toast.success('Photo updated');
            } catch (err: any) {
              toast.error(err.message || 'Failed to upload photo');
            } finally {
              setUploadingPhoto(false);
            }
          }} />

          {loadingProfile ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : profileDetails ? (
            <div className="space-y-6">
              {/* Avatar & Name */}
              <div className="flex flex-col items-center gap-3">
                <div className="relative">
                  <Avatar className="h-20 w-20">
                    <AvatarImage src={profileDetails.photo_url} />
                    <AvatarFallback className={cn(roleGradient, "text-xl")}>
                      {profileDetails.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingPhoto}
                    className="absolute bottom-0 right-0 h-7 w-7 bg-primary text-primary-foreground rounded-full flex items-center justify-center shadow-md hover:bg-primary/90 transition-colors"
                  >
                    {uploadingPhoto ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
                  </button>
                </div>
                <div className="text-center">
                  <h3 className="font-display text-xl font-bold">{profileDetails.full_name}</h3>
                  <Badge className={cn("mt-1", `btn-role-${roleColor}`)}>
                    <Shield className="h-3 w-3 mr-1" />
                    {roleLabel}
                  </Badge>
                </div>
              </div>

              {/* Basic Info */}
              <div className="space-y-3 bg-muted/50 rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{profileDetails.email || 'Not set'}</span>
                </div>
                {editingProfile ? (
                  <div className="space-y-2">
                    <Label htmlFor="edit-phone" className="text-xs text-muted-foreground">Phone Number</Label>
                    <div className="flex gap-2">
                      <Input id="edit-phone" value={editPhone} onChange={e => setEditPhone(e.target.value)} placeholder="Enter phone number" />
                      <Button size="sm" disabled={savingProfile} onClick={async () => {
                        if (!user) return;
                        setSavingProfile(true);
                        try {
                          await apiClient.put('/profile', { phone: editPhone });
                          setProfileDetails({ ...profileDetails, phone: editPhone });
                          setEditingProfile(false);
                          toast.success('Phone number updated');
                        } catch {
                          toast.error('Failed to update');
                        } finally {
                          setSavingProfile(false);
                        }
                      }}>
                        {savingProfile ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{profileDetails.phone || 'Not set'}</span>
                  </div>
                )}
              </div>

              {/* Teacher-specific details */}
              {userRole === 'teacher' && (
                <div className="space-y-3 bg-muted/50 rounded-xl p-4">
                  <h4 className="font-display font-semibold text-sm text-muted-foreground uppercase tracking-wider">Teacher Details</h4>
                  {profileDetails.teacherId && (
                    <div className="flex items-center gap-3">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">ID: {profileDetails.teacherId}</span>
                    </div>
                  )}
                  {profileDetails.qualification && (
                    <div className="flex items-center gap-3">
                      <GraduationCap className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{profileDetails.qualification}</span>
                    </div>
                  )}
                  {profileDetails.joiningDate && (
                    <div className="flex items-center gap-3">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">Joined: {new Date(profileDetails.joiningDate).toLocaleDateString()}</span>
                    </div>
                  )}
                  {profileDetails.subjects && profileDetails.subjects.length > 0 && (
                    <div className="flex items-start gap-3">
                      <BookOpen className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <div className="flex flex-wrap gap-1">
                        {profileDetails.subjects.map((s, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">{s}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {profileDetails.assignedClasses && profileDetails.assignedClasses.length > 0 && (
                    <div className="flex items-start gap-3">
                      <GraduationCap className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <div className="flex flex-wrap gap-1">
                        {profileDetails.assignedClasses.map((c, i) => (
                          <Badge key={i} variant="outline" className="text-xs">{c}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {profileDetails.status && (
                    <Badge className={profileDetails.status === 'active' ? 'status-active' : 'status-inactive'}>
                      {profileDetails.status}
                    </Badge>
                  )}
                </div>
              )}

              {/* Parent-specific details */}
              {userRole === 'parent' && profileDetails.childrenNames && profileDetails.childrenNames.length > 0 && (
                <div className="space-y-3 bg-muted/50 rounded-xl p-4">
                  <h4 className="font-display font-semibold text-sm text-muted-foreground uppercase tracking-wider">Children</h4>
                  <div className="flex flex-wrap gap-2">
                    {profileDetails.childrenNames.map((name, i) => (
                      <Badge key={i} variant="secondary">{name}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Admin-specific */}
              {userRole === 'admin' && (
                <div className="space-y-3 bg-muted/50 rounded-xl p-4">
                  <h4 className="font-display font-semibold text-sm text-muted-foreground uppercase tracking-wider">Role Info</h4>
                  <p className="text-sm text-muted-foreground">Full system access with administrative privileges.</p>
                </div>
              )}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Mobile Bottom Navigation */}
      <MobileBottomNav sidebarItems={sidebarItems} roleColor={roleColor} />
    </div>
  );
}
