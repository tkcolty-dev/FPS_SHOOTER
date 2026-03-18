import React, { useState, useEffect, useRef, useCallback } from 'react';
import { API } from '../App';
import { IconSend, IconChat, IconZap, IconStar, IconCopy, IconCheck } from '../icons';

// Strip note blocks and parse special blocks
function processContent(text) {
  const noteRegex = /```note\s*\n?\s*\{[\s\S]*?\}\s*\n?\s*```/g;
  const hasNotes = noteRegex.test(text);
  let cleaned = text.replace(/```note\s*\n?\s*\{[\s\S]*?\}\s*\n?\s*```\s*/g, '').trim();
  return { cleaned, hasNotes };
}

// Parse [OPTIONS: A | B | C] from text
function parseOptions(text) {
  const match = text.match(/\[OPTIONS:\s*(.*?)\]/);
  if (!match) return null;
  return match[1].split('|').map(o => o.trim()).filter(Boolean);
}

// Parse [SHARE]...[/SHARE] blocks
function parseShareBlocks(text) {
  const parts = [];
  let remaining = text;
  const regex = /\[SHARE\]\s*\n?([\s\S]*?)\n?\s*\[\/SHARE\]/g;
  let match;
  let lastIndex = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', content: text.slice(lastIndex, match.index) });
    }
    parts.push({ type: 'share', content: match[1].trim() });
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push({ type: 'text', content: text.slice(lastIndex) });
  }

  return parts.length > 0 ? parts : [{ type: 'text', content: text }];
}

// Remove [OPTIONS:...] from display text
function stripOptions(text) {
  return text.replace(/\[OPTIONS:\s*.*?\]/g, '').trim();
}

function ShareBlock({ content }) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const share = async () => {
    if (navigator.share) {
      try { await navigator.share({ text: content }); } catch {}
    } else {
      copy();
    }
  };

  return (
    <div className="share-block">
      <div className="share-block-content">{content}</div>
      <div className="share-block-actions">
        <button onClick={copy} className="share-btn">
          {copied ? <><IconCheck size={12} /> Copied</> : <><IconCopy size={12} /> Copy</>}
        </button>
        {navigator.share && (
          <button onClick={share} className="share-btn primary">
            <IconSend size={12} /> Share
          </button>
        )}
      </div>
    </div>
  );
}

function MessageBubble({ content, role, onOptionClick }) {
  if (role === 'user') return <div className="chat-bubble user">{content}</div>;

  const { cleaned } = processContent(content);
  const options = parseOptions(cleaned);
  const displayText = stripOptions(cleaned);
  const parts = parseShareBlocks(displayText);

  return (
    <div className="chat-bubble assistant">
      {parts.map((part, i) =>
        part.type === 'share' ? (
          <ShareBlock key={i} content={part.content} />
        ) : (
          <span key={i}>{part.content}</span>
        )
      )}
      {options && (
        <div className="chat-options">
          {options.map((opt, i) => (
            <button key={i} className="chat-option-btn" onClick={() => onOptionClick(opt)}>
              {opt}
            </button>
          ))}
          <button className="chat-option-btn other" onClick={() => onOptionClick(null)}>
            Other...
          </button>
        </div>
      )}
    </div>
  );
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

  const handleOptionClick = (option) => {
    if (option) {
      sendMessage(option);
    } else {
      inputRef.current?.focus();
    }
  };

  const suggestions = [
    "Plan my day",
    "What should I do next?",
    "Plan a birthday party",
    "Draft a meeting invite",
    "Break down a big project",
    "Plan my week",
    "Help me meal prep",
    "Schedule my morning routine"
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
          <div className="text-sm text-secondary">Plans, schedules, shares — just ask</div>
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
              I plan your day, draft messages, schedule events, and remember your preferences. Just tell me what you need.
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
          <MessageBubble key={i} content={m.content} role={m.role} onOptionClick={handleOptionClick} />
        ))}

        {streaming && streamingText && (
          <MessageBubble content={streamingText} role="assistant" onOptionClick={handleOptionClick} />
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
          placeholder="Ask me to plan something..."
          disabled={streaming}
        />
        <button className="chat-send-btn" onClick={() => sendMessage()} disabled={!input.trim() || streaming}>
          <IconSend size={18} />
        </button>
      </div>
    </div>
  );
}
