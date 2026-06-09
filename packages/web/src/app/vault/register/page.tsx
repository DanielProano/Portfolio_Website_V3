'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Box, Typography, TextField, Button } from '@mui/material';
import bcrypt from 'bcryptjs';

export default function RegisterPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [output, setOutput] = useState('');
    const [passWarn, setPassWarn] = useState('');

    const router = useRouter();

    function validatePassword(pass: string): boolean {
        const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{12,}$/;
        return regex.test(pass);
    }

    function handlePassChange(e: React.ChangeEvent<HTMLInputElement>) {
        const value = e.target.value;
        setPassword(value);
        if (!validatePassword(value)) {
            setPassWarn('Password requires 12 characters with a special, capital, lowercase, and number');
        } else {
            setPassWarn('');
        }
    }

    async function register_login() {
        const salt = bcrypt.genSaltSync(10);
        const hash = bcrypt.hashSync(password, salt);

        try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user: email, hash, master_salt: salt }),
            });

            if (response.ok) {
                router.push('/vault/register-success');
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
            <Typography variant="h4" sx={{ mt: 10, fontWeight: 'bold' }}>
                Register for Password Manager
            </Typography>

            <Box sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                maxWidth: '50%',
                mt: 5,
                border: '2px solid #3c4e77',
                backgroundColor: '#202733',
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
                    onChange={handlePassChange}
                    sx={{
                        m: 1,
                        '& .MuiOutlinedInput-root': {
                            borderRadius: '20px',
                            '& fieldset': { borderColor: '#87a6ed' },
                        },
                    }}
                />

                {passWarn && (
                    <Typography sx={{ color: 'orange', mt: 1, fontSize: '0.85rem' }}>
                        {passWarn}
                    </Typography>
                )}

                {output && (
                    <Typography sx={{ color: 'red', mt: 1 }}>
                        {output}
                    </Typography>
                )}

                <Button
                    onClick={register_login}
                    disabled={!email || !password}
                    variant="outlined"
                    sx={{
                        mt: 2,
                        borderRadius: '24px',
                        borderColor: '#87a6ed',
                        color: '#fff',
                        '&:hover': { backgroundColor: '#394b74' },
                    }}
                >
                    Register
                </Button>
            </Box>
        </Box>
    );
}