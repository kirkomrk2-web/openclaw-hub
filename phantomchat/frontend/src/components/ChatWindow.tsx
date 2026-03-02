/**
 * PhantomChat main chat window component.
 *
 * Renders the message list with anti-exfiltration protections,
 * self-destruct indicators, burn-after-read markers, and integrity badges.
 */

import { useState, useRef, useEffect, type FormEvent } from 'react';
import { useAntiExfiltration } from '../hooks/useAntiExfiltration';
import type { ChatMessage, ChatPeer } from '../hooks/usePhantomChat';
import type { SelfDestructParams } from '../crypto/phantom-engine';

/* ═══════════════════════════════════════════
   TYPE DEFINITIONS
   ═══════════════════════════════════════════ */

export interface ChatWindowProps {
  messages: ChatMessage[];
  currentPeer: ChatPeer | null;
  onSendMessage: (
    text: string,
    selfDestruct: SelfDestructParams
  ) => Promise<void>;
  onMarkAsRead: (messageId: string) => void;
  isEncrypting: boolean;
  isDecrypting: boolean;
}

/* ═══════════════════════════════════════════
   SELF-DESTRUCT OPTIONS
   ═══════════════════════════════════════════ */

const SELF_DESTRUCT_OPTIONS: Array<{ label: string; value: SelfDestructParams }> = [
  { label: 'Off', value: { ttlSeconds: null, burnAfterRead: false } },
  { label: '30s', value: { ttlSeconds: 30, burnAfterRead: false } },
  { label: '5m', value: { ttlSeconds: 300, burnAfterRead: false } },
  { label: '1h', value: { ttlSeconds: 3600, burnAfterRead: false } },
  { label: 'Burn', value: { ttlSeconds: null, burnAfterRead: true } },
];

/* ═══════════════════════════════════════════
   MESSAGE BUBBLE COMPONENT
   ═══════════════════════════════════════════ */

interface MessageBubbleProps {
  message: ChatMessage;
  onRead: () => void;
  protectedClass: string;
  protectRef: (el: HTMLElement | null) => void;
}

function MessageBubble({ message, onRead, protectedClass, protectRef }: MessageBubbleProps) {
  const bubbleRef = useRef<HTMLDivElement>(null);
  const hasTriggeredRead = useRef(false);

  // Intersection observer for burn-after-read: trigger once visible
  useEffect(() => {
    if (message.isRead || message.sender === 'self' || hasTriggeredRead.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasTriggeredRead.current) {
          hasTriggeredRead.current = true;
          onRead();
        }
      },
      { threshold: 0.5 }
    );

    if (bubbleRef.current) {
      observer.observe(bubbleRef.current);
    }

    return () => observer.disconnect();
  }, [message.isRead, message.sender, onRead]);

  const isSelf = message.sender === 'self';
  const isBurned = message.isBurned;

  return (
    <div
      ref={bubbleRef}
      className={`flex ${isSelf ? 'justify-end' : 'justify-start'} mb-3`}
    >
      <div
        ref={protectRef}
        className={`max-w-xs lg:max-w-md rounded-2xl px-4 py-2.5 ${
          isSelf
            ? 'bg-zinc-700 text-zinc-100'
            : 'bg-zinc-900 border border-zinc-800 text-zinc-200'
        } ${protectedClass}`}
      >
        {/* Message text */}
        {isBurned ? (
          <p className="text-zinc-500 italic text-sm">Message burned after reading</p>
        ) : (
          <p className="text-sm whitespace-pre-wrap break-words">{message.text}</p>
        )}

        {/* Metadata row */}
        <div className="flex items-center gap-2 mt-1.5">
          {/* Integrity badge */}
          {message.integrityVerified ? (
            <span className="text-emerald-500 text-xs" title="Integrity verified (BLAKE2b)">
              &#10003;
            </span>
          ) : (
            <span className="text-red-500 text-xs" title="Integrity check FAILED">
              &#10007;
            </span>
          )}

          {/* Self-destruct indicator */}
          {message.selfDestruct.ttlSeconds !== null && (
            <span className="text-amber-500 text-xs" title={`Self-destructs in ${message.selfDestruct.ttlSeconds}s`}>
              TTL:{message.selfDestruct.ttlSeconds}s
            </span>
          )}

          {/* Burn-after-read indicator */}
          {message.burnAfterRead && !isBurned && (
            <span className="text-red-400 text-xs" title="Burns after reading">
              burn
            </span>
          )}

          {/* Lamport timestamp */}
          <span className="text-zinc-600 text-xs ml-auto">
            L:{message.lamportTs}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   CHAT WINDOW COMPONENT
   ═══════════════════════════════════════════ */

export function ChatWindow({
  messages,
  currentPeer,
  onSendMessage,
  onMarkAsRead,
  isEncrypting,
  isDecrypting,
}: ChatWindowProps) {
  const [inputText, setInputText] = useState('');
  const [selfDestruct, setSelfDestruct] = useState<SelfDestructParams>(
    SELF_DESTRUCT_OPTIONS[0].value
  );
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { state: antiExState, protectedContentClass, protectElement } = useAntiExfiltration();

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const text = inputText.trim();
    if (!text || !currentPeer) return;

    setInputText('');
    await onSendMessage(text, selfDestruct);
  };

  return (
    <div className="flex flex-col h-full bg-zinc-950 relative">
      {/* Blur overlay — activated when window loses focus */}
      {antiExState.isBlurred && (
        <div className="absolute inset-0 z-50 bg-zinc-950/95 backdrop-blur-xl flex items-center justify-center">
          <p className="text-zinc-500 text-sm">Content hidden — return to this tab to view</p>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-900">
        <div>
          <h2 className="text-zinc-100 font-medium">
            {currentPeer?.displayName ?? 'Select a conversation'}
          </h2>
          {currentPeer && (
            <p className="text-zinc-600 text-xs font-mono truncate max-w-[200px]">
              {currentPeer.publicKey.slice(0, 16)}...
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {isEncrypting && (
            <span className="text-amber-500 text-xs animate-pulse">Encrypting...</span>
          )}
          {isDecrypting && (
            <span className="text-blue-500 text-xs animate-pulse">Decrypting...</span>
          )}
          <div className={`w-2 h-2 rounded-full ${currentPeer ? 'bg-emerald-500' : 'bg-zinc-700'}`} />
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-zinc-700 text-sm">
            {currentPeer
              ? 'No messages yet. Send the first encrypted message.'
              : 'Select a peer to start a conversation.'}
          </div>
        ) : (
          messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              onRead={() => onMarkAsRead(msg.id)}
              protectedClass={protectedContentClass}
              protectRef={protectElement}
            />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      {currentPeer && (
        <div className="border-t border-zinc-900 px-6 py-4">
          {/* Self-destruct selector */}
          <div className="flex items-center gap-2 mb-3">
            <span className="text-zinc-600 text-xs">Self-destruct:</span>
            {SELF_DESTRUCT_OPTIONS.map((opt) => (
              <button
                key={opt.label}
                type="button"
                onClick={() => setSelfDestruct(opt.value)}
                className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
                  JSON.stringify(selfDestruct) === JSON.stringify(opt.value)
                    ? 'bg-zinc-700 text-zinc-100'
                    : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Message input */}
          <form onSubmit={handleSubmit} className="flex gap-3">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2.5 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-zinc-700 focus:border-transparent text-sm"
              disabled={isEncrypting}
            />
            <button
              type="submit"
              disabled={isEncrypting || !inputText.trim()}
              className="bg-zinc-100 text-zinc-900 px-5 py-2.5 rounded-lg font-medium text-sm hover:bg-zinc-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Send
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
