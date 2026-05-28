'use client';

import { useState, useEffect } from 'react';
import { AppBar, Toolbar, Typography, Button, Box, Select, MenuItem, IconButton } from '@mui/material';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import GitHubIcon from '@mui/icons-material/GitHub';
import LinkedInIcon from '@mui/icons-material/LinkedIn';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';

const navButtonStyle = {
    color: '#f0e8e8',
    fontSize: '1.3rem',
    textTransform: 'none',
    '&:hover': { 
        color: '#64b5f6',
        transition: 'color 0.3s'
    }
};

const dropDownStyle = {
    color: '#f0e8e8',
    fontSize: '1.3rem',
    textTransform: 'none',
    '&:hover': { 
        color: '#64b5f6',
        transition: 'color 0.3s'
    },
    '& .MuiInput-underline:before': {
        display: 'none',
    },
    '& .MuiInput-underline:after': {
        display: 'none',
    },
    '& .MuiOutlinedInput-notchedOutline': {
        border: 'none',
    },
    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
        border: 'none',
    },
    '& .MuiSelect-select': {
        fontStyle: 'normal',
        padding: '0',
        lineHeight: 'inherit',
    }
};

const iconStyle = {
    color: '#f0e8e8',
    fontSize: '1.5rem',
    '&:hover': {
        color: '#64b5f6',
        transition: 'color 0.3s'
    }
};

export function TopBar() {
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
            backgroundColor: '#2a3b5a', 
            boxShadow: 5, 
            transform: isVisible ? 'translateY(0)' : 'translateY(-100%)', 
            transition: 'transform 0.3s ease-out',
        }}>
            <Toolbar sx={{ py: 1.5 }}>
                <Typography 
                    variant="h6" 
                    sx={{ 
                        fontWeight: 'bold', 
                        fontSize: '2rem',
                        letterSpacing: 1,
                    }}
                >
                    Danny Proano
                </Typography>

                <Box 
                    sx={{ display: 'flex', gap: 1, ml: 'auto', mr: 'auto'}}
                >
                    <Link href="/" style={{ textDecoration: 'none' }}>
                        <Button sx={navButtonStyle}>Home</Button>
                    </Link>
                    
                    <Select 
                        value={selectedOption}
                        onChange={handleSelectChange}
                        displayEmpty
                        sx={dropDownStyle}
                        renderValue={() => 'About'}
                        open={openAboutMenu}
                        onOpen={() => setOpenAboutMenu(true)}
                        onClose={() => setOpenAboutMenu(false)}
                    >
                        <MenuItem value="about">About</MenuItem>
                        <MenuItem value="research">Research</MenuItem>
                    </Select>

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
                        <MenuItem value="chess">Chess</MenuItem>
                        <MenuItem value="vault">Password Manager</MenuItem>
                    </Select>
                </Box>

                <Box sx={{ display: 'flex', gap: 2, ml: 3}}>
                    <IconButton 
                        href="https://github.com/DanielProano" 
                        target="_blank"
                        rel="noopener noreferrer"
                        sx={iconStyle}
                    >
                        <GitHubIcon />
                    </IconButton>
                    <IconButton 
                        href="https://www.linkedin.com/in/daniel-proano-20976b32a/"
                        target="_blank"
                        rel="noopener noreferrer"
                        sx={iconStyle}
                    >
                        <LinkedInIcon />
                    </IconButton>
                    <IconButton
                        href="/login" 
                        sx={iconStyle}
                    >
                        <AccountCircleIcon />
                    </IconButton>
                </Box>
            </Toolbar>
        </AppBar>
    );
}