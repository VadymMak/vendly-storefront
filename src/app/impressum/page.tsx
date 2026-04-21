import fs from 'fs';
import path from 'path';
import type { Metadata } from 'next';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';

export const metadata: Metadata = {
  title: 'Impressum — VendShop',
  description: 'Impressum und rechtliche Angaben für VendShop (vendshop.shop).',
  robots: { index: false },
};

function renderMarkdown(md: string) {
  const lines = md.split('\n');
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith('# ')) {
      elements.push(<h1 key={i} className="text-3xl font-bold text-white mb-8 mt-2">{line.slice(2)}</h1>);
    } else if (line.startsWith('## ')) {
      elements.push(<h2 key={i} className="text-xl font-semibold text-white mt-10 mb-3">{line.slice(3)}</h2>);
    } else if (line.startsWith('### ')) {
      elements.push(<h3 key={i} className="text-base font-semibold text-[--color-text-muted] mt-6 mb-2">{line.slice(4)}</h3>);
    } else if (line.startsWith('- ')) {
      const items: string[] = [];
      while (i < lines.length && lines[i].startsWith('- ')) {
        items.push(lines[i].slice(2));
        i++;
      }
      elements.push(
        <ul key={`ul-${i}`} className="list-disc list-inside space-y-1 text-[--color-text-muted] mb-4 ml-2">
          {items.map((item, j) => <li key={j} dangerouslySetInnerHTML={{ __html: parseBold(item) }} />)}
        </ul>
      );
      continue;
    } else if (line.trim() === '' || line.startsWith('*')) {
      if (line.startsWith('*') && !line.startsWith('**')) {
        elements.push(<p key={i} className="text-sm text-[--color-text-dim] mt-8">{line.replace(/\*/g, '')}</p>);
      }
    } else if (line.trim() !== '') {
      elements.push(
        <p key={i} className="text-[--color-text-muted] leading-relaxed mb-3"
          dangerouslySetInnerHTML={{ __html: parseBold(line) }} />
      );
    }
    i++;
  }
  return elements;
}

function parseBold(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong class="text-white font-medium">$1</strong>')
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" class="text-[--color-primary] underline hover:opacity-80" target="_blank" rel="noopener noreferrer">$1</a>');
}

export default function ImpressumPage() {
  const filePath = path.join(process.cwd(), 'legal', 'impressum.md');
  const content = fs.readFileSync(filePath, 'utf-8');

  return (
    <>
      <Header />
      <main className="min-h-screen bg-[--color-bg]">
        <div className="mx-auto max-w-3xl px-4 py-20 sm:px-6 sm:py-28">
          <div className="rounded-2xl border border-[--color-border] bg-[--color-card] p-8 sm:p-12">
            {renderMarkdown(content)}
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
