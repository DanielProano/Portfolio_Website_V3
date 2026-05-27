'use client';

import { useState, useEffect } from 'react';
import { AppBar, Toolbar, Typography, Button, Box, Container } from '@mui/material';
import Link from 'next/link';

const navButtonStyle = {
    color: '#f0e8e8',
    fontSize: '1rem',
    textTransform: 'none',
    '&:hover': { 
        color: '#64b5f6',
        transition: 'color 0.3s'
    }
};

export function TopBar() {
    const [isVisible, setIsVisble] = useState(true);
    const [lastScrollY, setLastScrollY] = useState(0);

    useEffect(() => {
        const handleScroll = () => {
            const currentScrollY = window.scrollY;
            setIsVisble(currentScrollY < lastScrollY || currentScrollY < 50);
            setLastScrollY(currentScrollY);
        };

        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, [lastScrollY]);

    return (
        <AppBar position="sticky" sx={{ backgroundColor: '#2a3b5a', boxShadow: 20, transform: isVisible ? 'translateY(0)' : 'translate(-100%)', }}>
            <Container maxWidth="lg">
                <Toolbar sx={{ justifyContent: 'space-between', py: 1.5 }}>
                    <Typography 
                        variant="h6" 
                        sx={{ 
                            fontWeight: 'bold', 
                            fontSize: '2rem',
                            letterSpacing: 1
                        }}
                    >
                        Danny Proano
                    </Typography>

                    <Box sx={{ display: 'flex', gap: 3 }}>
                        <Link href="/" style={{ textDecoration: 'none' }}>
                            <Button sx={navButtonStyle} >Home</Button>
                        </Link>
                        <Link href="/about" style={{ textDecoration: 'none' }}>
                            <Button sx={navButtonStyle}>About</Button>
                        </Link>
                        <Link href="/blog" style={{ textDecoration: 'none' }}>
                            <Button sx={navButtonStyle}>Blog</Button>
                        </Link>
                        <Link href="/vault" style={{ textDecoration: 'none' }}>
                            <Button sx={navButtonStyle}>Password Manager</Button>
                        </Link>
                        <Link href="/chess" style={{ textDecoration: 'none' }}>
                            <Button sx={navButtonStyle}>Chess</Button>
                        </Link>
                    </Box>
                </Toolbar>
            </Container>
        </AppBar>
    );
}