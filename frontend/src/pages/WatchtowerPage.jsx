import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
    Eye,
    Plus,
    X,
    Play,
    Square,
    Trash2,
    Clock,
    Globe,
    AlertTriangle,
    CheckCircle2,
    Settings,
    Bookmark,
    ChevronDown
} from 'lucide-react';
import { GlassCard, GlassCardContent } from '@/components/ui/GlassCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import useAppStore from '@/store/useAppStore';

// Saved Profiles
const savedProfiles = [
    { name: 'wallester', proxy: true, timeout: 30 },
    { name: 'gmail', proxy: false, timeout: 60 },
    { name: 'default', proxy: false, timeout: 30 },
    { name: 'scraper', proxy: true, timeout: 120 },
];

// Session Logs
const sessionLogs = [
    { time: '14:45:32', type: 'info', message: 'Session started: wallester-reg' },
    { time: '14:45:35', type: 'success', message: 'Browser initialized successfully' },
    { time: '14:45:38', type: 'info', message: 'Navigating to wallester.com' },
    { time: '14:45:42', type: 'success', message: 'Page loaded (2.4s)' },
    { time: '14:46:01', type: 'info', message: 'Form detected: login-form' },
    { time: '14:46:15', type: 'warning', message: 'CAPTCHA detected, waiting...' },
    { time: '14:46:45', type: 'success', message: 'CAPTCHA solved automatically' },
    { time: '14:47:02', type: 'info', message: 'Login successful' },
];

const statusColors = {
    running: { bg: 'bg-success/20', border: 'border-success', text: 'text-success', label: 'Running' },
    idle: { bg: 'bg-warning/20', border: 'border-warning', text: 'text-warning', label: 'Idle' },
    error: { bg: 'bg-destructive/20', border: 'border-destructive', text: 'text-destructive', label: 'Error' },
};

