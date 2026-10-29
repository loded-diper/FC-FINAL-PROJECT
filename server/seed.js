import bcrypt from 'bcrypt';
import { existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { openDatabase, transaction } from './db.js';

export const DEMO_PASSWORD = 'CampusDemo!24';
export function seedDatabase(db) {
  // Only explicit development fixtures use this public password. Never seed a production database.
  const hash = bcrypt.hashSync(DEMO_PASSWORD, 12);
  transaction(db, () => {
    for (const [name, email, role] of [
      ['Demo Student', 'student@campus.demo', 'STUDENT'],
      ['Campus Activities Team', 'organizer@campus.demo', 'ORGANIZER'],
    ]) db.prepare('INSERT OR IGNORE INTO users(name,email,password_hash,role) VALUES (?,?,?,?)').run(name, email, hash, role);
    const organizer = db.prepare('SELECT id FROM users WHERE email = ?').get('organizer@campus.demo');
    // Existing events are never overwritten. Re-running does not duplicate fixtures.
    const events = [
      ['Build something that matters', 'Technology', 3, 'Innovation Lab · Block 5', 32, 'A hands-on web workshop for curious builders. Form a small team, turn a campus problem into a prototype, and share what you made. Bring a laptop; beginners are welcome.'],
      ['An evening, unplugged', 'Arts & Culture', 5, 'Student Plaza', 60, 'A relaxed open-mic evening of music, poetry, and stories under the lights. Come to perform or simply find your next favourite campus artist. No experience required.'],
      ['The weekend court club', 'Sports', 7, 'Indoor Sports Complex', 24, 'Meet your next doubles partner at our friendly badminton social. We will rotate teams and keep the games welcoming for every skill level. Bring indoor shoes and a water bottle.'],
      ['Small acts. Big campus.', 'Community', 9, 'Student Activity Centre', 40, 'Join fellow students for a campus clean-up and a practical conversation about everyday sustainability. Gloves and materials are provided. Meet new people while making a visible difference.'],
      ['Design beyond the screen', 'Arts & Culture', 12, 'Creative Studio · Block 3', 28, 'Explore accessible design through a playful poster-making session. Learn simple principles of hierarchy, contrast, and storytelling, then create a poster for a campus cause. Materials included.'],
      ['Ideas over coffee', 'Technology', 14, 'Library Collaboration Room', 20, 'An informal meetup for students interested in technology. Share a project, ask a question, or find someone to build with. Short demos, thoughtful feedback, and plenty of conversation.'],
    ];
    for (const [title, category, days, venue, capacity, description] of events) {
      if (db.prepare('SELECT id FROM events WHERE title = ? AND organizer_id = ?').get(title, organizer.id)) continue;
      const starts = new Date(); starts.setUTCDate(starts.getUTCDate() + days); starts.setUTCHours(12, 0, 0, 0);
      db.prepare('INSERT INTO events(title,description,category,starts_at,venue,capacity,organizer_id) VALUES (?,?,?,?,?,?,?)').run(title, description, category, starts.toISOString(), venue, capacity, organizer.id);
    }
  });
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (existsSync('.env')) process.loadEnvFile('.env');
  const db = openDatabase(); seedDatabase(db); db.close();
  console.log('Development fixtures ready (six fictional events; see README for demo accounts).');
}
