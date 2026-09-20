import re

from django import template
from django.urls import reverse
from django.utils.html import format_html, format_html_join

register = template.Library()


@register.filter
def hashtag_links(content):
    """Escape all user text; only generated hashtag links contain HTML."""
    parts = []
    start = 0
    for match in re.finditer(r"#([a-zA-Z0-9_]{2,50})(?![a-zA-Z0-9_])", content):
        parts.append(content[start:match.start()])
        parts.append(format_html('<a href="{}">{}</a>', reverse("hashtag", args=[match[1].lower()]), match[0]))
        start = match.end()
    parts.append(content[start:])
    return format_html_join("", "{}", ((part,) for part in parts))