export default function WatchtowerPage() {
    const sessions = useAppStore((s) => s.sessions);
    const activeSessionId = useAppStore((s) => s.activeSessionId);
    const setActiveSessionId = useAppStore((s) => s.setActiveSessionId);
    const addSession = useAppStore((s) => s.addSession);
    const stopSession = useAppStore((s) => s.stopSession);
    const deleteSession = useAppStore((s) => s.deleteSession);

    const activeSession = sessions.find(s => s.id === activeSessionId) || null;

    const [showNewSessionModal, setShowNewSessionModal] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
    const [showSettingsDropdown, setShowSettingsDropdown] = useState(false);
    const settingsRef = useRef(null);
    const [newSession, setNewSession] = useState({
        name: '',
        url: '',
        profile: 'default',
        timeout: 30,
        proxy: false,
    });

    // Close settings dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (settingsRef.current && !settingsRef.current.contains(e.target)) {
                setShowSettingsDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleCreateSession = () => {
        if (!newSession.name || !newSession.url) {
            toast.error('Моля попълнете всички полета');
            return;
        }

        const session = {
            id: Date.now(),
            name: newSession.name,
            status: 'running',
            url: newSession.url,
            duration: '00:00:00',
            profile: newSession.profile,
        };

        addSession(session);
        setShowNewSessionModal(false);
        setNewSession({ name: '', url: '', profile: 'default', timeout: 30, proxy: false });
        toast.success('Сесията е създадена');
    };

    const handleStopSession = (session) => {
        stopSession(session.id);
        toast.info(`${session.name} е спряна`);
    };

    const handleDeleteSession = (session) => {
        setShowDeleteConfirm(session);
    };

    const confirmDeleteSession = () => {
        if (showDeleteConfirm) {
            deleteSession(showDeleteConfirm.id);
            toast.success(`${showDeleteConfirm.name} е изтрита`);
            setShowDeleteConfirm(null);
        }
    };

    const handleSettingsAction = (action) => {
        setShowSettingsDropdown(false);
        switch (action) {
            case 'clear':
                toast.success('Логовете са изчистени');
                break;
            case 'export':
                toast.success('Логовете са експортирани');
                break;
            case 'settings':
                toast.info('Настройки на сесията');
                break;
            default:
                break;
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="pt-20 pb-8 px-4 sm:px-6 lg:px-8 min-h-screen"
        >
            <div className="max-w-7xl mx-auto space-y-6">
                {/* Breadcrumb & Credits */}
                <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">
                        <Link to="/" className="text-primary hover:underline">🦞 OpenClaw</Link> / Наблюдател
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full glass-card">
                        <span className="text-xs text-muted-foreground">Credits:</span>
                        <span className="text-sm font-bold gradient-text">51.47</span>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                    {/* Left Panel - Sessions List */}
                    <div className="lg:col-span-1 space-y-4">
                        <GlassCard>
                            <GlassCardContent className="p-4">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="font-semibold text-foreground">Сесии</h3>
                                    <Button
                                        size="sm"
                                        onClick={() => setShowNewSessionModal(true)}
                                        className="bg-primary hover:bg-primary/90"
                                    >
                                        <Plus className="w-4 h-4" />
                                    </Button>
                                </div>

                                <div className="space-y-2">
                                    {sessions.map((session) => (
                                        <motion.button
                                            key={session.id}
                                            onClick={() => setActiveSessionId(session.id)}
                                            className={`w-full p-3 rounded-lg border-2 text-left transition-all ${
                                                activeSessionId === session.id
                                                    ? `${statusColors[session.status].border} ${statusColors[session.status].bg}`
                                                    : 'border-border/30 hover:border-primary/50'
                                            } ${session.status === 'error' ? 'animate-pulse' : ''}`}
                                            whileHover={{ scale: 1.02 }}
                                        >
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="font-medium text-foreground text-sm truncate">
                                                    {session.name}
                                                </span>
                                                <span className={`text-xs ${statusColors[session.status].text}`}>
                                                    {statusColors[session.status].label}
                                                </span>
                                            </div>
                                            <div className="text-xs text-muted-foreground truncate">
                                                {session.url}
                                            </div>
                                        </motion.button>
                                    ))}
                                </div>
                            </GlassCardContent>
                        </GlassCard>

                        {/* Saved Profiles */}
                        <GlassCard>
                            <GlassCardContent className="p-4">
                                <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                                    <Bookmark className="w-4 h-4 text-primary" />
                                    Запазени Профили
                                </h3>
                                <div className="space-y-2">
                                    {savedProfiles.map((profile) => (
                                        <div
                                            key={profile.name}
                                            className="flex items-center justify-between p-2 rounded-lg bg-secondary/20"
                                        >
                                            <span className="text-sm text-foreground">{profile.name}</span>
                                            <div className="flex items-center gap-2">
                                                {profile.proxy && (
                                                    <span className="text-xs px-1.5 py-0.5 rounded bg-accent/20 text-accent">
                                                        Proxy
                                                    </span>
                                                )}
                                                <span className="text-xs text-muted-foreground">{profile.timeout}s</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </GlassCardContent>
                        </GlassCard>
                    </div>

                    {/* Main Panel - Live View */}
                    <div className="lg:col-span-3 space-y-4">
                        {/* Session Tabs */}
                        <div className="flex items-center gap-2 overflow-x-auto pb-2">
                            {sessions.filter(s => s.status !== 'error').map((session) => (
                                <button
                                    key={session.id}
                                    onClick={() => setActiveSessionId(session.id)}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-t-lg transition-all whitespace-nowrap ${
                                        activeSessionId === session.id
                                            ? 'bg-primary/20 text-primary border-b-2 border-primary'
                                            : 'text-muted-foreground hover:text-foreground'
                                    }`}
                                >
                                    <div className={`w-2 h-2 rounded-full ${
                                        session.status === 'running' ? 'bg-success animate-pulse' : 'bg-warning'
                                    }`} />
                                    {session.name}
                                </button>
                            ))}
                        </div>

                        {/* Live View Frame */}
                        <GlassCard className={`${
                            activeSession?.status === 'error'
                                ? 'border-2 border-destructive animate-pulse'
                                : activeSession?.status === 'idle'
                                    ? 'border-2 border-warning'
                                    : ''
                        }`}>
                            <GlassCardContent className="p-0">
                                {/* Frame Header */}
                                <div className="flex items-center justify-between p-3 border-b border-border/30">
                                    <div className="flex items-center gap-3">
                                        <Eye className="w-5 h-5 text-primary" />
                                        <span className="font-medium text-foreground">
                                            {activeSession?.name || 'Няма активна сесия'}
                                        </span>
                                        {activeSession && (
                                            <span className={`text-xs px-2 py-0.5 rounded-full ${statusColors[activeSession.status].bg} ${statusColors[activeSession.status].text}`}>
                                                {statusColors[activeSession.status].label}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {activeSession?.status === 'running' && (
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => handleStopSession(activeSession)}
                                            >
                                                <Square className="w-3 h-3 mr-1" />
                                                Stop
                                            </Button>
                                        )}
                                        {activeSession && (
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className="text-destructive"
                                                onClick={() => handleDeleteSession(activeSession)}
                                            >
                                                <Trash2 className="w-3 h-3" />
                                            </Button>
                                        )}
                                    </div>
                                </div>

                                {/* Iframe Placeholder */}
                                <div
                                    className="h-[400px] bg-secondary/10 flex items-center justify-center"
                                    style={{
                                        backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 50px, rgba(108, 156, 255, 0.03) 50px, rgba(108, 156, 255, 0.03) 51px), repeating-linear-gradient(90deg, transparent, transparent 50px, rgba(108, 156, 255, 0.03) 50px, rgba(108, 156, 255, 0.03) 51px)'
                                    }}
                                >
                                    {activeSession ? (
                                        <div className="text-center">
                                            <Globe className="w-16 h-16 text-primary/30 mx-auto mb-4" />
                                            <p className="text-muted-foreground">
                                                Airtop Live View: <span className="text-primary">{activeSession.url}</span>
                                            </p>
                                            <p className="text-sm text-muted-foreground mt-2">
                                                iframe placeholder (allow="clipboard-read;clipboard-write")
                                            </p>
                                            <div className="flex items-center justify-center gap-2 mt-4">
                                                <Clock className="w-4 h-4 text-muted-foreground" />
                                                <span className="font-mono text-foreground">{activeSession.duration}</span>
                                            </div>
                                        </div>
                                    ) : (
                                        <p className="text-muted-foreground">Изберете сесия от списъка</p>
                                    )}
                                </div>
                            </GlassCardContent>
                        </GlassCard>

                        {/* Session Log */}
                        <GlassCard>
                            <GlassCardContent className="p-4">
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="font-semibold text-foreground flex items-center gap-2">
                                        <Settings className="w-4 h-4 text-primary" />
                                        Session Log
                                    </h3>
                                    {/* Settings Dropdown */}
                                    <div className="relative" ref={settingsRef}>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setShowSettingsDropdown(!showSettingsDropdown)}
                                        >
                                            <Settings className="w-4 h-4" />
                                            <ChevronDown className="w-3 h-3 ml-1" />
                                        </Button>
                                        {showSettingsDropdown && (
                                            <div className="absolute right-0 top-full mt-1 w-48 rounded-lg border border-border/30 bg-background/95 backdrop-blur-xl shadow-lg z-50">
                                                <button
                                                    className="w-full text-left px-4 py-2 text-sm text-foreground hover:bg-primary/10 rounded-t-lg"
                                                    onClick={() => handleSettingsAction('clear')}
                                                >
                                                    Изчисти логове
                                                </button>
                                                <button
                                                    className="w-full text-left px-4 py-2 text-sm text-foreground hover:bg-primary/10"
                                                    onClick={() => handleSettingsAction('export')}
                                                >
                                                    Експортирай логове
                                                </button>
                                                <button
                                                    className="w-full text-left px-4 py-2 text-sm text-foreground hover:bg-primary/10 rounded-b-lg"
                                                    onClick={() => handleSettingsAction('settings')}
                                                >
                                                    Настройки
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="h-[200px] overflow-y-auto space-y-1 font-mono text-xs">
                                    {sessionLogs.map((log, index) => (
                                        <div
                                            key={index}
                                            className={`flex items-start gap-2 p-2 rounded ${
                                                log.type === 'success' ? 'text-success' :
                                                log.type === 'warning' ? 'text-warning' :
                                                log.type === 'error' ? 'text-destructive' : 'text-muted-foreground'
                                            }`}
                                        >
                                            <span className="text-muted-foreground shrink-0">[{log.time}]</span>
                                            {log.type === 'success' && <CheckCircle2 className="w-3 h-3 shrink-0 mt-0.5" />}
                                            {log.type === 'warning' && <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />}
                                            <span>{log.message}</span>
                                        </div>
                                    ))}
                                </div>
                            </GlassCardContent>
                        </GlassCard>
                    </div>
                </div>

                {/* New Session Modal */}
                <AnimatePresence>
                    {showNewSessionModal && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
                            onClick={() => setShowNewSessionModal(false)}
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
                                                Нова Airtop Сесия
                                            </h3>
                                            <Button variant="ghost" size="icon" onClick={() => setShowNewSessionModal(false)}>
                                                <X className="w-5 h-5" />
                                            </Button>
                                        </div>

                                        <div className="space-y-4">
                                            <div>
                                                <label className="text-sm text-muted-foreground mb-2 block">Име на сесията</label>
                                                <Input
                                                    value={newSession.name}
                                                    onChange={(e) => setNewSession({ ...newSession, name: e.target.value })}
                                                    placeholder="my-session"
                                                    className="bg-secondary/30"
                                                />
                                            </div>

                                            <div>
                                                <label className="text-sm text-muted-foreground mb-2 block">URL</label>
                                                <Input
                                                    value={newSession.url}
                                                    onChange={(e) => setNewSession({ ...newSession, url: e.target.value })}
                                                    placeholder="https://example.com"
                                                    className="bg-secondary/30"
                                                />
                                            </div>

                                            <div>
                                                <label className="text-sm text-muted-foreground mb-2 block">Профил</label>
                                                <select
                                                    value={newSession.profile}
                                                    onChange={(e) => setNewSession({ ...newSession, profile: e.target.value })}
                                                    className="w-full p-2 rounded-lg bg-secondary/30 border border-border/30 text-foreground"
                                                >
                                                    {savedProfiles.map((p) => (
                                                        <option key={p.name} value={p.name}>{p.name}</option>
                                                    ))}
                                                </select>
                                            </div>

                                            <div>
                                                <label className="text-sm text-muted-foreground mb-2 block">Timeout (секунди)</label>
                                                <Input
                                                    type="number"
                                                    value={newSession.timeout}
                                                    onChange={(e) => setNewSession({ ...newSession, timeout: parseInt(e.target.value) })}
                                                    className="bg-secondary/30"
                                                />
                                            </div>

                                            <div className="flex items-center gap-3">
                                                <input
                                                    type="checkbox"
                                                    id="proxy"
                                                    checked={newSession.proxy}
                                                    onChange={(e) => setNewSession({ ...newSession, proxy: e.target.checked })}
                                                    className="w-4 h-4 rounded border-border/30"
                                                />
                                                <label htmlFor="proxy" className="text-sm text-foreground">Използвай Proxy</label>
                                            </div>

                                            <Button
                                                className="w-full bg-primary hover:bg-primary/90"
                                                onClick={handleCreateSession}
                                            >
                                                <Play className="w-4 h-4 mr-2" />
                                                Стартирай Сесия
                                            </Button>
                                        </div>
                                    </GlassCardContent>
                                </GlassCard>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Delete Confirmation Modal */}
                <AnimatePresence>
                    {showDeleteConfirm && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
                            onClick={() => setShowDeleteConfirm(null)}
                        >
                            <motion.div
                                initial={{ scale: 0.9, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0.9, opacity: 0 }}
                                onClick={(e) => e.stopPropagation()}
                                className="w-full max-w-sm"
                            >
                                <GlassCard>
                                    <GlassCardContent className="p-6">
                                        <div className="text-center">
                                            <AlertTriangle className="w-12 h-12 text-destructive mx-auto mb-4" />
                                            <h3 className="text-lg font-semibold text-foreground mb-2">
                                                Изтриване на сесия
                                            </h3>
                                            <p className="text-sm text-muted-foreground mb-6">
                                                Сигурни ли сте, че искате да изтриете <strong>{showDeleteConfirm.name}</strong>?
                                            </p>
                                            <div className="flex gap-3">
                                                <Button
                                                    variant="outline"
                                                    className="flex-1"
                                                    onClick={() => setShowDeleteConfirm(null)}
                                                >
                                                    Отказ
                                                </Button>
                                                <Button
                                                    className="flex-1 bg-destructive hover:bg-destructive/90"
                                                    onClick={confirmDeleteSession}
                                                >
                                                    <Trash2 className="w-4 h-4 mr-2" />
                                                    Изтрий
                                                </Button>
                                            </div>
                                        </div>
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
