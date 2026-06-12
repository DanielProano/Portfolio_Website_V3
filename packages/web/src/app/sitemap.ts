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
    ];
}