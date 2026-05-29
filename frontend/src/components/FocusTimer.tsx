import { useState, useEffect } from 'react';
import { Timer, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTrackStore } from '../store';

export default function FocusTimer() {
  const { isFocusMode, setFocusMode } = useTrackStore();
  const [timeLeft, setTimeLeft] = useState(25 * 60);

  useEffect(() => {
    let interval: any;
    if (isFocusMode && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft(prev => prev - 1);
      }, 1000);
    } else if (timeLeft === 0) {
      toggleFocusMode(false);
    }
    return () => clearInterval(interval);
  }, [isFocusMode, timeLeft]);

  const toggleFocusMode = async (forceState?: boolean) => {
    const newState = forceState !== undefined ? forceState : !isFocusMode;
    setFocusMode(newState);
    if (newState) {
      setTimeLeft(25 * 60);
    }
    
    // Tell backend to update focus state
    try {
      await fetch('http://127.0.0.1:8000/api/focus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: newState })
      });
    } catch (e) {
      console.error(e);
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex items-center gap-2">
      <AnimatePresence>
        {isFocusMode && (
          <motion.div
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: 'auto' }}
            exit={{ opacity: 0, width: 0 }}
            className="flex items-center gap-3 bg-red-500/20 text-red-400 px-3 py-1.5 rounded-full border border-red-500/30 overflow-hidden"
          >
            <span className="font-mono font-bold tracking-wider">{formatTime(timeLeft)}</span>
            <button onClick={() => toggleFocusMode(false)} className="hover:text-red-300">
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      
      {!isFocusMode && (
        <button 
          onClick={() => toggleFocusMode(true)}
          className="flex items-center gap-2 text-slate-400 hover:text-red-400 hover:bg-slate-800 px-3 py-1.5 rounded-full transition-colors font-medium text-sm border border-transparent hover:border-red-500/30"
        >
          <Timer className="w-4 h-4" />
          <span>Focus Mode</span>
        </button>
      )}
    </div>
  );
}
