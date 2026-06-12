'use client';

import { useState, useEffect } from 'react';
import { AppBar, Toolbar, Typography, Button, Box, Select, MenuItem, IconButton } from '@mui/material';
import { useRouter } from 'next/navigation';
import GitHubIcon from '@mui/icons-material/GitHub';
import LinkedInIcon from '@mui/icons-material/LinkedIn';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';

const navButtonStyle = {
    color: '#f0e8e8',
    fontSize: { xs: '0.6rem', sm: '1rem', md: '1.3rem' },
    textTransform: 'none',
    '&:hover': { 
        color: '#64b5f6',
        transition: 'color 0.3s'
    }
};

const dropDownStyle = {
    color: '#f0e8e8',
    fontSize: { xs: '0.6rem', sm: '1rem', md: '1.3rem' },
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
    fontSize: { xs: '0.8rem', sm: '1rem', md: '1.3rem' },
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
            backgroundColor: '#3d4b66', 
            boxShadow: 5, 
            transform: isVisible ? 'translateY(0)' : 'translateY(-100%)', 
            transition: 'transform 0.3s ease-out',
        }}>
            <Toolbar sx={{ py: 1.5 }}>
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

                <Box 
                    sx={{ display: 'flex', gap: 1, ml: 'auto', mr: 'auto'}}
                >
                    <Button 
                        sx={navButtonStyle} 
                        onClick={() => {
                            router.push('/');
                            setSelectedOption('');
                        }}
                    >
                        Home
                    </Button>
                    
                    {/* <Select 
                        value={selectedOption}
                        onChange={handleSelectChange}
                        displayEmpty
                        sx={dropDownStyle}
                        renderValue={() => 'Research'}
                        open={openAboutMenu}
                        onOpen={() => setOpenAboutMenu(true)}
                        onClose={() => setOpenAboutMenu(false)}
                    >
                        <MenuItem value="research">How To Build a Racecar</MenuItem>
                        <MenuItem value="research">Reverse Engineering w/ Frida</MenuItem>
                        <MenuItem value="research">Computer Vision for Racecars</MenuItem>
                        <MenuItem value="research">AI Computer Vision for Drones</MenuItem>
                        <MenuItem value="research">Zero Knowledge Architecture</MenuItem>
                        <MenuItem value="research">Automated Logistics</MenuItem>
                        <MenuItem value="research">How the Enigma Machine Works</MenuItem>
                    </Select> */}

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