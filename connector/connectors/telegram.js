/**
 * connector/connectors/telegram.js
 *
 * Telegram connector — uses the Telegram Bot API to verify the bot token
 * and send messages to a chat.
 */

import { BaseConnector } from "./base.js";

const TELEGRAM_API = "https://api.telegram.org";

export class TelegramConnector extends BaseConnector {
  /**
   * @param {{ botToken: string, chatId?: string|number, _fetch?: typeof fetch }} config
   *   botToken - Telegram bot token from @BotFather
   *   chatId   - Default chat/channel ID for send operations (optional)
   */
  constructor(config) {
    if (!config?.botToken) throw new TypeError("TelegramConnector requires config.botToken");
    super("telegram", "Telegram Bot", "messaging", {
      url: TELEGRAM_API,
      botToken: config.botToken,
      chatId: config.chatId ?? null,
      healthPath: `/bot${config.botToken}/getMe`,
    });
    this._fetch = config._fetch ?? fetch;
  }

  #apiUrl(method) {
    return `${TELEGRAM_API}/bot${this.config.botToken}/${method}`;
  }

  async connect() {
    try {
      const result = await this.ping();
      if (result.status === "offline") {
        this._setState("error", result.error ?? "Unreachable");
      } else {
        this._setState("connected");
      }
    } catch (err) {
      this._setState("error", err.message);
      throw err;
    }
  }

  async ping() {
    const url = this.#apiUrl("getMe");
    const start = Date.now();
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8_000);
      const res = await this._fetch(url, { signal: controller.signal });
      clearTimeout(timer);
      const latency = Date.now() - start;
      // Telegram always returns 200 for valid tokens; 401 for invalid
      return {
        status: res.status < 500 ? (latency >= 3_000 ? "degraded" : "online") : "degraded",
        latency_ms: latency,
        status_code: res.status,
      };
    } catch (err) {
      const isTimeout = err instanceof Error && err.name === "AbortError";
      return {
        status: "offline",
        latency_ms: isTimeout ? 8_000 : Date.now() - start,
        status_code: null,
        error: isTimeout ? "Request timed out (8000ms)" : err.message,
      };
    }
  }

  /**
   * Send a text message to a chat.
   *
   * @param {string} text
   * @param {{ chatId?: string|number, parseMode?: 'HTML'|'MarkdownV2' }} [opts]
   * @returns {Promise<unknown>}
   */
  async sendMessage(text, { chatId, parseMode = "HTML" } = {}) {
    const targetChat = chatId ?? this.config.chatId;
    if (!targetChat) throw new Error("TelegramConnector: chatId is required for sendMessage()");
    const res = await this._fetch(this.#apiUrl("sendMessage"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: targetChat, text, parse_mode: parseMode }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Telegram API error ${res.status}: ${body}`);
    }
    return res.json();
  }
}
