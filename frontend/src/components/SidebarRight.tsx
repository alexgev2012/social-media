import React, { useState, useEffect } from 'react';
import { Search, Hash, UserPlus, UserCheck, Sparkles, X } from 'lucide-react';
import { User, TrendingTag } from '../types';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

interface SidebarRightProps {
  onSelectTag: (tag: string) => void;
  onSelectUser: (username: string) => void;
  onOpenAiStudio: () => void;
}

export const SidebarRight: React.FC<SidebarRightProps> = ({
  onSelectTag,
  onSelectUser,
  onOpenAiStudio,
}) => {
  const { user, openAuthModal } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [trendingTags, setTrendingTags] = useState<TrendingTag[]>([]);
  const [suggestedUsers, setSuggestedUsers] = useState<User[]>([]);
  const [followingMap, setFollowingMap] = useState<Record<string, boolean>>({});

  useEffect(() => {
    api.hashtags.trending().then(setTrendingTags).catch(() => {});
    api.users.suggestions().then((users) => {
      setSuggestedUsers(users);
      const initialMap: Record<string, boolean> = {};
      users.forEach(u => { initialMap[u.username] = !!u.is_following; });
      setFollowingMap(initialMap);
    }).catch(() => {});
  }, [user]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await api.users.search(searchQuery);
        setSearchResults(results);
      } catch {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleToggleFollow = async (targetUsername: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) {
      openAuthModal();
      return;
    }
    try {
      const res = await api.users.toggleFollow(targetUsername);
      setFollowingMap(prev => ({ ...prev, [targetUsername]: res.is_following }));
    } catch {
      // error
    }
  };

  return (
    <aside className="right-sidebar-col">
      {/* Search Input Bar */}
      <div style={{ position: 'relative' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.65rem',
            background: 'var(--bg-input)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-full)',
            padding: '0.6rem 1rem',
          }}
        >
          <Search size={17} color="var(--text-muted)" />
          <input
            type="text"
            placeholder="Search people or #tags..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && searchQuery.startsWith('#')) {
                onSelectTag(searchQuery.replace('#', ''));
                setSearchQuery('');
              }
            }}
            style={{
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--text-primary)',
              width: '100%',
              fontSize: '0.88rem',
            }}
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="btn-ghost" style={{ padding: '0.2rem' }}>
              <X size={14} />
            </button>
          )}
        </div>

        {/* Search Results Popover */}
        {searchQuery.trim() && (
          <div
            className="panel"
            style={{
              position: 'absolute',
              top: '110%',
              left: 0,
              right: 0,
              zIndex: 40,
              maxHeight: '280px',
              overflowY: 'auto',
              padding: '0.4rem',
              boxShadow: 'var(--shadow-md)',
            }}
          >
            {isSearching ? (
              <div style={{ padding: '0.75rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.84rem' }}>
                Searching...
              </div>
            ) : searchResults.length > 0 ? (
              searchResults.map((resUser) => (
                <div
                  key={resUser.id}
                  onClick={() => {
                    onSelectUser(resUser.username);
                    setSearchQuery('');
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.65rem',
                    padding: '0.55rem 0.75rem',
                    borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer',
                  }}
                  className="btn-ghost:hover"
                >
                  <div className="avatar-wrap avatar-sm">
                    {resUser.avatar_url ? (
                      <img src={resUser.avatar_url} alt="" className="avatar-img" />
                    ) : (
                      resUser.initials
                    )}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>{resUser.display_name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>@{resUser.username}</div>
                  </div>
                </div>
              ))
            ) : (
              <div style={{ padding: '0.75rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.84rem' }}>
                No users found. Press Enter to view #{searchQuery.replace('#', '')}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Trending Topics Module */}
      <div className="panel" style={{ padding: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.85rem' }}>
          <Hash size={17} color="var(--accent-primary)" />
          <h3 style={{ fontSize: '1rem', fontWeight: 800 }}>Trending Today</h3>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {trendingTags.slice(0, 5).map((item) => (
            <div
              key={item.tag}
              onClick={() => onSelectTag(item.tag)}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                cursor: 'pointer',
                padding: '0.55rem 0.5rem',
                borderRadius: 'var(--radius-sm)',
                transition: 'var(--transition)',
              }}
              className="btn-ghost:hover"
            >
              <div>
                <span className="hashtag" style={{ fontSize: '0.92rem' }}>#{item.tag}</span>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>{item.count} posts</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Suggested Follows Module */}
      <div className="panel" style={{ padding: '1rem' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 800, marginBottom: '0.85rem' }}>Who to Follow</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
          {suggestedUsers.map((sUser) => {
            const isFollowing = followingMap[sUser.username];
            return (
              <div
                key={sUser.id}
                onClick={() => onSelectUser(sUser.username)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.35rem 0.25rem',
                  cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                  <div className="avatar-wrap avatar-sm">
                    {sUser.avatar_url ? (
                      <img src={sUser.avatar_url} alt="" className="avatar-img" />
                    ) : (
                      sUser.initials
                    )}
                  </div>
                  <div style={{ overflow: 'hidden' }}>
                    <div style={{ fontWeight: 700, fontSize: '0.86rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {sUser.display_name}
                    </div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>@{sUser.username}</div>
                  </div>
                </div>

                <button
                  onClick={(e) => handleToggleFollow(sUser.username, e)}
                  style={{
                    padding: '0.35rem 0.85rem',
                    fontSize: '0.78rem',
                    borderRadius: 'var(--radius-full)',
                    background: isFollowing ? 'transparent' : 'var(--text-primary)',
                    border: isFollowing ? '1px solid var(--border-color)' : 'none',
                    color: isFollowing ? 'var(--text-secondary)' : 'var(--bg-main)',
                    fontWeight: 700,
                  }}
                >
                  {isFollowing ? (
                    <>
                      <UserCheck size={12} /> Following
                    </>
                  ) : (
                    <>
                      <UserPlus size={12} /> Follow
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* AI Assistant Studio Card */}
      <div
        className="panel"
        style={{
          padding: '1rem',
          background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.12) 0%, rgba(168, 85, 247, 0.12) 100%)',
          borderColor: 'rgba(168, 85, 247, 0.25)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.4rem' }}>
          <Sparkles size={17} color="var(--accent-primary)" />
          <h4 style={{ fontSize: '0.92rem', fontWeight: 800 }}>AI Creative Assistant</h4>
        </div>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.45, marginBottom: '0.75rem' }}>
          Draft captivating posts, smart hashtags, or quotes with 1-click.
        </p>
        <button
          onClick={onOpenAiStudio}
          className="btn-primary"
          style={{
            fontSize: '0.8rem',
            padding: '0.45rem 0.95rem',
            boxShadow: 'none',
          }}
        >
          Open AI Studio ✨
        </button>
      </div>
    </aside>
  );
};
