import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, fmtDate, fmtTime } from '../api.js';
import { useToast } from '../context.jsx';

export function BookingRow({ b, onCancel, showUser }) {
  return (
    <div className={`card booking ${b.status}`}>
      <div>
        <strong>{b.room?.name ?? 'Deleted room'}</strong>
        <div className="muted small">{fmtDate(b.date)} · {fmtTime(b.startMinute)}–{fmtTime(b.endMinute)} · {b.attendees} people{b.purpose && ` · ${b.purpose}`}</div>
        {showUser && b.user && <div className="small">{b.user.name} ({b.user.email})</div>}
      </div>
      {b.status === 'cancelled' ? <span className="badge grey">Cancelled</span>
        : onCancel ? <button className="danger" onClick={() => onCancel(b)}>Cancel</button>
        : <span className="badge">Done</span>}
    </div>
  );
}

export default function MyBookings() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const toast = useToast();
  const load = () => api('/bookings/mine').then(setData).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  const cancel = async (b) => {
    if (!confirm(`Cancel ${b.room.name} on ${fmtDate(b.date)} at ${fmtTime(b.startMinute)}?`)) return;
    try {
      await api(`/bookings/${b._id}/cancel`, { method: 'POST' });
      toast('Booking cancelled. The slot is free for others now.');
      load();
    } catch (err) { toast(err.message, 'error'); }
  };

  if (error) return <p className="error">{error}</p>;
  if (!data) return <p className="muted">Loading your bookings…</p>;
  return (
    <>
      <h1>My bookings</h1>
      <h2>Upcoming <span className="muted small">({data.upcoming.length}/3 allowed)</span></h2>
      {data.upcoming.length === 0
        ? <div className="empty">No upcoming bookings. <Link to="/">Find a room</Link></div>
        : data.upcoming.map((b) => <BookingRow key={b._id} b={b} onCancel={cancel} />)}
      <h2>History</h2>
      {data.history.length === 0 ? <p className="muted">Nothing yet.</p> : data.history.map((b) => <BookingRow key={b._id} b={b} />)}
    </>
  );
}
