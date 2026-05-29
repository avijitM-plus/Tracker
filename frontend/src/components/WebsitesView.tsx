import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import {
  Activity,
  AlertTriangle,
  Ban,
  BarChart3,
  Clock,
  ExternalLink,
  Film,
  Globe,
  Layers,
  MousePointerClick,
  Search,
  Shield,
  TrendingUp,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

type DomainCategory = 'Work' | 'Learning' | 'Communication' | 'Entertainment' | 'Other';
type FilterKey = 'All' | DomainCategory | 'Short-form' | 'Risk';

interface DomainRow {
  domain: string;
  category: DomainCategory;
  minutes: number;
  sessions: number;
  avg_session_minutes: number;
  longest_session_minutes: number;
  last_seen: string | null;
  trend_minutes: number;
  shortform_minutes: number;
  shortform_sessions: number;
  top_title: string;
}

interface PageRow {
  title: string;
  domain: string;
  url: string;
  minutes: number;
  visits: number;
}

interface WebsiteDeepDive {
  summary: {
    total_minutes: number;
    productive_minutes: number;
    distracting_minutes: number;
    shortform_minutes: number;
    shortform_sessions: number;
    productive_ratio: number;
    domains_count: number;
    sessions_count: number;
  };
  categories: Record<DomainCategory, number>;
  hourly: number[];
  domains: DomainRow[];
  top_pages: PageRow[];
  focus_candidates: DomainRow[];
  risk_domains: DomainRow[];
  recommendations: string[];
}

interface ExtensionStatus {
  browser_running: boolean;
  telemetry_recent: boolean;
  needs_install: boolean;
  primary_browser: string | null;
  browser_family: string | null;
  running_browsers: string[];
  seconds_since_telemetry: number | null;
  install_url: string;
  install_path: string;
  install_file: string;
  install_steps: string[];
  message: string;
}

const CATEGORY_COLORS: Record<DomainCategory, string> = {
  Work: '#38bdf8',
  Learning: '#34d399',
  Communication: '#a78bfa',
  Entertainment: '#fb7185',
  Other: '#94a3b8',
};

const FILTERS: FilterKey[] = ['All', 'Work', 'Learning', 'Communication', 'Entertainment', 'Short-form', 'Risk'];

function formatMinutes(minutes: number): string {
  if (minutes >= 60) return `${(minutes / 60).toFixed(1)}h`;
  return `${Math.round(minutes)}m`;
}

export default function WebsitesView() {
  const [data, setData] = useState<WebsiteDeepDive | null>(null);
  const [blockedDomains, setBlockedDomains] = useState<string[]>([]);
  const [rangeDays, setRangeDays] = useState(1);
  const [filter, setFilter] = useState<FilterKey>('All');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [blocking, setBlocking] = useState<string | null>(null);
  const [extensionStatus, setExtensionStatus] = useState<ExtensionStatus | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        const [deepDiveRes, settingsRes, extensionRes] = await Promise.all([
          fetch(`http://127.0.0.1:8000/api/reports/websites/deep-dive?days=${rangeDays}`),
          fetch('http://127.0.0.1:8000/api/settings'),
          fetch('http://127.0.0.1:8000/api/browser-extension/status'),
        ]);
        if (!deepDiveRes.ok) throw new Error(`HTTP ${deepDiveRes.status}`);
        const deepDive = await deepDiveRes.json();
        const settings = settingsRes.ok ? await settingsRes.json() : {};
        const extension = extensionRes.ok ? await extensionRes.json() : null;
        if (!cancelled) {
          setData(deepDive);
          setBlockedDomains(String(settings.blocked_domains || '').split(',').map((d) => d.trim()).filter(Boolean));
          setExtensionStatus(extension);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load website analytics');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadData();
    return () => {
      cancelled = true;
    };
  }, [rangeDays]);

  const filteredDomains = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return (data?.domains || []).filter((item) => {
      const matchesQuery = !normalizedQuery || item.domain.toLowerCase().includes(normalizedQuery) || item.top_title.toLowerCase().includes(normalizedQuery);
      const matchesFilter =
        filter === 'All' ||
        item.category === filter ||
        (filter === 'Short-form' && item.shortform_minutes > 0) ||
        (filter === 'Risk' && (item.category === 'Entertainment' || item.shortform_minutes > 0));
      return matchesQuery && matchesFilter;
    });
  }, [data, filter, query]);

  const categoryChart = useMemo(() => {
    if (!data) return [];
    return Object.entries(data.categories)
      .map(([name, minutes]) => ({ name: name as DomainCategory, value: minutes }))
      .filter((item) => item.value > 0);
  }, [data]);

  const hourlyChart = useMemo(() => {
    return (data?.hourly || []).map((minutes, hour) => ({
      hour,
      label: hour === 0 ? '12a' : hour < 12 ? `${hour}a` : hour === 12 ? '12p' : `${hour - 12}p`,
      minutes,
    }));
  }, [data]);

  const topDomainsChart = filteredDomains.slice(0, 8).map((item) => ({
    domain: item.domain.replace(/^www\./, ''),
    minutes: item.minutes,
    fill: CATEGORY_COLORS[item.category] || '#94a3b8',
  }));

  const blockDomain = async (domain: string) => {
    if (blockedDomains.some((blocked) => domain.includes(blocked) || blocked.includes(domain))) return;
    setBlocking(domain);
    try {
      const nextBlocked = [...blockedDomains, domain];
      const res = await fetch('http://127.0.0.1:8000/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: { blocked_domains: nextBlocked.join(',') } }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setBlockedDomains(nextBlocked);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to block domain');
    } finally {
      setBlocking(null);
    }
  };

  if (loading) {
    return (
      <div className="h-64 flex items-center justify-center text-slate-400">
        <Globe className="w-5 h-5 animate-spin mr-2" />
        Loading website intelligence...
      </div>
    );
  }

  if (error && !data) {
    return <div className="h-64 flex items-center justify-center text-rose-400">Failed to load website analytics: {error}</div>;
  }

  const summary = data?.summary;
  const showExtensionPrompt = extensionStatus?.needs_install || (!extensionStatus?.telemetry_recent && (summary?.sessions_count || 0) === 0);

  return (
    <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="space-y-6">
      {showExtensionPrompt && (
        <section className="rounded-2xl bg-amber-500/10 border border-amber-500/30 p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex gap-4">
              <div className="w-11 h-11 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center flex-shrink-0">
                <MousePointerClick className="w-5 h-5 text-amber-300" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-amber-100">
                  Install NeuroTrack extension for {extensionStatus?.primary_browser || 'your browser'}
                </h3>
                <p className="text-sm text-amber-100/70 mt-1 max-w-3xl">
                  {extensionStatus?.message || 'Website tracking needs the browser extension to send page URLs to the local tracker.'}
                </p>
                <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-2">
                  {(extensionStatus?.install_steps || [
                    'Open your browser extensions page.',
                    'Enable Developer mode.',
                    'Load D:\\Tracker\\extension.',
                  ]).map((step, index) => (
                    <div key={step} className="rounded-xl bg-slate-950/35 border border-amber-500/20 px-3 py-2 text-sm text-amber-50/85">
                      <span className="text-amber-300 font-semibold mr-2">{index + 1}</span>
                      {step}
                    </div>
                  ))}
                </div>
                {extensionStatus?.browser_family === 'firefox' && (
                  <p className="text-xs text-amber-100/70 mt-3">
                    Firefox requires the dedicated manifest file. If you loaded manifest.json, remove that temporary add-on and load manifest-firefox.json instead.
                  </p>
                )}
                <p className="text-xs text-amber-100/55 mt-3">
                  Extension folder: {extensionStatus?.install_path || 'D:\\Tracker\\extension'}
                  {extensionStatus?.browser_family === 'firefox' ? `, file: ${extensionStatus.install_file}` : ''}
                </p>
              </div>
            </div>
            <button
              onClick={() => navigator.clipboard?.writeText(extensionStatus?.install_path || 'D:\\Tracker\\extension')}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-400 text-slate-950 text-sm font-semibold hover:bg-amber-300 transition-colors"
            >
              Copy Folder Path
            </button>
          </div>
        </section>
      )}

      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-100 flex items-center gap-3">
            <Globe className="w-6 h-6 text-cyan-300" />
            Website Intelligence
          </h2>
          <p className="text-sm text-slate-500 mt-1">Domains, sessions, page trails, short-form risk, and Focus Mode blockers.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {[1, 7, 30].map((days) => (
            <button
              key={days}
              onClick={() => setRangeDays(days)}
              className={`px-3 py-2 rounded-lg text-sm border transition-colors ${
                rangeDays === days ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-200' : 'bg-slate-900/50 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              {days === 1 ? 'Today' : `${days} days`}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <MetricCard icon={<Clock className="w-5 h-5" />} label="Website Time" value={formatMinutes(summary?.total_minutes || 0)} tone="text-cyan-300" />
        <MetricCard icon={<Shield className="w-5 h-5" />} label="Useful Browsing" value={`${summary?.productive_ratio || 0}%`} tone="text-emerald-300" />
        <MetricCard icon={<Film className="w-5 h-5" />} label="Short-form" value={formatMinutes(summary?.shortform_minutes || 0)} tone="text-rose-300" />
        <MetricCard icon={<Layers className="w-5 h-5" />} label="Sessions" value={String(summary?.sessions_count || 0)} tone="text-amber-300" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <section className="xl:col-span-2 rounded-2xl bg-slate-900/40 border border-slate-800 p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between mb-5">
            <h3 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-cyan-300" />
              Domain Ranking
            </h3>
            <div className="relative w-full lg:w-72">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search domains or titles..."
                className="w-full bg-slate-950/70 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-200 outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mb-5">
            {FILTERS.map((item) => (
              <button
                key={item}
                onClick={() => setFilter(item)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  filter === item ? 'bg-slate-100 text-slate-950 border-slate-100' : 'bg-slate-950/40 text-slate-400 border-slate-800 hover:text-slate-200'
                }`}
              >
                {item}
              </button>
            ))}
          </div>

          {filteredDomains.length === 0 ? (
            <div className="h-52 flex items-center justify-center text-slate-500">No domains match this view.</div>
          ) : (
            <div className="space-y-3">
              {filteredDomains.slice(0, 12).map((item) => {
                const blocked = blockedDomains.some((blockedDomain) => item.domain.includes(blockedDomain) || blockedDomain.includes(item.domain));
                return (
                  <div key={item.domain} className="grid grid-cols-1 lg:grid-cols-[1fr_120px_110px_120px_96px] gap-3 items-center rounded-xl bg-slate-950/35 border border-slate-800 px-4 py-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-slate-100 truncate">{item.domain}</span>
                        <span className="text-[11px] px-2 py-0.5 rounded-full border" style={{ color: CATEGORY_COLORS[item.category], borderColor: `${CATEGORY_COLORS[item.category]}66`, backgroundColor: `${CATEGORY_COLORS[item.category]}1f` }}>
                          {item.category}
                        </span>
                        {item.shortform_minutes > 0 && (
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-300 border border-rose-500/30">
                            {formatMinutes(item.shortform_minutes)} short-form
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 truncate mt-1">{item.top_title || 'No page title captured'}</p>
                    </div>
                    <Stat label="Time" value={formatMinutes(item.minutes)} />
                    <Stat label="Sessions" value={String(item.sessions)} />
                    <Stat label="Avg session" value={formatMinutes(item.avg_session_minutes)} />
                    <button
                      onClick={() => blockDomain(item.domain)}
                      disabled={blocked || blocking === item.domain}
                      className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium border transition-colors ${
                        blocked ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-rose-500/10 border-rose-500/30 text-rose-300 hover:bg-rose-500/20'
                      }`}
                    >
                      <Ban className="w-3.5 h-3.5" />
                      {blocked ? 'Blocked' : blocking === item.domain ? 'Adding' : 'Block'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="rounded-2xl bg-slate-900/40 border border-slate-800 p-5">
          <h3 className="text-lg font-semibold text-slate-100 flex items-center gap-2 mb-4">
            <AlertTriangle className="w-5 h-5 text-amber-300" />
            Recommendations
          </h3>
          <div className="space-y-3">
            {(data?.recommendations || []).map((item) => (
              <div key={item} className="text-sm text-slate-300 bg-slate-950/40 border border-slate-800 rounded-xl p-3">
                {item}
              </div>
            ))}
          </div>

          <div className="mt-6 pt-5 border-t border-slate-800">
            <h4 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
              <Shield className="w-4 h-4 text-emerald-300" />
              Useful References
            </h4>
            <div className="space-y-2">
              {(data?.focus_candidates || []).slice(0, 4).map((item) => (
                <div key={item.domain} className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-slate-300 truncate">{item.domain}</span>
                  <span className="text-emerald-300 text-xs">{formatMinutes(item.minutes)}</span>
                </div>
              ))}
              {(data?.focus_candidates || []).length === 0 && <p className="text-sm text-slate-500">No productive reference domains yet.</p>}
            </div>
          </div>

          <div className="mt-6 pt-5 border-t border-slate-800">
            <h4 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
              <Film className="w-4 h-4 text-rose-300" />
              Risk Domains
            </h4>
            <div className="space-y-2">
              {(data?.risk_domains || []).slice(0, 4).map((item) => (
                <div key={item.domain} className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-slate-300 truncate">{item.domain}</span>
                  <span className="text-rose-300 text-xs">{formatMinutes(Math.max(item.shortform_minutes, item.minutes))}</span>
                </div>
              ))}
              {(data?.risk_domains || []).length === 0 && <p className="text-sm text-slate-500">No risky domains in this range.</p>}
            </div>
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <section className="rounded-2xl bg-slate-900/40 border border-slate-800 p-5">
          <h3 className="text-lg font-semibold text-slate-100 mb-4">Category Mix</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={categoryChart} innerRadius={62} outerRadius={92} paddingAngle={4} dataKey="value">
                  {categoryChart.map((item) => (
                    <Cell key={item.name} fill={CATEGORY_COLORS[item.name]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: 8 }} formatter={(value) => [`${Number(value ?? 0)} min`, '']} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="xl:col-span-2 rounded-2xl bg-slate-900/40 border border-slate-800 p-5">
          <h3 className="text-lg font-semibold text-slate-100 mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5 text-cyan-300" />
            Browsing Rhythm
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={hourlyChart} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="websiteHourGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#38bdf8" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} interval={2} />
                <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: 8 }} formatter={(value) => [`${Number(value ?? 0).toFixed(1)} min`, 'Browsing']} />
                <Area type="monotone" dataKey="minutes" stroke="#38bdf8" strokeWidth={2} fill="url(#websiteHourGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <section className="rounded-2xl bg-slate-900/40 border border-slate-800 p-5">
          <h3 className="text-lg font-semibold text-slate-100 mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-amber-300" />
            Top Domains Chart
          </h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topDomainsChart} layout="vertical" margin={{ top: 4, right: 18, left: 24, bottom: 4 }}>
                <XAxis type="number" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="domain" width={120} tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: 8 }} formatter={(value) => [`${Number(value ?? 0)} min`, 'Time']} />
                <Bar dataKey="minutes" radius={[0, 6, 6, 0]}>
                  {topDomainsChart.map((entry) => <Cell key={entry.domain} fill={entry.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="rounded-2xl bg-slate-900/40 border border-slate-800 p-5">
          <h3 className="text-lg font-semibold text-slate-100 mb-4 flex items-center gap-2">
            <ExternalLink className="w-5 h-5 text-cyan-300" />
            Top Pages
          </h3>
          <div className="space-y-3">
            {(data?.top_pages || []).slice(0, 8).map((page) => (
              <div key={`${page.domain}-${page.url || page.title}`} className="flex items-start justify-between gap-4 border-b border-slate-800/70 last:border-b-0 pb-3 last:pb-0">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-200 truncate">{page.title || page.domain}</p>
                  <p className="text-xs text-slate-500 truncate">{page.domain} · {page.visits} visits</p>
                </div>
                <span className="text-sm font-semibold text-slate-300 flex-shrink-0">{formatMinutes(page.minutes)}</span>
              </div>
            ))}
            {(data?.top_pages || []).length === 0 && <div className="h-40 flex items-center justify-center text-slate-500">No page-level data recorded.</div>}
          </div>
        </section>
      </div>

      {error && <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{error}</div>}
    </motion.div>
  );
}

function MetricCard({ icon, label, value, tone }: { icon: ReactNode; label: string; value: string; tone: string }) {
  return (
    <div className="rounded-2xl bg-slate-900/40 border border-slate-800 p-5 flex items-center gap-4">
      <div className={`w-11 h-11 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-center ${tone}`}>
        {icon}
      </div>
      <div>
        <p className="text-sm text-slate-500">{label}</p>
        <p className="text-2xl font-bold text-slate-100">{value}</p>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-slate-600">{label}</p>
      <p className="text-sm font-semibold text-slate-200">{value}</p>
    </div>
  );
}
