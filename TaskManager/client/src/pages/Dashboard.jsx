import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { API, useAuth } from '../App';
import { IconPlus, IconCalendar, IconChat, IconSettings, IconCheck, IconTarget, IconClock, IconAlertCircle } from '../icons';

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({ pending: 0, completedToday: 0, overdue: 0, today: 0 });
  const [todayTasks, setTodayTasks] = useState([]);
  const [todayEvents, setTodayEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    Promise.all([
      API('/tasks/stats'),
      API(`/tasks?date=${today}`),
      API(`/events?date=${today}`)
    ]).then(([s, t, e]) => {
      setStats(s);
      setTodayTasks(t);
      setTodayEvents(e);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const toggleTask = async (task) => {
    const newStatus = task.status === 'completed' ? 'pending' : 'completed';
    await API(`/tasks/${task.id}`, { method: 'PUT', body: { status: newStatus } });
    setTodayTasks(ts => ts.map(t => t.id === task.id ? { ...t, status: newStatus } : t));
    setStats(s => ({
      ...s,
      pending: newStatus === 'completed' ? s.pending - 1 : s.pending + 1,
      completedToday: newStatus === 'completed' ? s.completedToday + 1 : s.completedToday - 1
    }));
  };

  const formatTime = (dt) => {
    if (!dt) return '';
    return new Date(dt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  };

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  if (loading) return <div className="loading-center"><div className="spinner" /></div>;

  return (
    <div>
      <div className="page-header">
        <h1>{greeting()}, {user?.displayName || user?.username}</h1>
        <p>{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
      </div>

      {/* Stats */}
      <div className="stats-row">
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'var(--color-primary-light)', color: 'var(--color-primary)' }}>
            <IconTarget size={18} />
          </div>
          <div>
            <div className="stat-value">{stats.today}</div>
            <div className="stat-label">Today</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'var(--color-success-light)', color: 'var(--color-success)' }}>
            <IconCheck size={18} />
          </div>
          <div>
            <div className="stat-value">{stats.completedToday}</div>
            <div className="stat-label">Done</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'var(--color-warning-light)', color: 'var(--color-warning)' }}>
            <IconClock size={18} />
          </div>
          <div>
            <div className="stat-value">{stats.pending}</div>
            <div className="stat-label">Pending</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'var(--color-danger-light)', color: 'var(--color-danger)' }}>
            <IconAlertCircle size={18} />
          </div>
          <div>
            <div className="stat-value">{stats.overdue}</div>
            <div className="stat-label">Overdue</div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="quick-actions">
        <button className="quick-action-tile" onClick={() => navigate('/tasks')}>
          <IconPlus size={22} />
          <span>New Task</span>
        </button>
        <button className="quick-action-tile" onClick={() => navigate('/calendar')}>
          <IconCalendar size={22} />
          <span>New Event</span>
        </button>
        <button className="quick-action-tile" onClick={() => navigate('/chat')}>
          <IconChat size={22} />
          <span>AI Planner</span>
        </button>
        <button className="quick-action-tile" onClick={() => navigate('/profile')}>
          <IconSettings size={22} />
          <span>Settings</span>
        </button>
      </div>

      {/* Today's Events */}
      {todayEvents.length > 0 && (
        <div className="card">
          <div className="card-title">
            <span>Today's Schedule</span>
            <Link to="/calendar" className="btn btn-sm btn-secondary">View All</Link>
          </div>
          {todayEvents.map(e => (
            <div key={e.id} className="event-item">
              <div className="event-color-bar" style={{ background: e.color || '#2563eb' }} />
              <div className="event-body">
                <div className="event-title">{e.title}</div>
                <div className="event-time">
                  <IconClock size={12} />
                  <span>{formatTime(e.start_time)}{e.end_time ? ` - ${formatTime(e.end_time)}` : ''}</span>
                </div>
                {e.location && <div className="event-location">{e.location}</div>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Today's Tasks */}
      <div className="card">
        <div className="card-title">
          <span>Today's Tasks</span>
          <Link to="/tasks" className="btn btn-sm btn-secondary">View All</Link>
        </div>
        {todayTasks.length === 0 ? (
          <div className="empty-state-inline">
            <p>No tasks due today</p>
          </div>
        ) : todayTasks.slice(0, 6).map(task => (
          <div key={task.id} className="task-item compact">
            <button
              className={`task-checkbox ${task.status === 'completed' ? 'checked' : ''}`}
              onClick={() => toggleTask(task)}
            >
              {task.status === 'completed' && <IconCheck size={14} />}
            </button>
            <div className="task-body">
              <div className={`task-title ${task.status === 'completed' ? 'completed' : ''}`}>{task.title}</div>
              <div className="task-meta">
                <span className={`task-tag tag-${task.priority}`}>{task.priority}</span>
                {task.due_time && <span className="task-due"><IconClock size={10} /> {task.due_time}</span>}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Empty state when nothing today */}
      {todayTasks.length === 0 && todayEvents.length === 0 && (
        <div className="card">
          <div className="empty-state">
            <IconCalendar size={40} />
            <h3>Your day is clear</h3>
            <p>Add tasks or events to get started</p>
            <div className="flex gap-sm" style={{ justifyContent: 'center', marginTop: '0.75rem' }}>
              <button className="btn btn-primary btn-sm" onClick={() => navigate('/tasks')}>Add Task</button>
              <button className="btn btn-secondary btn-sm" onClick={() => navigate('/calendar')}>Add Event</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
