# Decisión: acceso Ministerio (no home dedicado)

**Fecha**: 2026-08-03  
**Estado**: documentado — **no implementar aún**  
**Engram**: `#909` · `architecture/ministry-access-model`

## Decisión

Un usuario con rol `ministerio` debe obtener **lectura de (casi) todo** a través de **roles y permisos (RBAC)**, igual que el resto del modelo actual.

**No** debe existir un home / dashboard dedicado `/ministerio` (`MinisterioDashboard.tsx`) como entrada principal.

## Contexto

Hoy el login hardcodea:

| Rol | Entrada post-login |
|-----|--------------------|
| student | `/estudiante/cursos` |
| teacher | `/profesor/cursos` |
| admin | `/admin/mis-cursos` |
| ministerio | `/ministerio` ← legacy |

El modelo vigente para “ver más o menos del admin” es:

- `User.role` en JWT
- `role_permissions` / `system_functionalities`
- Sidebar: `ROLE_NAV` + `ADMIN_NAV_GROUPS` (+ `AdminReadOnlyProvider` para solo lectura)

`/ministerio` quedó desalineado con ese modelo (ruta protegida, pero UX y datos viejos).

## Implicaciones

1. **Paginación (`paginacion-global`)**: no migrar `MinisterioDashboard` a `usePagination`.
2. **Cambio futuro (separado)**: redirigir ministerio a un home coherente (p. ej. admin read-only / mis-cursos) y deprecar `/ministerio` + `ROLE_NAV.ministerio` actual.
3. Credencial seed de prueba: `control@ministerio.gob` / `Admin123!` (sigue existiendo en seed; útil para probar el estado actual, no el target).

## Relación con paginación

Ver `HANDOFF_PAGINACION_FRONTEND.md` (sección decisión Ministerio + vistas pendientes corregidas).
