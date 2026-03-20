import React, { useState, useEffect, useRef, useCallback } from 'react';
import { API, useToast } from '../App';
import { IconSend, IconZap, IconStar, IconCopy, IconCheck, IconPlus, IconClock, IconTasks, IconCalendar } from '../icons';

function processContent(text) {
  const noteRegex = /```note\s*\n?\s*\{[\s\S]*?\}\s*\n?\s*```/g;
  const hasNotes = noteRegex.test(text);
  const cleaned = text.replace(/```note\s*\n?\s*\{[\s\S]*?\}\s*\n?\s*```\s*/g, '').trim();
  return { cleaned, hasNotes };
}

function parseOptions(text) {
  const match = text.match(/\[OPTIONS:\s*([\s\S]*?)\]/);
  if (!match) return null;
  return match[1].split('|').map(o => o.trim().replace(/\n/g, ' ')).filter(Boolean);
}

function stripSpecialTags(text) {
  return text
    .replace(/\[OPTIONS:\s*.*?\]/g, '')
    .replace(/\[PLAN:?\s*[^\]]*\][\s\S]*?\[\/PLAN\]/g, '')
    .replace(/\[CHECKLIST:?\s*[^\]]*\][\s\S]*?\[\/CHECKLIST\]/g, '')
    .replace(/\[EVENT:?\s*[^\]]*\][\s\S]*?\[\/EVENT\]/g, '')
    .replace(/\[SHARE\][\s\S]*?\[\/SHARE\]/g, '')
    .trim();
}

function parseEventBlocks(text) {
  const blocks = [];
  const regex = /\[EVENT:?\s*([^\]]*)\]([\s\S]*?)\[\/EVENT\]/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const headerTitle = match[1].trim();
    const data = {};
    match[2].trim().split('\n').forEach(line => {
      const [key, ...rest] = line.split(':');
      if (key && rest.length) data[key.trim().toLowerCase()] = rest.join(':').trim();
    });
    blocks.push({ type: 'event', headerTitle, data });
  }
  return blocks;
}

function parsePlanBlocks(text) {
  const blocks = [];
  const planRegex = /\[PLAN:?\s*([^\]]*)\]([\s\S]*?)\[\/PLAN\]/g;
  let match;
  while ((match = planRegex.exec(text)) !== null) {
    const title = match[1].trim();
    const items = match[2].trim().split('\n')
      .map(l => l.replace(/^[-*]\s*/, '').trim())
      .filter(Boolean);
    blocks.push({ type: 'plan', title, items });
  }
  return blocks;
}

function parseChecklistBlocks(text) {
  const blocks = [];
  const regex = /\[CHECKLIST:?\s*([^\]]*)\]([\s\S]*?)\[\/CHECKLIST\]/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const title = match[1].trim();
    const items = match[2].trim().split('\n')
      .map(l => l.replace(/^[-*]\s*/, '').trim())
      .filter(Boolean);
    blocks.push({ type: 'checklist', title, items });
  }
  return blocks;
}

function parseShareBlocks(text) {
  const blocks = [];
  const regex = /\[SHARE\]\s*\n?([\s\S]*?)\n?\s*\[\/SHARE\]/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    blocks.push({ type: 'share', content: match[1].trim() });
  }
  return blocks;
}

// Parse time from plan items like "9:00 AM: Do thing" or "2 PM: Do thing"
function parseTimeFromItem(item) {
  const match = item.match(/^(\d{1,2}(?::\d{2})?\s*(?:AM|PM|am|pm))\s*[-:]\s*/);
  if (!match) return { time: null, title: item };
  const timeStr = match[1].trim();
  const title = item.slice(match[0].length).trim();
  // Convert to 24h for due_time
  const tMatch = timeStr.match(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM|am|pm)/);
  if (!tMatch) return { time: null, title: item };
  let h = parseInt(tMatch[1]);
  const m = tMatch[2] ? parseInt(tMatch[2]) : 0;
  const period = tMatch[3].toUpperCase();
  if (period === 'PM' && h !== 12) h += 12;
  if (period === 'AM' && h === 12) h = 0;
  const dueTime = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  return { time: timeStr, dueTime, title };
}

