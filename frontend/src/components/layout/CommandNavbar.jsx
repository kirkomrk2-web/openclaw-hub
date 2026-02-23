import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Calendar, Eye, FolderOpen, LayoutDashboard, Menu, Sparkles, Terminal, X } from 'lucide-react';

const navLinks = [
  { name: 'Табло', href: '/', icon: LayoutDashboard },
  { name: 'Календар', href: '/calendar', icon: Calendar },
  { name: 'Ресурси', href: '/resources', icon: FolderOpen },
  { name: 'Наблюдател', href: '/watchtower', icon: Eye },
  { name: 'Пясъчник', href: '/playground', icon: Terminal },
  { name: 'Google AI', href: '/google-ai', icon: Sparkles },
];

export const CommandNavbar = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();

  const isActive = (href) => {
    if (href === '/') return location.pathname === '/';
    return location.pathname === href;
  };

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2 group">
              <span className="text-2xl">🦞</span>
              <span className="text-lg font-bold text-foreground hidden sm:inline">
                OpenClaw <span className="gradient-text">Hub</span>
              </span>
            </Link>

            {/* Desktop Nav Links */}
            <div className="hidden md:flex items-center gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  to={link.href}
                  className={`flex items-center gap-2 px-4 py-2 text-sm rounded-lg transition-all duration-200 ${
                    isActive(link.href)
                      ? 'text-primary bg-primary/10 font-medium'
                      : 'text-muted-foreground hover:text-primary hover:bg-primary/10'
                  }`}
                >
                  <link.icon className="w-4 h-4" />
                  {link.name}
                </Link>
              ))}
            </div>

            {/* Right side */}
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full glass-card">
                <span className="text-lg">🦞</span>
                <span className="text-sm text-foreground font-medium">Молти</span>
                <div className="relative">
                  <div className="w-2.5 h-2.5 rounded-full bg-success" />
                  <div className="absolute inset-0 w-2.5 h-2.5 rounded-full bg-success animate-ping opacity-75" />
                </div>
                <span className="text-xs text-success">Online</span>
              </div>
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="md:hidden p-2 text-foreground hover:text-primary transition-colors"
              >
                {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="fixed top-16 left-0 right-0 z-40 bg-background/95 backdrop-blur-xl border-b border-border/30 md:hidden"
        >
          <div className="px-4 py-4 space-y-2">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                to={link.href}
                onClick={() => setIsMobileMenuOpen(false)}
                className={`flex items-center gap-3 w-full px-4 py-3 rounded-lg transition-all ${
                  isActive(link.href)
                    ? 'text-primary bg-primary/10 font-medium'
                    : 'text-foreground hover:bg-primary/10'
                }`}
              >
                <link.icon className="w-5 h-5" />
                {link.name}
              </Link>
            ))}
            <div className="flex items-center gap-2 px-4 py-3 border-t border-border/30 mt-2">
              <span className="text-lg">🦞</span>
              <span className="text-sm text-foreground font-medium">Молти</span>
              <div className="w-2 h-2 rounded-full bg-success" />
              <span className="text-xs text-success">Online</span>
            </div>
          </div>
        </motion.div>
      )}
    </>
  );
};
