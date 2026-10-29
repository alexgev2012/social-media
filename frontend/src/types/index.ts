export interface User {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  display_name: string;
  initials: string;
  avatar_url: string | null;
  bio: string;
  email?: string;
  followers_count?: number;
  following_count?: number;
  posts_count?: number;
  is_following?: boolean;
}

export interface Post {
  id: number;
  author: User;
  content: string;
  image_url: string | null;
  video_url: string | null;
  created_at: string;
  updated_at: string;
  like_count: number;
  comment_count: number;
  is_liked: boolean;
  hashtags: string[];
}

export interface CommentReply {
  id: number;
  post_id: number;
  author: User;
  content: string;
  parent_id: number | null;
  created_at: string;
  like_count: number;
  is_liked: boolean;
}

export interface CommentItem {
  id: number;
  post_id: number;
  author: User;
  content: string;
  parent_id: number | null;
  created_at: string;
  like_count: number;
  is_liked: boolean;
  replies: CommentReply[];
}

export interface Story {
  id: number;
  author: User;
  image_url: string | null;
  video_url: string | null;
  caption: string;
  created_at: string;
  like_count: number;
  is_liked: boolean;
}

export interface StoryGroup {
  user: User;
  stories: Story[];
  latest_story_time: string;
}

export interface Message {
  id: number;
  sender: User;
  content: string;
  is_read: boolean;
  created_at: string;
  is_mine: boolean;
}

export interface Conversation {
  id: number;
  partner: User;
  last_message: {
    id: number;
    content: string;
    sender_id: number;
    created_at: string;
    is_read: boolean;
  } | null;
  unread_count: number;
  updated_at: string;
}

export interface NotificationItem {
  id: number;
  actor: User;
  kind: 'like' | 'comment' | 'reply' | 'comment_like' | 'follow' | 'story_like' | 'message';
  post_id: number | null;
  comment_id: number | null;
  story_id: number | null;
  is_read: boolean;
  created_at: string;
}

export interface TrendingTag {
  tag: string;
  count: number;
}
