import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Server, HardDrive, Cpu, Container, Shield, Activity,
  RefreshCw, CheckCircle, AlertTriangle, XCircle, Clock
} from 'lucide-react';
import { GlassCard, GlassCardContent } from '@/components/ui/GlassCard';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

// Mock VPS Health Data (simulating data from VPS Health Bot)
const mockVPSHealth = {
  lastUpdated: new Date().toISOString(),
  system: {
    uptime: '5 days, 16h',
    load: [0.01, 0.00, 0.00],
    users: 2,
  },
  disk: {
    total: '96G',
    used: '17G',
    free: '79G',
    percentage: 18,
  },
  memory: {
    total: '7.8Gi',
    used: '1.2Gi',
    available: '6.5Gi',
    percentage: 15,
  },
  swap: null,
  docker: {
    containers: [
      { name: 'n8n-n8n-1', status: 'running', uptime: '5 days' },
      { name: 'n8n-traefik-1', status: 'running', uptime: '5 days' },
    ],
  },
  n8n: {
    version: '2.6.4',
    healthz: 200,
    activeWorkflows: 19,
    url: 'https://n8n.srv1201204.hstgr.cloud',
  },
  security: {
    fail2ban: {
      active: true,
      bannedIPs: 2,
      totalFailed: 10,
      currentlyFailed: 0,
    },
    ssh: 'keys-only',
    port3000: 'tailscale-only',
  },
  verdict: 'ALL GREEN',
};

const StatusBadge = ({ status }) => {
  const styles = {
    healthy: 'bg-success/20 text-success border-success/30',
    warning: 'bg-warning/20 text-warning border-warning/30',
    critical: 'bg-destructive/20 text-destructive border-destructive/30',
  };

  const icons = {
    healthy: CheckCircle,
    warning: AlertTriangle,
    critical: XCircle,
  };

  const Icon = icons[status] || CheckCircle;

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border ${styles[status]}`}>
      <Icon className="w-3 h-3" />
      {status === 'healthy' ? 'OK' : status.toUpperCase()}
    </span>
  );
};

const ProgressBar = ({ value, max = 100, warning = 70, critical = 90 }) => {
  const percentage = (value / max) * 100;
  let color = 'bg-success';
  if (percentage >= critical) color = 'bg-destructive';
  else if (percentage >= warning) color = 'bg-warning';

  return (
    <div className="w-full h-2 bg-secondary/50 rounded-full overflow-hidden">
      <motion.div
        className={`h-full ${color}`}
        initial={{ width: 0 }}
        animate={{ width: `${percentage}%` }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      />
    </div>
  );
};

const MetricCard = ({ icon: Icon, title, value, subValue, status, children }) => (
  <div className="p-3 rounded-lg bg-secondary/30 border border-border/30">
    <div className="flex items-center justify-between mb-2">
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4 text-primary" />
        <span className="text-sm font-medium text-foreground">{title}</span>
      </div>
      {status && <StatusBadge status={status} />}
    </div>
    <div className="text-lg font-bold text-foreground">{value}</div>
    {subValue && <div className="text-xs text-muted-foreground">{subValue}</div>}
    {children}
  </div>
);

export default function VPSHealthMonitor() {
  const [health, setHealth] = useState(mockVPSHealth);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const getOverallStatus = () => {
    if (health.disk.percentage >= 90 || health.memory.percentage >= 90) return 'critical';
    if (health.disk.percentage >= 70 || health.memory.percentage >= 70) return 'warning';
    if (health.docker.containers.some(c => c.status !== 'running')) return 'warning';
    if (health.n8n.healthz !== 200) return 'critical';
    return 'healthy';
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    setLastRefresh(new Date());
    setIsRefreshing(false);
    toast.success('VPS Health обновен', {
      description: 'Данните са актуализирани успешно',
    });
  };

  const formatTime = (date) => {
    return new Intl.DateTimeFormat('bg-BG', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
    >
      <GlassCard>
        <GlassCardContent className="p-5">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Server className="w-5 h-5 text-primary" />
              VPS Health Monitor
              <StatusBadge status={getOverallStatus()} />
            </h3>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatTime(lastRefresh)}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="h-8 w-8 p-0"
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>

          {/* Verdict Banner */}
          <div className={`mb-4 p-3 rounded-lg text-center font-medium ${
            health.verdict === 'ALL GREEN'
              ? 'bg-success/20 text-success border border-success/30'
              : 'bg-warning/20 text-warning border border-warning/30'
          }`}>
            🏥 {health.verdict} ✅
          </div>

          {/* Metrics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
            {/* System */}
            <MetricCard
              icon={Activity}
              title="System"
              value={`Uptime: ${health.system.uptime}`}
              subValue={`Load: ${health.system.load.join(' / ')}`}
              status="healthy"
            />

            {/* Disk */}
            <MetricCard
              icon={HardDrive}
              title="Disk"
              value={`${health.disk.used} / ${health.disk.total}`}
              subValue={`${health.disk.free} свободни`}
              status={health.disk.percentage >= 90 ? 'critical' : health.disk.percentage >= 70 ? 'warning' : 'healthy'}
            >
              <ProgressBar value={health.disk.percentage} />
            </MetricCard>

            {/* Memory */}
            <MetricCard
              icon={Cpu}
              title="Memory"
              value={`${health.memory.used} / ${health.memory.total}`}
              subValue={`${health.memory.available} налични`}
              status={health.memory.percentage >= 90 ? 'critical' : health.memory.percentage >= 70 ? 'warning' : 'healthy'}
            >
              <ProgressBar value={health.memory.percentage} />
            </MetricCard>
          </div>

          {/* Docker & n8n Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
            {/* Docker Containers */}
            <div className="p-3 rounded-lg bg-secondary/30 border border-border/30">
              <div className="flex items-center gap-2 mb-3">
                <Container className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium text-foreground">Docker Containers</span>
              </div>
              <div className="space-y-2">
                {health.docker.containers.map((container, idx) => (
                  <div key={idx} className="flex items-center justify-between text-sm">
                    <span className="font-mono text-xs text-muted-foreground">{container.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Up {container.uptime}</span>
                      <div className={`w-2 h-2 rounded-full ${
                        container.status === 'running' ? 'bg-success' : 'bg-destructive'
                      }`} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* n8n Status */}
            <div className="p-3 rounded-lg bg-secondary/30 border border-border/30">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-lg">⚡</span>
                  <span className="text-sm font-medium text-foreground">n8n</span>
                </div>
                <StatusBadge status={health.n8n.healthz === 200 ? 'healthy' : 'critical'} />
              </div>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Version</span>
                  <span className="text-foreground font-medium">v{health.n8n.version}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Healthz</span>
                  <span className="text-success">{health.n8n.healthz} OK</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Active Workflows</span>
                  <span className="text-foreground font-bold">{health.n8n.activeWorkflows}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Security Section */}
          <div className="p-3 rounded-lg bg-secondary/30 border border-border/30">
            <div className="flex items-center gap-2 mb-3">
              <Shield className="w-4 h-4 text-success" />
              <span className="text-sm font-medium text-foreground">Security</span>
              <StatusBadge status="healthy" />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground block text-xs">fail2ban</span>
                <span className="text-foreground">Active ✅</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-xs">Banned IPs</span>
                <span className="text-warning font-bold">{health.security.fail2ban.bannedIPs}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-xs">SSH</span>
                <span className="text-foreground">Keys Only ✅</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-xs">Port 3000</span>
                <span className="text-foreground">Tailscale ✅</span>
              </div>
            </div>
          </div>
        </GlassCardContent>
      </GlassCard>
    </motion.div>
  );
}
