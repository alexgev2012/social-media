import logging
from functools import partial

from django.db import transaction
from django.db.models.signals import post_delete, post_save, pre_save
from django.dispatch import receiver

from .models import Post, Story, User

logger = logging.getLogger(__name__)
MEDIA_FIELDS = ("avatar", "image", "video")


def current_media_name(instance, field_name):
    field = getattr(instance, field_name, None)
    return field.name if field else ""


def delete_media_if_unreferenced(storage, name):
    if not name:
        return
    for model, field_names in ((User, ("avatar",)), (Post, ("image", "video")), (Story, ("image", "video"))):
        for field_name in field_names:
            if model.objects.filter(**{field_name: name}).exists():
                return
    try:
        storage.delete(name)
    except Exception as exc:
        logger.warning("Could not delete an unreferenced media object (error_type=%s).", type(exc).__name__)


@receiver(pre_save, sender=User)
@receiver(pre_save, sender=Post)
@receiver(pre_save, sender=Story)
def remember_previous_media(sender, instance, **kwargs):
    if not instance.pk:
        instance._previous_media_names = {}
        return
    field_names = [name for name in MEDIA_FIELDS if any(field.name == name for field in sender._meta.fields)]
    old_values = sender._default_manager.filter(pk=instance.pk).values(*field_names).first() or {}
    instance._previous_media_names = {name: old_values.get(name) or "" for name in field_names}


@receiver(post_save, sender=User)
@receiver(post_save, sender=Post)
@receiver(post_save, sender=Story)
def clean_replaced_media(sender, instance, **kwargs):
    previous = getattr(instance, "_previous_media_names", {})
    for field_name, old_name in previous.items():
        if old_name and old_name != current_media_name(instance, field_name):
            storage = sender._meta.get_field(field_name).storage
            transaction.on_commit(partial(delete_media_if_unreferenced, storage, old_name))


@receiver(post_delete, sender=User)
@receiver(post_delete, sender=Post)
@receiver(post_delete, sender=Story)
def clean_deleted_media(sender, instance, **kwargs):
    for field_name in MEDIA_FIELDS:
        if any(field.name == field_name for field in sender._meta.fields):
            name = current_media_name(instance, field_name)
            if name:
                storage = sender._meta.get_field(field_name).storage
                transaction.on_commit(partial(delete_media_if_unreferenced, storage, name))
