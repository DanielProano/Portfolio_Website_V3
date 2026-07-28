'use client';

/**
 * Persists the derived library key in IndexedDB.
 *
 * A CryptoKey is structured-cloneable, so the browser stores it in its own keystore
 * and hands back an opaque handle. Because the key was derived with
 * extractable: false, JS still cannot read the raw bytes — not before storing it and
 * not after loading it back. Nothing key-related is ever sent to the server; this is
 * purely "don't make me retype the passphrase in this browser".
 *
 * Every operation degrades to a no-op if IndexedDB is unavailable (private windows,
 * storage disabled, or a browser that refuses to clone CryptoKeys), in which case the
 * user just enters the passphrase each session.
 */

const DB_NAME = 'dp-audio';
const DB_VERSION = 1;
const STORE = 'keys';
const RECORD_ID = 'library-key';

function openDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        if (typeof indexedDB === 'undefined') {
            reject(new Error('IndexedDB unavailable'));
            return;
        }
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error ?? new Error('Could not open IndexedDB'));
        req.onblocked = () => reject(new Error('IndexedDB upgrade blocked'));
    });
}

function runTx<T>(
    db: IDBDatabase,
    mode: IDBTransactionMode,
    action: (store: IDBObjectStore) => IDBRequest<T> | void
): Promise<T | undefined> {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const req = action(tx.objectStore(STORE));
        let value: T | undefined;
        if (req) req.onsuccess = () => { value = req.result; };
        tx.oncomplete = () => resolve(value);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
    });
}

/** Returns true if the key was persisted. Never throws. */
export async function saveKey(key: CryptoKey): Promise<boolean> {
    let db: IDBDatabase | null = null;
    try {
        db = await openDb();
        await runTx(db, 'readwrite', store => store.put(key, RECORD_ID));
        return true;
    } catch {
        // DataCloneError, quota, private browsing — fall back to typing it each time.
        return false;
    } finally {
        db?.close();
    }
}

/** Returns the stored key, or null if there isn't one. Never throws. */
export async function loadKey(): Promise<CryptoKey | null> {
    let db: IDBDatabase | null = null;
    try {
        db = await openDb();
        const value = await runTx<unknown>(db, 'readonly', store => store.get(RECORD_ID));
        // Guard the type: anything else in this slot is corrupt and should be ignored.
        return value instanceof CryptoKey ? value : null;
    } catch {
        return null;
    } finally {
        db?.close();
    }
}

export async function clearKey(): Promise<void> {
    let db: IDBDatabase | null = null;
    try {
        db = await openDb();
        await runTx(db, 'readwrite', store => store.delete(RECORD_ID));
    } catch {
        // Nothing to clear.
    } finally {
        db?.close();
    }
}
