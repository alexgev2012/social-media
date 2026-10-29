from django.test import TestCase, override_settings
from django.urls import reverse
from rest_framework.test import APIClient
from config.settings import parse_allowed_hosts
from .models import User, Post, Story, Conversation, Message, Notification


RENDER_BACKEND_HOST = "nexusbackend-5mqs.onrender.com"


class ApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.alice = User.objects.create_user("alice", "alice@example.com", "Testpass123!", first_name="Alice", last_name="Smith")
        self.bob = User.objects.create_user("bob", "bob@example.com", "Testpass123!", first_name="Bob", last_name="Jones")

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
        self.assertEqual(response.status_code, 201)
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
