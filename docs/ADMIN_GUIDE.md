# Guía de administración de plataforma — Talent HCM

Esta guía está dirigida a los operadores de SUMMA BPO con acceso de staff o superusuario a la plataforma.

---

## Niveles de acceso de plataforma

| Nivel | `is_staff` | `is_superuser` | Capacidades |
|---|---|---|---|
| Operador de plataforma | ✓ | — | Gestionar tenants, ver catálogos globales |
| Superusuario | ✓ | ✓ | Todo lo anterior + crear/editar/desactivar catálogos globales |

Los superusuarios sin tenant asignado en sesión ven únicamente las secciones de administración en el menú lateral (sin acceso a los módulos operativos de ninguna empresa específica).

---

## Crear un nuevo cliente (tenant)

### Desde la interfaz web

1. Ingresar a la plataforma con una cuenta de staff.
2. Ir a **Admin → Tenants → Nuevo tenant**.
3. Completar los datos obligatorios:
   - **Nombre** — razón social de la empresa
   - **Slug** — identificador único en URL (sin espacios, solo minúsculas y guiones)
4. Completar los datos opcionales:
   - Tipo y número de documento (NIT), representante legal, teléfono, dirección, correo
   - País, ciudad, ARL
   - Logo y firma digital para certificaciones
5. Guardar. El tenant queda activo con los módulos por defecto habilitados (`hiring`, `personnel`, `quality`, `performance`).

### Configurar módulos del tenant

Desde el detalle del tenant, en la sección **Módulos**, activar o desactivar los módulos disponibles:

- `hiring` — Reclutamiento y Onboarding
- `personnel` — Personal
- `quality` — Calidad ISO 9001
- `performance` — KPIs y OKRs
- `evaluations`, `portal`, `surveys`, `orgchart` — Fase 2 (desactivados por defecto)

---

## Gestión de usuarios

Los usuarios se crean desde el Django Admin (`/admin/`) o mediante el endpoint `POST /api/v1/auth/register/`.

### Asignar un usuario a un tenant

Desde el Django Admin → `Core > User Tenants` → Agregar:

1. Seleccionar el usuario y el tenant.
2. Asignar los roles del usuario en esa empresa (admin, manager, recruiter, quality_auditor, employee).
3. Marcar como activo.

Un mismo usuario puede tener membresías en múltiples tenants con diferentes roles en cada uno.

### Crear un superusuario de plataforma

```bash
# Desde el servidor (Docker)
docker compose exec backend python manage.py createsuperuser

# O con el ORM
docker compose exec backend python manage.py shell -c "
from apps.core.models import User
User.objects.create_superuser(
    email='admin@summabpo.com',
    password='contraseña-segura',
    first_name='Admin',
    last_name='Plataforma'
)
"
```

Un superusuario **sin** membresía de UserTenant activa inicia sesión como administrador de plataforma (sin `tenant_id` en el token).

---

## Catálogos globales

Los catálogos globales son datos de referencia compartidos por todos los clientes: países, departamentos, ciudades, tipos de documento, bancos y entidades de seguridad social.

**Acceso:** la sección **Admin → Catálogos globales** está visible para cualquier usuario con `is_staff`. Sin embargo, crear, editar o desactivar registros requiere `is_superuser`.

### Cargar datos iniciales

Los catálogos de Colombia (ciudades, departamentos, EPS, AFP, ARL, CCF, bancos) se cargan normalmente desde un dump de la base de datos de Nomiweb:

```bash
# Ejemplo: restaurar desde dump SQL
psql -h <host-rds> -U talent_user -d db_talent < catalogo_colombia.sql
```

Alternativa usando fixtures de Django:

```bash
docker compose exec backend python manage.py loaddata catalogs/fixtures/colombia.json
```

### Desactivar un registro de catálogo global

En la interfaz web, usar el botón **Desactivar** del registro. Esto realiza un **soft-delete** — establece `is_active=False` sin eliminar el registro de la base de datos. Los usuarios de los tenants dejan de ver el registro en los selects, pero los registros históricos (contratos, empleados) que lo referencian no se ven afectados.

### Reactivar un registro

Usar el botón **Activar** desde la misma página de catálogo.

---

## Django Admin

El Django Admin está disponible en `/admin/` y es accesible para usuarios con `is_staff=True`.

### Recursos principales en el Admin

| Sección | Uso |
|---|---|
| `Core > Tenants` | Ver y editar tenants (alternativa al admin de la SPA) |
| `Core > Users` | Gestión de usuarios, asignación de is_staff / is_superuser |
| `Core > User Tenants` | Asignar usuarios a tenants con roles |
| `Core > Tenant Modules` | Ver y editar módulos habilitados por tenant |
| `Core > Roles` | Ver los roles disponibles en el sistema |
| `Catalogs > ...` | Gestión directa de todos los catálogos |

---

## Comandos de gestión útiles

```bash
# Ejecutar migraciones
docker compose exec backend python manage.py migrate

# Compilar traducciones
docker compose exec backend python manage.py compilemessages

# Generar mensajes de traducción
docker compose exec backend python manage.py makemessages -l es -l en

# Shell de Django para consultas ad-hoc
docker compose exec backend python manage.py shell

# Ver migraciones pendientes
docker compose exec backend python manage.py showmigrations

# Recolectar estáticos
docker compose exec backend python manage.py collectstatic --noinput
```

---

## Monitoreo de tareas Celery

Celery se usa para tareas asíncronas programadas (con `django-celery-beat`). Para ver el estado:

```bash
# Ver tareas activas
docker compose exec celery celery -A config.celery inspect active

# Ver tareas programadas
docker compose exec celery celery -A config.celery inspect scheduled

# Ver logs
docker compose logs -f celery
```

Las tareas periódicas se configuran desde el Django Admin en **Django Celery Beat → Periodic Tasks**.

---

## Solución de problemas comunes

### El usuario no puede iniciar sesión

1. Verificar que la cuenta esté activa (`is_active=True`) en Django Admin → Users.
2. Verificar que tenga al menos una membresía activa en `User Tenants`, o que sea superusuario.
3. Verificar que el tenant esté activo (`Tenant.is_active=True`).

### Un usuario ve "Módulo no disponible"

El módulo no está habilitado para el tenant del usuario. Ir a **Admin → Tenants → [tenant] → Módulos** y activar el módulo correspondiente.

### El catálogo global no aparece en los selects del tenant

El registro probablemente está inactivo (`is_active=False`). Ir a **Admin → Catálogos globales → [catálogo]** y buscar el registro. Si está inactivo, usar el botón **Activar**.

### Error 500 en el backend

```bash
# Ver los últimos errores
docker compose logs backend | tail -100

# Ver el stack completo del último error
docker compose logs backend | grep -A 30 "Internal Server Error"
```
