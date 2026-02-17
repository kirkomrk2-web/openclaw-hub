import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bot, Copy, Key, KeyRound, Loader2, MessageSquare, Plus, Send, Shield, Trash2, User, UserPlus, X
} from 'lucide-react';
import { GlassCard, GlassCardContent } from '@/components/ui/GlassCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

// Bot channels with predefined commands
const BOT_CHANNELS = [
  { id: 'local-gateway', name: 'Local Gateway', icon: '🌐', description: 'Local system commands', color: 'text-primary' },
  { id: 'leon', name: 'Leon', icon: '🤖', description: 'AI Assistant', color: 'text-accent' },
  { id: 'zara', name: 'Zara', icon: '⚡', description: 'Automation Bot', color: 'text-warning' },
];

// Crypto utilities using Web Crypto API
const cryptoUtils = {
  async generateKeyPair() {
    const keyPair = await window.crypto.subtle.generateKey(
      { name: 'ECDH', namedCurve: 'P-256' },
      true,
      ['deriveKey', 'deriveBits']
    );
    const publicKey = await window.crypto.subtle.exportKey('jwk', keyPair.publicKey);
    const privateKey = await window.crypto.subtle.exportKey('jwk', keyPair.privateKey);
    return { publicKey, privateKey };
  },

  async deriveSharedSecret(privateKeyJwk, publicKeyJwk) {
    const privateKey = await window.crypto.subtle.importKey(
      'jwk', privateKeyJwk, { name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits']
    );
    const publicKey = await window.crypto.subtle.importKey(
      'jwk', publicKeyJwk, { name: 'ECDH', namedCurve: 'P-256' }, false, []
    );
    const sharedBits = await window.crypto.subtle.deriveBits(
      { name: 'ECDH', public: publicKey }, privateKey, 256
    );
    return await window.crypto.subtle.importKey(
      'raw', sharedBits, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']
    );
  },

  async encrypt(key, message) {
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(message);
    const ciphertext = await window.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv }, key, encoded
    );
    return {
      iv: Array.from(iv),
      ciphertext: Array.from(new Uint8Array(ciphertext))
    };
  },

  async decrypt(key, { iv, ciphertext }) {
    const decrypted = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: new Uint8Array(iv) },
      key,
      new Uint8Array(ciphertext)
    );
    return new TextDecoder().decode(decrypted);
  },

  generateFingerprint(publicKey) {
    const data = JSON.stringify(publicKey);
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      hash = ((hash << 5) - hash) + data.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash).toString(16).toUpperCase().padStart(8, '0');
  }
};

// Glass Key Visual Component
const GlassKeyVisual = ({ fingerprint }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !fingerprint) return;
    const ctx = canvas.getContext('2d');
    const size = 80;
    canvas.width = size;
    canvas.height = size;

    // Generate pattern from fingerprint
    const colors = ['#6C9CFF', '#00D4FF', '#A855F7', '#10B981'];
    ctx.fillStyle = '#0F1423';
    ctx.fillRect(0, 0, size, size);

    for (let i = 0; i < fingerprint.length; i++) {
      const charCode = fingerprint.charCodeAt(i);
      const x = (charCode * 7 + i * 13) % size;
      const y = (charCode * 11 + i * 17) % size;
      const radius = (charCode % 8) + 4;

      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = colors[i % colors.length] + '60';
      ctx.fill();
    }
  }, [fingerprint]);

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        className="rounded-xl border border-primary/30"
        style={{ imageRendering: 'pixelated' }}
      />
      <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-primary/10 to-transparent pointer-events-none" />
    </div>
  );
};

// Message Bubble Component
const MessageBubble = ({ message, isSent }) => (
  <motion.div
    initial={{ opacity: 0, y: 10, scale: 0.95 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    className={`flex ${isSent ? 'justify-end' : 'justify-start'} mb-3`}
  >
    <div
      className={`max-w-[80%] px-4 py-3 rounded-2xl ${
        isSent
          ? 'bg-primary/20 border border-primary/30 rounded-br-md'
          : 'glass-card rounded-bl-md'
      }`}
    >
      <p className="text-sm text-foreground">{message.text}</p>
      <div className="flex items-center gap-2 mt-1">
        <span className="text-[10px] text-muted-foreground">{message.time}</span>
        {message.encrypted && (
          <Shield className="w-3 h-3 text-success" />
        )}
      </div>
    </div>
  </motion.div>
);

// Identity Setup Component
const IdentitySetup = ({ onGenerate, isGenerating }) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.95 }}
    animate={{ opacity: 1, scale: 1 }}
    className="flex flex-col items-center justify-center h-full p-8"
  >
    <GlassCard className="max-w-md w-full" glow>
      <GlassCardContent className="p-8 text-center">
        <div className="w-20 h-20 rounded-2xl glass-card mx-auto mb-6 flex items-center justify-center">
          <KeyRound className="w-10 h-10 text-primary" />
        </div>
        <h2 className="text-2xl font-bold text-foreground mb-2">Create Your Identity</h2>
        <p className="text-muted-foreground mb-6">
          Generate an ECDH P-256 key pair for end-to-end encrypted conversations.
          Your private key never leaves this device.
        </p>
        <Button
          size="lg"
          className="w-full bg-primary/20 border border-primary/40 hover:bg-primary/30"
          onClick={onGenerate}
          disabled={isGenerating}
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Key className="w-4 h-4 mr-2" />
              Generate Identity
            </>
          )}
        </Button>
      </GlassCardContent>
    </GlassCard>
  </motion.div>
);

