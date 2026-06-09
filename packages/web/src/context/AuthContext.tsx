'use client';

import { createContext, useState, useContext } from 'react';

type DerivedKey = {
    key: CryptoKey;
    token: string;
} | null;

type AuthContextType = {
    derived_key: DerivedKey;
    set_derived_key: (key: DerivedKey) => void;
};

const auth_context = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [derived_key, set_derived_key] = useState<DerivedKey>(null);

    return (
        <auth_context.Provider value={{ derived_key, set_derived_key }}>
            {children}
        </auth_context.Provider>
    );
}

export function use_auth(): AuthContextType {
    const context = useContext(auth_context);
    if (!context) throw new Error('use_auth must be used within an AuthProvider');
    return context;
}

