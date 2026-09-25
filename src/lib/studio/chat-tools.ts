// Page → tool name mapping for context-aware AI command layer
export const TOOL_PAGE_MAP: Record<string, string[]> = {
  // ── Universal (all pages) ──────────────────────────────────────────────────
  searchDocs:            ['*'],
  getUserCredits:        ['*'],
  getRecentJobs:         ['*'],
  getJobDiagnostics:     ['*'],
  openStudioTool:        ['*'],
  checkToolAvailability: ['*'],
  suggestWorkflow:       ['*'],

  // ── Generation (pages where creating content makes sense) ─────────────────
  generate_image:        ['home', 'generate', 'animate', 'library'],
  remove_background:     ['home', 'generate', 'remove-bg', 'library'],
  upscale:               ['home', 'generate', 'upscale', 'library'],
  generate_video:        ['home', 'generate-video', 'animate', 'library'],

  // ── Timeline (assemble page only) ─────────────────────────────────────────
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

// Re-export PAGE_CAPABILITIES from chat-skills for backward compatibility
export { PAGE_CAPABILITIES } from '@/lib/studio/chat-skills';
