import { create } from 'zustand';
import { debounce } from '../utils/debounce';
import { apiService } from '../services/api';

interface PlayerState {
  currentVideoId: string | null;
  currentTime: number;
  isPlaying: boolean;
  setVideo: (videoId: string | null) => void;
  setCurrentTime: (time: number) => void;
  setIsPlaying: (playing: boolean) => void;
  updateProgress: (time: number) => void;
}

// Debounced save progress function
const debouncedSaveProgress = debounce(
  (videoId: string, position: number) => {
    apiService.saveProgress(videoId, position).catch((error) => {
      console.error('Failed to save progress:', error);
    });
  },
  500
);

export const usePlayerStore = create<PlayerState>((set, get) => ({
  currentVideoId: null,
  currentTime: 0,
  isPlaying: false,
  setVideo: (videoId: string | null) => {
    set({ currentVideoId: videoId, currentTime: 0, isPlaying: false });
  },
  setCurrentTime: (time: number) => {
    set({ currentTime: time });
  },
  setIsPlaying: (playing: boolean) => {
    set({ isPlaying: playing });
  },
  updateProgress: (time: number) => {
    const { currentVideoId } = get();
    set({ currentTime: time });
    if (currentVideoId) {
      debouncedSaveProgress(currentVideoId, time);
    }
  },
}));
