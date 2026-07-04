'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
    Box, Typography, IconButton, Button, Chip,
    TextField, Select, MenuItem, FormControl, InputLabel, Tooltip,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import CloseIcon from '@mui/icons-material/Close';

// ─── Types ────────────────────────────────────────────────────────────────────

type TaskStatus = 'todo' | 'in_progress' | 'done';

type Task = {
    id: number;
    title: string;
    description: string;
    status: TaskStatus;
    priority: 'low' | 'medium' | 'high';
    due_date: string | null;
    due_time: string | null;
    sort_order: number | null;
    created_at: string;
};

type FormData = {
    title: string;
    description: string;
    status: TaskStatus;
    priority: 'low' | 'medium' | 'high';
    due_date: string;
    due_time: string;
};

type DropTarget = { status: TaskStatus; index: number };

// ─── Constants ────────────────────────────────────────────────────────────────

const PRIORITY_COLORS: Record<string, string> = {
    low: '#81c784',
    medium: '#ffb74d',
    high: '#e57373',
};

const COLUMNS: { status: TaskStatus; label: string; accent: string }[] = [
    { status: 'todo',        label: 'Todo',        accent: '#718096' },
    { status: 'in_progress', label: 'In Progress',  accent: '#90b4e8' },
    { status: 'done',        label: 'Done',         accent: '#81c784' },
];

const inputSx = {
    '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: '#4a5568' } },
    '& .MuiInputLabel-root': { color: '#aaa', fontSize: { xs: '0.875rem', lg: '1rem' } },
    '& .MuiInputBase-input': { fontSize: { xs: '0.875rem', lg: '1rem' } },
};

function emptyForm(status: TaskStatus = 'todo'): FormData {
    return { title: '', description: '', status, priority: 'medium', due_date: '', due_time: '' };
}

