'use client';

import { useState, useEffect, ReactNode } from 'react';
import { AppBar, Toolbar, Typography, Button, Box, Select, MenuItem, IconButton } from '@mui/material';
import { useRouter } from 'next/navigation';
import GitHubIcon from '@mui/icons-material/GitHub';
import LinkedInIcon from '@mui/icons-material/LinkedIn';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';

const navButtonStyle = {
    color: '#f0e8e8',
    fontSize: { xs: '0.6rem', sm: '0.85rem', md: '1.3rem' },
    textTransform: 'none',
    minWidth: 0,
    px: { xs: 0.5, sm: 1, md: 1.5 },
    '&:hover': {
        color: '#64b5f6',
        transition: 'color 0.3s'
    }
};

const dropDownStyle = {
    color: '#f0e8e8',
    fontSize: { xs: '0.6rem', sm: '0.85rem', md: '1.3rem' },
    minWidth: 0,
    textTransform: 'none',
    '&:hover': {
        color: '#64b5f6',
        transition: 'color 0.3s'
    },
    '& .MuiInput-underline:before': { display: 'none' },
    '& .MuiInput-underline:after': { display: 'none' },
    '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
    '&.Mui-focused .MuiOutlinedInput-notchedOutline': { border: 'none' },
    '& .MuiSelect-select': {
        fontStyle: 'normal',
        padding: '0',
        lineHeight: 'inherit',
    }
};

const iconStyle = {
    color: '#f0e8e8',
    fontSize: { xs: '0.8rem', sm: '1rem', md: '1.3rem' },
    '&:hover': {
        color: '#64b5f6',
        transition: 'color 0.3s'
    }
};

export function TopBar({ authButton }: { authButton?: ReactNode }) {
    const router = useRouter();
    const [isVisible, setIsVisible] = useState(true);
    const [lastScrollY, setLastScrollY] = useState(0);
    const [selectedOption, setSelectedOption] = useState('');
    const [openAboutMenu, setOpenAboutMenu] = useState(false);
    const [openProjectMenu, setOpenProjectMenu] = useState(false);

    useEffect(() => {
        const handleScroll = () => {
            const currentScrollY = window.scrollY;
            setIsVisible(currentScrollY < lastScrollY || currentScrollY < 50);
            setLastScrollY(currentScrollY);
        };

        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, [lastScrollY]);

    const handleSelectChange = (event) => {
        const value = event.target.value;
        setSelectedOption(value);
        
        router.push(`/${value}`);
    };

    return (
        <AppBar position="sticky" sx={{ 
            backgroundColor: '#3d4b66', 
            boxShadow: 5, 
            transform: isVisible ? 'translateY(0)' : 'translateY(-100%)', 
            transition: 'transform 0.3s ease-out',
        }}>
            <Toolbar sx={{
                py: 1.5,
                display: 'grid',
                gridTemplateColumns: 'minmax(0,1fr) auto minmax(0,1fr)',
                alignItems: 'center',
            }}>
                {/* Column 1: Brand */}
                <Typography
                    variant="h6"
                    sx={{
                        fontWeight: 'bold',
                        fontSize: { xs: '0.6rem', sm: '1.2rem', md: '2rem' },
                        letterSpacing: 1,
                    }}
                >
                    Danny Proano
                </Typography>

                {/* Column 2: Nav — always centered */}
                <Box sx={{ display: 'flex', gap: { xs: 0, sm: 1 } }}>
                    <Button
                        sx={navButtonStyle}
                        onClick={() => { router.push('/'); setSelectedOption(''); }}
                    >
                        Home
                    </Button>

                    <Button
                        sx={navButtonStyle}
                        onClick={() => { router.push('/research'); setSelectedOption(''); }}
                    >
                        Research
                    </Button>

                    <Select
                        value={selectedOption}
                        onChange={handleSelectChange}
                        displayEmpty
                        sx={dropDownStyle}
                        renderValue={() => 'Projects'}
                        open={openProjectMenu}
                        onOpen={() => setOpenProjectMenu(true)}
                        onClose={() => setOpenProjectMenu(false)}
                    >
                        <MenuItem value="chess/board">Chess</MenuItem>
                        <MenuItem value="password/login">Password Manager</MenuItem>
                        <MenuItem value="calendar">Calendar</MenuItem>
                        <MenuItem value="tasks">Tasks</MenuItem>
                    </Select>
                </Box>

                {/* Column 3: Actions — right-aligned */}
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: { xs: 0, sm: 1, md: 2 } }}>
                    <Button
                        component="a"
                        href="/resume.pdf"
                        download
                        variant="outlined"
                        size="small"
                        sx={{
                            color: '#90b4e8',
                            borderColor: '#3d5280',
                            textTransform: 'none',
                            fontWeight: 600,
                            fontSize: { xs: '0.5rem', sm: '0.8rem', md: '0.95rem' },
                            px: { xs: 0.5, sm: 1, md: 2 },
                            '&:hover': { borderColor: '#90b4e8', backgroundColor: '#2d3f5e' },
                        }}
                    >
                        Resume
                    </Button>

                    <IconButton
                        href="https://github.com/DanielProano"
                        target="_blank"
                        rel="noopener noreferrer"
                        sx={{ ...iconStyle, p: { xs: 0.25, sm: 0.75, md: 1 } }}
                    >
                        <GitHubIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                        href="https://www.linkedin.com/in/daniel-proano-20976b32a/"
                        target="_blank"
                        rel="noopener noreferrer"
                        sx={{ ...iconStyle, p: { xs: 0.25, sm: 0.75, md: 1 } }}
                    >
                        <LinkedInIcon fontSize="small" />
                    </IconButton>
                    {authButton ?? (
                        <IconButton href="/auth/login" sx={{ ...iconStyle, p: { xs: 0.25, sm: 0.75, md: 1 } }}>
                            <AccountCircleIcon fontSize="small" />
                        </IconButton>
                    )}
                </Box>
            </Toolbar>
        </AppBar>
    );
}