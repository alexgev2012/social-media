import json
import os
import re
from datetime import timedelta
from io import BytesIO
from PIL import Image, ImageOps, UnidentifiedImageError

from django.contrib.auth import authenticate, login, logout
from django.core.files.base import ContentFile
from django.db import models
from django.db.models import Count, Exists, OuterRef, Q
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, authentication_classes, permission_classes, parser_classes
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response

from .api_auth import CsrfExemptSessionAuthentication
from .models import (
    User, Post, Comment, PostLike, Follow, CommentLike,
    Story, StoryLike, Conversation, Message, Notification
)
from .serializers import (
    UserBasicSerializer, UserProfileSerializer,
    PostSerializer, CommentSerializer,
    StorySerializer, MessageSerializer, ConversationSerializer,
    NotificationSerializer, extract_hashtags_list
)


def process_image_upload(upload):
    if not upload:
        return None
    if getattr(upload, "size", 0) > 5 * 1024 * 1024:
        raise ValueError("Image must be 5 MB or smaller.")
    upload.seek(0)
    with Image.open(upload) as original:
        if original.width * original.height > 20_000_000:
            raise ValueError("Image must be at most 20 megapixels.")
        if original.format not in {"JPEG", "PNG", "GIF", "WEBP"}:
            raise ValueError("Use a JPG, PNG, GIF or WebP image.")
        img = ImageOps.exif_transpose(original).convert("RGB")
        img.thumbnail((2400, 2400))
        output = BytesIO()
        img.save(output, format="JPEG", quality=88)
        return ContentFile(output.getvalue(), name="image.jpg")


# ==========================================
# AUTH ENDPOINTS
# ==========================================

@api_view(["POST"])
@authentication_classes([CsrfExemptSessionAuthentication])
@permission_classes([AllowAny])
def api_register(request):
    data = request.data
    username = (data.get("username") or "").strip()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    first_name = (data.get("first_name") or "").strip()
    last_name = (data.get("last_name") or "").strip()

    if not username or not email or not password:
        return Response({"error": "Username, email, and password are required."}, status=status.HTTP_400_BAD_REQUEST)

    if len(password) < 6:
        return Response({"error": "Password must be at least 6 characters."}, status=status.HTTP_400_BAD_REQUEST)

    if User.objects.filter(username__iexact=username).exists():
        return Response({"error": "This username is already taken."}, status=status.HTTP_400_BAD_REQUEST)

    if User.objects.filter(email__iexact=email).exists():
        return Response({"error": "This email is already registered."}, status=status.HTTP_400_BAD_REQUEST)

    user = User.objects.create_user(
        username=username,
        email=email,
        password=password,
        first_name=first_name,
        last_name=last_name
    )
    login(request, user)
    return Response(UserProfileSerializer(user, context={"request": request}).data, status=status.HTTP_201_CREATED)


@api_view(["POST"])
@authentication_classes([CsrfExemptSessionAuthentication])
@permission_classes([AllowAny])
def api_login(request):
    data = request.data
    username = (data.get("username") or "").strip()
    password = data.get("password") or ""

    user = authenticate(request, username=username, password=password)
    if not user:
        # Check if login was attempted with email
        try:
            matched_user = User.objects.get(email__iexact=username)
            user = authenticate(request, username=matched_user.username, password=password)
        except User.DoesNotExist:
            pass

    if user is not None:
        login(request, user)
        return Response(UserProfileSerializer(user, context={"request": request}).data)
    return Response({"error": "Invalid username or password."}, status=status.HTTP_400_BAD_REQUEST)


@api_view(["POST"])
@authentication_classes([CsrfExemptSessionAuthentication])
def api_logout(request):
    logout(request)
    return Response({"message": "Successfully logged out."})


@api_view(["GET"])
@authentication_classes([CsrfExemptSessionAuthentication])
@permission_classes([AllowAny])
def api_me(request):
    if request.user.is_authenticated:
        return Response({
            "authenticated": True,
            "user": UserProfileSerializer(request.user, context={"request": request}).data
        })
    return Response({"authenticated": False, "user": None})


@api_view(["PATCH", "PUT"])
@authentication_classes([CsrfExemptSessionAuthentication])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser, JSONParser])
def api_update_profile(request):
    user = request.user
    data = request.data

    if "first_name" in data:
        user.first_name = data["first_name"].strip()
    if "last_name" in data:
        user.last_name = data["last_name"].strip()
    if "bio" in data:
        user.bio = data["bio"].strip()

    if "avatar" in request.FILES:
        try:
            processed = process_image_upload(request.FILES["avatar"])
            user.avatar = processed
        except ValueError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    user.save()
    return Response(UserProfileSerializer(user, context={"request": request}).data)


