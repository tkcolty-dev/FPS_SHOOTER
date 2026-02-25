import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useBooth } from '../context/BoothContext';
import { getCookieById, PRICE_PER_BOX } from '../data/cookies';
import { formatCurrency, formatDateTime } from '../utils/helpers';
import Navbar from '../components/Navbar';

export default function OrderHistory() {
  const { boothId } = useParams();
  const navigate = useNavigate();
  const { getOrders, deleteOrder } = useBooth();
  const orders = getOrders(boothId);
  const [expandedId, setExpandedId] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  function handleDelete(orderId) {
    deleteOrder(boothId, orderId);
    setConfirmDelete(null);
  }

  return (
    <div className="app-main">
      <div className="container animate-in">
        <div className="page-header">
          <div className="page-header-row">
            <div>
              <h1>Orders</h1>
              <p>{orders.length} total order{orders.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
        </div>

        {orders.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">&#128203;</div>
            <h3>No orders yet</h3>
            <p>Orders will appear here after you log your first sale</p>
          </div>
        ) : (
          <div className="order-list">
            {orders.map((order, index) => {
              const orderNum = orders.length - index;
              const saleItems = (order.items || []).filter(i => !i.isDonation);
              const donationItems = (order.items || []).filter(i => i.isDonation);
              const isExpanded = expandedId === order.id;
              const hasDonations = donationItems.length > 0 || (order.cashDonation || 0) > 0;

              return (
                <div
                  key={order.id}
                  className="order-card"
                  onClick={() => setExpandedId(isExpanded ? null : order.id)}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="order-card-header">
                    <span className="order-number">Order #{orderNum}</span>
                    <span className="order-time">{formatDateTime(order.createdAt)}</span>
                  </div>

                  <div className="order-items">
                    {saleItems.map((item, i) => {
                      const cookie = getCookieById(item.cookieType);
                      if (!cookie) return null;
                      return (
                        <span
                          key={i}
                          className="order-item-chip"
                          style={{ background: cookie.bg, color: cookie.color }}
                        >
                          {item.quantity}x {cookie.shortName}
                        </span>
                      );
                    })}
                    {donationItems.map((item, i) => {
                      const cookie = getCookieById(item.cookieType);
                      if (!cookie) return null;
                      return (
                        <span
                          key={`d${i}`}
                          className="order-item-chip donation"
                          style={{ borderColor: 'var(--success)', color: 'var(--success)' }}
                        >
                          {item.quantity}x {cookie.shortName} &#9829;
                        </span>
                      );
                    })}
                  </div>

                  <div className="order-footer">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="order-total">{formatCurrency(order.total)}</span>
                      {hasDonations && (
                        <span className="order-donation-badge">Donation</span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <button
                        className="order-delete-btn"
                        style={{ color: 'var(--primary)' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/booth/${boothId}/order/${order.id}`);
                        }}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>
                      <button
                        className="order-delete-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmDelete(order.id);
                        }}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="order-expanded">
                      {saleItems.map((item, i) => {
                        const cookie = getCookieById(item.cookieType);
                        return (
                          <div key={i} className="order-detail-row">
                            <span className="label">
                              <span style={{
                                display: 'inline-block',
                                width: 6,
                                height: 6,
                                borderRadius: '50%',
                                background: cookie?.color,
                                marginRight: 6,
                              }} />
                              {cookie?.name} x{item.quantity}
                            </span>
                            <span className="value">{formatCurrency(item.quantity * PRICE_PER_BOX)}</span>
                          </div>
                        );
                      })}
                      {donationItems.map((item, i) => {
                        const cookie = getCookieById(item.cookieType);
                        return (
                          <div key={`d${i}`} className="order-detail-row">
                            <span className="label" style={{ color: 'var(--success)' }}>
                              {cookie?.name} x{item.quantity} (donated)
                            </span>
                            <span className="value" style={{ color: 'var(--success)' }}>
                              {formatCurrency(item.quantity * PRICE_PER_BOX)}
                            </span>
                          </div>
                        );
                      })}
                      {(order.cashDonation || 0) > 0 && (
                        <div className="order-detail-row">
                          <span className="label" style={{ color: 'var(--success)' }}>Cash donation</span>
                          <span className="value" style={{ color: 'var(--success)' }}>
                            {formatCurrency(order.cashDonation)}
                          </span>
                        </div>
                      )}
                      <div className="order-detail-row" style={{
                        marginTop: 6,
                        paddingTop: 6,
                        borderTop: '1px solid var(--border-light)',
                        fontWeight: 700,
                        fontSize: '0.85rem',
                      }}>
                        <span>Total</span>
                        <span>{formatCurrency(order.total)}</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Delete confirmation modal */}
      {confirmDelete && (
        <div className="modal-overlay" onClick={() => setConfirmDelete(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3>Delete Order?</h3>
            <p>This will undo the sale and restore inventory. This can't be reversed.</p>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setConfirmDelete(null)}>
                Cancel
              </button>
              <button className="btn btn-danger" onClick={() => handleDelete(confirmDelete)}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      <Navbar />
    </div>
  );
}
