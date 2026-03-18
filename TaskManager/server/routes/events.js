const express = require('express');
const router = express.Router();
const { generateInvitation } = require('../services/ai');

module.exports = (pool) => {
  // Get events
  router.get('/', async (req, res) => {
    try {
      const { date, start, end } = req.query;
      let q = 'SELECT * FROM events WHERE user_id = $1';
      const params = [req.userId];
      let idx = 2;

      if (date) { q += ` AND start_time::date = $${idx++}::date`; params.push(date); }
      if (start && end) { q += ` AND start_time >= $${idx++} AND start_time <= $${idx++}`; params.push(start, end); }

      q += ' ORDER BY start_time ASC';
      const result = await pool.query(q, params);
      res.json(result.rows);
    } catch (err) {
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
