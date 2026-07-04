'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
    Box, Typography, IconButton, Button, TextField, Tooltip, Collapse,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import CloseIcon from '@mui/icons-material/Close';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import FolderIcon from '@mui/icons-material/Folder';
import EditIcon from '@mui/icons-material/Edit';

// ─── Types ────────────────────────────────────────────────────────────────────

type IdeaFolder = { id: number; name: string; sort_order: number | null };
type Idea = { id: number; folder_id: number; title: string; sort_order: number | null };

type FolderDragState = {
    id: number;
    originalIndex: number;
    deltaY: number;
    isDragging: boolean;
};

type IdeaDragState = {
    idea: Idea;
    originalIndex: number;
    deltaY: number;
    isDragging: boolean;
};

type FormMode =
    | { type: 'none' }
    | { type: 'newFolder' }
    | { type: 'editFolder'; folder: IdeaFolder }
    | { type: 'newIdea'; folderId: number };

// ─── Constants ────────────────────────────────────────────────────────────────

const FOLDER_ROW_HEIGHT = 48;
const IDEA_ROW_HEIGHT = 52;

const inputSx = {
    '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: '#4a5568' } },
    '& .MuiInputLabel-root': { color: '#aaa' },
    '& .MuiInputBase-input': { color: '#f0e8e8' },
};

