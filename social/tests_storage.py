from unittest.mock import patch

from django.core.files.base import ContentFile
from django.test import SimpleTestCase, override_settings

from .serializers import media_field_url
from .storage import SupabasePublicMediaStorage


@override_settings(SUPABASE_STORAGE_PUBLIC_URL="https://project-ref.supabase.co")
class SupabaseStorageTests(SimpleTestCase):
    def make_storage(self):
        return SupabasePublicMediaStorage(
            bucket_name="social-media",
            region_name="eu-west-1",
            endpoint_url="https://project-ref.storage.supabase.co/storage/v1/s3",
            access_key="test-access-key",
            secret_key="test-secret-key",
            addressing_style="path",
            signature_version="s3v4",
            querystring_auth=False,
            file_overwrite=False,
        )

    def test_urls_use_public_supabase_object_route_and_encode_key(self):
        storage = self.make_storage()
        self.assertEqual(
            storage.url("posts/images/space name.jpg"),
            "https://project-ref.supabase.co/storage/v1/object/public/social-media/posts/images/space%20name.jpg",
        )

    def test_upload_uses_storage_without_network_or_overwriting(self):
        storage = self.make_storage()
        with patch.object(storage, "exists", return_value=False), patch.object(
            storage, "_save", return_value="avatars/new.jpg"
        ) as save:
            saved_name = storage.save("avatars/new.jpg", ContentFile(b"image-bytes"))
        self.assertEqual(saved_name, "avatars/new.jpg")
        save.assert_called_once()

    def test_external_media_url_is_not_prefixed_with_backend_origin(self):
        from django.test import RequestFactory

        url = "https://project-ref.supabase.co/storage/v1/object/public/social-media/avatars/photo.jpg"
        request = RequestFactory().get("/api/users/alice/", HTTP_HOST="nexusbackend-5mqs.onrender.com")
        self.assertEqual(media_field_url(type("Field", (), {"url": url})(), request), url)
