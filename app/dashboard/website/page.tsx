'use client';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

type Tab = 'projects' | 'team' | 'launch';
const TABS: { key: Tab; label: string; blurb: string }[] = [
  { key: 'projects', label: 'Projects', blurb: 'Portfolio items shown in the work grid on octadevs.fun.' },
  { key: 'team', label: 'Team', blurb: 'People shown in the about section, in the order listed here.' },
  { key: 'launch', label: 'Launch banner', blurb: 'The countdown strip at the top of the site.' },
];

export default function WebsitePage() {
  const [tab, setTab] = useState<Tab>('projects');
  const blurb = TABS.find((t) => t.key === tab)!.blurb;
  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-[26px] font-semibold tracking-tightest md:text-[30px]">Website</h1>
        <p className="mt-1.5 max-w-[54ch] text-[13px] leading-relaxed text-mid">
          Content published on octadevs.fun. Changes appear on the public site as soon as you save them.
        </p>
      </header>

      <div className="flex flex-wrap gap-2 border-b border-line pb-px">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={'-mb-px border-b-2 px-3 pb-3 pt-1 text-[14px] transition-colors ' + (tab === t.key ? 'border-fg font-medium text-fg' : 'border-transparent text-mid hover:text-fg')}
          >
            {t.label}
          </button>
        ))}
      </div>

      <p className="-mt-3 text-[13px] text-mid">{blurb}</p>

      {tab === 'projects' && <Collection endpoint="website/projects" noun="project" fields={[
        { key: 'title', label: 'Title', placeholder: 'Lumen Labs' },
        { key: 'category', label: 'Category', placeholder: 'Mobile App' },
        { key: 'status', label: 'Status', placeholder: 'Coming Soon' },
        { key: 'project_url', label: 'Link', placeholder: 'https://' },
        { key: 'image_url', label: 'Image URL' },
        { key: 'description', label: 'Description', type: 'textarea' },
      ]} row={(i) => [i.title || 'Untitled project', [i.category, i.status].filter(Boolean).join(' · ')]} />}

      {tab === 'team' && <Collection endpoint="website/team" noun="member" fields={[
        { key: 'name', label: 'Name', placeholder: 'Aarav Sharma' },
        { key: 'role', label: 'Role', placeholder: 'Co-founder' },
        { key: 'avatar_url', label: 'Photo URL' },
        { key: 'bio', label: 'Bio', type: 'textarea' },
      ]} row={(i) => [i.name || 'Unnamed', i.role || '—']} />}

      {tab === 'launch' && <LaunchForm />}
    </div>
  );
}

type FieldDef = { key: string; label: string; type?: 'text' | 'textarea'; placeholder?: string };

