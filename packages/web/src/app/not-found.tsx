'use client';

import { Typography, Box } from "@mui/material";

export default function NotFound() {
    return (
        <Box>
            <Typography 
                variant="h6" 
                sx={{ 
                    fontWeight: 'bold', 
                    fontSize: '2rem',
                    letterSpacing: 1,
                    color: '#fff',
                    textAlign: 'center',
                    mt: 50
                }}
            >
                Not Found
            </Typography>
        </Box>
    )
}