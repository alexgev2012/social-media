from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta
from social.models import User, Post, Comment, PostLike, Follow, CommentLike, Story, StoryLike, Conversation, Message, Notification


class Command(BaseCommand):
    help = "Seed the social media database with realistic sample users, posts, stories, and chats."

    def handle(self, *args, **options):
        self.stdout.write("Seeding sample data...")

        # Create demo users
        users_data = [
            {"username": "alex", "email": "alex@example.com", "first_name": "Alex", "last_name": "Rivers", "bio": "Creative technologist & UI craftsperson. Building the future of human interfaces. 🚀"},
            {"username": "sarah", "email": "sarah@example.com", "first_name": "Sarah", "last_name": "Vance", "bio": "Street photographer & indie hacker. Coffee first, questions later. ☕📸"},
            {"username": "elena", "email": "elena@example.com", "first_name": "Elena", "last_name": "Rostova", "bio": "AI researcher, open source contributor, and digital nomad. Exploring neural magic. ✨"},
            {"username": "marcus", "email": "marcus@example.com", "first_name": "Marcus", "last_name": "Chen", "bio": "Full-stack engineer & synthesizer nerd. Obsessed with design systems and clean architecture. ⚡"},
        ]

        users = {}
        for u in users_data:
            user, created = User.objects.get_or_create(
                username=u["username"],
                defaults={
                    "email": u["email"],
                    "first_name": u["first_name"],
                    "last_name": u["last_name"],
                    "bio": u["bio"]
                }
            )
            if created:
                user.set_password("password123")
                user.save()
            users[u["username"]] = user

        alex = users["alex"]
        sarah = users["sarah"]
        elena = users["elena"]
        marcus = users["marcus"]

        # Follow relationships
        Follow.objects.get_or_create(follower=alex, following=sarah)
        Follow.objects.get_or_create(follower=alex, following=elena)
        Follow.objects.get_or_create(follower=sarah, following=alex)
        Follow.objects.get_or_create(follower=sarah, following=marcus)
        Follow.objects.get_or_create(follower=elena, following=alex)
        Follow.objects.get_or_create(follower=marcus, following=alex)
        Follow.objects.get_or_create(follower=marcus, following=sarah)

        # Posts
        posts_data = [
            {
                "author": alex,
                "content": "Just finished rewriting the entire stack in Django REST and React TypeScript! The performance difference and component fluidity are night and day. What tech stack gives you that pure developer joy? #tech #react #django #coding",
            },
            {
                "author": sarah,
                "content": "Dawn patrol through the city fog with my trusty 35mm lens. 🌅 Sometimes the quietest mornings yield the most unforgettable frames. Small rituals make life rich. #photography #lifestyle #slowliving #coffee",
            },
            {
                "author": elena,
                "content": "Excited to share that our latest lightweight diffusion paper got accepted! Incredible what can be accomplished when you strip out redundant parameters and focus on data quality. The future is lean. #ai #technology #innovation #future",
            },
            {
                "author": marcus,
                "content": "Hot take: Good design isn't about how much flair you add, it's about how much friction you remove. Every pixel, every millisecond of transition duration matters. #design #ux #craft #webdev",
            },
            {
                "author": alex,
                "content": "Nothing beats that moment when your automated test suite goes completely green after a massive refactor. 💚 Have an awesome day everyone! #coding #buildinpublic #vibes",
            }
        ]

        created_posts = []
        for p in posts_data:
            post, _ = Post.objects.get_or_create(
                author=p["author"],
                content=p["content"]
            )
            created_posts.append(post)

        # Likes
        PostLike.objects.get_or_create(post=created_posts[0], user=sarah)
        PostLike.objects.get_or_create(post=created_posts[0], user=elena)
        PostLike.objects.get_or_create(post=created_posts[0], user=marcus)
        PostLike.objects.get_or_create(post=created_posts[1], user=alex)
        PostLike.objects.get_or_create(post=created_posts[2], user=alex)
        PostLike.objects.get_or_create(post=created_posts[2], user=sarah)
        PostLike.objects.get_or_create(post=created_posts[3], user=alex)

        # Comments
        c1, _ = Comment.objects.get_or_create(
            post=created_posts[0],
            author=sarah,
            content="This looks so crisp! Loving the sleek UI and speed.",
            parent=None
        )
        Comment.objects.get_or_create(
            post=created_posts[0],
            author=alex,
            content="Thank you Sarah! Spent a lot of love polishing the details.",
            parent=c1
        )
        CommentLike.objects.get_or_create(comment=c1, user=alex)

        # Stories
        Story.objects.get_or_create(author=sarah, caption="City rooftop sunset 🌇")
        Story.objects.get_or_create(author=alex, caption="Coding sprint fueled by dark roast ☕💻")
        Story.objects.get_or_create(author=elena, caption="Model training overnight checkpoints ✅")

        # Conversations & Messages
        conv, _ = Conversation.get_or_create_pair(alex, sarah)
        Message.objects.get_or_create(
            conversation=conv,
            sender=sarah,
            content="Hey Alex! How is the new social app coming along?"
        )
        Message.objects.get_or_create(
            conversation=conv,
            sender=alex,
            content="Hey Sarah! Just shipped the full React TypeScript rewrite with instant messaging and stories! 🎉"
        )
        Message.objects.get_or_create(
            conversation=conv,
            sender=sarah,
            content="That is phenomenal! Loving the modern glassmorphism design! 🔥"
        )

        # Notifications
        Notification.objects.get_or_create(
            recipient=alex,
            actor=sarah,
            kind=Notification.Kind.LIKE,
            post=created_posts[0]
        )
        Notification.objects.get_or_create(
            recipient=alex,
            actor=sarah,
            kind=Notification.Kind.COMMENT,
            post=created_posts[0],
            comment=c1
        )
        Notification.objects.get_or_create(
            recipient=alex,
            actor=elena,
            kind=Notification.Kind.FOLLOW
        )

        self.stdout.write(self.style.SUCCESS("Database seeded successfully with demo users, posts, stories and chats!"))
