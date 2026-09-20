import re

from django.contrib import messages
from django.contrib.auth import login
from django.contrib.auth.decorators import login_required
from django.core.paginator import Paginator
from django.db import IntegrityError, transaction
from django.db.models import Count, Exists, OuterRef, Q
from django.http import FileResponse, Http404, HttpResponseBadRequest
from django.shortcuts import get_object_or_404, redirect, render
from django.urls import reverse
from django.views.decorators.http import require_POST

from .forms import CommentForm, PostForm, ProfileForm, RegisterForm
from .models import Comment, CommentLike, Follow, Notification, Post, PostLike, User


def notify(recipient_id, actor, kind, post=None, comment=None):
    if recipient_id != actor.pk:
        Notification.objects.create(recipient_id=recipient_id, actor=actor, kind=kind, post=post, comment=comment)


def post_queryset(user):
    return Post.objects.select_related("author").annotate(
        like_count=Count("postlike", distinct=True),
        comment_count=Count("comments", distinct=True),
        is_liked=Exists(PostLike.objects.filter(post=OuterRef("pk"), user=user)),
    ).order_by("-created_at", "-pk")


def register(request):
    if request.user.is_authenticated:
        return redirect("feed")
    form = RegisterForm(request.POST or None)
    if request.method == "POST" and form.is_valid():
        try:
            with transaction.atomic():
                user = form.save()
        except IntegrityError:
            form.add_error(None, "That username or email is already registered.")
        else:
            login(request, user)
            return redirect("feed")
    return render(request, "social/form.html", {"form": form, "title": "Create account", "submit": "Register"})


@login_required
def feed(request):
    form = PostForm(request.POST or None, request.FILES or None)
    if request.method == "POST" and form.is_valid():
        post = form.save(commit=False)
        post.author = request.user
        post.save()
        return redirect("post_detail", pk=post.pk)
    posts = post_queryset(request.user)
    following = request.GET.get("feed") == "following"
    if following:
        posts = posts.filter(Q(author=request.user) | Q(author__followers__follower=request.user))
    page = Paginator(posts, 20).get_page(request.GET.get("page"))
    return render(request, "social/feed.html", {"form": form, "page_obj": page, "following": following})


@login_required
def post_detail(request, pk):
    post = get_object_or_404(post_queryset(request.user), pk=pk)
    form = CommentForm(request.POST or None)
    if request.method == "POST" and form.is_valid():
        comment = form.save(commit=False)
        comment.author = request.user
        comment.post = post
        target = None
        parent_id = request.POST.get("parent_id")
        if parent_id:
            if not parent_id.isdecimal() or len(parent_id) > 18:
                return HttpResponseBadRequest("Invalid comment.")
            target = get_object_or_404(Comment, pk=int(parent_id), post=post)
            comment.parent_id = target.parent_id or target.pk
        with transaction.atomic():
            comment.save()
            if target:
                notify(target.author_id, request.user, Notification.Kind.REPLY, post, comment)
            if not target or target.author_id != post.author_id:
                notify(post.author_id, request.user, Notification.Kind.COMMENT, post, comment)
        return redirect("comment_link", pk=comment.pk)
    comments = Paginator(post.comments.select_related("author", "parent__author").annotate(
        like_count=Count("likes"),
        is_liked=Exists(CommentLike.objects.filter(comment=OuterRef("pk"), user=request.user)),
    ).order_by("created_at", "pk"), 30).get_page(request.GET.get("page"))
    return render(request, "social/post_detail.html", {"post": post, "form": form, "page_obj": comments})


@login_required
def edit_post(request, pk):
    post = get_object_or_404(Post, pk=pk, author=request.user)
    form = PostForm(request.POST or None, request.FILES or None, instance=post)
    if request.method == "POST" and form.is_valid():
        form.save()
        return redirect("post_detail", pk=pk)
    return render(request, "social/form.html", {"form": form, "title": "Edit post", "submit": "Save post"})


@login_required
@require_POST
def delete_post(request, pk):
    get_object_or_404(Post, pk=pk, author=request.user).delete()
    messages.success(request, "Post deleted.")
    return redirect("feed")


@login_required
@require_POST
@transaction.atomic
def like_post(request, pk):
    post = get_object_or_404(Post, pk=pk)
    action = request.POST.get("action")
    if action == "like":
        _, created = PostLike.objects.get_or_create(post=post, user=request.user)
        if created:
            notify(post.author_id, request.user, Notification.Kind.LIKE, post)
    elif action == "unlike":
        PostLike.objects.filter(post=post, user=request.user).delete()
        Notification.objects.filter(actor=request.user, post=post, kind=Notification.Kind.LIKE).delete()
    else:
        return HttpResponseBadRequest("Invalid like action.")
    return redirect("post_detail", pk=pk)


