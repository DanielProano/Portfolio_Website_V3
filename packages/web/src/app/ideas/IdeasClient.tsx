'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    Box, Typography, IconButton, Button, TextField, Tooltip, Collapse,
    Select, MenuItem, Menu, ListItemIcon, ListItemText,
    Dialog, DialogTitle, DialogContent, DialogActions,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import CheckIcon from '@mui/icons-material/Check';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import FolderIcon from '@mui/icons-material/Folder';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import LightbulbOutlinedIcon from '@mui/icons-material/LightbulbOutlined';

// ─── Types ────────────────────────────────────────────────────────────────────

type IdeaFolder = {
    id: number; name: string; sort_order: number | null;
    created_at: string; idea_count: number;
};
type Idea = { id: number; folder_id: number; title: string; sort_order: number | null };

type FolderDrag = { id: number; originalIndex: number; deltaY: number; isDragging: boolean };
type IdeaDrag = { idea: Idea; originalIndex: number; deltaY: number; isDragging: boolean };

type FolderDialog = { mode: 'new' } | { mode: 'rename'; folder: IdeaFolder } | null;

// ─── Constants ────────────────────────────────────────────────────────────────

const FOLDER_ROW_HEIGHT = 60;
const IDEA_ROW_HEIGHT = 60;
const TOPBAR_OFFSET = 72;