// Invite Modal Component
const InviteModal = ({ isOpen, onClose, identity, inviteToken, onGenerateInvite, onAcceptInvite }) => {
  const [acceptToken, setAcceptToken] = useState('');
  const [activeTab, setActiveTab] = useState('generate');

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-lg"
        >
          <GlassCard glow>
            <GlassCardContent className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-foreground flex items-center gap-2">
                  <Key className="w-5 h-5 text-primary" />
                  Glass Key Invite
                </h3>
                <Button variant="ghost" size="icon" onClick={onClose}>
                  <X className="w-5 h-5" />
                </Button>
              </div>

              {/* Tabs */}
              <div className="flex gap-2 mb-6">
                <Button
                  variant={activeTab === 'generate' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setActiveTab('generate')}
                  className={activeTab === 'generate' ? 'bg-primary/20 border-primary/40' : ''}
                >
                  Generate Invite
                </Button>
                <Button
                  variant={activeTab === 'accept' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setActiveTab('accept')}
                  className={activeTab === 'accept' ? 'bg-primary/20 border-primary/40' : ''}
                >
                  Accept Invite
                </Button>
              </div>

              {activeTab === 'generate' ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <GlassKeyVisual fingerprint={identity?.fingerprint} />
                    <div>
                      <p className="text-sm font-medium text-foreground">Your Fingerprint</p>
                      <p className="text-xs font-mono text-primary">{identity?.fingerprint}</p>
                    </div>
                  </div>

                  {inviteToken ? (
                    <div className="space-y-3">
                      <p className="text-sm text-muted-foreground">Share this token with your contact:</p>
                      <div className="p-3 rounded-lg bg-secondary/30 border border-border/50">
                        <code className="text-xs text-foreground break-all">{inviteToken}</code>
                      </div>
                      <Button
                        className="w-full"
                        variant="outline"
                        onClick={() => {
                          navigator.clipboard.writeText(inviteToken);
                          toast.success('Token copied to clipboard');
                        }}
                      >
                        <Copy className="w-4 h-4 mr-2" />
                        Copy Token
                      </Button>
                    </div>
                  ) : (
                    <Button
                      className="w-full bg-primary/20 border border-primary/40 hover:bg-primary/30"
                      onClick={onGenerateInvite}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Generate New Invite Token
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">Paste an invite token from your contact:</p>
                  <Input
                    placeholder="Paste invite token here..."
                    value={acceptToken}
                    onChange={(e) => setAcceptToken(e.target.value)}
                    className="font-mono text-xs"
                  />
                  <Button
                    className="w-full bg-primary/20 border border-primary/40 hover:bg-primary/30"
                    onClick={() => {
                      onAcceptInvite(acceptToken);
                      setAcceptToken('');
                    }}
                    disabled={!acceptToken.trim()}
                  >
                    <UserPlus className="w-4 h-4 mr-2" />
                    Accept Invite
                  </Button>
                </div>
              )}
            </GlassCardContent>
          </GlassCard>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default function ConversationsPage() {
  const [identity, setIdentity] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [contacts, setContacts] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState({});
  const [newMessage, setNewMessage] = useState('');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteToken, setInviteToken] = useState('');
  const messagesEndRef = useRef(null);

  // Load identity from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('openclaw-identity');
    if (stored) {
      setIdentity(JSON.parse(stored));
    }
    const storedContacts = localStorage.getItem('openclaw-contacts');
    if (storedContacts) {
      setContacts(JSON.parse(storedContacts));
    }
    const storedMessages = localStorage.getItem('openclaw-messages');
    if (storedMessages) {
      setMessages(JSON.parse(storedMessages));
    }
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, activeChat]);

  const handleGenerateIdentity = async () => {
    setIsGenerating(true);
    try {
      const keyPair = await cryptoUtils.generateKeyPair();
      const fingerprint = cryptoUtils.generateFingerprint(keyPair.publicKey);
      const newIdentity = { ...keyPair, fingerprint, createdAt: new Date().toISOString() };
      setIdentity(newIdentity);
      localStorage.setItem('openclaw-identity', JSON.stringify(newIdentity));
      toast.success('Identity generated successfully', {
        description: `Fingerprint: ${fingerprint}`,
      });
    } catch (error) {
      toast.error('Failed to generate identity', { description: error.message });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateInvite = () => {
    if (!identity) return;
    const token = btoa(JSON.stringify({
      publicKey: identity.publicKey,
      fingerprint: identity.fingerprint,
      timestamp: Date.now()
    }));
    setInviteToken(token);
    toast.success('Invite token generated');
  };

  const handleAcceptInvite = (token) => {
    try {
      const decoded = JSON.parse(atob(token));
      if (!decoded.publicKey || !decoded.fingerprint) {
        throw new Error('Invalid token format');
      }
      const existingContact = contacts.find(c => c.fingerprint === decoded.fingerprint);
      if (existingContact) {
        toast.error('Contact already exists');
        return;
      }
      const newContact = {
        id: `contact-${Date.now()}`,
        name: `Contact ${decoded.fingerprint.slice(0, 4)}`,
        fingerprint: decoded.fingerprint,
        publicKey: decoded.publicKey,
        addedAt: new Date().toISOString()
      };
      const updatedContacts = [...contacts, newContact];
      setContacts(updatedContacts);
      localStorage.setItem('openclaw-contacts', JSON.stringify(updatedContacts));
      setShowInviteModal(false);
      toast.success('Contact added successfully', {
        description: `Fingerprint: ${decoded.fingerprint}`,
      });
    } catch (error) {
      toast.error('Invalid invite token', { description: error.message });
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !activeChat) return;

    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const msg = {
      id: `msg-${Date.now()}`,
      text: newMessage,
      time,
      sender: 'me',
      encrypted: activeChat.startsWith('contact-')
    };

    const chatId = activeChat;
    const updatedMessages = {
      ...messages,
      [chatId]: [...(messages[chatId] || []), msg]
    };
    setMessages(updatedMessages);
    localStorage.setItem('openclaw-messages', JSON.stringify(updatedMessages));
    setNewMessage('');

    // Simulate bot response for bot channels
    if (activeChat.startsWith('bot-')) {
      setTimeout(() => {
        const botResponses = {
          'bot-local-gateway': `Command received: "${newMessage}". Processing locally...`,
          'bot-leon': `[Leon AI] Analyzing: "${newMessage}"... I'll help you with that.`,
          'bot-zara': `[Zara] Automation triggered for: "${newMessage}". Task queued.`,
        };
        const responseMsg = {
          id: `msg-${Date.now()}`,
          text: botResponses[chatId] || 'Response received.',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          sender: 'bot',
          encrypted: false
        };
        setMessages(prev => {
          const updated = { ...prev, [chatId]: [...(prev[chatId] || []), responseMsg] };
          localStorage.setItem('openclaw-messages', JSON.stringify(updated));
          return updated;
        });
      }, 1000);
    }
  };

  const handleDeleteContact = (contactId) => {
    const updatedContacts = contacts.filter(c => c.id !== contactId);
    setContacts(updatedContacts);
    localStorage.setItem('openclaw-contacts', JSON.stringify(updatedContacts));
    if (activeChat === contactId) {
      setActiveChat(null);
    }
    toast.success('Contact removed');
  };

  if (!identity) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="pt-20 pb-8 px-4 sm:px-6 lg:px-8 min-h-screen"
      >
        <div className="max-w-7xl mx-auto h-[calc(100vh-8rem)]">
          <IdentitySetup onGenerate={handleGenerateIdentity} isGenerating={isGenerating} />
        </div>
      </motion.div>
    );
  }

  const currentChatMessages = messages[activeChat] || [];
  const activeChatInfo = activeChat?.startsWith('bot-')
    ? BOT_CHANNELS.find(b => `bot-${b.id}` === activeChat)
    : contacts.find(c => c.id === activeChat);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="pt-20 pb-8 px-4 sm:px-6 lg:px-8 min-h-screen"
    >
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <MessageSquare className="w-6 h-6 text-primary" />
              <span className="gradient-text">Conversations</span>
            </h1>
            <p className="text-sm text-muted-foreground">End-to-end encrypted messaging</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full glass-card">
              <Shield className="w-4 h-4 text-success" />
              <span className="text-xs text-muted-foreground">{identity.fingerprint}</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowInviteModal(true)}
              className="border-primary/40"
            >
              <Key className="w-4 h-4 mr-2" />
              Invite
            </Button>
          </div>
        </div>

        {/* Main Content - Split Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 h-[calc(100vh-14rem)]">
          {/* Sidebar */}
          <div className="lg:col-span-1">
            <GlassCard className="h-full overflow-hidden">
              <GlassCardContent className="p-4 h-full flex flex-col">
                {/* Bot Channels */}
                <div className="mb-4">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    Bot Channels
                  </h4>
                  <div className="space-y-1">
                    {BOT_CHANNELS.map((bot) => (
                      <button
                        key={bot.id}
                        onClick={() => setActiveChat(`bot-${bot.id}`)}
                        className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all ${
                          activeChat === `bot-${bot.id}`
                            ? 'bg-primary/20 border border-primary/40'
                            : 'hover:bg-secondary/30'
                        }`}
                      >
                        <span className="text-xl">{bot.icon}</span>
                        <div className="flex-1 text-left">
                          <p className={`text-sm font-medium ${bot.color}`}>{bot.name}</p>
                          <p className="text-xs text-muted-foreground">{bot.description}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Contacts */}
                <div className="flex-1 overflow-y-auto">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Contacts ({contacts.length})
                    </h4>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => setShowInviteModal(true)}
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="space-y-1">
                    {contacts.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-4">
                        No contacts yet. Use Glass Key to invite someone.
                      </p>
                    ) : (
                      contacts.map((contact) => (
                        <div
                          key={contact.id}
                          className={`flex items-center gap-3 p-3 rounded-lg transition-all cursor-pointer group ${
                            activeChat === contact.id
                              ? 'bg-primary/20 border border-primary/40'
                              : 'hover:bg-secondary/30'
                          }`}
                          onClick={() => setActiveChat(contact.id)}
                        >
                          <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
                            <User className="w-4 h-4 text-muted-foreground" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{contact.name}</p>
                            <p className="text-xs text-muted-foreground font-mono">{contact.fingerprint}</p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteContact(contact.id);
                            }}
                          >
                            <Trash2 className="w-3 h-3 text-destructive" />
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </GlassCardContent>
            </GlassCard>
          </div>

          {/* Chat Area */}
          <div className="lg:col-span-3">
            <GlassCard className="h-full overflow-hidden flex flex-col">
              {activeChat ? (
                <>
                  {/* Chat Header */}
                  <div className="p-4 border-b border-border/30 flex items-center gap-3">
                    {activeChatInfo && (
                      <>
                        {activeChat.startsWith('bot-') ? (
                          <>
                            <span className="text-2xl">{activeChatInfo.icon}</span>
                            <div>
                              <h3 className="font-semibold text-foreground">{activeChatInfo.name}</h3>
                              <p className="text-xs text-muted-foreground">{activeChatInfo.description}</p>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
                              <User className="w-5 h-5 text-muted-foreground" />
                            </div>
                            <div>
                              <h3 className="font-semibold text-foreground">{activeChatInfo.name}</h3>
                              <div className="flex items-center gap-1">
                                <Shield className="w-3 h-3 text-success" />
                                <span className="text-xs text-success">E2E Encrypted</span>
                                <span className="text-xs text-muted-foreground font-mono ml-1">
                                  {activeChatInfo.fingerprint}
                                </span>
                              </div>
                            </div>
                          </>
                        )}
                      </>
                    )}
                  </div>

                  {/* Messages */}
                  <div className="flex-1 overflow-y-auto p-4">
                    {currentChatMessages.length === 0 ? (
                      <div className="h-full flex items-center justify-center">
                        <p className="text-muted-foreground text-center">
                          No messages yet. Start the conversation!
                        </p>
                      </div>
                    ) : (
                      currentChatMessages.map((msg) => (
                        <MessageBubble
                          key={msg.id}
                          message={msg}
                          isSent={msg.sender === 'me'}
                        />
                      ))
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Input Area */}
                  <div className="p-4 border-t border-border/30">
                    <div className="flex gap-2">
                      <Input
                        placeholder="Type a message..."
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                        className="flex-1"
                      />
                      <Button
                        onClick={handleSendMessage}
                        disabled={!newMessage.trim()}
                        className="bg-primary/20 border border-primary/40 hover:bg-primary/30"
                      >
                        <Send className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center">
                    <div className="w-16 h-16 rounded-2xl glass-card mx-auto mb-4 flex items-center justify-center">
                      <Bot className="w-8 h-8 text-primary" />
                    </div>
                    <h3 className="text-lg font-semibold text-foreground mb-2">Select a conversation</h3>
                    <p className="text-sm text-muted-foreground">
                      Choose a bot channel or contact to start messaging
                    </p>
                  </div>
                </div>
              )}
            </GlassCard>
          </div>
        </div>
      </div>

      {/* Invite Modal */}
      <InviteModal
        isOpen={showInviteModal}
        onClose={() => {
          setShowInviteModal(false);
          setInviteToken('');
        }}
        identity={identity}
        inviteToken={inviteToken}
        onGenerateInvite={handleGenerateInvite}
        onAcceptInvite={handleAcceptInvite}
      />
    </motion.div>
  );
}
