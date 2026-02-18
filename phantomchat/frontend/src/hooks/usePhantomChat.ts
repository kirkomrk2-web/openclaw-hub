/**
 * React hook for PhantomChat messaging operations.
 * Manages encryption, decryption, message lifecycle, and chat state.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  initPhantomEngine,
  phantomEncrypt,
  phantomDecrypt,
  phantomGroupEncrypt,
  phantomGroupDecrypt,
  importPublicKey,
  type PhantomCiphertext,
  type PhantomPlaintext,
  type SelfDestructParams,
} from '../crypto/phantom-engine';
import { keyManager } from '../crypto/key-manager';

/* ═══════════════════════════════════════════
   TYPE DEFINITIONS
   ═══════════════════════════════════════════ */

export interface ChatMessage {
  id: string;
  text: string;
  sender: string;
  timestamp: number;
  lamportTs: number;
  integrityVerified: boolean;
  selfDestruct: SelfDestructParams;
  burnAfterRead: boolean;
  isRead: boolean;
  isBurned: boolean;
}

export interface ChatPeer {
  userId: string;
  publicKey: string;
  displayName: string;
  sessionId: string | null;
}

export interface ChatState {
  messages: ChatMessage[];
  peers: Map<string, ChatPeer>;
  isInitialized: boolean;
  isEncrypting: boolean;
  isDecrypting: boolean;
  error: string | null;
}

export interface UsePhantomChatReturn {
  state: ChatState;
  initialize: (encryptionKey: Uint8Array) => Promise<string>;
  sendMessage: (
    text: string,
    recipientId: string,
    selfDestruct?: SelfDestructParams
  ) => Promise<PhantomCiphertext>;
  sendGroupMessage: (
    text: string,
    recipientIds: string[]
  ) => Promise<{
    envelope: PhantomCiphertext;
    wrappedKeys: Array<{ recipientPubKey: string; wrappedKey: string; ephemeralPub: string }>;
  }>;
  receiveMessage: (envelope: PhantomCiphertext) => Promise<ChatMessage>;
  receiveGroupMessage: (
    envelope: PhantomCiphertext,
    wrappedKey: { wrappedKey: string; ephemeralPub: string }
  ) => Promise<ChatMessage>;
  addPeer: (peer: ChatPeer) => void;
  removePeer: (userId: string) => void;
  markAsRead: (messageId: string) => void;
  getPublicKey: () => string;
  destroy: () => void;
}

/* ═══════════════════════════════════════════
   HOOK IMPLEMENTATION
   ═══════════════════════════════════════════ */

