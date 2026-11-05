import Link from 'next/link';
import { getPlatformReport } from '@/lib/platforms-report';
import { FREE_PLATFORMS, LIVE_CATEGORIES, worthItRows, tier35Rows, type Grade, type PlatformShowRow, type PlatformSummary, type WaitingShow } from '@/lib/platforms';

export const dynamic = 'force-dynamic';

const GRADE_COLORS: Record<Grade, string> = {
  'A': 'bg-emerald-600', 'A-': 'bg-emerald-700', 'B+': 'bg-lime-700', 'B': 'bg-lime-800',
  'C+': 'bg-amber-700', 'C': 'bg-amber-800', 'D+': 'bg-red-800', 'D': 'bg-red-900',
};

const FALLBACK_NAMES: Record<string, string> = {
  'netflix': 'Netflix', 'stan': 'Stan', 'binge': 'Binge', 'disney-plus': 'Disney+', 'prime-video': 'Prime Video',
  'paramount-plus': 'Paramount+', 'apple-tv-plus': 'Apple TV+', 'max': 'Max', 'foxtel-now': 'Foxtel Now',
  'britbox': 'BritBox', 'abc-iview': 'ABC iview', 'sbs-on-demand': 'SBS On Demand', 'ten-play': '10 Play', 'amc-plus': 'AMC+',
  '7plus': '7plus', '9now': '9Now',
};

function isLive(r: PlatformShowRow) { return LIVE_CATEGORIES.includes(r.watchCategory); }

function Score({ r }: { r: PlatformShowRow }) {
  if (r.qualityScore == null) return <span className="text-gray-500">—</span>;
  const rated = r.rating != null;
  return (
    <span className={rated ? 'text-yellow-300' : 'text-gray-300'} title={rated ? 'Your rating' : 'Predicted'}>
      {rated ? '' : '~'}{r.qualityScore}★
    </span>
  );
}

function Binge({ r }: { r: PlatformShowRow }) {
  const own = r.bingeability;
  const value = own ?? r.predictedBingeability;
  if (value == null) return null;
  const tip = `${own != null ? 'Your bingeability' : 'Predicted bingeability'}${r.bingeRamp ? ` — ${r.bingeRamp}` : ''}`;
  return (
    <span className={own != null ? 'text-teal-300' : 'text-teal-500'} title={tip}>
      {own != null ? '' : '~'}{value}/5 binge
    </span>
  );
}

function ModeBadge({ mode }: { mode: PlatformShowRow['watchMode'] }) {
  if (!mode) return <span className="px-1.5 py-0.5 rounded text-[10px] bg-gray-700 text-gray-400">no mode</span>;
  return (
    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${mode === 'solo' ? 'bg-purple-800 text-purple-100' : 'bg-pink-800 text-pink-100'}`}>
      {mode}
    </span>
  );
}

function LiveBadge({ r }: { r: PlatformShowRow }) {
  if (r.watchCategory === 'new-season-waiting') return <span className="px-1.5 py-0.5 rounded text-[10px] bg-blue-700 text-blue-100">new season</span>;
  if (isLive(r)) return <span className="px-1.5 py-0.5 rounded text-[10px] bg-blue-700 text-blue-100">in progress</span>;
  return <span className="px-1.5 py-0.5 rounded text-[10px] bg-gray-700 text-gray-300">start</span>;
}

function NextCard({ r, name }: { r: PlatformShowRow; name: (slug: string) => string }) {
  return (
    <div className="flex gap-3 bg-gray-800 rounded-lg p-2 ring-1 ring-gray-700">
      <div className="w-14 h-20 shrink-0 rounded overflow-hidden bg-gray-700">
        {r.posterPath && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`https://image.tmdb.org/t/p/w185${r.posterPath}`} alt="" className="w-full h-full object-cover" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-medium text-white truncate">{r.title} <span className="text-gray-500 font-normal">{r.year}</span></div>
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
          <Score r={r} />
          <Binge r={r} />
          <LiveBadge r={r} />
          <span className="text-gray-400">{name(r.platform)}</span>
          {r.traktNextEpisode && isLive(r) && <span className="text-gray-500">next {r.traktNextEpisode}</span>}
        </div>
        <div className="mt-1 text-[11px] text-gray-500">
          {r.numberOfSeasons ? `${r.numberOfSeasons} season${r.numberOfSeasons === 1 ? '' : 's'}` : ''}
          {r.showStatus ? ` · ${r.showStatus}` : ''}
        </div>
      </div>
    </div>
  );
}

