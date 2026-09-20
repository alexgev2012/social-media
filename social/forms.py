from io import BytesIO
import warnings

from PIL import Image, ImageOps, UnidentifiedImageError
from django import forms
from django.contrib.auth.forms import UserCreationForm
from django.core.files.base import ContentFile

from .models import Comment, Post, User


class SafeImageField(forms.ImageField):
    def to_python(self, data):
        if data and getattr(data, "size", 0) > 5 * 1024 * 1024:
            raise forms.ValidationError("Images must be 5 MB or smaller.")
        upload = super().to_python(data)
        if not upload:
            return upload
        try:
            with warnings.catch_warnings():
                warnings.simplefilter("error", Image.DecompressionBombWarning)
                upload.seek(0)
                with Image.open(upload) as original:
                    if original.width * original.height > 20_000_000:
                        raise forms.ValidationError("Images must be at most 20 megapixels.")
                    if original.format not in {"JPEG", "PNG", "GIF", "WEBP"}:
                        raise forms.ValidationError("Use a JPG, PNG, GIF or WebP image.")
                    image = ImageOps.exif_transpose(original).convert("RGB")
                    image.thumbnail((2400, 2400))
                    output = BytesIO()
                    image.save(output, format="JPEG", quality=88)
            return ContentFile(output.getvalue(), name="image.jpg")
        except (OSError, UnidentifiedImageError, Image.DecompressionBombError, Image.DecompressionBombWarning):
            raise forms.ValidationError("Please upload a valid image.")


class RegisterForm(UserCreationForm):
    class Meta(UserCreationForm.Meta):
        model = User
        fields = ("username", "email", "first_name", "last_name")

    def clean_username(self):
        username = self.cleaned_data["username"].strip()
        if User.objects.filter(username__iexact=username).exists():
            raise forms.ValidationError("This username is already taken.")
        return username

    def clean_email(self):
        email = self.cleaned_data["email"].strip().lower()
        if User.objects.filter(email__iexact=email).exists():
            raise forms.ValidationError("This email is already registered.")
        return email


class ProfileForm(forms.ModelForm):
    avatar = SafeImageField(required=False)

    class Meta:
        model = User
        fields = ("first_name", "last_name", "bio", "avatar")
        widgets = {"bio": forms.Textarea(attrs={"rows": 3})}


class PostForm(forms.ModelForm):
    image = SafeImageField(required=False)

    class Meta:
        model = Post
        fields = ("content", "image")
        widgets = {"content": forms.Textarea(attrs={"rows": 3, "placeholder": "What's on your mind?"})}

    def clean(self):
        cleaned = super().clean()
        if not cleaned.get("content") and not cleaned.get("image"):
            raise forms.ValidationError("Write something or add an image.")
        return cleaned


class CommentForm(forms.ModelForm):
    class Meta:
        model = Comment
        fields = ("content",)
        widgets = {"content": forms.Textarea(attrs={"rows": 2, "placeholder": "Write a comment"})}
