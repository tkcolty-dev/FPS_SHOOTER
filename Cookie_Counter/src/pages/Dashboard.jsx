import { useParams, useNavigate, Link } from 'react-router-dom';
import { useBooth } from '../context/BoothContext';
import { COOKIE_TYPES, PRICE_PER_BOX } from '../data/cookies';
import { formatCurrency } from '../utils/helpers';
import Navbar from '../components/Navbar';

export default function Dashboard() {
  const { boothId } = useParams();
  const navigate = useNavigate();
  const { getBooth, getBoothStats } = useBooth();
  const booth = getBooth(boothId);
  const stats = getBoothStats(boothId);

  if (!booth) {
    return (
      <div className="app-main" style={{ paddingBottom: 32 }}>
        <div className="container">
          <div className="empty-state">
            <h3>Booth not found</h3>
            <Link to="/booths" className="btn btn-primary" style={{ marginTop: 16 }}>
              Back to Booths
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const totalInventoryRemaining = COOKIE_TYPES.reduce(
    (sum, c) => sum + (stats?.perCookie[c.id]?.remaining || 0), 0
  );
  const totalInventoryStarting = COOKIE_TYPES.reduce(
    (sum, c) => sum + (stats?.perCookie[c.id]?.starting || 0), 0
  );

  return (
    <div className="app-main">
      <div className="container animate-in">
        <div className="top-bar">
          <button
            onClick={() => navigate('/booths')}
            className="back-btn"
            style={{ marginBottom: 0 }}
          >
            <svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6" /></svg>
            Booths
          </button>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
            {booth.name}
          </span>
        </div>

        {/* Summary stats */}
        <div className="stats-row">
          <div className="stat-card primary">
            <div className="stat-value">{formatCurrency(stats?.cashOnHand || 0)}</div>
            <div className="stat-label">Cash On Hand</div>
          </div>
          <div className="stat-card success">
            <div className="stat-value">{formatCurrency(stats?.totalRevenue || 0)}</div>
            <div className="stat-label">Revenue</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats?.totalBoxesSold || 0}</div>
            <div className="stat-label">Boxes Sold</div>
          </div>
        </div>

        {/* Quick stats row */}
        <div className="stats-row" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
          <div className="stat-card">
            <div className="stat-value">{stats?.orderCount || 0}</div>
            <div className="stat-label">Orders</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats?.totalBoxesDonated || 0}</div>
            <div className="stat-label">Donated</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{formatCurrency(stats?.totalCashDonations || 0)}</div>
            <div className="stat-label">Cash Tips</div>
          </div>
        </div>

        {/* Inventory remaining bar */}
        {totalInventoryStarting > 0 && (
          <div className="dash-section">
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              marginBottom: 6,
            }}>
              <span className="dash-section-title" style={{ marginBottom: 0 }}>Inventory</span>
              <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                {totalInventoryRemaining} / {totalInventoryStarting} remaining
              </span>
            </div>
            <div className="inv-progress" style={{ height: 6, borderRadius: 3, marginBottom: 14 }}>
              <div
                className="inv-progress-fill"
                style={{
                  width: `${Math.max(0, (totalInventoryRemaining / totalInventoryStarting) * 100)}%`,
                  background: totalInventoryRemaining > 0 ? 'var(--primary)' : 'var(--danger)',
                  borderRadius: 3,
                }}
              />
            </div>
          </div>
        )}

        {/* Per-cookie inventory grid */}
        <div className="dash-section">
          <div className="dash-section-title">Cookie Breakdown</div>
          <div className="cookie-inv-grid">
            {COOKIE_TYPES.map(cookie => {
              const pc = stats?.perCookie[cookie.id];
              if (!pc || pc.starting === 0) return null;
              const pct = pc.starting > 0 ? (pc.remaining / pc.starting) * 100 : 0;
              return (
                <div className="cookie-inv-card" key={cookie.id}>
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: 3,
                    background: cookie.color,
                    borderRadius: '12px 12px 0 0',
                  }} />
                  <div className="cookie-inv-header">
                    <div className="cookie-inv-dot" style={{ background: cookie.color }} />
                    <span className="cookie-inv-name">{cookie.name}</span>
                  </div>
                  <div className="cookie-inv-stats">
                    <div className="cookie-inv-stat">
                      <div className="cookie-inv-stat-val">{pc.remaining}</div>
                      <div className="cookie-inv-stat-label">Left</div>
                    </div>
                    <div className="cookie-inv-stat">
                      <div className="cookie-inv-stat-val">{pc.sold}</div>
                      <div className="cookie-inv-stat-label">Sold</div>
                    </div>
                    <div className="cookie-inv-stat">
                      <div className="cookie-inv-stat-val">{pc.donated}</div>
                      <div className="cookie-inv-stat-label">Donated</div>
                    </div>
                  </div>
                  <div className="inv-progress">
                    <div
                      className="inv-progress-fill"
                      style={{
                        width: `${Math.max(0, pct)}%`,
                        background: pct > 20 ? cookie.color : 'var(--danger)',
                      }}
                    />
                  </div>
                  <div style={{
                    marginTop: 6,
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    color: 'var(--text-secondary)',
                    textAlign: 'right',
                  }}>
                    {formatCurrency(pc.revenue)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Revenue table */}
        <div className="dash-section">
          <div className="dash-section-title">Revenue Summary</div>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Cookie</th>
                  <th style={{ textAlign: 'center', padding: '10px 8px', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.72rem', textTransform: 'uppercase' }}>Boxes</th>
                  <th style={{ textAlign: 'right', padding: '10px 14px', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.72rem', textTransform: 'uppercase' }}>Revenue</th>
                </tr>
              </thead>
              <tbody>
                {COOKIE_TYPES.map(cookie => {
                  const pc = stats?.perCookie[cookie.id];
                  if (!pc || (pc.sold === 0 && pc.donated === 0)) return null;
                  return [
                    pc.sold > 0 && (
                      <tr key={cookie.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                        <td style={{ padding: '10px 14px', fontWeight: 500 }}>
                          <span style={{
                            display: 'inline-block',
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            background: cookie.color,
                            marginRight: 8,
                            verticalAlign: 'middle',
                          }} />
                          {cookie.name}
                        </td>
                        <td style={{ textAlign: 'center', padding: '10px 8px', fontWeight: 600 }}>
                          {pc.sold}
                        </td>
                        <td style={{ textAlign: 'right', padding: '10px 14px', fontWeight: 700 }}>
                          {formatCurrency(pc.sold * PRICE_PER_BOX)}
                        </td>
                      </tr>
                    ),
                    pc.donated > 0 && (
                      <tr key={`${cookie.id}-donated`} style={{ borderBottom: '1px solid var(--border-light)' }}>
                        <td style={{ padding: '10px 14px', fontWeight: 500, color: 'var(--success)' }}>
                          <span style={{
                            display: 'inline-block',
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            background: cookie.color,
                            marginRight: 8,
                            verticalAlign: 'middle',
                          }} />
                          {cookie.name} <span style={{ fontSize: '0.7rem', opacity: 0.8 }}>(donated)</span>
                        </td>
                        <td style={{ textAlign: 'center', padding: '10px 8px', fontWeight: 600, color: 'var(--success)' }}>
                          {pc.donated}
                        </td>
                        <td style={{ textAlign: 'right', padding: '10px 14px', fontWeight: 700, color: 'var(--success)' }}>
                          {formatCurrency(pc.donated * PRICE_PER_BOX)}
                        </td>
                      </tr>
                    ),
                  ];
                })}
                {stats?.totalCashDonations > 0 && (
                  <tr style={{ borderBottom: '1px solid var(--border-light)' }}>
                    <td style={{ padding: '10px 14px', fontWeight: 500, color: 'var(--success)' }}>
                      Cash Donations
                    </td>
                    <td style={{ textAlign: 'center', padding: '10px 8px' }}>&mdash;</td>
                    <td style={{ textAlign: 'right', padding: '10px 14px', fontWeight: 700, color: 'var(--success)' }}>
                      {formatCurrency(stats.totalCashDonations)}
                    </td>
                  </tr>
                )}
                <tr style={{ background: 'var(--bg)' }}>
                  <td style={{ padding: '12px 14px', fontWeight: 700 }}>Total</td>
                  <td style={{ textAlign: 'center', padding: '12px 8px', fontWeight: 700 }}>
                    {(stats?.totalBoxesSold || 0) + (stats?.totalBoxesDonated || 0)}
                  </td>
                  <td style={{ textAlign: 'right', padding: '12px 14px', fontWeight: 700, fontSize: '0.95rem' }}>
                    {formatCurrency(stats?.totalRevenue || 0)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <Navbar />
    </div>
  );
}
