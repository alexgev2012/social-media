import React, { useState, useEffect, useRef } from 'react';
import { Send, Search, User as UserIcon, MessageSquare, ArrowLeft } from 'lucide-react';
import { Conversation, Message, User } from '../types';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

interface ChatViewProps {
  initialPartnerUsername?: string | null;
  onSelectUser: (username: string) => void;
}

export const ChatView: React.FC<ChatViewProps> = ({
  initialPartnerUsername,
  onSelectUser,
}) => {
  const { user, refreshBadges } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedPartner, setSelectedPartner] = useState<User | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageText, setMessageText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestedUsers, setSuggestedUsers] = useState<User[]>([]);
  const [isMobileChatOpen, setIsMobileChatOpen] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadConversations = async () => {
    try {
      const data = await api.chat.getConversations();
      setConversations(data);
    } catch {
      // error
    }
  };

  useEffect(() => {
    loadConversations();
    api.users.suggestions().then(setSuggestedUsers).catch(() => {});
  }, []);

  useEffect(() => {
    if (initialPartnerUsername) {
      openChatWithUser(initialPartnerUsername);
    }
  }, [initialPartnerUsername]);

  const openChatWithUser = async (username: string) => {
    try {
      const data = await api.chat.getConversation(username);
      setSelectedPartner(data.partner);
      setMessages(data.messages);
      setIsMobileChatOpen(true);
      setTimeout(scrollToBottom, 100);
      refreshBadges();
      loadConversations();
    } catch {
      // error
    }
  };

  useEffect(() => {
    if (!selectedPartner) return;
    const interval = setInterval(async () => {
      try {
        const data = await api.chat.getConversation(selectedPartner.username);
        setMessages(data.messages);
      } catch {
        // error
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [selectedPartner]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPartner || !messageText.trim() || isSending) return;

    const text = messageText.trim();
    setMessageText('');
    setIsSending(true);

    const tempMsg: Message = {
      id: Date.now(),
      sender: user!,
      content: text,
      is_read: false,
      created_at: new Date().toISOString(),
      is_mine: true,
    };
    setMessages(prev => [...prev, tempMsg]);
    setTimeout(scrollToBottom, 50);

    try {
      const actualMsg = await api.chat.sendMessage(selectedPartner.username, text);
      setMessages(prev => prev.map(m => (m.id === tempMsg.id ? actualMsg : m)));
      loadConversations();
    } catch {
      setMessages(prev => prev.filter(m => m.id !== tempMsg.id));
    } finally {
      setIsSending(false);
    }
  };

  const isJumboEmoji = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || trimmed.length > 8) return false;
    const hasLettersOrNumbers = /[a-zA-Z0-9]/.test(trimmed);
    return !hasLettersOrNumbers;
  };

  const filteredConversations = conversations.filter(c =>
    c.partner.display_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.partner.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div
      className={`chat-view${isMobileChatOpen ? ' chat-open' : ''}`}
      style={{
        display: 'flex',
        height: '100vh',
        background: 'var(--bg-main)',
      }}
    >
      {/* Left Column: Conversations List */}
      <div
        className="chat-conversation-list"
        style={{
          width: isMobileChatOpen ? '0' : '100%',
          maxWidth: '300px',
          borderRight: '1px solid var(--border-color)',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--bg-surface)',
          flexShrink: 0,
        }}
      >
        <div style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)' }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '0.75rem' }}>Messages</h2>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              background: 'var(--bg-input)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-full)',
              padding: '0.45rem 0.85rem',
            }}
          >
            <Search size={15} color="var(--text-muted)" />
            <input
              type="text"
              placeholder="Search chat..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-primary)',
                fontSize: '0.84rem',
                outline: 'none',
                width: '100%',
              }}
            />
          </div>
        </div>

        {/* Conversation list */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {filteredConversations.length > 0 ? (
            filteredConversations.map((c) => {
              const isSelected = selectedPartner?.username === c.partner.username;
              return (
                <div
                  key={c.id}
                  onClick={() => openChatWithUser(c.partner.username)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.65rem',
                    padding: '0.75rem 1rem',
                    cursor: 'pointer',
                    background: isSelected ? 'rgba(99, 102, 241, 0.12)' : 'transparent',
                    borderLeft: isSelected ? '3px solid var(--accent-primary)' : '3px solid transparent',
                    transition: 'var(--transition)',
                  }}
                  className="btn-ghost:hover"
                >
                  <div className="avatar-wrap avatar-md">
                    {c.partner.avatar_url ? (
                      <img src={c.partner.avatar_url} alt="" className="avatar-img" />
                    ) : (
                      c.partner.initials
                    )}
                  </div>
                  <div style={{ flex: 1, overflow: 'hidden' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{c.partner.display_name}</span>
                      {c.unread_count > 0 && (
                        <span
                          style={{
                            background: 'var(--accent-primary)',
                            color: '#fff',
                            fontSize: '0.65rem',
                            fontWeight: 800,
                            padding: '1px 6px',
                            borderRadius: '999px',
                          }}
                        >
                          {c.unread_count}
                        </span>
                      )}
                    </div>
                    <div
                      style={{
                        fontSize: '0.78rem',
                        color: 'var(--text-muted)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        marginTop: '0.15rem',
                      }}
                    >
                      {c.last_message ? c.last_message.content : 'No messages yet'}
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div style={{ padding: '1.5rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              <MessageSquare size={28} style={{ marginBottom: '0.5rem', opacity: 0.5 }} />
              <p style={{ fontSize: '0.84rem' }}>No conversations yet.</p>
              <div style={{ marginTop: '1rem', textAlign: 'left' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                  Start a chat:
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.4rem' }}>
                  {suggestedUsers.map(u => (
                    <div
                      key={u.id}
                      onClick={() => openChatWithUser(u.username)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.35rem 0.5rem',
                        cursor: 'pointer',
                        borderRadius: 'var(--radius-sm)',
                      }}
                      className="btn-ghost:hover"
                    >
                      <div className="avatar-wrap avatar-xs">{u.initials}</div>
                      <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>{u.display_name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right Column: Chat History & Input */}
      <div
        className="chat-history-col"
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--bg-main)',
        }}
      >
        {selectedPartner ? (
          <>
            {/* Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.75rem 1.25rem',
                borderBottom: '1px solid var(--border-color)',
                background: 'var(--bg-surface)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <button
                  onClick={() => setIsMobileChatOpen(false)}
                  className="btn-ghost"
                  style={{ display: isMobileChatOpen ? 'inline-flex' : 'none' }}
                >
                  <ArrowLeft size={18} />
                </button>
                <div
                  className="avatar-wrap avatar-md"
                  onClick={() => onSelectUser(selectedPartner.username)}
                  style={{ cursor: 'pointer' }}
                >
                  {selectedPartner.avatar_url ? (
                    <img src={selectedPartner.avatar_url} alt="" className="avatar-img" />
                  ) : (
                    selectedPartner.initials
                  )}
                </div>
                <div>
                  <div
                    onClick={() => onSelectUser(selectedPartner.username)}
                    style={{ fontWeight: 700, fontSize: '0.96rem', cursor: 'pointer' }}
                  >
                    {selectedPartner.display_name}
                  </div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                    @{selectedPartner.username}
                  </div>
                </div>
              </div>

              <button
                onClick={() => onSelectUser(selectedPartner.username)}
                className="btn-secondary"
                style={{ fontSize: '0.78rem', padding: '0.35rem 0.75rem' }}
              >
                <UserIcon size={13} /> View Profile
              </button>
            </div>

            {/* Messages Body */}
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '1.25rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.65rem',
              }}
            >
              {messages.map((m) => {
                const isJumbo = isJumboEmoji(m.content);
                return (
                  <div
                    key={m.id}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: m.is_mine ? 'flex-end' : 'flex-start',
                    }}
                  >
                    {isJumbo ? (
                      <span className="jumbo-emoji">{m.content}</span>
                    ) : (
                      <div
                        style={{
                          maxWidth: '68%',
                          padding: '0.65rem 1rem',
                          borderRadius: m.is_mine ? '16px 16px 3px 16px' : '16px 16px 16px 3px',
                          background: m.is_mine ? 'var(--accent-gradient)' : 'var(--bg-surface)',
                          border: m.is_mine ? 'none' : '1px solid var(--border-color)',
                          color: '#ffffff',
                          fontSize: '0.92rem',
                          lineHeight: 1.45,
                          boxShadow: m.is_mine ? '0 3px 10px rgba(99, 102, 241, 0.25)' : 'none',
                        }}
                      >
                        {m.content}
                      </div>
                    )}
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '2px', padding: '0 4px' }}>
                      {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Footer */}
            <form
              onSubmit={handleSendMessage}
              style={{
                padding: '0.85rem 1.25rem',
                borderTop: '1px solid var(--border-color)',
                background: 'var(--bg-surface)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.65rem',
              }}
            >
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-full)',
                  padding: '0.35rem 0.5rem 0.35rem 1.1rem',
                }}
              >
                <input
                  type="text"
                  placeholder="Type a message or emoji..."
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  autoFocus
                  style={{
                    flex: 1,
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-primary)',
                    fontSize: '0.92rem',
                    outline: 'none',
                  }}
                />
                <button
                  type="submit"
                  disabled={!messageText.trim()}
                  className="btn-primary"
                  style={{
                    width: 32,
                    height: 32,
                    padding: 0,
                    borderRadius: '50%',
                    opacity: !messageText.trim() ? 0.45 : 1,
                  }}
                >
                  <Send size={14} />
                </button>
              </div>
            </form>
          </>
        ) : (
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-muted)',
              gap: '0.5rem',
            }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                background: 'var(--bg-surface)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <MessageSquare size={26} color="var(--accent-primary)" />
            </div>
            <h3 style={{ fontSize: '1.1rem', color: 'var(--text-primary)', fontWeight: 700 }}>
              Select a Conversation
            </h3>
            <p style={{ fontSize: '0.85rem', maxWidth: 280, textAlign: 'center' }}>
              Choose a person on the left to start chatting in real time.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
