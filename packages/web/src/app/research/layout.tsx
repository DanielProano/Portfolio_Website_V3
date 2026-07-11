import Box from '@mui/material/Box';
import { getAllPosts } from '@/lib/research';
import ResearchNav from './ResearchNav';
import TocSidebar from './TocSidebar';
import type { ReactNode } from 'react';

export default async function ResearchLayout({ children }: { children: ReactNode }) {
  const posts = getAllPosts();

  return (
    <Box sx={{ maxWidth: '1400px', mx: 'auto', display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 3, py: 2, px: { xs: 1.5, md: 3 }, alignItems: 'flex-start' }}>
      <Box
        sx={{
          flex: { xs: '0 0 auto', md: '0 0 clamp(220px, 20vw, 320px)' },
          width: { xs: '100%', md: 'clamp(220px, 20vw, 320px)' },
          backgroundColor: '#1e2535',
          borderRadius: 2,
          position: { xs: 'static', md: 'sticky' },
          top: '70px',
          alignSelf: 'flex-start',
          maxHeight: { xs: 'none', md: 'calc(100vh - 80px)' },
          overflowY: { xs: 'visible', md: 'scroll' },
          scrollbarWidth: 'thin',
          scrollbarColor: 'transparent transparent',
          '&:hover': { scrollbarColor: '#2d3f5e transparent' },
        }}
      >
        <ResearchNav posts={posts} />
        <TocSidebar />
      </Box>

      <Box sx={{ flex: 1, minWidth: 0, width: '100%' }}>
        {children}
      </Box>
    </Box>
  );
}
