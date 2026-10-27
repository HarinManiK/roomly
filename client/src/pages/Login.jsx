import { useState } from 'react';
import { useAuth } from '../context.jsx';

export default function Login() {
  const { authenticate } = useAuth();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await authenticate(mode, mode === 'login' ? { email: form.email, password: form.password } : form);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth">
      <div className="hero">
        <h1>Book a study room in seconds.</h1>
        <p>See live availability across campus, reserve a slot that fits your group, and never walk into a double-booked room again.</p>
      </div>
      <form className="card" onSubmit={submit}>
        <h2>{mode === 'login' ? 'Log in' : 'Create an account'}</h2>
        {mode === 'register' && <label>Name<input value={form.name} onChange={set('name')} required minLength={2} /></label>}
        <label>Email<input type="email" value={form.email} onChange={set('email')} required /></label>
        <label>Password<input type="password" value={form.password} onChange={set('password')} required minLength={mode === 'register' ? 8 : 1} /></label>
        {error && <p className="error">{error}</p>}
        <button disabled={busy}>{busy ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Sign up'}</button>
        <p className="muted small">
          {mode === 'login' ? 'New here? ' : 'Already have an account? '}
          <button type="button" className="link" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}>
            {mode === 'login' ? 'Create an account' : 'Log in'}
          </button>
        </p>
      </form>
    </div>
  );
}
