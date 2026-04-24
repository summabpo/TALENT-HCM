from .base import *  # noqa

DEBUG = True

ALLOWED_HOSTS = ['*']

SESSION_COOKIE_SECURE = False

INSTALLED_APPS += ['debug_toolbar']  # noqa

MIDDLEWARE.insert(1, 'debug_toolbar.middleware.DebugToolbarMiddleware')  # noqa

INTERNAL_IPS = ['127.0.0.1']

# Relax CORS for local dev — CORS_ALLOW_ALL_ORIGINS overrides CORS_ALLOWED_ORIGINS
CORS_ALLOW_ALL_ORIGINS = True
CORS_ALLOWED_ORIGINS = [
    'http://localhost:5173',
    'http://localhost:3000',
    'http://127.0.0.1:5173',
]

# Relax throttling in dev/test — Redis persists between pytest runs so the
# 5/minute prod limit would block repeated test logins from the same IP.
REST_FRAMEWORK['DEFAULT_THROTTLE_RATES']['login'] = '10000/minute'  # noqa: F821
