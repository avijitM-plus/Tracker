import { motion } from 'framer-motion';
import { useTrackStore } from '../store';
import { Play, Pause, Volume2, X } from 'lucide-react';
import { useState, useRef, useEffect, useCallback } from 'react';

type SoundMode = 'binaural' | 'brown' | 'rain';

// Web Audio API sound engine — zero external files, pure math
function createBinauralEngine(ctx: AudioContext) {
  const left = ctx.createOscillator();
  const right = ctx.createOscillator();
  const merger = ctx.createChannelMerger(2);
  const gain = ctx.createGain();

  left.type = 'sine';
  right.type = 'sine';
  left.frequency.value = 200;
  right.frequency.value = 214; // 14Hz binaural beat
  gain.gain.value = 0.3;

  left.connect(merger, 0, 0);
  right.connect(merger, 0, 1);
  merger.connect(gain);
  gain.connect(ctx.destination);

  left.start();
  right.start();
  return { gain, stop: () => { left.stop(); right.stop(); } };
}

function createBrownNoiseEngine(ctx: AudioContext) {
  const bufferSize = 2 * ctx.sampleRate;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let lastOut = 0;
  for (let i = 0; i < bufferSize; i++) {
    const white = Math.random() * 2 - 1;
    data[i] = (lastOut + 0.02 * white) / 1.02;
    lastOut = data[i];
    data[i] *= 3.5; // amplify
  }
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  const gain = ctx.createGain();
  gain.gain.value = 0.4;
  source.connect(gain);
  gain.connect(ctx.destination);
  source.start();
  return { gain, stop: () => source.stop() };
}

function createRainEngine(ctx: AudioContext) {
  const bufferSize = 2 * ctx.sampleRate;
  const buffer = ctx.createBuffer(2, bufferSize, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
  }
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.loop = true;

  // Low-pass filter to shape white noise into rain
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 800;
  filter.Q.value = 0.7;

  const gain = ctx.createGain();
  gain.gain.value = 0.25;
  source.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  source.start();
  return { gain, stop: () => source.stop() };
}

export default function ZenMode() {
  const { currentApp, currentTitle, apm } = useTrackStore();
  const [isPlaying, setIsPlaying] = useState(false);
  const [soundMode, setSoundMode] = useState<SoundMode>('binaural');
  const [volume, setVolume] = useState(0.5);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const engineRef = useRef<{ gain: GainNode; stop: () => void } | null>(null);

  const stopAudio = useCallback(() => {
    try { engineRef.current?.stop(); } catch {}
    try { audioCtxRef.current?.close(); } catch {}
    engineRef.current = null;
    audioCtxRef.current = null;
  }, []);

  const startAudio = useCallback((mode: SoundMode) => {
    stopAudio();
    const ctx = new AudioContext();
    audioCtxRef.current = ctx;
    let engine;
    if (mode === 'binaural') engine = createBinauralEngine(ctx);
    else if (mode === 'brown') engine = createBrownNoiseEngine(ctx);
    else engine = createRainEngine(ctx);
    engine.gain.gain.value = volume;
    engineRef.current = engine;
  }, [volume, stopAudio]);

  // Stop audio when component unmounts (focus mode ends)
  useEffect(() => () => stopAudio(), [stopAudio]);

  // Update volume live
  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.gain.gain.value = volume;
    }
  }, [volume]);

  const togglePlay = () => {
    if (isPlaying) {
      stopAudio();
      setIsPlaying(false);
    } else {
      startAudio(soundMode);
      setIsPlaying(true);
    }
  };

  const changeSoundMode = (mode: SoundMode) => {
    setSoundMode(mode);
    if (isPlaying) {
      startAudio(mode);
    }
  };

  const modeLabels: Record<SoundMode, string> = {
    binaural: 'Binaural Beta • 14Hz',
    brown: 'Brown Noise',
    rain: 'Rain'
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.05 }}
      transition={{ duration: 0.8, ease: "easeInOut" }}
      className="absolute inset-0 flex flex-col items-center justify-center bg-black z-50 pointer-events-none"
    >
      {/* Ambient animated background */}
      <div className="absolute inset-0 overflow-hidden">
        <motion.div 
          animate={{ rotate: 360, scale: [1, 1.2, 1] }}
          transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
          className="absolute -top-[50%] -left-[50%] w-[200%] h-[200%] bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-900/10 via-black to-black opacity-50"
        />
      </div>

      <div className="relative z-10 text-center pointer-events-auto">
        <h2 className="text-sm uppercase tracking-[0.3em] text-slate-500 mb-8 font-light">Deep Work Active</h2>
        
        <div className="text-7xl font-thin tracking-tight text-white mb-4">
          {currentApp || "Focused"}
        </div>
        <p className="text-xl text-slate-400 font-light max-w-xl truncate mx-auto">
          {currentTitle || "Flow State"}
        </p>

        <div className="mt-16 flex flex-col items-center">
          <div className="text-3xl font-extralight text-emerald-400/80 tracking-widest">{apm}</div>
          <div className="text-xs uppercase tracking-widest text-slate-600 mt-2">APM</div>
        </div>

        {/* Sound Mode Selector */}
        <div className="mt-16 flex items-center justify-center gap-2">
          {(['binaural', 'brown', 'rain'] as SoundMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => changeSoundMode(mode)}
              className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all ${
                soundMode === mode
                  ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                  : 'text-slate-500 border border-slate-800 hover:text-slate-300 hover:border-slate-600'
              }`}
            >
              {mode === 'binaural' ? 'Binaural' : mode === 'brown' ? 'Brown Noise' : 'Rain'}
            </button>
          ))}
        </div>

        {/* Player Controls */}
        <div className="mt-6 flex items-center justify-center gap-5">
          <button 
            onClick={togglePlay}
            className={`w-14 h-14 rounded-full border flex items-center justify-center transition-all ${
              isPlaying
                ? 'border-blue-500/50 text-blue-400 bg-blue-500/10 shadow-lg shadow-blue-500/10'
                : 'border-slate-800 text-slate-400 hover:text-white hover:border-slate-600'
            }`}
          >
            {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
          </button>
          
          <div className="flex items-center gap-2">
            <Volume2 className="w-4 h-4 text-slate-600" />
            <input
              type="range"
              min={0} max={1} step={0.05}
              value={volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              className="w-24 accent-blue-500 h-1"
            />
          </div>
        </div>

        <div className="mt-4 text-sm text-slate-500 font-light tracking-wide">
          {modeLabels[soundMode]}
        </div>

        {/* Exit Button */}
        <div className="mt-12 flex justify-center">
          <button
            onClick={() => {
              useTrackStore.getState().setFocusMode(false);
              fetch('http://127.0.0.1:8000/api/focus', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ is_active: false })
              }).catch(console.error);
            }}
            className="flex items-center gap-2 text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 px-4 py-2 rounded-full transition-all text-sm font-medium border border-red-500/20"
          >
            <X className="w-4 h-4" /> Exit Focus Mode
          </button>
        </div>
      </div>
    </motion.div>
  );
}
