import React, { useState } from 'react';
import { X, Save } from 'lucide-react';
import { Post } from '../types';
import { api } from '../services/api';

interface EditPostModalProps {
  post: Post;
  onClose: () => void;
  onPostUpdated: (updatedPost: Post) => void;
}

export const EditPostModal: React.FC<EditPostModalProps> = ({
  post,
  onClose,
  onPostUpdated,
}) => {
  const [content, setContent] = useState(post.content);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() && !post.image_url && !post.video_url) {
      setError('Post cannot be empty.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const updated = await api.posts.edit(post.id, content.trim());
      onPostUpdated(updated);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update post');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--border-color)',
          }}
        >
          <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>Edit Post</h3>
          <button onClick={onClose} className="btn-ghost">
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {error && (
            <div style={{ color: '#f87171', fontSize: '0.85rem' }}>
              {error}
            </div>
          )}

          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={5}
            maxLength={1000}
            style={{
              width: '100%',
              background: 'var(--bg-input)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              padding: '0.85rem',
              color: 'var(--text-primary)',
              fontSize: '1rem',
              outline: 'none',
              resize: 'vertical',
            }}
          />

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={isSubmitting} className="btn-primary">
              <Save size={16} />
              <span>{isSubmitting ? 'Saving...' : 'Save Changes'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
