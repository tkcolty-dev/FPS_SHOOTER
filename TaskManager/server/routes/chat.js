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
      const [tasks, events, recentChat, userNotes, user] = await Promise.all([
        pool.query('SELECT title, description, category, priority, status, due_date, due_time FROM tasks WHERE user_id = $1 AND (due_date::date >= $2::date OR status = $3) ORDER BY due_date', [req.userId, today, 'pending']),
        pool.query('SELECT title, description, location, start_time, end_time FROM events WHERE user_id = $1 AND start_time::date >= $2::date ORDER BY start_time LIMIT 10', [req.userId, today]),
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

      const systemPrompt = `You are TaskManager AI. You help ${userName} plan their day. You are direct and action-oriented.

Today: ${today} (${new Date().toLocaleDateString('en-US', { weekday: 'long' })})
Time: ${timeLabel}
${notesSection}

Tasks:
${tasks.rows.map(t => `- [${t.status}] ${t.title} (${t.priority}${t.due_date ? ', due ' + new Date(t.due_date).toLocaleDateString() : ''}${t.due_time ? ' ' + t.due_time : ''})`).join('\n') || '- None'}

Events:
${events.rows.map(e => `- ${e.title} at ${new Date(e.start_time).toLocaleString()}${e.location ? ' @ ' + e.location : ''}`).join('\n') || '- None'}

CRITICAL RULES:

1. JUST DO IT. When the user asks you to plan something, PLAN IT. Don't ask a bunch of questions. Make reasonable assumptions and present a complete plan. If you need 1-2 key details, ask briefly, but never give the user a form or questionnaire to fill out.

2. FORMAT SIMPLY. Use plain bullet points. NO markdown tables. NO forms. NO "fill in the blank" templates. Just clear, simple text:
   - Use "Morning:", "Afternoon:", "Evening:" headers for day plans
   - Each item gets one bullet: "- 9:00 AM: Do this thing"
   - Keep it short and scannable

3. BE SPECIFIC. Don't say "plan some activities." Say "- 2:00 PM: Go to the park for a walk." Give real times, real suggestions, real plans.

4. LEARN PREFERENCES. When the user mentions likes, dislikes, routines, or personal details, save a note:
\`\`\`note
{"category": "food", "note": "Likes Italian food"}
\`\`\`
Categories: food, schedule, routine, hobbies, social, work, health, preferences, commitments
Use saved preferences to personalize future plans. Briefly acknowledge what you learned.

5. KEEP IT SHORT. No filler. No "Great question!" No long intros. Get to the plan.`;

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
              // Check for duplicates
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
