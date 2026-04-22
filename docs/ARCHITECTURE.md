# Arquitectura técnica — Talent HCM

## Multi-tenancy

Talent usa el patrón de **base de datos compartida con discriminador de tenant** (`shared schema`). Cada tabla de negocio tiene una columna `tenant_id` (FK a `core_tenant`). No hay bases de datos separadas por cliente.

### Modelos base

```python
class TenantModel(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, db_index=True)
    class Meta:
        abstract = True

class TimestampedTenantModel(TenantModel):
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    class Meta:
        abstract = True
```

Todos los modelos de negocio heredan de `TimestampedTenantModel`. Los catálogos globales (países, ciudades, EPS, bancos) no tienen `tenant_id` y son compartidos por todas las empresas.

### TenantManager

`apps.core.managers.TenantManager` filtra automáticamente por tenant en todos los querysets. Los ViewSets de tenant llaman a `.for_tenant(request.tenant)` para garantizar el aislamiento de datos.

---

## Autenticación y autorización

### Flujo JWT

1. El cliente hace `POST /api/v1/auth/login/` con email y password.
2. Si el usuario pertenece a un solo tenant, el servidor devuelve access token + refresh token con claims `tenant_id` y `roles`.
3. Si pertenece a varios tenants, el servidor responde con `tenant_required: true` y la lista de tenants disponibles. El cliente repite el login con `tenant_id`.
4. Los superusuarios de plataforma (sin tenant asignado) reciben tokens sin `tenant_id`.

### Claims del token

```json
{
  "user_id": "uuid",
  "tenant_id": "uuid",
  "roles": ["admin", "recruiter"],
  "exp": 1234567890
}
```

### TalentJWTAuthentication

Extiende `JWTAuthentication` de simplejwt. Al autenticar, inyecta `_jwt_tenant_id` y `_jwt_roles` en `request.user`.

### TenantMiddleware

Resuelve el tenant desde `request.user._jwt_tenant_id` y lo asigna a `request.tenant`. Los ViewSets lo leen desde allí.

### Jerarquía de permisos

| Clase | Verifica | Uso |
|---|---|---|
| `IsAuthenticated` | Token válido | Lectura de catálogos globales |
| `IsStaffUser` | `is_staff` o `is_superuser` | Administración de tenants |
| `IsDjangoSuperuser` | `is_superuser` | Escritura en catálogos globales |
| `HasTenant` | `request.tenant` existe | Operaciones de tenant |
| `HasModule` | Módulo habilitado en `TenantModules` | Acceso a módulos opcionales |

---

## Modelos de datos

### Tenant y configuración

- **`Tenant`** — empresa cliente: nombre, slug único, datos legales, logo, idioma, ARL, ciudad
- **`TenantModules`** — OneToOne con Tenant; flags booleanos por módulo (`hiring`, `personnel`, `quality`, `performance`, `evaluations`, `portal`, `surveys`, `orgchart`)
- **`User`** — usuario de plataforma; email como USERNAME_FIELD; `nomiweb_id` para sincronización futura
- **`UserTenant`** — relación M2M Usuario↔Tenant con roles por empresa; `unique_together(user, tenant)`
- **`Role`** — choices: `admin`, `manager`, `employee`, `recruiter`, `quality_auditor`

### Catálogos globales

Replican la estructura de Nomiweb para sincronización futura:

| Modelo | Tabla Nomiweb | Contenido |
|---|---|---|
| `Country` | `paises` | Países con código ISO |
| `StateProvince` | `ciudades.coddepartamento` | Departamentos/estados |
| `City` | `ciudades` | Municipios con código DANE |
| `DocumentType` | `tipodocumento` | CC, CE, NIT, Pasaporte… |
| `SocialSecurityEntity` | `entidadessegsocial` | EPS, AFP, ARL, CCF, Cesantías |
| `Bank` | `bancos` | Entidades bancarias |
| `ContractType` | `tipocontrato` | Tipos de contrato laboral |
| `SalaryType` | `tiposalario` | Tipos de salario |
| `ContributorType` | `tiposdecotizantes` | Tipos de cotizante PILA |
| `Profession` | `profesiones` | Profesiones |

### Catálogos por empresa (tenant-scoped)

| Modelo | Nomiweb | Descripción |
|---|---|---|
| `OrganizationalLevel` | `nivelesestructura` | Niveles del organigrama |
| `Position` | `cargos` | Cargos/posiciones |
| `CostCenter` | `costos` | Centros de costo |
| `SubCostCenter` | `subcostos` | Sub-centros de costo |
| `WorkLocation` | `sedes` | Sedes / lugares de trabajo |
| `WorkCenter` | `centrotrabajo` | Centros de trabajo ARL |

### Personal

