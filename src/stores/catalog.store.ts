import { create } from 'zustand';
import type { Formation } from '../types';
import { apiService } from '../services/api';

interface CatalogState {
  formations: Formation[];
  loading: boolean;
  error: string | null;
  fetchFormations: () => Promise<void>;
  reset: () => void;
}

export const useCatalogStore = create<CatalogState>((set) => ({
  formations: [],
  loading: false,
  error: null,
  fetchFormations: async () => {
    set({ loading: true, error: null });
    try {
      const formations = await apiService.getFormations();
      // console.log('Formations received in store:', formations);
      // console.log('Formations length:', formations?.length);
      // Ensure we always set an array, even if API returns something unexpected
      const safeFormations = Array.isArray(formations) ? formations : [];
      // console.log('Safe formations length:', safeFormations.length);
      set({ formations: safeFormations, loading: false, error: null });
    } catch (error) {
      console.error('Error fetching formations:', error);
      set({
        formations: [],
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to load formations',
      });
    }
  },
  reset: () => {
    set({ formations: [], loading: false, error: null });
  },
}));
