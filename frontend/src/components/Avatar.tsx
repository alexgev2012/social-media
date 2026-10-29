import React from 'react';
import { User } from '../types';

interface AvatarProps {
  user: User;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  alt?: string;
  className?: string;
  style?: React.CSSProperties;
  onClick?: React.MouseEventHandler<HTMLDivElement>;
}

export const Avatar: React.FC<AvatarProps> = ({
  user,
  size = 'md',
  alt = '',
  className = '',
  style,
  onClick,
}) => (
  <div className={`avatar-wrap avatar-${size} ${className}`.trim()} style={style} onClick={onClick}>
    <span className="avatar-fallback" aria-hidden="true">{user.initials}</span>
    {user.avatar_url && (
      <img
        src={user.avatar_url}
        alt={alt}
        className="avatar-img"
        loading="lazy"
        onError={(event) => { event.currentTarget.style.display = 'none'; }}
      />
    )}
  </div>
);
