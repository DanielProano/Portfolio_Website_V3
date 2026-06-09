'use client';

import { useRouter } from 'next/navigation';
import { Box, Typography, Button } from '@mui/material';

export default function RegisterSuccess() {
    const router = useRouter();
    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mt: 10 }}>
            <Typography variant="h4" sx={{ fontWeight: 'bold', mb: 4 }}>
                Registration Successful!
            </Typography>
            <Button
                variant="outlined"
                onClick={() => router.push('/vault/login')}
                sx={{
                    borderRadius: '24px',
                    borderColor: '#87a6ed',
                    color: '#fff',
                    '&:hover': { backgroundColor: '#394b74' },
                }}
            >
                Return To Login
            </Button>
        </Box>
    );
}