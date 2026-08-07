'use client';

import Image from 'next/image';
import type { CSSProperties } from 'react';

/**
 * Renders either a still image or a looping video from a single `src`, so the
 * content arrays on the home page can swap a photo for a clip by changing the
 * file path and nothing else.
 *
 * `next/image` is an image-only pipeline (it resizes and re-encodes to WebP/AVIF
 * through Vercel's image CDN), so video has to drop down to a plain <video>.
 */

const VIDEO_EXTENSIONS = /\.(mp4|webm|mov|m4v)$/i;

export function isVideo(src: string): boolean {
    return VIDEO_EXTENSIONS.test(src);
}

type MediaProps = {
    src: string;
    /** Alt text for images; an aria-label for videos. */
    alt: string;
    /** Still frame shown while a video buffers. Ignored for images. */
    poster?: string;
    /** Eager-load this media — use for above-the-fold content only. */
    priority?: boolean;
    /** Fill the nearest positioned ancestor instead of using width/height. */
    fill?: boolean;
    width?: number;
    height?: number;
    sizes?: string;
    style?: CSSProperties;
};

export function Media({ src, alt, poster, priority, fill, width, height, sizes, style }: MediaProps) {
    const fitStyle: CSSProperties = { width: '100%', height: '100%', objectFit: 'cover', ...style };

    if (isVideo(src)) {
        return (
            <video
                // Keyed on src so swapping slides swaps the element rather than
                // reusing one that is mid-playback with the previous source.
                key={src}
                src={src}
                poster={poster}
                aria-label={alt}
                // All three are load-bearing: muted or the browser blocks autoplay,
                // playsInline or iOS Safari yanks it into its fullscreen player,
                // loop for the play-forever behaviour.
                autoPlay
                muted
                loop
                playsInline
                preload={priority ? 'auto' : 'metadata'}
                style={fill ? { position: 'absolute', inset: 0, ...fitStyle } : fitStyle}
            />
        );
    }

    return (
        <Image
            src={src}
            alt={alt}
            priority={priority}
            sizes={sizes}
            {...(fill ? { fill: true } : { width: width ?? 1000, height: height ?? 1000 })}
            style={fill ? style : fitStyle}
        />
    );
}
