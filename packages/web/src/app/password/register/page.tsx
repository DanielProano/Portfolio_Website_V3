'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Box, Typography, TextField, Button } from '@mui/material';
import bcrypt from 'bcryptjs';

export default function RegisterPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [output, setOutput] = useState('');
    const [submitted, setSubmitted] = useState(false);

    const checks = [
        { label: 'At least 12 characters', test: (p: string) => p.length >= 12 },
        { label: 'Uppercase letter', test: (p: string) => /[A-Z]/.test(p) },
        { label: 'Lowercase letter', test: (p: string) => /[a-z]/.test(p) },
        { label: 'Number', test: (p: string) => /\d/.test(p) },
        { label: 'Special character', test: (p: string) => /[\W_]/.test(p) },
    ];

    const router = useRouter();

    function validatePassword(pass: string): boolean {
        const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{12,}$/;
        return regex.test(pass);
    }

    async function register_login() {
        const salt = bcrypt.genSaltSync(10);
        const hash = bcrypt.hashSync(password, salt);

        try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user: email, hash, master_salt: salt }),
            });

            if (response.ok) {
                router.push('/password/register_success');
            } else {
                setOutput("Couldn't Register");
            }
        } catch (error) {
            console.error('Error:', error);
            setOutput('Register Error');
        }
    }

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <Typography variant="h4" sx={{ mt: 10, fontWeight: 'bold', color: '#fff' }}>
                Register for Password Manager
            </Typography>

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
                    placeholder="Register a New User"
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
                    placeholder="Register a New Password"
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

                <Button
                    onClick={() => {
                        setSubmitted(true);
                        if (checks.every(({ test }) => test(password))) {
                            register_login();
                        }
                    }}
                    disabled={!email || !password}
                    variant="outlined"
                    sx={{
                        mt: 2,
                        borderRadius: '24px',
                        borderColor: '#fff',
                        color: '#fff',
                        input: { color: '#fff' },
                        '&:hover': { backgroundColor: '#919191' },
                    }}
                >
                    Register
                </Button>

                {submitted && !checks.every(({ test }) => test(password)) && (
                    <Box sx={{ mt: 4, width: '100%' }}>
                        {checks.map(({ label, test }) => (
                            <Typography key={label} sx={{ 
                                fontSize: '0.8rem', 
                                color: test(password) ? '#4caf50' : '#f44336' 
                            }}>
                                {test(password) ? '✓' : '✗'} {label}
                            </Typography>
                        ))}
                    </Box>
                )}

                {output && (
                    <Typography sx={{ color: 'red', mt: 1 }}>
                        {output}
                    </Typography>
                )}
            </Box>
        </Box>
    );
}