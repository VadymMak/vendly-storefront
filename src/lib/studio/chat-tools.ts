// Page → tool name mapping for context-aware AI command layer
export const TOOL_PAGE_MAP: Record<string, string[]> = {
  // Always available
  searchDocs:            ['*'],
  getUserCredits:        ['*'],
  getRecentJobs:         ['*'],
  getJobDiagnostics:     ['*'],
  openStudioTool:        ['*'],
  checkToolAvailability: ['*'],
  suggestWorkflow:       ['*'],

  // Generation tools — available on ALL pages
  generate_image:        ['*'],
  remove_background:     ['*'],
  upscale:               ['*'],
  generate_video:        ['*'],

  // /studio/assemble
  get_timeline:          ['assemble'],
  add_clip:              ['assemble'],
  move_clip:             ['assemble'],
  trim_clip:             ['assemble'],
  split_clip:            ['assemble'],
  duplicate_clip:        ['assemble'],
  remove_clip:           ['assemble'],
  add_text_overlay:      ['assemble'],
  set_playhead:          ['assemble'],
  auto_caption:          ['assemble'],
};

export function getToolsForPage(currentPage: string): string[] {
  const tools: string[] = [];
  for (const [toolName, pages] of Object.entries(TOOL_PAGE_MAP)) {
    if (pages.includes('*') || pages.includes(currentPage)) {
      tools.push(toolName);
    }
  }
  return tools;
}

export const PAGE_CAPABILITIES: Record<string, string> = {
  generate: `
You are on the IMAGE GENERATION page. You can:
- Generate images from text prompts (generate_image)
- Remove backgrounds (remove_background — requires an image in context)
- Upscale images to 4K (upscale — requires an image in context)
When the user asks to create/generate/make an image, USE the generate_image tool directly.`,

  animate: `
You are on the VIDEO/ANIMATION page. You can:
- Generate videos from text prompts (generate_video)
- Generate images to use as video frames (generate_image)
When the user asks to create a video or animate something, USE the tool directly.`,

  assemble: `
You are on the VIDEO EDITOR (Assemble) page. You can:
- Read the current timeline (get_timeline) — ALWAYS call this first before any mutation
- Add clips to tracks (add_clip)
- Move, trim, split, duplicate clips (move_clip, trim_clip, split_clip, duplicate_clip)
- Remove clips (remove_clip) — destructive, confirm with the user first
- Add text overlays/titles (add_text_overlay)
- Set playhead position (set_playhead)
- Auto-generate captions from audio (auto_caption)
- Generate images/videos to add to the timeline (generate_image, generate_video)
All timeline mutations are undoable (Ctrl+Z).`,

  library: `You are on the MY WORK library page. Help the user find, filter, or manage their saved generations. You can also generate new images/videos if asked.`,

  home: `You are on the STUDIO HOME page. You can:
- Generate images from text prompts (generate_image)
- Generate videos from text prompts (generate_video)
- Remove backgrounds (remove_background)
- Upscale images (upscale)
- Navigate the user to specialized tools (openStudioTool)
- Suggest creative workflows (suggestWorkflow)
When the user asks to create/generate something, USE the tool directly — do not redirect them.`,
};