# ==========================================
# POSTS ENDPOINTS
# ==========================================

@api_view(["GET", "POST"])
@authentication_classes([CsrfExemptSessionAuthentication])
@permission_classes([AllowAny])
@parser_classes([MultiPartParser, FormParser, JSONParser])
def api_posts_list_create(request):
    if request.method == "POST":
        if not request.user.is_authenticated:
            return Response({"error": "Authentication required."}, status=status.HTTP_401_UNAUTHORIZED)

        content = (request.data.get("content") or "").strip()
        image_file = request.FILES.get("image")
        video_file = request.FILES.get("video")

        if not content and not image_file and not video_file:
            return Response({"error": "Write something or attach media."}, status=status.HTTP_400_BAD_REQUEST)

        processed_img = None
        if image_file:
            try:
                processed_img = process_image_upload(image_file)
            except ValueError as e:
                return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

        post = Post.objects.create(
            author=request.user,
            content=content,
            image=processed_img or "",
            video=video_file or ""
        )
        return Response(PostSerializer(post, context={"request": request}).data, status=status.HTTP_201_CREATED)

    # GET Feed
    feed_type = request.GET.get("feed", "global")
    tag = request.GET.get("tag")
    search = request.GET.get("search")
    author_username = request.GET.get("author")

    qs = Post.objects.select_related("author").prefetch_related("liked_by", "comments")

    if feed_type == "following":
        if request.user.is_authenticated:
            following_ids = Follow.objects.filter(follower=request.user).values_list("following_id", flat=True)
            qs = qs.filter(author_id__in=following_ids)
        else:
            qs = qs.none()

    if tag:
        qs = qs.filter(content__iregex=rf"(^|\s)#({re.escape(tag)})(\b|$)")

    if search:
        qs = qs.filter(Q(content__icontains=search) | Q(author__username__icontains=search))

    if author_username:
        qs = qs.filter(author__username=author_username)

    if request.user.is_authenticated:
        qs = qs.annotate(
            like_count_annotated=Count("postlike", distinct=True),
            comment_count_annotated=Count("comments", distinct=True),
            is_liked_annotated=Exists(PostLike.objects.filter(post=OuterRef("pk"), user=request.user))
        )
    else:
        qs = qs.annotate(
            like_count_annotated=Count("postlike", distinct=True),
            comment_count_annotated=Count("comments", distinct=True)
        )

    qs = qs.order_by("-created_at")[:100]
    serializer = PostSerializer(qs, many=True, context={"request": request})
    return Response(serializer.data)


@api_view(["GET", "PATCH", "DELETE"])
@authentication_classes([CsrfExemptSessionAuthentication])
@permission_classes([AllowAny])
def api_post_detail(request, pk):
    try:
        post = Post.objects.select_related("author").get(pk=pk)
    except Post.DoesNotExist:
        return Response({"error": "Post not found."}, status=status.HTTP_404_NOT_FOUND)

    if request.method == "GET":
        serializer = PostSerializer(post, context={"request": request})
        return Response(serializer.data)

    if not request.user.is_authenticated:
        return Response({"error": "Authentication required."}, status=status.HTTP_401_UNAUTHORIZED)

    if post.author != request.user:
        return Response({"error": "Permission denied."}, status=status.HTTP_403_FORBIDDEN)

    if request.method == "PATCH":
        content = (request.data.get("content") or "").strip()
        if not content and not post.image and not post.video:
            return Response({"error": "Post cannot be empty."}, status=status.HTTP_400_BAD_REQUEST)
        post.content = content
        post.save()
        return Response(PostSerializer(post, context={"request": request}).data)

    if request.method == "DELETE":
        post.delete()
        return Response({"message": "Post deleted successfully."})


@api_view(["POST"])
@authentication_classes([CsrfExemptSessionAuthentication])
@permission_classes([IsAuthenticated])
def api_post_like(request, pk):
    try:
        post = Post.objects.get(pk=pk)
    except Post.DoesNotExist:
        return Response({"error": "Post not found."}, status=status.HTTP_404_NOT_FOUND)

    like, created = PostLike.objects.get_or_create(post=post, user=request.user)
    if not created:
        like.delete()
        is_liked = False
        Notification.objects.filter(
            recipient=post.author,
            actor=request.user,
            kind=Notification.Kind.LIKE,
            post=post
        ).delete()
    else:
        is_liked = True
        if post.author != request.user:
            Notification.objects.create(
                recipient=post.author,
                actor=request.user,
                kind=Notification.Kind.LIKE,
                post=post
            )

    return Response({
        "is_liked": is_liked,
        "like_count": post.liked_by.count()
    })


