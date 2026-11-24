import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import nodemailer from 'nodemailer';
import Database from 'better-sqlite3';
import { v4 as uuid } from 'uuid';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port = Number(process.env.PORT || 3000);
const baseUrl = (process.env.APP_BASE_URL || `http://localhost:${port}`).replace(/\/$/, '');
const business = process.env.BUSINESS_NAME || 'RMB Garage';
const timeZone = process.env.TIME_ZONE || 'America/Chicago';
const db = new Database('appointments.db');
db.pragma('journal_mode = WAL');
db.exec(`CREATE TABLE IF NOT EXISTS appointments (
  id TEXT PRIMARY KEY, customer_name TEXT NOT NULL, email TEXT NOT NULL, phone TEXT,
  vehicle TEXT NOT NULL, service TEXT NOT NULL, appointment_at TEXT NOT NULL,
  notes TEXT, status TEXT NOT NULL DEFAULT 'pending', created_at TEXT NOT NULL,
  reminder48_sent INTEGER NOT NULL DEFAULT 0, reminder2_sent INTEGER NOT NULL DEFAULT 0
)`);

const transporter = process.env.SMTP_HOST ? nodemailer.createTransport({
  host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 587),
  secure: process.env.SMTP_SECURE === 'true', auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined
}) : null;
const mailFrom = process.env.MAIL_FROM || `${business} <appointments@example.com>`;
const esc = (value = '') => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const formatDate = value => new Intl.DateTimeFormat('en-US', { dateStyle: 'full', timeStyle: 'short', timeZone }).format(new Date(value));

async function sendMail(to, subject, html) {
  if (!transporter) { console.log(`\n--- Email preview to ${to}\nSubject: ${subject}\n${html}\n---\n`); return; }
  await transporter.sendMail({ from: mailFrom, to, subject, html });
}
function emailBody(a, kind = 'created') {
  const confirm = `${baseUrl}/api/appointments/${a.id}/respond?status=confirmed`;
  const decline = `${baseUrl}/api/appointments/${a.id}/respond?status=declined`;
  const heading = kind === 'created' ? 'Appointment request received' : `${kind === '48-hour' ? '48-hour' : '2-hour'} appointment reminder`;
  return `<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;color:#17324d"><h1 style="color:#176b87">${esc(business)}</h1><h2>${heading}</h2><p>Hello ${esc(a.customer_name)},</p><p>Your appointment is scheduled for <strong>${esc(formatDate(a.appointment_at))}</strong>.</p><p><strong>Vehicle:</strong> ${esc(a.vehicle)}<br><strong>Service:</strong> ${esc(a.service)}${a.notes ? `<br><strong>Notes:</strong> ${esc(a.notes)}` : ''}</p><p>Please choose an option:</p><p><a href="${confirm}" style="background:#2f9e63;color:white;padding:13px 20px;text-decoration:none;border-radius:7px">Confirm appointment</a> &nbsp; <a href="${decline}" style="background:#d94b4b;color:white;padding:13px 20px;text-decoration:none;border-radius:7px">Decline appointment</a></p><p>If you did not request this appointment, you can ignore this message.</p></div>`;
}

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/appointments', (req, res) => {
  const rows = db.prepare('SELECT * FROM appointments ORDER BY appointment_at ASC').all();
  res.json(rows);
});
app.post('/api/appointments', async (req, res) => {
  const { customerName, email, phone, vehicle, service, appointmentAt, notes } = req.body;
  if (!customerName || !email || !vehicle || !service || !appointmentAt || Number.isNaN(new Date(appointmentAt).getTime())) return res.status(400).json({ error: 'Please complete all required fields.' });
  const id = uuid();
  const appointment = { id, customer_name: customerName.trim(), email: email.trim(), phone: phone?.trim() || '', vehicle: vehicle.trim(), service: service.trim(), appointment_at: new Date(appointmentAt).toISOString(), notes: notes?.trim() || '', status: 'pending', created_at: new Date().toISOString() };
  db.prepare(`INSERT INTO appointments (id,customer_name,email,phone,vehicle,service,appointment_at,notes,status,created_at) VALUES (@id,@customer_name,@email,@phone,@vehicle,@service,@appointment_at,@notes,@status,@created_at)`).run(appointment);
  try { await sendMail(appointment.email, `${business}: appointment request`, emailBody(appointment)); } catch (e) { console.error('Email error:', e.message); }
  res.status(201).json(appointment);
});
app.get('/api/appointments/:id/respond', (req, res) => {
  const status = ['confirmed', 'declined'].includes(req.query.status) ? req.query.status : null;
  if (!status) return res.status(400).send('Invalid response.');
  const result = db.prepare('UPDATE appointments SET status = ? WHERE id = ?').run(status, req.params.id);
  if (!result.changes) return res.status(404).send('Appointment not found.');
  res.send(`<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font-family:Arial;text-align:center;padding:15vh 20px;color:#17324d}h1{color:${status === 'confirmed' ? '#2f9e63' : '#d94b4b'}}</style></head><body><h1>Appointment ${status}</h1><p>Thank you. ${business} has recorded your response.</p></body></html>`);
});

async function sendDueReminders() {
  const now = Date.now();
  const appointments = db.prepare("SELECT * FROM appointments WHERE status != 'declined' AND appointment_at > datetime('now')").all();
  for (const a of appointments) {
    const hours = (new Date(a.appointment_at).getTime() - now) / 3600000;
    const kind = hours <= 48 && hours > 2 && !a.reminder48_sent ? '48-hour' : hours <= 2 && hours > 0 && !a.reminder2_sent ? '2-hour' : null;
    if (!kind) continue;
    try { await sendMail(a.email, `${business}: ${kind} reminder`, emailBody(a, kind)); db.prepare(`UPDATE appointments SET reminder${kind === '48-hour' ? '48' : '2'}_sent = 1 WHERE id = ?`).run(a.id); } catch (e) { console.error('Reminder error:', e.message); }
  }
}
setInterval(sendDueReminders, 60 * 1000);
sendDueReminders();
app.listen(port, () => console.log(`${business} scheduler running at ${baseUrl} (${timeZone})`));
