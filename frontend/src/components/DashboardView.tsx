import { useEffect, useState } from 'react';
import { AlertTriangle, Brain, Clock, Download, Flame, Gauge, ListChecks, Monitor, Play, ShieldCheck, Target, TrendingDown, TrendingUp, Trophy, Zap } from 'lucide-react';
import { motion } from 'framer-motion';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { useTrackStore } from '../store';

const CATEGORY_COLORS: Record<string, string> = {
  Work: '#3b82f6', Learning: '#10b981', Communication: '#8b5cf6',
  Entertainment: '#f43f5e', Other: '#64748b'
};

export default function DashboardView() {
  const { currentApp, currentTitle, isIdle, apm, setFocusMode } = useTrackStore();
  const [report, setReport] = useState<any>({ productivity_score: 0, insights: [], categories: {}, hourly: [] });
  const [coach, setCoach] = useState<any>(null);
  const [yesterday, setYesterday] = useState<any>(null);
  const [goals, setGoals] = useState<any[]>([]);
  const [streak, setStreak] = useState<any>({ streak: 0 });
  const [newGoalMinutes, setNewGoalMinutes] = useState(240);

  useEffect(() => {
    fetch('http://127.0.0.1:8000/api/reports/today').then(r => r.json()).then(setReport).catch(console.error);
    fetch('http://127.0.0.1:8000/api/reports/yesterday').then(r => r.json()).then(setYesterday).catch(() => {});
    fetch('http://127.0.0.1:8000/api/coach/today').then(r => r.json()).then(setCoach).catch(() => {});
    fetch('http://127.0.0.1:8000/api/goals').then(r => r.json()).then(d => Array.isArray(d) ? setGoals(d) : setGoals([])).catch(() => {});
    fetch('http://127.0.0.1:8000/api/streak').then(r => r.json()).then(setStreak).catch(() => {});
  }, []);

  const categoryData = Object.entries(report.categories || {})
    .filter(([_, v]) => (v as number) > 0)
    .map(([name, seconds]) => ({ name, value: Math.round((seconds as number) / 60) }));

  const sparklineData = (report.hourly || []).map((m: number, h: number) => ({ hour: h, minutes: m }));

  const addGoal = async () => {
    await fetch('http://127.0.0.1:8000/api/goals', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ goal_type: 'productive_time', target_minutes: newGoalMinutes })
    });
    const res = await fetch('http://127.0.0.1:8000/api/goals');
    const data = await res.json();
    setGoals(Array.isArray(data) ? data : []);
  };

  const startCoachFocus = async () => {
    setFocusMode(true);
    await fetch('http://127.0.0.1:8000/api/focus', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: true })
    }).catch(console.error);
  };

  const totalHours = report.total_seconds ? (report.total_seconds / 3600).toFixed(1) : '0';
  const scoreDelta = yesterday ? report.productivity_score - yesterday.productivity_score : null;
  const formatHour = (h: number) => {
    if (h < 0) return '—';
    if (h === 0) return '12 AM';
    if (h < 12) return `${h} AM`;
    if (h === 12) return '12 PM';
    return `${h - 12} PM`;
  };

  return (
    <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* ───── Active Session ───── */}
      <div className="col-span-2 relative group rounded-2xl bg-slate-900/40 border border-slate-800 p-6 backdrop-blur-xl overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-violet-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        <div className="flex justify-between items-start mb-6 relative z-10">
          <h3 className="text-sm font-medium text-slate-400 flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isIdle ? 'bg-amber-500' : 'bg-blue-500 animate-pulse'}`} />
            {isIdle ? 'IDLE' : 'CURRENTLY ACTIVE'}
          </h3>
          <a href="http://127.0.0.1:8000/api/reports/export" download="neurotrack_export.csv"
            className="text-xs flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-full transition-colors border border-slate-700/50">
            <Download className="w-3 h-3" /> Export CSV
          </a>
        </div>
        <div className="flex items-start gap-6 relative z-10">
          <div className="w-16 h-16 rounded-2xl bg-slate-800 flex items-center justify-center flex-shrink-0">
            <Monitor className="w-8 h-8 text-blue-400" />
          </div>
          <div className="overflow-hidden flex-1">
            <h4 className="text-3xl font-bold text-slate-100 mb-2 truncate">{currentApp || "Desktop"}</h4>
            <p className="text-slate-400 mb-4 truncate w-full">{currentTitle || "No Active Window"}</p>
            <div className="flex flex-wrap gap-3 text-sm">
              <span className="px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 font-medium border border-blue-500/20 flex items-center gap-1">
                <Clock className="w-3 h-3" /> {totalHours}h tracked
              </span>
              <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 font-medium border border-emerald-500/20 flex items-center gap-1">
                <Zap className="w-3 h-3" /> {apm} APM
              </span>
              {report.most_productive_hour >= 0 && (
                <span className="px-3 py-1 rounded-full bg-amber-500/10 text-amber-400 font-medium border border-amber-500/20 flex items-center gap-1">
                  <Trophy className="w-3 h-3" /> Peak: {formatHour(report.most_productive_hour)}
                </span>
              )}
            </div>
          </div>
        </div>
        {report.insights?.length > 0 && (
          <div className="mt-8 pt-4 border-t border-slate-800/50 relative z-10">
            <h4 className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wider flex items-center gap-1">
              <Zap className="w-3 h-3 text-violet-400" /> AI Insight
            </h4>
            <p className="text-slate-300 text-sm">{report.insights[0]}</p>
          </div>
        )}
      </div>

      {/* ───── Productivity Score + vs Yesterday ───── */}
      <div className="rounded-2xl bg-slate-900/40 border border-slate-800 p-6 backdrop-blur-xl flex flex-col justify-center items-center relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 to-fuchsia-500/10" />
        <h3 className="text-sm font-medium text-slate-400 mb-2 relative z-10 text-center">PRODUCTIVITY<br/>SCORE</h3>
        <div className="text-7xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-violet-400 to-fuchsia-400 relative z-10 my-3">
          {report.productivity_score || 0}
        </div>
        {scoreDelta !== null && scoreDelta !== 0 && (
          <div className={`flex items-center gap-1 text-sm font-medium relative z-10 ${scoreDelta > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {scoreDelta > 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
            {scoreDelta > 0 ? '+' : ''}{scoreDelta} vs yesterday
          </div>
        )}
        {streak.streak > 0 && (
          <div className="flex items-center gap-1.5 text-amber-400 text-sm font-medium relative z-10 mt-2">
            <Flame className="w-4 h-4" /> {streak.streak}-day streak!
          </div>
        )}
      </div>

      {/* ───── Today's Activity Sparkline ───── */}
      <div className="md:col-span-3 rounded-2xl bg-slate-900/40 border border-slate-800 backdrop-blur-xl overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-800/70 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center flex-shrink-0">
              <Brain className="w-5 h-5 text-cyan-300" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h3 className="text-sm font-semibold text-slate-100 uppercase tracking-wider">Neuro Coach</h3>
                {coach?.mode && (
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                    {coach.mode}
                  </span>
                )}
              </div>
              <p className="text-lg font-semibold text-slate-100 truncate">
                {coach?.title || 'Building today\'s recommendation...'}
              </p>
              <p className="text-sm text-slate-400 mt-1 max-w-3xl">
                {coach?.rationale || 'The coach uses local app, website, goal, and break signals to decide the next useful move.'}
              </p>
            </div>
          </div>
          <button
            onClick={startCoachFocus}
            disabled={!coach}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-800 disabled:text-slate-500 text-white text-sm font-semibold transition-colors"
          >
            <Play className="w-4 h-4" />
            Start {coach?.duration_minutes || 25}m Focus
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-slate-800/70">
          <div className="p-6">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-300 mb-4">
              <ListChecks className="w-4 h-4 text-emerald-400" />
              Next Moves
            </div>
            <div className="space-y-3">
              {(coach?.actions || ['Choose one task', 'Start a focused sprint', 'Review after the timer ends']).map((action: string, index: number) => (
                <div key={action} className="flex gap-3 text-sm">
                  <span className="w-5 h-5 rounded-full bg-slate-800 text-slate-400 flex items-center justify-center text-[11px] flex-shrink-0">
                    {index + 1}
                  </span>
                  <span className="text-slate-300">{action}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="p-6">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-300 mb-4">
              <Gauge className="w-4 h-4 text-amber-400" />
              Live Signals
            </div>
            <div className="grid grid-cols-2 gap-y-4 gap-x-6">
              <div>
                <p className="text-xs text-slate-500">Recent focus</p>
                <p className="text-xl font-bold text-slate-100">{coach?.metrics?.recent_productive_minutes ?? 0}m</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Recent drift</p>
                <p className="text-xl font-bold text-rose-300">{coach?.metrics?.recent_distracting_minutes ?? 0}m</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Switches / hour</p>
                <p className="text-xl font-bold text-slate-100">{coach?.metrics?.context_switches_last_hour ?? 0}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Best block</p>
                <p className="text-xl font-bold text-emerald-300">{coach?.metrics?.longest_focus_block_minutes ?? 0}m</p>
              </div>
            </div>
            {coach?.goal && (
              <div className="mt-5 pt-4 border-t border-slate-800/70">
                <div className="flex justify-between text-xs mb-2">
                  <span className="text-slate-500">Goal progress</span>
                  <span className="text-slate-300">{coach.goal.current_minutes}m / {coach.goal.target_minutes}m</span>
                </div>
                <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${coach.goal.percent}%` }} />
                </div>
              </div>
            )}
          </div>

          <div className="p-6">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-300 mb-4">
              <ShieldCheck className="w-4 h-4 text-blue-400" />
              Guardrails
            </div>
            {coach?.risk_flags?.length > 0 ? (
              <div className="space-y-3">
                {coach.risk_flags.map((risk: any) => (
                  <div key={risk.label} className="flex gap-3">
                    <AlertTriangle className={`w-4 h-4 mt-0.5 flex-shrink-0 ${risk.level === 'high' ? 'text-rose-400' : 'text-amber-400'}`} />
                    <div>
                      <p className="text-sm font-medium text-slate-200">{risk.label}</p>
                      <p className="text-xs text-slate-500">{risk.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400">No major risk flags right now. Keep the session bounded and intentional.</p>
            )}
            <div className="mt-5 pt-4 border-t border-slate-800/70">
              <p className="text-xs text-slate-500 mb-2">Protect against</p>
              <div className="flex flex-wrap gap-2">
                {(coach?.blockers || ['distractions']).map((blocker: string) => (
                  <span key={blocker} className="px-2 py-1 rounded-lg bg-slate-800/70 text-xs text-slate-300 border border-slate-700/70">
                    {blocker}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="col-span-2 rounded-2xl bg-slate-900/40 border border-slate-800 p-6 backdrop-blur-xl">
        <h3 className="text-sm font-medium text-slate-400 mb-3 uppercase tracking-wider">Today's Activity</h3>
        {sparklineData.length > 0 && sparklineData.some((d: any) => d.minutes > 0) ? (
          <div className="h-24 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={sparklineData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                <defs>
                  <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area type="monotone" dataKey="minutes" stroke="#3b82f6" strokeWidth={2} fill="url(#sparkGrad)" />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '8px', fontSize: '12px' }}
                  itemStyle={{ color: '#f8fafc' }}
                  formatter={(v) => [`${Number(v ?? 0).toFixed(1)} min`, 'Activity']}
                  labelFormatter={(h) => formatHour(Number(h))}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-24 flex items-center justify-center text-slate-600 text-sm">Activity will appear as you work...</div>
        )}
      </div>

      {/* ───── Daily Goals ───── */}
      <div className="rounded-2xl bg-slate-900/40 border border-slate-800 p-6 backdrop-blur-xl">
        <h3 className="text-sm font-medium text-slate-400 mb-4 uppercase tracking-wider flex items-center gap-1.5">
          <Target className="w-3.5 h-3.5 text-blue-400" /> Daily Goals
        </h3>
        {(!Array.isArray(goals) || goals.length === 0) ? (
          <div className="space-y-3">
            <p className="text-slate-500 text-sm">Set a productive work target.</p>
            <div className="flex gap-2">
              <input type="number" value={newGoalMinutes} onChange={(e) => setNewGoalMinutes(Number(e.target.value))}
                className="w-20 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-200 outline-none focus:border-blue-500" min={1} />
              <span className="text-slate-500 text-sm self-center">min</span>
              <button onClick={addGoal} className="ml-auto bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium px-4 py-1.5 rounded-lg transition-colors">Set Goal</button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {goals.map((g: any) => (
              <div key={g.id}>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="text-slate-300">{g.app_keyword || 'Productive Work'}</span>
                  <span className="text-slate-400">{g.current_minutes}m / {g.target_minutes}m</span>
                </div>
                <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${g.percent}%` }} transition={{ duration: 1, ease: 'easeOut' }}
                    className={`h-full rounded-full ${g.percent >= 100 ? 'bg-emerald-500' : 'bg-blue-500'}`} />
                </div>
                {g.percent >= 100 && (
                  <p className="text-xs text-emerald-400 mt-1.5 flex items-center gap-1"><Flame className="w-3 h-3" /> Goal reached!</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ───── Category Breakdown ───── */}
      <div className="col-span-2 rounded-2xl bg-slate-900/40 border border-slate-800 p-6 backdrop-blur-xl">
        <h3 className="text-sm font-medium text-slate-400 mb-4 uppercase tracking-wider">Category Breakdown</h3>
        {categoryData.length === 0 ? (
          <div className="text-slate-500 text-center py-8">No activity data yet. Start working!</div>
        ) : (
          <div className="flex items-center gap-8">
            <div className="w-48 h-48 flex-shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={categoryData} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={3} dataKey="value">
                    {categoryData.map((entry, i) => (<Cell key={i} fill={CATEGORY_COLORS[entry.name] || '#64748b'} />))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '8px' }}
                    itemStyle={{ color: '#f8fafc' }} formatter={(v) => [`${Number(v ?? 0)} min`, '']} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 grid grid-cols-2 gap-3">
              {categoryData.map((cat) => (
                <div key={cat.name} className="flex items-center gap-2.5">
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: CATEGORY_COLORS[cat.name] || '#64748b' }} />
                  <span className="text-sm text-slate-300">{cat.name}</span>
                  <span className="text-xs text-slate-500 ml-auto">{cat.value}m</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ───── Goals Card (right column) ───── */}
      <div className="rounded-2xl bg-slate-900/40 border border-slate-800 p-6 backdrop-blur-xl flex flex-col items-center justify-center">
        <div className="text-5xl mb-3">{report.productivity_score >= 70 ? '🔥' : report.productivity_score >= 40 ? '💪' : '😴'}</div>
        <p className="text-sm text-slate-400 text-center">
          {report.productivity_score >= 70 ? "You're on fire today!" : report.productivity_score >= 40 ? 'Good momentum. Keep pushing!' : 'Slow start. Time to focus!'}
        </p>
      </div>
    </motion.div>
  );
}