# ==========================================
# COMMENTS ENDPOINTS
# ==========================================

@api_view(["GET", "POST"])
@authentication_classes([CsrfExemptSessionAuthentication])
@permission_classes([AllowAny])
def api_post_comments(request, post_pk):
    try:
        post = Post.objects.get(pk=post_pk)
    except Post.DoesNotExist:
        return Response({"error": "Post not found."}, status=status.HTTP_404_NOT_FOUND)

    if request.method == "POST":
        if not request.user.is_authenticated:
            return Response({"error": "Authentication required."}, status=status.HTTP_401_UNAUTHORIZED)

        content = (request.data.get("content") or "").strip()
        parent_id = request.data.get("parent_id")

        if not content:
            return Response({"error": "Comment cannot be empty."}, status=status.HTTP_400_BAD_REQUEST)

        parent = None
        if parent_id:
            try:
                parent = Comment.objects.get(pk=parent_id, post=post)
            except Comment.DoesNotExist:
                return Response({"error": "Parent comment not found."}, status=status.HTTP_404_NOT_FOUND)

        comment = Comment.objects.create(
            post=post,
            author=request.user,
            content=content,
            parent=parent
        )

        if parent:
            if parent.author != request.user:
                Notification.objects.create(
                    recipient=parent.author,
                    actor=request.user,
                    kind=Notification.Kind.REPLY,
                    post=post,
                    comment=comment
                )
        else:
            if post.author != request.user:
                Notification.objects.create(
                    recipient=post.author,
                    actor=request.user,
                    kind=Notification.Kind.COMMENT,
                    post=post,
                    comment=comment
                )

        return Response(CommentSerializer(comment, context={"request": request}).data, status=status.HTTP_201_CREATED)

    comments = post.comments.filter(parent=None).select_related("author").prefetch_related("replies__author", "likes")
    return Response(CommentSerializer(comments, many=True, context={"request": request}).data)


@api_view(["POST"])
@authentication_classes([CsrfExemptSessionAuthentication])
@permission_classes([IsAuthenticated])
def api_comment_like(request, pk):
    try:
        comment = Comment.objects.get(pk=pk)
    except Comment.DoesNotExist:
        return Response({"error": "Comment not found."}, status=status.HTTP_404_NOT_FOUND)

    like, created = CommentLike.objects.get_or_create(comment=comment, user=request.user)
    if not created:
        like.delete()
        is_liked = False
        Notification.objects.filter(
            recipient=comment.author,
            actor=request.user,
            kind=Notification.Kind.COMMENT_LIKE,
            comment=comment
        ).delete()
    else:
        is_liked = True
        if comment.author != request.user:
            Notification.objects.create(
                recipient=comment.author,
                actor=request.user,
                kind=Notification.Kind.COMMENT_LIKE,
                post=comment.post,
                comment=comment
            )

    return Response({
        "is_liked": is_liked,
        "like_count": comment.likes.count()
    })


@api_view(["DELETE"])
@authentication_classes([CsrfExemptSessionAuthentication])
@permission_classes([IsAuthenticated])
def api_comment_delete(request, pk):
    try:
        comment = Comment.objects.get(pk=pk)
    except Comment.DoesNotExist:
        return Response({"error": "Comment not found."}, status=status.HTTP_404_NOT_FOUND)

    if comment.author != request.user and comment.post.author != request.user:
        return Response({"error": "Permission denied."}, status=status.HTTP_403_FORBIDDEN)

    comment.delete()
    return Response({"message": "Comment deleted."})


# ==========================================
# STORIES ENDPOINTS
# ==========================================

