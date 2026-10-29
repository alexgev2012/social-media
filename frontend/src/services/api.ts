import {
  User, Post, CommentItem, Story, StoryGroup,
  Conversation, Message, NotificationItem, TrendingTag
} from '../types';

const BASE_URL = '/api';

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const defaultHeaders: Record<string, string> = {};
  if (!(options.body instanceof FormData)) {
    defaultHeaders['Content-Type'] = 'application/json';
  }

  const res = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    credentials: 'include',
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
  });

  if (!res.ok) {
    let errMessage = 'Request failed';
    try {
      const data = await res.json();
      errMessage = data.error || data.detail || JSON.stringify(data);
    } catch {
      errMessage = `HTTP error ${res.status}`;
    }
    throw new Error(errMessage);
  }

  // Check if response is empty (e.g. 204 or delete)
  const contentType = res.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return res.json();
  }
  return {} as T;
}

export const api = {
  // Auth
  auth: {
    me: () => request<{ authenticated: boolean; user: User | null }>('/auth/me/'),
    login: (credentials: { username: string; password: string }) =>
      request<User>('/auth/login/', { method: 'POST', body: JSON.stringify(credentials) }),
    register: (data: { username: string; email: string; password: string; first_name?: string; last_name?: string }) =>
      request<User>('/auth/register/', { method: 'POST', body: JSON.stringify(data) }),
    logout: () => request<{ message: string }>('/auth/logout/', { method: 'POST' }),
    updateProfile: (formData: FormData) =>
      request<User>('/auth/profile/', { method: 'PATCH', body: formData }),
  },

  // Posts
  posts: {
    list: (params: { feed?: string; tag?: string; search?: string; author?: string } = {}) => {
      const q = new URLSearchParams();
      if (params.feed) q.append('feed', params.feed);
      if (params.tag) q.append('tag', params.tag);
      if (params.search) q.append('search', params.search);
      if (params.author) q.append('author', params.author);
      return request<Post[]>(`/posts/?${q.toString()}`);
    },
    get: (id: number) => request<Post>(`/posts/${id}/`),
    create: (formData: FormData) =>
      request<Post>('/posts/', { method: 'POST', body: formData }),
    edit: (id: number, content: string) =>
      request<Post>(`/posts/${id}/`, { method: 'PATCH', body: JSON.stringify({ content }) }),
    delete: (id: number) =>
      request<{ message: string }>(`/posts/${id}/`, { method: 'DELETE' }),
    toggleLike: (id: number) =>
      request<{ is_liked: boolean; like_count: number }>(`/posts/${id}/like/`, { method: 'POST' }),
  },

  // Comments
  comments: {
    list: (postId: number) => request<CommentItem[]>(`/posts/${postId}/comments/`),
    create: (postId: number, data: { content: string; parent_id?: number | null }) =>
      request<CommentItem>(`/posts/${postId}/comments/`, { method: 'POST', body: JSON.stringify(data) }),
    toggleLike: (commentId: number) =>
      request<{ is_liked: boolean; like_count: number }>(`/comments/${commentId}/like/`, { method: 'POST' }),
    delete: (commentId: number) =>
      request<{ message: string }>(`/comments/${commentId}/delete/`, { method: 'DELETE' }),
  },

  // Stories
  stories: {
    list: () => request<StoryGroup[]>('/stories/'),
    create: (formData: FormData) =>
      request<Story>('/stories/', { method: 'POST', body: formData }),
    toggleLike: (storyId: number) =>
      request<{ is_liked: boolean; like_count: number }>(`/stories/${storyId}/like/`, { method: 'POST' }),
    delete: (storyId: number) =>
      request<{ message: string }>(`/stories/${storyId}/delete/`, { method: 'DELETE' }),
  },

  // Chat
  chat: {
    getConversations: () => request<Conversation[]>('/conversations/'),
    getConversation: (username: string) =>
      request<{ conversation_id: number; partner: User; messages: Message[] }>(`/conversations/${username}/`),
    sendMessage: (username: string, content: string) =>
      request<Message>(`/conversations/${username}/messages/`, { method: 'POST', body: JSON.stringify({ content }) }),
    getUnreadCount: () => request<{ unread_count: number }>('/messages/unread-count/'),
  },

  // Users
  users: {
    getProfile: (username: string) => request<User>(`/users/${username}/`),
    toggleFollow: (username: string) =>
      request<{ is_following: boolean; followers_count: number; following_count: number }>(`/users/${username}/follow/`, { method: 'POST' }),
    search: (query: string) => request<User[]>(`/users/search/?q=${encodeURIComponent(query)}`),
    suggestions: () => request<User[]>('/users/suggestions/'),
  },

  // Notifications
  notifications: {
    list: () => request<NotificationItem[]>('/notifications/'),
    markRead: (id?: number) =>
      request<{ message: string }>('/notifications/read/', { method: 'POST', body: JSON.stringify({ id }) }),
    getUnreadCount: () => request<{ unread_count: number }>('/notifications/unread-count/'),
  },

  // Hashtags
  hashtags: {
    trending: () => request<TrendingTag[]>('/hashtags/trending/'),
  },

  // AI Assistant
  ai: {
    generate: (data: { topic?: string; prompt?: string }) =>
      request<{ text: string; tags: string[]; full_content: string }>('/ai/generate/', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },
};
