'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Box, Typography, Button, IconButton, Slider, TextField, Tooltip, LinearProgress,
    Checkbox, FormControlLabel, Dialog, DialogTitle, DialogContent, DialogActions,
    Collapse, Select, MenuItem, FormControl, InputLabel, Menu, ListItemIcon, ListItemText,
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import SkipPreviousIcon from '@mui/icons-material/SkipPrevious';
import Replay10Icon from '@mui/icons-material/Replay10';
import Forward10Icon from '@mui/icons-material/Forward10';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import VolumeOffIcon from '@mui/icons-material/VolumeOff';
import MusicNoteIcon from '@mui/icons-material/MusicNote';
import CheckIcon from '@mui/icons-material/Check';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import HourglassTopIcon from '@mui/icons-material/HourglassTop';
import FolderIcon from '@mui/icons-material/Folder';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import AddIcon from '@mui/icons-material/Add';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import ShuffleIcon from '@mui/icons-material/Shuffle';
import RepeatOneIcon from '@mui/icons-material/RepeatOne';
import QueueMusicIcon from '@mui/icons-material/QueueMusic';
import PlaylistPlayIcon from '@mui/icons-material/PlaylistPlay';
import CloseIcon from '@mui/icons-material/Close';
import { derive_key } from '@/context/Encrypt';
import { encryptFile, sealText, openText, VERIFIER_PLAINTEXT } from '@/lib/audioCrypto';
import { saveKey, loadKey, clearKey } from '@/lib/keyStore';
import { useAudioPlayer } from '@/context/AudioPlayerContext';
import type { RawFolder, Folder, RawTrack, Track } from './types';

type Staged = { file: File; title: string; folderId: number | '' };
type Upload = { title: string; pct: number; phase: 'encrypting' | 'uploading'; error?: string };
type FolderDialog = { mode: 'new' } | { mode: 'rename'; folder: Folder } | null;

type FolderDrag = { id: number; originalIndex: number; deltaY: number; isDragging: boolean };
type TrackDrag = { track: Track; originalIndex: number; deltaY: number; isDragging: boolean };

const FOLDER_ROW_HEIGHT = 46;
const TRACK_ROW_HEIGHT = 48;
const SIDEBAR_WIDTH = 320;
const TOPBAR_OFFSET = 88;

const EXT_MIME: Record<string, string> = {
    mp3: 'audio/mpeg', m4a: 'audio/mp4', aac: 'audio/aac', flac: 'audio/flac',
    ogg: 'audio/ogg', oga: 'audio/ogg', opus: 'audio/opus', wav: 'audio/wav', webm: 'audio/webm',
};

function moveItem<T>(arr: T[], from: number, to: number): T[] {
    const result = [...arr];
    const [item] = result.splice(from, 1);
    result.splice(to, 0, item);
    return result;
}

function guessMime(file: File): string {
    if (file.type && file.type.startsWith('audio/')) return file.type;
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    return EXT_MIME[ext] ?? 'application/octet-stream';
}

/** Only ever a suggested default — what gets stored is whatever you type. */
function titleFromFilename(name: string): string {
    return name.replace(/\.[^.]+$/, '').replace(/[_]+/g, ' ').trim() || 'Untitled';
}

function formatTime(seconds: number | null): string {
    if (seconds == null || !Number.isFinite(seconds)) return '--:--';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
}

function probeDuration(file: File): Promise<number | null> {
    return new Promise(resolve => {
        const url = URL.createObjectURL(file);
        const el = document.createElement('audio');
        el.preload = 'metadata';
        const done = (v: number | null) => { URL.revokeObjectURL(url); resolve(v); };
        el.onloadedmetadata = () => done(Number.isFinite(el.duration) ? el.duration : null);
        el.onerror = () => done(null);
        el.src = url;
    });
}

/** XHR rather than fetch — fetch has no upload-progress events. */
function putWithProgress(
    url: string, body: Blob, contentType: string, onProgress: (pct: number) => void
): Promise<void> {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', url);
        xhr.setRequestHeader('Content-Type', contentType);
        xhr.upload.onprogress = e => {
            if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
        };
        xhr.onload = () => xhr.status >= 200 && xhr.status < 300
            ? resolve() : reject(new Error(`R2 rejected the upload (${xhr.status})`));
        xhr.onerror = () => reject(new Error('Network error during upload'));
        xhr.send(body);
    });
}

