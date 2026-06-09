'use client';

interface Skill {
  id: string;
  label: string;
  emoji: string;
  prompt: string;
}

const SKILLS: Skill[] = [
  { id: 'product',   emoji: '📦', label: 'Product Photo',    prompt: 'Create a professional product photo of ' },
  { id: 'turntable', emoji: '🔄', label: 'Turntable 360°',   prompt: 'Make a 360° turntable video of my product' },
  { id: 'zoom-in',   emoji: '🔍', label: 'Zoom In',          prompt: 'Create a dramatic zoom-in video' },
  { id: 'cinematic', emoji: '🎬', label: 'Cinematic',         prompt: 'Create a cinematic reveal video' },
  { id: 'remove-bg', emoji: '✂️', label: 'Remove BG',        prompt: 'Remove the background from my image' },
  { id: 'upscale',   emoji: '🔎', label: 'Upscale 4K',       prompt: 'Upscale my image to 4K resolution' },
  { id: 'caption',   emoji: '✍️', label: 'Write Caption',    prompt: 'Write an Instagram caption with hashtags for ' },
  { id: 'reel',      emoji: '📱', label: 'Instagram Reel',   prompt: 'Create a complete Instagram Reel from scratch: ' },
  { id: 'lifestyle', emoji: '🌅', label: 'Lifestyle Shot',   prompt: 'Create a lifestyle scene with ' },
  { id: 'flat-lay',  emoji: '📐', label: 'Flat Lay',         prompt: 'Create a flat lay composition of ' },
];

interface Props {
  onSelect: (prompt: string) => void;
}

export default function SkillPicker({ onSelect }: Props) {
  return (
    <div className="px-4 py-2 border-t border-[var(--color-border)]">
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {SKILLS.map((skill) => (
          <button
            key={skill.id}
            type="button"
            onClick={() => onSelect(skill.prompt)}
            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-bg)] text-xs font-medium text-[var(--color-text-muted)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition-colors whitespace-nowrap cursor-pointer"
          >
            <span>{skill.emoji}</span>
            {skill.label}
          </button>
        ))}
      </div>
    </div>
  );
}
