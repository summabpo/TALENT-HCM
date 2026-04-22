# Tests E2E — Talent HCM

Tests de extremo a extremo con [Playwright](https://playwright.dev/). Cubren los flujos principales del sistema desde el navegador Chromium.

---

## Prerequisitos

- Backend corriendo en `http://localhost:8001`
- Frontend corriendo en `http://localhost:5173` (`npm run dev`)
- Datos del seed cargados en la base de datos de desarrollo
- Chromium instalado: `npx playwright install chromium`

### Credenciales requeridas

| Usuario | Contraseña | Rol |
|---|---|---|
| `admin@demo.co` | `admin1234` | Admin de tenant (Demo Company) |
| `superadmin@talentsumma.co` | `Super1234!` | Superusuario de plataforma |

---

## Estructura

```
e2e/
├── auth.setup.ts                      # Genera .auth/admin.json y .auth/superadmin.json
├── auth.spec.ts                       # Tests 1–5: login, logout, rutas protegidas
├── admin-tenants.superadmin.spec.ts   # Tests 6–9: gestión de empresas (superadmin)
├── admin-catalogs.superadmin.spec.ts  # Tests 10–12: catálogos globales
├── personnel.spec.ts                  # Tests 13–16: empleados
├── hiring.spec.ts                     # Tests 17–20: reclutamiento
├── quality.spec.ts                    # Tests 21–23: calidad ISO 9001
├── performance.spec.ts                # Tests 24–26: KPIs y OKRs
├── settings-catalogs.spec.ts          # Tests 27–28: catálogos por empresa
├── helpers/
│   ├── auth.ts                        # Funciones loginAsAdmin, loginAsSuperAdmin, logout
│   └── api.ts                         # Creación de datos de prueba vía API
└── .auth/                             # storageState generados en setup (gitignore)
    ├── admin.json
    └── superadmin.json
```

---

## Ejecución

```bash
# Todos los tests (headless)
npm run test:e2e

# Con interfaz visual de Playwright (útil para depurar)
npm run test:e2e:ui

# Ver el reporte HTML del último run
npm run test:e2e:report

# Un archivo específico
npx playwright test e2e/auth.spec.ts

# Un test específico por nombre
npx playwright test --grep "login exitoso como admin"

# Con trazas (para depurar fallos)
npx playwright test --trace on
```

---

## Cómo funciona el setup de autenticación

`auth.setup.ts` se ejecuta primero y genera dos archivos de estado de sesión:

- `e2e/.auth/admin.json` — tokens JWT del admin de Demo Company en localStorage
- `e2e/.auth/superadmin.json` — tokens JWT del superusuario de plataforma

Los tests declaran cuál estado usan al inicio del archivo:

```typescript
// Tests de admin de tenant
test.use({ storageState: 'e2e/.auth/admin.json' })

// Tests de superadmin
test.use({ storageState: 'e2e/.auth/superadmin.json' })

// Tests de auth (browser fresco, sin tokens)
test.use({ storageState: { cookies: [], origins: [] } })
```

---

## Tests cubiertos

| # | Descripción | Archivo |
|---|---|---|
| 1 | Login exitoso como admin de tenant | auth.spec.ts |
| 2 | Login exitoso como superadmin | auth.spec.ts |
| 3 | Login fallido con credenciales incorrectas | auth.spec.ts |
| 4 | Logout redirige a /login | auth.spec.ts |
| 5 | Ruta protegida sin auth redirige a /login | auth.spec.ts |
| 6 | Ver lista de empresas | admin-tenants.superadmin.spec.ts |
| 7 | Crear nueva empresa | admin-tenants.superadmin.spec.ts |
| 8 | Editar empresa existente | admin-tenants.superadmin.spec.ts |
| 9 | Activar/desactivar módulos | admin-tenants.superadmin.spec.ts |
| 10 | Dashboard catálogos globales (6 tarjetas) | admin-catalogs.superadmin.spec.ts |
| 11 | Gestionar bancos: crear, editar, desactivar | admin-catalogs.superadmin.spec.ts |
| 12 | Admin tenant no puede editar catálogos globales | admin-catalogs.superadmin.spec.ts |
| 13 | Ver lista de empleados | personnel.spec.ts |
| 14 | Ver detalle de empleado | personnel.spec.ts |
| 15 | Crear empleado con campos requeridos | personnel.spec.ts |
| 16 | Editar empleado existente | personnel.spec.ts |
| 17 | Ver lista de procesos de hiring | hiring.spec.ts |
| 18 | Ver detalle de proceso con candidatos | hiring.spec.ts |
| 19 | Agregar candidato a proceso | hiring.spec.ts |
| 20 | Mover candidato de etapa | hiring.spec.ts |
| 21 | Ver dashboard de calidad | quality.spec.ts |
| 22 | Ver lista de no conformidades | quality.spec.ts |
| 23 | Crear no conformidad nueva | quality.spec.ts |
| 24 | Ver lista de períodos OKR | performance.spec.ts |
| 25 | Ver dashboard OKR con objetivos | performance.spec.ts |
| 26 | Ver dashboard de KPI | performance.spec.ts |
| 27 | Listar, crear y editar cargos | settings-catalogs.spec.ts |
| 28 | Ver centros de costo y verificar en sub-centros | settings-catalogs.spec.ts |

---

## Agregar `.auth/` al gitignore

Los archivos de estado contienen tokens JWT activos. Agregar al `.gitignore`:

```
# Playwright auth state
e2e/.auth/
playwright-report/
test-results/
```
