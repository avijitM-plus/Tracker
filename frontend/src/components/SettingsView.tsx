import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Settings2, Save, X, Plus } from "lucide-react";

interface SettingsData {
  productive_keywords: string;
  distracting_keywords: string;
  learning_keywords: string;
  communication_keywords: string;
  blocked_domains: string;
  idle_timeout: string;
  screenshot_interval: string;
  enable_screenshots: string;
}

type TagCategory = keyof Pick<
  SettingsData,
  | "productive_keywords"
  | "distracting_keywords"
  | "learning_keywords"
  | "communication_keywords"
  | "blocked_domains"
>;

type NumericKey = keyof Pick<SettingsData, "idle_timeout" | "screenshot_interval">;

const TAG_CATEGORIES: {
  key: TagCategory;
  label: string;
  color: string;
  bg: string;
  border: string;
  inputRing: string;
}[] = [
  {
    key: "productive_keywords",
    label: "Productive Keywords",
    color: "text-blue-300",
    bg: "bg-blue-500/20",
    border: "border-blue-500/40",
    inputRing: "focus:ring-blue-500/50",
  },
  {
    key: "distracting_keywords",
    label: "Distracting Keywords",
    color: "text-red-300",
    bg: "bg-red-500/20",
    border: "border-red-500/40",
    inputRing: "focus:ring-red-500/50",
  },
  {
    key: "learning_keywords",
    label: "Learning Keywords",
    color: "text-green-300",
    bg: "bg-green-500/20",
    border: "border-green-500/40",
    inputRing: "focus:ring-green-500/50",
  },
  {
    key: "communication_keywords",
    label: "Communication Keywords",
    color: "text-purple-300",
    bg: "bg-purple-500/20",
    border: "border-purple-500/40",
    inputRing: "focus:ring-purple-500/50",
  },
  {
    key: "blocked_domains",
    label: "Blocked Domains",
    color: "text-orange-300",
    bg: "bg-orange-500/20",
    border: "border-orange-500/40",
    inputRing: "focus:ring-orange-500/50",
  },
];

const NUMERIC_FIELDS: { key: NumericKey; label: string }[] = [
  { key: "idle_timeout", label: "Idle Timeout (seconds)" },
  { key: "screenshot_interval", label: "Screenshot Interval (seconds)" },
];

