const express = require('express');
const router = express.Router();
const { streamChat, chatCompletion } = require('../services/ai');

module.exports = (pool) => {
  // Get chat history
  router.get('/history', async (req, res) => {
    try {
      const result = await pool.query(
        'SELECT * FROM chat_history WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50',
        [req.userId]
      );
      res.json(result.rows.reverse());
    } catch (err) {
      res.status(500).json({ error: 'Server error' });
    }
  });

  // Get user notes (AI-learned preferences)
  router.get('/notes', async (req, res) => {
    try {
      const result = await pool.query(
        'SELECT * FROM user_notes WHERE user_id = $1 ORDER BY category, created_at',
        [req.userId]
      );
      res.json(result.rows);
    } catch (err) {
      res.status(500).json({ error: 'Server error' });
    }
  });

  // Send message (streaming)
  router.post('/stream', async (req, res) => {
    try {
      const { message } = req.body;
      if (!message) return res.status(400).json({ error: 'Message required' });

      // Save user message
      await pool.query('INSERT INTO chat_history (user_id, role, content) VALUES ($1, $2, $3)', [req.userId, 'user', message]);

      // Get context
      const today = new Date().toISOString().slice(0, 10);
      const hour = new Date().getHours();
      const dayOfWeek = new Date().toLocaleDateString('en-US', { weekday: 'long' });
      const [tasks, events, recentChat, userNotes, user] = await Promise.all([
        pool.query('SELECT title, description, category, priority, status, due_date, due_time FROM tasks WHERE user_id = $1 AND (due_date::date >= $2::date OR status = $3) ORDER BY due_date', [req.userId, today, 'pending']),
        pool.query('SELECT title, description, location, start_time, end_time FROM events WHERE user_id = $1 AND start_time::date >= $2::date ORDER BY start_time LIMIT 15', [req.userId, today]),
        pool.query('SELECT role, content FROM chat_history WHERE user_id = $1 ORDER BY created_at DESC LIMIT 10', [req.userId]),
        pool.query('SELECT category, note FROM user_notes WHERE user_id = $1 ORDER BY category', [req.userId]),
        pool.query('SELECT display_name FROM users WHERE id = $1', [req.userId])
      ]);

      const userName = user.rows[0]?.display_name || 'there';

      // Group notes by category
      const notesByCategory = {};
      userNotes.rows.forEach(n => {
        if (!notesByCategory[n.category]) notesByCategory[n.category] = [];
        notesByCategory[n.category].push(n.note);
      });

      const notesSection = Object.keys(notesByCategory).length > 0
        ? `\n\nWhat I know about ${userName} (learned from past conversations):\n${Object.entries(notesByCategory).map(([cat, notes]) => `- ${cat}: ${notes.join(', ')}`).join('\n')}`
        : '';

      const timeLabel = `${hour % 12 || 12}:00 ${hour >= 12 ? 'PM' : 'AM'}`;

      const pendingTasks = tasks.rows.filter(t => t.status === 'pending');
      const todayTasks = pendingTasks.filter(t => t.due_date && t.due_date.slice(0, 10) === today);

      const systemPrompt = `You are TaskManager AI — a sharp, proactive planning assistant for ${userName}. You make plans, not ask questions.

TODAY: ${dayOfWeek}, ${today}
TIME: ${timeLabel}
${notesSection}

TASKS (${pendingTasks.length} pending${todayTasks.length > 0 ? `, ${todayTasks.length} today` : ''}):
${pendingTasks.map(t => `- [${t.status}] ${t.title} (${t.priority}${t.due_date ? ', due ' + t.due_date.slice(0, 10) : ''}${t.due_time ? ' ' + t.due_time : ''})`).join('\n') || '- None'}

UPCOMING EVENTS:
${events.rows.map(e => `- ${e.title} on ${new Date(e.start_time).toLocaleDateString()} at ${new Date(e.start_time).toLocaleTimeString([], {hour: 'numeric', minute: '2-digit'})}${e.location ? ' @ ' + e.location : ''}`).join('\n') || '- None'}

RULES — follow these exactly:

1. PLAN IMMEDIATELY. When asked to plan something (a day, a trip, a party, anything), OUTPUT A FULL PLAN right away. Use the user's existing tasks/events as anchors. Fill gaps with smart suggestions. NEVER respond with "what would you like to do?" or a list of questions. Just plan it.

2. FORMAT FOR READABILITY:
   - Day plans: Use "Morning:", "Afternoon:", "Evening:" headers
   - Each item: "- 9:00 AM: Activity description"
   - Lists: Simple bullets
   - Keep it scannable — no walls of text

3. BE SPECIFIC AND REAL. Don't say "plan an activity." Say "- 2:00 PM: 30-minute walk at the park." Give actual times, actual suggestions. Use what you know about the user.

4. WHEN YOU NEED INPUT, use multiple choice. Format choices like this:
   [OPTIONS: Choice A | Choice B | Choice C]
   This shows the user clickable buttons. Always include 3-5 options. Only ask ONE question at a time and ONLY when truly needed (like "plan a birthday party" — you'd need to know whose birthday).

5. SHAREABLE TEXT. When generating invitations, messages, or plans to share, wrap them in:
   [SHARE]
   The text content here that can be copied/sent
   [/SHARE]

6. LEARN PREFERENCES. When the user mentions likes, dislikes, routines, or personal info, save a note:
\`\`\`note
{"category": "food", "note": "Likes Italian food"}
\`\`\`
Categories: food, schedule, routine, hobbies, social, work, health, preferences, commitments, birthdays

7. KEEP IT SHORT. No filler. No "Great question!" No "I'd be happy to help!" Just do the thing.

8. PROACTIVE SUGGESTIONS. After completing a plan, suggest a next step: "Want me to create tasks for this?" or "Should I draft an invitation to send?"

9. BRIEF SUMMARY. After every plan, add a one-line TL;DR at the bottom, like:
   "Summary: 6 items planned, busy morning, free evening."

10. BIRTHDAYS & ANNUAL EVENTS. When a user mentions a birthday or annual event, save it as a note with category "birthdays" and suggest creating an annual recurring event.`;


      const chatMessages = recentChat.rows.reverse().map(m => ({ role: m.role, content: m.content }));
      chatMessages.push({ role: 'user', content: message });

      const fullContent = await streamChat(systemPrompt, chatMessages, res);

      // Save assistant response
      if (fullContent) {
        await pool.query('INSERT INTO chat_history (user_id, role, content) VALUES ($1, $2, $3)', [req.userId, 'assistant', fullContent]);

        // Extract and save any note blocks
        const noteRegex = /```note\s*\n?\s*({[\s\S]*?})\s*\n?\s*```/g;
        let match;
        while ((match = noteRegex.exec(fullContent)) !== null) {
          try {
            const note = JSON.parse(match[1]);
            if (note.category && note.note) {
              const existing = await pool.query(
                'SELECT id FROM user_notes WHERE user_id = $1 AND category = $2 AND note = $3',
                [req.userId, note.category, note.note]
              );
              if (existing.rows.length === 0) {
                await pool.query(
                  'INSERT INTO user_notes (user_id, category, note) VALUES ($1, $2, $3)',
                  [req.userId, note.category, note.note]
                );
              }
            }
          } catch {}
        }
      }
    } catch (err) {
      console.error('Chat error:', err);
      if (!res.headersSent) res.status(500).json({ error: 'Chat failed' });
    }
  });

  // Clear history
  router.delete('/history', async (req, res) => {
    try {
      await pool.query('DELETE FROM chat_history WHERE user_id = $1', [req.userId]);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: 'Server error' });
    }
  });

  // Delete a specific note
  router.delete('/notes/:id', async (req, res) => {
    try {
      await pool.query('DELETE FROM user_notes WHERE id = $1 AND user_id = $2', [req.params.id, req.userId]);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: 'Server error' });
    }
  });

  return router;
};
