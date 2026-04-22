FROM python:3.12-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DJANGO_SETTINGS_MODULE=config.settings.prod

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev gcc gettext \
    && rm -rf /var/lib/apt/lists/*

ARG INSTALL_DEV=false
COPY requirements/ ./requirements/
RUN pip install --no-cache-dir -r requirements/prod.txt \
    && if [ "$INSTALL_DEV" = "true" ]; then pip install --no-cache-dir -r requirements/dev.txt; fi

COPY . .

RUN python manage.py collectstatic --noinput

RUN python manage.py compilemessages

EXPOSE 8000

CMD ["gunicorn", "config.wsgi:application", \
     "--bind", "0.0.0.0:8000", \
     "--workers", "3", \
     "--timeout", "120", \
     "--access-logfile", "-", \
     "--error-logfile", "-"]
