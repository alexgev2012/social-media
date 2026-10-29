import React from 'react';
import { Plus } from 'lucide-react';
import { StoryGroup } from '../types';
import { useAuth } from '../context/AuthContext';
import { Avatar } from './Avatar';

interface StoriesBarProps {
  storyGroups: StoryGroup[];
  onOpenStory: (groupIndex: number) => void;
  onOpenCreateStory: () => void;
}

export const StoriesBar: React.FC<StoriesBarProps> = ({
  storyGroups,
  onOpenStory,
  onOpenCreateStory,
}) => {
  const { user, openAuthModal } = useAuth();

  const handleAddClick = () => {
    if (!user) {
      openAuthModal();
      return;
    }
    onOpenCreateStory();
  };

  return (
    <div
      className="stories-bar"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '1.1rem',
        padding: '0.85rem 1.25rem',
        overflowX: 'auto',
        scrollbarWidth: 'none',
        borderBottom: '1px solid var(--border-color)',
      }}
    >
      {/* Create / Add Story Button */}
      <div
        onClick={handleAddClick}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '0.35rem',
          cursor: 'pointer',
          flexShrink: 0,
        }}
      >
        <div style={{ position: 'relative' }}>
          {user ? (
            <Avatar
              user={user}
              size="lg"
              style={{ border: '2px dashed rgba(99, 102, 241, 0.5)' }}
            />
          ) : (
            <div className="avatar-wrap avatar-lg" style={{ background: 'rgba(99, 102, 241, 0.12)', border: '2px dashed rgba(99, 102, 241, 0.5)' }}>+</div>
          )}
          <div
            style={{
              position: 'absolute',
              bottom: -2,
              right: -2,
              width: 20,
              height: 20,
              borderRadius: '50%',
              background: 'var(--accent-primary)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '2px solid var(--bg-main)',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <Plus size={13} strokeWidth={3} />
          </div>
        </div>
        <span style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
          Your story
        </span>
      </div>

      {/* Story Groups */}
      {storyGroups.map((group, idx) => (
        <div
          key={group.user.id}
          onClick={() => onOpenStory(idx)}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '0.35rem',
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          <div
            style={{
              padding: '2.5px',
              borderRadius: '50%',
              background: 'var(--story-ring)',
              boxShadow: '0 2px 8px rgba(220, 39, 67, 0.2)',
              transition: 'var(--transition)',
            }}
          >
            <Avatar user={group.user} size="lg" style={{ border: '2px solid var(--bg-main)' }} />
          </div>
          <span
            style={{
              fontSize: '0.74rem',
              fontWeight: 500,
              maxWidth: 62,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              color: 'var(--text-primary)',
            }}
          >
            {group.user.display_name.split(' ')[0]}
          </span>
        </div>
      ))}
    </div>
  );
};
