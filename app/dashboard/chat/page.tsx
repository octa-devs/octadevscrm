'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSession } from '@/components/Session';

type Tab = 'inbox' | 'team';

const MAX_BODY = 4000;

/* ---------- formatting ---------- */

function timeAgo(iso?: string) {
  if (!iso) return '';
  const ms = Date.now() - new Date(iso).getTime();
  if (!isFinite(ms)) return '';
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 45) return 'now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function clock(iso?: string) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function initials(name?: string) {
  const c = (name || '').trim();
  if (!c) return '?';
  const parts = c.replace(/@.*/, '').split(/[\s._-]+/).filter(Boolean);
  return ((parts.length >= 2 ? parts[0][0] + parts[1][0] : c.slice(0, 2))).toUpperCase();
}

function visitorName(c: any) {
  return (c?.visitor_name || '').trim() || (c?.visitor_email || '').trim() || 'Visitor';
}

/* ---------- page ---------- */

export default function ChatPage() {
  const [tab, setTab] = useState<Tab>('inbox');

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-[26px] font-semibold tracking-tightest md:text-[30px]">Chat</h1>
        <p className="mt-1.5 max-w-[54ch] text-[13px] leading-relaxed text-mid">
          Talk to visitors on octadevs.fun, and to the team — nothing here is public.
        </p>
      </header>

      <div className="flex flex-wrap gap-2 border-b border-line pb-px">
        {(
          [
            ['inbox', 'Visitor inbox'],
            ['team', 'Team'],
          ] as [Tab, string][]
        ).map(([key, text]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={'-mb-px border-b-2 px-3 pb-3 pt-1 text-[14px] transition-colors ' +
              (tab === key ? 'border-fg font-medium text-fg' : 'border-transparent text-mid hover:text-fg')}
          >
            {text}
          </button>
        ))}
      </div>

      <div key={tab} className="pop">
        {tab === 'inbox' ? <Inbox /> : <TeamRail />}
      </div>
    </div>
  );
}

/* ---------- visitor inbox ---------- */

