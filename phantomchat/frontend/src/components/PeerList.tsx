/**
 * Peer list sidebar component.
 * Displays connected peers and allows selecting a conversation.
 */

import type { ChatPeer } from '../hooks/usePhantomChat';

export interface PeerListProps {
  peers: Map<string, ChatPeer>;
  selectedPeerId: string | null;
  onSelectPeer: (peerId: string) => void;
  onAddPeer: (publicKey: string, displayName: string) => void;
  myPublicKey: string | null;
}

export function PeerList({
  peers,
  selectedPeerId,
  onSelectPeer,
  onAddPeer,
  myPublicKey,
}: PeerListProps) {
  const handleAddPeer = () => {
    const publicKey = prompt('Enter peer public key (base64):');
    if (!publicKey) return;
    const displayName = prompt('Display name for this peer:') ?? 'Anonymous';
    onAddPeer(publicKey, displayName);
  };

  const handleCopyKey = async () => {
    if (myPublicKey) {
      await navigator.clipboard.writeText(myPublicKey);
    }
  };

  return (
    <div className="w-72 bg-zinc-950 border-r border-zinc-900 flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-4 border-b border-zinc-900">
        <h2 className="text-zinc-100 font-medium text-sm">Conversations</h2>
      </div>

      {/* My Key */}
      {myPublicKey && (
        <div className="px-4 py-3 border-b border-zinc-900">
          <p className="text-zinc-600 text-xs mb-1">Your Public Key</p>
          <button
            type="button"
            onClick={handleCopyKey}
            className="text-zinc-400 text-xs font-mono truncate block w-full text-left hover:text-zinc-200 transition-colors"
            title="Click to copy"
          >
            {myPublicKey.slice(0, 24)}...
          </button>
        </div>
      )}

      {/* Peer List */}
      <div className="flex-1 overflow-y-auto">
        {Array.from(peers.values()).map((peer) => (
          <button
            key={peer.userId}
            type="button"
            onClick={() => onSelectPeer(peer.userId)}
            className={`w-full px-4 py-3 text-left transition-colors ${
              selectedPeerId === peer.userId
                ? 'bg-zinc-900 border-l-2 border-zinc-400'
                : 'hover:bg-zinc-900/50 border-l-2 border-transparent'
            }`}
          >
            <p className="text-zinc-200 text-sm font-medium truncate">
              {peer.displayName}
            </p>
            <p className="text-zinc-600 text-xs font-mono truncate">
              {peer.publicKey.slice(0, 16)}...
            </p>
          </button>
        ))}

        {peers.size === 0 && (
          <div className="px-4 py-8 text-center text-zinc-700 text-xs">
            No peers yet. Add one to start chatting.
          </div>
        )}
      </div>

      {/* Add Peer Button */}
      <div className="px-4 py-4 border-t border-zinc-900">
        <button
          type="button"
          onClick={handleAddPeer}
          className="w-full bg-zinc-900 text-zinc-300 py-2 rounded-lg text-sm hover:bg-zinc-800 transition-colors"
        >
          + Add Peer
        </button>
      </div>
    </div>
  );
}