export function usePhantomChat(): UsePhantomChatReturn {
  const [state, setState] = useState<ChatState>({
    messages: [],
    peers: new Map(),
    isInitialized: false,
    isEncrypting: false,
    isDecrypting: false,
    error: null,
  });

  const stateRef = useRef(state);
  stateRef.current = state;

  // Clean up on unmount
  useEffect(() => {
    return () => {
      keyManager.destroy();
    };
  }, []);

  const initialize = useCallback(async (encryptionKey: Uint8Array): Promise<string> => {
    try {
      await initPhantomEngine();
      const publicKey = await keyManager.initialize(encryptionKey);
      setState((prev) => ({ ...prev, isInitialized: true, error: null }));
      return publicKey;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Initialization failed';
      setState((prev) => ({ ...prev, error: message }));
      throw err;
    }
  }, []);

  const addPeer = useCallback((peer: ChatPeer) => {
    setState((prev) => {
      const peers = new Map(prev.peers);
      // Create an ephemeral session for this peer
      if (!peer.sessionId) {
        const session = keyManager.createSession(peer.publicKey);
        peer.sessionId = session.sessionId;
      }
      peers.set(peer.userId, peer);
      return { ...prev, peers };
    });
  }, []);

  const removePeer = useCallback((userId: string) => {
    setState((prev) => {
      const peers = new Map(prev.peers);
      const peer = peers.get(userId);
      if (peer?.sessionId) {
        keyManager.destroySession(peer.sessionId);
      }
      peers.delete(userId);
      return { ...prev, peers };
    });
  }, []);

  const sendMessage = useCallback(
    async (
      text: string,
      recipientId: string,
      selfDestruct: SelfDestructParams = { ttlSeconds: null, burnAfterRead: false }
    ): Promise<PhantomCiphertext> => {
      setState((prev) => ({ ...prev, isEncrypting: true, error: null }));

      try {
        const peer = stateRef.current.peers.get(recipientId);
        if (!peer) {
          throw new Error(`Unknown peer: ${recipientId}`);
        }

        const recipientPubKey = importPublicKey(peer.publicKey);
        const envelope = await phantomEncrypt(text, recipientPubKey, selfDestruct);

        // Add to local messages
        const message: ChatMessage = {
          id: envelope.messageId,
          text,
          sender: 'self',
          timestamp: Date.now(),
          lamportTs: envelope.lamportTs,
          integrityVerified: true,
          selfDestruct,
          burnAfterRead: selfDestruct.burnAfterRead,
          isRead: true,
          isBurned: false,
        };

        setState((prev) => ({
          ...prev,
          messages: [...prev.messages, message].sort((a, b) => a.lamportTs - b.lamportTs),
          isEncrypting: false,
        }));

        return envelope;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Encryption failed';
        setState((prev) => ({ ...prev, isEncrypting: false, error: errorMsg }));
        throw err;
      }
    },
    []
  );

  const sendGroupMessage = useCallback(
    async (text: string, recipientIds: string[]) => {
      setState((prev) => ({ ...prev, isEncrypting: true, error: null }));

      try {
        const pubKeys = recipientIds.map((id) => {
          const peer = stateRef.current.peers.get(id);
          if (!peer) throw new Error(`Unknown peer: ${id}`);
          return importPublicKey(peer.publicKey);
        });

        const result = await phantomGroupEncrypt(text, pubKeys);

        const message: ChatMessage = {
          id: result.envelope.messageId,
          text,
          sender: 'self',
          timestamp: Date.now(),
          lamportTs: result.envelope.lamportTs,
          integrityVerified: true,
          selfDestruct: { ttlSeconds: null, burnAfterRead: false },
          burnAfterRead: false,
          isRead: true,
          isBurned: false,
        };

        setState((prev) => ({
          ...prev,
          messages: [...prev.messages, message].sort((a, b) => a.lamportTs - b.lamportTs),
          isEncrypting: false,
        }));

        return result;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Group encryption failed';
        setState((prev) => ({ ...prev, isEncrypting: false, error: errorMsg }));
        throw err;
      }
    },
    []
  );

  const receiveMessage = useCallback(
    async (envelope: PhantomCiphertext): Promise<ChatMessage> => {
      setState((prev) => ({ ...prev, isDecrypting: true, error: null }));

      try {
        const secretKey = keyManager.getSecretKey();
        const plaintext: PhantomPlaintext = await phantomDecrypt(envelope, secretKey);

        const message: ChatMessage = {
          id: plaintext.messageId,
          text: plaintext.text,
          sender: 'peer',
          timestamp: Date.now(),
          lamportTs: plaintext.lamportTs,
          integrityVerified: plaintext.integrityVerified,
          selfDestruct: {
            ttlSeconds: envelope.ttlSeconds,
            burnAfterRead: envelope.burnAfterRead,
          },
          burnAfterRead: envelope.burnAfterRead,
          isRead: false,
          isBurned: false,
        };

        setState((prev) => ({
          ...prev,
          messages: [...prev.messages, message].sort((a, b) => a.lamportTs - b.lamportTs),
          isDecrypting: false,
        }));

        return message;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Decryption failed';
        setState((prev) => ({ ...prev, isDecrypting: false, error: errorMsg }));
        throw err;
      }
    },
    []
  );

  const receiveGroupMessage = useCallback(
    async (
      envelope: PhantomCiphertext,
      wrappedKey: { wrappedKey: string; ephemeralPub: string }
    ): Promise<ChatMessage> => {
      setState((prev) => ({ ...prev, isDecrypting: true, error: null }));

      try {
        const secretKey = keyManager.getSecretKey();
        const plaintext = await phantomGroupDecrypt(envelope, wrappedKey, secretKey);

        const message: ChatMessage = {
          id: plaintext.messageId,
          text: plaintext.text,
          sender: 'peer',
          timestamp: Date.now(),
          lamportTs: plaintext.lamportTs,
          integrityVerified: plaintext.integrityVerified,
          selfDestruct: { ttlSeconds: null, burnAfterRead: false },
          burnAfterRead: false,
          isRead: false,
          isBurned: false,
        };

        setState((prev) => ({
          ...prev,
          messages: [...prev.messages, message].sort((a, b) => a.lamportTs - b.lamportTs),
          isDecrypting: false,
        }));

        return message;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Group decryption failed';
        setState((prev) => ({ ...prev, isDecrypting: false, error: errorMsg }));
        throw err;
      }
    },
    []
  );

  const markAsRead = useCallback((messageId: string) => {
    setState((prev) => ({
      ...prev,
      messages: prev.messages.map((m) => {
        if (m.id === messageId && !m.isRead) {
          const updated = { ...m, isRead: true };
          // Handle burn-after-read: mark as burned once read
          if (m.burnAfterRead) {
            updated.isBurned = true;
            updated.text = '[Message burned after reading]';
          }
          return updated;
        }
        return m;
      }),
    }));
  }, []);

  const getPublicKey = useCallback((): string => {
    return keyManager.getPublicKey();
  }, []);

  const destroy = useCallback(() => {
    keyManager.destroy();
    setState({
      messages: [],
      peers: new Map(),
      isInitialized: false,
      isEncrypting: false,
      isDecrypting: false,
      error: null,
    });
  }, []);

  return {
    state,
    initialize,
    sendMessage,
    sendGroupMessage,
    receiveMessage,
    receiveGroupMessage,
    addPeer,
    removePeer,
    markAsRead,
    getPublicKey,
    destroy,
  };
}
