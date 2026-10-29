import React, { useState, useEffect } from 'react';
import { Bell, Heart, MessageCircle, UserPlus, CheckCheck } from 'lucide-react';
import { NotificationItem } from '../types';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

interface NotificationsViewProps {
  onSelectUser: (username: string) => void;
  onSelectPost: (postId: number) => void;
}

export const NotificationsView: React.FC<NotificationsViewProps> = ({
  onSelectUser,
  onSelectPost,
}) => {
  const { refreshBadges } = useAuth();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [isLoading, setIsLoading] = useState(true);

  const loadNotifications = async () => {
    setIsLoading(true);
    try {
      const data = await api.notifications.list();
      setNotifications(data);
    } catch {
      // error
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, []);

  const handleMarkAllRead = async () => {
    try {
      await api.notifications.markRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      refreshBadges();
    } catch {
      // error
    }
  };

  const handleNotificationClick = async (notif: NotificationItem) => {
    if (!notif.is_read) {
      try {
        await api.notifications.markRead(notif.id);
        setNotifications(prev => prev.map(n => (n.id === notif.id ? { ...n, is_read: true } : n)));
        refreshBadges();
      } catch {
        // error
      }
    }

    if (notif.post_id) {
      onSelectPost(notif.post_id);
    } else {
      onSelectUser(notif.actor.username);
    }
  };

  const getNotificationIcon = (kind: string) => {
    switch (kind) {
      case 'like':
      case 'story_like':
        return <Heart size={16} color="var(--like-color)" fill="currentColor" />;
      case 'comment':
      case 'reply':
      case 'comment_like':
        return <MessageCircle size={16} color="var(--accent-primary)" />;
      case 'follow':
        return <UserPlus size={16} color="#10b981" />;
      default:
        return <Bell size={16} color="var(--accent-primary)" />;
    }
  };

  const getNotificationText = (kind: string) => {
    switch (kind) {
      case 'like':
        return 'liked your post';
      case 'story_like':
        return 'liked your story';
      case 'comment':
        return 'commented on your post';
      case 'reply':
        return 'replied to your comment';
      case 'comment_like':
        return 'liked your comment';
      case 'follow':
        return 'started following you';
      case 'message':
        return 'sent you a message';
      default:
        return 'interacted with you';
    }
  };

  const filteredNotifs = filter === 'unread'
    ? notifications.filter(n => !n.is_read)
    : notifications;

  return (
    <div style={{ padding: '1.25rem 1rem' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '1rem',
        }}
      >
        <h2 style={{ fontSize: '1.35rem', fontWeight: 800 }}>Notifications</h2>
        <button
          onClick={handleMarkAllRead}
          className="btn-ghost"
          style={{ fontSize: '0.82rem', gap: '0.35rem', color: 'var(--text-secondary)' }}
        >
          <CheckCheck size={16} /> Mark all read
        </button>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '0.5rem',
          borderBottom: '1px solid var(--border-color)',
          paddingBottom: '0.75rem',
          marginBottom: '1rem',
        }}
      >
        <button
          onClick={() => setFilter('all')}
          style={{
            padding: '0.4rem 1rem',
            borderRadius: 'var(--radius-full)',
            fontSize: '0.88rem',
            fontWeight: filter === 'all' ? 700 : 500,
            background: filter === 'all' ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
            color: filter === 'all' ? 'var(--accent-primary)' : 'var(--text-secondary)',
          }}
        >
          All
        </button>
        <button
          onClick={() => setFilter('unread')}
          style={{
            padding: '0.4rem 1rem',
            borderRadius: 'var(--radius-full)',
            fontSize: '0.88rem',
            fontWeight: filter === 'unread' ? 700 : 500,
            background: filter === 'unread' ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
            color: filter === 'unread' ? 'var(--accent-primary)' : 'var(--text-secondary)',
          }}
        >
          Unread
        </button>
      </div>

      {/* Notifications list */}
      {isLoading ? (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
          Loading notifications...
        </div>
      ) : filteredNotifs.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {filteredNotifs.map((notif) => (
            <div
              key={notif.id}
              onClick={() => handleNotificationClick(notif)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.85rem',
                padding: '0.85rem 1rem',
                borderRadius: 'var(--radius-md)',
                background: notif.is_read ? 'var(--bg-card)' : 'rgba(99, 102, 241, 0.08)',
                border: '1px solid var(--border-color)',
                cursor: 'pointer',
              }}
              className="card:hover"
            >
              {/* Type Icon Badge */}
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  background: 'var(--bg-input)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                {getNotificationIcon(notif.kind)}
              </div>

              {/* Actor avatar */}
              <div className="avatar-wrap avatar-sm">
                {notif.actor.avatar_url ? (
                  <img src={notif.actor.avatar_url} alt="" className="avatar-img" />
                ) : (
                  notif.actor.initials
                )}
              </div>

              {/* Notification text */}
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                  <strong>{notif.actor.display_name}</strong> {getNotificationText(notif.kind)}
                </p>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  {new Date(notif.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                </span>
              </div>

              {/* Unread dot */}
              {!notif.is_read && (
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: 'var(--accent-primary)',
                    flexShrink: 0,
                  }}
                />
              )}
            </div>
          ))}
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
          <Bell size={36} style={{ marginBottom: '0.5rem', opacity: 0.5 }} />
          <p style={{ fontSize: '0.95rem' }}>No notifications to display.</p>
        </div>
      )}
    </div>
  );
};
