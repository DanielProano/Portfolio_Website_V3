import { getAllPosts } from '@/lib/research';
import { redirect } from 'next/navigation';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

export default function ResearchIndexPage() {
  const posts = getAllPosts();
  if (posts.length > 0) {
    redirect(`/research/${posts[0].slug}`);
  }
  return (
    <Box sx={{ p: 4 }}>
      <Typography sx={{ color: '#888' }}>No research posts yet.</Typography>
    </Box>
  );
}