function formatDueDate(due_date: string | null, due_time: string | null): string | null {
    if (!due_date) return null;
    const [y, mo, dy] = due_date.split('-').map(Number);
    const d = new Date(y, mo - 1, dy);
    const dateStr = d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    if (!due_time) return dateStr;
    const [h, m] = due_time.split(':').map(Number);
    const period = h < 12 ? 'AM' : 'PM';
    const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${dateStr}, ${hour12}:${String(m).padStart(2, '0')} ${period}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function TasksClient({ isAdmin }: { isAdmin: boolean }) {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [formOpen, setFormOpen] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [formData, setFormData] = useState<FormData>(emptyForm());

    // Drag refs — always current, no stale closure issues
    const dragTaskRef = useRef<Task | null>(null);
    const dragStartXRef = useRef(0);
    const dragStartYRef = useRef(0);
    const isDraggingRef = useRef(false);
    const dropTargetRef = useRef<DropTarget | null>(null);

    // Drag state — for visual re-renders only
    const [draggingId, setDraggingId] = useState<number | null>(null);
    const [dropIndicator, setDropIndicator] = useState<DropTarget | null>(null);

    // ── Fetch ──────────────────────────────────────────────────────────────────

    const fetchTasks = useCallback(async () => {
        try {
            const res = await fetch('/api/tasks');
            if (!res.ok) { setTasks([]); return; }
            const data = await res.json();
            setTasks(data.tasks ?? []);
        } catch { setTasks([]); }
    }, []);

    useEffect(() => { if (isAdmin) fetchTasks(); }, [isAdmin, fetchTasks]);

    // ── Column helpers ─────────────────────────────────────────────────────────

    const columnTasks = (status: TaskStatus): Task[] =>
        tasks
            .filter(t => t.status === status)
            .sort((a, b) => {
                if (a.sort_order !== null && b.sort_order !== null) return a.sort_order - b.sort_order;
                if (a.sort_order !== null) return -1;
                if (b.sort_order !== null) return 1;
                return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
            });

    // ── Drag ──────────────────────────────────────────────────────────────────

    const computeDropTarget = (clientX: number, clientY: number): DropTarget | null => {
        const el = document.elementFromPoint(clientX, clientY);
        const colEl = el?.closest('[data-column-status]');
        if (!colEl) return null;
        const status = colEl.getAttribute('data-column-status') as TaskStatus;
        const cardEls = colEl.querySelectorAll('[data-task-id]');
        let index = 0;
        for (let i = 0; i < cardEls.length; i++) {
            const cardId = parseInt(cardEls[i].getAttribute('data-task-id') ?? '0');
            if (cardId === dragTaskRef.current?.id) continue;
            const rect = cardEls[i].getBoundingClientRect();
            if (clientY > rect.top + rect.height / 2) index = i + 1;
        }
        return { status, index };
    };

    const handlePointerDown = (e: React.PointerEvent, task: Task) => {
        if (!isAdmin) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        dragTaskRef.current = task;
        dragStartXRef.current = e.clientX;
        dragStartYRef.current = e.clientY;
        isDraggingRef.current = false;
        dropTargetRef.current = null;
        setDraggingId(task.id);
        setDropIndicator(null);
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!dragTaskRef.current) return;
        const dx = Math.abs(e.clientX - dragStartXRef.current);
        const dy = Math.abs(e.clientY - dragStartYRef.current);
        if (dx > 4 || dy > 4) isDraggingRef.current = true;
        if (!isDraggingRef.current) return;

        const target = computeDropTarget(e.clientX, e.clientY);
        dropTargetRef.current = target;
        setDropIndicator(target);
    };

    const handlePointerUp = async (e: React.PointerEvent) => {
        const task = dragTaskRef.current;
        if (!task) return;

        dragTaskRef.current = null;
        setDraggingId(null);
        setDropIndicator(null);

        if (!isDraggingRef.current) {
            isDraggingRef.current = false;
            dropTargetRef.current = null;
            return;
        }
        isDraggingRef.current = false;

        // Recompute drop target from live event coords (not stale state)
        const target = computeDropTarget(e.clientX, e.clientY);
        dropTargetRef.current = null;
        if (!target) return;

        const newStatus = target.status;
        const targetIndex = target.index;

        // ── Optimistic update ──────────────────────────────────────────────────
        setTasks(prev => {
            // Sort each column the same way we do for rendering
            const sortCol = (status: TaskStatus) =>
                prev.filter(t => t.status === status).sort((a, b) => {
                    if (a.sort_order !== null && b.sort_order !== null) return a.sort_order - b.sort_order;
                    if (a.sort_order !== null) return -1;
                    if (b.sort_order !== null) return 1;
                    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
                });

            const updatedTask = { ...task, status: newStatus };

            // Build new column arrays with the task inserted at the target index
            const newCols: Record<TaskStatus, Task[]> = {
                todo:        sortCol('todo').filter(t => t.id !== task.id),
                in_progress: sortCol('in_progress').filter(t => t.id !== task.id),
                done:        sortCol('done').filter(t => t.id !== task.id),
            };
            const clampedIndex = Math.max(0, Math.min(targetIndex, newCols[newStatus].length));
            newCols[newStatus].splice(clampedIndex, 0, updatedTask);

            // Reassign sort_order within each column and flatten
            return COLUMNS.flatMap(({ status }) =>
                newCols[status].map((t, i) => ({ ...t, sort_order: i }))
            );
        });

        // ── API calls ──────────────────────────────────────────────────────────
        const statusChanged = newStatus !== task.status;
        if (statusChanged) {
            await fetch(`/api/tasks/${task.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: task.title,
                    description: task.description,
                    status: newStatus,
                    priority: task.priority,
                    due_date: task.due_date,
                    due_time: task.due_time,
                }),
            });
        }

        // Persist new sort_orders for the affected column(s)
        // Read from local state snapshot after optimistic update
        setTasks(current => {
            const updates = current
                .filter(t => t.status === newStatus || (statusChanged && t.status === task.status))
                .map(t => ({ id: t.id, sort_order: t.sort_order }));
            fetch('/api/tasks', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ updates }),
            }).catch(console.error);
            return current; // no change to state, just side-effecting
        });
    };

    const handlePointerCancel = () => {
        dragTaskRef.current = null;
        isDraggingRef.current = false;
        dropTargetRef.current = null;
        setDraggingId(null);
        setDropIndicator(null);
    };

    // ── CRUD ──────────────────────────────────────────────────────────────────

    const openCreate = (status: TaskStatus = 'todo') => {
        setEditingId(null);
        setFormData(emptyForm(status));
        setFormOpen(true);
    };

    const openEdit = (task: Task) => {
        setEditingId(task.id);
        setFormData({
            title: task.title,
            description: task.description,
            status: task.status,
            priority: task.priority,
            due_date: task.due_date ?? '',
            due_time: task.due_time ?? '',
        });
        setFormOpen(true);
    };

    const handleSave = async () => {
        const body = {
            ...formData,
            due_date: formData.due_date || null,
            due_time: formData.due_time || null,
        };
        if (editingId !== null) {
            await fetch(`/api/tasks/${editingId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
        } else {
            await fetch('/api/tasks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
        }
        setFormOpen(false);
        await fetchTasks();
    };

    const handleDelete = async (id: number) => {
        await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
        await fetchTasks();
    };

    // ─── Render ───────────────────────────────────────────────────────────────

    return (
        <Box sx={{ height: 'calc(100vh - 72px)', backgroundColor: '#1e2535', color: '#f0e8e8', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

            {/* Header */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 3, py: 2, borderBottom: '1px solid #4a5568', flexShrink: 0 }}>
                <Typography variant="h5" sx={{ fontWeight: 700 }}>Tasks</Typography>
                {isAdmin && (
                    <Button startIcon={<AddIcon />} onClick={() => openCreate()} variant="contained" size="small"
                        sx={{ backgroundColor: '#90b4e8', color: '#1e2535', fontWeight: 600, textTransform: 'none', '&:hover': { backgroundColor: '#64b5f6' } }}>
                        New Task
                    </Button>
                )}
            </Box>

            {/* Kanban columns */}
            {!isAdmin ? (
                <Typography sx={{ color: '#4a5568', fontStyle: 'italic', mt: 4, textAlign: 'center' }}>
                    Sign in to manage tasks.
                </Typography>
            ) : (
                <Box sx={{ flex: 1, display: 'flex', gap: 2, px: 2, py: 2, overflow: 'hidden' }}>
                    {COLUMNS.map(({ status, label, accent }) => {
                        const col = columnTasks(status);
                        const isDragTarget = dropIndicator?.status === status;

                        return (
                            <Box
                                key={status}
                                data-column-status={status}
                                sx={{
                                    flex: 1,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    minWidth: 0,
                                    backgroundColor: '#252f42',
                                    borderRadius: 2,
                                    border: '1px solid',
                                    borderColor: isDragTarget && draggingId !== null ? accent : '#4a5568',
                                    transition: 'border-color 0.15s',
                                    overflow: 'hidden',
                                }}
                            >
                                {/* Column header */}
                                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2, py: 1.5, borderBottom: '1px solid #4a5568', flexShrink: 0 }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <Box sx={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: accent }} />
                                        <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', color: accent }}>
                                            {label}
                                        </Typography>
                                        <Typography sx={{ fontSize: '0.75rem', color: '#4a5568', fontWeight: 600 }}>
                                            {col.length}
                                        </Typography>
                                    </Box>
                                    <Tooltip title={`Add to ${label}`}>
                                        <IconButton size="small" onClick={() => openCreate(status)}
                                            sx={{ color: '#4a5568', p: 0.25, '&:hover': { color: accent } }}>
                                            <AddIcon sx={{ fontSize: 16 }} />
                                        </IconButton>
                                    </Tooltip>
                                </Box>

                                {/* Task list */}
                                <Box sx={{ flex: 1, overflowY: 'auto', px: 1.5, py: 1 }}>
                                    {/* Drop indicator at index 0 */}
                                    {isDragTarget && dropIndicator?.index === 0 && draggingId !== null && (
                                        <Box sx={{ height: 2, backgroundColor: accent, borderRadius: 1, mb: 1, opacity: 0.8 }} />
                                    )}

                                    {col.map((task, idx) => {
                                        const isBeingDragged = draggingId === task.id;
                                        const dueLabel = formatDueDate(task.due_date, task.due_time);
                                        return (
                                            <Box key={task.id}>
                                                <Box
                                                    data-task-id={task.id}
                                                    onPointerDown={e => handlePointerDown(e, task)}
                                                    onPointerMove={handlePointerMove}
                                                    onPointerUp={handlePointerUp}
                                                    onPointerCancel={handlePointerCancel}
                                                    sx={{
                                                        backgroundColor: '#1e2535',
                                                        borderRadius: 1.5,
                                                        p: 1.5,
                                                        mb: 0,
                                                        display: 'flex',
                                                        flexDirection: 'column',
                                                        gap: 0.5,
                                                        opacity: isBeingDragged ? 0.3 : 1,
                                                        cursor: isBeingDragged ? 'grabbing' : 'grab',
                                                        userSelect: 'none',
                                                        touchAction: 'none',
                                                        border: '1px solid #2d3748',
                                                        transition: 'opacity 0.15s',
                                                        '&:hover': { borderColor: '#4a5568' },
                                                    }}
                                                >
                                                    <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 0.5 }}>
                                                        <Typography sx={{
                                                            fontWeight: 700,
                                                            fontSize: '0.88rem',
                                                            color: status === 'done' ? '#718096' : '#f0e8e8',
                                                            textDecoration: status === 'done' ? 'line-through' : 'none',
                                                            lineHeight: 1.3,
                                                            flex: 1,
                                                            minWidth: 0,
                                                        }}>
                                                            {task.title}
                                                        </Typography>
                                                        {isAdmin && (
                                                            <Box sx={{ display: 'flex', flexShrink: 0 }}>
                                                                <Tooltip title="Edit">
                                                                    <IconButton size="small"
                                                                        onPointerDown={e => e.stopPropagation()}
                                                                        onClick={e => { e.stopPropagation(); openEdit(task); }}
                                                                        sx={{ color: '#64b5f6', p: 0.25, '&:hover': { color: '#90b4e8' } }}>
                                                                        <EditIcon sx={{ fontSize: 13 }} />
                                                                    </IconButton>
                                                                </Tooltip>
                                                                <Tooltip title="Delete">
                                                                    <IconButton size="small"
                                                                        onPointerDown={e => e.stopPropagation()}
                                                                        onClick={e => { e.stopPropagation(); handleDelete(task.id); }}
                                                                        sx={{ color: '#e57373', p: 0.25, '&:hover': { color: '#ff5252' } }}>
                                                                        <DeleteIcon sx={{ fontSize: 13 }} />
                                                                    </IconButton>
                                                                </Tooltip>
                                                            </Box>
                                                        )}
                                                    </Box>
                                                    {task.description && (
                                                        <Typography sx={{ color: '#718096', fontSize: '0.75rem', lineHeight: 1.3, overflow: 'hidden', display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2 }}>
                                                            {task.description}
                                                        </Typography>
                                                    )}
                                                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 0.25 }}>
                                                        <Chip label={task.priority} size="small" sx={{
                                                            backgroundColor: `${PRIORITY_COLORS[task.priority]}22`,
                                                            color: PRIORITY_COLORS[task.priority],
                                                            border: `1px solid ${PRIORITY_COLORS[task.priority]}55`,
                                                            fontSize: '0.65rem', height: '18px', textTransform: 'capitalize',
                                                        }} />
                                                        {dueLabel && (
                                                            <Typography sx={{ color: '#4a5568', fontSize: '0.68rem', ml: 0.5 }}>
                                                                {dueLabel}
                                                            </Typography>
                                                        )}
                                                    </Box>
                                                </Box>

                                                {/* Drop indicator after this card */}
                                                {isDragTarget && dropIndicator?.index === idx + 1 && draggingId !== null && (
                                                    <Box sx={{ height: 2, backgroundColor: accent, borderRadius: 1, my: 0.5, opacity: 0.8 }} />
                                                )}

                                                {/* Spacer between cards (only when no drop indicator) */}
                                                {!(isDragTarget && dropIndicator?.index === idx + 1 && draggingId !== null) && (
                                                    <Box sx={{ height: 8 }} />
                                                )}
                                            </Box>
                                        );
                                    })}

                                    {/* Drop indicator at end when column is empty or dropping after all cards */}
                                    {isDragTarget && dropIndicator?.index === col.filter(t => t.id !== draggingId).length && draggingId !== null && col.length > 0 && (
                                        <Box sx={{ height: 2, backgroundColor: accent, borderRadius: 1, mt: 0.5, opacity: 0.8 }} />
                                    )}

                                    {col.length === 0 && draggingId === null && (
                                        <Typography sx={{ color: '#3a4255', fontSize: '0.78rem', fontStyle: 'italic', textAlign: 'center', mt: 2 }}>
                                            No tasks
                                        </Typography>
                                    )}
                                </Box>
                            </Box>
                        );
                    })}
                </Box>
            )}

            {/* Form modal */}
            {isAdmin && formOpen && (
                <Box sx={{
                    position: 'fixed', left: '50%', top: '50%', transform: 'translate(-50%, -50%)',
                    zIndex: 1300, width: { xs: '95vw', sm: '400px', lg: '480px' }, maxHeight: '90vh', overflowY: 'auto',
                    backgroundColor: '#2d3748', color: '#f0e8e8', borderRadius: '8px',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.6)', border: '1px solid #4a5568',
                }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2, py: 1.5, borderBottom: '1px solid #4a5568' }}>
                        <Typography sx={{ fontWeight: 600, fontSize: { xs: '1rem', lg: '1.1rem' } }}>
                            {editingId !== null ? 'Edit Task' : 'New Task'}
                        </Typography>
                        <IconButton size="small" onClick={() => setFormOpen(false)} sx={{ color: '#718096' }}>
                            <CloseIcon fontSize="small" />
                        </IconButton>
                    </Box>

                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, p: { xs: 2, lg: 2.5 }, userSelect: 'text' }}>
                        <TextField label="Title" value={formData.title}
                            onChange={e => setFormData(f => ({ ...f, title: e.target.value }))}
                            fullWidth size="small" autoFocus
                            InputLabelProps={{ sx: { color: '#aaa' } }} inputProps={{ style: { color: '#f0e8e8' } }} sx={inputSx} />
                        <TextField label="Description" value={formData.description}
                            onChange={e => setFormData(f => ({ ...f, description: e.target.value }))}
                            multiline rows={3} fullWidth size="small"
                            InputLabelProps={{ sx: { color: '#aaa' } }} inputProps={{ style: { color: '#f0e8e8' } }} sx={inputSx} />
                        <Box sx={{ display: 'flex', gap: 2 }}>
                            <FormControl size="small" fullWidth sx={inputSx}>
                                <InputLabel sx={{ color: '#aaa' }}>Status</InputLabel>
                                <Select value={formData.status} onChange={e => setFormData(f => ({ ...f, status: e.target.value as TaskStatus }))} label="Status" sx={{ color: '#f0e8e8' }}>
                                    <MenuItem value="todo">Todo</MenuItem>
                                    <MenuItem value="in_progress">In Progress</MenuItem>
                                    <MenuItem value="done">Done</MenuItem>
                                </Select>
                            </FormControl>
                            <FormControl size="small" fullWidth sx={inputSx}>
                                <InputLabel sx={{ color: '#aaa' }}>Priority</InputLabel>
                                <Select value={formData.priority} onChange={e => setFormData(f => ({ ...f, priority: e.target.value as Task['priority'] }))} label="Priority" sx={{ color: '#f0e8e8' }}>
                                    <MenuItem value="low">Low</MenuItem>
                                    <MenuItem value="medium">Medium</MenuItem>
                                    <MenuItem value="high">High</MenuItem>
                                </Select>
                            </FormControl>
                        </Box>
                        <Box sx={{ display: 'flex', gap: 2 }}>
                            <TextField label="Due Date" type="date" value={formData.due_date}
                                onChange={e => setFormData(f => ({ ...f, due_date: e.target.value }))}
                                size="small" fullWidth InputLabelProps={{ shrink: true, sx: { color: '#aaa' } }}
                                inputProps={{ style: { color: '#f0e8e8' } }} sx={inputSx} />
                            <TextField label="Due Time" type="time" value={formData.due_time}
                                onChange={e => setFormData(f => ({ ...f, due_time: e.target.value }))}
                                size="small" fullWidth InputLabelProps={{ shrink: true, sx: { color: '#aaa' } }}
                                inputProps={{ style: { color: '#f0e8e8' } }} sx={inputSx} />
                        </Box>
                    </Box>

                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, px: { xs: 2, lg: 2.5 }, pb: { xs: 2, lg: 2.5 } }}>
                        <Button onClick={() => setFormOpen(false)} sx={{ color: '#aaa', textTransform: 'none' }}>Cancel</Button>
                        <Button onClick={handleSave} disabled={!formData.title} variant="contained"
                            sx={{ backgroundColor: '#90b4e8', color: '#1e2535', textTransform: 'none', fontWeight: 600, '&:hover': { backgroundColor: '#64b5f6' } }}>
                            Save
                        </Button>
                    </Box>
                </Box>
            )}
        </Box>
    );
}
