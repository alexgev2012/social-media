from django.contrib.auth import views as auth_views
from django.urls import path
from . import views
from . import api_views

urlpatterns = [
    # Modern React Single Page App
    path("app/", views.spa_app, name="spa_app"),
    path("app/<path:path>/", views.spa_app),

    # Server-rendered views (backward compatibility)
    path("", views.feed, name="feed"),
    path("register/", views.register, name="register"),
    path("login/", auth_views.LoginView.as_view(template_name="social/login.html"), name="login"),
    path("logout/", auth_views.LogoutView.as_view(), name="logout"),
    path("profile/edit/", views.edit_profile, name="edit_profile"),
    path("people/<str:username>/", views.profile, name="profile"),
    path("people/<str:username>/follow/", views.follow, name="follow"),
    path("posts/<int:pk>/", views.post_detail, name="post_detail"),
    path("posts/<int:pk>/edit/", views.edit_post, name="edit_post"),
    path("posts/<int:pk>/delete/", views.delete_post, name="delete_post"),
    path("posts/<int:pk>/like/", views.like_post, name="like_post"),
    path("search/", views.search, name="search"),
    path("comments/<int:pk>/", views.comment_link, name="comment_link"),
    path("comments/<int:pk>/like/", views.like_comment, name="like_comment"),
    path("notifications/", views.notifications, name="notifications"),
    path("notifications/read/", views.read_notifications, name="read_notifications"),
    path("tags/<str:tag>/", views.hashtag, name="hashtag"),
    path("images/<str:kind>/<int:pk>/", views.image, name="image"),

    # REST API for React Frontend
    path("api/auth/register/", api_views.api_register, name="api_register"),
    path("api/auth/login/", api_views.api_login, name="api_login"),
    path("api/auth/logout/", api_views.api_logout, name="api_logout"),
    path("api/auth/me/", api_views.api_me, name="api_me"),
    path("api/auth/profile/", api_views.api_update_profile, name="api_update_profile"),

    path("api/posts/", api_views.api_posts_list_create, name="api_posts_list_create"),
    path("api/posts/<int:pk>/", api_views.api_post_detail, name="api_post_detail"),
    path("api/posts/<int:pk>/like/", api_views.api_post_like, name="api_post_like"),
    path("api/posts/<int:post_pk>/comments/", api_views.api_post_comments, name="api_post_comments"),
    path("api/comments/<int:pk>/like/", api_views.api_comment_like, name="api_comment_like"),
    path("api/comments/<int:pk>/delete/", api_views.api_comment_delete, name="api_comment_delete"),

    path("api/stories/", api_views.api_stories_list_create, name="api_stories_list_create"),
    path("api/stories/<int:pk>/like/", api_views.api_story_like, name="api_story_like"),
    path("api/stories/<int:pk>/delete/", api_views.api_story_delete, name="api_story_delete"),

    path("api/conversations/", api_views.api_conversations_list, name="api_conversations_list"),
    path("api/conversations/<str:username>/", api_views.api_conversation_detail, name="api_conversation_detail"),
    path("api/conversations/<str:username>/messages/", api_views.api_send_message, name="api_send_message"),
    path("api/messages/unread-count/", api_views.api_unread_messages_count, name="api_unread_messages_count"),

    path("api/users/<str:username>/", api_views.api_user_profile, name="api_user_profile"),
    path("api/users/<str:username>/follow/", api_views.api_toggle_follow, name="api_toggle_follow"),
    path("api/users/search/", api_views.api_users_search, name="api_users_search"),
    path("api/users/suggestions/", api_views.api_suggested_users, name="api_suggested_users"),

    path("api/notifications/", api_views.api_notifications_list, name="api_notifications_list"),
    path("api/notifications/read/", api_views.api_notifications_mark_read, name="api_notifications_mark_read"),
    path("api/notifications/unread-count/", api_views.api_notifications_unread_count, name="api_notifications_unread_count"),

    path("api/hashtags/trending/", api_views.api_trending_hashtags, name="api_trending_hashtags"),
    path("api/ai/generate/", api_views.api_ai_generate, name="api_ai_generate"),
]