export function AudioClient() {
    const audioPlayer = useAudioPlayer();
    // Key state. Lives here and, if remembered, in IndexedDB. Never on the server.
    const [key, setKey] = useState<CryptoKey | null>(null);
    const [salt, setSalt] = useState<string | null>(null);
    const [needsSetup, setNeedsSetup] = useState(false);
    const [verifier, setVerifier] = useState<string | null>(null);
    const [passphrase, setPassphrase] = useState('');
    const [confirmPass, setConfirmPass] = useState('');
    const [unlocking, setUnlocking] = useState(false);
    const [unlockError, setUnlockError] = useState<string | null>(null);
    const [remember, setRemember] = useState(true);
    const [restoring, setRestoring] = useState(true);

    // Library
    const [folders, setFolders] = useState<Folder[]>([]);
    const [tracksByFolder, setTracksByFolder] = useState<Record<number, Track[]>>({});
    const [collapsed, setCollapsed] = useState<Record<number, boolean>>({});
    const [loadedFolders, setLoadedFolders] = useState<Set<number>>(new Set());
    const [loadingLibrary, setLoadingLibrary] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Drag
    const [folderDrag, setFolderDrag] = useState<FolderDrag | null>(null);
    const [trackDrag, setTrackDrag] = useState<TrackDrag | null>(null);
    const folderDragStartY = useRef(0);
    const trackDragStartY = useRef(0);
    const [dropTarget, setDropTarget] = useState<number | null>(null); // OS file drop

    // Menus (replaces always-visible icon buttons)
    const [folderMenu, setFolderMenu] = useState<{ el: HTMLElement; folder: Folder } | null>(null);
    const [trackMenu, setTrackMenu] = useState<{ el: HTMLElement; track: Track } | null>(null);

    // Dialogs
    const [folderDialog, setFolderDialog] = useState<FolderDialog>(null);
    const [folderNameInput, setFolderNameInput] = useState('');
    const [staged, setStaged] = useState<Staged[] | null>(null);
    const [uploads, setUploads] = useState<Upload[]>([]);

    const {
        currentTrack, currentFolderId, isPlaying, position, duration, volume, muted, loadingTrack,
        playerError, queue, shuffle, repeatOne, play, playFromQueue, step, nudge, togglePlay,
        stopPlayback, previewSeek, commitSeek, setVolume, setMuted, toggleShuffle, toggleRepeatOne,
        addToQueue, playNext, removeFromQueue, retagFolder, syncQueue,
    } = audioPlayer;

    const [editingId, setEditingId] = useState<number | null>(null);
    const [draftTitle, setDraftTitle] = useState('');
    const [draftFolderId, setDraftFolderId] = useState<number | ''>('');
    const [queueOpen, setQueueOpen] = useState(false);

    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const uploadTargetRef = useRef<number | ''>('');

    const currentFolder = folders.find(f => f.id === currentFolderId) ?? null;
    const upNext = useMemo(() => {
        if (!currentTrack) return [];
        const i = queue.findIndex(t => t.id === currentTrack.id);
        return i === -1 ? [] : queue.slice(i + 1);
    }, [queue, currentTrack]);

    // Keeps every loaded folder's slice of the queue (and the current track's live
    // title) in sync with library edits — reorders, renames, moves, deletes.
    useEffect(() => {
        for (const [folderIdStr, list] of Object.entries(tracksByFolder)) {
            syncQueue(Number(folderIdStr), list);
        }
    }, [tracksByFolder, syncQueue]);

    // ── loading ──────────────────────────────────────────────────────────────────

    const loadFolders = useCallback(async (k: CryptoKey) => {
        const res = await fetch('/api/audio/folders');
        if (!res.ok) throw new Error((await res.json()).error ?? 'Failed to load folders');
        const rows: RawFolder[] = (await res.json()).folders;
        const opened: Folder[] = await Promise.all(rows.map(async ({ name_enc, ...rest }) => ({
            ...rest,
            name: (await openText(k, name_enc)) || '(undecryptable)',
        })));
        setFolders(opened);
        setCollapsed(prev => {
            const next = { ...prev };
            for (const f of opened) if (!(f.id in next)) next[f.id] = true;
            return next;
        });
        return opened;
    }, []);

    const loadFolderTracks = useCallback(async (folderId: number, k: CryptoKey) => {
        try {
            const res = await fetch(`/api/audio?folder_id=${folderId}`);
            if (!res.ok) throw new Error((await res.json()).error ?? 'Failed to load songs');
            const rows: RawTrack[] = (await res.json()).tracks;
            const opened: Track[] = await Promise.all(rows.map(async ({ title_enc, ...rest }) => ({
                ...rest,
                title: (await openText(k, title_enc)) || '(undecryptable)',
            })));
            setTracksByFolder(prev => ({ ...prev, [folderId]: opened }));
            setLoadedFolders(prev => new Set(prev).add(folderId));
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to load songs');
        }
    }, []);

    const initLibrary = useCallback(async (k: CryptoKey) => {
        setLoadingLibrary(true);
        try {
            await loadFolders(k);
            setError(null);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to load library');
        } finally {
            setLoadingLibrary(false);
        }
    }, [loadFolders]);

    useEffect(() => {
        (async () => {
            try {
                const res = await fetch('/api/audio/keyinfo');
                if (!res.ok) throw new Error((await res.json()).error ?? 'Could not load key info');
                const info = await res.json();
                setSalt(info.salt);
                setVerifier(info.verifier);
                setNeedsSetup(info.verifier === null);
                if (!info.verifier) return;

                const stored = await loadKey();
                if (!stored) return;

                // Validate a restored key against the server verifier before trusting it.
                if (await openText(stored, info.verifier) === VERIFIER_PLAINTEXT) {
                    setKey(stored);
                    audioPlayer.setKey(stored);
                    await initLibrary(stored);
                } else {
                    await clearKey();
                }
            } catch (e) {
                setUnlockError(e instanceof Error ? e.message : 'Could not load key info');
            } finally {
                setRestoring(false);
            }
        })();
    }, [initLibrary]);

    async function handleUnlock() {
        if (!salt) return;
        if (passphrase.length < 8) { setUnlockError('Use at least 8 characters.'); return; }
        if (needsSetup && passphrase !== confirmPass) { setUnlockError('Passphrases do not match.'); return; }

        setUnlocking(true);
        setUnlockError(null);
        try {
            const k = await derive_key(passphrase, salt);
            if (needsSetup) {
                const sealed = await sealText(k, VERIFIER_PLAINTEXT);
                const res = await fetch('/api/audio/keyinfo', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ verifier: sealed }),
                });
                if (!res.ok) throw new Error((await res.json()).error ?? 'Could not save passphrase');
                setVerifier(sealed);
                setNeedsSetup(false);
            } else if (await openText(k, verifier) !== VERIFIER_PLAINTEXT) {
                setUnlockError('Wrong passphrase.');
                setUnlocking(false);
                return;
            }

            if (remember) await saveKey(k);
            setKey(k);
            audioPlayer.setKey(k);
            setPassphrase('');
            setConfirmPass('');
            await initLibrary(k);
        } catch (e) {
            setUnlockError(e instanceof Error ? e.message : 'Unlock failed');
        } finally {
            setUnlocking(false);
        }
    }

    // ── folders ──────────────────────────────────────────────────────────────────

    const toggleFolder = useCallback((folderId: number) => {
        if (!key) return;
        setCollapsed(prev => {
            const nowCollapsed = !prev[folderId];
            if (!nowCollapsed && !loadedFolders.has(folderId)) loadFolderTracks(folderId, key);
            return { ...prev, [folderId]: nowCollapsed };
        });
    }, [key, loadedFolders, loadFolderTracks]);

    async function submitFolderDialog() {
        if (!key || !folderDialog) return;
        const name = folderNameInput.trim();
        if (!name) return;
        try {
            const name_enc = await sealText(key, name);
            const res = folderDialog.mode === 'new'
                ? await fetch('/api/audio/folders', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name_enc }),
                })
                : await fetch(`/api/audio/folders/${folderDialog.folder.id}`, {
                    method: 'PUT', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name_enc }),
                });
            if (!res.ok) throw new Error((await res.json()).error ?? 'Folder operation failed');
            setFolderDialog(null);
            setFolderNameInput('');
            await loadFolders(key);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Folder operation failed');
        }
    }

    async function deleteFolder(folder: Folder) {
        const n = folder.track_count;
        const warning = n > 0
            ? `Delete "${folder.name}" and its ${n} song${n === 1 ? '' : 's'}? The files are permanently removed from storage.`
            : `Delete the empty folder "${folder.name}"?`;
        if (!window.confirm(warning)) return;

        const res = await fetch(`/api/audio/folders/${folder.id}`, { method: 'DELETE' });
        if (!res.ok) { setError('Could not delete folder'); return; }
        if (currentFolderId === folder.id) stopPlayback();
        setTracksByFolder(prev => { const next = { ...prev }; delete next[folder.id]; return next; });
        setLoadedFolders(prev => { const next = new Set(prev); next.delete(folder.id); return next; });
        if (key) await loadFolders(key);
    }

    // ── drag: folders ────────────────────────────────────────────────────────────

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
        await fetch('/api/audio/folders', {
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

    // ── drag: songs (reorder within a folder, or drop onto another folder) ───────

    const startTrackDrag = (e: React.PointerEvent, track: Track, index: number) => {
        e.stopPropagation();
        e.currentTarget.setPointerCapture(e.pointerId);
        trackDragStartY.current = e.clientY;
        setTrackDrag({ track, originalIndex: index, deltaY: 0, isDragging: false });
    };

    const moveTrackDrag = (e: React.PointerEvent) => {
        if (!trackDrag) return;
        const deltaY = e.clientY - trackDragStartY.current;
        setTrackDrag(prev => prev ? { ...prev, deltaY, isDragging: prev.isDragging || Math.abs(deltaY) > 4 } : null);
    };

    const endTrackDrag = async (e: React.PointerEvent) => {
        if (!trackDrag || !key) return;
        if (!trackDrag.isDragging) { setTrackDrag(null); return; }

        // Live pointer coords, not stale state — the drop target is geometric.
        const overFolder = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-folder-id]');
        const targetId = overFolder?.getAttribute('data-folder-id');
        const targetFolderId = targetId ? parseInt(targetId, 10) : null;

        const sourceFolderId = trackDrag.track.folder_id;
        const sourceTracks = tracksByFolder[sourceFolderId] ?? [];
        const dragged = trackDrag.track;
        setTrackDrag(null);

        if (targetFolderId !== null && targetFolderId !== sourceFolderId) {
            await fetch('/api/audio', {
                method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ updates: [{ id: dragged.id, folder_id: targetFolderId, sort_order: 0 }] }),
            });
            setCollapsed(prev => ({ ...prev, [targetFolderId]: false }));
            await loadFolders(key);
            await loadFolderTracks(sourceFolderId, key);
            await loadFolderTracks(targetFolderId, key);
            if (currentTrack?.id === dragged.id) retagFolder(targetFolderId);
            return;
        }

        const toIdx = Math.max(0, Math.min(sourceTracks.length - 1,
            trackDrag.originalIndex + Math.round(trackDrag.deltaY / TRACK_ROW_HEIGHT)));
        if (toIdx === trackDrag.originalIndex) return;

        const withOrder = moveItem(sourceTracks, trackDrag.originalIndex, toIdx)
            .map((t, i) => ({ ...t, sort_order: i }));
        setTracksByFolder(prev => ({ ...prev, [sourceFolderId]: withOrder }));
        await fetch('/api/audio', {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ updates: withOrder.map(t => ({ id: t.id, sort_order: t.sort_order })) }),
        });
    };

    const displayedTracks = (folderId: number): Track[] => {
        const list = tracksByFolder[folderId] ?? [];
        if (!trackDrag?.isDragging || trackDrag.track.folder_id !== folderId) return list;
        const toIdx = Math.max(0, Math.min(list.length - 1,
            trackDrag.originalIndex + Math.round(trackDrag.deltaY / TRACK_ROW_HEIGHT)));
        return moveItem(list, trackDrag.originalIndex, toIdx);
    };

    // ── upload ───────────────────────────────────────────────────────────────────

    /** Starts (or resumes) a track, handing the provider this folder's current order for next/previous. */
    function playTrack(track: Track) {
        play(track, tracksByFolder[track.folder_id] ?? []);
    }

    function openPicker(folderId: number | '') {
        uploadTargetRef.current = folderId;
        fileInputRef.current?.click();
    }

    const stageFiles = useCallback((files: File[], folderId: number | '') => {
        const audio = files.filter(f => f.type.startsWith('audio/') || /\.(mp3|flac|m4a|ogg|oga|opus|wav|webm|aac)$/i.test(f.name));
        if (audio.length === 0) { setError('No audio files in that drop.'); return; }
        setStaged(audio.map(file => ({ file, title: titleFromFilename(file.name), folderId })));
    }, []);

    async function uploadStaged() {
        if (!key || !staged) return;
        const items = staged.filter(s => s.title.trim().length > 0 && s.folderId !== '');
        setStaged(null);
        if (items.length === 0) return;

        setUploads(items.map(s => ({ title: s.title, pct: 0, phase: 'encrypting' as const })));
        const touched = new Set<number>();

        for (let i = 0; i < items.length; i++) {
            const { file, title, folderId } = items[i];
            const bump = (patch: Partial<Upload>) =>
                setUploads(prev => prev.map((u, j) => (j === i ? { ...u, ...patch } : u)));
            try {
                const contentType = guessMime(file);
                const seconds = await probeDuration(file);

                // Encrypt first: the plaintext never leaves this function.
                const sealedBlob = await encryptFile(file, key, f =>
                    bump({ phase: 'encrypting', pct: Math.round(f * 100) }));

                const signRes = await fetch('/api/audio/upload-url', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        content_type: contentType,
                        size_bytes: sealedBlob.size,
                        duration_seconds: seconds,
                        title_enc: await sealText(key, title.trim()),
                        folder_id: folderId,
                    }),
                });
                if (!signRes.ok) throw new Error((await signRes.json()).error ?? 'Could not sign upload');
                const { upload_url, track_id, content_type } = await signRes.json();

                bump({ phase: 'uploading', pct: 0 });
                await putWithProgress(upload_url, sealedBlob, content_type, pct => bump({ phase: 'uploading', pct }));

                const doneRes = await fetch(`/api/audio/${track_id}/complete`, { method: 'POST' });
                if (!doneRes.ok) throw new Error('Upload finished but could not be confirmed');
                bump({ pct: 100 });
                touched.add(folderId as number);
            } catch (e) {
                bump({ error: e instanceof Error ? e.message : 'Upload failed' });
            }
        }

        await loadFolders(key);
        // Array.from because the tsconfig target predates Set iteration.
        for (const folderId of Array.from(touched)) {
            setCollapsed(prev => ({ ...prev, [folderId]: false }));
            await loadFolderTracks(folderId, key);
        }
        setUploads(prev => prev.filter(u => u.error));
    }

    // ── track edit / delete ──────────────────────────────────────────────────────

    async function saveEdit(track: Track) {
        if (!key) return;
        const name = draftTitle.trim() || 'Untitled';
        const movingTo = draftFolderId === '' || draftFolderId === track.folder_id ? null : draftFolderId;

        const res = await fetch(`/api/audio/${track.id}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title_enc: await sealText(key, name), folder_id: movingTo }),
        });
        if (!res.ok) { setError('Could not save changes'); return; }

        setEditingId(null);
        if (movingTo != null) {
            await loadFolders(key);
            await loadFolderTracks(track.folder_id, key);
            if (loadedFolders.has(movingTo)) await loadFolderTracks(movingTo, key);
            if (currentTrack?.id === track.id) retagFolder(movingTo);
        } else {
            setTracksByFolder(prev => ({
                ...prev,
                [track.folder_id]: (prev[track.folder_id] ?? []).map(t =>
                    t.id === track.id ? { ...t, title: name } : t),
            }));
        }
    }

    async function removeTrack(track: Track) {
        if (!window.confirm(`Delete "${track.title}"? This removes the file from storage permanently.`)) return;
        const res = await fetch(`/api/audio/${track.id}`, { method: 'DELETE' });
        if (!res.ok) { setError('Could not delete song'); return; }
        if (currentTrack?.id === track.id) stopPlayback();
        setTracksByFolder(prev => ({
            ...prev,
            [track.folder_id]: (prev[track.folder_id] ?? []).filter(t => t.id !== track.id),
        }));
        if (key) await loadFolders(key);
    }

    async function handleLock() {
        stopPlayback();
        audioPlayer.setKey(null);
        await clearKey();
        setKey(null);
        setFolders([]);
        setTracksByFolder({});
        setLoadedFolders(new Set());
        setEditingId(null);
    }

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
    /** Dashed "ghost" row — the creation affordance, distinct from destructive icons. */
    const ghostRowSx = (active: boolean) => ({
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.75,
        px: 1.5, py: 1, borderRadius: 1.5, cursor: 'pointer',
        border: '1px dashed', borderColor: active ? '#90b4e8' : '#3a4255',
        backgroundColor: active ? '#1e2d46' : 'transparent',
        color: active ? '#90b4e8' : '#4a5568',
        transition: 'color 0.15s, border-color 0.15s, background-color 0.15s',
        '&:hover': { borderColor: '#90b4e8', color: '#90b4e8' },
    });

    // ── player (shared between sidebar and mobile bar) ───────────────────────────

    const seekBar = (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography sx={{ fontSize: '0.68rem', color: '#718096', fontVariantNumeric: 'tabular-nums', minWidth: 32 }}>
                {formatTime(position)}
            </Typography>
            <Slider
                value={position} max={duration || 1} disabled={!currentTrack}
                onChange={(_, v) => previewSeek(v as number)}
                onChangeCommitted={(_, v) => commitSeek(v as number)}
                sx={{
                    color: '#64b5f6', py: 1,
                    '& .MuiSlider-thumb': { width: 10, height: 10 },
                    '& .MuiSlider-rail': { color: '#4a5568' },
                }}
            />
            <Typography sx={{ fontSize: '0.68rem', color: '#718096', fontVariantNumeric: 'tabular-nums', minWidth: 32 }}>
                {formatTime(duration || (currentTrack?.duration_seconds ?? null))}
            </Typography>
        </Box>
    );

    const toggleIconSx = (active: boolean) => ({
        color: active ? '#90b4e8' : '#4a5568',
        '&:hover': { color: '#90b4e8' },
        '&.Mui-disabled': { color: '#2d3748' },
    });

    const transportButtons = (big: boolean) => (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: big ? 0.5 : 0 }}>
            <Tooltip title={shuffle ? 'Shuffle on' : 'Shuffle off'}>
                <IconButton onClick={toggleShuffle} disabled={!currentTrack} size="small" sx={toggleIconSx(shuffle)}>
                    <ShuffleIcon fontSize="small" />
                </IconButton>
            </Tooltip>
            <Tooltip title="Previous">
                <IconButton onClick={() => step(-1)} disabled={!currentTrack}
                    sx={{ color: '#90b4e8', '&.Mui-disabled': { color: '#3a4255' } }}>
                    <SkipPreviousIcon />
                </IconButton>
            </Tooltip>
            <Tooltip title="Back 10s">
                <IconButton onClick={() => nudge(-10)} disabled={!currentTrack}
                    sx={{ color: '#718096', '&.Mui-disabled': { color: '#3a4255' } }}>
                    <Replay10Icon fontSize={big ? 'medium' : 'small'} />
                </IconButton>
            </Tooltip>
            <IconButton
                onClick={togglePlay} disabled={!currentTrack || !!loadingTrack}
                sx={{
                    mx: 0.5, color: '#1e2535', backgroundColor: '#90b4e8',
                    width: big ? 52 : 40, height: big ? 52 : 40,
                    '&:hover': { backgroundColor: '#64b5f6' },
                    '&.Mui-disabled': { backgroundColor: '#2d3748', color: '#4a5568' },
                }}
            >
                {isPlaying ? <PauseIcon fontSize={big ? 'large' : 'medium'} /> : <PlayArrowIcon fontSize={big ? 'large' : 'medium'} />}
            </IconButton>
            <Tooltip title="Forward 10s">
                <IconButton onClick={() => nudge(10)} disabled={!currentTrack}
                    sx={{ color: '#718096', '&.Mui-disabled': { color: '#3a4255' } }}>
                    <Forward10Icon fontSize={big ? 'medium' : 'small'} />
                </IconButton>
            </Tooltip>
            <Tooltip title="Next">
                <IconButton onClick={() => step(1)} disabled={!currentTrack}
                    sx={{ color: '#90b4e8', '&.Mui-disabled': { color: '#3a4255' } }}>
                    <SkipNextIcon />
                </IconButton>
            </Tooltip>
            <Tooltip title={repeatOne ? 'Repeat: this song' : 'Repeat: off'}>
                <IconButton onClick={toggleRepeatOne} disabled={!currentTrack} size="small" sx={toggleIconSx(repeatOne)}>
                    <RepeatOneIcon fontSize="small" />
                </IconButton>
            </Tooltip>
            <Tooltip title="Queue">
                <IconButton onClick={() => setQueueOpen(true)} disabled={!currentTrack} size="small"
                    sx={{ color: '#4a5568', '&:hover': { color: '#90b4e8' }, '&.Mui-disabled': { color: '#2d3748' } }}>
                    <QueueMusicIcon fontSize="small" />
                </IconButton>
            </Tooltip>
        </Box>
    );

    const volumeControl = (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <IconButton size="small" onClick={() => setMuted(!muted)} sx={{ color: '#4a5568', '&:hover': { color: '#90b4e8' } }}>
                {muted || volume === 0 ? <VolumeOffIcon fontSize="small" /> : <VolumeUpIcon fontSize="small" />}
            </IconButton>
            <Slider
                value={muted ? 0 : volume} min={0} max={1} step={0.01}
                onChange={(_, v) => setVolume(v as number)}
                sx={{ color: '#90b4e8', '& .MuiSlider-thumb': { width: 9, height: 9 }, '& .MuiSlider-rail': { color: '#4a5568' } }}
            />
        </Box>
    );

    // ── restoring ────────────────────────────────────────────────────────────────
    if (restoring) {
        return (
            <Box sx={{
                minHeight: `calc(100vh - ${TOPBAR_OFFSET}px)`, backgroundColor: '#1a2030', color: '#4a5568',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
                <Typography sx={{ fontSize: '0.9rem' }}>Unlocking…</Typography>
            </Box>
        );
    }

    // ── lock screen ──────────────────────────────────────────────────────────────
    if (!key) {
        return (
            <Box sx={{
                minHeight: `calc(100vh - ${TOPBAR_OFFSET}px)`, backgroundColor: '#1a2030', color: '#f0e8e8',
                display: 'flex', alignItems: 'flex-start', justifyContent: 'center', px: 2, py: 10,
            }}>
                <Box sx={{ width: '100%', maxWidth: 420, textAlign: 'center' }}>
                    <LockOutlinedIcon sx={{ fontSize: 44, color: '#90b4e8', mb: 1.5 }} />
                    <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
                        {needsSetup ? 'Set an audio passphrase' : 'Unlock your library'}
                    </Typography>
                    <Typography sx={{ color: '#718096', fontSize: '0.85rem', mb: 3 }}>
                        {needsSetup
                            ? 'This encrypts every file before it leaves your browser. It is never sent to the server — if you lose it, your library cannot be recovered.'
                            : 'Your files are decrypted locally. The passphrase never leaves this browser.'}
                    </Typography>
                    <TextField
                        type="password" value={passphrase}
                        onChange={e => setPassphrase(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter' && !needsSetup) handleUnlock(); }}
                        placeholder="Passphrase" fullWidth autoFocus
                        disabled={unlocking || !salt} sx={{ mb: 1.5, ...fieldSx }}
                    />
                    {needsSetup && (
                        <TextField
                            type="password" value={confirmPass}
                            onChange={e => setConfirmPass(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') handleUnlock(); }}
                            placeholder="Confirm passphrase" fullWidth
                            disabled={unlocking} sx={{ mb: 1.5, ...fieldSx }}
                        />
                    )}
                    <FormControlLabel
                        control={<Checkbox checked={remember} onChange={e => setRemember(e.target.checked)}
                            disabled={unlocking} size="small"
                            sx={{ color: '#4a5568', '&.Mui-checked': { color: '#90b4e8' } }} />}
                        label="Remember on this device"
                        sx={{ mb: 1, '& .MuiFormControlLabel-label': { fontSize: '0.8rem', color: '#718096' } }}
                    />
                    {unlockError && (
                        <Typography sx={{ color: '#e57373', fontSize: '0.82rem', mb: 1.5 }}>{unlockError}</Typography>
                    )}
                    <Button
                        onClick={handleUnlock} disabled={unlocking || !salt || !passphrase} fullWidth
                        sx={{
                            textTransform: 'none', fontWeight: 600, py: 1,
                            color: '#1e2535', backgroundColor: '#90b4e8',
                            '&:hover': { backgroundColor: '#64b5f6' },
                            '&.Mui-disabled': { backgroundColor: '#2d3748', color: '#4a5568' },
                        }}
                    >
                        {unlocking ? 'Deriving key…' : needsSetup ? 'Set passphrase' : 'Unlock'}
                    </Button>
                    <Typography sx={{ color: '#4a5568', fontSize: '0.72rem', mt: 2 }}>
                        600,000 PBKDF2 iterations — this takes a moment on purpose.
                    </Typography>
                </Box>
            </Box>
        );
    }

    // ── library + sidebar ────────────────────────────────────────────────────────
    return (
        <Box sx={{ display: 'flex', backgroundColor: '#1a2030', color: '#f0e8e8', minHeight: `calc(100vh - ${TOPBAR_OFFSET}px)` }}>

            {/* Main column */}
            <Box sx={{ flex: 1, minWidth: 0, px: { xs: 2, md: 4 }, py: 4, pb: { xs: 16, lg: 6 } }}>
                <Box sx={{ maxWidth: 760, mx: 'auto' }}>
                    <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 2, mb: 0.5 }}>
                        <Typography variant="h4" sx={{ fontWeight: 700 }}>Audio</Typography>
                        <Button
                            startIcon={<LockOutlinedIcon />} onClick={handleLock} size="small"
                            sx={{
                                textTransform: 'none', fontWeight: 600, color: '#718096',
                                '&:hover': { color: '#90b4e8', backgroundColor: 'transparent' },
                            }}
                        >
                            Lock
                        </Button>
                    </Box>
                    <Typography sx={{ color: '#718096', fontSize: '0.85rem', mb: 3 }}>
                        End-to-end encrypted. Song and folder names are stored only as ciphertext.
                    </Typography>

                    <input
                        ref={fileInputRef} type="file"
                        accept="audio/*,.mp3,.flac,.m4a,.ogg,.opus,.wav"
                        multiple hidden
                        onChange={e => {
                            if (e.target.files?.length) stageFiles(Array.from(e.target.files), uploadTargetRef.current || (folders[0]?.id ?? ''));
                            e.target.value = '';
                        }}
                    />

                    {(error || playerError) && (
                        <Box sx={{ mb: 2, p: 1.5, borderRadius: 1, backgroundColor: '#2d2130', border: '1px solid #e57373' }}>
                            <Typography sx={{ color: '#e57373', fontSize: '0.85rem' }}>{error || playerError}</Typography>
                        </Box>
                    )}

                    {uploads.map((u, i) => (
                        <Box key={`${u.title}-${i}`} sx={{ mb: 1.5, p: 1.5, borderRadius: 1, backgroundColor: '#1e2535' }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
                                <Typography noWrap sx={{ fontSize: '0.85rem', mb: 0.5 }}>{u.title}</Typography>
                                {!u.error && (
                                    <Typography sx={{ fontSize: '0.72rem', color: '#718096', flexShrink: 0 }}>
                                        {u.phase} {u.pct}%
                                    </Typography>
                                )}
                            </Box>
                            {u.error
                                ? <Typography sx={{ color: '#e57373', fontSize: '0.78rem' }}>{u.error}</Typography>
                                : <LinearProgress variant="determinate" value={u.pct}
                                    sx={{
                                        height: 4, borderRadius: 2, backgroundColor: '#2d3748',
                                        '& .MuiLinearProgress-bar': { backgroundColor: u.phase === 'encrypting' ? '#ffb74d' : '#64b5f6' },
                                    }} />}
                        </Box>
                    ))}

                    {loadingLibrary ? (
                        <Typography sx={{ color: '#4a5568' }}>Decrypting library…</Typography>
                    ) : (
                        <Box>
                            {displayedFolders.map((folder, folderIndex) => {
                                const isExpanded = !collapsed[folder.id];
                                const beingDragged = folderDrag?.id === folder.id && folderDrag.isDragging;
                                const trackHovering = trackDrag?.isDragging && trackDrag.track.folder_id !== folder.id;
                                const fileHovering = dropTarget === folder.id;
                                const list = displayedTracks(folder.id);

                                return (
                                    <Box
                                        key={folder.id} data-folder-id={folder.id} sx={{ mb: 0.75 }}
                                        onDragOver={e => { e.preventDefault(); setDropTarget(folder.id); }}
                                        onDragLeave={() => setDropTarget(prev => (prev === folder.id ? null : prev))}
                                        onDrop={e => {
                                            e.preventDefault();
                                            setDropTarget(null);
                                            if (e.dataTransfer?.files?.length) stageFiles(Array.from(e.dataTransfer.files), folder.id);
                                        }}
                                    >
                                        {/* Folder header */}
                                        <Box sx={{
                                            display: 'flex', alignItems: 'center', gap: 0.5,
                                            px: 1, py: 0.75, borderRadius: 2, minHeight: FOLDER_ROW_HEIGHT,
                                            backgroundColor: trackHovering || fileHovering ? '#2a3550' : beingDragged ? '#1a2030' : '#252f42',
                                            border: '1px solid',
                                            borderColor: trackHovering || fileHovering ? '#90b4e8' : beingDragged ? '#64b5f6' : '#3a4255',
                                            opacity: beingDragged ? 0.5 : 1,
                                            transition: folderDrag?.isDragging ? 'none' : 'background-color 0.15s, border-color 0.15s',
                                            userSelect: 'none',
                                            '&:hover .rowActions': { opacity: 1 },
                                        }}>
                                            <IconButton
                                                size="small"
                                                onPointerDown={e => startFolderDrag(e, folder.id, folderIndex)}
                                                onPointerMove={moveFolderDrag}
                                                onPointerUp={endFolderDrag}
                                                onPointerCancel={() => setFolderDrag(null)}
                                                className="rowActions"
                                                sx={{
                                                    color: '#4a5568', p: 0.25, opacity: 0, touchAction: 'none',
                                                    cursor: folderDrag?.isDragging ? 'grabbing' : 'grab',
                                                    transition: 'opacity 0.15s', '&:hover': { color: '#90b4e8' },
                                                }}
                                            >
                                                <DragIndicatorIcon sx={{ fontSize: 18 }} />
                                            </IconButton>

                                            <IconButton size="small" onClick={() => toggleFolder(folder.id)} sx={{ color: '#90b4e8', p: 0.25 }}>
                                                {isExpanded ? <ExpandMoreIcon sx={{ fontSize: 20 }} /> : <ChevronRightIcon sx={{ fontSize: 20 }} />}
                                            </IconButton>
                                            <FolderIcon sx={{ color: '#90b4e8', fontSize: 18, flexShrink: 0 }} />
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
                                                    {folder.track_count}
                                                </Typography>
                                            </Typography>

                                            <IconButton
                                                size="small" className="rowActions"
                                                onClick={e => setFolderMenu({ el: e.currentTarget, folder })}
                                                sx={{ color: '#4a5568', opacity: 0, transition: 'opacity 0.15s', '&:hover': { color: '#f0e8e8' } }}
                                            >
                                                <MoreVertIcon sx={{ fontSize: 18 }} />
                                            </IconButton>
                                        </Box>

                                        {/* Songs */}
                                        <Collapse in={isExpanded} timeout={180}>
                                            <Box sx={{ pl: { xs: 1.5, sm: 4 }, pr: 0.5, pt: 0.5 }}>
                                                {!loadedFolders.has(folder.id) ? (
                                                    <Typography sx={{ color: '#4a5568', fontSize: '0.8rem', py: 1 }}>Loading…</Typography>
                                                ) : (
                                                    <>
                                                        {list.map((t, trackIndex) => {
                                                            const active = t.id === currentTrack?.id;
                                                            const busy = loadingTrack?.id === t.id;
                                                            const isEditing = editingId === t.id;
                                                            const dragging = trackDrag?.track.id === t.id && trackDrag.isDragging;
                                                            return (
                                                                <Box key={t.id}>
                                                                    <Box sx={{
                                                                        display: 'flex', alignItems: 'center', gap: 0.5,
                                                                        px: 0.75, py: 0.5, mb: 0.5, borderRadius: 1.5,
                                                                        minHeight: TRACK_ROW_HEIGHT,
                                                                        backgroundColor: active ? '#252f42' : '#1e2535',
                                                                        border: '1px solid',
                                                                        borderColor: dragging ? '#64b5f6' : active ? '#3d5280' : isEditing ? '#90b4e8' : '#2d3748',
                                                                        opacity: dragging ? 0.4 : 1,
                                                                        transition: trackDrag?.isDragging ? 'none' : 'opacity 0.15s, border-color 0.15s',
                                                                        '&:hover .trackActions': { opacity: 1 },
                                                                    }}>
                                                                        <IconButton
                                                                            size="small" className="trackActions"
                                                                            onPointerDown={e => { if (!isEditing) startTrackDrag(e, t, trackIndex); }}
                                                                            onPointerMove={moveTrackDrag}
                                                                            onPointerUp={endTrackDrag}
                                                                            onPointerCancel={() => setTrackDrag(null)}
                                                                            sx={{
                                                                                color: '#4a5568', p: 0.25, opacity: 0, touchAction: 'none',
                                                                                cursor: trackDrag?.isDragging ? 'grabbing' : 'grab',
                                                                                transition: 'opacity 0.15s', '&:hover': { color: '#90b4e8' },
                                                                            }}
                                                                        >
                                                                            <DragIndicatorIcon sx={{ fontSize: 16 }} />
                                                                        </IconButton>

                                                                        <IconButton
                                                                            onClick={() => (active && isPlaying ? togglePlay() : playTrack(t))}
                                                                            disabled={busy} size="small"
                                                                            sx={{ color: active ? '#64b5f6' : '#90b4e8' }}
                                                                        >
                                                                            {busy ? <HourglassTopIcon fontSize="small" />
                                                                                : active && isPlaying ? <PauseIcon /> : <PlayArrowIcon />}
                                                                        </IconButton>

                                                                        {isEditing ? (
                                                                            <Box sx={{ display: 'flex', gap: 1, flexGrow: 1, alignItems: 'center', flexWrap: 'wrap', py: 0.5 }}>
                                                                                <TextField
                                                                                    value={draftTitle}
                                                                                    onChange={e => setDraftTitle(e.target.value)}
                                                                                    onKeyDown={e => { if (e.key === 'Enter') saveEdit(t); if (e.key === 'Escape') setEditingId(null); }}
                                                                                    placeholder="Song name" size="small" variant="standard" autoFocus
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
                                                                                <IconButton onClick={() => saveEdit(t)} size="small" sx={{ color: '#81c784' }}>
                                                                                    <CheckIcon fontSize="small" />
                                                                                </IconButton>
                                                                            </Box>
                                                                        ) : (
                                                                            <Typography
                                                                                noWrap onDoubleClick={() => { setEditingId(t.id); setDraftTitle(t.title); setDraftFolderId(t.folder_id); }}
                                                                                sx={{ flexGrow: 1, minWidth: 0, fontSize: '0.9rem', color: active ? '#64b5f6' : '#f0e8e8', cursor: 'default' }}
                                                                            >
                                                                                {t.title}
                                                                            </Typography>
                                                                        )}

                                                                        <Typography sx={{ fontSize: '0.75rem', color: '#4a5568', fontVariantNumeric: 'tabular-nums' }}>
                                                                            {formatTime(t.duration_seconds)}
                                                                        </Typography>
                                                                        <IconButton
                                                                            size="small" className="trackActions"
                                                                            onClick={e => setTrackMenu({ el: e.currentTarget, track: t })}
                                                                            sx={{ color: '#4a5568', opacity: 0, transition: 'opacity 0.15s', '&:hover': { color: '#f0e8e8' } }}
                                                                        >
                                                                            <MoreVertIcon sx={{ fontSize: 18 }} />
                                                                        </IconButton>
                                                                    </Box>
                                                                    {busy && (
                                                                        <Box sx={{ px: 1, pb: 1 }}>
                                                                            <Typography sx={{ fontSize: '0.68rem', color: '#718096', mb: 0.3 }}>
                                                                                {loadingTrack.phase === 'fetching' ? 'Downloading' : 'Decrypting'} {loadingTrack.pct}%
                                                                            </Typography>
                                                                            <LinearProgress variant="determinate" value={loadingTrack.pct}
                                                                                sx={{
                                                                                    height: 3, borderRadius: 2, backgroundColor: '#252f42',
                                                                                    '& .MuiLinearProgress-bar': { backgroundColor: loadingTrack.phase === 'fetching' ? '#64b5f6' : '#ffb74d' },
                                                                                }} />
                                                                        </Box>
                                                                    )}
                                                                </Box>
                                                            );
                                                        })}

                                                        {/* Ghost row: click or drop files here */}
                                                        <Box onClick={() => openPicker(folder.id)} sx={{ ...ghostRowSx(fileHovering), mb: 0.5 }}>
                                                            <UploadFileIcon sx={{ fontSize: 16 }} />
                                                            <Typography sx={{ fontSize: '0.78rem' }}>
                                                                {fileHovering ? 'Drop to add to this folder' : 'Add songs — click or drop files'}
                                                            </Typography>
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
                                sx={{ ...ghostRowSx(false), mt: folders.length ? 1.5 : 0, py: 1.25 }}
                            >
                                <AddIcon sx={{ fontSize: 18 }} />
                                <Typography sx={{ fontSize: '0.82rem', fontWeight: 600 }}>New folder</Typography>
                            </Box>

                            {folders.length === 0 && (
                                <Typography sx={{ color: '#4a5568', fontSize: '0.82rem', textAlign: 'center', mt: 2 }}>
                                    Create a folder to start adding songs.
                                </Typography>
                            )}
                        </Box>
                    )}
                </Box>
            </Box>

            {/* Sidebar player (desktop) */}
            <Box sx={{
                display: { xs: 'none', lg: 'flex' }, flexDirection: 'column',
                width: SIDEBAR_WIDTH, flexShrink: 0,
                position: 'sticky', top: TOPBAR_OFFSET, alignSelf: 'flex-start',
                height: `calc(100vh - ${TOPBAR_OFFSET}px)`,
                borderLeft: '1px solid #252f42', backgroundColor: '#161c29',
                px: 2.5, py: 3, gap: 2, overflowY: 'auto',
            }}>
                <Box sx={{
                    width: '100%', aspectRatio: '1 / 1', borderRadius: 3,
                    background: 'linear-gradient(145deg, #252f42 0%, #1a2030 100%)',
                    border: '1px solid #2d3748',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                    <MusicNoteIcon sx={{ fontSize: 64, color: currentTrack ? '#3d5280' : '#252f42' }} />
                </Box>

                <Box sx={{ minWidth: 0 }}>
                    <Typography noWrap sx={{ fontWeight: 700, fontSize: '1rem', color: currentTrack ? '#f0e8e8' : '#4a5568' }}>
                        {currentTrack ? currentTrack.title : 'Nothing playing'}
                    </Typography>
                    <Typography noWrap sx={{ fontSize: '0.78rem', color: '#718096' }}>
                        {currentFolder ? currentFolder.name : '—'}
                    </Typography>
                </Box>

                {seekBar}
                {transportButtons(true)}
                {volumeControl}

                {upNext.length > 0 && (
                    <Box sx={{ mt: 1, borderTop: '1px solid #252f42', pt: 2 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', mb: 1 }}>
                            <Typography sx={{ fontSize: '0.68rem', letterSpacing: 1, textTransform: 'uppercase', color: '#4a5568' }}>
                                Up next
                            </Typography>
                            <Typography
                                onClick={() => setQueueOpen(true)}
                                sx={{ fontSize: '0.7rem', color: '#90b4e8', cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
                            >
                                See queue ({upNext.length})
                            </Typography>
                        </Box>
                        {upNext.slice(0, 3).map(t => (
                            <Box
                                key={t.id} onClick={() => playFromQueue(t)}
                                sx={{
                                    display: 'flex', justifyContent: 'space-between', gap: 1,
                                    py: 0.6, px: 0.5, borderRadius: 1, cursor: 'pointer',
                                    '&:hover': { backgroundColor: '#1e2535' },
                                }}
                            >
                                <Typography noWrap sx={{ fontSize: '0.8rem', color: '#a8b4c8' }}>{t.title}</Typography>
                                <Typography sx={{ fontSize: '0.72rem', color: '#4a5568', fontVariantNumeric: 'tabular-nums' }}>
                                    {formatTime(t.duration_seconds)}
                                </Typography>
                            </Box>
                        ))}
                    </Box>
                )}
            </Box>

            {/* Compact player (mobile / tablet) */}
            <Box sx={{
                display: { xs: 'block', lg: 'none' },
                position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 10,
                backgroundColor: '#161c29', borderTop: '1px solid #3a4255',
                px: 2, py: 1,
            }}>
                <Typography noWrap sx={{ fontSize: '0.78rem', color: currentTrack ? '#f0e8e8' : '#4a5568', textAlign: 'center' }}>
                    {currentTrack ? currentTrack.title : 'Nothing playing'}
                </Typography>
                {seekBar}
                {transportButtons(false)}
            </Box>

            {/* Folder menu */}
            <Menu
                anchorEl={folderMenu?.el ?? null} open={folderMenu !== null}
                onClose={() => setFolderMenu(null)} slotProps={{ paper: menuPaperSx }}
            >
                <MenuItem onClick={() => { if (folderMenu) openPicker(folderMenu.folder.id); setFolderMenu(null); }}>
                    <ListItemIcon><UploadFileIcon fontSize="small" /></ListItemIcon>
                    <ListItemText>Add songs</ListItemText>
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

            {/* Song menu */}
            <Menu
                anchorEl={trackMenu?.el ?? null} open={trackMenu !== null}
                onClose={() => setTrackMenu(null)} slotProps={{ paper: menuPaperSx }}
            >
                <MenuItem onClick={() => { const t = trackMenu?.track; setTrackMenu(null); if (t) playNext(t); }} disabled={!currentTrack}>
                    <ListItemIcon><PlaylistPlayIcon fontSize="small" /></ListItemIcon>
                    <ListItemText>Play next</ListItemText>
                </MenuItem>
                <MenuItem onClick={() => { const t = trackMenu?.track; setTrackMenu(null); if (t) addToQueue(t); }} disabled={!currentTrack}>
                    <ListItemIcon><QueueMusicIcon fontSize="small" /></ListItemIcon>
                    <ListItemText>Add to queue</ListItemText>
                </MenuItem>
                <MenuItem onClick={() => {
                    if (trackMenu) { setEditingId(trackMenu.track.id); setDraftTitle(trackMenu.track.title); setDraftFolderId(trackMenu.track.folder_id); }
                    setTrackMenu(null);
                }}>
                    <ListItemIcon><EditOutlinedIcon fontSize="small" /></ListItemIcon>
                    <ListItemText>Rename or move</ListItemText>
                </MenuItem>
                <MenuItem onClick={() => { const t = trackMenu?.track; setTrackMenu(null); if (t) removeTrack(t); }}>
                    <ListItemIcon><DeleteOutlineIcon fontSize="small" sx={{ color: '#e57373' }} /></ListItemIcon>
                    <ListItemText sx={{ color: '#e57373' }}>Delete song</ListItemText>
                </MenuItem>
            </Menu>

            {/* New / rename folder */}
            <Dialog
                open={folderDialog !== null} onClose={() => setFolderDialog(null)} fullWidth maxWidth="xs"
                PaperProps={{ sx: { backgroundColor: '#1a2030', color: '#f0e8e8', backgroundImage: 'none' } }}
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
                    <Typography sx={{ fontSize: '0.72rem', color: '#718096', mt: 1.5 }}>
                        The folder name is encrypted in your browser, same as the songs.
                    </Typography>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button onClick={() => setFolderDialog(null)} sx={{ textTransform: 'none', color: '#718096' }}>Cancel</Button>
                    <Button
                        onClick={submitFolderDialog} disabled={!folderNameInput.trim()}
                        sx={{
                            textTransform: 'none', fontWeight: 600, px: 2, color: '#1e2535', backgroundColor: '#90b4e8',
                            '&:hover': { backgroundColor: '#64b5f6' },
                            '&.Mui-disabled': { backgroundColor: '#2d3748', color: '#4a5568' },
                        }}
                    >
                        {folderDialog?.mode === 'rename' ? 'Rename' : 'Create'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Name + folder before upload */}
            <Dialog
                open={staged !== null} onClose={() => setStaged(null)} fullWidth maxWidth="xs"
                PaperProps={{ sx: { backgroundColor: '#1a2030', color: '#f0e8e8', backgroundImage: 'none' } }}
            >
                <DialogTitle sx={{ fontSize: '1.05rem', fontWeight: 700 }}>
                    {staged?.length === 1 ? 'Name this song' : `Name these ${staged?.length ?? 0} songs`}
                </DialogTitle>
                <DialogContent>
                    {staged?.map((s, i) => (
                        <Box key={i} sx={{ mb: 2.5 }}>
                            <TextField
                                value={s.title}
                                onChange={e => setStaged(prev => prev ? prev.map((p, j) => (j === i ? { ...p, title: e.target.value } : p)) : prev)}
                                onKeyDown={e => { if (e.key === 'Enter') uploadStaged(); }}
                                placeholder="Song name" fullWidth autoFocus={i === 0} sx={{ mb: 1, ...fieldSx }}
                            />
                            <FormControl fullWidth size="small" sx={fieldSx}>
                                <InputLabel>Folder</InputLabel>
                                <Select
                                    value={s.folderId} label="Folder"
                                    MenuProps={{ PaperProps: menuPaperSx }}
                                    onChange={e => setStaged(prev => prev ? prev.map((p, j) => (j === i ? { ...p, folderId: e.target.value as number } : p)) : prev)}
                                >
                                    {folders.map(f => <MenuItem key={f.id} value={f.id}>{f.name}</MenuItem>)}
                                </Select>
                            </FormControl>
                            <Typography noWrap sx={{ fontSize: '0.7rem', color: '#4a5568', mt: 0.5 }}>
                                {s.file.name} · {(s.file.size / (1024 * 1024)).toFixed(1)} MB
                            </Typography>
                        </Box>
                    ))}
                    <Typography sx={{ fontSize: '0.72rem', color: '#718096' }}>
                        The name is encrypted in your browser along with the audio.
                    </Typography>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button onClick={() => setStaged(null)} sx={{ textTransform: 'none', color: '#718096' }}>Cancel</Button>
                    <Button
                        onClick={uploadStaged}
                        disabled={!staged?.some(s => s.title.trim().length > 0 && s.folderId !== '')}
                        sx={{
                            textTransform: 'none', fontWeight: 600, px: 2, color: '#1e2535', backgroundColor: '#90b4e8',
                            '&:hover': { backgroundColor: '#64b5f6' },
                            '&.Mui-disabled': { backgroundColor: '#2d3748', color: '#4a5568' },
                        }}
                    >
                        Upload
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Queue */}
            <Dialog
                open={queueOpen} onClose={() => setQueueOpen(false)} fullWidth maxWidth="xs"
                PaperProps={{ sx: { backgroundColor: '#1a2030', color: '#f0e8e8', backgroundImage: 'none' } }}
            >
                <DialogTitle sx={{ fontSize: '1.05rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    Queue
                    <IconButton onClick={() => setQueueOpen(false)} size="small" sx={{ color: '#718096' }}>
                        <CloseIcon fontSize="small" />
                    </IconButton>
                </DialogTitle>
                <DialogContent sx={{ pt: 0 }}>
                    {currentTrack && (
                        <Box sx={{ mb: 1.5 }}>
                            <Typography sx={{ fontSize: '0.68rem', letterSpacing: 1, textTransform: 'uppercase', color: '#4a5568', mb: 0.75 }}>
                                Now playing
                            </Typography>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, py: 0.6, px: 0.75, borderRadius: 1, backgroundColor: '#252f42' }}>
                                <Typography noWrap sx={{ fontSize: '0.85rem', color: '#64b5f6', fontWeight: 600 }}>{currentTrack.title}</Typography>
                                <Typography sx={{ fontSize: '0.72rem', color: '#4a5568', fontVariantNumeric: 'tabular-nums' }}>
                                    {formatTime(currentTrack.duration_seconds)}
                                </Typography>
                            </Box>
                        </Box>
                    )}

                    <Typography sx={{ fontSize: '0.68rem', letterSpacing: 1, textTransform: 'uppercase', color: '#4a5568', mb: 0.75 }}>
                        Up next
                    </Typography>
                    {upNext.length === 0 ? (
                        <Typography sx={{ color: '#4a5568', fontSize: '0.82rem', py: 1 }}>Nothing queued.</Typography>
                    ) : (
                        upNext.map((t, k) => {
                            // upNext is exactly queue's tail after the current track, so this recovers k's absolute position.
                            const queueIndex = queue.length - upNext.length + k;
                            return (
                                <Box
                                    key={`${t.id}-${k}`}
                                    sx={{
                                        display: 'flex', alignItems: 'center', gap: 0.5,
                                        py: 0.5, px: 0.5, mb: 0.4, borderRadius: 1,
                                        '&:hover': { backgroundColor: '#1e2535' },
                                    }}
                                >
                                    <Box
                                        onClick={() => { playFromQueue(t); setQueueOpen(false); }}
                                        sx={{ flex: 1, minWidth: 0, display: 'flex', justifyContent: 'space-between', gap: 1, cursor: 'pointer' }}
                                    >
                                        <Typography noWrap sx={{ fontSize: '0.85rem', color: '#a8b4c8' }}>{t.title}</Typography>
                                        <Typography sx={{ fontSize: '0.72rem', color: '#4a5568', fontVariantNumeric: 'tabular-nums' }}>
                                            {formatTime(t.duration_seconds)}
                                        </Typography>
                                    </Box>
                                    <IconButton
                                        size="small" onClick={() => removeFromQueue(queueIndex)}
                                        sx={{ color: '#4a5568', '&:hover': { color: '#e57373' } }}
                                    >
                                        <CloseIcon sx={{ fontSize: 14 }} />
                                    </IconButton>
                                </Box>
                            );
                        })
                    )}
                </DialogContent>
            </Dialog>
        </Box>
    );
}
