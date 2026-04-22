# Referencia de la API — Talent HCM

Base URL: `/api/v1/`

Documentación interactiva (Swagger): `/api/docs/`

Schema OpenAPI: `/api/schema/`

---

## Autenticación

Todas las rutas (salvo `/auth/login/` y `/auth/register/`) requieren el header:

```
Authorization: Bearer <access_token>
```

Los tokens se obtienen en el endpoint de login y se renuevan con el refresh token.

---

## Auth — `/api/v1/auth/`

### `POST /api/v1/auth/login/`

Autentica un usuario y devuelve tokens JWT.

**Permisos:** Público

**Request:**
```json
{
  "email": "usuario@empresa.com",
  "password": "contraseña",
  "tenant_id": "uuid-opcional"
}
```

**Response exitosa (un solo tenant):**
```json
{
  "access": "<jwt_access_token>",
  "refresh": "<jwt_refresh_token>",
  "user": { "id": "uuid", "email": "...", "firstName": "...", "roles": ["admin"] },
  "tenant": { "id": "uuid", "name": "Empresa XYZ", "slug": "empresa-xyz" },
  "modules": { "hiring": true, "personnel": true, "quality": false, ... }
}
```

**Response — usuario con múltiples tenants (requiere selección):**
```json
{
  "tenant_required": true,
  "tenants": [
    { "id": "uuid-1", "name": "Empresa A", "slug": "empresa-a" },
    { "id": "uuid-2", "name": "Empresa B", "slug": "empresa-b" }
  ]
}
```

En este caso el cliente vuelve a llamar a `/login/` incluyendo el `tenant_id` elegido.

### `POST /api/v1/auth/logout/`

Invalida el refresh token (lo añade a la blacklist).

**Request:** `{ "refresh": "<refresh_token>" }`

**Response:** `204 No Content`

### `POST /api/v1/auth/token/refresh/`

Renueva el access token.

**Request:** `{ "refresh": "<refresh_token>" }`

**Response:** `{ "access": "<nuevo_access_token>" }`

### `GET /api/v1/auth/me/`

Bootstrap del frontend. Devuelve usuario, tenant activo y módulos habilitados.

**Response:** igual al login exitoso.

### `POST /api/v1/auth/register/`

Crea una cuenta de usuario. Un administrador debe asignarla a un tenant manualmente.

---

## Tenants (staff) — `/api/v1/tenants/`

