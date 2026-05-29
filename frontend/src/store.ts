import { create } from 'zustand';

interface TrackState {
  currentApp: string;
  currentProcess: string;
  currentTitle: string;
  isIdle: boolean;
  sessionStart: string | null;
  apm: number;
  isFocusMode: boolean;
  setFocusMode: (state: boolean) => void;
  setCurrentActivity: (data: any) => void;
}

export const useTrackStore = create<TrackState>((set) => ({
  currentApp: 'Unknown',
  currentProcess: 'Unknown',
  currentTitle: 'Unknown',
  isIdle: false,
  sessionStart: null,
  apm: 0,
  isFocusMode: false,
  setFocusMode: (state) => set({ isFocusMode: state }),
  setCurrentActivity: (data) => set({
    currentApp: data.app_name || 'Unknown',
    currentProcess: data.process_name || 'Unknown',
    currentTitle: data.window_title || data.title || 'Unknown',
    isIdle: data.is_idle || false,
    sessionStart: data.session_start || null,
    apm: data.apm || 0
  }),
}));
