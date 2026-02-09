export interface Formation {
  name: string;
  chapters: Chapter[];
}

export interface Chapter {
  name: string;
  videos: Video[];
}

export interface Video {
  id: string;
  title: string;
  duration: number;
}

export interface Note {
  id: number;
  video_id: string;
  timecode: number;
  content: string;
  created_at: string;
}

export interface ProgressResponse {
  last_position: number;
}

export interface AuthResponse {
  uid: string;
}

export interface VideoProgress {
  id: string;
  title: string;
  progress_percentage: number;
}

export interface ChapterProgress {
  name: string;
  videos: VideoProgress[];
  progress_percentage: number;
}

export interface FormationProgress {
  name: string;
  chapters: ChapterProgress[];
  progress_percentage: number;
}
