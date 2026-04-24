from .dev import *  # noqa

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': ':memory:',
    }
}

# Disable Redis for tests; DummyCache also prevents throttle counts from
# accumulating across test cases (throttle uses the default cache).
CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.dummy.DummyCache',
    }
}

SESSION_ENGINE = 'django.contrib.sessions.backends.db'

PASSWORD_HASHERS = ['django.contrib.auth.hashers.MD5PasswordHasher']
