'use client';

import { useState, useEffect, useCallback } from 'react';
import {
    Box, Typography, IconButton, Dialog, DialogTitle, DialogContent,
    DialogActions, Button, TextField, Tooltip,
} from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import CloseIcon from '@mui/icons-material/Close';

// ─── Types ────────────────────────────────────────────────────────────────────

type CalendarEvent = {
    id: number;
    title: string;
    description?: string;
    start_time: string;
    end_time: string;
    color: string;
};

type FormData = {
    title: string;
    date: string;
    startTime: string;
    endTime: string;
    description: string;
    color: string;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const HOUR_HEIGHT = 64;
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

function getEventStyle(event: CalendarEvent): React.CSSProperties {
    const start = new Date(event.start_time);
    const end = new Date(event.end_time);
    const startDec = start.getHours() + start.getMinutes() / 60;
    const endDec = end.getHours() + end.getMinutes() / 60;
    return {
        position: 'absolute',
        top: `${(startDec - DAY_START) * HOUR_HEIGHT}px`,
        height: `${Math.max((endDec - startDec) * HOUR_HEIGHT - 2, 22)}px`,
        left: `${LABEL_WIDTH + 8}px`,
        right: '8px',
        backgroundColor: event.color,
        borderRadius: '6px',
        padding: '3px 8px',
        cursor: 'pointer',
        overflow: 'hidden',
        boxSizing: 'border-box',
    };
}

function emptyForm(date: Date): FormData {
    return {
        title: '',
        date: formatDateInput(date),
        startTime: '09:00',
        endTime: '10:00',
        description: '',
        color: EVENT_COLORS[0],
    };
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CalendarClient({ isAdmin }: { isAdmin: boolean }) {
    const today = new Date();
    const [viewMonth, setViewMonth] = useState(today);
    const [selectedDay, setSelectedDay] = useState(today);
    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
    const [formOpen, setFormOpen] = useState(false);
    const [formData, setFormData] = useState<FormData>(emptyForm(today));
    const [editingId, setEditingId] = useState<number | null>(null);

    const fetchEvents = useCallback(async (year: number, month: number) => {
        try {
            const res = await fetch(`/api/calendar?year=${year}&month=${month + 1}`);
            if (!res.ok) { setEvents([]); return; }
            const data = await res.json();
            setEvents(data.events ?? []);
        } catch {
            setEvents([]);
        }
    }, []);

    useEffect(() => {
        fetchEvents(viewMonth.getFullYear(), viewMonth.getMonth());
    }, [viewMonth, fetchEvents]);

    const dayEvents = events.filter(e =>
        isSameDay(new Date(e.start_time), selectedDay)
    );

    // ── Month navigation ──

    const prevMonth = () => setViewMonth(d => new Date(d.getFullYear(), d.getMonth() - 1, 1));
    const nextMonth = () => setViewMonth(d => new Date(d.getFullYear(), d.getMonth() + 1, 1));

    const handleDayClick = (day: number) => {
        setSelectedDay(new Date(viewMonth.getFullYear(), viewMonth.getMonth(), day));
        setSelectedEvent(null);
    };

    // ── Admin CRUD ──

    const openCreate = () => {
        setEditingId(null);
        setFormData(emptyForm(selectedDay));
        setFormOpen(true);
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
        const start = new Date(formData.date);
        start.setHours(h1, m1, 0, 0);
        const end = new Date(formData.date);
        end.setHours(h2, m2, 0, 0);

        const body = {
            title: formData.title,
            description: formData.description,
            start_time: start.toISOString(),
            end_time: end.toISOString(),
            color: formData.color,
        };

        if (editingId !== null) {
            await fetch(`/api/calendar/${editingId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
        } else {
            await fetch('/api/calendar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
        }

        setFormOpen(false);
        setSelectedEvent(null);
        await fetchEvents(viewMonth.getFullYear(), viewMonth.getMonth());
    };

    const handleDelete = async (id: number) => {
        await fetch(`/api/calendar/${id}`, { method: 'DELETE' });
        setSelectedEvent(null);
        await fetchEvents(viewMonth.getFullYear(), viewMonth.getMonth());
    };

    // ── Cells ──

    const cells = getMonthCells(viewMonth.getFullYear(), viewMonth.getMonth());
    const hours = Array.from({ length: DAY_END - DAY_START }, (_, i) => DAY_START + i);

    // ─── Render ───────────────────────────────────────────────────────────────

    return (
        <Box sx={{
            display: 'flex',
            height: 'calc(100vh - 72px)',
            backgroundColor: '#1e2535',
            color: '#f0e8e8',
            overflow: 'hidden',
        }}>

            {/* ── Left: Month Grid ── */}
            <Box sx={{
                width: '32%',
                borderRight: '1px solid #4a5568',
                display: 'flex',
                flexDirection: 'column',
                p: 2,
            }}>
                {/* Month header */}
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

                {/* Day-of-week labels */}
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', mb: 1 }}>
                    {DAYS.map(d => (
                        <Typography key={d} align="center" sx={{ fontSize: '0.7rem', color: '#aaa', fontWeight: 600 }}>
                            {d}
                        </Typography>
                    ))}
                </Box>

                {/* Day cells */}
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px' }}>
                    {cells.map((day, i) => {
                        if (!day) return <Box key={`empty-${i}`} />;
                        const cellDate = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), day);
                        const isToday = isSameDay(cellDate, today);
                        const isSelected = isSameDay(cellDate, selectedDay);
                        const hasEvents = events.some(e => isSameDay(new Date(e.start_time), cellDate));

                        return (
                            <Box
                                key={day}
                                onClick={() => handleDayClick(day)}
                                sx={{
                                    aspectRatio: '1',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    borderRadius: '50%',
                                    cursor: 'pointer',
                                    position: 'relative',
                                    backgroundColor: isSelected ? '#64b5f6' : 'transparent',
                                    border: isToday && !isSelected ? '1px solid #64b5f6' : 'none',
                                    '&:hover': { backgroundColor: isSelected ? '#64b5f6' : '#3d4b66' },
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
                                {hasEvents && (
                                    <Box sx={{
                                        width: 4, height: 4,
                                        borderRadius: '50%',
                                        backgroundColor: isSelected ? '#1e2535' : '#64b5f6',
                                        mt: '2px',
                                    }} />
                                )}
                            </Box>
                        );
                    })}
                </Box>
            </Box>

            {/* ── Right: Timeline + Detail ── */}
            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

                {/* Timeline header */}
                <Box sx={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    px: 3, py: 1.5, borderBottom: '1px solid #4a5568', flexShrink: 0,
                }}>
                    <Typography variant="h6" sx={{ color: '#f0e8e8', fontWeight: 600 }}>
                        {selectedDay.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}
                    </Typography>
                    {isAdmin && (
                        <Tooltip title="Add event">
                            <IconButton onClick={openCreate} sx={{ color: '#64b5f6' }}>
                                <AddIcon />
                            </IconButton>
                        </Tooltip>
                    )}
                </Box>

                {/* Timeline scroll area */}
                <Box sx={{ flex: '0 0 58%', overflowY: 'auto', position: 'relative' }}>
                    <Box sx={{ position: 'relative', height: `${(DAY_END - DAY_START) * HOUR_HEIGHT}px` }}>

                        {/* Hour rows */}
                        {hours.map(h => (
                            <Box
                                key={h}
                                sx={{
                                    position: 'absolute',
                                    top: `${(h - DAY_START) * HOUR_HEIGHT}px`,
                                    left: 0, right: 0,
                                    height: `${HOUR_HEIGHT}px`,
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
                        {dayEvents.map(event => (
                            <Box
                                key={event.id}
                                onClick={() => setSelectedEvent(event)}
                                sx={{
                                    ...getEventStyle(event),
                                    outline: selectedEvent?.id === event.id ? '2px solid #fff' : 'none',
                                    outlineOffset: '1px',
                                    '&:hover': { filter: 'brightness(1.15)' },
                                    transition: 'filter 0.15s',
                                }}
                            >
                                <Typography sx={{ fontSize: '0.78rem', fontWeight: 700, color: '#1e2535', lineHeight: 1.2 }}>
                                    {event.title}
                                </Typography>
                                <Typography sx={{ fontSize: '0.68rem', color: '#1e253599' }}>
                                    {formatTime(event.start_time)} – {formatTime(event.end_time)}
                                </Typography>
                            </Box>
                        ))}

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
                                <Box sx={{ display: 'flex', gap: 0.5 }}>
                                    {isAdmin && (
                                        <>
                                            <Tooltip title="Edit">
                                                <IconButton size="small" onClick={() => openEdit(selectedEvent)} sx={{ color: '#64b5f6' }}>
                                                    <EditIcon fontSize="small" />
                                                </IconButton>
                                            </Tooltip>
                                            <Tooltip title="Delete">
                                                <IconButton size="small" onClick={() => handleDelete(selectedEvent.id)} sx={{ color: '#e57373' }}>
                                                    <DeleteIcon fontSize="small" />
                                                </IconButton>
                                            </Tooltip>
                                        </>
                                    )}
                                    <Tooltip title="Close">
                                        <IconButton size="small" onClick={() => setSelectedEvent(null)} sx={{ color: '#718096' }}>
                                            <CloseIcon fontSize="small" />
                                        </IconButton>
                                    </Tooltip>
                                </Box>
                            </Box>

                            <Typography sx={{ color: '#aaa', fontSize: '0.85rem', mb: 2 }}>
                                {formatTime(selectedEvent.start_time)} – {formatTime(selectedEvent.end_time)}
                            </Typography>

                            {isAdmin && selectedEvent.description ? (
                                <Typography sx={{ color: '#d0ccc8', fontSize: '0.9rem', whiteSpace: 'pre-wrap' }}>
                                    {selectedEvent.description}
                                </Typography>
                            ) : !isAdmin ? (
                                <Typography sx={{ color: '#718096', fontSize: '0.85rem', fontStyle: 'italic' }}>
                                    Sign in to view details.
                                </Typography>
                            ) : (
                                <Typography sx={{ color: '#718096', fontSize: '0.85rem', fontStyle: 'italic' }}>
                                    No notes for this event.
                                </Typography>
                            )}
                        </>
                    ) : (
                        <Typography sx={{ color: '#4a5568', fontSize: '0.9rem', fontStyle: 'italic' }}>
                            Select an event to view details.
                        </Typography>
                    )}
                </Box>
            </Box>

            {/* ── Admin Event Form Dialog ── */}
            {isAdmin && (
                <Dialog
                    open={formOpen}
                    onClose={() => setFormOpen(false)}
                    PaperProps={{ sx: { backgroundColor: '#2d3748', color: '#f0e8e8', minWidth: 380 } }}
                >
                    <DialogTitle sx={{ color: '#f0e8e8' }}>
                        {editingId !== null ? 'Edit Event' : 'New Event'}
                    </DialogTitle>
                    <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '12px !important' }}>
                        <TextField
                            label="Title"
                            value={formData.title}
                            onChange={e => setFormData(f => ({ ...f, title: e.target.value }))}
                            fullWidth
                            size="small"
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
                            rows={4}
                            fullWidth
                            size="small"
                            InputLabelProps={{ sx: { color: '#aaa' } }}
                            inputProps={{ style: { color: '#f0e8e8' } }}
                            sx={{ '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: '#4a5568' } } }}
                        />
                        {/* Color picker */}
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
                    </DialogContent>
                    <DialogActions sx={{ px: 3, pb: 2 }}>
                        <Button onClick={() => setFormOpen(false)} sx={{ color: '#aaa' }}>Cancel</Button>
                        <Button
                            onClick={handleSave}
                            disabled={!formData.title}
                            variant="contained"
                            sx={{ backgroundColor: '#64b5f6', color: '#1e2535', '&:hover': { backgroundColor: '#42a5f5' } }}
                        >
                            Save
                        </Button>
                    </DialogActions>
                </Dialog>
            )}
        </Box>
    );
}
