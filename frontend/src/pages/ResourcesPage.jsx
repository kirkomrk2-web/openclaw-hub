import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
    Search, 
    Folder, 
    Key, 
    Server, 
    Workflow,
    ChevronRight,
    ChevronDown,
    Play,
    Edit,
    FileText,
    CheckCircle2,
    XCircle,
    RefreshCw
} from 'lucide-react';
import { GlassCard, GlassCardContent } from '@/components/ui/GlassCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

// Skills Data
const skillsData = [
    { name: 'airtop-browser', category: 'Browser', status: 'active' },
    { name: 'github', category: 'DevOps', status: 'active' },
    { name: 'n8n-orchestrator', category: 'Automation', status: 'active' },
    { name: 'keepassxc', category: 'Security', status: 'active' },
    { name: 'vps-manager', category: 'Infrastructure', status: 'active' },
    { name: 'wallestars-devops', category: 'DevOps', status: 'active' },
    { name: 'supabase-client', category: 'Database', status: 'active' },
    { name: 'filesystem', category: 'System', status: 'active' },
    { name: 'memory-store', category: 'System', status: 'active' },
    { name: 'sequential-thinking', category: 'AI', status: 'active' },
    { name: 'web-scraper', category: 'Browser', status: 'active' },
    { name: 'email-handler', category: 'Communication', status: 'active' },
    { name: 'slack-integration', category: 'Communication', status: 'inactive' },
    { name: 'discord-bot', category: 'Communication', status: 'inactive' },
    { name: 'google-sheets', category: 'Productivity', status: 'active' },
    { name: 'notion-client', category: 'Productivity', status: 'active' },
    { name: 'calendar-sync', category: 'Productivity', status: 'active' },
    { name: 'pdf-processor', category: 'Documents', status: 'active' },
    { name: 'image-analyzer', category: 'AI', status: 'active' },
    { name: 'code-executor', category: 'DevOps', status: 'active' },
];

// Credentials Tree
const credentialsTree = [
    {
        name: 'API Keys',
        items: ['Airtop-PAID', 'N8N', 'DuoPlus', 'OpenAI', 'Anthropic'],
    },
    {
        name: 'Tokens',
        items: ['GitHub-PAT', 'Netlify-Token', 'Vercel-Token'],
    },
    {
        name: 'SSH Keys',
        items: ['VPS-Root', 'GitHub-Deploy', 'Backup-Server'],
    },
    {
        name: 'Supabase',
        items: ['PostgreSQL-DB', 'API-Anon-Key', 'API-Service-Key'],
    },
    {
        name: 'Emails',
        items: ['Primary-Gmail', 'Work-Email', 'Notifications'],
    },
];

// MCP Servers
const mcpServers = [
    { name: 'n8n', status: 'connected', port: 5678 },
    { name: 'supabase', status: 'connected', port: 54321 },
    { name: 'netlify', status: 'connected', port: 8888 },
    { name: 'github', status: 'connected', port: 3000 },
    { name: 'filesystem', status: 'connected', port: 8080 },
    { name: 'memory', status: 'connected', port: 9000 },
    { name: 'sequential-thinking', status: 'connected', port: 9001 },
    { name: 'fetch', status: 'disconnected', port: 8081 },
];

// n8n Workflows
const workflows = [
    { id: 1, name: 'Wallester V3', nodes: 33, status: 'active', lastRun: '14:32' },
    { id: 2, name: 'Verified Owners', nodes: 26, status: 'active', lastRun: '13:45' },
    { id: 3, name: 'Email Monitor', nodes: 12, status: 'active', lastRun: '14:00' },
    { id: 4, name: 'GitHub Sync', nodes: 8, status: 'active', lastRun: '12:30' },
    { id: 5, name: 'Memory Backup', nodes: 15, status: 'paused', lastRun: '10:00' },
    { id: 6, name: 'Daily Report', nodes: 18, status: 'active', lastRun: '09:00' },
    { id: 7, name: 'Credential Rotation', nodes: 22, status: 'scheduled', lastRun: '—' },
    { id: 8, name: 'Health Check', nodes: 6, status: 'active', lastRun: '14:28' },
];

