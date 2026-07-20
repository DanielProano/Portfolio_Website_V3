'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
    Box, Typography, IconButton, Button, TextField, Tooltip,
} from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import CloseIcon from '@mui/icons-material/Close';
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank';
import CheckBoxIcon from '@mui/icons-material/CheckBox';
import AddTaskIcon from '@mui/icons-material/AddTask';

// ─── Types ────────────────────────────────────────────────────────────────────

type CalendarEvent = {
    id: number;
    title: string;
    description?: string;
    start_time: string;
    end_time: string;
    color: string;
};

type CalendarTask = {
    id: number;
    title: string;
    status: 'todo' | 'in_progress' | 'done';
    priority: 'low' | 'medium' | 'high';
    due_date: string;
    due_time: string | null;
};

const TASK_PRIORITY_COLORS: Record<string, string> = {
    low: '#81c784',
    medium: '#ffb74d',
    high: '#e57373',
};

type FormData = {
    title: string;
    date: string;
    startTime: string;
    endTime: string;
    description: string;
    color: string;
};

type EventDrag = {
    event: CalendarEvent;
    pointerStartY: number;
    isDragging: boolean;
    deltaY: number;
    resizeEdge: 'top' | 'bottom' | null;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const DAY_START = 6;
const DAY_END = 23;
const LABEL_WIDTH = 56;

const EVENT_COLORS = [
    '#64b5f6', '#81c784', '#e57373', '#ffb74d',
    '#ba68c8', '#4dd0e1', '#fff176', '#f06292',
];

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isSameDay(a: Date, b: Date) {
    return a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate();
}

function formatTime(iso: string) {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDateInput(d: Date) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getMonthCells(year: number, month: number): (number | null)[] {
    const firstDow = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    return [
        ...Array(firstDow).fill(null),
        ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
    ];
}

function getEventTop(event: CalendarEvent, hourHeight: number): number {
    const start = new Date(event.start_time);
    return (start.getHours() + start.getMinutes() / 60 - DAY_START) * hourHeight;
}

function getEventHeight(event: CalendarEvent, hourHeight: number): number {
    const start = new Date(event.start_time);
    const end = new Date(event.end_time);
    const startDec = start.getHours() + start.getMinutes() / 60;
    const endDec = end.getHours() + end.getMinutes() / 60;
    return Math.max((endDec - startDec) * hourHeight - 2, 20);
}

function formatDueTimeStr(hhmm: string): string {
    const [h, m] = hhmm.split(':').map(Number);
    const period = h >= 12 ? 'PM' : 'AM';
    const displayH = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${displayH}:${String(m).padStart(2, '0')} ${period}`;
}

function formatUpcomingDate(iso: string): string {
    const d = new Date(iso);
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    if (isSameDay(d, now)) return `Today · ${formatTime(iso)}`;
    if (isSameDay(d, tomorrow)) return `Tomorrow · ${formatTime(iso)}`;
    return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }) + ' · ' + formatTime(iso);
}

function emptyForm(date: Date, startH = 9, startM = 0): FormData {
    const endH = Math.min(startH + 1, DAY_END - 1);
    return {
        title: '',
        date: formatDateInput(date),
        startTime: `${String(startH).padStart(2, '0')}:${String(startM).padStart(2, '0')}`,
        endTime: `${String(endH).padStart(2, '0')}:${String(startM).padStart(2, '0')}`,
        description: '',
        color: EVENT_COLORS[0],
    };
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CalendarClient({ isAdmin }: { isAdmin: boolean }) {
    const router = useRouter();
    const today = new Date();
    const [viewMonth, setViewMonth] = useState(today);
    const [selectedDay, setSelectedDay] = useState(today);
    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [tasks, setTasks] = useState<CalendarTask[]>([]);
    const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
    const [formOpen, setFormOpen] = useState(false);
    const [formData, setFormData] = useState<FormData>(emptyForm(today));
    const [editingId, setEditingId] = useState<number | null>(null);
    const [eventDrag, setEventDrag] = useState<EventDrag | null>(null);
    const [taskCreatedId, setTaskCreatedId] = useState<number | null>(null);
    const [quickNotes, setQuickNotes] = useState('');
    const [hourHeight, setHourHeight] = useState(44);
    const [dragDropDay, setDragDropDay] = useState<Date | null>(null);
    const [upcomingTasks, setUpcomingTasks] = useState<CalendarTask[]>([]);

    const timelineScrollRef = useRef<HTMLDivElement>(null);
    const saveDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const selectedEventRef = useRef<CalendarEvent | null>(null);
    const quickEditsRef = useRef<{ notes: string; eventId: number } | null>(null);

    // Prevents timeline click from firing a create-form open right after a drag ends
    const dragJustEndedRef = useRef(false);

    const fetchEvents = useCallback(async (year: number, month: number) => {
        try {
            const res = await fetch(`/api/calendar?year=${year}&month=${month + 1}`);
            if (!res.ok) { setEvents([]); setTasks([]); return; }
            const data = await res.json();
            setEvents(data.events ?? []);
            setTasks(data.tasks ?? []);
        } catch {
            setEvents([]);
            setTasks([]);
        }
    }, []);

    useEffect(() => {
        fetchEvents(viewMonth.getFullYear(), viewMonth.getMonth());
    }, [viewMonth, fetchEvents]);

    const fetchUpcomingTasks = useCallback(async () => {
        try {
            const now = new Date();
            const from = formatDateInput(now);
            const twoMonthsOut = new Date(now.getFullYear(), now.getMonth() + 2, now.getDate());
            const to = formatDateInput(twoMonthsOut);
            const res = await fetch(`/api/tasks?from=${from}&to=${to}`);
            if (!res.ok) { setUpcomingTasks([]); return; }
            const data = await res.json();
            setUpcomingTasks((data.tasks ?? []).filter((t: CalendarTask) => t.status !== 'done'));
        } catch {
            setUpcomingTasks([]);
        }
    }, []);

    useEffect(() => { fetchUpcomingTasks(); }, [fetchUpcomingTasks]);

    // Keep ref in sync so debounced saves always use the latest event data
    useEffect(() => { selectedEventRef.current = selectedEvent; }, [selectedEvent]);

    // Reset quick-edit notes when switching to a different event (not on every re-render)
    useEffect(() => {
        if (selectedEvent) {
            setQuickNotes(selectedEvent.description ?? '');
            quickEditsRef.current = { notes: selectedEvent.description ?? '', eventId: selectedEvent.id };
        } else {
            quickEditsRef.current = null;
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedEvent?.id]);

    // Fit all hours into the container with no scrolling
    useEffect(() => {
        const el = timelineScrollRef.current;
        if (!el) return;
        const update = () => {
            const h = el.clientHeight;
            if (h > 0) setHourHeight(Math.max(28, Math.floor(h / (DAY_END - DAY_START))));
        };
        update();
        const ro = new ResizeObserver(update);
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    const dayEvents = events.filter(e => isSameDay(new Date(e.start_time), selectedDay));

    // ── Month navigation ──

    const prevMonth = () => setViewMonth(d => new Date(d.getFullYear(), d.getMonth() - 1, 1));
    const nextMonth = () => setViewMonth(d => new Date(d.getFullYear(), d.getMonth() + 1, 1));

    const handleDayClick = (day: number) => {
        setSelectedDay(new Date(viewMonth.getFullYear(), viewMonth.getMonth(), day));
        setSelectedEvent(null);
    };

    // ── Timeline click → open create form at click position ──

    const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!isAdmin || dragJustEndedRef.current || !timelineScrollRef.current) return;

        const rect = timelineScrollRef.current.getBoundingClientRect();
        const relY = e.clientY - rect.top + timelineScrollRef.current.scrollTop;

        // Snap to nearest 15-minute slot
        const rawMinutes = (relY / hourHeight) * 60;
        const snappedMinutes = Math.round(rawMinutes / 15) * 15;
        const hour = Math.floor(snappedMinutes / 60) + DAY_START;
        const minute = snappedMinutes % 60;
        const clampedHour = Math.max(DAY_START, Math.min(DAY_END - 1, hour));

        setEditingId(null);
        setFormData(emptyForm(selectedDay, clampedHour, minute));
        setFormOpen(true);
    };

    // ── Admin CRUD ──

    const handleNotesChange = (value: string) => {
        setQuickNotes(value);
        if (quickEditsRef.current) quickEditsRef.current.notes = value;
        const id = selectedEventRef.current?.id;
        if (id) {
            setEvents(prev => prev.map(e => e.id === id ? { ...e, description: value } : e));
            setSelectedEvent(prev => prev ? { ...prev, description: value } : null);
        }
        if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current);
        saveDebounceRef.current = setTimeout(async () => {
            const ev = selectedEventRef.current;
            const q = quickEditsRef.current;
            if (!ev || !q || q.eventId !== ev.id) return;
            await fetch(`/api/calendar/${ev.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: ev.title,
                    description: q.notes,
                    start_time: ev.start_time,
                    end_time: ev.end_time,
                    color: ev.color,
                }),
            });
        }, 800);
    };

    const openEdit = (event: CalendarEvent) => {
        const start = new Date(event.start_time);
        const end = new Date(event.end_time);
        setEditingId(event.id);
        setFormData({
            title: event.title,
            date: formatDateInput(start),
            startTime: `${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}`,
            endTime: `${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`,
            description: event.description ?? '',
            color: event.color,
        });
        setFormOpen(true);
    };

    const handleSave = async () => {
        const [h1, m1] = formData.startTime.split(':').map(Number);
        const [h2, m2] = formData.endTime.split(':').map(Number);
        // Parse date as local midnight — new Date("YYYY-MM-DD") would be UTC midnight,
        // which shifts the date backwards for UTC- timezones.
        const [dy, dm, dd] = formData.date.split('-').map(Number);
        const start = new Date(dy, dm - 1, dd, h1, m1, 0, 0);
        const end = new Date(dy, dm - 1, dd, h2, m2, 0, 0);

        const body = {
            title: formData.title,
            description: formData.description,
            start_time: start.toISOString(),
            end_time: end.toISOString(),
            color: formData.color,
        };

        // Optimistic update: show the change immediately before the round trip completes.
        // fetchEvents below reconciles the server state (e.g. replaces the temp ID on creates).
        setFormOpen(false);
        setSelectedEvent(null);
        if (editingId !== null) {
            setEvents(prev => prev.map(e => e.id === editingId ? { ...e, ...body } : e));
        } else {
            setEvents(prev => [...prev, { id: -1, ...body }]);
        }

        let res: Response;
        if (editingId !== null) {
            res = await fetch(`/api/calendar/${editingId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
        } else {
            res = await fetch('/api/calendar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
        }

        // Always reconcile — reverts on failure, assigns real ID on create
        await fetchEvents(viewMonth.getFullYear(), viewMonth.getMonth());
    };

    const handleCreateTaskFromEvent = async (event: CalendarEvent) => {
        const start = new Date(event.start_time);
        const dateStr = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`;
        const timeStr = `${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}`;
        const res = await fetch('/api/tasks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title: event.title,
                description: event.description ?? '',
                status: 'todo',
                priority: 'medium',
                due_date: dateStr,
                due_time: timeStr,
            }),
        });
        if (res.ok) {
            setTaskCreatedId(event.id);
            setTimeout(() => setTaskCreatedId(null), 2000);
            await fetchEvents(viewMonth.getFullYear(), viewMonth.getMonth());
        }
    };

    const handleDelete = async (id: number) => {
        await fetch(`/api/calendar/${id}`, { method: 'DELETE' });
        setSelectedEvent(null);
        await fetchEvents(viewMonth.getFullYear(), viewMonth.getMonth());
    };

    // ── Event drag to reschedule ──

    const handleEventPointerDown = (e: React.PointerEvent, event: CalendarEvent) => {
        if (!isAdmin) return;
        e.stopPropagation();
        e.currentTarget.setPointerCapture(e.pointerId);
        const rect = e.currentTarget.getBoundingClientRect();
        const relY = e.clientY - rect.top;
        const ZONE = 8;
        const resizeEdge = relY <= ZONE ? 'top' as const : relY >= rect.height - ZONE ? 'bottom' as const : null;
        setEventDrag({ event, pointerStartY: e.clientY, isDragging: false, deltaY: 0, resizeEdge });
    };

    const handleEventPointerMove = (e: React.PointerEvent) => {
        if (!eventDrag) return;
        const deltaY = e.clientY - eventDrag.pointerStartY;
        setEventDrag(prev => prev ? { ...prev, deltaY, isDragging: prev.isDragging || Math.abs(deltaY) > 6 } : null);

        // Detect when the pointer is hovering over a month-grid day cell (cross-day drop)
        if (eventDrag.resizeEdge === null) {
            const el = document.elementFromPoint(e.clientX, e.clientY);
            const dropEl = el ? el.closest('[data-drop-date]') : null;
            const dateStr = dropEl?.getAttribute('data-drop-date') ?? null;
            if (dateStr) {
                const [y, mo, d] = dateStr.split('-').map(Number);
                setDragDropDay(new Date(y, mo - 1, d));
            } else {
                setDragDropDay(null);
            }
        }
    };

    const handleEventPointerUp = async (e: React.PointerEvent) => {
        if (!eventDrag) return;

        if (!eventDrag.isDragging) {
            setSelectedEvent(eventDrag.event);
            setEventDrag(null);
            setDragDropDay(null);
            return;
        }

        dragJustEndedRef.current = true;
        setTimeout(() => { dragJustEndedRef.current = false; }, 100);

        // Cross-day drop: move event to the hovered month-grid day at 12pm
        if (dragDropDay && eventDrag.resizeEdge === null) {
            const origStart = new Date(eventDrag.event.start_time);
            const origEnd = new Date(eventDrag.event.end_time);
            const duration = origEnd.getTime() - origStart.getTime();
            const newStart = new Date(dragDropDay.getFullYear(), dragDropDay.getMonth(), dragDropDay.getDate(), 12, 0, 0);
            const newEnd = new Date(newStart.getTime() + duration);
            setEvents(prev => prev.map(ev =>
                ev.id === eventDrag.event.id
                    ? { ...ev, start_time: newStart.toISOString(), end_time: newEnd.toISOString() }
                    : ev
            ));
            setSelectedDay(dragDropDay);
            setDragDropDay(null);
            setEventDrag(null);
            await fetch(`/api/calendar/${eventDrag.event.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: eventDrag.event.title,
                    description: eventDrag.event.description,
                    start_time: newStart.toISOString(),
                    end_time: newEnd.toISOString(),
                    color: eventDrag.event.color,
                }),
            });
            await fetchEvents(viewMonth.getFullYear(), viewMonth.getMonth());
            return;
        }

        setDragDropDay(null);

        const deltaMinutes = Math.round((eventDrag.deltaY / hourHeight) * 60 / 15) * 15;
        const origStart = new Date(eventDrag.event.start_time);
        const origEnd = new Date(eventDrag.event.end_time);
        const duration = origEnd.getTime() - origStart.getTime();
        const dayMin = new Date(origStart); dayMin.setHours(DAY_START, 0, 0, 0);
        const dayMax = new Date(origStart); dayMax.setHours(DAY_END, 0, 0, 0);

        const putEvent = (start_time: string, end_time: string) =>
            fetch(`/api/calendar/${eventDrag.event.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: eventDrag.event.title,
                    description: eventDrag.event.description,
                    start_time,
                    end_time,
                    color: eventDrag.event.color,
                }),
            });

        if (eventDrag.resizeEdge === 'bottom') {
            const newEnd = new Date(origEnd.getTime() + deltaMinutes * 60 * 1000);
            if (newEnd > origStart && newEnd <= dayMax) {
                setEvents(prev => prev.map(ev =>
                    ev.id === eventDrag.event.id ? { ...ev, end_time: newEnd.toISOString() } : ev
                ));
                setEventDrag(null);
                await putEvent(eventDrag.event.start_time, newEnd.toISOString());
                await fetchEvents(viewMonth.getFullYear(), viewMonth.getMonth());
            } else {
                setEventDrag(null);
            }
        } else if (eventDrag.resizeEdge === 'top') {
            const newStart = new Date(origStart.getTime() + deltaMinutes * 60 * 1000);
            if (newStart < origEnd && newStart >= dayMin) {
                setEvents(prev => prev.map(ev =>
                    ev.id === eventDrag.event.id ? { ...ev, start_time: newStart.toISOString() } : ev
                ));
                setEventDrag(null);
                await putEvent(newStart.toISOString(), eventDrag.event.end_time);
                await fetchEvents(viewMonth.getFullYear(), viewMonth.getMonth());
            } else {
                setEventDrag(null);
            }
        } else {
            const newStart = new Date(origStart.getTime() + deltaMinutes * 60 * 1000);
            const newEnd = new Date(newStart.getTime() + duration);
            if (newStart >= dayMin && newEnd <= dayMax) {
                setEvents(prev => prev.map(ev =>
                    ev.id === eventDrag.event.id
                        ? { ...ev, start_time: newStart.toISOString(), end_time: newEnd.toISOString() }
                        : ev
                ));
                setEventDrag(null);
                await putEvent(newStart.toISOString(), newEnd.toISOString());
                await fetchEvents(viewMonth.getFullYear(), viewMonth.getMonth());
            } else {
                setEventDrag(null);
            }
        }
    };

    // ── Cells / hours ──

    const cells = getMonthCells(viewMonth.getFullYear(), viewMonth.getMonth());
    const hours = Array.from({ length: DAY_END - DAY_START }, (_, i) => DAY_START + i);

    const now = new Date();
    const upcomingEvents = events
        .filter(e => new Date(e.start_time) >= now)
        .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
        .slice(0, 5);

    // ─── Render ───────────────────────────────────────────────────────────────

    return (
        <Box sx={{
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            height: { xs: 'auto', sm: 'calc(100vh - 72px)' },
            minHeight: '100vh',
            backgroundColor: '#1e2535',
            color: '#f0e8e8',
            overflow: { xs: 'visible', sm: 'hidden' },
        }}>

            {/* ── Left: Month Grid ── */}
            <Box sx={{
                width: { xs: '100%', sm: '32%' },
                borderRight: { xs: 'none', sm: '1px solid #4a5568' },
                borderBottom: { xs: '1px solid #4a5568', sm: 'none' },
                display: 'flex',
                flexDirection: 'column',
                p: 2,
                flexShrink: 0,
            }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                    <IconButton onClick={prevMonth} sx={{ color: '#f0e8e8' }}>
                        <ChevronLeftIcon />
                    </IconButton>
                    <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#f0e8e8' }}>
                        {MONTHS[viewMonth.getMonth()]} {viewMonth.getFullYear()}
                    </Typography>
                    <IconButton onClick={nextMonth} sx={{ color: '#f0e8e8' }}>
                        <ChevronRightIcon />
                    </IconButton>
                </Box>

                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', mb: 1 }}>
                    {DAYS.map(d => (
                        <Typography key={d} align="center" sx={{ fontSize: '0.7rem', color: '#aaa', fontWeight: 600 }}>
                            {d}
                        </Typography>
                    ))}
                </Box>

                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px', flexShrink: 0 }}>
                    {cells.map((day, i) => {
                        if (!day) return <Box key={`empty-${i}`} />;
                        const cellDate = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), day);
                        const isToday = isSameDay(cellDate, today);
                        const isSelected = isSameDay(cellDate, selectedDay);
                        const isDropTarget = !!dragDropDay && isSameDay(dragDropDay, cellDate);
                        const hasEvents = events.some(e => isSameDay(new Date(e.start_time), cellDate));
                        const hasTasks = tasks.some(t => {
                            const [y, mo, d] = (t.due_date as string).split('-').map(Number);
                            return isSameDay(new Date(y, mo - 1, d), cellDate);
                        });
                        const dateAttr = `${viewMonth.getFullYear()}-${String(viewMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                        return (
                            <Box
                                key={day}
                                onClick={() => handleDayClick(day)}
                                data-drop-date={dateAttr}
                                sx={{
                                    aspectRatio: '1',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    borderRadius: '50%',
                                    cursor: isDropTarget ? 'copy' : 'pointer',
                                    position: 'relative',
                                    backgroundColor: isSelected ? '#64b5f6' : isDropTarget ? 'rgba(129,199,132,0.35)' : 'transparent',
                                    border: isDropTarget ? '2px solid #81c784' : isToday && !isSelected ? '1px solid #64b5f6' : 'none',
                                    '&:hover': { backgroundColor: isSelected ? '#64b5f6' : isDropTarget ? 'rgba(129,199,132,0.45)' : '#3d4b66' },
                                    transition: 'background-color 0.15s',
                                }}
                            >
                                <Typography sx={{
                                    fontSize: '0.85rem',
                                    color: isSelected ? '#1e2535' : '#f0e8e8',
                                    fontWeight: isToday ? 700 : 400,
                                    lineHeight: 1,
                                }}>
                                    {day}
                                </Typography>
                                {(hasEvents || hasTasks) && (
                                    <Box sx={{ display: 'flex', gap: '3px', mt: '2px' }}>
                                        {hasEvents && (
                                            <Box sx={{ width: 4, height: 4, borderRadius: '50%', backgroundColor: isSelected ? '#1e2535' : '#64b5f6' }} />
                                        )}
                                        {hasTasks && (
                                            <Box sx={{ width: 4, height: 4, borderRadius: '50%', backgroundColor: isSelected ? '#1e2535' : '#ffb74d' }} />
                                        )}
                                    </Box>
                                )}
                            </Box>
                        );
                    })}
                </Box>
                {/* Upcoming Events + Tasks */}
                <Box sx={{ mt: 2, flex: 1, overflowY: 'auto', minHeight: 0, maxHeight: { xs: 360, sm: 'none' } }}>
                    <Typography sx={{ fontSize: '0.68rem', color: '#718096', fontWeight: 700, letterSpacing: 0.8, mb: 1, textTransform: 'uppercase' }}>
                        Upcoming
                    </Typography>
                    {upcomingEvents.length === 0 ? (
                        <Typography sx={{ color: '#4a5568', fontSize: '0.75rem', fontStyle: 'italic', mb: 1.5 }}>
                            No upcoming events this month
                        </Typography>
                    ) : (
                        upcomingEvents.map(event => (
                            <Box
                                key={event.id}
                                onClick={() => {
                                    const d = new Date(event.start_time);
                                    setSelectedDay(d);
                                    setSelectedEvent(event);
                                }}
                                sx={{
                                    display: 'flex',
                                    alignItems: 'flex-start',
                                    gap: 1,
                                    py: 0.6,
                                    px: 0.75,
                                    mb: 0.25,
                                    borderRadius: 1.5,
                                    cursor: 'pointer',
                                    '&:hover': { backgroundColor: '#252f42' },
                                    transition: 'background-color 0.15s',
                                }}
                            >
                                <Box sx={{ width: 3, minHeight: 32, borderRadius: '2px', backgroundColor: event.color, flexShrink: 0, mt: '2px' }} />
                                <Box sx={{ minWidth: 0 }}>
                                    <Typography sx={{ fontSize: '0.78rem', color: '#f0e8e8', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {event.title}
                                    </Typography>
                                    <Typography sx={{ fontSize: '0.68rem', color: '#718096' }}>
                                        {formatUpcomingDate(event.start_time)}
                                    </Typography>
                                </Box>
                            </Box>
                        ))
                    )}

                    <Typography sx={{ fontSize: '0.68rem', color: '#718096', fontWeight: 700, letterSpacing: 0.8, mt: 2, mb: 1, textTransform: 'uppercase' }}>
                        Tasks · Next 2 Months
                    </Typography>
                    {upcomingTasks.length === 0 ? (
                        <Typography sx={{ color: '#4a5568', fontSize: '0.75rem', fontStyle: 'italic' }}>
                            No upcoming tasks
                        </Typography>
                    ) : (
                        upcomingTasks.map(task => {
                            const color = TASK_PRIORITY_COLORS[task.priority];
                            const [ty, tm, td] = (task.due_date as string).split('-').map(Number);
                            const dueDate = new Date(ty, tm - 1, td);
                            const isToday2 = isSameDay(dueDate, today);
                            const tomorrow2 = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
                            const isTomorrow2 = isSameDay(dueDate, tomorrow2);
                            let dateLabel = isToday2
                                ? 'Today'
                                : isTomorrow2
                                    ? 'Tomorrow'
                                    : dueDate.toLocaleDateString([], { month: 'short', day: 'numeric' });
                            if (task.due_time) dateLabel += ` · ${formatDueTimeStr(task.due_time)}`;
                            const isInProgress = task.status === 'in_progress';
                            return (
                                <Box
                                    key={task.id}
                                    onClick={() => router.push('/tasks')}
                                    sx={{
                                        display: 'flex',
                                        alignItems: 'flex-start',
                                        gap: 1,
                                        py: 0.6,
                                        px: 0.75,
                                        mb: 0.25,
                                        borderRadius: 1.5,
                                        cursor: 'pointer',
                                        '&:hover': { backgroundColor: '#252f42' },
                                        transition: 'background-color 0.15s',
                                    }}
                                >
                                    <Box sx={{ width: 3, minHeight: 32, borderRadius: '2px', backgroundColor: color, flexShrink: 0, mt: '2px' }} />
                                    <Box sx={{ minWidth: 0 }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                            <Typography sx={{ fontSize: '0.78rem', color: '#f0e8e8', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {task.title}
                                            </Typography>
                                            {isInProgress && (
                                                <Box sx={{ fontSize: '0.6rem', color: '#ffb74d', border: '1px solid #ffb74d44', borderRadius: '3px', px: '3px', lineHeight: 1.6, flexShrink: 0 }}>
                                                    in progress
                                                </Box>
                                            )}
                                        </Box>
                                        <Typography sx={{ fontSize: '0.68rem', color: '#718096' }}>
                                            {dateLabel}
                                        </Typography>
                                    </Box>
                                </Box>
                            );
                        })
                    )}
                </Box>
            </Box>

            {/* ── Right: Timeline + Detail ── */}
            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', height: { xs: 'calc(100vh - 72px)', sm: 'auto' }, flexShrink: 0 }}>

                {/* Timeline header */}
                <Box sx={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    px: 3, py: 1.5, borderBottom: '1px solid #4a5568', flexShrink: 0,
                }}>
                    <Typography variant="h6" sx={{ color: '#f0e8e8', fontWeight: 600 }}>
                        {selectedDay.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}
                    </Typography>
                    {isAdmin && (
                        <Typography sx={{ color: '#4a5568', fontSize: '0.75rem', fontStyle: 'italic' }}>
                            Click to add · Drag to reschedule
                        </Typography>
                    )}
                </Box>

                {/* Timeline scroll area */}
                <Box
                    ref={timelineScrollRef}
                    onClick={handleTimelineClick}
                    sx={{
                        flex: '0 0 62%',
                        overflow: 'hidden',
                        position: 'relative',
                        cursor: isAdmin ? 'crosshair' : 'default',
                    }}
                >
                    <Box sx={{ position: 'relative', height: `${(DAY_END - DAY_START) * hourHeight}px` }}>

                        {/* Hour rows */}
                        {hours.map(h => (
                            <Box
                                key={h}
                                sx={{
                                    position: 'absolute',
                                    top: `${(h - DAY_START) * hourHeight}px`,
                                    left: 0, right: 0,
                                    height: `${hourHeight}px`,
                                    borderTop: '1px solid #2d3748',
                                    display: 'flex',
                                    alignItems: 'flex-start',
                                    pt: '4px',
                                }}
                            >
                                <Typography sx={{
                                    width: `${LABEL_WIDTH}px`,
                                    fontSize: '0.7rem',
                                    color: '#718096',
                                    textAlign: 'right',
                                    pr: 1.5,
                                    flexShrink: 0,
                                }}>
                                    {h === 0 ? '12 AM' : h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h - 12} PM`}
                                </Typography>
                            </Box>
                        ))}

                        {/* Event blocks */}
                        {dayEvents.map(event => {
                            const isDraggingThis = eventDrag?.event.id === event.id && eventDrag.isDragging;
                            const dragData = isDraggingThis ? eventDrag! : null;
                            const isResizingBottom = dragData?.resizeEdge === 'bottom';
                            const isResizingTop = dragData?.resizeEdge === 'top';
                            const isMoving = isDraggingThis && dragData?.resizeEdge === null;
                            const dy = dragData?.deltaY ?? 0;
                            const baseTop = getEventTop(event, hourHeight);
                            const baseHeight = getEventHeight(event, hourHeight);
                            const visualTop = isResizingTop ? baseTop + dy : baseTop;
                            const visualHeight = isResizingBottom
                                ? Math.max(baseHeight + dy, hourHeight / 4)
                                : isResizingTop
                                    ? Math.max(baseHeight - dy, hourHeight / 4)
                                    : baseHeight;
                            const showNotesPanel = isAdmin && selectedEvent?.id === event.id && !isDraggingThis;
                            return (
                                <Box
                                    key={event.id}
                                    onPointerDown={e => handleEventPointerDown(e, event)}
                                    onPointerMove={handleEventPointerMove}
                                    onPointerUp={handleEventPointerUp}
                                    onPointerCancel={() => { setEventDrag(null); setDragDropDay(null); }}
                                    onClick={e => {
                                        e.stopPropagation();
                                        if (!isAdmin) setSelectedEvent(event);
                                    }}
                                    sx={{
                                        position: 'absolute',
                                        top: `${visualTop}px`,
                                        height: `${visualHeight}px`,
                                        left: `${LABEL_WIDTH + 8}px`,
                                        right: '8px',
                                        backgroundColor: event.color,
                                        borderRadius: '6px',
                                        padding: '3px 8px',
                                        overflow: 'hidden',
                                        boxSizing: 'border-box',
                                        userSelect: 'none',
                                        cursor: isAdmin
                                            ? (isMoving ? 'grabbing' : isDraggingThis ? 'ns-resize' : 'grab')
                                            : 'pointer',
                                        transform: isMoving ? `translateY(${dy}px)` : undefined,
                                        opacity: isDraggingThis ? 0.85 : 1,
                                        zIndex: isDraggingThis ? 10 : 1,
                                        outline: selectedEvent?.id === event.id ? '2px solid #fff' : 'none',
                                        outlineOffset: '1px',
                                        transition: isDraggingThis ? 'none' : 'filter 0.15s',
                                        '&:hover': { filter: 'brightness(1.15)' },
                                    }}
                                >
                                    <Typography sx={{ fontSize: '0.78rem', fontWeight: 700, color: '#1e2535', lineHeight: 1.2 }}>
                                        {event.title}
                                    </Typography>
                                    <Typography sx={{ fontSize: '0.68rem', color: '#1e253599' }}>
                                        {formatTime(event.start_time)} – {formatTime(event.end_time)}
                                    </Typography>
                                    {visualHeight > 54 && (event.description || showNotesPanel) && (
                                        <Box
                                            sx={{ position: 'absolute', top: '30px', left: '4px', right: '4px', bottom: '10px', zIndex: 2, overflow: 'hidden' }}
                                            onPointerDown={showNotesPanel ? e => e.stopPropagation() : undefined}
                                            onClick={showNotesPanel ? e => e.stopPropagation() : undefined}
                                        >
                                            {showNotesPanel ? (
                                                <textarea
                                                    value={quickNotes}
                                                    onChange={e => handleNotesChange(e.target.value)}
                                                    placeholder="Notes..."
                                                    style={{
                                                        width: '100%',
                                                        height: '100%',
                                                        background: 'transparent',
                                                        border: 'none',
                                                        outline: 'none',
                                                        color: '#1e2535',
                                                        fontSize: '0.65rem',
                                                        resize: 'none',
                                                        fontFamily: 'inherit',
                                                        padding: '2px 4px',
                                                        boxSizing: 'border-box',
                                                    }}
                                                />
                                            ) : (
                                                <Typography sx={{
                                                    fontSize: '0.65rem',
                                                    color: 'rgba(30,37,53,0.72)',
                                                    lineHeight: 1.35,
                                                    px: '4px',
                                                    pt: '2px',
                                                    overflow: 'hidden',
                                                    display: '-webkit-box',
                                                    WebkitBoxOrient: 'vertical',
                                                    WebkitLineClamp: Math.max(1, Math.floor((visualHeight - 36) / 11)),
                                                    pointerEvents: 'none',
                                                }}>
                                                    {event.description}
                                                </Typography>
                                            )}
                                        </Box>
                                    )}
                                    {isAdmin && (
                                        <>
                                            <Box sx={{
                                                position: 'absolute', top: 0, left: 0, right: 0,
                                                height: '8px', cursor: 'ns-resize',
                                                display: 'flex', justifyContent: 'center', alignItems: 'flex-start', pt: '2px',
                                            }}>
                                                <Box sx={{ width: 20, height: 2, borderRadius: '1px', backgroundColor: 'rgba(0,0,0,0.3)' }} />
                                            </Box>
                                            <Box sx={{
                                                position: 'absolute', bottom: 0, left: 0, right: 0,
                                                height: '8px', cursor: 'ns-resize',
                                                display: 'flex', justifyContent: 'center', alignItems: 'flex-end', pb: '2px',
                                            }}>
                                                <Box sx={{ width: 20, height: 2, borderRadius: '1px', backgroundColor: 'rgba(0,0,0,0.3)' }} />
                                            </Box>
                                        </>
                                    )}
                                </Box>
                            );
                        })}

                        {/* Task blocks (timed tasks for selected day) */}
                        {tasks
                            .filter(t => {
                                if (!t.due_time) return false;
                                const [y, mo, d] = (t.due_date as string).split('-').map(Number);
                                return isSameDay(new Date(y, mo - 1, d), selectedDay);
                            })
                            .map(task => {
                                const [h, m] = task.due_time!.split(':').map(Number);
                                const topPx = (h + m / 60 - DAY_START) * hourHeight;
                                const color = TASK_PRIORITY_COLORS[task.priority];
                                const isDone = task.status === 'done';
                                return (
                                    <Box
                                        key={`task-${task.id}`}
                                        onClick={() => router.push('/tasks')}
                                        sx={{
                                            position: 'absolute',
                                            top: `${topPx}px`,
                                            height: '40px',
                                            left: `${LABEL_WIDTH + 8}px`,
                                            right: '8px',
                                            backgroundColor: `${color}33`,
                                            borderLeft: `3px solid ${color}`,
                                            borderRadius: '0 6px 6px 0',
                                            padding: '3px 8px',
                                            overflow: 'hidden',
                                            boxSizing: 'border-box',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 0.5,
                                            zIndex: 1,
                                            '&:hover': { backgroundColor: `${color}55` },
                                        }}
                                    >
                                        {isDone
                                            ? <CheckBoxIcon sx={{ fontSize: '0.85rem', color, flexShrink: 0 }} />
                                            : <CheckBoxOutlineBlankIcon sx={{ fontSize: '0.85rem', color, flexShrink: 0 }} />
                                        }
                                        <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color, lineHeight: 1.2, textDecoration: isDone ? 'line-through' : 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {task.title}
                                        </Typography>
                                    </Box>
                                );
                            })
                        }

                    </Box>
                </Box>

                {/* ── Detail panel ── */}
                <Box sx={{
                    flex: 1,
                    borderTop: '1px solid #4a5568',
                    p: 3,
                    overflowY: 'auto',
                    backgroundColor: '#252f42',
                }}>
                    {selectedEvent ? (
                        <>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                    <Box sx={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: selectedEvent.color, flexShrink: 0, mt: '2px' }} />
                                    <Typography variant="h6" sx={{ color: '#f0e8e8', fontWeight: 700 }}>
                                        {selectedEvent.title}
                                    </Typography>
                                </Box>
                                <Box sx={{ display: 'flex', gap: { xs: 0.5, sm: 0.25 } }}>
                                    {isAdmin && (
                                        <>
                                            <Tooltip title={taskCreatedId === selectedEvent.id ? 'Task created!' : 'Create Task'}>
                                                <IconButton onClick={() => handleCreateTaskFromEvent(selectedEvent)} sx={{ color: taskCreatedId === selectedEvent.id ? '#81c784' : '#ffb74d', p: { xs: 1, sm: 0.5 } }}>
                                                    <AddTaskIcon sx={{ fontSize: { xs: '1.4rem', sm: '1.1rem' } }} />
                                                </IconButton>
                                            </Tooltip>
                                            <Tooltip title="Edit">
                                                <IconButton onClick={() => openEdit(selectedEvent)} sx={{ color: '#64b5f6', p: { xs: 1, sm: 0.5 } }}>
                                                    <EditIcon sx={{ fontSize: { xs: '1.4rem', sm: '1.1rem' } }} />
                                                </IconButton>
                                            </Tooltip>
                                            <Tooltip title="Delete">
                                                <IconButton onClick={() => handleDelete(selectedEvent.id)} sx={{ color: '#e57373', p: { xs: 1, sm: 0.5 } }}>
                                                    <DeleteIcon sx={{ fontSize: { xs: '1.4rem', sm: '1.1rem' } }} />
                                                </IconButton>
                                            </Tooltip>
                                        </>
                                    )}
                                    <Tooltip title="Close">
                                        <IconButton onClick={() => setSelectedEvent(null)} sx={{ color: '#718096', p: { xs: 1, sm: 0.5 } }}>
                                            <CloseIcon sx={{ fontSize: { xs: '1.4rem', sm: '1.1rem' } }} />
                                        </IconButton>
                                    </Tooltip>
                                </Box>
                            </Box>

                            <Typography sx={{ color: '#aaa', fontSize: '0.85rem', mb: 2 }}>
                                {formatTime(selectedEvent.start_time)} – {formatTime(selectedEvent.end_time)}
                            </Typography>

                            {isAdmin ? (
                                <TextField
                                    multiline
                                    fullWidth
                                    minRows={2}
                                    placeholder="Notes..."
                                    value={quickNotes}
                                    onChange={e => handleNotesChange(e.target.value)}
                                    size="small"
                                    sx={{
                                        '& .MuiOutlinedInput-root': {
                                            color: '#d0ccc8',
                                            fontSize: '0.9rem',
                                            '& fieldset': { borderColor: '#3d4b66' },
                                            '&:hover fieldset': { borderColor: '#4a5568' },
                                            '&.Mui-focused fieldset': { borderColor: '#64b5f6' },
                                        },
                                    }}
                                />
                            ) : !isAdmin ? (
                                <Typography sx={{ color: '#718096', fontSize: '0.85rem', fontStyle: 'italic' }}>
                                    Sign in to view details.
                                </Typography>
                            ) : null}
                        </>
                    ) : (
                        <Typography sx={{ color: '#4a5568', fontSize: '0.9rem', fontStyle: 'italic' }}>
                            Select an event to view details.
                        </Typography>
                    )}
                </Box>
            </Box>

            {/* ── Centered form modal ── */}
            {isAdmin && formOpen && (
                <Box sx={{
                    position: 'fixed',
                    left: '50%',
                    top: '50%',
                    transform: 'translate(-50%, -50%)',
                    zIndex: 1300,
                    width: { xs: '95vw', sm: '380px' },
                    maxHeight: '90vh',
                    overflowY: 'auto',
                    backgroundColor: '#2d3748',
                    color: '#f0e8e8',
                    borderRadius: '8px',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
                    border: '1px solid #4a5568',
                }}>
                    {/* Title bar */}
                    <Box
                        sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            px: 2,
                            py: 1.5,
                            borderBottom: '1px solid #4a5568',
                            borderRadius: '8px 8px 0 0',
                        }}
                    >
                        <Typography sx={{ color: '#f0e8e8', fontWeight: 600, fontSize: '1rem' }}>
                            {editingId !== null ? 'Edit Event' : 'New Event'}
                        </Typography>
                        <IconButton size="small" onClick={() => setFormOpen(false)} sx={{ color: '#718096' }}>
                            <CloseIcon fontSize="small" />
                        </IconButton>
                    </Box>

                    {/* Form fields */}
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, p: 2, userSelect: 'text' }}>
                        <TextField
                            label="Title"
                            value={formData.title}
                            onChange={e => setFormData(f => ({ ...f, title: e.target.value }))}
                            fullWidth
                            size="small"
                            autoFocus
                            InputLabelProps={{ sx: { color: '#aaa' } }}
                            inputProps={{ style: { color: '#f0e8e8' } }}
                            sx={{ '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: '#4a5568' } } }}
                        />
                        <TextField
                            label="Date"
                            type="date"
                            value={formData.date}
                            onChange={e => setFormData(f => ({ ...f, date: e.target.value }))}
                            size="small"
                            InputLabelProps={{ shrink: true, sx: { color: '#aaa' } }}
                            inputProps={{ style: { color: '#f0e8e8' } }}
                            sx={{ '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: '#4a5568' } } }}
                        />
                        <Box sx={{ display: 'flex', gap: 2 }}>
                            <TextField
                                label="Start"
                                type="time"
                                value={formData.startTime}
                                onChange={e => setFormData(f => ({ ...f, startTime: e.target.value }))}
                                size="small"
                                fullWidth
                                InputLabelProps={{ shrink: true, sx: { color: '#aaa' } }}
                                inputProps={{ style: { color: '#f0e8e8' } }}
                                sx={{ '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: '#4a5568' } } }}
                            />
                            <TextField
                                label="End"
                                type="time"
                                value={formData.endTime}
                                onChange={e => setFormData(f => ({ ...f, endTime: e.target.value }))}
                                size="small"
                                fullWidth
                                InputLabelProps={{ shrink: true, sx: { color: '#aaa' } }}
                                inputProps={{ style: { color: '#f0e8e8' } }}
                                sx={{ '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: '#4a5568' } } }}
                            />
                        </Box>
                        <TextField
                            label="Notes"
                            value={formData.description}
                            onChange={e => setFormData(f => ({ ...f, description: e.target.value }))}
                            multiline
                            rows={3}
                            fullWidth
                            size="small"
                            InputLabelProps={{ sx: { color: '#aaa' } }}
                            inputProps={{ style: { color: '#f0e8e8' } }}
                            sx={{ '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: '#4a5568' } } }}
                        />
                        <Box>
                            <Typography sx={{ color: '#aaa', fontSize: '0.8rem', mb: 1 }}>Color</Typography>
                            <Box sx={{ display: 'flex', gap: 1 }}>
                                {EVENT_COLORS.map(c => (
                                    <Box
                                        key={c}
                                        onClick={() => setFormData(f => ({ ...f, color: c }))}
                                        sx={{
                                            width: 24, height: 24,
                                            borderRadius: '50%',
                                            backgroundColor: c,
                                            cursor: 'pointer',
                                            outline: formData.color === c ? '2px solid #fff' : 'none',
                                            outlineOffset: '2px',
                                        }}
                                    />
                                ))}
                            </Box>
                        </Box>
                    </Box>

                    {/* Actions */}
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, px: 2, pb: 2 }}>
                        <Button onClick={() => setFormOpen(false)} sx={{ color: '#aaa' }}>Cancel</Button>
                        <Button
                            onClick={handleSave}
                            disabled={!formData.title}
                            variant="contained"
                            sx={{ backgroundColor: '#64b5f6', color: '#1e2535', '&:hover': { backgroundColor: '#42a5f5' } }}
                        >
                            Save
                        </Button>
                    </Box>
                </Box>
            )}
        </Box>
    );
}
