import axios from 'axios';
import type { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { getUID, clearUID } from './auth';
import type {
  AuthResponse,
  Formation,
  Note,
  ProgressResponse,
  FormationProgress,
} from '../types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Create Axios instance
const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  // withCredentials: true,
});

// Request interceptor to inject UID header
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const uid = getUID();
    // Add header if UID exists (backend will handle auth requirements)
    if (uid && config.headers) {
      config.headers['X-User-UID'] = uid;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle 401/403 - clear UID and redirect will be handled by AuthGuard
    if (error.response?.status === 401 || error.response?.status === 403) {
      // Clear UID on auth failure
      const uid = getUID();
      if (uid) {
        clearUID();
      }
    }
    return Promise.reject(error);
  }
);

// Response interceptor for error handling & AUTO-HEALING
// api.interceptors.response.use(
//   (response) => response,
//   async (error) => {
//     const originalRequest = error.config;

//     // 1. AUTO-GUÉRISON : Si erreur 401 (Cookie expiré ou absent)
//     if (error.response?.status === 401 && !originalRequest._retry) {
//       originalRequest._retry = true; // Pour éviter une boucle infinie
      
//       const backupUid = getUID(); // On récupère la sauvegarde dans le localStorage

//       if (backupUid) {
//         try {
//           // On demande au backend de restaurer le cookie en utilisant axios "brut" 
//           // pour ne pas repasser par cet intercepteur en cas d'échec
//           await axios.post(`${API_BASE_URL}/auth/restore`, { uid: backupUid }, {
//             withCredentials: true 
//           });

//           // Si ça réussit, on rejoue la requête initiale qui avait échoué !
//           return api(originalRequest);
//         } catch (restoreError) {
//           // Si la restauration échoue (ex: utilisateur supprimé côté serveur)
//           clearUID();
//           return Promise.reject(restoreError);
//         }
//       } else {
//         // Pas de backup, on déconnecte l'utilisateur
//         clearUID();
//       }
//     }

//     // 2. Si c'est un 403 (Accès refusé définitif), on déconnecte
//     if (error.response?.status === 403) {
//       const uid = getUID();
//       if (uid) {
//         clearUID();
//       }
//     }

//     return Promise.reject(error);
//   }
// );

// API functions
export const apiService = {
  // Auth
  generateUID: async (): Promise<string> => {
    const response = await api.post<AuthResponse>('/auth/generate');
    return response.data.uid;
  },

  // Formations
  getFormations: async (): Promise<Formation[]> => {
    const response = await api.get('/formations');
    // Log the raw response for debugging
    // console.log('Raw API response:', response.data);
    // console.log('Response type:', typeof response.data);
    // console.log('Is array?', Array.isArray(response.data));
    
    // Handle different response formats
    const data = response.data;
    
    // If it's already an array, return it
    if (Array.isArray(data)) {
      return data;
    }
    
    // If it's an object, check for common keys
    if (typeof data === 'object' && data !== null) {
      // Try common keys that might contain the array
      if (Array.isArray(data.formations)) {
        return data.formations;
      }
      if (Array.isArray(data.data)) {
        return data.data;
      }
      if (Array.isArray(data.items)) {
        return data.items;
      }
    }
    
    console.warn('Unexpected response format, returning empty array');
    return [];
  },

  // Progress
  getProgress: async (videoId: string): Promise<number | null> => {
    try {
      const response = await api.get<ProgressResponse>(`/progress/${videoId}`);
      return response.data.last_position;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return null; // No progress yet
      }
      throw error;
    }
  },

  saveProgress: async (videoId: string, position: number): Promise<void> => {
    await api.post<ProgressResponse>(`/progress/${videoId}`, {
      last_position: position,
    });
  },

  getFormationProgress: async (formationName: string): Promise<FormationProgress> => {
    const response = await api.get<FormationProgress>(`/progress/formation/${formationName}`);
    return response.data;
  },

  // Notes
  getNotes: async (videoId: string): Promise<Note[]> => {
    const response = await api.get<Note[]>(`/notes/${videoId}`);
    return response.data;
  },

  createNote: async (
    videoId: string,
    timecode: number,
    content: string
  ): Promise<Note> => {
    const response = await api.post<Note>(`/notes/${videoId}`, {
      timecode,
      content,
    });
    return response.data;
  },

  updateNote: async (
    noteId: number,
    content: string
  ): Promise<Note> => {
    const response = await api.put<Note>(`/notes/${noteId}`, {
      content,
    });
    return response.data;
  },

  deleteNote: async (noteId: number): Promise<void> => {
    await api.delete(`/notes/${noteId}`);
  },

  // Video Summary
  getVideoSummary: async (videoId: string): Promise<string> => {
    try {
      const uid = getUID();
      const response = await api.get<{ summary: string }>(`/videos/${videoId}/summary?user_uid=${uid}`);
      return response.data.summary;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        throw new Error('Summary not available for this video');
      }
      throw error;
    }
  },

  updateVideoSummary: async (videoId: string, summary: string): Promise<string> => {
    const uid = getUID();
    const response = await api.put<{ summary: string }>(`/videos/${videoId}/summary?user_uid=${uid}`, {
      summary,
    });
    return response.data.summary;
  },
};

export default api;
