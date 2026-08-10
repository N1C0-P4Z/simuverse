'use client';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupContent,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarSeparator,
    useSidebar,
} from '@/components/ui/sidebar';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/useAuth';
import { useAdmin } from '@/lib/admin-context';
import { ADMIN_NAV_GROUPS } from '@/lib/admin-nav';
import { ROLE_NAV } from '@/lib/nav-config';
import { useSidebarHeader } from '@/lib/sidebar-header-context';
import { apiClient } from '@/services/ApiClient';
import { ArrowLeft, ChevronDown, ChevronRight, LogOut, Menu, PanelLeftClose, Shield } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const GROUP_STORAGE_KEY = 'admin-sidebar:groups-v2';

const ROLE_LABELS: Record<string, string> = {
  student: 'Estudiante',
  teacher: 'Docente',
  admin: 'Administrador',
  ministerio: 'Ministerio',
};

/** Admin-nav item id → teacher-facing route under /profesor */
const TEACHER_ADMIN_ITEM_ROUTES: Record<string, string> = {
  reports: '/profesor/reportes',
  sessions: '/profesor/sesiones',
  courses: '/profesor/cursos',
  assignments: '/profesor/cursos',
  legajos: '/profesor/legajos',
};

export function AppSidebar() {
  const { user, signOut, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { backTo, backLabel } = useSidebarHeader();
  const { open, toggleSidebar } = useSidebar();

  const lastKnownUser = useRef(user);
  useEffect(() => {
    if (user) lastKnownUser.current = user;
  }, [user]);

  const displayUser = user || lastKnownUser.current;
  const role = (displayUser?.role || 'student') as string;
  const navItems = ROLE_NAV[role as keyof typeof ROLE_NAV] || ROLE_NAV.student;
  const isAdmin = role === 'admin' || role === 'ministerio';

  // ── Permission-based sidebar visibility ──────────────────────────
  const [enabledCodes, setEnabledCodes] = useState<Set<string>>(new Set());
  const [permissionsLoaded, setPermissionsLoaded] = useState(false);

  useEffect(() => {
    if (!role || role === 'student' || isAdmin) {
      setEnabledCodes(new Set());
      setPermissionsLoaded(true);
      return;
    }
    setPermissionsLoaded(false);
    apiClient
      .get(`/role-permissions?role_name=${encodeURIComponent(role)}`)
      .then((res) => {
        const data = Array.isArray(res.data) ? res.data : [];
        const codes = new Set<string>();
        for (const p of data) {
          if (p.enabled && p.code) codes.add(p.code);
        }
        setEnabledCodes(codes);
      })
      .catch(() => setEnabledCodes(new Set()))
      .finally(() => setPermissionsLoaded(true));
  }, [role, isAdmin, user]);
  // Filter groups by permissions (for non-admin roles that have admin permissions)
  const visibleGroups = useMemo(() => {
    if (isAdmin) return ADMIN_NAV_GROUPS;

    if (!permissionsLoaded) return [];

    return ADMIN_NAV_GROUPS
      .map((group) => {
        const visibleItems = group.items.filter((item) => {
          if (item.excludeRoles?.includes(role)) return false;
          if (!item.permissionCode) return false; // admin-only item
          return enabledCodes.has(item.permissionCode);
        });
        return { ...group, items: visibleItems };
      })
      .filter((group) => group.items.length > 0);
  }, [isAdmin, permissionsLoaded, enabledCodes, role]);

  const showAdminSidebar = isAdmin || visibleGroups.length > 0;
  const adminPath = role === 'ministerio' ? '/ministerio/admin' : '/admin';
  const homeRoute = role === 'admin' ? '/admin/mis-cursos' : role === 'ministerio' ? '/ministerio' : (navItems[0]?.href || '/auth');
  const { currentTab, setCurrentTab } = useAdmin();

  // Admin group expansion state (starts completely closed)
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const group of ADMIN_NAV_GROUPS) {
      initial[group.id] = false;
    }
    return initial;
  });

  // Auto-expand group containing the active admin sub-tab
  useEffect(() => {
    if (!showAdminSidebar || pathname !== adminPath) return;
    setExpandedGroups((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const group of visibleGroups) {
        const hasActive = group.items.some((item) => item.id === currentTab);
        if (hasActive && !next[group.id]) {
          next[group.id] = true;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [currentTab, isAdmin, pathname]);





  const toggleGroup = useCallback((groupId: string) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
  }, []);

  const isActive = (href: string) => {
    if (href === '/ministerio') return pathname === href;
    return pathname === href || pathname.startsWith(href + '/');
  };

  // Get user initial for avatar fallback
  const userInitial = (displayUser?.name?.charAt(0) || displayUser?.email?.charAt(0) || 'U').toUpperCase();

  return (
    <div className="flex h-full w-full flex-col">
      <SidebarHeader className="h-16 justify-center">
        {backTo ? (
          <SidebarMenu className="group-data-[collapsible=icon]:items-center">
            <SidebarMenuItem className="group-data-[collapsible=icon]:w-full group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center">
              <SidebarMenuButton
                onClick={() => router.push(backTo)}
                className="group-data-[collapsible=icon]:justify-center"
                tooltip={backLabel || 'Volver'}
              >
                <ArrowLeft className="size-4 shrink-0" />
                <span className="group-data-[collapsible=icon]:hidden">{backLabel || 'Volver'}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        ) : (
          <SidebarMenu className="group-data-[collapsible=icon]:items-center">
            <SidebarMenuItem className="group-data-[collapsible=icon]:w-full group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center">
              <SidebarMenuButton
                size="lg"
                onClick={() => !open && toggleSidebar()}
                className={`group-data-[collapsible=icon]:!p-0 ${open ? "pointer-events-none" : ""}`}
              >
                <div className="group/logo relative flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <Shield className="size-4 transition-all group-data-[collapsible=icon]:group-hover/logo:scale-0 group-data-[collapsible=icon]:group-hover/logo:opacity-0" />
                  <Menu className="absolute size-4 scale-0 opacity-0 transition-all group-data-[collapsible=icon]:group-hover/logo:scale-100 group-data-[collapsible=icon]:group-hover/logo:opacity-100" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
                  <span className="truncate font-semibold">MSM</span>
                </div>
              </SidebarMenuButton>
              <button
                onClick={toggleSidebar}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md hover:bg-sidebar-accent transition-colors group-data-[collapsible=icon]:hidden z-10"
                title="Comprimir sidebar"
              >
                <PanelLeftClose className="size-5 text-sidebar-foreground/70" />
              </button>
            </SidebarMenuItem>
          </SidebarMenu>
        )}
      </SidebarHeader>

      <SidebarContent
        className="group-data-[collapsible=icon]:px-0 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
      >
        <SidebarGroup className="group-data-[collapsible=icon]:px-0">
          <SidebarMenu className="group-data-[collapsible=icon]:items-center">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <SidebarMenuItem key={i} className="group-data-[collapsible=icon]:w-full group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center">
                  <SidebarMenuButton disabled>
                    <Skeleton className="size-4 shrink-0 rounded-md" />
                    <Skeleton className="h-4 w-24 rounded-md group-data-[collapsible=icon]:hidden" />
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))
            ) : navItems.map((item) => (
              <SidebarMenuItem key={item.href} className="group-data-[collapsible=icon]:w-full group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center">
                <SidebarMenuButton
                  asChild
                  isActive={isActive(item.href)}
                  tooltip={item.label}
                >
                  <Link href={item.href}>
                    <item.icon className="size-4 shrink-0" />
                    <span className="group-data-[collapsible=icon]:hidden">{item.label}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>

        {showAdminSidebar && (
          <>
        <SidebarSeparator />
            {visibleGroups.map((group) => (
              <SidebarGroup key={group.id} className="group-data-[collapsible=icon]:px-0">
                <SidebarMenu className="group-data-[collapsible=icon]:items-center">
                  <SidebarMenuItem className="group-data-[collapsible=icon]:w-full group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center">
                    <SidebarMenuButton
                      onClick={() => toggleGroup(group.id)}
                      className="font-medium text-sidebar-foreground/70"
                      tooltip={group.label}
                    >
                      <group.icon className={`size-4 shrink-0 ${expandedGroups[group.id] ? 'hidden group-data-[collapsible=icon]:block' : ''}`} />
                      <span className="flex-1 truncate group-data-[collapsible=icon]:hidden">{group.label}</span>
                      <span className="group-data-[collapsible=icon]:hidden">
                        {expandedGroups[group.id] ? (
                          <ChevronDown className="size-4 shrink-0" />
                        ) : (
                          <ChevronRight className="size-4 shrink-0" />
                        )}
                      </span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
                {expandedGroups[group.id] && (
                  <SidebarGroupContent>
                    <SidebarMenu className="group-data-[collapsible=icon]:items-center">
                      {group.items.map((item) => (
                        <SidebarMenuItem key={item.id} className="group-data-[collapsible=icon]:w-full group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center">
                          <SidebarMenuButton
                            isActive={
                              pathname === `/admin/${item.id}` ||
                              pathname === TEACHER_ADMIN_ITEM_ROUTES[item.id] ||
                              (pathname === adminPath && currentTab === item.id)
                            }
                            onClick={() => {
                              setCurrentTab(item.id);
                              const teacherRoute = TEACHER_ADMIN_ITEM_ROUTES[item.id];
                              if (role === 'teacher' && teacherRoute) {
                                router.push(teacherRoute);
                                return;
                              }
                              router.push(`/admin/${item.id}`);
                            }}
                            tooltip={item.label}
                          >
                            <item.icon className="size-4 shrink-0" />
                            <span className="group-data-[collapsible=icon]:hidden">{item.label}</span>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      ))}
                    </SidebarMenu>
                  </SidebarGroupContent>
                )}
              </SidebarGroup>
            ))}
          </>
        )}
      </SidebarContent>

      <SidebarFooter>
        <div className="flex items-center gap-3 px-2 py-1.5 group-data-[collapsible=icon]:justify-center">
          {loading ? (
            <div className="size-8 shrink-0" />
          ) : (
            <Avatar className="size-8 shrink-0">
              <AvatarFallback className="text-sm font-medium bg-primary text-primary-foreground">
                {userInitial}
              </AvatarFallback>
            </Avatar>
          )}
          {loading ? (
            <div className="flex flex-col gap-1.5 min-w-0 group-data-[collapsible=icon]:hidden">
              <Skeleton className="h-4 w-24 rounded-md" />
              <Skeleton className="h-3 w-32 rounded-md" />
            </div>
          ) : (
            <div className="flex flex-col gap-0.5 min-w-0 group-data-[collapsible=icon]:hidden">
              <span className="text-sm font-medium text-sidebar-foreground truncate">
                {displayUser?.name || displayUser?.email?.split('@')[0] || 'Usuario'}
              </span>
              <span className="text-xs text-sidebar-foreground/70 truncate">{displayUser?.email}</span>
            </div>
          )}
        </div>
        <SidebarSeparator />
        <SidebarMenu className="group-data-[collapsible=icon]:items-center">
          <SidebarMenuItem className="group-data-[collapsible=icon]:w-full group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center">
            <SidebarMenuButton onClick={signOut} className="text-red-600 hover:text-red-600 group-data-[collapsible=icon]:!p-2 group-data-[collapsible=icon]:!size-8" tooltip="Cerrar sesión">
              <LogOut className="size-4 text-red-600 shrink-0" />
              <span className="group-data-[collapsible=icon]:hidden">Cerrar sesión</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </div>
  );
}
