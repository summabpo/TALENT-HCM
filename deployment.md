# Talent HCM — Deployment & Infrastructure

Docker, docker-compose, Nginx Proxy Manager, RDS, env vars, and dev commands.
Referenced by CLAUDE.md.

---

## 11. Deployment (Docker on AWS)

Talent runs as Docker containers on the same AWS EC2 instance as Nomiweb, behind the existing Nginx.

### Docker Architecture

```
AWS EC2 (Ubuntu + Nginx already running)
│
├── Nginx (host) ─── talent.nomiweb.co
│   │                    ├── /        → talent-frontend:80
│   │                    ├── /api/    → talent-backend:8000
│   │                    ├── /media/  → volume mount
│   │                    └── /static/ → volume mount
│   │
│   └── nomiweb.co       (existing Nomiweb config)
│
├── Docker containers
│   ├── talent-backend    (Django + Gunicorn)
│   ├── talent-frontend   (React built, served by Nginx)
│   ├── talent-celery     (Celery worker)
│   └── talent-redis      (Redis 7) *or shared with Nomiweb
│
├── AWS RDS (PostgreSQL 16)
│   └── db_talent          (managed by AWS, not Docker)
│
└── Volumes
    ├── talent-media
    └── talent-static
```

### Dockerfile — Backend

```dockerfile
# Dockerfile
FROM python:3.12-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# System dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev gcc gettext \
    && rm -rf /var/lib/apt/lists/*

# Python dependencies
COPY requirements/base.txt requirements/prod.txt ./requirements/
RUN pip install --no-cache-dir -r requirements/prod.txt

# Application code
COPY . .

# Collect static files
RUN python manage.py collectstatic --noinput

# Compile translations
RUN python manage.py compilemessages

EXPOSE 8000

CMD ["gunicorn", "config.wsgi:application", \
     "--bind", "0.0.0.0:8000", \
     "--workers", "3", \
     "--timeout", "120", \
     "--access-logfile", "-", \
     "--error-logfile", "-"]
```

### Dockerfile — Frontend

```dockerfile
# frontend/Dockerfile
# Stage 1: Build
FROM node:20-alpine AS build

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .

ARG VITE_API_URL=https://talent.nomiweb.co/api
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

# Stage 2: Serve
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

```nginx
# frontend/nginx.conf (inside container, serves SPA)
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

### docker-compose.yml

```yaml
version: "3.9"

services:
  backend:
    build: .
    container_name: talent-backend
    restart: always
    env_file: .env
    volumes:
      - talent-media:/app/media
      - talent-static:/app/staticfiles
    depends_on:
      redis:
        condition: service_started
    networks:
      - talent-network
    ports:
      - "127.0.0.1:8001:8000"

  frontend:
    build: ./frontend
    container_name: talent-frontend
    restart: always
    networks:
      - talent-network
    ports:
      - "127.0.0.1:8002:80"

  celery:
    build: .
    container_name: talent-celery
    restart: always
    env_file: .env
    command: celery -A config worker -l info --concurrency=2
    depends_on:
      - backend
      - redis
    networks:
      - talent-network

  celery-beat:
    build: .
    container_name: talent-celery-beat
    restart: always
    env_file: .env
    command: celery -A config beat -l info --scheduler django_celery_beat.schedulers:DatabaseScheduler
    depends_on:
      - backend
      - redis
    networks:
      - talent-network

  redis:
    image: redis:7-alpine
    container_name: talent-redis
    restart: always
    command: redis-server --appendonly yes
    volumes:
      - talent-redis-data:/data
    networks:
      - talent-network

volumes:
  talent-media:
  talent-static:
  talent-redis-data:

networks:
  talent-network:
    driver: bridge
```

> **Database:** PostgreSQL lives in AWS RDS, not Docker. The backend connects via `TALENT_DB_HOST` in `.env` pointing to your RDS endpoint (e.g., `talent-db.xxxx.us-east-1.rds.amazonaws.com`). Make sure the EC2 security group allows outbound traffic to the RDS security group on port 5432.

