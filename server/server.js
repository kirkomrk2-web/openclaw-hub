/**
 * OpenClaw Hub API Server
 *
 * End-to-end encrypted conversations with ECDH P-256 key exchange
 * and AES-256-GCM message encryption.
 *
 * Data stored in ~/.file-dashboard/ (JSON files)
 */

const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3848;

// Data directory
const DATA_DIR = path.join(process.env.HOME || '/root', '.file-dashboard');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Helper functions for file storage
const readJsonFile = (filename) => {
  const filepath = path.join(DATA_DIR, filename);
  if (!fs.existsSync(filepath)) {
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(filepath, 'utf8'));
  } catch {
    return null;
  }
};

const writeJsonFile = (filename, data) => {
  const filepath = path.join(DATA_DIR, filename);
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2), 'utf8');
};

// ============================================
// Crypto Endpoints
// ============================================

/**
 * POST /api/crypto/keypair
 * Generate ECDH P-256 key pair
 */
app.post('/api/crypto/keypair', (req, res) => {
  try {
    const ecdh = crypto.createECDH('prime256v1');
    ecdh.generateKeys();

    const publicKey = ecdh.getPublicKey('base64');
    const privateKey = ecdh.getPrivateKey('base64');

    // Generate fingerprint from public key
    const hash = crypto.createHash('sha256').update(publicKey).digest('hex');
    const fingerprint = hash.substring(0, 8).toUpperCase();

    const identity = {
      publicKey,
      privateKey,
      fingerprint,
      createdAt: new Date().toISOString()
    };

    // Store identity
    writeJsonFile('identity.json', identity);

    res.json({
      success: true,
      publicKey,
      fingerprint,
      createdAt: identity.createdAt
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/crypto/identity
 * Get current identity (public key only)
 */
app.get('/api/crypto/identity', (req, res) => {
  try {
    const identity = readJsonFile('identity.json');
    if (!identity) {
      return res.status(404).json({ success: false, error: 'No identity found' });
    }
    res.json({
      success: true,
      publicKey: identity.publicKey,
      fingerprint: identity.fingerprint,
      createdAt: identity.createdAt
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// Invite Endpoints
// ============================================

/**
 * POST /api/invite/create
 * Create a new invite token
 */
app.post('/api/invite/create', (req, res) => {
  try {
    const identity = readJsonFile('identity.json');
    if (!identity) {
      return res.status(400).json({ success: false, error: 'Identity not found. Generate keypair first.' });
    }

    const invite = {
      id: uuidv4(),
      publicKey: identity.publicKey,
      fingerprint: identity.fingerprint,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours
    };

    // Store invite
    const invites = readJsonFile('invites.json') || [];
    invites.push(invite);
    writeJsonFile('invites.json', invites);

    // Generate token
    const token = Buffer.from(JSON.stringify(invite)).toString('base64');

    res.json({
      success: true,
      token,
      invite
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/invite/accept
 * Accept an invite token and add contact
 */
app.post('/api/invite/accept', (req, res) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ success: false, error: 'Token required' });
    }

    // Decode token
    let invite;
    try {
      invite = JSON.parse(Buffer.from(token, 'base64').toString('utf8'));
    } catch {
      return res.status(400).json({ success: false, error: 'Invalid token format' });
    }

    // Check expiration
    if (new Date(invite.expiresAt) < new Date()) {
      return res.status(400).json({ success: false, error: 'Invite expired' });
    }

    // Check if contact already exists
    const contacts = readJsonFile('contacts.json') || [];
    const existingContact = contacts.find(c => c.fingerprint === invite.fingerprint);
    if (existingContact) {
      return res.status(400).json({ success: false, error: 'Contact already exists' });
    }

    // Add contact
    const contact = {
      id: uuidv4(),
      name: `Contact ${invite.fingerprint.substring(0, 4)}`,
      publicKey: invite.publicKey,
      fingerprint: invite.fingerprint,
      addedAt: new Date().toISOString()
    };
    contacts.push(contact);
    writeJsonFile('contacts.json', contacts);

    res.json({
      success: true,
      contact
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// Contacts Endpoints
// ============================================

/**
 * GET /api/contacts
 * List all contacts
 */
app.get('/api/contacts', (req, res) => {
  try {
    const contacts = readJsonFile('contacts.json') || [];
    res.json({ success: true, contacts });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/contacts
 * Add a new contact manually
 */
app.post('/api/contacts', (req, res) => {
  try {
    const { name, publicKey, fingerprint } = req.body;
    if (!publicKey || !fingerprint) {
      return res.status(400).json({ success: false, error: 'publicKey and fingerprint required' });
    }

    const contacts = readJsonFile('contacts.json') || [];

    // Check if exists
    if (contacts.find(c => c.fingerprint === fingerprint)) {
      return res.status(400).json({ success: false, error: 'Contact already exists' });
    }

    const contact = {
      id: uuidv4(),
      name: name || `Contact ${fingerprint.substring(0, 4)}`,
      publicKey,
      fingerprint,
      addedAt: new Date().toISOString()
    };
    contacts.push(contact);
    writeJsonFile('contacts.json', contacts);

    res.json({ success: true, contact });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/contacts/:id
 * Remove a contact
 */
app.delete('/api/contacts/:id', (req, res) => {
  try {
    const { id } = req.params;
    let contacts = readJsonFile('contacts.json') || [];
    const originalLength = contacts.length;
    contacts = contacts.filter(c => c.id !== id);

    if (contacts.length === originalLength) {
      return res.status(404).json({ success: false, error: 'Contact not found' });
    }

    writeJsonFile('contacts.json', contacts);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// Messages Endpoints
// ============================================

/**
 * GET /api/messages/:conversationId
 * Get messages for a conversation
 */
app.get('/api/messages/:conversationId', (req, res) => {
  try {
    const { conversationId } = req.params;
    const filename = `messages_${conversationId}.json`;
    const messages = readJsonFile(filename) || [];
    res.json({ success: true, messages });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/messages/:conversationId
 * Send a message (stored encrypted)
 * Body: { iv, ciphertext, recipientFingerprint }
 */
app.post('/api/messages/:conversationId', (req, res) => {
  try {
    const { conversationId } = req.params;
    const { iv, ciphertext, recipientFingerprint, plaintext } = req.body;

    const message = {
      id: uuidv4(),
      conversationId,
      iv,
      ciphertext,
      recipientFingerprint,
      plaintext, // For bot channels (unencrypted)
      sentAt: new Date().toISOString()
    };

    const filename = `messages_${conversationId}.json`;
    const messages = readJsonFile(filename) || [];
    messages.push(message);
    writeJsonFile(filename, messages);

    res.json({ success: true, message });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// Conversations Endpoints
// ============================================

/**
 * GET /api/conversations
 * List all conversations
 */
app.get('/api/conversations', (req, res) => {
  try {
    const contacts = readJsonFile('contacts.json') || [];

    // Create conversation list from contacts + bot channels
    const conversations = [
      ...contacts.map(c => ({
        id: c.id,
        type: 'contact',
        name: c.name,
        fingerprint: c.fingerprint,
        lastActivity: c.addedAt
      })),
      // Bot channels
      { id: 'local-gateway', type: 'bot', name: 'Local Gateway', icon: 'gateway', lastActivity: null },
      { id: 'leon', type: 'bot', name: 'Leon', icon: 'robot', lastActivity: null },
      { id: 'zara', type: 'bot', name: 'Zara', icon: 'zap', lastActivity: null }
    ];

    res.json({ success: true, conversations });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// Health Check
// ============================================

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'OpenClaw Hub API',
    version: '1.0.0',
    dataDir: DATA_DIR,
    timestamp: new Date().toISOString()
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`OpenClaw Hub API Server running on port ${PORT}`);
  console.log(`Data directory: ${DATA_DIR}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
});
