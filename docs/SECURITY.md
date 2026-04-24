# Talent HCM — Security Report

**Fecha:** 2026-04-22
**Rama:** feature/security-audit
**Autor:** Security Audit (Claude Code)

---

## 1. Vulnerabilidades encontradas y corregidas

| # | Severidad | Hallazgo | Estado |
|---|-----------|---------|--------|
| 1 | ALTA | Sin rate limiting en `/auth/login/` — fuerza bruta posible | **CORREGIDO** |
| 2 | ALTA | Sin validación de tipo/tamaño en uploads de archivos | **CORREGIDO** |
| 3 | MEDIA | Headers HTTP de seguridad ausentes (`X-Frame-Options`, `X-Content-Type-Options`, `X-XSS-Protection`) | **CORREGIDO** |
| 4 | MEDIA | `CSRF_COOKIE_SECURE` ausente en configuración de producción | **CORREGIDO** |
| 5 | MEDIA | `UPDATE_LAST_LOGIN` no configurado en JWT | **CORREGIDO** |
| 6 | MEDIA | Sin logging de eventos de seguridad (intentos de login fallidos) | **CORREGIDO** |
| 7 | BAJA | `CORS_ALLOWED_ORIGINS` no listados explícitamente en dev | **CORREGIDO** |

---

## 2. Configuración JWT

| Parámetro | Valor | Notas |
|-----------|-------|-------|
| `ACCESS_TOKEN_LIFETIME` | 60 minutos | Apropiado para SaaS interno |
| `REFRESH_TOKEN_LIFETIME` | 7 días | Reducir a 1 día en producción si se requiere mayor seguridad |
| `ROTATE_REFRESH_TOKENS` | `True` | Cada uso del refresh token genera uno nuevo |
| `BLACKLIST_AFTER_ROTATION` | `True` | El token anterior se invalida al rotar |
| `ALGORITHM` | `HS256` | Estándar; para mayor seguridad considerar RS256 en el futuro |
| `UPDATE_LAST_LOGIN` | `True` | Se actualiza `last_login` al autenticar |
| `token_blacklist` | Instalado | `rest_framework_simplejwt.token_blacklist` en INSTALLED_APPS |

**Endpoint de refresh:** `POST /api/v1/auth/token/refresh/`

---

## 3. Rate Limiting

| Scope | Rate (producción) | Rate (dev) | Aplicado en |
|-------|-------------------|------------|------------|
| `login` | 5/minuto | 10000/minuto | `LoginView` (`LoginRateThrottle`) |
| `anon` | 100/día | 100/día | Todos los endpoints no autenticados |
| `user` | 1000/día | 1000/día | Todos los endpoints autenticados |

**Clase:** `apps/core/throttling.py` → `LoginRateThrottle(AnonRateThrottle)`

**Comportamiento al exceder:** HTTP 429 Too Many Requests

**Nota dev/test:** El rate de `login` en dev es 10000/minuto para evitar que el throttle
interfiera con las corridas de pytest (el Redis persiste entre runs en el entorno dev).

---

## 4. Headers HTTP de seguridad

| Header | Configuración | Archivo |
|--------|---------------|---------|
| `X-Frame-Options` | `DENY` | `base.py` |
| `X-Content-Type-Options` | `nosniff` | `base.py` (`SECURE_CONTENT_TYPE_NOSNIFF`) |
| `X-XSS-Protection` | Activado | `base.py` (`SECURE_BROWSER_XSS_FILTER`) |
| `Strict-Transport-Security` | 1 año + subdomains + preload | `prod.py` |
| `Strict-Transport-Security` | Solo en HTTPS (SSL redirect) | `prod.py` |
| `Session-Cookie` | `Secure`, `HttpOnly`, `SameSite=Lax` | `base.py` |
| `CSRF-Cookie` | `Secure` | `prod.py` |

---

## 5. CORS

| Configuración | Valor | Archivo |
|--------------|-------|---------|
| `CORS_ALLOWED_ORIGINS` | Desde env var `CORS_ALLOWED_ORIGINS` | `base.py` |
| `CORS_ALLOW_CREDENTIALS` | `True` | `base.py` |
| `CORS_ALLOW_ALL_ORIGINS` | `True` (solo dev) | `dev.py` |
| Orígenes dev explícitos | `localhost:5173`, `localhost:3000`, `127.0.0.1:5173` | `dev.py` |

**Producción:** Solo los orígenes listados en la variable de entorno `CORS_ALLOWED_ORIGINS`.
Nunca se usa `CORS_ALLOW_ALL_ORIGINS = True` en producción.

---

## 6. Validaciones de upload implementadas

**Módulo:** `apps/core/validators.py`

| Validator | Límite | Tipos permitidos | Aplicado en |
|-----------|--------|-----------------|------------|
| `validate_image_file` | 2 MB | JPEG, PNG, WEBP, GIF (Pillow magic bytes) | Tenant.logo, Tenant.signature, Employee.photo |
| `validate_document_file` | 10 MB | Todo excepto: .exe, .sh, .bat, .cmd, .php, .js, .py, .rb, .pl, .ps1, .msi | Employee.resume_file, Contract.document, EmployeeDocument.file, Candidate.resume |

**Implementación:** Usa Pillow para verificar imágenes por magic bytes (no por extensión),
lo que previene bypass mediante renombrar archivos.

---

## 7. Logging de seguridad

**Archivo de log:** `logs/security.log` (relativo al `BASE_DIR`)

