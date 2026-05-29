import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Monitor, Globe, Camera } from 'lucide-react';

export default function TimelineView() {
  const [events, setEvents] = useState<any[]>([]);
  const [screenshots, setScreenshots] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('http://127.0.0.1:8000/api/reports/timeline').then(res => res.json()),
      fetch('http://127.0.0.1:8000/api/reports/screenshots').then(res => res.json())
    ]).then(([timelineData, screenshotData]) => {
      setEvents(timelineData);
      setScreenshots(screenshotData);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const formatTime = (isoString: string) => {
    const d = new Date(isoString + "Z"); // SQLite stores UTC, but sometimes python strips it, ensure UTC parse
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Find a screenshot that occurred during this event
  const getScreenshotForEvent = (event: any) => {
    const eventStart = new Date(event.start + "Z").getTime();
    const eventEnd = eventStart + (event.duration * 1000);
    
    // Find first screenshot that falls within this window
    return screenshots.find(s => {
      const sTime = new Date(s.timestamp + "Z").getTime();
      return sTime >= eventStart && sTime <= eventEnd;
    });
  };

  return (
    <motion.div 
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="h-full flex flex-col gap-6 max-w-4xl mx-auto w-full"
    >
      <div className="rounded-2xl bg-slate-900/40 border border-slate-800 p-6 backdrop-blur-xl">
        <div className="flex items-center justify-between mb-8">
            <h3 className="text-xl font-semibold text-slate-100">Visual Activity Timeline</h3>
            <div className="flex items-center gap-2 text-xs font-medium text-slate-400 bg-slate-800/50 px-3 py-1.5 rounded-full border border-slate-700/50">
                <Camera className="w-3 h-3 text-blue-400" />
                DVR Active
            </div>
        </div>
        
        {loading ? (
          <div className="text-center text-slate-500 py-10">Loading timeline...</div>
        ) : events.length === 0 ? (
          <div className="text-center text-slate-500 py-10">No events recorded today.</div>
        ) : (
          <div className="space-y-8 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-800 before:to-transparent">
            {events.map((event, i) => {
              const screenshot = getScreenshotForEvent(event);
              return (
              <div key={i} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                
                {/* Icon */}
                <div className="flex items-center justify-center w-10 h-10 rounded-full border border-slate-800 bg-slate-900 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                  {event.type === 'app' ? <Monitor className="w-5 h-5 text-blue-400" /> : <Globe className="w-5 h-5 text-violet-400" />}
                </div>
                
                {/* Card */}
                <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-xl border border-slate-800 bg-slate-800/40 backdrop-blur-md overflow-hidden group-hover:border-slate-600 transition-colors">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-slate-200">{event.name}</span>
                    <time className="text-xs font-medium text-slate-500">{formatTime(event.start)}</time>
                  </div>
                  <div className="text-sm text-slate-400 truncate mb-3">{event.title || "Unknown"}</div>
                  
                  {screenshot && (
                      <div className="mt-3 rounded-lg overflow-hidden border border-slate-700/50 relative group/img">
                          <img src={screenshot.url} alt="Screenshot" className="w-full h-auto opacity-70 group-hover/img:opacity-100 transition-opacity" />
                          <div className="absolute bottom-2 right-2 bg-slate-900/80 backdrop-blur px-2 py-1 rounded text-[10px] text-slate-300 flex items-center gap-1 border border-slate-700">
                              <Camera className="w-3 h-3" />
                              {formatTime(screenshot.timestamp)}
                          </div>
                      </div>
                  )}

                  {event.duration > 1 && (
                    <div className="mt-3 text-xs font-semibold text-slate-500 flex justify-between items-center">
                      <span>Duration: {Math.round(event.duration)}s</span>
                    </div>
                  )}
                </div>
              </div>
            )})}
          </div>
        )}
      </div>
    </motion.div>
  );
}
