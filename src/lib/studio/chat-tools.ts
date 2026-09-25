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

  // /studio/generate
  generate_image:        ['generate'],
  remove_background:     ['generate'],
  upscale:               ['generate'],

  // /studio/animate
  generate_video:        ['animate'],

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
You are on the IMAGE GENERATION page. In addition to help, you can:
- Generate images from text prompts (generate_image)
- Remove backgrounds (remove_background — requires an image in context)
- Upscale images to 4K (upscale — requires an image in context)
When the user asks to create/generate/make an image, USE the generate_image tool directly instead of telling them to use the UI.`,

  animate: `
You are on the VIDEO/ANIMATION page. In addition to help, you can:
- Generate videos from text prompts (generate_video)
When the user asks to create a video or animate something, USE the tool directly.`,

  assemble: `
You are on the VIDEO EDITOR (Assemble) page. In addition to help, you can:
- Read the current timeline (get_timeline) — ALWAYS call this first before any mutation
- Add clips to tracks (add_clip)
- Move, trim, split, duplicate clips (move_clip, trim_clip, split_clip, duplicate_clip)
- Remove clips (remove_clip) — destructive, confirm with the user first
- Add text overlays/titles (add_text_overlay)
- Set playhead position (set_playhead)
- Auto-generate captions from audio (auto_caption) — transcribes speech and creates synced subtitle clips
All timeline mutations are undoable (Ctrl+Z).`,

  library: `You are on the MY WORK library page. Help the user find, filter, or manage their saved generations.`,

  home: `You are on the STUDIO HOME page. Use openStudioTool to navigate the user to the right tool, or suggestWorkflow to guide them toward their creative goal.`,
};
