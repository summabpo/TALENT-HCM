# Guía de despliegue — Talent HCM

## Infraestructura de producción

| Componente | Servicio |
|---|---|
| Backend | Docker en EC2 Ubuntu 24.04 |
| Base de datos | AWS RDS PostgreSQL 16 |
| Caché y colas | Redis 7 (instancia compartida con Nomiweb) |
| Archivos estáticos | Volumen en EC2 servido por Nginx |
| SSL / Routing | Nginx Proxy Manager |
| Frontend | Build estático en Nginx (mismo EC2) |

---

## 1. Prerequisitos en el servidor EC2

```bash
# Actualizar el sistema
sudo apt update && sudo apt upgrade -y

# Instalar Docker
sudo apt install -y ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Añadir el usuario al grupo docker
sudo usermod -aG docker $USER
newgrp docker
```

---

## 2. Variables de entorno de producción

Crear `/opt/talent/.env.prod`:

```bash
DJANGO_SETTINGS_MODULE=config.settings.prod
DJANGO_SECRET_KEY=<clave-larga-y-aleatoria>
DJANGO_ALLOWED_HOSTS=talent.nomiweb.co,<ip-publica-del-ec2>

TALENT_DB_NAME=db_talent
TALENT_DB_USER=talent_user
TALENT_DB_PASSWORD=<password-rds>
TALENT_DB_HOST=<endpoint-rds>.rds.amazonaws.com
TALENT_DB_PORT=5432

REDIS_URL=redis://<host-redis>:6379/1
CELERY_BROKER_URL=redis://<host-redis>:6379/2

CORS_ALLOWED_ORIGINS=https://talent.nomiweb.co

MEDIA_ROOT=/app/media
```

---

## 3. docker-compose de producción

Crear `/opt/talent/docker-compose.yml`:

```yaml
services:
  backend:
    image: talent-hcm:latest
    env_file: .env.prod
    volumes:
      - talent-media:/app/media
      - talent-static:/app/staticfiles
    ports:
      - "8000:8000"
    restart: unless-stopped

  celery:
    image: talent-hcm:latest
    command: celery -A config.celery worker -l info
    env_file: .env.prod
    volumes:
      - talent-media:/app/media
    depends_on:
      - backend
    restart: unless-stopped

  celery-beat:
    image: talent-hcm:latest
    command: celery -A config.celery beat -l info --scheduler django_celery_beat.schedulers:DatabaseScheduler
    env_file: .env.prod
    depends_on:
      - backend
    restart: unless-stopped

volumes:
  talent-media:
  talent-static:
```

---

## 4. Build y despliegue

```bash
# En el servidor, clonar o actualizar el código
cd /opt/talent
git pull origin main

# Build de la imagen Docker del backend
docker build -t talent-hcm:latest .

# Build del frontend (se puede hacer en CI/CD o en el servidor)
cd frontend
npm ci
npm run build
# Copiar dist/ al volumen de Nginx o a /var/www/talent/

# Ejecutar migraciones
docker run --rm --env-file .env.prod talent-hcm:latest python manage.py migrate

# Recolectar estáticos (ya se ejecuta en el Dockerfile, pero por si acaso)
# docker run --rm --env-file .env.prod talent-hcm:latest python manage.py collectstatic --noinput

# Levantar los servicios
docker compose up -d
```

---

## 5. Nginx Proxy Manager

Configurar en la UI de Nginx Proxy Manager:

**Proxy Host 1 — Backend**
- Domain: `talent.nomiweb.co`
- Forward to: `http://localhost:8000`
- Location `/api/` → proxy al backend
- Location `/admin/` → proxy al backend
- Location `/static/` → archivos estáticos de Django
- Location `/media/` → archivos de media

**Proxy Host 2 — Frontend**
- Location `/` → directorio `/var/www/talent/dist/` (build de React)
- Habilitar SSL con Let's Encrypt en el mismo host

**Nota:** el frontend es una SPA; configurar Nginx para devolver `index.html` en todas las rutas no-API:

```nginx
location / {
    root /var/www/talent/dist;
    try_files $uri $uri/ /index.html;
}
```

---

## 6. Base de datos — AWS RDS PostgreSQL 16

### Crear la instancia RDS

```bash
# Con AWS CLI
aws rds create-db-instance \
  --db-instance-identifier talent-db \
  --db-instance-class db.t3.small \
  --engine postgres \
  --engine-version 16.3 \
  --master-username talent_user \
  --master-user-password <password> \
  --allocated-storage 20 \
  --db-name db_talent \
  --vpc-security-group-ids <sg-id> \
  --backup-retention-period 7 \
  --no-publicly-accessible
```

Asegurarse de que el security group del RDS permite conexiones en el puerto 5432 desde el security group del EC2.

### Migraciones iniciales

```bash
docker run --rm --env-file /opt/talent/.env.prod talent-hcm:latest \
  python manage.py migrate

# Crear superusuario de plataforma
docker run --rm -it --env-file /opt/talent/.env.prod talent-hcm:latest \
  python manage.py createsuperuser
```

---

## 7. Actualización de la aplicación

```bash
cd /opt/talent

# 1. Obtener el nuevo código
git pull origin main

# 2. Reconstruir la imagen
docker build -t talent-hcm:latest .

# 3. Ejecutar migraciones nuevas
docker run --rm --env-file .env.prod talent-hcm:latest python manage.py migrate

# 4. Reemplazar los contenedores
docker compose up -d --no-deps backend celery celery-beat

# 5. Actualizar el frontend si cambió
cd frontend && npm ci && npm run build
# Copiar dist/ a /var/www/talent/
```

---

## 8. Logs y monitoreo

```bash
# Ver logs del backend en tiempo real
docker compose logs -f backend

# Ver logs de Celery
docker compose logs -f celery

# Estado de los contenedores
docker compose ps
```

---

## 9. Backups de base de datos

```bash
# Backup manual
pg_dump -h <endpoint-rds> -U talent_user -d db_talent -F c -f backup_$(date +%Y%m%d).dump

# RDS tiene snapshots automáticos configurados con retention de 7 días
```

---

## 10. Consideraciones de seguridad

- El `SECRET_KEY` debe ser un string aleatorio de al menos 50 caracteres; jamás el valor por defecto.
- `DJANGO_ALLOWED_HOSTS` debe incluir únicamente el dominio y la IP del servidor.
- El RDS no debe tener acceso público (`--no-publicly-accessible`).
- Los archivos `.env.prod` no deben estar en el repositorio de Git.
- Habilitar MFA en la cuenta AWS.
- Rotación periódica de credenciales de base de datos.
