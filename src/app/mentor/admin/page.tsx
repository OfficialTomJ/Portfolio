import { notFound } from "next/navigation";
import { getSession } from "../../../lib/session";
import { isAdmin } from "../../../lib/admin";
import {
  getOverview,
  getSignupSeries,
  getCertificateSeries,
  getEpisodeFunnel,
  getEngagementTotals,
  type DayCount,
} from "../../../lib/analytics";

export const metadata = { title: "Admin — The Blueprint" };

// Private creator dashboard. Invisible (404) to anyone not in ADMIN_EMAILS.
export default async function AdminDashboard() {
  const session = await getSession();
  if (!isAdmin(session)) notFound();

  const [overview, signups, certs, funnel, engagement] = await Promise.all([
    getOverview(),
    getSignupSeries(30),
    getCertificateSeries(30),
    getEpisodeFunnel(),
    getEngagementTotals(),
  ]);

  const maxStarted = Math.max(1, ...funnel.map((f) => f.started));

  return (
    <main className="mx-auto max-w-6xl px-4 sm:px-6 py-10 space-y-10">
      <header>
        <p className="text-[var(--bp-accent)] text-sm font-medium uppercase tracking-widest mb-2">
          Admin
        </p>
        <h1 className="text-3xl font-semibold">Creator dashboard</h1>
      </header>

      {/* Overview cards */}
      <section className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <Stat label="Members" value={overview.members} />
        <Stat
          label="Verified"
          value={overview.verified}
          sub={`${pct(overview.verified, overview.members)}% of members`}
        />
        <Stat label="New signups (7d)" value={overview.signups7d} />
        <Stat label="New signups (30d)" value={overview.signups30d} />
        <Stat label="Completions" value={overview.completions} />
        <Stat
          label="Completion rate"
          value={`${overview.completionRate}%`}
          sub="of verified members"
        />
      </section>

      {/* Daily series */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Series title="Signups (last 30 days)" data={signups} />
        <Series title="Completions (last 30 days)" data={certs} />
      </section>

      {/* Episode drop-off */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Episode drop-off</h2>
        <div className="bp-surface rounded-xl overflow-hidden">
          {funnel.length === 0 && (
            <p className="p-5 text-[var(--bp-text-dim)]">No episodes yet.</p>
          )}
          {funnel.map((row, i) => (
            <div
              key={row.slug}
              className="flex items-center gap-4 px-5 py-3 border-b border-[var(--bp-border)] last:border-0"
            >
              <span className="text-sm text-[var(--bp-text-dim)] w-8 shrink-0">
                {row.episodeNumber || i + 1}
              </span>
              <span className="flex-1 min-w-0 truncate text-sm">{row.title}</span>
              <div className="hidden sm:block w-40 h-2 rounded-full bg-white/10 overflow-hidden shrink-0">
                <div
                  className="h-full bg-[var(--bp-accent)]"
                  style={{ width: `${(row.started / maxStarted) * 100}%` }}
                />
              </div>
              <span className="text-sm w-28 text-right shrink-0 text-[var(--bp-text-dim)]">
                {row.completed}/{row.started}
              </span>
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-[var(--bp-text-dim)]">
          completed / started per episode
        </p>
      </section>

      {/* Engagement */}
      <section className="grid grid-cols-3 gap-4">
        <Stat label="Comments" value={engagement.comments} />
        <Stat label="Episode likes" value={engagement.likes} />
        <Stat label="Resource downloads" value={engagement.resourceDownloads} />
      </section>
    </main>
  );
}

function pct(n: number, total: number): number {
  return total > 0 ? Math.round((n / total) * 100) : 0;
}

function Stat({
  label,
  value,
  sub,
}: {
  label: string;
  value: number | string;
  sub?: string;
}) {
  return (
    <div className="bp-surface rounded-xl p-5">
      <p className="text-sm text-[var(--bp-text-dim)]">{label}</p>
      <p className="text-3xl font-semibold mt-1">{value}</p>
      {sub && <p className="text-xs text-[var(--bp-text-dim)] mt-1">{sub}</p>}
    </div>
  );
}

function Series({ title, data }: { title: string; data: DayCount[] }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  const total = data.reduce((s, d) => s + d.count, 0);
  return (
    <div className="bp-surface rounded-xl p-5">
      <div className="flex items-baseline justify-between mb-4">
        <p className="text-sm text-[var(--bp-text-dim)]">{title}</p>
        <p className="text-sm font-medium">{total} total</p>
      </div>
      <div className="flex items-end gap-[2px] h-24">
        {data.map((d) => (
          <div
            key={d.date}
            title={`${d.date}: ${d.count}`}
            className="flex-1 bg-[var(--bp-accent)] rounded-sm min-h-[2px]"
            style={{ height: `${(d.count / max) * 100}%`, opacity: d.count ? 1 : 0.25 }}
          />
        ))}
      </div>
    </div>
  );
}
