import React, { useState, useEffect } from 'react';
import { Edit, UserPlus, UserCheck, MessageSquare, ArrowLeft } from 'lucide-react';
import { User, Post } from '../types';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { PostCard } from './PostCard';

interface ProfileViewProps {
  username: string;
  onBack: () => void;
  onSelectTag: (tag: string) => void;
  onSelectUser: (username: string) => void;
  onOpenEditProfile: () => void;
  onOpenChat: (username: string) => void;
  onEditPost: (post: Post) => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  username,
  onBack,
  onSelectTag,
  onSelectUser,
  onOpenEditProfile,
  onOpenChat,
  onEditPost,
}) => {
  const { user, openAuthModal } = useAuth();
  const [profileUser, setProfileUser] = useState<User | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [activeTab, setActiveTab] = useState<'posts' | 'media'>('posts');
  const [isLoading, setIsLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);

  const loadProfile = async () => {
    setIsLoading(true);
    try {
      const [u, p] = await Promise.all([
        api.users.getProfile(username),
        api.posts.list({ author: username }),
      ]);
      setProfileUser(u);
      setPosts(p);
      setIsFollowing(!!u.is_following);
      setFollowersCount(u.followers_count || 0);
    } catch {
      // error
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, [username]);

  const handleToggleFollow = async () => {
    if (!user) {
      openAuthModal();
      return;
    }
    try {
      const res = await api.users.toggleFollow(username);
      setIsFollowing(res.is_following);
      setFollowersCount(res.followers_count);
    } catch {
      // error
    }
  };

  const isOwnProfile = user && user.username === username;

  const filteredPosts = posts.filter(p => {
    if (activeTab === 'media') {
      return !!p.image_url || !!p.video_url;
    }
    return true;
  });

  return (
    <div>
      {/* Top Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          padding: '0.65rem 1.25rem',
          borderBottom: '1px solid var(--border-color)',
          background: 'rgba(11, 15, 23, 0.85)',
          backdropFilter: 'blur(16px)',
          position: 'sticky',
          top: 0,
          zIndex: 30,
        }}
      >
        <button onClick={onBack} className="btn-ghost" style={{ padding: '0.4rem' }}>
          <ArrowLeft size={19} />
        </button>
        <div>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 800, lineHeight: 1.2 }}>
            {profileUser?.display_name || username}
          </h2>
          <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
            {posts.length} posts
          </span>
        </div>
      </div>

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '3.5rem', color: 'var(--text-muted)' }}>
          Loading profile...
        </div>
      ) : profileUser ? (
        <>
          {/* Header Cover Banner */}
          <div
            style={{
              height: '170px',
              background: 'linear-gradient(135deg, #4338ca 0%, #7c3aed 50%, #db2777 100%)',
              position: 'relative',
            }}
          />

          {/* Profile Header Details */}
          <div style={{ padding: '0 1.25rem 1.25rem', position: 'relative' }}>
            {/* Avatar & Action Button Row */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-end',
                marginTop: '-48px',
                marginBottom: '0.85rem',
              }}
            >
              <div
                className="avatar-wrap avatar-xl"
                style={{
                  border: '4px solid var(--bg-main)',
                  boxShadow: 'var(--shadow-md)',
                }}
              >
                {profileUser.avatar_url ? (
                  <img src={profileUser.avatar_url} alt="" className="avatar-img" />
                ) : (
                  profileUser.initials
                )}
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {isOwnProfile ? (
                  <button onClick={onOpenEditProfile} className="btn-secondary" style={{ fontSize: '0.85rem' }}>
                    <Edit size={14} /> Edit Profile
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => onOpenChat(username)}
                      className="btn-secondary"
                      style={{ fontSize: '0.85rem' }}
                    >
                      <MessageSquare size={14} /> Message
                    </button>
                    <button
                      onClick={handleToggleFollow}
                      style={{
                        padding: '0.5rem 1.25rem',
                        fontSize: '0.85rem',
                        borderRadius: 'var(--radius-full)',
                        background: isFollowing ? 'transparent' : 'var(--text-primary)',
                        border: isFollowing ? '1px solid var(--border-color)' : 'none',
                        color: isFollowing ? 'var(--text-secondary)' : 'var(--bg-main)',
                        fontWeight: 700,
                      }}
                    >
                      {isFollowing ? (
                        <>
                          <UserCheck size={14} /> Following
                        </>
                      ) : (
                        <>
                          <UserPlus size={14} /> Follow
                        </>
                      )}
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Name & Handle */}
            <h1 style={{ fontSize: '1.35rem', fontWeight: 800 }}>{profileUser.display_name}</h1>
            <div style={{ fontSize: '0.86rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
              @{profileUser.username}
            </div>

            {/* Bio */}
            {profileUser.bio && (
              <p style={{ fontSize: '0.94rem', lineHeight: 1.5, marginBottom: '0.85rem', color: 'var(--text-primary)' }}>
                {profileUser.bio}
              </p>
            )}

            {/* Stats */}
            <div style={{ display: 'flex', gap: '1.25rem', fontSize: '0.88rem' }}>
              <div>
                <strong style={{ color: 'var(--text-primary)' }}>{profileUser.following_count || 0}</strong>{' '}
                <span style={{ color: 'var(--text-muted)' }}>Following</span>
              </div>
              <div>
                <strong style={{ color: 'var(--text-primary)' }}>{followersCount}</strong>{' '}
                <span style={{ color: 'var(--text-muted)' }}>Followers</span>
              </div>
            </div>
          </div>

          {/* Full-width Tabs (50% / 50%) */}
          <div
            style={{
              display: 'flex',
              borderBottom: '1px solid var(--border-color)',
              height: '48px',
            }}
          >
            {(['posts', 'media'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setActiveTab(t)}
                style={{
                  flex: 1,
                  height: '100%',
                  fontWeight: activeTab === t ? 700 : 500,
                  fontSize: '0.94rem',
                  textTransform: 'capitalize',
                  color: activeTab === t ? 'var(--text-primary)' : 'var(--text-secondary)',
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                className="btn-ghost:hover"
              >
                <span>{t}</span>
                {activeTab === t && (
                  <div
                    style={{
                      position: 'absolute',
                      bottom: 0,
                      width: '48px',
                      height: '3.5px',
                      borderRadius: '999px',
                      background: 'var(--accent-primary)',
                    }}
                  />
                )}
              </button>
            ))}
          </div>

          {/* Posts Feed for this profile */}
          <div>
            {filteredPosts.length > 0 ? (
              filteredPosts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  onPostUpdated={(up) => setPosts(prev => prev.map(p => (p.id === up.id ? up : p)))}
                  onPostDeleted={(pid) => setPosts(prev => prev.filter(p => p.id !== pid))}
                  onSelectTag={onSelectTag}
                  onSelectUser={onSelectUser}
                  onEditPost={onEditPost}
                />
              ))
            ) : (
              <div style={{ textAlign: 'center', padding: '3.5rem 1rem', color: 'var(--text-muted)' }}>
                No posts found here yet.
              </div>
            )}
          </div>
        </>
      ) : (
        <div style={{ textAlign: 'center', padding: '3.5rem', color: '#f87171' }}>
          User not found.
        </div>
      )}
    </div>
  );
};
