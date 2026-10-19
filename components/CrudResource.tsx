'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export type Field = {
  key: string;
  label: string;
  type?: 'text' | 'email' | 'textarea' | 'select' | 'date' | 'number';
  options?: string[];
  placeholder?: string;
  full?: boolean;
};

export type ChipRule = { key: string; tone?: 'signal' | 'danger' | 'ok' | 'neutral'; map?: Record<string, 'signal' | 'danger' | 'ok'> };

export default function CrudResource({
  entity,
  title,
  intro,
  fields,
  chips = [],
  primary,
  secondary,
  emptyLine,
}: {
  entity: string;
  title: string;
  intro: string;
  fields: Field[];
  chips?: ChipRule[];
  primary: (i: any) => string;
  secondary?: (i: any) => string;
  emptyLine: string;
}) {
  const [items, setItems] = useState<any[] | null>(null);
  const [editing, setEditing] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [form, setForm] = useState<any>({});
  const [q, setQ] = useState('');
  const [error, setError] = useState('');

  const load = () => fetch(`/api/crm/${entity}`).then((r) => r.json()).then(setItems).catch(() => setItems([]));
  useEffect(() => { load(); }, [entity]);

  const openNew = () => {
    const seed: any = {};
    fields.forEach((f) => { seed[f.key] = f.type === 'select' ? (f.options?.[0] ?? '') : ''; });
    setForm(seed); setError(''); setEditing({});
  };
  const openEdit = (i: any) => { setForm({ ...i }); setError(''); setEditing(i); };
  const close = () => { setEditing(null); setForm({}); setError(''); };

  const save = async () => {
    const missing = fields.filter((f) => f.label && !String(form[f.key] ?? '').trim() && ['name', 'title'].includes(f.key));
    if (missing.length) { setError(`${missing[0].label} is required.`); return; }
    setSaving(true);
    const res = await fetch(`/api/crm/${entity}`, {
      method: editing?.id ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (!res.ok) { setError('Could not save. Try again.'); return; }
    close(); load();
  };

  const remove = async (id: string) => {
    setDeleting(id);
    await fetch(`/api/crm/${entity}?id=${id}`, { method: 'DELETE' });
    setDeleting(null); load();
  };

  const filtered = useMemo(() => {
    if (!items) return [];
    const t = q.trim().toLowerCase();
    return t ? items.filter((i) => Object.values(i).some((v) => String(v).toLowerCase().includes(t))) : items;
  }, [items, q]);

  const noun = title.replace(/s$/, '');

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[26px] font-semibold tracking-tightest md:text-[30px]">{title}</h1>
          <p className="mt-1.5 max-w-[52ch] text-[13px] leading-relaxed text-mid">{intro}</p>
        </div>
        <div className="flex items-center gap-2">
          <input className="field w-[168px]" placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} aria-label={`Search ${title}`} />
          <button className="btn btn-primary" onClick={openNew}>New {noun.toLowerCase()}</button>
        </div>
      </header>

      {items === null ? (
        <div className="card-flat divide-y divide-line">
          {[0, 1, 2].map((i) => <div key={i} className="h-[74px] shimmer" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card-flat px-6 py-14 text-center">
          <p className="font-display text-[17px] font-medium tracking-tight">
            {q ? `Nothing matches “${q}”` : `No ${title.toLowerCase()} yet`}
          </p>
          <p className="mx-auto mt-2 max-w-[42ch] text-[13px] leading-relaxed text-mid">
            {q ? 'Try a different name, company or email address.' : emptyLine}
          </p>
          {!q && <button className="btn btn-ghost mt-6" onClick={openNew}>New {noun.toLowerCase()}</button>}
        </div>
      ) : (
        <ul className="card-flat divide-y divide-line overflow-hidden">
          {filtered.map((item) => {
            const d = chips.filter((c) => item[c.key]);
            return (
              <li key={item.id} className="group flex items-center gap-4 px-4 py-3.5 transition-colors hover:bg-panel md:px-5">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
                    <p className="truncate text-[14px] font-medium">{primary(item)}</p>
                    {d.map((c) => (
                      <span key={c.key} className={'chip ' + tone(item, c)}>{item[c.key]}</span>
                    ))}
                  </div>
                  {secondary && item && <p className="mt-1 truncate text-[13px] text-mid">{secondary(item)}</p>}
                  <p className="num mt-1.5 text-[10.5px] uppercase tracking-[0.1em] text-dim">
                    {item.created_at ? new Date(item.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : ''}
                    {item.created_by ? ` · ${item.created_by}` : ''}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100">
                  <button className="icon-btn" onClick={() => openEdit(item)} aria-label={`Edit ${primary(item)}`}>
                    <Pencil />
                  </button>
                  <button
                    className="icon-btn danger"
                    disabled={deleting === item.id}
                    onClick={() => remove(item.id)}
                    aria-label={`Delete ${primary(item)}`}
                  >
                    <Trash />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {editing !== null && (
        <Modal onClose={close} title={`${editing.id ? 'Edit' : 'New'} ${noun.toLowerCase()}`}>
          <div className="space-y-3.5">
            {fields.map((f) => (
              <div key={f.key} className={f.full || f.type === 'textarea' ? 'md:col-span-2' : ''}>
                <label className="label" htmlFor={`f-${f.key}`}>{f.label}</label>
                {f.type === 'textarea' ? (
                  <textarea id={`f-${f.key}`} className="field min-h-[92px] resize-y" placeholder={f.placeholder} value={form[f.key] ?? ''} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} />
                ) : f.type === 'select' ? (
                  <select id={`f-${f.key}`} className="field" value={form[f.key] ?? ''} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}>
                    {f.options?.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : (
                  <input id={`f-${f.key}`} className="field" type={f.type === 'date' ? 'date' : f.type === 'number' ? 'number' : f.type || 'text'} placeholder={f.placeholder} value={form[f.key] ?? ''} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} />
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
    </div>
  );
}

function tone(item: any, c: ChipRule) {
  if (c.map && c.map[item[c.key]]) return c.map[item[c.key]];
  return c.tone || 'neutral';
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', esc);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', esc); document.body.style.overflow = ''; };
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-black/65 backdrop-blur-[2px] fade" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-label={title} className="glass relative w-full max-w-[520px] rounded-t-[18px] p-5 pop sm:rounded-[18px] sm:p-6">
        <div className="mb-5 flex items-center justify-between gap-4">
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
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-[17px] w-[17px]" aria-hidden>
      <path d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17v3Z" /><path d="M13.5 6.5l4 4" />
    </svg>
  );
}
function Trash() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-[17px] w-[17px]" aria-hidden>
      <path d="M4 7h16M9.5 7V5.5A1.5 1.5 0 0 1 11 4h2a1.5 1.5 0 0 1 1.5 1.5V7" /><path d="M6.5 7l.8 12.1A2 2 0 0 0 9.3 21h5.4a2 2 0 0 0 2-1.9L17.5 7" /><path d="M10.5 11v6M13.5 11v6" />
    </svg>
  );
}
