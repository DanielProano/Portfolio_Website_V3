import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import { MDXRemote } from 'next-mdx-remote/rsc';
import { getAllPosts, getPost } from '@/lib/research';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

function extractText(node: React.ReactNode): string {
  if (typeof node === 'string') return node;
  if (typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(extractText).join('');
  if (node !== null && typeof node === 'object' && 'props' in (node as object)) {
    return extractText((node as React.ReactElement).props.children);
  }
  return '';
}


const mdxComponents = {
  h1: ({ children }: { children?: React.ReactNode }) => (
    <Typography variant="h3" id={slugify(extractText(children))} sx={{ mt: 4, mb: 2, fontWeight: 700, color: '#e8f0ff', scrollMarginTop: '80px' }}>
      {children}
    </Typography>
  ),
  h2: ({ children }: { children?: React.ReactNode }) => (
    <Typography variant="h4" id={slugify(extractText(children))} sx={{ mt: 4, mb: 1.5, fontWeight: 600, color: '#c8d8f0', borderBottom: '1px solid #2d3f5e', pb: 1, scrollMarginTop: '80px' }}>
      {children}
    </Typography>
  ),
  h3: ({ children }: { children?: React.ReactNode }) => (
    <Typography variant="h5" id={slugify(extractText(children))} sx={{ mt: 3, mb: 1, fontWeight: 600, color: '#b0c4e0', scrollMarginTop: '80px' }}>
      {children}
    </Typography>
  ),
  p: ({ children }: { children?: React.ReactNode }) => (
    <Typography variant="body1" sx={{ mb: 2, lineHeight: 1.85, color: '#ccc' }}>
      {children}
    </Typography>
  ),
  strong: ({ children }: { children?: React.ReactNode }) => (
    <Box component="strong" sx={{ color: '#90b4e8', fontWeight: 700 }}>
      {children}
    </Box>
  ),
  code: ({ children, className }: { children?: React.ReactNode; className?: string }) => {
    if (className) {
      return <code className={className}>{children}</code>;
    }
    return (
      <Box
        component="code"
        sx={{
          backgroundColor: '#1a2030',
          color: '#90b4e8',
          px: 0.75,
          py: 0.2,
          borderRadius: 0.5,
          fontFamily: 'monospace',
          fontSize: '0.875em',
        }}
      >
        {children}
      </Box>
    );
  },
  pre: ({ children }: { children?: React.ReactNode }) => (
    <Box
      component="pre"
      sx={{
        backgroundColor: '#141920',
        border: '1px solid #2d3f5e',
        borderRadius: 1,
        p: 2,
        mb: 2.5,
        overflowX: 'auto',
        fontFamily: 'monospace',
        fontSize: '0.85rem',
        lineHeight: 1.65,
        color: '#d0e0f0',
        '& code': {
          backgroundColor: 'transparent',
          color: 'inherit',
          padding: 0,
          borderRadius: 0,
          fontSize: 'inherit',
          fontFamily: 'inherit',
        },
      }}
    >
      {children}
    </Box>
  ),
  ul: ({ children }: { children?: React.ReactNode }) => (
    <Box component="ul" sx={{ pl: 3, mb: 2, color: '#ccc' }}>
      {children}
    </Box>
  ),
  ol: ({ children }: { children?: React.ReactNode }) => (
    <Box component="ol" sx={{ pl: 3, mb: 2, color: '#ccc' }}>
      {children}
    </Box>
  ),
  li: ({ children }: { children?: React.ReactNode }) => (
    <Box component="li" sx={{ mb: 0.75, lineHeight: 1.75 }}>
      {children}
    </Box>
  ),
  hr: () => <Divider sx={{ my: 3, borderColor: '#2d3f5e' }} />,
  img: ({ src, alt }: { src?: string; alt?: string }) => (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', my: 3, gap: 1 }}>
      <Box
        component="img"
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        sx={{
          display: 'block',
          maxWidth: '100%',
          maxHeight: '450px',
          height: 'auto',
          width: 'auto',
          mx: 'auto',
          borderRadius: 1,
          border: '1px solid #2d3f5e',
          objectFit: 'contain',
        }}
      />
      {alt && (
        <Typography variant="body2" sx={{ color: '#888', fontStyle: 'italic', textAlign: 'center', fontSize: '0.8rem' }}>
          {alt}
        </Typography>
      )}
    </Box>
  ),
  figure: ({ children }: { children?: React.ReactNode }) => (
    <Box
      component="figure"
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        mx: 0,
        my: 3,
        gap: 1,
        '& figcaption': {
          color: '#888',
          fontStyle: 'italic',
          textAlign: 'center',
          fontSize: '0.8rem',
          fontFamily: 'inherit',
        },
      }}
    >
      {children}
    </Box>
  ),
  figcaption: ({ children }: { children?: React.ReactNode }) => (
    <Box
      component="figcaption"
      style={{
        color: '#888',
        fontStyle: 'italic',
        textAlign: 'center',
        fontSize: '0.8rem',
        width: '100%',
        margin: 0,
        fontFamily: 'inherit',
      }}
    >
      {children}
    </Box>
  ),
  video: ({
    src,
    children,
    controls,
    autoPlay,
    loop,
    muted,
    poster,
    preload,
  }: {
    src?: string;
    children?: React.ReactNode;
    controls?: boolean;
    autoPlay?: boolean;
    loop?: boolean;
    muted?: boolean;
    poster?: string;
    preload?: string;
  }) => (
    <Box sx={{ width: '100%', display: 'flex', justifyContent: 'center', my: 3 }}>
      <Box
        component="video"
        src={src}
        controls={controls}
        autoPlay={autoPlay}
        loop={loop}
        muted={muted}
        poster={poster}
        preload={preload}
        sx={{
          maxWidth: '100%',
          maxHeight: '450px',
          borderRadius: 1,
          border: '1px solid #2d3f5e',
        }}
      >
        {children}
      </Box>
    </Box>
  ),
  VideoFigure: ({ src, caption, controls, autoPlay, loop, muted, poster }: {
    src?: string;
    caption?: string;
    controls?: boolean;
    autoPlay?: boolean;
    loop?: boolean;
    muted?: boolean;
    poster?: string;
  }) => (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', my: 3, gap: 1 }}>
      <Box
        component="video"
        src={src}
        controls={controls}
        autoPlay={autoPlay}
        loop={loop}
        muted={muted}
        poster={poster}
        sx={{ maxWidth: '100%', maxHeight: '450px', borderRadius: 1, border: '1px solid #2d3f5e' }}
      />
      {caption && (
        <Box
          component="span"
          style={{ color: '#888', fontStyle: 'italic', textAlign: 'center', fontSize: '0.8rem', display: 'block', width: '100%' }}
        >
          {caption}
        </Box>
      )}
    </Box>
  ),
  a: ({ href, children }: { href?: string; children?: React.ReactNode }) => (
    <Box
      component="a"
      href={href}
      target={href?.startsWith('http') ? '_blank' : undefined}
      rel={href?.startsWith('http') ? 'noopener noreferrer' : undefined}
      sx={{
        color: '#90b4e8',
        textDecoration: 'none',
        borderBottom: '1px solid rgba(144, 180, 232, 0.35)',
        transition: 'color 0.15s, border-color 0.15s',
        '&:hover': {
          color: '#b8d0f5',
          borderBottomColor: '#b8d0f5',
        },
      }}
    >
      {children}
    </Box>
  ),
  blockquote: ({ children }: { children?: React.ReactNode }) => (
    <Box
      component="blockquote"
      sx={{
        borderLeft: '3px solid #90b4e8',
        pl: 2,
        ml: 0,
        mb: 2,
        color: '#aaa',
        fontStyle: 'italic',
      }}
    >
      {children}
    </Box>
  ),
};

