import { Link } from 'react-router-dom';
import { availability, formatDate, formatTime } from './api';

const paths = {
 arrow: 'M4 12h16m-6-6 6 6-6 6', search: 'm21 21-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
 calendar: 'M8 2v4m8-4v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z',
 pin: 'M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0ZM15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
 users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m20 0v-2a4 4 0 0 0-3-3.87M13 3.13a4 4 0 0 1 0 7.75M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
 check: 'm5 12 4 4L19 6', plus: 'M12 5v14M5 12h14', close: 'm6 6 12 12M6 18 18 6',
 ticket: 'M3 8V5h18v3a4 4 0 0 0 0 8v3H3v-3a4 4 0 0 0 0-8Zm12-3v3m0 3v2m0 3v3',
 logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4m7 14 5-5-5-5M21 12H9',
 clock: 'M12 8v4l3 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
 edit: 'm16 3 5 5L9 20l-6 1 1-6L16 3Zm-2 2 5 5', trash: 'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7',
 spark: 'm12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3 3-7Z',
};
export function Icon({ name, size = 20, ...props }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}><path d={paths[name] || paths.spark} /></svg>; }
export function Logo() { return <span className="brand-mark" aria-hidden="true"><i /><i /><i /><i /></span>; }
export function Notice({ children, success = false }) { return children ? <div role={success ? 'status' : 'alert'} className={`notice ${success ? 'success' : 'error'}`}><Icon name={success ? 'check' : 'close'} size={18} /><span>{children}</span></div> : null; }
export function Loading() { return <div role="status" className="loading"><span className="spinner" /> Bringing campus to you…</div>; }
export function Empty({ title, children, action }) { return <div className="empty"><span className="empty-icon"><Icon name="calendar" size={28} /></span><h2>{title}</h2><p>{children}</p>{action}</div>; }
export function Badge({ children, muted = false }) { return <span className={`badge ${muted ? 'muted' : ''}`}>{children}</span>; }

export function EventArt({ category, large = false }) {
  const kind = { Technology: 'tech', 'Arts & Culture': 'arts', Sports: 'sports', Community: 'community' }[category] || 'tech';
  return <div className={`event-art ${kind} ${large ? 'large' : ''}`} aria-hidden="true">
    <span className="art-grid" /><span className="art-label">CAMPUS / {kind === 'arts' ? 'CULTURE' : kind.toUpperCase()}</span>
    {kind === 'tech' && <svg viewBox="0 0 300 180"><rect x="72" y="34" width="156" height="106" rx="10" fill="#334e4b" stroke="#a4c5b7" strokeWidth="2"/><path d="m119 71-18 16 18 16m62-32 18 16-18 16m-23-41-17 50" stroke="#d8eea0" fill="none" strokeWidth="5" strokeLinecap="round"/><path d="M55 145h190l-13 12H68Z" fill="#d8eea0"/><circle cx="234" cy="37" r="15" fill="#e5ad78"/></svg>}
    {kind === 'arts' && <svg viewBox="0 0 300 180"><circle cx="170" cy="88" r="63" fill="#d59170"/><path d="M86 138V44a8 8 0 0 1 8-8h58v102Z" fill="#f5d2b1" transform="rotate(-13 120 88)"/><path d="M107 69h27m-27 15h27m-27 15h19" stroke="#ae5e44" strokeWidth="3"/><path d="M184 44v72m0-49 30-9v44" stroke="#593c54" strokeWidth="5" fill="none"/><ellipse cx="174" cy="117" rx="12" ry="8" fill="#593c54"/><ellipse cx="204" cy="103" rx="12" ry="8" fill="#593c54"/></svg>}
    {kind === 'sports' && <svg viewBox="0 0 300 180"><path d="M30 150 87 35h132l50 115ZM63 87h178M150 35v115" stroke="#dfebd0" strokeWidth="2" fill="none"/><ellipse cx="157" cy="74" rx="28" ry="39" transform="rotate(32 157 74)" stroke="#faf2d7" strokeWidth="7" fill="#4e7860"/><path d="m137 108-31 45" stroke="#f2b66b" strokeWidth="9" strokeLinecap="round"/><path d="m213 61 15-23 14 14-22 17Z" fill="#e9e8c9"/></svg>}
    {kind === 'community' && <svg viewBox="0 0 300 180"><circle cx="150" cy="86" r="65" fill="#cfaf4f"/><path d="M151 146V67m0 42c-35 0-47-19-44-39 31 0 44 15 44 39Zm0-20c31 0 45-23 39-43-28 2-39 19-39 43Z" fill="#f6e9bd" stroke="#5e6240" strokeWidth="3"/><path d="M96 149h109" stroke="#5e6240" strokeWidth="3" strokeLinecap="round"/></svg>}
    <span className="art-corner">CC /</span>
  </div>;
}
export function EventCard({ event }) {
  const date = new Date(event.starts_at);
  const open = availability(event).includes('seats');
  return <article className="event-card"><Link to={`/events/${event.id}`} className="card-art-link" aria-label={`View ${event.title}`}><EventArt category={event.category} /></Link><div className="card-content">
    <div className="flex items-center justify-between gap-2"><Badge>{event.category}</Badge><span className={`seat-count ${open ? '' : 'text-neutral-500'}`}><span />{availability(event)}</span></div>
    <div className="card-title-row"><span className="date-tile"><small>{date.toLocaleDateString('en-IN', { month: 'short' })}</small><strong>{date.getDate()}</strong></span><h3><Link to={`/events/${event.id}`}>{event.title}</Link></h3></div>
    <p className="card-description">{event.description}</p>
    <div className="card-meta"><span><Icon name="clock" size={15} />{formatTime(event.starts_at)}</span><span><Icon name="pin" size={15} />{event.venue}</span></div>
    <div className="card-bottom"><span>By {event.organizer_name}</span><Link to={`/events/${event.id}`}>View event <Icon name="arrow" size={17} /></Link></div>
  </div></article>;
}
export function EventMeta({ event }) { return <dl className="event-meta-list">{[
 ['calendar', 'Date', formatDate(event.starts_at)], ['clock', 'Time', `${formatTime(event.starts_at)} (your local time)`], ['pin', 'Venue', event.venue], ['users', 'Organizer', event.organizer_name],
].map(([icon, label, value]) => <div key={label}><span className="meta-icon"><Icon name={icon} /></span><div><dt>{label}</dt><dd>{value}</dd></div></div>)}</dl>; }
