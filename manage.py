#!/usr/bin/env python
import os
import sys
from pathlib import Path


def main():
    # Carga .env.local / .env para que runserver/migrate usen el mismo Postgres que Navicat
    try:
        from dotenv import load_dotenv
        root = Path(__file__).resolve().parent
        load_dotenv(root / '.env.local')
        load_dotenv(root / '.env')
    except ImportError:
        pass
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.dev')
    try:
        from django.core.management import execute_from_command_line
    except ImportError as exc:
        raise ImportError(
            "Couldn't import Django. Make sure it's installed and available on your PYTHONPATH."
        ) from exc
    execute_from_command_line(sys.argv)


if __name__ == '__main__':
    main()