function Inbox() {
  const [conversations, setConversations] = useState<any[] | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [thread, setThread] = useState<any[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const logRef = useRef<HTMLDivElement | null>(null);
  const activeRef = useRef<string | null>(null);
  activeRef.current = activeId;

  const loadList = useCallback(async () => {
    try {
      const r = await fetch('/api/chat/conversations', { cache: 'no-store' });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setError(d?.error || 'Could not load the inbox.'); return; }
      setError('');
      setConversations(Array.isArray(d.conversations) ? d.conversations : []);
    } catch {
      setError('Could not load the inbox.');
    }
  }, []);

  const loadThread = useCallback(async (id: string) => {
    try {
      const r = await fetch(`/api/chat/conversations/${id}`, { cache: 'no-store' });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setError(d?.error || 'Could not open that thread.'); return; }
      setError('');
      if (activeRef.current !== id) return; // you already moved on
      setThread(Array.isArray(d.messages) ? d.messages : []);
    } catch {
      /* transient — the next tick retries */
    }
  }, []);

  // The list breathes while you watch it, and wakes up the moment you return.
  useEffect(() => {
    loadList();
    const tick = () => { if (!document.hidden) loadList(); };
    const iv = setInterval(tick, 5000);
    document.addEventListener('visibilitychange', tick);
    return () => { clearInterval(iv); document.removeEventListener('visibilitychange', tick); };
  }, [loadList]);

  useEffect(() => {
    if (!activeId) { setThread([]); return; }
    loadThread(activeId);
    // The list poll already pauses when the tab is hidden; the thread only
    // needs its own clock.
    const iv = setInterval(() => { if (!document.hidden) loadThread(activeId!); }, 2500);
    return () => clearInterval(iv);
  }, [activeId, loadThread]);

  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [thread]);

  const active = conversations?.find((c) => c.id === activeId) || null;

  const send = async () => {
    const body = draft.trim();
    if (!body || !activeId || busy) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/chat/conversations/${activeId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setError(d?.error || 'Could not send.'); return; }
      setError('');
      setDraft('');
      if (d.message) setThread((t) => (t.some((m) => m.id === d.message.id) ? t : [...t, d.message]));
      loadList();
    } catch {
      setError('Could not send — check your connection.');
    } finally {
      setBusy(false);
    }
  };

  const setStatus = async (status: 'open' | 'closed') => {
    if (!activeId) return;
    await fetch(`/api/chat/conversations/${activeId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    loadList();
    loadThread(activeId);
  };

  return (
    <div className="grid gap-5 md:grid-cols-[340px_minmax(0,1fr)]">
      {/* list */}
      <div className={'card-flat overflow-hidden ' + (activeId ? 'hidden md:block' : 'block')}>
        {conversations === null ? (
          <div className="divide-y divide-line">{[0, 1, 2].map((i) => <div key={i} className="h-[74px] shimmer" />)}</div>
        ) : !conversations.length ? (
          <div className="px-6 py-14 text-center">
            <p className="font-display text-[16px] font-medium tracking-tight">Inbox is empty</p>
            <p className="mx-auto mt-2 max-w-[34ch] text-[13px] text-mid">
              Conversations started from the live chat widget on the site land here.
            </p>
          </div>
        ) : (
          <ul className="max-h-[540px] divide-y divide-line overflow-y-auto">
            {conversations.map((c) => {
              const selected = c.id === activeId;
              const preview = c.last_message
                ? (c.last_message.sender === 'team' ? 'You: ' : '') + c.last_message.body
                : 'No messages yet';
              return (
                <li key={c.id}>
                  <button
                    onClick={() => setActiveId(c.id)}
                    className={'flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors ' +
                      (selected ? 'bg-panel' : 'hover:bg-panel')}
                  >
                    <span className="chamfer grid h-9 w-9 shrink-0 place-items-center bg-raised font-display text-[12px] font-semibold text-mid">
                      {initials(visitorName(c))}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline gap-2">
                        <span className="min-w-0 flex-1 truncate text-[14px] font-medium">{visitorName(c)}</span>
                        <span className="num shrink-0 text-[10.5px] text-dim">{timeAgo(c.last_message_at)}</span>
                      </span>
                      <span className="mt-1 flex items-center gap-2">
                        <span className="min-w-0 flex-1 truncate text-[13px] text-mid">{preview}</span>
                        {c.unread_team > 0 && (
                          <span className="pop grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-signal px-1.5 num text-[10px] font-semibold text-signalink">
                            {c.unread_team}
                          </span>
                        )}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* thread */}
      <div className={'flex h-[540px] flex-col overflow-hidden rounded-[14px] border border-line bg-surface ' + (activeId ? 'flex' : 'hidden md:flex')}>
        {!active ? (
          <div className="grid flex-1 place-items-center px-6 py-14 text-center">
            <div>
              <p className="font-display text-[16px] font-medium tracking-tight">Pick a conversation</p>
              <p className="mx-auto mt-2 max-w-[38ch] text-[13px] text-mid">
                Replies you send appear in the visitor's chat window within seconds.
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 border-b border-line px-4 py-3">
              <button className="icon-btn -ml-1 md:hidden" onClick={() => setActiveId(null)} aria-label="Back to conversations">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" className="h-5 w-5" aria-hidden><path d="M14 6l-6 6 6 6" /></svg>
              </button>
              <span className="chamfer grid h-9 w-9 shrink-0 place-items-center bg-raised font-display text-[12px] font-semibold text-mid">
                {initials(visitorName(active))}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-medium">{visitorName(active)}</p>
                <p className="num mt-0.5 truncate text-[10.5px] uppercase tracking-[0.1em] text-dim">
                  {active.visitor_email ? active.visitor_email + ' · ' : ''}{active.last_page ? 'from ' + active.last_page : ''}
                </p>
              </div>
              <span className={'chip ' + (active.status === 'closed' ? 'ok' : 'signal')}>{active.status}</span>
              <button className="btn btn-ghost hidden text-[13px] sm:inline-flex" onClick={() => setStatus(active.status === 'closed' ? 'open' : 'closed')}>
                {active.status === 'closed' ? 'Reopen' : 'Close'}
              </button>
            </div>

            <div ref={logRef} aria-live="polite" className="flex-1 space-y-2.5 overflow-y-auto px-4 py-4">
              {!thread.length && <p className="py-10 text-center text-[13px] text-dim">No messages yet.</p>}
              {thread.map((m) => (
                <Bubble key={m.id} mine={m.sender === 'team'} author={m.sender === 'team' ? 'You' : visitorName(active)} text={m.body} at={m.created_at} />
              ))}
            </div>

            {error && <p className="px-4 pb-1 text-[13px] text-danger">{error}</p>}

            <div className="border-t border-line px-4 py-3">
              <div className="flex items-end gap-2">
                <textarea
                  value={draft}
                  maxLength={MAX_BODY}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
                  }}
                  rows={1}
                  placeholder={active.status === 'closed' ? 'Reopen the conversation to reply' : 'Reply to the visitor…'}
                  disabled={active.status === 'closed'}
                  className="field max-h-[132px] min-h-[42px] flex-1 resize-none"
                />
                <button className="btn btn-primary" onClick={send} disabled={!draft.trim() || busy || active.status === 'closed'}>
                  {busy ? 'Sending…' : 'Send'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ---------- team rooms ---------- */

function TeamRail() {
  const { username, email } = useSession();
  const [members, setMembers] = useState<any[] | null>(null);
  const [partner, setPartner] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const logRef = useRef<HTMLDivElement | null>(null);
  const roomRef = useRef<string | null>(null);
  roomRef.current = partner;

  // The directory rarely changes; one read per mount is plenty.
  useEffect(() => {
    fetch('/api/chat/team/members')
      .then((r) => r.json())
      .then((d) => setMembers(Array.isArray(d.members) ? d.members : []))
      .catch(() => setMembers([]));
  }, []);

  const load = useCallback(async (who: string | null) => {
    try {
      const url = who ? `/api/chat/team?partner=${encodeURIComponent(who)}` : '/api/chat/team';
      const r = await fetch(url, { cache: 'no-store' });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setError(d?.error || 'Could not load messages.'); return; }
      setError('');
      const room = who || null;
      if (roomRef.current !== room) return;
      setMessages(Array.isArray(d.messages) ? d.messages : []);
    } catch {
      /* transient */
    }
  }, []);

  useEffect(() => {
    if (!members) return;
    load(partner);
    const iv = setInterval(() => { if (!document.hidden) load(partner); }, 3000);
    const wake = () => { if (!document.hidden) load(partner); };
    document.addEventListener('visibilitychange', wake);
    return () => { clearInterval(iv); document.removeEventListener('visibilitychange', wake); };
  }, [partner, members, load]);

  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const send = async () => {
    const body = draft.trim();
    if (!body || busy) return;
    setBusy(true);
    try {
      const r = await fetch('/api/chat/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body, ...(partner ? { partner } : {}) }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setError(d?.error || 'Could not send.'); return; }
      setError('');
      setDraft('');
      if (d.message) setMessages((t) => (t.some((m) => m.id === d.message.id) ? t : [...t, d.message]));
    } catch {
      setError('Could not send — check your connection.');
    } finally {
      setBusy(false);
    }
  };

  const title = partner ? (members?.find((m) => m.email === partner)?.username || 'Direct message') : 'Everyone';

  return (
    <div className="grid gap-5 md:grid-cols-[240px_minmax(0,1fr)]">
      {/* who's here */}
      <div className="card-flat overflow-hidden">
        <p className="eyebrow px-4 pb-2 pt-4">Rooms</p>
        <ul className="divide-y divide-line">
          <li>
            <button
              onClick={() => setPartner(null)}
              className={'flex w-full items-center gap-3 px-4 py-3 text-left transition-colors ' + (!partner ? 'bg-panel' : 'hover:bg-panel')}
            >
              <span className={'h-2 w-2 shrink-0 rounded-full ' + (!partner ? 'bg-ok live-dot' : 'bg-line')} />
              <span className="truncate text-[14px] font-medium">Everyone</span>
            </button>
          </li>
          {(members || []).filter((m) => !m.is_me).map((m) => (
            <li key={m.email}>
              <button
                onClick={() => setPartner(m.email)}
                className={'flex w-full items-center gap-3 px-4 py-3 text-left transition-colors ' + (partner === m.email ? 'bg-panel' : 'hover:bg-panel')}
              >
                <span className="chamfer grid h-8 w-8 shrink-0 place-items-center bg-raised font-display text-[11px] font-semibold text-mid">
                  {initials(m.username)}
                </span>
                <span className="min-w-0 flex-1 truncate text-[14px]">{m.username}</span>
                {m.role === 'super_admin' && <span className="h-2 w-2 shrink-0 rounded-full bg-signal" />}
              </button>
            </li>
          ))}
          {members && !members.some((m) => !m.is_me) && (
            <li className="px-4 py-4 text-[13px] text-dim">Nobody else has an account yet.</li>
          )}
        </ul>
      </div>

      {/* thread */}
      <div className="flex flex-col overflow-hidden rounded-[14px] border border-line bg-surface md:h-[540px] h-[480px]">
        <div className="flex items-center gap-3 border-b border-line px-4 py-3">
          <span className={'h-2 w-2 shrink-0 rounded-full ' + (partner ? 'bg-signal' : 'bg-ok live-dot')} />
          <p className="min-w-0 flex-1 truncate font-display text-[15px] font-semibold tracking-tightest">{title}</p>
          <span className="eyebrow hidden sm:block">live · refreshes every few seconds</span>
        </div>

        <div ref={logRef} aria-live="polite" className="flex-1 space-y-2.5 overflow-y-auto px-4 py-4">
          {!messages.length && <p className="py-10 text-center text-[13px] text-dim">Say something — it lands instantly for everyone here.</p>}
          {messages.map((m) => (
            <Bubble key={m.id} mine={String(m.author_email).toLowerCase() === String(email).toLowerCase()} author={m.author_username || m.author_email} text={m.body} at={m.created_at} />
          ))}
        </div>

        {error && <p className="px-4 pb-1 text-[13px] text-danger">{error}</p>}

        <div className="border-t border-line px-4 py-3">
          <div className="flex items-end gap-2">
            <textarea
              value={draft}
              maxLength={MAX_BODY}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
              rows={1}
              placeholder={`Message ${title} as ${username}…`}
              className="field max-h-[132px] min-h-[42px] flex-1 resize-none"
            />
            <button className="btn btn-primary" onClick={send} disabled={!draft.trim() || busy}>
              {busy ? 'Sending…' : 'Send'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- bubbles ---------- */

function Bubble({ mine, author, text, at }: { mine: boolean; author: string; text: string; at: string }) {
  return (
    <div className={'msg-in flex gap-2.5 ' + (mine ? 'flex-row-reverse' : '')}>
      <span className={'chamfer mt-0.5 grid h-7 w-7 shrink-0 place-items-center font-display text-[10px] font-semibold ' + (mine ? 'bg-fg text-surface' : 'bg-panel text-mid')}>
        {initials(author)}
      </span>
      <div className={'max-w-[78%] min-w-0 ' + (mine ? 'text-right' : '')}>
        <p className="num mb-1 text-[10px] uppercase tracking-[0.08em] text-dim">
          {author} {clock(at)}
        </p>
        <p
          className={
            'whitespace-pre-wrap break-words rounded-[12px] px-3.5 py-2 text-[13.5px] leading-relaxed ' +
            (mine ? 'bg-fg text-surface' : 'bg-panel text-fg border border-line')
          }
        >
          {text}
        </p>
      </div>
    </div>
  );
}
