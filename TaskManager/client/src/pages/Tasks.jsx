import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { API, useToast } from '../App';
import { IconPlus, IconCheck, IconEdit, IconTrash, IconClock, IconX, IconCalendar, IconChevronRight, IconSunrise, IconSunHigh, IconSunset, IconMoonStars, IconMoonFull, IconChevronUp, IconChevronDown, IconLink, IconExternalLink } from '../icons';

const CATEGORIES = ['general', 'work', 'personal', 'health', 'shopping', 'errands'];

const toDateStr = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
};

const addDays = (d, n) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };

const shortDate = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
const dayName = (d) => d.toLocaleDateString('en-US', { weekday: 'short' });

const quickDates = () => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tmrw = addDays(today, 1);
  const dow = today.getDay();
  const nextMon = addDays(today, dow === 0 ? 1 : 8 - dow);
  const in3 = addDays(today, 3);
  const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  return [
    { label: 'Today', sub: shortDate(today), value: toDateStr(today), accent: 'var(--color-primary)' },
    { label: 'Tomorrow', sub: dayName(tmrw), value: toDateStr(tmrw), accent: 'var(--color-success)' },
    { label: dayName(in3), sub: shortDate(in3), value: toDateStr(in3), accent: 'var(--color-warning)' },
    { label: 'Next Mon', sub: shortDate(nextMon), value: toDateStr(nextMon), accent: '#7c3aed' },
    { label: 'Next month', sub: shortDate(nextMonth), value: toDateStr(nextMonth), accent: 'var(--color-text-secondary)' },
  ];
};

const quickTimeIcons = {
  '09:00': IconSunrise,
  '12:00': IconSunHigh,
  '14:00': IconSunset,
  '18:00': IconMoonStars,
  '21:00': IconMoonFull,
};

const quickTimes = [
  { label: '9 AM', value: '09:00' },
  { label: '12 PM', value: '12:00' },
  { label: '2 PM', value: '14:00' },
  { label: '6 PM', value: '18:00' },
  { label: '9 PM', value: '21:00' },
];

const formatTime12h = (t) => {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return m === 0 ? `${h12} ${period}` : `${h12}:${String(m).padStart(2, '0')} ${period}`;
};

