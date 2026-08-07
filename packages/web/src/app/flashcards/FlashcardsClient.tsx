'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Box, Typography, Button, IconButton, TextField, Tooltip } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import EditIcon from '@mui/icons-material/Edit';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';

interface Folder { id: number; name: string; color: string; }
interface Card { id: number; folder_id: number; front_text: string; back_text: string; }
interface EditState { id: number | null; front: string; back: string; }

const FOLDER_COLORS = ['#4a6fa5', '#5c8a5c', '#8a5c5c', '#7c5c8a', '#5c8a8a', '#8a7a4a'];
const SWIPE_THRESHOLD = 100;

export function FlashcardsClient({ canEdit }: { canEdit: boolean }) {
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
    const [dragY, setDragY] = useState(0);
    const [navX, setNavX] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const [isDraggingToTrash, setIsDraggingToTrash] = useState(false);
    const dragXRef = useRef(0);
    const dragYRef = useRef(0);
    const isDraggingRef = useRef(false);
    const isDraggingToTrashRef = useRef(false);
    const dragStartXRef = useRef(0);
    const dragStartYRef = useRef(0);
    const dragDistanceRef = useRef(0);
    const isAnimatingRef = useRef(false);
    const trashRef = useRef<HTMLDivElement>(null);

    const [editingCard, setEditingCard] = useState<EditState | null>(null);
    const [editSide, setEditSide] = useState<'front' | 'back'>('front');

    const [addingFolder, setAddingFolder] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');
    const folderSavingRef = useRef(false);

    useEffect(() => {
        if (!canEdit) return;
        fetch('/api/flashcards/folders')
            .then(r => r.json())
            .then(d => setFolders(d.folders ?? []))
            .catch(console.error);
    }, [canEdit]);

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
        setDragY(0);
        setNavX(0);
        dragXRef.current = 0;
        dragYRef.current = 0;
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

    const deleteCardById = async (cardId: number) => {
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

        // Must exceed the widest card (lg = 560px) so it fully clears the viewport.
        const flyX = direction === 'right' ? 900 : -900;
        dragXRef.current = flyX;
        dragYRef.current = 0;
        setDragX(flyX);
        setDragY(0);

        if (direction === 'right') {
            setKnownCount(k => k + 1);
        } else {
            setStudyAgainCards(prev => [...prev, studyDeck[deckIndex]]);
        }

        setTimeout(() => {
            isAnimatingRef.current = false;
            dragXRef.current = 0;
            dragYRef.current = 0;
            setDragX(0);
            setDragY(0);
            setIsFlipped(false);
            const next = deckIndex + 1;
            if (next >= studyDeck.length) {
                setSessionDone(true);
            } else {
                setDeckIndex(next);
            }
        }, 380);
    }, [deckIndex, studyDeck]);

    // ── Browse navigation (arrows) ─────────────────────────────────────────────
    // Unlike swiping, this just moves through the deck — it never scores a card
    // as "Got It" or "Study Again".

    const navigateCard = useCallback((dir: -1 | 1) => {
        if (isAnimatingRef.current || isDraggingRef.current) return;
        const target = deckIndex + dir;
        if (target < 0 || target >= studyDeck.length) return;

        isAnimatingRef.current = true;
        setIsFlipped(false);
        setNavX(dir === 1 ? -40 : 40);
        setDeckIndex(target);
        setTimeout(() => {
            setNavX(0);
            isAnimatingRef.current = false;
        }, 160);
    }, [deckIndex, studyDeck.length]);

    // ── Pointer handlers ───────────────────────────────────────────────────────

    const handlePointerDown = (e: React.PointerEvent) => {
        if (editingCard || sessionDone || isAnimatingRef.current) return;
        dragStartXRef.current = e.clientX;
        dragStartYRef.current = e.clientY;
        dragDistanceRef.current = 0;
        isDraggingRef.current = true;
        setIsDragging(true);
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!isDraggingRef.current) return;
        const dx = e.clientX - dragStartXRef.current;
        const dy = e.clientY - dragStartYRef.current;
        dragDistanceRef.current = Math.sqrt(dx * dx + dy * dy);
        dragXRef.current = dx;
        dragYRef.current = dy;
        setDragX(dx);
        setDragY(dy);

        // Check if pointer is over the trash zone
        if (trashRef.current) {
            const rect = trashRef.current.getBoundingClientRect();
            const pad = 24;
            const over =
                e.clientX >= rect.left - pad && e.clientX <= rect.right + pad &&
                e.clientY >= rect.top - pad && e.clientY <= rect.bottom + pad;
            if (over !== isDraggingToTrashRef.current) {
                isDraggingToTrashRef.current = over;
                setIsDraggingToTrash(over);
            }
        }
    };

    const handlePointerUp = async () => {
        if (!isDraggingRef.current) return;
        isDraggingRef.current = false;
        setIsDragging(false);

        if (isDraggingToTrashRef.current) {
            isDraggingToTrashRef.current = false;
            setIsDraggingToTrash(false);
            dragXRef.current = 0;
            dragYRef.current = 0;
            setDragX(0);
            setDragY(0);
            dragDistanceRef.current = 0;
            const card = studyDeck[deckIndex];
            if (card) await deleteCardById(card.id);
            return;
        }

        if (Math.abs(dragXRef.current) > SWIPE_THRESHOLD) {
            swipeCard(dragXRef.current > 0 ? 'right' : 'left');
        } else {
            setDragX(0);
            setDragY(0);
            dragXRef.current = 0;
            dragYRef.current = 0;
        }
    };

    const handleStudyCardClick = () => {
        if (dragDistanceRef.current > 8) return;
        if (isAnimatingRef.current) return;
        setIsFlipped(f => !f);
    };

    const handleEditCardClick = (e: React.MouseEvent) => {
        e.stopPropagation(); // prevent click reaching main area save handler
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
            if (editingCard) {
                if (e.key === 'Escape') cancelEdit();
                return;
            }
            if (sessionDone || !studyDeck.length) return;
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
    const borderColor = isDraggingToTrash
        ? 'rgba(255, 82, 82, 1)'
        : dragX < -20
        ? `rgba(255, 82, 82, ${Math.min(absX / 120, 1)})`
        : dragX > 20
        ? `rgba(72, 199, 116, ${Math.min(absX / 120, 1)})`
        : '#3a4d6b';

    const cardW = { xs: '280px', sm: '360px', md: '480px', lg: '560px' };
    const cardH = { xs: '190px', sm: '240px', md: '310px', lg: '360px' };

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

    const isStudying = !!selectedFolderId && studyDeck.length > 0 && !sessionDone && !editingCard;

    return (
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, height: 'calc(100vh - 80px)', overflow: 'hidden' }}>

            {/* ── Folders — a scrolling strip on phones, a sidebar from sm up ── */}
            <Box sx={{
                width: { xs: '100%', sm: 200 },
                flexShrink: 0,
                borderRight: { xs: 'none', sm: '1px solid #3a4d6b' },
                borderBottom: { xs: '1px solid #3a4d6b', sm: 'none' },
                display: 'flex',
                flexDirection: { xs: 'row', sm: 'column' },
                alignItems: { xs: 'center', sm: 'stretch' },
                p: { xs: 1, sm: 2 },
                gap: { xs: 0.75, sm: 0.5 },
                overflowX: { xs: 'auto', sm: 'hidden' },
                overflowY: { xs: 'hidden', sm: 'auto' },
                '&::-webkit-scrollbar': { display: 'none' },
                scrollbarWidth: 'none',
            }}>
                <Typography sx={{
                    display: { xs: 'none', sm: 'block' },
                    color: '#90b4e8', fontWeight: 700, mb: 1, fontSize: '0.75rem', letterSpacing: 1,
                }}>
                    FOLDERS
                </Typography>

                {folders.map(folder => (
                    <Box
                        key={folder.id}
                        onClick={() => selectFolder(folder.id)}
                        sx={{
                            display: 'flex', alignItems: 'center', gap: 1,
                            px: 1.5, py: 0.9, borderRadius: 2, cursor: 'pointer',
                            flexShrink: 0,
                            maxWidth: { xs: 160, sm: 'none' },
                            backgroundColor: selectedFolderId === folder.id ? '#2a3550' : 'transparent',
                            border: '1px solid',
                            borderColor: selectedFolderId === folder.id ? '#3a4d6b' : { xs: '#253550', sm: 'transparent' },
                            '@media (hover: hover)': {
                                '&:hover': { backgroundColor: '#1e2d46', '& .del': { opacity: 1 } },
                            },
                            transition: '0.15s',
                        }}
                    >
                        <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: folder.color, flexShrink: 0 }} />
                        <Typography sx={{ fontSize: '0.8rem', color: '#ddd', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {folder.name}
                        </Typography>
                        {canEdit && (
                            <IconButton
                                className="del"
                                onClick={e => deleteFolder(folder.id, e)}
                                size="small"
                                sx={{
                                    // No hover on touch — the handle would never appear otherwise.
                                    opacity: { xs: 0.6, sm: 0 },
                                    color: '#888', p: 0.25, flexShrink: 0,
                                    '&:hover': { color: '#ff5252' }, transition: '0.15s',
                                }}
                            >
                                <DeleteIcon sx={{ fontSize: 13 }} />
                            </IconButton>
                        )}
                    </Box>
                ))}

                {canEdit && (addingFolder ? (
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
                            mt: { xs: 0, sm: 0.5 }, px: 1.5,
                            flexShrink: 0, width: { xs: 150, sm: 'auto' },
                            // 16px keeps iOS Safari from force-zooming the page on focus.
                            '& input': { color: '#ddd', fontSize: { xs: '16px', sm: '0.8rem' } },
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
                            justifyContent: 'flex-start', px: 1.5, py: 0.5,
                            mt: { xs: 0, sm: 0.5 },
                            flexShrink: 0, minWidth: 'auto', whiteSpace: 'nowrap',
                            '& .MuiButton-startIcon': { mr: { xs: 0, sm: 0.5 } },
                            '&:hover': { backgroundColor: '#1e2d46' },
                        }}
                    >
                        <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>Add Folder</Box>
                    </Button>
                ))}
            </Box>

            {/* ── Main area ── */}
            <Box
                onClick={editingCard ? () => saveEditCard() : undefined}
                sx={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                    overflow: 'hidden',
                    cursor: editingCard ? 'default' : 'default',
                }}
            >

                {!selectedFolderId ? (
                    <Box sx={{ textAlign: 'center', color: '#555' }}>
                        {canEdit ? (
                            <>
                                <Typography variant="h6" sx={{ mb: 1, color: '#888' }}>Select a folder to start</Typography>
                                <Typography variant="body2">or create one with +</Typography>
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
                        {canEdit && (
                            <Button variant="outlined" onClick={startNewCard}
                                sx={{ color: '#90b4e8', borderColor: '#3d5280', textTransform: 'none', '&:hover': { borderColor: '#90b4e8', bgcolor: '#1e2d46' } }}>
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
                            <Button variant="outlined" onClick={() => startSession(allCards)} startIcon={<RestartAltIcon />}
                                sx={{ color: '#90b4e8', borderColor: '#3d5280', textTransform: 'none', '&:hover': { borderColor: '#90b4e8', bgcolor: '#1e2d46' } }}>
                                Restart All
                            </Button>
                            {studyAgainCards.length > 0 && (
                                <Button variant="contained" onClick={() => startSession(studyAgainCards)}
                                    sx={{ bgcolor: '#c0392b', textTransform: 'none', '&:hover': { bgcolor: '#a93226' } }}>
                                    Study Again ({studyAgainCards.length})
                                </Button>
                            )}
                        </Box>
                        <Button onClick={startNewCard}
                            sx={{ mt: 3, color: '#555', fontSize: '0.75rem', textTransform: 'none', '&:hover': { color: '#90b4e8' } }}>
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
                                {editingCard
                                    ? (editingCard.id ? 'Editing — click outside to save' : 'New card — click outside to save')
                                    : `${deckIndex + 1} / ${studyDeck.length}`}
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                                {!editingCard && (
                                    <>
                                        {canEdit && (
                                            <Button size="small" startIcon={<AddIcon sx={{ fontSize: 14 }} />}
                                                onClick={e => { e.stopPropagation(); startNewCard(); }}
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

                                {nextNextCard && (
                                    <Box sx={{ position: 'absolute', inset: 0, bgcolor: '#1a2640', border: '1px solid #253550', borderRadius: 4, transform: 'translateY(10px) scale(0.93)', zIndex: 1 }} />
                                )}
                                {nextCard && (
                                    <Box sx={{ position: 'absolute', inset: 0, bgcolor: '#1f2f48', border: '1px solid #2c3e5a', borderRadius: 4, transform: 'translateY(5px) scale(0.965)', zIndex: 2 }} />
                                )}

                                {/* Active card */}
                                <Box
                                    onPointerDown={handlePointerDown}
                                    onPointerMove={handlePointerMove}
                                    onPointerUp={handlePointerUp}
                                    onClick={editingCard ? handleEditCardClick : handleStudyCardClick}
                                    sx={{
                                        position: 'absolute', inset: 0, zIndex: 10,
                                        touchAction: 'none',
                                        cursor: editingCard ? 'default' : isDragging ? 'grabbing' : 'grab',
                                        transform: `translateX(${dragX + navX}px) translateY(${dragY}px) rotate(${dragX * 0.03}deg)`,
                                        transition: isDragging ? 'none' : navX !== 0 ? 'transform 0.16s ease-out' : 'transform 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                                        perspective: '1200px',
                                    }}
                                >
                                    {/* Red overlay when over trash */}
                                    {isDraggingToTrash && (
                                        <Box sx={{
                                            position: 'absolute', inset: 0, zIndex: 20,
                                            borderRadius: 4,
                                            backgroundColor: 'rgba(255, 82, 82, 0.25)',
                                            pointerEvents: 'none',
                                        }} />
                                    )}

                                    {/* Flip wrapper */}
                                    <Box sx={{
                                        width: '100%', height: '100%',
                                        transformStyle: 'preserve-3d',
                                        transform: `rotateY(${isFlipped ? 180 : 0}deg)`,
                                        transition: 'transform 0.45s ease',
                                        position: 'relative',
                                    }}>
                                        {/* Front face */}
                                        <Box sx={{ ...cardFaceStyle, bgcolor: isDraggingToTrash ? '#3a1a1a' : '#2a3550' }}>
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
                                                <Typography sx={{ color: '#fff', fontSize: { xs: '0.88rem', sm: '1rem', md: '1.15rem', lg: '1.3rem' }, textAlign: 'center', lineHeight: 1.5, fontWeight: 500, userSelect: 'none' }}>
                                                    {currentCard?.front_text || <span style={{ color: '#555' }}>(empty)</span>}
                                                </Typography>
                                            )}
                                            {canEdit && !editingCard && currentCard && (
                                                <Box sx={{ position: 'absolute', bottom: 8, right: 8 }}>
                                                    <IconButton size="small"
                                                        onPointerDown={e => e.stopPropagation()}
                                                        onClick={e => startEditCard(currentCard, e)}
                                                        sx={{ color: '#90b4e8', p: 0.4, opacity: 0.5, '&:hover': { opacity: 1 } }}>
                                                        <EditIcon sx={{ fontSize: 14 }} />
                                                    </IconButton>
                                                </Box>
                                            )}
                                            {editingCard && editSide === 'front' && (
                                                <Typography variant="caption" sx={{ position: 'absolute', bottom: 10, color: '#444', fontSize: '0.6rem' }}>
                                                    click outside text to flip →
                                                </Typography>
                                            )}
                                        </Box>

                                        {/* Back face */}
                                        <Box sx={{ ...cardFaceStyle, bgcolor: isDraggingToTrash ? '#3a1a1a' : '#1e3259', transform: 'rotateY(180deg)' }}>
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
                                                <Typography sx={{ color: '#fff', fontSize: { xs: '0.88rem', sm: '1rem', md: '1.15rem', lg: '1.3rem' }, textAlign: 'center', lineHeight: 1.5, fontWeight: 500, userSelect: 'none' }}>
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

                        {/* Card-to-card navigation arrows */}
                        {!editingCard && studyDeck.length > 1 && (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: { xs: 2, sm: 2.5 } }}>
                                <Tooltip title="Previous card">
                                    <span>
                                        <IconButton
                                            size="small"
                                            disabled={deckIndex === 0}
                                            onClick={e => { e.stopPropagation(); navigateCard(-1); }}
                                            sx={{
                                                color: '#90b4e8',
                                                border: '1px solid #3a4d6b',
                                                '&:hover': { bgcolor: '#1e2d46', borderColor: '#90b4e8' },
                                                '&.Mui-disabled': { color: '#2c3a52', borderColor: '#232f45' },
                                                transition: '0.15s',
                                            }}
                                        >
                                            <ChevronLeftIcon fontSize="small" />
                                        </IconButton>
                                    </span>
                                </Tooltip>

                                <Typography sx={{ color: '#3a4a60', fontSize: '0.7rem', minWidth: 52, textAlign: 'center', userSelect: 'none' }}>
                                    {deckIndex + 1} / {studyDeck.length}
                                </Typography>

                                <Tooltip title="Next card">
                                    <span>
                                        <IconButton
                                            size="small"
                                            disabled={deckIndex >= studyDeck.length - 1}
                                            onClick={e => { e.stopPropagation(); navigateCard(1); }}
                                            sx={{
                                                color: '#90b4e8',
                                                border: '1px solid #3a4d6b',
                                                '&:hover': { bgcolor: '#1e2d46', borderColor: '#90b4e8' },
                                                '&.Mui-disabled': { color: '#2c3a52', borderColor: '#232f45' },
                                                transition: '0.15s',
                                            }}
                                        >
                                            <ChevronRightIcon fontSize="small" />
                                        </IconButton>
                                    </span>
                                </Tooltip>
                            </Box>
                        )}

                        {/* Bottom hint */}
                        {!editingCard && (
                            <Typography variant="caption" sx={{ mt: { xs: 1.5, sm: 2 }, color: '#3a4a60', fontSize: '0.68rem', textAlign: 'center', px: 2 }}>
                                tap to flip · drag right ✓ · drag left ✗ · arrows browse without scoring · drag to trash to delete · space / ← →
                            </Typography>
                        )}
                    </>
                )}

                {/* Trash drop zone — visible while studying */}
                {isStudying && (
                    <Box
                        ref={trashRef}
                        sx={{
                            position: 'absolute',
                            bottom: 24,
                            right: 24,
                            width: 48,
                            height: 48,
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: isDraggingToTrash ? 'rgba(255,82,82,0.25)' : 'rgba(255,82,82,0.05)',
                            border: '1px solid',
                            borderColor: isDraggingToTrash ? 'rgba(255,82,82,0.9)' : 'rgba(255,82,82,0.2)',
                            transform: isDraggingToTrash ? 'scale(1.25)' : 'scale(1)',
                            transition: 'background-color 0.15s, border-color 0.15s, transform 0.15s',
                            pointerEvents: 'none',
                        }}
                    >
                        <DeleteForeverIcon sx={{
                            fontSize: isDraggingToTrash ? 26 : 20,
                            color: isDraggingToTrash ? '#ff5252' : 'rgba(255,82,82,0.35)',
                            transition: 'font-size 0.15s, color 0.15s',
                        }} />
                    </Box>
                )}
            </Box>
        </Box>
    );
}
