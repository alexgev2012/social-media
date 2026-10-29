import React, { useState } from 'react';
import { Heart, MessageCircle, Share2, MoreHorizontal, Edit, Trash2, Send } from 'lucide-react';
import { Post, CommentItem } from '../types';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';

interface PostCardProps {
  post: Post;
  onPostUpdated: (updatedPost: Post) => void;
  onPostDeleted: (postId: number) => void;
  onSelectTag: (tag: string) => void;
  onSelectUser: (username: string) => void;
  onEditPost: (post: Post) => void;
}

export const PostCard: React.FC<PostCardProps> = ({
  post,
  onPostDeleted,
  onSelectTag,
  onSelectUser,
  onEditPost,
}) => {
  const { user, openAuthModal } = useAuth();
  const [isLiked, setIsLiked] = useState(post.is_liked);
  const [likeCount, setLikeCount] = useState(post.like_count);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [commentsCount, setCommentsCount] = useState(post.comment_count);
  const [commentInput, setCommentInput] = useState('');
  const [replyParentId, setReplyParentId] = useState<number | null>(null);
  const [replyInput, setReplyInput] = useState('');
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const isOwner = user && user.id === post.author.id;

  const handleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) {
      openAuthModal();
      return;
    }
    const nextLiked = !isLiked;
    setIsLiked(nextLiked);
    setLikeCount(prev => (nextLiked ? prev + 1 : Math.max(0, prev - 1)));

    try {
      const res = await api.posts.toggleLike(post.id);
      setIsLiked(res.is_liked);
      setLikeCount(res.like_count);
    } catch {
      setIsLiked(!nextLiked);
      setLikeCount(prev => (!nextLiked ? prev + 1 : Math.max(0, prev - 1)));
    }
  };

  const loadComments = async () => {
    setIsLoadingComments(true);
    try {
      const data = await api.comments.list(post.id);
      setComments(data);
    } catch {
      // ignore
    } finally {
      setIsLoadingComments(false);
    }
  };

  const toggleComments = () => {
    const next = !commentsOpen;
    setCommentsOpen(next);
    if (next && comments.length === 0) {
      loadComments();
    }
  };

  const handleCreateComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      openAuthModal();
      return;
    }
    if (!commentInput.trim()) return;

    try {
      const newComment = await api.comments.create(post.id, { content: commentInput.trim() });
      setComments(prev => [...prev, newComment]);
      setCommentInput('');
      setCommentsCount(prev => prev + 1);
    } catch {
      // error
    }
  };

  const handleCreateReply = async (parentId: number, e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      openAuthModal();
      return;
    }
    if (!replyInput.trim()) return;

    try {
      await api.comments.create(post.id, { content: replyInput.trim(), parent_id: parentId });
      setReplyInput('');
      setReplyParentId(null);
      setCommentsCount(prev => prev + 1);
      loadComments();
    } catch {
      // error
    }
  };

  const handleToggleCommentLike = async (commentId: number) => {
    if (!user) {
      openAuthModal();
      return;
    }
    try {
      const res = await api.comments.toggleLike(commentId);
      setComments(prev =>
        prev.map(c => {
          if (c.id === commentId) {
            return { ...c, is_liked: res.is_liked, like_count: res.like_count };
          }
          if (c.replies) {
            return {
              ...c,
              replies: c.replies.map(r =>
                r.id === commentId ? { ...r, is_liked: res.is_liked, like_count: res.like_count } : r
              ),
            };
          }
          return c;
        })
      );
    } catch {
      // error
    }
  };

  const handleDeleteComment = async (commentId: number) => {
    if (!confirm('Delete this comment?')) return;
    try {
      await api.comments.delete(commentId);
      setCommentsCount(prev => Math.max(0, prev - 1));
      loadComments();
    } catch {
      // error
    }
  };

  const handleDeletePost = async () => {
    if (!confirm('Are you sure you want to delete this post?')) return;
    try {
      await api.posts.delete(post.id);
      onPostDeleted(post.id);
    } catch {
      // error
    }
  };

  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation();
    const url = `${window.location.origin}/#post-${post.id}`;
    navigator.clipboard?.writeText(url);
    setToastMessage('Link copied!');
    setTimeout(() => setToastMessage(null), 2000);
  };

  const formatTime = (isoString: string) => {
    const diff = Date.now() - new Date(isoString).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d`;
    return new Date(isoString).toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const renderContentWithHashtags = (text: string) => {
    const parts = text.split(/(#[a-zA-Z0-9_]{2,50})/g);
    return parts.map((part, index) => {
      if (part.startsWith('#')) {
        const tag = part.slice(1);
        return (
          <span
            key={index}
            className="hashtag"
            onClick={(e) => {
              e.stopPropagation();
              onSelectTag(tag);
            }}
          >
            {part}
          </span>
        );
      }
      return part;
    });
  };

  return (
    <article className="feed-post-item" style={{ position: 'relative' }}>
      {/* Toast Alert */}
      {toastMessage && (
        <div
          style={{
            position: 'absolute',
            top: 10,
            right: 16,
            background: 'var(--accent-primary)',
            color: '#fff',
            fontSize: '0.78rem',
            fontWeight: 600,
            padding: '3px 10px',
            borderRadius: 'var(--radius-full)',
            zIndex: 10,
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          {toastMessage}
        </div>
      )}

      {/* Left Column: Author Avatar */}
      <div style={{ flexShrink: 0 }}>
        <div
          className="avatar-wrap avatar-md"
          onClick={() => onSelectUser(post.author.username)}
          style={{ cursor: 'pointer' }}
        >
          {post.author.avatar_url ? (
            <img src={post.author.avatar_url} alt="" className="avatar-img" />
          ) : (
            post.author.initials
          )}
        </div>
      </div>

      {/* Right Column: Main Post Body & Thread */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Header line: Display Name, Username, Time & Options */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '0.35rem',
          }}
        >
          <div
            onClick={() => onSelectUser(post.author.username)}
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: '0.4rem',
              cursor: 'pointer',
              overflow: 'hidden',
              whiteSpace: 'nowrap',
            }}
          >
            <span style={{ fontWeight: 700, fontSize: '0.96rem', color: 'var(--text-primary)' }}>
              {post.author.display_name}
            </span>
            <span style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>
              @{post.author.username}
            </span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>·</span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              {formatTime(post.created_at)}
            </span>
            {post.updated_at !== post.created_at && (
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                (edited)
              </span>
            )}
          </div>

          {/* Three-dots menu for post owner */}
          {isOwner && (
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="btn-ghost"
                style={{ padding: '0.3rem', color: 'var(--text-muted)' }}
              >
                <MoreHorizontal size={17} />
              </button>

              {menuOpen && (
                <div
                  className="panel"
                  style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    zIndex: 30,
                    minWidth: 130,
                    padding: '0.35rem',
                    boxShadow: 'var(--shadow-md)',
                  }}
                >
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      onEditPost(post);
                    }}
                    className="btn-ghost"
                    style={{ width: '100%', justifyContent: 'flex-start', fontSize: '0.84rem', borderRadius: 'var(--radius-sm)' }}
                  >
                    <Edit size={14} /> Edit
                  </button>
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      handleDeletePost();
                    }}
                    className="btn-ghost"
                    style={{ width: '100%', justifyContent: 'flex-start', fontSize: '0.84rem', color: '#f87171', borderRadius: 'var(--radius-sm)' }}
                  >
                    <Trash2 size={14} /> Delete
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Post Text Content */}
        {post.content && (
          <p
            style={{
              fontSize: '0.98rem',
              lineHeight: 1.52,
              whiteSpace: 'pre-line',
              wordBreak: 'break-word',
              color: 'var(--text-primary)',
              marginBottom: post.image_url || post.video_url ? '0.75rem' : '0.45rem',
            }}
          >
            {renderContentWithHashtags(post.content)}
          </p>
        )}

        {/* Media Container: Photo or Video */}
        {post.image_url && (
          <div
            style={{
              borderRadius: 'var(--radius-sm)',
              overflow: 'hidden',
              marginBottom: '0.65rem',
              maxHeight: '440px',
              border: '1px solid var(--border-color)',
              background: '#000',
            }}
          >
            <img
              src={post.image_url}
              alt="Post attachment"
              style={{ width: '100%', maxHeight: '440px', objectFit: 'cover', display: 'block' }}
            />
          </div>
        )}

        {post.video_url && (
          <div
            style={{
              borderRadius: 'var(--radius-sm)',
              overflow: 'hidden',
              marginBottom: '0.65rem',
              maxHeight: '440px',
              border: '1px solid var(--border-color)',
              background: '#000',
            }}
          >
            <video
              src={post.video_url}
              controls
              preload="metadata"
              style={{ width: '100%', maxHeight: '440px', display: 'block' }}
            />
          </div>
        )}

        {/* Action Toolbar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            maxWidth: '380px',
            marginTop: '0.2rem',
          }}
        >
          {/* Like Button */}
          <button
            onClick={handleLike}
            style={{
              color: isLiked ? 'var(--like-color)' : 'var(--text-secondary)',
              gap: '0.35rem',
              padding: '0.35rem 0.5rem',
              fontSize: '0.85rem',
              fontWeight: isLiked ? 700 : 500,
            }}
            title="Like"
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'var(--transition)',
              }}
            >
              <Heart size={18} fill={isLiked ? 'currentColor' : 'none'} />
            </div>
            <span>{likeCount}</span>
          </button>

          {/* Comment Toggle Button */}
          <button
            onClick={toggleComments}
            style={{
              color: commentsOpen ? 'var(--accent-primary)' : 'var(--text-secondary)',
              gap: '0.35rem',
              padding: '0.35rem 0.5rem',
              fontSize: '0.85rem',
              fontWeight: commentsOpen ? 700 : 500,
            }}
            title="Comments"
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'var(--transition)',
              }}
            >
              <MessageCircle size={18} fill={commentsOpen ? 'currentColor' : 'none'} />
            </div>
            <span>{commentsCount}</span>
          </button>

          {/* Share Button */}
          <button
            onClick={handleShare}
            style={{
              color: 'var(--text-secondary)',
              padding: '0.35rem 0.5rem',
            }}
            title="Share"
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Share2 size={17} />
            </div>
          </button>
        </div>

        {/* Collapsible Comments Section */}
        {commentsOpen && (
          <div
            style={{
              marginTop: '0.85rem',
              paddingTop: '0.85rem',
              borderTop: '1px solid var(--border-color)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.85rem',
            }}
          >
            {/* New Comment Input */}
            <form onSubmit={handleCreateComment} style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                type="text"
                placeholder={user ? 'Post your reply...' : 'Log in to reply...'}
                value={commentInput}
                onChange={(e) => setCommentInput(e.target.value)}
                onClick={() => {
                  if (!user) openAuthModal();
                }}
                style={{
                  flex: 1,
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-full)',
                  padding: '0.5rem 1rem',
                  color: 'var(--text-primary)',
                  outline: 'none',
                  fontSize: '0.88rem',
                }}
              />
              <button
                type="submit"
                disabled={!commentInput.trim()}
                className="btn-primary"
                style={{
                  padding: '0.45rem 1rem',
                  fontSize: '0.82rem',
                  opacity: !commentInput.trim() ? 0.45 : 1,
                }}
              >
                <Send size={13} />
              </button>
            </form>

            {/* Comments List */}
            {isLoadingComments ? (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem', padding: '0.5rem' }}>
                Loading conversation...
              </div>
            ) : comments.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.84rem', padding: '0.5rem' }}>
                No replies yet. Start the thread!
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {comments.map((c) => (
                  <div key={c.id} style={{ display: 'flex', gap: '0.65rem' }}>
                    <div
                      className="avatar-wrap avatar-sm"
                      onClick={() => onSelectUser(c.author.username)}
                      style={{ cursor: 'pointer' }}
                    >
                      {c.author.avatar_url ? (
                        <img src={c.author.avatar_url} alt="" className="avatar-img" />
                      ) : (
                        c.author.initials
                      )}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          background: 'var(--bg-surface)',
                          border: '1px solid var(--border-color)',
                          padding: '0.6rem 0.85rem',
                          borderRadius: 'var(--radius-sm)',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span
                            onClick={() => onSelectUser(c.author.username)}
                            style={{ fontWeight: 700, fontSize: '0.86rem', cursor: 'pointer' }}
                          >
                            {c.author.display_name}
                          </span>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            {formatTime(c.created_at)}
                          </span>
                        </div>
                        <p style={{ fontSize: '0.9rem', marginTop: '0.2rem', color: 'var(--text-primary)', wordBreak: 'break-word' }}>
                          {c.content}
                        </p>
                      </div>

                      {/* Comment Bar: Like, Reply, Delete */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', padding: '0.2rem 0.4rem' }}>
                        <button
                          onClick={() => handleToggleCommentLike(c.id)}
                          style={{
                            fontSize: '0.75rem',
                            color: c.is_liked ? 'var(--like-color)' : 'var(--text-muted)',
                            fontWeight: 600,
                            gap: '0.25rem',
                          }}
                        >
                          <Heart size={12} fill={c.is_liked ? 'currentColor' : 'none'} />
                          {c.like_count > 0 && <span>{c.like_count}</span>}
                        </button>
                        <button
                          onClick={() => setReplyParentId(replyParentId === c.id ? null : c.id)}
                          style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}
                        >
                          Reply
                        </button>
                        {user && (user.id === c.author.id || isOwner) && (
                          <button
                            onClick={() => handleDeleteComment(c.id)}
                            style={{ fontSize: '0.75rem', color: '#f87171' }}
                          >
                            Delete
                          </button>
                        )}
                      </div>

                      {/* Reply Composer */}
                      {replyParentId === c.id && (
                        <form
                          onSubmit={(e) => handleCreateReply(c.id, e)}
                          style={{ display: 'flex', gap: '0.4rem', marginTop: '0.4rem' }}
                        >
                          <input
                            type="text"
                            placeholder={`Reply to @${c.author.username}...`}
                            value={replyInput}
                            onChange={(e) => setReplyInput(e.target.value)}
                            autoFocus
                            style={{
                              flex: 1,
                              background: 'var(--bg-input)',
                              border: '1px solid var(--border-color)',
                              borderRadius: 'var(--radius-full)',
                              padding: '0.4rem 0.85rem',
                              color: 'var(--text-primary)',
                              fontSize: '0.82rem',
                              outline: 'none',
                            }}
                          />
                          <button type="submit" className="btn-primary" style={{ padding: '0.4rem 0.85rem', fontSize: '0.8rem' }}>
                            Send
                          </button>
                        </form>
                      )}

                      {/* Nested Replies */}
                      {c.replies && c.replies.length > 0 && (
                        <div
                          style={{
                            marginTop: '0.5rem',
                            paddingLeft: '0.75rem',
                            borderLeft: '2px solid var(--border-color)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.5rem',
                          }}
                        >
                          {c.replies.map((r) => (
                            <div key={r.id} style={{ display: 'flex', gap: '0.5rem' }}>
                              <div
                                className="avatar-wrap avatar-xs"
                                onClick={() => onSelectUser(r.author.username)}
                                style={{ cursor: 'pointer' }}
                              >
                                {r.author.avatar_url ? (
                                  <img src={r.author.avatar_url} alt="" className="avatar-img" />
                                ) : (
                                  r.author.initials
                                )}
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div
                                  style={{
                                    background: 'var(--bg-surface)',
                                    border: '1px solid var(--border-color)',
                                    padding: '0.45rem 0.75rem',
                                    borderRadius: 'var(--radius-sm)',
                                  }}
                                >
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontWeight: 700, fontSize: '0.82rem' }}>
                                      {r.author.display_name}
                                    </span>
                                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                      {formatTime(r.created_at)}
                                    </span>
                                  </div>
                                  <p style={{ fontSize: '0.85rem', marginTop: '0.15rem', color: 'var(--text-primary)', wordBreak: 'break-word' }}>
                                    {r.content}
                                  </p>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.15rem 0.35rem' }}>
                                  <button
                                    onClick={() => handleToggleCommentLike(r.id)}
                                    style={{
                                      fontSize: '0.72rem',
                                      color: r.is_liked ? 'var(--like-color)' : 'var(--text-muted)',
                                      fontWeight: 600,
                                      gap: '0.2rem',
                                    }}
                                  >
                                    <Heart size={11} fill={r.is_liked ? 'currentColor' : 'none'} />
                                    {r.like_count > 0 && <span>{r.like_count}</span>}
                                  </button>
                                  {user && (user.id === r.author.id || isOwner) && (
                                    <button
                                      onClick={() => handleDeleteComment(r.id)}
                                      style={{ fontSize: '0.7rem', color: '#f87171' }}
                                    >
                                      Delete
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </article>
  );
};
