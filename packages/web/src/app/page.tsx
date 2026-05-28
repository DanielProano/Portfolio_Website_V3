'use client';

import { useState, useEffect } from 'react';
import { Box, Container, Typography, Button, Stack } from '@mui/material';
import Image from 'next/image';

const projects = [
  { id: 1, image: '/projects/team_with_kart.JPG', title: 'Autonomous Team', href: 'https://dannyproano.com/' },
  { id: 2, image: '/projects/selfie_kart.jpg', title: 'Autonomous Racecar Selfie', href: 'https://dannyproano.com' },
  { id: 3, image: '/projects/autonomous_stand.png', title: 'Autonomous Racecar', href: 'https://dannyproano.com/' },
  { id: 4, image: '/projects/purt_team.jpeg', title: 'Autonomous UAV Research', href: 'https://dannyproano.com/' },
  { id: 5, image: '/projects/winning_evc.jpeg', title: 'Winning in EVC', href: 'https://dannyproano.com/' },
  { id: 6, image: '/projects/per_car.jpeg', title: 'PER Racecar', href: 'https://dannyproano.com/' },
  { id: 7, image: '/projects/purt_drone.jpeg', title: 'UAV Drone', href: 'https://dannyproano.com/' },
  { id: 8, image: '/projects/pit_kart.jpg', title: 'Autonomous in pits', href: 'https://dannyproano.com/' },
  { id: 9, image: '/projects/per_car2.jpeg', title: 'PER Racecar', href: 'https://dannyproano.com/' },
  { id: 10, image: '/projects/rain_kart.jpeg', title: 'Autonomus Racecar in Rain', href: 'https://dannyproano.com/' },
  { id: 11, image: '/projects/rocket_drone.jpeg', title: 'PSP Telemetry Drone', href: 'https://dannyproano.com/' },
  { id: 12, image: '/projects/research.jpeg', title: 'Cybersecurity IoT Hacking', href: 'https://dannyproano.com/' },
  { id: 13, image: '/projects/amp.jpeg', title: 'AMP Racecar', href: 'https://dannyproano.com/' },
];

export default function Home() {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % projects.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Container maxWidth="lg">
      <Stack direction="row" spacing={6} sx={{ minHeight: '700vh', alignItems: 'center' }}>
        <Box
          sx={{
            flex: '0 0 300px',
            backgroundColor: '#000000',
            color: '#fff',
            padding: 4,
            borderRadius: 2,
            textAlign: 'center',
          }}
        >
          <Box
            sx={{
              mb: 2,
              borderRadius: 1,
              overflow: 'hidden',
              width: 200,
              height: 200,
              margin: '0 auto 20px',
            }}
          >
            <Image
              src="/profile/self_autonomous.jpg"
              alt="Profile"
              width={200}
              height={200}
              priority
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </Box>

          <Typography variant="h5" sx={{ mb: 1, fontWeight: 'bold' }}>
            Daniel Proano
          </Typography>

          <Typography variant="body2" sx={{ mb: 3, color: '#ccc', lineHeight: 1.6 }}>
            Engineer & builder. I design and build robots, autonomous vehicles, and cool hardware projects.
          </Typography>

          <Stack direction="column" spacing={1}>
            <Button 
              variant="contained" 
              sx={{ backgroundColor: '#fff', color: '#000', fontWeight: 'bold' }} 
              href="/about"
            >
              About
            </Button>
            <Button 
              variant="contained" 
              sx={{ backgroundColor: '#fff', color: '#000', fontWeight: 'bold' }} 
              href="/projects"
            >
              All Projects
            </Button>
            <Button 
              variant="contained" 
              sx={{ backgroundColor: '#fff', color: '#000', fontWeight: 'bold' }} 
              href="/blog"
            >
              Blog
            </Button>
          </Stack>
        </Box>

        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Box
            sx={{
              position: 'relative',
              borderRadius: 2,
              overflow: 'hidden',
              aspectRatio: '1',
              maxWidth: 500,
              boxShadow: 3,
            }}
          >
            <Image
              src={projects[currentIndex].image}
              alt={projects[currentIndex].title}
              width={500}
              height={500}
              priority
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
            <Typography
              variant="h6"
              sx={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                background: 'rgba(0, 0, 0, 0.8)',
                color: '#fff',
                padding: 2,
                margin: 0,
                fontWeight: 'bold',
              }}
            >
              {projects[currentIndex].title}
            </Typography>
          </Box>

          {/* Dots Navigation */}
          <Stack direction="row" spacing={1} justifyContent="center">
            {projects.map((_, index) => (
              <Box
                key={index}
                onClick={() => setCurrentIndex(index)}
                sx={{
                  width: index === currentIndex ? 30 : 12,
                  height: 12,
                  borderRadius: index === currentIndex ? 1 : '50%',
                  backgroundColor: index === currentIndex ? '#000' : '#ddd',
                  cursor: 'pointer',
                  transition: '0.3s',
                  '&:hover': { backgroundColor: '#999' },
                }}
              />
            ))}
          </Stack>
        </Box>
      </Stack>
    </Container>
  );
}