'use client';

import { ReactNode, createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { decryptToBlob } from '@/lib/audioCrypto';
import type { Loading, Track } from '@/app/audio/types';

/** XHR rather than fetch — fetch has no download-progress events. */
function getWithProgress(url: string, onProgress: (pct: number) => void): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', url);
        xhr.responseType = 'arraybuffer';
        xhr.onprogress = e => {
            if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
        };
        xhr.onload = () => xhr.status >= 200 && xhr.status < 300
            ? resolve(xhr.response as ArrayBuffer) : reject(new Error(`R2 refused the download (${xhr.status})`));
        xhr.onerror = () => reject(new Error('Network error during download'));
        xhr.send();
    });
}

function shuffled<T>(arr: T[]): T[] {
    const out = [...arr];
    for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
}

type AudioPlayerContextValue = {
    currentTrack: Track | null;
    currentFolderId: number | null;
    isPlaying: boolean;
    position: number;
    duration: number;
    volume: number;
    muted: boolean;
    loadingTrack: Loading | null;
    playerError: string | null;
    /** The full play order: past, current, and upcoming tracks — spans folders once you add-to-queue. */
    queue: Track[];
    shuffle: boolean;
    repeatOne: boolean;
    setKey: (k: CryptoKey | null) => void;
    /** Starts a track from the library, replacing the queue with its folder's contents (reshuffled if shuffle is on). */
    play: (track: Track, contextQueue: Track[]) => Promise<void>;
    /** Jumps straight to a track already sitting in the queue, without touching the queue itself. */
    playFromQueue: (track: Track) => void;
    step: (delta: number) => void;
    nudge: (seconds: number) => void;
    togglePlay: () => void;
    stopPlayback: () => void;
    previewSeek: (seconds: number) => void;
    commitSeek: (seconds: number) => void;
    setVolume: (v: number) => void;
    setMuted: (m: boolean) => void;
    toggleShuffle: () => void;
    toggleRepeatOne: () => void;
    addToQueue: (track: Track) => void;
    playNext: (track: Track) => void;
    removeFromQueue: (index: number) => void;
    /** Reassociates the currently playing track with a different folder (e.g. after a drag-move), without touching playback. */
    retagFolder: (folderId: number) => void;
    /** Keeps queued tracks from a given folder (and the current track's live title) in sync with the library's own copy. */
    syncQueue: (folderId: number, list: Track[]) => void;
};

const AudioPlayerContext = createContext<AudioPlayerContextValue | null>(null);

export function useAudioPlayer(): AudioPlayerContextValue {
    const ctx = useContext(AudioPlayerContext);
    if (!ctx) throw new Error('useAudioPlayer must be used within an AudioPlayerProvider');
    return ctx;
}

/**
 * Owns the <audio> element and all playback state at the root layout level so a
 * track keeps playing across client-side navigation, instead of being tied to the
 * lifetime of the /audio page's component tree.
 */
