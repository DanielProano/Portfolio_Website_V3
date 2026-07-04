'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
    Box, Typography, IconButton, Button, TextField, Tooltip, Collapse,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import CloseIcon from '@mui/icons-material/Close';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import FolderIcon from '@mui/icons-material/Folder';

// ─── Types ────────────────────────────────────────────────────────────────────

type IdeaFolder = { id: number; name: string; sort_order: number | null };
type Idea = { id: number; folder_id: number; title: string; description: string; sort_order: number | null };

type FolderDragState = {
    id: number;
    originalIndex: number;
    deltaY: number;
    isDragging: boolean;
};

type IdeaDragState = {
    id: number;
    folderId: number;
    originalIndex: number;
    deltaY: number;
    isDragging: boolean;
    currentClientX: number;
    currentClientY: number;
};

type FormMode =
    | { type: 'none' }
    | { type: 'newFolder' }
    | { type: 'editFolder'; folder: IdeaFolder }
    | { type: 'newIdea'; folderId: number }
    | { type: 'editIdea'; idea: Idea };

// ─── Constants ────────────────────────────────────────────────────────────────

const FOLDER_ROW_HEIGHT = 48;
const IDEA_ROW_HEIGHT = 60;

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

    const [formMode, setFormMode] = useState<FormMode>({ type: 'none' });
    const [folderNameInput, setFolderNameInput] = useState('');
    const [ideaTitleInput, setIdeaTitleInput] = useState('');
    const [ideaDescInput, setIdeaDescInput] = useState('');

    // ── Data fetching ──────────────────────────────────────────────────────────

    const fetchFolders = useCallback(async () => {
        try {
            const res = await fetch('/api/ideas/folders');
            if (!res.ok) { setFolders([]); return; }
            const data = await res.json();
            const fetchedFolders: IdeaFolder[] = data.folders ?? [];
            setFolders(fetchedFolders);
            // Initialize all folders as collapsed (only for new folders not already tracked)
            setCollapsed(prev => {
                const next = { ...prev };
                for (const f of fetchedFolders) {
                    if (!(f.id in next)) next[f.id] = true;
                }
                return next;
            });
        } catch {
            setFolders([]);
        }
    }, []);

    const fetchFolderIdeas = useCallback(async (folderId: number) => {
        try {
            const res = await fetch(`/api/ideas?folder_id=${folderId}`);
            if (!res.ok) { setIdeas(prev => ({ ...prev, [folderId]: [] })); return; }
            const data = await res.json();
            setIdeas(prev => ({ ...prev, [folderId]: data.ideas ?? [] }));
            setLoadedFolders(prev => { const next = new Set(prev); next.add(folderId); return next; });
        } catch {
            setIdeas(prev => ({ ...prev, [folderId]: [] }));
        }
    }, []);

    useEffect(() => {
        if (isAdmin) fetchFolders();
    }, [isAdmin, fetchFolders]);

    // ── Expand / collapse ──────────────────────────────────────────────────────

    const toggleFolder = useCallback((folderId: number) => {
        setCollapsed(prev => {
            const nowCollapsed = !prev[folderId];
            if (!nowCollapsed && !loadedFolders.has(folderId)) {
                fetchFolderIdeas(folderId);
            }
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
        e.stopPropagation();
        e.currentTarget.setPointerCapture(e.pointerId);
        ideaDragStartY.current = e.clientY;
        setIdeaDrag({
            id: idea.id,
            folderId: idea.folder_id,
            originalIndex: index,
            deltaY: 0,
            isDragging: false,
            currentClientX: e.clientX,
            currentClientY: e.clientY,
        });
    };

    const handleIdeaDragMove = (e: React.PointerEvent) => {
        if (!ideaDrag) return;
        const deltaY = e.clientY - ideaDragStartY.current;
        setIdeaDrag(prev => prev ? {
            ...prev,
            deltaY,
            isDragging: Math.abs(deltaY) > 4 || Math.abs(e.clientX - (ideaDragStartY.current - ideaDragStartY.current)) > 4 ? prev.isDragging || Math.abs(deltaY) > 4 : prev.isDragging,
            currentClientX: e.clientX,
            currentClientY: e.clientY,
        } : null);
    };

    const handleIdeaDragEnd = async (e: React.PointerEvent) => {
        if (!ideaDrag) return;
        if (!ideaDrag.isDragging) { setIdeaDrag(null); return; }

        // Detect which folder the pointer is over
        const el = document.elementFromPoint(ideaDrag.currentClientX, ideaDrag.currentClientY);
        const folderRow = el?.closest('[data-folder-id]');
        const targetFolderIdStr = folderRow?.getAttribute('data-folder-id');
        const targetFolderId = targetFolderIdStr ? parseInt(targetFolderIdStr, 10) : null;

        const sourceFolderId = ideaDrag.folderId;
        const sourceIdeas = ideas[sourceFolderId] ?? [];

        if (targetFolderId !== null && targetFolderId !== sourceFolderId) {
            // Moving to a different folder
            await fetch(`/api/ideas/${ideaDrag.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    folder_id: targetFolderId,
                    sort_order: 0,
                }),
            });
            // Re-fetch both folders
            await Promise.all([
                fetchFolderIdeas(sourceFolderId),
                loadedFolders.has(targetFolderId) ? fetchFolderIdeas(targetFolderId) : Promise.resolve(),
            ]);
        } else {
            // Reordering within same folder
            const toIdx = Math.max(0, Math.min(sourceIdeas.length - 1,
                ideaDrag.originalIndex + Math.round(ideaDrag.deltaY / IDEA_ROW_HEIGHT)));
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

        setIdeaDrag(null);
    };

    const getDisplayedIdeas = (folderId: number): Idea[] => {
        const folderIdeas = ideas[folderId] ?? [];
        if (!ideaDrag?.isDragging || ideaDrag.folderId !== folderId) return folderIdeas;
        const toIdx = Math.max(0, Math.min(folderIdeas.length - 1,
            ideaDrag.originalIndex + Math.round(ideaDrag.deltaY / IDEA_ROW_HEIGHT)));
        return moveItem(folderIdeas, ideaDrag.originalIndex, toIdx);
    };

    // ── Form helpers ───────────────────────────────────────────────────────────

    const openNewFolder = () => {
        setFolderNameInput('');
        setFormMode({ type: 'newFolder' });
    };

    const openEditFolder = (folder: IdeaFolder) => {
        setFolderNameInput(folder.name);
        setFormMode({ type: 'editFolder', folder });
    };

    const openNewIdea = (folderId: number) => {
        setIdeaTitleInput('');
        setIdeaDescInput('');
        setFormMode({ type: 'newIdea', folderId });
    };

    const openEditIdea = (idea: Idea) => {
        setIdeaTitleInput(idea.title);
        setIdeaDescInput(idea.description);
        setFormMode({ type: 'editIdea', idea });
    };

    const closeForm = () => setFormMode({ type: 'none' });

    // ── CRUD operations ────────────────────────────────────────────────────────

    const handleSaveFolder = async () => {
        const name = folderNameInput.trim();
        if (!name) return;

        if (formMode.type === 'newFolder') {
            await fetch('/api/ideas/folders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name }),
            });
        } else if (formMode.type === 'editFolder') {
            await fetch(`/api/ideas/folders/${formMode.folder.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name }),
            });
        }
        closeForm();
        await fetchFolders();
    };

    const handleDeleteFolder = async (folderId: number) => {
        await fetch(`/api/ideas/folders/${folderId}`, { method: 'DELETE' });
        setIdeas(prev => {
            const next = { ...prev };
            delete next[folderId];
            return next;
        });
        setLoadedFolders(prev => {
            const next = new Set(prev);
            next.delete(folderId);
            return next;
        });
        await fetchFolders();
    };

    const handleSaveIdea = async () => {
        const title = ideaTitleInput.trim();
        if (!title) return;

        if (formMode.type === 'newIdea') {
            await fetch('/api/ideas', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ folder_id: formMode.folderId, title, description: ideaDescInput }),
            });
            closeForm();
            await fetchFolderIdeas(formMode.folderId);
        } else if (formMode.type === 'editIdea') {
            await fetch(`/api/ideas/${formMode.idea.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title, description: ideaDescInput }),
            });
            const folderId = formMode.idea.folder_id;
            closeForm();
            await fetchFolderIdeas(folderId);
        }
    };

    const handleDeleteIdea = async (idea: Idea) => {
        await fetch(`/api/ideas/${idea.id}`, { method: 'DELETE' });
        await fetchFolderIdeas(idea.folder_id);
    };

    // ─── Render ───────────────────────────────────────────────────────────────

    const formOpen = formMode.type !== 'none';
    const isFolderForm = formMode.type === 'newFolder' || formMode.type === 'editFolder';
    const isIdeaForm = formMode.type === 'newIdea' || formMode.type === 'editIdea';

    return (
        <Box sx={{
            height: 'calc(100vh - 72px)',
            backgroundColor: '#1e2535',
            color: '#f0e8e8',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
        }}>
            {/* Header */}
            <Box sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                px: 3,
                py: 2,
                borderBottom: '1px solid #4a5568',
                flexShrink: 0,
            }}>
                <Typography variant="h5" sx={{ fontWeight: 700 }}>Ideas Board</Typography>
                {isAdmin && (
                    <Button
                        startIcon={<AddIcon />}
                        onClick={openNewFolder}
                        variant="contained"
                        size="small"
                        sx={{
                            backgroundColor: '#90b4e8',
                            color: '#1e2535',
                            fontWeight: 600,
                            textTransform: 'none',
                            '&:hover': { backgroundColor: '#64b5f6' },
                        }}
                    >
                        New Folder
                    </Button>
                )}
            </Box>

            {/* Content */}
            <Box sx={{ flex: 1, overflowY: 'auto', px: 3, pb: 3 }}>
                {!isAdmin ? (
                    <Box sx={{ textAlign: 'center', mt: 8 }}>
                        <Typography sx={{ color: '#718096', mb: 2 }}>Sign in to view your ideas board.</Typography>
                        <Button
                            component="a"
                            href="/auth/login"
                            variant="outlined"
                            sx={{
                                color: '#90b4e8',
                                borderColor: '#3d5280',
                                textTransform: 'none',
                                '&:hover': { borderColor: '#90b4e8', bgcolor: '#1e2d46' },
                            }}
                        >
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
                            const folderIdeas = getDisplayedIdeas(folder.id);
                            const isIdeaBeingDraggedHere = ideaDrag?.isDragging && ideaDrag.folderId !== folder.id;

                            return (
                                <Box
                                    key={folder.id}
                                    data-folder-id={folder.id}
                                    sx={{ mb: 0.5 }}
                                >
                                    {/* Folder row */}
                                    <Box
                                        onPointerMove={isAdmin ? handleFolderDragMove : undefined}
                                        onPointerUp={isAdmin ? handleFolderDragEnd : undefined}
                                        onPointerCancel={isAdmin ? () => setFolderDrag(null) : undefined}
                                        sx={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 0.5,
                                            px: 1,
                                            py: 0.75,
                                            borderRadius: 2,
                                            backgroundColor: isIdeaBeingDraggedHere ? '#2a3550' : isFolderBeingDragged ? '#1a2030' : '#252f42',
                                            border: '1px solid',
                                            borderColor: isIdeaBeingDraggedHere ? '#90b4e8' : isFolderBeingDragged ? '#64b5f6' : '#4a5568',
                                            opacity: isFolderBeingDragged ? 0.5 : 1,
                                            transition: folderDrag?.isDragging ? 'none' : 'background-color 0.15s, border-color 0.15s',
                                            cursor: 'default',
                                            userSelect: 'none',
                                            minHeight: `${FOLDER_ROW_HEIGHT}px`,
                                        }}
                                    >
                                        {/* Folder drag handle — admin only */}
                                        {isAdmin && (
                                            <Tooltip title="Drag to reorder">
                                                <IconButton
                                                    size="small"
                                                    onPointerDown={e => handleFolderDragStart(e, folder.id, folderIndex)}
                                                    sx={{
                                                        color: '#4a5568',
                                                        p: 0.25,
                                                        cursor: folderDrag?.isDragging ? 'grabbing' : 'grab',
                                                        '&:hover': { color: '#718096' },
                                                        touchAction: 'none',
                                                    }}
                                                >
                                                    <DragIndicatorIcon sx={{ fontSize: 18 }} />
                                                </IconButton>
                                            </Tooltip>
                                        )}

                                        {/* Expand/collapse chevron */}
                                        <IconButton
                                            size="small"
                                            onClick={() => toggleFolder(folder.id)}
                                            sx={{ color: '#90b4e8', p: 0.25 }}
                                        >
                                            {isExpanded
                                                ? <ExpandMoreIcon sx={{ fontSize: 20 }} />
                                                : <ChevronRightIcon sx={{ fontSize: 20 }} />
                                            }
                                        </IconButton>

                                        {/* Folder icon */}
                                        <FolderIcon sx={{ color: '#90b4e8', fontSize: 18, flexShrink: 0 }} />

                                        {/* Folder name */}
                                        <Typography
                                            onClick={() => toggleFolder(folder.id)}
                                            sx={{
                                                flex: 1,
                                                fontWeight: 600,
                                                fontSize: '0.95rem',
                                                color: '#f0e8e8',
                                                cursor: 'pointer',
                                                '&:hover': { color: '#90b4e8' },
                                                transition: 'color 0.15s',
                                            }}
                                        >
                                            {folder.name}
                                            {loadedFolders.has(folder.id) && (
                                                <Typography component="span" sx={{ color: '#4a5568', fontSize: '0.75rem', ml: 1, fontWeight: 400 }}>
                                                    ({(ideas[folder.id] ?? []).length})
                                                </Typography>
                                            )}
                                        </Typography>

                                        {/* Admin actions */}
                                        {isAdmin && (
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, ml: 'auto' }}>
                                                {isExpanded && (
                                                    <Tooltip title="Add Idea">
                                                        <IconButton
                                                            size="small"
                                                            onClick={() => openNewIdea(folder.id)}
                                                            sx={{ color: '#90b4e8', p: 0.5, '&:hover': { color: '#64b5f6' } }}
                                                        >
                                                            <AddIcon sx={{ fontSize: 16 }} />
                                                        </IconButton>
                                                    </Tooltip>
                                                )}
                                                <Tooltip title="Rename folder">
                                                    <IconButton
                                                        size="small"
                                                        onClick={() => openEditFolder(folder)}
                                                        sx={{ color: '#64b5f6', p: 0.5, '&:hover': { color: '#90b4e8' } }}
                                                    >
                                                        <EditIcon sx={{ fontSize: 16 }} />
                                                    </IconButton>
                                                </Tooltip>
                                                <Tooltip title="Delete folder">
                                                    <IconButton
                                                        size="small"
                                                        onClick={() => handleDeleteFolder(folder.id)}
                                                        sx={{ color: '#e57373', p: 0.5, '&:hover': { color: '#ff5252' } }}
                                                    >
                                                        <DeleteIcon sx={{ fontSize: 16 }} />
                                                    </IconButton>
                                                </Tooltip>
                                            </Box>
                                        )}
                                    </Box>

                                    {/* Ideas list (expanded) */}
                                    <Collapse in={isExpanded} timeout={180}>
                                        <Box sx={{ pl: isAdmin ? 5 : 3, pr: 1, pt: 0.5, pb: 0.5 }}>
                                            {!loadedFolders.has(folder.id) ? (
                                                <Typography sx={{ color: '#4a5568', fontSize: '0.8rem', py: 1, fontStyle: 'italic' }}>
                                                    Loading…
                                                </Typography>
                                            ) : folderIdeas.length === 0 ? (
                                                <Typography sx={{ color: '#4a5568', fontSize: '0.8rem', py: 1, fontStyle: 'italic' }}>
                                                    No ideas in this folder yet.
                                                </Typography>
                                            ) : (
                                                folderIdeas.map((idea, ideaIndex) => {
                                                    const isBeingDragged = ideaDrag?.id === idea.id && ideaDrag.isDragging;
                                                    return (
                                                        <Box
                                                            key={idea.id}
                                                            onPointerMove={isAdmin ? handleIdeaDragMove : undefined}
                                                            onPointerUp={isAdmin ? handleIdeaDragEnd : undefined}
                                                            onPointerCancel={isAdmin ? () => setIdeaDrag(null) : undefined}
                                                            sx={{
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: 0.75,
                                                                px: 1,
                                                                py: 0.75,
                                                                mb: 0.5,
                                                                borderRadius: 1.5,
                                                                backgroundColor: '#1a2030',
                                                                border: '1px solid',
                                                                borderColor: isBeingDragged ? '#64b5f6' : '#3a4255',
                                                                opacity: isBeingDragged ? 0.4 : 1,
                                                                transition: ideaDrag?.isDragging ? 'none' : 'opacity 0.15s',
                                                                userSelect: 'none',
                                                                minHeight: `${IDEA_ROW_HEIGHT}px`,
                                                            }}
                                                        >
                                                            {/* Idea drag handle — admin only */}
                                                            {isAdmin && (
                                                                <Tooltip title="Drag to reorder or move">
                                                                    <IconButton
                                                                        size="small"
                                                                        onPointerDown={e => handleIdeaDragStart(e, idea, ideaIndex)}
                                                                        sx={{
                                                                            color: '#3a4255',
                                                                            p: 0.25,
                                                                            cursor: ideaDrag?.isDragging ? 'grabbing' : 'grab',
                                                                            flexShrink: 0,
                                                                            '&:hover': { color: '#718096' },
                                                                            touchAction: 'none',
                                                                        }}
                                                                    >
                                                                        <DragIndicatorIcon sx={{ fontSize: 16 }} />
                                                                    </IconButton>
                                                                </Tooltip>
                                                            )}

                                                            {/* Idea content */}
                                                            <Box sx={{ flex: 1, minWidth: 0 }}>
                                                                <Typography sx={{
                                                                    fontWeight: 700,
                                                                    fontSize: '0.9rem',
                                                                    color: '#f0e8e8',
                                                                    overflow: 'hidden',
                                                                    textOverflow: 'ellipsis',
                                                                    whiteSpace: 'nowrap',
                                                                }}>
                                                                    {idea.title}
                                                                </Typography>
                                                                {idea.description && (
                                                                    <Typography sx={{
                                                                        color: '#718096',
                                                                        fontSize: '0.78rem',
                                                                        mt: 0.2,
                                                                        overflow: 'hidden',
                                                                        textOverflow: 'ellipsis',
                                                                        whiteSpace: 'nowrap',
                                                                    }}>
                                                                        {idea.description}
                                                                    </Typography>
                                                                )}
                                                            </Box>

                                                            {/* Admin actions */}
                                                            {isAdmin && (
                                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, flexShrink: 0 }}>
                                                                    <Tooltip title="Edit">
                                                                        <IconButton
                                                                            size="small"
                                                                            onPointerDown={e => e.stopPropagation()}
                                                                            onClick={() => openEditIdea(idea)}
                                                                            sx={{ color: '#64b5f6', p: 0.5, '&:hover': { color: '#90b4e8' } }}
                                                                        >
                                                                            <EditIcon sx={{ fontSize: 15 }} />
                                                                        </IconButton>
                                                                    </Tooltip>
                                                                    <Tooltip title="Delete">
                                                                        <IconButton
                                                                            size="small"
                                                                            onPointerDown={e => e.stopPropagation()}
                                                                            onClick={() => handleDeleteIdea(idea)}
                                                                            sx={{ color: '#e57373', p: 0.5, '&:hover': { color: '#ff5252' } }}
                                                                        >
                                                                            <DeleteIcon sx={{ fontSize: 15 }} />
                                                                        </IconButton>
                                                                    </Tooltip>
                                                                </Box>
                                                            )}
                                                        </Box>
                                                    );
                                                })
                                            )}
                                            {/* Add idea inline shortcut */}
                                            {isAdmin && (
                                                <Button
                                                    size="small"
                                                    startIcon={<AddIcon sx={{ fontSize: 14 }} />}
                                                    onClick={() => openNewIdea(folder.id)}
                                                    sx={{
                                                        color: '#4a5568',
                                                        textTransform: 'none',
                                                        fontSize: '0.78rem',
                                                        py: 0.25,
                                                        mt: 0.25,
                                                        '&:hover': { color: '#90b4e8', backgroundColor: 'transparent' },
                                                    }}
                                                >
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

            {/* Modal form overlay */}
            {formOpen && (
                <Box
                    onClick={closeForm}
                    sx={{
                        position: 'fixed',
                        inset: 0,
                        backgroundColor: 'rgba(0,0,0,0.5)',
                        zIndex: 1200,
                    }}
                />
            )}

            {/* Folder form modal */}
            {formOpen && isFolderForm && (
                <Box sx={{
                    position: 'fixed',
                    left: '50%',
                    top: '50%',
                    transform: 'translate(-50%, -50%)',
                    zIndex: 1300,
                    width: { xs: '95vw', sm: '360px' },
                    backgroundColor: '#2d3748',
                    color: '#f0e8e8',
                    borderRadius: '8px',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
                    border: '1px solid #4a5568',
                }}>
                    <Box sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        px: 2,
                        py: 1.5,
                        borderBottom: '1px solid #4a5568',
                    }}>
                        <Typography sx={{ fontWeight: 600 }}>
                            {formMode.type === 'newFolder' ? 'New Folder' : 'Rename Folder'}
                        </Typography>
                        <IconButton size="small" onClick={closeForm} sx={{ color: '#718096' }}>
                            <CloseIcon fontSize="small" />
                        </IconButton>
                    </Box>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, p: 2 }}>
                        <TextField
                            label="Folder name"
                            value={folderNameInput}
                            onChange={e => setFolderNameInput(e.target.value)}
                            onKeyDown={e => {
                                if (e.key === 'Enter') handleSaveFolder();
                                if (e.key === 'Escape') closeForm();
                            }}
                            fullWidth
                            size="small"
                            autoFocus
                            InputLabelProps={{ sx: { color: '#aaa' } }}
                            inputProps={{ style: { color: '#f0e8e8' } }}
                            sx={inputSx}
                        />
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, px: 2, pb: 2 }}>
                        <Button onClick={closeForm} sx={{ color: '#aaa', textTransform: 'none' }}>Cancel</Button>
                        <Button
                            onClick={handleSaveFolder}
                            disabled={!folderNameInput.trim()}
                            variant="contained"
                            sx={{
                                backgroundColor: '#90b4e8',
                                color: '#1e2535',
                                textTransform: 'none',
                                fontWeight: 600,
                                '&:hover': { backgroundColor: '#64b5f6' },
                            }}
                        >
                            Save
                        </Button>
                    </Box>
                </Box>
            )}

            {/* Idea form modal */}
            {formOpen && isIdeaForm && (
                <Box sx={{
                    position: 'fixed',
                    left: '50%',
                    top: '50%',
                    transform: 'translate(-50%, -50%)',
                    zIndex: 1300,
                    width: { xs: '95vw', sm: '400px', lg: '480px' },
                    maxHeight: '90vh',
                    overflowY: 'auto',
                    backgroundColor: '#2d3748',
                    color: '#f0e8e8',
                    borderRadius: '8px',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
                    border: '1px solid #4a5568',
                }}>
                    <Box sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        px: 2,
                        py: 1.5,
                        borderBottom: '1px solid #4a5568',
                    }}>
                        <Typography sx={{ fontWeight: 600 }}>
                            {formMode.type === 'newIdea' ? 'New Idea' : 'Edit Idea'}
                        </Typography>
                        <IconButton size="small" onClick={closeForm} sx={{ color: '#718096' }}>
                            <CloseIcon fontSize="small" />
                        </IconButton>
                    </Box>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, p: 2 }}>
                        <TextField
                            label="Title"
                            value={ideaTitleInput}
                            onChange={e => setIdeaTitleInput(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Escape') closeForm(); }}
                            fullWidth
                            size="small"
                            autoFocus
                            InputLabelProps={{ sx: { color: '#aaa' } }}
                            inputProps={{ style: { color: '#f0e8e8' } }}
                            sx={inputSx}
                        />
                        <TextField
                            label="Description"
                            value={ideaDescInput}
                            onChange={e => setIdeaDescInput(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Escape') closeForm(); }}
                            multiline
                            rows={3}
                            fullWidth
                            size="small"
                            InputLabelProps={{ sx: { color: '#aaa' } }}
                            inputProps={{ style: { color: '#f0e8e8' } }}
                            sx={inputSx}
                        />
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, px: 2, pb: 2 }}>
                        <Button onClick={closeForm} sx={{ color: '#aaa', textTransform: 'none' }}>Cancel</Button>
                        <Button
                            onClick={handleSaveIdea}
                            disabled={!ideaTitleInput.trim()}
                            variant="contained"
                            sx={{
                                backgroundColor: '#90b4e8',
                                color: '#1e2535',
                                textTransform: 'none',
                                fontWeight: 600,
                                '&:hover': { backgroundColor: '#64b5f6' },
                            }}
                        >
                            Save
                        </Button>
                    </Box>
                </Box>
            )}
        </Box>
    );
}
