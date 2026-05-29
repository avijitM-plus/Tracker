import { useEffect, useState, useRef } from 'react';
import { Activity, Clock, Globe, Monitor, Zap, BarChart3, Settings2, Camera } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTrackStore } from './store';
import DashboardView from './components/DashboardView';
import AppsView from './components/AppsView';
import WebsitesView from './components/WebsitesView';
import TimelineView from './components/TimelineView';
import AnalyticsView from './components/AnalyticsView';
import SettingsView from './components/SettingsView';
import GalleryView from './components/GalleryView';
import FocusTimer from './components/FocusTimer';
import AIChat from './components/AIChat';
import ZenMode from './components/ZenMode';

// Type-safe access to Electron IPC bridge
declare global {
  interface Window {
    neurotrack?: {
      onToggleFocus: (callback: () => void) => void;
      showNotification: (title: string, body: string) => void;
    };
  }
}

type Tab = 'Dashboard' | 'Analytics' | 'Apps' | 'Websites' | 'Timeline' | 'Gallery' | 'Settings';

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('Dashboard');
  const [isConnected, setIsConnected] = useState(false);
  const continuousWorkMinutes = useRef(0);
  const lastBreakReminder = useRef(0);
  const alertedShortformSession = useRef<string | null>(null);
  const extensionInstallAlert = useRef<string | null>(null);
  
  const { setCurrentActivity, isFocusMode, setFocusMode } = useTrackStore();

  useEffect(() => {
    // WebSocket connection
    const ws = new WebSocket('ws://127.0.0.1:8000/ws/activity');
    ws.onopen = () => setIsConnected(true);
    ws.onclose = () => setIsConnected(false);
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setCurrentActivity(data);

        // ── Distraction Shield: track continuous work and distraction ──
        const isIdle = data.is_idle;
        if (!isIdle) {
          continuousWorkMinutes.current += 1 / 60; // called ~1/sec from WS
          
          // Break reminder after 90 minutes of continuous work
          const now = Date.now();
          if (continuousWorkMinutes.current >= 90 && now - lastBreakReminder.current > 30 * 60 * 1000) {
            window.neurotrack?.showNotification(
              '🧘 Break Time',
              "You've been working for 90 minutes straight. Stand up, stretch, and look away from the screen!"
            );
            lastBreakReminder.current = now;
            continuousWorkMinutes.current = 0;
          }
        } else {
          continuousWorkMinutes.current = 0; // Reset on idle
        }

        const shortformKind = data.shortform_kind;
        const shortformElapsed = Number(data.shortform_elapsed_seconds || 0);
        const shortformSessionKey = `${shortformKind || ''}|${data.website_url || ''}|${data.website_start || ''}`;
        if (shortformKind && shortformElapsed >= 30 * 60 && alertedShortformSession.current !== shortformSessionKey) {
          window.neurotrack?.showNotification(
            `${shortformKind} limit reached`,
            `You've watched ${shortformKind} for 30 minutes. Take a break or switch to Focus Mode.`
          );
          alertedShortformSession.current = shortformSessionKey;
        } else if (!shortformKind) {
          alertedShortformSession.current = null;
        }
      } catch (e) {
        console.error("Failed to parse websocket message", e);
      }
    };

    return () => ws.close();
  }, [setCurrentActivity]);

  useEffect(() => {
    const checkExtensionHealth = async () => {
      try {
        const res = await fetch('http://127.0.0.1:8000/api/browser-extension/status');
        if (!res.ok) return;
        const status = await res.json();
        const browserKey = status.primary_browser || 'browser';
        if (status.needs_install && extensionInstallAlert.current !== browserKey) {
          window.neurotrack?.showNotification(
            `Install NeuroTrack for ${status.primary_browser || 'your browser'}`,
            'Website tracking and Focus Mode blocking need the browser extension.'
          );
          extensionInstallAlert.current = browserKey;
        } else if (!status.needs_install) {
          extensionInstallAlert.current = null;
        }
      } catch {
        // Backend may still be starting.
      }
    };

    checkExtensionHealth();
    const interval = window.setInterval(checkExtensionHealth, 60 * 1000);
    return () => window.clearInterval(interval);
  }, []);

  // Listen for global shortcut from Electron (Ctrl+Shift+F)
  useEffect(() => {
    if (window.neurotrack) {
      window.neurotrack.onToggleFocus(() => {
        const newState = !useTrackStore.getState().isFocusMode;
        setFocusMode(newState);
        fetch('http://127.0.0.1:8000/api/focus', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_active: newState })
        }).catch(console.error);
      });
    }
  }, [setFocusMode]);

  return (
    <div className={`h-screen w-screen overflow-hidden flex font-sans ${isFocusMode ? 'bg-black' : 'bg-slate-950 text-slate-300'}`}>
      
      {/* ───── Zen Mode Overlay ───── */}
      <AnimatePresence>
        {isFocusMode && <ZenMode />}
      </AnimatePresence>

      {/* ───── Sidebar ───── */}
      <motion.div 
        animate={{ opacity: isFocusMode ? 0 : 1, x: isFocusMode ? -100 : 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="w-64 border-r border-slate-800/50 flex flex-col bg-slate-900/20 backdrop-blur-3xl relative z-10"
      >
        <div className="h-16 flex items-center px-6 border-b border-slate-800/50 pt-2" style={{ WebkitAppRegion: 'drag' } as any}>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
              <Activity className="w-5 h-5 text-blue-400" />
            </div>
            <span className="text-slate-100 font-bold tracking-wide">NeuroTrack</span>
          </div>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-1">
          {[
            { id: 'Dashboard', icon: <Monitor className="w-4 h-4" /> },
            { id: 'Analytics', icon: <BarChart3 className="w-4 h-4" /> },
            { id: 'Apps', icon: <Zap className="w-4 h-4" /> },
            { id: 'Websites', icon: <Globe className="w-4 h-4" /> },
            { id: 'Timeline', icon: <Clock className="w-4 h-4" /> },
            { id: 'Gallery', icon: <Camera className="w-4 h-4" /> },
            { id: 'Settings', icon: <Settings2 className="w-4 h-4" /> }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as Tab)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200 ${
                activeTab === tab.id 
                  ? 'bg-blue-500/10 text-blue-400 font-medium' 
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              {tab.icon}
              {tab.id}
            </button>
          ))}
        </nav>

        <div className="px-4 pb-3">
          <div className="text-[10px] text-slate-600 text-center">
            <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-slate-500 font-mono">Ctrl+Shift+F</kbd> Focus
            <span className="mx-1.5">·</span>
            <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-slate-500 font-mono">Ctrl+Shift+N</kbd> Hide
          </div>
        </div>

        <div className="p-6 pt-3 border-t border-slate-800/50">
          <div className="flex items-center gap-2 text-xs font-medium">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-red-500'}`} />
            <span className={isConnected ? 'text-emerald-500/70' : 'text-red-500/70'}>
              {isConnected ? 'Backend Connected' : 'Backend Offline'}
            </span>
          </div>
        </div>
      </motion.div>

      {/* ───── Main Content ───── */}
      <motion.div 
        animate={{ opacity: isFocusMode ? 0 : 1 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="flex-1 flex flex-col relative z-10"
      >
        <header className="h-16 border-b border-slate-800/50 flex items-center justify-between px-8 pt-2 backdrop-blur-xl" style={{ WebkitAppRegion: 'drag' } as any}>
          <h1 className="text-xl font-semibold text-slate-100">{activeTab}</h1>
          <div style={{ WebkitAppRegion: 'no-drag' } as any}>
            <FocusTimer />
          </div>
        </header>
        
        <main className="flex-1 p-8 overflow-y-auto">
          {activeTab === 'Dashboard' && <DashboardView />}
          {activeTab === 'Analytics' && <AnalyticsView />}
          {activeTab === 'Apps' && <AppsView />}
          {activeTab === 'Websites' && <WebsitesView />}
          {activeTab === 'Timeline' && <TimelineView />}
          {activeTab === 'Gallery' && <GalleryView />}
          {activeTab === 'Settings' && <SettingsView />}
        </main>
      </motion.div>

      {/* ───── AI Chat ───── */}
      <motion.div animate={{ opacity: isFocusMode ? 0 : 1, pointerEvents: isFocusMode ? 'none' : 'auto' }}>
        <AIChat />
      </motion.div>
    </div>
  );
}

export default App;
