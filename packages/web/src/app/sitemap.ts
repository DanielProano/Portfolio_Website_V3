import { MetadataRoute } from 'next';
import { getAllPosts } from '@/lib/research';

export default function sitemap(): MetadataRoute.Sitemap {
    const baseUrl = 'https://dannyproano.com';
    const buildDate = new Date().toISOString();

    const researchPosts = getAllPosts().map(post => ({
        url: `${baseUrl}/research/${post.slug}`,
        lastModified: new Date(post.date + 'T00:00:00').toISOString(),
        changeFrequency: 'monthly' as const,
        priority: 0.9,
    }));

    return [
        { url: baseUrl, lastModified: buildDate, changeFrequency: 'monthly', priority: 1.0 },
        { url: `${baseUrl}/research`, lastModified: buildDate, changeFrequency: 'weekly', priority: 0.9 },
        ...researchPosts,
        { url: `${baseUrl}/chess`, lastModified: buildDate, changeFrequency: 'monthly', priority: 0.8 },
        { url: `${baseUrl}/password`, lastModified: buildDate, changeFrequency: 'monthly', priority: 0.8 },
    ];
}