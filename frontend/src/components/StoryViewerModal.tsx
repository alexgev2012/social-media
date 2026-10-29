import React, { useState, useEffect, useRef } from 'react';
import { X, ChevronLeft, ChevronRight, Heart, Trash2 } from 'lucide-react';
import { StoryGroup } from '../types';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Avatar } from './Avatar';
import { MediaImage, MediaVideo } from './MediaAsset';

interface StoryViewerModalProps {
  storyGroups: StoryGroup[];
  initialGroupIndex: number;
  onClose: () => void;
  onStoryDeleted?: () => void;
}

export const StoryViewerModal: React.FC<StoryViewerModalProps> = ({
  storyGroups,
  initialGroupIndex,
  onClose,
  onStoryDeleted,
}) => {
  const { user } = useAuth();
  const [groupIndex, setGroupIndex] = useState(initialGroupIndex);
  const [storyIndex, setStoryIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [actionError, setActionError] = useState<string | null>(null);

  const currentGroup = storyGroups[groupIndex];
  const currentStory = currentGroup?.stories[storyIndex];

  // Sync like state
  useEffect(() => {
    if (currentStory) {
      setIsLiked(currentStory.is_liked);
      setLikeCount(currentStory.like_count);
      setProgress(0);
    }
  }, [groupIndex, storyIndex, currentStory]);

  const progressTimerRef = useRef<number | null>(null);

  // Auto advance progress bar
  useEffect(() => {
    if (isPaused || !currentStory) return;

    const interval = 50; // ms
    const duration = 5000; // 5 seconds
    const step = (interval / duration) * 100;

    progressTimerRef.current = window.setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          handleNext();
          return 0;
        }
        return prev + step;
      });
    }, interval);

    return () => {
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    };
  }, [groupIndex, storyIndex, isPaused, currentStory]);

  const handleNext = () => {
    if (!currentGroup) return;
    if (storyIndex < currentGroup.stories.length - 1) {
      setStoryIndex(prev => prev + 1);
      setProgress(0);
    } else if (groupIndex < storyGroups.length - 1) {
      setGroupIndex(prev => prev + 1);
      setStoryIndex(0);
      setProgress(0);
    } else {
      onClose();
    }
  };

  const handlePrev = () => {
    if (storyIndex > 0) {
      setStoryIndex(prev => prev - 1);
      setProgress(0);
    } else if (groupIndex > 0) {
      setGroupIndex(prev => prev - 1);
      setStoryIndex(storyGroups[groupIndex - 1].stories.length - 1);
      setProgress(0);
    }
  };

  const handleToggleLike = async () => {
    if (!currentStory) return;
    try {
      const res = await api.stories.toggleLike(currentStory.id);
      setIsLiked(res.is_liked);
      setLikeCount(res.like_count);
      setActionError(null);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Could not update story like.');
    }
  };

  const handleDelete = async () => {
    if (!currentStory || !confirm('Delete this story?')) return;
    try {
      await api.stories.delete(currentStory.id);
      if (onStoryDeleted) onStoryDeleted();
      handleNext();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Could not delete this story.');
    }
  };

  if (!currentStory || !currentGroup) return null;

  const isOwner = user && user.id === currentGroup.user.id;

  return (
    <div
      className="modal-overlay"
      style={{
        background: 'rgba(0, 0, 0, 0.92)',
        zIndex: 200,
        padding: 0,
      }}
      onMouseDown={() => setIsPaused(true)}
      onMouseUp={() => setIsPaused(false)}
      onTouchStart={() => setIsPaused(true)}
      onTouchEnd={() => setIsPaused(false)}
    >
      <div
        className="story-viewer-panel"
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '430px',
          height: '100vh',
          maxHeight: '860px',
          background: '#000000',
          borderRadius: '16px',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 0 50px rgba(0, 0, 0, 0.8)',
        }}
      >
        {actionError && (
          <div role="alert" style={{ position: 'absolute', top: 48, left: 12, right: 12, zIndex: 30, padding: '0.65rem', borderRadius: 'var(--radius-sm)', background: 'rgba(127, 29, 29, 0.9)', color: '#fff' }}>
            {actionError}
          </div>
        )}
        {/* Progress Bars */}
        <div
          style={{
            position: 'absolute',
            top: 12,
            left: 12,
            right: 12,
            display: 'flex',
            gap: 4,
            zIndex: 10,
          }}
        >
          {currentGroup.stories.map((st, i) => (
            <div
              key={st.id}
              style={{
                flex: 1,
                height: 3,
                background: 'rgba(255, 255, 255, 0.3)',
                borderRadius: 2,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  background: '#ffffff',
                  width:
                    i < storyIndex
                      ? '100%'
                      : i === storyIndex
                      ? `${progress}%`
                      : '0%',
                  transition: i === storyIndex ? 'width 0.05s linear' : 'none',
                }}
              />
            </div>
          ))}
        </div>

        {/* Header: Author & Controls */}
        <div
          style={{
            position: 'absolute',
            top: 24,
            left: 12,
            right: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            zIndex: 10,
            color: '#fff',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <Avatar user={currentGroup.user} size="sm" />
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}>
                {currentGroup.user.display_name}
              </div>
              <div style={{ fontSize: '0.72rem', opacity: 0.8 }}>
                @{currentGroup.user.username}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {isOwner && (
              <button onClick={handleDelete} title="Delete story" className="btn-ghost" style={{ color: '#fff' }}>
                <Trash2 size={18} />
              </button>
            )}
            <button onClick={onClose} className="btn-ghost" style={{ color: '#fff' }}>
              <X size={22} />
            </button>
          </div>
        </div>

        {/* Story Media */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
          }}
        >
          {currentStory.image_url ? (
            <MediaImage
              src={currentStory.image_url}
              alt=""
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              }}
            />
          ) : currentStory.video_url ? (
            <MediaVideo
              src={currentStory.video_url}
              autoPlay
              muted
              playsInline
              loop
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              }}
            />
          ) : (
            <div
              style={{
                width: '100%',
                height: '100%',
                background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 50%, #db2777 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '2rem',
                textAlign: 'center',
                color: '#fff',
                fontSize: '1.4rem',
                fontWeight: 600,
              }}
            >
              {currentStory.caption}
            </div>
          )}

          {/* Left / Right Click Nav Zones */}
          <div
            onClick={handlePrev}
            style={{
              position: 'absolute',
              top: 70,
              bottom: 80,
              left: 0,
              width: '35%',
              cursor: 'pointer',
              zIndex: 5,
            }}
          />
          <div
            onClick={handleNext}
            style={{
              position: 'absolute',
              top: 70,
              bottom: 80,
              right: 0,
              width: '35%',
              cursor: 'pointer',
              zIndex: 5,
            }}
          />
        </div>

        {/* Footer: Caption & Like */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            padding: '1.25rem 1rem',
            background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 100%)',
            zIndex: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
          }}
        >
          {currentStory.caption && (
            <p
              style={{
                color: '#ffffff',
                fontSize: '0.95rem',
                textShadow: '0 1px 4px rgba(0,0,0,0.9)',
                lineHeight: 1.4,
                flex: 1,
              }}
            >
              {currentStory.caption}
            </p>
          )}

          <button
            onClick={handleToggleLike}
            style={{
              color: isLiked ? 'var(--like-color)' : '#ffffff',
              padding: '0.5rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              fontWeight: 700,
            }}
          >
            <Heart size={24} fill={isLiked ? 'currentColor' : 'none'} />
            {likeCount > 0 && <span style={{ fontSize: '0.9rem' }}>{likeCount}</span>}
          </button>
        </div>

        {/* Desktop Prev / Next floating arrows */}
        <button
          onClick={handlePrev}
          style={{
            position: 'absolute',
            left: 10,
            top: '50%',
            transform: 'translateY(-50%)',
            zIndex: 15,
            background: 'rgba(0,0,0,0.4)',
            color: '#fff',
            borderRadius: '50%',
            padding: '0.5rem',
          }}
        >
          <ChevronLeft size={22} />
        </button>
        <button
          onClick={handleNext}
          style={{
            position: 'absolute',
            right: 10,
            top: '50%',
            transform: 'translateY(-50%)',
            zIndex: 15,
            background: 'rgba(0,0,0,0.4)',
            color: '#fff',
            borderRadius: '50%',
            padding: '0.5rem',
          }}
        >
          <ChevronRight size={22} />
        </button>
      </div>
    </div>
  );
};
