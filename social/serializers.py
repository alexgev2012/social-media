import re
from rest_framework import serializers
from .models import User, Post, Comment, PostLike, Follow, CommentLike, Story, StoryLike, Conversation, Message, Notification


def extract_hashtags_list(content):
    if not content:
        return []
    matches = re.findall(r'#([a-zA-Z0-9_]{2,50})', content)
    return list(dict.fromkeys([tag.lower() for tag in matches]))


class UserBasicSerializer(serializers.ModelSerializer):
    avatar_url = serializers.SerializerMethodField()
    display_name = serializers.CharField(read_only=True)
    initials = serializers.CharField(read_only=True)

    class Meta:
        model = User
        fields = [
            "id", "username", "first_name", "last_name",
            "display_name", "initials", "avatar_url", "bio"
        ]

    def get_avatar_url(self, obj):
        if obj.avatar:
            request = self.context.get("request")
            if request:
                return request.build_absolute_uri(obj.avatar.url)
            return obj.avatar.url
        return None


class UserProfileSerializer(UserBasicSerializer):
    followers_count = serializers.SerializerMethodField()
    following_count = serializers.SerializerMethodField()
    posts_count = serializers.SerializerMethodField()
    is_following = serializers.SerializerMethodField()

    class Meta(UserBasicSerializer.Meta):
        fields = UserBasicSerializer.Meta.fields + [
            "email", "followers_count", "following_count", "posts_count", "is_following"
        ]

    def get_followers_count(self, obj):
        return obj.followers.count()

    def get_following_count(self, obj):
        return obj.following.count()

    def get_posts_count(self, obj):
        return obj.posts.count()

    def get_is_following(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return False
        return Follow.objects.filter(follower=request.user, following=obj).exists()


class CommentReplySerializer(serializers.ModelSerializer):
    author = UserBasicSerializer(read_only=True)
    like_count = serializers.SerializerMethodField()
    is_liked = serializers.SerializerMethodField()

    class Meta:
        model = Comment
        fields = ["id", "post_id", "author", "content", "parent_id", "created_at", "like_count", "is_liked"]

    def get_like_count(self, obj):
        return obj.likes.count()

    def get_is_liked(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return False
        return obj.likes.filter(user=request.user).exists()


class CommentSerializer(serializers.ModelSerializer):
    author = UserBasicSerializer(read_only=True)
    like_count = serializers.SerializerMethodField()
    is_liked = serializers.SerializerMethodField()
    replies = serializers.SerializerMethodField()

    class Meta:
        model = Comment
        fields = ["id", "post_id", "author", "content", "parent_id", "created_at", "like_count", "is_liked", "replies"]

    def get_like_count(self, obj):
        return obj.likes.count()

    def get_is_liked(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return False
        return obj.likes.filter(user=request.user).exists()

    def get_replies(self, obj):
        replies = obj.replies.select_related("author").order_by("created_at")
        return CommentReplySerializer(replies, many=True, context=self.context).data


class PostSerializer(serializers.ModelSerializer):
    author = UserBasicSerializer(read_only=True)
    image_url = serializers.SerializerMethodField()
    video_url = serializers.SerializerMethodField()
    like_count = serializers.SerializerMethodField()
    comment_count = serializers.SerializerMethodField()
    is_liked = serializers.SerializerMethodField()
    hashtags = serializers.SerializerMethodField()

    class Meta:
        model = Post
        fields = [
            "id", "author", "content", "image_url", "video_url",
            "created_at", "updated_at", "like_count", "comment_count",
            "is_liked", "hashtags"
        ]

    def get_image_url(self, obj):
        if obj.image:
            request = self.context.get("request")
            if request:
                return request.build_absolute_uri(obj.image.url)
            return obj.image.url
        return None

    def get_video_url(self, obj):
        if obj.video:
            request = self.context.get("request")
            if request:
                return request.build_absolute_uri(obj.video.url)
            return obj.video.url
        return None

    def get_like_count(self, obj):
        if hasattr(obj, "like_count_annotated"):
            return obj.like_count_annotated
        return obj.liked_by.count()

    def get_comment_count(self, obj):
        if hasattr(obj, "comment_count_annotated"):
            return obj.comment_count_annotated
        return obj.comments.count()

    def get_is_liked(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return False
        if hasattr(obj, "is_liked_annotated"):
            return bool(obj.is_liked_annotated)
        return obj.liked_by.filter(pk=request.user.pk).exists()

    def get_hashtags(self, obj):
        return extract_hashtags_list(obj.content)


class StorySerializer(serializers.ModelSerializer):
    author = UserBasicSerializer(read_only=True)
    image_url = serializers.SerializerMethodField()
    video_url = serializers.SerializerMethodField()
    like_count = serializers.SerializerMethodField()
    is_liked = serializers.SerializerMethodField()

    class Meta:
        model = Story
        fields = ["id", "author", "image_url", "video_url", "caption", "created_at", "like_count", "is_liked"]

    def get_image_url(self, obj):
        if obj.image:
            request = self.context.get("request")
            if request:
                return request.build_absolute_uri(obj.image.url)
            return obj.image.url
        return None

    def get_video_url(self, obj):
        if obj.video:
            request = self.context.get("request")
            if request:
                return request.build_absolute_uri(obj.video.url)
            return obj.video.url
        return None

    def get_like_count(self, obj):
        return obj.likes.count()

    def get_is_liked(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return False
        return obj.likes.filter(user=request.user).exists()


class MessageSerializer(serializers.ModelSerializer):
    sender = UserBasicSerializer(read_only=True)
    is_mine = serializers.SerializerMethodField()

    class Meta:
        model = Message
        fields = ["id", "sender", "content", "is_read", "created_at", "is_mine"]

    def get_is_mine(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return False
        return obj.sender_id == request.user.id


class ConversationSerializer(serializers.ModelSerializer):
    partner = serializers.SerializerMethodField()
    last_message = serializers.SerializerMethodField()
    unread_count = serializers.SerializerMethodField()

    class Meta:
        model = Conversation
        fields = ["id", "partner", "last_message", "unread_count", "updated_at"]

    def get_partner(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return None
        partner_user = obj.user2 if obj.user1_id == request.user.id else obj.user1
        return UserBasicSerializer(partner_user, context=self.context).data

    def get_last_message(self, obj):
        msg = obj.messages.order_by("-created_at").first()
        if msg:
            return {
                "id": msg.id,
                "content": msg.content,
                "sender_id": msg.sender_id,
                "created_at": msg.created_at,
                "is_read": msg.is_read
            }
        return None

    def get_unread_count(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return 0
        return obj.messages.filter(is_read=False).exclude(sender_id=request.user.id).count()


class NotificationSerializer(serializers.ModelSerializer):
    actor = UserBasicSerializer(read_only=True)

    class Meta:
        model = Notification
        fields = ["id", "actor", "kind", "post_id", "comment_id", "story_id", "is_read", "created_at"]
