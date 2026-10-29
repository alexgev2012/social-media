import React, { useState } from 'react';
import { X, Sparkles, User, Lock, Mail, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const AuthModal: React.FC = () => {
  const { isAuthModalOpen, closeAuthModal, login, register } = useAuth();
  const [tab, setTab] = useState<'login' | 'register'>('login');

  // Form states
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isAuthModalOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      if (tab === 'login') {
        await login({ username, password });
      } else {
        await register({
          username,
          email,
          password,
          first_name: firstName,
          last_name: lastName,
        });
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={closeAuthModal}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
        {/* Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--border-color)',
            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.12) 0%, rgba(168, 85, 247, 0.12) 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: '10px',
                background: 'var(--accent-gradient)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
              }}
            >
              <Sparkles size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800 }}>Welcome to Nexus</h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                {tab === 'login' ? 'Sign in to join the conversation' : 'Create an account to start sharing'}
              </p>
            </div>
          </div>
          <button onClick={closeAuthModal} className="btn-ghost">
            <X size={19} />
          </button>
        </div>

        {/* Tab Switcher */}
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid var(--border-color)',
            background: 'var(--bg-input)',
          }}
        >
          <button
            type="button"
            onClick={() => {
              setTab('login');
              setError(null);
            }}
            style={{
              flex: 1,
              padding: '0.8rem',
              fontWeight: 700,
              fontSize: '0.9rem',
              color: tab === 'login' ? 'var(--accent-primary)' : 'var(--text-secondary)',
              borderBottom: tab === 'login' ? '2px solid var(--accent-primary)' : 'none',
              background: tab === 'login' ? 'var(--bg-surface)' : 'transparent',
            }}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setTab('register');
              setError(null);
            }}
            style={{
              flex: 1,
              padding: '0.8rem',
              fontWeight: 700,
              fontSize: '0.9rem',
              color: tab === 'register' ? 'var(--accent-primary)' : 'var(--text-secondary)',
              borderBottom: tab === 'register' ? '2px solid var(--accent-primary)' : 'none',
              background: tab === 'register' ? 'var(--bg-surface)' : 'transparent',
            }}
          >
            Create Account
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
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

          {tab === 'register' && (
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600 }}>First Name</label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="e.g. Alex"
                  style={{
                    width: '100%',
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '0.65rem 0.85rem',
                    color: 'var(--text-primary)',
                    marginTop: '0.25rem',
                    outline: 'none',
                  }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Last Name</label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="e.g. Rivers"
                  style={{
                    width: '100%',
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '0.65rem 0.85rem',
                    color: 'var(--text-primary)',
                    marginTop: '0.25rem',
                    outline: 'none',
                  }}
                />
              </div>
            </div>
          )}

          <div>
            <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Username</label>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                background: 'var(--bg-input)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-sm)',
                padding: '0.65rem 0.85rem',
                marginTop: '0.25rem',
              }}
            >
              <User size={16} color="var(--text-muted)" />
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="username"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-primary)',
                  outline: 'none',
                  width: '100%',
                }}
              />
            </div>
          </div>

          {tab === 'register' && (
            <div>
              <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Email Address</label>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '0.65rem 0.85rem',
                  marginTop: '0.25rem',
                }}
              >
                <Mail size={16} color="var(--text-muted)" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="user@example.com"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-primary)',
                    outline: 'none',
                    width: '100%',
                  }}
                />
              </div>
            </div>
          )}

          <div>
            <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Password</label>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                background: 'var(--bg-input)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-sm)',
                padding: '0.65rem 0.85rem',
                marginTop: '0.25rem',
              }}
            >
              <Lock size={16} color="var(--text-muted)" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-primary)',
                  outline: 'none',
                  width: '100%',
                }}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="btn-primary"
            style={{
              width: '100%',
              padding: '0.8rem',
              marginTop: '0.4rem',
              fontSize: '0.95rem',
            }}
          >
            <span>{isLoading ? 'Please wait...' : tab === 'login' ? 'Sign In' : 'Create Account'}</span>
            <ArrowRight size={16} />
          </button>
        </form>
      </div>
    </div>
  );
};
