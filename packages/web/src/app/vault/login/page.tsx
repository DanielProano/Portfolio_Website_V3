'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { use_auth } from '@/context/AuthContext';
import { derive_key } from '@/context/Encrypt';
import { Box, Typography, TextField, Button } from '@mui/material';
import bcrypt from 'bcryptjs';

const isDev = process.env.NODE_ENV === 'development';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [output, setOutput] = useState('');

    const router = useRouter();
    const { set_derived_key } = use_auth();

    async function login() {
        try {
            const salt_response = await fetch(
                `${process.env.NEXT_PUBLIC_BACKEND_URL}/salt?user=${encodeURIComponent(email)}`
            );
            const { master_salt } = await salt_response.json();
            const hash = bcrypt.hashSync(password, master_salt);

            const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/verify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user: email, hash: hash }),
            });

            const data = await response.json();

            if (response.ok) {
                const { token, salt } = data;
                const key = await derive_key(password, salt);
                set_derived_key({ key, token });
                router.push('/vault');
            } else {
                setOutput(data.message || 'Login failed, try again');
            }
        } catch (error) {
            console.error('Error:', error);
            setOutput('Login Error');
        }
    }

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            
            <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h1" sx={{ mt: 10, mb: 2, fontSize: '5rem', color: '#ffffff'}}>
                    A Password Manager
                </Typography>
                <Typography variant="h2" sx={{ fontSize: '2rem', color: '#ffffff' }}>
                    Keeping your passwords secure
                </Typography>
            </Box>

            <Box sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                maxWidth: '50%',
                mt: 5,
                border: '2px solid #3c4e77',
                backgroundColor: '#3c4353',
                padding: '3em',
                borderRadius: 6,
            }}>
                <TextField
                    type="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    sx={{
                        m: 1,
                        input: { color: '#fff' },
                        '& .MuiOutlinedInput-root': {
                            borderRadius: '20px',
                            '& fieldset': { borderColor: '#87a6ed' },
                        },
                    }}
                />

                <TextField
                    type="password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    sx={{
                        m: 1,
                        input: { color: '#fff' },
                        '& .MuiOutlinedInput-root': {
                            borderRadius: '20px',
                            '& fieldset': { borderColor: '#87a6ed' },
                        },
                    }}
                />

                {output && <Typography sx={{ color: 'red', mt: 1 }}>{output}</Typography>}

                <Button
                    onClick={login}
                    variant="outlined"
                    sx={{
                        mt: 2,
                        borderRadius: '24px',
                        borderColor: '#87a6ed',
                        color: '#fff',
                        '&:hover': { backgroundColor: '#394b74' },
                    }}
                >
                    Login
                </Button>
            </Box>

            <Box sx={{ mt: 3 }}>
                <Typography sx={{ color: '#fff' }}>
                    {"Don't have an account? "}
                    <Link style={{ color: "#9cdfee" }} href="/vault/register">Register</Link>
                </Typography>
            </Box>

            {isDev && (
                <Button
                    variant="outlined"
                    onClick={async () => {
                        const fakeToken = "dev-token";
                        const fakeKey = await derive_key("password123", "dev-salt");
                        set_derived_key({ key: fakeKey, token: fakeToken });
                        router.push('/vault');
                    }}
                    sx={{ mt: 2, borderRadius: '24px', borderColor: '#87a6ed' }}
                >
                    Dev
                </Button>
            )}
        </Box>
    );
}