function WaitingRow({ w, name }: { w: WaitingShow; name: (slug: string) => string }) {
  const r = w.row;
  const where = w.reason === 'caught-up'
    ? 'caught up — waiting on a new season'
    : w.reason === 'not-in-au'
      ? `S${r.nextSeason} not streaming in Australia yet`
      : `S${r.nextSeason} only on ${w.nextSeasonOn.map(name).join(', ')}`;
  return (
    <li className="flex items-center gap-2 py-1.5 border-b border-gray-800 last:border-0 text-sm">
      <Score r={r} />
      <span className="text-xs"><Binge r={r} /></span>
      <span className="text-white truncate">{r.title}</span>
      <ModeBadge mode={r.watchMode} />
      {r.traktNextEpisode && <span className="text-[11px] text-gray-500">next {r.traktNextEpisode}</span>}
      <span className="ml-auto text-[11px] text-gray-400 text-right">{where}</span>
    </li>
  );
}

type AlsoOn = Record<number, string[]>;

function ShelfRow({ r, alsoOnMap, name }: { r: PlatformShowRow; alsoOnMap: AlsoOn; name: (slug: string) => string }) {
  const alsoOn = (alsoOnMap[r.tmdbId] || []).filter((p) => p !== r.platform);
  return (
    <li className="flex items-center gap-2 py-1.5 border-b border-gray-800 last:border-0 text-sm">
      <Score r={r} />
      <span className="text-xs"><Binge r={r} /></span>
      <span className="text-white truncate">{r.title}</span>
      <span className="text-gray-500 text-xs">{r.year}</span>
      <ModeBadge mode={r.watchMode} />
      {r.exclusiveToPlatform && <span className="px-1.5 py-0.5 rounded text-[10px] bg-gray-700 text-gray-300">exclusive</span>}
      <span className="ml-auto text-[11px] text-gray-500 whitespace-nowrap">
        {r.numberOfSeasons ? `${r.numberOfSeasons}s` : ''}
        {alsoOn.length ? ` · also ${alsoOn.map(name).join(', ')}` : ''}
      </span>
    </li>
  );
}

function PlatformSection({ s, rows, alsoOnMap, name }: { s: PlatformSummary; rows: PlatformShowRow[]; alsoOnMap: AlsoOn; name: (slug: string) => string }) {
  const worth = worthItRows(rows);
  const live = worth.filter(isLive);
  const cold = worth.filter((r) => !isLive(r));
  const tail = tier35Rows(rows);
  const status = s.subscribed ? 'Subscribed' : FREE_PLATFORMS.has(s.platform) ? 'Free' : 'Not subscribed';
  return (
    <details id={s.platform} open={s.subscribed} className={`rounded-lg ring-1 ${s.subscribed ? 'ring-emerald-700/60 bg-gray-800/80' : 'ring-gray-700 bg-gray-800/40'}`}>
      <summary className="cursor-pointer select-none px-3 py-2.5 flex flex-wrap items-center gap-2">
        <span className={`inline-flex items-center justify-center w-9 h-7 rounded font-bold text-white text-sm ${GRADE_COLORS[s.grade]}`}>{s.grade}</span>
        <span className="font-semibold text-white">{name(s.platform)}</span>
        <span className={`text-xs px-1.5 py-0.5 rounded ${s.subscribed ? 'bg-emerald-800 text-emerald-100' : 'bg-gray-700 text-gray-300'}`}>{status}</span>
        <span className="text-xs text-gray-400 ml-auto">
          {s.worthIt4plus} worth it · {s.worthItExclusive} exclusive · {s.worthItLive} live · {s.worthItSolo}/{s.worthItTogether} solo/together · {s.tier35} at 3.5★
        </span>
      </summary>
      <div className="px-3 pb-3 space-y-3">
        <p className="text-xs text-gray-400">{s.gradeReason}. {s.worthIt45plus} at 4.5★+, {s.worthItSingleSeason} single-season, {s.worthItSeasonsTotal} seasons in total.</p>
        {live.length > 0 && (
          <div>
            <h4 className="text-xs uppercase tracking-wide text-blue-300 mb-1">In progress ({live.length})</h4>
            <ul>{live.map((r) => <ShelfRow key={r.tmdbId} r={r} alsoOnMap={alsoOnMap} name={name} />)}</ul>
          </div>
        )}
        {cold.length > 0 && (
          <div>
            <h4 className="text-xs uppercase tracking-wide text-gray-300 mb-1">Cold starts ({cold.length})</h4>
            <ul>{cold.map((r) => <ShelfRow key={r.tmdbId} r={r} alsoOnMap={alsoOnMap} name={name} />)}</ul>
          </div>
        )}
        {worth.length === 0 && <p className="text-sm text-gray-500">Nothing at 4★ or better left to watch here.</p>}
        {tail.length > 0 && (
          <p className="text-xs text-gray-500">
            <span className="text-gray-400">3.5★ tail:</span> {tail.map((r) => r.title).join(', ')}
          </p>
        )}
      </div>
    </details>
  );
}

