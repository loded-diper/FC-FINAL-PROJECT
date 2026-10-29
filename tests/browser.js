// Real Chromium walkthrough against a fresh, disposable SQLite database.
import { chromium, expect } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { openDatabase } from '../server/db.js';
import { seedDatabase, DEMO_PASSWORD } from '../server/seed.js';
import assert from 'node:assert/strict';

const temp = mkdtempSync(join(tmpdir(), 'campusconnect-browser-'));
const filename = join(temp, 'browser.sqlite');
const db = openDatabase(filename); seedDatabase(db); db.close();
const port = 3101, base = `http://127.0.0.1:${port}`;
const logs = [], browserErrors = [], steps = [];
const server = spawn(process.execPath, ['server/index.js'], { env: { ...process.env, PORT: String(port), DATABASE_PATH:filename }, stdio: ['ignore','pipe','pipe'] });
server.stdout.on('data',chunk => logs.push(chunk.toString())); server.stderr.on('data',chunk => logs.push(chunk.toString()));
let browser;
async function step(name, action) { await action(); steps.push(name); console.log(`PASS ${name}`); }
async function screenshot(page, name) { await page.screenshot({ path:resolve('docs/screenshots', `${name}.png`), animations:'disabled', fullPage:name === '06-event-management' }); }
try {
  let ready = false;
  for (let n=0;n<80;n++) {
    if (server.exitCode !== null) throw new Error(`Server failed: ${logs.join('')}`);
    try { if ((await fetch(`${base}/api/health`)).ok) { ready=true; break; } } catch { /* Server starting. */ }
    await new Promise(resolve => setTimeout(resolve,100));
  }
  assert.ok(ready, 'Browser test server started');
  browser = await chromium.launch({ executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless:true });
  const context = await browser.newContext({ viewport:{ width:1280,height:1200 }, timezoneId:'Asia/Kolkata' });
  const page = await context.newPage();
  page.on('pageerror',error => browserErrors.push(error.message));
  page.on('console',message => { if (message.type()==='error' && !/Failed to load resource: the server responded with a status of 401/.test(message.text())) browserErrors.push(message.text()); });
  page.on('response',response => { if (response.status()>=500) browserErrors.push(`${response.status()} ${response.url()}`); });
  mkdirSync('docs/screenshots',{ recursive:true });
  await step('Discovery loads six database events and screenshot', async () => {
    await page.goto(base); await expect(page.locator('.event-card')).toHaveCount(6); await screenshot(page,'01-discovery'); await page.setViewportSize({width:1280,height:900}); await page.locator('#events').screenshot({path:resolve('docs/screenshots/01b-events.png'),animations:'disabled'});
  });
  await step('Search, categories and empty state work', async () => {
    await page.getByRole('button',{ name:'Sports',exact:true }).click(); await expect(page.locator('.event-card')).toHaveCount(1);
    await page.getByRole('button',{ name:'All events',exact:true }).click();
    await page.getByRole('searchbox',{name:'Search events'}).fill('unplugged'); await expect(page.locator('.event-card')).toHaveCount(1);
    await page.getByRole('searchbox').fill('nothing-exists-here'); await expect(page.getByRole('heading',{name:'No events match this one.'})).toBeVisible();
    await page.getByRole('button',{name:'Clear filters'}).click(); await expect(page.locator('.event-card')).toHaveCount(6);
  });
  await step('New student registers and logs out', async () => {
    await page.getByRole('link',{name:/Join the campus/}).click();
    await page.getByLabel('Full name',{exact:true}).fill('Demo Learner'); await page.getByLabel('Email address').fill('learner@campus.demo'); await page.getByLabel('Password',{exact:true}).fill(DEMO_PASSWORD);
    await page.getByRole('button',{name:'Create my account'}).click(); await expect(page.getByRole('heading',{name:'My registrations'})).toBeVisible();
    await page.getByRole('button',{name:'Log out'}).click(); await expect(page.getByRole('link',{name:'Log in',exact:true})).toBeVisible();
  });
  await step('Wrong password is rejected and student logs in', async () => {
    await page.getByRole('link',{name:'Log in',exact:true}).click(); await page.getByLabel('Email address').fill('student@campus.demo'); await page.getByLabel('Password',{exact:true}).fill('IncorrectPassword');
    await page.getByRole('button',{name:'Log in',exact:true}).click(); await expect(page.getByRole('alert')).toContainText('incorrect');
    await page.getByLabel('Password',{exact:true}).fill(DEMO_PASSWORD); await page.getByRole('button',{name:'Log in',exact:true}).click(); await expect(page.getByRole('heading',{name:'My registrations'})).toBeVisible();
  });
  await step('Student books an event and sees availability and confirmation', async () => {
    await page.getByRole('link',{name:'Discover events',exact:true}).click();
    await page.getByRole('heading',{name:'Build something that matters'}).getByRole('link').click();
    await page.getByRole('button',{name:'Register for event'}).click(); await expect(page.getByText('You’re on the list!')).toBeVisible(); await expect(page.getByText('31 seats left',{exact:true})).toBeVisible(); await screenshot(page,'02-event-registration');
  });
  await step('Student dashboard persists booking and cancellation', async () => {
    await page.getByRole('link',{name:'My registrations',exact:true}).click(); await expect(page.locator('.registration-card')).toHaveCount(1); await screenshot(page,'03-student-dashboard');
    page.once('dialog',dialog => dialog.accept()); await page.getByRole('button',{name:'Cancel registration'}).click(); await expect(page.locator('.registration-card')).toContainText('Cancelled');
    await page.reload(); await expect(page.locator('.registration-card')).toContainText('Cancelled');
    // Restore a booking for the organizer attendee walkthrough.
    await page.getByRole('link',{name:'View event',exact:true}).click(); await page.getByRole('button',{name:'Register for event'}).click(); await expect(page.getByText('You’re on the list!')).toBeVisible();
  });
  await step('Student cannot open organizer pages', async () => {
    await page.goto(`${base}/organizer`); await expect(page.getByRole('alert')).toContainText('Organizer access required.');
  });
  await step('Organizer dashboard and private attendee list work', async () => {
    await page.getByRole('button',{name:'Log out'}).click(); await page.getByRole('link',{name:'Log in',exact:true}).click();
    await page.getByLabel('Email address').fill('organizer@campus.demo'); await page.getByLabel('Password',{exact:true}).fill(DEMO_PASSWORD); await page.getByRole('button',{name:'Log in',exact:true}).click();
    await expect(page.getByRole('heading',{name:'Organizer studio',exact:true})).toBeVisible(); await expect(page.locator('tbody tr')).toHaveCount(6); await screenshot(page,'04-organizer-studio');
    await page.locator('tbody tr').filter({hasText:'Build something that matters'}).getByRole('link',{name:'Attendees'}).click();
    await expect(page.locator('tbody')).toContainText('student@campus.demo'); await screenshot(page,'05-attendees');
  });
  await step('Organizer creates, edits, closes and deletes an event', async () => {
    await page.getByRole('link',{name:'Back to organizer studio',exact:false}).click(); await page.getByRole('link',{name:'Create event',exact:true}).click();
    await page.getByLabel('Event title').fill('Browser demo gathering'); await page.getByLabel('About the event').fill('A fictional gathering created during the automated browser walkthrough.');
    await page.getByLabel('Date & time').fill('2099-06-15T17:30'); await page.getByLabel('Venue',{exact:true}).fill('Demo Auditorium'); await page.getByLabel('Capacity').fill('12'); await screenshot(page,'06-event-management');
    await page.getByRole('button',{name:'Publish event'}).click(); await expect(page.locator('tbody tr')).toHaveCount(7);
    await page.getByRole('link',{name:'Edit Browser demo gathering'}).click(); await page.getByLabel('Event title').fill('Updated demo gathering'); await page.getByLabel('Registration status').selectOption('CLOSED'); await page.getByRole('button',{name:'Save changes'}).click();
    await expect(page.locator('tbody tr').filter({hasText:'Updated demo gathering'})).toContainText('Closed');
    page.once('dialog',dialog => dialog.accept()); await page.getByRole('button',{name:'Delete Updated demo gathering'}).click(); await expect(page.locator('tbody tr')).toHaveCount(6);
  });
  await step('Mobile discovery fits 390px and custom 404 renders', async () => {
    await page.setViewportSize({width:390,height:844}); await page.goto(base); await expect(page.locator('.event-card')).toHaveCount(6);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'No horizontal overflow'); await screenshot(page,'07-mobile');
    await page.goto(`${base}/not-a-page`); await expect(page.getByRole('heading',{name:'This page took a detour.'})).toBeVisible();
  });
  assert.deepEqual(browserErrors,[], 'No unexpected browser console errors or failed server responses');
  assert.ok(!logs.join('').includes('Server error:'), 'No server exceptions during walkthrough');
  console.log(`Browser walkthrough: ${steps.length} steps passed; no unexpected browser errors or server exceptions.`);
} finally {
  if (browser) await browser.close();
  server.kill('SIGTERM'); await new Promise(resolve => { if(server.exitCode!==null) resolve(); else server.once('exit',resolve); });
  rmSync(temp,{ recursive:true,force:true });
}
