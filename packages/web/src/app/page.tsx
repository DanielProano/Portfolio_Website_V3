'use client';

import { useState, useEffect } from 'react';
import { Box, Container, Typography, Stack, Chip, IconButton, Tooltip, Button } from '@mui/material';
import Image from 'next/image';
import GitHubIcon from '@mui/icons-material/GitHub';
import LinkedInIcon from '@mui/icons-material/LinkedIn';
import EmailIcon from '@mui/icons-material/Email';

const projects = [
  { id: 1, image: '/projects/slideshow/team_with_kart.JPG', title: 'Autonomous Team', href: 'https://dannyproano.com/' },
  { id: 2, image: '/projects/slideshow/selfie_kart.jpg', title: 'Autonomous Racecar Selfie', href: 'https://dannyproano.com' },
  { id: 3, image: '/projects/slideshow/purt_team.jpeg', title: 'Autonomous UAV Research', href: 'https://dannyproano.com/' },
  { id: 4, image: '/projects/slideshow/autonomous_stand.png', title: 'Autonomous Racecar', href: 'https://dannyproano.com/' },
  { id: 5, image: '/projects/slideshow/winning_evc.jpeg', title: 'Winning in EVC', href: 'https://dannyproano.com/' },
  { id: 6, image: '/projects/slideshow/running.JPG', title: 'Running After Kart', href: 'https://dannyproano.com/' },
  { id: 7, image: '/projects/slideshow/purt_drone.jpeg', title: 'UAV Drone', href: 'https://dannyproano.com/' },
  { id: 8, image: '/projects/slideshow/pit_kart.jpg', title: 'Autonomous in pits', href: 'https://dannyproano.com/' },
  { id: 9, image: '/projects/slideshow/per_car2.jpeg', title: 'PER Racecar', href: 'https://dannyproano.com/' },
  { id: 10, image: '/projects/slideshow/rain_kart.jpeg', title: 'Autonomus Racecar in Rain', href: 'https://dannyproano.com/' },
  { id: 11, image: '/projects/slideshow/rocket_drone.jpeg', title: 'PSP Telemetry Drone', href: 'https://dannyproano.com/' },
  { id: 12, image: '/projects/slideshow/research.jpeg', title: 'Cybersecurity IoT Hacking', href: 'https://dannyproano.com/' },
  { id: 13, image: '/projects/slideshow/per_car.jpeg', title: 'PER Racecar', href: 'https://dannyproano.com/' },
];

const highlights = [
  {
    title: "I made an Autonomous Racecar",
    description: "We won 1st place in the International Autonomous Karting Series! I built everything from the computer vision algorithm to cutting the steel for the chassis!",
    image: "/projects/EVC/team_kart.JPG",
    link: "https://github.com/EVC-Purdue/AutonomousKart"
  },
  {
    title: "Firefly: A Real Time OS for the STM32F4",
    description: "I hand-made a real time operating system for the STM32f4 microcontroller, featuring a preemptvie scheduler with priority-based task & queue, mutex, and sempaphore primitives!"
  },
  {
    title: "Starling: An Autonomous Drone Fleet Coordinator",
    description: "Coming Soon"
  },
  {
    title: "Buffalo: A Secure Bootloader for STM32 in Spark ADA & C",
    description: "Coming Soon"
  },
  {
    title: "Dragonfly: A Drone Flight Controller",
    description: "Coming Soon"
  },
  {
    title: "A PHAL for a RaceCar",
    description: "Coming Soon"
  },
  {
    title: "Vulnerability Research on Baby Monitor",
    description: "Software lead conducting vulnerability research using Android phone emulation and reverse engineering techniques to do binary exploitation, network analysis, and static analysis",
    image: "/projects/slideshow/research.jpeg"
  },
  {
    title: "Portfolio Website",
    description: "I've made 3 versions of my Portfolio website, getting experience in AWS, GCR, Vercel, Next.js, React, Javascript, load balancers and more!",
    image: "/projects/highlights/website.png",
    link: "https://github.com/DanielProano/Portfolio_Website_V3"
  },
  {
    title: "A Modern Zero-Knowledge Password Manager",
    description: "A traditional password manager can leak your passwords, but my implementation of the Zero-Knowledge Architecture is designed to address that!",
    image: "/projects/highlights/PasswordManagerPhoto.png",
    link: "https://dannyproano.com/password/login"
  },
  {
    title: "Chess Engine 3.0 w/ Rust + React",
    description: "A hand-made Rust chess engine implementing advanced alpha-beta pruning, complete move generation, and a whole frontend with fen integration!",
    image: "/projects/highlights/chess.png",
    link: "https://github.com/DanielProano/ChessBot"
  },
  {
    title: "Object Detection with Drones",
    description: "I made over 30 different YOLOv8 AI models for Corn Tassel object detection from a drone!",
    image: "/projects/highlights/tassel_detection.png",
    link: "https://dannyproano.com/Purt"
  },
  {
    title: "Hardware Hacking a 2002 Card Reader",
    description: "I researched how to exploit and take control of a 2002 Smart Card Reader using fuzzing and bruteforce.",
    image: "/projects/highlights/smart_card.jpeg",
    link: "https://dannyproano.com/Hacking_2002_Card_Reader"
  },
  {
    title: "Enigma Machine",
    description: "I recreated history's most famous encryption algorithm: the Enigma Machine.",
    image: "/projects/highlights/enigma_machine.png",
    link: "https://dannyproano.com/enigma_machine"
  },
];