export function AudioPlayerProvider({ children }: { children: ReactNode }) {
    const keyRef = useRef<CryptoKey | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const blobUrlRef = useRef<string | null>(null);
    const playGenRef = useRef(0);

    const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
    const [currentFolderId, setCurrentFolderId] = useState<number | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [position, setPosition] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolumeState] = useState(1);
    const [muted, setMutedState] = useState(false);
    const [loadingTrack, setLoadingTrack] = useState<Loading | null>(null);
    const [playerError, setPlayerError] = useState<string | null>(null);
    const [seeking, setSeeking] = useState(false);

    const [queue, setQueue] = useState<Track[]>([]);
    const [unshuffledQueue, setUnshuffledQueue] = useState<Track[] | null>(null);
    const [shuffle, setShuffle] = useState(false);
    const [repeatOne, setRepeatOne] = useState(false);

    useEffect(() => () => {
        if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
    }, []);

    useEffect(() => {
        if (audioRef.current) audioRef.current.loop = repeatOne;
    }, [repeatOne]);

    const setKey = useCallback((k: CryptoKey | null) => { keyRef.current = k; }, []);

    const stopPlayback = useCallback(() => {
        playGenRef.current++;
        audioRef.current?.pause();
        if (blobUrlRef.current) { URL.revokeObjectURL(blobUrlRef.current); blobUrlRef.current = null; }
        audioRef.current?.removeAttribute('src');
        setQueue([]);
        setUnshuffledQueue(null);
        setCurrentTrack(null);
        setCurrentFolderId(null);
        setIsPlaying(false);
        setPosition(0);
        setDuration(0);
    }, []);

    /** Fetches, decrypts, and plays a track. Never touches the queue — callers decide that. */
    const loadAndPlay = useCallback(async (track: Track) => {
        const el = audioRef.current;
        const key = keyRef.current;
        if (!el || !key) return;

        if (currentTrack?.id === track.id && el.src) {
            await el.play();
            return;
        }

        const gen = ++playGenRef.current;
        setPlayerError(null);
        setLoadingTrack({ id: track.id, phase: 'fetching', pct: 0 });
        try {
            const urlRes = await fetch(`/api/audio/${track.id}/play`);
            if (!urlRes.ok) throw new Error((await urlRes.json()).error ?? 'Could not get playback URL');
            const { url } = await urlRes.json();

            const ciphertext = await getWithProgress(url, pct => {
                if (playGenRef.current === gen) setLoadingTrack({ id: track.id, phase: 'fetching', pct });
            });
            if (playGenRef.current !== gen) return;

            setLoadingTrack({ id: track.id, phase: 'decrypting', pct: 0 });
            const blob = await decryptToBlob(ciphertext, key, track.mime_type || 'audio/mpeg', f => {
                if (playGenRef.current === gen) {
                    setLoadingTrack({ id: track.id, phase: 'decrypting', pct: Math.round(f * 100) });
                }
            });
            if (playGenRef.current !== gen) return;

            if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
            blobUrlRef.current = URL.createObjectURL(blob);
            el.src = blobUrlRef.current;
            setCurrentTrack(track);
            setCurrentFolderId(track.folder_id);
            setPosition(0);
            await el.play();
        } catch (e) {
            if (playGenRef.current !== gen) return;
            setPlayerError(
                e instanceof Error && e.name === 'OperationError'
                    ? 'Could not decrypt this song — it may have been uploaded under a different passphrase.'
                    : e instanceof Error ? e.message : 'Playback failed'
            );
            setIsPlaying(false);
        } finally {
            if (playGenRef.current === gen) setLoadingTrack(null);
        }
    }, [currentTrack]);

    /** Starting point for playback from the library: this folder's tracks become the queue. */
    const play = useCallback(async (track: Track, contextQueue: Track[]) => {
        if (shuffle) {
            setUnshuffledQueue(contextQueue);
            setQueue([track, ...shuffled(contextQueue.filter(t => t.id !== track.id))]);
        } else {
            setUnshuffledQueue(null);
            setQueue(contextQueue);
        }
        await loadAndPlay(track);
    }, [shuffle, loadAndPlay]);

    const playFromQueue = useCallback((track: Track) => {
        loadAndPlay(track);
    }, [loadAndPlay]);

    /** The queue is the order, so next/previous stay inside it — wrapping at either end. */
    const step = useCallback((delta: number) => {
        if (!currentTrack || queue.length === 0) return;
        const i = queue.findIndex(t => t.id === currentTrack.id);
        if (i === -1) return;
        loadAndPlay(queue[(i + delta + queue.length) % queue.length]);
    }, [currentTrack, queue, loadAndPlay]);

    const addToQueue = useCallback((track: Track) => {
        setQueue(prev => [...prev, track]);
        setUnshuffledQueue(prev => (prev ? [...prev, track] : prev));
    }, []);

    const playNext = useCallback((track: Track) => {
        setQueue(prev => {
            const i = currentTrack ? prev.findIndex(t => t.id === currentTrack.id) : -1;
            const insertAt = i === -1 ? prev.length : i + 1;
            const next = [...prev];
            next.splice(insertAt, 0, track);
            return next;
        });
    }, [currentTrack]);

    const removeFromQueue = useCallback((index: number) => {
        setQueue(prev => prev.filter((_, i) => i !== index));
    }, []);

    const toggleShuffle = useCallback(() => {
        if (!shuffle) {
            setUnshuffledQueue(queue);
            setQueue(prev => {
                if (!currentTrack) return prev;
                return [currentTrack, ...shuffled(prev.filter(t => t.id !== currentTrack.id))];
            });
            setShuffle(true);
        } else {
            setQueue(unshuffledQueue ?? queue);
            setUnshuffledQueue(null);
            setShuffle(false);
        }
    }, [shuffle, queue, currentTrack, unshuffledQueue]);

    const toggleRepeatOne = useCallback(() => setRepeatOne(r => !r), []);

    const nudge = useCallback((seconds: number) => {
        const el = audioRef.current;
        if (!el || !currentTrack) return;
        el.currentTime = Math.max(0, Math.min(el.duration || 0, el.currentTime + seconds));
    }, [currentTrack]);

    const togglePlay = useCallback(() => {
        const el = audioRef.current;
        if (!el) return;
        if (isPlaying) el.pause();
        else if (currentTrack) loadAndPlay(currentTrack);
    }, [isPlaying, currentTrack, loadAndPlay]);

    const previewSeek = useCallback((seconds: number) => {
        setSeeking(true);
        setPosition(seconds);
    }, []);

    const commitSeek = useCallback((seconds: number) => {
        if (audioRef.current) audioRef.current.currentTime = seconds;
        setSeeking(false);
    }, []);

    const setVolume = useCallback((v: number) => {
        setVolumeState(v);
        setMutedState(v === 0);
        if (audioRef.current) { audioRef.current.volume = v; audioRef.current.muted = v === 0; }
    }, []);

    const setMuted = useCallback((m: boolean) => {
        setMutedState(m);
        if (audioRef.current) audioRef.current.muted = m;
    }, []);

    const retagFolder = useCallback((folderId: number) => setCurrentFolderId(folderId), []);

    /** Drops or refreshes queued tracks belonging to `folderId` whenever the library's copy of that folder changes. */
    const syncQueue = useCallback((folderId: number, list: Track[]) => {
        const reconcile = (arr: Track[]) => arr
            .map(t => (t.folder_id === folderId ? (list.find(x => x.id === t.id) ?? null) : t))
            .filter((t): t is Track => t !== null);

        setQueue(prev => reconcile(prev));
        setUnshuffledQueue(prev => (prev ? reconcile(prev) : prev));
        setCurrentTrack(prev => {
            if (!prev || prev.folder_id !== folderId) return prev;
            return list.find(t => t.id === prev.id) ?? prev;
        });
    }, []);

    useEffect(() => {
        if (!('mediaSession' in navigator) || !currentTrack) return;
        navigator.mediaSession.metadata = new MediaMetadata({ title: currentTrack.title });
        navigator.mediaSession.setActionHandler('play', () => audioRef.current?.play());
        navigator.mediaSession.setActionHandler('pause', () => audioRef.current?.pause());
        navigator.mediaSession.setActionHandler('nexttrack', () => step(1));
        navigator.mediaSession.setActionHandler('previoustrack', () => step(-1));
    }, [currentTrack, step]);

    const value: AudioPlayerContextValue = {
        currentTrack, currentFolderId, isPlaying, position, duration, volume, muted,
        loadingTrack, playerError, queue, shuffle, repeatOne, setKey, play, playFromQueue, step, nudge,
        togglePlay, stopPlayback, previewSeek, commitSeek, setVolume, setMuted, toggleShuffle,
        toggleRepeatOne, addToQueue, playNext, removeFromQueue, retagFolder, syncQueue,
    };

    return (
        <AudioPlayerContext.Provider value={value}>
            {children}
            <audio
                ref={audioRef}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onLoadedMetadata={e => setDuration(e.currentTarget.duration)}
                onTimeUpdate={e => { if (!seeking) setPosition(e.currentTarget.currentTime); }}
                onEnded={() => step(1)}
                onError={() => {
                    if (audioRef.current?.src) {
                        setPlayerError('The decrypted audio could not be decoded.');
                        setIsPlaying(false);
                    }
                }}
            />
        </AudioPlayerContext.Provider>
    );
}
