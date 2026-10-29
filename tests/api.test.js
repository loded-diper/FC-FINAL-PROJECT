import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import bcrypt from 'bcrypt';
import { openDatabase } from '../server/db.js';
import { createApp } from '../server/app.js';
import { seedDatabase, DEMO_PASSWORD } from '../server/seed.js';

const dir = mkdtempSync(join(tmpdir(), 'campusconnect-api-'));
const filename = join(dir, 'test.sqlite');
let db, server, base, student, organizer, second, outsider, eventId, registrationId;
const payload = overrides => ({ title: 'Integration workshop', description: 'A fictional event used for focused integration testing.', category: 'Technology', starts_at: new Date(Date.now() + 86400000 * 30).toISOString(), venue: 'Test Hall', capacity: 2, status: 'OPEN', ...overrides });
function agent() {
  let cookie = '';
  return { async request(path, method = 'GET', body, headers = {}) {
    const response = await fetch(`${base}/api${path}`, { method, headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}), ...headers }, ...(body !== undefined ? { body: typeof body === 'string' ? body : JSON.stringify(body) } : {}) });
    if (response.headers.get('set-cookie')) cookie = response.headers.get('set-cookie').split(';')[0];
    return { status: response.status, body: await response.json(), headers: response.headers };
  } };
}
before(async () => {
  db = openDatabase(filename); seedDatabase(db);
  const hash = bcrypt.hashSync(DEMO_PASSWORD, 12);
  db.prepare('INSERT INTO users(name,email,password_hash,role) VALUES (?,?,?,?)').run('Other Organizer','other@campus.demo',hash,'ORGANIZER');
  server = createApp(db, { authLimit: 1000 }).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve)); base = `http://127.0.0.1:${server.address().port}`;
  student = agent(); organizer = agent(); second = agent(); outsider = agent();
});
after(async () => { await new Promise(resolve => server.close(resolve)); db.close(); rmSync(dir, { recursive: true, force: true }); });

