import express from 'express';
import bcrypt from 'bcrypt';
import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { transaction } from './db.js';
import { CATEGORIES, credentials, eventInput, HttpError, id, requireValue } from './validation.js';

const eventSelect = `SELECT e.*, u.name AS organizer_name,
 (SELECT COUNT(*) FROM registrations r WHERE r.event_id=e.id AND r.status='CONFIRMED') AS registration_count
 FROM events e JOIN users u ON e.organizer_id=u.id`;
const publicUser = user => ({ id: user.id, name: user.name, email: user.email, role: user.role });
const cookieName = 'campus_session';
const sessionMs = 8 * 60 * 60 * 1000;

export function createApp(db, { secureCookies = process.env.COOKIE_SECURE === 'true', appOrigin = process.env.APP_ORIGIN, authLimit = 40 } = {}) {
  const app = express();
  const sessions = new Map();
  const attempts = new Map();
  const dummyHash = bcrypt.hashSync('not-a-real-account-password', 12);
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    res.set({ 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'strict-origin-when-cross-origin' });
    if (req.path.startsWith('/api')) {
      res.set('Cache-Control', 'no-store');
      if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
        // Browser writes must come from this origin. JSON-only bodies prevent cross-site form submissions.
        const origin = req.get('origin');
        const expected = appOrigin || `${req.protocol}://${req.get('host')}`;
        if (origin && origin !== expected) return next(new HttpError(403, 'Cross-origin requests are not allowed.'));
        if (req.method !== 'DELETE' && !req.is('application/json')) return next(new HttpError(415, 'Send JSON with Content-Type: application/json.'));
      }
    }
    next();
  });
  app.use(express.json({ limit: '32kb' }));
  app.use((req, _res, next) => {
    const token = req.headers.cookie?.split(';').map(s => s.trim()).find(s => s.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1);
    const session = sessions.get(token);
    if (session && session.expires > Date.now()) { req.user = db.prepare('SELECT id,name,email,role FROM users WHERE id=?').get(session.userId); req.sessionToken = token; }
    else if (session) sessions.delete(token);
    next();
  });
  function auth(req, _res, next) { requireValue(req.user, 401, 'Please log in to continue.'); next(); }
  function role(required) { return (req, _res, next) => { requireValue(req.user?.role === required, 403, `${required === 'ORGANIZER' ? 'Organizer' : 'Student'} access required.`); next(); }; }
  function login(req, res, user) {
    // Remove expired sessions and rotate a prior session on every successful login.
    for (const [token, session] of sessions) if (session.expires <= Date.now()) sessions.delete(token);
    if (req.sessionToken) sessions.delete(req.sessionToken);
    const token = randomBytes(32).toString('hex');
    sessions.set(token, { userId: user.id, expires: Date.now() + sessionMs });
    res.cookie(cookieName, token, { httpOnly: true, sameSite: 'lax', secure: secureCookies, maxAge: sessionMs, path: '/' });
  }
  function rateLimit(req, _res, next) {
    const now = Date.now();
    for (const [key, value] of attempts) if (value.until < now) attempts.delete(key);
    const entry = attempts.get(req.ip) || { count: 0, until: now + 15 * 60 * 1000 };
    entry.count++; attempts.set(req.ip, entry);
    requireValue(entry.count <= authLimit, 429, 'Too many authentication attempts. Please try again in 15 minutes.'); next();
  }
  function ownEvent(req) {
    const event = db.prepare(`${eventSelect} WHERE e.id=?`).get(id(req.params.id));
    requireValue(event, 404, 'Event not found.');
    requireValue(event.organizer_id === req.user.id, 403, 'You can only manage your own events.');
    return event;
  }
  app.get('/api/health', (_req, res) => { db.prepare('SELECT 1').get(); res.json({ status: 'ok' }); });
  app.get('/api/auth/me', (req, res) => res.json({ user: req.user || null }));
  app.post('/api/auth/register', rateLimit, async (req, res) => {
    const input = credentials(req.body, true);
    requireValue(!db.prepare('SELECT id FROM users WHERE email=?').get(input.email), 409, 'An account with this email already exists.');
    const hash = await bcrypt.hash(input.password, 12);
    // The UNIQUE constraint also protects two requests that pass the initial email check.
    let result;
    try { result = db.prepare('INSERT INTO users(name,email,password_hash) VALUES (?,?,?)').run(input.name, input.email, hash); }
    catch (error) { if (String(error.message).includes('UNIQUE')) throw new HttpError(409, 'An account with this email already exists.'); throw error; }
    const user = db.prepare('SELECT * FROM users WHERE id=?').get(result.lastInsertRowid);
    login(req, res, user); res.status(201).json({ user: publicUser(user) });
  });
  app.post('/api/auth/login', rateLimit, async (req, res) => {
    const input = credentials(req.body);
    const user = db.prepare('SELECT * FROM users WHERE email=?').get(input.email);
    const valid = await bcrypt.compare(input.password, user?.password_hash || dummyHash);
    requireValue(user && valid, 401, 'Email or password is incorrect.');
    login(req, res, user); res.json({ user: publicUser(user) });
  });
  app.post('/api/auth/logout', (req, res) => {
    if (req.sessionToken) sessions.delete(req.sessionToken);
    res.clearCookie(cookieName, { httpOnly: true, sameSite: 'lax', secure: secureCookies, path: '/' }); res.json({ message: 'Logged out.' });
  });
  app.get('/api/events', (req, res) => {
    const search = String(req.query.search || '').trim().slice(0, 100);
    const category = String(req.query.category || '');
    requireValue(!category || CATEGORIES.includes(category), 400, 'Choose a valid category.');
    const clauses = [], values = [];
    if (search) { clauses.push('(e.title LIKE ? ESCAPE \'\\\' OR e.description LIKE ? ESCAPE \'\\\' OR e.venue LIKE ? ESCAPE \'\\\')'); const term = `%${search.replace(/[\\%_]/g, '\\$&')}%`; values.push(term, term, term); }
    if (category) { clauses.push('e.category=?'); values.push(category); }
    const events = db.prepare(`${eventSelect}${clauses.length ? ` WHERE ${clauses.join(' AND ')}` : ''} ORDER BY e.starts_at ASC`).all(...values);
    res.json({ events });
  });
  app.get('/api/events/:id', (req, res) => {
    const event = db.prepare(`${eventSelect} WHERE e.id=?`).get(id(req.params.id)); requireValue(event, 404, 'Event not found.');
    const registration = req.user ? db.prepare('SELECT id,status FROM registrations WHERE user_id=? AND event_id=?').get(req.user.id, event.id) : null;
    res.json({ event, registration: registration || null });
  });
  app.post('/api/events/:id/register', auth, role('STUDENT'), (req, res) => {
    const eventId = id(req.params.id);
    const registration = transaction(db, () => {
      const event = db.prepare(`${eventSelect} WHERE e.id=?`).get(eventId);
      requireValue(event, 404, 'Event not found.');
      const existing = db.prepare('SELECT * FROM registrations WHERE user_id=? AND event_id=?').get(req.user.id, eventId);
      requireValue(existing?.status !== 'CONFIRMED', 409, 'You are already registered for this event.');
      requireValue(event.status === 'OPEN' && Date.parse(event.starts_at) > Date.now(), 409, 'Registration for this event is closed.');
      requireValue(event.registration_count < event.capacity, 409, 'This event is full.');
      db.prepare(`INSERT INTO registrations(user_id,event_id,status) VALUES (?,?,'CONFIRMED')
        ON CONFLICT(user_id,event_id) DO UPDATE SET status='CONFIRMED', updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')`).run(req.user.id, eventId);
      return db.prepare('SELECT * FROM registrations WHERE user_id=? AND event_id=?').get(req.user.id, eventId);
    });
    res.status(201).json({ registration, message: 'Your seat is confirmed. See you there!' });
  });
  app.get('/api/registrations', auth, role('STUDENT'), (req, res) => {
    const registrations = db.prepare(`SELECT r.id AS registration_id,r.status AS registration_status,r.created_at AS registered_at,
      e.*, u.name AS organizer_name FROM registrations r JOIN events e ON r.event_id=e.id
      JOIN users u ON e.organizer_id=u.id WHERE r.user_id=? ORDER BY e.starts_at`).all(req.user.id);
    res.json({ registrations });
  });
  app.delete('/api/registrations/:id', auth, role('STUDENT'), (req, res) => {
    transaction(db, () => {
      const registration = db.prepare('SELECT r.*,e.starts_at FROM registrations r JOIN events e ON r.event_id=e.id WHERE r.id=? AND r.user_id=?').get(id(req.params.id), req.user.id);
      requireValue(registration, 404, 'Registration not found.');
      requireValue(registration.status === 'CONFIRMED', 409, 'This registration is already cancelled.');
      requireValue(Date.parse(registration.starts_at) > Date.now(), 409, 'Cancellation closes when the event starts.');
      db.prepare("UPDATE registrations SET status='CANCELLED', updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?").run(registration.id);
    });
    res.json({ message: 'Registration cancelled. Your seat has been released.' });
  });
  app.get('/api/organizer/events', auth, role('ORGANIZER'), (req, res) => {
    res.json({ events: db.prepare(`${eventSelect} WHERE e.organizer_id=? ORDER BY e.starts_at`).all(req.user.id) });
  });
  app.post('/api/organizer/events', auth, role('ORGANIZER'), (req, res) => {
    const e = eventInput(req.body);
    const result = db.prepare('INSERT INTO events(title,description,category,starts_at,venue,capacity,status,organizer_id) VALUES (?,?,?,?,?,?,?,?)').run(e.title,e.description,e.category,e.starts_at,e.venue,e.capacity,e.status,req.user.id);
    res.status(201).json({ event: db.prepare(`${eventSelect} WHERE e.id=?`).get(result.lastInsertRowid) });
  });
  app.put('/api/organizer/events/:id', auth, role('ORGANIZER'), (req, res) => {
    const e = eventInput(req.body);
    transaction(db, () => {
      const event = ownEvent(req);
      requireValue(e.capacity >= event.registration_count, 409, 'Capacity cannot be lower than confirmed registrations.');
      db.prepare("UPDATE events SET title=?,description=?,category=?,starts_at=?,venue=?,capacity=?,status=?,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?").run(e.title,e.description,e.category,e.starts_at,e.venue,e.capacity,e.status,event.id);
    });
    res.json({ event: db.prepare(`${eventSelect} WHERE e.id=?`).get(id(req.params.id)) });
  });
  app.delete('/api/organizer/events/:id', auth, role('ORGANIZER'), (req, res) => {
    const event = ownEvent(req); db.prepare('DELETE FROM events WHERE id=?').run(event.id); res.json({ message: 'Event and its registrations deleted.' });
  });
  app.get('/api/organizer/events/:id/attendees', auth, role('ORGANIZER'), (req, res) => {
    const event = ownEvent(req);
    const attendees = db.prepare(`SELECT u.name,u.email,r.created_at AS registered_at FROM registrations r
      JOIN users u ON r.user_id=u.id WHERE r.event_id=? AND r.status='CONFIRMED' ORDER BY r.created_at`).all(event.id);
    res.json({ event, attendees });
  });
  app.use('/api', (_req, _res, next) => next(new HttpError(404, 'API endpoint not found.')));
  const dist = resolve('dist');
  if (existsSync(dist)) {
    app.use((_req, res, next) => { res.set('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"); next(); });
    app.use(express.static(dist));
    app.get('/{*path}', (_req, res) => res.sendFile(resolve(dist, 'index.html')));
  }
  app.use((error, _req, res, _next) => {
    const status = error.status || (error.type === 'entity.parse.failed' ? 400 : 500);
    if (status >= 500) console.error('Server error:', error);
    res.status(status).json({ error: status >= 500 ? 'Something went wrong. Please try again.' : error.type === 'entity.parse.failed' ? 'Invalid JSON request.' : error.message });
  });
  return app;
}
