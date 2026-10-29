import React, { useState, useRef } from 'react';
import { X, Image, Video, Sparkles } from 'lucide-react';
import { api } from '../services/api';

interface CreateStoryModalProps {
  onClose: () => void;
  onStoryCreated: () => void;
}

export const CreateStoryModal: React.FC<CreateStoryModalProps> = ({
  onClose,
  onStoryCreated,
}) => {
  const [caption, setCaption] = useState('');
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video' | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type.startsWith('image/')) {
      setMediaType('image');
    } else if (file.type.startsWith('video/')) {
      setMediaType('video');
    } else {
      setError('Please upload an image or video file.');
      return;
    }

    setMediaFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mediaFile) {
      setError('Please attach an image or video for your story.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const formData = new FormData();
      if (mediaType === 'image') {
        formData.append('image', mediaFile);
      } else if (mediaType === 'video') {
        formData.append('video', mediaFile);
      }
      if (caption.trim()) {
        formData.append('caption', caption.trim());
      }

      await api.stories.create(formData);
      onStoryCreated();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to publish story');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Sparkles size={20} color="var(--accent-primary)" />
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>Add to Story</h3>
          </div>
          <button onClick={onClose} className="btn-ghost">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {error && (
            <div
              style={{
                background: 'rgba(239, 68, 68, 0.15)',
                color: '#f87171',
                padding: '0.75rem',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.85rem',
              }}
            >
              {error}
            </div>
          )}

          {/* Media Preview Box */}
          <div
            onClick={() => fileInputRef.current?.click()}
            style={{
              height: 280,
              borderRadius: 'var(--radius-md)',
              border: previewUrl ? 'none' : '2px dashed var(--border-color)',
              background: 'var(--bg-input)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            {previewUrl ? (
              mediaType === 'image' ? (
                <img src={previewUrl} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <video src={previewUrl} controls style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              )
            ) : (
              <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-muted)' }}>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                  <Image size={32} color="var(--accent-primary)" />
                  <Video size={32} color="#a855f7" />
                </div>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                  Choose Photo or Video
                </div>
                <div style={{ fontSize: '0.8rem' }}>Stories last for 24 hours</div>
              </div>
            )}
          </div>

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/*,video/*"
            style={{ display: 'none' }}
          />

          {/* Caption Input */}
          <input
            type="text"
            placeholder="Add an optional caption..."
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            maxLength={280}
            style={{
              background: 'var(--bg-input)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-sm)',
              padding: '0.75rem 1rem',
              color: 'var(--text-primary)',
              outline: 'none',
              fontSize: '0.95rem',
            }}
          />

          {/* Submit button */}
          <button
            type="submit"
            disabled={isSubmitting || !mediaFile}
            className="btn-primary"
            style={{
              width: '100%',
              padding: '0.85rem',
              opacity: isSubmitting || !mediaFile ? 0.6 : 1,
            }}
          >
            {isSubmitting ? 'Sharing story...' : 'Share Story'}
          </button>
        </form>
      </div>
    </div>
  );
};
