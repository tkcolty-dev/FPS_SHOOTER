import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useBooth } from '../context/BoothContext';
import { formatDate } from '../utils/helpers';

export default function BoothList() {
  const { user, logout } = useAuth();
  const { booths, getBoothStats } = useBooth();

  return (
    <div className="app-main" style={{ paddingBottom: 32 }}>
      <div className="container">
        <div className="booth-list-header">
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, letterSpacing: '-0.02em' }}>
              My Booths
            </h1>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: 2 }}>
              Hi, {user?.name}
            </p>
          </div>
          <Link to="/booths/new" className="btn btn-primary btn-sm">
            + New Booth
          </Link>
        </div>

        {booths.length === 0 ? (
          <div className="empty-state animate-in">
            <div className="empty-icon">&#127850;</div>
            <h3>No booths yet</h3>
            <p>Create your first cookie booth to start tracking sales and inventory</p>
            <Link to="/booths/new" className="btn btn-primary">
              Create a Booth
            </Link>
          </div>
        ) : (
          <div className="animate-in">
            {booths.map(booth => {
              const stats = getBoothStats(booth.id);
              return (
                <Link to={`/booth/${booth.id}`} key={booth.id} className="booth-card">
                  <div className="booth-icon">&#127850;</div>
                  <div className="booth-info">
                    <div className="booth-name">{booth.name}</div>
                    <div className="booth-meta">
                      {formatDate(booth.createdAt)}
                      {stats ? ` \u00B7 ${stats.orderCount} orders` : ''}
                    </div>
                  </div>
                  <div className="booth-arrow">&rsaquo;</div>
                </Link>
              );
            })}
          </div>
        )}

        <div className="logout-section">
          <button onClick={logout} className="btn btn-ghost" style={{ color: 'var(--danger)' }}>
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}
