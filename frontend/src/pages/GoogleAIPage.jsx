import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence, useInView } from 'framer-motion';
import {
  Sparkles, Zap, Brain, Globe, Code, Image, Video, Mic,
  BookOpen, Cloud, CreditCard, ChevronRight, ChevronDown,
  Star, Rocket, Shield, Users, Check, ArrowRight, Play,
  Pause, Volume2, VolumeX, ExternalLink, Crown, Gem,
  Cpu, FileText, Search, Layers, MessageSquare, GraduationCap,
  Clock, DollarSign, Monitor, Smartphone, X, ChevronUp
} from 'lucide-react';

// ─── Voice Narration System ───
const useVoiceNarration = () => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(false);
  const utteranceRef = useRef(null);

  const speak = useCallback((text) => {
    if (!isVoiceEnabled || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.05;
    utterance.pitch = 1;
    utterance.volume = 0.8;
    utterance.lang = 'en-US';
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(v => v.name.includes('Google') && v.lang.startsWith('en')) || voices.find(v => v.lang.startsWith('en'));
    if (preferred) utterance.voice = preferred;
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  }, [isVoiceEnabled]);

  const stop = useCallback(() => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }, []);

  const toggleVoice = useCallback(() => {
    if (isVoiceEnabled) {
      stop();
    }
    setIsVoiceEnabled(prev => !prev);
  }, [isVoiceEnabled, stop]);

  return { speak, stop, isSpeaking, isVoiceEnabled, toggleVoice };
};