export async function generateStaticParams() {
  return getAllPosts().map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const posts = getAllPosts();
  const post = posts.find((p) => p.slug === params.slug);
  if (!post) return {};
  const url = `https://dannyproano.com/research/${post.slug}`;
  return {
    title: `${post.title} | Daniel Proano`,
    description: post.description,
    alternates: { canonical: url },
    openGraph: {
      title: post.title,
      description: post.description,
      url,
      type: 'article',
      publishedTime: post.date,
      authors: ['Daniel Proano'],
      tags: post.tags,
    },
    twitter: {
      card: 'summary',
      title: post.title,
      description: post.description,
    },
  };
}

export default async function ResearchPostPage({ params }: { params: { slug: string } }) {
  const posts = getAllPosts();
  const found = posts.find((p) => p.slug === params.slug);
  if (!found) notFound();

  const { meta, content } = getPost(params.slug);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: meta.title,
    description: meta.description,
    datePublished: meta.date,
    author: { '@type': 'Person', name: 'Daniel Proano', url: 'https://dannyproano.com' },
    url: `https://dannyproano.com/research/${meta.slug}`,
    keywords: meta.tags.join(', '),
  };

  return (
    <Box sx={{ maxWidth: '720px', width: '100%', py: 3, px: { xs: 3, md: 4 } }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* Article header */}
      <Box sx={{ mb: 4 }}>
        <Typography
          variant="h2"
          sx={{ fontWeight: 700, color: '#e8f0ff', mb: 1.5, lineHeight: 1.2, fontSize: { xs: '1.75rem', md: '2.25rem' } }}
        >
          {meta.title}
        </Typography>

        <Typography variant="body2" sx={{ color: '#888', mb: 1.5 }}>
          {new Date(meta.date + 'T00:00:00').toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </Typography>

        <Typography variant="body1" sx={{ color: '#aaa', fontStyle: 'italic', lineHeight: 1.7 }}>
          {meta.description}
        </Typography>

        <Divider sx={{ mt: 3, borderColor: '#2d3f5e' }} />
      </Box>

      {/* MDX body */}
      <MDXRemote source={content} components={mdxComponents} />
    </Box>
  );
}