export default async function PlatformsPage() {
  const report = await getPlatformReport();
  const name = (slug: string) => report.names[slug] || FALLBACK_NAMES[slug] || slug;
  const subscribedNames = report.subscribed.map(name).join(', ') || 'none';
  const solo = report.next.filter((r) => r.watchMode === 'solo').slice(0, 6);
  const together = report.next.filter((r) => r.watchMode === 'together').slice(0, 6);
  const unassigned = report.next.filter((r) => !r.watchMode).slice(0, 4);
  const streamingAge = report.streamingAgeDays;

  return (
    <div className="min-h-screen bg-gray-900 text-white p-3 sm:p-8">
    <main className="max-w-6xl mx-auto space-y-8">
      <header>
        <h1 className="text-2xl font-bold text-white">Platforms</h1>
        <p className="text-sm text-gray-400 mt-1">
          Subscribed: <span className="text-gray-200">{subscribedNames}</span>.
          {' '}&ldquo;Worth it&rdquo; = unfinished, not stalled, and 4★ or better (your rating if rated, otherwise the prediction, shown with ~).
          {' '}A show only counts where the season you need next is actually streaming: season 1 for a cold start, the next episode&rsquo;s season when in progress.
        </p>
        <p className="text-xs text-gray-500 mt-1">
          {report.showCount} shows · episode progress {report.progressAt ? `from the ${report.progressAt.slice(0, 10)} Trakt capture` : 'never synced'} · streaming availability {streamingAge == null ? 'never refreshed' : `refreshed ${streamingAge} day${streamingAge === 1 ? '' : 's'} ago`}
          {streamingAge != null && streamingAge > 14 ? ' — run /sync-library' : ''}
          {' '}· Foxtel Now is left out: JustWatch still lists it for HBO titles that are on Max, and it is not a service you would subscribe to.
        </p>
      </header>

      <section>
        <h2 className="text-lg font-semibold text-white mb-2">Watch next <span className="text-sm font-normal text-gray-400">on {subscribedNames}</span></h2>
        {report.next.length === 0 ? (
          <p className="text-sm text-gray-500">Nothing at 4★+ on a subscribed service. Check the grades below for where the shelf is.</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <h3 className="text-xs uppercase tracking-wide text-purple-300 mb-2">Solo</h3>
              <div className="space-y-2">{solo.map((r) => <NextCard key={r.tmdbId} r={r} name={name} />)}</div>
              {solo.length === 0 && <p className="text-sm text-gray-500">Nothing solo at 4★+.</p>}
            </div>
            <div>
              <h3 className="text-xs uppercase tracking-wide text-pink-300 mb-2">Together</h3>
              <div className="space-y-2">{together.map((r) => <NextCard key={r.tmdbId} r={r} name={name} />)}</div>
              {together.length === 0 && <p className="text-sm text-gray-500">Nothing together at 4★+.</p>}
            </div>
            {unassigned.length > 0 && (
              <div className="md:col-span-2">
                <h3 className="text-xs uppercase tracking-wide text-gray-400 mb-2">No watch mode set</h3>
                <div className="grid gap-2 md:grid-cols-2">{unassigned.map((r) => <NextCard key={r.tmdbId} r={r} name={name} />)}</div>
              </div>
            )}
          </div>
        )}
        {report.waiting.length > 0 && (
          <details className="mt-4 rounded-lg ring-1 ring-gray-700 bg-gray-800/40">
            <summary className="cursor-pointer select-none px-3 py-2 text-sm text-gray-300">
              Waiting <span className="text-gray-500">({report.waiting.length}) — 4★+ on your services, but the next season isn&rsquo;t</span>
            </summary>
            <ul className="px-3 pb-2">{report.waiting.map((w) => <WaitingRow key={w.row.tmdbId} w={w} name={name} />)}</ul>
          </details>
        )}
        <p className="text-xs text-gray-500 mt-2">
          Live shows first, then by score. <Link href="/shows?status=watchlist&unrated=true&sort=predicted" className="text-blue-400 hover:underline">Open the full watchlist →</Link>
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-white mb-2">Report card</h2>
        <div className="overflow-x-auto rounded-lg ring-1 ring-gray-700">
          <table className="w-full text-sm">
            <thead className="bg-gray-800 text-gray-300 text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-3 py-2">Platform</th>
                <th className="text-left px-2 py-2">Grade</th>
                <th className="text-right px-2 py-2">4★+ worth it</th>
                <th className="text-right px-2 py-2">Exclusive</th>
                <th className="text-right px-2 py-2">Live now</th>
                <th className="text-right px-2 py-2">Solo / Together</th>
                <th className="text-right px-2 py-2">3.5★ tail</th>
                <th className="text-left px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {report.summary.map((s) => (
                <tr key={s.platform} className={`border-t border-gray-800 ${s.subscribed ? 'bg-emerald-950/40' : ''}`}>
                  <td className="px-3 py-2"><a href={`#${s.platform}`} className="text-white hover:underline">{name(s.platform)}</a></td>
                  <td className="px-2 py-2"><span className={`inline-block px-2 py-0.5 rounded font-bold text-white ${GRADE_COLORS[s.grade]}`} title={s.gradeReason}>{s.grade}</span></td>
                  <td className="px-2 py-2 text-right text-white">{s.worthIt4plus}</td>
                  <td className="px-2 py-2 text-right text-gray-300">{s.worthItExclusive}</td>
                  <td className="px-2 py-2 text-right text-gray-300">{s.worthItLive}</td>
                  <td className="px-2 py-2 text-right text-gray-300">{s.worthItSolo} / {s.worthItTogether}</td>
                  <td className="px-2 py-2 text-right text-gray-500">{s.tier35}</td>
                  <td className="px-3 py-2 text-xs">
                    <span className={s.subscribed ? 'text-emerald-300' : FREE_PLATFORMS.has(s.platform) ? 'text-sky-300' : 'text-gray-400'}>
                      {s.subscribed ? 'Subscribed' : FREE_PLATFORMS.has(s.platform) ? 'Free' : 'Not subscribed'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Grade starts from the 4★+ count (20+ A, 15 A-, 11 B+, 8 B, 6 C+, 4 C, 2 D+), then moves one step: down when under 30% is exclusive, up when half or more is live, down when subscribed with nothing live. Hover a grade for the reason.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-white mb-2">Shelves</h2>
        <div className="space-y-2">
          {report.summary.map((s) => (
            <PlatformSection key={s.platform} s={s} rows={report.rows.filter((r) => r.platform === s.platform)} alsoOnMap={report.alsoOn} name={name} />
          ))}
        </div>
        <p className="text-xs text-gray-500 mt-3">
          Unstarted scores are predictions (MAE about 0.5★). Grades resting on rated, in-progress shows are firmer than grades resting on cold starts.
        </p>
      </section>
    </main>
    </div>
  );
}
