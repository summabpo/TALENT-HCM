# Guía de usuario — Talent HCM

Esta guía está dirigida a los administradores y usuarios operativos de cada empresa (tenant) dentro de la plataforma.

---

## Acceso e inicio de sesión

### Primer acceso

1. Ingresar a la URL de la plataforma proporcionada por SUMMA BPO.
2. Introducir el correo electrónico y la contraseña asignados.
3. Si el usuario pertenece a más de una empresa, aparecerá un selector de empresa antes de continuar.

### Módulos disponibles

Los módulos visibles en el menú lateral dependen de la configuración de la empresa. Los módulos posibles son:

- **Personal** — Empleados, contratos y documentos
- **Reclutamiento** — Procesos de selección y onboarding
- **Calidad** — Procesos ISO 9001, documentos y auditorías
- **Desempeño** — KPIs y OKRs

---

## Personal

### Ver el directorio de empleados

El módulo de Personal muestra un listado de todos los empleados activos de la empresa. Se puede buscar por nombre, número de documento o correo electrónico, y filtrar por departamento o estado.

### Crear un empleado

1. Ir a **Personal → Empleados** y hacer clic en **Nuevo empleado**.
2. Completar la información de identidad: tipo de documento, número de documento, nombres y apellidos.
3. Completar los datos de contacto: correo, teléfono, dirección.
4. Completar los datos personales: género, fecha de nacimiento, estado civil, grupo sanguíneo.
5. Guardar el registro.

### Registrar un contrato

Desde el perfil del empleado, acceder a la pestaña **Contratos** y hacer clic en **Nuevo contrato**. Completar:

- Tipo de contrato y fecha de inicio
- Cargo y sede
- Salario, tipo de salario y método de pago
- Entidades de seguridad social (EPS, AFP, ARL, CCF)
- Centro de costo y sub-centro de costo

Solo un contrato puede estar marcado como vigente al mismo tiempo. Al crear un nuevo contrato como vigente, el anterior se marca automáticamente como no vigente.

### Subir documentos del empleado

En la pestaña **Documentos** del perfil del empleado, hacer clic en **Agregar documento** para adjuntar archivos (copia de cédula, RUT, certificación bancaria, etc.).

### Departamentos

Ir a **Personal → Departamentos** para ver la estructura organizacional. Los departamentos pueden tener jerarquía (departamento padre e hijos) y un gerente asignado.

---

## Reclutamiento

### Crear un proceso de selección

1. Ir a **Reclutamiento → Procesos** y hacer clic en **Nuevo proceso**.
2. Ingresar el nombre del cargo, el departamento solicitante y el número de vacantes.
3. Guardar. El proceso queda en estado **Abierto**.

### Gestionar candidatos

Dentro del proceso, hacer clic en **Ver candidatos** para acceder al pipeline:

- **Aplicado** — candidato recién registrado
- **Preselección** — revisión inicial de hoja de vida
- **Entrevista** — en proceso de entrevistas
- **Oferta** — oferta laboral enviada
- **Contratado** — candidato aceptó y fue vinculado como empleado
- **Rechazado** — candidato descartado

Para avanzar un candidato, editar su registro y cambiar el estado.

### Onboarding

Cuando un candidato pasa a estado **Contratado**, se crea automáticamente un empleado. Para iniciar el onboarding:

1. Ir a **Reclutamiento → Onboarding**.
2. Seleccionar la checklist de onboarding aplicable.
3. Asignarla al nuevo empleado con la fecha de inicio.

Cada tarea de la checklist puede marcarse como completada. La plataforma muestra el porcentaje de avance del onboarding.

---

## Calidad ISO 9001

### Procesos de calidad

En **Calidad → Procesos** se gestionan los procesos documentados del sistema de gestión. Cada proceso tiene un código único (ej. `PR-RH-001`), un responsable y un estado (Borrador, Activo, En revisión, Obsoleto).

### Documentos controlados

En **Calidad → Documentos** se gestiona el control documental. Los tipos de documentos son: procedimiento, instrucción de trabajo, formato, registro, política y manual. Cada documento tiene versión, estado (Borrador, Aprobado, Obsoleto) y puede tener un archivo adjunto.

### Auditorías internas

En **Calidad → Auditorías** se planifican y registran las auditorías internas. El proceso incluye:

1. Crear la auditoría con código, proceso a auditar, auditor y fecha planificada.
2. Registrar los hallazgos: no conformidades mayores/menores, observaciones y oportunidades de mejora.
3. Cerrar la auditoría con conclusiones.

### No conformidades y CAPA

En **Calidad → No Conformidades** se registran las no conformidades detectadas (en auditoría, por queja de cliente, en proceso, etc.). Cada no conformidad incluye:

- Descripción y causa raíz
- Acción inmediata tomada
- Acción correctiva y preventiva
- Responsable y fecha límite
- Estado: Abierta → En proceso → Verificación → Cerrada

---

## Desempeño — KPIs y OKRs

### Períodos OKR

Antes de crear objetivos, debe existir un período activo (ej. Q1 2026, H1 2026). Solo puede haber un período activo por empresa. Ir a **Desempeño → Períodos** para crear o activar un período.

### Objetivos

Los objetivos se clasifican en tres niveles:

- **Empresa** — objetivos estratégicos corporativos
- **Departamento** — objetivos por área
- **Individual** — objetivos por empleado

Cada objetivo puede tener objetivos padre (cascada OKR). El avance se calcula automáticamente a partir del progreso de los resultados clave.

### Resultados clave (KR)

Dentro de cada objetivo, agregar resultados clave con:

- Valor inicial, valor objetivo y valor actual
- Tipo de métrica (número, porcentaje, moneda, sí/no)
- Peso para el cálculo de progreso del objetivo

Registrar check-ins periódicos actualizando el valor actual de cada KR.

### KPIs

Los KPIs son indicadores independientes de los OKRs. Se definen con una frecuencia de medición (diaria, semanal, mensual, trimestral, anual) y un valor objetivo. Pueden vincularse a un proceso de calidad para medir el desempeño de ese proceso.

Registrar mediciones periódicas desde **Desempeño → KPIs → Mediciones**.

---

## Configuración de la empresa

### Catálogos por empresa

En **Configuración → Catálogos** se gestionan los datos maestros propios de cada empresa:

- **Niveles organizacionales** — jerarquía de cargos (ej. Directivo, Coordinador, Operativo)
- **Cargos** — posiciones de trabajo vinculadas a un nivel organizacional
- **Centros de costo** — unidades de imputación contable
- **Sub-centros de costo** — subdivisiones de un centro de costo
- **Sedes** — lugares físicos de trabajo
- **Centros de trabajo** — unidades ARL con tasa de riesgo

Estos catálogos son usados en los contratos de los empleados y deben configurarse antes de registrar contratos.

---

## Roles de usuario

| Rol | Acceso principal |
|---|---|
| `admin` | Acceso completo a todos los módulos habilitados de la empresa |
| `manager` | Visualización y gestión de su equipo y departamento |
| `employee` | Acceso al portal del empleado (módulo futuro) |
| `recruiter` | Módulo de reclutamiento y onboarding |
| `quality_auditor` | Módulo de calidad: procesos, documentos, auditorías |

Los roles son asignados por el administrador de la plataforma (SUMMA BPO) al crear o editar la membresía del usuario en la empresa.
