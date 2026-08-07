# Handoff: Paginación global — estado post-ejecución

**Rama**: `feat/paginacion-global`  
**Base**: develop (`057d471`)  
**Fecha cierre implementación**: 2026-08-03  

---

## Estado

| Fase | Estado |
|------|--------|
| 1 Truncamiento Assignments + Legajos | Hecho |
| 2A Sesiones `limit=100` sin UI | Hecho |
| 3 Cursos BE+FE + dropdown | Hecho |
| 4 Seed local `[PAG]` | Script listo (correr en Docker local) |
| 5 QA manual | Checklist en `QA_PAGINACION_CHECKLIST.md` (UI pendiente humano) |
| 6 Docs / Engram | Hecho — PR a develop cuando lo pidas |

### Números reales

- Backend list endpoints con envelope paginado: **~20** (incluye `GET /courses` ahora)
- Frontend con `usePagination` + UI: **9 ABMs previos + AssignmentsABM + LegajosPage + AdminPanel Cursos**
- Dropdowns de cursos: **`GET /courses/dropdown/list`** (array completo)

---

## Decisión Ministerio (fuera de scope)

Ver [`DECISION_MINISTERIO_ACCESS.md`](DECISION_MINISTERIO_ACCESS.md) y Engram `#909`.

No migrar `MinisterioDashboard`. Entradas por rol:

| Rol | Entrada |
|-----|---------|
| student | `/estudiante/cursos` |
| teacher | `/profesor/cursos` |
| admin | `/admin/mis-cursos` |
| ministerio (legacy) | `/ministerio` |

Excluidas de UI de paginación: **Sesiones**, **Sesiones (general)**, **Calendario**.

---

## Infraestructura

```ts
// Backend
PaginationDto { page=1, limit=20 } // max 100
paginate(model, where, opts) → { data, total, page, limit }

// Frontend
usePagination({ endpoint, limit?, extraParams? })
```

---

## Cambios por fase (esta ejecución)

### Phase 1
- [`AssignmentsABM.tsx`](apps/web/src/components/AssignmentsABM.tsx) → `usePagination` + Pagination UI
- [`LegajosPage.tsx`](apps/web/src/views/LegajosPage.tsx) → `usePagination` + search server-side debounced + Pagination UI

### Phase 2A
- [`TeacherSessionsPage.tsx`](apps/web/src/views/TeacherSessionsPage.tsx) → `limit=100&page=1`, sin Pagination UI
- [`SimulationSessionViewer.tsx`](apps/web/src/components/SimulationSessionViewer.tsx) → igual

### Phase 3
- `GET /courses` paginado; `GET /courses/dropdown/list` unbounded
- [`AdminPanel.tsx`](apps/web/src/views/AdminPanel.tsx) courses tab → `usePagination`
- 11 consumidores de dropdown migrados a `/courses/dropdown/list`

### Phase 4 — Seed local

```bash
docker compose exec api-nest npx ts-node src/prisma/seed-pagination-demo.ts --local-only
```

Script: [`apps/api-nest/src/prisma/seed-pagination-demo.ts`](apps/api-nest/src/prisma/seed-pagination-demo.ts)  
~28 registros `[PAG]` por entidad. Guards: `--local-only` / NODE_ENV + bloqueo URLs prod.

### Phase 5

Checklist: [`QA_PAGINACION_CHECKLIST.md`](QA_PAGINACION_CHECKLIST.md)

---

## Lo que NO se toca / queda fuera

- Deploy / CI producción
- `MinisterioDashboard` paginación
- Revertir paginación BE de sesiones
- Prácticas / Grupos / Términos / Reportes (no priorizados tras Phase 3 Cursos)

---

## PR sugerido (cuando lo pidas)

**Branch:** `feat/paginacion-global` → `develop`  
**Título sugerido:** `feat(pagination): close silent truncation, courses tab, local seed`

**Archivos relevantes del diff de esta sesión:**  
AssignmentsABM, LegajosPage, TeacherSessionsPage, SimulationSessionViewer, AdminPanel, courses service/controller/specs, admin.controller, 11 dropdown consumers, seed-pagination-demo, handoffs/QA/decision docs.

**No incluir en commit:** scripts de prueba sueltos (`check_pw.ts`, `test_pw_update.ts`, `db_output*.txt`, notas Gemini, etc.).

---

## Referencias

- ABM con filtros: `UsersABM.tsx`
- ABM simple: `SponsorsABM.tsx`
- Hook: `apps/web/src/hooks/usePagination.ts`
- Envelope: `r.data?.data ?? r.data` (dropdowns) / `usePagination` (listas)
