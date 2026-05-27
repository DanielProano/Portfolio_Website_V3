import { MetadataRoute } from 'next';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const baseUrl = 'https://dannyproano.com';

    return [
        { url: baseUrl, lastModified: new Date() },
    ];
}