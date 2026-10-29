import React, { useState, useRef } from 'react';
import { Image, Sparkles, X, Send } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { Post } from '../types';

interface PostComposerProps {
  onPostCreated: (post: Post) => void;
  openAiStudio: () => void;
  defaultContent?: string;
  onClearDefaultContent?: () => void;
}

export const PostComposer: React.FC<PostComposerProps> = ({
  onPostCreated,
  openAiStudio,
  defaultContent,
  onClearDefaultContent,
}) => {
  const { user, openAuthModal } = useAuth();
  const [content, setContent] = useState(defaultContent || '');
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video' | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    if (defaultContent) {
      setContent(defaultContent);
      if (onClearDefaultContent) onClearDefaultContent();
    }
  }, [defaultContent]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type.startsWith('image/')) {
      setMediaType('image');
    } else if (file.type.startsWith('video/')) {
      setMediaType('video');
    } else {
      setError('Please choose an image or video file.');
      return;
    }

    setMediaFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setError(null);
  };

  const removeMedia = () => {
    setMediaFile(null);
    setPreviewUrl(null);
    setMediaType(null);
  };

  const insertTag = (tag: string) => {
    setContent(prev => (prev.endsWith(' ') || prev === '' ? `${prev}#${tag} ` : `${prev} #${tag} `));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      openAuthModal();
      return;
    }

    if (!content.trim() && !mediaFile) {
      setError('Say something or attach media.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const formData = new FormData();
      if (content.trim()) {
        formData.append('content', content.trim());
      }
      if (mediaFile && mediaType === 'image') {
        formData.append('image', mediaFile);
      } else if (mediaFile && mediaType === 'video') {
        formData.append('video', mediaFile);
      }

      const newPost = await api.posts.create(formData);
      setContent('');
      removeMedia();
      onPostCreated(newPost);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to publish post');
    } finally {
      setIsSubmitting(false);
    }
  };

  const tagChips = ['tech', 'design', 'coding', 'coffee', 'motivation'];

  return (
    <div
      className="post-composer"
      style={{
        padding: '1.1rem 1.25rem',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        gap: '0.85rem',
      }}
    >
      {/* Left Column: Author Avatar */}
      <div style={{ flexShrink: 0 }}>
        <div className="avatar-wrap avatar-md">
          {user?.avatar_url ? (
            <img src={user.avatar_url} alt="" className="avatar-img" />
          ) : user ? (
            user.initials
          ) : (
            '?'
          )}
        </div>
      </div>

      {/* Right Column: Input & Actions */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <form onSubmit={handleSubmit}>
          <textarea
            placeholder={user ? "What's happening? #hashtags or thoughts..." : "Sign in to post..."}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onClick={() => {
              if (!user) openAuthModal();
            }}
            rows={content.length > 80 ? 4 : 2}
            maxLength={1000}
            style={{
              width: '100%',
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--text-primary)',
              fontSize: '1.05rem',
              lineHeight: 1.5,
              resize: 'none',
            }}
          />

          {/* Attached Media Preview */}
          {previewUrl && (
            <div
              style={{
                position: 'relative',
                marginTop: '0.5rem',
                borderRadius: 'var(--radius-sm)',
                overflow: 'hidden',
                maxHeight: '280px',
                border: '1px solid var(--border-color)',
                background: '#000',
              }}
            >
              {mediaType === 'image' ? (
                <img
                  src={previewUrl}
                  alt="Attachment"
                  style={{ width: '100%', maxHeight: '280px', objectFit: 'cover', display: 'block' }}
                />
              ) : (
                <video
                  src={previewUrl}
                  controls
                  style={{ width: '100%', maxHeight: '280px', display: 'block' }}
                />
              )}
              <button
                type="button"
                onClick={removeMedia}
                style={{
                  position: 'absolute',
                  top: 8,
                  right: 8,
                  background: 'rgba(0, 0, 0, 0.75)',
                  color: '#ffffff',
                  borderRadius: '50%',
                  padding: '0.35rem',
                }}
              >
                <X size={16} />
              </button>
            </div>
          )}

          {/* Quick Tag Pills */}
          <div
            style={{
              display: 'flex',
              gap: '0.4rem',
              flexWrap: 'wrap',
              marginTop: '0.4rem',
            }}
          >
            {tagChips.map(tag => (
              <span
                key={tag}
                onClick={() => insertTag(tag)}
                style={{
                  fontSize: '0.75rem',
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-secondary)',
                  padding: '2px 8px',
                  borderRadius: 'var(--radius-full)',
                  cursor: 'pointer',
                  userSelect: 'none',
                  transition: 'var(--transition)',
                }}
                className="btn-ghost:hover"
              >
                #{tag}
              </span>
            ))}
          </div>

          {error && (
            <div style={{ color: '#f87171', fontSize: '0.82rem', marginTop: '0.5rem' }}>
              {error}
            </div>
          )}

          {/* Bottom Action Bar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: '0.75rem',
              paddingTop: '0.65rem',
              borderTop: '1px solid var(--border-subtle)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="btn-ghost"
                title="Attach Media"
                style={{ color: 'var(--accent-primary)', padding: '0.4rem' }}
              >
                <Image size={19} />
              </button>

              <button
                type="button"
                onClick={openAiStudio}
                className="btn-ghost"
                title="Write with AI"
                style={{
                  color: '#a855f7',
                  padding: '0.4rem 0.65rem',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  gap: '0.35rem',
                }}
              >
                <Sparkles size={16} />
                <span>AI Assist</span>
              </button>

              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*,video/*"
                style={{ display: 'none' }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                {1000 - content.length}
              </span>

              <button
                type="submit"
                disabled={isSubmitting || (!content.trim() && !mediaFile)}
                className="btn-primary"
                style={{
                  padding: '0.5rem 1.25rem',
                  fontSize: '0.88rem',
                  opacity: isSubmitting || (!content.trim() && !mediaFile) ? 0.45 : 1,
                }}
              >
                <Send size={14} />
                <span>{isSubmitting ? 'Posting...' : 'Post'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
