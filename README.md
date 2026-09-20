# Social — Django core rewrite

The Django application now implements registration, login/logout, profile editing
with avatars, people search, global/following feeds, text/image posts, owner-only
post editing/deletion, comment replies and likes, follows, notifications, and
hashtag browsing. It reuses `assets/app.css` with
new Django templates. All mutations use CSRF-protected forms; likes and follows
use explicit, idempotent actions. Feeds, comments and search are paginated.

Notifications include an unread navbar count, individual and bulk mark-as-read
buttons, and links to the relevant post/comment/profile. Self-notifications are
skipped; unliking/unfollowing removes the associated notification. Counts refresh
on page navigation. Replies attach to the top-level comment while notifying the
person actually replied to. Comments display chronologically, with reply context
and permalinks that locate the correct page. Hashtags (2–50 ASCII letters, digits
or underscores) link to case-insensitive topic feeds and reflect post edits
immediately. Topic feeds currently search post text rather than a separate index.

## Run locally (PowerShell)

Requires Python 3.10 or newer. These steps follow Django's
[installation guide](https://docs.djangoproject.com/en/5.2/topics/install/).

```powershell
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe manage.py migrate
.\.venv\Scripts\python.exe manage.py runserver
```

Open http://127.0.0.1:8000/ and register an account. To access Django admin:

```powershell
.\.venv\Scripts\python.exe manage.py createsuperuser
```

## Check the rewrite

```powershell
.\.venv\Scripts\python.exe manage.py check
.\.venv\Scripts\python.exe manage.py test
.\.venv\Scripts\python.exe manage.py makemigrations --check --dry-run
```

Tests cover account creation/login, duplicate accounts, CSRF, ownership, validation,
image processing, comments/replies, likes, follows, filtered feeds, profiles,
pagination, notification privacy, and escaped hashtag links.

## Data and scope

- This is a separate runnable application using a new local SQLite database.
  Existing PHP files and `aleksgevorgyan.sql` are preserved. Existing PHP accounts,
  password hashes, content, and media have **not** been imported. Create a new
  account to use the Django application. Do not run Django migrations against the
  legacy MySQL database; a separate, validated import is required first.
- Images and avatars are stored in `media/`, limited to 5 MB and 20 megapixels,
  resized to a maximum of 2400 pixels per side and re-encoded as JPEG. Animated
  images become a still image. Media is served through authenticated Django views.
- Chat, stories, video uploads, and AI generation remain in PHP and are not
  linked from the Django interface.
- There is no password-reset/email delivery or login rate limiting in this slice.
- Replaced/deleted images are retained in storage for now; orphan cleanup is a
  follow-up, as is migrating existing media.

## Deployment configuration

Local development defaults to `DJANGO_DEBUG=1` and generates an ignored local
`.django-dev-key` file. For deployment, set `DJANGO_DEBUG=0`, a strong
`DJANGO_SECRET_KEY`, and comma-separated `DJANGO_ALLOWED_HOSTS`. HTTPS is required
for session and CSRF cookies in that mode. Use a production WSGI server and serve
collected static assets (`manage.py collectstatic`) separately. Keep uploads behind
the authenticated image endpoint. Run `manage.py check --deploy` and configure
HTTPS/proxy settings, backups, login rate limiting, and an appropriate database
before exposing the application publicly. `runserver` is for local development.