**Formato:** `{level} {timestamp} {module} {message}`

**Eventos registrados:**
- Login fallido: `WARNING security — Login fallido para <email> desde <IP>`
- Eventos de seguridad de Django (`django.security` logger)

**Loggers configurados:**

| Logger | Level | Handlers |
|--------|-------|---------|
| `security` | WARNING | console + `logs/security.log` |
| `django.security` | WARNING | console + `logs/security.log` |

---

## 8. Variables de entorno requeridas en producción

```bash
# Django
DJANGO_SECRET_KEY=<clave-aleatoria-64-chars-minimo>
DJANGO_SETTINGS_MODULE=config.settings.prod
DJANGO_ALLOWED_HOSTS=talent.nomiweb.co

# Base de datos (AWS RDS)
TALENT_DB_NAME=db_talent
TALENT_DB_USER=talent_user
TALENT_DB_PASSWORD=<password>
TALENT_DB_HOST=<rds-endpoint>
TALENT_DB_PORT=5432

# Redis
REDIS_URL=redis://redis:6379/1
CELERY_BROKER_URL=redis://redis:6379/2

# CORS (React SPA)
CORS_ALLOWED_ORIGINS=https://talent.nomiweb.co

# Almacenamiento de archivos
MEDIA_ROOT=/app/media/

# Monitoreo (opcional)
SENTRY_DSN=<dsn>
```

---

## 9. Endpoints públicos (sin autenticación requerida)

| Endpoint | Método | Notas |
|----------|--------|-------|
| `POST /api/v1/auth/login/` | POST | Rate limited: 5/min |
| `POST /api/v1/auth/register/` | POST | Crear cuenta; requiere asignación de tenant por admin |
| `POST /api/v1/auth/token/refresh/` | POST | Requiere refresh token válido |
| `GET /api/schema/` | GET | OpenAPI schema — considerar proteger en prod |
| `GET /api/docs/` | GET | Swagger UI — considerar proteger en prod |
| `GET /` | GET | Redirect a Swagger UI |

---

## 10. Recomendaciones pendientes para fases futuras

### Alta prioridad

1. **Proteger documentación en producción** — `/api/schema/` y `/api/docs/` están accesibles
   sin autenticación. Agregar `permission_classes = [IsAuthenticated]` a `SpectacularAPIView`
   y `SpectacularSwaggerView` en producción, o agregar auth básica vía Nginx.

2. **Autenticación 2FA** — Para superadmins y admins de tenant, implementar TOTP
   (django-otp o similar). Especialmente crítico para la plataforma multi-tenant.

3. **Audit log completo** — Registrar CREATE/UPDATE/DELETE en modelos críticos
   (Employee, Contract, Tenant, UserTenant) con quién, cuándo, desde dónde y qué cambió.
   Considerar `django-simple-history` o modelo `AuditLog` propio.

4. **Penetration testing** — Realizar pruebas OWASP Top 10 antes del despliegue en
   producción (IDOR en tenant isolation, SQL injection, XSS, CSRF).

### Media prioridad

5. **RS256 para JWT** — Migrar de HS256 a RS256 si se planea federación con otros
   servicios o tokens de larga duración. Requiere par de claves pública/privada.

6. **Redis con password** — Configurar `requirepass` en Redis de producción.
   Actualmente el Redis de docker-compose no tiene contraseña (aceptable si solo
   está en red interna, pero agregar auth es buena práctica).

7. **Rotación de SECRET_KEY** — Implementar procedimiento de rotación periódica de
   `DJANGO_SECRET_KEY` sin downtime (Django soporta `SECRET_KEY_FALLBACKS`).

8. **Content Security Policy (CSP)** — Agregar header CSP vía `django-csp` para
   proteger contra XSS en el frontend.

9. **Límite de tamaño de request** — Configurar `DATA_UPLOAD_MAX_MEMORY_SIZE` y
   `FILE_UPLOAD_MAX_MEMORY_SIZE` en settings para prevenir DoS por uploads masivos.

### Baja prioridad

10. **Alertas en tiempo real** — Integrar el logger `security` con un canal de Slack
    o PagerDuty para alertas inmediatas en intentos de login sospechosos (múltiples
    IPs, patrones de fuerza bruta distribuida).

11. **IP allowlist para admin** — Restringir acceso a `/admin/` por IP vía Nginx o
    middleware.

---

## 11. Archivos modificados en este hardening

| Archivo | Cambios |
|---------|---------|
| `config/settings/base.py` | Headers HTTP, throttling en REST_FRAMEWORK, `UPDATE_LAST_LOGIN`, LOGGING |
| `config/settings/prod.py` | `SESSION_COOKIE_SECURE`, `CSRF_COOKIE_SECURE` |
| `config/settings/dev.py` | `CORS_ALLOWED_ORIGINS` list, rate de login relajado para tests |
| `config/settings/test.py` | `DummyCache` para no acumular throttle en tests |
| `apps/core/throttling.py` | `LoginRateThrottle` (nuevo) |
| `apps/core/validators.py` | `validate_image_file`, `validate_document_file` (nuevo) |
| `apps/core/views.py` | `throttle_classes`, logging en LoginView |
| `apps/core/models.py` | Validators en `logo`, `signature` |
| `apps/personnel/models.py` | Validators en `photo`, `resume_file`, `document`, `file` |
| `apps/hiring/models.py` | Validator en `resume` |
| `logs/.gitkeep` | Carpeta de logs (nuevo) |
