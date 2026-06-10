export type MessageRole = 'user' | 'assistant' | 'system';

export type MediaType = 'image' | 'video' | 'audio';

export interface MediaAttachment {
  type: MediaType;
  url: string;
  width?: number;
  height?: number;
  duration?: number;
}

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  media?: MediaAttachment;
  toolUsed?: string;
  isLoading?: boolean;
  timestamp: number;
}

export interface ChatSession {
  id: string;
  messages: ChatMessage[];
  context: SessionContext;
  createdAt: number;
}

export interface SessionContext {
  lastImageUrl: string | null;
  lastVideoUrl: string | null;
  platform?: Platform;
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
  | 'image_to_video'
  | 'edit_image'
  | 'upscale'
  | 'remove_background'
  | 'face_enhance'
  | 'write_caption'
  | 'create_clip';

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
