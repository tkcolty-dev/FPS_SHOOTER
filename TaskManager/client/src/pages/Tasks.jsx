import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { API, useToast } from '../App';
import { IconPlus, IconCheck, IconEdit, IconTrash, IconClock, IconX, IconCalendar, IconChevronRight,
  IconSunrise, IconSunHigh, IconSunset, IconMoonStars, IconMoonFull, IconChevronUp, IconChevronDown,
  IconLink, IconExternalLink, IconSearch, IconRepeat, IconTemplate, IconZap, IconTarget, IconClipboard,
  IconTasks, IconPin, IconPlay, IconPause, IconSkipForward, IconRotateCcw, IconUsers } from '../icons';

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

const quickTimeIcons = { '09:00': IconSunrise, '12:00': IconSunHigh, '14:00': IconSunset, '18:00': IconMoonStars, '21:00': IconMoonFull };
const quickTimes = [
  { label: '9 AM', value: '09:00' }, { label: '12 PM', value: '12:00' },
  { label: '2 PM', value: '14:00' }, { label: '6 PM', value: '18:00' }, { label: '9 PM', value: '21:00' },
];

const formatTime12h = (t) => {
  if (!t) return '';
  try {
    const parts = t.match(/^(\d{1,2}):(\d{2})/);
    if (!parts) return t;
    const h = parseInt(parts[1]), m = parseInt(parts[2]);
    if (isNaN(h) || isNaN(m)) return t;
    const period = h >= 12 ? 'PM' : 'AM';
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return m === 0 ? `${h12} ${period}` : `${h12}:${String(m).padStart(2, '0')} ${period}`;
  } catch { return t; }
};

const formatTimeSpent = (s) => {
  if (!s) return null;
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
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
  const setHour = (dir) => { let h = hour + dir; if (h > 12) h = 1; if (h < 1) h = 12; onChange(toValue(h, minute, period)); };
  const setMinute = (dir) => { let m = minute + dir * 5; if (m >= 60) m = 0; if (m < 0) m = 55; onChange(toValue(hour, m, period)); };
  const togglePeriod = () => onChange(toValue(hour, minute, period === 'AM' ? 'PM' : 'AM'));

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
      <button type="button" className="ampm-toggle" onClick={togglePeriod}>{period}</button>
      {value && <button type="button" className="ampm-clear" onClick={() => onChange('')}><IconX size={14} /></button>}
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
    const ds = (task.due_date || '').slice(0, 10);
    if (!ds || ds.length !== 10) { groups.noDate.push(task); return; }
    if (task.status !== 'completed' && ds < todayStr) groups.overdue.push(task);
    else if (ds === todayStr) groups.today.push(task);
    else if (ds === tomorrowStr) groups.tomorrow.push(task);
    else if (ds <= endOfWeekStr) groups.thisWeek.push(task);
    else groups.later.push(task);
  });
  // Sort pinned to top within each group, stable by id
  Object.values(groups).forEach(g => g.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || a.id - b.id));
  return groups;
}

const TEMPLATES = [
  { name: 'Morning Routine', Icon: IconSunrise, tasks: [
    { title: 'Wake up & stretch', dueTime: '07:00', priority: 'medium' },
    { title: 'Breakfast', dueTime: '07:30', priority: 'medium' },
    { title: 'Shower & get ready', dueTime: '08:00', priority: 'medium' },
    { title: 'Review today\'s plan', dueTime: '08:30', priority: 'high' },
  ]},
  { name: 'Workout', Icon: IconTarget, tasks: [
    { title: 'Warm up (5 min)', dueTime: '06:00', priority: 'medium' },
    { title: 'Main workout (30 min)', dueTime: '06:10', priority: 'high' },
    { title: 'Cool down & stretch', dueTime: '06:40', priority: 'medium' },
    { title: 'Protein shake', dueTime: '07:00', priority: 'low' },
  ]},
  { name: 'Study Session', Icon: IconClipboard, tasks: [
    { title: 'Review notes', priority: 'high' },
    { title: 'Practice problems', priority: 'high' },
    { title: 'Flashcard review', priority: 'medium' },
    { title: 'Summarize key concepts', priority: 'medium' },
  ]},
  { name: 'Weekly Review', Icon: IconTasks, tasks: [
    { title: 'Review completed tasks', priority: 'medium' },
    { title: 'Plan next week goals', priority: 'high' },
    { title: 'Clean up overdue items', priority: 'high' },
    { title: 'Update calendar', priority: 'medium' },
  ]},
];

// ── Focus Timer ──
const TIMER_PRESETS = [
  { label: '5m', value: 5 }, { label: '10m', value: 10 }, { label: '15m', value: 15 },
  { label: '25m', value: 25 }, { label: '30m', value: 30 }, { label: '45m', value: 45 },
  { label: '60m', value: 60 },
];