function parseTags(raw: string): string[] {
  return raw
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

function joinTags(tags: string[]): string {
  return tags.join(",");
}

export default function SettingsView() {
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [tags, setTags] = useState<Record<TagCategory, string[]>>(
    {} as Record<TagCategory, string[]>
  );
  const [numerics, setNumerics] = useState<Record<NumericKey, string>>(
    {} as Record<NumericKey, string>
  );
  const [newInputs, setNewInputs] = useState<Record<TagCategory, string>>(
    {} as Record<TagCategory, string>
  );
  const [enableScreenshots, setEnableScreenshots] = useState<boolean>(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const hydrateFromData = useCallback((data: SettingsData) => {
    setSettings(data);
    const tagState = {} as Record<TagCategory, string[]>;
    const inputState = {} as Record<TagCategory, string>;
    for (const cat of TAG_CATEGORIES) {
      tagState[cat.key] = parseTags(data[cat.key]);
      inputState[cat.key] = "";
    }
    setTags(tagState);
    setNewInputs(inputState);

    const numState = {} as Record<NumericKey, string>;
    for (const f of NUMERIC_FIELDS) {
      numState[f.key] = data[f.key];
    }
    setNumerics(numState);
    setEnableScreenshots(data.enable_screenshots === "true");
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("http://127.0.0.1:8000/api/settings");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: SettingsData = await res.json();
        if (!cancelled) {
          hydrateFromData(data);
          setLoading(false);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load settings");
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hydrateFromData]);

  const removeTag = (category: TagCategory, index: number) => {
    setTags((prev) => ({
      ...prev,
      [category]: prev[category].filter((_, i) => i !== index),
    }));
  };

  const addTag = (category: TagCategory) => {
    const value = newInputs[category].trim();
    if (!value) return;
    if (tags[category].includes(value)) {
      setNewInputs((prev) => ({ ...prev, [category]: "" }));
      return;
    }
    setTags((prev) => ({
      ...prev,
      [category]: [...prev[category], value],
    }));
    setNewInputs((prev) => ({ ...prev, [category]: "" }));
  };

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const payload: Record<string, string> = {};
      for (const cat of TAG_CATEGORIES) {
        payload[cat.key] = joinTags(tags[cat.key]);
      }
      for (const f of NUMERIC_FIELDS) {
        payload[f.key] = numerics[f.key];
      }
      payload["enable_screenshots"] = enableScreenshots ? "true" : "false";
      const res = await fetch("http://127.0.0.1:8000/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: payload }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex items-center justify-center h-64 text-slate-400"
      >
        <Settings2 className="w-5 h-5 animate-spin mr-2" />
        Loading settings…
      </motion.div>
    );
  }

  if (error && !settings) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex items-center justify-center h-64 text-red-400"
      >
        {error}
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 space-y-8"
    >
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-slate-800/60">
          <Settings2 className="w-5 h-5 text-slate-300" />
        </div>
        <h2 className="text-xl font-semibold text-slate-100">Settings</h2>
      </div>

      {/* Tag Categories */}
      {TAG_CATEGORIES.map((cat) => (
        <motion.section
          key={cat.key}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="space-y-3"
        >
          <label className={`text-sm font-medium ${cat.color}`}>
            {cat.label}
          </label>

          <div className="flex flex-wrap gap-2">
            <AnimatePresence mode="popLayout">
              {tags[cat.key].map((tag, idx) => (
                <motion.span
                  key={tag}
                  layout
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.15 }}
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${cat.bg} ${cat.border} border ${cat.color}`}
                >
                  {tag}
                  <button
                    onClick={() => removeTag(cat.key, idx)}
                    className="hover:bg-white/10 rounded-full p-0.5 transition-colors"
                    aria-label={`Remove ${tag}`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </motion.span>
              ))}
            </AnimatePresence>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newInputs[cat.key]}
              onChange={(e) =>
                setNewInputs((prev) => ({
                  ...prev,
                  [cat.key]: e.target.value,
                }))
              }
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addTag(cat.key);
                }
              }}
              placeholder={`Add ${cat.label.toLowerCase().replace(" keywords", "").replace(" domains", "")}…`}
              className={`flex-1 max-w-xs bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-200 placeholder-slate-500 outline-none focus:ring-2 ${cat.inputRing} transition-all`}
            />
            <button
              onClick={() => addTag(cat.key)}
              className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium ${cat.bg} ${cat.border} border ${cat.color} hover:brightness-125 transition-all`}
            >
              <Plus className="w-3.5 h-3.5" />
              Add
            </button>
          </div>
        </motion.section>
      ))}

      {/* Screenshot Toggle — saves instantly on click */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className={`flex items-center justify-between rounded-xl p-4 border transition-colors duration-300 ${
          enableScreenshots 
            ? 'bg-cyan-500/5 border-cyan-500/30' 
            : 'bg-slate-800/30 border-slate-700/50'
        }`}
      >
        <div>
          <label className="text-sm font-medium text-slate-200 block">Take Screenshots</label>
          <span className="text-xs text-slate-500">
            {enableScreenshots ? '📸 Capturing your screen every 60s' : '⏸ Screenshot capture is paused'}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-xs font-medium transition-colors ${enableScreenshots ? 'text-cyan-400' : 'text-slate-500'}`}>
            {enableScreenshots ? 'ON' : 'OFF'}
          </span>
          <button
            onClick={async () => {
              const newValue = !enableScreenshots;
              setEnableScreenshots(newValue);
              try {
                const res = await fetch('http://127.0.0.1:8000/api/settings', {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ settings: { enable_screenshots: newValue ? 'true' : 'false' } }),
                });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
              } catch {
                // Revert on failure
                setEnableScreenshots(!newValue);
                setError('Failed to update screenshot setting');
              }
            }}
            className={`w-12 h-6 rounded-full transition-colors relative ${enableScreenshots ? 'bg-cyan-500' : 'bg-slate-700'}`}
          >
            <motion.div
              className="w-4 h-4 bg-white rounded-full absolute top-1 left-1"
              initial={false}
              animate={{ x: enableScreenshots ? 24 : 0 }}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
            />
          </button>
        </div>
      </motion.div>

      {/* Numeric Fields */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {NUMERIC_FIELDS.map((field) => (
          <motion.div
            key={field.key}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="space-y-2"
          >
            <label className="text-sm font-medium text-slate-300">
              {field.label}
            </label>
            <input
              type="number"
              min={1}
              value={numerics[field.key]}
              onChange={(e) =>
                setNumerics((prev) => ({
                  ...prev,
                  [field.key]: e.target.value,
                }))
              }
              className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none focus:ring-2 focus:ring-cyan-500/50 transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          </motion.div>
        ))}
      </div>

      {/* Error banner */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-2"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Save Button */}
      <div className="flex items-center gap-3 pt-2">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Save className="w-4 h-4" />
          {saving ? "Saving…" : "Save Settings"}
        </motion.button>

        <AnimatePresence>
          {saved && (
            <motion.span
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              className="text-sm font-medium text-emerald-400"
            >
              ✓ Saved!
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
