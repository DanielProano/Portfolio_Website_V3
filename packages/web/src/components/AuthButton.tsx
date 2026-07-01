'use client';

import { useState, useEffect } from 'react';
import {
    IconButton, Menu, MenuItem, Avatar,
    Divider, Typography, Box, Chip
} from '@mui/material';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import LogoutIcon from '@mui/icons-material/Logout';
import LoginIcon from '@mui/icons-material/Login';

type AuthUser = { name?: string; email?: string; picture?: string };

const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL;

export function AuthButton() {
    const [user, setUser] = useState<AuthUser | null>(null);
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const isAdmin = user?.email === ADMIN_EMAIL;

    useEffect(() => {
        fetch('/auth/profile')
            .then(res => res.ok ? res.json() : null)
            .then(data => setUser(data))
            .catch(() => {});
    }, []);

    const handleOpen = (e: React.MouseEvent<HTMLElement>) => setAnchorEl(e.currentTarget);
    const handleClose = () => setAnchorEl(null);

    return (
        <>
            <IconButton
                onClick={handleOpen}
                sx={{
                    color: '#f0e8e8',
                    '&:hover': { color: '#64b5f6', transition: 'color 0.3s' }
                }}
            >
                {user?.picture ? (
                    <Avatar src={user.picture as string} sx={{ width: 28, height: 28 }} />
                ) : (
                    <AccountCircleIcon />
                )}
            </IconButton>

            <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={handleClose}
                PaperProps={{
                    sx: {
                        backgroundColor: '#3d4b66',
                        color: '#f0e8e8',
                        minWidth: 200,
                        mt: 1,
                    }
                }}
            >
                {user ? (
                    <>
                        <Box sx={{ px: 2, py: 1 }}>
                            <Typography variant="subtitle2" sx={{ color: '#f0e8e8' }}>
                                {user.name as string}
                            </Typography>
                            <Typography variant="caption" sx={{ color: '#aaa' }}>
                                {user.email as string}
                            </Typography>
                            {isAdmin && (
                                <Box sx={{ mt: 0.5 }}>
                                    <Chip
                                        label="Admin"
                                        size="small"
                                        icon={<AdminPanelSettingsIcon sx={{ fontSize: '14px !important' }} />}
                                        sx={{ backgroundColor: '#64b5f6', color: '#1a1a2e' }}
                                    />
                                </Box>
                            )}
                        </Box>
                        <Divider sx={{ borderColor: '#4a5568' }} />
                        {isAdmin && (
                            <MenuItem
                                component="a"
                                href="/admin"
                                onClick={handleClose}
                                sx={{ color: '#64b5f6', gap: 1 }}
                            >
                                <AdminPanelSettingsIcon fontSize="small" />
                                Admin Dashboard
                            </MenuItem>
                        )}
                        <MenuItem
                            component="a"
                            href="/auth/logout"
                            onClick={handleClose}
                            sx={{ color: '#f0e8e8', gap: 1 }}
                        >
                            <LogoutIcon fontSize="small" />
                            Sign Out
                        </MenuItem>
                    </>
                ) : (
                    <MenuItem
                        component="a"
                        href="/auth/login"
                        onClick={handleClose}
                        sx={{ color: '#f0e8e8', gap: 1 }}
                    >
                        <LoginIcon fontSize="small" />
                        Sign In
                    </MenuItem>
                )}
            </Menu>
        </>
    );
}
