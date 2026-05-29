import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { TrendingUp, Calendar, BarChart3, Clock, Award, Flame } from "lucide-react";

interface DayReport {
  date: string;
  day_name: string;
  total_minutes: number;
  productive_minutes: number;
  distracting_minutes: number;
  score: number;
  hourly: number[];
}

function getHeatmapOpacity(minutes: number): string {
  if (minutes === 0) return "bg-slate-800/50";
  if (minutes < 5) return "bg-blue-500 opacity-10";
  if (minutes < 15) return "bg-blue-500 opacity-30";
  if (minutes < 30) return "bg-blue-500 opacity-50";
  if (minutes < 45) return "bg-blue-500 opacity-70";
  return "bg-blue-500 opacity-90";
}

function formatHour(hour: number): string {
  if (hour === 0) return "12am";
  if (hour < 12) return `${hour}am`;
  if (hour === 12) return "12pm";
  return `${hour - 12}pm`;
}

const HEATMAP_START_HOUR = 6;
const HEATMAP_END_HOUR = 23;

export default function AnalyticsView() {
  const [data, setData] = useState<DayReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const res = await fetch("http://127.0.0.1:8000/api/reports/weekly");
        if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`);
        const json: DayReport[] = await res.json();
        setData(json);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        <Clock className="w-5 h-5 animate-spin mr-2" />
        Loading analytics…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64 text-red-400">
        Failed to load analytics: {error}
      </div>
    );
  }

  // ── Weekly summary calculations ──
  const totalMinutes = data.reduce((s, d) => s + d.total_minutes, 0);
  const totalHours = totalMinutes / 60;
  const avgScore =
    data.length > 0
      ? Math.round(data.reduce((s, d) => s + d.score, 0) / data.length)
      : 0;
  const bestDay =
    data.length > 0
      ? data.reduce((best, d) => (d.score > best.score ? d : best), data[0])
      : null;

  // ── Heatmap hours range ──
  const hours = Array.from(
    { length: HEATMAP_END_HOUR - HEATMAP_START_HOUR + 1 },
    (_, i) => HEATMAP_START_HOUR + i
  );

  // ── Chart data for stacked bar ──
  const chartData = data.map((d) => ({
    day: d.day_name,
    Productive: Math.round(d.productive_minutes * 10) / 10,
    Distracting: Math.round(d.distracting_minutes * 10) / 10,
  }));

  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="space-y-6 p-4"
    >
      {/* ── Header ── */}
      <div className="flex items-center gap-3">
        <BarChart3 className="w-6 h-6 text-blue-400" />
        <h2 className="text-2xl font-bold text-slate-100">Weekly Analytics</h2>
      </div>

      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Total Hours */}
        <motion.div
          initial={{ y: 12, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="rounded-xl bg-slate-900/40 border border-slate-800 p-5 flex items-center gap-4"
        >
          <div className="p-3 rounded-lg bg-blue-500/10">
            <Clock className="w-6 h-6 text-blue-400" />
          </div>
          <div>
            <p className="text-sm text-slate-400">Total Hours</p>
            <p className="text-2xl font-bold text-slate-100">
              {totalHours.toFixed(1)}
              <span className="text-sm font-normal text-slate-500 ml-1">hrs</span>
            </p>
          </div>
        </motion.div>

        {/* Avg Score */}
        <motion.div
          initial={{ y: 12, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.15 }}
          className="rounded-xl bg-slate-900/40 border border-slate-800 p-5 flex items-center gap-4"
        >
          <div className="p-3 rounded-lg bg-emerald-500/10">
            <TrendingUp className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <p className="text-sm text-slate-400">Avg Score</p>
            <p className="text-2xl font-bold text-slate-100">
              {avgScore}
              <span className="text-sm font-normal text-slate-500 ml-1">/ 100</span>
            </p>
          </div>
        </motion.div>

        {/* Best Day */}
        <motion.div
          initial={{ y: 12, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="rounded-xl bg-slate-900/40 border border-slate-800 p-5 flex items-center gap-4"
        >
          <div className="p-3 rounded-lg bg-amber-500/10">
            <Award className="w-6 h-6 text-amber-400" />
          </div>
          <div>
            <p className="text-sm text-slate-400">Best Day</p>
            {bestDay ? (
              <p className="text-2xl font-bold text-slate-100">
                {bestDay.day_name}
                <span className="text-sm font-normal text-slate-500 ml-1">
                  score {bestDay.score}
                </span>
              </p>
            ) : (
              <p className="text-lg text-slate-500">—</p>
            )}
          </div>
        </motion.div>
      </div>

      {/* ── Activity Heatmap ── */}
      <motion.div
        initial={{ y: 12, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.25 }}
        className="rounded-xl bg-slate-900/40 border border-slate-800 p-5"
      >
        <div className="flex items-center gap-2 mb-4">
          <Flame className="w-5 h-5 text-orange-400" />
          <h3 className="text-lg font-semibold text-slate-100">Activity Heatmap</h3>
          <span className="text-xs text-slate-500 ml-auto">6 AM – 11 PM</span>
        </div>

        <div className="overflow-x-auto">
          {/* Column headers (days) */}
          <div
            className="grid gap-1 mb-1"
            style={{
              gridTemplateColumns: `56px repeat(${data.length}, minmax(40px, 1fr))`,
            }}
          >
            <div /> {/* empty corner */}
            {data.map((d) => (
              <div
                key={d.date}
                className="text-center text-xs font-medium text-slate-400"
              >
                {d.day_name}
              </div>
            ))}
          </div>

          {/* Heatmap grid: rows = hours, columns = days */}
          {hours.map((hour) => (
            <div
              key={hour}
              className="grid gap-1 mb-1"
              style={{
                gridTemplateColumns: `56px repeat(${data.length}, minmax(40px, 1fr))`,
              }}
            >
              <div className="text-xs text-slate-500 flex items-center justify-end pr-2 tabular-nums">
                {formatHour(hour)}
              </div>
              {data.map((d) => {
                const minutes = d.hourly?.[hour] ?? 0;
                return (
                  <div
                    key={`${d.date}-${hour}`}
                    title={`${d.day_name} ${formatHour(hour)}: ${Math.round(minutes)} min`}
                    className={`rounded-sm h-5 ${getHeatmapOpacity(minutes)} transition-colors`}
                  />
                );
              })}
            </div>
          ))}

          {/* Legend */}
          <div className="flex items-center gap-2 mt-3 justify-end">
            <span className="text-xs text-slate-500">Less</span>
            <div className="w-4 h-4 rounded-sm bg-slate-800/50" />
            <div className="w-4 h-4 rounded-sm bg-blue-500 opacity-10" />
            <div className="w-4 h-4 rounded-sm bg-blue-500 opacity-30" />
            <div className="w-4 h-4 rounded-sm bg-blue-500 opacity-50" />
            <div className="w-4 h-4 rounded-sm bg-blue-500 opacity-70" />
            <div className="w-4 h-4 rounded-sm bg-blue-500 opacity-90" />
            <span className="text-xs text-slate-500">More</span>
          </div>
        </div>
      </motion.div>

      {/* ── Stacked Bar Chart ── */}
      <motion.div
        initial={{ y: 12, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="rounded-xl bg-slate-900/40 border border-slate-800 p-5"
      >
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="w-5 h-5 text-blue-400" />
          <h3 className="text-lg font-semibold text-slate-100">
            Daily Breakdown
          </h3>
        </div>

        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData} barCategoryGap="20%">
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
            <XAxis
              dataKey="day"
              tick={{ fill: "#94a3b8", fontSize: 12 }}
              axisLine={{ stroke: "#334155" }}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: "#94a3b8", fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              label={{
                value: "Minutes",
                angle: -90,
                position: "insideLeft",
                fill: "#64748b",
                fontSize: 12,
              }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#1e293b",
                border: "1px solid #334155",
                borderRadius: "8px",
                color: "#f1f5f9",
                fontSize: 13,
              }}
              cursor={{ fill: "rgba(148,163,184,0.08)" }}
              formatter={(value) => `${Number(value ?? 0)} min`}
            />
            <Legend
              wrapperStyle={{ color: "#94a3b8", fontSize: 12, paddingTop: 8 }}
            />
            <Bar
              dataKey="Productive"
              stackId="stack"
              fill="#3b82f6"
              radius={[0, 0, 0, 0]}
            />
            <Bar
              dataKey="Distracting"
              stackId="stack"
              fill="#f43f5e"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </motion.div>
    </motion.div>
  );
}
