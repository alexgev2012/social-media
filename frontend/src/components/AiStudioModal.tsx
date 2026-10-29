import React, { useState } from 'react';
import { Sparkles, X, Copy, Check, ArrowRight } from 'lucide-react';
import { api } from '../services/api';

interface AiStudioModalProps {
  onClose: () => void;
  onUseContent: (content: string) => void;
}

export const AiStudioModal: React.FC<AiStudioModalProps> = ({
  onClose,
  onUseContent,
}) => {
  const [selectedTopic, setSelectedTopic] = useState('tech');
  const [customPrompt, setCustomPrompt] = useState('');
  const [generatedText, setGeneratedText] = useState('');
  const [generatedTags, setGeneratedTags] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const topics = [
    { id: 'tech', label: '💻 Tech Innovation' },
    { id: 'coffee', label: '☕ Morning Ritual' },
    { id: 'motivation', label: '🚀 Growth & Mindset' },
    { id: 'design', label: '✨ UI/UX Craft' },
    { id: 'coding', label: '⚡ Coding & Dev' },
    { id: 'travel', label: '🌄 Wanderlust' },
  ];

  const handleGenerate = async (topicId?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const activeTopic = topicId || selectedTopic;
      const res = await api.ai.generate({
        topic: activeTopic,
        prompt: customPrompt.trim(),
      });
      setGeneratedText(res.text);
      setGeneratedTags(res.tags);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not generate a draft. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = () => {
    const full = `${generatedText}\n\n${generatedTags.join(' ')}`;
    navigator.clipboard?.writeText(full);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleUseInComposer = () => {
    const full = `${generatedText}\n\n${generatedTags.join(' ')}`;
    onUseContent(full);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--border-color)',
            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(168, 85, 247, 0.1) 100%)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: '8px',
                background: 'var(--accent-gradient)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
              }}
            >
              <Sparkles size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800 }}>AI Social Studio</h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                Generate inspiring posts, hashtags and ideas in seconds
              </p>
            </div>
          </div>
          <button onClick={onClose} className="btn-ghost">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Quick Topic Chips */}
          <div>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.5rem' }}>
              Choose a Theme
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {topics.map((t) => (
                <button
                  key={t.id}
                  onClick={() => {
                    setSelectedTopic(t.id);
                    handleGenerate(t.id);
                  }}
                  style={{
                    padding: '0.45rem 0.85rem',
                    fontSize: '0.82rem',
                    borderRadius: 'var(--radius-full)',
                    background: selectedTopic === t.id ? 'var(--accent-gradient)' : 'var(--bg-input)',
                    border: '1px solid var(--border-color)',
                    color: selectedTopic === t.id ? '#ffffff' : 'var(--text-primary)',
                    fontWeight: selectedTopic === t.id ? 700 : 500,
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Optional Prompt */}
          <div>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.4rem' }}>
              Or describe your idea (optional)
            </label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                type="text"
                placeholder="e.g. launching our new open source React component library..."
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleGenerate();
                }}
                style={{
                  flex: 1,
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '0.65rem 0.85rem',
                  color: 'var(--text-primary)',
                  fontSize: '0.9rem',
                  outline: 'none',
                }}
              />
              <button
                type="button"
                onClick={() => handleGenerate()}
                disabled={isLoading}
                className="btn-primary"
                style={{ padding: '0.65rem 1.1rem', fontSize: '0.88rem' }}
              >
                {isLoading ? 'Thinking...' : 'Generate'}
              </button>
            </div>
          </div>

          {error && (
            <div role="alert" style={{ padding: '0.75rem', borderRadius: 'var(--radius-sm)', background: 'rgba(239, 68, 68, 0.12)', color: '#f87171' }}>
              {error}
            </div>
          )}

          {/* Generated Result Preview Box */}
          {generatedText ? (
            <div
              style={{
                background: 'var(--bg-input)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                padding: '1.25rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.85rem',
                position: 'relative',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  AI Generated Draft
                </span>
                <button
                  onClick={handleCopy}
                  className="btn-ghost"
                  style={{ fontSize: '0.75rem', gap: '0.3rem', padding: '0.2rem 0.5rem' }}
                >
                  {copied ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>

              <p style={{ fontSize: '0.98rem', lineHeight: 1.5, color: 'var(--text-primary)', whiteSpace: 'pre-line' }}>
                {generatedText}
              </p>

              {/* Tags */}
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                {generatedTags.map((tag) => (
                  <span
                    key={tag}
                    style={{
                      fontSize: '0.8rem',
                      color: 'var(--accent-primary)',
                      fontWeight: 600,
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </div>

              {/* Actions */}
              <button
                onClick={handleUseInComposer}
                className="btn-primary"
                style={{
                  marginTop: '0.5rem',
                  width: '100%',
                  padding: '0.75rem',
                  justifyContent: 'center',
                }}
              >
                <span>Use in Post Composer</span>
                <ArrowRight size={16} />
              </button>
            </div>
          ) : (
            <div
              style={{
                textAlign: 'center',
                padding: '2rem 1rem',
                border: '1px dashed var(--border-color)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-muted)',
              }}
            >
              <Sparkles size={28} color="var(--accent-primary)" style={{ marginBottom: '0.5rem' }} />
              <p style={{ fontSize: '0.9rem' }}>Click a theme above or write a prompt to generate your post!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