**Permisos:** `is_staff` o `is_superuser`

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/v1/tenants/` | Listar tenants |
| POST | `/api/v1/tenants/` | Crear tenant |
| GET | `/api/v1/tenants/{id}/` | Detalle de tenant |
| PATCH | `/api/v1/tenants/{id}/` | Actualizar tenant |
| DELETE | `/api/v1/tenants/{id}/` | Eliminar tenant |
| GET | `/api/v1/tenants/{id}/modules/` | Ver módulos habilitados |
| PATCH | `/api/v1/tenants/{id}/modules/` | Actualizar módulos habilitados |

---

## Catálogos globales — `/api/v1/catalogs/`

**Lectura:** cualquier usuario autenticado  
**Escritura/eliminación:** solo `is_superuser`  
**Eliminación:** soft-delete — establece `is_active=False`

Los usuarios sin `is_staff` solo ven registros con `is_active=True`. El staff ve todos.

### Paginación

Todos los endpoints de listado usan paginación por página (`PAGE_SIZE=50`):

```json
{
  "count": 1127,
  "next": "/api/v1/catalogs/cities/?page=2",
  "previous": null,
  "results": [...]
}
```

**Parámetros de query comunes:**
- `page` — número de página (default: 1)
- `page_size` — registros por página (default: 50)
- `search` — búsqueda de texto
- `is_active` — filtrar por estado (`true`/`false`)

### Endpoints por catálogo

#### Países
`GET/POST /api/v1/catalogs/countries/`  
`GET/PATCH/DELETE /api/v1/catalogs/countries/{id}/`

Query params: `search` (nombre, iso_code)

#### Departamentos / Estados
`GET/POST /api/v1/catalogs/states/`  
`GET/PATCH/DELETE /api/v1/catalogs/states/{id}/`

Query params: `search`, `country` (id)

#### Ciudades
`GET/POST /api/v1/catalogs/cities/`  
`GET/PATCH/DELETE /api/v1/catalogs/cities/{id}/`

Query params: `search`, `country` (id), `state` (id)

**Response incluye `state_province_name`** (campo de solo lectura del serializer).

#### Tipos de documento
`GET/POST /api/v1/catalogs/document-types/`  
`GET/PATCH/DELETE /api/v1/catalogs/document-types/{id}/`

#### Bancos
`GET/POST /api/v1/catalogs/banks/`  
`GET/PATCH/DELETE /api/v1/catalogs/banks/{id}/`

#### Entidades de seguridad social
`GET/POST /api/v1/catalogs/social-security-entities/`  
`GET/PATCH/DELETE /api/v1/catalogs/social-security-entities/{id}/`

Query params: `search`, `type` (EPS | AFP | ARL | CCF | CESANTIAS)

#### Tipos de contrato (solo lectura)
`GET /api/v1/catalogs/contract-types/`

#### Tipos de salario (solo lectura)
`GET /api/v1/catalogs/salary-types/`

#### Tipos de cotizante y subtipos (solo lectura)
`GET /api/v1/catalogs/contributor-types/`  
`GET /api/v1/catalogs/contributor-subtypes/`

#### Profesiones, Diagnósticos, Tipos de ausencia (solo lectura)
`GET /api/v1/catalogs/professions/`  
`GET /api/v1/catalogs/diagnoses/`  
`GET /api/v1/catalogs/absence-types/`

#### Festivos (solo lectura)
`GET /api/v1/catalogs/holidays/`

### Catálogos por empresa (tenant-scoped)

**Permisos:** `IsAuthenticated` + `HasTenant`

| Ruta | Catálogo |
|---|---|
| `/api/v1/catalogs/organizational-levels/` | Niveles organizacionales |
| `/api/v1/catalogs/positions/` | Cargos |
| `/api/v1/catalogs/cost-centers/` | Centros de costo |
| `/api/v1/catalogs/sub-cost-centers/` | Sub-centros de costo |
| `/api/v1/catalogs/work-locations/` | Sedes |
| `/api/v1/catalogs/work-centers/` | Centros de trabajo |

Todos soportan GET (lista), POST (crear), GET/{id}, PATCH/{id}, DELETE/{id}.

---

## Personal — `/api/v1/personnel/`

**Permisos:** `IsAuthenticated` + `HasTenant` + módulo `personnel` habilitado

### Departamentos
`GET/POST /api/v1/personnel/departments/`  
`GET/PATCH/DELETE /api/v1/personnel/departments/{id}/`  
`GET /api/v1/personnel/departments/tree/` — árbol jerárquico completo

### Empleados
`GET/POST /api/v1/personnel/employees/`  
`GET/PATCH/DELETE /api/v1/personnel/employees/{id}/`

Query params: `search`, `status`, `department`, `is_active`

### Contratos
`GET/POST /api/v1/personnel/employees/{id}/contracts/`  
`GET/PATCH /api/v1/personnel/employees/{id}/contracts/{contract_id}/`

### Documentos del empleado
`GET/POST /api/v1/personnel/employees/{id}/documents/`  
`GET/PATCH/DELETE /api/v1/personnel/employees/{id}/documents/{doc_id}/`

### Historial del empleado
`GET /api/v1/personnel/employees/{id}/history/`

---

## Reclutamiento — `/api/v1/hiring/`

**Permisos:** `IsAuthenticated` + `HasTenant` + módulo `hiring` habilitado

### Procesos de selección
`GET/POST /api/v1/hiring/processes/`  
`GET/PATCH/DELETE /api/v1/hiring/processes/{id}/`

### Candidatos
`GET/POST /api/v1/hiring/processes/{id}/candidates/`  
`GET/PATCH /api/v1/hiring/processes/{id}/candidates/{candidate_id}/`

### Checklists de onboarding
`GET/POST /api/v1/hiring/onboarding-checklists/`  
`GET/PATCH/DELETE /api/v1/hiring/onboarding-checklists/{id}/`

### Tareas de la checklist
`GET/POST /api/v1/hiring/onboarding-checklists/{id}/tasks/`

### Onboarding de empleados
`GET/POST /api/v1/hiring/employee-onboardings/`  
`GET /api/v1/hiring/employee-onboardings/{id}/`  
`POST /api/v1/hiring/employee-onboardings/{id}/complete-task/`

---

## Calidad — `/api/v1/quality/`

**Permisos:** `IsAuthenticated` + `HasTenant` + módulo `quality` habilitado

| Ruta | Recurso |
|---|---|
| `/api/v1/quality/processes/` | Procesos de calidad |
| `/api/v1/quality/documents/` | Documentos controlados |
| `/api/v1/quality/audits/` | Auditorías internas |
| `/api/v1/quality/audits/{id}/findings/` | Hallazgos de auditoría |
| `/api/v1/quality/nonconformities/` | No conformidades + CAPA |
| `/api/v1/quality/improvements/` | Mejora continua |
| `/api/v1/quality/dashboard/` | Métricas de calidad (GET) |

---

## Desempeño — `/api/v1/performance/`

**Permisos:** `IsAuthenticated` + `HasTenant` + módulo `performance` habilitado

| Ruta | Recurso |
|---|---|
| `/api/v1/performance/periods/` | Períodos OKR |
| `/api/v1/performance/objectives/` | Objetivos |
| `/api/v1/performance/objectives/{id}/key-results/` | Resultados clave |
| `/api/v1/performance/objectives/{id}/key-results/{kr_id}/updates/` | Check-ins de KR |
| `/api/v1/performance/kpis/` | KPIs |
| `/api/v1/performance/kpis/{id}/measurements/` | Mediciones de KPI |
| `/api/v1/performance/dashboard/` | Métricas de desempeño (GET) |

---

## Códigos de error

| Código | Descripción |
|---|---|
| `400` | Datos inválidos — body con detalle de errores por campo |
| `401` | Sin autenticación o token expirado |
| `403` | Sin permisos suficientes (módulo no habilitado, sin tenant, sin rol) |
| `404` | Recurso no encontrado |
| `405` | Método no permitido |

**Formato de error:**
```json
{
  "detail": "No tiene permiso para realizar esta acción."
}
```

O por campo:
```json
{
  "email": ["Este campo es requerido."],
  "salary": ["Un número válido es requerido."]
}
```
