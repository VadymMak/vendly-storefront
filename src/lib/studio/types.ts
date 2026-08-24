export type MessageRole = 'user' | 'assistant' | 'system';

export type AgentState =
  | 'idle'
  | 'asking_business_type'
  | 'asking_director_questions'
  | 'ready_to_generate'
  | 'generating'
  | 'done'
  | 'lora_asking_scene';

export type MediaType = 'image' | 'video' | 'audio';

export interface MediaAttachment {
  type: MediaType;
  url: string;
  width?: number;
  height?: number;
  duration?: number;
}

export interface QuickReplyButton {
  label: string;
  value: string;
}

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  media?: MediaAttachment;
  toolUsed?: string;
  enhancedPrompt?: string;
  model?: string;
  toolParams?: Record<string, unknown>;
  isLoading?: boolean;
  buttons?: QuickReplyButton[];
  timestamp: number;
}

export interface ChatSession {
  id: string;
  messages: ChatMessage[];
  context: SessionContext;
  createdAt: number;
}

export interface AdClipState {
  scenes: string[];        // generated image URLs (up to 3)
  videos: string[];        // completed animation URLs
  currentStep: 'videos' | 'clip';
}

export interface SessionContext {
  lastImageUrl: string | null;
  lastVideoUrl: string | null;
  lastAudioUrl: string | null;
  characterReferenceUrl: string | null;
  platform?: Platform;
  adClipState?: AdClipState;
  uploadedReferenceUrl?: string | null;
  businessType?: string | null;
  brandName?: string | null;
  slogan?: string | null;
  loraModel?: string | null;
  loraTriggerWord?: string | null;
  jobIds?: string[];
  lastAgentState?: AgentState;
}

export type Platform =
  | 'instagram_reel'
  | 'instagram_post'
  | 'instagram_story'
  | 'tiktok'
  | 'youtube_shorts'
  | 'facebook_post';

export type ToolName =
  | 'generate_image'
  | 'generate_with_reference'
  | 'generate_character'
  | 'talking_avatar'
  | 'voiceover'
  | 'image_to_video'
  | 'edit_image'
  | 'upscale'
  | 'remove_background'
  | 'face_enhance'
  | 'write_caption'
  | 'write_script'
  | 'create_clip'
  | 'transform_image';

export interface ToolCall {
  tool: ToolName;
  params: Record<string, unknown>;
}

export interface AgentResponse {
  message: string;
  toolCall?: ToolCall;
  media?: MediaAttachment;
  context: SessionContext;
}

export interface FeedbackExample {
  userPrompt: string;
  enhancedPrompt: string;
  tool: string;
  model: string;
  rating: string;
  issue: string | null;
  similarity: number;
}

export interface ModelStat {
  tool: string;
  model: string;
  upCount: number;
  downCount: number;
  total: number;
  winRate: number;
}

export interface LearningContext {
  isActive: boolean;
  totalFeedback: number;
  goodExamples: FeedbackExample[];
  badExamples: FeedbackExample[];
  modelStats: ModelStat[];
}