function AmPmPicker({ value, onChange }) {
  const parse = (v) => {
    if (!v) return { hour: 12, minute: 0, period: 'PM' };
    const [h, m] = v.split(':').map(Number);
    return { hour: h === 0 ? 12 : h > 12 ? h - 12 : h, minute: m, period: h >= 12 ? 'PM' : 'AM' };
  };

  const { hour, minute, period } = parse(value);

  const toValue = (h, m, p) => {
    let h24 = h;
    if (p === 'AM' && h === 12) h24 = 0;
    else if (p === 'PM' && h !== 12) h24 = h + 12;
    return `${String(h24).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

  const setHour = (dir) => {
    let h = hour + dir;
    if (h > 12) h = 1;
    if (h < 1) h = 12;
    onChange(toValue(h, minute, period));
  };

  const setMinute = (dir) => {
    let m = minute + dir * 5;
    if (m >= 60) m = 0;
    if (m < 0) m = 55;
    onChange(toValue(hour, m, period));
  };

  const togglePeriod = () => {
    const newP = period === 'AM' ? 'PM' : 'AM';
    onChange(toValue(hour, minute, newP));
  };

  return (
    <div className="ampm-picker">
      <div className="ampm-col">
        <button type="button" className="ampm-arrow" onClick={() => setHour(1)}><IconChevronUp size={16} /></button>
        <span className="ampm-value">{hour}</span>
        <button type="button" className="ampm-arrow" onClick={() => setHour(-1)}><IconChevronDown size={16} /></button>
      </div>
      <span className="ampm-sep">:</span>
      <div className="ampm-col">
        <button type="button" className="ampm-arrow" onClick={() => setMinute(1)}><IconChevronUp size={16} /></button>
        <span className="ampm-value">{String(minute).padStart(2, '0')}</span>
        <button type="button" className="ampm-arrow" onClick={() => setMinute(-1)}><IconChevronDown size={16} /></button>
      </div>
      <button type="button" className="ampm-toggle" onClick={togglePeriod}>
        {period}
      </button>
      {value && (
        <button type="button" className="ampm-clear" onClick={() => onChange('')}>
          <IconX size={14} />
        </button>
      )}
    </div>
  );
}

function groupTasks(tasks) {
  const now = new Date();
  const todayStr = toDateStr(now);
  const tomorrowStr = toDateStr(addDays(now, 1));
  const endOfWeekStr = toDateStr(addDays(now, 7 - now.getDay()));

  const groups = { overdue: [], today: [], tomorrow: [], thisWeek: [], later: [], noDate: [] };

  tasks.forEach(task => {
    if (!task.due_date) { groups.noDate.push(task); return; }
    const ds = task.due_date.slice(0, 10);

    if (task.status !== 'completed' && ds < todayStr) groups.overdue.push(task);
    else if (ds === todayStr) groups.today.push(task);
    else if (ds === tomorrowStr) groups.tomorrow.push(task);
    else if (ds <= endOfWeekStr) groups.thisWeek.push(task);
    else groups.later.push(task);
  });

  return groups;
}

export default function Tasks() {
  const showToast = useToast();
  const [searchParams] = useSearchParams();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const initialFilter = searchParams.get('filter') || 'all';
  const [filter, setFilter] = useState(initialFilter);
  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [form, setForm] = useState({ title: '', description: '', category: 'general', priority: 'medium', dueDate: '', dueTime: '', link: '' });
  const [showDatePicker, setShowDatePicker] = useState(false);

  const loadTasks = useCallback(async () => {
    try {
      const params = filter === 'all' ? '' : `?status=${filter}`;
      setTasks(await API(`/tasks${params}`));
    } catch {} finally { setLoading(false); }
  }, [filter]);

  useEffect(() => { loadTasks(); }, [loadTasks]);

  const resetForm = () => {
    setForm({ title: '', description: '', category: 'general', priority: 'medium', dueDate: '', dueTime: '', link: '' });
    setEditingTask(null);
    setShowForm(false);
    setShowDatePicker(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    try {
      if (editingTask) {
        await API(`/tasks/${editingTask.id}`, { method: 'PUT', body: form });
        showToast('Task Updated', form.title);
      } else {
        await API('/tasks', { method: 'POST', body: form });
        showToast('Task Created', form.title);
      }
      resetForm();
      loadTasks();
    } catch (err) { showToast('Error', err.message, 'error'); }
  };

  const toggleTask = async (task) => {
    const newStatus = task.status === 'completed' ? 'pending' : 'completed';
    await API(`/tasks/${task.id}`, { method: 'PUT', body: { status: newStatus } });
    setTasks(ts => ts.map(t => t.id === task.id ? { ...t, status: newStatus } : t));
  };

  const deleteTask = async (id) => {
    await API(`/tasks/${id}`, { method: 'DELETE' });
    setTasks(ts => ts.filter(t => t.id !== id));
    showToast('Deleted', 'Task removed');
  };

  const editTask = (task) => {
    setForm({
      title: task.title, description: task.description || '',
      category: task.category, priority: task.priority,
      dueDate: task.due_date ? task.due_date.slice(0, 10) : '',
      dueTime: task.due_time || '', link: task.link || ''
    });
    setEditingTask(task);
    setShowForm(true);
  };

  const reschedule = async (task, dateStr) => {
    await API(`/tasks/${task.id}`, { method: 'PUT', body: { dueDate: dateStr } });
    loadTasks();
    showToast('Rescheduled', `Moved to ${formatDateLabel(dateStr)}`);
  };

  const isOverdue = (task) => task.due_date && task.status !== 'completed' && task.due_date.slice(0, 10) < toDateStr(new Date());

  const formatDue = (task) => {
    if (!task.due_date) return null;
    return formatDateLabel(task.due_date.slice(0, 10)) + (task.due_time ? ' ' + formatTime12h(task.due_time) : '');
  };

  const formatDateLabel = (dateStr) => {
    const d = new Date(dateStr + 'T12:00:00');
    const today = new Date();
    const todayStr = toDateStr(today);
    const tomorrowStr = toDateStr(addDays(today, 1));
    if (dateStr === todayStr) return 'Today';
    if (dateStr === tomorrowStr) return 'Tomorrow';
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const setQuickDate = (val) => {
    setForm(f => ({ ...f, dueDate: val }));
    setShowDatePicker(false);
  };

  if (loading) return <div className="loading-center"><div className="spinner" /></div>;

  const groups = groupTasks(tasks);
  const sections = [
    { key: 'overdue', label: 'Overdue', tasks: groups.overdue, color: 'var(--color-danger)', icon: '!' },
    { key: 'today', label: 'Today', tasks: groups.today, color: 'var(--color-primary)', icon: null },
    { key: 'tomorrow', label: 'Tomorrow', tasks: groups.tomorrow, color: 'var(--color-success)', icon: null },
    { key: 'thisWeek', label: 'This Week', tasks: groups.thisWeek, color: 'var(--color-warning)', icon: null },
    { key: 'later', label: 'Later', tasks: groups.later, color: 'var(--color-text-secondary)', icon: null },
    { key: 'noDate', label: 'No Date', tasks: groups.noDate, color: 'var(--color-text-secondary)', icon: null },
  ];

  const todayStr = toDateStr(new Date());
  const tomorrowStr = toDateStr(addDays(new Date(), 1));

  return (
    <div>
      <div className="page-header">
        <h1>Tasks</h1>
        <p>Manage your to-dos and track progress</p>
      </div>

      <div className="flex-center" style={{ justifyContent: 'space-between', marginBottom: '0.75rem' }}>
        <div className="tab-strip" style={{ marginBottom: 0, flex: 1 }}>
          {['all', 'pending', 'completed'].map(f => (
            <button key={f} className={filter === f ? 'active' : ''} onClick={() => setFilter(f)}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => { resetForm(); setShowForm(true); }}>
          <IconPlus size={16} /> Add
        </button>
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && resetForm()}>
          <div className="modal">
            <div className="modal-header">
              <h3>{editingTask ? 'Edit Task' : 'New Task'}</h3>
              <button className="modal-close" onClick={resetForm}><IconX size={20} /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Title</label>
                  <input type="text" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="What needs to be done?" required autoFocus />
                </div>
                <div className="form-group">
                  <label>Description</label>
                  <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Add details (optional)" rows="2" />
                </div>
                <div className="form-group">
                  <label>Link</label>
                  <div className="link-input-wrap">
                    <IconLink size={14} />
                    <input type="url" value={form.link} onChange={e => setForm({ ...form, link: e.target.value })} placeholder="https://..." />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Category</label>
                    <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                      {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Priority</label>
                    <div className="priority-chips">
                      {['high', 'medium', 'low'].map(p => (
                        <button key={p} type="button" className={`priority-chip chip-${p} ${form.priority === p ? 'active' : ''}`}
                          onClick={() => setForm({ ...form, priority: p })}>
                          {p.charAt(0).toUpperCase() + p.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Quick Date Selection */}
                <div className="form-group">
                  <label>When</label>
                  <div className="date-chip-grid">
                    {quickDates().map(qd => (
                      <button key={qd.label} type="button"
                        className={`date-chip ${form.dueDate === qd.value ? 'active' : ''}`}
                        style={{ '--chip-color': qd.accent }}
                        onClick={() => setQuickDate(qd.value)}>
                        <span className="date-chip-label">{qd.label}</span>
                        <span className="date-chip-sub">{qd.sub}</span>
                      </button>
                    ))}
                    <button type="button"
                      className={`date-chip ${form.dueDate && !quickDates().some(q => q.value === form.dueDate) ? 'active' : ''}`}
                      style={{ '--chip-color': 'var(--color-text-secondary)' }}
                      onClick={() => setShowDatePicker(!showDatePicker)}>
                      <span className="date-chip-label"><IconCalendar size={13} /></span>
                      <span className="date-chip-sub">Pick</span>
                    </button>
                  </div>
                  {showDatePicker && (
                    <input type="date" value={form.dueDate}
                      onChange={e => setForm({ ...form, dueDate: e.target.value })}
                      min={toDateStr(new Date())}
                      style={{ marginTop: '0.5rem' }} />
                  )}
                  {form.dueDate && (
                    <button type="button" className="clear-date-btn" onClick={() => setForm({ ...form, dueDate: '', dueTime: '' })}>
                      <IconX size={12} /> Clear date
                    </button>
                  )}
                </div>

                {/* Quick Time Selection */}
                {form.dueDate && (
                  <div className="form-group">
                    <label>Time (optional)</label>
                    <div className="time-chip-row">
                      {quickTimes.map(qt => {
                        const Icon = quickTimeIcons[qt.value];
                        return (
                          <button key={qt.label} type="button"
                            className={`time-chip ${form.dueTime === qt.value ? 'active' : ''}`}
                            onClick={() => setForm(f => ({ ...f, dueTime: f.dueTime === qt.value ? '' : qt.value }))}>
                            <Icon size={14} />
                            <span>{qt.label}</span>
                          </button>
                        );
                      })}
                    </div>
                    <AmPmPicker value={form.dueTime} onChange={v => setForm({ ...form, dueTime: v })} />
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={resetForm}>Cancel</button>
                <button type="submit" className="btn btn-primary">{editingTask ? 'Save' : 'Create Task'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {tasks.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <IconTasks size={40} />
            <h3>{filter === 'completed' ? 'No completed tasks' : 'No tasks yet'}</h3>
            <p>Tap the + button to add your first task</p>
          </div>
        </div>
      ) : filter === 'completed' ? (
        // Flat list for completed
        tasks.map(task => <TaskRow key={task.id} task={task} toggleTask={toggleTask} deleteTask={deleteTask} editTask={editTask} formatDue={formatDue} isOverdue={isOverdue} />)
      ) : (
        // Grouped view for all/pending
        sections.filter(s => s.tasks.length > 0).map(section => (
          <div key={section.key} className="task-section">
            <div className="task-section-header">
              <div className="task-section-dot" style={{ background: section.color }} />
              <span className="task-section-label">{section.label}</span>
              <span className="task-section-count">{section.tasks.length}</span>
            </div>
            {section.tasks.map(task => (
              <TaskRow key={task.id} task={task} toggleTask={toggleTask} deleteTask={deleteTask}
                editTask={editTask} formatDue={formatDue} isOverdue={isOverdue}
                showReschedule={section.key === 'overdue'}
                reschedule={reschedule} todayStr={todayStr} tomorrowStr={tomorrowStr} />
            ))}
          </div>
        ))
      )}
    </div>
  );
}

function TaskRow({ task, toggleTask, deleteTask, editTask, formatDue, isOverdue, showReschedule, reschedule, todayStr, tomorrowStr }) {
  const [showRescheduleMenu, setShowRescheduleMenu] = useState(false);

  return (
    <div className="task-item">
      <button className={`task-checkbox ${task.status === 'completed' ? 'checked' : ''}`} onClick={() => toggleTask(task)}>
        {task.status === 'completed' && <IconCheck size={14} />}
      </button>
      <div className="task-body">
        <div className={`task-title ${task.status === 'completed' ? 'completed' : ''}`}>{task.title}</div>
        {task.description && <div className="task-desc">{task.description}</div>}
        {task.link && (
          <a href={task.link} target="_blank" rel="noopener noreferrer" className="task-link" onClick={e => e.stopPropagation()}>
            <IconExternalLink size={12} />
            <span>{task.link.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]}</span>
          </a>
        )}
        <div className="task-meta">
          <span className={`task-tag tag-${task.priority}`}>{task.priority}</span>
          <span className="task-tag tag-category">{task.category}</span>
          {formatDue(task) && (
            <span className={`task-due ${isOverdue(task) ? 'overdue' : ''}`}>
              <IconClock size={10} /> {formatDue(task)}
            </span>
          )}
        </div>
        {showReschedule && (
          <div className="reschedule-row">
            <button className="reschedule-chip" onClick={() => reschedule(task, todayStr)}>Move to Today</button>
            <button className="reschedule-chip" onClick={() => reschedule(task, tomorrowStr)}>Tomorrow</button>
            <button className="reschedule-chip" onClick={() => setShowRescheduleMenu(!showRescheduleMenu)}>
              <IconCalendar size={10} /> Pick
            </button>
            {showRescheduleMenu && (
              <input type="date" className="reschedule-date-input"
                onChange={e => { reschedule(task, e.target.value); setShowRescheduleMenu(false); }} autoFocus />
            )}
          </div>
        )}
      </div>
      <div className="task-actions">
        <button className="task-action-btn" onClick={() => editTask(task)} title="Edit"><IconEdit size={16} /></button>
        <button className="task-action-btn" onClick={() => deleteTask(task.id)} title="Delete"><IconTrash size={16} /></button>
      </div>
    </div>
  );
}

import { IconTasks } from '../icons';