function FocusTimer({ task, onClose, onTimeLogged }) {
  const SHORT_BREAK = 5 * 60, LONG_BREAK = 15 * 60;
  const [workMins, setWorkMins] = useState(25);
  const [started, setStarted] = useState(false);
  const [mode, setMode] = useState('work');
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const [sessions, setSessions] = useState(0);
  const intervalRef = useRef(null);
  const alarmRef = useRef(null);
  const workDuration = workMins * 60;

  // Pre-load alarm audio on mount so it's ready to play
  useEffect(() => {
    const audio = new Audio('/alarm.wav');
    audio.load();
    alarmRef.current = audio;
  }, []);

  const total = mode === 'work' ? workDuration : sessions > 0 && sessions % 4 === 0 ? LONG_BREAK : SHORT_BREAK;
  const progress = started ? 1 - timeLeft / total : 0;
  const mm = String(Math.floor(timeLeft / 60)).padStart(2, '0');
  const ss = String(timeLeft % 60).padStart(2, '0');

  useEffect(() => {
    if (!running) { clearInterval(intervalRef.current); return; }
    intervalRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          clearInterval(intervalRef.current);
          setRunning(false);
          try { if (alarmRef.current) { alarmRef.current.currentTime = 0; alarmRef.current.play(); } } catch {}
          if (mode === 'work') { setSessions(s => s + 1); onTimeLogged(workDuration); }
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(intervalRef.current);
  }, [running, mode]);

  const begin = () => {
    // Unlock audio on user gesture so alarm can play later
    if (alarmRef.current) { alarmRef.current.play().then(() => { alarmRef.current.pause(); alarmRef.current.currentTime = 0; }).catch(() => {}); }
    setStarted(true); setTimeLeft(workDuration); setRunning(true);
  };
  const startBreak = () => { const dur = sessions > 0 && sessions % 4 === 0 ? LONG_BREAK : SHORT_BREAK; setMode('break'); setTimeLeft(dur); setRunning(true); };
  const startWork = () => { setMode('work'); setTimeLeft(workDuration); setRunning(true); };
  const reset = () => { setRunning(false); setTimeLeft(mode === 'work' ? workDuration : SHORT_BREAK); };

  const r = 70, c = 2 * Math.PI * r;

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 360 }}>
        <div className="modal-header">
          <h3>Focus Timer</h3>
          <button className="modal-close" onClick={onClose}><IconX size={20} /></button>
        </div>
        <div className="focus-timer">
          <div className="focus-timer-task">{task.title}</div>

          {!started ? (
            <>
              <div className="focus-timer-label" style={{ color: 'var(--color-primary)' }}>Set Duration</div>
              <div className="timer-preset-grid">
                {TIMER_PRESETS.map(p => (
                  <button key={p.value} className={`timer-preset ${workMins === p.value ? 'active' : ''}`}
                    onClick={() => setWorkMins(p.value)}>{p.label}</button>
                ))}
              </div>
              <div className="focus-timer-controls" style={{ marginTop: '1rem' }}>
                <button className="focus-btn primary" onClick={begin}><IconPlay size={18} /> Start {workMins}m Focus</button>
              </div>
            </>
          ) : (
            <>
              <div className="focus-timer-label" style={{ color: mode === 'work' ? 'var(--color-primary)' : 'var(--color-success)' }}>
                {mode === 'work' ? 'Focus' : 'Break'}
              </div>
              <div className="focus-timer-ring">
                <svg width="160" height="160" viewBox="0 0 160 160">
                  <circle cx="80" cy="80" r={r} fill="none" stroke="var(--color-border)" strokeWidth="6" />
                  <circle cx="80" cy="80" r={r} fill="none"
                    stroke={mode === 'work' ? 'var(--color-primary)' : 'var(--color-success)'}
                    strokeWidth="6" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - progress)}
                    transform="rotate(-90 80 80)" style={{ transition: 'stroke-dashoffset 1s linear' }} />
                </svg>
                <span className="focus-timer-time">{mm}:{ss}</span>
              </div>
              <div className="focus-timer-controls">
                {timeLeft === 0 ? (
                  mode === 'work' ? (
                    <button className="focus-btn primary" onClick={startBreak}><IconSkipForward size={18} /> Break</button>
                  ) : (
                    <button className="focus-btn primary" onClick={startWork}><IconPlay size={18} /> Focus</button>
                  )
                ) : (
                  <>
                    <button className="focus-btn secondary" onClick={reset}><IconRotateCcw size={16} /></button>
                    <button className="focus-btn primary" onClick={() => setRunning(!running)}>
                      {running ? <IconPause size={18} /> : <IconPlay size={18} />}
                    </button>
                    {mode === 'work' && !running && <button className="focus-btn secondary" onClick={startBreak}><IconSkipForward size={16} /></button>}
                  </>
                )}
              </div>
            </>
          )}
          <div className="focus-timer-sessions">
            {sessions} session{sessions !== 1 ? 's' : ''} completed
            {task.time_spent > 0 && <> &middot; {formatTimeSpent(task.time_spent)} total</>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Share Modal ──
function ShareModal({ onClose, showToast }) {
  const [username, setUsername] = useState('');
  const [partners, setPartners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [operatorMode, setOperatorMode] = useState(false);
  const [shareBack, setShareBack] = useState(true);

  useEffect(() => {
    API('/sharing/partners').then(setPartners).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const link = async () => {
    if (!username.trim()) return;
    try {
      const result = await API('/sharing/link', { method: 'POST', body: {
        username: username.trim(),
        permission: operatorMode ? 'operator' : 'view',
        shareBack
      }});
      showToast('Linked', `Now sharing tasks with @${username.trim()}`);
      setUsername('');
      setPartners(ps => [...ps, { ...result.partner, permission: operatorMode ? 'operator' : 'view' }]);
    } catch (err) { showToast('Error', err.message, 'error'); }
  };

  const togglePermission = async (partner) => {
    const newPerm = partner.permission === 'operator' ? 'view' : 'operator';
    try {
      await API(`/sharing/${partner.id}/permission`, { method: 'PUT', body: { permission: newPerm } });
      setPartners(ps => ps.map(p => p.id === partner.id ? { ...p, permission: newPerm } : p));
      showToast('Updated', `${partner.display_name || partner.username} is now ${newPerm === 'operator' ? 'an operator' : 'view-only'}`);
    } catch (err) { showToast('Error', err.message, 'error'); }
  };

  const unlink = async (id) => {
    await API(`/sharing/${id}`, { method: 'DELETE' });
    setPartners(ps => ps.filter(p => p.id !== id));
    showToast('Unlinked', 'Stopped sharing');
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 400 }}>
        <div className="modal-header">
          <h3>Share Tasks</h3>
          <button className="modal-close" onClick={onClose}><IconX size={20} /></button>
        </div>
        <div className="modal-body">
          <div className="text-sm text-secondary" style={{ marginBottom: '0.75rem' }}>
            Link with someone to share all tasks. You'll get notified when they complete, edit, or delete tasks.
          </div>
          <div className="form-group">
            <label>Link with user</label>
            <div className="share-input-row">
              <input type="text" value={username} onChange={e => setUsername(e.target.value)}
                placeholder="Enter their username" onKeyDown={e => e.key === 'Enter' && link()} />
              <button className="btn btn-primary btn-sm" onClick={link} disabled={!username.trim()}>Link</button>
            </div>
          </div>
          <div className="share-options">
            <label className="share-option" onClick={() => setOperatorMode(!operatorMode)}>
              <button className={`toggle small ${operatorMode ? 'on' : ''}`} />
              <div>
                <span className="share-option-label">Operator Mode</span>
                <span className="share-option-desc">They can edit, complete & delete your tasks</span>
              </div>
            </label>
            <label className="share-option" onClick={() => setShareBack(!shareBack)}>
              <button className={`toggle small ${shareBack ? 'on' : ''}`} />
              <div>
                <span className="share-option-label">Share Back</span>
                <span className="share-option-desc">Also let you see their tasks</span>
              </div>
            </label>
          </div>
          {loading ? <div className="loading-center"><div className="spinner" /></div> : (
            partners.length > 0 && (
              <div className="collaborator-list">
                <label>Sharing with</label>
                {partners.map(p => (
                  <div key={p.id} className="collaborator-row">
                    <div className="collaborator-avatar">{(p.display_name || p.username)[0].toUpperCase()}</div>
                    <div className="collaborator-info">
                      <span className="collaborator-name">{p.display_name || p.username}</span>
                      <span className="collaborator-user">@{p.username}</span>
                    </div>
                    <button className={`share-perm-btn ${p.permission === 'operator' ? 'operator' : ''}`}
                      onClick={() => togglePermission(p)} title="Toggle operator mode">
                      {p.permission === 'operator' ? 'Operator' : 'View'}
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => unlink(p.id)}><IconX size={14} /></button>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}

export default function Tasks() {
  const showToast = useToast();
  const [searchParams] = useSearchParams();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const initialFilter = searchParams.get('filter') || localStorage.getItem('taskFilter') || 'all';
  const [filter, setFilter] = useState(initialFilter);
  const updateFilter = (f) => { setFilter(f); localStorage.setItem('taskFilter', f); };
  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [form, setForm] = useState({ title: '', description: '', category: 'general', priority: 'medium', dueDate: '', dueTime: '', link: '', recurrence: 'none' });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [search, setSearch] = useState('');
  const [showTemplates, setShowTemplates] = useState(false);
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [aiScript, setAiScript] = useState('');
  const [aiTasks, setAiTasks] = useState([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSelected, setAiSelected] = useState(new Set());
  const [timerTask, setTimerTask] = useState(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [sharedWithMe, setSharedWithMe] = useState([]);
  const [sharedPermissions, setSharedPermissions] = useState({});
  const [offline, setOffline] = useState(false);
  const [sharedFilter, setSharedFilter] = useState(() => localStorage.getItem('sharedFilter') || 'all');
  const updateSharedFilter = (f) => { setSharedFilter(f); localStorage.setItem('sharedFilter', f); };

  const loadTasks = useCallback(async () => {
    try {
      let params = filter === 'all' ? '' : filter === 'shared' ? '' : `?status=${filter}`;
      if (search.trim()) params += `${params ? '&' : '?'}search=${encodeURIComponent(search.trim())}`;
      if (filter === 'shared') {
        const data = await API('/sharing/with-me');
        setSharedWithMe(data.tasks || []);
        setSharedPermissions(data.permissions || {});
        setTasks([]);
      } else {
        setTasks(await API(`/tasks${params}`));
      }
      setOffline(false);
    } catch { setOffline(true); } finally { setLoading(false); }
  }, [filter, search]);

  useEffect(() => { loadTasks(); }, [loadTasks]);

  // Poll every 5s for real-time sync on all tabs
  useEffect(() => {
    const iv = setInterval(() => { loadTasks(); }, 5000);
    return () => clearInterval(iv);
  }, [loadTasks]);

  const resetForm = () => {
    setForm({ title: '', description: '', category: 'general', priority: 'medium', dueDate: '', dueTime: '', link: '', recurrence: 'none' });
    setEditingTask(null); setShowForm(false); setShowDatePicker(false);
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
      resetForm(); loadTasks();
    } catch (err) { showToast('Error', err.message, 'error'); }
  };

  const toggleTask = async (task) => {
    const newStatus = task.status === 'completed' ? 'pending' : 'completed';
    await API(`/tasks/${task.id}`, { method: 'PUT', body: { status: newStatus } });
    if ((filter === 'pending' && newStatus === 'completed') || (filter === 'completed' && newStatus === 'pending')) {
      setTasks(ts => ts.filter(t => t.id !== task.id));
    } else {
      setTasks(ts => ts.map(t => t.id === task.id ? { ...t, status: newStatus } : t));
    }
  };

  const deleteTask = async (id) => {
    await API(`/tasks/${id}`, { method: 'DELETE' });
    setTasks(ts => ts.filter(t => t.id !== id));
    showToast('Deleted', 'Task removed');
  };

  const editTask = (task) => {
    setForm({
      title: task.title, description: task.description || '', category: task.category, priority: task.priority,
      dueDate: task.due_date ? task.due_date.slice(0, 10) : '', dueTime: task.due_time || '',
      link: task.link || '', recurrence: task.recurrence || 'none'
    });
    setEditingTask(task); setShowForm(true);
  };

  const togglePin = async (task) => {
    const newPinned = !task.pinned;
    await API(`/tasks/${task.id}`, { method: 'PUT', body: { pinned: newPinned } });
    setTasks(ts => ts.map(t => t.id === task.id ? { ...t, pinned: newPinned } : t));
    showToast(newPinned ? 'Pinned' : 'Unpinned', task.title);
  };

  const reschedule = async (task, dateStr) => {
    await API(`/tasks/${task.id}`, { method: 'PUT', body: { dueDate: dateStr } });
    loadTasks();
    showToast('Rescheduled', `Moved to ${formatDateLabel(dateStr)}`);
  };

  const deleteCompleted = async () => {
    try {
      const result = await API('/tasks/completed', { method: 'DELETE' });
      showToast('Cleared', `Removed ${result.deleted} completed tasks`);
      loadTasks();
    } catch { showToast('Error', 'Failed to clear', 'error'); }
  };

  const applyTemplate = async (template) => {
    const todayStr = toDateStr(new Date());
    const t = template.tasks.map(t => ({ ...t, dueDate: todayStr, category: 'general' }));
    try {
      const result = await API('/tasks/bulk', { method: 'POST', body: { tasks: t } });
      showToast('Template Applied', `Created ${result.created} tasks`);
      setShowTemplates(false); loadTasks();
    } catch { showToast('Error', 'Failed to apply template', 'error'); }
  };

  const generateChecklist = async () => {
    if (!aiScript.trim()) return;
    setAiLoading(true); setAiTasks([]);
    try {
      const result = await API('/tasks/ai-checklist', { method: 'POST', body: { script: aiScript } });
      const tasks = result.tasks || [];
      setAiTasks(tasks); setAiSelected(new Set(tasks.map((_, i) => i)));
    } catch (err) { showToast('Error', err.message || 'Failed to generate', 'error'); }
    finally { setAiLoading(false); }
  };

  const createAiTasks = async () => {
    const selected = aiTasks.filter((_, i) => aiSelected.has(i));
    if (!selected.length) return;
    try {
      const result = await API('/tasks/bulk', { method: 'POST', body: { tasks: selected.map(t => ({ ...t, dueDate: toDateStr(new Date()) })) } });
      showToast('Checklist Created', `Added ${result.created} tasks`);
      setShowAiPanel(false); setAiScript(''); setAiTasks([]); loadTasks();
    } catch { showToast('Error', 'Failed to create tasks', 'error'); }
  };

  const toggleAiTask = (idx) => setAiSelected(s => { const next = new Set(s); next.has(idx) ? next.delete(idx) : next.add(idx); return next; });

  const logTime = async (seconds) => {
    if (!timerTask) return;
    try {
      const updated = await API(`/tasks/${timerTask.id}/timer`, { method: 'POST', body: { seconds } });
      setTimerTask(t => ({ ...t, time_spent: updated.time_spent }));
      setTasks(ts => ts.map(t => t.id === timerTask.id ? { ...t, time_spent: updated.time_spent } : t));
    } catch {}
  };

  // Shared task actions (operator mode)
  const toggleSharedTask = async (task) => {
    const newStatus = task.status === 'completed' ? 'pending' : 'completed';
    try {
      await API(`/sharing/task/${task.id}`, { method: 'PUT', body: { status: newStatus } });
      setSharedWithMe(ts => ts.map(t => t.id === task.id ? { ...t, status: newStatus } : t));
    } catch (err) { showToast('Error', err.message, 'error'); }
  };

  const deleteSharedTask = async (id) => {
    try {
      await API(`/sharing/task/${id}`, { method: 'DELETE' });
      setSharedWithMe(ts => ts.filter(t => t.id !== id));
      showToast('Deleted', 'Shared task removed');
    } catch (err) { showToast('Error', err.message, 'error'); }
  };

  const isOverdue = (task) => task.due_date && task.status !== 'completed' && task.due_date.slice(0, 10) < toDateStr(new Date());
  const formatDue = (task) => task.due_date ? formatDateLabel(task.due_date.slice(0, 10)) : null;
  const formatDateLabel = (dateStr) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr + 'T12:00:00');
      if (isNaN(d)) return dateStr;
      const today = new Date();
      if (dateStr === toDateStr(today)) return 'Today';
      if (dateStr === toDateStr(addDays(today, 1))) return 'Tomorrow';
      return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    } catch { return dateStr; }
  };

  const setQuickDate = (val) => { setForm(f => ({ ...f, dueDate: val })); setShowDatePicker(false); };

  if (loading) return <div className="loading-center"><div className="spinner" /></div>;

  const groups = groupTasks(tasks);
  const sections = [
    { key: 'overdue', label: 'Overdue', tasks: groups.overdue, color: 'var(--color-danger)' },
    { key: 'today', label: 'Today', tasks: groups.today, color: 'var(--color-primary)' },
    { key: 'tomorrow', label: 'Tomorrow', tasks: groups.tomorrow, color: 'var(--color-success)' },
    { key: 'thisWeek', label: 'This Week', tasks: groups.thisWeek, color: 'var(--color-warning)' },
    { key: 'later', label: 'Later', tasks: groups.later, color: 'var(--color-text-secondary)' },
    { key: 'noDate', label: 'No Date', tasks: groups.noDate, color: 'var(--color-text-secondary)' },
  ];

  const todayStr = toDateStr(new Date());
  const tomorrowStr = toDateStr(addDays(new Date(), 1));
  const taskRowProps = { toggleTask, deleteTask, editTask, formatDue, isOverdue, togglePin, setTimerTask };

  return (
    <div>
      <div className="page-header"><h1>Tasks</h1><p>Manage your to-dos and track progress</p></div>

      {offline && (
        <div className="offline-banner">
          <span>Connection lost — retrying...</span>
        </div>
      )}

      <div className="search-bar">
        <IconSearch size={16} />
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search tasks..." />
        {search && <button className="search-clear" onClick={() => setSearch('')}><IconX size={14} /></button>}
      </div>

      <div className="flex-center" style={{ justifyContent: 'space-between', marginBottom: '0.75rem' }}>
        <div className="tab-strip" style={{ marginBottom: 0, flex: 1 }}>
          {['all', 'pending', 'completed', 'shared'].map(f => (
            <button key={f} className={filter === f ? 'active' : ''} onClick={() => updateFilter(f)}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
        <div className="flex gap-sm">
          <button className="btn btn-secondary btn-sm" onClick={() => setShowTemplates(!showTemplates)} title="Templates"><IconTemplate size={14} /></button>
          <button className="btn btn-secondary btn-sm" onClick={() => setShowAiPanel(!showAiPanel)} title="AI Script to Checklist" style={{ color: '#7c3aed' }}><IconZap size={14} /></button>
          <button className="btn btn-secondary btn-sm" onClick={() => setShowShareModal(true)} title="Share Tasks"><IconUsers size={14} /></button>
          <button className="btn btn-primary btn-sm" onClick={() => { resetForm(); setShowForm(true); }}><IconPlus size={16} /> Add</button>
        </div>
      </div>

      {/* Templates */}
      {showTemplates && (
        <div className="card templates-card">
          <div className="card-title"><span>Quick Templates</span><button className="btn btn-ghost btn-sm" onClick={() => setShowTemplates(false)}><IconX size={14} /></button></div>
          <div className="template-grid">
            {TEMPLATES.map((t, i) => (
              <button key={i} className="template-tile" onClick={() => applyTemplate(t)}>
                <span className="template-icon"><t.Icon size={20} /></span>
                <span className="template-name">{t.name}</span>
                <span className="template-count">{t.tasks.length} tasks</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* AI Checklist */}
      {showAiPanel && (
        <div className="card ai-checklist-card">
          <div className="card-title">
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}><IconZap size={16} style={{ color: '#7c3aed' }} /> Script to Checklist</span>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowAiPanel(false)}><IconX size={14} /></button>
          </div>
          <div className="form-group" style={{ marginBottom: '0.75rem' }}>
            <textarea value={aiScript} onChange={e => setAiScript(e.target.value)}
              placeholder="Paste a script, recipe, instructions, process, plan — anything. AI will break it into tasks..." rows={4} style={{ fontSize: '0.85rem' }} />
          </div>
          <button className="btn btn-primary btn-sm" onClick={generateChecklist} disabled={aiLoading || !aiScript.trim()}
            style={{ background: '#7c3aed', borderColor: '#7c3aed', marginBottom: aiTasks.length ? '0.75rem' : 0 }}>
            {aiLoading ? <><div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Generating...</> : <><IconZap size={14} /> Generate Checklist</>}
          </button>
          {aiTasks.length > 0 && (
            <div className="ai-task-list">
              {aiTasks.map((t, i) => (
                <div key={i} className={`ai-task-row ${aiSelected.has(i) ? '' : 'excluded'}`} onClick={() => toggleAiTask(i)}>
                  <button className={`task-checkbox ${aiSelected.has(i) ? 'checked' : ''}`}>{aiSelected.has(i) && <IconCheck size={14} />}</button>
                  <div className="ai-task-body">
                    <div className="ai-task-title">{t.title}</div>
                    <div className="task-meta"><span className={`task-tag tag-${t.priority}`}>{t.priority}</span><span className="task-tag tag-category">{t.category}</span></div>
                  </div>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.75rem' }}>
                <span className="text-sm text-secondary">{aiSelected.size} of {aiTasks.length} selected</span>
                <button className="btn btn-primary btn-sm" onClick={createAiTasks} disabled={aiSelected.size === 0}
                  style={{ background: '#7c3aed', borderColor: '#7c3aed' }}>Create {aiSelected.size} Tasks</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Task Form Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && resetForm()}>
          <div className="modal">
            <div className="modal-header"><h3>{editingTask ? 'Edit Task' : 'New Task'}</h3><button className="modal-close" onClick={resetForm}><IconX size={20} /></button></div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group"><label>Title</label><input type="text" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="What needs to be done?" required autoFocus /></div>
                <div className="form-group"><label>Description</label><textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Add details (optional)" rows="2" /></div>
                <div className="form-row">
                  <div className="form-group"><label>Link</label><div className="link-input-wrap"><IconLink size={14} /><input type="url" value={form.link} onChange={e => setForm({ ...form, link: e.target.value })} placeholder="https://..." /></div></div>
                  <div className="form-group"><label>Repeat</label><select value={form.recurrence} onChange={e => setForm({ ...form, recurrence: e.target.value })}><option value="none">No repeat</option><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="annual">Annually</option></select></div>
                </div>
                <div className="form-row">
                  <div className="form-group"><label>Category</label><select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>{CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}</select></div>
                  <div className="form-group"><label>Priority</label><div className="priority-chips">{['high', 'medium', 'low'].map(p => (<button key={p} type="button" className={`priority-chip chip-${p} ${form.priority === p ? 'active' : ''}`} onClick={() => setForm({ ...form, priority: p })}>{p.charAt(0).toUpperCase() + p.slice(1)}</button>))}</div></div>
                </div>
                <div className="form-group"><label>When</label>
                  <div className="date-chip-grid">
                    {quickDates().map(qd => (<button key={qd.label} type="button" className={`date-chip ${form.dueDate === qd.value ? 'active' : ''}`} style={{ '--chip-color': qd.accent }} onClick={() => setQuickDate(qd.value)}><span className="date-chip-label">{qd.label}</span><span className="date-chip-sub">{qd.sub}</span></button>))}
                    <button type="button" className={`date-chip ${form.dueDate && !quickDates().some(q => q.value === form.dueDate) ? 'active' : ''}`} style={{ '--chip-color': 'var(--color-text-secondary)' }} onClick={() => setShowDatePicker(!showDatePicker)}><span className="date-chip-label"><IconCalendar size={13} /></span><span className="date-chip-sub">Pick</span></button>
                  </div>
                  {showDatePicker && <input type="date" value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })} min={toDateStr(new Date())} style={{ marginTop: '0.5rem' }} />}
                  {form.dueDate && <button type="button" className="clear-date-btn" onClick={() => setForm({ ...form, dueDate: '', dueTime: '' })}><IconX size={12} /> Clear date</button>}
                </div>
                {form.dueDate && (
                  <div className="form-group"><label>Time (optional)</label>
                    <div className="time-chip-row">{quickTimes.map(qt => { const Icon = quickTimeIcons[qt.value]; return (<button key={qt.label} type="button" className={`time-chip ${form.dueTime === qt.value ? 'active' : ''}`} onClick={() => setForm(f => ({ ...f, dueTime: f.dueTime === qt.value ? '' : qt.value }))}><Icon size={14} /><span>{qt.label}</span></button>); })}</div>
                    <AmPmPicker value={form.dueTime} onChange={v => setForm({ ...form, dueTime: v })} />
                  </div>
                )}
              </div>
              <div className="modal-footer"><button type="button" className="btn btn-ghost" onClick={resetForm}>Cancel</button><button type="submit" className="btn btn-primary">{editingTask ? 'Save' : 'Create Task'}</button></div>
            </form>
          </div>
        </div>
      )}

      {/* Task List */}
      {filter === 'shared' ? (
        sharedWithMe.length === 0 ? (
          <div className="card"><div className="empty-state"><IconUsers size={40} /><h3>No shared tasks</h3><p>Link with someone using the people icon above</p></div></div>
        ) : (<>
          <div className="shared-sub-filter">
            {['all', 'current', 'completed'].map(f => (
              <button key={f} className={sharedFilter === f ? 'active' : ''} onClick={() => updateSharedFilter(f)}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
          {sharedWithMe
            .filter(t => sharedFilter === 'all' ? true : sharedFilter === 'current' ? t.status !== 'completed' : t.status === 'completed')
            .map(task => {
          const perm = sharedPermissions[task.user_id];
          const isOp = perm === 'operator';
          return <TaskRow key={task.id} task={task}
            toggleTask={isOp ? toggleSharedTask : toggleTask}
            deleteTask={isOp ? deleteSharedTask : null}
            editTask={null} formatDue={formatDue} isOverdue={isOverdue}
            togglePin={null} setTimerTask={setTimerTask}
            sharedBy={task.owner_name || task.owner_username}
            isOperator={isOp} />;
        })}
        </>)
      ) : tasks.length === 0 ? (
        <div className="card"><div className="empty-state"><IconTasks size={40} /><h3>{filter === 'completed' ? 'No completed tasks' : 'No tasks yet'}</h3><p>Tap the + button to add your first task</p></div></div>
      ) : filter === 'completed' ? (
        <>
          {tasks.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.5rem' }}>
              <button className="btn btn-danger btn-sm" onClick={deleteCompleted}><IconTrash size={14} /> Clear all completed</button>
            </div>
          )}
          {tasks.map(task => <TaskRow key={task.id} task={task} {...taskRowProps} />)}
        </>
      ) : (
        sections.filter(s => s.tasks.length > 0).map(section => (
          <div key={section.key} className="task-section">
            <div className="task-section-header">
              <div className="task-section-dot" style={{ background: section.color }} />
              <span className="task-section-label">{section.label}</span>
              <span className="task-section-count">{section.tasks.length}</span>
            </div>
            {section.tasks.map(task => (
              <TaskRow key={task.id} task={task} {...taskRowProps}
                showReschedule={section.key === 'overdue'} reschedule={reschedule} todayStr={todayStr} tomorrowStr={tomorrowStr} />
            ))}
          </div>
        ))
      )}

      {/* Modals */}
      {timerTask && <FocusTimer task={timerTask} onClose={() => setTimerTask(null)} onTimeLogged={logTime} />}
      {showShareModal && <ShareModal onClose={() => setShowShareModal(false)} showToast={showToast} />}
    </div>
  );
}

function TaskRow({ task, toggleTask, deleteTask, editTask, formatDue, isOverdue, togglePin, setTimerTask,
  showReschedule, reschedule, todayStr, tomorrowStr, sharedBy, isOperator }) {
  const [showRescheduleMenu, setShowRescheduleMenu] = useState(false);
  const [swipeX, setSwipeX] = useState(0);
  const touchStartX = useRef(0);

  const onTouchStart = (e) => { touchStartX.current = e.touches[0].clientX; };
  const onTouchMove = (e) => { setSwipeX(Math.max(-100, Math.min(100, e.touches[0].clientX - touchStartX.current))); };
  const onTouchEnd = () => { if (swipeX > 60) toggleTask(task); else if (swipeX < -60) deleteTask(task.id); setSwipeX(0); };

  return (
    <div className="task-item-wrap">
      {swipeX > 20 && <div className="swipe-bg swipe-complete"><IconCheck size={18} /></div>}
      {swipeX < -20 && <div className="swipe-bg swipe-delete"><IconTrash size={18} /></div>}
      <div className="task-item" style={{ transform: `translateX(${swipeX}px)`, transition: swipeX === 0 ? 'transform 0.2s' : 'none' }}
        onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
        <button className={`task-checkbox ${task.status === 'completed' ? 'checked' : ''}`} onClick={() => toggleTask(task)}>
          {task.status === 'completed' && <IconCheck size={14} />}
        </button>
        <div className="task-body">
          <div className="task-title-row">
            <div className={`task-title ${task.status === 'completed' ? 'completed' : ''}`}>{task.title}</div>
            <div className="task-title-badges">
              {task.pinned && <span className="task-pin-badge"><IconPin size={10} /></span>}
              {task.recurrence && task.recurrence !== 'none' && <span className="task-recurrence-badge"><IconRepeat size={10} /></span>}
              {task.due_time && <span className="task-time-badge"><IconClock size={10} /> {formatTime12h(task.due_time)}</span>}
            </div>
          </div>
          {task.description && <div className="task-desc">{task.description}</div>}
          {task.link && (
            <a href={task.link} target="_blank" rel="noopener noreferrer" className="task-link" onClick={e => e.stopPropagation()}>
              <IconExternalLink size={12} /><span>{task.link.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]}</span>
            </a>
          )}
          <div className="task-meta">
            <span className={`task-tag tag-${task.priority}`}>{task.priority}</span>
            <span className="task-tag tag-category">{task.category}</span>
            {formatDue(task) && <span className={`task-due ${isOverdue(task) ? 'overdue' : ''}`}>{formatDue(task)}</span>}
            {task.time_spent > 0 && <span className="task-time-tracked"><IconClock size={10} /> {formatTimeSpent(task.time_spent)}</span>}
            {sharedBy && <span className="task-shared-badge"><IconUsers size={10} /> {sharedBy}</span>}
          </div>
          {showReschedule && (
            <div className="reschedule-row">
              <button className="reschedule-chip" onClick={() => reschedule(task, todayStr)}>Move to Today</button>
              <button className="reschedule-chip" onClick={() => reschedule(task, tomorrowStr)}>Tomorrow</button>
              <button className="reschedule-chip" onClick={() => setShowRescheduleMenu(!showRescheduleMenu)}><IconCalendar size={10} /> Pick</button>
              {showRescheduleMenu && <input type="date" className="reschedule-date-input" onChange={e => { reschedule(task, e.target.value); setShowRescheduleMenu(false); }} autoFocus />}
            </div>
          )}
        </div>
        <div className="task-actions">
          {togglePin && <button className={`task-action-btn ${task.pinned ? 'pinned' : ''}`} onClick={() => togglePin(task)} title="Pin"><IconPin size={14} /></button>}
          <button className="task-action-btn" onClick={() => setTimerTask(task)} title="Focus Timer"><IconClock size={14} /></button>
          {editTask && <button className="task-action-btn" onClick={() => editTask(task)} title="Edit"><IconEdit size={16} /></button>}
          {deleteTask && <button className="task-action-btn" onClick={() => deleteTask(task.id)} title="Delete"><IconTrash size={16} /></button>}
        </div>
      </div>
    </div>
  );
}
