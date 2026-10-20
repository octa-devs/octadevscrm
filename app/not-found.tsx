import Link from 'next/link';

/**
 * Brand 404. The static app in /app is all hand-written pages, but people
 * still mistype URLs and old bookmarks die — this renders there instead of a
 * white NEXT_NOT_FOUND page. Dressed in the same Ink & Signal look as the
 * static app: reusing /app/assets/app.css directly keeps one design system.
 */
export const metadata = {
  title: '404 — OCTA DEVS Portal',
};

export default function NotFound() {
  return (
    <>
      {/* Same design system as the static app: tokens, fonts, buttons. */}
      <link rel="stylesheet" href="/app/assets/app.css" />
      <style>{`
        .nf-wrap { min-height: 100vh; display: grid; place-items: center; position: relative; overflow: hidden; padding: 24px; }
        .nf-card { position: relative; z-index: 1; max-width: 520px; padding: 40px 48px 44px; border-radius: 18px; text-align: center;
                   background: rgb(var(--glass-bg) / 0.92); backdrop-filter: blur(18px); -webkit-backdrop-filter: blur(18px);
                   border: 1px solid rgb(var(--line)); box-shadow: var(--shadow-card); }
        .nf-code { font-family: var(--font-mono); font-size: 12px; letter-spacing: 0.24em; text-transform: uppercase; color: rgb(var(--signal)); }
        .nf-card h1 { margin: 14px 0 0; font-family: var(--font-display); font-size: clamp(30px, 7vw, 44px); font-weight: 600; letter-spacing: -0.04em; color: rgb(var(--fg)); }
        .nf-card p { margin: 14px auto 0; max-width: 34ch; font-size: 14px; line-height: 1.65; color: rgb(var(--mid)); }
        .nf-actions { display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; margin-top: 28px; }
        .nf-ghost { display: inline-flex; align-items: center; padding: 10px 16px; border-radius: 10px; border: 1px solid rgb(var(--line));
                    color: rgb(var(--mid)); font-size: 13.5px; text-decoration: none; transition: border-color 140ms ease, color 140ms ease; }
        .nf-ghost:hover { border-color: rgb(var(--mid) / 0.6); color: rgb(var(--fg)); }
        .nf-foot { margin-top: 30px; display: flex; justify-content: center; gap: 16px; font-family: var(--font-mono); font-size: 10.5px;
                   letter-spacing: 0.12em; text-transform: uppercase; color: rgb(var(--dim)); }
        .nf-foot a { color: inherit; text-decoration: none; }
        .nf-foot a:hover { color: rgb(var(--mid)); }
        .nf-lines { position: fixed; inset: 0; z-index: 0; pointer-events: none;
                    background-image: linear-gradient(rgb(var(--line) / 0.28) 1px, transparent 1px), linear-gradient(90deg, rgb(var(--line) / 0.28) 1px, transparent 1px);
                    background-size: 44px 44px;
                    mask-image: radial-gradient(ellipse 70% 60% at 50% 45%, black 30%, transparent 75%);
                    -webkit-mask-image: radial-gradient(ellipse 70% 60% at 50% 45%, black 30%, transparent 75%); }
        .nf-beam { position: fixed; left: 50%; top: 30%; width: 720px; height: 260px; transform: translate(-50%, -50%); pointer-events: none; opacity: 0.55; filter: blur(70px);
                   background: radial-gradient(closest-side, rgb(var(--signal) / 0.34), transparent 70%); }
        @media (prefers-reduced-motion: reduce) { .nf-lines, .nf-beam { opacity: 0.35; } }
      `}</style>
      <div className="nf-wrap" style={{ background: 'rgb(var(--canvas))', color: 'rgb(var(--fg))' }}>
        <div className="nf-beam" aria-hidden />
        <div className="nf-lines" aria-hidden />
        <main className="nf-card">
          <div className="nf-code">Error 404 · Signal lost</div>
          <h1>This channel does not exist</h1>
          <p>
            The page you asked for is not on this frequency. It may have moved,
            been renamed, or never been broadcast at all.
          </p>
          <div className="nf-actions">
            <Link href="/app/dashboard.html" className="nf-ghost nf-primary" style={{ background: 'rgb(var(--btn-bg))', color: 'rgb(var(--btn-fg))', borderColor: 'rgb(var(--btn-bg))', fontWeight: 500 }}>
              Open the portal
            </Link>
            <a href="/app/login.html" className="nf-ghost">Sign in</a>
          </div>
          <div className="nf-foot">
            <a href="/app/privacy.html">Privacy</a>
            <a href="/app/terms.html">Terms</a>
          </div>
        </main>
      </div>
    </>
  );
}
