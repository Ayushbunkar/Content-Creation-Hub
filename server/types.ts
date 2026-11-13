export interface VideoProject {
  id: string;
  title: string;
  category: string;
  topic: string;
  duration: number; // in seconds
  language: string;
  voice: string;
  aspect_ratio: '16:9' | '9:16' | '1:1' | '4:5';
  resolution: '720p' | '1080p' | '4K';
  fps: number;
  visual_style: string;
  caption_template: string;
  status: 'draft' | 'processing' | 'completed' | 'failed';
  current_stage: PipelineStage;
  progress: number;
  script?: string;
  scene_data?: SceneData[];
  narration_file?: string;
  subtitles_file?: string;
  video_output?: string;
  social_captions?: SocialCaptions;
  research_summary?: ResearchSummary;
  error_message?: string;
  created_at?: string;
  updated_at?: string;
}

export type PipelineStage = 
  | 'JOB_CREATED'
  | 'RESEARCH'
  | 'SCRIPT_WRITING'
  | 'FACT_CHECKING'
  | 'SCENE_PLANNING'
  | 'ASSET_COLLECTION'
  | 'IMAGE_AND_GRAPHIC_PREPARATION'
  | 'VOICE_GENERATION'
  | 'SUBTITLE_GENERATION'
  | 'ANIMATION_GENERATION'
  | 'AUDIO_ASSEMBLY'
  | 'VIDEO_ASSEMBLY'
  | 'QUALITY_CHECK'
  | 'FINAL_RENDER'
  | 'READY_FOR_EDITING';

export type VisualShotType =
  | 'video_footage'
  | 'layered_parallax'
  | 'archival_document'
  | 'tactical_map'
  | 'data_metric'
  | 'cinematic_hook'
  | 'ai_video';

export type MediaSource = 
  | 'real_video' 
  | 'motion_graphics' 
  | 'archival' 
  | 'ai_video';

export type CameraMovement = 
  | 'dolly_in' 
  | 'dolly_out' 
  | 'pan_left' 
  | 'pan_right' 
  | 'tilt_up' 
  | 'tilt_down' 
  | 'aerial_zoom' 
  | 'tracking_forward' 
  | 'orbit';

export type TransitionType = 
  | 'fade' 
  | 'crossfade' 
  | 'whip_pan' 
  | 'zoom_in' 
  | 'cut' 
  | 'slide';

export interface SceneData {
  id: string;
  shot_number?: number;
  title: string;
  narration: string;
  duration: number; // seconds
  startSec?: number;
  endSec?: number;
  startFrame?: number;
  durationFrames?: number;
  visual_type: VisualShotType;
  media_source: MediaSource;
  badge: string; // '[Real Video Footage]', '[Motion Graphics]', '[Archival Document]', '[AI Video]'
  media_url?: string; // Path to video footage or graphic file
  camera_movement: CameraMovement;
  transition: TransitionType;
  visual_description: string;
  subject_action?: string;
  environment_period?: string;
  location?: string;
  coordinates?: string;
  layers?: {
    background?: string;
    middle?: string;
    foreground?: string;
    particles?: 'dust_motes' | 'embers' | 'light_leaks' | 'film_grain' | 'none';
  };
  archival_data?: {
    headline: string;
    publication: string;
    date: string;
    snippet: string;
    highlightPhrase?: string;
  };
  map_config?: {
    region: string;
    targetName?: string;
    highlighted_countries: string[];
    markers?: Array<{ name: string; x: number; y: number; type?: 'chokepoint' | 'capital' | 'base' | 'port' }>;
    arrows?: Array<{ from: [number, number]; to: [number, number]; label?: string }>;
    zoom?: number;
  };
  data_metric?: {
    statNumber: string;
    statLabel: string;
    statSubtext: string;
  };
  audio?: {
    music_volume?: number;
    sfx?: string;
    ambient?: string;
  };
  quality_status?: 'approved' | 'auto_enhanced';
}

export interface QualityReport {
  passed: boolean;
  total_shots: number;
  real_video_count: number;
  motion_graphics_count: number;
  archival_count: number;
  static_images_detected: number;
  static_images_upgraded: number;
  duplicate_media_count: number;
  notes: string[];
}

export interface ResearchSummary {
  topic: string;
  key_questions: string[];
  confirmed_facts: string[];
  disputed_points: string[];
  sources: Array<{ title: string; url: string; date?: string }>;
}

export interface SocialCaptions {
  youtube_titles: string[];
  youtube_description: string;
  youtube_chapters: string[];
  tags: string[];
  hashtags: string[];
  instagram_caption: string;
  reels_caption: string;
  shorts_title: string;
  pinned_comment: string;
  hook_ideas: string[];
}
