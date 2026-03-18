import React, { useState, useEffect, useCallback } from 'react';
import { API, useToast } from '../App';
import { IconPlus, IconCheck, IconEdit, IconTrash, IconClock, IconX } from '../icons';

const CATEGORIES = ['general', 'work', 'personal', 'health', 'shopping', 'errands'];

export default function Tasks() {
  const showToast = useToast();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [form, setForm] = useState({ title: '', description: '', category: 'general', priority: 'medium', dueDate: '', dueTime: '' });

  const loadTasks = useCallback(async () => {
    try {
      const params = filter === 'all' ? '' : `?status=${filter}`;
      setTasks(await API(`/tasks${params}`));
    } catch {} finally { setLoading(false); }
  }, [filter]);

  useEffect(() => { loadTasks(); }, [loadTasks]);

  const resetForm = () => {
    setForm({ title: '', description: '', category: 'general', priority: 'medium', dueDate: '', dueTime: '' });
    setEditingTask(null);
    setShowForm(false);
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
    } catch (err) {
      showToast('Error', err.message, 'error');
    }
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
      dueTime: task.due_time || ''
    });
    setEditingTask(task);
    setShowForm(true);
  };

  const isOverdue = (task) => task.due_date && task.status !== 'completed' && new Date(task.due_date) < new Date();

  const formatDue = (task) => {
    if (!task.due_date) return null;
    const d = new Date(task.due_date);
    const today = new Date();
    const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
    let label;
    if (d.toDateString() === today.toDateString()) label = 'Today';
    else if (d.toDateString() === tomorrow.toDateString()) label = 'Tomorrow';
    else label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return label + (task.due_time ? ' ' + task.due_time : '');
  };

  if (loading) return <div className="loading-center"><div className="spinner" /></div>;

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
                <div className="form-row">
                  <div className="form-group">
                    <label>Category</label>
                    <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                      {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Priority</label>
                    <select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}>
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                    </select>
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Due Date</label>
                    <input type="date" value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>Due Time</label>
                    <input type="time" value={form.dueTime} onChange={e => setForm({ ...form, dueTime: e.target.value })} />
                  </div>
                </div>
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
      ) : tasks.map(task => (
        <div key={task.id} className="task-item">
          <button
            className={`task-checkbox ${task.status === 'completed' ? 'checked' : ''}`}
            onClick={() => toggleTask(task)}
          >
            {task.status === 'completed' && <IconCheck size={14} />}
          </button>
          <div className="task-body">
            <div className={`task-title ${task.status === 'completed' ? 'completed' : ''}`}>{task.title}</div>
            {task.description && <div className="task-desc">{task.description}</div>}
            <div className="task-meta">
              <span className={`task-tag tag-${task.priority}`}>{task.priority}</span>
              <span className="task-tag tag-category">{task.category}</span>
              {formatDue(task) && (
                <span className={`task-due ${isOverdue(task) ? 'overdue' : ''}`}>
                  <IconClock size={10} /> {formatDue(task)}
                </span>
              )}
            </div>
          </div>
          <div className="task-actions">
            <button className="task-action-btn" onClick={() => editTask(task)} title="Edit"><IconEdit size={16} /></button>
            <button className="task-action-btn" onClick={() => deleteTask(task.id)} title="Delete"><IconTrash size={16} /></button>
          </div>
        </div>
      ))}
    </div>
  );
}

import { IconTasks } from '../icons';
