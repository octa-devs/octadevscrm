'use client';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

export default function UsersPage() {
  const [items, setItems] = useState<any[] | null>(null);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState<any>({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = () => fetch('/api/users').then((r) => r.json()).then((d) => setItems(Array.isArray(d) ? d : [])).catch(() => setItems([]));
  useEffect(() => { load(); }, []);

  const openNew = () => { setForm({ email: '', password: '', role: 'employee' }); setError(''); setEditing({}); };
  const openEdit = (u: any) => { setForm({ id: u.id, email: u.email, password: '', role: u.role }); setError(''); setEditing(u); };
  const close = () => { setEditing(null); setForm({}); setError(''); };

  const save = async () => {
    setSaving(true); setError('');
    const res = await fetch('/api/users', {
      method: editing?.id ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editing?.id ? { id: form.id, role: form.role, ...(form.email ? { email: form.email } : {}), ...(form.password ? { password: form.password } : {}) } : form),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) { setError(data.error || 'Could not save that account.'); return; }
    close(); load();
  };

  const remove = async (u: any) => {
    if (!confirm(`Delete ${u.email}? They will lose access immediately.`)) return;
    setDeleting(u.id);
    const res = await fetch(`/api/users?id=${u.id}`, { method: 'DELETE' });
    if (!res.ok) alert((await res.json().catch(() => ({}))).error || 'Could not delete that account.');
    setDeleting(null); load();
  };

  const counts = items ? items.reduce((a, u) => ((a[u.role] = (a[u.role] || 0) + 1), a), {} as Record<string, number>) : {};

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[26px] font-semibold tracking-tightest md:text-[30px]">People</h1>
          <p className="mt-1.5 max-w-[54ch] text-[13px] leading-relaxed text-mid">
            Accounts that can sign in to the portal. Super users can edit anyone's email, password and role.
          </p>
        </div>
        <button className="btn btn-primary" onClick={openNew}>New account</button>
      </header>

      {items && (
        <div className="flex flex-wrap gap-2">
          {(['super_admin', 'admin', 'employee'] as const).map((r) => (
            <span key={r} className="chip">
              {label(r)} <span className="text-fg">{counts[r] ?? 0}</span>
            </span>
          ))}
        </div>
      )}

      {items === null ? (
        <div className="card-flat divide-y divide-line">{[0, 1, 2].map((i) => <div key={i} className="h-[68px] shimmer" />)}</div>
      ) : !items.length ? (
        <div className="card-flat px-6 py-14 text-center">
          <p className="font-display text-[17px] font-medium tracking-tight">No accounts yet</p>
          <p className="mx-auto mt-2 max-w-[42ch] text-[13px] text-mid">Create the first account to give someone access.</p>
        </div>
      ) : (
        <ul className="card-flat divide-y divide-line overflow-hidden">
          {items.map((u) => (
            <li key={u.id} className="group flex items-center gap-4 px-4 py-3.5 transition-colors hover:bg-panel md:px-5">
              <span className="chamfer hidden h-9 w-9 shrink-0 place-items-center bg-panel font-display text-[13px] font-semibold text-mid sm:grid">
                {(u.email || '?').slice(0, 1).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
                  <p className="truncate text-[14px] font-medium">{u.email}</p>
                  {u.role === 'super_admin' && <span className="chip signal">Super user</span>}
                </div>
                <p className="num mt-1 text-[10.5px] uppercase tracking-[0.1em] text-dim">
                  {label(u.role)} · joined {u.created_at ? new Date(u.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                </p>
              </div>
              <div className="flex shrink-0 gap-1 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100">
                <button className="icon-btn" onClick={() => openEdit(u)} aria-label={`Edit ${u.email}`}><Pencil /></button>
                <button className="icon-btn danger" disabled={deleting === u.id} onClick={() => remove(u)} aria-label={`Delete ${u.email}`}><Trash /></button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {editing !== null && (
        <Modal onClose={close} title={editing.id ? 'Edit account' : 'New account'}>
          <div className="space-y-3.5">
            <div>
              <label className="label" htmlFor="u-email">Email</label>
              <input id="u-email" className="field" type="email" placeholder="name@octadevs.fun" value={form.email || ''} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <label className="label" htmlFor="u-pass">
                Password{editing.id && <span className="text-dim"> — leave blank to keep the current one</span>}
              </label>
              <input id="u-pass" className="field" type="password" autoComplete="new-password" placeholder="At least 8 characters" value={form.password || ''} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </div>
            <div>
              <label className="label" htmlFor="u-role">Role</label>
              <select id="u-role" className="field" value={form.role || 'employee'} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                <option value="employee">Employee — portal and CRM</option>
                <option value="admin">Admin — everything except People</option>
                <option value="super_admin">Super user — full access</option>
              </select>
            </div>
          </div>

          {error && <p className="mt-4 text-[13px] text-danger">{error}</p>}

          <div className="mt-6 flex justify-end gap-2">
            <button className="btn btn-ghost" onClick={close}>Cancel</button>
            <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function label(r: string) {
  return r === 'super_admin' ? 'Super user' : r === 'admin' ? 'Admin' : 'Employee';
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', esc);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', esc); document.body.style.overflow = ''; };
  }, [onClose]);
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-black/65 backdrop-blur-[2px] fade" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-label={title} className="glass relative w-full max-w-[440px] rounded-t-[18px] p-5 pop sm:rounded-[18px] sm:p-6">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-display text-[18px] font-semibold tracking-tightest">{title}</h2>
          <button className="icon-btn -mr-1" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" className="h-[18px] w-[18px]" aria-hidden><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}

function Pencil() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-[17px] w-[17px]" aria-hidden><path d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17v3Z" /><path d="M13.5 6.5l4 4" /></svg>;
}
function Trash() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-[17px] w-[17px]" aria-hidden><path d="M4 7h16M9.5 7V5.5A1.5 1.5 0 0 1 11 4h2a1.5 1.5 0 0 1 1.5 1.5V7" /><path d="M6.5 7l.8 12.1A2 2 0 0 0 9.3 21h5.4a2 2 0 0 0 2-1.9L17.5 7" /><path d="M10.5 11v6M13.5 11v6" /></svg>;
}
