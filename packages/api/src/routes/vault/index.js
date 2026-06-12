"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = vaultRoutes;
const express_1 = require("express");
const pg_1 = require("pg");
const crypto_1 = __importDefault(require("crypto"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const auth_1 = require("../../middleware/auth");
function vaultRoutes(pool) {
    const router = (0, express_1.Router)();
    pool.query(`
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            hash TEXT NOT NULL,
            master_salt TEXT NOT NULL,
            enc_salt TEXT NOT NULL
        )
    `).then(() => {
        console.log('Users table access successful');
        return pool.query(`
            CREATE TABLE IF NOT EXISTS vault (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id),
                service TEXT NOT NULL,
                login TEXT NOT NULL,
                password TEXT NOT NULL,
                notes TEXT DEFAULT ''
            )
        `);
    }).then(() => console.log('Vault table access successful'))
        .catch(err => console.error('Table access failure:', err));
    router.get('/salt', async (req, res) => {
        const user = req.query.user;
        if (!user) {
            return res.status(400).json({ message: 'Username required' });
        }
        try {
            const result = await pool.query('SELECT master_salt FROM users WHERE username = $1', [user]);
            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'User does not exist' });
            }
            res.status(200).json({ master_salt: result.rows[0].master_salt });
        }
        catch (err) {
            res.status(500).json({ error: 'DB Error' });
        }
    });
    router.post('/register', async (req, res) => {
        const { user, hash, master_salt } = req.body;
        if (!user || !hash || !master_salt) {
            return res.status(400).json({ error: 'Need a user, pass, or salt' });
        }
        try {
            const vault_salt = crypto_1.default.randomBytes(16).toString('base64');
            await pool.query('INSERT INTO users (username, hash, master_salt, enc_salt) VALUES ($1, $2, $3, $4)', [user, hash, master_salt, vault_salt]);
            res.status(201).json({ message: 'User registered successfully' });
        }
        catch (err) {
            if (err.code === '23505') {
                return res.status(409).json({ error: 'User already exists' });
            }
            res.status(500).json({ error: 'Internal server error' });
        }
    });
    router.post('/verify', async (req, res) => {
        const { user, hash } = req.body;
        try {
            const result = await pool.query('SELECT id, hash, enc_salt FROM users WHERE username = $1', [user]);
            if (result.rows.length === 0) {
                return res.status(401).json({ error: 'User not found' });
            }
            const row = result.rows[0];
            const isValid = hash === row.hash;
            if (isValid) {
                const token = jsonwebtoken_1.default.sign({ user_id: row.id }, process.env.JWT_SECRET, {
                    expiresIn: '1h',
                });
                res.status(200).json({ message: 'Authentication successful', token, salt: row.enc_salt });
            }
            else {
                res.status(401).json({ error: 'Invalid password' });
            }
        }
        catch (err) {
            res.status(500).json({ error: 'Internal server error' });
        }
    });
    router.get('/vault/get', auth_1.validateToken, async (req, res) => {
        const user_id = req.user?.user_id;
        try {
            const result = await pool.query('SELECT * FROM vault WHERE user_id = $1', [user_id]);
            res.status(200).json({ vault: result.rows });
        }
        catch (err) {
            res.status(500).json({ error: 'Internal server error' });
        }
    });
    router.post('/vault/store', auth_1.validateToken, async (req, res) => {
        const { service, login, password, notes } = req.body;
        const user_id = req.user?.user_id;
        if (!service || !login || !password) {
            return res.status(400).json({ error: 'Missing fields' });
        }
        try {
            await pool.query('INSERT INTO vault (user_id, service, login, password, notes) VALUES ($1, $2, $3, $4, $5)', [user_id, JSON.stringify(service), JSON.stringify(login), JSON.stringify(password), JSON.stringify(notes || {})]);
            res.status(201).json({ message: 'Inserted password successfully' });
        }
        catch (err) {
            res.status(500).json({ error: 'Problem saving password' });
        }
    });
    router.delete('/vault/delete/:id', auth_1.validateToken, async (req, res) => {
        const user_id = req.user?.user_id;
        const vault_id = req.params.id;
        try {
            const result = await pool.query('DELETE FROM vault WHERE user_id = $1 AND id = $2', [user_id, vault_id]);
            if (result.rowCount === 0) {
                return res.status(404).json({ error: 'Entry not found' });
            }
            res.status(200).json({ message: 'Deleted successfully' });
        }
        catch (err) {
            res.status(500).json({ error: 'Internal server error' });
        }
    });
    return router;
}
//# sourceMappingURL=index.js.map