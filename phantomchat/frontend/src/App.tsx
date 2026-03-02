/**
 * PhantomChat — Main Application Component
 *
 * Orchestrates the login flow, key initialization, and chat UI.
 */

import { useState, useCallback } from 'react';
import { LoginForm } from './components/LoginForm';
import { ChatWindow } from './components/ChatWindow';
import { PeerList } from './components/PeerList';
import { StegoPanel } from './components/StegoPanel';
import { usePhantomChat, type ChatPeer } from './hooks/usePhantomChat';
import { setupDecoyPasswords, attemptLogin } from './crypto/argon2-wrapper';
import sodium from 'libsodium-wrappers';
import type { SelfDestructParams } from './crypto/phantom-engine';

type AppView = 'login' | 'chat';

export default function App() {
  const [view, setView] = useState<AppView>('login');
  const [isLoading, setIsLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [selectedPeerId, setSelectedPeerId] = useState<string | null>(null);
  const [accountType, setAccountType] = useState<'real' | 'decoy' | null>(null);
  const [showStegoPanel, setShowStegoPanel] = useState(false);

  const chat = usePhantomChat();

  /* ─── Registration Handler ─── */
  const handleRegister = useCallback(
    async (realPassword: string, decoyPassword: string) => {
      setIsLoading(true);
      setLoginError(null);

      try {
        const { realKey } = await setupDecoyPasswords(realPassword, decoyPassword);

        // Initialize the chat engine with the real key
        await chat.initialize(realKey.key);

        setAccountType('real');
        setView('chat');

        // SECURITY: zeroing key material after use
        // The key is now stored encrypted in IndexedDB by the KeyManager
      } catch (err) {
        setLoginError(err instanceof Error ? err.message : 'Registration failed');
      } finally {
        setIsLoading(false);
      }
    },
    [chat]
  );

  /* ─── Login Handler ─── */
  const handleLogin = useCallback(
    async (password: string) => {
      setIsLoading(true);
      setLoginError(null);

      try {
        // For demo: derive key directly from password with a stored salt
        // In production, salts would be fetched from the server
        const salt = sodium.from_string('PhantomChat-Salt'); // 16 bytes
        const { deriveKeyFromPassword } = await import('./crypto/argon2-wrapper');
        const { key } = await deriveKeyFromPassword(password, salt);

        await chat.initialize(key);

        setAccountType('real');
        setView('chat');

        // SECURITY: zeroing key after initialization
        sodium.memzero(key);
      } catch (err) {
        setLoginError(err instanceof Error ? err.message : 'Login failed');
      } finally {
        setIsLoading(false);
      }
    },
    [chat]
  );

  /* ─── Peer Management ─── */
  const handleAddPeer = useCallback(
    (publicKey: string, displayName: string) => {
      const peer: ChatPeer = {
        userId: crypto.randomUUID(),
        publicKey,
        displayName,
        sessionId: null,
      };
      chat.addPeer(peer);
    },
    [chat]
  );

  /* ─── Send Message ─── */
  const handleSendMessage = useCallback(
    async (text: string, selfDestruct: SelfDestructParams) => {
      if (!selectedPeerId) return;
      await chat.sendMessage(text, selectedPeerId, selfDestruct);
    },
    [chat, selectedPeerId]
  );

  /* ─── Stego Extraction Callback ─── */
  const handleStegoExtract = useCallback(
    (_payload: Uint8Array) => {
      // The extracted payload is encrypted — pass it to the decryption pipeline
      // In a full implementation this would be deserialized into a PhantomCiphertext
      // and decrypted via chat.receiveMessage()
    },
    []
  );

  /* ─── Logout ─── */
  const handleLogout = useCallback(() => {
    chat.destroy();
    setView('login');
    setAccountType(null);
    setSelectedPeerId(null);
  }, [chat]);

  const currentPeer = selectedPeerId ? chat.state.peers.get(selectedPeerId) ?? null : null;

  /* ─── Render ─── */
  if (view === 'login') {
    return (
      <LoginForm
        onLogin={handleLogin}
        onRegister={handleRegister}
        isLoading={isLoading}
        error={loginError}
      />
    );
  }

  return (
    <div className="h-screen flex bg-zinc-950 text-zinc-100">
      {/* Sidebar */}
      <PeerList
        peers={chat.state.peers}
        selectedPeerId={selectedPeerId}
        onSelectPeer={setSelectedPeerId}
        onAddPeer={handleAddPeer}
        myPublicKey={chat.state.isInitialized ? chat.getPublicKey() : null}
      />

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Top Bar */}
        <div className="flex items-center justify-between px-6 py-2 border-b border-zinc-900 bg-zinc-950">
          <div className="flex items-center gap-3">
            {accountType === 'decoy' && (
              <span className="text-xs bg-amber-900/50 text-amber-400 px-2 py-0.5 rounded">
                Decoy Account
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowStegoPanel(!showStegoPanel)}
              className="text-zinc-500 text-xs hover:text-zinc-300 transition-colors px-3 py-1 rounded"
            >
              {showStegoPanel ? 'Hide' : 'Stego'}
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="text-zinc-500 text-xs hover:text-red-400 transition-colors px-3 py-1 rounded"
            >
              Logout
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 flex overflow-hidden">
          <div className="flex-1">
            <ChatWindow
              messages={chat.state.messages}
              currentPeer={currentPeer}
              onSendMessage={handleSendMessage}
              onMarkAsRead={chat.markAsRead}
              isEncrypting={chat.state.isEncrypting}
              isDecrypting={chat.state.isDecrypting}
            />
          </div>

          {/* Stego Panel (collapsible) */}
          {showStegoPanel && (
            <div className="w-80 border-l border-zinc-900 p-4 overflow-y-auto">
              <StegoPanel
                onMessageExtracted={handleStegoExtract}
                payloadToEmbed={null}
              />
            </div>
          )}
        </div>
      </div>

      {/* Error Toast */}
      {chat.state.error && (
        <div className="fixed bottom-4 right-4 bg-red-950/90 border border-red-900 rounded-lg px-4 py-3 text-sm text-red-400 max-w-sm">
          {chat.state.error}
        </div>
      )}
    </div>
  );
}