function moveItem<T>(arr: T[], from: number, to: number): T[] {
    const result = [...arr];
    const [item] = result.splice(from, 1);
    result.splice(to, 0, item);
    return result;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function IdeasClient({ isAdmin }: { isAdmin: boolean }) {
    const [folders, setFolders] = useState<IdeaFolder[]>([]);
    const [ideas, setIdeas] = useState<Record<number, Idea[]>>({});
    const [collapsed, setCollapsed] = useState<Record<number, boolean>>({});
    const [loadedFolders, setLoadedFolders] = useState<Set<number>>(new Set());

    const [folderDrag, setFolderDrag] = useState<FolderDragState | null>(null);
    const folderDragStartY = useRef(0);

    const [ideaDrag, setIdeaDrag] = useState<IdeaDragState | null>(null);
    const ideaDragStartY = useRef(0);

    // Inline editing
    const [editingIdeaId, setEditingIdeaId] = useState<number | null>(null);
    const [editTitle, setEditTitle] = useState('');
    const editTitleRef = useRef('');
    const editFolderIdRef = useRef<number>(0);

    const [formMode, setFormMode] = useState<FormMode>({ type: 'none' });
    const [folderNameInput, setFolderNameInput] = useState('');
    const [ideaTitleInput, setIdeaTitleInput] = useState('');

    // ── Data fetching ──────────────────────────────────────────────────────────

    const fetchFolders = useCallback(async () => {
        try {
            const res = await fetch('/api/ideas/folders');
            if (!res.ok) { setFolders([]); return; }
            const data = await res.json();
            const fetched: IdeaFolder[] = data.folders ?? [];
            setFolders(fetched);
            setCollapsed(prev => {
                const next = { ...prev };
                for (const f of fetched) { if (!(f.id in next)) next[f.id] = true; }
                return next;
            });
        } catch { setFolders([]); }
    }, []);

    const fetchFolderIdeas = useCallback(async (folderId: number) => {
        try {
            const res = await fetch(`/api/ideas?folder_id=${folderId}`);
            if (!res.ok) { setIdeas(prev => ({ ...prev, [folderId]: [] })); return; }
            const data = await res.json();
            setIdeas(prev => ({ ...prev, [folderId]: data.ideas ?? [] }));
            setLoadedFolders(prev => { const next = new Set(prev); next.add(folderId); return next; });
        } catch { setIdeas(prev => ({ ...prev, [folderId]: [] })); }
    }, []);

    useEffect(() => { if (isAdmin) fetchFolders(); }, [isAdmin, fetchFolders]);

    // ── Expand / collapse ──────────────────────────────────────────────────────

    const toggleFolder = useCallback((folderId: number) => {
        setCollapsed(prev => {
            const nowCollapsed = !prev[folderId];
            if (!nowCollapsed && !loadedFolders.has(folderId)) fetchFolderIdeas(folderId);
            return { ...prev, [folderId]: nowCollapsed };
        });
    }, [loadedFolders, fetchFolderIdeas]);

    // ── Folder drag ────────────────────────────────────────────────────────────

    const handleFolderDragStart = (e: React.PointerEvent, folderId: number, index: number) => {
        e.stopPropagation();
        e.currentTarget.setPointerCapture(e.pointerId);
        folderDragStartY.current = e.clientY;
        setFolderDrag({ id: folderId, originalIndex: index, deltaY: 0, isDragging: false });
    };

    const handleFolderDragMove = (e: React.PointerEvent) => {
        if (!folderDrag) return;
        const deltaY = e.clientY - folderDragStartY.current;
        setFolderDrag(prev => prev ? { ...prev, deltaY, isDragging: Math.abs(deltaY) > 4 } : null);
    };

    const handleFolderDragEnd = async () => {
        if (!folderDrag) return;
        if (!folderDrag.isDragging) { setFolderDrag(null); return; }
        const toIdx = Math.max(0, Math.min(folders.length - 1,
            folderDrag.originalIndex + Math.round(folderDrag.deltaY / FOLDER_ROW_HEIGHT)));
        const reordered = moveItem(folders, folderDrag.originalIndex, toIdx);
        const withOrder = reordered.map((f, i) => ({ ...f, sort_order: i }));
        setFolders(withOrder);
        setFolderDrag(null);
        await fetch('/api/ideas/folders', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ updates: withOrder.map(f => ({ id: f.id, sort_order: f.sort_order })) }),
        });
    };

    const displayedFolders = (() => {
        if (!folderDrag?.isDragging) return folders;
        const toIdx = Math.max(0, Math.min(folders.length - 1,
            folderDrag.originalIndex + Math.round(folderDrag.deltaY / FOLDER_ROW_HEIGHT)));
        return moveItem(folders, folderDrag.originalIndex, toIdx);
    })();

    // ── Idea drag ──────────────────────────────────────────────────────────────

    const handleIdeaDragStart = (e: React.PointerEvent, idea: Idea, index: number) => {
        if (editingIdeaId !== null) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        ideaDragStartY.current = e.clientY;
        setIdeaDrag({ idea, originalIndex: index, deltaY: 0, isDragging: false });
    };

    const handleIdeaDragMove = (e: React.PointerEvent) => {
        if (!ideaDrag) return;
        const deltaY = e.clientY - ideaDragStartY.current;
        setIdeaDrag(prev => prev ? { ...prev, deltaY, isDragging: prev.isDragging || Math.abs(deltaY) > 4 } : null);
    };

    const handleIdeaDragEnd = async (e: React.PointerEvent) => {
        if (!ideaDrag) return;

        if (!ideaDrag.isDragging) {
            // Tap without drag — enter inline edit mode
            const idea = ideaDrag.idea;
            setIdeaDrag(null);
            setEditingIdeaId(idea.id);
            setEditTitle(idea.title);
            editTitleRef.current = idea.title;
            editFolderIdRef.current = idea.folder_id;
            return;
        }

        // Use live pointer coords from the event, not stale state
        const el = document.elementFromPoint(e.clientX, e.clientY);
        const folderEl = el?.closest('[data-folder-id]');
        const targetFolderIdStr = folderEl?.getAttribute('data-folder-id');
        const targetFolderId = targetFolderIdStr ? parseInt(targetFolderIdStr, 10) : null;

        const sourceFolderId = ideaDrag.idea.folder_id;
        const sourceIdeas = ideas[sourceFolderId] ?? [];

        if (targetFolderId !== null && targetFolderId !== sourceFolderId) {
            setIdeaDrag(null);
            await fetch('/api/ideas', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ updates: [{ id: ideaDrag.idea.id, folder_id: targetFolderId, sort_order: 0 }] }),
            });
            setCollapsed(prev => ({ ...prev, [targetFolderId]: false }));
            await Promise.all([fetchFolderIdeas(sourceFolderId), fetchFolderIdeas(targetFolderId)]);
        } else {
            const toIdx = Math.max(0, Math.min(sourceIdeas.length - 1,
                ideaDrag.originalIndex + Math.round(ideaDrag.deltaY / IDEA_ROW_HEIGHT)));
            setIdeaDrag(null);
            if (toIdx !== ideaDrag.originalIndex) {
                const reordered = moveItem(sourceIdeas, ideaDrag.originalIndex, toIdx);
                const withOrder = reordered.map((idea, i) => ({ ...idea, sort_order: i }));
                setIdeas(prev => ({ ...prev, [sourceFolderId]: withOrder }));
                await fetch('/api/ideas', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ updates: withOrder.map(idea => ({ id: idea.id, sort_order: idea.sort_order })) }),
                });
            }
        }
    };

    const getDisplayedIdeas = (folderId: number): Idea[] => {
        const folderIdeas = ideas[folderId] ?? [];
        if (!ideaDrag?.isDragging || ideaDrag.idea.folder_id !== folderId) return folderIdeas;
        const toIdx = Math.max(0, Math.min(folderIdeas.length - 1,
            ideaDrag.originalIndex + Math.round(ideaDrag.deltaY / IDEA_ROW_HEIGHT)));
        return moveItem(folderIdeas, ideaDrag.originalIndex, toIdx);
    };

    // ── Inline idea save ───────────────────────────────────────────────────────

    const saveIdeaEdit = async () => {
        if (editingIdeaId === null) return;
        const id = editingIdeaId;
        const folderId = editFolderIdRef.current;
        setEditingIdeaId(null);
        await fetch(`/api/ideas/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: editTitleRef.current }),
        });
        fetchFolderIdeas(folderId);
    };

    // ── Form helpers ───────────────────────────────────────────────────────────

    const openNewFolder = () => { setFolderNameInput(''); setFormMode({ type: 'newFolder' }); };
    const openEditFolder = (folder: IdeaFolder) => { setFolderNameInput(folder.name); setFormMode({ type: 'editFolder', folder }); };
    const openNewIdea = (folderId: number) => { setIdeaTitleInput(''); setFormMode({ type: 'newIdea', folderId }); };
    const closeForm = () => setFormMode({ type: 'none' });

    // ── CRUD ──────────────────────────────────────────────────────────────────

    const handleSaveFolder = async () => {
        const name = folderNameInput.trim();
        if (!name) return;
        if (formMode.type === 'newFolder') {
            await fetch('/api/ideas/folders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
        } else if (formMode.type === 'editFolder') {
            await fetch(`/api/ideas/folders/${formMode.folder.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
        }
        closeForm();
        await fetchFolders();
    };

    const handleDeleteFolder = async (folderId: number) => {
        await fetch(`/api/ideas/folders/${folderId}`, { method: 'DELETE' });
        setIdeas(prev => { const next = { ...prev }; delete next[folderId]; return next; });
        setLoadedFolders(prev => { const next = new Set(prev); next.delete(folderId); return next; });
        await fetchFolders();
    };

    const handleSaveIdea = async () => {
        const title = ideaTitleInput.trim();
        if (!title || formMode.type !== 'newIdea') return;
        const folderId = formMode.folderId;
        await fetch('/api/ideas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ folder_id: folderId, title }) });
        closeForm();
        await fetchFolderIdeas(folderId);
    };

    const handleDeleteIdea = async (idea: Idea) => {
        await fetch(`/api/ideas/${idea.id}`, { method: 'DELETE' });
        await fetchFolderIdeas(idea.folder_id);
    };

    // ─── Render ───────────────────────────────────────────────────────────────

    const formOpen = formMode.type !== 'none';
    const isFolderForm = formMode.type === 'newFolder' || formMode.type === 'editFolder';

    return (
        <Box sx={{ height: 'calc(100vh - 72px)', backgroundColor: '#1e2535', color: '#f0e8e8', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

            {/* Header */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 3, py: 2, borderBottom: '1px solid #4a5568', flexShrink: 0 }}>
                <Typography variant="h5" sx={{ fontWeight: 700 }}>Ideas Board</Typography>
                {isAdmin && (
                    <Button startIcon={<AddIcon />} onClick={openNewFolder} variant="contained" size="small"
                        sx={{ backgroundColor: '#90b4e8', color: '#1e2535', fontWeight: 600, textTransform: 'none', '&:hover': { backgroundColor: '#64b5f6' } }}>
                        New Folder
                    </Button>
                )}
            </Box>

            {/* Content */}
            <Box sx={{ flex: 1, overflowY: 'auto', px: 3, pb: 3 }}>
                {!isAdmin ? (
                    <Box sx={{ textAlign: 'center', mt: 8 }}>
                        <Typography sx={{ color: '#718096', mb: 2 }}>Sign in to view your ideas board.</Typography>
                        <Button component="a" href="/auth/login" variant="outlined"
                            sx={{ color: '#90b4e8', borderColor: '#3d5280', textTransform: 'none', '&:hover': { borderColor: '#90b4e8', bgcolor: '#1e2d46' } }}>
                            Sign In
                        </Button>
                    </Box>
                ) : folders.length === 0 ? (
                    <Typography sx={{ color: '#4a5568', fontStyle: 'italic', mt: 4, textAlign: 'center' }}>
                        No folders yet. Create one to get started.
                    </Typography>
                ) : (
                    <Box sx={{ pt: 2 }}>
                        {displayedFolders.map((folder, folderIndex) => {
                            const isExpanded = !collapsed[folder.id];
                            const isFolderBeingDragged = folderDrag?.id === folder.id && folderDrag.isDragging;
                            const isIdeaDragHovering = ideaDrag?.isDragging && ideaDrag.idea.folder_id !== folder.id;
                            const folderIdeas = getDisplayedIdeas(folder.id);

                            return (
                                <Box key={folder.id} data-folder-id={folder.id} sx={{ mb: 0.5 }}>

                                    {/* Folder header */}
                                    <Box
                                        onPointerMove={isAdmin ? handleFolderDragMove : undefined}
                                        onPointerUp={isAdmin ? handleFolderDragEnd : undefined}
                                        onPointerCancel={isAdmin ? () => setFolderDrag(null) : undefined}
                                        sx={{
                                            display: 'flex', alignItems: 'center', gap: 0.5,
                                            px: 1, py: 0.75, borderRadius: 2,
                                            backgroundColor: isIdeaDragHovering ? '#2a3550' : isFolderBeingDragged ? '#1a2030' : '#252f42',
                                            border: '1px solid',
                                            borderColor: isIdeaDragHovering ? '#90b4e8' : isFolderBeingDragged ? '#64b5f6' : '#4a5568',
                                            opacity: isFolderBeingDragged ? 0.5 : 1,
                                            transition: folderDrag?.isDragging ? 'none' : 'background-color 0.15s, border-color 0.15s',
                                            userSelect: 'none',
                                            minHeight: `${FOLDER_ROW_HEIGHT}px`,
                                        }}
                                    >
                                        {isAdmin && (
                                            <Tooltip title="Drag to reorder">
                                                <IconButton size="small" onPointerDown={e => handleFolderDragStart(e, folder.id, folderIndex)}
                                                    sx={{ color: '#4a5568', p: 0.25, cursor: folderDrag?.isDragging ? 'grabbing' : 'grab', '&:hover': { color: '#718096' }, touchAction: 'none' }}>
                                                    <DragIndicatorIcon sx={{ fontSize: 18 }} />
                                                </IconButton>
                                            </Tooltip>
                                        )}

                                        <IconButton size="small" onClick={() => toggleFolder(folder.id)} sx={{ color: '#90b4e8', p: 0.25 }}>
                                            {isExpanded ? <ExpandMoreIcon sx={{ fontSize: 20 }} /> : <ChevronRightIcon sx={{ fontSize: 20 }} />}
                                        </IconButton>

                                        <FolderIcon sx={{ color: '#90b4e8', fontSize: 18, flexShrink: 0 }} />

                                        <Typography onClick={() => toggleFolder(folder.id)}
                                            sx={{ flex: 1, fontWeight: 600, fontSize: '0.95rem', color: '#f0e8e8', cursor: 'pointer', '&:hover': { color: '#90b4e8' }, transition: 'color 0.15s' }}>
                                            {folder.name}
                                            {loadedFolders.has(folder.id) && (
                                                <Typography component="span" sx={{ color: '#4a5568', fontSize: '0.75rem', ml: 1, fontWeight: 400 }}>
                                                    ({(ideas[folder.id] ?? []).length})
                                                </Typography>
                                            )}
                                        </Typography>

                                        {isAdmin && (
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, ml: 'auto' }}>
                                                {isExpanded && (
                                                    <Tooltip title="Add Idea">
                                                        <IconButton size="small" onClick={() => openNewIdea(folder.id)}
                                                            sx={{ color: '#90b4e8', p: 0.5, '&:hover': { color: '#64b5f6' } }}>
                                                            <AddIcon sx={{ fontSize: 16 }} />
                                                        </IconButton>
                                                    </Tooltip>
                                                )}
                                                <Tooltip title="Rename folder">
                                                    <IconButton size="small" onClick={() => openEditFolder(folder)}
                                                        sx={{ color: '#64b5f6', p: 0.5, '&:hover': { color: '#90b4e8' } }}>
                                                        <EditIcon sx={{ fontSize: 16 }} />
                                                    </IconButton>
                                                </Tooltip>
                                                <Tooltip title="Delete folder">
                                                    <IconButton size="small" onClick={() => handleDeleteFolder(folder.id)}
                                                        sx={{ color: '#e57373', p: 0.5, '&:hover': { color: '#ff5252' } }}>
                                                        <DeleteIcon sx={{ fontSize: 16 }} />
                                                    </IconButton>
                                                </Tooltip>
                                            </Box>
                                        )}
                                    </Box>

                                    {/* Ideas list */}
                                    <Collapse in={isExpanded} timeout={180}>
                                        <Box sx={{ pl: isAdmin ? 5 : 3, pr: 1, pt: 0.5, pb: 0.5 }}>
                                            {loadedFolders.has(folder.id) && folderIdeas.map((idea, ideaIndex) => {
                                                const isBeingDragged = ideaDrag?.idea.id === idea.id && ideaDrag.isDragging;
                                                const isEditing = editingIdeaId === idea.id;

                                                return (
                                                    <Box
                                                        key={idea.id}
                                                        onPointerDown={isAdmin && !isEditing ? e => handleIdeaDragStart(e, idea, ideaIndex) : undefined}
                                                        onPointerMove={isAdmin ? handleIdeaDragMove : undefined}
                                                        onPointerUp={isAdmin ? handleIdeaDragEnd : undefined}
                                                        onPointerCancel={isAdmin ? () => setIdeaDrag(null) : undefined}
                                                        sx={{
                                                            display: 'flex', alignItems: 'center', gap: 0.75,
                                                            px: 1.5, py: 0.75, mb: 0.5, borderRadius: 1.5,
                                                            backgroundColor: '#1a2030',
                                                            border: '1px solid',
                                                            borderColor: isBeingDragged ? '#64b5f6' : isEditing ? '#90b4e8' : '#3a4255',
                                                            opacity: isBeingDragged ? 0.4 : 1,
                                                            transition: ideaDrag?.isDragging ? 'none' : 'opacity 0.15s, border-color 0.15s',
                                                            cursor: isEditing ? 'text' : isAdmin ? (ideaDrag?.isDragging ? 'grabbing' : 'grab') : 'default',
                                                            userSelect: isEditing ? 'text' : 'none',
                                                            touchAction: 'none',
                                                            minHeight: `${IDEA_ROW_HEIGHT}px`,
                                                        }}
                                                    >
                                                        {isEditing ? (
                                                            <Box
                                                                component="input"
                                                                autoFocus
                                                                value={editTitle}
                                                                onChange={e => { setEditTitle(e.target.value); editTitleRef.current = e.target.value; }}
                                                                onBlur={saveIdeaEdit}
                                                                onKeyDown={e => {
                                                                    if (e.key === 'Enter') { e.preventDefault(); saveIdeaEdit(); }
                                                                    if (e.key === 'Escape') setEditingIdeaId(null);
                                                                }}
                                                                onPointerDown={e => e.stopPropagation()}
                                                                sx={{
                                                                    flex: 1, minWidth: 0,
                                                                    background: 'transparent', border: 'none',
                                                                    borderBottom: '1px solid #4a5568',
                                                                    outline: 'none', color: '#f0e8e8',
                                                                    fontWeight: 700, fontSize: '0.9rem',
                                                                    fontFamily: 'inherit', pb: 0.25,
                                                                }}
                                                            />
                                                        ) : (
                                                            <Typography sx={{
                                                                flex: 1, minWidth: 0,
                                                                fontWeight: 700, fontSize: '0.9rem', color: '#f0e8e8',
                                                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                                            }}>
                                                                {idea.title}
                                                            </Typography>
                                                        )}

                                                        {isAdmin && (
                                                            <Tooltip title="Delete">
                                                                <IconButton size="small"
                                                                    onPointerDown={e => e.stopPropagation()}
                                                                    onClick={e => { e.stopPropagation(); handleDeleteIdea(idea); }}
                                                                    sx={{ color: '#e57373', p: 0.5, flexShrink: 0, '&:hover': { color: '#ff5252' } }}>
                                                                    <DeleteIcon sx={{ fontSize: 15 }} />
                                                                </IconButton>
                                                            </Tooltip>
                                                        )}
                                                    </Box>
                                                );
                                            })}

                                            {isAdmin && (
                                                <Button size="small" startIcon={<AddIcon sx={{ fontSize: 14 }} />}
                                                    onClick={() => openNewIdea(folder.id)}
                                                    sx={{ color: '#4a5568', textTransform: 'none', fontSize: '0.78rem', py: 0.25, mt: 0.25, '&:hover': { color: '#90b4e8', backgroundColor: 'transparent' } }}>
                                                    Add idea
                                                </Button>
                                            )}
                                        </Box>
                                    </Collapse>
                                </Box>
                            );
                        })}
                    </Box>
                )}
            </Box>

            {/* Modal backdrop */}
            {formOpen && <Box onClick={closeForm} sx={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1200 }} />}

            {/* Folder form */}
            {formOpen && isFolderForm && (
                <Box sx={{ position: 'fixed', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', zIndex: 1300, width: { xs: '95vw', sm: '360px' }, backgroundColor: '#2d3748', color: '#f0e8e8', borderRadius: '8px', boxShadow: '0 8px 32px rgba(0,0,0,0.6)', border: '1px solid #4a5568' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2, py: 1.5, borderBottom: '1px solid #4a5568' }}>
                        <Typography sx={{ fontWeight: 600 }}>{formMode.type === 'newFolder' ? 'New Folder' : 'Rename Folder'}</Typography>
                        <IconButton size="small" onClick={closeForm} sx={{ color: '#718096' }}><CloseIcon fontSize="small" /></IconButton>
                    </Box>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, p: 2 }}>
                        <TextField label="Folder name" value={folderNameInput} onChange={e => setFolderNameInput(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') handleSaveFolder(); if (e.key === 'Escape') closeForm(); }}
                            fullWidth size="small" autoFocus InputLabelProps={{ sx: { color: '#aaa' } }} inputProps={{ style: { color: '#f0e8e8' } }} sx={inputSx} />
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, px: 2, pb: 2 }}>
                        <Button onClick={closeForm} sx={{ color: '#aaa', textTransform: 'none' }}>Cancel</Button>
                        <Button onClick={handleSaveFolder} disabled={!folderNameInput.trim()} variant="contained"
                            sx={{ backgroundColor: '#90b4e8', color: '#1e2535', textTransform: 'none', fontWeight: 600, '&:hover': { backgroundColor: '#64b5f6' } }}>
                            Save
                        </Button>
                    </Box>
                </Box>
            )}

            {/* New idea modal */}
            {formOpen && formMode.type === 'newIdea' && (
                <Box sx={{ position: 'fixed', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', zIndex: 1300, width: { xs: '95vw', sm: '360px' }, backgroundColor: '#2d3748', color: '#f0e8e8', borderRadius: '8px', boxShadow: '0 8px 32px rgba(0,0,0,0.6)', border: '1px solid #4a5568' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2, py: 1.5, borderBottom: '1px solid #4a5568' }}>
                        <Typography sx={{ fontWeight: 600 }}>New Idea</Typography>
                        <IconButton size="small" onClick={closeForm} sx={{ color: '#718096' }}><CloseIcon fontSize="small" /></IconButton>
                    </Box>
                    <Box sx={{ p: 2 }}>
                        <TextField label="Title" value={ideaTitleInput} onChange={e => setIdeaTitleInput(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') handleSaveIdea(); if (e.key === 'Escape') closeForm(); }}
                            fullWidth size="small" autoFocus InputLabelProps={{ sx: { color: '#aaa' } }} inputProps={{ style: { color: '#f0e8e8' } }} sx={inputSx} />
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, px: 2, pb: 2 }}>
                        <Button onClick={closeForm} sx={{ color: '#aaa', textTransform: 'none' }}>Cancel</Button>
                        <Button onClick={handleSaveIdea} disabled={!ideaTitleInput.trim()} variant="contained"
                            sx={{ backgroundColor: '#90b4e8', color: '#1e2535', textTransform: 'none', fontWeight: 600, '&:hover': { backgroundColor: '#64b5f6' } }}>
                            Save
                        </Button>
                    </Box>
                </Box>
            )}
        </Box>
    );
}
