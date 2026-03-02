import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
    Terminal,
    Globe,
    Database,
    Send,
    Loader2,
    Play,
    Trash2,
    Copy
} from 'lucide-react';
import { GlassCard, GlassCardContent } from '@/components/ui/GlassCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

const tabs = [
    { id: 'terminal', name: 'Terminal', icon: Terminal },
    { id: 'api', name: 'API Tester', icon: Globe },
    { id: 'sql', name: 'SQL Console', icon: Database },
];

// Mock terminal responses
const terminalResponses = {
    'помощ': `Налични команди:
• статус - Проверка на системния статус
• агенти - Списък с активни агенти
• n8n - n8n workflow статус
• supabase - Supabase статус
• airtop - Airtop сесии
• tailscale - Mesh network статус
• credentials - Списък с credentials
• skills - Списък с налични skills
• изчисти - Изчистване на терминала`,
    'статус': `[СИСТЕМЕН СТАТУС] ✓
├─ MoltBot v4.0.0: Online
├─ Claude Opus 4.6: Connected
├─ n8n: 11/100 workflows active
├─ Supabase: 17 tables, 2.4GB
├─ Airtop: 0 active sessions
├─ Tailscale: 4 nodes connected
└─ Uptime: 99.99%`,
    'агенти': `[АКТИВНИ АГЕНТИ]
┌─ Молти (Primary)
│  Status: Online
│  Tasks: 3 running
├─ Scheduler
│  Status: Idle
│  Next: 15:00
└─ Monitor
   Status: Active
   Watching: 5 services`,
    'n8n': `[N8N STATUS]
├─ Active Workflows: 11
├─ Total Workflows: 100
├─ Executions Today: 47
├─ Failed: 2
└─ Last Execution: 14:32 (Wallester V3)`,
    'supabase': `[SUPABASE STATUS]
├─ Tables: 17
├─ Storage: 2.4GB / 8GB
├─ Connections: 3 active
├─ Last Backup: 12:00
└─ Region: eu-central-1`,
    'airtop': `[AIRTOP STATUS]
├─ Active Sessions: 0
├─ Credits: 51.47
├─ Profiles: 4 saved
└─ Status: Ready`,
    'tailscale': `[TAILSCALE MESH]
├─ Mac Air: 100.121.178.114 ✓
├─ Linux: 100.89.20.112 ✓
├─ VPS: 72.61.154.188 ✓
└─ Supabase: cloud ✓`,
    'credentials': `[CREDENTIALS]
├─ API Keys: 5
├─ Tokens: 3
├─ SSH Keys: 3
├─ Database: 3
└─ Emails: 3`,
    'skills': `[SKILLS] 20 active
airtop-browser, github, n8n-orchestrator,
keepassxc, vps-manager, supabase-client,
filesystem, memory-store, web-scraper,
email-handler, google-sheets, notion-client...`,
    'default': `Команда не е разпозната. Въведете "помощ" за списък с команди.`,
};

// HTTP Methods
const httpMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

