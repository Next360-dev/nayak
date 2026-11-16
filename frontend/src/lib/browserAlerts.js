// "Show alerts on this device while the app is open": uses the browser's own notification permission.
const KEY = 'ai_office_browser_alerts';

export const supported = () => typeof window !== 'undefined' && 'Notification' in window;
export const permission = () => (supported() ? Notification.permission : 'unsupported');
export function enabled() {
  try { return supported() && Notification.permission === 'granted' && localStorage.getItem(KEY) === '1'; } catch { return false; }
}
export async function turnOn() {
  if (!supported()) return 'unsupported';
  const p = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
  try { if (p === 'granted') localStorage.setItem(KEY, '1'); } catch { /* storage blocked */ }
  return p;
}
export function turnOff() { try { localStorage.removeItem(KEY); } catch { /* storage blocked */ } }
export function notify(title, body) {
  if (!enabled()) return;
  try { new Notification(title, { body, tag: 'ai-office-unread' }); } catch { /* some browsers block constructors */ }
}
