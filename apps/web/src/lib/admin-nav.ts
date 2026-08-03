import {
    ArrowRightLeft, BookOpen,
    Bot, BotMessageSquare, Building, Building2, CalendarDays, ChartBar, ChartNoAxesCombined, Clapperboard, ClipboardList, FileChartColumnIncreasing, FilePlus, FileText, GraduationCap, HandHeart, Handshake, LucideIcon, Play, ShieldCheck, Tags, UserCheck, UserRound, Users, Users2, Wrench
} from 'lucide-react';

export interface AdminNavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  /** Permission code required to see this item (from system_functionalities.code). If undefined, shown to admin only. */
  permissionCode?: string;
  excludeRoles?: string[];
}

export interface AdminNavGroup {
  id: string;
  label: string;
  icon: LucideIcon;
  items: AdminNavItem[];
  permissionCode?: string;
  excludeRoles?: string[];
}

export const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
  {
    id: 'contenido',
    label: 'Contenido y Configuración',
    icon: BookOpen,
    items: [
      { id: 'courses', label: 'Cursos', icon: GraduationCap, permissionCode: 'courses.read' },
      { id: 'categories', label: 'Categorías', icon: Tags },
      { id: 'scenarios', label: 'Escenarios', icon: Clapperboard, permissionCode: 'scenarios.read' },
      { id: 'practices', label: 'Prácticas', icon: Play },
      { id: 'documents', label: 'Documentos', icon: FilePlus, permissionCode: 'documents.read' },
      { id: 'techsheets', label: 'Fichas Técnicas', icon: ClipboardList, permissionCode: 'techsheets.manage' },
    ],
  },
  {
    id: 'ia',
    label: 'IA y Simulación',
    icon: Bot,
    items: [
      { id: 'prompt-templates', label: 'Prompts por curso', icon: BotMessageSquare, permissionCode: 'templates.prompts' },
      { id: 'sessions', label: 'Sesiones del curso', icon: Play, permissionCode: 'sessions.manage' },
    ],
  },
  {
    id: 'usuarios',
    label: 'Usuarios y Acceso',
    icon: Users,
    items: [
      { id: 'users', label: 'Usuarios', icon: UserRound, permissionCode: 'users.read' },
      { id: 'roles', label: 'Roles y Permisos', icon: ShieldCheck, permissionCode: 'rbac.manage', excludeRoles: ['ministerio'] },
      { id: 'groups', label: 'Grupos', icon: Users2, permissionCode: 'teacher_groups.manage' },
      { id: 'terms', label: 'Términos', icon: FileText, excludeRoles: ['ministerio'] },
    ],
  },
  {
    id: 'operaciones',
    label: 'Operaciones',
    icon: Wrench,
    excludeRoles: ['ministerio'],
    items: [
      { id: 'assignments', label: 'Asignaciones', icon: ArrowRightLeft, permissionCode: 'assignments.read' },
      { id: 'calendar', label: 'Calendario', icon: CalendarDays },
    ],
  },
  {
    id: 'analisis',
    label: 'Análisis',
    icon: ChartNoAxesCombined,
    items: [
      { id: 'reports', label: 'Reportes', icon: FileChartColumnIncreasing, permissionCode: 'reports.read' },
      { id: 'stats', label: 'Estadísticas', icon: ChartBar, permissionCode: 'reports.read_stats' },
    ],
  },
  {
    id: 'organizacion',
    label: 'Organización',
    icon: Building2,
    items: [
      { id: 'companies', label: 'Empresas', icon: Building, permissionCode: 'companies.manage' },
      { id: 'foundation', label: 'Fundación', icon: HandHeart, permissionCode: 'foundation.manage' },
      { id: 'endorsers', label: 'Auspiciantes', icon: UserCheck, permissionCode: 'endorsers.manage' },
      { id: 'sponsors', label: 'Patrocinadores', icon: Handshake, permissionCode: 'sponsors.manage' },
    ],
  },
];