@api_view(["GET", "POST"])
@authentication_classes([CsrfExemptSessionAuthentication])
@permission_classes([AllowAny])
@parser_classes([MultiPartParser, FormParser, JSONParser])
def api_stories_list_create(request):
    if request.method == "POST":
        if not request.user.is_authenticated:
            return Response({"error": "Authentication required."}, status=status.HTTP_401_UNAUTHORIZED)

        image_file = request.FILES.get("image")
        video_file = request.FILES.get("video")
        caption = (request.data.get("caption") or "").strip()

        if not image_file and not video_file:
            return Response({"error": "Please provide an image or video for the story."}, status=status.HTTP_400_BAD_REQUEST)

        processed_img = None
        if image_file:
            try:
                processed_img = process_image_upload(image_file)
            except ValueError as e:
                return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

        story = Story.objects.create(
            author=request.user,
            image=processed_img or "",
            video=video_file or "",
            caption=caption
        )
        return Response(StorySerializer(story, context={"request": request}).data, status=status.HTTP_201_CREATED)

    # GET active stories (past 24h)
    cutoff = timezone.now() - timedelta(hours=24)
    active_stories = Story.objects.filter(created_at__gte=cutoff).select_related("author").prefetch_related("likes")

    # Group stories by author
    users_dict = {}
    for story in active_stories:
        uid = story.author_id
        if uid not in users_dict:
            users_dict[uid] = {
                "user": UserBasicSerializer(story.author, context={"request": request}).data,
                "stories": [],
                "latest_story_time": story.created_at
            }
        users_dict[uid]["stories"].append(StorySerializer(story, context={"request": request}).data)
        if story.created_at > users_dict[uid]["latest_story_time"]:
            users_dict[uid]["latest_story_time"] = story.created_at

    result = sorted(users_dict.values(), key=lambda x: x["latest_story_time"], reverse=True)
    return Response(result)


@api_view(["POST"])
@authentication_classes([CsrfExemptSessionAuthentication])
@permission_classes([IsAuthenticated])
def api_story_like(request, pk):
    try:
        story = Story.objects.get(pk=pk)
    except Story.DoesNotExist:
        return Response({"error": "Story not found."}, status=status.HTTP_404_NOT_FOUND)

    like, created = StoryLike.objects.get_or_create(story=story, user=request.user)
    if not created:
        like.delete()
        is_liked = False
        Notification.objects.filter(
            recipient=story.author,
            actor=request.user,
            kind=Notification.Kind.STORY_LIKE,
            story=story
        ).delete()
    else:
        is_liked = True
        if story.author != request.user:
            Notification.objects.create(
                recipient=story.author,
                actor=request.user,
                kind=Notification.Kind.STORY_LIKE,
                story=story
            )

    return Response({
        "is_liked": is_liked,
        "like_count": story.likes.count()
    })


@api_view(["DELETE"])
@authentication_classes([CsrfExemptSessionAuthentication])
@permission_classes([IsAuthenticated])
def api_story_delete(request, pk):
    try:
        story = Story.objects.get(pk=pk)
    except Story.DoesNotExist:
        return Response({"error": "Story not found."}, status=status.HTTP_404_NOT_FOUND)

    if story.author != request.user:
        return Response({"error": "Permission denied."}, status=status.HTTP_403_FORBIDDEN)

    story.delete()
    return Response({"message": "Story deleted."})


# ==========================================
# CHAT & MESSAGING ENDPOINTS
# ==========================================

@api_view(["GET"])
@authentication_classes([CsrfExemptSessionAuthentication])
@permission_classes([IsAuthenticated])
def api_conversations_list(request):
    user = request.user
    convs = Conversation.objects.filter(Q(user1=user) | Q(user2=user)).select_related("user1", "user2").order_by("-updated_at")
    serializer = ConversationSerializer(convs, many=True, context={"request": request})
    return Response(serializer.data)


@api_view(["GET"])
@authentication_classes([CsrfExemptSessionAuthentication])
@permission_classes([IsAuthenticated])
def api_conversation_detail(request, username):
    user = request.user
    try:
        partner = User.objects.get(username=username)
    except User.DoesNotExist:
        return Response({"error": "User not found."}, status=status.HTTP_404_NOT_FOUND)

    if partner == user:
        return Response({"error": "Cannot chat with yourself."}, status=status.HTTP_400_BAD_REQUEST)

    conv, _ = Conversation.get_or_create_pair(user, partner)

    # Mark incoming partner messages as read
    conv.messages.filter(sender=partner, is_read=False).update(is_read=True)

    messages = conv.messages.select_related("sender").order_by("created_at")[:200]
    return Response({
        "conversation_id": conv.id,
        "partner": UserBasicSerializer(partner, context={"request": request}).data,
        "messages": MessageSerializer(messages, many=True, context={"request": request}).data
    })


