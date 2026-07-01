const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
    webpack: (config) => {
        config.resolve.alias = {
            ...config.resolve.alias,
            '@emotion/react': path.resolve(__dirname, 'node_modules/@emotion/react'),
            '@emotion/styled': path.resolve(__dirname, 'node_modules/@emotion/styled'),
            '@emotion/cache': path.resolve(__dirname, 'node_modules/@emotion/cache'),
        };
        return config;
    },
};

module.exports = nextConfig;
