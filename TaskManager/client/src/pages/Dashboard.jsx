import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { API, useAuth } from '../App';
import { IconPlus, IconCalendar, IconChat, IconSettings, IconCheck, IconTarget, IconClock, IconAlertCircle, IconChevronRight } from '../icons';

const toDateStr = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
};

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({ pending: 0, completedToday: 0, overdue: 0, today: 0 });
  const [todayTasks, setTodayTasks] = useState([]);
  const [todayEvents, setTodayEvents] = useState([]);
  const [weekData, setWeekData] = useState([]);
  const [loading, setLoading] = useState(true);
  const today = new Date();
  const todayStr = toDateStr(today);

  useEffect(() => {
    const loadAll = async () => {
      try {
        const [s, t, e, allTasks] = await Promise.all([
          API('/tasks/stats'),
          API(`/tasks?date=${todayStr}`),
          API(`/events?date=${todayStr}`),
          API('/tasks?status=pending')
        ]);
        setStats(s);
        setTodayTasks(t);
        setTodayEvents(e);

        // Build week data
        const week = [];
        for (let i = 0; i < 7; i++) {
          const d = new Date(today);
          d.setDate(today.getDate() + i);
          const ds = toDateStr(d);
          const dayTasks = allTasks.filter(tk => tk.due_date && tk.due_date.slice(0, 10) === ds);
          week.push({
            date: d,
            dateStr: ds,
            label: i === 0 ? 'Today' : i === 1 ? 'Tmrw' : d.toLocaleDateString('en-US', { weekday: 'short' }),
            day: d.getDate(),
            taskCount: dayTasks.length,
            completedCount: dayTasks.filter(tk => tk.status === 'completed').length,
            isToday: i === 0
          });
        }
        setWeekData(week);
      } catch {} finally { setLoading(false); }
    };
    loadAll();
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

  const completedToday = todayTasks.filter(t => t.status === 'completed').length;
  const totalToday = todayTasks.length;
  const progressPercent = totalToday > 0 ? Math.round((completedToday / totalToday) * 100) : 0;

  if (loading) return <div className="loading-center"><div className="spinner" /></div>;

  return (
    <div>
      <div className="page-header">
        <h1>{greeting()}, {user?.displayName || user?.username}</h1>
        <p>{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
      </div>

      {/* Today's Progress */}
      {totalToday > 0 && (
        <div className="card progress-card">
          <div className="progress-header">
            <div>
              <div className="progress-label">Today's Progress</div>
              <div className="progress-detail">{completedToday} of {totalToday} tasks done</div>
            </div>
            <div className="progress-ring">
              <svg width="52" height="52" viewBox="0 0 52 52">
                <circle cx="26" cy="26" r="22" fill="none" stroke="var(--color-border)" strokeWidth="4" />
                <circle cx="26" cy="26" r="22" fill="none" stroke="var(--color-primary)" strokeWidth="4"
                  strokeDasharray={`${2 * Math.PI * 22}`}
                  strokeDashoffset={`${2 * Math.PI * 22 * (1 - progressPercent / 100)}`}
                  strokeLinecap="round" transform="rotate(-90 26 26)" style={{ transition: 'stroke-dashoffset 0.6s ease' }} />
              </svg>
              <span className="progress-ring-text">{progressPercent}%</span>
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="stats-row">
        <div className="stat-card clickable" onClick={() => navigate(`/calendar?date=${todayStr}`)}>
          <div className="stat-icon" style={{ background: 'var(--color-primary-light)', color: 'var(--color-primary)' }}>
            <IconTarget size={18} />
          </div>
          <div>
            <div className="stat-value">{stats.today}</div>
            <div className="stat-label">Today</div>
          </div>
        </div>
        <div className="stat-card clickable" onClick={() => navigate('/tasks?filter=completed')}>
          <div className="stat-icon" style={{ background: 'var(--color-success-light)', color: 'var(--color-success)' }}>
            <IconCheck size={18} />
          </div>
          <div>
            <div className="stat-value">{stats.completedToday}</div>
            <div className="stat-label">Done</div>
          </div>
        </div>
        <div className="stat-card clickable" onClick={() => navigate('/tasks?filter=pending')}>
          <div className="stat-icon" style={{ background: 'var(--color-warning-light)', color: 'var(--color-warning)' }}>
            <IconClock size={18} />
          </div>
          <div>
            <div className="stat-value">{stats.pending}</div>
            <div className="stat-label">Pending</div>
          </div>
        </div>
        <div className="stat-card clickable" onClick={() => navigate('/tasks?filter=pending')}>
          <div className="stat-icon" style={{ background: 'var(--color-danger-light)', color: 'var(--color-danger)' }}>
            <IconAlertCircle size={18} />
          </div>
          <div>
            <div className="stat-value">{stats.overdue}</div>
            <div className="stat-label">Overdue</div>
          </div>
        </div>
      </div>

      {/* Week Ahead */}
      <div className="card">
        <div className="card-title">
          <span>Week Ahead</span>
          <Link to="/calendar" className="btn btn-sm btn-secondary">Calendar <IconChevronRight size={12} /></Link>
        </div>
        <div className="week-ahead">
          {weekData.map((wd, i) => {
            const hasTasks = wd.taskCount > 0;
            const allDone = hasTasks && wd.completedCount === wd.taskCount;
            return (
              <div key={i}
                className={`week-ahead-day ${wd.isToday ? 'today' : ''} ${hasTasks ? 'has-tasks' : ''} ${allDone ? 'all-done' : ''}`}
                onClick={() => navigate(`/calendar?date=${wd.dateStr}`)}>
                <div className="week-ahead-label">{wd.label}</div>
                <div className="week-ahead-num">{wd.day}</div>
                {hasTasks ? (
                  <div className="week-ahead-badge">
                    {allDone ? <IconCheck size={10} /> : wd.taskCount}
                  </div>
                ) : (
                  <div className="week-ahead-no-badge" />
                )}
              </div>
            );
          })}
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

      {/* Today's Timeline */}
      {(todayEvents.length > 0 || todayTasks.length > 0) && (
        <div className="card">
          <div className="card-title">
            <span>Today's Timeline</span>
          </div>
          <div className="timeline">
            {/* Merge events and tasks, sorted by time */}
            {[
              ...todayEvents.map(e => ({ type: 'event', time: e.start_time, data: e })),
              ...todayTasks.filter(t => t.due_time).map(t => ({ type: 'task', time: `${todayStr}T${t.due_time}`, data: t })),
            ].sort((a, b) => new Date(a.time) - new Date(b.time)).map((item, i) => (
              <div key={`${item.type}-${item.data.id}`} className="timeline-item">
                <div className="timeline-time">{formatTime(item.time)}</div>
                <div className={`timeline-dot ${item.type}`} />
                <div className="timeline-content">
                  {item.type === 'event' ? (
                    <>
                      <div className="timeline-title">{item.data.title}</div>
                      {item.data.location && <div className="timeline-sub">{item.data.location}</div>}
                      {item.data.end_time && <div className="timeline-sub">Until {formatTime(item.data.end_time)}</div>}
                    </>
                  ) : (
                    <>
                      <div className="timeline-title">{item.data.title}</div>
                      <div className="task-meta" style={{ marginTop: '0.15rem' }}>
                        <span className={`task-tag tag-${item.data.priority}`}>{item.data.priority}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            ))}

            {/* Tasks without time */}
            {todayTasks.filter(t => !t.due_time).length > 0 && (
              <>
                <div className="timeline-separator">Anytime</div>
                {todayTasks.filter(t => !t.due_time).map(task => (
                  <div key={task.id} className="task-item compact">
                    <button className={`task-checkbox ${task.status === 'completed' ? 'checked' : ''}`} onClick={() => toggleTask(task)}>
                      {task.status === 'completed' && <IconCheck size={14} />}
                    </button>
                    <div className="task-body">
                      <div className={`task-title ${task.status === 'completed' ? 'completed' : ''}`}>{task.title}</div>
                      <div className="task-meta">
                        <span className={`task-tag tag-${task.priority}`}>{task.priority}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      )}

      {/* Empty state */}
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
