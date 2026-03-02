import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Plus, X, Trash2, Edit } from 'lucide-react';
import { GlassCard, GlassCardContent } from '@/components/ui/GlassCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import useAppStore from '@/store/useAppStore';

const DAYS_BG = ['Пон', 'Вто', 'Сря', 'Чет', 'Пет', 'Съб', 'Нед'];
const MONTHS_BG = [
  'Януари', 'Февруари', 'Март', 'Април', 'Май', 'Юни',
  'Юли', 'Август', 'Септември', 'Октомври', 'Ноември', 'Декември',
];

const eventColors = {
  critical: '#FF4757',
  task: '#FFB347',
  meeting: '#6C9CFF',
  auto: '#2ED573',
  idea: '#A855F7',
};

export default function CalendarPage() {
  const events = useAppStore((s) => s.events);
  const addEvent = useAppStore((s) => s.addEvent);
  const deleteEvent = useAppStore((s) => s.deleteEvent);

  const [currentDate, setCurrentDate] = useState(new Date(2025, 1, 1)); // February 2025
  const [view, setView] = useState('month');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [newEvent, setNewEvent] = useState({ title: '', type: 'task' });

  const today = new Date();

  const isToday = (date) => {
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    let startDay = firstDay.getDay() - 1;
    if (startDay < 0) startDay = 6;
    const days = [];

    // Previous month days
    const prevMonth = new Date(year, month, 0);
    for (let i = startDay - 1; i >= 0; i--) {
      days.push({ date: new Date(year, month - 1, prevMonth.getDate() - i), isCurrentMonth: false });
    }

    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({ date: new Date(year, month, i), isCurrentMonth: true });
    }

    // Next month days
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      days.push({ date: new Date(year, month + 1, i), isCurrentMonth: false });
    }

    return days;
  };

  const getEventsForDate = (date) => {
    const dateStr = date.toISOString().split('T')[0];
    return events.filter((e) => e.date === dateStr);
  };

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const handleDayClick = (day) => {
    const dayEvents = getEventsForDate(day.date);
    setSelectedDate(day.date);
    if (dayEvents.length > 0) {
      setSelectedEvent(dayEvents);
      setShowDetailModal(true);
    } else {
      setNewEvent({ title: '', type: 'task' });
      setShowAddModal(true);
    }
  };

  const handleEventClick = (e, event) => {
    e.stopPropagation();
    setSelectedEvent([event]);
    setShowDetailModal(true);
  };

  const handleAddEvent = () => {
    if (!newEvent.title.trim()) {
      toast.error('Моля въведете заглавие');
      return;
    }
    const event = {
      id: Date.now(),
      date: selectedDate.toISOString().split('T')[0],
      title: newEvent.title,
      type: newEvent.type,
    };
    addEvent(event);
    setNewEvent({ title: '', type: 'task' });
    setShowAddModal(false);
    toast.success('Събитието е добавено');
  };

  const handleDeleteEvent = (eventId) => {
    deleteEvent(eventId);
    const remaining = selectedEvent.filter(e => e.id !== eventId);
    if (remaining.length === 0) {
      setShowDetailModal(false);
      setSelectedEvent(null);
    } else {
      setSelectedEvent(remaining);
    }
    toast.success('Събитието е изтрито');
  };

  const openAddFromDetail = () => {
    setShowDetailModal(false);
    setNewEvent({ title: '', type: 'task' });
    setShowAddModal(true);
  };

  const days = getDaysInMonth(currentDate);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="pt-20 pb-8 px-4 sm:px-6 lg:px-8 min-h-screen"
    >
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Breadcrumb */}
        <div className="text-sm text-muted-foreground">
          <Link to="/" className="text-primary hover:underline">🦞 OpenClaw</Link> / Календар
        </div>

        <GlassCard>
          <GlassCardContent className="p-4 sm:p-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={handlePrevMonth}>
                  <ChevronLeft className="w-5 h-5" />
                </Button>
                <h2 className="text-xl sm:text-2xl font-bold text-foreground min-w-[200px] text-center">
                  {MONTHS_BG[currentDate.getMonth()]} {currentDate.getFullYear()}
                </h2>
                <Button variant="ghost" size="icon" onClick={handleNextMonth}>
                  <ChevronRight className="w-5 h-5" />
                </Button>
              </div>

              {/* View Toggle */}
              <div className="flex items-center gap-2">
                {['day', 'week', 'month'].map((v) => (
                  <Button
                    key={v}
                    variant={view === v ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => {
                      if (v === 'month') setView(v);
                    }}
                    disabled={v !== 'month'}
                    className={view === v ? 'bg-primary' : ''}
                    title={v !== 'month' ? 'Скоро' : ''}
                  >
                    {v === 'day' ? 'Ден' : v === 'week' ? 'Седмица' : 'Месец'}
                  </Button>
                ))}
              </div>
            </div>

            {/* Day Headers */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {DAYS_BG.map((day) => (
                <div key={day} className="text-center text-sm font-medium text-muted-foreground py-2">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-1">
              {days.map((day, index) => {
                const dayEvents = getEventsForDate(day.date);
                const isTodayDate = isToday(day.date);
                return (
                  <motion.button
                    key={index}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: index * 0.01 }}
                    onClick={() => handleDayClick(day)}
                    className={`
                      min-h-[80px] sm:min-h-[100px] p-1 sm:p-2 rounded-lg border transition-all
                      ${day.isCurrentMonth ? 'bg-secondary/20' : 'bg-secondary/5 opacity-50'}
                      ${isTodayDate ? 'border-primary ring-2 ring-primary/30' : 'border-border/20'}
                      hover:border-primary/50 hover:bg-primary/10
                    `}
                  >
                    <div className={`text-sm font-medium mb-1 ${isTodayDate ? 'text-primary' : 'text-foreground'}`}>
                      {day.date.getDate()}
                    </div>
                    <div className="space-y-1">
                      {dayEvents.slice(0, 2).map((event) => (
                        <div
                          key={event.id}
                          onClick={(e) => handleEventClick(e, event)}
                          className="text-xs px-1 py-0.5 rounded truncate cursor-pointer hover:opacity-80"
                          style={{
                            backgroundColor: eventColors[event.type] + '30',
                            color: eventColors[event.type],
                            borderLeft: `2px solid ${eventColors[event.type]}`,
                          }}
                        >
                          {event.title}
                        </div>
                      ))}
                      {dayEvents.length > 2 && (
                        <div className="text-xs text-muted-foreground">
                          +{dayEvents.length - 2} още
                        </div>
                      )}
                    </div>
                  </motion.button>
                );
              })}
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-4 mt-6 pt-4 border-t border-border/30">
              {Object.entries(eventColors).map(([type, color]) => (
                <div key={type} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                  <span className="text-xs text-muted-foreground capitalize">
                    {type === 'critical' ? 'Критично' : type === 'task' ? 'Задача' : type === 'meeting' ? 'Среща' : type === 'auto' ? 'Автоматично' : 'Идея'}
                  </span>
                </div>
              ))}
            </div>
          </GlassCardContent>
        </GlassCard>

        {/* Add Event Modal */}
        <AnimatePresence>
          {showAddModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
              onClick={() => setShowAddModal(false)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-md"
              >
                <GlassCard>
                  <GlassCardContent className="p-6">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                        <Plus className="w-5 h-5 text-primary" />
                        Добави Събитие
                      </h3>
                      <Button variant="ghost" size="icon" onClick={() => setShowAddModal(false)}>
                        <X className="w-5 h-5" />
                      </Button>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="text-sm text-muted-foreground mb-2 block">Дата</label>
                        <div className="px-3 py-2 rounded-lg bg-secondary/30 text-foreground">
                          {selectedDate?.toLocaleDateString('bg-BG')}
                        </div>
                      </div>

                      <div>
                        <label className="text-sm text-muted-foreground mb-2 block">Заглавие</label>
                        <Input
                          value={newEvent.title}
                          onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                          placeholder="Въведете заглавие..."
                          className="bg-secondary/30"
                        />
                      </div>

                      <div>
                        <label className="text-sm text-muted-foreground mb-2 block">Тип</label>
                        <div className="grid grid-cols-5 gap-2">
                          {Object.entries(eventColors).map(([type, color]) => (
                            <button
                              key={type}
                              onClick={() => setNewEvent({ ...newEvent, type })}
                              className={`p-2 rounded-lg border-2 transition-all ${
                                newEvent.type === type ? 'border-current' : 'border-transparent'
                              }`}
                              style={{ color, backgroundColor: color + '20' }}
                            >
                              <div className="w-full h-4 rounded" style={{ backgroundColor: color }} />
                            </button>
                          ))}
                        </div>
                      </div>

                      <Button className="w-full bg-primary hover:bg-primary/90" onClick={handleAddEvent}>
                        Добави
                      </Button>
                    </div>
                  </GlassCardContent>
                </GlassCard>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Event Detail Modal */}
        <AnimatePresence>
          {showDetailModal && selectedEvent && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
              onClick={() => { setShowDetailModal(false); setSelectedEvent(null); }}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-md"
              >
                <GlassCard>
                  <GlassCardContent className="p-6">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                        <Edit className="w-5 h-5 text-primary" />
                        {selectedDate?.toLocaleDateString('bg-BG')} — {selectedEvent.length === 1 ? '1 събитие' : `${selectedEvent.length} събития`}
                      </h3>
                      <Button variant="ghost" size="icon" onClick={() => { setShowDetailModal(false); setSelectedEvent(null); }}>
                        <X className="w-5 h-5" />
                      </Button>
                    </div>

                    <div className="space-y-3 mb-6">
                      {selectedEvent.map((event) => (
                        <div
                          key={event.id}
                          className="flex items-center justify-between p-3 rounded-lg border"
                          style={{
                            backgroundColor: eventColors[event.type] + '15',
                            borderColor: eventColors[event.type] + '50',
                          }}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: eventColors[event.type] }}
                            />
                            <div>
                              <div className="text-sm font-medium text-foreground">{event.title}</div>
                              <div className="text-xs text-muted-foreground capitalize">
                                {event.type === 'critical' ? 'Критично' : event.type === 'task' ? 'Задача' : event.type === 'meeting' ? 'Среща' : event.type === 'auto' ? 'Автоматично' : 'Идея'}
                              </div>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => handleDeleteEvent(event.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>

                    <Button
                      className="w-full bg-primary hover:bg-primary/90"
                      onClick={openAddFromDetail}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Добави ново събитие
                    </Button>
                  </GlassCardContent>
                </GlassCard>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
