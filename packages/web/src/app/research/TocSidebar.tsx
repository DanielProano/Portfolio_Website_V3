'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';

interface Heading {
  level: number;
  text: string;
  id: string;
}

export default function TocSidebar() {
  const pathname = usePathname();
  const [headings, setHeadings] = useState<Heading[]>([]);

  const isPostPage = /^\/research\/.+/.test(pathname);

  useEffect(() => {
    if (!isPostPage) {
      setHeadings([]);
      return;
    }

    // MDX h1 → Typography variant="h3" → <h3>, h2 → <h4>, h3 → <h5>
    const els = document.querySelectorAll<HTMLElement>('h3[id], h4[id], h5[id]');
    const extracted: Heading[] = [];
    els.forEach((el) => {
      const tag = el.tagName;
      const level = tag === 'H3' ? 1 : tag === 'H4' ? 2 : 3;
      extracted.push({ level, text: el.textContent ?? '', id: el.id });
    });
    setHeadings(extracted);
  }, [pathname, isPostPage]);

  if (!isPostPage || headings.length === 0) return null;

  return (
    <>
      <Divider sx={{ mx: 2, borderColor: '#2d3f5e' }} />
      <Box sx={{ p: 2, pt: 1.5 }}>
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
          On this page
        </Typography>

        <Box sx={{ display: 'flex', flexDirection: 'column' }}>
          {headings.map((h, i) => (
            <Box
              key={i}
              component="a"
              href={`#${h.id}`}
              sx={{
                display: 'block',
                pl: h.level === 1 ? 1 : h.level === 2 ? 1.5 : 2.5,
                py: 0.35,
                fontSize: h.level === 1 ? '0.8rem' : h.level === 2 ? '0.77rem' : '0.73rem',
                color: h.level === 1 ? '#b8ccec' : h.level === 2 ? '#8aa4cc' : '#607090',
                borderLeft: h.level >= 2 ? '1px solid #2d3f5e' : 'none',
                textDecoration: 'none',
                lineHeight: 1.5,
                transition: 'color 0.15s',
                '&:hover': { color: '#e8f0ff' },
              }}
            >
              {h.text}
            </Box>
          ))}
        </Box>
      </Box>
    </>
  );
}