function moveItem<T>(arr: T[], from: number, to: number): T[] {
    const result = [...arr];
    const [item] = result.splice(from, 1);
    result.splice(to, 0, item);
    return result;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function IdeasClient({ canEdit }: { canEdit: boolean }) {
    const [folders, setFolders] = useState<IdeaFolder[]>([]);
    const [ideasByFolder, setIdeasByFolder] = useState<Record<number, Idea[]>>({});
    const [collapsed, setCollapsed] = useState<Record<number, boolean>>({});
    const [loadedFolders, setLoadedFolders] = useState<Set<number>>(new Set());
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Drag
    const [folderDrag, setFolderDrag] = useState<FolderDrag | null>(null);
    const [ideaDrag, setIdeaDrag] = useState<IdeaDrag | null>(null);
    const folderDragStartY = useRef(0);
    const ideaDragStartY = useRef(0);
    const [reorderMode, setReorderMode] = useState(false);

    // Menus (replaces always-visible icon buttons)
    const [folderMenu, setFolderMenu] = useState<{ el: HTMLElement; folder: IdeaFolder } | null>(null);
    const [ideaMenu, setIdeaMenu] = useState<{ el: HTMLElement; idea: Idea } | null>(null);

    // Dialogs
    const [folderDialog, setFolderDialog] = useState<FolderDialog>(null);
    const [folderNameInput, setFolderNameInput] = useState('');
    const [ideaDialogFolder, setIdeaDialogFolder] = useState<number | null>(null);
    const [ideaTitleInput, setIdeaTitleInput] = useState('');

    // Inline edit (rename and/or move)
    const [editingId, setEditingId] = useState<number | null>(null);
    const [draftTitle, setDraftTitle] = useState('');
    const [draftFolderId, setDraftFolderId] = useState<number | ''>('');

    // ── loading ──────────────────────────────────────────────────────────────

    const loadFolders = useCallback(async () => {
        const res = await fetch('/api/ideas/folders');
        if (!res.ok) throw new Error((await res.json()).error ?? 'Failed to load folders');
        const fetched: IdeaFolder[] = (await res.json()).folders ?? [];
        setFolders(fetched);
        setCollapsed(prev => {
            const next = { ...prev };
            for (const f of fetched) if (!(f.id in next)) next[f.id] = true;
            return next;
        });
        return fetched;
    }, []);

    const loadFolderIdeas = useCallback(async (folderId: number) => {
        try {
            const res = await fetch(`/api/ideas?folder_id=${folderId}`);
            if (!res.ok) throw new Error((await res.json()).error ?? 'Failed to load ideas');
            const fetched: Idea[] = (await res.json()).ideas ?? [];
            setIdeasByFolder(prev => ({ ...prev, [folderId]: fetched }));
            setLoadedFolders(prev => new Set(prev).add(folderId));
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to load ideas');
        }
    }, []);

    useEffect(() => {
        if (!canEdit) { setLoading(false); return; }
        (async () => {
            try {
                await loadFolders();
                setError(null);
            } catch (e) {
                setError(e instanceof Error ? e.message : 'Failed to load board');
            } finally {
                setLoading(false);
            }
        })();
    }, [canEdit, loadFolders]);

    // ── folders ──────────────────────────────────────────────────────────────

    const toggleFolder = useCallback((folderId: number) => {
        setCollapsed(prev => {
            const nowCollapsed = !prev[folderId];
            if (!nowCollapsed && !loadedFolders.has(folderId)) loadFolderIdeas(folderId);
            return { ...prev, [folderId]: nowCollapsed };
        });
    }, [loadedFolders, loadFolderIdeas]);

    async function submitFolderDialog() {
        if (!folderDialog) return;
        const name = folderNameInput.trim();
        if (!name) return;
        try {
            const res = folderDialog.mode === 'new'
                ? await fetch('/api/ideas/folders', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name }),
                })
                : await fetch(`/api/ideas/folders/${folderDialog.folder.id}`, {
                    method: 'PUT', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name }),
                });
            if (!res.ok) throw new Error((await res.json()).error ?? 'Folder operation failed');
            setFolderDialog(null);
            setFolderNameInput('');
            await loadFolders();
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Folder operation failed');
        }
    }

    async function deleteFolder(folder: IdeaFolder) {
        const n = folder.idea_count;
        const warning = n > 0
            ? `Delete "${folder.name}" and its ${n} idea${n === 1 ? '' : 's'}?`
            : `Delete the empty folder "${folder.name}"?`;
        if (!window.confirm(warning)) return;

        const res = await fetch(`/api/ideas/folders/${folder.id}`, { method: 'DELETE' });
        if (!res.ok) { setError('Could not delete folder'); return; }
        setIdeasByFolder(prev => { const next = { ...prev }; delete next[folder.id]; return next; });
        setLoadedFolders(prev => { const next = new Set(prev); next.delete(folder.id); return next; });
        await loadFolders();
    }

    // ── drag: folders ────────────────────────────────────────────────────────

    const startFolderDrag = (e: React.PointerEvent, folderId: number, index: number) => {
        e.stopPropagation();
        e.currentTarget.setPointerCapture(e.pointerId);
        folderDragStartY.current = e.clientY;
        setFolderDrag({ id: folderId, originalIndex: index, deltaY: 0, isDragging: false });
    };

    const moveFolderDrag = (e: React.PointerEvent) => {
        if (!folderDrag) return;
        const deltaY = e.clientY - folderDragStartY.current;
        setFolderDrag(prev => prev ? { ...prev, deltaY, isDragging: prev.isDragging || Math.abs(deltaY) > 4 } : null);
    };

    const endFolderDrag = async () => {
        if (!folderDrag) return;
        if (!folderDrag.isDragging) { setFolderDrag(null); return; }
        const toIdx = Math.max(0, Math.min(folders.length - 1,
            folderDrag.originalIndex + Math.round(folderDrag.deltaY / FOLDER_ROW_HEIGHT)));
        const withOrder = moveItem(folders, folderDrag.originalIndex, toIdx)
            .map((f, i) => ({ ...f, sort_order: i }));
        setFolders(withOrder);
        setFolderDrag(null);
        await fetch('/api/ideas/folders', {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ updates: withOrder.map(f => ({ id: f.id, sort_order: f.sort_order })) }),
        });
    };

    const displayedFolders = (() => {
        if (!folderDrag?.isDragging) return folders;
        const toIdx = Math.max(0, Math.min(folders.length - 1,
            folderDrag.originalIndex + Math.round(folderDrag.deltaY / FOLDER_ROW_HEIGHT)));
        return moveItem(folders, folderDrag.originalIndex, toIdx);
    })();

    // ── drag: ideas (reorder within a folder, or drop onto another folder) ───

    const startIdeaDrag = (e: React.PointerEvent, idea: Idea, index: number) => {
        e.stopPropagation();
        e.currentTarget.setPointerCapture(e.pointerId);
        ideaDragStartY.current = e.clientY;
        setIdeaDrag({ idea, originalIndex: index, deltaY: 0, isDragging: false });
    };

    const moveIdeaDrag = (e: React.PointerEvent) => {
        if (!ideaDrag) return;
        const deltaY = e.clientY - ideaDragStartY.current;
        setIdeaDrag(prev => prev ? { ...prev, deltaY, isDragging: prev.isDragging || Math.abs(deltaY) > 4 } : null);
    };

    const endIdeaDrag = async (e: React.PointerEvent) => {
        if (!ideaDrag) return;
        if (!ideaDrag.isDragging) { setIdeaDrag(null); return; }

        // Live pointer coords, not stale state — the drop target is geometric.
        const overFolder = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-folder-id]');
        const targetId = overFolder?.getAttribute('data-folder-id');
        const targetFolderId = targetId ? parseInt(targetId, 10) : null;

        const sourceFolderId = ideaDrag.idea.folder_id;
        const sourceIdeas = ideasByFolder[sourceFolderId] ?? [];
        const dragged = ideaDrag.idea;
        setIdeaDrag(null);

        if (targetFolderId !== null && targetFolderId !== sourceFolderId) {
            await fetch('/api/ideas', {
                method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ updates: [{ id: dragged.id, folder_id: targetFolderId, sort_order: 0 }] }),
            });
            setCollapsed(prev => ({ ...prev, [targetFolderId]: false }));
            await loadFolders();
            await loadFolderIdeas(sourceFolderId);
            await loadFolderIdeas(targetFolderId);
            return;
        }

        const toIdx = Math.max(0, Math.min(sourceIdeas.length - 1,
            ideaDrag.originalIndex + Math.round(ideaDrag.deltaY / IDEA_ROW_HEIGHT)));
        if (toIdx === ideaDrag.originalIndex) return;

        const withOrder = moveItem(sourceIdeas, ideaDrag.originalIndex, toIdx)
            .map((it, i) => ({ ...it, sort_order: i }));
        setIdeasByFolder(prev => ({ ...prev, [sourceFolderId]: withOrder }));
        await fetch('/api/ideas', {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ updates: withOrder.map(it => ({ id: it.id, sort_order: it.sort_order })) }),
        });
    };

    const displayedIdeas = (folderId: number): Idea[] => {
        const list = ideasByFolder[folderId] ?? [];
        if (!ideaDrag?.isDragging || ideaDrag.idea.folder_id !== folderId) return list;
        const toIdx = Math.max(0, Math.min(list.length - 1,
            ideaDrag.originalIndex + Math.round(ideaDrag.deltaY / IDEA_ROW_HEIGHT)));
        return moveItem(list, ideaDrag.originalIndex, toIdx);
    };

    // ── idea create / edit / delete ──────────────────────────────────────────

    function openNewIdea(folderId: number) {
        setIdeaTitleInput('');
        setIdeaDialogFolder(folderId);
    }

    async function submitIdeaDialog() {
        if (ideaDialogFolder === null) return;
        const title = ideaTitleInput.trim();
        if (!title) return;
        const folderId = ideaDialogFolder;
        setIdeaDialogFolder(null);

        const res = await fetch('/api/ideas', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ folder_id: folderId, title }),
        });
        if (!res.ok) { setError('Could not create idea'); return; }
        setCollapsed(prev => ({ ...prev, [folderId]: false }));
        await loadFolders();
        await loadFolderIdeas(folderId);
    }

    async function saveEdit(idea: Idea) {
        const title = draftTitle.trim() || 'Untitled';
        const movingTo = draftFolderId === '' || draftFolderId === idea.folder_id ? null : draftFolderId;

        const res = await fetch(`/api/ideas/${idea.id}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, folder_id: movingTo }),
        });
        if (!res.ok) { setError('Could not save changes'); return; }

        setEditingId(null);
        if (movingTo != null) {
            setCollapsed(prev => ({ ...prev, [movingTo]: false }));
            await loadFolders();
            await loadFolderIdeas(idea.folder_id);
            await loadFolderIdeas(movingTo);
        } else {
            setIdeasByFolder(prev => ({
                ...prev,
                [idea.folder_id]: (prev[idea.folder_id] ?? []).map(it =>
                    it.id === idea.id ? { ...it, title } : it),
            }));
        }
    }

    async function removeIdea(idea: Idea) {
        if (!window.confirm(`Delete "${idea.title}"?`)) return;
        const res = await fetch(`/api/ideas/${idea.id}`, { method: 'DELETE' });
        if (!res.ok) { setError('Could not delete idea'); return; }
        setIdeasByFolder(prev => ({
            ...prev,
            [idea.folder_id]: (prev[idea.folder_id] ?? []).filter(it => it.id !== idea.id),
        }));
        await loadFolders();
    }

    // ── shared styles (mirrors the audio library) ────────────────────────────

    const fieldSx = {
        '& .MuiOutlinedInput-root': { color: '#f0e8e8', backgroundColor: '#1e2535' },
        '& .MuiOutlinedInput-notchedOutline': { borderColor: '#3a4255' },
        '& .MuiInputLabel-root': { color: '#718096' },
        '& .MuiSvgIcon-root': { color: '#718096' },
    };
    const menuPaperSx = {
        sx: {
            backgroundColor: '#252f42', color: '#f0e8e8', backgroundImage: 'none',
            border: '1px solid #3a4255', minWidth: 180,
            '& .MuiMenuItem-root': { fontSize: '0.85rem' },
            '& .MuiListItemIcon-root': { color: '#90b4e8', minWidth: 32 },
        },
    };
    const dialogPaperSx = { sx: { backgroundColor: '#1a2030', color: '#f0e8e8', backgroundImage: 'none' } };
    /** Dashed "ghost" row — the creation affordance, distinct from destructive icons. */
    const ghostRowSx = {
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.75,
        px: 1.5, py: 1, borderRadius: 1.5, cursor: 'pointer',
        border: '1px dashed #3a4255',
        backgroundColor: 'transparent',
        color: '#4a5568',
        transition: 'color 0.15s, border-color 0.15s, background-color 0.15s',
        '&:hover': { borderColor: '#90b4e8', color: '#90b4e8' },
    };
    const primaryButtonSx = {
        textTransform: 'none', fontWeight: 600, px: 2, color: '#1e2535', backgroundColor: '#90b4e8',
        '&:hover': { backgroundColor: '#64b5f6' },
        '&.Mui-disabled': { backgroundColor: '#2d3748', color: '#4a5568' },
    };

    // ── signed out ───────────────────────────────────────────────────────────

    if (!canEdit) {
        return (
            <Box sx={{
                minHeight: `calc(100vh - ${TOPBAR_OFFSET}px)`, backgroundColor: '#1a2030', color: '#f0e8e8',
                display: 'flex', alignItems: 'flex-start', justifyContent: 'center', px: 2, py: 10,
            }}>
                <Box sx={{ textAlign: 'center' }}>
                    <Typography sx={{ color: '#718096', mb: 2 }}>Sign in to view your ideas board.</Typography>
                    <Button component="a" href="/auth/login" variant="outlined"
                        sx={{ color: '#90b4e8', borderColor: '#3d5280', textTransform: 'none', '&:hover': { borderColor: '#90b4e8', bgcolor: '#1e2d46' } }}>
                        Sign In
                    </Button>
                </Box>
            </Box>
        );
    }

    // ── board ────────────────────────────────────────────────────────────────

    return (
        <Box sx={{ backgroundColor: '#1a2030', color: '#f0e8e8', minHeight: `calc(100vh - ${TOPBAR_OFFSET}px)` }}>
            <Box sx={{ px: { xs: 2, md: 4 }, py: 4 }}>
                <Box sx={{ maxWidth: 1200 }}>

                    {/* Header */}
                    <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 2, mb: 0.5 }}>
                        <Typography variant="h4" sx={{ fontWeight: 700 }}>Ideas</Typography>
                        <Button
                            startIcon={<DragIndicatorIcon />} onClick={() => setReorderMode(v => !v)} size="small"
                            sx={{
                                textTransform: 'none', fontWeight: 600,
                                color: reorderMode ? '#64b5f6' : '#718096',
                                backgroundColor: reorderMode ? '#252f42' : 'transparent',
                                '&:hover': { color: '#90b4e8', backgroundColor: reorderMode ? '#252f42' : 'transparent' },
                            }}
                        >
                            {reorderMode ? 'Done' : 'Reorder'}
                        </Button>
                    </Box>
                    <Typography sx={{ color: '#718096', fontSize: '0.85rem', mb: 3 }}>
                        Group ideas into folders. Drag to reorder, or drag an idea onto another folder to move it.
                    </Typography>

                    {error && (
                        <Box sx={{ mb: 2, p: 1.5, borderRadius: 1, backgroundColor: '#2d2130', border: '1px solid #e57373' }}>
                            <Typography sx={{ color: '#e57373', fontSize: '0.85rem' }}>{error}</Typography>
                        </Box>
                    )}

                    {loading ? (
                        <Typography sx={{ color: '#4a5568' }}>Loading board…</Typography>
                    ) : (
                        <Box>
                            {displayedFolders.map((folder, folderIndex) => {
                                const isExpanded = !collapsed[folder.id];
                                const beingDragged = folderDrag?.id === folder.id && folderDrag.isDragging;
                                const ideaHovering = ideaDrag?.isDragging && ideaDrag.idea.folder_id !== folder.id;
                                const list = displayedIdeas(folder.id);

                                return (
                                    <Box key={folder.id} data-folder-id={folder.id} sx={{ mb: 0.75 }}>

                                        {/* Folder header */}
                                        <Box sx={{
                                            display: 'flex', alignItems: 'center', gap: 0.5,
                                            px: 1, py: 0.75, borderRadius: 2, minHeight: FOLDER_ROW_HEIGHT,
                                            backgroundColor: ideaHovering ? '#2a3550' : beingDragged ? '#1a2030' : '#252f42',
                                            border: '1px solid',
                                            borderColor: ideaHovering ? '#90b4e8' : beingDragged ? '#64b5f6' : '#3a4255',
                                            opacity: beingDragged ? 0.5 : 1,
                                            transition: folderDrag?.isDragging ? 'none' : 'background-color 0.15s, border-color 0.15s',
                                            userSelect: 'none',
                                            '&:hover .rowActions': { opacity: 1 },
                                        }}>
                                            {reorderMode && (
                                                <IconButton
                                                    size="small"
                                                    onPointerDown={e => startFolderDrag(e, folder.id, folderIndex)}
                                                    onPointerMove={moveFolderDrag}
                                                    onPointerUp={endFolderDrag}
                                                    onPointerCancel={() => setFolderDrag(null)}
                                                    sx={{
                                                        color: '#4a5568', p: 0.75, touchAction: 'none',
                                                        cursor: folderDrag?.isDragging ? 'grabbing' : 'grab',
                                                        '&:hover': { color: '#90b4e8' },
                                                    }}
                                                >
                                                    <DragIndicatorIcon sx={{ fontSize: 22 }} />
                                                </IconButton>
                                            )}

                                            <IconButton size="small" onClick={() => toggleFolder(folder.id)} sx={{ color: '#90b4e8', p: 0.6 }}>
                                                {isExpanded ? <ExpandMoreIcon sx={{ fontSize: 22 }} /> : <ChevronRightIcon sx={{ fontSize: 22 }} />}
                                            </IconButton>
                                            <FolderIcon sx={{ color: '#90b4e8', fontSize: 20, flexShrink: 0 }} />
                                            <Typography
                                                onClick={() => toggleFolder(folder.id)}
                                                noWrap
                                                sx={{
                                                    flex: 1, minWidth: 0, fontWeight: 600, fontSize: '0.95rem', color: '#f0e8e8',
                                                    cursor: 'pointer', '&:hover': { color: '#90b4e8' }, transition: 'color 0.15s',
                                                }}
                                            >
                                                {folder.name}
                                                <Typography component="span" sx={{ color: '#4a5568', fontSize: '0.75rem', ml: 1, fontWeight: 400 }}>
                                                    {folder.idea_count}
                                                </Typography>
                                            </Typography>

                                            <IconButton
                                                size="small" className="rowActions"
                                                onClick={e => setFolderMenu({ el: e.currentTarget, folder })}
                                                sx={{
                                                    color: '#4a5568', p: 0.75, opacity: { xs: 1, lg: 0 },
                                                    transition: 'opacity 0.15s', '&:hover': { color: '#f0e8e8' },
                                                }}
                                            >
                                                <MoreVertIcon sx={{ fontSize: 22 }} />
                                            </IconButton>
                                        </Box>

                                        {/* Ideas */}
                                        <Collapse in={isExpanded} timeout={180}>
                                            <Box sx={{ pl: { xs: 1.5, sm: 4 }, pr: 0.5, pt: 0.5 }}>
                                                {!loadedFolders.has(folder.id) ? (
                                                    <Typography sx={{ color: '#4a5568', fontSize: '0.8rem', py: 1 }}>Loading…</Typography>
                                                ) : (
                                                    <>
                                                        {list.map((idea, ideaIndex) => {
                                                            const isEditing = editingId === idea.id;
                                                            const dragging = ideaDrag?.idea.id === idea.id && ideaDrag.isDragging;
                                                            const beginEdit = () => {
                                                                setEditingId(idea.id);
                                                                setDraftTitle(idea.title);
                                                                setDraftFolderId(idea.folder_id);
                                                            };
                                                            return (
                                                                <Box
                                                                    key={idea.id}
                                                                    sx={{
                                                                        display: 'flex', alignItems: 'center', gap: 0.5,
                                                                        px: 0.75, py: 0.5, mb: 0.5, borderRadius: 1.5,
                                                                        minHeight: IDEA_ROW_HEIGHT,
                                                                        backgroundColor: '#1e2535',
                                                                        border: '1px solid',
                                                                        borderColor: dragging ? '#64b5f6' : isEditing ? '#90b4e8' : '#2d3748',
                                                                        opacity: dragging ? 0.4 : 1,
                                                                        transition: ideaDrag?.isDragging ? 'none' : 'opacity 0.15s, border-color 0.15s',
                                                                        '&:hover .ideaActions': { opacity: 1 },
                                                                    }}
                                                                >
                                                                    {isEditing ? (
                                                                        <Box sx={{ display: 'flex', gap: 1, flexGrow: 1, alignItems: 'center', flexWrap: 'wrap', py: 0.5 }}>
                                                                            <TextField
                                                                                value={draftTitle}
                                                                                onChange={e => setDraftTitle(e.target.value)}
                                                                                onKeyDown={e => { if (e.key === 'Enter') saveEdit(idea); if (e.key === 'Escape') setEditingId(null); }}
                                                                                placeholder="Idea" size="small" variant="standard" autoFocus
                                                                                sx={{
                                                                                    flex: 1, minWidth: 130,
                                                                                    '& .MuiInput-input': { color: '#f0e8e8', fontSize: '0.9rem' },
                                                                                    '& .MuiInput-root:before': { borderColor: '#4a5568' },
                                                                                }}
                                                                            />
                                                                            <Select
                                                                                value={draftFolderId}
                                                                                onChange={e => setDraftFolderId(e.target.value as number)}
                                                                                size="small" variant="standard"
                                                                                MenuProps={{ PaperProps: menuPaperSx }}
                                                                                sx={{
                                                                                    minWidth: 110, color: '#f0e8e8', fontSize: '0.8rem',
                                                                                    '&:before': { borderColor: '#4a5568' },
                                                                                    '& .MuiSvgIcon-root': { color: '#718096' },
                                                                                }}
                                                                            >
                                                                                {folders.map(f => <MenuItem key={f.id} value={f.id}>{f.name}</MenuItem>)}
                                                                            </Select>
                                                                            <IconButton onClick={() => saveEdit(idea)} size="small" sx={{ color: '#81c784' }}>
                                                                                <CheckIcon fontSize="small" />
                                                                            </IconButton>
                                                                        </Box>
                                                                    ) : (
                                                                        <Typography
                                                                            noWrap
                                                                            onClick={beginEdit}
                                                                            sx={{
                                                                                flexGrow: 1, minWidth: 0, fontSize: '0.9rem',
                                                                                fontWeight: 600, color: '#f0e8e8', cursor: 'pointer',
                                                                                '&:hover': { color: '#90b4e8' }, transition: 'color 0.15s',
                                                                            }}
                                                                        >
                                                                            {idea.title || 'Untitled'}
                                                                        </Typography>
                                                                    )}

                                                                    {reorderMode && (
                                                                        <Tooltip title="Reorder, or drag onto a folder to move it there">
                                                                            <IconButton
                                                                                size="small"
                                                                                onPointerDown={e => { if (!isEditing) startIdeaDrag(e, idea, ideaIndex); }}
                                                                                onPointerMove={moveIdeaDrag}
                                                                                onPointerUp={endIdeaDrag}
                                                                                onPointerCancel={() => setIdeaDrag(null)}
                                                                                onClick={e => e.stopPropagation()}
                                                                                sx={{
                                                                                    color: '#4a5568', p: 0.75, touchAction: 'none',
                                                                                    cursor: ideaDrag?.isDragging ? 'grabbing' : 'grab',
                                                                                    '&:hover': { color: '#90b4e8' },
                                                                                }}
                                                                            >
                                                                                <DragIndicatorIcon sx={{ fontSize: 20 }} />
                                                                            </IconButton>
                                                                        </Tooltip>
                                                                    )}
                                                                    <IconButton
                                                                        size="small" className="ideaActions"
                                                                        onClick={e => { e.stopPropagation(); setIdeaMenu({ el: e.currentTarget, idea }); }}
                                                                        sx={{
                                                                            color: '#4a5568', p: 0.75, opacity: { xs: 1, lg: 0 },
                                                                            transition: 'opacity 0.15s', '&:hover': { color: '#f0e8e8' },
                                                                        }}
                                                                    >
                                                                        <MoreVertIcon sx={{ fontSize: 22 }} />
                                                                    </IconButton>
                                                                </Box>
                                                            );
                                                        })}

                                                        {/* Ghost row: add an idea to this folder */}
                                                        <Box onClick={() => openNewIdea(folder.id)} sx={{ ...ghostRowSx, mb: 0.5 }}>
                                                            <LightbulbOutlinedIcon sx={{ fontSize: 16 }} />
                                                            <Typography sx={{ fontSize: '0.78rem' }}>Add idea</Typography>
                                                        </Box>
                                                    </>
                                                )}
                                            </Box>
                                        </Collapse>
                                    </Box>
                                );
                            })}

                            {/* Ghost row: new folder */}
                            <Box
                                onClick={() => { setFolderDialog({ mode: 'new' }); setFolderNameInput(''); }}
                                sx={{ ...ghostRowSx, mt: folders.length ? 1.5 : 0, py: 1.25 }}
                            >
                                <AddIcon sx={{ fontSize: 18 }} />
                                <Typography sx={{ fontSize: '0.82rem', fontWeight: 600 }}>New folder</Typography>
                            </Box>

                            {folders.length === 0 && (
                                <Typography sx={{ color: '#4a5568', fontSize: '0.82rem', textAlign: 'center', mt: 2 }}>
                                    Create a folder to start adding ideas.
                                </Typography>
                            )}
                        </Box>
                    )}
                </Box>
            </Box>

            {/* Folder menu */}
            <Menu
                anchorEl={folderMenu?.el ?? null} open={folderMenu !== null}
                onClose={() => setFolderMenu(null)} slotProps={{ paper: menuPaperSx }}
            >
                <MenuItem onClick={() => { if (folderMenu) openNewIdea(folderMenu.folder.id); setFolderMenu(null); }}>
                    <ListItemIcon><LightbulbOutlinedIcon fontSize="small" /></ListItemIcon>
                    <ListItemText>Add idea</ListItemText>
                </MenuItem>
                <MenuItem onClick={() => {
                    if (folderMenu) { setFolderDialog({ mode: 'rename', folder: folderMenu.folder }); setFolderNameInput(folderMenu.folder.name); }
                    setFolderMenu(null);
                }}>
                    <ListItemIcon><EditOutlinedIcon fontSize="small" /></ListItemIcon>
                    <ListItemText>Rename</ListItemText>
                </MenuItem>
                <MenuItem onClick={() => { const f = folderMenu?.folder; setFolderMenu(null); if (f) deleteFolder(f); }}>
                    <ListItemIcon><DeleteOutlineIcon fontSize="small" sx={{ color: '#e57373' }} /></ListItemIcon>
                    <ListItemText sx={{ color: '#e57373' }}>Delete folder</ListItemText>
                </MenuItem>
            </Menu>

            {/* Idea menu */}
            <Menu
                anchorEl={ideaMenu?.el ?? null} open={ideaMenu !== null}
                onClose={() => setIdeaMenu(null)} slotProps={{ paper: menuPaperSx }}
            >
                <MenuItem onClick={() => {
                    if (ideaMenu) { setEditingId(ideaMenu.idea.id); setDraftTitle(ideaMenu.idea.title); setDraftFolderId(ideaMenu.idea.folder_id); }
                    setIdeaMenu(null);
                }}>
                    <ListItemIcon><EditOutlinedIcon fontSize="small" /></ListItemIcon>
                    <ListItemText>Rename or move</ListItemText>
                </MenuItem>
                <MenuItem onClick={() => { const i = ideaMenu?.idea; setIdeaMenu(null); if (i) removeIdea(i); }}>
                    <ListItemIcon><DeleteOutlineIcon fontSize="small" sx={{ color: '#e57373' }} /></ListItemIcon>
                    <ListItemText sx={{ color: '#e57373' }}>Delete idea</ListItemText>
                </MenuItem>
            </Menu>

            {/* New / rename folder */}
            <Dialog
                open={folderDialog !== null} onClose={() => setFolderDialog(null)} fullWidth maxWidth="xs"
                PaperProps={dialogPaperSx}
            >
                <DialogTitle sx={{ fontSize: '1.05rem', fontWeight: 700 }}>
                    {folderDialog?.mode === 'rename' ? 'Rename folder' : 'New folder'}
                </DialogTitle>
                <DialogContent>
                    <TextField
                        value={folderNameInput} onChange={e => setFolderNameInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') submitFolderDialog(); }}
                        placeholder="Folder name" fullWidth autoFocus sx={{ mt: 1, ...fieldSx }}
                    />
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button onClick={() => setFolderDialog(null)} sx={{ textTransform: 'none', color: '#718096' }}>Cancel</Button>
                    <Button onClick={submitFolderDialog} disabled={!folderNameInput.trim()} sx={primaryButtonSx}>
                        {folderDialog?.mode === 'rename' ? 'Rename' : 'Create'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* New idea */}
            <Dialog
                open={ideaDialogFolder !== null} onClose={() => setIdeaDialogFolder(null)} fullWidth maxWidth="xs"
                PaperProps={dialogPaperSx}
            >
                <DialogTitle sx={{ fontSize: '1.05rem', fontWeight: 700 }}>New idea</DialogTitle>
                <DialogContent>
                    <TextField
                        value={ideaTitleInput} onChange={e => setIdeaTitleInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') submitIdeaDialog(); }}
                        placeholder="Idea" fullWidth autoFocus sx={{ mt: 1, ...fieldSx }}
                    />
                    <Typography sx={{ fontSize: '0.72rem', color: '#718096', mt: 1.5 }}>
                        Adding to {folders.find(f => f.id === ideaDialogFolder)?.name ?? 'this folder'}.
                    </Typography>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button onClick={() => setIdeaDialogFolder(null)} sx={{ textTransform: 'none', color: '#718096' }}>Cancel</Button>
                    <Button onClick={submitIdeaDialog} disabled={!ideaTitleInput.trim()} sx={primaryButtonSx}>Create</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
