import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api, addDays, fmtDate, fmtTime, todayISO } from '../api.js';
import { useToast } from '../context.jsx';

const MAX_SLOTS = 4; // 2 hours of 30-minute slots, mirrors the server rule

export default function RoomDetail() {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const date = params.get('date') || todayISO();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [sel, setSel] = useState([]); // selected slot start minutes, contiguous
  const [form, setForm] = useState({ attendees: 1, purpose: '' });
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const navigate = useNavigate();

  const load = useCallback(async () => {
    setError('');
    try { setData(await api(`/rooms/${id}/availability?date=${date}`)); } catch (err) { setError(err.message); }
  }, [id, date]);
  useEffect(() => { setData(null); setSel([]); load(); }, [load]);

  const click = (slot) => {
    if (slot.status !== 'free') return;
    const m = slot.start;
    if (sel.includes(m)) return setSel(sel.length === 1 ? [] : sel.filter((x) => x < m)); // shrink
    const lo = Math.min(...sel), hi = Math.max(...sel);
    const contiguous = sel.length && (m === hi + 30 || m === lo - 30);
    if (contiguous && sel.length < MAX_SLOTS) setSel([...sel, m].sort((a, b) => a - b));
    else setSel([m]);
  };

  const book = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api('/bookings', { method: 'POST', body: {
        roomId: id, date, start: fmtTime(sel[0]), end: fmtTime(sel[sel.length - 1] + 30), ...form,
      } });
      toast(`Booked ${data.room.name}, ${fmtDate(date)} ${fmtTime(sel[0])}–${fmtTime(sel[sel.length - 1] + 30)}`);
      navigate('/bookings');
    } catch (err) {
      toast(err.message, 'error');
      setSel([]);
      load(); // availability may have changed under us
    } finally {
      setBusy(false);
    }
  };

  if (error) return <div className="empty"><p className="error">{error}</p><Link to="/">Back to rooms</Link></div>;
  if (!data) return <p className="muted">Loading availability…</p>;
  const { room, slots } = data;

  return (
    <>
      <Link to="/" className="muted small">← All rooms</Link>
      <h1>{room.name}</h1>
      <p className="muted">{room.building} · up to {room.capacity} people · {room.amenities.join(', ') || 'no amenities listed'}</p>
      <div className="days">
        {Array.from({ length: 7 }, (_, i) => addDays(todayISO(), i)).map((d) => (
          <button key={d} className={`chip ${d === date ? 'on' : ''}`} onClick={() => setParams({ date: d })}>{fmtDate(d)}</button>
        ))}
      </div>
      <div className="legend small muted"><span className="dot free" /> free <span className="dot booked" /> booked <span className="dot mine" /> yours <span className="dot sel" /> selected</div>
      <div className="slots">
        {slots.map((s) => (
          <button key={s.start} disabled={s.status !== 'free'} onClick={() => click(s)}
            className={`slot ${s.mine ? 'mine' : s.status} ${sel.includes(s.start) ? 'sel' : ''}`}
            title={s.status === 'booked' ? (s.mine ? 'Your booking' : 'Already booked') : s.status === 'past' ? 'In the past' : 'Click to select'}>
            {s.label}
          </button>
        ))}
      </div>
      {slots.every((s) => s.status !== 'free') && <div className="empty">No free slots this day. Try another date.</div>}
      {sel.length > 0 && (
        <form className="card book" onSubmit={book}>
          <strong>{fmtDate(date)}, {fmtTime(sel[0])}–{fmtTime(sel[sel.length - 1] + 30)}</strong>
          <span className="muted small">({sel.length * 30} min, max 2 h, click adjacent slots to extend)</span>
          <label>Attendees<input type="number" min="1" max={room.capacity} value={form.attendees} onChange={(e) => setForm({ ...form, attendees: e.target.value })} required /></label>
          <label>Purpose<input maxLength="140" placeholder="e.g. DBMS project meeting" value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} /></label>
          <button disabled={busy}>{busy ? 'Booking…' : 'Confirm booking'}</button>
        </form>
      )}
    </>
  );
}
