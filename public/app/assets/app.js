/* ==========================================================================
   OCTA DEVS CRM — shared front-end runtime for the static /app pages.
   No framework, no build step: one ES module every page imports.
   ========================================================================== */

/* ---------- tiny helpers ---------- */

export const esc = (s) => String(s ?? '')
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;').replaceAll("'", '&#39;');

export const initials = (name) => String(name || '?')
  .split(/[\s@._-]+/).filter(Boolean).slice(0, 2)
  .map((p) => p[0]).join('').toUpperCase() || '?';

export const timeAgo = (iso) => {
  if (!iso) return '';
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
};

export const stamp = (iso) => iso
  ? new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
  : '';

/* ---------- API ---------- */

export async function api(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: options.body ? { 'content-type': 'application/json', ...(options.headers || {}) } : options.headers,
  });
  let data = null;
  try { data = await res.json(); } catch { /* non-JSON */ }
  if (!res.ok) {
    const message = data?.error || data?.detail || `Request failed (${res.status})`;
    if (res.status === 401) { location.replace('/app/login.html'); }
    throw Object.assign(new Error(message), { status: res.status });
  }
  return data;
}

/* ---------- session ---------- */

let _user;
export async function session() {
  if (_user === undefined) {
    try { _user = (await api('/api/session')).user ?? null; }
    catch (e) { if (e.status !== 401) _user = null; }
  }
  return _user;
}

/** Redirect anonymous visitors to the login page; returns the user. */
export async function requireUser() {
  const user = await session();
  if (!user) location.replace('/app/login.html');
  return user;
}

export async function signOut() {
  try {
    await api('/api/auth/session', { method: 'DELETE' });
    const mod = await import('./config.js');
    const sb = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
    sb.createClient(mod.SUPABASE_URL, mod.SUPABASE_ANON_KEY).removeAllSubscriptions?.();
    localStorage.clear();
  } finally {
    location.replace('/app/login.html');
  }
}

/* ---------- toasts ---------- */

export function toast(message, kind = 'ok') {
  let wrap = document.querySelector('.toasts');
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.className = 'toasts';
    document.body.appendChild(wrap);
  }
  const el = document.createElement('div');
  el.className = `toast${kind === 'err' ? ' err' : ''}`;
  el.textContent = message;
  wrap.appendChild(el);
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 220); }, 2400);
}

/* ---------- modal ---------- */

export const openModal = (el) => { el.classList.add('open'); el.style.display = ''; document.body.style.overflow = 'hidden'; };
export const closeModal = (el) => { el.classList.remove('open'); el.style.display = 'none'; document.body.style.overflow = ''; };
export function wireModal(el, onClose) {
  if (!el) return;
  el.style.display = 'none';
  el.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => { closeModal(el); onClose?.(); }));
  el.querySelector('.scrim-full')?.addEventListener('click', () => { closeModal(el); onClose?.(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && el.style.display !== 'none') { closeModal(el); onClose?.(); } });
}

/* ---------- animation utilities ---------- */

export function stagger(scope, selector, step = 55, base = 0) {
  scope.querySelectorAll(selector).forEach((el, i) => el.style.setProperty('--d', `${base + i * step}ms`));
}

const revealIO = ('IntersectionObserver' in window)
  ? new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) { e.target.classList.add('in'); revealIO.unobserve(e.target); }
    }, { threshold: 0.12 })
  : null;

export function reveal(scope) {
  scope.querySelectorAll('.reveal').forEach((el) => (revealIO ? revealIO.observe(el) : el.classList.add('in')));
}

export function countUp(el, to, { dur = 900, prefix = '' } = {}) {
  if (!el) return;
  const from = Number(el.textContent) || 0;
  if (to === from || !Number.isFinite(to)) { el.textContent = `${prefix}${to ?? ''}`; return; }
  const t0 = performance.now();
  const tick = (t) => {
    const p = Math.min(1, (t - t0) / dur);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = `${prefix}${Math.round(from + (to - from) * eased)}`;
    if (p < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

/** Cursor-following highlight for elements with the .spotlight class. */
export function spotlight(root = document) {
  root.querySelectorAll('.spotlight').forEach((el) => {
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      el.style.setProperty('--mx', `${e.clientX - r.left}px`);
      el.style.setProperty('--my', `${e.clientY - r.top}px`);
      el.classList.add('spot-on');
    });
    el.addEventListener('pointerleave', () => el.classList.remove('spot-on'));
  });
}

/* ---------- icons ---------- */

export const icons = {
  edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
  arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7"/><path d="M7 7h10v10"/></svg>',
  send: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>',
  menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
  eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>',
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
  sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4m11.4-11.4 1.4-1.4"/></svg>',
  moon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>',
};

/* ---------- theme (matches the React app's localStorage key) ---------- */

function applyTheme(paper) {
  document.documentElement.classList.toggle('paper', paper);
  document.documentElement.style.colorScheme = paper ? 'light' : 'dark';
  try { localStorage.setItem('octa-theme', paper ? 'paper' : 'ink'); } catch { /* private mode */ }
}

function wireTheme() {
  document.querySelectorAll('[data-theme-toggle]').forEach((btn) => {
    btn.innerHTML = document.documentElement.classList.contains('paper') ? icons.sun : icons.moon;
    btn.addEventListener('click', () => {
      applyTheme(!document.documentElement.classList.contains('paper'));
      btn.innerHTML = document.documentElement.classList.contains('paper') ? icons.sun : icons.moon;
    });
  });
}

/* ---------- shared chrome (sidebar + topbar wiring) ---------- */

export async function boot(pageId) {
  wireTheme();
  stagger(document, '.rail li, [data-stagger]', 45);

  const drawer = document.querySelector('.rail');
  const scrim = document.querySelector('.scrim');
  const burger = document.querySelector('[data-drawer]');
  burger?.addEventListener('click', () => { drawer.classList.add('open'); scrim?.classList.add('open'); });
  scrim?.addEventListener('click', () => { drawer.classList.remove('open'); scrim.classList.remove('open'); });

  // Sign-in identity in the rail footer.
  const user = await requireUser();
  const whoami = document.querySelector('.whoami');
  if (whoami) whoami.textContent = user?.email ?? '';

  document.querySelectorAll('[data-signout]').forEach((b) => b.addEventListener('click', signOut));

  // Chat badge: unread conversations for the rail.
  refreshBadge();

  spotlight(document);
  reveal(document);
  return user;
}

export async function refreshBadge() {
  const badge = document.querySelector('.nav-item[data-page="chat"] .badge');
  if (!badge) return;
  try {
    const { conversations } = await api('/api/chat/conversations');
    const count = (conversations ?? []).filter((c) => c.status === 'open').length;
    badge.textContent = String(count);
    badge.classList.toggle('show', count > 0);
  } catch { /* offline or anonymous — leave the badge hidden */ }
}
