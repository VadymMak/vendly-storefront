import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

const KB_DIR = join(process.cwd(), 'docs', 'kb');
const EMBEDDING_MODEL = 'text-embedding-3-small';
const OPENAI_URL = 'https://api.openai.com/v1/embeddings';
const MAX_CHUNK_TOKENS = 800;

interface Chunk {
  heading: string;
  content: string;
  tokens: number;
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function splitMarkdown(content: string): Chunk[] {
  const lines = content.split('\n');
  const chunks: Chunk[] = [];
  let currentHeading = '';
  let currentContent: string[] = [];

  for (const line of lines) {
    if (line.startsWith('## ')) {
      if (currentContent.length > 0) {
        const text = currentContent.join('\n').trim();
        if (text) {
          chunks.push({ heading: currentHeading, content: text, tokens: estimateTokens(text) });
        }
      }
      currentHeading = line.replace(/^##\s+/, '');
      currentContent = [];
    } else if (line.startsWith('# ') && !currentHeading) {
      currentHeading = line.replace(/^#\s+/, '');
    } else {
      currentContent.push(line);
    }
  }

  if (currentContent.length > 0) {
    const text = currentContent.join('\n').trim();
    if (text) {
      chunks.push({ heading: currentHeading, content: text, tokens: estimateTokens(text) });
    }
  }

  const result: Chunk[] = [];
  for (const chunk of chunks) {
    if (chunk.tokens > MAX_CHUNK_TOKENS) {
      const paragraphs = chunk.content.split('\n\n');
      let acc: string[] = [];
      let accTokens = 0;

      for (const para of paragraphs) {
        const paraTokens = estimateTokens(para);
        if (accTokens + paraTokens > MAX_CHUNK_TOKENS && acc.length > 0) {
          result.push({ heading: chunk.heading, content: acc.join('\n\n'), tokens: accTokens });
          acc = [acc[acc.length - 1], para];
          accTokens = estimateTokens(acc.join('\n\n'));
        } else {
          acc.push(para);
          accTokens += paraTokens;
        }
      }
      if (acc.length > 0) {
        result.push({ heading: chunk.heading, content: acc.join('\n\n'), tokens: estimateTokens(acc.join('\n\n')) });
      }
    } else {
      result.push(chunk);
    }
  }

  return result;
}

async function getEmbeddings(texts: string[]): Promise<number[][]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not set');

  const all: number[][] = [];
  for (let i = 0; i < texts.length; i += 20) {
    const batch = texts.slice(i, i + 20);
    const res = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: EMBEDDING_MODEL, input: batch }),
    });

    if (!res.ok) throw new Error(`Embedding API error: ${res.status} ${await res.text()}`);

    const data = await res.json() as { data: Array<{ embedding: number[]; index: number }> };
    all.push(...data.data.sort((a, b) => a.index - b.index).map(d => d.embedding));

    if (i + 20 < texts.length) {
      await new Promise(r => setTimeout(r, 500));
    }
  }

  return all;
}

async function main() {
  console.log('📚 KB Ingestion — starting...\n');

  const files = readdirSync(KB_DIR)
    .filter(f => f.endsWith('.md') && f !== 'README.md')
    .sort();

  console.log(`Found ${files.length} KB files\n`);

  let totalChunks = 0;
  let skipped = 0;

  for (const file of files) {
    const filePath = `docs/kb/${file}`;
    const fullPath = join(KB_DIR, file);
    const content = readFileSync(fullPath, 'utf-8');
    const checksum = createHash('md5').update(content).digest('hex');
    const slug = file.replace(/^\d+-/, '').replace(/\.md$/, '');

    const titleMatch = content.match(/^#\s+(.+)$/m);
    const title = titleMatch ? titleMatch[1] : slug;

    const existing = await db.kbDocument.findUnique({ where: { slug } });
    if (existing?.checksum === checksum) {
      console.log(`⏭️  ${file} — unchanged, skipping`);
      skipped++;
      continue;
    }

    console.log(`📄 ${file} — processing...`);

    if (existing) {
      await db.kbChunk.deleteMany({ where: { documentId: existing.id } });
      await db.kbDocument.delete({ where: { id: existing.id } });
    }

    const doc = await db.kbDocument.create({ data: { slug, title, filePath, checksum } });
    const chunks = splitMarkdown(content);
    console.log(`   → ${chunks.length} chunks`);

    const texts = chunks.map(c => `${c.heading}\n\n${c.content}`);
    const embeddings = await getEmbeddings(texts);

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const embeddingStr = `[${embeddings[i].join(',')}]`;

      await db.$executeRaw`
        INSERT INTO "KbChunk" (id, "documentId", heading, content, tokens, embedding, "createdAt")
        VALUES (
          ${`chunk-${doc.id}-${i}`},
          ${doc.id},
          ${chunk.heading},
          ${chunk.content},
          ${chunk.tokens},
          ${embeddingStr}::vector,
          NOW()
        )
      `;
    }

    totalChunks += chunks.length;
  }

  console.log(`\n✅ Done! Ingested ${totalChunks} chunks from ${files.length - skipped} files (${skipped} skipped)`);
  await db.$disconnect();
}

main().catch(err => {
  console.error('❌ Ingestion failed:', err);
  process.exit(1);
});