> **Note on Redis:** If Nomiweb already has a Redis instance on the host and you want to share sessions, you have two options:
> 1. **Use the host Redis:** Remove the `redis` service from docker-compose. In `.env` set `REDIS_URL=redis://host.docker.internal:6379/1` (or `172.17.0.1` on Linux). Both apps share the same Redis.
> 2. **Use Talent's Redis:** Keep the redis container but expose port `6379` on the host (`127.0.0.1:6379:6379`). Configure Nomiweb to connect to the same Redis. This is cleaner if Nomiweb doesn't have Redis yet.

### Nginx Proxy Manager (existing on server)

Since the server already runs Nginx Proxy Manager, no manual Nginx configs are needed. Create two Proxy Hosts in the NPM admin panel:

**Proxy Host 1 — React SPA (frontend)**

```
Domain:          talent.nomiweb.co
Scheme:          http
Forward IP:      127.0.0.1
Forward Port:    8002
SSL:             Request new Let's Encrypt certificate
                 ✅ Force SSL
                 ✅ HTTP/2 Support
Custom locations:
  (none needed — default catches everything not matched by Host 2)
```

**Proxy Host 2 — Django API (backend)**

Since NPM doesn't natively support path-based routing to different backends within a single host, use the **Advanced** tab with a custom Nginx config:

```
Domain:          talent.nomiweb.co
Scheme:          http
Forward IP:      127.0.0.1
Forward Port:    8002
SSL:             Use existing certificate from Host 1

Advanced tab → Custom Nginx Configuration:
```

```nginx
# API and admin go to Django backend container
location /api/ {
    proxy_pass http://127.0.0.1:8001;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    client_max_body_size 20M;
}

location /admin/ {
    proxy_pass http://127.0.0.1:8001;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}

# Static and media from Docker volumes
location /static/ {
    alias /var/lib/docker/volumes/talent_talent-static/_data/;
}

location /media/ {
    alias /var/lib/docker/volumes/talent_talent-media/_data/;
    client_max_body_size 20M;
}
```

> **Alternative (simpler):** Use a single Proxy Host pointing to the frontend (port 8002). In the frontend container's Nginx config, add reverse proxy rules for `/api/` and `/admin/` to the backend container. This keeps all routing inside Docker and NPM only handles SSL + domain → port mapping.

```nginx
# frontend/nginx.conf (inside frontend container — single entry point approach)
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;

    # SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Proxy API to backend container
    location /api/ {
        proxy_pass http://talent-backend:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        client_max_body_size 20M;
    }

    # Proxy admin to backend container
    location /admin/ {
        proxy_pass http://talent-backend:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Static files
    location /static/ {
        alias /app/staticfiles/;
    }

    # Media files
    location /media/ {
        alias /app/media/;
    }
}
```

With this approach, update docker-compose.yml to mount static and media volumes into the frontend container too:

```yaml
  frontend:
    build: ./frontend
    container_name: talent-frontend
    restart: always
    volumes:
      - talent-static:/app/staticfiles:ro    # read-only mount
      - talent-media:/app/media:ro           # read-only mount
    networks:
      - talent-network
    ports:
      - "127.0.0.1:8002:80"
```

And NPM only needs one simple Proxy Host: `talent.nomiweb.co` → `127.0.0.1:8002` with SSL.

### Deployment Commands

```bash
# First deployment
cd /opt/talent
git clone <repo> .
cp .env.example .env  # edit with production values
docker compose build
docker compose up -d
docker compose exec backend python manage.py migrate
docker compose exec backend python manage.py createsuperuser

# Updates
git pull
docker compose build
docker compose up -d
docker compose exec backend python manage.py migrate

# Logs
docker compose logs -f backend
docker compose logs -f celery

# Database backup (from RDS — run from EC2 or any machine with access)
PGPASSWORD=$TALENT_DB_PASSWORD pg_dump -h $TALENT_DB_HOST -U $TALENT_DB_USER $TALENT_DB_NAME > backup_$(date +%Y%m%d).sql

# Database restore
PGPASSWORD=$TALENT_DB_PASSWORD psql -h $TALENT_DB_HOST -U $TALENT_DB_USER $TALENT_DB_NAME < backup.sql

# Shell access
docker compose exec backend python manage.py shell

# DB shell (connect to RDS from EC2)
PGPASSWORD=$TALENT_DB_PASSWORD psql -h $TALENT_DB_HOST -U $TALENT_DB_USER $TALENT_DB_NAME
```

