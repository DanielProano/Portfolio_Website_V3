'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Box, Typography, Button, IconButton, TextField, Tooltip } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import RestartAltIcon from '@mui/icons-material/RestartAlt';

interface Folder { id: number; name: string; color: string; }
interface Card { id: number; folder_id: number; front_text: string; back_text: string; }
interface EditState { id: number | null; front: string; back: string; }

const FOLDER_COLORS = ['#4a6fa5', '#5c8a5c', '#8a5c5c', '#7c5c8a', '#5c8a8a', '#8a7a4a'];
const SWIPE_THRESHOLD = 100;

export function FlashcardsClient({ isAdmin }: { isAdmin: boolean }) {
    const [folders, setFolders] = useState<Folder[]>([]);
    const [selectedFolderId, setSelectedFolderId] = useState<number | null>(null);
    const [allCards, setAllCards] = useState<Card[]>([]);

    const [studyDeck, setStudyDeck] = useState<Card[]>([]);
    const [deckIndex, setDeckIndex] = useState(0);
    const [isFlipped, setIsFlipped] = useState(false);
    const [knownCount, setKnownCount] = useState(0);
    const [studyAgainCards, setStudyAgainCards] = useState<Card[]>([]);
    const [sessionDone, setSessionDone] = useState(false);

    const [dragX, setDragX] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const dragXRef = useRef(0);
    const isDraggingRef = useRef(false);
    const dragStartXRef = useRef(0);
    const dragDistanceRef = useRef(0);
    const isAnimatingRef = useRef(false);

    const [editingCard, setEditingCard] = useState<EditState | null>(null);
    const [editSide, setEditSide] = useState<'front' | 'back'>('front');

    const [addingFolder, setAddingFolder] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');
    const folderSavingRef = useRef(false);

    useEffect(() => {
        if (!isAdmin) return;
        fetch('/api/flashcards/folders')
            .then(r => r.json())
            .then(d => setFolders(d.folders ?? []))
            .catch(console.error);
    }, [isAdmin]);

    const startSession = useCallback((cards: Card[]) => {
        const shuffled = [...cards].sort(() => Math.random() - 0.5);
        setStudyDeck(shuffled);
        setDeckIndex(0);
        setIsFlipped(false);
        setKnownCount(0);
        setStudyAgainCards([]);
        setSessionDone(false);
        setEditingCard(null);
        setDragX(0);
        dragXRef.current = 0;
    }, []);

    const selectFolder = useCallback((id: number) => {
        setSelectedFolderId(id);
        fetch(`/api/flashcards?folder_id=${id}`)
            .then(r => r.json())
            .then(d => {
                const cards = d.cards ?? [];
                setAllCards(cards);
                startSession(cards);
            })
            .catch(console.error);
    }, [startSession]);

    // ── Folder operations ──────────────────────────────────────────────────────

    const createFolder = async () => {
        if (folderSavingRef.current) return;
        folderSavingRef.current = true;
        const name = newFolderName.trim();
        setAddingFolder(false);
        setNewFolderName('');
        folderSavingRef.current = false;
        if (!name) return;

        const color = FOLDER_COLORS[folders.length % FOLDER_COLORS.length];
        const res = await fetch('/api/flashcards/folders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, color }),
        });
        const data = await res.json();
        if (data.folder) setFolders(prev => [...prev, data.folder]);
    };

    const deleteFolder = async (id: number, e: React.MouseEvent) => {
        e.stopPropagation();
        await fetch(`/api/flashcards/folders/${id}`, { method: 'DELETE' });
        setFolders(prev => prev.filter(f => f.id !== id));
        if (selectedFolderId === id) {
            setSelectedFolderId(null);
            setAllCards([]);
            setStudyDeck([]);
        }
    };

    // ── Card operations ────────────────────────────────────────────────────────

    const startNewCard = () => {
        setEditingCard({ id: null, front: '', back: '' });
        setEditSide('front');
        setIsFlipped(false);
    };

    const startEditCard = (card: Card, e: React.MouseEvent) => {
        e.stopPropagation();
        setEditingCard({ id: card.id, front: card.front_text, back: card.back_text });
        setEditSide('front');
        setIsFlipped(false);
    };

    const cancelEdit = () => {
        setEditingCard(null);
        setIsFlipped(false);
        setEditSide('front');
    };

    const saveEditCard = async () => {
        if (!editingCard || !selectedFolderId) return;

        if (editingCard.id === null) {
            const res = await fetch('/api/flashcards', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ folder_id: selectedFolderId, front_text: editingCard.front, back_text: editingCard.back }),
            });
            const data = await res.json();
            if (data.card) {
                const updated = [...allCards, data.card];
                setAllCards(updated);
                setStudyDeck(prev => [...prev, data.card]);
                if (studyDeck.length === 0) setSessionDone(false);
            }
        } else {
            const res = await fetch(`/api/flashcards/${editingCard.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ front_text: editingCard.front, back_text: editingCard.back }),
            });
            const data = await res.json();
            if (data.card) {
                setAllCards(prev => prev.map(c => c.id === data.card.id ? data.card : c));
                setStudyDeck(prev => prev.map(c => c.id === data.card.id ? data.card : c));
            }
        }

        setEditingCard(null);
        setIsFlipped(false);
        setEditSide('front');
    };

    const deleteCard = async (cardId: number, e: React.MouseEvent) => {
        e.stopPropagation();
        await fetch(`/api/flashcards/${cardId}`, { method: 'DELETE' });
        const newAll = allCards.filter(c => c.id !== cardId);
        const newDeck = studyDeck.filter(c => c.id !== cardId);
        setAllCards(newAll);
        setStudyDeck(newDeck);
        if (newDeck.length === 0) {
            setSessionDone(false);
            setDeckIndex(0);
        } else if (deckIndex >= newDeck.length) {
            setDeckIndex(newDeck.length - 1);
        }
    };

    // ── Swipe ──────────────────────────────────────────────────────────────────

    const swipeCard = useCallback((direction: 'left' | 'right') => {
        if (isAnimatingRef.current) return;
        isAnimatingRef.current = true;

        const flyX = direction === 'right' ? 650 : -650;
        dragXRef.current = flyX;
        setDragX(flyX);

        if (direction === 'right') {
            setKnownCount(k => k + 1);
        } else {
            setStudyAgainCards(prev => [...prev, studyDeck[deckIndex]]);
        }

        setTimeout(() => {
            isAnimatingRef.current = false;
            dragXRef.current = 0;
            setDragX(0);
            setIsFlipped(false);
            const next = deckIndex + 1;
            if (next >= studyDeck.length) {
                setSessionDone(true);
            } else {
                setDeckIndex(next);
            }
        }, 380);
    }, [deckIndex, studyDeck]);

    // ── Pointer handlers ───────────────────────────────────────────────────────

    const handlePointerDown = (e: React.PointerEvent) => {
        if (editingCard || sessionDone || isAnimatingRef.current) return;
        dragStartXRef.current = e.clientX;
        dragDistanceRef.current = 0;
        isDraggingRef.current = true;
        setIsDragging(true);
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!isDraggingRef.current) return;
        const dx = e.clientX - dragStartXRef.current;
        dragDistanceRef.current = Math.abs(dx);
        dragXRef.current = dx;
        setDragX(dx);
    };

    const handlePointerUp = () => {
        if (!isDraggingRef.current) return;
        isDraggingRef.current = false;
        setIsDragging(false);
        if (Math.abs(dragXRef.current) > SWIPE_THRESHOLD) {
            swipeCard(dragXRef.current > 0 ? 'right' : 'left');
        } else {
            setDragX(0);
            dragXRef.current = 0;
        }
    };

    const handleStudyCardClick = (e: React.MouseEvent) => {
        if (dragDistanceRef.current > 8) return;
        if (isAnimatingRef.current) return;
        setIsFlipped(f => !f);
    };

    const handleEditCardClick = (e: React.MouseEvent) => {
        if ((e.target as HTMLElement).tagName === 'TEXTAREA') return;
        if (dragDistanceRef.current > 8) return;
        if (editSide === 'front') {
            setEditSide('back');
            setIsFlipped(true);
        } else {
            saveEditCard();
        }
    };

    // ── Keyboard shortcuts ─────────────────────────────────────────────────────

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
            if (editingCard || sessionDone || !studyDeck.length) return;
            if (e.key === ' ') { e.preventDefault(); setIsFlipped(f => !f); }
            else if (e.key === 'ArrowRight') swipeCard('right');
            else if (e.key === 'ArrowLeft') swipeCard('left');
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [editingCard, sessionDone, studyDeck.length, swipeCard]);

    // ── Derived values ─────────────────────────────────────────────────────────

    const currentCard = studyDeck[deckIndex];
    const nextCard = studyDeck[deckIndex + 1];
    const nextNextCard = studyDeck[deckIndex + 2];

    const absX = Math.abs(dragX);
    const leftOpacity = Math.min(Math.max(-dragX / 80, 0), 1);
    const rightOpacity = Math.min(Math.max(dragX / 80, 0), 1);
    const borderColor = dragX < -20
        ? `rgba(255, 82, 82, ${Math.min(absX / 120, 1)})`
        : dragX > 20
        ? `rgba(72, 199, 116, ${Math.min(absX / 120, 1)})`
        : '#3a4d6b';

    const cardW = { xs: '280px', sm: '360px', md: '420px' };
    const cardH = { xs: '190px', sm: '240px', md: '270px' };

    const cardFaceStyle = {
        position: 'absolute' as const,
        inset: 0,
        backfaceVisibility: 'hidden' as const,
        WebkitBackfaceVisibility: 'hidden' as const,
        borderRadius: 4,
        border: '2px solid',
        borderColor,
        display: 'flex',
        flexDirection: 'column' as const,
        alignItems: 'center',
        justifyContent: 'center',
        p: 3,
        transition: isDragging ? 'none' : 'border-color 0.2s',
    };

    const textareaStyle: React.CSSProperties = {
        width: '100%',
        flex: 1,
        background: 'transparent',
        border: 'none',
        outline: 'none',
        color: '#fff',
        fontSize: '1rem',
        fontFamily: 'inherit',
        resize: 'none',
        textAlign: 'center',
        cursor: 'text',
        lineHeight: 1.5,
    };

    return (
        <Box sx={{ display: 'flex', height: 'calc(100vh - 80px)', overflow: 'hidden' }}>

            {/* ── Sidebar ── */}
            <Box sx={{
                width: { xs: 150, sm: 200 },
                flexShrink: 0,
                borderRight: '1px solid #3a4d6b',
                display: 'flex',
                flexDirection: 'column',
                p: 2,
                gap: 0.5,
                overflowY: 'auto',
            }}>
                <Typography sx={{ color: '#90b4e8', fontWeight: 700, mb: 1, fontSize: '0.75rem', letterSpacing: 1 }}>
                    FOLDERS
                </Typography>

                {folders.map(folder => (
                    <Box
                        key={folder.id}
                        onClick={() => selectFolder(folder.id)}
                        sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1,
                            px: 1.5,
                            py: 0.9,
                            borderRadius: 2,
                            cursor: 'pointer',
                            backgroundColor: selectedFolderId === folder.id ? '#2a3550' : 'transparent',
                            border: '1px solid',
                            borderColor: selectedFolderId === folder.id ? '#3a4d6b' : 'transparent',
                            '&:hover': { backgroundColor: '#1e2d46', '& .del': { opacity: 1 } },
                            transition: '0.15s',
                        }}
                    >
                        <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: folder.color, flexShrink: 0 }} />
                        <Typography sx={{ fontSize: '0.8rem', color: '#ddd', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {folder.name}
                        </Typography>
                        {isAdmin && (
                            <IconButton
                                className="del"
                                onClick={e => deleteFolder(folder.id, e)}
                                size="small"
                                sx={{ opacity: 0, color: '#888', p: 0.25, '&:hover': { color: '#ff5252' }, transition: '0.15s' }}
                            >
                                <DeleteIcon sx={{ fontSize: 13 }} />
                            </IconButton>
                        )}
                    </Box>
                ))}

                {isAdmin && (addingFolder ? (
                    <TextField
                        autoFocus
                        value={newFolderName}
                        onChange={e => setNewFolderName(e.target.value)}
                        onKeyDown={e => {
                            if (e.key === 'Enter') createFolder();
                            if (e.key === 'Escape') { setAddingFolder(false); setNewFolderName(''); }
                        }}
                        onBlur={createFolder}
                        placeholder="Folder name…"
                        variant="standard"
                        size="small"
                        sx={{
                            mt: 0.5, px: 1.5,
                            '& input': { color: '#ddd', fontSize: '0.8rem' },
                            '& .MuiInput-underline:before': { borderColor: '#3a4d6b' },
                            '& .MuiInput-underline:after': { borderColor: '#90b4e8' },
                        }}
                    />
                ) : (
                    <Button
                        onClick={() => setAddingFolder(true)}
                        startIcon={<AddIcon sx={{ fontSize: 14 }} />}
                        sx={{
                            color: '#90b4e8', fontSize: '0.75rem', textTransform: 'none',
                            justifyContent: 'flex-start', px: 1.5, py: 0.5, mt: 0.5,
                            '&:hover': { backgroundColor: '#1e2d46' },
                        }}
                    >
                        Add Folder
                    </Button>
                ))}
            </Box>

            {/* ── Main area ── */}
            <Box sx={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                overflow: 'hidden',
            }}>

                {!selectedFolderId ? (
                    <Box sx={{ textAlign: 'center', color: '#555' }}>
                        {isAdmin ? (
                            <>
                                <Typography variant="h6" sx={{ mb: 1, color: '#888' }}>Select a folder to start</Typography>
                                <Typography variant="body2">or create one on the left</Typography>
                            </>
                        ) : (
                            <>
                                <Typography variant="h6" sx={{ mb: 1, color: '#888' }}>Flashcards</Typography>
                                <Typography variant="body2" sx={{ mb: 2 }}>Sign in to create folders and study your own flashcards.</Typography>
                                <Button component="a" href="/auth/login" variant="outlined"
                                    sx={{ color: '#90b4e8', borderColor: '#3d5280', textTransform: 'none', '&:hover': { borderColor: '#90b4e8', bgcolor: '#1e2d46' } }}>
                                    Sign In
                                </Button>
                            </>
                        )}
                    </Box>

                ) : studyDeck.length === 0 && !editingCard ? (
                    <Box sx={{ textAlign: 'center' }}>
                        <Typography variant="h6" sx={{ mb: 2, color: '#888' }}>No cards in this folder yet</Typography>
                        {isAdmin && (
                            <Button
                                variant="outlined"
                                onClick={startNewCard}
                                sx={{ color: '#90b4e8', borderColor: '#3d5280', textTransform: 'none', '&:hover': { borderColor: '#90b4e8', bgcolor: '#1e2d46' } }}
                            >
                                + Create First Card
                            </Button>
                        )}
                    </Box>

                ) : sessionDone ? (
                    <Box sx={{ textAlign: 'center', maxWidth: 380 }}>
                        <Typography variant="h4" sx={{ color: '#fff', fontWeight: 'bold', mb: 1 }}>Session Complete!</Typography>
                        <Typography variant="h6" sx={{ color: '#90b4e8', mb: 4 }}>
                            {knownCount} / {studyDeck.length} Got It
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
                            <Button
                                variant="outlined"
                                onClick={() => startSession(allCards)}
                                startIcon={<RestartAltIcon />}
                                sx={{ color: '#90b4e8', borderColor: '#3d5280', textTransform: 'none', '&:hover': { borderColor: '#90b4e8', bgcolor: '#1e2d46' } }}
                            >
                                Restart All
                            </Button>
                            {studyAgainCards.length > 0 && (
                                <Button
                                    variant="contained"
                                    onClick={() => startSession(studyAgainCards)}
                                    sx={{ bgcolor: '#c0392b', textTransform: 'none', '&:hover': { bgcolor: '#a93226' } }}
                                >
                                    Study Again ({studyAgainCards.length})
                                </Button>
                            )}
                        </Box>
                        <Button
                            onClick={startNewCard}
                            sx={{ mt: 3, color: '#555', fontSize: '0.75rem', textTransform: 'none', '&:hover': { color: '#90b4e8' } }}
                        >
                            + Add a card
                        </Button>
                    </Box>

                ) : (
                    <>
                        {/* Top bar */}
                        <Box sx={{
                            position: 'absolute', top: 0, left: 0, right: 0,
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            px: { xs: 2, sm: 4 }, py: 1.5,
                        }}>
                            <Typography sx={{ color: '#555', fontSize: '0.82rem' }}>
                                {editingCard ? (editingCard.id ? 'Editing card' : 'New card') : `${deckIndex + 1} / ${studyDeck.length}`}
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                                {editingCard ? (
                                    <>
                                        <Button size="small" onClick={cancelEdit}
                                            sx={{ color: '#666', fontSize: '0.75rem', textTransform: 'none' }}>
                                            Cancel
                                        </Button>
                                        <Button size="small" variant="outlined" onClick={saveEditCard}
                                            sx={{ color: '#48c774', borderColor: '#48c774', fontSize: '0.75rem', textTransform: 'none', '&:hover': { bgcolor: 'rgba(72,199,116,0.1)' } }}>
                                            Save
                                        </Button>
                                    </>
                                ) : (
                                    <>
                                        {isAdmin && (
                                            <Button size="small" startIcon={<AddIcon sx={{ fontSize: 14 }} />}
                                                onClick={startNewCard}
                                                sx={{ color: '#90b4e8', fontSize: '0.75rem', textTransform: 'none', '&:hover': { bgcolor: '#1e2d46' } }}>
                                                New Card
                                            </Button>
                                        )}
                                        <Tooltip title="Restart session">
                                            <IconButton size="small" onClick={() => startSession(allCards)}
                                                sx={{ color: '#555', '&:hover': { color: '#90b4e8' } }}>
                                                <RestartAltIcon fontSize="small" />
                                            </IconButton>
                                        </Tooltip>
                                    </>
                                )}
                            </Box>
                        </Box>

                        {/* Card + side hints */}
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1, sm: 3 } }}>

                            {/* Left hint */}
                            <Box sx={{ width: { xs: 36, sm: 72 }, textAlign: 'right', opacity: leftOpacity, transition: isDragging ? 'none' : 'opacity 0.2s', userSelect: 'none' }}>
                                <Typography sx={{ color: '#ff5252', fontWeight: 700, fontSize: { xs: '1rem', sm: '1.2rem' } }}>✗</Typography>
                                <Typography sx={{ color: '#ff5252', fontSize: { xs: '0.55rem', sm: '0.68rem' }, lineHeight: 1.3 }}>Study<br />Again</Typography>
                            </Box>

                            {/* Card stack */}
                            <Box sx={{ position: 'relative', width: cardW, height: cardH }}>

                                {/* Ghost cards for depth effect */}
                                {nextNextCard && (
                                    <Box sx={{ position: 'absolute', inset: 0, bgcolor: '#1a2640', border: '1px solid #253550', borderRadius: 4, transform: 'translateY(10px) scale(0.93)', zIndex: 1 }} />
                                )}
                                {nextCard && (
                                    <Box sx={{ position: 'absolute', inset: 0, bgcolor: '#1f2f48', border: '1px solid #2c3e5a', borderRadius: 4, transform: 'translateY(5px) scale(0.965)', zIndex: 2 }} />
                                )}

                                {/* Active card — drag wrapper */}
                                <Box
                                    onPointerDown={handlePointerDown}
                                    onPointerMove={handlePointerMove}
                                    onPointerUp={handlePointerUp}
                                    onClick={editingCard ? handleEditCardClick : handleStudyCardClick}
                                    sx={{
                                        position: 'absolute', inset: 0, zIndex: 10,
                                        touchAction: 'none',
                                        cursor: editingCard ? 'default' : isDragging ? 'grabbing' : 'grab',
                                        transform: `translateX(${dragX}px) rotate(${dragX * 0.03}deg)`,
                                        transition: isDragging ? 'none' : 'transform 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                                        perspective: '1200px',
                                    }}
                                >
                                    {/* Flip wrapper */}
                                    <Box sx={{
                                        width: '100%', height: '100%',
                                        transformStyle: 'preserve-3d',
                                        transform: `rotateY(${isFlipped ? 180 : 0}deg)`,
                                        transition: 'transform 0.45s ease',
                                        position: 'relative',
                                    }}>
                                        {/* Front face */}
                                        <Box sx={{ ...cardFaceStyle, bgcolor: '#2a3550' }}>
                                            <Typography variant="caption" sx={{ position: 'absolute', top: 10, color: '#444', fontSize: '0.6rem', letterSpacing: 1.5 }}>
                                                FRONT
                                            </Typography>
                                            {editingCard ? (
                                                <textarea
                                                    autoFocus={editSide === 'front'}
                                                    value={editingCard.front}
                                                    onChange={e => setEditingCard(prev => prev ? { ...prev, front: e.target.value } : null)}
                                                    onClick={e => e.stopPropagation()}
                                                    placeholder="Question or term…"
                                                    style={textareaStyle}
                                                />
                                            ) : (
                                                <Typography sx={{ color: '#fff', fontSize: { xs: '0.88rem', sm: '1rem' }, textAlign: 'center', lineHeight: 1.5, fontWeight: 500, userSelect: 'none' }}>
                                                    {currentCard?.front_text || <span style={{ color: '#555' }}>(empty)</span>}
                                                </Typography>
                                            )}
                                            {isAdmin && !editingCard && currentCard && (
                                                <Box sx={{ position: 'absolute', bottom: 8, right: 8, display: 'flex', gap: 0.25 }}>
                                                    <IconButton size="small" onClick={e => startEditCard(currentCard, e)} sx={{ color: '#90b4e8', p: 0.4, opacity: 0.5, '&:hover': { opacity: 1 } }}>
                                                        <EditIcon sx={{ fontSize: 14 }} />
                                                    </IconButton>
                                                    <IconButton size="small" onClick={e => deleteCard(currentCard.id, e)} sx={{ color: '#ff5252', p: 0.4, opacity: 0.5, '&:hover': { opacity: 1 } }}>
                                                        <DeleteIcon sx={{ fontSize: 14 }} />
                                                    </IconButton>
                                                </Box>
                                            )}
                                            {editingCard && editSide === 'front' && (
                                                <Typography variant="caption" sx={{ position: 'absolute', bottom: 10, color: '#444', fontSize: '0.6rem' }}>
                                                    click outside text to flip
                                                </Typography>
                                            )}
                                        </Box>

                                        {/* Back face */}
                                        <Box sx={{ ...cardFaceStyle, bgcolor: '#1e3259', transform: 'rotateY(180deg)' }}>
                                            <Typography variant="caption" sx={{ position: 'absolute', top: 10, color: '#444', fontSize: '0.6rem', letterSpacing: 1.5 }}>
                                                BACK
                                            </Typography>
                                            {editingCard ? (
                                                <textarea
                                                    autoFocus={editSide === 'back'}
                                                    value={editingCard.back}
                                                    onChange={e => setEditingCard(prev => prev ? { ...prev, back: e.target.value } : null)}
                                                    onClick={e => e.stopPropagation()}
                                                    placeholder="Answer or definition…"
                                                    style={textareaStyle}
                                                />
                                            ) : (
                                                <Typography sx={{ color: '#fff', fontSize: { xs: '0.88rem', sm: '1rem' }, textAlign: 'center', lineHeight: 1.5, fontWeight: 500, userSelect: 'none' }}>
                                                    {currentCard?.back_text || <span style={{ color: '#555' }}>(empty)</span>}
                                                </Typography>
                                            )}
                                            {editingCard && editSide === 'back' && (
                                                <Typography variant="caption" sx={{ position: 'absolute', bottom: 10, color: '#444', fontSize: '0.6rem' }}>
                                                    click outside text to save
                                                </Typography>
                                            )}
                                        </Box>
                                    </Box>
                                </Box>
                            </Box>

                            {/* Right hint */}
                            <Box sx={{ width: { xs: 36, sm: 72 }, textAlign: 'left', opacity: rightOpacity, transition: isDragging ? 'none' : 'opacity 0.2s', userSelect: 'none' }}>
                                <Typography sx={{ color: '#48c774', fontWeight: 700, fontSize: { xs: '1rem', sm: '1.2rem' } }}>✓</Typography>
                                <Typography sx={{ color: '#48c774', fontSize: { xs: '0.55rem', sm: '0.68rem' }, lineHeight: 1.3 }}>Got<br />It</Typography>
                            </Box>
                        </Box>

                        {/* Bottom hint */}
                        {!editingCard && (
                            <Typography variant="caption" sx={{ mt: { xs: 3, sm: 4 }, color: '#3a4a60', fontSize: '0.68rem', textAlign: 'center', px: 2 }}>
                                tap to flip · drag right ✓ · drag left ✗ · space / ← →
                            </Typography>
                        )}
                    </>
                )}
            </Box>
        </Box>
    );
}
