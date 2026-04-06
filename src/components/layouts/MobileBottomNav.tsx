import { ReactNode, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useIsMobile } from '@/hooks/use-mobile';
import { LayoutDashboard, GraduationCap, Clock, MessageSquare, BookOpen, FileText, Plus } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

interface SidebarItem {
  icon: ReactNode;
  label: string;
  path: string;
}

interface MobileBottomNavProps {
  sidebarItems: SidebarItem[];
  roleColor: 'admin' | 'teacher' | 'parent';
}

// Primary tab paths per role (order matters for display)
const PRIMARY_PATHS: Record<string, string[]> = {
  admin: ['/admin', '/admin/students', '/admin/messages', '/admin/attendance'],
  teacher: ['/teacher', '/teacher/attendance', '/teacher/homework', '/teacher/messages'],
  parent: ['/parent', '/parent/attendance', '/parent/exams', '/parent/messages'],
};

// Index where "More" button should be inserted (0-indexed among primary items)
const MORE_BUTTON_INDEX: Record<string, number> = {
  admin: 2,
  teacher: 2,
  parent: 2,
};

export default function MobileBottomNav({ sidebarItems, roleColor }: MobileBottomNavProps) {
  const [moreOpen, setMoreOpen] = useState(false);
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const location = useLocation();

  if (!isMobile) return null;

  const primaryPaths = PRIMARY_PATHS[roleColor] || PRIMARY_PATHS.admin;
  const moreIndex = MORE_BUTTON_INDEX[roleColor] ?? primaryPaths.length;
  const primaryItems = primaryPaths
    .map(path => sidebarItems.find(item => item.path === path))
    .filter(Boolean) as SidebarItem[];
  const moreItems = sidebarItems.filter(item => !primaryPaths.includes(item.path));

  const activeColor = {
    admin: 'text-primary',
    teacher: 'text-[hsl(152,35%,16%)]',
    parent: 'text-[hsl(210,8%,45%)]',
  }[roleColor];

  const moreBg = {
    admin: 'bg-primary',
    teacher: 'bg-[hsl(152,35%,16%)]',
    parent: 'bg-[hsl(210,8%,45%)]',
  }[roleColor];

  const moreButton = moreItems.length > 0 ? (
    <button
      key="__more__"
      onClick={() => setMoreOpen(true)}
      className="flex items-center justify-center flex-1 py-1"
    >
      <span className={cn("flex items-center justify-center h-10 w-10 rounded-full text-primary-foreground", moreBg)}>
        <Plus className="h-5 w-5" />
      </span>
    </button>
  ) : null;

  // Build tab list with More inserted at the right position
  const tabs: React.ReactNode[] = [];
  primaryItems.forEach((item, i) => {
    if (i === moreIndex && moreButton) tabs.push(moreButton);
    const isActive = location.pathname === item.path;
    tabs.push(
      <button
        key={item.path}
        onClick={() => navigate(item.path)}
        className={cn(
          "flex flex-col items-center justify-center gap-0.5 flex-1 py-1 transition-colors",
          isActive ? activeColor : "text-muted-foreground"
        )}
      >
        <span className="[&_svg]:h-5 [&_svg]:w-5">{item.icon}</span>
        <span className={cn("text-[10px] leading-tight", isActive && "font-semibold")}>{item.label}</span>
      </button>
    );
  });
  // If moreIndex >= primaryItems.length, append at end
  if (moreIndex >= primaryItems.length && moreButton) tabs.push(moreButton);

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border lg:hidden">
        <div className="flex items-center justify-around h-16 px-1">
          {tabs}
        </div>
      </nav>

      {/* More Sheet */}
      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[70vh] overflow-y-auto pb-8">
          <SheetHeader className="pb-2">
            <SheetTitle className="text-base font-display">More</SheetTitle>
          </SheetHeader>
          <div className="grid grid-cols-3 gap-3 pt-2">
            {moreItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <button
                  key={item.path}
                  onClick={() => {
                    navigate(item.path);
                    setMoreOpen(false);
                  }}
                  className={cn(
                    "flex flex-col items-center gap-2 p-3 rounded-xl transition-colors",
                    isActive
                      ? cn("bg-accent", activeColor)
                      : "text-foreground hover:bg-muted"
                  )}
                >
                  <span className="[&_svg]:h-5 [&_svg]:w-5">{item.icon}</span>
                  <span className="text-xs text-center leading-tight">{item.label}</span>
                </button>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
