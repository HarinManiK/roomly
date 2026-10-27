import { useEffect, useState } from 'react';
import { api, fmtDate, fmtTime, todayISO } from '../api.js';
import { useToast } from '../context.jsx';
import { BookingRow } from './MyBookings.jsx';

const EMPTY = { name: '', building: '', capacity: 4, amenities: [], open: '09:00', close: '21:00', isActive: true };

export default function Admin() {
  const toast = useToast();
  const [rooms, setRooms] = useState(null);
  const [allAmenities, setAllAmenities] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState(null);
  const [date, setDate] = useState(todayISO());
  const [bookings, setBookings] = useState(null);
  const [error, setError] = useState('');

  const loadRooms = () => api('/rooms?includeInactive=true').then((d) => { setRooms(d.rooms); setAllAmenities(d.amenities); }).catch((e) => setError(e.message));
  const loadBookings = () => api(`/bookings?date=${date}`).then((d) => setBookings(d.bookings)).catch((e) => setError(e.message));
  useEffect(() => { loadRooms(); }, []);
  useEffect(() => { setBookings(null); loadBookings(); }, [date]); // eslint-disable-line react-hooks/exhaustive-deps

  const edit = (r) => {
    setEditing(r._id);
    setForm({ name: r.name, building: r.building, capacity: r.capacity, amenities: r.amenities, open: fmtTime(r.openMinute), close: fmtTime(r.closeMinute), isActive: r.isActive });
  };
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const toggle = (a) => setForm({ ...form, amenities: form.amenities.includes(a) ? form.amenities.filter((x) => x !== a) : [...form.amenities, a] });

  const save = async (e) => {
    e.preventDefault();
    try {
      await api(editing ? `/rooms/${editing}` : '/rooms', { method: editing ? 'PUT' : 'POST', body: { ...form, capacity: Number(form.capacity) } });
      toast(editing ? 'Room updated' : 'Room created');
      setEditing(null); setForm(EMPTY); loadRooms();
    } catch (err) { toast(err.message, 'error'); }
  };

  const cancel = async (b) => {
    if (!confirm(`Cancel ${b.user?.name}'s booking of ${b.room.name}?`)) return;
    try { await api(`/bookings/${b._id}/cancel`, { method: 'POST' }); toast('Booking cancelled'); loadBookings(); } catch (err) { toast(err.message, 'error'); }
  };

  return (
    <>
      <h1>Admin</h1>
      {error && <p className="error">{error}</p>}
      <div className="two">
        <section>
          <h2>Rooms</h2>
          {!rooms ? <p className="muted">Loading…</p> : rooms.map((r) => (
            <div key={r._id} className={`card booking ${r.isActive ? '' : 'cancelled'}`}>
              <div><strong>{r.name}</strong><div className="muted small">{r.building} · {r.capacity} people · {fmtTime(r.openMinute)}–{fmtTime(r.closeMinute)}{!r.isActive && ' · inactive'}</div></div>
              <button className="secondary" onClick={() => edit(r)}>Edit</button>
            </div>
          ))}
          <form className="card" onSubmit={save}>
            <h3>{editing ? 'Edit room' : 'Add a room'}</h3>
            <label>Name<input value={form.name} onChange={set('name')} required /></label>
            <label>Building<input value={form.building} onChange={set('building')} required /></label>
            <div className="row">
              <label>Capacity<input type="number" min="1" max="100" value={form.capacity} onChange={set('capacity')} required /></label>
              <label>Opens<input type="time" step="1800" value={form.open} onChange={set('open')} required /></label>
              <label>Closes<input type="time" step="1800" value={form.close} onChange={set('close')} required /></label>
            </div>
            <div className="chips">{allAmenities.map((a) => <button type="button" key={a} className={`chip ${form.amenities.includes(a) ? 'on' : ''}`} onClick={() => toggle(a)}>{a}</button>)}</div>
            <label className="check"><input type="checkbox" checked={form.isActive} onChange={set('isActive')} /> Bookable</label>
            <div className="row">
              <button>{editing ? 'Save changes' : 'Create room'}</button>
              {editing && <button type="button" className="secondary" onClick={() => { setEditing(null); setForm(EMPTY); }}>Cancel</button>}
            </div>
          </form>
        </section>
        <section>
          <h2>Bookings on <input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></h2>
          {!bookings ? <p className="muted">Loading…</p> : bookings.length === 0
            ? <div className="empty">No bookings on {fmtDate(date)}.</div>
            : bookings.map((b) => <BookingRow key={b._id} b={b} showUser onCancel={b.status === 'confirmed' ? cancel : null} />)}
        </section>
      </div>
    </>
  );
}
