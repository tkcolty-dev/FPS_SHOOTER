import React, { useState, useEffect, useCallback } from 'react';
import { API, useToast } from '../App';
import { IconPlus, IconChevronLeft, IconChevronRight, IconClock, IconMapPin, IconUsers, IconEdit, IconTrash, IconMail, IconCopy, IconX } from '../icons';

const EVENT_COLORS = ['#2563eb', '#16a34a', '#ea580c', '#dc2626', '#7c3aed', '#0891b2', '#c026d3', '#65a30d'];

export default function Calendar() {
  const showToast = useToast();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [events, setEvents] = useState([]);
  const [allEvents, setAllEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [showInvitation, setShowInvitation] = useState(null);
  const [generatingInvite, setGeneratingInvite] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', location: '', startTime: '', endTime: '', color: '#2563eb', attendees: '' });

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const loadEvents = useCallback(async () => {
    try {
      const start = new Date(year, month, 1).toISOString();
      const end = new Date(year, month + 1, 0, 23, 59, 59).toISOString();
      setAllEvents(await API(`/events?start=${start}&end=${end}`));
    } catch {} finally { setLoading(false); }
  }, [year, month]);

  useEffect(() => { loadEvents(); }, [loadEvents]);

  useEffect(() => {
    const ds = selectedDate.toISOString().slice(0, 10);
    setEvents(allEvents.filter(e => e.start_time.slice(0, 10) === ds));
  }, [selectedDate, allEvents]);

  const getDaysInMonth = () => {
    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0);
    const startDay = first.getDay();
    const days = [];
    for (let i = startDay - 1; i >= 0; i--) days.push({ date: new Date(year, month, -i), other: true });
    for (let i = 1; i <= last.getDate(); i++) days.push({ date: new Date(year, month, i), other: false });
    const rem = 7 - (days.length % 7);
    if (rem < 7) for (let i = 1; i <= rem; i++) days.push({ date: new Date(year, month + 1, i), other: true });
    return days;
  };

  const hasEvent = (date) => {
    const ds = date.toISOString().slice(0, 10);
    return allEvents.some(e => e.start_time.slice(0, 10) === ds);
  };

  const isToday = (d) => d.toDateString() === new Date().toDateString();
  const isSelected = (d) => d.toDateString() === selectedDate.toDateString();

  const resetForm = () => {
    setForm({ title: '', description: '', location: '', startTime: '', endTime: '', color: '#2563eb', attendees: '' });
    setEditingEvent(null);
    setShowForm(false);
  };

  const openNewEvent = () => {
    const ds = selectedDate.toISOString().slice(0, 10);
    setForm({ ...form, startTime: `${ds}T09:00`, endTime: `${ds}T10:00`, title: '', description: '', location: '', color: '#2563eb', attendees: '' });
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.startTime) return;
    try {
      if (editingEvent) {
        await API(`/events/${editingEvent.id}`, { method: 'PUT', body: form });
        showToast('Event Updated', form.title);
      } else {
        await API('/events', { method: 'POST', body: form });
        showToast('Event Created', form.title);
      }
      resetForm();
      loadEvents();
    } catch (err) { showToast('Error', err.message, 'error'); }
  };

  const deleteEvent = async (id) => {
    await API(`/events/${id}`, { method: 'DELETE' });
    loadEvents();
    showToast('Deleted', 'Event removed');
  };

  const editEvent = (ev) => {
    setForm({
      title: ev.title, description: ev.description || '', location: ev.location || '',
      startTime: ev.start_time.slice(0, 16), endTime: ev.end_time ? ev.end_time.slice(0, 16) : '',
      color: ev.color || '#2563eb', attendees: ev.attendees || ''
    });
    setEditingEvent(ev);
    setShowForm(true);
  };

  const generateInvite = async (ev) => {
    setGeneratingInvite(true);
    try {
      const data = await API(`/events/${ev.id}/invitation`, { method: 'POST' });
      setShowInvitation({ ...ev, invitation_text: data.invitation });
      showToast('Invitation Ready', 'AI generated your invitation');
    } catch { showToast('Error', 'Failed to generate invitation', 'error'); }
    finally { setGeneratingInvite(false); }
  };

  const ft = (dt) => new Date(dt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const monthName = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  if (loading) return <div className="loading-center"><div className="spinner" /></div>;

  return (
    <div>
      <div className="page-header">
        <h1>Calendar</h1>
        <p>Schedule events and manage your time</p>
      </div>

      {/* Compact calendar */}
      <div className="card calendar-card">
        <div className="calendar-header">
          <button className="btn btn-ghost btn-sm" onClick={() => setCurrentDate(new Date(year, month - 1, 1))}><IconChevronLeft size={18} /></button>
          <h3 style={{ fontSize: '0.95rem' }}>{monthName}</h3>
          <button className="btn btn-ghost btn-sm" onClick={() => setCurrentDate(new Date(year, month + 1, 1))}><IconChevronRight size={18} /></button>
        </div>
        <div className="calendar-grid">
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
            <div key={i} className="calendar-day-header">{d}</div>
          ))}
          {getDaysInMonth().map((d, i) => (
            <div
              key={i}
              className={`calendar-day ${d.other ? 'other-month' : ''} ${isToday(d.date) ? 'today' : ''} ${isSelected(d.date) ? 'selected' : ''}`}
              onClick={() => !d.other && setSelectedDate(d.date)}
            >
              {d.date.getDate()}
              {hasEvent(d.date) && !isSelected(d.date) && <span className="dot" />}
            </div>
          ))}
        </div>
      </div>

      {/* Selected day */}
      <div className="card">
        <div className="card-title">
          <span>{selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</span>
          <button className="btn btn-sm btn-primary" onClick={openNewEvent}><IconPlus size={14} /> Event</button>
        </div>
        {events.length === 0 ? (
          <div className="empty-state-inline"><p>No events on this day</p></div>
        ) : events.map(e => (
          <div key={e.id} className="event-item">
            <div className="event-color-bar" style={{ background: e.color || '#2563eb' }} />
            <div className="event-body">
              <div className="event-title">{e.title}</div>
              <div className="event-time"><IconClock size={12} /> {ft(e.start_time)}{e.end_time ? ` - ${ft(e.end_time)}` : ''}</div>
              {e.location && <div className="event-location"><IconMapPin size={12} /> {e.location}</div>}
              {e.description && <div className="task-desc">{e.description}</div>}
              {e.attendees && <div className="event-location"><IconUsers size={12} /> {e.attendees}</div>}
              <div className="flex gap-sm" style={{ marginTop: '0.5rem' }}>
                <button className="btn btn-sm btn-secondary" onClick={() => editEvent(e)}><IconEdit size={14} /> Edit</button>
                <button className="btn btn-sm btn-secondary" onClick={() => generateInvite(e)} disabled={generatingInvite}>
                  <IconMail size={14} /> {generatingInvite ? '...' : 'Invite'}
                </button>
                <button className="btn btn-sm btn-danger" onClick={() => deleteEvent(e.id)}><IconTrash size={14} /></button>
              </div>
              {e.invitation_text && <div className="invitation-preview">{e.invitation_text}</div>}
            </div>
          </div>
        ))}
      </div>

      {/* Event form modal */}
      {showForm && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && resetForm()}>
          <div className="modal">
            <div className="modal-header">
              <h3>{editingEvent ? 'Edit Event' : 'New Event'}</h3>
              <button className="modal-close" onClick={resetForm}><IconX size={20} /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Title</label>
                  <input type="text" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Event name" required autoFocus />
                </div>
                <div className="form-group">
                  <label>Description</label>
                  <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Details (optional)" rows="2" />
                </div>
                <div className="form-group">
                  <label>Location</label>
                  <input type="text" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} placeholder="Where?" />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Start</label>
                    <input type="datetime-local" value={form.startTime} onChange={e => setForm({ ...form, startTime: e.target.value })} required />
                  </div>
                  <div className="form-group">
                    <label>End</label>
                    <input type="datetime-local" value={form.endTime} onChange={e => setForm({ ...form, endTime: e.target.value })} />
                  </div>
                </div>
                <div className="form-group">
                  <label>Attendees</label>
                  <input type="text" value={form.attendees} onChange={e => setForm({ ...form, attendees: e.target.value })} placeholder="Names, separated by commas" />
                </div>
                <div className="form-group">
                  <label>Color</label>
                  <div className="color-options">
                    {EVENT_COLORS.map(c => (
                      <button key={c} type="button" className={`color-dot ${form.color === c ? 'selected' : ''}`} style={{ background: c }} onClick={() => setForm({ ...form, color: c })} />
                    ))}
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={resetForm}>Cancel</button>
                <button type="submit" className="btn btn-primary">{editingEvent ? 'Save' : 'Create Event'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Invitation modal */}
      {showInvitation && (
        <div className="modal-overlay" onClick={() => setShowInvitation(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Event Invitation</h3>
              <button className="modal-close" onClick={() => setShowInvitation(null)}><IconX size={20} /></button>
            </div>
            <div className="modal-body">
              <div className="invitation-preview">{showInvitation.invitation_text}</div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => {
                navigator.clipboard.writeText(showInvitation.invitation_text);
                showToast('Copied!', 'Invitation copied to clipboard');
              }}><IconCopy size={14} /> Copy</button>
              <button className="btn btn-primary" onClick={() => setShowInvitation(null)}>Done</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