function PlanCard({ title, items, created }) {
  return (
    <div className={`plan-card ${created ? 'created' : ''}`}>
      <div className="plan-card-header">
        <IconClock size={14} />
        <span>{title || 'Your Plan'}</span>
      </div>
      <div className="plan-card-items">
        {items.map((item, i) => {
          const { time, title: itemTitle } = parseTimeFromItem(item);
          return (
            <div key={i} className="plan-card-item">
              {time ? <span className="plan-time">{time}</span> : <span className="plan-bullet" />}
              <span className="plan-text">{itemTitle || item}</span>
            </div>
          );
        })}
      </div>
      <div className={`plan-save-btn ${created ? 'saved' : 'planned'}`}>
        {created ? <><IconCheck size={14} /> Added to your tasks</> : <><IconClock size={14} /> Suggested plan</>}
      </div>
    </div>
  );
}

function ChecklistCard({ title, items, created }) {
  return (
    <div className={`plan-card checklist ${created ? 'created' : ''}`}>
      <div className="plan-card-header">
        <IconTasks size={14} />
        <span>{title || 'Checklist'}</span>
      </div>
      <div className="plan-card-items">
        {items.map((item, i) => (
          <div key={i} className="plan-card-item">
            <span className="checklist-num">{i + 1}</span>
            <span className="plan-text">{item}</span>
          </div>
        ))}
      </div>
      <div className={`plan-save-btn ${created ? 'saved' : 'planned'}`}>
        {created ? <><IconCheck size={14} /> {items.length} tasks created</> : <><IconClock size={14} /> Suggested checklist</>}
      </div>
    </div>
  );
}

function EventCard({ title, data, created }) {
  return (
    <div className={`plan-card event-card ${created ? 'created' : ''}`}>
      <div className={`plan-card-header ${created ? 'event' : ''}`}>
        <IconCalendar size={14} />
        <span>{title || 'Event'}</span>
      </div>
      <div className="plan-card-items">
        {data.title && <div className="plan-card-item"><span className="plan-time">Event</span><span className="plan-text">{data.title}</span></div>}
        {data.start && <div className="plan-card-item"><span className="plan-time">When</span><span className="plan-text">{data.start}</span></div>}
        {data.location && <div className="plan-card-item"><span className="plan-time">Where</span><span className="plan-text">{data.location}</span></div>}
        {data.description && <div className="plan-card-item"><span className="plan-time">Details</span><span className="plan-text">{data.description}</span></div>}
      </div>
      <div className={`plan-save-btn ${created ? 'saved event' : 'planned'}`}>
        {created ? <><IconCheck size={14} /> Added to your calendar</> : <><IconClock size={14} /> Suggested event</>}
      </div>
    </div>
  );
}

