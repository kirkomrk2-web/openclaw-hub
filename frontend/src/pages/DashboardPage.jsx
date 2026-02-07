import React from 'react';
import { motion } from 'framer-motion';
import {
  CircleCheck, TriangleAlert, Activity, Bot, Cpu, Database,
  Globe, Key, Play, Search, Server, Wifi, Zap
} from 'lucide-react';
import { GlassCard, GlassCardContent } from '@/components/ui/GlassCard';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

// Quick Stats Data
const stats = [
  { icon: Bot, label: 'Агенти', value: '3 активни', status: 'online', emoji: '🤖' },
  { icon: Zap, label: 'n8n', value: '11/100 active', status: 'healthy', emoji: '⚡' },
  { icon: Database, label: 'Supabase', value: '17 таблици', status: 'connected', emoji: '💾' },
  { icon: Globe, label: 'Airtop', value: '0 сесии', status: 'ready', emoji: '🌐' },
];

// Activity Feed Data
const activities = [
  { time: '14:32', type: 'success', message: 'Молти health check OK', icon: CircleCheck },
  { time: '14:28', type: 'info', message: 'n8n Wallester workflow triggered', icon: Zap },
  { time: '14:15', type: 'warning', message: 'KeePassXC credential accessed', icon: Key },
  { time: '14:02', type: 'info', message: 'Airtop session terminated gracefully', icon: Globe },
  { time: '13:45', type: 'error', message: 'VPS High CPU Alert: 87%', icon: TriangleAlert },
  { time: '13:30', type: 'success', message: 'Supabase sync completed', icon: Database },
  { time: '13:12', type: 'info', message: 'GitHub push detected: main branch', icon: Activity },
  { time: '12:58', type: 'success', message: 'Memory maintenance completed', icon: Cpu },
];

// Quick Actions
const quickActions = [
  { label: 'Нов Task', icon: Play, color: 'primary' },
  { label: 'Нова Airtop Сесия', icon: Globe, color: 'accent' },
  { label: 'Run Workflow', icon: Zap, color: 'warning' },
  { label: 'Search Skills', icon: Search, color: 'primary' },
  { label: 'n8n Status', icon: Activity, color: 'success' },
  { label: 'Get Credential', icon: Key, color: 'accent' },
];

// Tailscale Mesh Nodes
const meshNodes = [
  { name: 'Mac Air', ip: '100.121.178.114', type: 'laptop' },
  { name: 'Linux', ip: '100.89.20.112', type: 'server' },
  { name: 'VPS', ip: '72.61.154.188', type: 'cloud' },
  { name: 'Supabase', ip: 'cloud', type: 'database' },
];

const statusColors = {
  online: 'text-success',
  healthy: 'text-success',
  connected: 'text-primary',
  ready: 'text-accent',
};

const activityColors = {
  success: 'text-success border-success/30',
  info: 'text-primary border-primary/30',
  warning: 'text-warning border-warning/30',
  error: 'text-destructive border-destructive/30',
};

export default function DashboardPage() {
  const handleQuickAction = (action) => {
    toast.success(`${action.label} изпълнено`, {
      description: 'Действието е стартирано успешно',
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
          <span className="text-primary">🦞 OpenClaw</span> / Табло
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <GlassCard className="h-full" hover>
                <GlassCardContent className="p-4 sm:p-5">
                  <div className="flex items-start justify-between mb-3">
                    <span className="text-2xl">{stat.emoji}</span>
                    <div className={`flex items-center gap-1 text-xs ${statusColors[stat.status]}`}>
                      <div className="w-1.5 h-1.5 rounded-full bg-current" />
                      {stat.status}
                    </div>
                  </div>
                  <div className="text-lg sm:text-xl font-bold text-foreground">{stat.value}</div>
                  <div className="text-sm text-muted-foreground">{stat.label}</div>
                </GlassCardContent>
              </GlassCard>
            </motion.div>
          ))}
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Activity Feed */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="lg:col-span-3"
          >
            <GlassCard className="h-full">
              <GlassCardContent className="p-5">
                <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                  <Activity className="w-5 h-5 text-primary" />
                  Лента на Активността
                </h3>
                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                  {activities.map((activity, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.4 + index * 0.05 }}
                      className={`flex items-start gap-3 p-3 rounded-lg border bg-secondary/20 ${activityColors[activity.type]}`}
                    >
                      <activity.icon className="w-5 h-5 shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground">{activity.message}</p>
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0">{activity.time}</span>
                    </motion.div>
                  ))}
                </div>
              </GlassCardContent>
            </GlassCard>
          </motion.div>

          {/* Quick Actions */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
            className="lg:col-span-2"
          >
            <GlassCard className="h-full">
              <GlassCardContent className="p-5">
                <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                  <Zap className="w-5 h-5 text-warning" />
                  Бързи Действия
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  {quickActions.map((action, index) => (
                    <Button
                      key={index}
                      variant="outline"
                      className="h-auto py-4 flex flex-col items-center gap-2 border-border/50 hover:bg-primary/10 hover:border-primary/50"
                      onClick={() => handleQuickAction(action)}
                    >
                      <action.icon className={`w-5 h-5 text-${action.color}`} />
                      <span className="text-xs text-center">{action.label}</span>
                    </Button>
                  ))}
                </div>
              </GlassCardContent>
            </GlassCard>
          </motion.div>
        </div>

        {/* Tailscale Mesh Network */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <GlassCard>
            <GlassCardContent className="p-5">
              <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                <Wifi className="w-5 h-5 text-accent" />
                Tailscale Mesh Network
              </h3>
              <div className="flex flex-wrap items-center justify-center gap-4 py-6">
                {meshNodes.map((node, index) => (
                  <React.Fragment key={index}>
                    <div className="flex flex-col items-center">
                      <div className="w-16 h-16 rounded-2xl glass-card flex items-center justify-center mb-2 relative">
                        <Server className="w-8 h-8 text-primary" />
                        <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-success" />
                      </div>
                      <span className="text-sm font-medium text-foreground">{node.name}</span>
                      <span className="text-xs text-muted-foreground font-mono">{node.ip}</span>
                    </div>
                    {index < meshNodes.length - 1 && (
                      <div className="hidden sm:flex items-center">
                        <div className="w-12 h-0.5 bg-gradient-to-r from-primary to-accent relative overflow-hidden">
                          <motion.div
                            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent"
                            animate={{ x: ['-100%', '100%'] }}
                            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                          />
                        </div>
                        <span className="text-muted-foreground mx-1">↔</span>
                        <div className="w-12 h-0.5 bg-gradient-to-r from-accent to-primary relative overflow-hidden">
                          <motion.div
                            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent"
                            animate={{ x: ['100%', '-100%'] }}
                            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                          />
                        </div>
                      </div>
                    )}
                  </React.Fragment>
                ))}
              </div>
            </GlassCardContent>
          </GlassCard>
        </motion.div>
      </div>
    </motion.div>
  );
}
