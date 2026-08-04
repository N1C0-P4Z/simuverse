# Handoff: Paginación Frontend Pendiente

**Rama**: `feat/paginacion-global`  
**Base**: develop (`057d471`)  
**Fecha**: 2026-08-03  

---

## Contexto

28 endpoints backend ya tienen paginación con Prisma `skip`/`take` + `count`. Todos devuelven envelope `{ data: T[], total: number, page: number, limit: number }`.  
10 ABMs frontend ya migrados a `usePagination` + `<Pagination>`.  
**Faltan 5 vistas** que usan `useState` + `useEffect` + `apiClient.get()` sin paginación visible.

---

## Infraestructura Disponible

### Backend
```ts
// apps/api-nest/src/common/dto/pagination.dto.ts
class PaginationDto { page: number = 1; limit: number = 20 } // @Min(1), @Max(100)

// apps/api-nest/src/common/helpers/paginate.ts
paginate<T>(model, where, opts) → Promise<{ data: T[], total, page, limit }>
```

### Frontend
```ts
// apps/web/src/hooks/usePagination.ts
usePagination<T>({ endpoint, limit?, extraParams? }) → {
  data, total, page, totalPages, loading, error, setPage, setExtraParams
}
```

### Componente
```tsx
// apps/web/src/components/ui/pagination.tsx
<Pagination>, <PaginationContent>, <PaginationItem>, <PaginationLink>,
<PaginationPrevious>, <PaginationNext> — ya tiene isDisabled para accesibilidad
```

---

## Vistas Pendientes (5)

### 1. LegajosPage.tsx
**Archivo**: `apps/web/src/views/LegajosPage.tsx`  
**Backend**: `GET /legajo/students?page=&limit=&course_id=&search=` (missing-controllers.ts)  
**Estado actual**: `useState<StudentSummary[]>([])` + `apiClient.get('/legajo/students')`  
**Filtros existentes**: course_id, search — ya server-side, solo falta envolver con hook

**Patrón a seguir**:
```tsx
import { usePagination } from '@/hooks/usePagination';

const { data: students, total, page, totalPages, setPage, setExtraParams } = usePagination<StudentSummary>({
  endpoint: '/legajo/students',
  extraParams: { course_id: selectedCourse, search: searchTerm },
});
// Reemplazar useState + useEffect
// Agregar <Pagination> al final
```

---

### 2. TeacherSessionsPage.tsx
**Archivo**: `apps/web/src/views/TeacherSessionsPage.tsx`  
**Backend**: `GET /teacher/sessions?page=&limit=&course_id=&status=`  
**Estado actual**: `useState<SessionRow[]>([])` + `apiClient.get('/teacher/sessions?...')`  
**Filtros existentes**: course_id, status — ya server-side

**Patrón**:
```tsx
const { data: sessions, total, page, totalPages, setPage, setExtraParams } = usePagination<SessionRow>({
  endpoint: '/teacher/sessions',
  extraParams: { course_id: selectedCourse, status: selectedStatus },
});
```

---

### 3. EvaluationsPage.tsx
**Archivo**: `apps/web/src/views/EvaluationsPage.tsx`  
**Backend**: `GET /simulations?page=&limit=` + `GET /assessments?page=&limit=`  
**Estado actual**: `useState<any[]>([])` + `apiClient.get('/simulations')` + `/assessments`  
**Nota**: Tiene 3 datasets (simulations, courses, logs). Solo simulations y assessments van paginados. Courses sigue siendo dropdown.

**Patrón**:
```tsx
const { data: simulations, total, page, totalPages, setPage } = usePagination<any>({
  endpoint: '/simulations',
});
// courses sigue con apiClient.get('/courses') normal
// assessments similar con usePagination
```

---

### 4. MinisterioDashboard.tsx
**Archivo**: `apps/web/src/views/MinisterioDashboard.tsx`  
**Backend**: `GET /ministry/requirements?page=&limit=` + `GET /ministry/kpis?page=&limit=`  
**Estado actual**: `useState<MinistryRequirement[]>([])` + `useState<KPI[]>([])`

**Patrón**:
```tsx
const { data: reqs, total: reqsTotal, page: reqsPage, totalPages: reqsPages, setPage: setReqsPage } = usePagination<MinistryRequirement>({
  endpoint: '/ministry/requirements',
});
const { data: kpis, total: kpisTotal, page: kpisPage, totalPages: kpisPages, setPage: setKpisPage } = usePagination<KPI>({
  endpoint: '/ministry/kpis',
});
```

---

### 5. AssignmentsABM.tsx
**Archivo**: `apps/web/src/components/AssignmentsABM.tsx`  
**Backend**: `GET /assignments?page=&limit=&student_id=&course_id=&status=`  
**Estado actual**: `useState<Assignment[]>([])` + `apiClient.get('/assignments')`  
**También usa**: `/users?role=student` (dropdown de alumnos — NO paginar), `/courses` (dropdown — NO paginar), `/scenarios/dropdown/list` (dropdown — NO paginar)

**Patrón**:
```tsx
const { data: assignments, total, page, totalPages, setPage } = usePagination<Assignment>({
  endpoint: '/assignments',
});
// fetchStudents, fetchCourses, fetchScenarios siguen con apiClient.get() normal (son dropdowns)
// La función fetchAssignments se ELIMINA, reemplazada por usePagination
```

---

## Patrón de Paginación en JSX

Copiá de cualquier ABM ya migrado (ej. `UsersABM.tsx` o `SponsorsABM.tsx`):

```tsx
{total > 0 && (
  <div className="flex items-center justify-between mt-4">
    <p className="text-sm text-gray-500">{total} resultados</p>
    {totalPages > 1 && (
      <Pagination>
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              onClick={() => page > 1 && setPage(page - 1)}
              className={page <= 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
            />
          </PaginationItem>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
            <PaginationItem key={p}>
              <PaginationLink isActive={p === page} onClick={() => setPage(p)} className="cursor-pointer">
                {p}
              </PaginationLink>
            </PaginationItem>
          ))}
          <PaginationItem>
            <PaginationNext
              onClick={() => page < totalPages && setPage(page + 1)}
              className={page >= totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    )}
  </div>
)}
```

---

## Filtros Server-Side

Si el `useState` actual ya maneja filtros con query params (ej. `?course_id=`), usá `setExtraParams`:

```tsx
const [selectedCourse, setSelectedCourse] = useState('');

const { data, setPage, setExtraParams } = usePagination({
  endpoint: '/legajo/students',
  extraParams: { course_id: selectedCourse },
});

// Cuando cambia el filtro:
const handleCourseChange = (courseId: string) => {
  setSelectedCourse(courseId);
  setExtraParams({ course_id: courseId }); // resetea a page 1 automáticamente
};
```

---

## Lo Que NO Se Toca

- Endpoints de dropdown: `/users?role=student`, `/courses`, `/scenarios/dropdown/list`, `/categories/dropdown/list`, etc.
- Vistas: Simulations, Calendar, Aulas — excluidas por diseño
- RolesABM — es dropdown data, sin paginación
- PromptTemplatesABM — es editor por curso, no lista

---

## Referencias

- ABM con filtros: `apps/web/src/components/UsersABM.tsx` (búsqueda + rol)
- ABM simple: `apps/web/src/components/SponsorsABM.tsx`
- Hook: `apps/web/src/hooks/usePagination.ts`
- Pagination: `apps/web/src/components/ui/pagination.tsx`
- Handler de envelope: `r.data?.data ?? r.data` (donde `r` es response de apiClient)