### docker-compose.dev.yml (for local development)

For local development, a Postgres container is useful since you don't want to hit RDS from your laptop:

```yaml
version: "3.9"

services:
  backend:
    build: .
    container_name: talent-backend-dev
    env_file: .env.dev
    volumes:
      - .:/app                    # hot reload
      - talent-media:/app/media
    command: python manage.py runserver 0.0.0.0:8000
    ports:
      - "8001:8000"
    depends_on:
      postgres-dev:
        condition: service_healthy
      redis:
        condition: service_started
    networks:
      - talent-network

  postgres-dev:
    image: postgres:16-alpine
    container_name: talent-postgres-dev
    environment:
      POSTGRES_DB: db_talent
      POSTGRES_USER: talent_user
      POSTGRES_PASSWORD: talent_dev_pass
    ports:
      - "5433:5432"               # different port to avoid conflict
    volumes:
      - talent-db-data-dev:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U talent_user"]
      interval: 5s
      timeout: 5s
      retries: 5
    networks:
      - talent-network

  redis:
    image: redis:7-alpine
    container_name: talent-redis-dev
    ports:
      - "6380:6379"               # different port to avoid conflict
    networks:
      - talent-network

volumes:
  talent-db-data-dev:
  talent-media:

networks:
  talent-network:
    driver: bridge
```

```env
# .env.dev — points to local Docker postgres, not RDS
TALENT_DB_HOST=postgres-dev
TALENT_DB_PORT=5432
TALENT_DB_NAME=db_talent
TALENT_DB_USER=talent_user
TALENT_DB_PASSWORD=talent_dev_pass
REDIS_URL=redis://redis:6379/1
DJANGO_DEBUG=True
DJANGO_SETTINGS_MODULE=config.settings.dev
```

```bash
# Local development
docker compose -f docker-compose.dev.yml up -d

# Frontend runs on host for hot reload
cd frontend
npm install
npm run dev  # Vite dev server on :5173
```

---


---

## 12. Environment Variables

```env
# .env (production)

# Database (AWS RDS)
TALENT_DB_NAME=db_talent
TALENT_DB_USER=talent_user
TALENT_DB_PASSWORD=<secure>
TALENT_DB_HOST=talent-db.xxxxxxxxxxxx.us-east-1.rds.amazonaws.com  # RDS endpoint
TALENT_DB_PORT=5432

# Redis
REDIS_URL=redis://redis:6379/1  # Docker service name
# If sharing with Nomiweb on host: redis://host.docker.internal:6379/1

# Django
DJANGO_SECRET_KEY=<secure, must match Nomiweb for session compatibility>
DJANGO_DEBUG=False
DJANGO_ALLOWED_HOSTS=talent.nomiweb.co
DJANGO_SETTINGS_MODULE=config.settings.prod

# Session (must match Nomiweb exactly)
SESSION_COOKIE_DOMAIN=.nomiweb.co
SESSION_COOKIE_NAME=nomiweb_session

# CORS (for React SPA)
CORS_ALLOWED_ORIGINS=https://talent.nomiweb.co

# Celery
CELERY_BROKER_URL=redis://redis:6379/2

# File storage
MEDIA_ROOT=/app/media/

# Sentry (optional, recommended)
SENTRY_DSN=<your-sentry-dsn>
```

---


---

## 13. Development Commands

```bash
# --- Docker-based (recommended) ---

# Start dev environment
docker compose -f docker-compose.dev.yml up -d

# Run frontend dev server (on host, with hot reload)
cd frontend && npm run dev

# Run migrations
docker compose exec backend python manage.py migrate

# Create superuser
docker compose exec backend python manage.py createsuperuser

# Run tests
docker compose exec backend pytest

# Generate API docs
docker compose exec backend python manage.py spectacular --file schema.yml

# Create translations
docker compose exec backend python manage.py makemessages -l es
docker compose exec backend python manage.py compilemessages

# Create new module
docker compose exec backend python manage.py startapp new_module apps/new_module

# View logs
docker compose logs -f backend

# --- Production ---

# Deploy update
git pull && docker compose build && docker compose up -d
docker compose exec backend python manage.py migrate

# Backup
docker compose exec postgres pg_dump -U talent_user db_talent > backup_$(date +%Y%m%d).sql
```

---


---