function ShareBlock({ content }) {
  const [copied, setCopied] = useState(false);
  const copy = () => { navigator.clipboard.writeText(content); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  const share = async () => { if (navigator.share) { try { await navigator.share({ text: content }); } catch {} } else copy(); };

  return (
    <div className="share-block">
      <div className="share-block-content">{content}</div>
      <div className="share-block-actions">
        <button onClick={copy} className="share-btn">{copied ? <><IconCheck size={12} /> Copied</> : <><IconCopy size={12} /> Copy</>}</button>
        {navigator.share && <button onClick={share} className="share-btn primary"><IconSend size={12} /> Share</button>}
      </div>
    </div>
  );
}

function MessageBubble({ content, role, created }) {
  if (role === 'user') return <div className="chat-bubble user">{content}</div>;

  const { cleaned } = processContent(content);
  const plainText = stripSpecialTags(cleaned);
  const plans = parsePlanBlocks(cleaned);
  const checklists = parseChecklistBlocks(cleaned);
  const events = parseEventBlocks(cleaned);
  const shares = parseShareBlocks(cleaned);

  if (!plainText && !plans.length && !checklists.length && !events.length && !shares.length) return null;

  return (
    <div className="chat-bubble assistant">
      {plainText && <span>{plainText}</span>}
      {plans.map((p, i) => <PlanCard key={`p${i}`} title={p.title} items={p.items} created={created} />)}
      {checklists.map((c, i) => <ChecklistCard key={`c${i}`} title={c.title} items={c.items} created={created} />)}
      {events.map((e, i) => <EventCard key={`e${i}`} title={e.headerTitle} data={e.data} created={created} />)}
      {shares.map((s, i) => <ShareBlock key={`s${i}`} content={s.content} />)}
    </div>
  );
}

export default function Chat() {
  const showToast = useToast();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [loading, setLoading] = useState(true);
  const [learnedNote, setLearnedNote] = useState('');
  const [quickReplies, setQuickReplies] = useState(null);
  const messagesEnd = useRef(null);
  const inputRef = useRef(null);
  const streamRef = useRef('');
  const rafRef = useRef(null);

  useEffect(() => {
    API('/chat/history').then(data => {
      const msgs = data.map(m => ({ role: m.role, content: m.content }));
      setMessages(msgs);
      const lastAssistant = [...msgs].reverse().find(m => m.role === 'assistant');
      if (lastAssistant) {
        const opts = parseOptions(processContent(lastAssistant.content).cleaned);
        if (opts) setQuickReplies(opts);
      }
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => { messagesEnd.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const lastScrollRef = useRef(0);
  useEffect(() => {
    if (!streamingText) return;
    const now = Date.now();
    if (now - lastScrollRef.current > 300) { lastScrollRef.current = now; messagesEnd.current?.scrollIntoView({ behavior: 'smooth' }); }
  }, [streamingText]);

  const sendMessage = useCallback(async (text) => {
    const msg = (text || input).trim();
    if (!msg || streaming) return;

    setInput('');
    setQuickReplies(null);
    setMessages(prev => [...prev, { role: 'user', content: msg }]);
    setStreaming(true);
    setStreamingText('');
    streamRef.current = '';

    let dirty = false;
    const scheduleUpdate = () => {
      if (!dirty) { dirty = true; rafRef.current = requestAnimationFrame(() => { setStreamingText(streamRef.current); dirty = false; }); }
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
            if (!line.startsWith('data:')) continue;
            const rest = line.slice(5).trim();
            if (rest === '[DONE]' || !rest) continue;
            try {
              const parsed = JSON.parse(rest);
              const content = parsed.content || parsed.choices?.[0]?.delta?.content || '';
              if (content) { accumulated += content; streamRef.current = accumulated; scheduleUpdate(); }
            } catch {}
          }
        }
      }
    } catch {
      if (!accumulated) accumulated = 'Sorry, I had trouble responding. Please try again.';
    } finally {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    }

    const { cleaned, hasNotes } = processContent(accumulated);
    if (hasNotes) { setLearnedNote('Noted!'); setTimeout(() => setLearnedNote(''), 3000); }

    const opts = parseOptions(cleaned);
    if (opts) setQuickReplies(opts);

    setMessages(prev => [...prev, { role: 'assistant', content: accumulated }]);
    setStreamingText('');
    setStreaming(false);
  }, [input, streaming]);

  // Save plan items as tasks
  const savePlanAsTasks = async (items, planTitle) => {
    // Try to extract a date from the plan title like "March 19" or "Tomorrow"
    const today = new Date();
    let dueDate = today.toISOString().slice(0, 10);

    // Simple date extraction from title
    const dateMatch = planTitle?.match(/(\w+ \d{1,2})/);
    if (dateMatch) {
      const parsed = new Date(dateMatch[1] + ', ' + today.getFullYear());
      if (!isNaN(parsed)) dueDate = parsed.toISOString().slice(0, 10);
    }
    if (/tomorrow/i.test(planTitle || '')) {
      const tmrw = new Date(today); tmrw.setDate(tmrw.getDate() + 1);
      dueDate = tmrw.toISOString().slice(0, 10);
    }

    const tasks = items.map(item => {
      const { dueTime, title } = parseTimeFromItem(item);
      return { title: title || item, dueDate, dueTime: dueTime || null, priority: 'medium', category: 'general' };
    });

    try {
      const result = await API('/tasks/bulk', { method: 'POST', body: { tasks } });
      showToast('Plan Saved', `Created ${result.created} tasks`);
    } catch { showToast('Error', 'Failed to save tasks', 'error'); }
  };

  // Save checklist items as tasks
  const saveChecklistAsTasks = async (items, title) => {
    const tasks = items.map((item, i) => ({
      title: item,
      description: title ? `From checklist: ${title}` : null,
      priority: 'medium',
      category: 'general'
    }));

    try {
      const result = await API('/tasks/bulk', { method: 'POST', body: { tasks } });
      showToast('Checklist Created', `Created ${result.created} tasks`);
    } catch { showToast('Error', 'Failed to create tasks', 'error'); }
  };

  const clearHistory = async () => { await API('/chat/history', { method: 'DELETE' }); setMessages([]); setQuickReplies(null); };
  const handleKeyDown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } };

  const suggestions = [
    "Plan my day",
    "Plan tomorrow",
    "What should I do next?",
    "Plan a birthday party",
    "Break down a big project",
    "Draft a meeting invite",
  ];

  if (loading) return <div className="loading-center"><div className="spinner" /></div>;

  return (
    <div className="chat-container">
      <div className="chat-header">
        <div>
          <div className="chat-header-title"><IconZap size={16} /><span>TaskManager AI</span></div>
          <div className="text-sm text-secondary">Plans, checklists, invites — just ask</div>
        </div>
        {messages.length > 0 && <button className="btn btn-sm btn-ghost" onClick={clearHistory}>Clear</button>}
      </div>

      <div className="chat-messages">
        {messages.length === 0 && !streaming && (
          <>
            <div className="chat-bubble system">
              <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>AI Planner</div>
              I build real plans from your schedule and create task checklists. Try "plan my day" or "break down homework".
            </div>
            <div className="chat-quick-actions">
              {suggestions.map((s, i) => <button key={i} className="chat-quick-action" onClick={() => sendMessage(s)}>{s}</button>)}
            </div>
          </>
        )}

        {messages.map((m, i) => (
          <MessageBubble key={i} content={m.content} role={m.role} created={true} />
        ))}

        {streaming && streamingText && (
          <MessageBubble content={streamingText} role="assistant" created={false} />
        )}
        {streaming && !streamingText && <div className="typing-indicator"><span /><span /><span /></div>}

        <div ref={messagesEnd} />
      </div>

      {learnedNote && <div className="learned-banner"><IconStar size={14} /><span>{learnedNote}</span></div>}

      {quickReplies && !streaming && (
        <div className="chat-replies">
          {quickReplies.map((opt, i) => (
            <button key={i} className="chat-reply-btn" onClick={() => { setQuickReplies(null); sendMessage(opt); }}>{opt}</button>
          ))}
          <button className="chat-reply-btn other" onClick={() => { setQuickReplies(null); inputRef.current?.focus(); }}>Type my own...</button>
        </div>
      )}

      <div className="chat-input-bar">
        <input ref={inputRef} type="text" value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown} placeholder="Ask me to plan something..." disabled={streaming} />
        <button className="chat-send-btn" onClick={() => sendMessage()} disabled={!input.trim() || streaming}>
          <IconSend size={18} />
        </button>
      </div>
    </div>
  );
}
