from urllib.error import HTTPError
from unittest.mock import patch

from django.core.exceptions import ImproperlyConfigured
from django.core.files.base import ContentFile
from django.test import SimpleTestCase, override_settings
from config.settings import (
    default_media_storage_backend,
    read_supabase_storage_config,
    supabase_storage_is_configured,
)
from .serializers import media_field_url
from .storage import SupabasePublicMediaStorage


class FakeResponse:
    def __init__(self, body=b""):
        self.body = body

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False

    def read(self):
        return self.body


class SupabaseStorageConfigurationTests(SimpleTestCase):
    def test_environment_settings_are_trimmed_and_bucket_defaults_to_nexus_media(self):
        self.assertEqual(
            read_supabase_storage_config({
                "SUPABASE_URL": " https://project-ref.supabase.co/ ",
                "SUPABASE_SERVICE_ROLE_KEY": " test-secret ",
                "SUPABASE_STORAGE_BUCKET": " nexus-media ",
            }),
            ("https://project-ref.supabase.co", "test-secret", "nexus-media"),
        )
        self.assertEqual(read_supabase_storage_config({}), ("", "", "nexus-media"))
        self.assertEqual(
            read_supabase_storage_config({"SUPABASE_STORAGE_BUCKET": "  "}),
            ("", "", "nexus-media"),
        )
        self.assertEqual(
            read_supabase_storage_config({
                "SUPABASE_SECRET_KEY": " modern-secret ",
                "SUPABASE_SERVICE_ROLE_KEY": "legacy-key",
            }),
            ("", "modern-secret", "nexus-media"),
        )

    def test_development_can_use_local_storage_but_production_never_does(self):
        self.assertEqual(
            default_media_storage_backend(True, False),
            "django.core.files.storage.FileSystemStorage",
        )
        self.assertEqual(
            default_media_storage_backend(False, False),
            "social.storage.SupabasePublicMediaStorage",
        )
        self.assertEqual(
            default_media_storage_backend(True, True),
            "social.storage.SupabasePublicMediaStorage",
        )

    def test_configuration_requires_nonblank_credentials_and_https_in_production(self):
        self.assertTrue(supabase_storage_is_configured(
            "https://project-ref.supabase.co", "server-key", "nexus-media", debug=False,
        ))
        self.assertFalse(supabase_storage_is_configured(
            " https://project-ref.supabase.co ", "   ", "nexus-media", debug=False,
        ))
        self.assertFalse(supabase_storage_is_configured(
            "http://project-ref.supabase.co", "server-key", "nexus-media", debug=False,
        ))

    @override_settings(
        SUPABASE_URL=" ",
        SUPABASE_STORAGE_SERVER_KEY=" ",
        SUPABASE_STORAGE_BUCKET="nexus-media",
        MEDIA_STORAGE_CONFIGURED=False,
    )
    def test_missing_configuration_fails_clearly_without_network_access(self):
        storage = SupabasePublicMediaStorage()
        with self.assertRaisesMessage(ImproperlyConfigured, "SUPABASE_URL"):
            storage.url("avatars/missing.jpg")


@override_settings(
    SUPABASE_URL="https://project-ref.supabase.co/",
    SUPABASE_STORAGE_SERVER_KEY="test-service-role-key",
    SUPABASE_STORAGE_BUCKET=" nexus-media ",
    MEDIA_STORAGE_CONFIGURED=True,
)
class SupabaseStorageTests(SimpleTestCase):
    def make_storage(self):
        return SupabasePublicMediaStorage()

    def test_urls_use_public_bucket_route_and_encode_key(self):
        self.assertEqual(
            self.make_storage().url("posts/images/space name.jpg"),
            "https://project-ref.supabase.co/storage/v1/object/public/nexus-media/posts/images/space%20name.jpg",
        )

    def test_upload_checks_collision_then_posts_file_to_supabase(self):
        storage = self.make_storage()
        requests = []

        def fake_urlopen(request, timeout):
            requests.append((request, timeout))
            if request.get_method() == "HEAD":
                raise HTTPError(request.full_url, 404, "missing", {}, None)
            return FakeResponse(b"{}")

        with patch("social.storage.urlopen", side_effect=fake_urlopen):
            saved_name = storage.save("avatars/new image.jpg", ContentFile(b"image-bytes", name="new.jpg"))

        self.assertEqual(saved_name, "avatars/new image.jpg")
        self.assertEqual([request.get_method() for request, _ in requests], ["HEAD", "POST"])
        self.assertEqual(
            requests[0][0].full_url,
            "https://project-ref.supabase.co/storage/v1/object/info/nexus-media/avatars/new%20image.jpg",
        )
        upload_request = requests[1][0]
        self.assertEqual(
            upload_request.full_url,
            "https://project-ref.supabase.co/storage/v1/object/nexus-media/avatars/new%20image.jpg",
        )
        self.assertEqual(upload_request.data, b"image-bytes")
        self.assertEqual(upload_request.get_header("Authorization"), "Bearer test-service-role-key")
        self.assertEqual(upload_request.get_header("X-upsert"), "false")

    def test_open_reads_content_from_authenticated_storage_endpoint(self):
        storage = self.make_storage()
        with patch("social.storage.urlopen", return_value=FakeResponse(b"stored-media")) as request:
            self.assertEqual(storage.open("avatars/a.jpg").read(), b"stored-media")
        sent_request = request.call_args.args[0]
        self.assertEqual(sent_request.get_method(), "GET")
        self.assertEqual(
            sent_request.full_url,
            "https://project-ref.supabase.co/storage/v1/object/authenticated/nexus-media/avatars/a.jpg",
        )

    @override_settings(SUPABASE_STORAGE_SERVER_KEY="sb_secret_test-key")
    def test_current_supabase_secret_key_is_sent_only_as_apikey(self):
        storage = self.make_storage()
        with patch("social.storage.urlopen", return_value=FakeResponse(b"ok")) as request:
            storage._request("GET", storage._object_url("avatars/a.jpg"))
        sent_request = request.call_args.args[0]
        self.assertEqual(sent_request.get_header("Apikey"), "sb_secret_test-key")
        self.assertIsNone(sent_request.get_header("Authorization"))

    def test_delete_uses_storage_api_and_public_media_url_is_not_backend_prefixed(self):
        storage = self.make_storage()
        with patch("social.storage.urlopen", return_value=FakeResponse(b"[]")) as request:
            storage.delete("avatars/a.jpg")
        sent_request = request.call_args.args[0]
        self.assertEqual(sent_request.get_method(), "DELETE")
        self.assertEqual(sent_request.full_url, "https://project-ref.supabase.co/storage/v1/object/nexus-media")
        self.assertEqual(sent_request.data, b'{"prefixes": ["avatars/a.jpg"]}')

        from django.test import RequestFactory

        public_url = storage.url("avatars/a.jpg")
        api_request = RequestFactory().get("/api/users/alice/", HTTP_HOST="nexusbackend-5mqs.onrender.com")
        self.assertEqual(media_field_url(type("Field", (), {"url": public_url})(), api_request), public_url)
