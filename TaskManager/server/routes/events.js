const express = require('express');
const router = express.Router();
const { generateInvitation } = require('../services/ai');

module.exports = (pool) => {
  // Generate recurring instances of an event within a date range
  function expandRecurring(events, rangeStart, rangeEnd) {
    const result = [];
    for (const ev of events) {
      result.push(ev);
      if (!ev.recurrence || ev.recurrence === 'none') continue;

      const evStart = new Date(ev.start_time);
      const evEnd = ev.end_time ? new Date(ev.end_time) : null;
      const duration = evEnd ? evEnd - evStart : 0;
      const rStart = new Date(rangeStart);
      const rEnd = new Date(rangeEnd);

      // Generate up to 60 occurrences within the range
      for (let i = 1; i <= 60; i++) {
        const next = new Date(evStart);
        if (ev.recurrence === 'daily') next.setDate(next.getDate() + i);
        else if (ev.recurrence === 'weekly') next.setDate(next.getDate() + i * 7);
        else if (ev.recurrence === 'monthly') next.setMonth(next.getMonth() + i);
        else if (ev.recurrence === 'annual') next.setFullYear(next.getFullYear() + i);
        else break;

        if (next > rEnd) break;
        if (next < rStart) continue;

        const nextEnd = evEnd ? new Date(next.getTime() + duration) : null;
        result.push({
          ...ev,
          id: `${ev.id}_r${i}`,
          start_time: next.toISOString(),
          end_time: nextEnd ? nextEnd.toISOString() : null,
          _recurring: true
        });
      }
    }
    return result;
  }

  // Get events
  router.get('/', async (req, res) => {
    try {
      const { date, start, end } = req.query;

      if (date) {
        // Single date query - also check recurring events
        const result = await pool.query('SELECT * FROM events WHERE user_id = $1 ORDER BY start_time ASC', [req.userId]);
        const dayStart = new Date(date + 'T00:00:00');
        const dayEnd = new Date(date + 'T23:59:59');
        const expanded = expandRecurring(result.rows, dayStart, dayEnd);
        const filtered = expanded.filter(e => {
          const eDate = new Date(e.start_time).toISOString().slice(0, 10);
          return eDate === date.slice(0, 10);
        });
        return res.json(filtered);
      }

      if (start && end) {
        // Range query - get all events and expand recurring ones
        const result = await pool.query('SELECT * FROM events WHERE user_id = $1 ORDER BY start_time ASC', [req.userId]);
        const expanded = expandRecurring(result.rows, start, end);
        const filtered = expanded.filter(e => {
          const eTime = new Date(e.start_time);
          return eTime >= new Date(start) && eTime <= new Date(end);
        });
        return res.json(filtered);
      }

      // No filter - return all
      const result = await pool.query('SELECT * FROM events WHERE user_id = $1 ORDER BY start_time ASC', [req.userId]);
      res.json(result.rows);
    } catch (err) {
      console.error('Get events error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // Create event
  router.post('/', async (req, res) => {
    try {
      const { title, description, location, startTime, endTime, color, attendees, recurrence } = req.body;
      if (!title || !startTime) return res.status(400).json({ error: 'Title and start time required' });

      const result = await pool.query(
        `INSERT INTO events (user_id, title, description, location, start_time, end_time, color, attendees, recurrence)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
        [req.userId, title, description || null, location || null, startTime, endTime || null, color || '#2563eb', attendees || null, recurrence || 'none']
      );
      res.json(result.rows[0]);
    } catch (err) {
      console.error('Create event error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // Update event
  router.put('/:id', async (req, res) => {
    try {
      const { title, description, location, startTime, endTime, color, attendees, invitationText } = req.body;
      const result = await pool.query(
        `UPDATE events SET title = COALESCE($1, title), description = COALESCE($2, description),
         location = COALESCE($3, location), start_time = COALESCE($4, start_time),
         end_time = COALESCE($5, end_time), color = COALESCE($6, color),
         attendees = COALESCE($7, attendees), invitation_text = COALESCE($8, invitation_text)
         WHERE id = $9 AND user_id = $10 RETURNING *`,
        [title, description, location, startTime, endTime, color, attendees, invitationText, req.params.id, req.userId]
      );
      if (!result.rows.length) return res.status(404).json({ error: 'Event not found' });
      res.json(result.rows[0]);
    } catch (err) {
      res.status(500).json({ error: 'Server error' });
    }
  });

  // Delete event
  router.delete('/:id', async (req, res) => {
    try {
      const result = await pool.query('DELETE FROM events WHERE id = $1 AND user_id = $2 RETURNING id', [req.params.id, req.userId]);
      if (!result.rows.length) return res.status(404).json({ error: 'Event not found' });
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: 'Server error' });
    }
  });

  // Generate invitation for event
  router.post('/:id/invitation', async (req, res) => {
    try {
      const result = await pool.query('SELECT * FROM events WHERE id = $1 AND user_id = $2', [req.params.id, req.userId]);
      if (!result.rows.length) return res.status(404).json({ error: 'Event not found' });

      const event = result.rows[0];
      const invitation = await generateInvitation({
        title: event.title,
        description: event.description,
        location: event.location,
        startTime: event.start_time,
        endTime: event.end_time,
        attendees: event.attendees
      });

      await pool.query('UPDATE events SET invitation_text = $1 WHERE id = $2', [invitation, event.id]);
      res.json({ invitation });
    } catch (err) {
      console.error('Generate invitation error:', err);
      res.status(500).json({ error: 'Failed to generate invitation' });
    }
  });

  return router;
};
