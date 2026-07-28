import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
    return {
        rules: [
            {
                userAgent: '*',
                allow: '/',
                disallow: [
                    '/api/',
                    '/password/vault'
                ],
            },
        ],
        sitemap: 'https://dannyproano.com/sitemap.xml',
    };
}