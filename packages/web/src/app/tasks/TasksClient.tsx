'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
    Box, Typography, IconButton, Button,
    TextField, Select, MenuItem, FormControl, InputLabel, Tooltip,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import CloseIcon from '@mui/icons-material/Close';

// ─── Types ────────────────────────────────────────────────────────────────────

type Task = {
    id: number;
    title: string;
    description: string;
    status: 'todo' | 'in_progress' | 'done';
    due_date: string | null;
    due_time: string | null;
    sort_order: number | null;
    created_at: string;
};

type TaskDragState = { id: number; originalIndex: number; deltaY: number; isDragging: boolean };

type TaskFilter = 'all' | 'todo' | 'in_progress' | 'done';

type FormData = {
    title: string;
    description: string;
    status: 'todo' | 'in_progress' | 'done';
    due_date: string;
    due_time: string;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const FILTER_LABELS: Record<TaskFilter, string> = {
    all: 'All',
    todo: 'Todo',
    in_progress: 'In Progress',
    done: 'Done',
};

const STATUS_FILTERS: TaskFilter[] = ['todo', 'in_progress', 'done'];

const inputSx = {
    '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: '#4a5568' } },
    '& .MuiInputLabel-root': { color: '#aaa', fontSize: { xs: '0.875rem', lg: '1rem' } },
    // 16px is not cosmetic: iOS Safari force-zooms the whole page whenever a focused
    // input computes to less than 16px. Anything smaller here re-introduces that zoom.
    '& .MuiInputBase-input': { fontSize: { xs: '16px', lg: '1rem' } },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TASK_ROW_HEIGHT = 72;

function emptyForm(): FormData {
    return { title: '', description: '', status: 'todo', due_date: '', due_time: '' };
}

function moveItem<T>(arr: T[], from: number, to: number): T[] {
    const result = [...arr];
    const [item] = result.splice(from, 1);
    result.splice(to, 0, item);
    return result;
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

export function TasksClient({ canEdit }: { canEdit: boolean }) {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [filter, setFilter] = useState<TaskFilter>('all');
    const [formOpen, setFormOpen] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [formData, setFormData] = useState<FormData>(emptyForm());
    const [taskDrag, setTaskDrag] = useState<TaskDragState | null>(null);
    const taskDragStartY = useRef(0);

    // Tab-drop state — ref for event handler, state for visual highlight
    const hoverTabRef = useRef<Task['status'] | null>(null);
    const [hoverTab, setHoverTab] = useState<Task['status'] | null>(null);

    const fetchTasks = useCallback(async () => {
        try {
            const res = await fetch('/api/tasks');
            if (!res.ok) { setTasks([]); return; }
            const data = await res.json();
            setTasks(data.tasks ?? []);
        } catch {
            setTasks([]);
        }
    }, []);

    useEffect(() => {
        if (canEdit) fetchTasks();
    }, [canEdit, fetchTasks]);

    const filtered = filter === 'all' ? tasks : tasks.filter(t => t.status === filter);

    const displayedTasks = (() => {
        if (!taskDrag?.isDragging) return filtered;
        const toIdx = Math.max(0, Math.min(filtered.length - 1,
            taskDrag.originalIndex + Math.round(taskDrag.deltaY / TASK_ROW_HEIGHT)));
        return moveItem(filtered, taskDrag.originalIndex, toIdx);
    })();

    const handleTaskDragStart = (e: React.PointerEvent, taskId: number, index: number) => {
        e.stopPropagation();
        e.currentTarget.setPointerCapture(e.pointerId);
        taskDragStartY.current = e.clientY;
        hoverTabRef.current = null;
        setTaskDrag({ id: taskId, originalIndex: index, deltaY: 0, isDragging: false });
    };

    const handleTaskDragMove = (e: React.PointerEvent) => {
        if (!taskDrag) return;
        const deltaY = e.clientY - taskDragStartY.current;
        setTaskDrag(prev => prev ? { ...prev, deltaY, isDragging: prev.isDragging || Math.abs(deltaY) > 4 } : null);

        // Detect if the pointer is hovering over a status tab
        const el = document.elementFromPoint(e.clientX, e.clientY);
        const tabEl = el?.closest('[data-status-tab]');
        const tab = (tabEl?.getAttribute('data-status-tab') as Task['status']) ?? null;
        if (tab !== hoverTabRef.current) {
            hoverTabRef.current = tab;
            setHoverTab(tab);
        }
    };

    const handleTaskDragEnd = async () => {
        if (!taskDrag) return;

        const tab = hoverTabRef.current;
        hoverTabRef.current = null;
        setHoverTab(null);

        if (!taskDrag.isDragging) { setTaskDrag(null); return; }

        // ── Drop on a status tab → change status ──────────────────────────────
        if (tab) {
            const draggedId = taskDrag.id;
            setTaskDrag(null);

            // Optimistic: update status immediately
            setTasks(prev => prev.map(t => t.id === draggedId ? { ...t, status: tab } : t));
            setFilter(tab); // jump to the target tab so user sees it land

            const draggedTask = tasks.find(t => t.id === draggedId);
            if (draggedTask) {
                await fetch(`/api/tasks/${draggedId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        title: draggedTask.title,
                        description: draggedTask.description,
                        status: tab,
                        due_date: draggedTask.due_date,
                        due_time: draggedTask.due_time,
                    }),
                });
            }
            return;
        }

        // ── Normal reorder within list ─────────────────────────────────────────
        const toIdx = Math.max(0, Math.min(filtered.length - 1,
            taskDrag.originalIndex + Math.round(taskDrag.deltaY / TASK_ROW_HEIGHT)));
        const reordered = moveItem(filtered, taskDrag.originalIndex, toIdx);
        const reorderedWithOrder = reordered.map((t, i) => ({ ...t, sort_order: i }));

        const reorderedMap = new Map(reorderedWithOrder.map(t => [t.id, t]));
        setTasks(prev => {
            const queue = [...reorderedWithOrder];
            let qi = 0;
            return prev.map(t => reorderedMap.has(t.id) ? queue[qi++] : t);
        });
        setTaskDrag(null);

        await fetch('/api/tasks', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ updates: reordered.map((t, i) => ({ id: t.id, sort_order: i })) }),
        });
    };

    // ── Form helpers ──

    const openCreate = () => {
        setEditingId(null);
        setFormData(emptyForm());
        setFormOpen(true);
    };

    const openEdit = (task: Task) => {
        setEditingId(task.id);
        setFormData({
            title: task.title,
            description: task.description,
            status: task.status,
            due_date: task.due_date ?? '',
            due_time: task.due_time ?? '',
        });
        setFormOpen(true);
    };

    // ── CRUD ──

    const handleSave = async () => {
        const body = {
            ...formData,
            due_date: formData.due_date || null,
            due_time: formData.due_time || null,
        };
        let res: Response;
        if (editingId !== null) {
            res = await fetch(`/api/tasks/${editingId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
        } else {
            res = await fetch('/api/tasks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
        }
        if (!res.ok) return;
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
                {canEdit && (
                    <Button
                        startIcon={<AddIcon />}
                        onClick={openCreate}
                        variant="contained"
                        size="small"
                        sx={{ backgroundColor: '#90b4e8', color: '#1e2535', fontWeight: 600, textTransform: 'none', '&:hover': { backgroundColor: '#64b5f6' } }}
                    >
                        New Task
                    </Button>
                )}
            </Box>

            {/* Filter tabs */}
            <Box sx={{ display: 'flex', gap: 0.5, px: 3, pt: 2, pb: 1, flexShrink: 0 }}>
                {(['all', 'todo', 'in_progress', 'done'] as TaskFilter[]).map(f => {
                    const isStatusTab = STATUS_FILTERS.includes(f as Task['status']);
                    const isHovered = hoverTab === f && taskDrag?.isDragging;
                    return (
                        <Button
                            key={f}
                            onClick={() => setFilter(f)}
                            {...(isStatusTab ? { 'data-status-tab': f } : {})}
                            sx={{
                                color: filter === f ? '#90b4e8' : isHovered ? '#f0e8e8' : '#718096',
                                textTransform: 'none',
                                fontWeight: filter === f || isHovered ? 700 : 400,
                                fontSize: { xs: '0.8rem', lg: '0.95rem' },
                                borderBottom: filter === f
                                    ? '2px solid #90b4e8'
                                    : isHovered
                                    ? '2px solid #64b5f6'
                                    : '2px solid transparent',
                                borderRadius: 0,
                                px: { xs: 1.5, lg: 2 },
                                backgroundColor: isHovered ? 'rgba(100,181,246,0.12)' : 'transparent',
                                transition: 'background-color 0.1s, border-color 0.1s, color 0.1s',
                                '&:hover': { color: '#90b4e8' },
                            }}
                        >
                            {FILTER_LABELS[f]}
                        </Button>
                    );
                })}
            </Box>

            {/* Task list */}
            <Box sx={{ flex: 1, overflowY: 'auto', px: 3, pb: 3 }}>
                {!canEdit && tasks.length === 0 ? (
                    <Typography sx={{ color: '#4a5568', fontStyle: 'italic', mt: 4, textAlign: 'center' }}>
                        Sign in to manage tasks.
                    </Typography>
                ) : filtered.length === 0 ? (
                    <Typography sx={{ color: '#4a5568', fontStyle: 'italic', mt: 4, textAlign: 'center' }}>
                        No tasks here.
                    </Typography>
                ) : (
                    displayedTasks.map((task, index) => {
                        const dueLabel = formatDueDate(task.due_date, task.due_time);
                        const isBeingDragged = taskDrag?.id === task.id && taskDrag.isDragging;
                        return (
                            <Box
                                key={task.id}
                                onPointerDown={canEdit ? e => handleTaskDragStart(e, task.id, index) : undefined}
                                onPointerMove={canEdit ? handleTaskDragMove : undefined}
                                onPointerUp={canEdit ? handleTaskDragEnd : undefined}
                                onPointerCancel={canEdit ? () => { setTaskDrag(null); hoverTabRef.current = null; setHoverTab(null); } : undefined}
                                sx={{
                                    backgroundColor: '#252f42',
                                    borderRadius: 2,
                                    p: { xs: 2, lg: 2.5 },
                                    mb: { xs: 1, lg: 1.5 },
                                    display: 'flex',
                                    alignItems: 'flex-start',
                                    gap: { xs: 1, lg: 1.5 },
                                    opacity: isBeingDragged ? 0.5 : 1,
                                    outline: isBeingDragged ? '1px solid #64b5f6' : 'none',
                                    transition: taskDrag?.isDragging ? 'none' : 'opacity 0.2s',
                                    cursor: canEdit ? (taskDrag?.isDragging ? 'grabbing' : 'grab') : 'default',
                                    userSelect: 'none',
                                }}
                            >
                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                    <Typography sx={{
                                        fontWeight: 700,
                                        fontSize: { xs: '0.95rem', lg: '1.05rem' },
                                        color: '#f0e8e8',
                                    }}>
                                        {task.title}
                                    </Typography>
                                    {task.description && (
                                        <Typography sx={{
                                            color: '#aaa',
                                            fontSize: { xs: '0.8rem', lg: '0.875rem' },
                                            mt: 0.25,
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap',
                                        }}>
                                            {task.description}
                                        </Typography>
                                    )}
                                </Box>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
                                    {dueLabel && (
                                        <Typography sx={{ color: '#aaa', fontSize: { xs: '0.78rem', lg: '0.85rem' }, whiteSpace: 'nowrap' }}>
                                            {dueLabel}
                                        </Typography>
                                    )}
                                    {canEdit && (
                                        <>
                                            <Tooltip title="Edit">
                                                <IconButton onPointerDown={e => e.stopPropagation()} onClick={() => openEdit(task)} sx={{ color: '#64b5f6', p: { xs: 0.5, lg: 0.75 } }}>
                                                    <EditIcon sx={{ fontSize: { xs: '1rem', lg: '1.25rem' } }} />
                                                </IconButton>
                                            </Tooltip>
                                            <Tooltip title="Delete">
                                                <IconButton onPointerDown={e => e.stopPropagation()} onClick={() => handleDelete(task.id)} sx={{ color: '#e57373', p: { xs: 0.5, lg: 0.75 } }}>
                                                    <DeleteIcon sx={{ fontSize: { xs: '1rem', lg: '1.25rem' } }} />
                                                </IconButton>
                                            </Tooltip>
                                        </>
                                    )}
                                </Box>
                            </Box>
                        );
                    })
                )}
            </Box>

            {/* Form modal — bottom sheet on phones, centered dialog from sm up */}
            {canEdit && formOpen && (
                <>
                <Box
                    onClick={() => setFormOpen(false)}
                    sx={{ position: 'fixed', inset: 0, zIndex: 1299, backgroundColor: 'rgba(0,0,0,0.5)' }}
                />
                <Box sx={{
                    position: 'fixed',
                    zIndex: 1300,
                    // Phones: pin to the bottom edge so the sheet grows upward and the
                    // keyboard never pushes it off-centre. Centred dialog from sm up.
                    left: { xs: 0, sm: '50%' },
                    right: { xs: 0, sm: 'auto' },
                    bottom: { xs: 0, sm: 'auto' },
                    top: { xs: 'auto', sm: '50%' },
                    transform: { xs: 'none', sm: 'translate(-50%, -50%)' },
                    width: { xs: 'auto', sm: '400px', lg: '480px' },
                    // dvh, not vh: iOS reports vh against the URL-bar-retracted viewport,
                    // so a vh-sized sheet overflows the actually-visible area.
                    maxHeight: { xs: '85dvh', sm: '90dvh' },
                    overflowY: 'auto',
                    WebkitOverflowScrolling: 'touch',
                    backgroundColor: '#2d3748',
                    color: '#f0e8e8',
                    borderRadius: { xs: '12px 12px 0 0', sm: '8px' },
                    boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
                    border: '1px solid #4a5568',
                }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2, py: 1.5, borderBottom: '1px solid #4a5568', borderRadius: '8px 8px 0 0' }}>
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
                            multiline minRows={2} maxRows={4} fullWidth size="small"
                            InputLabelProps={{ sx: { color: '#aaa' } }} inputProps={{ style: { color: '#f0e8e8' } }} sx={inputSx} />
                        <FormControl size="small" fullWidth sx={inputSx}>
                            <InputLabel sx={{ color: '#aaa' }}>Status</InputLabel>
                            <Select value={formData.status} onChange={e => setFormData(f => ({ ...f, status: e.target.value as Task['status'] }))} label="Status" sx={{ color: '#f0e8e8' }}>
                                <MenuItem value="todo">Todo</MenuItem>
                                <MenuItem value="in_progress">In Progress</MenuItem>
                                <MenuItem value="done">Done</MenuItem>
                            </Select>
                        </FormControl>
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

                    <Box sx={{
                        display: 'flex', justifyContent: 'flex-end', gap: 1, px: { xs: 2, lg: 2.5 },
                        // viewportFit: 'cover' in layout.tsx means the sheet runs under the
                        // home indicator; without this inset the buttons sit beneath it.
                        pb: { xs: 'calc(16px + env(safe-area-inset-bottom))', lg: 2.5 },
                    }}>
                        <Button onClick={() => setFormOpen(false)} sx={{ color: '#aaa', textTransform: 'none', fontSize: { xs: '0.875rem', lg: '1rem' } }}>Cancel</Button>
                        <Button onClick={handleSave} disabled={!formData.title} variant="contained"
                            sx={{ backgroundColor: '#90b4e8', color: '#1e2535', textTransform: 'none', fontWeight: 600, fontSize: { xs: '0.875rem', lg: '1rem' }, '&:hover': { backgroundColor: '#64b5f6' } }}>
                            Save
                        </Button>
                    </Box>
                </Box>
                </>
            )}
        </Box>
    );
}