describe('CampusConnect REST integration', () => {
  test('database migration and seed are repeatable without resetting existing data', () => {
    seedDatabase(db); const reopened = openDatabase(filename);
    assert.equal(reopened.prepare('SELECT COUNT(*) AS n FROM events').get().n, 6);
    assert.equal(reopened.prepare('PRAGMA user_version').get().user_version, 1); reopened.close();
  });
  test('health check exercises the database and unknown API paths return JSON 404', async () => {
    assert.equal((await agent().request('/health')).body.status, 'ok');
    assert.equal((await agent().request('/missing')).status, 404);
  });
  test('new student signs up with a hashed password, safe cookie, and no elevated role', async () => {
    const result = await student.request('/auth/register', 'POST', { name: 'Test Learner', email: 'learner@campus.demo', password: DEMO_PASSWORD, role: 'ORGANIZER' });
    assert.equal(result.status, 201); assert.equal(result.body.user.role, 'STUDENT'); assert.equal(result.body.user.password_hash, undefined);
    const stored = db.prepare('SELECT password_hash FROM users WHERE email=?').get('learner@campus.demo').password_hash;
    assert.notEqual(stored, DEMO_PASSWORD); assert.ok(bcrypt.compareSync(DEMO_PASSWORD, stored));
    const cookie = result.headers.get('set-cookie'); assert.match(cookie, /HttpOnly/); assert.match(cookie, /SameSite=Lax/);
    assert.equal((await student.request('/auth/me')).body.user.email, 'learner@campus.demo');
  });
  test('duplicate emails are case-insensitive and invalid input is rejected', async () => {
    assert.equal((await agent().request('/auth/register', 'POST', { name:'Other', email:'LEARNER@campus.demo', password:DEMO_PASSWORD })).status, 409);
    assert.equal((await agent().request('/auth/register', 'POST', { name:'A', email:'wrong', password:'short' })).status, 400);
    assert.equal((await agent().request('/auth/register', 'POST', { name:'Name', email:'utf8@campus.demo', password:'😀'.repeat(30) })).status, 400);
  });
  test('login rejects wrong passwords and unknown accounts, then accepts the real password', async () => {
    assert.equal((await student.request('/auth/login', 'POST', { email:'learner@campus.demo', password:'WrongPassword' })).status, 401);
    assert.equal((await agent().request('/auth/login', 'POST', { email:'nobody@campus.demo', password:'WrongPassword' })).status, 401);
    assert.equal((await student.request('/auth/login', 'POST', { email:'learner@campus.demo', password:DEMO_PASSWORD })).status, 200);
    await second.request('/auth/register', 'POST', { name:'Second Student', email:'second@campus.demo', password:DEMO_PASSWORD });
    await organizer.request('/auth/login', 'POST', { email:'organizer@campus.demo', password:DEMO_PASSWORD });
    await outsider.request('/auth/login', 'POST', { email:'other@campus.demo', password:DEMO_PASSWORD });
  });
  test('events come from SQLite, support search and category filters, and sort by date', async () => {
    const all = (await student.request('/events')).body.events; assert.equal(all.length, 6);
    assert.deepEqual(all.map(e => e.starts_at), [...all.map(e => e.starts_at)].sort());
    const tech = (await student.request('/events?category=Technology')).body.events; assert.equal(tech.length, 2);
    assert.ok(tech.every(e => e.category === 'Technology'));
    assert.equal((await student.request('/events?search=unplugged')).body.events.length, 1);
    assert.equal((await student.request('/events?search=%25')).body.events.length, 0);
    assert.equal((await student.request('/events?search=NoSuchEvent')).body.events.length, 0);
    assert.equal((await student.request('/events?category=Unknown')).status, 400);
  });
  test('unauthenticated requests and students cannot use organizer endpoints', async () => {
    assert.equal((await agent().request('/organizer/events')).status, 401);
    assert.equal((await student.request('/organizer/events')).status, 403);
    assert.equal((await student.request('/organizer/events', 'POST', payload())).status, 403);
    assert.equal((await agent().request('/registrations')).status, 401);
  });
  test('organizer creates a valid event and validates capacity, dates, fields and status', async () => {
    for (const input of [payload({ capacity:0 }),payload({ capacity:1.5 }),payload({ starts_at:'2020-01-01' }),payload({ starts_at:'bad' }),payload({ category:'Unknown' }),payload({ status:'OTHER' }),payload({ title:'x' })]) {
      assert.equal((await organizer.request('/organizer/events','POST',input)).status,400);
    }
    const created = await organizer.request('/organizer/events','POST',payload());
    assert.equal(created.status,201); eventId = created.body.event.id;
    assert.equal((await organizer.request('/organizer/events')).body.events.length,7);
    assert.equal((await outsider.request('/organizer/events')).body.events.length,0);
  });
  test('another organizer cannot edit, delete, or read attendee data for an unowned event', async () => {
    assert.equal((await outsider.request(`/organizer/events/${eventId}`, 'PUT', payload())).status, 403);
    assert.equal((await outsider.request(`/organizer/events/${eventId}`, 'DELETE')).status, 403);
    assert.equal((await outsider.request(`/organizer/events/${eventId}/attendees`)).status, 403);
    assert.equal((await student.request(`/organizer/events/${eventId}/attendees`)).status, 403);
  });
  test('available event registration is persisted and duplicate registration is rejected', async () => {
    assert.equal((await agent().request(`/events/${eventId}/register`,'POST',{})).status,401);
    assert.equal((await organizer.request(`/events/${eventId}/register`,'POST',{})).status,403);
    const result = await student.request(`/events/${eventId}/register`,'POST',{});
    assert.equal(result.status,201); registrationId = result.body.registration.id;
    assert.equal(result.body.registration.status,'CONFIRMED');
    assert.equal((await student.request(`/events/${eventId}/register`,'POST',{})).status,409);
    assert.equal((await student.request(`/events/${eventId}`)).body.event.registration_count,1);
    assert.equal((await student.request(`/events/${eventId}`)).body.registration.status,'CONFIRMED');
  });
  test('a student only sees their own registrations and cannot cancel someone else’s', async () => {
    assert.equal((await student.request('/registrations')).body.registrations.length,1);
    assert.equal((await second.request('/registrations')).body.registrations.length,0);
    assert.equal((await second.request(`/registrations/${registrationId}`,'DELETE')).status,404);
    assert.equal((await agent().request(`/registrations/${registrationId}`,'DELETE')).status,401);
  });
  test('organizer sees confirmed attendee information for their event', async () => {
    const result = await organizer.request(`/organizer/events/${eventId}/attendees`);
    assert.equal(result.status,200); assert.equal(result.body.attendees.length,1);
    assert.equal(result.body.attendees[0].email,'learner@campus.demo');
    assert.equal(result.body.attendees[0].password_hash,undefined);
  });
  test('capacity cannot drop below bookings; organizer can update owned event', async () => {
    assert.equal((await organizer.request(`/organizer/events/${eventId}`,'PUT',payload({ capacity:1, title:'Updated workshop' }))).status,200);
    assert.equal((await second.request(`/events/${eventId}/register`,'POST',{})).status,409);
    // A second seat allows us to test an otherwise valid capacity reduction below the actual bookings.
    await organizer.request(`/organizer/events/${eventId}`,'PUT',payload({ capacity:2 }));
    await second.request(`/events/${eventId}/register`,'POST',{});
    assert.equal((await organizer.request(`/organizer/events/${eventId}`,'PUT',payload({ capacity:1 }))).status,409);
  });
  test('cancellation releases a seat, persists its status, and removes the attendee', async () => {
    assert.equal((await student.request(`/registrations/${registrationId}`,'DELETE')).status,200);
    assert.equal((await student.request('/registrations')).body.registrations[0].registration_status,'CANCELLED');
    assert.equal((await organizer.request(`/organizer/events/${eventId}/attendees`)).body.attendees.length,1);
    assert.equal((await student.request(`/registrations/${registrationId}`,'DELETE')).status,409);
    assert.equal((await student.request(`/events/${eventId}/register`,'POST',{})).status,201);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM registrations WHERE user_id=(SELECT id FROM users WHERE email=?) AND event_id=?').get('learner@campus.demo',eventId).n,1);
  });
  test('closed and past events reject registrations; past registrations cannot be cancelled', async () => {
    const closed = await organizer.request('/organizer/events','POST',payload({ title:'Closed event',status:'CLOSED' }));
    assert.equal((await student.request(`/events/${closed.body.event.id}/register`,'POST',{})).status,409);
    db.prepare('UPDATE events SET starts_at=? WHERE id=?').run('2020-01-01T10:00:00.000Z',eventId);
    assert.equal((await student.request(`/registrations/${registrationId}`,'DELETE')).status,409);
    const third = agent(); await third.request('/auth/register','POST',{ name:'Third Student',email:'third@campus.demo',password:DEMO_PASSWORD });
    assert.equal((await third.request(`/events/${eventId}/register`,'POST',{})).status,409);
  });
  test('simultaneous attempts cannot overbook the last seat', async () => {
    const created = await organizer.request('/organizer/events','POST',payload({ title:'Last seat race',capacity:1 }));
    const raceId = created.body.event.id;
    const results = await Promise.all([student,second].map(a => a.request(`/events/${raceId}/register`,'POST',{})));
    assert.deepEqual(results.map(r => r.status).sort(),[201,409]);
    assert.equal((await organizer.request(`/organizer/events/${raceId}/attendees`)).body.attendees.length,1);
  });
  test('malformed IDs, nonexistent resources, invalid JSON, and cross-site writes are rejected', async () => {
    assert.equal((await student.request('/events/nope')).status,400);
    assert.equal((await student.request('/events/999999')).status,404);
    assert.equal((await student.request('/events/999999/register','POST',{})).status,404);
    assert.equal((await student.request('/auth/login','POST','{broken')).status,400);
    assert.equal((await student.request('/auth/login','POST',{})).status,400);
    assert.equal((await student.request('/auth/login','POST',{}, { Origin:'https://evil.example' })).status,403);
    const response = await fetch(`${base}/api/auth/login`,{ method:'POST',body:'email=x' }); assert.equal(response.status,415);
  });
  test('event deletion cascades registrations and only its owner can perform it', async () => {
    assert.equal((await student.request(`/organizer/events/${eventId}`,'DELETE')).status,403);
    assert.equal((await organizer.request(`/organizer/events/${eventId}`,'DELETE')).status,200);
    assert.equal((await student.request(`/events/${eventId}`)).status,404);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM registrations WHERE event_id=?').get(eventId).n,0);
  });
  test('data survives reopening SQLite; logout invalidates the session', async () => {
    const check = openDatabase(filename);
    assert.ok(check.prepare('SELECT id FROM users WHERE email=?').get('learner@campus.demo')); check.close();
    assert.equal((await student.request('/auth/logout','POST',{})).status,200);
    assert.equal((await student.request('/registrations')).status,401);
    assert.equal((await student.request('/auth/me')).body.user,null);
  });
  test('authentication attempts are rate-limited', async () => {
    const limitedServer = createApp(db,{ authLimit:1 }).listen(0,'127.0.0.1');
    await new Promise(resolve => limitedServer.once('listening',resolve));
    try {
      const url = `http://127.0.0.1:${limitedServer.address().port}/api/auth/login`;
      const options = { method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'none@campus.demo',password:'WrongPassword'}) };
      assert.equal((await fetch(url,options)).status,401);
      assert.equal((await fetch(url,options)).status,429);
    } finally { await new Promise(resolve => limitedServer.close(resolve)); }
  });
});