export default function Home() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [emailCopied, setEmailCopied] = useState(false);

  const handleCopyEmail = () => {
    navigator.clipboard.writeText('daniel.proano@yahoo.com');
    setEmailCopied(true);
    setTimeout(() => setEmailCopied(false), 2000);
  };
  const handlePrev = () => setCurrentIndex((prev) => (prev - 1 + projects.length) % projects.length);
  const handleNext = () => setCurrentIndex((prev) => (prev + 1) % projects.length);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % projects.length);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Container maxWidth={false} sx={{ py: 2, px: 0 }}>

      {/* ── Top row: sidebar + slideshow ── */}
      <Stack direction="row" spacing={4} sx={{ mb: 6 }}>

        {/* Sidebar */}
        <Box
          sx={{
            flex: '0 0 clamp(200px, 22vw, 300px)',
            minWidth: 'clamp(200px, 22vw, 300px)',
            backgroundColor: '#1e2535',
            color: '#ffffff',
            padding: 3,
            borderRadius: 8,
            alignSelf: 'flex-start',
          }}
        >
          <Box sx={{ mb: 2, borderRadius: 1, aspectRatio: '1' }}>
            <Image
              src="/profile/self_autonomous.jpg"
              alt="Profile"
              width={450}
              height={450}
              priority
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </Box>

          <Typography variant="h5" sx={{ mb: 0.5, fontWeight: 'bold' }}>
            Daniel Proano
          </Typography>

          <Typography variant="body2" sx={{ mb: 0.5, color: '#90b4e8', fontWeight: 600, letterSpacing: 0.5 }}>
            Embedded Security Engineer
          </Typography>

          <Typography variant="body2" sx={{ mb: 0.5, color: '#aaa', fontSize: '0.75rem' }}>
            BBI Logistics · Purdue University
          </Typography>

          <Typography variant="body2" sx={{ mb: 2, color: '#6dbf6d', fontSize: '0.75rem', fontWeight: 600 }}>
            Open to internships · May 2028
          </Typography>

          <Typography variant="body2" sx={{ mb: 3, color: '#ccc', lineHeight: 1.6 }}>
            I specialize in designing performant & secure systems for
            everything from race cars to drones to rocket ships!
          </Typography>

          {/* Social links — update LinkedIn href and mailto below */}
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <Tooltip title="GitHub">
              <IconButton
                component="a"
                href="https://github.com/DanielProano"
                target="_blank"
                rel="noopener noreferrer"
                sx={{ color: '#aaa', '&:hover': { color: '#fff' }, p: 0.75 }}
              >
                <GitHubIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="LinkedIn">
              <IconButton
                component="a"
                href="https://linkedin.com/in/danielproano"
                target="_blank"
                rel="noopener noreferrer"
                sx={{ color: '#aaa', '&:hover': { color: '#0a66c2' }, p: 0.75 }}
              >
                <LinkedInIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title={emailCopied ? 'Copied!' : 'daniel.proano@yahoo.com'}>
              <IconButton
                onClick={handleCopyEmail}
                sx={{ color: '#aaa', '&:hover': { color: '#64b5f6' }, p: 0.75 }}
              >
                <EmailIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>

          <Button
            component="a"
            href="/resume.pdf"
            download
            fullWidth
            variant="outlined"
            sx={{
              mt: 1,
              color: '#90b4e8',
              borderColor: '#3d5280',
              textTransform: 'none',
              fontWeight: 600,
              '&:hover': { borderColor: '#90b4e8', backgroundColor: '#2d3f5e' },
            }}
          >
            Resume
          </Button>
        </Box>

        {/* Slideshow */}
        <Box sx={{ flex: 1, minWidth: 0, maxWidth: { xl: '750px' }, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Box
            sx={{
              position: 'relative',
              borderRadius: 2,
              overflow: 'hidden',
              aspectRatio: '4/3',
              width: '100%',
              minHeight: { xs: '380px', md: '420px', lg: '300px' },
              boxShadow: 3,
            }}
          >
            <Image
              src={projects[currentIndex].image}
              alt={projects[currentIndex].title}
              width={1025}
              height={1025}
              priority
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />

            <Box
              onClick={handlePrev}
              sx={{
                position: 'absolute',
                left: 8,
                top: '50%',
                transform: 'translateY(-50%)',
                backgroundColor: 'rgba(0,0,0,0.5)',
                color: '#fff',
                borderRadius: '50%',
                width: 36,
                height: 36,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                zIndex: 1,
                '&:hover': { backgroundColor: 'rgba(0,0,0,0.8)' },
              }}
            >
              ‹
            </Box>

            <Box
              onClick={handleNext}
              sx={{
                position: 'absolute',
                right: 8,
                top: '50%',
                transform: 'translateY(-50%)',
                backgroundColor: 'rgba(0,0,0,0.5)',
                color: '#fff',
                borderRadius: '50%',
                width: 36,
                height: 36,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                zIndex: 1,
                '&:hover': { backgroundColor: 'rgba(0,0,0,0.8)' },
              }}
            >
              ›
            </Box>

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

          <Stack direction="row" spacing={1} justifyContent="center" sx={{ maxWidth: { xs: '100%', lg: '90%' } }}>
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

      {/* ── Full-width: project highlights ── */}
      <Box sx={{ py: 2 }}>
        <Typography variant="h4" sx={{ color: '#fff', fontWeight: 'bold', mb: 4 }}>
          Project Highlights
        </Typography>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr 1fr' },
            gap: 3,
          }}
        >
          {highlights.map((project, index) => (
            <Box
              key={index}
              onClick={() => project.link && window.open(project.link, '_blank')}
              sx={{
                backgroundColor: '#1e2535',
                borderRadius: 4,
                overflow: 'hidden',
                cursor: project.link ? 'pointer' : 'default',
                transition: '0.2s',
                '&:hover': project.link
                  ? { transform: 'translateY(-4px)', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }
                  : {},
              }}
            >
              {project.image && (
                <Box sx={{ width: '100%', aspectRatio: '16/9', position: 'relative' }}>
                  <Image
                    src={project.image}
                    alt={project.title}
                    fill
                    style={{ objectFit: 'cover' }}
                  />
                </Box>
              )}
              <Box sx={{ p: { xs: 2, lg: 3 } }}>
                <Typography variant="h6" sx={{ color: '#fff', fontWeight: 'bold', mb: 1, fontSize: { xs: '0.85rem', md: '0.95rem', lg: '1.1rem' } }}>
                  {project.title}
                </Typography>
                <Typography variant="body2" sx={{ color: '#ccc', lineHeight: 1.6, fontSize: { xs: '0.7rem', md: '0.78rem', lg: '0.875rem' } }}>
                  {project.description}
                </Typography>
              </Box>
            </Box>
          ))}
        </Box>
      </Box>

    </Container>
  );
}
