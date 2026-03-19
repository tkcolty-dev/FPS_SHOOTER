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

      const systemPrompt = `You are a planning assistant for ${userName}. Today is ${dayOfWeek}, ${today}, ${timeLabel}.
${notesSection}

Their tasks: ${pendingTasks.map(t => `${t.title} (${t.priority}${t.due_date ? ', due ' + t.due_date.slice(0, 10) : ''}${t.due_time ? ' at ' + t.due_time : ''})`).join('; ') || 'None'}

Their events: ${events.rows.map(e => `${e.title} on ${new Date(e.start_time).toLocaleDateString()} ${new Date(e.start_time).toLocaleTimeString([], {hour: 'numeric', minute: '2-digit'})}${e.location ? ' @ ' + e.location : ''}`).join('; ') || 'None'}

RULES:
1. ASK BEFORE CREATING. When the user asks you to plan something, first show a quick summary of what you'd plan and ask "Want me to add this to your calendar?" or give options. Only output [PLAN], [CHECKLIST], or [EVENT] tags AFTER the user confirms (says "yes", "do it", "go ahead", "plan it", "add it", "sure", "ok", etc). If the user's message is a confirmation like those, THEN output the tags to create everything.

2. PLAN = FULL SCHEDULE. When confirmed, build a COMPLETE hour-by-hour plan that includes their EXISTING tasks and events at their scheduled times PLUS new activities filling the gaps. Output inside [PLAN] tags:

[PLAN: March 19]
- 8:00 AM: Wake up, breakfast
- 9:00 AM: Existing task - Project review (high priority)
- 10:30 AM: Break + coffee
- 11:00 AM: Work on presentation
- 12:00 PM: Lunch
- 1:00 PM: Existing event - Team meeting @ Office
- 2:30 PM: Follow up on meeting action items
- 5:00 PM: Gym - 30 min cardio
- 6:30 PM: Dinner
- 8:00 PM: Free time / relax
[/PLAN]

IMPORTANT: [PLAN], [CHECKLIST], and [EVENT] blocks are AUTO-SAVED. Only use them after the user approves.

3. CHECKLISTS. For project breakdowns or step-by-step lists (after user confirms):

[CHECKLIST: Project name]
- First step
- Second step
- Third step
[/CHECKLIST]

AUTO-SAVED as tasks after user confirms.

4. EVENTS. When confirmed, create events (party, meeting, appointment, dinner):

[EVENT: Party name]
title: Birthday Party for Sarah
start: 2026-03-22T18:00
end: 2026-03-22T21:00
location: Pizza Palace
description: Surprise party
[/EVENT]

AUTO-SAVED as a calendar event after user confirms.

5. ASK GOOD QUESTIONS. Use [OPTIONS:] to gather what you need. Example:
   "What kind of party are you thinking?"
   [OPTIONS: Birthday | Dinner party | Game night | Holiday | Other]

6. Be specific with times. "2:00 PM: Walk at the park" not "plan some exercise."
7. Keep responses SHORT. Brief and conversational.
8. Shareable text: [SHARE]text[/SHARE]
9. Save preferences: \`\`\`note\n{"category": "birthdays", "note": "Mom's bday March 5"}\n\`\`\`
10. When the user says "yes", "do it", "plan it", "go ahead", "sure", "add it", "create it" — THAT is when you output [PLAN]/[EVENT]/[CHECKLIST] tags. Not before.
11. Use common sense: birthday party = [EVENT], daily schedule = [PLAN], project steps = [CHECKLIST].`;


      const chatMessages = recentChat.rows.reverse().map(m => ({ role: m.role, content: m.content }));
      chatMessages.push({ role: 'user', content: message });

      const fullContent = await streamChat(systemPrompt, chatMessages, res);

      // Save assistant response and auto-create tasks/events
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

        // Auto-create tasks from [PLAN] blocks
        const planRegex = /\[PLAN:?\s*([^\]]*)\]([\s\S]*?)\[\/PLAN\]/g;
        let planMatch;
        while ((planMatch = planRegex.exec(fullContent)) !== null) {
          try {
            const planTitle = planMatch[1].trim();
            const items = planMatch[2].trim().split('\n').map(l => l.replace(/^[-*]\s*/, '').trim()).filter(Boolean);

            // Parse date from title
            let dueDate = today;
            if (/tomorrow/i.test(planTitle)) {
              const t = new Date(); t.setDate(t.getDate() + 1);
              dueDate = t.toISOString().slice(0, 10);
            } else {
              const dm = planTitle.match(/(\w+)\s+(\d{1,2})/);
              if (dm) {
                const parsed = new Date(`${dm[1]} ${dm[2]}, ${new Date().getFullYear()}`);
                if (!isNaN(parsed)) dueDate = parsed.toISOString().slice(0, 10);
              }
            }

            for (const item of items) {
              const timeMatch = item.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM|am|pm)\s*[-:]\s*(.*)/);
              let title = item, dueTime = null;
              if (timeMatch) {
                let h = parseInt(timeMatch[1]);
                const m = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
                const p = timeMatch[3].toUpperCase();
                if (p === 'PM' && h !== 12) h += 12;
                if (p === 'AM' && h === 12) h = 0;
                dueTime = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
                title = timeMatch[4].trim();
              }
              if (title) {
                await pool.query(
                  'INSERT INTO tasks (user_id, title, priority, due_date, due_time) VALUES ($1, $2, $3, $4, $5)',
                  [req.userId, title, 'medium', dueDate, dueTime]
                );
              }
            }
          } catch (e) { console.error('Auto-create plan tasks error:', e); }
        }

        // Auto-create tasks from [CHECKLIST] blocks
        const checkRegex = /\[CHECKLIST:?\s*([^\]]*)\]([\s\S]*?)\[\/CHECKLIST\]/g;
        let checkMatch;
        while ((checkMatch = checkRegex.exec(fullContent)) !== null) {
          try {
            const listTitle = checkMatch[1].trim();
            const items = checkMatch[2].trim().split('\n').map(l => l.replace(/^[-*]\s*/, '').trim()).filter(Boolean);
            for (const item of items) {
              if (item) {
                await pool.query(
                  'INSERT INTO tasks (user_id, title, description, priority) VALUES ($1, $2, $3, $4)',
                  [req.userId, item, listTitle ? `Checklist: ${listTitle}` : null, 'medium']
                );
              }
            }
          } catch (e) { console.error('Auto-create checklist tasks error:', e); }
        }

        // Auto-create events from [EVENT] blocks
        const eventRegex = /\[EVENT:?\s*([^\]]*)\]([\s\S]*?)\[\/EVENT\]/g;
        let eventMatch;
        while ((eventMatch = eventRegex.exec(fullContent)) !== null) {
          try {
            const evData = {};
            eventMatch[2].trim().split('\n').forEach(line => {
              const [key, ...rest] = line.split(':');
              if (key && rest.length) evData[key.trim().toLowerCase()] = rest.join(':').trim();
            });
            if (evData.title || eventMatch[1].trim()) {
              await pool.query(
                'INSERT INTO events (user_id, title, description, location, start_time, end_time, color) VALUES ($1, $2, $3, $4, $5, $6, $7)',
                [req.userId, evData.title || eventMatch[1].trim(), evData.description || null,
                 evData.location || null, evData.start || evData.when || null, evData.end || null, '#2563eb']
              );
            }
          } catch (e) { console.error('Auto-create event error:', e); }
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
