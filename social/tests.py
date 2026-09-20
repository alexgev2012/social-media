from io import BytesIO
from tempfile import TemporaryDirectory

from PIL import Image
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import Client, TestCase, override_settings
from django.urls import reverse

from .models import Comment, CommentLike, Follow, Notification, Post, PostLike, User


@override_settings(PASSWORD_HASHERS=["django.contrib.auth.hashers.MD5PasswordHasher"])
class SocialTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.alice = User.objects.create_user("alice", "alice@example.com", "Test-password-842!")
        cls.bob = User.objects.create_user("bob", "bob@example.com", "Test-password-842!")
        cls.post = Post.objects.create(author=cls.alice, content="Hello world")

    def setUp(self):
        self.client.force_login(self.alice)
        self.media = TemporaryDirectory()
        self.media_settings = override_settings(MEDIA_ROOT=self.media.name)
        self.media_settings.enable()
        self.addCleanup(self.media.cleanup)
        self.addCleanup(self.media_settings.disable)

    def test_registration_login_and_logout(self):
        self.client.logout()
        response = self.client.post(reverse("register"), {
            "username": "charlie", "email": "Charlie@example.com",
            "password1": "New-strong-password-812!", "password2": "New-strong-password-812!",
        })
        self.assertRedirects(response, reverse("feed"))
        user = User.objects.get(username="charlie")
        self.assertTrue(user.check_password("New-strong-password-812!"))
        self.assertEqual(user.email, "charlie@example.com")
        self.assertEqual(self.client.get(reverse("logout")).status_code, 405)
        self.assertRedirects(self.client.post(reverse("logout")), reverse("login"))
        response = self.client.post(reverse("login"), {"username": "charlie", "password": "New-strong-password-812!"})
        self.assertRedirects(response, reverse("feed"))

    def test_duplicate_account_and_weak_password_rejected(self):
        self.client.logout()
        response = self.client.post(reverse("register"), {
            "username": "ALICE", "email": "ALICE@example.com",
            "password1": "123", "password2": "123",
        })
        self.assertContains(response, "already taken")
        self.assertContains(response, "already registered")
        self.assertEqual(User.objects.count(), 2)

    def test_guests_cannot_read_or_mutate_feed(self):
        self.client.logout()
        for name, kwargs in [("feed", {}), ("post_detail", {"pk": self.post.pk}), ("like_post", {"pk": self.post.pk})]:
            response = self.client.post(reverse(name, kwargs=kwargs), {"action": "like"})
            self.assertEqual(response.status_code, 302)
            self.assertIn("/login/?next=", response.url)
        self.assertFalse(PostLike.objects.exists())

    def test_csrf_required_for_mutations(self):
        client = Client(enforce_csrf_checks=True)
        client.force_login(self.alice)
        response = client.post(reverse("feed"), {"content": "Blocked"})
        self.assertEqual(response.status_code, 403)
        client.get(reverse("feed"))
        token = client.cookies["csrftoken"].value
        response = client.post(reverse("feed"), {"content": "Allowed", "csrfmiddlewaretoken": token})
        self.assertEqual(response.status_code, 302)

    def test_create_edit_and_delete_post(self):
        response = self.client.post(reverse("feed"), {"content": "My new post"})
        post = Post.objects.get(content="My new post")
        self.assertRedirects(response, reverse("post_detail", args=[post.pk]))
        self.client.post(reverse("edit_post", args=[post.pk]), {"content": "Updated"})
        post.refresh_from_db()
        self.assertEqual(post.content, "Updated")
        Comment.objects.create(post=post, author=self.bob, content="Hi")
        PostLike.objects.create(post=post, user=self.bob)
        response = self.client.post(reverse("delete_post", args=[post.pk]))
        self.assertRedirects(response, reverse("feed"))
        self.assertFalse(Post.objects.filter(pk=post.pk).exists())
        self.assertFalse(Comment.objects.exists())
        self.assertFalse(PostLike.objects.exists())

    def test_post_ownership_enforced(self):
        self.client.force_login(self.bob)
        for name in ["edit_post", "delete_post"]:
            response = self.client.post(reverse(name, args=[self.post.pk]), {"content": "Hacked"})
            self.assertEqual(response.status_code, 404)
        self.post.refresh_from_db()
        self.assertEqual(self.post.content, "Hello world")

    def test_blank_and_oversized_content_rejected(self):
        for content in ["   ", "x" * 1001]:
            response = self.client.post(reverse("feed"), {"content": content})
            self.assertEqual(response.status_code, 200)
            self.assertTrue(response.context["form"].errors)
        self.assertEqual(Post.objects.count(), 1)

    def test_like_actions_are_idempotent_and_post_only(self):
        url = reverse("like_post", args=[self.post.pk])
        self.assertEqual(self.client.get(url).status_code, 405)
        for _ in range(2):
            self.client.post(url, {"action": "like"})
        self.assertEqual(PostLike.objects.count(), 1)
        response = self.client.get(reverse("feed"))
        self.assertEqual(response.context["page_obj"][0].like_count, 1)
        self.assertTrue(response.context["page_obj"][0].is_liked)
        self.assertEqual(self.client.post(url, {"action": "bad"}).status_code, 400)
        for _ in range(2):
            self.client.post(url, {"action": "unlike"})
        self.assertFalse(PostLike.objects.exists())

    def test_comments_validation_and_escaping(self):
        url = reverse("post_detail", args=[self.post.pk])
        self.client.post(url, {"content": "   "})
        self.assertFalse(Comment.objects.exists())
        self.client.post(url, {"content": "<script>alert(1)</script>", "author": self.bob.pk})
        self.assertEqual(Comment.objects.get().author, self.alice)
        response = self.client.get(url)
        self.assertContains(response, "&lt;script&gt;")
        self.assertNotContains(response, "<script>alert(1)</script>")

    def test_following_feed_and_no_self_follow(self):
        other = User.objects.create_user("other", "other@example.com", "password")
        Post.objects.create(author=self.bob, content="Bob's post")
        Post.objects.create(author=other, content="Other post")
        url = reverse("follow", args=[self.bob.username])
        self.assertEqual(self.client.get(url).status_code, 405)
        for _ in range(2):
            self.client.post(url, {"action": "follow"})
        self.assertEqual(Follow.objects.count(), 1)
        response = self.client.get(reverse("feed"), {"feed": "following"})
        self.assertEqual({post.author_id for post in response.context["page_obj"]}, {self.alice.pk, self.bob.pk})
        self.assertEqual(self.client.post(reverse("follow", args=["alice"]), {"action": "follow"}).status_code, 400)
        self.client.post(url, {"action": "unfollow"})
        self.assertFalse(Follow.objects.exists())

    def test_profile_edit_cannot_change_another_user(self):
        self.client.post(reverse("edit_profile"), {"first_name": "Alicia", "last_name": "Smith", "bio": "Hello", "id": self.bob.pk})
        self.alice.refresh_from_db()
        self.bob.refresh_from_db()
        self.assertEqual(self.alice.first_name, "Alicia")
        self.assertEqual(self.bob.first_name, "")
        self.assertContains(self.client.get(reverse("profile", args=["alice"])), "Alicia Smith")

    def test_search_and_feed_pagination(self):
        response = self.client.get(reverse("search"), {"q": "bob"})
        self.assertEqual(list(response.context["page_obj"]), [self.bob])
        for number in range(22):
            Post.objects.create(author=self.alice, content=f"Post {number}")
        first = list(self.client.get(reverse("feed")).context["page_obj"])
        second = list(self.client.get(reverse("feed"), {"page": 2}).context["page_obj"])
        self.assertEqual(len(first), 20)
        self.assertEqual(len(second), 3)
        self.assertFalse({post.pk for post in first} & {post.pk for post in second})
        self.assertEqual([post.pk for post in first + second], list(Post.objects.values_list("pk", flat=True)))

    def test_image_upload_is_reencoded_and_access_requires_login(self):
        output = BytesIO()
        Image.new("RGB", (30, 30), "red").save(output, format="PNG")
        upload = SimpleUploadedFile("photo.png", output.getvalue(), content_type="image/png")
        response = self.client.post(reverse("feed"), {"image": upload})
        self.assertEqual(response.status_code, 302)
        post = Post.objects.exclude(pk=self.post.pk).get()
        self.assertTrue(post.image.name.endswith(".jpg"))
        url = reverse("image", args=["post", post.pk])
        response = self.client.get(url)
        self.assertEqual(response["Content-Type"], "image/jpeg")
        data = b"".join(response.streaming_content)
        response.close()
        self.assertEqual(Image.open(BytesIO(data)).format, "JPEG")
        self.client.logout()
        self.assertEqual(self.client.get(url).status_code, 302)

    def test_invalid_and_oversized_images_rejected(self):
        for data in [b"<svg onload='alert(1)'></svg>", b"x" * (5 * 1024 * 1024 + 1)]:
            response = self.client.post(reverse("feed"), {
                "content": "Image test", "image": SimpleUploadedFile("fake.jpg", data, content_type="image/jpeg"),
            })
            self.assertEqual(response.status_code, 200)
            self.assertIn("image", response.context["form"].errors)
        self.assertEqual(Post.objects.count(), 1)

    def test_replies_flatten_and_notify_actual_recipient(self):
        root = Comment.objects.create(post=self.post, author=self.alice, content="Root")
        reply = Comment.objects.create(post=self.post, author=self.bob, content="Reply", parent=root)
        charlie = User.objects.create_user("charlie", "charlie@example.com", "password")
        self.client.force_login(charlie)
        response = self.client.post(reverse("post_detail", args=[self.post.pk]), {"content": "Nested", "parent_id": reply.pk})
        nested = Comment.objects.get(content="Nested")
        self.assertEqual(nested.parent, root)
        self.assertRedirects(response, reverse("comment_link", args=[nested.pk]), fetch_redirect_response=False)
        self.assertEqual(set(Notification.objects.values_list("recipient_id", "kind")), {
            (self.bob.pk, "reply"), (self.alice.pk, "comment"),
        })
        response = self.client.get(reverse("post_detail", args=[self.post.pk]))
        self.assertContains(response, "alice's thread")

    def test_reply_cannot_reference_another_post_or_invalid_id(self):
        other = Post.objects.create(author=self.bob, content="Other")
        comment = Comment.objects.create(post=other, author=self.bob, content="Elsewhere")
        url = reverse("post_detail", args=[self.post.pk])
        self.assertEqual(self.client.post(url, {"content": "Bad", "parent_id": comment.pk}).status_code, 404)
        self.assertEqual(self.client.post(url, {"content": "Bad", "parent_id": "invalid"}).status_code, 400)
        self.assertEqual(Comment.objects.count(), 1)

    def test_comment_like_notification_idempotence_and_cleanup(self):
        comment = Comment.objects.create(post=self.post, author=self.bob, content="Hi")
        url = reverse("like_comment", args=[comment.pk])
        self.assertEqual(self.client.get(url).status_code, 405)
        for _ in range(2):
            self.client.post(url, {"action": "like"})
        self.assertEqual(CommentLike.objects.count(), 1)
        notification = Notification.objects.get()
        self.assertEqual(notification.recipient, self.bob)
        self.assertEqual(notification.comment, comment)
        self.assertEqual(notification.kind, "comment_like")
        self.assertEqual(self.client.post(url, {"action": "invalid"}).status_code, 400)
        self.client.post(url, {"action": "unlike"})
        self.assertFalse(CommentLike.objects.exists())
        self.assertFalse(Notification.objects.exists())

    def test_post_like_and_follow_notifications(self):
        self.client.force_login(self.bob)
        like = reverse("like_post", args=[self.post.pk])
        follow = reverse("follow", args=["alice"])
        for _ in range(2):
            self.client.post(like, {"action": "like"})
            self.client.post(follow, {"action": "follow"})
        self.assertEqual(Notification.objects.filter(recipient=self.alice).count(), 2)
        self.client.post(like, {"action": "unlike"})
        self.client.post(follow, {"action": "unfollow"})
        self.assertFalse(Notification.objects.exists())
        self.client.force_login(self.alice)
        self.client.post(like, {"action": "like"})
        self.client.post(reverse("post_detail", args=[self.post.pk]), {"content": "Self comment"})
        self.assertFalse(Notification.objects.exists())

    def test_notifications_are_private_and_read_requires_post_and_csrf(self):
        own = Notification.objects.create(recipient=self.alice, actor=self.bob, kind="follow")
        other = Notification.objects.create(recipient=self.bob, actor=self.alice, kind="follow")
        response = self.client.get(reverse("notifications"))
        self.assertEqual(list(response.context["page_obj"]), [own])
        self.assertEqual(response.context["unread_notifications"], 1)
        own.refresh_from_db()
        self.assertFalse(own.is_read)
        url = reverse("read_notifications")
        self.assertEqual(self.client.get(url).status_code, 405)
        self.assertEqual(self.client.post(url, {"notification_id": other.pk}).status_code, 404)
        csrf_client = Client(enforce_csrf_checks=True)
        csrf_client.force_login(self.alice)
        self.assertEqual(csrf_client.post(url, {"action": "all"}).status_code, 403)
        self.client.post(url, {"notification_id": own.pk})
        own.refresh_from_db()
        self.assertTrue(own.is_read)
        self.client.post(url, {"action": "all"})
        other.refresh_from_db()
        self.assertFalse(other.is_read)

    def test_comment_permalink_finds_correct_page(self):
        for n in range(31):
            comment = Comment.objects.create(post=self.post, author=self.alice, content=f"Comment {n}")
        response = self.client.get(reverse("comment_link", args=[comment.pk]))
        self.assertEqual(response.url, f"{reverse('post_detail', args=[self.post.pk])}?page=2#comment-{comment.pk}")
        self.assertContains(self.client.get(response.url), "Comment 30")

    def test_hashtags_escape_html_match_exactly_and_follow_edits(self):
        post = Post.objects.create(author=self.alice, content='<script>alert(1)</script> #Python #pythonista')
        response = self.client.get(reverse("feed"))
        self.assertContains(response, '&lt;script&gt;alert(1)&lt;/script&gt;')
        self.assertContains(response, 'href="/tags/python/"')
        self.assertNotContains(response, '<script>alert(1)</script>')
        url = reverse("hashtag", args=["PYTHON"])
        self.assertEqual(list(self.client.get(url).context["page_obj"]), [post])
        self.client.post(reverse("edit_post", args=[post.pk]), {"content": "#pythonista"})
        self.assertEqual(len(self.client.get(url).context["page_obj"]), 0)
        self.assertEqual(self.client.get(reverse("hashtag", args=["bad-tag"])).status_code, 404)

    def test_reply_to_post_owner_sends_only_one_notification(self):
        root = Comment.objects.create(post=self.post, author=self.alice, content="Root")
        self.client.force_login(self.bob)
        self.client.post(reverse("post_detail", args=[self.post.pk]), {"content": "Reply", "parent_id": root.pk})
        notification = Notification.objects.get()
        self.assertEqual(notification.kind, "reply")
        self.assertEqual(notification.recipient, self.alice)
        self.client.force_login(self.alice)
        self.client.post(reverse("delete_post", args=[self.post.pk]))
        self.assertFalse(Notification.objects.exists())
