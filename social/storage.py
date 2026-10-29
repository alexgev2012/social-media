import json
import mimetypes
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen

from django.conf import settings
from django.core.exceptions import ImproperlyConfigured
from django.core.files.base import ContentFile
from django.core.files.storage import Storage


class SupabaseStorageError(OSError):
    """A safe, non-secret-bearing Supabase Storage request failure."""

    def __init__(self, message, *, status_code=None):
        self.status_code = status_code
        super().__init__(message)


class SupabasePublicMediaStorage(Storage):
    """Store public social media through Supabase's authenticated Storage API."""

    def __init__(self):
        self.project_url = (settings.SUPABASE_URL or "").strip().rstrip("/")
        self.server_key = (settings.SUPABASE_STORAGE_SERVER_KEY or "").strip()
        self.bucket_name = (settings.SUPABASE_STORAGE_BUCKET or "nexus-media").strip() or "nexus-media"

    @property
    def configured(self):
        return bool(settings.MEDIA_STORAGE_CONFIGURED and self.project_url and self.server_key and self.bucket_name)

    def _ensure_configured(self):
        if not self.configured:
            raise ImproperlyConfigured(
                "Configure SUPABASE_URL, SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY), and SUPABASE_STORAGE_BUCKET for production media."
            )

    @staticmethod
    def _encoded_path(name):
        return quote(str(name).replace("\\", "/").lstrip("/"), safe="/")

    def _object_url(self, name, *, info=False, authenticated=False):
        self._ensure_configured()
        route = "object/info" if info else "object/authenticated" if authenticated else "object"
        return (
            f"{self.project_url}/storage/v1/{route}/"
            f"{quote(self.bucket_name, safe='')}/{self._encoded_path(name)}"
        )

    def _request(self, method, url, *, data=None, headers=None, allow_missing=False):
        self._ensure_configured()
        request_headers = {"apikey": self.server_key}
        # Legacy service_role keys are JWTs and are used as the Storage
        # Authorization token. New sb_secret_* keys are API keys, not JWTs;
        # Supabase requires them on apikey only.
        if not self.server_key.startswith("sb_secret_"):
            request_headers["Authorization"] = f"Bearer {self.server_key}"
        request_headers.update(headers or {})
        request = Request(url, data=data, headers=request_headers, method=method)
        try:
            with urlopen(request, timeout=60) as response:
                return response.read()
        except HTTPError as exc:
            if allow_missing and exc.code == 404:
                return None
            # Do not include response bodies or credentials; they can contain
            # server details that should not appear in user-visible errors.
            raise SupabaseStorageError(
                f"Supabase Storage returned HTTP {exc.code}.",
                status_code=exc.code,
            ) from None
        except (URLError, TimeoutError, OSError):
            raise SupabaseStorageError("Could not reach Supabase Storage.") from None

    def _open(self, name, mode="rb"):
        if mode not in {"rb", "r"}:
            raise ValueError("Supabase media files can only be opened for reading.")
        content = self._request("GET", self._object_url(name, authenticated=True))
        return ContentFile(content, name=name)

    def _save(self, name, content):
        content_type = getattr(content, "content_type", None) or mimetypes.guess_type(name)[0] or "application/octet-stream"
        payload = b"".join(content.chunks())
        self._request(
            "POST",
            self._object_url(name),
            data=payload,
            headers={
                "Content-Type": content_type,
                "Cache-Control": "max-age=31536000, immutable",
                "x-upsert": "false",
            },
        )
        return name

    def delete(self, name):
        if not name:
            return
        url = f"{self.project_url}/storage/v1/object/{quote(self.bucket_name, safe='')}"
        self._request(
            "DELETE",
            url,
            data=json.dumps({"prefixes": [str(name).replace("\\", "/").lstrip("/")]}).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            allow_missing=True,
        )

    def exists(self, name):
        response = self._request("HEAD", self._object_url(name, info=True), allow_missing=True)
        return response is not None

    def url(self, name):
        self._ensure_configured()
        return (
            f"{self.project_url}/storage/v1/object/public/"
            f"{quote(self.bucket_name, safe='')}/{self._encoded_path(name)}"
        )
