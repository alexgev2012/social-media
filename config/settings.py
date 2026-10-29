import os
import secrets
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
DEBUG = os.environ.get("DJANGO_DEBUG", "1") == "1"
SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY")
if not SECRET_KEY:
    if not DEBUG:
        raise RuntimeError("Set DJANGO_SECRET_KEY when DJANGO_DEBUG=0.")
    key_file = BASE_DIR / ".django-dev-key"
    try:
        with key_file.open("x") as handle:
            handle.write(secrets.token_urlsafe(64))
    except FileExistsError:
        pass
    SECRET_KEY = key_file.read_text().strip()

def parse_allowed_hosts(configured_hosts, render_external_hostname=""):
    if configured_hosts is None:
        configured_hosts = "localhost,127.0.0.1,[::1]"
    hosts = [host.strip() for host in configured_hosts.split(",") if host.strip()]
    render_hostname = render_external_hostname.strip()
    if render_hostname and render_hostname not in hosts:
        hosts.append(render_hostname)
    return hosts


ALLOWED_HOSTS = parse_allowed_hosts(
    os.environ.get("DJANGO_ALLOWED_HOSTS"),
    os.environ.get("RENDER_EXTERNAL_HOSTNAME", ""),
)

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "corsheaders",
    "rest_framework",
    "social",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [{
    "BACKEND": "django.template.backends.django.DjangoTemplates",
    "DIRS": [],
    "APP_DIRS": True,
    "OPTIONS": {"context_processors": [
        "django.template.context_processors.request",
        "django.contrib.auth.context_processors.auth",
        "django.contrib.messages.context_processors.messages",
        "social.context_processors.notifications",
    ]},
}]

WSGI_APPLICATION = "config.wsgi.application"

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "host_diagnostic": {
            "format": "{levelname} {name}: {message}",
            "style": "{",
        },
    },
    "handlers": {
        "host_diagnostic_console": {
            "class": "logging.StreamHandler",
            "formatter": "host_diagnostic",
        },
    },
    "loggers": {
        "django.security.DisallowedHost": {
            "handlers": ["host_diagnostic_console"],
            "level": "WARNING",
            "propagate": False,
        },
    },
}

if os.environ.get("DATABASE_URL"):
    import dj_database_url

    database_config = dj_database_url.config(
        conn_max_age=600,
        conn_health_checks=True,
    )
    database_config.setdefault("OPTIONS", {})["sslmode"] = "require"
    DATABASES = {"default": database_config}
else:
    DATABASES = {"default": {"ENGINE": "django.db.backends.sqlite3", "NAME": BASE_DIR / "db.sqlite3"}}

AUTH_USER_MODEL = "social.User"

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

STATIC_URL = "/static/"
STATICFILES_DIRS = [BASE_DIR / "assets"]
STATIC_ROOT = BASE_DIR / "staticfiles"

MEDIA_ROOT = BASE_DIR / "media"
MEDIA_URL = "/media/"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

LOGIN_URL = "login"
LOGIN_REDIRECT_URL = "feed"
LOGOUT_REDIRECT_URL = "login"

SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SECURE = not DEBUG
CSRF_COOKIE_SECURE = not DEBUG
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = "DENY"

FRONTEND_ORIGIN = os.environ.get("FRONTEND_ORIGIN", "").strip().rstrip("/")
LOCAL_FRONTEND_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]
LOCAL_CSRF_TRUSTED_ORIGINS = LOCAL_FRONTEND_ORIGINS + [
    "http://localhost:8000",
    "http://127.0.0.1:8000",
]
CORS_ALLOW_ALL_ORIGINS = False
CORS_ALLOWED_ORIGINS = LOCAL_FRONTEND_ORIGINS + ([FRONTEND_ORIGIN] if FRONTEND_ORIGIN else [])
CORS_ALLOW_CREDENTIALS = True
CSRF_TRUSTED_ORIGINS = LOCAL_CSRF_TRUSTED_ORIGINS + ([FRONTEND_ORIGIN] if FRONTEND_ORIGIN else [])

# The frontend and API use separate Render origins. Cross-site cookies require
# SameSite=None; Secure is enabled for production below.
SESSION_COOKIE_SAMESITE = "None" if not DEBUG else "Lax"
CSRF_COOKIE_SAMESITE = "None" if not DEBUG else "Lax"

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "social.api_auth.CsrfExemptSessionAuthentication",
        "rest_framework.authentication.SessionAuthentication",
    ],
}
