# CampusConnect classroom demonstration

Use the fictional seed accounts in README. Run `npm ci`, `npm run db:init`, `npm run db:seed`, `npm run build`, and `npm start` before class. Check `/api/health`. Open port 3001. Do not delete your demo database during the presentation.

Names, registrations, programme, guide and signatures must be completed in the report before submission. This allocation describes who presents and takes responsibility for understanding the modules; it does not invent individual implementation history. The initial implementation was generated with Codex assistance.

## Student 1 — [STUDENT 1 NAME], [STUDENT 1 REGISTRATION NUMBER]

**Module 1: Authentication and Student Dashboard (features 1 and 4).**

1. Create a student account with fictional details, or log in as `student@campus.demo`. Show a useful error for an incorrect password, then log in correctly. Explain the server's bcrypt comparison and HttpOnly session cookie; passwords are never returned to the UI.
2. Open My registrations. After making the booking in Module 2, show the confirmed event, reload to show database persistence, and cancel it. The badge changes to Cancelled, the seat is released, and the history remains.
3. Explain that `/api/registrations` scopes by the authenticated user, and cancellation scopes by both registration ID and user ID. The server rejects cancellation after the event starts.

**Module 2: Discovery and Registration (features 2 and 3).**

1. Search for `unplugged`, clear the search, and choose Sports. Show a search with no results and clear the filters.
2. Open Build something that matters. Show its date, venue, organizer, capacity, and description. Register; expect the confirmation and one fewer available seat.
3. Reload the details page. The confirmed state persists and offers My registrations instead of a second booking button. Explain that the API separately rejects duplicate, full, closed, and past-event attempts, even if a client bypasses the button.
4. After cancellation, optionally register again to leave an attendee for Student 2.

## Student 2 — [STUDENT 2 NAME], [STUDENT 2 REGISTRATION NUMBER]

Log out and sign in as `organizer@campus.demo`.

**Module 1: Organizer Event Management (feature 5).**

1. Open Organizer studio and create `Demo campus meetup` with a future date, venue, descriptive text, and capacity 10. Expect it in the studio and public discovery list.
2. Edit its venue or capacity, save, and show the persisted change. Close registration and explain that existing bookings remain.
3. Delete only this disposable event. Read the confirmation explaining that its registrations will be deleted too. Existing seed events remain available.
4. Explain the backend's role check, organizer ID ownership check, and capacity validation. A student cannot gain organizer access by editing browser state or supplying a signup role.

**Module 2: Organizer Dashboard and Attendees (feature 6).**

1. Show event totals, confirmed registrations, and upcoming open-event count. Explain these are derived from the organizer's database results.
2. Open Attendees for the event booked by Student 1. Expect the fictional student's name and email, confirmation, and registration date.
3. Explain that another organizer cannot access this event's attendee endpoint. Cancelling the booking removes it from this confirmed-only list.

## Shared explanation (about one minute)

- Trace React form → JSON request → Express validation/session/role check → parameterized SQLite write → JSON response → updated interface.
- Show the users, events and registrations diagram in README. Explain `UNIQUE(user_id,event_id)` and the `BEGIN IMMEDIATE` capacity transaction.
- Mention that the database persists but in-memory sessions end on server restart.
- Open the report and genuine screenshots. Accurately describe student review/adaptation and Codex assistance. Do not claim an unrun production deployment or security certification.
