import { useEffect, useState } from 'react';
import { Link, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { api } from './api';
import { Protected, useAuth } from './auth';
import { Icon, Logo, Notice } from './ui';
import { Discover, EventDetails, AuthPage, StudentDashboard } from './student';
import { OrganizerDashboard, EventEditor, Attendees } from './organizer';
export default function App() {
  const { user, setUser, error } = useAuth(); const navigate = useNavigate(); const location = useLocation(); const [logoutError, setLogoutError] = useState('');
  useEffect(() => { window.scrollTo(0, 0); }, [location.pathname]);
  async function logout() { try { await api('/auth/logout', { method: 'POST', body: {} }); setUser(null); setLogoutError(''); navigate('/'); } catch (e) { setLogoutError(e.message); } }
  return <><a className="skip-link" href="#main">Skip to content</a><header className="site-header"><div className="header-inner"><Link to="/" className="brand" aria-label="CampusConnect home"><Logo /><span>Campus<span className="font-normal">Connect</span><small>YOUR CAMPUS, CONNECTED.</small></span></Link><nav aria-label="Main navigation"><NavLink to="/" end>Discover events</NavLink>{user && <NavLink to={user.role === 'ORGANIZER' ? '/organizer' : '/dashboard'}>{user.role === 'ORGANIZER' ? 'Organizer studio' : 'My registrations'}</NavLink>}</nav><div className="header-actions">{user ? <><span className="avatar" title={user.name}>{user.name.charAt(0)}</span><span className="header-name">{user.name.split(' ')[0]}</span><button className="icon-button" onClick={logout} aria-label="Log out" title="Log out"><Icon name="logout" size={19} /></button></> : <><Link to="/login" className="login-link">Log in</Link><Link to="/signup" className="button small">Join the campus <Icon name="arrow" size={16} /></Link></>}</div></div></header>
  <main id="main"><div className="page-notice"><Notice>{logoutError || error}</Notice></div><Routes>
    <Route path="/" element={<Discover />} /><Route path="/events/:id" element={<EventDetails />} />
    <Route path="/login" element={<AuthPage />} /><Route path="/signup" element={<AuthPage signup />} />
    <Route path="/dashboard" element={<Protected><StudentDashboard /></Protected>} />
    <Route path="/organizer" element={<Protected organizer><OrganizerDashboard /></Protected>} />
    <Route path="/organizer/new" element={<Protected organizer><EventEditor /></Protected>} />
    <Route path="/organizer/events/:id/edit" element={<Protected organizer><EventEditor /></Protected>} />
    <Route path="/organizer/events/:id/attendees" element={<Protected organizer><Attendees /></Protected>} />
    <Route path="*" element={<div className="page not-found"><p className="eyebrow">404 / OFF THE CAMPUS MAP</p><h1>This page took a detour.</h1><p>Let’s get you back to something worth showing up for.</p><Link className="button" to="/">Discover events <Icon name="arrow" /></Link></div>} />
  </Routes></main><footer className="site-footer"><div><Link to="/" className="footer-brand"><Logo />CampusConnect</Link><p>A little more connected. A lot more campus.</p></div><div><span>FLEXICORE-3131 · Web Technology Project</span><small>Fictional events. Real possibilities. Built for learning.</small></div></footer></>;
}
