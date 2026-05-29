import { useEffect, useState, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { Camera, ChevronLeft, ChevronRight, Play, Pause, Clock } from 'lucide-react';

interface Screenshot {
  url: string;
  timestamp: string;
}

export default function GalleryView() {
  const [screenshots, setScreenshots] = useState<Screenshot[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isAutoPlaying, setIsAutoPlaying] = useState(false);
  const filmstripRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('http://127.0.0.1:8000/api/reports/screenshots')
      .then(res => res.json())
      .then(data => {
        setScreenshots([...data].reverse());
        setSelectedIndex(data.length > 0 ? data.length - 1 : 0);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Auto-scroll filmstrip to keep active thumbnail centered
  useEffect(() => {
    if (!filmstripRef.current || screenshots.length === 0) return;
    const container = filmstripRef.current;
    const activeChild = container.children[selectedIndex] as HTMLElement;
    if (activeChild) {
      const containerWidth = container.clientWidth;
      const childOffset = activeChild.offsetLeft;
      const childWidth = activeChild.clientWidth;
      container.scrollTo({
        left: childOffset - containerWidth / 2 + childWidth / 2,
        behavior: 'smooth'
      });
    }
  }, [selectedIndex, screenshots.length]);

  // Keyboard navigation
  const handleKey = useCallback((e: KeyboardEvent) => {
    if (e.key === 'ArrowLeft') {
      setSelectedIndex(i => Math.max(0, i - 1));
      setIsAutoPlaying(false);
    } else if (e.key === 'ArrowRight') {
      setSelectedIndex(i => Math.min(screenshots.length - 1, i + 1));
      setIsAutoPlaying(false);
    } else if (e.key === ' ') {
      e.preventDefault();
      setIsAutoPlaying(p => !p);
    }
  }, [screenshots.length]);

  useEffect(() => {
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleKey]);

  // Auto-play: advance 1 frame per second
  useEffect(() => {
    if (!isAutoPlaying) return;
    const interval = setInterval(() => {
      setSelectedIndex(i => {
        if (i >= screenshots.length - 1) {
          setIsAutoPlaying(false);
          return i;
        }
        return i + 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isAutoPlaying, screenshots.length]);

  const current = screenshots[selectedIndex];

  const formatTime = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch { return ''; }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        <Camera className="w-5 h-5 animate-pulse mr-2" /> Loading screenshots...
      </div>
    );
  }

  if (screenshots.length === 0) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center h-64 text-slate-500 gap-3">
        <Camera className="w-12 h-12 text-slate-700" />
        <p>No screenshots captured yet.</p>
        <p className="text-sm text-slate-600">Screenshots are taken every 60 seconds while tracking.</p>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      style={{
        display: 'grid',
        gridTemplateRows: 'auto 1fr auto auto',
        height: 'calc(100vh - 8rem)',
        gap: '0.5rem',
        overflow: 'hidden',
      }}
    >
      {/* Row 1: Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Camera className="w-5 h-5 text-blue-400" />
          <h2 className="text-xl font-semibold text-slate-100">DVR Playback</h2>
          <span className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full">{screenshots.length} frames</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Clock className="w-3.5 h-3.5" />
          {current && formatTime(current.timestamp)}
          <span className="text-slate-600 ml-2">Frame {selectedIndex + 1} / {screenshots.length}</span>
        </div>
      </div>

      {/* Row 2: Main Viewer — 1fr takes ALL remaining space */}
      <div
        style={{ position: 'relative', overflow: 'hidden', minHeight: 0, minWidth: 0 }}
        className="rounded-2xl bg-slate-900/60 border border-slate-800 cursor-pointer"
        onClick={(e) => {
          if ((e.target as HTMLElement).closest('button')) return;
          const rect = e.currentTarget.getBoundingClientRect();
          const isRightHalf = e.clientX > rect.left + rect.width / 2;
          if (isRightHalf) {
            setSelectedIndex(i => Math.min(screenshots.length - 1, i + 1));
          } else {
            setSelectedIndex(i => Math.max(0, i - 1));
          }
          setIsAutoPlaying(false);
        }}
      >
        {current && (
          <img
            src={current.url}
            alt={`Screenshot at ${current.timestamp}`}
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              pointerEvents: 'none',
            }}
          />
        )}

        {/* Nav arrows */}
        <button
          onClick={() => { setSelectedIndex(i => Math.max(0, i - 1)); setIsAutoPlaying(false); }}
          disabled={selectedIndex === 0}
          className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/60 border border-slate-700 flex items-center justify-center text-slate-300 hover:text-white hover:bg-black/80 transition-all disabled:opacity-30"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <button
          onClick={() => { setSelectedIndex(i => Math.min(screenshots.length - 1, i + 1)); setIsAutoPlaying(false); }}
          disabled={selectedIndex === screenshots.length - 1}
          className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/60 border border-slate-700 flex items-center justify-center text-slate-300 hover:text-white hover:bg-black/80 transition-all disabled:opacity-30"
        >
          <ChevronRight className="w-5 h-5" />
        </button>

        {/* Autoplay badge */}
        {isAutoPlaying && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute top-3 right-3 bg-blue-500/20 text-blue-300 px-3 py-1 rounded-full text-xs font-medium border border-blue-500/30 flex items-center gap-1.5"
          >
            <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse" /> 60x Replay
          </motion.div>
        )}
      </div>

      {/* Row 3: Controls + Filmstrip — fixed height, no growth */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', minWidth: 0 }}>
        <button
          onClick={() => setIsAutoPlaying(p => !p)}
          className={`w-10 h-10 rounded-full border flex items-center justify-center transition-all flex-shrink-0 ${
            isAutoPlaying
              ? 'border-blue-500/50 text-blue-400 bg-blue-500/10'
              : 'border-slate-700 text-slate-400 hover:text-white hover:border-slate-500'
          }`}
        >
          {isAutoPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
        </button>

        <div style={{ flex: '1 1 0%', minWidth: 0, position: 'relative' }}>
          <input
            type="range"
            min={0}
            max={screenshots.length - 1}
            value={selectedIndex}
            onChange={(e) => { setSelectedIndex(Number(e.target.value)); setIsAutoPlaying(false); }}
            className="w-full accent-blue-500 h-2 cursor-pointer"
          />
          {/* Filmstrip thumbnails */}
          <div
            ref={filmstripRef}
            className="custom-scrollbar"
            style={{
              display: 'flex',
              gap: '2px',
              marginTop: '4px',
              overflowX: 'auto',
              overflowY: 'hidden',
              height: '48px',
              scrollBehavior: 'smooth',
            }}
          >
            {screenshots.map((s, i) => (
              <button
                key={i}
                onClick={() => { setSelectedIndex(i); setIsAutoPlaying(false); }}
                className={`flex-shrink-0 w-16 h-10 rounded overflow-hidden border-2 transition-all ${
                  i === selectedIndex ? 'border-blue-500 opacity-100 scale-105' : 'border-transparent opacity-40 hover:opacity-70'
                }`}
              >
                <img src={s.url} alt="" className="w-full h-full object-cover" loading="lazy" />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Row 4: Help text */}
      <p className="text-xs text-slate-600 text-center">Use ← → arrow keys to navigate, Space to play/pause</p>
    </motion.div>
  );
}
