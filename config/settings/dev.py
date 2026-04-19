from .base import *  # noqa

DEBUG = True

ALLOWED_HOSTS = ['*']

SESSION_COOKIE_SECURE = False
SESSION_COOKIE_DOMAIN = None  # localhost doesn't need domain restriction

INSTALLED_APPS += ['debug_toolbar']  # noqa

MIDDLEWARE.insert(1, 'debug_toolbar.middleware.DebugToolbarMiddleware')  # noqa

INTERNAL_IPS = ['127.0.0.1']

# Relax CORS for local dev
CORS_ALLOW_ALL_ORIGINS = True