- **`Department`** — estructura jerárquica (`parent` auto-referencial); método `get_tree()` para árbol anidado
- **`Employee`** — empleado con 40+ campos alineados con `contratosemp` de Nomiweb; `global_employee_id` (UUID) para identificación cruzada entre sistemas
- **`Contract`** — contrato laboral alineado con `contratos` de Nomiweb; sólo un contrato `is_current=True` por empleado
- **`EmployeeDocument`** — archivos adjuntos (copia CC, RUT, certificación bancaria, etc.)
- **`EmployeeHistory`** — auditoría de cambios en campos del empleado

### Reclutamiento

- **`HiringProcess`** — proceso de selección para un cargo
- **`Candidate`** — candidato con pipeline: applied → screening → interview → offer → hired/rejected
- **`OnboardingChecklist`** — plantilla reutilizable de tareas de incorporación (máximo una `is_default` por tenant)
- **`OnboardingTask`** — tarea individual dentro de la checklist; ordenada por `order`
- **`EmployeeOnboarding`** — instancia de checklist asignada a un empleado específico
- **`OnboardingTaskCompletion`** — registro de completitud por tarea; cálculo de `progress_percentage`

### Calidad ISO 9001

- **`QualityProcess`** — proceso documentado con código único por tenant (ej. `PR-RH-001`)
- **`QualityDocument`** — documento controlado: procedimiento, instrucción, formato, registro, política, manual
- **`InternalAudit`** — auditoría interna; código único por tenant; vinculada a un proceso
- **`AuditFinding`** — hallazgo: no conformidad mayor/menor, observación, oportunidad de mejora
- **`NonConformity`** — no conformidad + CAPA completa: causa raíz, acción inmediata, correctiva, preventiva
- **`ContinuousImprovement`** — acción de mejora continua (ISO 9001 cláusula 10.3)

### KPIs y OKRs

- **`OKRPeriod`** — período de evaluación (Q1, H1, Anual); solo uno `is_active=True` por tenant
- **`Objective`** — objetivo en tres niveles: company, department, individual; soporta jerarquía padre-hijo
- **`KeyResult`** — resultado clave con valores start/current/target; `progress_percentage` calculado
- **`KeyResultUpdate`** — check-in de progreso; sincroniza `KeyResult.current_value` automáticamente
- **`KPI`** — indicador independiente de OKRs; puede vincularse a un proceso de calidad
- **`KPIMeasurement`** — medición puntual de KPI por período; `unique_together(kpi, period_date)`

---

## Frontend

### Estructura

```
frontend/src/
├── api/            # Módulos de cliente HTTP (catalogs.ts, personnel.ts, hiring.ts…)
├── components/
│   ├── layout/     # Header, Sidebar, layout general
│   └── ui/         # DataTable, Badge, ConfirmDialog, ErrorAlert, Breadcrumb…
├── contexts/
│   ├── AuthContext.tsx   # JWT, usuario, tenant, hooks de acceso
│   └── TenantContext.tsx # Contexto de tenant activo
├── pages/
│   ├── admin/      # Sección staff: TenantAdmin, AdminCatalogs
│   └── settings/   # Catálogos por empresa
└── types/          # Interfaces TypeScript (index.ts)
```

### Capa de API

Dos helpers genéricos en `api/catalogs.ts`:

- `tenantCrud<T>(basePath)` — para catálogos de empresa (datasets pequeños, respuesta plana)
- `globalCatalogCrud<T>(basePath)` — para catálogos globales (paginado, incluye `deactivate`/`activate`)

### Patrones de UI

- **Formulario inline**: el formulario de creación/edición se muestra como una card encima de la tabla, sin páginas separadas
- **Confirmación de toggle**: botones "Activar"/"Desactivar" abren `ConfirmDialog` antes de ejecutar
- **Protección de escritura**: `canWrite = useGlobalCatalogWriteAccess()` controla visibilidad de botones de escritura
- **Paginación servidor**: catálogos globales con >50 registros usan `PAGE_SIZE=50` en el backend; `DataTable` recibe `total`, `page` y `onPageChange`

### Librerías principales

| Librería | Versión | Uso |
|---|---|---|
| React | 18.3 | UI |
| TypeScript | 5.7 | Tipado estático |
| Vite | 6 | Build y dev server |
| Tailwind CSS | 3.4 | Estilos |
| TanStack Query | 5 | Fetching y caché |
| React Hook Form | 7 | Formularios |
| React Router DOM | 7 | Ruteo |
| Recharts | 3 | Gráficos |
| Axios | 1.7 | HTTP client |

---

## Integración con Nomiweb

Los modelos de Talent replican intencionalmente los nombres de columna de Nomiweb (`pnombre`, `papellido`, `docidentidad`, etc.) en los comentarios del código. La integración futura se realizará mediante API REST entre sistemas, usando `global_employee_id` como clave de sincronización entre Talent y Nomiweb.

Los catálogos globales (países, ciudades, EPS, bancos, etc.) comparten la misma estructura de tablas para facilitar la carga inicial desde dumps de Nomiweb y la sincronización periódica posterior.
