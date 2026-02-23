import { useState, useRef, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import api from '../api/client';
import ChatMessage from '../components/ChatMessage';

const quickActions = [
  'Plan my meals for today',
  'Suggest a healthy snack',
  'What should I eat for dinner?',
  'Low calorie lunch ideas',
];

export default function Chat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [learnedNote, setLearnedNote] = useState('');
  const messagesEndRef = useRef(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (text) => {
    const userMsg = { role: 'user', content: text };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setInput('');
    setLoading(true);

    try {
      const n = new Date();
      const localToday = `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
      const { data } = await api.post('/chat', {
        message: text,
        history: messages,
        today: localToday,
      });
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
      if (data.learnedPreferences?.length > 0) {
        const names = data.learnedPreferences.map(p => p.value).join(', ');
        setLearnedNote(`Remembered: ${names}`);
        queryClient.invalidateQueries({ queryKey: ['preferences'] });
        setTimeout(() => setLearnedNote(''), 4000);
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, something went wrong. Please try again.' }]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!input.trim() || loading) return;
    sendMessage(input.trim());
  };

  return (
    <div className="chat-container">
      <div className="chat-messages">
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--color-text-secondary)', padding: '2rem 0' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.5rem' }}>AI Meal Assistant</h2>
            <p style={{ fontSize: '0.875rem' }}>Ask me about meal planning, nutrition advice, or recipe ideas.</p>
          </div>
        )}

        {messages.map((msg, i) => (
          <ChatMessage key={i} message={msg} />
        ))}

        {loading && (
          <div className="chat-bubble assistant" style={{ color: 'var(--color-text-secondary)' }}>
            Thinking...
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {messages.length === 0 && (
        <div className="chat-quick-actions">
          {quickActions.map(action => (
            <button
              key={action}
              className="chat-quick-action"
              onClick={() => sendMessage(action)}
              disabled={loading}
            >
              {action}
            </button>
          ))}
        </div>
      )}

      {learnedNote && (
        <div style={{
          fontSize: '0.8rem',
          color: 'var(--color-success)',
          padding: '0.375rem 0',
          textAlign: 'center',
          fontWeight: 500,
        }}>
          {learnedNote}
        </div>
      )}

      <form onSubmit={handleSubmit} className="chat-input-bar">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about meals, nutrition..."
          disabled={loading}
        />
        <button type="submit" className="btn btn-primary" disabled={!input.trim() || loading}>
          Send
        </button>
      </form>
    </div>
  );
}
