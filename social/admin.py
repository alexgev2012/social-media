from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import Comment, CommentLike, Follow, Notification, Post, PostLike, User


@admin.register(User)
class SocialUserAdmin(UserAdmin):
    fieldsets = UserAdmin.fieldsets + (("Profile", {"fields": ("bio", "avatar")}),)


admin.site.register([Post, Comment, CommentLike, PostLike, Follow, Notification])
