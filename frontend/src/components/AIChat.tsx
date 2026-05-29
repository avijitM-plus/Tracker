import { useState, useRef, useEffect } from 'react';
import { Send, X, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function AIChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([
    { role: 'ai', content: 'Hello! I am your NeuroTrack assistant. I can analyze your productivity, summarize your daily timeline, or give you focus tips.' }
  ]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isOpen]);

  const handleSend = async () => {
    if (!input.trim()) return;
    
    const userMsg = input.trim();
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setInput('');
    
    try {
      const res = await fetch('http://127.0.0.1:8000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg })
      });
      const data = await res.json();
      setMessages(prev => [...prev, { role: 'ai', content: data.response }]);
    } catch (e) {
      setMessages(prev => [...prev, { role: 'ai', content: 'Error connecting to the brain.' }]);
    }
  };

  return (
    <>
      {/* Floating Action Button */}
      <button 
        onClick={() => setIsOpen(true)}
        className="fixed bottom-8 right-8 w-14 h-14 rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 shadow-lg shadow-violet-500/20 flex items-center justify-center hover:scale-105 transition-transform z-40 group"
      >
        <Sparkles className="w-6 h-6 text-white group-hover:animate-pulse" />
      </button>

      {/* Chat Drawer */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ x: 400, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 400, opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed top-0 right-0 w-96 h-screen bg-slate-900/90 backdrop-blur-2xl border-l border-slate-800 shadow-2xl flex flex-col z-50"
          >
            <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <h3 className="font-semibold text-slate-100">Neuro AI</h3>
              </div>
              <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-2xl p-3 text-sm ${
                    msg.role === 'user' 
                      ? 'bg-blue-600 text-white rounded-br-none' 
                      : 'bg-slate-800/80 text-slate-200 border border-slate-700/50 rounded-bl-none'
                  }`}>
                    {msg.content}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            <div className="p-4 border-t border-slate-800 bg-slate-900/50">
              <div className="relative">
                <input 
                  type="text" 
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSend()}
                  placeholder="Ask about your productivity..."
                  className="w-full bg-slate-950 border border-slate-700 text-slate-200 rounded-full pl-4 pr-12 py-3 focus:outline-none focus:border-violet-500 transition-colors text-sm"
                />
                <button 
                  onClick={handleSend}
                  className="absolute right-2 top-2 w-8 h-8 rounded-full bg-violet-600 flex items-center justify-center text-white hover:bg-violet-500 transition-colors"
                >
                  <Send className="w-4 h-4 -ml-0.5" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