// ─── Animated Section Wrapper ───
const AnimatedSection = ({ children, className = '', delay = 0, onInView, id }) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });

  useEffect(() => {
    if (isInView && onInView) onInView();
  }, [isInView, onInView]);

  return (
    <motion.section
      ref={ref}
      id={id}
      initial={{ opacity: 0, y: 60 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 60 }}
      transition={{ duration: 0.8, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={className}
    >
      {children}
    </motion.section>
  );
};

// ─── Floating Particles Background ───
const FloatingParticles = () => (
  <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
    {[...Array(20)].map((_, i) => (
      <motion.div
        key={i}
        className="absolute w-1 h-1 rounded-full"
        style={{
          background: `hsl(${210 + i * 15}, 80%, 60%)`,
          left: `${Math.random() * 100}%`,
          top: `${Math.random() * 100}%`,
        }}
        animate={{
          y: [0, -30, 0],
          opacity: [0.2, 0.6, 0.2],
          scale: [1, 1.5, 1],
        }}
        transition={{
          duration: 3 + Math.random() * 4,
          repeat: Infinity,
          delay: Math.random() * 2,
        }}
      />
    ))}
  </div>
);

// ─── Glowing Card ───
const GlowCard = ({ children, className = '', glowColor = 'from-blue-500/20 to-purple-500/20', onClick }) => (
  <motion.div
    whileHover={{ scale: 1.02, y: -4 }}
    whileTap={{ scale: 0.98 }}
    onClick={onClick}
    className={`relative group cursor-pointer ${className}`}
  >
    <div className="absolute -inset-0.5 bg-gradient-to-r rounded-2xl opacity-0 group-hover:opacity-100 blur-lg transition-all duration-500 ${glowColor}" />
    <div className="relative bg-gray-900/80 backdrop-blur-xl border border-white/10 rounded-2xl p-6 transition-all duration-300 group-hover:border-white/20">
      {children}
    </div>
  </motion.div>
);

// ─── Interactive Feature Card ───
const FeatureCard = ({ icon: Icon, title, description, color, link, delay = 0 }) => (
  <motion.a
    href={link}
    target="_blank"
    rel="noopener noreferrer"
    initial={{ opacity: 0, y: 30 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    transition={{ duration: 0.5, delay }}
    whileHover={{ scale: 1.05, y: -8 }}
    whileTap={{ scale: 0.97 }}
    className="block"
  >
    <div className={`relative overflow-hidden bg-gray-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6 transition-all duration-500 hover:border-${color}-500/50 group`}>
      <div className={`absolute top-0 right-0 w-32 h-32 bg-${color}-500/10 rounded-full blur-3xl group-hover:bg-${color}-500/20 transition-all duration-500`} />
      <div className={`w-12 h-12 rounded-xl bg-${color}-500/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}>
        <Icon className={`w-6 h-6 text-${color}-400`} />
      </div>
      <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
      <p className="text-gray-400 text-sm leading-relaxed">{description}</p>
      <div className={`mt-4 flex items-center gap-1 text-${color}-400 text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-300`}>
        <span>Learn more</span>
        <ArrowRight className="w-4 h-4" />
      </div>
    </div>
  </motion.a>
);

// ─── Pricing Tier Card ───
const PricingCard = ({ plan, price, originalPrice, features, highlight, ctaLink, badge, delay = 0 }) => (
  <motion.div
    initial={{ opacity: 0, y: 40 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    transition={{ duration: 0.6, delay }}
    whileHover={{ y: -8 }}
    className={`relative ${highlight ? 'z-10' : ''}`}
  >
    {badge && (
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true }}
        className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full text-white text-xs font-bold z-20"
      >
        {badge}
      </motion.div>
    )}
    <div className={`relative overflow-hidden rounded-2xl border transition-all duration-500 ${
      highlight
        ? 'bg-gradient-to-b from-blue-950/80 to-gray-900/90 border-blue-500/40 shadow-2xl shadow-blue-500/10'
        : 'bg-gray-900/60 border-white/10 hover:border-white/20'
    } backdrop-blur-xl p-8`}>
      <div className="text-center mb-6">
        <h3 className={`text-2xl font-bold mb-2 ${highlight ? 'text-blue-300' : 'text-white'}`}>{plan}</h3>
        <div className="flex items-baseline justify-center gap-1">
          <span className="text-4xl font-black text-white">${price}</span>
          <span className="text-gray-400">/month</span>
        </div>
        {originalPrice && (
          <div className="mt-1 text-sm text-gray-500 line-through">${originalPrice}/month</div>
        )}
      </div>
      <div className="space-y-3 mb-8">
        {features.map((feat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -10 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: delay + i * 0.05 }}
            className="flex items-start gap-3"
          >
            <Check className={`w-5 h-5 mt-0.5 flex-shrink-0 ${highlight ? 'text-blue-400' : 'text-green-400'}`} />
            <span className="text-gray-300 text-sm">{feat}</span>
          </motion.div>
        ))}
      </div>
      <a
        href={ctaLink}
        target="_blank"
        rel="noopener noreferrer"
        className={`block w-full py-3 px-6 rounded-xl text-center font-bold text-sm transition-all duration-300 ${
          highlight
            ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white hover:from-blue-600 hover:to-purple-600 shadow-lg shadow-blue-500/25'
            : 'bg-white/10 text-white hover:bg-white/20'
        }`}
      >
        Get Started <ArrowRight className="w-4 h-4 inline ml-1" />
      </a>
    </div>
  </motion.div>
);

// ─── Interactive Accordion ───
const AccordionItem = ({ title, children, icon: Icon, defaultOpen = false }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <motion.div layout className="border border-white/10 rounded-xl overflow-hidden bg-gray-900/40 backdrop-blur">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-5 text-left hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-3">
          {Icon && <Icon className="w-5 h-5 text-blue-400" />}
          <span className="font-semibold text-white">{title}</span>
        </div>
        <motion.div animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.3 }}>
          <ChevronDown className="w-5 h-5 text-gray-400" />
        </motion.div>
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="px-5 pb-5 text-gray-400 text-sm leading-relaxed border-t border-white/5 pt-4">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// ─── Step Progress ───
const SetupStep = ({ number, title, description, isActive, isCompleted, onClick }) => (
  <motion.div
    whileHover={{ scale: 1.02 }}
    onClick={onClick}
    className={`flex items-start gap-4 p-4 rounded-xl cursor-pointer transition-all duration-300 ${
      isActive ? 'bg-blue-500/10 border border-blue-500/30' : isCompleted ? 'bg-green-500/5 border border-green-500/20' : 'bg-gray-900/40 border border-white/5 hover:border-white/15'
    }`}
  >
    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 transition-all duration-300 ${
      isCompleted ? 'bg-green-500 text-white' : isActive ? 'bg-blue-500 text-white' : 'bg-gray-700 text-gray-400'
    }`}>
      {isCompleted ? <Check className="w-5 h-5" /> : number}
    </div>
    <div>
      <h4 className={`font-semibold ${isActive ? 'text-blue-300' : isCompleted ? 'text-green-300' : 'text-gray-300'}`}>{title}</h4>
      <p className="text-sm text-gray-500 mt-1">{description}</p>
    </div>
  </motion.div>
);

// ─── Typewriter ───
const Typewriter = ({ text, speed = 40, className = '' }) => {
  const [displayed, setDisplayed] = useState('');
  useEffect(() => {
    setDisplayed('');
    let i = 0;
    const timer = setInterval(() => {
      if (i < text.length) {
        setDisplayed(prev => prev + (text[i] ?? ''));
        i++;
      } else {
        clearInterval(timer);
      }
    }, speed);
    return () => clearInterval(timer);
  }, [text, speed]);
  return <span className={className}>{displayed}<span className="animate-pulse">|</span></span>;
};

// ─── Navigation Dots ───
const sections = [
  { id: 'hero', label: 'Welcome' },
  { id: 'overview', label: 'Overview' },
  { id: 'features', label: 'Features' },
  { id: 'tools', label: 'AI Tools' },
  { id: 'pricing', label: 'Pricing' },
  { id: 'use-cases', label: 'Use Cases' },
  { id: 'requirements', label: 'Requirements' },
  { id: 'faq', label: 'FAQ' },
  { id: 'setup', label: 'Quick Setup' },
];

const NavDots = ({ activeSection }) => (
  <div className="fixed right-6 top-1/2 -translate-y-1/2 z-50 hidden lg:flex flex-col gap-3">
    {sections.map((s) => (
      <a key={s.id} href={`#${s.id}`} className="group flex items-center gap-3 justify-end">
        <span className={`text-xs font-medium transition-all duration-300 opacity-0 group-hover:opacity-100 ${
          activeSection === s.id ? 'text-blue-400' : 'text-gray-500'
        }`}>
          {s.label}
        </span>
        <div className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
          activeSection === s.id ? 'bg-blue-400 scale-125 shadow-lg shadow-blue-400/50' : 'bg-gray-600 hover:bg-gray-400'
        }`} />
      </a>
    ))}
  </div>
);

// ────────────────────────────────────────────────────────────
// MAIN PAGE COMPONENT
// ────────────────────────────────────────────────────────────
const GoogleAIPage = () => {
  const [activeSection, setActiveSection] = useState('hero');
  const [activeSetupStep, setActiveSetupStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState([]);
  const [showComparison, setShowComparison] = useState(false);
  const { speak, stop, isSpeaking, isVoiceEnabled, toggleVoice } = useVoiceNarration();

  // Intersection Observer for active section
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        });
      },
      { threshold: 0.3 }
    );
    sections.forEach(s => {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  // Setup step progression
  const handleStepClick = (i) => {
    setActiveSetupStep(i);
    if (!completedSteps.includes(i - 1) && i > 0) {
      setCompletedSteps(prev => [...prev, i - 1]);
    }
  };

  // Voice narration data per section
  const narrations = {
    hero: "Welcome to the Google AI ecosystem overview. Discover the most powerful AI tools and plans from Google, including Gemini Advanced, Deep Research, and Project Genie.",
    overview: "Google offers three AI subscription tiers: AI Plus for casual users, AI Pro for professionals, and AI Ultra for power users and enterprises.",
    features: "Explore the incredible capabilities: from Deep Research that analyzes hundreds of sources, to Deep Think for advanced reasoning, and Project Genie for interactive world generation.",
    tools: "Google's AI tools span across coding with Gemini CLI and Jules, creativity with Flow and Whisk, research with NotebookLM Pro, and browsing with Project Mariner.",
    pricing: "Plans start at AI Plus for basic access. AI Pro is 19.99 dollars per month with 2 terabytes of storage. AI Ultra is 249.99 dollars monthly with 30 terabytes and all premium features.",
    'use-cases': "Use cases range from coding and development, academic research, creative content production, to enterprise workflows and business automation.",
    requirements: "All you need is a Google account, a modern web browser, and a compatible device. Works on desktop, mobile, and tablet.",
    faq: "Find answers to frequently asked questions about Google AI plans, features, billing, and how to get started.",
    setup: "Set up your Google AI account in under 60 seconds. Choose a plan, connect your Google account, and start using AI immediately.",
  };

  return (
    <div className="min-h-screen bg-[#0a0a1a] text-white overflow-x-hidden">
      <FloatingParticles />
      <NavDots activeSection={activeSection} />

      {/* Voice Control FAB */}
      <motion.button
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 1 }}
        onClick={toggleVoice}
        className={`fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full flex items-center justify-center shadow-2xl transition-all duration-300 ${
          isVoiceEnabled
            ? 'bg-gradient-to-r from-blue-500 to-purple-500 shadow-blue-500/30'
            : 'bg-gray-800 border border-white/10 hover:border-white/30'
        }`}
        title={isVoiceEnabled ? 'Disable voice narration' : 'Enable voice narration'}
      >
        {isVoiceEnabled ? (
          isSpeaking ? <Volume2 className="w-6 h-6 animate-pulse" /> : <Volume2 className="w-6 h-6" />
        ) : (
          <VolumeX className="w-6 h-6 text-gray-400" />
        )}
      </motion.button>

      {/* ═══════════════════ HERO ═══════════════════ */}
      <section id="hero" className="relative min-h-screen flex items-center justify-center px-4 pt-20">
        <div className="absolute inset-0">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-[120px]" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-[120px]" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-500/5 rounded-full blur-[150px]" />
        </div>

        <div className="relative z-10 text-center max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1, ease: 'easeOut' }}
            className="mb-8"
          >
            <motion.div
              animate={{ rotate: [0, 5, -5, 0] }}
              transition={{ duration: 4, repeat: Infinity }}
              className="inline-block"
            >
              <div className="w-24 h-24 mx-auto mb-6 rounded-3xl bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-2xl shadow-purple-500/30">
                <Sparkles className="w-12 h-12 text-white" />
              </div>
            </motion.div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.8 }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-sm font-medium mb-6">
              <Sparkles className="w-4 h-4" />
              Interactive Guide 2026
            </div>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.8 }}
            className="text-5xl sm:text-7xl font-black mb-6 leading-tight"
          >
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400">
              Google AI
            </span>
            <br />
            <span className="text-white">Ecosystem</span>
          </motion.h1>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="text-xl text-gray-400 mb-10 max-w-2xl mx-auto h-8"
          >
            <Typewriter text="Gemini Advanced · Deep Research · Project Genie · NotebookLM · Jules" speed={35} />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.2 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <a
              href="#pricing"
              className="px-8 py-4 bg-gradient-to-r from-blue-500 to-purple-500 rounded-2xl font-bold text-lg hover:from-blue-600 hover:to-purple-600 transition-all duration-300 shadow-xl shadow-blue-500/25 flex items-center gap-2"
            >
              <Rocket className="w-5 h-5" /> Explore Plans
            </a>
            <button
              onClick={() => {
                toggleVoice();
                if (!isVoiceEnabled) {
                  setTimeout(() => speak(narrations.hero), 300);
                }
              }}
              className="px-8 py-4 bg-white/10 backdrop-blur border border-white/20 rounded-2xl font-bold text-lg hover:bg-white/20 transition-all duration-300 flex items-center gap-2"
            >
              <Play className="w-5 h-5" /> Voice Tour
            </button>
          </motion.div>

          {/* Scroll indicator */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 2 }}
            className="absolute bottom-8 left-1/2 -translate-x-1/2"
          >
            <motion.div
              animate={{ y: [0, 10, 0] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="flex flex-col items-center gap-2 text-gray-500"
            >
              <span className="text-xs">Scroll to explore</span>
              <ChevronDown className="w-5 h-5" />
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ═══════════════════ OVERVIEW ═══════════════════ */}
      <AnimatedSection
        id="overview"
        className="relative py-32 px-4"
        onInView={() => { if (isVoiceEnabled) speak(narrations.overview); }}
      >
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-medium mb-4"
            >
              <Layers className="w-3.5 h-3.5" />
              Three Tiers
            </motion.div>
            <h2 className="text-4xl sm:text-5xl font-black mb-4">
              Choose Your <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">AI Power Level</span>
            </h2>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">
              Google restructured its AI offerings into three distinct plans — from casual exploration to enterprise-grade power.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {/* AI Plus */}
            <GlowCard glowColor="from-green-500/20 to-emerald-500/20">
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center">
                  <Star className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-bold text-green-300 mb-2">AI Plus</h3>
                <p className="text-gray-400 text-sm mb-4">Entry-level access to Google's AI</p>
                <ul className="text-left space-y-2 text-sm text-gray-400">
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-green-400" /> Gemini 3.1 Pro access</li>
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-green-400" /> Limited Veo 3.1 Fast</li>
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-green-400" /> AI Mode in Search</li>
                </ul>
              </div>
            </GlowCard>

            {/* AI Pro */}
            <GlowCard glowColor="from-blue-500/20 to-cyan-500/20">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-blue-500 rounded-full text-xs font-bold text-white">
                POPULAR
              </div>
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-blue-400 to-cyan-500 flex items-center justify-center">
                  <Gem className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-bold text-blue-300 mb-2">AI Pro</h3>
                <p className="text-gray-400 text-sm mb-4">$19.99/mo · Professional power</p>
                <ul className="text-left space-y-2 text-sm text-gray-400">
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-blue-400" /> Gemini Advanced + Deep Research</li>
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-blue-400" /> 2TB Storage</li>
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-blue-400" /> Workspace Integration</li>
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-blue-400" /> NotebookLM Pro (500 notebooks)</li>
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-blue-400" /> Jules 5x limits</li>
                </ul>
              </div>
            </GlowCard>

            {/* AI Ultra */}
            <GlowCard glowColor="from-purple-500/20 to-pink-500/20">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full text-xs font-bold text-white">
                ULTIMATE
              </div>
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-purple-400 to-pink-500 flex items-center justify-center">
                  <Crown className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-bold text-purple-300 mb-2">AI Ultra</h3>
                <p className="text-gray-400 text-sm mb-4">$249.99/mo · Maximum everything</p>
                <ul className="text-left space-y-2 text-sm text-gray-400">
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-purple-400" /> Deep Think reasoning</li>
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-purple-400" /> Project Genie worlds</li>
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-purple-400" /> 30TB Storage</li>
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-purple-400" /> $100/mo Cloud Credits</li>
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-purple-400" /> Jules 20x + Antigravity</li>
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-purple-400" /> YouTube Premium included</li>
                </ul>
              </div>
            </GlowCard>
          </div>
        </div>
      </AnimatedSection>

      {/* ═══════════════════ KEY FEATURES ═══════════════════ */}
      <AnimatedSection
        id="features"
        className="relative py-32 px-4"
        onInView={() => { if (isVoiceEnabled) speak(narrations.features); }}
      >
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-medium mb-4"
            >
              <Zap className="w-3.5 h-3.5" />
              Core Capabilities
            </motion.div>
            <h2 className="text-4xl sm:text-5xl font-black mb-4">
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-400">Breakthrough</span> Features
            </h2>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">
              Every feature is designed to amplify your productivity, creativity, and intelligence.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <FeatureCard
              icon={Brain}
              title="Deep Research"
              description="Analyzes hundreds of sources in real-time to generate comprehensive research reports in minutes."
              color="blue"
              link="https://gemini.google.com"
              delay={0}
            />
            <FeatureCard
              icon={Cpu}
              title="Deep Think"
              description="Advanced reasoning mode with iterative hypothesis exploration. Excels at math, science, and logic."
              color="purple"
              link="https://gemini.google.com"
              delay={0.1}
            />
            <FeatureCard
              icon={Globe}
              title="Project Genie"
              description="Generate and explore interactive 3D worlds from text and images. Physics simulation in real-time."
              color="pink"
              link="https://blog.google/innovation-and-ai/models-and-research/google-deepmind/project-genie/"
              delay={0.2}
            />
            <FeatureCard
              icon={Search}
              title="AI Mode in Search"
              description="Gemini 3 Pro powers conversational, deep search directly on google.com/ai."
              color="cyan"
              link="https://google.com/ai"
              delay={0.3}
            />
            <FeatureCard
              icon={FileText}
              title="1M Token Context"
              description="Process 1,500 pages of text or 30,000 lines of code in a single conversation."
              color="orange"
              link="https://gemini.google.com"
              delay={0.4}
            />
            <FeatureCard
              icon={Shield}
              title="25,000 AI Credits"
              description="Monthly credits for Flow, Whisk, and other creative AI products. Ultra exclusive."
              color="green"
              link="https://one.google.com/about/google-ai-plans/"
              delay={0.5}
            />
          </div>
        </div>
      </AnimatedSection>

      {/* ═══════════════════ AI TOOLS ECOSYSTEM ═══════════════════ */}
      <AnimatedSection
        id="tools"
        className="relative py-32 px-4"
        onInView={() => { if (isVoiceEnabled) speak(narrations.tools); }}
      >
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-pink-500/10 border border-pink-500/20 text-pink-400 text-xs font-medium mb-4"
            >
              <Rocket className="w-3.5 h-3.5" />
              Tool Ecosystem
            </motion.div>
            <h2 className="text-4xl sm:text-5xl font-black mb-4">
              AI Tools <span className="bg-clip-text text-transparent bg-gradient-to-r from-pink-400 to-orange-400">at Your Fingertips</span>
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { icon: Code, name: 'Gemini CLI', desc: 'Terminal-native AI coding', link: 'https://github.com/google-gemini/gemini-cli', color: 'blue' },
              { icon: Cpu, name: 'Jules', desc: 'Async coding agent', link: 'https://gemini.google/jules/', color: 'green' },
              { icon: BookOpen, name: 'NotebookLM', desc: 'AI research notebook', link: 'https://notebooklm.google.com', color: 'purple' },
              { icon: Video, name: 'Flow', desc: 'AI filmmaking suite', link: 'https://flow.google', color: 'pink' },
              { icon: Image, name: 'Whisk', desc: 'Creative image tools', link: 'https://labs.google/whisk', color: 'orange' },
              { icon: Globe, name: 'Project Mariner', desc: 'Browser AI agent', link: 'https://gemini.google.com', color: 'cyan' },
              { icon: Layers, name: 'Antigravity', desc: 'Agentic dev platform', link: 'https://idx.dev', color: 'indigo' },
              { icon: Monitor, name: 'Code Assist', desc: 'IDE AI extensions', link: 'https://cloud.google.com/gemini/docs/codeassist/overview', color: 'teal' },
            ].map((tool, i) => (
              <motion.a
                key={tool.name}
                href={tool.link}
                target="_blank"
                rel="noopener noreferrer"
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                whileHover={{ scale: 1.05, y: -4 }}
                className={`block p-5 bg-gray-900/60 backdrop-blur border border-white/10 rounded-xl hover:border-${tool.color}-500/40 transition-all duration-300 group`}
              >
                <tool.icon className={`w-8 h-8 text-${tool.color}-400 mb-3 group-hover:scale-110 transition-transform`} />
                <h4 className="font-bold text-white text-sm mb-1">{tool.name}</h4>
                <p className="text-gray-500 text-xs">{tool.desc}</p>
                <ExternalLink className="w-3.5 h-3.5 text-gray-600 mt-2 group-hover:text-white transition-colors" />
              </motion.a>
            ))}
          </div>

          {/* Workspace Integration Banner */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mt-10 p-8 rounded-2xl bg-gradient-to-r from-blue-900/40 to-purple-900/40 border border-blue-500/20 backdrop-blur"
          >
            <div className="flex flex-col md:flex-row items-center gap-6">
              <div className="flex-1">
                <h3 className="text-2xl font-bold text-white mb-2">Google Workspace Integration</h3>
                <p className="text-gray-400">
                  Gemini is built into Docs, Sheets, Slides, Gmail, Meet, Drive & Chat. AI assistance everywhere you work.
                </p>
              </div>
              <a
                href="https://workspace.google.com/solutions/ai/"
                target="_blank"
                rel="noopener noreferrer"
                className="px-6 py-3 bg-blue-500 hover:bg-blue-600 rounded-xl font-bold text-sm transition-colors flex items-center gap-2 whitespace-nowrap"
              >
                Explore Workspace AI <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          </motion.div>
        </div>
      </AnimatedSection>

      {/* ═══════════════════ PRICING ═══════════════════ */}
      <AnimatedSection
        id="pricing"
        className="relative py-32 px-4"
        onInView={() => { if (isVoiceEnabled) speak(narrations.pricing); }}
      >
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-medium mb-4"
            >
              <DollarSign className="w-3.5 h-3.5" />
              Pricing
            </motion.div>
            <h2 className="text-4xl sm:text-5xl font-black mb-4">
              Transparent <span className="bg-clip-text text-transparent bg-gradient-to-r from-green-400 to-emerald-400">Pricing</span>
            </h2>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">
              Choose the plan that fits your needs. Students get AI Pro free for a year!
            </p>
          </div>

          {/* 2026 Promo Banner */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="mb-10 p-6 rounded-2xl bg-gradient-to-r from-yellow-900/30 to-orange-900/30 border border-yellow-500/30 text-center"
          >
            <div className="flex items-center justify-center gap-2 text-yellow-400 font-bold text-lg mb-2">
              <Sparkles className="w-5 h-5" />
              2026 Limited-Time Offer
            </div>
            <p className="text-gray-300">
              New subscribers get <span className="text-yellow-300 font-bold">50% off</span> AI Pro annual plan — <span className="line-through text-gray-500">$199.99</span>{' '}
              <span className="text-yellow-300 font-bold">$99.99/year</span>
            </p>
            <a
              href="https://one.google.com/about/google-ai-plans/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 mt-3 text-yellow-400 hover:text-yellow-300 text-sm font-medium"
            >
              Claim offer <ArrowRight className="w-4 h-4" />
            </a>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6 items-start">
            <PricingCard
              plan="AI Plus"
              price="9.99"
              features={[
                'Gemini 3.1 Pro access',
                'Limited Veo 3.1 Fast',
                'AI Mode in Google Search',
                'Basic Google One storage',
              ]}
              ctaLink="https://one.google.com/about/google-ai-plans/"
              delay={0}
            />
            <PricingCard
              plan="AI Pro"
              price="19.99"
              originalPrice="19.99"
              features={[
                'Full Gemini Advanced + Deep Research',
                '2TB cloud storage',
                'Google Workspace AI features',
                'NotebookLM Pro (500 notebooks)',
                'Jules 5x coding limits',
                'Gemini Code Assist higher limits',
                'Whisk Animate + Flow access',
                'YouTube Premium discount',
              ]}
              highlight
              badge="MOST POPULAR"
              ctaLink="https://one.google.com/about/google-ai-plans/"
              delay={0.1}
            />
            <PricingCard
              plan="AI Ultra"
              price="249.99"
              features={[
                'Everything in AI Pro, plus:',
                'Deep Think advanced reasoning',
                'Project Genie interactive worlds',
                '30TB cloud storage + family sharing',
                '$100/mo Google Cloud credits',
                'Jules 20x + Antigravity access',
                'Project Mariner browser agent',
                '25,000 AI credits/month',
                'YouTube Premium included',
                'Available in 140+ countries',
              ]}
              badge="ULTIMATE POWER"
              ctaLink="https://one.google.com/about/google-ai-plans/"
              delay={0.2}
            />
          </div>

          {/* Student Banner */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mt-10 p-6 rounded-2xl bg-gradient-to-r from-indigo-900/30 to-blue-900/30 border border-indigo-500/20 flex flex-col sm:flex-row items-center gap-4"
          >
            <GraduationCap className="w-12 h-12 text-indigo-400 flex-shrink-0" />
            <div className="flex-1 text-center sm:text-left">
              <h4 className="font-bold text-white text-lg">Students: Free AI Pro for 1 Year!</h4>
              <p className="text-gray-400 text-sm">Sign up by April 30, 2026. Cancel anytime before auto-renewal at $19.99/mo.</p>
            </div>
            <a
              href="https://gemini.google/students/"
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 py-3 bg-indigo-500 hover:bg-indigo-600 rounded-xl font-bold text-sm transition-colors whitespace-nowrap flex items-center gap-2"
            >
              <GraduationCap className="w-4 h-4" /> Claim Free Year
            </a>
          </motion.div>
        </div>
      </AnimatedSection>

      {/* ═══════════════════ USE CASES ═══════════════════ */}
      <AnimatedSection
        id="use-cases"
        className="relative py-32 px-4"
        onInView={() => { if (isVoiceEnabled) speak(narrations['use-cases']); }}
      >
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-xs font-medium mb-4"
            >
              <Rocket className="w-3.5 h-3.5" />
              Use Cases
            </motion.div>
            <h2 className="text-4xl sm:text-5xl font-black mb-4">
              Built for <span className="bg-clip-text text-transparent bg-gradient-to-r from-orange-400 to-red-400">Every Workflow</span>
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: Code, title: 'Development & Coding',
                items: ['Ship code faster with Jules async agent', 'Terminal AI via Gemini CLI', 'IDE integration with Code Assist', 'Agent-first coding on Antigravity'],
                color: 'blue',
              },
              {
                icon: BookOpen, title: 'Research & Academia',
                items: ['Deep Research: 100s of sources in minutes', 'NotebookLM: 300 sources per notebook', 'Audio/Video overviews auto-generated', '1M token context for massive docs'],
                color: 'purple',
              },
              {
                icon: Video, title: 'Creative Production',
                items: ['Flow: AI filmmaking suite', 'Whisk Animate: image-to-video', 'Veo 3.1 professional video gen', '25,000 monthly AI credits'],
                color: 'pink',
              },
              {
                icon: MessageSquare, title: 'Business & Enterprise',
                items: ['Workspace AI in Docs/Sheets/Slides', 'Gmail AI compose & summarize', 'Meet transcription & notes', 'Drive intelligent search'],
                color: 'green',
              },
              {
                icon: Globe, title: 'Browsing & Automation',
                items: ['Project Mariner: 10 simultaneous tasks', 'Trip planning, ordering, reservations', 'AI-powered web browsing agent', 'Automate repetitive browser tasks'],
                color: 'cyan',
              },
              {
                icon: Sparkles, title: 'Interactive Worlds',
                items: ['Project Genie: text-to-world', 'Real-time physics simulation', 'Sketch, explore, and remix worlds', 'Available to Ultra subscribers'],
                color: 'orange',
              },
            ].map((uc, i) => (
              <motion.div
                key={uc.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="bg-gray-900/60 backdrop-blur border border-white/10 rounded-2xl p-6 hover:border-white/20 transition-all duration-300"
              >
                <uc.icon className={`w-10 h-10 text-${uc.color}-400 mb-4`} />
                <h3 className="text-lg font-bold text-white mb-4">{uc.title}</h3>
                <ul className="space-y-2">
                  {uc.items.map((item, j) => (
                    <li key={j} className="flex items-start gap-2 text-sm text-gray-400">
                      <ChevronRight className={`w-4 h-4 text-${uc.color}-400 mt-0.5 flex-shrink-0`} />
                      {item}
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </div>
        </div>
      </AnimatedSection>

      {/* ═══════════════════ REQUIREMENTS ═══════════════════ */}
      <AnimatedSection
        id="requirements"
        className="relative py-32 px-4"
        onInView={() => { if (isVoiceEnabled) speak(narrations.requirements); }}
      >
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-medium mb-4"
            >
              <Shield className="w-3.5 h-3.5" />
              Requirements
            </motion.div>
            <h2 className="text-4xl sm:text-5xl font-black mb-4">
              What You <span className="bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-teal-400">Need</span>
            </h2>
          </div>

          <div className="grid sm:grid-cols-3 gap-6">
            {[
              { icon: Users, title: 'Google Account', desc: 'Free Gmail or Google Workspace account. Manage everything from one dashboard.', color: 'blue' },
              { icon: Monitor, title: 'Modern Browser', desc: 'Chrome, Firefox, Safari, or Edge. Latest version recommended for best experience.', color: 'purple' },
              { icon: Smartphone, title: 'Any Device', desc: 'Desktop, laptop, tablet, or phone. Full experience on all screen sizes.', color: 'pink' },
            ].map((req, i) => (
              <motion.div
                key={req.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="text-center p-8 bg-gray-900/60 backdrop-blur border border-white/10 rounded-2xl"
              >
                <div className={`w-16 h-16 mx-auto mb-4 rounded-2xl bg-${req.color}-500/20 flex items-center justify-center`}>
                  <req.icon className={`w-8 h-8 text-${req.color}-400`} />
                </div>
                <h4 className="font-bold text-white text-lg mb-2">{req.title}</h4>
                <p className="text-gray-400 text-sm">{req.desc}</p>
              </motion.div>
            ))}
          </div>

          {/* Availability */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="mt-8 p-6 bg-gray-900/40 border border-white/10 rounded-2xl text-center"
          >
            <Globe className="w-8 h-8 text-blue-400 mx-auto mb-3" />
            <h4 className="text-white font-bold mb-2">Available in 140+ Countries</h4>
            <p className="text-gray-400 text-sm">Google AI Ultra is available worldwide. Some features like Project Genie are rolling out first in the US.</p>
          </motion.div>
        </div>
      </AnimatedSection>

      {/* ═══════════════════ FAQ ═══════════════════ */}
      <AnimatedSection
        id="faq"
        className="relative py-32 px-4"
        onInView={() => { if (isVoiceEnabled) speak(narrations.faq); }}
      >
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl sm:text-5xl font-black mb-4">
              Frequently <span className="bg-clip-text text-transparent bg-gradient-to-r from-yellow-400 to-orange-400">Asked</span>
            </h2>
          </div>

          <div className="space-y-3">
            <AccordionItem title="What's the difference between AI Pro and AI Ultra?" icon={Layers} defaultOpen>
              <strong>AI Pro ($19.99/mo)</strong> gives you Gemini Advanced, Deep Research, 2TB storage, Workspace AI, and NotebookLM Pro with 500 notebooks.
              <br /><br />
              <strong>AI Ultra ($249.99/mo)</strong> adds Deep Think reasoning, Project Genie interactive worlds, 30TB storage, $100/mo Google Cloud credits, Jules 20x limits, Project Mariner browser agent, 25,000 AI credits, and YouTube Premium included.
            </AccordionItem>

            <AccordionItem title="Can I try before I buy?" icon={Clock}>
              Students get <strong>free AI Pro for 1 year</strong> (sign up by April 30, 2026). New subscribers can get the 2026 promotional pricing at 50% off the annual plan.
            </AccordionItem>

            <AccordionItem title="What is Deep Research?" icon={Search}>
              Deep Research analyzes hundreds of web sources in real-time to produce comprehensive, cited research reports. It's like having a research assistant that reads the entire internet for you in minutes.
            </AccordionItem>

            <AccordionItem title="What is Project Genie?" icon={Globe}>
              Project Genie is a text/image-to-world AI that generates interactive 3D environments you can explore in real-time. It simulates physics and interactions. Currently available to AI Ultra users in the US, with generations up to 60 seconds.
            </AccordionItem>

            <AccordionItem title="What coding tools are included?" icon={Code}>
              <strong>Jules</strong> — async coding agent (5x limits Pro, 20x Ultra)<br />
              <strong>Gemini CLI</strong> — terminal AI coding tool<br />
              <strong>Gemini Code Assist</strong> — IDE extensions for VS Code and more<br />
              <strong>Antigravity</strong> — agentic development platform (Ultra only)<br />
              <strong>$100/mo Cloud credits</strong> for production deployment (Ultra only)
            </AccordionItem>

            <AccordionItem title="Is family sharing available?" icon={Users}>
              AI Ultra includes 30TB storage with family sharing for up to 5 members. The AI features themselves are tied to the individual subscriber's account.
            </AccordionItem>

            <AccordionItem title="How does the 1M token context work?" icon={FileText}>
              The 1 million token context window lets you process approximately 1,500 pages of text or 30,000 lines of code in a single Gemini conversation. This is ideal for analyzing large documents, codebases, or research papers.
            </AccordionItem>
          </div>
        </div>
      </AnimatedSection>

      {/* ═══════════════════ QUICK SETUP CTA ═══════════════════ */}
      <AnimatedSection
        id="setup"
        className="relative py-32 px-4"
        onInView={() => { if (isVoiceEnabled) speak(narrations.setup); }}
      >
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-medium mb-4"
            >
              <Clock className="w-3.5 h-3.5" />
              Under 60 Seconds
            </motion.div>
            <h2 className="text-4xl sm:text-5xl font-black mb-4">
              Ready to <span className="bg-clip-text text-transparent bg-gradient-to-r from-green-400 to-emerald-400">Get Started?</span>
            </h2>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">
              Set up your Google AI account in under 1 minute. No complicated docs — just 4 quick steps.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Steps */}
            <div className="space-y-3">
              {[
                { title: 'Visit Google AI Plans', description: 'Go to one.google.com and choose your tier.' },
                { title: 'Sign In with Google', description: 'Use your existing Gmail or create a new account.' },
                { title: 'Choose Your Plan', description: 'Select AI Plus, Pro, or Ultra. Apply promo if available.' },
                { title: 'Start Using AI', description: 'Open gemini.google.com and explore all your new tools!' },
              ].map((step, i) => (
                <SetupStep
                  key={i}
                  number={i + 1}
                  title={step.title}
                  description={step.description}
                  isActive={activeSetupStep === i}
                  isCompleted={completedSteps.includes(i)}
                  onClick={() => handleStepClick(i)}
                />
              ))}
            </div>

            {/* CTA Card */}
            <div className="flex items-center">
              <motion.div
                whileHover={{ scale: 1.02 }}
                className="w-full p-8 rounded-2xl bg-gradient-to-br from-blue-900/50 to-purple-900/50 border border-blue-500/30 text-center"
              >
                <div className="w-20 h-20 mx-auto mb-6 rounded-3xl bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
                  <Rocket className="w-10 h-10 text-white" />
                </div>
                <h3 className="text-2xl font-black text-white mb-3">Launch Your AI Journey</h3>
                <p className="text-gray-400 text-sm mb-6">
                  Join millions using Google's most advanced AI. Start for free or unlock all features with a plan.
                </p>
                <div className="space-y-3">
                  <a
                    href="https://one.google.com/about/google-ai-plans/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-full py-4 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl font-bold text-lg hover:from-blue-600 hover:to-purple-600 transition-all shadow-xl shadow-blue-500/25"
                  >
                    Choose a Plan <ArrowRight className="w-5 h-5 inline ml-2" />
                  </a>
                  <a
                    href="https://gemini.google.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-full py-4 bg-white/10 hover:bg-white/20 rounded-xl font-bold transition-all border border-white/10"
                  >
                    Try Gemini Free <ExternalLink className="w-4 h-4 inline ml-2" />
                  </a>
                  <a
                    href="https://gemini.google/students/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-full py-3 text-indigo-400 hover:text-indigo-300 font-medium text-sm transition-colors"
                  >
                    <GraduationCap className="w-4 h-4 inline mr-1" /> Students: Get Free AI Pro
                  </a>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </AnimatedSection>

      {/* ═══════════════════ FOOTER ═══════════════════ */}
      <footer className="relative py-16 px-4 border-t border-white/5">
        <div className="max-w-6xl mx-auto">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-10">
            <div>
              <h5 className="font-bold text-white mb-4">Google AI Plans</h5>
              <div className="space-y-2 text-sm">
                <a href="https://one.google.com/about/google-ai-plans/" target="_blank" rel="noopener noreferrer" className="block text-gray-400 hover:text-blue-400 transition-colors">Plans & Pricing</a>
                <a href="https://gemini.google/subscriptions/" target="_blank" rel="noopener noreferrer" className="block text-gray-400 hover:text-blue-400 transition-colors">Subscriptions</a>
                <a href="https://gemini.google/students/" target="_blank" rel="noopener noreferrer" className="block text-gray-400 hover:text-blue-400 transition-colors">Students</a>
              </div>
            </div>
            <div>
              <h5 className="font-bold text-white mb-4">AI Tools</h5>
              <div className="space-y-2 text-sm">
                <a href="https://gemini.google.com" target="_blank" rel="noopener noreferrer" className="block text-gray-400 hover:text-blue-400 transition-colors">Gemini</a>
                <a href="https://notebooklm.google.com" target="_blank" rel="noopener noreferrer" className="block text-gray-400 hover:text-blue-400 transition-colors">NotebookLM</a>
                <a href="https://github.com/google-gemini/gemini-cli" target="_blank" rel="noopener noreferrer" className="block text-gray-400 hover:text-blue-400 transition-colors">Gemini CLI</a>
              </div>
            </div>
            <div>
              <h5 className="font-bold text-white mb-4">Creative Tools</h5>
              <div className="space-y-2 text-sm">
                <a href="https://flow.google" target="_blank" rel="noopener noreferrer" className="block text-gray-400 hover:text-blue-400 transition-colors">Flow</a>
                <a href="https://labs.google/whisk" target="_blank" rel="noopener noreferrer" className="block text-gray-400 hover:text-blue-400 transition-colors">Whisk</a>
                <a href="https://blog.google/innovation-and-ai/models-and-research/google-deepmind/project-genie/" target="_blank" rel="noopener noreferrer" className="block text-gray-400 hover:text-blue-400 transition-colors">Project Genie</a>
              </div>
            </div>
            <div>
              <h5 className="font-bold text-white mb-4">Developer</h5>
              <div className="space-y-2 text-sm">
                <a href="https://cloud.google.com/gemini/docs/codeassist/overview" target="_blank" rel="noopener noreferrer" className="block text-gray-400 hover:text-blue-400 transition-colors">Code Assist</a>
                <a href="https://gemini.google/jules/" target="_blank" rel="noopener noreferrer" className="block text-gray-400 hover:text-blue-400 transition-colors">Jules</a>
                <a href="https://idx.dev" target="_blank" rel="noopener noreferrer" className="block text-gray-400 hover:text-blue-400 transition-colors">Project IDX</a>
              </div>
            </div>
          </div>
          <div className="text-center text-gray-600 text-xs border-t border-white/5 pt-8">
            <p>Interactive guide by OpenClaw Hub. This is an independent informational resource.</p>
            <p className="mt-1">Google, Gemini, and related trademarks belong to Google LLC.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default GoogleAIPage;
