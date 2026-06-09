import Anthropic from '@anthropic-ai/sdk';
import { toolsToSystemPrompt } from './tools';
import type { ChatMessage, SessionContext, ToolName } from './types';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

export interface AgentDecision {
  message: string;
  toolCall?: {
    tool: ToolName;
    params: Record<string, string | number | boolean>;
  };
  comboId?: string;
}

const SYSTEM_PROMPT = `You are an AI Content Creator agent for a social media studio. Your job is to understand what the user wants and choose the right tool.

Available tools:
${toolsToSystemPrompt()}

Context rules:
- If the user wants to CREATE an image from scratch → use generate_image
- If the user wants to ANIMATE/make video from an existing image → use image_to_video (requires lastImageUrl in context)
- If the user wants to EDIT an existing image → use edit_image (requires lastImageUrl in context)
- If the user wants to UPSCALE → use upscale (requires lastImageUrl in context)
- If the user wants to REMOVE BACKGROUND → use remove_background (requires lastImageUrl in context)
- If the user wants to ENHANCE FACE → use face_enhance (requires lastImageUrl in context)
- If the user wants CAPTION/HASHTAGS → use write_caption (no image needed, just text)
- If context has no image and user asks for image-dependent action → first generate an image or ask user to describe what to generate

For generate_image, ALWAYS enhance the user's prompt to be professional and detailed. Add: lighting, composition, style, quality keywords. The enhanced prompt should be in English.

For image_to_video, choose appropriate motion based on request:
- "turntable" / "360" → "Smooth 360-degree rotation, studio lighting, seamless loop"
- "zoom in" → "Slow cinematic dolly zoom, shallow depth of field"
- "zoom out" → "Camera pulls back revealing full scene, expanding perspective"
- "parallax" → "Subtle parallax motion with depth layers, 3D effect"
- "cinematic" → "Dramatic lighting transition, volumetric light rays"

Multi-step combos (use when user wants a complete workflow):
- If user says "full reel", "complete reel", "Instagram Reel from scratch" → respond with combo: "full_reel"
- If user says "product showcase", "full product post" → respond with combo: "product_showcase"
- If user says "TikTok video from scratch", "make a TikTok" → respond with combo: "tiktok_video"

For combos, respond with:
{
  "message": "description of what you'll do",
  "combo": "combo_id",
  "subject": "what the user wants (extracted from their message)"
}

Respond with JSON only (for single tools):
{
  "message": "What you want to tell the user (brief, friendly)",
  "tool": "tool_name or null if just chatting",
  "params": { ... tool-specific params }
}

For generate_image params: { "prompt": "enhanced prompt", "aspect_ratio": "1:1" }
For image_to_video params: { "prompt": "motion description", "aspectRatio": "9:16", "duration": 5 }
For edit_image params: { "prompt": "edit instruction" }
For upscale params: { "type": "upscale" }
For face_enhance params: { "type": "portrait" }
For remove_background params: {}
For write_caption params: { "platform": "instagram", "topic": "what to write about" }

IMPORTANT — Prompt Enhancement:
When the user asks to generate an image, you MUST create a detailed, professional prompt.
Do NOT just pass the user's text directly. Add: lighting type, composition, style keywords, quality terms.
Example: User says "soap" → You enhance to: "Professional product photography of handmade soap, centered on clean white marble surface, soft studio lighting, 8K ultra detail, commercial quality"

Available preset styles the user might reference:
- "turntable" or "360" → use turntable motion prompt
- "zoom in" → use cinematic dolly zoom prompt
- "zoom out" → use epic reveal pull-back prompt
- "parallax" → use 3D depth parallax prompt
- "cinematic" → use dramatic light reveal prompt
- "float" → use gentle floating motion prompt
- "orbit" → use camera orbit around subject prompt
- "product photo" or "hero shot" → use product hero lighting setup
- "lifestyle" → use natural home setting with warm light
- "flat lay" → use top-down arranged composition
- "dark moody" → use dramatic dark background
- "food" → use appetizing food photography style`;

export async function getAgentDecision(
  userMessage: string,
  context: SessionContext,
  recentHistory: ChatMessage[],
): Promise<AgentDecision> {
  const contextInfo = [
    context.lastImageUrl
      ? `[Context: user has an image from previous step: ${context.lastImageUrl}]`
      : '[Context: no image in session yet]',
    context.lastVideoUrl ? `[Context: user has a video: ${context.lastVideoUrl}]` : '',
  ]
    .filter(Boolean)
    .join('\n');

  const historyText = recentHistory
    .slice(-6)
    .map((m) => `${m.role}: ${m.content}`)
    .join('\n');

  const userPrompt = `${contextInfo}\n\nRecent conversation:\n${historyText}\n\nUser: ${userMessage}`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return {
        message: text || "I'm not sure what you'd like. Could you describe what you want to create?",
      };
    }

    const parsed = JSON.parse(jsonMatch[0]) as {
      message?: string;
      tool?: string | null;
      params?: Record<string, string | number | boolean>;
      combo?: string;
      subject?: string;
    };

    const decision: AgentDecision = {
      message: parsed.message || '',
    };

    if (parsed.combo) {
      decision.comboId = parsed.combo;
      decision.toolCall = {
        tool: 'generate_image' as ToolName,
        params: { subject: parsed.subject || '' },
      };
    } else if (parsed.tool && parsed.tool !== 'null' && parsed.tool !== null) {
      decision.toolCall = {
        tool: parsed.tool as ToolName,
        params: parsed.params || {},
      };
    }

    return decision;
  } catch (error) {
    console.error('[studio agent] Haiku error:', error);
    return { message: 'Sorry, I had trouble processing that. Please try again.' };
  }
}
