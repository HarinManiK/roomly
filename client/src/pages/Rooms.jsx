import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, todayISO, fmtTime } from '../api.js';

export default function Rooms() {
  const [filters, setFilters] = useState({ q: '', minCapacity: '', amenities: [], date: todayISO(), start: '', end: '' });
  const [rooms, setRooms] = useState(null);
  const [amenities, setAmenities] = useState([]);
  const [error, setError] = useState('');

  const search = async (f = filters) => {
    setError('');
    const params = new URLSearchParams();
    if (f.q) params.set('q', f.q);
    if (f.minCapacity) params.set('minCapacity', f.minCapacity);
    if (f.amenities.length) params.set('amenities', f.amenities.join(','));
    if (f.start || f.end) { params.set('date', f.date); params.set('start', f.start); params.set('end', f.end); }
    try {
      const d = await api(`/rooms?${params}`);
      setRooms(d.rooms);
      setAmenities(d.amenities);
    } catch (err) {
      setError(err.message);
      setRooms([]);
    }
  };
  useEffect(() => { search(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (k) => (e) => setFilters({ ...filters, [k]: e.target.value });
  const toggle = (a) => setFilters({ ...filters, amenities: filters.amenities.includes(a) ? filters.amenities.filter((x) => x !== a) : [...filters.amenities, a] });
  const timed = filters.start && filters.end;

  return (
    <>
      <h1>Find a room</h1>
      <form className="card filters" onSubmit={(e) => { e.preventDefault(); search(); }}>
        <label>Search<input placeholder="Room or building" value={filters.q} onChange={set('q')} /></label>
        <label>Group size<input type="number" min="1" max="100" value={filters.minCapacity} onChange={set('minCapacity')} /></label>
        <label>Date<input type="date" min={todayISO()} value={filters.date} onChange={set('date')} /></label>
        <label>From<input type="time" step="1800" value={filters.start} onChange={set('start')} /></label>
        <label>To<input type="time" step="1800" value={filters.end} onChange={set('end')} /></label>
        <div className="chips">
          {amenities.map((a) => (
            <button type="button" key={a} className={`chip ${filters.amenities.includes(a) ? 'on' : ''}`} onClick={() => toggle(a)}>{a}</button>
          ))}
        </div>
        <button>Search</button>
      </form>
      {timed && rooms && !error && <p className="muted">Showing rooms free {filters.start}–{filters.end} on {filters.date}.</p>}
      {error && <p className="error">{error}</p>}
      {!rooms ? <p className="muted">Loading rooms…</p> : rooms.length === 0 ? (
        <div className="empty">No rooms match. Try a different time or fewer filters.</div>
      ) : (
        <div className="grid">
          {rooms.map((r) => (
            <Link key={r._id} to={`/rooms/${r._id}?date=${filters.date}`} className="card room">
              <div className="row"><h3>{r.name}</h3><span className="badge">👥 {r.capacity}</span></div>
              <p className="muted">{r.building} · {fmtTime(r.openMinute)}–{fmtTime(r.closeMinute)}</p>
              <div className="chips">{r.amenities.map((a) => <span key={a} className="chip static">{a}</span>)}</div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
