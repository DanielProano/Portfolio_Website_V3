"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const pg_1 = require("pg");
const pool = new pg_1.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});
pool.on('connect', () => {
    console.log('Connected to PostgreSQL');
});
pool.on('error', (err) => {
    console.error('PostgreSQL error:', err);
});
exports.default = pool;
