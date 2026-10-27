import { Navigate, NavLink, Route, Routes } from 'react-router-dom';
import { useAuth } from './context.jsx';
import Login from './pages/Login.jsx';
import Rooms from './pages/Rooms.jsx';
import RoomDetail from './pages/RoomDetail.jsx';
import MyBookings from './pages/MyBookings.jsx';
import Admin from './pages/Admin.jsx';

function Protected({ children, admin }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (admin && user.role !== 'admin') return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  const { user, loading, logout } = useAuth();
  if (loading) return <div className="center muted">Loading…</div>;
  return (
    <>
      <header className="nav">
        <NavLink to="/" className="brand">▣ Roomly</NavLink>
        {user && (
          <nav>
            <NavLink to="/" end>Find a room</NavLink>
            <NavLink to="/bookings">My bookings</NavLink>
            {user.role === 'admin' && <NavLink to="/admin">Admin</NavLink>}
            <span className="muted who">{user.name}{user.role === 'admin' && ' (admin)'}</span>
            <button className="link" onClick={logout}>Log out</button>
          </nav>
        )}
      </header>
      <main>
        <Routes>
          <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
          <Route path="/" element={<Protected><Rooms /></Protected>} />
          <Route path="/rooms/:id" element={<Protected><RoomDetail /></Protected>} />
          <Route path="/bookings" element={<Protected><MyBookings /></Protected>} />
          <Route path="/admin" element={<Protected admin><Admin /></Protected>} />
          <Route path="*" element={<div className="center"><h2>Page not found</h2><NavLink to="/">Go home</NavLink></div>} />
        </Routes>
      </main>
    </>
  );
}
