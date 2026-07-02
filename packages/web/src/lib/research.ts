import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

const contentDir = path.join(process.cwd(), 'src/content/research');

export type PostMeta = {
  slug: string;
  title: string;
  date: string;
  description: string;
  tags: string[];
};

export function getAllPosts(): PostMeta[] {
  if (!fs.existsSync(contentDir)) return [];
  return fs
    .readdirSync(contentDir)
    .filter((f) => f.endsWith('.mdx'))
    .map((filename) => {
      const slug = filename.replace('.mdx', '');
      const raw = fs.readFileSync(path.join(contentDir, filename), 'utf8');
      const { data } = matter(raw);
      const date = data.date instanceof Date ? data.date.toISOString().split('T')[0] : String(data.date ?? '');
      return { slug, title: data.title ?? slug, date, description: data.description ?? '', tags: data.tags ?? [] };
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export function getPost(slug: string): { meta: PostMeta; content: string } {
  const filePath = path.join(contentDir, `${slug}.mdx`);
  const raw = fs.readFileSync(filePath, 'utf8');
  const { data, content } = matter(raw);
  const date = data.date instanceof Date ? data.date.toISOString().split('T')[0] : String(data.date ?? '');
  return {
    meta: { slug, title: data.title ?? slug, date, description: data.description ?? '', tags: data.tags ?? [] },
    content,
  };
}
