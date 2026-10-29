import React, { useState, useEffect, useRef } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SidebarLeft } from './components/SidebarLeft';
import { SidebarRight } from './components/SidebarRight';
import { StoriesBar } from './components/StoriesBar';
import { StoryViewerModal } from './components/StoryViewerModal';
import { CreateStoryModal } from './components/CreateStoryModal';
import { PostComposer } from './components/PostComposer';
import { PostCard } from './components/PostCard';
import { AiStudioModal } from './components/AiStudioModal';
import { EditPostModal } from './components/EditPostModal';
import { EditProfileModal } from './components/EditProfileModal';
import { AuthModal } from './components/AuthModal';
import { ChatView } from './components/ChatView';
import { NotificationsView } from './components/NotificationsView';
import { ProfileView } from './components/ProfileView';
import { Post, StoryGroup } from './types';
import { api } from './services/api';
import { X, Filter } from 'lucide-react';

const MainApp: React.FC = () => {
  const { user } = useAuth();
  const [currentTab, setCurrentTab] = useState('feed');
  const [feedType, setFeedType] = useState<'global' | 'following'>('global');
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [selectedProfileUsername, setSelectedProfileUsername] = useState<string | null>(null);
  const [profileRefreshKey, setProfileRefreshKey] = useState(0);
  const [chatPartnerUsername, setChatPartnerUsername] = useState<string | null>(null);

  // Posts & Stories State
  const [posts, setPosts] = useState<Post[]>([]);
  const [storyGroups, setStoryGroups] = useState<StoryGroup[]>([]);
  const [isLoadingPosts, setIsLoadingPosts] = useState(true);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [storiesError, setStoriesError] = useState<string | null>(null);
  const postsRequestId = useRef(0);
  const storiesRequestId = useRef(0);

  // Modals
  const [isStoryViewerOpen, setIsStoryViewerOpen] = useState(false);
  const [initialStoryGroupIdx, setInitialStoryGroupIdx] = useState(0);
  const [isCreateStoryOpen, setIsCreateStoryOpen] = useState(false);
  const [isAiStudioOpen, setIsAiStudioOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);

  // AI draft to insert into composer
  const [aiDraftContent, setAiDraftContent] = useState<string | undefined>(undefined);

  // Theme
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    if (!isDark) {
      document.body.classList.add('light-theme');
    } else {
      document.body.classList.remove('light-theme');
    }
  }, [isDark]);

  const toggleTheme = () => setIsDark(!isDark);

  const loadStories = async () => {
    const requestId = ++storiesRequestId.current;
    setStoriesError(null);
    try {
      const data = await api.stories.list();
      if (requestId === storiesRequestId.current) setStoryGroups(data);
    } catch (error) {
      if (requestId === storiesRequestId.current) {
        setStoriesError(error instanceof Error ? error.message : 'Could not load stories.');
      }
    }
  };

  const loadPosts = async () => {
    const requestId = ++postsRequestId.current;
    setIsLoadingPosts(true);
    setFeedError(null);
    try {
      const data = await api.posts.list({
        feed: feedType,
        tag: activeTag || undefined,
      });
      if (requestId === postsRequestId.current) setPosts(data);
    } catch (error) {
      if (requestId === postsRequestId.current) {
        setFeedError(error instanceof Error ? error.message : 'Could not load the feed.');
      }
    } finally {
      if (requestId === postsRequestId.current) setIsLoadingPosts(false);
    }
  };

  useEffect(() => {
    loadStories();
  }, [user]);

  useEffect(() => {
    if (currentTab === 'feed') {
      loadPosts();
    }
  }, [currentTab, feedType, activeTag]);

  const handleOpenStory = (groupIndex: number) => {
    setInitialStoryGroupIdx(groupIndex);
    setIsStoryViewerOpen(true);
  };

  const handleSelectTag = (tag: string) => {
    setActiveTag(tag);
    setCurrentTab('feed');
  };

  const handleSelectUser = (username: string) => {
    setSelectedProfileUsername(username);
    setCurrentTab('profile');
  };

  const handleOpenChat = (username: string) => {
    setChatPartnerUsername(username);
    setCurrentTab('messages');
  };

  return (
    <div className="app-container">
      {/* Left Sidebar */}
      <SidebarLeft
        currentTab={currentTab}
        setCurrentTab={(tab) => {
          if (tab === 'feed') {
            setActiveTag(null);
          }
          if (tab === 'profile' && user) {
            setSelectedProfileUsername(user.username);
          }
          setCurrentTab(tab);
        }}
        openComposer={() => {
          setCurrentTab('feed');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        openAiStudio={() => setIsAiStudioOpen(true)}
        openProfile={(uname) => {
          setSelectedProfileUsername(uname);
          setCurrentTab('profile');
        }}
        isDark={isDark}
        toggleTheme={toggleTheme}
      />

      {/* Main Column */}
      <main
        className="main-content-col"
        style={{
          maxWidth: currentTab === 'messages' ? '980px' : undefined,
        }}
      >
        {currentTab === 'feed' && (
          <>
            {/* Header Tabs (50% / 50% split) */}
            <div
              className="feed-tab-bar"
              style={{
                position: 'sticky',
                top: 0,
                zIndex: 30,
                background: 'rgba(11, 15, 23, 0.85)',
                backdropFilter: 'blur(16px)',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                height: '52px',
              }}
            >
              <button
                onClick={() => {
                  setFeedType('global');
                  setActiveTag(null);
                }}
                style={{
                  flex: 1,
                  height: '100%',
                  fontWeight: feedType === 'global' && !activeTag ? 700 : 500,
                  fontSize: '0.96rem',
                  color: feedType === 'global' && !activeTag ? 'var(--text-primary)' : 'var(--text-secondary)',
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                className="btn-ghost:hover"
              >
                <span>For You</span>
                {feedType === 'global' && !activeTag && (
                  <div
                    style={{
                      position: 'absolute',
                      bottom: 0,
                      width: '56px',
                      height: '3.5px',
                      borderRadius: '999px',
                      background: 'var(--accent-primary)',
                    }}
                  />
                )}
              </button>

              <button
                onClick={() => {
                  setFeedType('following');
                  setActiveTag(null);
                }}
                style={{
                  flex: 1,
                  height: '100%',
                  fontWeight: feedType === 'following' && !activeTag ? 700 : 500,
                  fontSize: '0.96rem',
                  color: feedType === 'following' && !activeTag ? 'var(--text-primary)' : 'var(--text-secondary)',
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                className="btn-ghost:hover"
              >
                <span>Following</span>
                {feedType === 'following' && !activeTag && (
                  <div
                    style={{
                      position: 'absolute',
                      bottom: 0,
                      width: '64px',
                      height: '3.5px',
                      borderRadius: '999px',
                      background: 'var(--accent-primary)',
                    }}
                  />
                )}
              </button>
            </div>

            {/* Stories Bar */}
            <StoriesBar
              storyGroups={storyGroups}
              onOpenStory={handleOpenStory}
              onOpenCreateStory={() => setIsCreateStoryOpen(true)}
            />
            {storiesError && (
              <div role="alert" style={{ padding: '0.7rem 1.25rem', color: '#f87171', fontSize: '0.85rem' }}>
                Stories couldn’t load. {storiesError}{' '}
                <button className="btn-ghost" onClick={loadStories} style={{ color: 'var(--text-primary)' }}>Retry</button>
              </div>
            )}

            {/* Active Tag Filter Banner */}
            {activeTag && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.65rem 1.25rem',
                  background: 'rgba(99, 102, 241, 0.08)',
                  borderBottom: '1px solid var(--border-color)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Filter size={15} color="var(--accent-primary)" />
                  <span style={{ fontSize: '0.88rem', fontWeight: 600 }}>Posts tagged with</span>
                  <span className="hashtag" style={{ fontSize: '0.92rem' }}>#{activeTag}</span>
                </div>
                <button onClick={() => setActiveTag(null)} className="btn-ghost" style={{ padding: '0.2rem' }}>
                  <X size={15} />
                </button>
              </div>
            )}

            {/* Post Composer */}
            <PostComposer
              onPostCreated={(newPost) => setPosts((prev) => [newPost, ...prev])}
              openAiStudio={() => setIsAiStudioOpen(true)}
              defaultContent={aiDraftContent}
              onClearDefaultContent={() => setAiDraftContent(undefined)}
            />

            {/* Posts Stream */}
            <div>
              {isLoadingPosts ? (
                <div style={{ textAlign: 'center', padding: '3.5rem', color: 'var(--text-muted)' }}>
                  Loading feed...
                </div>
              ) : feedError ? (
                <div role="alert" style={{ textAlign: 'center', padding: '3.5rem 1.5rem', color: '#f87171' }}>
                  <p>Could not load the feed. {feedError}</p>
                  <button className="btn-secondary" onClick={loadPosts} style={{ marginTop: '0.8rem' }}>Retry</button>
                </div>
              ) : posts.length > 0 ? (
                posts.map((post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    onPostUpdated={(up) => setPosts((prev) => prev.map((p) => (p.id === up.id ? up : p)))}
                    onPostDeleted={(pid) => setPosts((prev) => prev.filter((p) => p.id !== pid))}
                    onSelectTag={handleSelectTag}
                    onSelectUser={handleSelectUser}
                    onEditPost={(p) => setEditingPost(p)}
                  />
                ))
              ) : (
                <div style={{ textAlign: 'center', padding: '4rem 1.5rem', color: 'var(--text-muted)' }}>
                  <p style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>No posts yet in this feed</p>
                  <p style={{ fontSize: '0.85rem', marginTop: '0.35rem' }}>
                    Follow some people or share your first post!
                  </p>
                </div>
              )}
            </div>
          </>
        )}

        {currentTab === 'explore' && (
          <div style={{ padding: '1.25rem' }}>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 800, marginBottom: '1rem' }}>Explore</h2>
            <SidebarRight
              onSelectTag={handleSelectTag}
              onSelectUser={handleSelectUser}
              onOpenAiStudio={() => setIsAiStudioOpen(true)}
              embedded
            />
          </div>
        )}

        {currentTab === 'notifications' && (
          <NotificationsView
            onSelectUser={handleSelectUser}
            onSelectPost={() => {
              setCurrentTab('feed');
            }}
          />
        )}

        {currentTab === 'messages' && (
          <ChatView
            initialPartnerUsername={chatPartnerUsername}
            onSelectUser={handleSelectUser}
          />
        )}

        {currentTab === 'profile' && selectedProfileUsername && (
          <ProfileView
            username={selectedProfileUsername}
            refreshKey={profileRefreshKey}
            onBack={() => setCurrentTab('feed')}
            onSelectTag={handleSelectTag}
            onSelectUser={handleSelectUser}
            onOpenEditProfile={() => setIsEditProfileOpen(true)}
            onOpenChat={handleOpenChat}
            onEditPost={(p) => setEditingPost(p)}
          />
        )}
      </main>

      {/* Right Sidebar */}
      {currentTab !== 'messages' && currentTab !== 'explore' && (
        <SidebarRight
          onSelectTag={handleSelectTag}
          onSelectUser={handleSelectUser}
          onOpenAiStudio={() => setIsAiStudioOpen(true)}
        />
      )}

      {/* Modals */}
      {isStoryViewerOpen && (
        <StoryViewerModal
          storyGroups={storyGroups}
          initialGroupIndex={initialStoryGroupIdx}
          onClose={() => setIsStoryViewerOpen(false)}
          onStoryDeleted={() => loadStories()}
        />
      )}

      {isCreateStoryOpen && (
        <CreateStoryModal
          onClose={() => setIsCreateStoryOpen(false)}
          onStoryCreated={() => loadStories()}
        />
      )}

      {isAiStudioOpen && (
        <AiStudioModal
          onClose={() => setIsAiStudioOpen(false)}
          onUseContent={(draft) => {
            setAiDraftContent(draft);
            setCurrentTab('feed');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        />
      )}

      {editingPost && (
        <EditPostModal
          post={editingPost}
          onClose={() => setEditingPost(null)}
          onPostUpdated={(up) => {
            setPosts((prev) => prev.map((p) => (p.id === up.id ? up : p)));
          }}
        />
      )}

      {isEditProfileOpen && (
        <EditProfileModal
          onClose={() => setIsEditProfileOpen(false)}
          onProfileUpdated={() => {
            setProfileRefreshKey((key) => key + 1);
          }}
        />
      )}

      <AuthModal />
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
