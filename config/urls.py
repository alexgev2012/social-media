from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path
from django.views.static import serve

urlpatterns = [
    path("admin/", admin.site.urls),
    path("", include("social.urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    dist_assets = settings.BASE_DIR / "frontend" / "dist" / "assets"
    if dist_assets.exists():
        urlpatterns += [
            path("assets/<path:path>", serve, {"document_root": dist_assets}),
        ]