@api_view(["POST"])
@authentication_classes([CsrfExemptSessionAuthentication])
@permission_classes([IsAuthenticated])
def api_send_message(request, username):
    user = request.user
    content = (request.data.get("content") or "").strip()

    if not content:
        return Response({"error": "Message cannot be empty."}, status=status.HTTP_400_BAD_REQUEST)

    try:
        partner = User.objects.get(username=username)
    except User.DoesNotExist:
        return Response({"error": "User not found."}, status=status.HTTP_404_NOT_FOUND)

    if partner == user:
        return Response({"error": "Cannot chat with yourself."}, status=status.HTTP_400_BAD_REQUEST)

    conv, _ = Conversation.get_or_create_pair(user, partner)
    msg = Message.objects.create(
        conversation=conv,
        sender=user,
        content=content
    )
    conv.updated_at = timezone.now()
    conv.save()

    # Optional notification for partner
    Notification.objects.create(
        recipient=partner,
        actor=user,
        kind=Notification.Kind.MESSAGE
    )

    return Response(MessageSerializer(msg, context={"request": request}).data, status=status.HTTP_201_CREATED)


@api_view(["GET"])
@authentication_classes([CsrfExemptSessionAuthentication])
@permission_classes([IsAuthenticated])
def api_unread_messages_count(request):
    user = request.user
    count = Message.objects.filter(
        conversation__in=Conversation.objects.filter(Q(user1=user) | Q(user2=user)),
        is_read=False
    ).exclude(sender=user).count()
    return Response({"unread_count": count})


# ==========================================
# USERS, PROFILES & FOLLOWS
# ==========================================

@api_view(["GET"])
@authentication_classes([CsrfExemptSessionAuthentication])
@permission_classes([AllowAny])
def api_user_profile(request, username):
    try:
        user = User.objects.get(username=username)
    except User.DoesNotExist:
        return Response({"error": "User not found."}, status=status.HTTP_404_NOT_FOUND)

    return Response(UserProfileSerializer(user, context={"request": request}).data)


@api_view(["POST"])
@authentication_classes([CsrfExemptSessionAuthentication])
@permission_classes([IsAuthenticated])
def api_toggle_follow(request, username):
    try:
        target = User.objects.get(username=username)
    except User.DoesNotExist:
        return Response({"error": "User not found."}, status=status.HTTP_404_NOT_FOUND)

    if target == request.user:
        return Response({"error": "You cannot follow yourself."}, status=status.HTTP_400_BAD_REQUEST)

    follow, created = Follow.objects.get_or_create(follower=request.user, following=target)
    if not created:
        follow.delete()
        is_following = False
        Notification.objects.filter(
            recipient=target,
            actor=request.user,
            kind=Notification.Kind.FOLLOW
        ).delete()
    else:
        is_following = True
        Notification.objects.create(
            recipient=target,
            actor=request.user,
            kind=Notification.Kind.FOLLOW
        )

    return Response({
        "is_following": is_following,
        "followers_count": target.followers.count(),
        "following_count": target.following.count()
    })


@api_view(["GET"])
@authentication_classes([CsrfExemptSessionAuthentication])
@permission_classes([AllowAny])
def api_users_search(request):
    query = (request.GET.get("q") or "").strip()
    if not query:
        return Response([])

    users = User.objects.filter(
        Q(username__icontains=query) | Q(first_name__icontains=query) | Q(last_name__icontains=query)
    )[:20]
    return Response(UserBasicSerializer(users, many=True, context={"request": request}).data)


@api_view(["GET"])
@authentication_classes([CsrfExemptSessionAuthentication])
@permission_classes([AllowAny])
def api_suggested_users(request):
    current_user = request.user
    if current_user.is_authenticated:
        following_ids = Follow.objects.filter(follower=current_user).values_list("following_id", flat=True)
        users = User.objects.exclude(id=current_user.id).exclude(id__in=following_ids)[:6]
    else:
        users = User.objects.all()[:6]
    return Response(UserBasicSerializer(users, many=True, context={"request": request}).data)


# ==========================================
# NOTIFICATIONS ENDPOINTS
# ==========================================

@api_view(["GET"])
@authentication_classes([CsrfExemptSessionAuthentication])
@permission_classes([IsAuthenticated])
def api_notifications_list(request):
    notifs = request.user.notifications.select_related("actor").order_by("-created_at")[:50]
    return Response(NotificationSerializer(notifs, many=True, context={"request": request}).data)


