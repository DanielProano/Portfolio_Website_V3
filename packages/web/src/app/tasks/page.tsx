import dynamic from 'next/dynamic';
import { redirect } from 'next/navigation';
import { getSessionSafe } from '@/lib/auth0';

const TasksClient = dynamic(
    () => import('./TasksClient').then(m => m.TasksClient),
    { ssr: false }
);

export default async function TasksPage() {
    const session = await getSessionSafe();
    if (!session?.user?.sub) {
        redirect('/');
    }

    return <TasksClient isAdmin={true} />;
}
