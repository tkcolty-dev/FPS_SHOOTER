import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useBooth } from '../context/BoothContext';
import { COOKIE_TYPES, PRICE_PER_BOX } from '../data/cookies';
import { generateId, formatCurrency } from '../utils/helpers';
import Navbar from '../components/Navbar';

export default function LogOrder() {
  const { boothId, orderId } = useParams();
  const navigate = useNavigate();
  const { getBooth, getBoothStats, getOrders, addOrder, updateOrder } = useBooth();
  const booth = getBooth(boothId);
  const stats = getBoothStats(boothId);
  const isEditing = !!orderId;

  // Find the existing order when editing
  const existingOrder = useMemo(() => {
    if (!orderId) return null;
    const orders = getOrders(boothId);
    return orders.find(o => o.id === orderId) || null;
  }, [orderId, boothId, getOrders]);

  const [saleQty, setSaleQty] = useState({});
  const [showDonations, setShowDonations] = useState(false);
  const [donationQty, setDonationQty] = useState({});
  const [cashDonation, setCashDonation] = useState('');
  const [initialized, setInitialized] = useState(false);

  // Load existing order data when editing
  useEffect(() => {
    if (isEditing && existingOrder && !initialized) {
      const sales = {};
      const donations = {};
      let hasDonationItems = false;

      (existingOrder.items || []).forEach(item => {
        if (item.isDonation) {
          donations[item.cookieType] = item.quantity;
          hasDonationItems = true;
        } else {
          sales[item.cookieType] = item.quantity;
        }
      });

      setSaleQty(sales);
      setDonationQty(donations);
      setShowDonations(hasDonationItems);
      setCashDonation(existingOrder.cashDonation ? String(existingOrder.cashDonation) : '');
      setInitialized(true);
    }
  }, [isEditing, existingOrder, initialized]);

  if (!booth) return null;

  // When editing, add back the original order's quantities to "remaining" so
  // the user can freely adjust without being blocked by their own previous values.
  function getAdjustedRemaining(cookieId) {
    const base = stats?.perCookie[cookieId]?.remaining || 0;
    if (!isEditing || !existingOrder) return base;
    let orderUsed = 0;
    (existingOrder.items || []).forEach(item => {
      if (item.cookieType === cookieId) orderUsed += item.quantity;
    });
    return base + orderUsed;
  }

  function updateSale(cookieId, delta) {
    setSaleQty(prev => {
      const current = prev[cookieId] || 0;
      const remaining = getAdjustedRemaining(cookieId);
      const donating = donationQty[cookieId] || 0;
      const maxAdd = remaining - donating;
      const next = Math.max(0, Math.min(current + delta, maxAdd));
      return { ...prev, [cookieId]: next };
    });
  }

  function updateDonation(cookieId, delta) {
    setDonationQty(prev => {
      const current = prev[cookieId] || 0;
      const remaining = getAdjustedRemaining(cookieId);
      const selling = saleQty[cookieId] || 0;
      const maxAdd = remaining - selling;
      const next = Math.max(0, Math.min(current + delta, maxAdd));
      return { ...prev, [cookieId]: next };
    });
  }

  const totalSaleBoxes = Object.values(saleQty).reduce((s, n) => s + n, 0);
  const totalDonationBoxes = Object.values(donationQty).reduce((s, n) => s + n, 0);
  const cashDonationAmt = parseFloat(cashDonation) || 0;
  const orderTotal = (totalSaleBoxes + totalDonationBoxes) * PRICE_PER_BOX + cashDonationAmt;
  const hasItems = totalSaleBoxes > 0 || totalDonationBoxes > 0 || cashDonationAmt > 0;

  function handleSubmit() {
    if (!hasItems) return;

    const items = [];
    COOKIE_TYPES.forEach(c => {
      const sq = saleQty[c.id] || 0;
      if (sq > 0) items.push({ cookieType: c.id, quantity: sq, isDonation: false });
      const dq = donationQty[c.id] || 0;
      if (dq > 0) items.push({ cookieType: c.id, quantity: dq, isDonation: true });
    });

    if (isEditing) {
      updateOrder(boothId, orderId, {
        items,
        cashDonation: cashDonationAmt,
        total: orderTotal,
      });
    } else {
      const order = {
        id: generateId(),
        items,
        cashDonation: cashDonationAmt,
        total: orderTotal,
        createdAt: Date.now(),
      };
      addOrder(boothId, order);
    }

    // Reset form
    setSaleQty({});
    setDonationQty({});
    setCashDonation('');
    setShowDonations(false);

    navigate(isEditing ? `/booth/${boothId}/orders` : `/booth/${boothId}`);
  }

  return (
    <div className="app-main">
      <div className="container page-with-summary animate-in">
        <div className="page-header">
          <h1>{isEditing ? 'Edit Sale' : 'Log Sale'}</h1>
          <p>{isEditing ? 'Update this order' : 'Select cookies for this order'}</p>
        </div>

        {/* Sale cookie grid */}
        <div className="dash-section-title">Cookies</div>
        <div className="cookie-selector-grid">
          {COOKIE_TYPES.map(cookie => {
            const remaining = getAdjustedRemaining(cookie.id);
            const qty = saleQty[cookie.id] || 0;
            const donating = donationQty[cookie.id] || 0;
            const available = remaining - donating;
            const isActive = qty > 0;

            return (
              <div
                key={cookie.id}
                className={`cookie-select-card${isActive ? ' active' : ''}`}
                style={isActive ? { borderColor: cookie.color, background: cookie.bg } : {}}
              >
                <div className="cookie-select-name">
                  <span className="cookie-select-dot" style={{ background: cookie.color }} />
                  {cookie.name}
                </div>
                <div className="cookie-select-stock">
                  {remaining} in stock
                </div>
                <div className="qty-control">
                  <button
                    className="qty-btn minus"
                    onClick={() => updateSale(cookie.id, -1)}
                    disabled={qty === 0}
                  >
                    &minus;
                  </button>
                  <span className="qty-value">{qty}</span>
                  <button
                    className="qty-btn plus"
                    onClick={() => updateSale(cookie.id, 1)}
                    disabled={qty >= available}
                  >
                    +
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Donation section */}
        <div className="donation-section">
          <div
            className={`donation-toggle${showDonations ? ' active' : ''}`}
            onClick={() => setShowDonations(!showDonations)}
          >
            <div className={`toggle-switch${showDonations ? ' on' : ''}`} />
            <div>
              <div className="donation-toggle-text">Include Donations</div>
              <div className="donation-toggle-sub">Cookie boxes purchased for donation</div>
            </div>
          </div>

          {showDonations && (
            <>
              <div className="cookie-selector-grid" style={{ marginBottom: 12 }}>
                {COOKIE_TYPES.map(cookie => {
                  const remaining = getAdjustedRemaining(cookie.id);
                  const selling = saleQty[cookie.id] || 0;
                  const available = remaining - selling;
                  const qty = donationQty[cookie.id] || 0;
                  const isActive = qty > 0;

                  return (
                    <div
                      key={cookie.id}
                      className={`cookie-select-card${isActive ? ' active' : ''}`}
                      style={isActive ? {
                        borderColor: 'var(--success)',
                        background: 'var(--success-light)',
                      } : {}}
                    >
                      <div className="cookie-select-name">
                        <span className="cookie-select-dot" style={{ background: cookie.color }} />
                        {cookie.name}
                      </div>
                      <div className="cookie-select-stock" style={isActive ? { color: 'var(--success)' } : {}}>
                        {isActive ? 'Donation' : `${available} avail`}
                      </div>
                      <div className="qty-control">
                        <button
                          className="qty-btn minus"
                          onClick={() => updateDonation(cookie.id, -1)}
                          disabled={qty === 0}
                        >
                          &minus;
                        </button>
                        <span className="qty-value">{qty}</span>
                        <button
                          className="qty-btn plus"
                          onClick={() => updateDonation(cookie.id, 1)}
                          disabled={qty >= available}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          <div className="cash-donation-row">
            <div>
              <div className="cash-donation-label">Cash Donation</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                Extra cash tip / donation
              </div>
            </div>
            <input
              type="number"
              className="cash-donation-input"
              placeholder="$0.00"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={cashDonation}
              onChange={e => setCashDonation(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Sticky order summary bar */}
      <div className="order-summary-bar">
        <div className="order-summary-inner">
          <div className="order-summary-info">
            <div className="order-summary-total">{formatCurrency(orderTotal)}</div>
            <div className="order-summary-detail">
              {totalSaleBoxes + totalDonationBoxes} box{totalSaleBoxes + totalDonationBoxes !== 1 ? 'es' : ''}
              {totalDonationBoxes > 0 && ` (${totalDonationBoxes} donated)`}
              {cashDonationAmt > 0 && ` + ${formatCurrency(cashDonationAmt)} tip`}
            </div>
          </div>
          <button
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={!hasItems}
          >
            {isEditing ? 'Save' : 'Submit'}
          </button>
        </div>
      </div>

      <Navbar />
    </div>
  );
}