@api_view(["POST"])
@authentication_classes([CsrfExemptSessionAuthentication])
@permission_classes([IsAuthenticated])
def api_notifications_mark_read(request):
    notif_id = request.data.get("id")
    if notif_id:
        request.user.notifications.filter(pk=notif_id).update(is_read=True)
    else:
        request.user.notifications.filter(is_read=False).update(is_read=True)
    return Response({"message": "Marked as read."})


@api_view(["GET"])
@authentication_classes([CsrfExemptSessionAuthentication])
@permission_classes([IsAuthenticated])
def api_notifications_unread_count(request):
    count = request.user.notifications.filter(is_read=False).count()
    return Response({"unread_count": count})


# ==========================================
# HASHTAGS & EXPLORE
# ==========================================

@api_view(["GET"])
@authentication_classes([CsrfExemptSessionAuthentication])
@permission_classes([AllowAny])
def api_trending_hashtags(request):
    # Scan recent posts for popular hashtags
    posts = Post.objects.all()[:200]
    counts = {}
    for p in posts:
        for tag in extract_hashtags_list(p.content):
            counts[tag] = counts.get(tag, 0) + 1

    # Default starter tags if few or none
    defaults = {"tech": 14, "design": 11, "lifestyle": 9, "coding": 8, "nature": 6, "coffee": 5}
    for k, v in defaults.items():
        if k not in counts:
            counts[k] = v

    sorted_tags = sorted([{"tag": k, "count": v} for k, v in counts.items()], key=lambda x: x["count"], reverse=True)[:10]
    return Response(sorted_tags)


# ==========================================
# AI POST GENERATOR
# ==========================================

AI_TEMPLATES = [
    {
        "topic": "tech",
        "text": "The pace of tech innovation right now is mind-bending. What used to take engineering teams months can now be prototyped in an afternoon. What's one tool that completely changed your workflow recently?",
        "tags": ["#technology", "#future", "#innovation", "#coding"]
    },
    {
        "topic": "coffee",
        "text": "Nothing beats that first sip of coffee while the city is still quiet. ☕ Small rituals, big difference — what's the one morning habit that sets your day up for success?",
        "tags": ["#coffee", "#morningritual", "#slowliving", "#mindset"]
    },
    {
        "topic": "motivation",
        "text": "Consistency quietly outworks talent every single time. Don't worry about being exceptional every day; just show up and keep building block by block. 🚀",
        "tags": ["#growthmindset", "#consistency", "#motivation", "#focus"]
    },
    {
        "topic": "design",
        "text": "Great design isn't just about what looks sleek — it's about eliminating cognitive friction so things just feel natural and effortless to use. ✨",
        "tags": ["#design", "#ux", "#minimalism", "#craft"]
    },
    {
        "topic": "travel",
        "text": "Caught this breathtaking view completely unplanned — took the detour and the scenery made every extra mile worth it. 🌄 Keep exploring!",
        "tags": ["#wanderlust", "#travel", "#explore", "#views"]
    },
    {
        "topic": "coding",
        "text": "That dopamine rush when clean code compiles without a single warning and the tests turn all green on the first try. Pure bliss. 💻⚡",
        "tags": ["#developer", "#code", "#react", "#python", "#buildinpublic"]
    }
]

@api_view(["POST"])
@authentication_classes([CsrfExemptSessionAuthentication])
@permission_classes([AllowAny])
def api_ai_generate(request):
    prompt = (request.data.get("prompt") or "").strip().lower()
    topic = (request.data.get("topic") or "").strip().lower()

    # Match template
    selected = None
    for tmpl in AI_TEMPLATES:
        if topic and topic in tmpl["topic"]:
            selected = tmpl
            break
        if prompt and (tmpl["topic"] in prompt or any(t.strip("#") in prompt for t in tmpl["tags"])):
            selected = tmpl
            break

    if not selected:
        import random
        selected = random.choice(AI_TEMPLATES)

    # If user provided a specific prompt, customize text
    if prompt and len(prompt) > 3 and not selected["topic"] in prompt:
        custom_tags = ["#" + re.sub(r'\W+', '', w).lower() for w in prompt.split()[:3] if len(w) > 3]
        text = f"{prompt.capitalize()}! Loving the journey and exploring fresh horizons. What are your thoughts on this? 💡"
        tags = custom_tags if custom_tags else selected["tags"]
    else:
        text = selected["text"]
        tags = selected["tags"]

    return Response({
        "text": text,
        "tags": tags,
        "full_content": f"{text}\n\n{' '.join(tags)}"
    })
