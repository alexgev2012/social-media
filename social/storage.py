from urllib.parse import quote

from django.conf import settings
from storages.backends.s3 import S3Storage


class SupabasePublicMediaStorage(S3Storage):
    """Store public social media in Supabase and return browser-ready URLs."""

    def url(self, name, parameters=None, expire=None, http_method=None):
        if not settings.SUPABASE_STORAGE_PUBLIC_URL:
            raise ValueError("SUPABASE_STORAGE_PUBLIC_URL is not configured.")
        object_name = str(name).replace("\\", "/")
        bucket = quote(self.bucket_name, safe="")
        key = quote(object_name.lstrip("/"), safe="/")
        return (
            f"{settings.SUPABASE_STORAGE_PUBLIC_URL}/storage/v1/object/public/"
            f"{bucket}/{key}"
        )
