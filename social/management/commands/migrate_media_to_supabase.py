from django.conf import settings
from django.core.files.storage import FileSystemStorage, default_storage
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from social.models import Post, Story, User


class Command(BaseCommand):
    help = "Copy media files that still exist in MEDIA_ROOT to configured Supabase Storage."

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true", help="Report what would be copied without uploading files.")

    def handle(self, *args, **options):
        if not settings.MEDIA_STORAGE_CONFIGURED:
            raise CommandError(
                "Configure SUPABASE_URL, SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY), "
                "and SUPABASE_STORAGE_BUCKET before migrating media."
            )

        local_storage = FileSystemStorage(location=settings.MEDIA_ROOT)
        dry_run = options["dry_run"]
        copied = already_remote = missing_local = failures = 0
        for model, field_name in ((User, "avatar"), (Post, "image"), (Post, "video"), (Story, "image"), (Story, "video")):
            for record in model.objects.exclude(**{f"{field_name}__exact": ""}).only("pk", field_name).iterator():
                field = getattr(record, field_name)
                name = field.name
                if not name:
                    continue
                try:
                    if default_storage.exists(name):
                        already_remote += 1
                        continue
                    if not local_storage.exists(name):
                        missing_local += 1
                        self.stdout.write(self.style.WARNING(f"Source file unavailable; retained database path: {name}"))
                        continue
                    if dry_run:
                        copied += 1
                        continue
                    with local_storage.open(name, "rb") as source:
                        remote_name = default_storage.save(name, source)
                    if remote_name != name:
                        with transaction.atomic():
                            model.objects.filter(pk=record.pk).update(**{field_name: remote_name})
                    copied += 1
                except Exception as exc:
                    failures += 1
                    self.stderr.write(self.style.ERROR(
                        f"Could not copy {model._meta.label} media (error_type={type(exc).__name__}): {name}"
                    ))

        action = "would copy" if dry_run else "copied"
        self.stdout.write(
            f"Media migration {action}={copied}, already_in_storage={already_remote}, "
            f"local_source_missing={missing_local}, failures={failures}."
        )
        if failures:
            raise CommandError("Some media files could not be copied; see the safe error summary above.")
