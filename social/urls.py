from django.contrib.auth import views as auth_views
from django.urls import path
from . import views

urlpatterns = [
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
]
