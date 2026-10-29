# Nexus — Full-Stack Social Media Platform

A modern social media web platform engineered with **Python Django** on the backend and **TypeScript React (Vite)** on the frontend, featuring an ultra-modern dark/light theme, real-time messaging, interactive 24-hour stories, nested comment threads, and an AI Creative Studio.

---

## 🚀 Key Features

### 🎨 Upgraded Modern UI/UX
- **Design System**: Deep slate dark theme by default (`#0b0f17`) with seamless light theme toggle, glassmorphic headers, vibrant accent gradients, and custom scrollbars.
- **Continuous Feed Stream**: Clean two-column stream layout with hairline separators (inspired by modern platforms like Threads, Bluesky, and Twitter/X) without disjointed borders or floating boxes.
- **Interactive Story Viewer**: Fullscreen/modal story reel with auto-advancing 5-second progress bars, tap-to-skip, story likes, and owner deletion.
- **Real-Time Direct Messenger**: Split-pane messaging interface with conversation search, auto-scroll, read receipts, unread badge counters, and jumbo emoji rendering for reactions.
- **AI Social Studio**: Built-in assistant to generate catchy captions, tech thoughts, motivational quotes, and matching hashtags directly into the post composer.

### ⚙️ Python Django REST Architecture
- **RESTful API**: Comprehensive Django REST Framework endpoints covering authentication, posts, comments with nested replies, likes, follows, 24-hour stories, direct messaging, notifications, trending hashtags, and AI generation.
- **Authentication**: Session and cookie-based authentication with CSRF protection and secure session management.
- **Media Pipeline**: Pillow image processing pipeline with upload resizing, EXIF normalization, and JPEG re-encoding.
- **Dual-Mode Serving**: Django directly serves the compiled React application at `/app/` (with static assets served automatically in debug mode), while also supporting Vite HMR during development at `http://localhost:5173/`.

---

## 🛠️ Tech Stack

- **Backend**: Python 3.10+, Django 5/6, Django REST Framework, Django CORS Headers, Pillow, SQLite (or PostgreSQL/MySQL in production).
- **Frontend**: React 19, TypeScript, Vite, Lucide React (vector icons), Modern CSS variables.

---

## 💻 Local Development Guide

### 1. Backend Setup (Django)

In the project root directory:

```powershell
# Install Python dependencies
python -m pip install -r requirements.txt

# Run database migrations
python manage.py migrate

# Create your admin superuser (optional)
python manage.py createsuperuser

# Start the Django development server
python manage.py runserver
```

Django will run at `http://127.0.0.1:8000/`.

---

### 2. Frontend Setup (TypeScript React)

In a second terminal, navigate to the `frontend/` directory:

```powershell
cd frontend

# Install dependencies
npm install

# Start Vite dev server with instant Hot Module Reloading (HMR)
npm run dev
```

- **Vite Dev Server**: `http://localhost:5173/` (automatically proxies API requests to Django at `127.0.0.1:8000`).
- **Django Production/Integrated Mode**: `http://127.0.0.1:8000/app/` (serves the built React app directly through Django).

---

## 🚢 Deployment Guide

### 1. Build the React Frontend

Run the production build script inside `frontend/`:

```powershell
cd frontend
npm run build
```

This compiles optimized assets into `frontend/dist/`, which Django serves directly at `/app/`.

### 2. Configure Environment Variables

Set the following environment variables on your production server:

| Variable | Description | Example |
| :--- | :--- | :--- |
| `DJANGO_DEBUG` | Set to `0` for production | `0` |
| `DJANGO_SECRET_KEY` | Strong random secret key | `super-secret-production-key` |
| `DJANGO_ALLOWED_HOSTS` | Comma-separated domains | `yourdomain.com,www.yourdomain.com` |

### 3. Production Static & Media Collection

```powershell
python manage.py collectstatic --noinput
```

Run Django using a production WSGI/ASGI server such as Gunicorn or Uvicorn behind Nginx or Caddy with HTTPS enabled.

---

## 📡 REST API Reference

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/api/auth/register/` | `POST` | Register a new user |
| `/api/auth/login/` | `POST` | Authenticate user & start session |
| `/api/auth/logout/` | `POST` | End session |
| `/api/auth/me/` | `GET` | Get current authenticated user profile |
| `/api/auth/profile/` | `PATCH` | Update profile information and avatar |
| `/api/posts/` | `GET`, `POST` | List feed posts or create a new post |
| `/api/posts/<id>/` | `GET`, `PATCH`, `DELETE` | Post details, update content, or delete |
| `/api/posts/<id>/like/` | `POST` | Toggle post like |
| `/api/posts/<id>/comments/` | `GET`, `POST` | List comments or add comment / reply |
| `/api/comments/<id>/like/` | `POST` | Toggle comment like |
| `/api/comments/<id>/delete/` | `DELETE` | Delete comment |
| `/api/stories/` | `GET`, `POST` | Active 24-hour stories grouped by user or upload story |
| `/api/stories/<id>/like/` | `POST` | Toggle story like |
| `/api/stories/<id>/delete/` | `DELETE` | Delete story |
| `/api/conversations/` | `GET` | List active chat conversations |
| `/api/conversations/<username>/` | `GET` | Message thread with a user |
| `/api/conversations/<username>/messages/` | `POST` | Send message to user |
| `/api/messages/unread-count/` | `GET` | Total unread message badge count |
| `/api/users/<username>/` | `GET` | Public profile stats, bio, and posts |
| `/api/users/<username>/follow/` | `POST` | Toggle follow / unfollow |
| `/api/users/search/?q=` | `GET` | Search users by name or handle |
| `/api/notifications/` | `GET` | List user notifications |
| `/api/notifications/read/` | `POST` | Mark notification(s) as read |
| `/api/hashtags/trending/` | `GET` | Top trending hashtags |
| `/api/ai/generate/` | `POST` | AI generator for captions and hashtags |

---

## 🧪 Testing

Run the full automated test suite (including both view tests and API endpoint tests):

```powershell
python manage.py check
python manage.py test
```

Type-check and build the React frontend:

```powershell
cd frontend
npm run build
```
