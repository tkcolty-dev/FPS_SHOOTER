import { NavLink, useParams } from 'react-router-dom';

function Icon({ name }) {
  const icons = {
    dashboard: (
      <svg viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>
    ),
    plus: (
      <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="16" /><line x1="8" y1="12" x2="16" y2="12" /></svg>
    ),
    list: (
      <svg viewBox="0 0 24 24"><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" /></svg>
    ),
    settings: (
      <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" /></svg>
    ),
  };
  return <span className="nav-icon">{icons[name]}</span>;
}

export default function Navbar() {
  const { boothId } = useParams();
  if (!boothId) return null;

  const base = `/booth/${boothId}`;

  return (
    <nav className="bottom-nav">
      <NavLink to={base} end className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
        <Icon name="dashboard" />
        <span>Dashboard</span>
      </NavLink>
      <NavLink to={`${base}/order`} className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
        <Icon name="plus" />
        <span>Log Sale</span>
      </NavLink>
      <NavLink to={`${base}/orders`} className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
        <Icon name="list" />
        <span>Orders</span>
      </NavLink>
      <NavLink to={`${base}/settings`} className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
        <Icon name="settings" />
        <span>Settings</span>
      </NavLink>
    </nav>
  );
}
