export async function api(path, options = {}) {
  const response = await fetch(`/api${path}`, {
    credentials: 'same-origin',
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...(options.body ? { body: JSON.stringify(options.body) } : {}),
  });
  const data = await response.json();
  if (!response.ok) { const error = new Error(data.error || 'The request could not be completed.'); error.status = response.status; throw error; }
  return data;
}
export const categories = ['Technology', 'Arts & Culture', 'Sports', 'Community'];
export const formatDate = value => new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
export const formatTime = value => new Date(value).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
export function availability(event) {
  if (new Date(event.starts_at) <= new Date()) return 'Event ended';
  if (event.status === 'CLOSED') return 'Registration closed';
  if (event.registration_count >= event.capacity) return 'Fully booked';
  return `${event.capacity - event.registration_count} seats left`;
}