export default function PlaygroundPage() {
    const [activeTab, setActiveTab] = useState('terminal');

    // Terminal State
    const [terminalHistory, setTerminalHistory] = useState([
        { type: 'system', content: 'OpenClaw Terminal v4.0.0\nВъведете "помощ" за списък с команди.\n─────────────────────────────────' }
    ]);
    const [terminalInput, setTerminalInput] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const terminalRef = useRef(null);

    // API Tester State
    const [apiMethod, setApiMethod] = useState('GET');
    const [apiUrl, setApiUrl] = useState('');
    const [apiBody, setApiBody] = useState('{\n  \n}');
    const [apiResponse, setApiResponse] = useState(null);
    const [apiLoading, setApiLoading] = useState(false);

    // SQL Console State
    const [sqlQuery, setSqlQuery] = useState('SELECT * FROM users LIMIT 10;');
    const [sqlResult, setSqlResult] = useState(null);
    const [sqlLoading, setSqlLoading] = useState(false);

    useEffect(() => {
        if (terminalRef.current) {
            terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
        }
    }, [terminalHistory]);

    // Terminal Functions
    const executeCommand = (command) => {
        if (!command.trim() || isProcessing) return;

        const cmd = command.toLowerCase().trim();
        setTerminalHistory(prev => [...prev, { type: 'user', content: command }]);
        setTerminalInput('');
        setIsProcessing(true);

        if (cmd === 'изчисти') {
            setTimeout(() => {
                setTerminalHistory([
                    { type: 'system', content: 'OpenClaw Terminal v4.0.0\nВъведете "помощ" за списък с команди.\n─────────────────────────────────' }
                ]);
                setIsProcessing(false);
            }, 300);
            return;
        }

        setTimeout(() => {
            const response = terminalResponses[cmd] || terminalResponses.default;
            setTerminalHistory(prev => [...prev, { type: 'response', content: response }]);
            setIsProcessing(false);
        }, 500);
    };

    const handleTerminalSubmit = (e) => {
        e.preventDefault();
        executeCommand(terminalInput);
    };

    const handleQuickCommand = (cmd) => {
        executeCommand(cmd);
    };

    // API Tester Functions
    const handleApiTest = async () => {
        if (!apiUrl) {
            toast.error('Моля въведете URL');
            return;
        }

        setApiLoading(true);
        setApiResponse(null);

        // Mock API response
        setTimeout(() => {
            setApiResponse({
                status: 200,
                statusText: 'OK',
                headers: {
                    'content-type': 'application/json',
                    'x-request-id': 'abc123',
                },
                data: {
                    success: true,
                    message: 'Mock response from OpenClaw API',
                    timestamp: new Date().toISOString(),
                    data: [
                        { id: 1, name: 'Item 1' },
                        { id: 2, name: 'Item 2' },
                    ]
                },
                time: '145ms'
            });
            setApiLoading(false);
            toast.success('Заявката е изпълнена');
        }, 1000);
    };

    // SQL Console Functions
    const handleSqlExecute = () => {
        if (!sqlQuery.trim()) {
            toast.error('Моля въведете SQL заявка');
            return;
        }

        setSqlLoading(true);
        setSqlResult(null);

        // Mock SQL result
        setTimeout(() => {
            setSqlResult({
                columns: ['id', 'name', 'email', 'created_at'],
                rows: [
                    [1, 'John Doe', 'john@example.com', '2024-01-15'],
                    [2, 'Jane Smith', 'jane@example.com', '2024-01-16'],
                    [3, 'Bob Wilson', 'bob@example.com', '2024-01-17'],
                ],
                rowCount: 3,
                time: '23ms'
            });
            setSqlLoading(false);
            toast.success('Заявката е изпълнена');
        }, 800);
    };

    const handleSqlClear = () => {
        setSqlQuery('');
        setSqlResult(null);
    };

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
        toast.success('Копирано в клипборда');
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="pt-20 pb-8 px-4 sm:px-6 lg:px-8 min-h-screen"
        >
            <div className="max-w-6xl mx-auto space-y-6">
                {/* Breadcrumb */}
                <div className="text-sm text-muted-foreground">
                    <Link to="/" className="text-primary hover:underline">🦞 OpenClaw</Link> / Пясъчник
                </div>

                {/* Tabs */}
                <div className="flex gap-2">
                    {tabs.map((tab) => (
                        <Button
                            key={tab.id}
                            variant={activeTab === tab.id ? 'default' : 'outline'}
                            onClick={() => setActiveTab(tab.id)}
                            className={activeTab === tab.id ? 'bg-primary' : ''}
                        >
                            <tab.icon className="w-4 h-4 mr-2" />
                            {tab.name}
                        </Button>
                    ))}
                </div>

                {/* Terminal Tab */}
                {activeTab === 'terminal' && (
                    <GlassCard>
                        <GlassCardContent className="p-0">
                            {/* Terminal Header */}
                            <div className="flex items-center gap-2 p-3 border-b border-border/30">
                                <div className="w-3 h-3 rounded-full bg-destructive/80" />
                                <div className="w-3 h-3 rounded-full bg-warning/80" />
                                <div className="w-3 h-3 rounded-full bg-success/80" />
                                <span className="ml-2 text-sm text-muted-foreground font-mono">
                                    molti@openclaw-hub ~
                                </span>
                            </div>

                            {/* Terminal Content */}
                            <div
                                ref={terminalRef}
                                className="h-[400px] overflow-y-auto p-4 font-mono text-sm bg-secondary/10"
                            >
                                {terminalHistory.map((entry, index) => (
                                    <div key={index} className="mb-3">
                                        {entry.type === 'system' && (
                                            <div className="text-muted-foreground whitespace-pre-wrap">{entry.content}</div>
                                        )}
                                        {entry.type === 'user' && (
                                            <div className="flex items-start gap-2">
                                                <span className="text-success">❯</span>
                                                <span className="text-foreground">{entry.content}</span>
                                            </div>
                                        )}
                                        {entry.type === 'response' && (
                                            <div className="text-primary whitespace-pre-wrap pl-4 border-l-2 border-primary/30">
                                                {entry.content}
                                            </div>
                                        )}
                                    </div>
                                ))}
                                {isProcessing && (
                                    <div className="flex items-center gap-2 text-muted-foreground">
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        <span>Обработване...</span>
                                    </div>
                                )}
                            </div>

                            {/* Terminal Input */}
                            <form onSubmit={handleTerminalSubmit} className="flex items-center gap-2 p-3 border-t border-border/30">
                                <span className="text-success font-mono">❯</span>
                                <Input
                                    value={terminalInput}
                                    onChange={(e) => setTerminalInput(e.target.value)}
                                    placeholder="Въведете команда..."
                                    className="flex-1 bg-transparent border-none font-mono focus-visible:ring-0"
                                    disabled={isProcessing}
                                />
                                <Button type="submit" size="sm" disabled={isProcessing}>
                                    <Send className="w-4 h-4" />
                                </Button>
                            </form>

                            {/* Quick Commands */}
                            <div className="flex flex-wrap gap-2 p-3 border-t border-border/30">
                                {['помощ', 'статус', 'агенти', 'n8n', 'supabase', 'airtop'].map((cmd) => (
                                    <button
                                        key={cmd}
                                        onClick={() => handleQuickCommand(cmd)}
                                        className="px-2 py-1 text-xs font-mono rounded bg-secondary/30 text-muted-foreground hover:text-primary hover:bg-primary/10"
                                    >
                                        {cmd}
                                    </button>
                                ))}
                            </div>
                        </GlassCardContent>
                    </GlassCard>
                )}

                {/* API Tester Tab */}
                {activeTab === 'api' && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Request */}
                        <GlassCard>
                            <GlassCardContent className="p-4 space-y-4">
                                <h3 className="font-semibold text-foreground">Request</h3>

                                <div className="flex gap-2">
                                    <select
                                        value={apiMethod}
                                        onChange={(e) => setApiMethod(e.target.value)}
                                        className="px-3 py-2 rounded-lg bg-secondary/30 border border-border/30 text-foreground"
                                    >
                                        {httpMethods.map((m) => (
                                            <option key={m} value={m}>{m}</option>
                                        ))}
                                    </select>
                                    <Input
                                        value={apiUrl}
                                        onChange={(e) => setApiUrl(e.target.value)}
                                        placeholder="https://api.example.com/endpoint"
                                        className="flex-1 bg-secondary/30"
                                    />
                                </div>

                                {['POST', 'PUT', 'PATCH'].includes(apiMethod) && (
                                    <div>
                                        <label className="text-sm text-muted-foreground mb-2 block">Body (JSON)</label>
                                        <Textarea
                                            value={apiBody}
                                            onChange={(e) => setApiBody(e.target.value)}
                                            className="font-mono text-sm bg-secondary/30 h-[200px]"
                                        />
                                    </div>
                                )}

                                <Button
                                    className="w-full bg-primary"
                                    onClick={handleApiTest}
                                    disabled={apiLoading}
                                >
                                    {apiLoading ? (
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    ) : (
                                        <Play className="w-4 h-4 mr-2" />
                                    )}
                                    Изпрати
                                </Button>
                            </GlassCardContent>
                        </GlassCard>

                        {/* Response */}
                        <GlassCard>
                            <GlassCardContent className="p-4">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="font-semibold text-foreground">Response</h3>
                                    {apiResponse && (
                                        <div className="flex items-center gap-2">
                                            <span className={`text-sm ${apiResponse.status < 400 ? 'text-success' : 'text-destructive'}`}>
                                                {apiResponse.status} {apiResponse.statusText}
                                            </span>
                                            <span className="text-xs text-muted-foreground">{apiResponse.time}</span>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={() => copyToClipboard(JSON.stringify(apiResponse.data, null, 2))}
                                            >
                                                <Copy className="w-3 h-3" />
                                            </Button>
                                        </div>
                                    )}
                                </div>

                                <div className="h-[300px] overflow-auto bg-secondary/10 rounded-lg p-4 font-mono text-sm">
                                    {apiResponse ? (
                                        <pre className="text-foreground whitespace-pre-wrap">
                                            {JSON.stringify(apiResponse.data, null, 2)}
                                        </pre>
                                    ) : (
                                        <div className="h-full flex items-center justify-center text-muted-foreground">
                                            Отговорът ще се покаже тук
                                        </div>
                                    )}
                                </div>
                            </GlassCardContent>
                        </GlassCard>
                    </div>
                )}

                {/* SQL Console Tab */}
                {activeTab === 'sql' && (
                    <div className="space-y-6">
                        <GlassCard>
                            <GlassCardContent className="p-4 space-y-4">
                                <div className="flex items-center justify-between">
                                    <h3 className="font-semibold text-foreground">SQL Query</h3>
                                    <span className="text-xs text-muted-foreground">Supabase PostgreSQL</span>
                                </div>

                                <Textarea
                                    value={sqlQuery}
                                    onChange={(e) => setSqlQuery(e.target.value)}
                                    className="font-mono text-sm bg-secondary/30 h-[150px]"
                                    placeholder="SELECT * FROM table_name;"
                                />

                                <div className="flex gap-2">
                                    <Button
                                        className="bg-primary"
                                        onClick={handleSqlExecute}
                                        disabled={sqlLoading}
                                    >
                                        {sqlLoading ? (
                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        ) : (
                                            <Play className="w-4 h-4 mr-2" />
                                        )}
                                        Изпълни
                                    </Button>
                                    <Button variant="outline" onClick={handleSqlClear}>
                                        <Trash2 className="w-4 h-4 mr-2" />
                                        Изчисти
                                    </Button>
                                </div>
                            </GlassCardContent>
                        </GlassCard>

                        {/* SQL Results */}
                        <GlassCard>
                            <GlassCardContent className="p-4">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="font-semibold text-foreground">Резултати</h3>
                                    {sqlResult && (
                                        <span className="text-xs text-muted-foreground">
                                            {sqlResult.rowCount} {sqlResult.rowCount === 1 ? 'ред' : 'реда'} • {sqlResult.time}
                                        </span>
                                    )}
                                </div>

                                {sqlResult ? (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="border-b border-border/30">
                                                    {sqlResult.columns.map((col) => (
                                                        <th key={col} className="text-left p-2 font-medium text-muted-foreground">
                                                            {col}
                                                        </th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {sqlResult.rows.map((row, i) => (
                                                    <tr key={i} className="border-b border-border/20 hover:bg-secondary/20">
                                                        {row.map((cell, j) => (
                                                            <td key={j} className="p-2 text-foreground font-mono">
                                                                {cell}
                                                            </td>
                                                        ))}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                                        Резултатите ще се покажат тук
                                    </div>
                                )}
                            </GlassCardContent>
                        </GlassCard>
                    </div>
                )}
            </div>
        </motion.div>
    );
}
