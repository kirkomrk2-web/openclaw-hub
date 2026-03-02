# PhantomChat

End-to-end encrypted messaging platform with steganography, self-destructing messages, and decoy accounts.

## What is PhantomChat?

PhantomChat is a secure messaging platform where **the server cannot read your messages**. Everything is encrypted on your device before it leaves your browser. Even if someone gains access to the server, all they see is meaningless encrypted data.

## How the "Phantom Scheme" Works (Non-Technical)

Imagine you want to send a secret letter to a friend. Here's what PhantomChat does, explained in everyday terms:

### Step 1: Establishing a Secret Code (Key Exchange)

Before you can send a message, you and your friend need to agree on a secret code — but you can't just shout it across a room full of people. Instead, you each create a pair of "keys":

- A **public key** — like your mailing address. Anyone can see it.
- A **private key** — like the key to your mailbox. Only you have it.

When you want to talk to someone, you combine your private key with their public key, and they combine their private key with your public key. Magically (mathematics!), you both arrive at the **same secret code** — without ever directly sharing it. An eavesdropper who sees both public keys cannot compute this secret.

For extra protection, PhantomChat creates a **fresh pair of temporary keys** for each conversation session. This means even if your main key is somehow compromised in the future, past conversations remain safe. This property is called **Forward Secrecy**.

### Step 2: Double-Locking Your Message

Your message is encrypted not once, but **twice**, using two completely different methods:

1. **AES-256-GCM** — A very fast encryption method used by banks and governments. It's like putting your letter in a titanium safe.
2. **ChaCha20-Poly1305** — A different mathematical approach to encryption. It's like wrapping the titanium safe in a second safe made of a completely different material.

Why two? If someone discovers a flaw in one type of encryption (which has never happened for either of these, but just in case), the other still protects your message. Your message stays safe as long as **at least one** of the two methods remains unbroken.

### Step 3: Tamper Detection

Before encrypting, PhantomChat creates a **digital fingerprint** (hash) of your message. This fingerprint is packed inside the encrypted envelope. When your friend decrypts the message, PhantomChat recalculates the fingerprint and checks that it matches. If someone tampered with the encrypted data along the way, the fingerprints won't match, and PhantomChat will warn your friend.

## Features

### End-to-End Encrypted Chat
- 1:1 and group conversations
- Every message is an independent encrypted blob with a unique ID
- Append-only model prevents sync conflicts

### Self-Destructing Messages
Messages don't actually get deleted — instead, the **decryption key** expires. After the timer runs out (30 seconds, 5 minutes, 1 hour, or custom), the key is permanently deleted. The encrypted message blob remains in the database but is forever unreadable. Think of it as destroying the only key to a safe — the safe still exists, but it can never be opened.

### Burn-After-Read
The decryption key is deleted immediately after the message is read once. There is no second chance to read it.

### Steganography Mode
Hide encrypted messages inside PNG images. The message is embedded in the least significant bits of pixel data — invisible to the naked eye. Reed-Solomon error correction (8 parity bytes per 247 data bytes) ensures the hidden data survives minor image processing.

**Only PNG is supported** — JPEG and WebP use lossy compression that would destroy the hidden data.

### Decoy Password
You set up two passwords:
- **Real password** — opens your actual account
- **Decoy password** — opens a separate, innocent-looking account

If someone forces you to reveal your password, you give them the decoy password. They see a normal-looking account with decoy conversations. The server stores both accounts in completely separate database tables with no link between them, so even with full database access, the two accounts cannot be correlated.

### Anti-Exfiltration Measures
- Text selection is disabled on protected messages
- Clipboard API is blocked for chat content
- Screen blurs when you switch to another tab
- These add friction against casual data theft (they are not bulletproof against screenshots)

### Offline-First with LAN Sync
- Messages carry Lamport timestamps for correct ordering
- On reconnect, messages merge by timestamp — append only, no overwrites

## Architecture

```
phantomchat/
├── frontend/           React 18 + TypeScript + Tailwind CSS
│   └── src/
│       ├── crypto/     All cryptography code
│       │   ├── phantom-engine.ts    Core encrypt/decrypt
│       │   ├── key-manager.ts       Key lifecycle & IndexedDB
│       │   ├── steganography.ts     PNG LSB + Reed-Solomon
│       │   └── argon2-wrapper.ts    Password hashing & decoy system
│       ├── components/ React UI components
│       └── hooks/      React hooks for chat & security
├── backend/            Node.js + Fastify
│   └── src/
│       ├── routes/     API endpoints (auth, messages, keys)
│       ├── middleware/  Security headers, rate limiting
│       └── db/         PostgreSQL schema & connection
├── docker-compose.yml  Full stack orchestration
└── .env.example        Environment configuration template
```

## Tech Stack

| Layer      | Technology                                    |
|------------|-----------------------------------------------|
| Frontend   | React 18, TypeScript, Tailwind CSS            |
| Backend    | Node.js, Fastify                              |
| Database   | PostgreSQL with pgcrypto extension             |
| Crypto     | Web Crypto API (AES-GCM), libsodium.js (X25519, ChaCha20, Argon2id) |
| Bundler    | Vite with SRI hash generation                 |

## Cryptographic Primitives Used

| Purpose                | Algorithm              | Library       |
|------------------------|------------------------|---------------|
| Key Exchange           | X25519 ECDH            | libsodium     |
| Symmetric Layer 1      | AES-256-GCM            | Web Crypto API|
| Symmetric Layer 2      | XChaCha20-Poly1305     | libsodium     |
| Integrity Hash         | BLAKE2b-256            | libsodium     |
| Password Hashing       | Argon2id (64MB, 3 iter)| libsodium     |
| Key Derivation         | BLAKE2b-KDF            | libsodium     |
| Error Correction       | Reed-Solomon RS(255,247)| Custom (GF(2^8)) |

**No custom cryptographic algorithms are used.** Every primitive is a well-studied, audited standard.

## Security Headers

Every HTTP response includes:
- `Content-Security-Policy`: Restricts resource loading to same origin
- `Strict-Transport-Security`: Forces HTTPS for 2 years
- `X-Content-Type-Options: nosniff`
- `Permissions-Policy`: Disables camera, microphone, geolocation
- `X-Frame-Options: DENY`
- `Referrer-Policy: no-referrer`

## Quick Start

```bash
# Clone and start with Docker
docker compose up -d

# Or run manually:

# Terminal 1: Database
docker run -d --name phantomchat-db \
  -e POSTGRES_DB=phantomchat \
  -e POSTGRES_USER=phantom \
  -e POSTGRES_PASSWORD=phantom_secret \
  -p 5432:5432 postgres:16-alpine

# Terminal 2: Backend
cd backend
npm install
npm run dev

# Terminal 3: Frontend
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 in your browser.

## Security Model — What the Server Sees

| Data                 | Visible to Server? |
|----------------------|-------------------|
| Message plaintext    | No                |
| Private keys         | No                |
| Passwords            | No                |
| Encrypted blobs      | Yes (opaque)      |
| Public keys          | Yes               |
| Message UUIDs        | Yes               |
| TTL timestamps       | Yes               |
| IP addresses         | Not logged        |
| User agents          | Not logged        |

## License

MIT
