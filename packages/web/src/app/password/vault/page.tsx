'use client';

import { useState, useEffect } from 'react';
import { Box, Typography, IconButton, TextField, Button, Dialog, DialogTitle, DialogContent } from '@mui/material';
import AddBoxIcon from '@mui/icons-material/AddBox';
import CloseIcon from '@mui/icons-material/Close';
import { use_auth } from '@/context/AuthContext';
import { encrypt, decrypt } from '@/context/Encrypt';

type VaultEntry = {
    id: string;
    service_decoded: string;
    login_decoded: string;
    pass_decoded: string;
    notes_decoded: string;
};

export default function VaultPage() {
    const { derived_key } = use_auth();
    const [output, set_output] = useState('');
    const [showPopup, setShowPopup] = useState(false);
    const [showDetailsPopup, setShowDetailsPopup] = useState(false);
    const [display, setDisplay] = useState<VaultEntry[]>([]);
    const [currentEntry, setCurrentEntry] = useState<VaultEntry | null>(null);

    const [service, setService] = useState('');
    const [login, setLogin] = useState('');
    const [password, setPassword] = useState('');
    const [notes, setNotes] = useState('');

    async function GetInfo() {
        if (!derived_key) {
            set_output('Unauthorized user');
            return;
        }

        const { key, token } = derived_key;

        try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/vault/get`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            });

            if (!response.ok) {
                set_output('Failed to get Passwords');
                return;
            }

            set_output('Access Granted');

            const data = await response.json();
            const decryptedEntries: VaultEntry[] = [];

            for (const entry of data.vault) {
                const service_enc = JSON.parse(entry.service);
                const login_enc = JSON.parse(entry.login);
                const pass_enc = JSON.parse(entry.password);
                const notes_enc = JSON.parse(entry.notes || '{}');

                decryptedEntries.push({
                    id: entry.id,
                    service_decoded: await decrypt(key, service_enc.iv, service_enc.data),
                    login_decoded: await decrypt(key, login_enc.iv, login_enc.data),
                    pass_decoded: await decrypt(key, pass_enc.iv, pass_enc.data),
                    notes_decoded: await decrypt(key, notes_enc.iv, notes_enc.data),
                });
            }

            setDisplay(decryptedEntries);
        } catch (error) {
            console.log('Error:', error);
            set_output('Internal Server Error');
        }
    }

    async function AddInfo() {
        if (!derived_key) return;
        if (!service || !login || !password) return;

        const { key, token } = derived_key;
        const serviceEnc = await encrypt(key, service);
        const loginEnc = await encrypt(key, login);
        const passEnc = await encrypt(key, password);
        const notesEnc = await encrypt(key, notes);

        const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/vault/store`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({
                service: serviceEnc,
                login: loginEnc,
                password: passEnc,
                notes: notesEnc,
            }),
        });

        if (!response.ok) return;
        await GetInfo();
    }

    async function deleteInfo(id: string) {
        if (!derived_key) return;

        const { token } = derived_key;

        const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/vault/delete/${id}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        });

        if (!response.ok) return;
        await GetInfo();
    }

    useEffect(() => { GetInfo(); }, [derived_key]);

   return (
        <Box sx={{ display: 'flex', flexDirection: 'column', p: 4, width: '100%', boxSizing: 'border-box' }}>
            
            {/* Header bar */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', mb: 3 }}>
                <Box>
                    <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#fff' }}>Vault</Typography>
                    <Typography sx={{ color: output === 'Access Granted' ? '#4caf50' : '#f44336' }}>{output}</Typography>
                </Box>
            </Box>

            {/* Floating add button */}
            <IconButton
                onClick={() => setShowPopup(true)}
                sx={{
                    color: '#87a6ed',
                    position: 'fixed',
                    bottom: 32,
                    right: 32,
                    backgroundColor: '#202733',
                    border: '2px solid #3c4e77',
                    '&:hover': { backgroundColor: '#2a3447' },
                }}
            >
                <AddBoxIcon sx={{ fontSize: '2.5rem' }} />
            </IconButton>

            {/* Vault list */}
            <Box sx={{
                width: '100%',
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                gap: 2,
            }}>
                {display.map(entry => (
                    <Box
                        key={entry.id}
                        onClick={() => { setCurrentEntry(entry); setShowDetailsPopup(true); }}
                        sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            backgroundColor: '#202733',
                            border: '2px solid #3c4e77',
                            borderRadius: 3,
                            p: 2,
                            cursor: 'pointer',
                            '&:hover': { backgroundColor: '#2a3447' },
                        }}
                    >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <Box sx={{
                                width: 40, height: 40,
                                borderRadius: '50%',
                                backgroundColor: '#3c4e77',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontWeight: 'bold', color: '#fff',
                            }}>
                                {entry.service_decoded.charAt(0).toUpperCase()}
                            </Box>
                            <Typography sx={{ color: '#fff' }}>{entry.service_decoded}</Typography>
                        </Box>
                        <IconButton onClick={e => { e.stopPropagation(); deleteInfo(entry.id); }} sx={{ color: '#87a6ed' }}>
                            <CloseIcon />
                        </IconButton>
                    </Box>
                ))}
            </Box>

            <Dialog open={showPopup} onClose={() => setShowPopup(false)} PaperProps={{ sx: { backgroundColor: '#202733', color: '#fff', borderRadius: 3 } }}>
                <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    Add New Password
                    <IconButton onClick={() => setShowPopup(false)} sx={{ color: '#fff' }}><CloseIcon /></IconButton>
                </DialogTitle>
                <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 400 }}>
                    {[
                        { label: 'Service', value: service, setter: setService, placeholder: 'Ex. Google' },
                        { label: 'Login', value: login, setter: setLogin, placeholder: 'Ex. Email' },
                        { label: 'Password', value: password, setter: setPassword, placeholder: 'Ex. 123' },
                    ].map(({ label, value, setter, placeholder }) => (
                        <Box key={label}>
                            <Typography sx={{ mb: 0.5 }}>{label}</Typography>
                            <TextField
                                placeholder={placeholder}
                                value={value}
                                onChange={e => setter(e.target.value)}
                                fullWidth
                                sx={{ input: { color: '#fff' }, '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: '#87a6ed' } } }}
                            />
                        </Box>
                    ))}
                    <Box>
                        <Typography sx={{ mb: 0.5 }}>Notes</Typography>
                        <TextField
                            placeholder="Text"
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            fullWidth
                            multiline
                            rows={3}
                            sx={{ textarea: { color: '#fff' }, '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: '#87a6ed' } } }}
                        />
                    </Box>
                    <Button
                        onClick={async () => { setShowPopup(false); await AddInfo(); }}
                        variant="outlined"
                        sx={{ borderColor: '#87a6ed', color: '#fff', borderRadius: '24px', '&:hover': { backgroundColor: '#394b74' } }}
                    >
                        Done
                    </Button>
                </DialogContent>
            </Dialog>

            <Dialog open={showDetailsPopup} onClose={() => setShowDetailsPopup(false)} PaperProps={{ sx: { backgroundColor: '#202733', color: '#fff', borderRadius: 3 } }}>
                <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    {currentEntry?.service_decoded}
                    <IconButton onClick={() => setShowDetailsPopup(false)} sx={{ color: '#fff' }}><CloseIcon /></IconButton>
                </DialogTitle>
                <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 400 }}>
                    {currentEntry && (
                        <>
                            <Box>
                                <Typography sx={{ color: '#87a6ed' }}>Login</Typography>
                                <Typography>{currentEntry.login_decoded}</Typography>
                            </Box>
                            <Box>
                                <Typography sx={{ color: '#87a6ed' }}>Password</Typography>
                                <Typography>{currentEntry.pass_decoded}</Typography>
                            </Box>
                            {currentEntry.notes_decoded && (
                                <Box>
                                    <Typography sx={{ color: '#87a6ed' }}>Notes</Typography>
                                    <Typography>{currentEntry.notes_decoded}</Typography>
                                </Box>
                            )}
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </Box>
    );
}