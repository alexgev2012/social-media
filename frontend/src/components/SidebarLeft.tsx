import React from 'react';
import { Home, Compass, Bell, MessageSquare, User as UserIcon, Sparkles, PlusCircle, LogOut, Sun, Moon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Avatar } from './Avatar';

interface SidebarLeftProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  openComposer: () => void;
  openAiStudio: () => void;
  openProfile: (username: string) => void;
  isDark: boolean;
  toggleTheme: () => void;
}

export const SidebarLeft: React.FC<SidebarLeftProps> = ({
  currentTab,
  setCurrentTab,
  openComposer,
  openAiStudio,
  openProfile,
  isDark,
  toggleTheme,
}) => {
  const { user, unreadMessages, unreadNotifications, logout, openAuthModal } = useAuth();

  const navItems = [
    { id: 'feed', label: 'Home', icon: Home },
    { id: 'explore', label: 'Explore', icon: Compass },
    { id: 'notifications', label: 'Notifications', icon: Bell, badge: unreadNotifications },
    { id: 'messages', label: 'Messages', icon: MessageSquare, badge: unreadMessages },
  ];

  return (
    <aside className="left-sidebar-col">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {/* Brand Header */}
        <div
          className="brand-header"
          onClick={() => setCurrentTab('feed')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            cursor: 'pointer',
            padding: '0.4rem 0.6rem',
            userSelect: 'none',
          }}
        >
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: '12px',
              background: 'var(--accent-gradient)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              boxShadow: '0 4px 14px rgba(99, 102, 241, 0.4)',
              flexShrink: 0,
            }}
          >
            <Sparkles size={20} />
          </div>
          <span
            className="brand-text"
            style={{
              fontSize: '1.35rem',
              fontWeight: 800,
              letterSpacing: '-0.03em',
              background: 'linear-gradient(135deg, #f8fafc, #c084fc)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            Nexus
          </span>
        </div>

        {/* Navigation Items */}
        <nav className="primary-nav" aria-label="Main navigation" style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                className={`nav-item nav-item-${item.id} btn-ghost:hover`}
                aria-label={item.label}
                title={item.label}
                onClick={() => {
                  if ((item.id === 'notifications' || item.id === 'messages') && !user) {
                    openAuthModal();
                    return;
                  }
                  setCurrentTab(item.id);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                  padding: '0.7rem 0.9rem',
                  borderRadius: 'var(--radius-full)',
                  fontWeight: isActive ? 700 : 500,
                  fontSize: '1rem',
                  color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                  background: isActive ? 'rgba(99, 102, 241, 0.12)' : 'transparent',
                  width: '100%',
                  justifyContent: 'flex-start',
                  position: 'relative',
                }}
              >
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <Icon size={21} color={isActive ? 'var(--accent-primary)' : 'currentColor'} />
                  {item.badge && item.badge > 0 ? (
                    <span
                      style={{
                        position: 'absolute',
                        top: -5,
                        right: -7,
                        background: 'var(--badge-bg)',
                        color: '#fff',
                        fontSize: '0.65rem',
                        fontWeight: 800,
                        padding: '1px 5px',
                        borderRadius: '999px',
                        lineHeight: 1.2,
                        boxShadow: '0 0 6px rgba(239, 68, 68, 0.5)',
                      }}
                    >
                      {item.badge > 99 ? '99+' : item.badge}
                    </span>
                  ) : null}
                </div>
                <span className="nav-label">{item.label}</span>
              </button>
            );
          })}

          {/* AI Studio Shortcut */}
          <button
            className="ai-nav-item"
            aria-label="AI Studio"
            title="AI Studio"
            onClick={openAiStudio}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              padding: '0.7rem 0.9rem',
              borderRadius: 'var(--radius-full)',
              fontWeight: 600,
              fontSize: '1rem',
              color: 'var(--accent-primary)',
              background: 'rgba(168, 85, 247, 0.08)',
              width: '100%',
              justifyContent: 'flex-start',
            }}
          >
            <Sparkles size={21} />
            <span className="nav-label">AI Studio</span>
          </button>

          {/* Profile link */}
          {user ? (
            <button
              className="profile-nav-item"
              aria-label="Profile"
              title="Profile"
              onClick={() => openProfile(user.username)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                padding: '0.7rem 0.9rem',
                borderRadius: 'var(--radius-full)',
                fontWeight: currentTab === 'profile' ? 700 : 500,
                fontSize: '1rem',
                color: currentTab === 'profile' ? 'var(--text-primary)' : 'var(--text-secondary)',
              background: currentTab === 'profile' ? 'rgba(99, 102, 241, 0.12)' : 'transparent',
                width: '100%',
                justifyContent: 'flex-start',
              }}
            >
              <UserIcon size={21} />
              <span className="nav-label">Profile</span>
            </button>
          ) : null}
        </nav>

        {/* Primary New Post Action Button */}
        <button
          className="btn-primary btn-new-post"
          aria-label="Create a post"
          title="Create a post"
          onClick={() => {
            if (!user) {
              openAuthModal();
            } else {
              openComposer();
            }
          }}
          style={{
            width: '100%',
            padding: '0.75rem',
            fontSize: '1rem',
            justifyContent: 'center',
            display: 'flex',
            marginTop: '0.25rem',
          }}
        >
          <PlusCircle size={18} />
          <span>New Post</span>
        </button>
      </div>

      {/* Footer / Account Section */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
        <button
          onClick={toggleTheme}
          className="btn-ghost theme-toggle-btn"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            width: '100%',
            justifyContent: 'flex-start',
            padding: '0.5rem 0.9rem',
            fontSize: '0.9rem',
          }}
        >
          {isDark ? <Sun size={18} /> : <Moon size={18} />}
          <span className="nav-label">{isDark ? 'Light Theme' : 'Dark Theme'}</span>
        </button>

        {user && (
          <button
            onClick={() => { void logout(); }}
            className="mobile-logout-btn"
            aria-label="Log out"
            title="Log out"
          >
            <LogOut size={18} />
          </button>
        )}

        {user ? (
          <div
            className="user-bottom-badge"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.5rem 0.65rem',
              borderRadius: 'var(--radius-md)',
              background: 'var(--border-subtle)',
              border: '1px solid var(--border-color)',
            }}
          >
            <div
              onClick={() => openProfile(user.username)}
              style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', cursor: 'pointer', overflow: 'hidden' }}
            >
              <Avatar user={user} size="sm" />
              <div className="user-details" style={{ overflow: 'hidden' }}>
                <div style={{ fontWeight: 700, fontSize: '0.88rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {user.display_name}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>@{user.username}</div>
              </div>
            </div>
            <button
              onClick={logout}
              title="Log out"
              className="btn-ghost"
              style={{ padding: '0.4rem', color: 'var(--text-muted)' }}
            >
              <LogOut size={16} />
            </button>
          </div>
        ) : (
          <button
            onClick={openAuthModal}
            className="btn-secondary"
            style={{ width: '100%', justifyContent: 'center' }}
          >
            Sign In / Join
          </button>
        )}
      </div>
    </aside>
  );
};
