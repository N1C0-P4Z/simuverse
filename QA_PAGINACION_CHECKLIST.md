# Phase 5 — QA checklist (paginación)

**Rama:** `feat/paginacion-global`  
**Fecha:** 2026-08-03

## Cómo preparar datos

```bash
docker compose exec api-nest npx ts-node src/prisma/seed-pagination-demo.ts --local-only
```

Login admin: `admin@simuverse.edu` / `Admin123!`

## Checklist (manual en UI)

- [ ] **9 ABMs migrados** (Categorías, Escenarios, Documentos, Fichas, Usuarios, Empresas, Fundación, Avaladores, Sponsors): muestran “X resultados” y controles de página si hay >20 (`[PAG]` seed)
- [ ] **Asignaciones**: `usePagination` + UI; sin truncamiento silencioso; create/delete refresca lista
- [ ] **Legajos**: búsqueda server-side; paginación visible con >20 alumnos; total en header
- [ ] **Sesiones / Sesiones (general)**: sin UI de paginación; request con `limit=100&page=1`
- [ ] **Calendario**: sin paginación
- [ ] **Dropdowns** (cursos en formularios, escenarios dropdown, roles): cargan lista completa
- [ ] **`/ministerio`**: no migrado a paginación (fuera de scope)

## Verificación estática (código — 2026-08-03)

| Item | Estado código |
|------|----------------|
| AssignmentsABM + usePagination + Pagination | OK |
| LegajosPage + usePagination + debounced search | OK |
| TeacherSessionsPage `limit=100&page=1` | OK |
| SimulationSessionViewer `limit=100&page=1` | OK |
| Seed `seed-pagination-demo.ts` + guards locales | OK |
| MinisterioDashboard no tocado para paginación | OK |
| Seed Docker no ejecutado en esta sesión (compose down) | Pendiente humano |

## Notas

Tras Phase 3 (Cursos), re-chequear dropdowns de curso en Assignments, Scenarios, Documents, TechSheets, Practices, PromptTemplates, Reports, TeacherSessions, Dashboard.
