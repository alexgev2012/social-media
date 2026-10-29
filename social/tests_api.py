from io import BytesIO
from pathlib import Path
from tempfile import TemporaryDirectory

from PIL import Image
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from django.urls import reverse
from rest_framework.test import APIClient
from config.settings import parse_allowed_hosts
from .api_views import MediaStorageError
from .models import User, Post, Story, Conversation, Message, Notification


RENDER_BACKEND_HOST = "nexusbackend-5mqs.onrender.com"


class ApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.media_directory = TemporaryDirectory()
        self.media_settings = override_settings(MEDIA_ROOT=self.media_directory.name)
        self.media_settings.enable()
        self.addCleanup(self.media_settings.disable)
        self.addCleanup(self.media_directory.cleanup)
        self.alice = User.objects.create_user("alice", "alice@example.com", "Testpass123!", first_name="Alice", last_name="Smith")
        self.bob = User.objects.create_user("bob", "bob@example.com", "Testpass123!", first_name="Bob", last_name="Jones")

    def png_upload(self, name="test.png"):
        image = Image.new("RGB", (8, 8), "purple")
        data = BytesIO()
        image.save(data, format="PNG")
        return SimpleUploadedFile(name, data.getvalue(), content_type="image/png")

    def test_auth_and_me(self):
        # Register
        res = self.client.post("/api/auth/register/", {
            "username": "charlie",
            "email": "charlie@example.com",
            "password": "Password123!",
            "first_name": "Charlie",
            "last_name": "Brown"
        })
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.data["username"], "charlie")

        # Me endpoint
        res = self.client.get("/api/auth/me/")
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.data["authenticated"])
        self.assertEqual(res.data["user"]["username"], "charlie")

        # Logout
        res = self.client.post("/api/auth/logout/")
        self.assertEqual(res.status_code, 200)

        # Login
        res = self.client.post("/api/auth/login/", {"username": "alice", "password": "Testpass123!"})
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["username"], "alice")

    def test_allowed_hosts_are_trimmed_and_include_render_hostname(self):
        self.assertEqual(
            parse_allowed_hosts(
                " nexusbackend-5mqs.onrender.com , , localhost ",
                " nexusbackend-5mqs.onrender.com ",
            ),
            [RENDER_BACKEND_HOST, "localhost"],
        )
        self.assertEqual(
            parse_allowed_hosts(" , ", f" {RENDER_BACKEND_HOST} "),
            [RENDER_BACKEND_HOST],
        )

    @override_settings(DEBUG=False, ALLOWED_HOSTS=[RENDER_BACKEND_HOST])
    def test_registration_accepts_render_host_and_starts_session(self):
        response = self.client.post(
            reverse("api_register"),
            {"username": "renderuser", "email": "render@example.com", "password": "Password123!"},
            format="json",
            HTTP_HOST=RENDER_BACKEND_HOST,
        )
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response["Content-Type"], "application/json")
        self.assertEqual(response.wsgi_request.get_host(), RENDER_BACKEND_HOST)

        current_user = self.client.get(reverse("api_me"), HTTP_HOST=RENDER_BACKEND_HOST)
        self.assertTrue(current_user.data["authenticated"])
        self.assertEqual(current_user.data["user"]["username"], "renderuser")

    @override_settings(DEBUG=False, ALLOWED_HOSTS=[RENDER_BACKEND_HOST])
    def test_registration_validation_failure_returns_json(self):
        response = self.client.post(
            reverse("api_register"),
            {"username": "renderuser", "password": "Password123!"},
            format="json",
            HTTP_HOST=RENDER_BACKEND_HOST,
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response["Content-Type"], "application/json")
        self.assertEqual(response.data["error"], "Username, email, and password are required.")

    @override_settings(
        DEBUG=False,
        ALLOWED_HOSTS=[RENDER_BACKEND_HOST],
        CSRF_TRUSTED_ORIGINS=["https://nexus-1qth.onrender.com"],
        CORS_ALLOWED_ORIGINS=["https://nexus-1qth.onrender.com"],
        CORS_ALLOW_CREDENTIALS=True,
    )
    def test_registration_csrf_flow_is_json_and_rotates_token_after_login(self):
        client = APIClient(enforce_csrf_checks=True)
        first = client.post(
            reverse("api_register"),
            {"username": "csrfuser", "email": "csrf@example.com", "password": "Secure-Password-92!"},
            format="json",
            secure=True,
            HTTP_HOST=RENDER_BACKEND_HOST,
            HTTP_ORIGIN="https://nexus-1qth.onrender.com",
        )
        self.assertEqual(first.status_code, 403)
        self.assertEqual(first["Content-Type"], "application/json")

        csrf_response = client.get(
            reverse("api_csrf"), secure=True, HTTP_HOST=RENDER_BACKEND_HOST,
            HTTP_ORIGIN="https://nexus-1qth.onrender.com",
        )
        token = csrf_response.data["csrfToken"]
        self.assertEqual(csrf_response["Access-Control-Allow-Origin"], "https://nexus-1qth.onrender.com")
        self.assertEqual(csrf_response["Access-Control-Allow-Credentials"], "true")
        self.assertIn("csrftoken", client.cookies)
        registered = client.post(
            reverse("api_register"),
            {"username": "csrfuser", "email": "csrf@example.com", "password": "Secure-Password-92!"},
            format="json",
            secure=True,
            HTTP_HOST=RENDER_BACKEND_HOST,
            HTTP_ORIGIN="https://nexus-1qth.onrender.com",
            HTTP_X_CSRFTOKEN=token,
        )
        self.assertEqual(registered.status_code, 201)
        self.assertEqual(registered["Content-Type"], "application/json")
        self.assertTrue(client.get(
            reverse("api_me"), secure=True, HTTP_HOST=RENDER_BACKEND_HOST,
            HTTP_ORIGIN="https://nexus-1qth.onrender.com",
        ).data["authenticated"])
        stale_token_request = client.post(
            reverse("api_posts_list_create"), {"content": "CSRF token rotation"}, format="json",
            secure=True, HTTP_HOST=RENDER_BACKEND_HOST,
            HTTP_ORIGIN="https://nexus-1qth.onrender.com", HTTP_X_CSRFTOKEN=token,
        )
        self.assertEqual(stale_token_request.status_code, 403)
        renewed_token = client.get(
            reverse("api_csrf"), secure=True, HTTP_HOST=RENDER_BACKEND_HOST,
            HTTP_ORIGIN="https://nexus-1qth.onrender.com",
        ).data["csrfToken"]
        valid_token_request = client.post(
            reverse("api_posts_list_create"), {"content": "CSRF token refreshed"}, format="json",
            secure=True, HTTP_HOST=RENDER_BACKEND_HOST,
            HTTP_ORIGIN="https://nexus-1qth.onrender.com", HTTP_X_CSRFTOKEN=renewed_token,
        )
        self.assertEqual(valid_token_request.status_code, 201)

    def test_user_search_is_trimmed_case_insensitive_limited_and_private(self):
        response = self.client.get(reverse("api_users_search"), {"q": "  aLiCe  "})
        self.assertEqual(response.status_code, 200)
        self.assertEqual([user["username"] for user in response.data], ["alice"])
        self.assertNotIn("email", response.data[0])
        profile = self.client.get(reverse("api_user_profile", args=["alice"]))
        self.assertEqual(profile.status_code, 200)
        self.assertNotIn("email", profile.data)

        User.objects.create_user("inactive", "inactive@example.com", "Testpass123!", is_active=False)
        self.assertEqual(self.client.get(reverse("api_users_search"), {"q": "inactive"}).data, [])
        self.assertEqual(self.client.get(reverse("api_users_search"), {"q": "  "}).data, [])

    @override_settings(DEBUG=True)
    def test_post_image_upload_is_stored_and_returns_absolute_media_url(self):
        self.client.force_authenticate(user=self.alice)
        response = self.client.post(
            reverse("api_posts_list_create"),
            {"content": "Image post", "image": self.png_upload()},
            format="multipart",
        )
        self.assertEqual(response.status_code, 201, response.data)
        post = Post.objects.get(pk=response.data["id"])
        self.assertTrue(post.image.name.startswith("posts/images/"))
        self.assertTrue(Path(post.image.path).exists())
        self.assertTrue(response.data["image_url"].startswith("http://testserver/media/posts/images/"))

    @override_settings(DEBUG=True)
    def test_video_upload_is_validated_and_owner_only_deletion_cleans_file(self):
        self.client.force_authenticate(user=self.alice)
        invalid = SimpleUploadedFile("clip.mp4", b"not video", content_type="video/mp4")
        bad_response = self.client.post(reverse("api_posts_list_create"), {"video": invalid}, format="multipart")
        self.assertEqual(bad_response.status_code, 400)
        self.assertEqual(Post.objects.count(), 0)

        mp4_bytes = b"\x00\x00\x00\x18ftypmp42\x00\x00\x00\x00"
        valid = SimpleUploadedFile("clip.mp4", mp4_bytes, content_type="video/mp4")
        response = self.client.post(reverse("api_posts_list_create"), {"video": valid}, format="multipart")
        self.assertEqual(response.status_code, 201)
        post = Post.objects.get(pk=response.data["id"])
        self.assertTrue(post.video.name.startswith("posts/videos/"))
        self.assertTrue(response.data["video_url"].startswith("http://testserver/media/posts/videos/"))
        stored_path = Path(post.video.path)
        self.assertTrue(stored_path.exists())

        self.client.force_authenticate(user=self.bob)
        denied = self.client.delete(reverse("api_post_detail", args=[post.pk]))
        self.assertEqual(denied.status_code, 403)
        self.assertTrue(stored_path.exists())

        self.client.force_authenticate(user=self.alice)
        with self.captureOnCommitCallbacks(execute=True):
            deleted = self.client.delete(reverse("api_post_detail", args=[post.pk]))
        self.assertEqual(deleted.status_code, 200)
        self.assertFalse(stored_path.exists())

    @override_settings(DEBUG=True, MEDIA_STORAGE_CONFIGURED=True)
    def test_storage_failure_does_not_create_post_and_returns_safe_error(self):
        from unittest.mock import patch

        self.client.force_authenticate(user=self.alice)
        with patch("social.api_views.persist_uploads", side_effect=MediaStorageError):
            response = self.client.post(
                reverse("api_posts_list_create"),
                {"content": "Image post", "image": self.png_upload()},
                format="multipart",
            )
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.data["error"], "Could not store the post media. Please try again.")
        self.assertEqual(Post.objects.count(), 0)

    @override_settings(DEBUG=True)
    def test_avatar_replacement_uses_avatar_prefix_and_removes_old_file_after_save(self):
        self.client.force_authenticate(user=self.alice)
        first = self.client.patch(
            reverse("api_update_profile"), {"avatar": self.png_upload("first.png")}, format="multipart"
        )
        self.assertEqual(first.status_code, 200)
        self.assertTrue(first.data["avatar_url"].startswith("http://testserver/media/avatars/"))
        self.alice.refresh_from_db()
        old_path = Path(self.alice.avatar.path)
        self.assertTrue(old_path.exists())

        with self.captureOnCommitCallbacks(execute=True):
            second = self.client.patch(
                reverse("api_update_profile"), {"avatar": self.png_upload("second.png")}, format="multipart"
            )
        self.assertEqual(second.status_code, 200)
        self.assertFalse(old_path.exists())

    @override_settings(DEBUG=True)
    def test_story_image_upload_and_owner_delete_use_persistent_media_path(self):
        self.client.force_authenticate(user=self.alice)
        response = self.client.post(
            reverse("api_stories_list_create"),
            {"caption": "Story", "image": self.png_upload()},
            format="multipart",
        )
        self.assertEqual(response.status_code, 201, response.data)
        story = Story.objects.get(pk=response.data["id"])
        self.assertTrue(story.image.name.startswith("stories/images/"))
        self.assertTrue(response.data["image_url"].startswith("http://testserver/media/stories/images/"))
        stored_path = Path(story.image.path)
        with self.captureOnCommitCallbacks(execute=True):
            deleted = self.client.delete(reverse("api_story_delete", args=[story.pk]))
        self.assertEqual(deleted.status_code, 200)
        self.assertFalse(stored_path.exists())

    @override_settings(DEBUG=False, ALLOWED_HOSTS=["localhost"])
    def test_disallowed_host_400_is_logged_without_request_body(self):
        with self.assertLogs("django.security.DisallowedHost", level="ERROR") as captured:
            response = self.client.post(
                reverse("api_register"),
                {"username": "renderuser", "email": "render@example.com", "password": "Secret-password-value"},
                format="json",
                HTTP_HOST=RENDER_BACKEND_HOST,
            )
        self.assertEqual(response.status_code, 400)
        self.assertIn("Invalid HTTP_HOST header", "\n".join(captured.output))
        self.assertNotIn("Secret-password-value", "\n".join(captured.output))

    def test_post_flow(self):
        self.client.force_authenticate(user=self.alice)

        # Create post
        res = self.client.post("/api/posts/", {"content": "Hello #react and #django world!"})
        self.assertEqual(res.status_code, 201)
        post_id = res.data["id"]
        self.assertIn("react", res.data["hashtags"])

        # Feed
        res = self.client.get("/api/posts/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.data), 1)

        # Like
        res = self.client.post(f"/api/posts/{post_id}/like/")
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.data["is_liked"])
        self.assertEqual(res.data["like_count"], 1)

        # Comment
        res = self.client.post(f"/api/posts/{post_id}/comments/", {"content": "Great first post!"})
        self.assertEqual(res.status_code, 201)
        comment_id = res.data["id"]

        # Reply
        res = self.client.post(f"/api/posts/{post_id}/comments/", {"content": "Thanks!", "parent_id": comment_id})
        self.assertEqual(res.status_code, 201)

        # Trending tags
        res = self.client.get("/api/hashtags/trending/")
        self.assertEqual(res.status_code, 200)

    def test_story_flow(self):
        self.client.force_authenticate(user=self.bob)
        res = self.client.post("/api/stories/", {"caption": "My first story without media should fail"})
        self.assertEqual(res.status_code, 400)

        story = Story.objects.create(author=self.bob, caption="Awesome sunrise")
        res = self.client.get("/api/stories/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.data), 1)
        self.assertEqual(res.data[0]["user"]["username"], "bob")

        # Like story
        res = self.client.post(f"/api/stories/{story.id}/like/")
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.data["is_liked"])

    def test_chat_flow(self):
        self.client.force_authenticate(user=self.alice)

        # Send message to bob
        res = self.client.post("/api/conversations/bob/messages/", {"content": "Hey Bob! 🎉"})
        self.assertEqual(res.status_code, 201)

        # Check conversations list
        res = self.client.get("/api/conversations/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.data), 1)
        self.assertEqual(res.data[0]["partner"]["username"], "bob")

        # As Bob, check conversation detail
        self.client.force_authenticate(user=self.bob)
        res = self.client.get("/api/conversations/alice/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.data["messages"]), 1)
        self.assertEqual(res.data["messages"][0]["content"], "Hey Bob! 🎉")

    def test_follow_and_notifications(self):
        self.client.force_authenticate(user=self.alice)
        res = self.client.post("/api/users/bob/follow/")
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.data["is_following"])

        # Bob checks notifications
        self.client.force_authenticate(user=self.bob)
        res = self.client.get("/api/notifications/")
        self.assertEqual(res.status_code, 200)
        self.assertTrue(any(n["kind"] == "follow" and n["actor"]["username"] == "alice" for n in res.data))

    def test_ai_generator(self):
        res = self.client.post("/api/ai/generate/", {"topic": "tech"})
        self.assertEqual(res.status_code, 200)
        self.assertIn("text", res.data)
        self.assertIn("tags", res.data)
