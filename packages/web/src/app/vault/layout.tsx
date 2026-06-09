import { AuthProvider } from '@/context/AuthContext';

export default function VaultLayout({ children }: { children: React.ReactNode }) {
    return (
        <AuthProvider>
            {children}
        </AuthProvider>
    );
}