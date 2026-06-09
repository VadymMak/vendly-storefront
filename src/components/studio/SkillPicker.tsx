'use client';

import { useState } from 'react';
import {
  ALL_PRESETS,
  PRESETS_BY_CATEGORY,
  type PromptPreset,
  type SkillCategory,
} from '@/lib/studio/prompt-library';

interface Props {
  onSelect: (prompt: string, presetId?: string) => void;
}

const CATEGORIES: { key: SkillCategory; label: string; emoji: string }[] = [
  { key: 'image', label: 'Create', emoji: '🖼️' },
  { key: 'video', label: 'Animate', emoji: '🎬' },
  { key: 'edit', label: 'Edit', emoji: '✏️' },
  { key: 'text', label: 'Text', emoji: '✍️' },
];

export default function SkillPicker({ onSelect }: Props) {
  const [activeCategory, setActiveCategory] = useState<SkillCategory | 'all'>('all');

  const presets =
    activeCategory === 'all' ? ALL_PRESETS : (PRESETS_BY_CATEGORY[activeCategory] ?? []);

  const handleSelect = (preset: PromptPreset) => {
    if (!preset.promptTemplate || !preset.promptTemplate.includes('{subject}')) {
      onSelect(preset.label, preset.id);
    } else {
      onSelect(`[${preset.label}] `, preset.id);
    }
  };

  return (
    <div className="px-4 py-2 border-t border-[var(--color-border)]">
      {/* Category tabs */}
      <div className="flex gap-1 mb-2">
        <button
          type="button"
          onClick={() => setActiveCategory('all')}
          className={`text-[11px] px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
            activeCategory === 'all'
              ? 'bg-[var(--color-primary)] text-white'
              : 'text-[var(--color-text-muted)] hover:bg-[var(--color-card)]'
          }`}
        >
          All
        </button>
        {CATEGORIES.map((cat) => (
          <button
            key={cat.key}
            type="button"
            onClick={() => setActiveCategory(cat.key)}
            className={`text-[11px] px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
              activeCategory === cat.key
                ? 'bg-[var(--color-primary)] text-white'
                : 'text-[var(--color-text-muted)] hover:bg-[var(--color-card)]'
            }`}
          >
            {cat.emoji} {cat.label}
          </button>
        ))}
      </div>

      {/* Skill chips */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {presets.map((preset) => (
          <button
            key={preset.id}
            type="button"
            onClick={() => handleSelect(preset)}
            title={preset.description}
            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-bg)] text-xs font-medium text-[var(--color-text-muted)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition-colors whitespace-nowrap cursor-pointer"
          >
            <span>{preset.emoji}</span>
            {preset.label}
          </button>
        ))}
      </div>
    </div>
  );
}
