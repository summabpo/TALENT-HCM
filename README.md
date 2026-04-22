# Talent HCM

Plataforma de Gestión del Capital Humano (HCM) multi-tenant para SUMMA BPO. Complementa Nomiweb (nómina) y un ATS externo con módulos de Personal, Reclutamiento, Calidad ISO 9001 y KPIs/OKRs.

---

## Stack tecnológico

| Capa | Tecnología |
|---|---|
| Backend | Python 3.12, Django 5.1, Django REST Framework 3.15 |
| Frontend | React 18, TypeScript, Vite 6, Tailwind CSS 3 |
| Base de datos | PostgreSQL 16 (AWS RDS en producción) |
| Caché / Sesiones | Redis 7 |
| Cola de tareas | Celery 5 + django-celery-beat |
| API Docs | drf-spectacular (OpenAPI 3.0) |
| Autenticación | JWT (simplejwt) |
| Contenedores | Docker + docker-compose |
| Reverse proxy | Nginx Proxy Manager |

---

## Módulos — Fase 1

- **Core** — Tenants, usuarios, roles, autenticación JWT, middlewares
- **Catálogos** — Referencias globales (países, ciudades, EPS, AFP, bancos) y catálogos por empresa (cargos, centros de costo, sedes, centros de trabajo)
- **Personal** — Empleados, contratos, documentos, departamentos, historial de cambios
- **Reclutamiento y Onboarding** — Procesos de selección, candidatos, checklists de incorporación
- **Calidad ISO 9001** — Procesos, documentos controlados, auditorías internas, no conformidades, mejora continua
- **KPIs y OKRs** — Períodos, objetivos por nivel, resultados clave, indicadores de desempeño

---

## Estructura del proyecto

```
talent-hcm/
├── apps/
│   ├── core/           # Multi-tenancy, auth, permisos, modelos base
│   ├── catalogs/       # Catálogos globales y por empresa
│   ├── personnel/      # Empleados, contratos, documentos
│   ├── hiring/         # Reclutamiento y onboarding
│   ├── quality/        # ISO 9001
│   └── performance/    # KPIs y OKRs
├── config/
│   ├── settings/       # base.py, dev.py, prod.py
│   └── urls.py
├── frontend/           # React SPA
│   └── src/
│       ├── api/        # Clientes HTTP por módulo
│       ├── components/ # Componentes reutilizables (ui/, layout/)
│       ├── contexts/   # AuthContext, TenantContext
│       ├── pages/      # Páginas por módulo y rutas admin
│       └── types/      # Tipos TypeScript globales
├── locale/             # Traducciones es/en
├── requirements/       # base.txt, dev.txt, prod.txt
├── Dockerfile
├── docker-compose.dev.yml
└── docs/               # Documentación técnica detallada
```

---

## Configuración local (desarrollo)

### Prerrequisitos

- Docker y Docker Compose
- Node.js 20+
- Git

### Pasos

```bash
# 1. Clonar el repositorio
git clone <url-del-repo>
cd talent-hcm

# 2. Crear el archivo de variables de entorno
cp .env.example .env.dev
# Editar .env.dev con las credenciales de desarrollo

# 3. Levantar los contenedores (PostgreSQL + Redis + Backend)
docker compose -f docker-compose.dev.yml up --build -d

# 4. Ejecutar migraciones y cargar datos iniciales
docker compose -f docker-compose.dev.yml exec backend python manage.py migrate
docker compose -f docker-compose.dev.yml exec backend python manage.py createsuperuser

# 5. Instalar dependencias del frontend
cd frontend
npm install

# 6. Iniciar el servidor de desarrollo del frontend
npm run dev
```

El backend queda disponible en `http://localhost:8001` y el frontend en `http://localhost:5173`.

La documentación interactiva de la API se encuentra en `http://localhost:8001/api/docs/`.

---

## Variables de entorno requeridas

| Variable | Descripción |
|---|---|
| `DJANGO_SECRET_KEY` | Clave secreta de Django |
| `DJANGO_ALLOWED_HOSTS` | Hosts permitidos, separados por coma |
| `TALENT_DB_NAME` | Nombre de la base de datos PostgreSQL |
| `TALENT_DB_USER` | Usuario de la base de datos |
| `TALENT_DB_PASSWORD` | Contraseña de la base de datos |
| `TALENT_DB_HOST` | Host de la base de datos |
| `TALENT_DB_PORT` | Puerto (por defecto `5432`) |
| `REDIS_URL` | URL completa de Redis (`redis://host:port/db`) |
| `CORS_ALLOWED_ORIGINS` | Orígenes CORS permitidos, separados por coma |
| `MEDIA_ROOT` | Ruta absoluta para archivos subidos |

---

## Documentación adicional

- [Arquitectura técnica](docs/ARCHITECTURE.md)
- [Referencia de la API](docs/API.md)
- [Guía de despliegue](docs/DEPLOYMENT.md)
- [Guía de usuario](docs/USER_GUIDE.md)
- [Guía de administración de plataforma](docs/ADMIN_GUIDE.md)