const tabs = [
    { id: 'skills', name: 'Skills', icon: Folder },
    { id: 'credentials', name: 'Credentials', icon: Key },
    { id: 'mcp', name: 'MCP Servers', icon: Server },
    { id: 'workflows', name: 'n8n Workflows', icon: Workflow },
];

export default function ResourcesPage() {
    const [activeTab, setActiveTab] = useState('skills');
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedFolders, setExpandedFolders] = useState(['API Keys']);

    const toggleFolder = (folder) => {
        setExpandedFolders(prev => 
            prev.includes(folder) 
                ? prev.filter(f => f !== folder) 
                : [...prev, folder]
        );
    };

    const filteredSkills = skillsData.filter(skill => 
        skill.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        skill.category.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleTestConnection = (server) => {
        toast.promise(
            new Promise(resolve => setTimeout(resolve, 1000)),
            {
                loading: `Тестване на ${server.name}...`,
                success: `${server.name} е достъпен`,
                error: `${server.name} не отговаря`,
            }
        );
    };

    const handleWorkflowAction = (workflow, action) => {
        toast.success(`${action} за ${workflow.name}`, {
            description: 'Действието е изпълнено',
        });
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="pt-20 pb-8 px-4 sm:px-6 lg:px-8 min-h-screen"
        >
            <div className="max-w-7xl mx-auto space-y-6">
                {/* Breadcrumb */}
                <div className="text-sm text-muted-foreground">
                    <span className="text-primary">🦞 OpenClaw</span> / Ресурси
                </div>

                {/* Tabs */}
                <div className="flex flex-wrap gap-2">
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

                {/* Content */}
                <GlassCard>
                    <GlassCardContent className="p-6">
                        {/* Skills Tab */}
                        {activeTab === 'skills' && (
                            <div className="space-y-4">
                                <div className="flex items-center gap-4">
                                    <div className="relative flex-1">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                        <Input
                                            placeholder="Търсене на skills..."
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            className="pl-10 bg-secondary/30"
                                        />
                                    </div>
                                    <span className="text-sm text-muted-foreground">
                                        {filteredSkills.length} skills
                                    </span>
                                </div>
                                
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                                    {filteredSkills.map((skill, index) => (
                                        <motion.div
                                            key={skill.name}
                                            initial={{ opacity: 0, scale: 0.9 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            transition={{ delay: index * 0.02 }}
                                            className={`p-3 rounded-lg border transition-all cursor-pointer hover:border-primary/50 ${
                                                skill.status === 'active' 
                                                    ? 'bg-success/10 border-success/30' 
                                                    : 'bg-secondary/20 border-border/30'
                                            }`}
                                        >
                                            <div className="text-sm font-mono text-foreground truncate">{skill.name}</div>
                                            <div className="text-xs text-muted-foreground mt-1">{skill.category}</div>
                                        </motion.div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Credentials Tab */}
                        {activeTab === 'credentials' && (
                            <div className="space-y-2">
                                {credentialsTree.map((folder) => (
                                    <div key={folder.name}>
                                        <button
                                            onClick={() => toggleFolder(folder.name)}
                                            className="w-full flex items-center gap-2 p-3 rounded-lg hover:bg-secondary/30 transition-colors"
                                        >
                                            {expandedFolders.includes(folder.name) 
                                                ? <ChevronDown className="w-4 h-4 text-primary" />
                                                : <ChevronRight className="w-4 h-4 text-muted-foreground" />
                                            }
                                            <Folder className="w-4 h-4 text-warning" />
                                            <span className="font-medium text-foreground">{folder.name}</span>
                                            <span className="text-xs text-muted-foreground ml-auto">
                                                {folder.items.length} items
                                            </span>
                                        </button>
                                        
                                        {expandedFolders.includes(folder.name) && (
                                            <motion.div
                                                initial={{ opacity: 0, height: 0 }}
                                                animate={{ opacity: 1, height: 'auto' }}
                                                className="ml-6 space-y-1 mt-1"
                                            >
                                                {folder.items.map((item) => (
                                                    <div
                                                        key={item}
                                                        className="flex items-center gap-2 p-2 pl-4 rounded-lg hover:bg-secondary/20 cursor-pointer"
                                                    >
                                                        <Key className="w-3 h-3 text-accent" />
                                                        <span className="text-sm text-foreground">{item}</span>
                                                        <span className="text-xs text-success ml-auto">●</span>
                                                    </div>
                                                ))}
                                            </motion.div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* MCP Servers Tab */}
                        {activeTab === 'mcp' && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                {mcpServers.map((server) => (
                                    <div
                                        key={server.name}
                                        className={`p-4 rounded-lg border ${
                                            server.status === 'connected'
                                                ? 'border-success/30 bg-success/10'
                                                : 'border-destructive/30 bg-destructive/10'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="font-medium text-foreground">{server.name}</span>
                                            {server.status === 'connected' 
                                                ? <CheckCircle2 className="w-4 h-4 text-success" />
                                                : <XCircle className="w-4 h-4 text-destructive" />
                                            }
                                        </div>
                                        <div className="text-xs text-muted-foreground mb-3">
                                            Port: {server.port}
                                        </div>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="w-full"
                                            onClick={() => handleTestConnection(server)}
                                        >
                                            <RefreshCw className="w-3 h-3 mr-2" />
                                            Test Connection
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Workflows Tab */}
                        {activeTab === 'workflows' && (
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b border-border/30">
                                            <th className="text-left p-3 text-sm font-medium text-muted-foreground">Workflow</th>
                                            <th className="text-left p-3 text-sm font-medium text-muted-foreground">Nodes</th>
                                            <th className="text-left p-3 text-sm font-medium text-muted-foreground">Status</th>
                                            <th className="text-left p-3 text-sm font-medium text-muted-foreground">Last Run</th>
                                            <th className="text-right p-3 text-sm font-medium text-muted-foreground">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {workflows.map((workflow) => (
                                            <tr key={workflow.id} className="border-b border-border/20 hover:bg-secondary/20">
                                                <td className="p-3">
                                                    <span className="font-medium text-foreground">{workflow.name}</span>
                                                </td>
                                                <td className="p-3 text-muted-foreground">{workflow.nodes} nodes</td>
                                                <td className="p-3">
                                                    <span className={`text-xs px-2 py-1 rounded-full ${
                                                        workflow.status === 'active' ? 'bg-success/20 text-success' :
                                                        workflow.status === 'paused' ? 'bg-warning/20 text-warning' :
                                                        'bg-primary/20 text-primary'
                                                    }`}>
                                                        {workflow.status}
                                                    </span>
                                                </td>
                                                <td className="p-3 text-muted-foreground">{workflow.lastRun}</td>
                                                <td className="p-3 text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <Button 
                                                            size="sm" 
                                                            variant="ghost"
                                                            onClick={() => handleWorkflowAction(workflow, 'Run')}
                                                        >
                                                            <Play className="w-3 h-3" />
                                                        </Button>
                                                        <Button 
                                                            size="sm" 
                                                            variant="ghost"
                                                            onClick={() => handleWorkflowAction(workflow, 'Edit')}
                                                        >
                                                            <Edit className="w-3 h-3" />
                                                        </Button>
                                                        <Button 
                                                            size="sm" 
                                                            variant="ghost"
                                                            onClick={() => handleWorkflowAction(workflow, 'Logs')}
                                                        >
                                                            <FileText className="w-3 h-3" />
                                                        </Button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </GlassCardContent>
                </GlassCard>
            </div>
        </motion.div>
    );
}
