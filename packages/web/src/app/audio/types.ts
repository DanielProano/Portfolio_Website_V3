export type RawFolder = {
    id: number; name_enc: string; sort_order: number | null;
    created_at: string; track_count: number;
};
export type Folder = Omit<RawFolder, 'name_enc'> & { name: string };

export type RawTrack = {
    id: number; folder_id: number; title_enc: string;
    duration_seconds: number | null; mime_type: string; size_bytes: number | null;
    sort_order: number | null; enc_v: number; created_at: string;
};
export type Track = Omit<RawTrack, 'title_enc'> & { title: string };

export type Loading = { id: number; phase: 'fetching' | 'decrypting'; pct: number };
