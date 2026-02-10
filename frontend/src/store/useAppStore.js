import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const initialSessions = [
  { id: 1, name: 'wallester-reg', status: 'running', url: 'wallester.com', duration: '00:45:32', profile: 'wallester' },
  { id: 2, name: 'gmail-monitor', status: 'idle', url: 'mail.google.com', duration: '02:15:00', profile: 'gmail' },
  { id: 3, name: 'failed-session', status: 'error', url: 'example.com', duration: '00:02:15', profile: 'default', error: 'Connection timeout' },
];

const initialEvents = [
  { id: 1, date: '2025-02-28', title: 'VPS Renewal', type: 'critical' },
  { id: 2, date: '2025-02-07', title: 'Sprint 1 End', type: 'task' },
  { id: 3, date: '2025-02-14', title: 'Sprint 2 End', type: 'task' },
  { id: 4, date: '2025-02-21', title: 'Sprint 3 End', type: 'task' },
  { id: 5, date: '2025-02-08', title: 'Memory Maintenance', type: 'auto' },
  { id: 6, date: '2025-02-15', title: 'Credential Rotation', type: 'auto' },
  { id: 7, date: '2025-02-22', title: 'Memory Maintenance', type: 'auto' },
  { id: 8, date: '2025-02-10', title: 'Google Sheets Sync', type: 'task' },
  { id: 9, date: '2025-02-12', title: 'Email Monitor Setup', type: 'task' },
  { id: 10, date: '2025-02-14', title: 'Multi-Agent Review', type: 'meeting' },
  { id: 11, date: '2025-03-02', title: 'Gemini Trial End', type: 'critical' },
  { id: 12, date: '2025-02-18', title: 'API Integration', type: 'idea' },
];

export const useAppStore = create(
  persist(
    (set, get) => ({
      sessions: initialSessions,
      activeSessionId: initialSessions[0]?.id || null,
      events: initialEvents,

      setSessions: (sessions) => set({ sessions }),
      setActiveSessionId: (id) => set({ activeSessionId: id }),
      addSession: (session) => set((state) => ({
        sessions: [...state.sessions, session],
        activeSessionId: session.id,
      })),
      stopSession: (id) => set((state) => ({
        sessions: state.sessions.map((s) =>
          s.id === id ? { ...s, status: 'idle' } : s
        ),
      })),
      deleteSession: (id) => set((state) => {
        const filtered = state.sessions.filter((s) => s.id !== id);
        return {
          sessions: filtered,
          activeSessionId: state.activeSessionId === id
            ? (filtered[0]?.id || null)
            : state.activeSessionId,
        };
      }),

      setEvents: (events) => set({ events }),
      addEvent: (event) => set((state) => ({
        events: [...state.events, event],
      })),
      updateEvent: (id, updates) => set((state) => ({
        events: state.events.map((e) =>
          e.id === id ? { ...e, ...updates } : e
        ),
      })),
      deleteEvent: (id) => set((state) => ({
        events: state.events.filter((e) => e.id !== id),
      })),

      getActiveSession: () => {
        const state = get();
        return state.sessions.find((s) => s.id === state.activeSessionId) || null;
      },
      getEventsForDate: (dateStr) => {
        return get().events.filter((e) => e.date === dateStr);
      },
    }),
    {
      name: 'openclaw-hub-storage',
      partialize: (state) => ({
        sessions: state.sessions,
        activeSessionId: state.activeSessionId,
        events: state.events,
      }),
    }
  )
);
