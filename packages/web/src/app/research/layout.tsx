import Box from '@mui/material/Box';
import { getAllPosts } from '@/lib/research';
import ResearchNav from './ResearchNav';
import type { ReactNode } from 'react';

export default async function ResearchLayout({ children }: { children: ReactNode }) {
  const posts = getAllPosts();

  return (
    <Box sx={{ maxWidth: '1400px', mx: 'auto', display: 'flex', gap: 3, py: 2, alignItems: 'flex-start' }}>
      <Box
        sx={{
          flex: '0 0 clamp(220px, 20vw, 320px)',
          minWidth: 'clamp(220px, 20vw, 320px)',
          backgroundColor: '#1e2535',
          borderRadius: 2,
          position: 'sticky',
          top: '70px',
          alignSelf: 'flex-start',
          maxHeight: 'calc(100vh - 80px)',
          overflowY: 'auto',
        }}
      >
        <ResearchNav posts={posts} />
      </Box>

      <Box sx={{ flex: 1, minWidth: 0, display: 'flex', justifyContent: 'center' }}>
        {children}
      </Box>
    </Box>
  );
}
