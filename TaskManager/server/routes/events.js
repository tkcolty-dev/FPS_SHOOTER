const express = require('express');
const router = express.Router();
const { generateInvitation } = require('../services/ai');

module.exports = (pool) => {
  // Generate recurring instances of an event within a date range
  function expandRecurring(events, rangeStart, rangeEnd) {
    const result = [];
    const rStart = new Date(rangeStart);
    const rEnd = new Date(rangeEnd);

    for (const ev of events) {
      try {
        // Convert start_time to ISO string if it's a Date object
        const stStr = ev.start_time instanceof Date ? ev.start_time.toISOString() : String(ev.start_time);
        const etStr = ev.end_time ? (ev.end_time instanceof Date ? ev.end_time.toISOString() : String(ev.end_time)) : null;
        const normalized = { ...ev, start_time: stStr, end_time: etStr };

        result.push(normalized);
        if (!ev.recurrence || ev.recurrence === 'none') continue;

        const evStart = new Date(stStr);
        if (isNaN(evStart)) continue;
        const duration = etStr ? new Date(etStr) - evStart : 0;

        for (let i = 1; i <= 60; i++) {
          const next = new Date(evStart);
          if (ev.recurrence === 'daily') next.setDate(next.getDate() + i);
          else if (ev.recurrence === 'weekly') next.setDate(next.getDate() + i * 7);
          else if (ev.recurrence === 'monthly') next.setMonth(next.getMonth() + i);
          else if (ev.recurrence === 'annual') next.setFullYear(next.getFullYear() + i);
          else break;

          if (next > rEnd) break;
          if (next < rStart) continue;

          result.push({
            ...normalized,
            id: `${ev.id}_r${i}`,
            start_time: next.toISOString(),
            end_time: duration ? new Date(next.getTime() + duration).toISOString() : null,
            _recurring: true
          });
        }
      } catch (e) {
        // Skip bad events, still include the original
        result.push(ev);
      }
    }
    return result;
  }

  // Get events
  router.get('/', async (req, res) => {
    try {
      const { date, start, end } = req.query;
      let q = 'SELECT * FROM events WHERE user_id = $1';
      const params = [req.userId];
      let idx = 2;

      if (date) {
        // Get all events for recurring expansion
        const result = await pool.query(q + ' ORDER BY start_time ASC', params);
        const dayStart = new Date(date + 'T00:00:00');
        const dayEnd = new Date(date + 'T23:59:59');
        const expanded = expandRecurring(result.rows, dayStart, dayEnd);
        const filtered = expanded.filter(e => {
          const d = new Date(e.start_time);
          return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` === date.slice(0, 10);
        });
        return res.json(filtered);
      }

      if (start && end) {
        const result = await pool.query(q + ' ORDER BY start_time ASC', params);
        const expanded = expandRecurring(result.rows, start, end);
        return res.json(expanded);
      }

      // No filter
      const result = await pool.query(q + ' ORDER BY start_time ASC', params);
      res.json(result.rows);
    } catch (err) {
      console.error('Get events error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // Force datetime-local values to be stored as-is without timezone conversion
  // We store as a TIMESTAMP string that postgres won't shift
  function fixLocalTime(dt) {
    if (!dt) return null;
    // Strip any timezone info so postgres stores the literal datetime
    const clean = String(dt).replace(/Z$/, '').replace(/[+-]\d{2}:\d{2}$/, '');
    return clean;
  }

  // Create event
  router.post('/', async (req, res) => {
    try {
      const { title, description, location, startTime, endTime, color, attendees, recurrence } = req.body;
      if (!title || !startTime) return res.status(400).json({ error: 'Title and start time required' });

      const result = await pool.query(
        `INSERT INTO events (user_id, title, description, location, start_time, end_time, color, attendees, recurrence)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
        [req.userId, title, description || null, location || null, fixLocalTime(startTime), fixLocalTime(endTime), color || '#2563eb', attendees || null, recurrence || 'none']
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
        [title, description, location, fixLocalTime(startTime), fixLocalTime(endTime), color, attendees, invitationText, req.params.id, req.userId]
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
