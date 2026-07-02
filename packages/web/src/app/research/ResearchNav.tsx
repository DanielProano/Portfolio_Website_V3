'use client';

import { Box, Typography } from '@mui/material';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { PostMeta } from '@/lib/research';

export default function ResearchNav({ posts }: { posts: PostMeta[] }) {
  const pathname = usePathname();

  return (
    <Box sx={{ p: 2 }}>
      <Typography
        sx={{
          color: '#90b4e8',
          letterSpacing: 2,
          fontSize: '0.7rem',
          fontWeight: 700,
          textTransform: 'uppercase',
          px: 1,
          display: 'block',
          mb: 1.5,
        }}
      >
        Research
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
        {posts.map((post) => {
          const isActive = pathname === `/research/${post.slug}`;
          return (
            <Box
              key={post.slug}
              component={Link}
              href={`/research/${post.slug}`}
              sx={{
                display: 'block',
                px: 1.5,
                py: 1,
                borderRadius: 1,
                textDecoration: 'none',
                backgroundColor: isActive ? '#2d3f5e' : 'transparent',
                borderLeft: `2px solid ${isActive ? '#90b4e8' : 'transparent'}`,
                '&:hover': { backgroundColor: isActive ? '#2d3f5e' : '#253350' },
                transition: 'all 0.15s',
              }}
            >
              <Typography
                sx={{
                  color: isActive ? '#90b4e8' : '#ccc',
                  fontWeight: isActive ? 600 : 400,
                  fontSize: '0.8rem',
                  lineHeight: 1.4,
                }}
              >
                {post.title}
              </Typography>
              {post.date && (
                <Typography sx={{ color: '#555', fontSize: '0.7rem', mt: 0.25 }}>
                  {new Date(post.date + 'T00:00:00').toLocaleDateString('en-US', {
                    month: 'short',
                    year: 'numeric',
                  })}
                </Typography>
              )}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
