const form = document.querySelector('#appointmentForm');
const list = document.querySelector('#appointments');
const message = document.querySelector('#formMessage');
const format = value => new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
async function loadAppointments() {
  list.innerHTML = '<div class="loading">Loading appointments...</div>';
  try { const rows = await fetch('/api/appointments').then(r => r.json());
    if (!rows.length) { list.innerHTML = '<div class="empty">No appointments yet.</div>'; return; }
    list.innerHTML = rows.map(a => `<article class="appointment"><span class="status ${a.status}">${a.status}</span><h4>${escapeHtml(a.customer_name)}</h4><p><strong>${format(a.appointment_at)}</strong></p><p>${escapeHtml(a.vehicle)} · ${escapeHtml(a.service)}</p><p>${escapeHtml(a.email)}${a.phone ? ` · ${escapeHtml(a.phone)}` : ''}</p></article>`).join('');
  } catch { list.innerHTML = '<div class="error">Could not load appointments.</div>'; }
}
function escapeHtml(v='') { return v.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
form.addEventListener('submit', async e => { e.preventDefault(); message.className=''; message.textContent='Saving...'; const data = Object.fromEntries(new FormData(form));
  try { const response = await fetch('/api/appointments', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data) }); const result = await response.json(); if (!response.ok) throw new Error(result.error);
    message.className='success'; message.textContent='Appointment saved. The customer confirmation email was sent.'; form.reset(); loadAppointments();
  } catch (err) { message.className='error'; message.textContent=err.message || 'Unable to save appointment.'; }
});
document.querySelector('#refresh').addEventListener('click', loadAppointments);
let installPrompt; window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installPrompt=e; document.querySelector('#installBtn').classList.remove('hidden'); });
document.querySelector('#installBtn').addEventListener('click', async () => { if (installPrompt) { installPrompt.prompt(); installPrompt=null; } });
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js');
loadAppointments();
