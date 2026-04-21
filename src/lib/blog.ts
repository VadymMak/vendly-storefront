import fs from 'fs';
import path from 'path';

export interface BlogPost {
  slug: string;
  locale: string;
  title: string;
  description: string;
  date: string;
  image?: string;
  tags: string[];
  author: string;
  readingTime: number;
  content: string;
  alternates?: Record<string, string>;
}

const BLOG_DIR = path.join(process.cwd(), 'content', 'blog');

// ─── Frontmatter parser (no gray-matter dependency) ───────────────────────────

function parseFrontmatter(source: string): { frontmatter: Record<string, unknown>; content: string } {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { frontmatter: {}, content: source.trim() };

  const yaml = match[1];
  const content = match[2].trim();
  const frontmatter: Record<string, unknown> = {};

  let i = 0;
  const lines = yaml.split('\n');
  while (i < lines.length) {
    const line = lines[i];
    const kvMatch = line.match(/^(\w+):\s*(.*)$/);
    if (!kvMatch) { i++; continue; }
    const [, key, rawVal] = kvMatch;

    // Inline array: tags: [a, b, c]
    if (rawVal.trimStart().startsWith('[')) {
      const inner = rawVal.match(/\[([^\]]*)\]/)?.[1] ?? '';
      frontmatter[key] = inner.split(',').map(s => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
      i++;
      continue;
    }

    // Block array: tags:\n  - x\n  - y
    if (rawVal.trim() === '') {
      const items: string[] = [];
      i++;
      while (i < lines.length && lines[i].match(/^\s+-\s/)) {
        items.push(lines[i].replace(/^\s+-\s+/, '').trim().replace(/^["']|["']$/g, ''));
        i++;
      }
      if (items.length) { frontmatter[key] = items; continue; }
      // Nested object (for alternates)
      const obj: Record<string, string> = {};
      while (i < lines.length && lines[i].match(/^\s+\w+:\s/)) {
        const nm = lines[i].match(/^\s+(\w+):\s*(.+)$/);
        if (nm) obj[nm[1]] = nm[2].trim().replace(/^["']|["']$/g, '');
        i++;
      }
      if (Object.keys(obj).length) { frontmatter[key] = obj; continue; }
      continue;
    }

    frontmatter[key] = rawVal.trim().replace(/^["']|["']$/g, '');
    i++;
  }

  return { frontmatter, content };
}

// ─── Inline markdown → Tailwind HTML renderer ─────────────────────────────────

function processInline(text: string): string {
  return text
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong class="font-bold text-white"><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-white">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em class="italic">$1</em>')
    .replace(/`([^`]+)`/g, '<code class="rounded bg-[--color-bg] px-1.5 py-0.5 text-sm text-[--color-primary] font-mono">$1</code>')
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" class="text-[--color-primary] underline hover:opacity-80" rel="noopener noreferrer">$1</a>');
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function renderMarkdown(md: string): string {
  const lines = md.split('\n');
  const result: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block
    if (line.startsWith('```')) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      result.push(
        `<pre class="my-6 overflow-x-auto rounded-xl border border-[--color-border] bg-[--color-bg] p-4 text-sm"><code class="text-[--color-text-muted]">${escapeHtml(codeLines.join('\n'))}</code></pre>`
      );
      i++; // skip closing ```
      continue;
    }

    // Headings
    if (line.startsWith('### ')) {
      result.push(`<h3 class="mb-3 mt-8 text-lg font-semibold text-white">${processInline(line.slice(4))}</h3>`);
    } else if (line.startsWith('## ')) {
      result.push(`<h2 class="mb-4 mt-10 text-xl font-bold text-white">${processInline(line.slice(3))}</h2>`);
    } else if (line.startsWith('# ')) {
      result.push(`<h1 class="mb-5 mt-12 text-2xl font-bold text-white">${processInline(line.slice(2))}</h1>`);
    }

    // Blockquote
    else if (line.startsWith('> ')) {
      result.push(
        `<blockquote class="my-5 border-l-4 border-[--color-primary] pl-5 italic text-[--color-text-muted]">${processInline(line.slice(2))}</blockquote>`
      );
    }

    // Horizontal rule
    else if (line.trim() === '---') {
      result.push('<hr class="my-8 border-[--color-border]" />');
    }

    // Unordered list
    else if (line.startsWith('- ')) {
      const items: string[] = [];
      while (i < lines.length && lines[i].startsWith('- ')) {
        items.push(lines[i].slice(2));
        i++;
      }
      const lis = items.map(
        (it) => `<li class="flex gap-2.5"><span class="mt-2.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[--color-primary]"></span><span>${processInline(it)}</span></li>`
      ).join('');
      result.push(`<ul class="my-5 space-y-2 text-[--color-text-muted]">${lis}</ul>`);
      continue;
    }

    // Ordered list
    else if (/^\d+\.\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s+/, ''));
        i++;
      }
      const lis = items.map(
        (it, idx) => `<li class="flex gap-3"><span class="flex-shrink-0 font-semibold text-[--color-primary]">${idx + 1}.</span><span class="text-[--color-text-muted]">${processInline(it)}</span></li>`
      ).join('');
      result.push(`<ol class="my-5 space-y-2">${lis}</ol>`);
      continue;
    }

    // Empty line → skip
    else if (line.trim() === '') {
      // intentional no-op
    }

    // Paragraph
    else {
      result.push(`<p class="my-4 leading-relaxed text-[--color-text-muted]">${processInline(line)}</p>`);
    }

    i++;
  }

  return result.join('\n');
}

