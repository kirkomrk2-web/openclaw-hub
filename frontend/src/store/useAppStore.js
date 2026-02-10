import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Initial sessions data
const initialSessions = [
  { id: 1, name: 'wallester-reg', status: 'running', url: 'wallester.com', duration: '00:45:32', profile: 'wallester' },
  { id: 2, name: 'gmail-monitor', status: 'idle', url: 'mail.google.com', duration: '02:15:00', profile: 'gmail' },
  { id: 3, name: 'failed-session', status: 'error', url: 'example.com', duration: '00:02:15', profile: 'default', error: 'Connection timeout' },
];

// Initial calendar events
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

const useAppStore = create(
  persist(
    (set, get) => ({
      // === Watchtower Sessions ===
      sessions: initialSessions,
      activeSessionId: initialSessions[0]?.id || null,

      getActiveSession: () => {
        const { sessions, activeSessionId } = get();
        return sessions.find(s => s.id === activeSessionId) || null;
      },

      setActiveSessionId: (id) => set({ activeSessionId: id }),

      addSession: (session) => set((state) => ({
        sessions: [...state.sessions, session],
        activeSessionId: session.id,
      })),

      stopSession: (sessionId) => set((state) => ({
        sessions: state.sessions.map(s =>
          s.id === sessionId ? { ...s, status: 'idle' } : s
        ),
      })),

      deleteSession: (sessionId) => set((state) => {
        const filtered = state.sessions.filter(s => s.id !== sessionId);
        return {
          sessions: filtered,
          activeSessionId: state.activeSessionId === sessionId
            ? (filtered[0]?.id || null)
            : state.activeSessionId,
        };
      }),

      // === Calendar Events ===
      events: initialEvents,

      addEvent: (event) => set((state) => ({
        events: [...state.events, event],
      })),

      deleteEvent: (eventId) => set((state) => ({
        events: state.events.filter(e => e.id !== eventId),
      })),

      updateEvent: (eventId, updates) => set((state) => ({
        events: state.events.map(e =>
          e.id === eventId ? { ...e, ...updates } : e
        ),
      })),
    }),
    {
      name: 'openclaw-app-store',
      partialize: (state) => ({
        sessions: state.sessions,
        activeSessionId: state.activeSessionId,
        events: state.events,
      }),
    }
  )
);

export default useAppStore;
