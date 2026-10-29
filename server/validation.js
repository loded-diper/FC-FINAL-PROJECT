export const CATEGORIES = ['Technology', 'Arts & Culture', 'Sports', 'Community'];
export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
export function requireValue(condition, status, message) { if (!condition) throw new HttpError(status, message); }
export function text(value, label, min, max) {
  requireValue(typeof value === 'string', 400, `${label} is required.`);
  const clean = value.trim();
  requireValue(clean.length >= min && clean.length <= max, 400, `${label} must be ${min}–${max} characters.`);
  return clean;
}
export function credentials(body = {}, includeName = false) {
  const email = text(body.email, 'Email', 5, 254).toLowerCase();
  requireValue(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email), 400, 'Enter a valid email address.');
  requireValue(typeof body.password === 'string' && body.password.length >= 8 && Buffer.byteLength(body.password, 'utf8') <= 72, 400, 'Password must be at least 8 characters and at most 72 UTF-8 bytes.');
  return { email, password: body.password, ...(includeName ? { name: text(body.name, 'Name', 2, 80) } : {}) };
}
export function eventInput(body = {}) {
  const title = text(body.title, 'Title', 4, 100);
  const description = text(body.description, 'Description', 20, 3000);
  const venue = text(body.venue, 'Venue', 3, 120);
  requireValue(CATEGORIES.includes(body.category), 400, 'Choose a valid category.');
  requireValue(typeof body.starts_at === 'string' && Number.isFinite(Date.parse(body.starts_at)), 400, 'Choose a valid event date and time.');
  const starts_at = new Date(body.starts_at).toISOString();
  requireValue(Date.parse(starts_at) > Date.now(), 400, 'Event date must be in the future.');
  requireValue(Number.isInteger(body.capacity) && body.capacity >= 1 && body.capacity <= 1000, 400, 'Capacity must be a whole number from 1 to 1000.');
  requireValue(['OPEN', 'CLOSED'].includes(body.status), 400, 'Choose a valid registration status.');
  return { title, description, category: body.category, starts_at, venue, capacity: body.capacity, status: body.status };
}
export function id(value) {
  requireValue(/^\d+$/.test(String(value)) && Number.isSafeInteger(Number(value)) && Number(value) > 0, 400, 'Invalid resource ID.');
  return Number(value);
}
