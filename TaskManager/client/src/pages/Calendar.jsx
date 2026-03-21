import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { API, useToast } from '../App';
import { IconPlus, IconChevronLeft, IconChevronRight, IconClock, IconMapPin, IconUsers, IconEdit, IconTrash, IconMail, IconCopy, IconX, IconCheck } from '../icons';

const EVENT_COLORS = ['#2563eb', '#16a34a', '#ea580c', '#dc2626', '#7c3aed', '#0891b2', '#c026d3', '#65a30d'];

const toDateStr = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
};

export default function Calendar() {
  const showToast = useToast();
  const [searchParams] = useSearchParams();
  const initialDate = () => {
    const dp = searchParams.get('date');
    if (dp) { const d = new Date(dp + 'T12:00:00'); if (!isNaN(d)) return d; }
    return new Date();
  };
  const [currentDate, setCurrentDate] = useState(initialDate);
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [events, setEvents] = useState([]);
  const [allEvents, setAllEvents] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [allTasks, setAllTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formType, setFormType] = useState('event'); // 'event' or 'task'
  const [editingEvent, setEditingEvent] = useState(null);
  const [showInvitation, setShowInvitation] = useState(null);
  const [generatingInvite, setGeneratingInvite] = useState(false);
  const [viewMode, setViewMode] = useState('month'); // 'month' or 'week'
  const [form, setForm] = useState({ title: '', description: '', location: '', startTime: '', endTime: '', color: '#2563eb', attendees: '', recurrence: 'none' });
  const [taskForm, setTaskForm] = useState({ title: '', description: '', category: 'general', priority: 'medium', dueTime: '' });
  const weekStripRef = useRef(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const loadData = useCallback(async () => {
    try {
      const start = new Date(year, month, 1).toISOString();
      const end = new Date(year, month + 1, 0, 23, 59, 59).toISOString();
      const [evts, tsks] = await Promise.all([
        API(`/events?start=${start}&end=${end}`),
        API(`/tasks?status=pending`)
      ]);
      setAllEvents(evts);
      setAllTasks(tsks);
    } catch {} finally { setLoading(false); }
  }, [year, month]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    const ds = toDateStr(selectedDate);
    setEvents(allEvents.filter(e => e.start_time.slice(0, 10) === ds));
    setTasks(allTasks.filter(t => t.due_date && t.due_date.slice(0, 10) === ds));
  }, [selectedDate, allEvents, allTasks]);

  // Week strip data
  const getWeekDays = () => {
    const today = new Date();
    const start = new Date(today);
    start.setDate(start.getDate() - start.getDay());
    const days = [];
    for (let i = 0; i < 14; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      days.push(d);
    }
    return days;
  };

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
    const ds = toDateStr(date);
    return allEvents.some(e => e.start_time.slice(0, 10) === ds);
  };

  const hasTask = (date) => {
    const ds = toDateStr(date);
    return allTasks.some(t => t.due_date && t.due_date.slice(0, 10) === ds);
  };

  const getDateCount = (date) => {
    const ds = toDateStr(date);
    return allEvents.filter(e => e.start_time.slice(0, 10) === ds).length +
           allTasks.filter(t => t.due_date && t.due_date.slice(0, 10) === ds).length;
  };

  const getDateItems = (date) => {
    const ds = toDateStr(date);
    const evts = allEvents.filter(e => e.start_time.slice(0, 10) === ds);
    const tsks = allTasks.filter(t => t.due_date && t.due_date.slice(0, 10) === ds);
    return { events: evts, tasks: tsks };
  };

  const isToday = (d) => d.toDateString() === new Date().toDateString();
  const isSelected = (d) => d.toDateString() === selectedDate.toDateString();

  const resetForm = () => {
    setForm({ title: '', description: '', location: '', startTime: '', endTime: '', color: '#2563eb', attendees: '' });
    setTaskForm({ title: '', description: '', category: 'general', priority: 'medium', dueTime: '' });
    setEditingEvent(null);
    setShowForm(false);
    setFormType('event');
  };

  const openNewEvent = () => {
    const ds = toDateStr(selectedDate);
    setForm({ ...form, startTime: `${ds}T09:00`, endTime: `${ds}T10:00`, title: '', description: '', location: '', color: '#2563eb', attendees: '' });
    setFormType('event');
    setShowForm(true);
  };

  const openNewTask = () => {
    setTaskForm({ title: '', description: '', category: 'general', priority: 'medium', dueTime: '' });
    setFormType('task');
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (formType === 'task') {
        if (!taskForm.title.trim()) return;
        const ds = toDateStr(selectedDate);
        await API('/tasks', { method: 'POST', body: { ...taskForm, dueDate: ds, dueTime: taskForm.dueTime } });
        showToast('Task Created', taskForm.title);
      } else {
        if (!form.title.trim() || !form.startTime) return;
        if (editingEvent) {
          await API(`/events/${editingEvent.id}`, { method: 'PUT', body: form });
          showToast('Event Updated', form.title);
        } else {
          await API('/events', { method: 'POST', body: form });
          showToast('Event Created', form.title);
        }
      }
      resetForm();
      loadData();
    } catch (err) { showToast('Error', err.message, 'error'); }
  };

  const deleteEvent = async (id) => {
    await API(`/events/${id}`, { method: 'DELETE' });
    loadData();
    showToast('Deleted', 'Event removed');
  };

  const editEvent = (ev) => {
    setForm({
      title: ev.title, description: ev.description || '', location: ev.location || '',
      startTime: ev.start_time.slice(0, 16), endTime: ev.end_time ? ev.end_time.slice(0, 16) : '',
      color: ev.color || '#2563eb', attendees: ev.attendees || ''
    });
    setEditingEvent(ev);
    setFormType('event');
    setShowForm(true);
  };

  const toggleTask = async (task) => {
    const newStatus = task.status === 'completed' ? 'pending' : 'completed';
    await API(`/tasks/${task.id}`, { method: 'PUT', body: { status: newStatus } });
    loadData();
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
  const monthName = currentDate.toLocaleDateString('en-US', { month: 'long' });
  const showYear = year !== new Date().getFullYear();
  const headerLabel = showYear ? `${monthName} ${year}` : monthName;

  if (loading) return <div className="loading-center"><div className="spinner" /></div>;

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1>Calendar</h1>
            <p>Schedule events and manage your time</p>
          </div>
          <div className="view-toggle">
            <button className={viewMode === 'week' ? 'active' : ''} onClick={() => setViewMode('week')}>Week</button>
            <button className={viewMode === 'month' ? 'active' : ''} onClick={() => setViewMode('month')}>Month</button>
          </div>
        </div>
      </div>

      {/* Week Strip View */}
      {viewMode === 'week' && (
        <div className="week-strip-container" ref={weekStripRef}>
          <div className="week-strip">
            {getWeekDays().map((d, i) => {
              const count = getDateCount(d);
              return (
                <button key={i}
                  className={`week-strip-day ${isToday(d) ? 'today' : ''} ${isSelected(d) ? 'selected' : ''}`}
                  onClick={() => setSelectedDate(d)}>
                  <span className="week-strip-dow">{d.toLocaleDateString('en-US', { weekday: 'short' })}</span>
                  <span className="week-strip-date">{d.getDate()}</span>
                  {count > 0 && <span className="week-strip-count">{count}</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Month Calendar */}
      {viewMode === 'month' && (
        <div className="card calendar-card">
          <div className="calendar-header">
            <button className="btn btn-ghost btn-sm" onClick={() => setCurrentDate(new Date(year, month - 1, 1))}><IconChevronLeft size={18} /></button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <h3 style={{ fontSize: '0.95rem' }}>{headerLabel}</h3>
              {(year !== new Date().getFullYear() || month !== new Date().getMonth()) && (
                <button className="btn btn-sm btn-secondary" onClick={() => { setCurrentDate(new Date()); setSelectedDate(new Date()); }} style={{ fontSize: '0.7rem', padding: '0.15rem 0.5rem' }}>Today</button>
              )}
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => setCurrentDate(new Date(year, month + 1, 1))}><IconChevronRight size={18} /></button>
          </div>
          <div className="calendar-grid">
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
              <div key={i} className="calendar-day-header">{d}</div>
            ))}
            {getDaysInMonth().map((d, i) => {
              const items = getDateItems(d.date);
              return (
                <div key={i}
                  className={`calendar-day ${d.other ? 'other-month' : ''} ${isToday(d.date) ? 'today' : ''} ${isSelected(d.date) ? 'selected' : ''}`}
                  onClick={() => { if (!d.other) { setSelectedDate(d.date); } }}>
                  <span className="calendar-day-num">{d.date.getDate()}</span>
                  <div className="calendar-day-items">
                    {items.events.slice(0, 2).map(e => (
                      <div key={e.id} className="calendar-day-event" style={{ background: e.color || '#2563eb' }}>
                        {ft(e.start_time).replace(':00', '')} {e.title}
                      </div>
                    ))}
                    {items.tasks.slice(0, 2 - items.events.length).map(t => (
                      <div key={t.id} className="calendar-day-task">
                        {t.title}
                      </div>
                    ))}
                    {(items.events.length + items.tasks.length) > 2 && (
                      <div className="calendar-day-more">+{items.events.length + items.tasks.length - 2} more</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Selected Day Panel */}
      <div className="card selected-day-card">
        <div className="card-title">
          <span>{selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</span>
          <div className="flex gap-sm">
            <button className="btn btn-sm btn-secondary" onClick={openNewTask}><IconPlus size={14} /> Task</button>
            <button className="btn btn-sm btn-primary" onClick={openNewEvent}><IconPlus size={14} /> Event</button>
          </div>
        </div>

        {/* Events for the day */}
        {events.length > 0 && (
          <div className="day-section">
            <div className="day-section-label">Events</div>
            {events.map(e => (
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
        )}

        {/* Tasks for the day */}
        {tasks.length > 0 && (
          <div className="day-section">
            <div className="day-section-label">Tasks</div>
            {tasks.map(t => (
              <div key={t.id} className="task-item compact">
                <button className={`task-checkbox ${t.status === 'completed' ? 'checked' : ''}`} onClick={() => toggleTask(t)}>
                  {t.status === 'completed' && <IconCheck size={14} />}
                </button>
                <div className="task-body">
                  <div className={`task-title ${t.status === 'completed' ? 'completed' : ''}`}>{t.title}</div>
                  <div className="task-meta">
                    <span className={`task-tag tag-${t.priority}`}>{t.priority}</span>
                    {t.due_time && <span className="task-due"><IconClock size={10} /> {t.due_time}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {events.length === 0 && tasks.length === 0 && (
          <div className="empty-state-inline">
            <p>Nothing scheduled - add a task or event</p>
          </div>
        )}
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && resetForm()}>
          <div className="modal">
            <div className="modal-header">
              <h3>{editingEvent ? 'Edit Event' : formType === 'task' ? 'New Task' : 'New Event'}</h3>
              <button className="modal-close" onClick={resetForm}><IconX size={20} /></button>
            </div>

            {/* Type toggle for new items */}
            {!editingEvent && (
              <div className="form-type-toggle">
                <button className={formType === 'task' ? 'active' : ''} onClick={() => setFormType('task')}>Task</button>
                <button className={formType === 'event' ? 'active' : ''} onClick={() => setFormType('event')}>Event</button>
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                {formType === 'task' ? (
                  <>
                    <div className="form-group">
                      <label>Title</label>
                      <input type="text" value={taskForm.title} onChange={e => setTaskForm({ ...taskForm, title: e.target.value })} placeholder="What needs to be done?" required autoFocus />
                    </div>
                    <div className="form-group">
                      <label>Description</label>
                      <textarea value={taskForm.description} onChange={e => setTaskForm({ ...taskForm, description: e.target.value })} placeholder="Details (optional)" rows="2" />
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label>Category</label>
                        <select value={taskForm.category} onChange={e => setTaskForm({ ...taskForm, category: e.target.value })}>
                          {['general', 'work', 'personal', 'health', 'shopping', 'errands'].map(c => (
                            <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                          ))}
                        </select>
                      </div>
                      <div className="form-group">
                        <label>Time</label>
                        <input type="time" value={taskForm.dueTime} onChange={e => setTaskForm({ ...taskForm, dueTime: e.target.value })} />
                      </div>
                    </div>
                    <div className="form-group">
                      <label>Priority</label>
                      <div className="priority-chips">
                        {['high', 'medium', 'low'].map(p => (
                          <button key={p} type="button" className={`priority-chip chip-${p} ${taskForm.priority === p ? 'active' : ''}`}
                            onClick={() => setTaskForm({ ...taskForm, priority: p })}>
                            {p.charAt(0).toUpperCase() + p.slice(1)}
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                ) : (
                  <>
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
                        <input type="datetime-local" value={form.startTime} onChange={e => setForm({ ...form, startTime: e.target.value })} required style={{ fontSize: '0.82rem' }} />
                      </div>
                      <div className="form-group">
                        <label>End</label>
                        <input type="datetime-local" value={form.endTime} onChange={e => setForm({ ...form, endTime: e.target.value })} style={{ fontSize: '0.82rem' }} />
                      </div>
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label>Attendees</label>
                        <input type="text" value={form.attendees} onChange={e => setForm({ ...form, attendees: e.target.value })} placeholder="Names, comma separated" />
                      </div>
                      <div className="form-group">
                        <label>Repeat</label>
                        <select value={form.recurrence || 'none'} onChange={e => setForm({ ...form, recurrence: e.target.value })}>
                          <option value="none">No repeat</option>
                          <option value="daily">Daily</option>
                          <option value="weekly">Weekly</option>
                          <option value="monthly">Monthly</option>
                          <option value="annual">Annually</option>
                        </select>
                      </div>
                    </div>
                    <div className="form-group">
                      <label>Color</label>
                      <div className="color-options">
                        {EVENT_COLORS.map(c => (
                          <button key={c} type="button" className={`color-dot ${form.color === c ? 'selected' : ''}`} style={{ background: c }} onClick={() => setForm({ ...form, color: c })} />
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={resetForm}>Cancel</button>
                <button type="submit" className="btn btn-primary">{editingEvent ? 'Save' : formType === 'task' ? 'Create Task' : 'Create Event'}</button>
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