function Collection({ endpoint, noun, fields, row }: { endpoint: string; noun: string; fields: FieldDef[]; row: (i: any) => [string, string] }) {
  const [items, setItems] = useState<any[] | null>(null);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState<any>({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = () => fetch(`/api/${endpoint}`).then((r) => r.json()).then((d) => setItems(Array.isArray(d) ? d : [])).catch(() => setItems([]));
  useEffect(() => { load(); }, [endpoint]);

  const openNew = () => { setForm({ sort_order: 0 }); setError(''); setEditing({}); };
  const openEdit = (i: any) => { setForm({ ...i }); setError(''); setEditing(i); };
  const close = () => { setEditing(null); setForm({}); setError(''); };

  const save = async () => {
    setSaving(true); setError('');
    const res = await fetch(`/api/${endpoint}`, {
      method: editing?.id ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) { setError(data.error || 'Could not save.'); return; }
    close(); load();
  };

  const remove = async (i: any) => {
    if (!confirm(`Remove ${row(i)[0]}?`)) return;
    await fetch(`/api/${endpoint}?id=${i.id}`, { method: 'DELETE' });
    load();
  };

  return (
    <>
      <div className="flex justify-end">
        <button className="btn btn-primary" onClick={openNew}>New {noun}</button>
      </div>

      {items === null ? (
        <div className="card-flat divide-y divide-line">{[0, 1].map((i) => <div key={i} className="h-[68px] shimmer" />)}</div>
      ) : !items.length ? (
        <div className="card-flat px-6 py-14 text-center">
          <p className="font-display text-[17px] font-medium tracking-tight">Nothing published</p>
          <p className="mx-auto mt-2 max-w-[42ch] text-[13px] text-mid">Add the first {noun} — it goes live on the site right away.</p>
        </div>
      ) : (
        <ul className="card-flat divide-y divide-line overflow-hidden">
          {items.map((i) => (
            <li key={i.id} className="group flex items-center gap-4 px-4 py-3.5 transition-colors hover:bg-panel md:px-5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-medium">{row(i)[0]}</p>
                <p className="mt-1 truncate text-[13px] text-mid">{row(i)[1]}</p>
              </div>
              <div className="flex shrink-0 gap-1 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100">
                <button className="icon-btn" onClick={() => openEdit(i)} aria-label={`Edit ${row(i)[0]}`}><Pencil /></button>
                <button className="icon-btn danger" onClick={() => remove(i)} aria-label={`Delete ${row(i)[0]}`}><Trash /></button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {editing !== null && (
        <Modal onClose={close} title={`${editing.id ? 'Edit' : 'New'} ${noun}`}>
          <div className="space-y-3.5">
            {fields.map((f) => (
              <div key={f.key}>
                <label className="label" htmlFor={`w-${f.key}`}>{f.label}</label>
                {f.type === 'textarea' ? (
                  <textarea id={`w-${f.key}`} className="field min-h-[92px] resize-y" placeholder={f.placeholder} value={form[f.key] ?? ''} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} />
                ) : (
                  <input id={`w-${f.key}`} className="field" placeholder={f.placeholder} value={form[f.key] ?? ''} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} />
                )}
              </div>
            ))}
          </div>
          {error && <p className="mt-4 text-[13px] text-danger">{error}</p>}
          <div className="mt-6 flex justify-end gap-2">
            <button className="btn btn-ghost" onClick={close}>Cancel</button>
            <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
          </div>
        </Modal>
      )}
    </>
  );
}

function LaunchForm() {
  const [form, setForm] = useState<any>(null);
  const [saved, setSaved] = useState(false);
  useEffect(() => { fetch('/api/website/launch').then((r) => r.json()).then(setForm).catch(() => setForm({})); }, []);
  if (!form) return <div className="card-flat h-[180px] shimmer" />;

  const save = async () => {
    await fetch('/api/website/launch', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    setSaved(true); setTimeout(() => setSaved(false), 2200);
  };

  return (
    <div className="card-flat max-w-[520px] p-5 md:p-6">
      <div className="space-y-3.5">
        <div>
          <label className="label" htmlFor="l-title">Headline</label>
          <input id="l-title" className="field" value={form.title || ''} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        </div>
        <div>
          <label className="label" htmlFor="l-sub">Supporting line</label>
          <input id="l-sub" className="field" value={form.subtitle || ''} onChange={(e) => setForm({ ...form, subtitle: e.target.value })} />
        </div>
        <div className="grid gap-3.5 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="l-date">Launch date</label>
            <input id="l-date" type="date" className="field" value={(form.target_date || '').slice(0, 10)} onChange={(e) => setForm({ ...form, target_date: e.target.value })} />
          </div>
          <div>
            <label className="label">Visibility</label>
            <button
              onClick={() => setForm({ ...form, is_active: !form.is_active })}
              className="flex h-[42px] w-full items-center gap-3 rounded-[10px] border border-line bg-panel px-3 text-left text-[13px] transition-colors hover:border-dim/60"
            >
              <span className={'relative h-5 w-9 rounded-full transition-colors ' + (form.is_active ? 'bg-signal' : 'bg-line')}>
                <span className="absolute top-0.5 h-4 w-4 rounded-full bg-fg transition-transform" style={{ transform: form.is_active ? 'translateX(18px)' : 'translateX(2px)' }} />
              </span>
              {form.is_active ? 'Shown on site' : 'Hidden'}
            </button>
          </div>
        </div>
      </div>
      <div className="mt-6 flex items-center gap-3">
        <button className="btn btn-primary" onClick={save}>Save changes</button>
        <span className={'text-[13px] text-mid transition-opacity duration-200 ' + (saved ? 'opacity-100' : 'opacity-0')}>Saved</span>
      </div>
    </div>
  );
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
      <div role="dialog" aria-modal="true" aria-label={title} className="glass relative max-h-[88vh] w-full overflow-y-auto rounded-t-[18px] p-5 pop sm:rounded-[18px] sm:p-6">
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