@login_required
def profile(request, username):
    person = get_object_or_404(User, username=username, is_active=True)
    page = Paginator(post_queryset(request.user).filter(author=person), 20).get_page(request.GET.get("page"))
    return render(request, "social/profile.html", {
        "person": person, "page_obj": page,
        "is_following": Follow.objects.filter(follower=request.user, following=person).exists(),
        "follower_count": person.followers.count(), "following_count": person.following.count(),
    })


@login_required
def edit_profile(request):
    form = ProfileForm(request.POST or None, request.FILES or None, instance=request.user)
    if request.method == "POST" and form.is_valid():
        form.save()
        return redirect("profile", username=request.user.username)
    return render(request, "social/form.html", {"form": form, "title": "Edit profile", "submit": "Save profile"})


@login_required
@require_POST
@transaction.atomic
def follow(request, username):
    person = get_object_or_404(User, username=username, is_active=True)
    if person == request.user:
        return HttpResponseBadRequest("You cannot follow yourself.")
    action = request.POST.get("action")
    if action == "follow":
        _, created = Follow.objects.get_or_create(follower=request.user, following=person)
        if created:
            notify(person.pk, request.user, Notification.Kind.FOLLOW)
    elif action == "unfollow":
        Follow.objects.filter(follower=request.user, following=person).delete()
        Notification.objects.filter(actor=request.user, recipient=person, kind=Notification.Kind.FOLLOW).delete()
    else:
        return HttpResponseBadRequest("Invalid follow action.")
    return redirect("profile", username=username)


@login_required
def search(request):
    query = request.GET.get("q", "").strip()[:150]
    people = User.objects.filter(is_active=True).order_by("username")
    people = people.filter(Q(username__icontains=query) | Q(first_name__icontains=query) | Q(last_name__icontains=query)) if query else people.none()
    page = Paginator(people, 30).get_page(request.GET.get("page"))
    return render(request, "social/search.html", {"query": query, "page_obj": page})


@login_required
def image(request, kind, pk):
    if kind == "post":
        field = get_object_or_404(Post, pk=pk).image
    elif kind == "avatar":
        field = get_object_or_404(User, pk=pk, is_active=True).avatar
    else:
        raise Http404
    if not field:
        raise Http404
    try:
        response = FileResponse(field.open("rb"), content_type="image/jpeg")
    except FileNotFoundError:
        raise Http404
    response["Cache-Control"] = "private, no-cache"
    return response


@login_required
def comment_link(request, pk):
    comment = get_object_or_404(Comment, pk=pk)
    preceding = comment.post.comments.filter(
        Q(created_at__lt=comment.created_at) | Q(created_at=comment.created_at, pk__lt=comment.pk)
    ).count()
    return redirect(f"{reverse('post_detail', args=[comment.post_id])}?page={preceding // 30 + 1}#comment-{comment.pk}")


@login_required
@require_POST
@transaction.atomic
def like_comment(request, pk):
    comment = get_object_or_404(Comment.objects.select_related("post"), pk=pk)
    action = request.POST.get("action")
    if action == "like":
        _, created = CommentLike.objects.get_or_create(comment=comment, user=request.user)
        if created:
            notify(comment.author_id, request.user, Notification.Kind.COMMENT_LIKE, comment.post, comment)
    elif action == "unlike":
        CommentLike.objects.filter(comment=comment, user=request.user).delete()
        Notification.objects.filter(actor=request.user, comment=comment, kind=Notification.Kind.COMMENT_LIKE).delete()
    else:
        return HttpResponseBadRequest("Invalid like action.")
    return redirect("comment_link", pk=pk)


@login_required
def notifications(request):
    page = Paginator(request.user.notifications.select_related("actor", "post", "comment"), 30).get_page(request.GET.get("page"))
    return render(request, "social/notifications.html", {"page_obj": page})


@login_required
@require_POST
def read_notifications(request):
    if request.POST.get("action") == "all":
        request.user.notifications.filter(is_read=False).update(is_read=True)
    else:
        pk = request.POST.get("notification_id", "")
        if not pk.isdecimal() or len(pk) > 18:
            return HttpResponseBadRequest("Invalid notification.")
        notification = get_object_or_404(request.user.notifications, pk=int(pk))
        notification.is_read = True
        notification.save(update_fields=["is_read"])
    return redirect("notifications")


@login_required
def hashtag(request, tag):
    if not re.fullmatch(r"[a-zA-Z0-9_]{2,50}", tag):
        raise Http404
    tag = tag.lower()
    posts = post_queryset(request.user).filter(content__iregex=rf"#{tag}(?![a-zA-Z0-9_])")
    page = Paginator(posts, 20).get_page(request.GET.get("page"))
    return render(request, "social/hashtag.html", {"tag": tag, "page_obj": page})