// ─── File readers ──────────────────────────────────────────────────────────────

export function getPostSlugs(locale: string): string[] {
  const dir = path.join(BLOG_DIR, locale);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => f.replace('.md', ''));
}

export function getAllPostSlugsForSitemap(): Array<{ slug: string; locale: string }> {
  if (!fs.existsSync(BLOG_DIR)) return [];
  return fs
    .readdirSync(BLOG_DIR)
    .flatMap((locale) => getPostSlugs(locale).map((slug) => ({ slug, locale })));
}

export function getPostBySlug(slug: string, locale: string): BlogPost | null {
  const localePath = path.join(BLOG_DIR, locale, `${slug}.md`);
  const enPath = path.join(BLOG_DIR, 'en', `${slug}.md`);

  let filePath: string;
  if (fs.existsSync(localePath)) {
    filePath = localePath;
  } else if (fs.existsSync(enPath)) {
    filePath = enPath;
  } else {
    return null;
  }

  const source = fs.readFileSync(filePath, 'utf-8');
  const { frontmatter, content } = parseFrontmatter(source);
  const wordCount = content.split(/\s+/).length;

  return {
    slug,
    locale: (frontmatter.locale as string) ?? locale,
    title: (frontmatter.title as string) ?? slug,
    description: (frontmatter.description as string) ?? '',
    date: (frontmatter.date as string) ?? '',
    image: frontmatter.image as string | undefined,
    tags: (frontmatter.tags as string[]) ?? [],
    author: (frontmatter.author as string) ?? 'VendShop Team',
    readingTime: Math.max(1, Math.ceil(wordCount / 200)),
    content,
    alternates: frontmatter.alternates as Record<string, string> | undefined,
  };
}

export function getAllPosts(locale: string): BlogPost[] {
  let slugs = getPostSlugs(locale);
  let effectiveLocale = locale;

  if (slugs.length === 0) {
    slugs = getPostSlugs('en');
    effectiveLocale = 'en';
  }

  return slugs
    .map((slug) => getPostBySlug(slug, effectiveLocale))
    .filter((p): p is BlogPost => p !== null)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export function formatPostDate(date: string, locale: string): string {
  try {
    const localeMap: Record<string, string> = {
      en: 'en-US', de: 'de-DE', sk: 'sk-SK', cs: 'cs-CZ', uk: 'uk-UA',
    };
    return new Intl.DateTimeFormat(localeMap[locale] ?? 'en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
    }).format(new Date(date));
  } catch {
    return date;
  }
}
