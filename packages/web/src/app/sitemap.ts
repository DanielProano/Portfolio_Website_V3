import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
    const baseUrl = 'https://dannyproano.com';
    const buildDate = new Date().toISOString();

    return [
        { 
            url: baseUrl, 
            lastModified: buildDate,
            changeFrequency: 'monthly',
            priority: 1.0,
        },
        { 
            url: `${baseUrl}/chess`,
            lastModified: buildDate,
            changeFrequency: 'monthly',
            priority: 0.8, 
        },
        {
            url: `${baseUrl}/password`,
            lastModified: buildDate,
            changeFrequency: 'monthly',
            priority: 0.8,
        }
    ];
}