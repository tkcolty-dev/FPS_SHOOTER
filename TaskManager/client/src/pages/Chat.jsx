import React, { useState, useEffect, useRef, useCallback } from 'react';
import { API } from '../App';
import { IconSend, IconChat, IconZap, IconStar } from '../icons';

// Strip note blocks from display and detect if notes were saved
function processContent(text) {
  const noteRegex = /```note\s*\n?\s*\{[\s\S]*?\}\s*\n?\s*```/g;
  const hasNotes = noteRegex.test(text);
  const cleaned = text.replace(/```note\s*\n?\s*\{[\s\S]*?\}\s*\n?\s*```\s*/g, '').trim();
  return { cleaned, hasNotes };
}

export default function Chat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [loading, setLoading] = useState(true);
  const [learnedNote, setLearnedNote] = useState('');
  const messagesEnd = useRef(null);
  const inputRef = useRef(null);
  const streamRef = useRef('');
  const rafRef = useRef(null);

  useEffect(() => {
    API('/chat/history').then(data => {
      setMessages(data.map(m => ({ role: m.role, content: m.content })));
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const lastScrollRef = useRef(0);
  useEffect(() => {
    if (!streamingText) return;
    const now = Date.now();
    if (now - lastScrollRef.current > 300) {
      lastScrollRef.current = now;
      messagesEnd.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [streamingText]);

  const sendMessage = useCallback(async (text) => {
    const msg = (text || input).trim();
    if (!msg || streaming) return;

    setInput('');
    const userMsg = { role: 'user', content: msg };
    setMessages(prev => [...prev, userMsg]);
    setStreaming(true);
    setStreamingText('');
    streamRef.current = '';

    let dirty = false;
    const scheduleUpdate = () => {
      if (!dirty) {
        dirty = true;
        rafRef.current = requestAnimationFrame(() => {
          setStreamingText(streamRef.current);
          dirty = false;
        });
      }
    };

    let accumulated = '';

    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ message: msg })
      });

      if (!res.ok) throw new Error('Stream failed');

      const contentType = res.headers.get('content-type') || '';

      if (contentType.includes('application/json')) {
        const data = await res.json();
        accumulated = data.choices?.[0]?.message?.content || JSON.stringify(data);
      } else {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            let jsonStr;
            if (line.startsWith('data:')) {
              const rest = line.slice(5).trim();
              if (rest === '[DONE]' || !rest) continue;
              jsonStr = rest;
            } else continue;

            try {
              const parsed = JSON.parse(jsonStr);
              const content = parsed.content || parsed.choices?.[0]?.delta?.content || '';
              if (content) {
                accumulated += content;
                streamRef.current = accumulated;
                scheduleUpdate();
              }
            } catch {}
          }
        }
      }
    } catch {
      if (!accumulated) accumulated = 'Sorry, I had trouble responding. Please try again.';
    } finally {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    }

    // Check if AI learned something
    const { cleaned, hasNotes } = processContent(accumulated);
    if (hasNotes) {
      setLearnedNote('Noted! I\'ll remember this for future plans.');
      setTimeout(() => setLearnedNote(''), 4000);
    }

    setMessages(prev => [...prev, { role: 'assistant', content: accumulated }]);
    setStreamingText('');
    setStreaming(false);
  }, [input, streaming]);

  const clearHistory = async () => {
    await API('/chat/history', { method: 'DELETE' });
    setMessages([]);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  // Render message content, stripping note blocks
  const renderContent = (content) => {
    const { cleaned } = processContent(content);
    return cleaned;
  };

  const suggestions = [
    "Plan my day for me",
    "What should I prioritize?",
    "Create a meeting invitation",
    "Break down a big project",
    "Suggest a schedule for today"
  ];

  if (loading) return <div className="loading-center"><div className="spinner" /></div>;

  return (
    <div className="chat-container">
      <div className="chat-header">
        <div>
          <div className="chat-header-title">
            <IconZap size={16} />
            <span>TaskManager AI</span>
          </div>
          <div className="text-sm text-secondary">Your planning assistant</div>
        </div>
        {messages.length > 0 && (
          <button className="btn btn-sm btn-ghost" onClick={clearHistory}>Clear</button>
        )}
      </div>

      <div className="chat-messages">
        {messages.length === 0 && !streaming && (
          <>
            <div className="chat-bubble system">
              <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>AI Planner</div>
              I can help you plan your day, prioritize tasks, create event invitations, and more. I learn your preferences over time to give better suggestions.
            </div>
            <div className="chat-quick-actions">
              {suggestions.map((s, i) => (
                <button key={i} className="chat-quick-action" onClick={() => sendMessage(s)}>
                  {s}
                </button>
              ))}
            </div>
          </>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`chat-bubble ${m.role}`}>
            {m.role === 'assistant' ? renderContent(m.content) : m.content}
          </div>
        ))}

        {streaming && streamingText && (
          <div className="chat-bubble assistant">{renderContent(streamingText)}</div>
        )}

        {streaming && !streamingText && (
          <div className="typing-indicator"><span /><span /><span /></div>
        )}

        <div ref={messagesEnd} />
      </div>

      {learnedNote && (
        <div className="learned-banner">
          <IconStar size={14} />
          <span>{learnedNote}</span>
        </div>
      )}

      <div className="chat-input-bar">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask me to plan your day..."
          disabled={streaming}
        />
        <button className="chat-send-btn" onClick={() => sendMessage()} disabled={!input.trim() || streaming}>
          <IconSend size={18} />
        </button>
      </div>
    </div>
  );
}
