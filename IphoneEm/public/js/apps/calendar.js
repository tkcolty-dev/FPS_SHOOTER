/* Calendar — continuous month scroll, year view, day timeline, event editor, alerts. */
(function () {
  'use strict';

  /* ───────────────────────── helpers ───────────────────────── */
  const DAY = 86400000, MIN = 60000;
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const MON = MONTHS.map((m) => m.slice(0, 3));
  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const DAY3 = DAYS.map((d) => d.slice(0, 3));
  const CURVE = 'cubic-bezier(.32,.72,0,1)';

  const esc = (s) => OS.util.esc(s == null ? '' : String(s));
  const uid = () => (OS.util.uid ? OS.util.uid() : 'e' + Math.random().toString(36).slice(2));
  const h = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
  const sod = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const dkey = (d) => d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
  const keyDate = (k) => new Date(Math.floor(k / 10000), Math.floor(k / 100) % 100 - 1, k % 100);
  const sameDay = (a, b) => dkey(new Date(a)) === dkey(new Date(b));
  const pad2 = (n) => String(n).padStart(2, '0');
  const use24 = () => { try { return !!OS.settings.get('use24h'); } catch (e) { return false; } };

  function fmtTime(ms) {
    const d = new Date(ms); let hr = d.getHours(); const mm = pad2(d.getMinutes());
    if (use24()) return pad2(hr) + ':' + mm;
    const ap = hr < 12 ? 'AM' : 'PM'; hr = hr % 12 || 12;
    return hr + ':' + mm + ' ' + ap;
  }
  const fmtLong = (d) => { d = new Date(d); return DAYS[d.getDay()] + ', ' + MON[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear(); };
  const fmtMed = (d) => { d = new Date(d); return MON[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear(); };
  const fmtShort = (d) => { d = new Date(d); return DAY3[d.getDay()] + ', ' + MON[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear(); };
  function fmtRelDay(ms) {
    const t = sod(new Date()).getTime(), d = sod(ms).getTime(), diff = Math.round((d - t) / DAY);
    if (diff === 0) return 'Today'; if (diff === 1) return 'Tomorrow'; if (diff === -1) return 'Yesterday';
    const x = new Date(ms); return DAY3[x.getDay()] + ', ' + MON[x.getMonth()] + ' ' + x.getDate();
  }

  const REPEATS = [['none', 'Never'], ['daily', 'Every Day'], ['weekly', 'Every Week'], ['biweekly', 'Every 2 Weeks'], ['monthly', 'Every Month'], ['yearly', 'Every Year']];
  const REPEAT_TEXT = { daily: 'Repeats every day', weekly: 'Repeats every week', biweekly: 'Repeats every 2 weeks', monthly: 'Repeats every month', yearly: 'Repeats every year' };
  const ALERTS_TIMED = [[null, 'None'], [0, 'At time of event'], [5, '5 minutes before'], [10, '10 minutes before'], [15, '15 minutes before'], [30, '30 minutes before'], [60, '1 hour before'], [120, '2 hours before'], [1440, '1 day before'], [2880, '2 days before'], [10080, '1 week before']];
  const ALERTS_ALLDAY = [[null, 'None'], [-540, 'On day of event (9 AM)'], [900, '1 day before (9 AM)'], [2340, '2 days before (9 AM)'], [9540, '1 week before (9 AM)']];
  const alertLabel = (ev) => { const l = (ev.allDay ? ALERTS_ALLDAY : ALERTS_TIMED).find((a) => a[0] === ev.alert); return l ? l[1] : 'None'; };
  const repeatLabel = (r) => (REPEATS.find((x) => x[0] === (r || 'none')) || REPEATS[0])[1];
  const PALETTE = ['#FF3B30', '#FF9500', '#FFCC00', '#34C759', '#007AFF', '#5856D6', '#AF52DE', '#FF2D55', '#A2845E'];

  const IC = {
    back: '<svg viewBox="0 0 12 21" width="12" height="21"><path d="M10.2 1.8 2 10.5l8.2 8.7" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    plus: '<svg viewBox="0 0 22 22" width="22" height="22"><path d="M11 3v16M3 11h16" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
    search: '<svg viewBox="0 0 22 22" width="22" height="22"><circle cx="9.5" cy="9.5" r="6.3" fill="none" stroke="currentColor" stroke-width="2.1"/><path d="m14.3 14.3 5 5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
    updown: '<svg viewBox="0 0 10 16" width="9" height="14"><path d="M2 6l3-3.2L8 6M2 10l3 3.2L8 10" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    check: '<svg viewBox="0 0 16 16" width="16" height="16"><path d="M3 8.6l3.2 3.3L13 4.6" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    chevR: '<svg viewBox="0 0 8 14" width="8" height="14"><path d="M1.5 1.5 7 7l-5.5 5.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    chevL: '<svg viewBox="0 0 8 14" width="8" height="14"><path d="M6.5 1.5 1 7l5.5 5.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    tray: '<svg viewBox="0 0 56 56" width="56" height="56"><path d="M8 32 15 12h26l7 20v10a4 4 0 0 1-4 4H12a4 4 0 0 1-4-4V32Zm0 0h12a8 8 0 0 0 16 0h12" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/></svg>',
  };

  /* ───────────────────────── data ───────────────────────── */
  let calendars = OS.store.get('calendar.calendars', null);
  let events = OS.store.get('calendar.events', null);
  let hidden = OS.store.get('calendar.hidden', []);
  if (!Array.isArray(calendars) || !calendars.length || !Array.isArray(events)) seed();

  const saveEvents = () => OS.store.set('calendar.events', events);
  const saveCalendars = () => OS.store.set('calendar.calendars', calendars);
  const calOf = (ev) => calendars.find((c) => c.id === ev.calId) || calendars[0] || { id: 'x', name: 'Calendar', color: '#007AFF' };
  const byId = (id) => events.find((e) => e.id === id);
  const isRepeating = (ev) => !!ev.repeat && ev.repeat !== 'none';
  const visibleEvents = () => events.filter((e) => hidden.indexOf(e.calId) < 0);

  function seed() {
    calendars = [
      { id: 'home', name: 'Home', color: '#007AFF' },
      { id: 'school', name: 'School', color: '#FF9500' },
      { id: 'sports', name: 'Sports', color: '#34C759' },
      { id: 'family', name: 'Family', color: '#AF52DE' },
      { id: 'gamedev', name: 'Game Dev', color: '#5856D6' },
      { id: 'birthdays', name: 'Birthdays', color: '#FF2D55' },
      { id: 'holidays', name: 'US Holidays', color: '#A2845E' },
    ];
    const today = sod(new Date()), tdow = today.getDay(), Y = today.getFullYear();
    const at = (off, hr, mi) => { const d = addDays(today, off); d.setHours(hr || 0, mi || 0, 0, 0); return d.getTime(); };
    const past = (dow, weeks) => (dow - tdow) - 7 * weeks;                 // offset of that weekday N weeks back
    const next = (dow, min) => { let o = (dow - tdow + 7) % 7; while (o < (min || 0)) o += 7; return o; };
    const weekday = (off) => { let o = off; while ([0, 6].indexOf(addDays(today, o).getDay()) >= 0) o++; return o; };
    const E = (title, calId, start, end, x) => Object.assign({ id: uid(), title, calId, start, end, allDay: false, location: '', repeat: 'none', alert: null, notes: '' }, x || {});
    const A = (title, calId, off, len, x) => E(title, calId, at(off), at(off + (len || 1) - 1), Object.assign({ allDay: true }, x || {}));
    const yearly = (title, calId, mo, d, x) => { const s = new Date(Y - 3, mo, d).getTime(); return E(title, calId, s, s, Object.assign({ allDay: true, repeat: 'yearly' }, x || {})); };
    const thanks = (yr) => { const d = new Date(yr, 10, 1); const first = (4 - d.getDay() + 7) % 7 + 1; return new Date(yr, 10, first + 21).getTime(); };
    const jam = next(5, 10), sat = next(6, 1), mathD = weekday(2), dent = weekday(5), lastSat = past(6, tdow === 6 ? 1 : 0) - (tdow === 6 ? 0 : 7) + (tdow === 6 ? 0 : 7);
    const sleep = tdow === 6 ? -7 : past(6, 0) <= 0 ? past(6, 0) : past(6, 1);
    void lastSat;
    const bday = (title, off) => { const d = addDays(today, off); return yearly(title, 'birthdays', d.getMonth(), d.getDate(), { alert: 900 }); };

    events = [
      E('Soccer Practice', 'sports', at(past(2, 6), 16, 0), at(past(2, 6), 17, 30), { repeat: 'weekly', location: 'Riverside Park, Field 2', alert: 30, notes: 'Bring shin guards + water bottle.' }),
      E('Soccer Practice', 'sports', at(past(4, 6), 16, 0), at(past(4, 6), 17, 30), { repeat: 'weekly', location: 'Riverside Park, Field 2', alert: 30 }),
      E('Piano Lesson', 'home', at(past(3, 8), 17, 0), at(past(3, 8), 17, 45), { repeat: 'weekly', location: 'Ms. Alvarez’s Studio', alert: 60 }),
      E('Coding Club', 'school', at(past(1, 4), 15, 15), at(past(1, 4), 16, 30), { repeat: 'biweekly', location: 'Room 114', alert: 15, notes: 'Show the Scratch platformer demo.' }),
      E('Family Dinner', 'family', at(past(0, 5), 18, 0), at(past(0, 5), 19, 30), { repeat: 'weekly', location: 'Grandma’s House' }),
      E('Game vs. Tigers', 'sports', at(sat, 10, 0), at(sat, 11, 30), { location: 'Lincoln Middle School', alert: 60, notes: 'Arrive 30 min early for warm-ups. Blue jerseys.' }),
      E('Math Test — Ch. 3', 'school', at(mathD, 9, 15), at(mathD, 10, 5), { location: 'Room 208', alert: 1440, notes: 'Ratios, proportions, percent problems. Calculator allowed.' }),
      A('Science Fair Project Due', 'school', weekday(9), 1, { alert: 900 }),
      A('Fall Game Jam', 'gamedev', jam, 3, { location: 'itch.io', alert: -540, notes: 'Theme drops Friday at 6 PM. 48 hours. Stock up on snacks.' }),
      E('Game Jam Theme Reveal', 'gamedev', at(jam, 18, 0), at(jam, 18, 30), { alert: 10 }),
      E('Work on Game', 'gamedev', at(0, 19, 0), at(0, 20, 30), { alert: 15, notes: 'Fix the controller bugs and playtest level 3.' }),
      E('Dentist', 'home', at(dent, 15, 30), at(dent, 16, 15), { location: 'Bright Smiles Dental', alert: 120 }),
      E('Movie Night', 'family', at(next(5, 0), 19, 30), at(next(5, 0), 22, 0), { location: 'Living Room' }),
      A('Picture Day', 'school', weekday(12), 1, { alert: 900 }),
      A('No School — Teacher Workday', 'school', next(1, 18), 1),
      A('Library Books Due', 'home', 6, 1, { alert: -540 }),
      A('History Essay Due', 'school', -3, 1),
      E('Sleepover at Max’s', 'home', at(sleep, 17, 0), at(sleep + 1, 10, 0), { location: 'Max’s House' }),
      E('Haircut', 'home', at(-6, 16, 30), at(-6, 17, 0), { location: 'Main St. Barbers' }),
      E('Study Group', 'school', at(weekday(1), 15, 30), at(weekday(1), 16, 30), { location: 'Library', alert: 15 }),
      bday('Mom’s Birthday', 17), bday('Grandpa’s Birthday', 44), bday('Max’s Birthday', -20), bday('Aunt Rachel’s Birthday', 96),
      yearly('New Year’s Day', 'holidays', 0, 1), yearly('Valentine’s Day', 'holidays', 1, 14), yearly('Independence Day', 'holidays', 6, 4),
      yearly('Halloween', 'holidays', 9, 31), yearly('Veterans Day', 'holidays', 10, 11), yearly('Christmas Day', 'holidays', 11, 25),
      E('Thanksgiving', 'holidays', thanks(Y), thanks(Y), { allDay: true }), E('Thanksgiving', 'holidays', thanks(Y + 1), thanks(Y + 1), { allDay: true }),
    ];
    OS.store.set('calendar.calendars', calendars);
    OS.store.set('calendar.events', events);
  }

  /* ───────────────────────── recurrence ───────────────────────── */
  function occStartDate(ev, k) {
    const s = new Date(ev.start), y = s.getFullYear(), mo = s.getMonth(), d = s.getDate(), hr = s.getHours(), mi = s.getMinutes();
    switch (ev.repeat) {
      case 'daily': return new Date(y, mo, d + k, hr, mi);
      case 'weekly': return new Date(y, mo, d + 7 * k, hr, mi);
      case 'biweekly': return new Date(y, mo, d + 14 * k, hr, mi);
      case 'monthly': { const x = new Date(y, mo + k, d, hr, mi); return x.getDate() === d ? x : null; }
      case 'yearly': { const x = new Date(y + k, mo, d, hr, mi); return x.getMonth() === mo ? x : null; }
      default: return k === 0 ? s : null;
    }
  }
  function occEnd(ev, startMs) {
    if (ev.allDay) { const n = Math.max(0, Math.round((ev.end - ev.start) / DAY)); const s = new Date(startMs); return new Date(s.getFullYear(), s.getMonth(), s.getDate() + n + 1).getTime(); }
    return startMs + Math.max(0, ev.end - ev.start);
  }
  const mkOcc = (ev, startMs) => ({ ev, start: startMs, end: occEnd(ev, startMs) });
  function occurrences(ev, from, to) {               // every occurrence overlapping [from, to)
    const out = [];
    if (!isRepeating(ev)) { const o = mkOcc(ev, ev.start); if (o.start < to && (o.end > from || o.start >= from)) out.push(o); return out; }
    const span = occEnd(ev, ev.start) - ev.start + DAY;
    const unit = { daily: DAY, weekly: 7 * DAY, biweekly: 14 * DAY, monthly: 31 * DAY, yearly: 366 * DAY }[ev.repeat] || DAY;
    let k = Math.max(0, Math.floor((from - ev.start - span) / unit) - 1), guard = 0;
    while (guard++ < 6000) {
      const d = occStartDate(ev, k++);
      if (!d) continue;
      const t = d.getTime();
      if (t >= to) break;
      if (ev.until && t > ev.until) break;
      const o = mkOcc(ev, t);
      if ((o.end > from || t >= from) && !(ev.exdates && ev.exdates.indexOf(t) >= 0)) out.push(o);
    }
    return out;
  }
  function occsInRange(from, to) {
    let out = [];
    visibleEvents().forEach((ev) => { out = out.concat(occurrences(ev, from, to)); });
    out.sort((a, b) => (b.ev.allDay ? 1 : 0) - (a.ev.allDay ? 1 : 0) || a.start - b.start || a.end - b.end);
    return out;
  }
  function relocate(occ) {
    const ev = byId(occ.ev.id); if (!ev) return null;
    if (!isRepeating(ev)) return mkOcc(ev, ev.start);
    const ds = sod(occ.start).getTime();
    const same = occurrences(ev, ds, ds + DAY).filter((o) => o.start >= ds)[0];
    if (same) return same;
    return occurrences(ev, Date.now(), Date.now() + 400 * DAY)[0] || mkOcc(ev, ev.start);
  }

  /* ───────────────────────── alerts (module-level, survives background / lock) ───────────────────────── */
  function alertBody(o) {
    const ev = o.ev; let s;
    if (ev.allDay) s = fmtRelDay(o.start) + ', all-day';
    else s = fmtRelDay(o.start) + ' at ' + fmtTime(o.start);
    if (ev.location) s += ' · ' + ev.location;
    return s;
  }
  function checkAlerts() {
    try {
      const now = Date.now();
      const last = OS.store.get('calendar.lastCheck', 0) || 0;
      const from = Math.max(last, now - 10 * MIN);
      const fired = OS.store.get('calendar.fired', {}) || {};
      let dirty = false;
      visibleEvents().forEach((ev) => {
        if (ev.alert == null) return;
        const a = ev.alert * MIN;
        occurrences(ev, from + a, now + a + 1).forEach((o) => {
          const when = o.start - a;
          if (when <= from || when > now) return;
          const key = ev.id + '@' + o.start;
          if (fired[key]) return;
          fired[key] = now; dirty = true;
          OS.notify({
            appId: 'calendar', title: ev.title || 'New Event', body: alertBody(o), sound: true,
            onTap() { OS.openApp('calendar', { eventId: ev.id, occ: o.start }); },
          });
        });
      });
      Object.keys(fired).forEach((k) => { if (now - fired[k] > 3 * DAY) { delete fired[k]; dirty = true; } });
      if (dirty) OS.store.set('calendar.fired', fired);
      OS.store.set('calendar.lastCheck', now);
    } catch (e) { console.error('[calendar] alert check failed', e); }
  }
  OS.on('minute', checkAlerts);
  setInterval(checkAlerts, 25000);
  setTimeout(checkAlerts, 1500);

  /* ───────────────────────── icon ───────────────────────── */
  function iconGlyph(d) {
    return '<svg viewBox="0 0 60 60"><text x="30" y="17.5" text-anchor="middle" font-family="system-ui,-apple-system,\'SF Pro Text\',\'Helvetica Neue\',Arial,sans-serif" font-size="10.5" font-weight="600" letter-spacing=".3" fill="#FF3B30">' +
      DAY3[d.getDay()].toUpperCase() + '</text><text x="30" y="49" text-anchor="middle" font-family="system-ui,-apple-system,\'SF Pro Display\',\'Helvetica Neue\',Arial,sans-serif" font-size="35" font-weight="300" letter-spacing="-1" fill="#000">' +
      d.getDate() + '</text></svg>';
  }

  /* ───────────────────────── styles ───────────────────────── */
  const TITLE_H = 42, ROW_H = 58, MONTH_GAP = 12;
  OS.addStyle('calendar', `
  .app-calendar{--tint:var(--red);background:var(--bg);color:var(--label);font-size:17px;letter-spacing:-.4px}
  .calendar-tint{--tint:var(--red)}
  .app-calendar button{font:inherit;letter-spacing:inherit;color:inherit;background:none;border:0;padding:0;margin:0;cursor:pointer;-webkit-tap-highlight-color:transparent}
  .app-calendar .cal-base{position:absolute;left:0;top:0;right:0;bottom:0;display:flex;flex-direction:column;transition:transform .42s ${CURVE}}
  .app-calendar .cal-base.under,.app-calendar .cal-page.under{transform:translateX(-30%)}
  .app-calendar .cal-head{flex:none;padding-top:var(--safe-top);background:var(--bar);border-bottom:.5px solid var(--sep);position:relative;z-index:2}
  .app-calendar .cal-head-row{height:44px;display:flex;align-items:center;padding:0 8px 0 8px}
  .app-calendar .cal-back{display:flex;align-items:center;gap:6px;color:var(--red);font-size:17px;height:44px;padding:0 8px 0 2px;transition:opacity .3s}
  .app-calendar .cal-back:active,.app-calendar .cal-ic:active,.app-calendar .cal-tool button:active{opacity:.4}
  .app-calendar .cal-head-title{position:absolute;left:100px;right:100px;text-align:center;font-weight:600;pointer-events:none;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .app-calendar .cal-sp{flex:1}
  .app-calendar .cal-ic{width:40px;height:44px;display:flex;align-items:center;justify-content:center;color:var(--red)}
  .app-calendar .cal-txtbtn{color:var(--red);font-size:17px;padding:0 8px;height:44px}
  .app-calendar .cal-wd{display:flex;height:20px;overflow:hidden;transition:height .35s ${CURVE},opacity .3s}
  .app-calendar .cal-wd span{width:calc(100%/7);text-align:center;font-size:10px;font-weight:600;letter-spacing:0;color:var(--label)}
  .app-calendar .cal-wd span.we{color:var(--label2)}
  .app-calendar[data-mode="year"] .cal-base>.cal-head .cal-wd{height:0;opacity:0}
  .app-calendar[data-mode="year"] .cal-base>.cal-head .cal-back{opacity:0;pointer-events:none}
  .app-calendar .cal-layers{flex:1;position:relative;overflow:hidden;min-height:0}
  .app-calendar .cal-layer{position:absolute;left:0;top:0;right:0;bottom:0;overflow-y:auto;transition:opacity .38s ease,transform .45s ${CURVE}}
  .app-calendar[data-mode="year"] .cal-month{opacity:0;transform:scale(.72);pointer-events:none}
  .app-calendar[data-mode="month"] .cal-year{opacity:0;transform:scale(1.6);pointer-events:none}
  .app-calendar .cal-tool{flex:none;height:49px;padding-bottom:var(--safe-bottom);display:flex;align-items:center;justify-content:space-between;
    padding-left:16px;padding-right:16px;background:var(--bar);border-top:.5px solid var(--sep)}
  .app-calendar .cal-tool button{color:var(--red);font-size:17px;height:44px;min-width:64px}
  .app-calendar .cal-tool button:first-child{text-align:left}.app-calendar .cal-tool button:last-child{text-align:right}

  /* month scroll */
  .app-calendar .cal-m{padding-bottom:${MONTH_GAP}px}
  .app-calendar .cal-m-title{height:${TITLE_H}px;box-sizing:border-box;display:flex;align-items:flex-end;padding-bottom:7px}
  .app-calendar .cal-m-title span{width:calc(100%/7);text-align:center;font-size:20px;font-weight:600;letter-spacing:-.2px}
  .app-calendar .cal-m.cur .cal-m-title span{color:var(--red)}
  .app-calendar .cal-w{display:flex;height:${ROW_H}px}
  .app-calendar .cal-c{width:calc(100%/7);box-sizing:border-box;border-top:.5px solid var(--sep);display:flex;flex-direction:column;align-items:center;padding-top:5px;cursor:pointer}
  .app-calendar .cal-c.e{border-top-color:transparent;cursor:default}
  .app-calendar .cal-c b{font-weight:400;font-size:19px;letter-spacing:0;width:34px;height:34px;line-height:34px;border-radius:50%;text-align:center;transition:background .15s}
  .app-calendar .cal-c.we b{color:var(--label2)}
  .app-calendar .cal-c:not(.today):active b{background:var(--fill)}
  .app-calendar .cal-c.today b{background:var(--red);color:#fff;font-weight:600}
  .app-calendar .cal-c i{width:6px;height:6px;border-radius:50%;background:var(--label3);margin-top:3px;visibility:hidden}
  .app-calendar .cal-c.has i{visibility:visible}

  /* year view */
  .app-calendar .cal-y{padding:0 16px 14px}
  .app-calendar .cal-y-title{font-size:32px;font-weight:700;letter-spacing:.2px;padding:12px 0 5px;border-bottom:.5px solid var(--sep);margin-bottom:10px}
  .app-calendar .cal-y.cur .cal-y-title{color:var(--red)}
  .app-calendar .cal-y-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px 16px}
  .app-calendar .cal-mm{cursor:pointer;border-radius:8px}
  .app-calendar .cal-mm:active{opacity:.5}
  .app-calendar .cal-mm-name{font-size:19px;font-weight:600;margin-bottom:2px}
  .app-calendar .cal-mm.cur .cal-mm-name{color:var(--red)}
  .app-calendar .cal-mm-days{display:grid;grid-template-columns:repeat(7,1fr)}
  .app-calendar .cal-mm-days span{font-size:9.5px;line-height:16px;height:16px;text-align:center;font-weight:500;letter-spacing:0}
  .app-calendar .cal-mm-days span.t{background:var(--red);color:#fff;border-radius:50%;font-weight:700}

  /* pushed pages */
  .app-calendar .cal-stack{position:absolute;left:0;top:0;right:0;bottom:0;pointer-events:none;overflow:hidden}
  .app-calendar .cal-page{position:absolute;left:0;top:0;right:0;bottom:0;display:flex;flex-direction:column;background:var(--bg);pointer-events:auto;
    transform:translateX(100%);transition:transform .42s ${CURVE};box-shadow:-.5px 0 0 var(--sep),-8px 0 24px rgba(0,0,0,.08)}
  .app-calendar .cal-page.in{transform:none}
  .app-calendar .cal-edge{position:absolute;left:0;top:var(--safe-top);bottom:0;width:20px;z-index:6}

  /* day view */
  .app-calendar .cal-strip{display:flex;height:44px;align-items:center}
  .app-calendar .cal-strip button{width:calc(100%/7);height:44px;display:flex;align-items:center;justify-content:center}
  .app-calendar .cal-strip b{font-weight:400;font-size:19px;letter-spacing:0;width:36px;height:36px;line-height:36px;border-radius:50%;text-align:center}
  .app-calendar .cal-strip .we b{color:var(--label2)}
  .app-calendar .cal-strip .today b{color:var(--red)}
  .app-calendar .cal-strip .sel b{background:var(--label);color:var(--bg);font-weight:600}
  .app-calendar .cal-strip .sel.today b{background:var(--red);color:#fff}
  .app-calendar .cal-dayline{height:34px;line-height:32px;text-align:center;font-size:17px}
  .app-calendar .cal-allday{flex:none;display:flex;border-bottom:.5px solid var(--sep);padding:4px 8px 4px 0;max-height:112px;overflow-y:auto}
  .app-calendar .cal-allday:empty{display:none}
  .app-calendar .cal-allday>span{width:58px;flex:none;text-align:right;font-size:11px;color:var(--label2);letter-spacing:0;padding-top:6px;box-sizing:border-box;padding-right:0}
  .app-calendar .cal-allday>div{flex:1;min-width:0;margin-left:4px;display:flex;flex-direction:column;gap:2px}
  .app-calendar .cal-tl{flex:1;min-height:0;overflow-y:auto;position:relative}
  .app-calendar .cal-tl-in{position:relative;height:${24 * 60 + 24}px}
  .app-calendar .cal-hr{position:absolute;left:0;right:0;height:60px}
  .app-calendar .cal-hr::after{content:"";position:absolute;left:62px;right:0;top:0;height:.5px;background:var(--sep)}
  .app-calendar .cal-hr span{position:absolute;left:0;width:54px;top:-7px;text-align:right;font-size:11px;line-height:14px;color:var(--label2);letter-spacing:0;white-space:nowrap}
  .app-calendar .cal-evs{position:absolute;left:63px;right:8px;top:12px;height:1440px;pointer-events:none}
  .app-calendar .cal-evb{--c:#007AFF;position:absolute;box-sizing:border-box;border-radius:5px;overflow:hidden;cursor:pointer;pointer-events:auto;
    background:color-mix(in srgb,var(--c) 24%,var(--bg));border-left:3px solid var(--c);padding:2px 5px;font-size:13px;line-height:16px;letter-spacing:-.1px;
    color:color-mix(in srgb,var(--c) 62%,var(--label));transition:filter .15s}
  .app-calendar .cal-evb:active{filter:brightness(.88)}
  .app-calendar .cal-evb b{display:block;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .app-calendar .cal-evb.wrap b{white-space:normal}
  .app-calendar .cal-evb small{display:block;font-size:12px;opacity:.85;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .app-calendar .cal-allday .cal-evb{position:relative;height:22px;line-height:18px}
  .app-calendar .cal-now{position:absolute;left:0;right:0;height:0;z-index:3;pointer-events:none}
  .app-calendar .cal-now span{position:absolute;left:0;width:54px;top:-7px;text-align:right;font-size:11px;line-height:14px;font-weight:600;color:var(--red);letter-spacing:0;white-space:nowrap}
  .app-calendar .cal-now::before{content:"";position:absolute;left:58px;top:-4px;width:8px;height:8px;border-radius:50%;background:var(--red)}
  .app-calendar .cal-now::after{content:"";position:absolute;left:62px;right:0;top:-.5px;height:1px;background:var(--red)}

  /* event detail */
  .app-calendar .cal-detail{flex:1;min-height:0;overflow-y:auto;background:var(--bg2)}
  .app-calendar .cal-detail-page{background:var(--bg2)}
  .app-calendar .cal-d-top{padding:18px 20px 8px}
  .app-calendar .cal-d-title{font-size:22px;font-weight:700;letter-spacing:.2px;line-height:27px;word-break:break-word}
  .app-calendar .cal-d-loc{color:var(--label2);margin-top:2px;font-size:16px}
  .app-calendar .cal-d-when{margin-top:12px;font-size:16px;line-height:22px;color:var(--label2)}
  .app-calendar .cal-d-when .rep{margin-top:4px}
  .app-calendar .cal-dot{display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:7px;vertical-align:0}
  .app-calendar .cal-d-notes{white-space:pre-wrap;line-height:22px;padding:11px 16px;font-size:16px}
  .app-calendar .cal-d-del{justify-content:center;color:var(--red);cursor:pointer}
  .app-calendar .cal-detail .ios-row{display:flex;align-items:center}
  .app-calendar .cal-detail .ios-row-label{flex:1}

  /* editor (lives inside OS sheets → scoped by own class names) */
  .cal-ed{padding-bottom:40px}
  .cal-ed .ios-row{display:flex;align-items:center}
  .cal-ed .ios-row-label{flex:1;white-space:nowrap}
  .cal-ed input.cal-in,.cal-ed textarea.cal-in{flex:1;width:100%;border:0;outline:0;background:none;font:inherit;font-size:17px;letter-spacing:-.4px;color:var(--label);padding:0;min-height:24px;resize:none}
  .cal-ed textarea.cal-in{height:96px;padding:11px 0;line-height:22px}
  .cal-ed .cal-in::placeholder{color:var(--label3)}
  .cal-ed .cal-pills{display:flex;gap:6px}
  .cal-ed .cal-pill{border:0;font:inherit;font-size:17px;letter-spacing:-.4px;background:var(--fill2);color:var(--label);border-radius:8px;padding:6px 11px;cursor:pointer;white-space:nowrap;transition:color .2s}
  .cal-ed .cal-pill.on{color:var(--red)}
  .cal-ed .cal-pill.bad{text-decoration:line-through;color:var(--label2)}
  .cal-ed .cal-exp{height:0;overflow:hidden;transition:height .35s ${CURVE};position:relative}
  .cal-ed .cal-exp.open{border-top:.5px solid var(--sep)}
  .cal-ed .cal-val{display:flex;align-items:center;gap:5px;color:var(--label2);cursor:pointer}
  .cal-ed .cal-val .cal-dot{width:10px;height:10px;border-radius:50%;display:inline-block}
  .cal-ed .cal-del{justify-content:center;color:var(--red);cursor:pointer}
  .cal-minical{padding:4px 12px 8px;-webkit-user-select:none;user-select:none}
  .cal-minical-h{display:flex;align-items:center;height:44px;padding:0 4px}
  .cal-minical-h b{flex:1;font-size:17px;font-weight:600}
  .cal-minical-h button{border:0;background:none;color:var(--red);width:40px;height:40px;display:flex;align-items:center;justify-content:center;cursor:pointer}
  .cal-minical-h button:active{opacity:.4}
  .cal-minical-w,.cal-minical-g{display:grid;grid-template-columns:repeat(7,1fr);text-align:center}
  .cal-minical-w span{font-size:12px;font-weight:600;color:var(--label3);height:20px;letter-spacing:0}
  .cal-minical-g button{border:0;background:none;font:inherit;font-size:20px;letter-spacing:0;color:var(--label);height:40px;padding:0;cursor:pointer;display:flex;align-items:center;justify-content:center}
  .cal-minical-g button span{width:38px;height:38px;line-height:38px;border-radius:50%}
  .cal-minical-g button.t span{color:var(--red)}
  .cal-minical-g button.s span{background:color-mix(in srgb,var(--red) 16%,transparent);color:var(--red);font-weight:600}
  .cal-minical-g button.s.t span{background:var(--red);color:#fff}

  /* search / calendars / inbox sheets */
  .cal-sr{padding:4px 0 40px}
  .cal-sr .ios-search{margin:4px 16px 10px}
  .cal-sr-day{padding:14px 20px 5px;font-size:13px;font-weight:600;color:var(--label2);text-transform:uppercase;letter-spacing:-.1px}
  .cal-sr-day.today{color:var(--red)}
  .cal-sr-row{display:flex;align-items:stretch;gap:10px;padding:9px 16px 9px 20px;cursor:pointer;position:relative}
  .cal-sr-row:active{background:var(--fill2)}
  .cal-sr-row::after{content:"";position:absolute;left:20px;right:0;bottom:0;height:.5px;background:var(--sep)}
  .cal-sr-row i{width:4px;border-radius:2px;flex:none}
  .cal-sr-row div{flex:1;min-width:0}
  .cal-sr-row b{display:block;font-weight:600;font-size:16px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .cal-sr-row small{display:block;font-size:14px;color:var(--label2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .cal-sr-row time{flex:none;text-align:right;font-size:14px;color:var(--label2);line-height:19px;white-space:nowrap}
  .cal-empty{padding:70px 40px;text-align:center;color:var(--label2)}
  .cal-empty svg{color:var(--label3);margin-bottom:10px}
  .cal-empty b{display:block;font-size:22px;font-weight:700;color:var(--label);margin-bottom:4px}
  .cal-cl{padding-bottom:40px}
  .cal-cl .ios-row{display:flex;align-items:center;cursor:pointer}
  .cal-cl .ios-row-label{flex:1}
  .cal-cl .cal-ck{width:22px;height:22px;border-radius:50%;border:1.5px solid var(--c);box-sizing:border-box;margin-right:12px;display:flex;align-items:center;justify-content:center;color:#fff;flex:none}
  .cal-cl .cal-ck.on{background:var(--c)}
  .cal-cl .cal-ck svg{width:13px;height:13px;opacity:0}.cal-cl .cal-ck.on svg{opacity:1}
  .cal-cl .cal-add{color:var(--red)}
  `);

  /* ───────────────────────── app state ───────────────────────── */
  let ui = null;               // set on launch
  let dayCounts = new Map();

  function rebuildCounts() {
    dayCounts = new Map();
    if (!ui) return;
    const from = ui.winStart.getTime(), to = ui.winEnd.getTime();
    visibleEvents().forEach((ev) => {
      occurrences(ev, from, to).forEach((o) => {
        let d = sod(Math.max(o.start, from)); const last = Math.min(o.end - 1, to - 1); let guard = 0;
        do { const k = dkey(d); dayCounts.set(k, (dayCounts.get(k) || 0) + 1); d = addDays(d, 1); } while (d.getTime() <= last && guard++ < 400);
      });
    });
  }
  function commit() {
    saveEvents();
    if (!ui) return;
    rebuildCounts();
    ui.updateDots();
    ui.pages.slice().forEach((p) => { try { p.refresh && p.refresh(); } catch (e) { console.error(e); } });
  }
  function tintSheet(body) { const s = (body.closest && body.closest('.ios-sheet')) || body; s.classList.add('calendar-tint'); }

  /* ───────────────────────── inline date picker ───────────────────────── */
  function miniCal(host, getDate, onPick) {
    const cur = getDate(); let view = new Date(cur.getFullYear(), cur.getMonth(), 1);
    function draw() {
      const selK = dkey(getDate()), tK = dkey(new Date());
      const first = view.getDay(), n = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
      let g = '';
      for (let i = 0; i < 42; i++) {
        const d = i - first + 1;
        if (d < 1 || d > n) { g += '<span></span>'; continue; }
        const k = view.getFullYear() * 10000 + (view.getMonth() + 1) * 100 + d;
        g += '<button type="button" data-d="' + k + '" class="' + (k === selK ? 's ' : '') + (k === tK ? 't' : '') + '"><span>' + d + '</span></button>';
      }
      host.innerHTML = '<div class="cal-minical"><div class="cal-minical-h"><b>' + MONTHS[view.getMonth()] + ' ' + view.getFullYear() + '</b>' +
        '<button type="button" data-n="-1">' + IC.chevL + '</button><button type="button" data-n="1">' + IC.chevR + '</button></div>' +
        '<div class="cal-minical-w">' + DAY3.map((d) => '<span>' + d.toUpperCase() + '</span>').join('') + '</div><div class="cal-minical-g">' + g + '</div></div>';
    }
    host.onclick = (e) => {
      const nb = e.target.closest('[data-n]'), db = e.target.closest('[data-d]');
      if (nb) { view = new Date(view.getFullYear(), view.getMonth() + (+nb.dataset.n), 1); OS.haptic('selection'); draw(); }
      else if (db) { OS.haptic('selection'); onPick(keyDate(+db.dataset.d)); draw(); }
    };
    draw();
  }

  /* ───────────────────────── event editor sheet ───────────────────────── */
  function defaultStart(day) {
    const now = new Date(); const d = new Date(day || now);
    d.setHours(now.getHours() + 1, 0, 0, 0);
    if (!sameDay(d, day || now)) { const x = sod(day || now); x.setHours(23, 0, 0, 0); return x; }
    return d;
  }
  function openEditor(opts) {
    opts = opts || {};
    const orig = opts.event || null;
    const d = orig ? JSON.parse(JSON.stringify(orig)) : {
      id: uid(), title: opts.title || '', location: opts.location || '', allDay: !!opts.allDay, repeat: 'none', alert: null, notes: '',
      calId: (calendars.find((c) => c.id === OS.store.get('calendar.lastCal', 'home')) || calendars[0]).id,
    };
    let sd, ed;
    if (orig) { sd = new Date(orig.start); ed = new Date(orig.end); }
    else { sd = opts.start ? new Date(opts.start) : defaultStart(opts.day); ed = opts.end ? new Date(opts.end) : new Date(sd.getTime() + 60 * MIN); }
    if (d.allDay && !orig) { sd = sod(sd); ed = sod(ed); }
    let open = null, picker = null, sheetRef = null;

    const valid = () => (d.allDay ? sod(ed) >= sod(sd) : ed > sd);
    function save() {
      if (!valid()) { OS.ui.alert({ title: 'Cannot Save Event', message: 'The start date must be before the end date.', buttons: [{ label: 'OK' }] }); return; }
      d.title = (d.title || '').trim() || 'New Event';
      d.location = (d.location || '').trim();
      if (d.allDay) { d.start = sod(sd).getTime(); d.end = sod(ed).getTime(); } else { d.start = sd.getTime(); d.end = ed.getTime(); }
      if (orig) { const i = events.findIndex((e) => e.id === orig.id); if (orig.start !== d.start) delete d.exdates; if (i >= 0) events[i] = d; else events.push(d); }
      else events.push(d);
      OS.store.set('calendar.lastCal', d.calId);
      // let a changed alert fire again
      const fired = OS.store.get('calendar.fired', {}) || {}; let ch = false;
      Object.keys(fired).forEach((k) => { if (k.indexOf(d.id + '@') === 0) { delete fired[k]; ch = true; } });
      if (ch) OS.store.set('calendar.fired', fired);
      commit();
      OS.haptic('success');
      sheetRef && sheetRef.close();
      opts.onSave && opts.onSave(d);
    }

    const sh = OS.ui.sheet({
      title: orig ? 'Edit Event' : 'New Event', height: 'large',
      left: { label: 'Cancel', onTap() { (sheetRef || sh).close(); } },
      right: { label: orig ? 'Done' : 'Add', bold: true, onTap: save },
      render(body, sheet) {
        sheetRef = sheet || sheetRef;
        tintSheet(body);
        body.innerHTML = `
        <div class="cal-ed">
          <div class="ios-list">
            <div class="ios-row"><input class="cal-in" data-f="title" placeholder="Title" enterkeyhint="done" autocomplete="off"></div>
            <div class="ios-row"><input class="cal-in" data-f="location" placeholder="Location or Video Call" enterkeyhint="done" autocomplete="off"></div>
          </div>
          <div class="ios-list">
            <div class="ios-row"><span class="ios-row-label">All-day</span><label class="ios-switch"><input type="checkbox" data-f="allDay"><i></i></label></div>
            <div class="ios-row"><span class="ios-row-label">Starts</span><span class="cal-pills"><button type="button" class="cal-pill" data-p="start-date"></button><button type="button" class="cal-pill" data-p="start-time"></button></span></div>
            <div class="cal-exp" data-x="start"></div>
            <div class="ios-row"><span class="ios-row-label">Ends</span><span class="cal-pills"><button type="button" class="cal-pill" data-p="end-date"></button><button type="button" class="cal-pill" data-p="end-time"></button></span></div>
            <div class="cal-exp" data-x="end"></div>
            <div class="ios-row tappable" data-m="repeat"><span class="ios-row-label">Repeat</span><span class="cal-val"><span data-v="repeat"></span>${IC.updown}</span></div>
          </div>
          <div class="ios-list">
            <div class="ios-row tappable" data-m="cal"><span class="ios-row-label">Calendar</span><span class="cal-val"><i class="cal-dot" data-v="caldot"></i><span data-v="cal"></span>${IC.updown}</span></div>
          </div>
          <div class="ios-list">
            <div class="ios-row tappable" data-m="alert"><span class="ios-row-label">Alert</span><span class="cal-val"><span data-v="alert"></span>${IC.updown}</span></div>
          </div>
          <div class="ios-list"><div class="ios-row"><textarea class="cal-in" data-f="notes" placeholder="Notes"></textarea></div></div>
          ${orig ? '<div class="ios-list"><div class="ios-row tappable cal-del" data-m="delete">Delete Event</div></div>' : ''}
        </div>`;
        const $ = (s) => body.querySelector(s);
        const fTitle = $('[data-f=title]'), fLoc = $('[data-f=location]'), fAll = $('[data-f=allDay]'), fNotes = $('[data-f=notes]');
        fTitle.value = d.title || ''; fLoc.value = d.location || ''; fNotes.value = d.notes || ''; fAll.checked = !!d.allDay;
        fTitle.addEventListener('input', () => { d.title = fTitle.value; });
        fLoc.addEventListener('input', () => { d.location = fLoc.value; });
        fNotes.addEventListener('input', () => { d.notes = fNotes.value; });
        [fTitle, fLoc].forEach((el) => el.addEventListener('keydown', (e) => { if (e.key === 'Enter') el.blur(); }));

        function sync() {
          $('[data-p=start-date]').textContent = fmtMed(sd);
          $('[data-p=end-date]').textContent = fmtMed(ed);
          const st = $('[data-p=start-time]'), et = $('[data-p=end-time]');
          st.textContent = fmtTime(sd); et.textContent = fmtTime(ed);
          st.style.display = et.style.display = d.allDay ? 'none' : '';
          body.querySelectorAll('.cal-pill').forEach((p) => p.classList.toggle('on', p.dataset.p === open));
          const bad = !valid();
          $('[data-p=end-date]').classList.toggle('bad', bad); et.classList.toggle('bad', bad);
          $('[data-v=repeat]').textContent = repeatLabel(d.repeat);
          $('[data-v=alert]').textContent = alertLabel(d);
          const c = calOf(d); $('[data-v=cal]').textContent = c.name; $('[data-v=caldot]').style.background = c.color;
        }
        function setStart(nd) { const dur = ed - sd; sd = nd; ed = new Date(sd.getTime() + dur); }
        function buildExp(which, kind, host) {
          host.innerHTML = '';
          const get = () => (which === 'start' ? sd : ed);
          const set = (nd) => { if (which === 'start') setStart(nd); else ed = nd; sync(); };
          if (kind === 'date') {
            miniCal(host, get, (day) => { const cur = get(); const nd = new Date(day); nd.setHours(cur.getHours(), cur.getMinutes(), 0, 0); set(nd); });
            return 316;
          }
          const cur = get(), m5 = Math.round(cur.getMinutes() / 5) * 5 % 60;
          const mins = []; for (let i = 0; i < 60; i += 5) mins.push(i);
          const wrap = document.createElement('div'); wrap.style.cssText = 'width:260px;margin:0 auto'; host.appendChild(wrap);
          if (!OS.ui.wheelPicker) { wrap.innerHTML = '<div class="cal-empty" style="padding:30px">Time picker unavailable</div>'; return 100; }
          if (use24()) {
            const hrs = []; for (let i = 0; i < 24; i++) hrs.push(i);
            picker = OS.ui.wheelPicker(wrap, {
              columns: [{ values: hrs, labels: hrs.map(pad2), value: cur.getHours(), loop: true, align: 'right' }, { values: mins, labels: mins.map(pad2), value: m5, loop: true, align: 'left' }],
              onChange(v) { const nd = new Date(get()); nd.setHours(v[0], v[1], 0, 0); set(nd); },
            });
          } else {
            const hrs = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
            picker = OS.ui.wheelPicker(wrap, {
              columns: [{ values: hrs, value: cur.getHours() % 12 || 12, loop: true, align: 'right', width: 80 }, { values: mins, labels: mins.map(pad2), value: m5, loop: true, width: 70 }, { values: ['AM', 'PM'], value: cur.getHours() < 12 ? 'AM' : 'PM', align: 'left', width: 80 }],
              onChange(v) { const nd = new Date(get()); nd.setHours((v[0] % 12) + (v[2] === 'PM' ? 12 : 0), v[1], 0, 0); set(nd); },
            });
          }
          return 216;
        }
        function toggle(p) {
          const prev = open; open = prev === p ? null : p;
          body.querySelectorAll('.cal-exp').forEach((x) => {
            const mine = open && open.indexOf(x.dataset.x + '-') === 0;
            if (!mine) { if (x.classList.contains('open')) { x.style.height = '0px'; x.classList.remove('open'); setTimeout(() => { if (!x.classList.contains('open')) x.innerHTML = ''; }, 360); } return; }
            const hgt = buildExp(x.dataset.x, open.split('-')[1], x);
            x.classList.add('open');
            requestAnimationFrame(() => { x.style.height = hgt + 'px'; });
          });
          if (document.activeElement && body.contains(document.activeElement)) document.activeElement.blur();
          sync();
        }
        body.querySelectorAll('.cal-pill').forEach((p) => p.addEventListener('click', () => toggle(p.dataset.p)));
        fAll.addEventListener('change', () => {
          d.allDay = fAll.checked;
          if (open && open.indexOf('time') > 0) toggle(open);
          const list = d.allDay ? ALERTS_ALLDAY : ALERTS_TIMED;
          if (!list.some((a) => a[0] === d.alert)) d.alert = null;
          if (!d.allDay && ed <= sd) { ed = new Date(sd.getTime() + 60 * MIN); }
          sync();
        });
        const menu = (anchor, list, curVal, pick) => OS.ui.contextMenu(anchor, list.map((it) => ({ label: it[1], icon: it[0] === curVal ? IC.check : undefined, onTap() { pick(it[0]); sync(); } })));
        body.querySelector('[data-m=repeat]').addEventListener('click', (e) => menu(e.currentTarget.querySelector('.cal-val'), REPEATS, d.repeat || 'none', (v) => { d.repeat = v; if (v === 'none') { delete d.until; delete d.exdates; } }));
        body.querySelector('[data-m=alert]').addEventListener('click', (e) => menu(e.currentTarget.querySelector('.cal-val'), d.allDay ? ALERTS_ALLDAY : ALERTS_TIMED, d.alert, (v) => { d.alert = v; }));
        body.querySelector('[data-m=cal]').addEventListener('click', (e) => OS.ui.contextMenu(e.currentTarget.querySelector('.cal-val'), calendars.map((c) => ({
          label: c.name, icon: '<svg viewBox="0 0 16 16" width="16" height="16"><circle cx="8" cy="8" r="' + (c.id === d.calId ? 6 : 5) + '" fill="' + c.color + '"/></svg>', onTap() { d.calId = c.id; sync(); },
        }))));
        const del = body.querySelector('[data-m=delete]');
        if (del) del.addEventListener('click', () => deleteFlow(opts.occ || mkOcc(orig, orig.start), () => { (sheetRef || sh).close(); opts.onDelete && opts.onDelete(); }));
        sync();
        if (!orig && !opts.title) setTimeout(() => { try { fTitle.focus(); } catch (e) {} }, 450);
      },
    });
    sheetRef = sheetRef || sh;
    void picker;
    return sh;
  }

  async function deleteFlow(occ, after) {
    const ev = byId(occ.ev.id); if (!ev) { after && after(); return; }
    if (isRepeating(ev)) {
      const i = await OS.ui.actionSheet({ title: 'This is a repeating event.', buttons: [{ label: 'Delete This Event Only', style: 'destructive' }, { label: 'Delete All Future Events', style: 'destructive' }], cancel: 'Cancel' });
      if (i === 0) { (ev.exdates = ev.exdates || []).push(occ.start); }
      else if (i === 1) { if (occ.start <= ev.start) events = events.filter((e) => e.id !== ev.id); else ev.until = occ.start - 1; }
      else return;
    } else {
      const i = await OS.ui.actionSheet({ title: 'Are you sure you want to delete this event?', buttons: [{ label: 'Delete Event', style: 'destructive' }], cancel: 'Cancel' });
      if (i !== 0) return;
      events = events.filter((e) => e.id !== ev.id);
    }
    OS.haptic('medium');
    after && after();          // pop first so refresh() doesn't touch a dead page
    commit();
  }

  /* ───────────────────────── sheets: search, calendars, inbox ───────────────────────── */
  function occTimeText(o) {
    if (o.ev.allDay) return 'all-day';
    return fmtTime(o.start) + '<br>' + fmtTime(o.end);
  }
  function openSearch() {
    const sh = OS.ui.sheet({
      title: 'Search', height: 'large', right: { label: 'Done', bold: true, onTap() { sh.close(); } },
      render(body, sheet) {
        tintSheet(body);
        body.innerHTML = '<div class="cal-sr"><div class="ios-search"><input type="text" placeholder="Search" enterkeyhint="search" autocomplete="off"></div><div class="cal-sr-list"></div></div>';
        const input = body.querySelector('input'), list = body.querySelector('.cal-sr-list');
        let shown = [];
        function draw() {
          const q = input.value.trim().toLowerCase(), now = Date.now();
          const from = q ? now - 365 * DAY : sod(now).getTime(), to = now + (q ? 365 : 60) * DAY;
          let occs = occsInRange(from, to).filter((o) => o.start >= from || o.end > from);
          if (q) occs = occs.filter((o) => (o.ev.title || '').toLowerCase().indexOf(q) >= 0 || (o.ev.location || '').toLowerCase().indexOf(q) >= 0 || (o.ev.notes || '').toLowerCase().indexOf(q) >= 0);
          occs.sort((a, b) => a.start - b.start);
          if (q) { const fut = occs.filter((o) => o.end >= now), pastO = occs.filter((o) => o.end < now); occs = pastO.slice(-15).concat(fut.slice(0, 60)); } else occs = occs.slice(0, 60);
          shown = occs;
          if (!occs.length) { list.innerHTML = '<div class="cal-empty">' + IC.search.replace('width="22" height="22"', 'width="44" height="44"') + '<b>No Results</b>' + (q ? 'for “' + esc(input.value.trim()) + '”' : 'No upcoming events') + '</div>'; return; }
          let html = '', lastK = 0;
          occs.forEach((o, i) => {
            const k = dkey(new Date(Math.max(o.start, from)));
            if (k !== lastK) { lastK = k; const dd = keyDate(k); html += '<div class="cal-sr-day' + (sameDay(dd, now) ? ' today' : '') + '">' + (sameDay(dd, now) ? 'Today · ' : '') + esc(fmtLong(dd)) + '</div>'; }
            html += '<div class="cal-sr-row" data-i="' + i + '"><i style="background:' + calOf(o.ev).color + '"></i><div><b>' + esc(o.ev.title) + '</b>' + (o.ev.location ? '<small>' + esc(o.ev.location) + '</small>' : '') + '</div><time>' + occTimeText(o) + '</time></div>';
          });
          list.innerHTML = html;
        }
        input.addEventListener('input', draw);
        input.addEventListener('keydown', (e) => { if (e.key === 'Enter') input.blur(); });
        list.addEventListener('click', (e) => {
          const r = e.target.closest('[data-i]'); if (!r) return;
          const o = shown[+r.dataset.i]; (sheet || sh).close();
          if (ui) setTimeout(() => ui.showEvent(o), 250);
        });
        draw();
      },
    });
  }
  function openCalendars() {
    const sh = OS.ui.sheet({
      title: 'Calendars', height: 'large', right: { label: 'Done', bold: true, onTap() { sh.close(); } },
      render(body) {
        tintSheet(body);
        function draw() {
          const allShown = !hidden.length;
          body.innerHTML = '<div class="cal-cl"><div class="ios-list-header">On My iPhone</div><div class="ios-list">' +
            calendars.map((c) => '<div class="ios-row tappable" data-c="' + esc(c.id) + '"><span class="cal-ck' + (hidden.indexOf(c.id) < 0 ? ' on' : '') + '" style="--c:' + c.color + '">' + IC.check + '</span><span class="ios-row-label">' + esc(c.name) + '</span><span class="ios-row-value">' + events.filter((e) => e.calId === c.id).length + '</span></div>').join('') +
            '</div><div class="ios-list"><div class="ios-row tappable cal-add" data-a="add">Add Calendar</div></div>' +
            '<div class="ios-list"><div class="ios-row tappable cal-add" data-a="all">' + (allShown ? 'Hide All' : 'Show All') + '</div></div>' +
            '<div class="ios-list-footer">Events from unchecked calendars are hidden and won’t send alerts.</div></div>';
        }
        body.addEventListener('click', async (e) => {
          const c = e.target.closest('[data-c]'), a = e.target.closest('[data-a]');
          if (c) { const id = c.dataset.c, i = hidden.indexOf(id); if (i >= 0) hidden.splice(i, 1); else hidden.push(id); OS.haptic('light'); }
          else if (a && a.dataset.a === 'all') { hidden = hidden.length ? [] : calendars.map((x) => x.id); }
          else if (a && a.dataset.a === 'add') {
            const name = await OS.ui.prompt({ title: 'New Calendar', message: 'Enter a name for this calendar.', placeholder: 'Calendar Name', okLabel: 'Add' });
            if (!name || !name.trim()) return;
            const used = calendars.map((x) => x.color); const color = PALETTE.find((p) => used.indexOf(p) < 0) || PALETTE[calendars.length % PALETTE.length];
            calendars.push({ id: uid(), name: name.trim(), color }); saveCalendars();
          } else return;
          OS.store.set('calendar.hidden', hidden);
          draw(); commit();
        });
        draw();
      },
    });
  }
  function openInbox() {
    const sh = OS.ui.sheet({
      title: 'Inbox', height: 'large', right: { label: 'Done', bold: true, onTap() { sh.close(); } },
      render(body) { tintSheet(body); body.innerHTML = '<div class="cal-empty">' + IC.tray + '<b>No New Invitations</b>Event invitations you receive will appear here.</div>'; },
    });
  }

  /* ───────────────────────── app UI ───────────────────────── */
  function buildUI(ctx) {
    const root = ctx.root;
    root.dataset.mode = 'month';
    let today = sod(new Date());
    const wd = DAY3.map((d, i) => '<span class="' + (i === 0 || i === 6 ? 'we' : '') + '">' + d[0] + '</span>').join('');
    const toolHTML = '<div class="cal-tool"><button type="button" data-t="today">Today</button><button type="button" data-t="cals">Calendars</button><button type="button" data-t="inbox">Inbox</button></div>';
    root.innerHTML = `
      <div class="cal-base">
        <div class="cal-head">
          <div class="cal-head-row"><button type="button" class="cal-back">${IC.back}<span></span></button><span class="cal-sp"></span>
            <button type="button" class="cal-ic" data-a="search">${IC.search}</button><button type="button" class="cal-ic" data-a="add">${IC.plus}</button></div>
          <div class="cal-wd">${wd}</div>
        </div>
        <div class="cal-layers"><div class="cal-layer cal-month ios-scroll"></div><div class="cal-layer cal-year ios-scroll"></div></div>
        ${toolHTML}
      </div>
      <div class="cal-stack"></div>`;
    const base = root.querySelector('.cal-base'), monthEl = root.querySelector('.cal-month'), yearEl = root.querySelector('.cal-year');
    const stack = root.querySelector('.cal-stack'), backLbl = root.querySelector('.cal-back span');
    const pages = [];
    const me = { pages, winStart: null, winEnd: null, updateDots, showEvent, goToDate, newEvent, refreshToday };
    let months = [];            // [{y, m, top, el}]
    let yearBuilt = false, firstScrollDone = false;

    /* ── month scroll ── */
    function buildMonths() {
      const y0 = today.getFullYear() - 2, y1 = today.getFullYear() + 3;
      me.winStart = new Date(y0, 0, 1); me.winEnd = new Date(y1 + 1, 0, 1);
      const tK = dkey(today); months = []; let html = '', top = 0;
      for (let y = y0; y <= y1; y++) for (let m = 0; m < 12; m++) {
        const first = new Date(y, m, 1).getDay(), n = new Date(y, m + 1, 0).getDate(), weeks = Math.ceil((first + n) / 7);
        const cur = y === today.getFullYear() && m === today.getMonth();
        html += '<div class="cal-m' + (cur ? ' cur' : '') + '" data-mi="' + months.length + '"><div class="cal-m-title"><span style="margin-left:calc(100%/7*' + first + ')">' + MON[m] + '</span></div>';
        for (let w = 0; w < weeks; w++) {
          html += '<div class="cal-w">';
          for (let c = 0; c < 7; c++) {
            const d = w * 7 + c - first + 1;
            if (d < 1 || d > n) { html += '<div class="cal-c e"></div>'; continue; }
            const k = y * 10000 + (m + 1) * 100 + d;
            html += '<div class="cal-c' + (c === 0 || c === 6 ? ' we' : '') + (k === tK ? ' today' : '') + '" data-d="' + k + '"><b>' + d + '</b><i></i></div>';
          }
          html += '</div>';
        }
        html += '</div>';
        months.push({ y, m, top });
        top += TITLE_H + weeks * ROW_H + MONTH_GAP;
      }
      monthEl.innerHTML = html;
      rebuildCounts(); updateDots();
    }
    function updateDots() { monthEl.querySelectorAll('.cal-c[data-d]').forEach((c) => c.classList.toggle('has', dayCounts.has(+c.dataset.d))); }
    const monthIndex = (y, m) => months.findIndex((x) => x.y === y && x.m === m);
    function visibleMonth() {
      const st = monthEl.scrollTop + 120; let lo = 0, hi = months.length - 1;
      while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (months[mid].top <= st) lo = mid; else hi = mid - 1; }
      return months[lo];
    }
    function syncBack() { const v = visibleMonth(); if (v) backLbl.textContent = v.y; }
    function scrollToMonth(y, m, smooth) {
      const i = monthIndex(y, m); if (i < 0) return false;
      const top = months[i].top;
      if (smooth && monthEl.scrollTo) { try { monthEl.scrollTo({ top, behavior: 'smooth' }); } catch (e) { monthEl.scrollTop = top; } } else monthEl.scrollTop = top;
      syncBack();
      return Math.abs(monthEl.scrollTop - top) < 4 || smooth;
    }
    monthEl.addEventListener('scroll', syncBack, { passive: true });
    monthEl.addEventListener('click', (e) => { const c = e.target.closest('.cal-c[data-d]'); if (c) openDay(keyDate(+c.dataset.d)); });

    /* ── year view ── */
    function buildYears() {
      const tK = dkey(today); let html = '';
      for (let y = me.winStart.getFullYear(); y < me.winEnd.getFullYear(); y++) {
        html += '<div class="cal-y' + (y === today.getFullYear() ? ' cur' : '') + '" data-y="' + y + '"><div class="cal-y-title">' + y + '</div><div class="cal-y-grid">';
        for (let m = 0; m < 12; m++) {
          const first = new Date(y, m, 1).getDay(), n = new Date(y, m + 1, 0).getDate();
          html += '<div class="cal-mm' + (y === today.getFullYear() && m === today.getMonth() ? ' cur' : '') + '" data-y="' + y + '" data-m="' + m + '"><div class="cal-mm-name">' + MON[m] + '</div><div class="cal-mm-days">';
          for (let i = 0; i < first; i++) html += '<span></span>';
          for (let d = 1; d <= n; d++) html += '<span' + (y * 10000 + (m + 1) * 100 + d === tK ? ' class="t"' : '') + '>' + d + '</span>';
          html += '</div></div>';
        }
        html += '</div></div>';
      }
      yearEl.innerHTML = html; yearBuilt = true;
    }
    function showYear() {
      if (!yearBuilt) buildYears();
      const v = visibleMonth(), blk = yearEl.querySelector('.cal-y[data-y="' + (v ? v.y : today.getFullYear()) + '"]');
      if (blk) yearEl.scrollTop = blk.offsetTop;
      const mm = v && yearEl.querySelector('.cal-mm[data-y="' + v.y + '"][data-m="' + v.m + '"]');
      setOrigin(mm);
      root.dataset.mode = 'year';
    }
    function setOrigin(mm) {
      if (!mm) { yearEl.style.transformOrigin = monthEl.style.transformOrigin = '50% 30%'; return; }
      const x = mm.offsetLeft + mm.offsetWidth / 2, y = mm.offsetTop - yearEl.scrollTop + mm.offsetHeight / 2;
      yearEl.style.transformOrigin = x + 'px ' + y + 'px';
      monthEl.style.transformOrigin = x + 'px ' + y + 'px';
    }
    yearEl.addEventListener('click', (e) => {
      const mm = e.target.closest('.cal-mm'); if (!mm) return;
      setOrigin(mm);
      scrollToMonth(+mm.dataset.y, +mm.dataset.m);
      root.dataset.mode = 'month';
    });
    root.querySelector('.cal-back').addEventListener('click', showYear);

    /* ── header + toolbar actions ── */
    base.querySelector('[data-a=search]').addEventListener('click', openSearch);
    base.querySelector('[data-a=add]').addEventListener('click', () => newEvent({ day: today }));
    function toolClick(e, onToday) {
      const b = e.target.closest('[data-t]'); if (!b) return;
      if (b.dataset.t === 'today') onToday(); else if (b.dataset.t === 'cals') openCalendars(); else openInbox();
    }
    base.querySelector('.cal-tool').addEventListener('click', (e) => toolClick(e, () => {
      if (root.dataset.mode === 'year') { setOrigin(yearEl.querySelector('.cal-mm.cur')); scrollToMonth(today.getFullYear(), today.getMonth()); root.dataset.mode = 'month'; }
      else scrollToMonth(today.getFullYear(), today.getMonth(), true);
    }));
    function newEvent(o) { return openEditor(o || {}); }

    /* ── page stack ── */
    function pushPage(page, instant) {
      const under = pages.length ? pages[pages.length - 1].el : base;
      pages.push(page); stack.appendChild(page.el);
      const edge = document.createElement('div'); edge.className = 'cal-edge'; page.el.appendChild(edge);
      let t0 = 0;
      OS.util.drag(edge, {
        onStart() { page.el.style.transition = 'none'; t0 = Date.now(); },
        onMove(p) { page.el.style.transform = 'translateX(' + Math.max(0, p.dx) + 'px)'; },
        onEnd(p) {
          page.el.style.transition = ''; const fast = p.dx > 40 && Date.now() - t0 < 260;
          if (p.dx > 140 || fast) popPage(); else page.el.style.transform = '';
        },
      });
      if (instant) { page.el.style.transition = 'none'; under.style.transition = 'none'; }
      void page.el.offsetWidth;
      page.el.classList.add('in'); under.classList.add('under');
      if (instant) { void page.el.offsetWidth; page.el.style.transition = ''; under.style.transition = ''; }
    }
    function popPage() {
      const page = pages.pop(); if (!page) return;
      const under = pages.length ? pages[pages.length - 1].el : base;
      page.el.style.transform = ''; page.el.classList.remove('in'); under.classList.remove('under');
      page.onPop && page.onPop();
      setTimeout(() => page.el.remove(), 460);
    }
    function popAll() { while (pages.length) { const p = pages.pop(); p.onPop && p.onPop(); p.el.remove(); } base.classList.remove('under'); }

    /* ── day view ── */
    function hourLabel(hr) { if (use24()) return pad2(hr % 24) + ':00'; if (hr === 12) return 'Noon'; return (hr % 12 || 12) + ' ' + (hr % 24 < 12 ? 'AM' : 'PM'); }
    function openDay(date, instant) {
      let day = sod(date), dragged = 0, shown = [];
      const el = h(`<div class="cal-page cal-daypage">
        <div class="cal-head">
          <div class="cal-head-row"><button type="button" class="cal-back">${IC.back}<span></span></button><span class="cal-sp"></span>
            <button type="button" class="cal-ic" data-a="search">${IC.search}</button><button type="button" class="cal-ic" data-a="add">${IC.plus}</button></div>
          <div class="cal-wd">${wd}</div><div class="cal-strip"></div><div class="cal-dayline"></div>
        </div>
        <div class="cal-allday"></div>
        <div class="cal-tl ios-scroll"><div class="cal-tl-in"></div></div>${toolHTML}</div>`);
      const strip = el.querySelector('.cal-strip'), line = el.querySelector('.cal-dayline'), allEl = el.querySelector('.cal-allday');
      const tl = el.querySelector('.cal-tl'), tlin = el.querySelector('.cal-tl-in'), back = el.querySelector('.cal-back span');
      let hrs = '';
      for (let i = 0; i <= 24; i++) hrs += '<div class="cal-hr" data-h="' + i + '" style="top:' + (12 + i * 60) + 'px' + (i === 24 ? ';height:12px' : '') + '"><span>' + hourLabel(i) + '</span></div>';
      tlin.innerHTML = hrs + '<div class="cal-evs"></div><div class="cal-now" style="display:none"><span></span></div>';
      const evs = tlin.querySelector('.cal-evs'), nowEl = tlin.querySelector('.cal-now');
      tlin.querySelectorAll('.cal-hr').forEach((r) => {
        const hr = +r.dataset.h; if (hr > 23) return;
        OS.util.longPress(r, () => { OS.haptic('medium'); const s = new Date(day); s.setHours(hr, 0, 0, 0); newEvent({ start: s }); });
      });

      function drawStrip() {
        const ws = addDays(day, -day.getDay()), tK = dkey(today); let html = '';
        for (let i = 0; i < 7; i++) { const d = addDays(ws, i), k = dkey(d); html += '<button type="button" data-d="' + k + '" class="' + (i === 0 || i === 6 ? 'we ' : '') + (k === tK ? 'today ' : '') + (k === dkey(day) ? 'sel' : '') + '"><b>' + d.getDate() + '</b></button>'; }
        strip.innerHTML = html;
        line.textContent = DAYS[day.getDay()] + '  ' + MONTHS[day.getMonth()] + ' ' + day.getDate() + ', ' + day.getFullYear();
        back.textContent = MONTHS[day.getMonth()];
      }
      function block(o, i, style, extra) {
        return '<div class="cal-evb' + (extra || '') + '" data-i="' + i + '" style="--c:' + calOf(o.ev).color + ';' + style + '"><b>' + esc(o.ev.title) + '</b>' + (o.ev.location ? '<small>' + esc(o.ev.location) + '</small>' : '') + '</div>';
      }
      function drawEvents() {
        const ds = day.getTime(), de = addDays(day, 1).getTime();
        shown = occsInRange(ds, de).filter((o) => o.ev.allDay ? o.end > ds : (o.end > ds || (o.start >= ds && o.start < de)));
        const allday = [], timed = [];
        shown.forEach((o, i) => { o._i = i; if (o.ev.allDay || (o.start <= ds && o.end >= de)) allday.push(o); else timed.push(o); });
        allEl.innerHTML = allday.length ? '<span>all-day</span><div>' + allday.map((o) => block(o, o._i, '')).join('') + '</div>' : '';
        const items = timed.map((o) => { const s = Math.max(0, Math.round((Math.max(o.start, ds) - ds) / MIN)), e = Math.min(1440, Math.round((Math.min(o.end, de) - ds) / MIN)); return { o, s, e: Math.max(e, s), ve: Math.max(e, s + 26) }; });
        items.sort((a, b) => a.s - b.s || b.e - a.e);
        let cluster = [], cols = [], cEnd = -1;
        const flush = () => { cluster.forEach((it) => { it.n = cols.length; }); cluster = []; cols = []; cEnd = -1; };
        items.forEach((it) => {
          if (cluster.length && it.s >= cEnd) flush();
          let c = cols.findIndex((x) => x <= it.s); if (c < 0) { c = cols.length; cols.push(0); }
          cols[c] = it.ve; it.c = c; cluster.push(it); cEnd = Math.max(cEnd, it.ve);
        });
        flush();
        evs.innerHTML = items.map((it) => {
          const hgt = Math.max(it.ve - it.s, 26) - 2;
          return block(it.o, it.o._i, 'top:' + (it.s + 1) + 'px;height:' + hgt + 'px;left:' + (it.c / it.n * 100) + '%;width:calc(' + (100 / it.n) + '% - 2px)', hgt >= 56 ? ' wrap' : '');
        }).join('');
      }
      function drawNow() {
        const isToday = sameDay(day, new Date());
        nowEl.style.display = isToday ? '' : 'none';
        const now = new Date(), mins = now.getHours() * 60 + now.getMinutes();
        if (isToday) { nowEl.style.top = (12 + mins) + 'px'; nowEl.querySelector('span').textContent = use24() ? fmtTime(now) : fmtTime(now).replace(/ (AM|PM)$/, ' $1'); }
        tlin.querySelectorAll('.cal-hr span').forEach((s, i) => { s.style.visibility = isToday && Math.abs(i * 60 - mins) < 14 ? 'hidden' : ''; });
      }
      function autoScroll() {
        let target;
        if (sameDay(day, new Date())) { const n = new Date(); target = n.getHours() * 60 + n.getMinutes() - 150; }
        else { const first = shown.filter((o) => !o.ev.allDay && o.start >= day.getTime())[0]; target = first ? (first.start - day.getTime()) / MIN - 60 : 7 * 60 + 30; }
        tl.scrollTop = Math.max(0, target);
      }
      function draw() { drawStrip(); drawEvents(); drawNow(); }
      function setDay(d, dir) {
        day = sod(d); draw();
        if (dir && strip.animate) strip.animate([{ transform: 'translateX(' + dir * 60 + 'px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 320, easing: CURVE });
        if (evs.animate) { evs.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 220 }); }
      }
      strip.addEventListener('click', (e) => { if (Date.now() - dragged < 250) return; const b = e.target.closest('[data-d]'); if (b) { OS.haptic('selection'); setDay(keyDate(+b.dataset.d)); } });
      OS.util.drag(strip, { onEnd(p) { if (Math.abs(p.dx) > 45 && Math.abs(p.dx) > Math.abs(p.dy)) { dragged = Date.now(); const dir = p.dx < 0 ? 1 : -1; setDay(addDays(day, 7 * dir), dir); autoScroll(); } } });
      const openOcc = (e) => { const b = e.target.closest('.cal-evb'); if (b && shown[+b.dataset.i]) openDetail(shown[+b.dataset.i]); };
      evs.addEventListener('click', openOcc); allEl.addEventListener('click', openOcc);
      el.querySelector('.cal-back').addEventListener('click', () => { scrollToMonth(day.getFullYear(), day.getMonth()); popPage(); });
      el.querySelector('[data-a=search]').addEventListener('click', openSearch);
      el.querySelector('[data-a=add]').addEventListener('click', () => newEvent({ day }));
      el.querySelector('.cal-tool').addEventListener('click', (e) => toolClick(e, () => { setDay(today, sameDay(day, today) ? 0 : (day > today ? -1 : 1)); autoScroll(); }));

      const page = { el, kind: 'day', refresh: draw, tickNow: drawNow, setDay(d) { setDay(d); autoScroll(); }, getDay: () => day };
      pushPage(page, instant);
      draw();
      requestAnimationFrame(autoScroll);
      return page;
    }

    /* ── event detail ── */
    function whenHTML(o) {
      const ev = o.ev; let a, b = '';
      if (ev.allDay) {
        const last = o.end - 1;
        if (sameDay(o.start, last)) { a = fmtLong(o.start); b = 'All-day'; }
        else { a = 'All-day from ' + fmtShort(o.start); b = 'to ' + fmtShort(last); }
      } else if (sameDay(o.start, o.end)) { a = fmtLong(o.start); b = 'from ' + fmtTime(o.start) + ' to ' + fmtTime(o.end); }
      else { a = 'from ' + fmtTime(o.start) + ' ' + fmtShort(o.start); b = 'to ' + fmtTime(o.end) + ' ' + fmtShort(o.end); }
      return '<div>' + esc(a) + '</div><div>' + esc(b) + '</div>' + (isRepeating(ev) ? '<div class="rep">' + REPEAT_TEXT[ev.repeat] + (ev.until ? ' until ' + esc(fmtMed(ev.until)) : '') + '</div>' : '');
    }
    function openDetail(occ, instant) {
      const el = h(`<div class="cal-page cal-detail-page">
        <div class="cal-head"><div class="cal-head-row"><button type="button" class="cal-back">${IC.back}<span></span></button><div class="cal-head-title">Event Details</div><span class="cal-sp"></span><button type="button" class="cal-txtbtn" data-a="edit">Edit</button></div></div>
        <div class="cal-detail ios-scroll"></div></div>`);
      const body = el.querySelector('.cal-detail'), back = el.querySelector('.cal-back span');
      function draw() {
        const o = relocate(occ); if (!o) return;
        occ = o; const ev = o.ev, c = calOf(ev), d = new Date(o.start);
        back.textContent = MON[d.getMonth()] + ' ' + d.getDate();
        body.innerHTML = '<div class="cal-d-top"><div class="cal-d-title">' + esc(ev.title) + '</div>' + (ev.location ? '<div class="cal-d-loc">' + esc(ev.location) + '</div>' : '') +
          '<div class="cal-d-when">' + whenHTML(o) + '</div></div>' +
          '<div class="ios-list"><div class="ios-row tappable" data-m="cal"><span class="ios-row-label">Calendar</span><span class="ios-row-value"><i class="cal-dot" style="background:' + c.color + '"></i>' + esc(c.name) + '</span></div>' +
          '<div class="ios-row tappable" data-m="alert"><span class="ios-row-label">Alert</span><span class="ios-row-value">' + esc(alertLabel(ev)) + '</span></div></div>' +
          (ev.notes ? '<div class="ios-list-header">Notes</div><div class="ios-list"><div class="cal-d-notes">' + esc(ev.notes) + '</div></div>' : '') +
          '<div class="ios-list" style="margin-top:28px"><div class="ios-row tappable cal-d-del" data-m="delete">Delete Event</div></div><div style="height:60px"></div>';
      }
      body.addEventListener('click', (e) => {
        const r = e.target.closest('[data-m]'); if (!r) return;
        const ev = byId(occ.ev.id); if (!ev) return;
        if (r.dataset.m === 'delete') deleteFlow(occ, () => { if (pages[pages.length - 1] === page) popPage(); });
        else if (r.dataset.m === 'cal') OS.ui.contextMenu(r.querySelector('.ios-row-value'), calendars.map((c) => ({ label: c.name, icon: '<svg viewBox="0 0 16 16" width="16" height="16"><circle cx="8" cy="8" r="' + (c.id === ev.calId ? 6 : 5) + '" fill="' + c.color + '"/></svg>', onTap() { ev.calId = c.id; commit(); } })));
        else if (r.dataset.m === 'alert') OS.ui.contextMenu(r.querySelector('.ios-row-value'), (ev.allDay ? ALERTS_ALLDAY : ALERTS_TIMED).map((a) => ({ label: a[1], icon: a[0] === ev.alert ? IC.check : undefined, onTap() { ev.alert = a[0]; commit(); } })));
      });
      el.querySelector('.cal-back').addEventListener('click', popPage);
      el.querySelector('[data-a=edit]').addEventListener('click', () => { const ev = byId(occ.ev.id); if (ev) openEditor({ event: ev, occ, onDelete() { if (pages[pages.length - 1] === page) popPage(); } }); });
      const page = { el, kind: 'detail', refresh: draw };
      pushPage(page, instant);
      draw();
      return page;
    }

    /* ── navigation helpers ── */
    function goToDate(date, instant) {
      const d = sod(date);
      root.dataset.mode = 'month';
      scrollToMonth(d.getFullYear(), d.getMonth());
      const top = pages[pages.length - 1];
      if (top && top.kind === 'day') { top.setDay(d); return top; }
      popAll();
      return openDay(d, instant);
    }
    function showEvent(o) {
      const ev = byId(o.ev.id); if (!ev) return;
      popAll();
      const day = sod(Math.max(o.start, Math.min(o.end - 1, o.start)));
      scrollToMonth(day.getFullYear(), day.getMonth());
      openDay(day, true);
      openDetail(mkOcc(ev, o.start));
    }
    function refreshToday() {
      const t = sod(new Date());
      if (dkey(t) !== dkey(today)) {
        today = t; const st = monthEl.scrollTop;
        buildMonths(); monthEl.scrollTop = st; if (yearBuilt) buildYears();
        pages.forEach((p) => p.refresh && p.refresh());
      }
      pages.forEach((p) => p.tickNow && p.tickNow());
    }
    me.ensureScrolled = function () {
      if (firstScrollDone) return;
      if (scrollToMonth(today.getFullYear(), today.getMonth()) && monthEl.clientHeight > 0) firstScrollDone = true;
    };

    buildMonths();
    syncBack();
    return me;
  }

  /* ───────────────────────── registration ───────────────────────── */
  const def = {
    id: 'calendar',
    name: 'Calendar',
    icon: { bg: '#fff', glyph: iconGlyph(new Date()) },
    system: true,
    statusBar: 'auto',
    background: 'var(--bg)',
    launch(ctx) {
      ui = buildUI(ctx);
      requestAnimationFrame(() => ui && ui.ensureScrolled());
    },
    onResume(ctx, params) {
      if (!ui) return;
      ui.ensureScrolled();
      requestAnimationFrame(() => ui && ui.ensureScrolled());
      ui.refreshToday();
      if (!params) return;
      if (params.eventId) {
        const ev = byId(params.eventId);
        if (ev) { const o = params.occ ? mkOcc(ev, +params.occ) : (occurrences(ev, Date.now() - DAY, Date.now() + 400 * DAY)[0] || mkOcc(ev, ev.start)); ui.showEvent(o); }
      } else if (params.date) { ui.goToDate(new Date(params.date), true); }
      else if (params.newEvent) { ui.newEvent(typeof params.newEvent === 'object' ? params.newEvent : {}); }
    },
    onPause() {},
    onClose() { ui = null; },
  };
  OS.registerApp(def);

  let iconDay = dkey(new Date());
  OS.on('minute', () => {
    const k = dkey(new Date());
    if (k !== iconDay) { iconDay = k; def.icon.glyph = iconGlyph(new Date()); }   // picked up next time the OS redraws the icon
    if (ui) ui.refreshToday();
  });
  OS.on('setting:use24h', () => { if (ui) ui.pages.forEach((p) => p.refresh && p.refresh()); });

  /* small public API for Siri / widgets */
  OS.calendar = {
    events: () => events.slice(),
    eventsOn(date) { const s = sod(date || new Date()).getTime(); return occsInRange(s, s + DAY).map((o) => ({ id: o.ev.id, title: o.ev.title, location: o.ev.location, allDay: !!o.ev.allDay, start: o.start, end: o.end, color: calOf(o.ev).color })); },
    addEvent(e) {
      e = e || {};
      const start = e.start ? new Date(e.start).getTime() : defaultStart().getTime();
      const ev = { id: uid(), title: e.title || 'New Event', location: e.location || '', allDay: !!e.allDay, start: e.allDay ? sod(start).getTime() : start,
        end: e.end ? new Date(e.end).getTime() : (e.allDay ? sod(start).getTime() : start + 60 * MIN), repeat: e.repeat || 'none', alert: e.alert === undefined ? (e.allDay ? null : 15) : e.alert,
        notes: e.notes || '', calId: (calendars.find((c) => c.id === e.calId) || calendars[0]).id };
      events.push(ev); commit();
      return ev;
    },
  };
})();
