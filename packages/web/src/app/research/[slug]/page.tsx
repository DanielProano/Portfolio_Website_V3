import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import { MDXRemote } from 'next-mdx-remote/rsc';
import { getAllPosts, getPost } from '@/lib/research';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

const mdxComponents = {
  h1: ({ children }: { children?: React.ReactNode }) => (
    <Typography variant="h3" sx={{ mt: 4, mb: 2, fontWeight: 700, color: '#e8f0ff' }}>
      {children}
    </Typography>
  ),
  h2: ({ children }: { children?: React.ReactNode }) => (
    <Typography variant="h4" sx={{ mt: 4, mb: 1.5, fontWeight: 600, color: '#c8d8f0', borderBottom: '1px solid #2d3f5e', pb: 1 }}>
      {children}
    </Typography>
  ),
  h3: ({ children }: { children?: React.ReactNode }) => (
    <Typography variant="h5" sx={{ mt: 3, mb: 1, fontWeight: 600, color: '#b0c4e0' }}>
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
  return { title: `${post.title} | Daniel Proano`, description: post.description };
}

export default async function ResearchPostPage({ params }: { params: { slug: string } }) {
  const posts = getAllPosts();
  const found = posts.find((p) => p.slug === params.slug);
  if (!found) notFound();

  const { meta, content } = getPost(params.slug);

  return (
    <Box sx={{ maxWidth: '720px', py: 3, pr: { xs: 2, md: 4 } }}>
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

        <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mb: 2 }}>
          {meta.tags.map((tag) => (
            <Chip
              key={tag}
              label={tag}
              size="small"
              sx={{ backgroundColor: '#2d3f5e', color: '#90b4e8', fontSize: '0.7rem' }}
            />
          ))}
        </Box>

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
