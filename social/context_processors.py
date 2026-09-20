def notifications(request):
    return {"unread_notifications": request.user.notifications.filter(is_read=False).count() if request.user.is_authenticated else 0}
