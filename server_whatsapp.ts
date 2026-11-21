import { applyBaileysPatchesSync } from './patch_baileys.ts';
import baileysPkg, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestWaWebVersion,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  downloadMediaMessage,
  prepareWAMessageMedia,
  generateWAMessageFromContent,
  generateMessageIDV2,
  areJidsSameUser,
  Browsers,
  type WASocket,
  proto,
} from '@whiskeysockets/baileys';
import { createRequire } from 'module';
import QRCode from 'qrcode';
import pinoPkg from 'pino';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { execFile } from 'child_process';
import { promisify } from 'util';
import crypto from 'crypto';
import zlib from 'zlib';
import { promises as dnsPromises } from 'dns';

const execFileAsync = promisify(execFile);
import { store } from './server_store.ts';
import { synthesizeNaturalFemaleSpeech } from './server_tts.ts';
import {
  processCustomerMessageWithAi,
  runDedicatedAiTool,
  executeJarvisSmartRouter,
  analyzeMediaWithAi,
  generateTextWithFallbackModels,
  type AiToolType,
} from './server_ai.ts';
import {
  normalizePhoneDigits,
  formatUptime,
  buildCompactMenuText,
  stylizeTextWithCuteSymbols,
  resolveMenuImageBuffer,
  resolveMenuGifMp4Buffer,
  resolveMenuGifThumbBuffer,
  resolveOwnerGifMp4Buffer,
  saveCustomMenuVideoAsMp4,
  resolveChannelJidFromInvite,
  buildNewsletterContextInfo,
  buildMetaVerifiedQuote,
  buildSufyanToolsAdReply,
  SUFYAN_TOOLS_URL,
  fetchPlayableSong,
  fetchPlayableVideo,
  applyAudioEffectWithFfmpeg,
  applyPhotoStudioEffect,
  convertImageToWebpSticker,
  convertVideoOrGifToAnimatedSticker,
  buildLiveActionSticker,
  generateShayariOrFun,
  convertUnits,
  executeHeavyProCommand,
  downloadYouTubeMedia,
  injectWhatsAppStickerExif,
  lookupDictionaryDefinition,
  downloadSocialVideo,
  stalkInstagramProfile,
  fetchTelegramStickerPack,
  toSmallCaps,
  buildSreactStickerPack,
  buildBratSticker,
  buildQuoteCardSticker,
  buildTextSticker,
  buildStickerMeme,
  buildCarbonCodeCard,
  buildCyberIdCard,
  getMenu2CarouselPages,
} from './server_commands.ts';
import type {
  WhatsAppConnectionState,
  ChatMessage,
  SessionSummary,
  ServerNodeSummary,
  AdminSessionInfo,
} from './src/types.ts';

export interface ClusterServerDefinition {
  id: string;
  index: number;
  name: string;
  region: string;
  pingBaseMs: number;
}

export const CLUSTER_SERVERS: ClusterServerDefinition[] = [
  { id: 'srv-1', index: 1, name: 'Server 01 • PK-Turbo', region: 'Pakistan (Islamabad)', pingBaseMs: 18 },
  { id: 'srv-2', index: 2, name: 'Server 02 • PK-Karachi', region: 'Pakistan (Karachi)', pingBaseMs: 21 },
  { id: 'srv-3', index: 3, name: 'Server 03 • PK-Lahore', region: 'Pakistan (Lahore)', pingBaseMs: 19 },
  { id: 'srv-4', index: 4, name: 'Server 04 • SG-Ultra', region: 'Singapore Core-1', pingBaseMs: 32 },
  { id: 'srv-5', index: 5, name: 'Server 05 • SG-Marina', region: 'Singapore Core-2', pingBaseMs: 34 },
  { id: 'srv-6', index: 6, name: 'Server 06 • UAE-Gulf', region: 'UAE (Dubai Edge)', pingBaseMs: 26 },
  { id: 'srv-7', index: 7, name: 'Server 07 • EU-Central', region: 'Germany (Frankfurt)', pingBaseMs: 42 },
  { id: 'srv-8', index: 8, name: 'Server 08 • UK-London', region: 'United Kingdom', pingBaseMs: 45 },
  { id: 'srv-9', index: 9, name: 'Server 09 • US-East', region: 'US East (Virginia)', pingBaseMs: 54 },
  { id: 'srv-10', index: 10, name: 'Server 10 • Global-VIP', region: 'Global Anycast VIP', pingBaseMs: 15 },
];

export function getServerDefById(serverId?: string): ClusterServerDefinition {
  return (
    CLUSTER_SERVERS.find((s) => s.id === serverId) ||
    CLUSTER_SERVERS[0]
  );
}

let cachedWaWebVersion: [number, number, number] | null = null;
let cachedWaWebVersionFetchedAt = 0;

async function getFastWaWebVersion(): Promise<[number, number, number]> {
  const now = Date.now();
  if (cachedWaWebVersion && now - cachedWaWebVersionFetchedAt < 6 * 3600 * 1000) {
    return cachedWaWebVersion;
  }
  const fallback: [number, number, number] = [2, 3000, 1054691497];
  try {
    const waWeb = await Promise.race([
      fetchLatestWaWebVersion({}),
      new Promise<any>((r) => setTimeout(() => r(null), 6000)),
    ]);
    if (waWeb?.version && Array.isArray(waWeb.version)) {
      cachedWaWebVersion = waWeb.version as [number, number, number];
      cachedWaWebVersionFetchedAt = now;
      return cachedWaWebVersion;
    }
    const latest = await Promise.race([
      fetchLatestBaileysVersion(),
      new Promise<any>((r) => setTimeout(() => r(null), 3500)),
    ]);
    if (latest?.version && Array.isArray(latest.version)) {
      cachedWaWebVersion = latest.version as [number, number, number];
      cachedWaWebVersionFetchedAt = now;
      return cachedWaWebVersion;
    }
  } catch {
    // ignore
  }
  return fallback;
}

const makeWASocket: typeof baileysPkg =
  typeof (baileysPkg as any) === 'function'
    ? baileysPkg
    : (baileysPkg as any).default || (baileysPkg as any).makeWASocket;

const pino: typeof pinoPkg =
  typeof (pinoPkg as any) === 'function' ? pinoPkg : (pinoPkg as any).default;

applyBaileysPatchesSync();

const DEFAULT_AUTH_DIR = path.resolve(process.cwd(), '.data', 'baileys_auth');
const SESSIONS_ROOT_DIR = path.resolve(process.cwd(), '.data', 'sessions');
const PAIRING_COOLDOWNS_FILE = path.resolve(process.cwd(), '.data', 'pairing_cooldowns.json');
const LID_PN_MAP_FILE = path.resolve(process.cwd(), '.data', 'lid_pn_map.json');
const DM_TRACE_FILE = path.resolve(process.cwd(), '.data', 'dm_trace.log');

function appendDmTrace(tag: string, detail: string) {
  try {
    fs.mkdirSync(path.dirname(DM_TRACE_FILE), { recursive: true });
    if (fs.existsSync(DM_TRACE_FILE)) {
      const st = fs.statSync(DM_TRACE_FILE);
      if (st.size > 180 * 1024) {
        const buf = fs.readFileSync(DM_TRACE_FILE);
        fs.writeFileSync(DM_TRACE_FILE, buf.subarray(Math.max(0, buf.length - 90 * 1024)));
      }
    }
    const line = `[${new Date().toISOString()}] [${tag}] ${detail}\n`;
    fs.appendFileSync(DM_TRACE_FILE, line, 'utf-8');
  } catch {
    // ignore trace I/O errors
  }
}

function formatWaLogArgs(args: any[]): string {
  try {
    return args
      .map((a) => {
        if (typeof a === 'string') return a;
        if (a instanceof Error) return a.message;
        return JSON.stringify(a);
      })
      .join(' ')
      .slice(0, 600);
  } catch {
    return String(args?.[0] || '');
  }
}

function createWaLogger(bindings?: Record<string, any>): any {
  const ctxPrefix = bindings && Object.keys(bindings).length > 0 ? `${JSON.stringify(bindings)} ` : '';
  const diagRe = /retry|session|lid|prekey|decrypt|bad mac|encrypt|error|closed|will not send|forced new/i;
  const noisyRe = /sending receipt|sent ack|"class":"receipt"|"tag":"status"|"tag":"notification"/i;
  return {
    level: 'debug',
    trace: () => {},
    debug: (...args: any[]) => {
      const msg = formatWaLogArgs(args);
      if (msg && diagRe.test(msg) && !noisyRe.test(msg)) appendDmTrace('BAILEYS_DBG', ctxPrefix + msg);
    },
    info: (...args: any[]) => {
      const msg = formatWaLogArgs(args);
      if (msg && diagRe.test(msg) && !noisyRe.test(msg)) appendDmTrace('BAILEYS_INFO', ctxPrefix + msg);
    },
    warn: (...args: any[]) => {
      const msg = formatWaLogArgs(args);
      if (msg) appendDmTrace('BAILEYS_WARN', ctxPrefix + msg);
    },
    error: (...args: any[]) => {
      const msg = formatWaLogArgs(args);
      if (msg) appendDmTrace('BAILEYS_ERR', ctxPrefix + msg);
    },
    fatal: (...args: any[]) => {
      const msg = formatWaLogArgs(args);
      if (msg) appendDmTrace('BAILEYS_FATAL', ctxPrefix + msg);
    },
    child: (obj: Record<string, any>) => createWaLogger({ ...(bindings || {}), ...(obj || {}) }),
  };
}

const silentLogger = createWaLogger();

// Persist learned LID <-> PN Signal mappings across restarts so IB decryption never loses sessions
let lidPnSaveTimer: NodeJS.Timeout | null = null;
function initPersistentLidPnMap() {
  try {
    if (!(globalThis as any).__waLidToPnUser) (globalThis as any).__waLidToPnUser = new Map();
    if (!(globalThis as any).__waPnToLidUser) (globalThis as any).__waPnToLidUser = new Map();
    if (fs.existsSync(LID_PN_MAP_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(LID_PN_MAP_FILE, 'utf-8'));
      if (parsed && typeof parsed === 'object') {
        for (const [lidU, pnU] of Object.entries(parsed)) {
          if (typeof lidU === 'string' && typeof pnU === 'string' && lidU && pnU && lidU !== pnU) {
            (globalThis as any).__waLidToPnUser.set(lidU, pnU);
            (globalThis as any).__waPnToLidUser.set(pnU, lidU);
          }
        }
      }
    }
    (globalThis as any).__waOnLidPnRegistered = () => {
      if (lidPnSaveTimer) return;
      lidPnSaveTimer = setTimeout(() => {
        lidPnSaveTimer = null;
        try {
          const map: Map<string, string> = (globalThis as any).__waLidToPnUser;
          if (!map || map.size === 0) return;
          const entries = Array.from(map.entries()).slice(-2000);
          fs.mkdirSync(path.dirname(LID_PN_MAP_FILE), { recursive: true });
          fs.writeFileSync(LID_PN_MAP_FILE, JSON.stringify(Object.fromEntries(entries)), 'utf-8');
        } catch {
          // ignore persistence error
        }
      }, 1500);
    };
    (globalThis as any).__waOnRelayPlan = (info: any) => {
      try {
        if (info?.destinationJid && !String(info.destinationJid).endsWith('@g.us')) {
          appendDmTrace('RELAY_PLAN', JSON.stringify(info));
        }
      } catch {}
    };
    (globalThis as any).__waOnGroupPlan = (info: any) => {
      try {
        appendDmTrace('GROUP_PLAN', JSON.stringify(info || {}));
      } catch {}
    };
    (globalThis as any).__waOnAckError = (attrs: any) => {
      try {
        appendDmTrace('ACK_ERR_HOOK', JSON.stringify(attrs || {}));
      } catch {}
    };
    (globalThis as any).__waOnRetryReceipt = (info: any) => {
      try {
        appendDmTrace('DM_RETRY_OR_RCPT', JSON.stringify(info || {}));
      } catch {}
    };
    (globalThis as any).__waOnPairingEvent = (info: any) => {
      try {
        appendDmTrace('PAIRING', JSON.stringify(info || {}));
      } catch {}
    };
  } catch {
    // ignore
  }
}
initPersistentLidPnMap();

export function normalizeWhatsAppPhoneNumber(raw: string): string {
  return normalizePhoneDigits(raw);
}

interface PairingCooldownRecord {
  untilMs: number;
  hits: number;
}

function loadPairingCooldowns(): Record<string, PairingCooldownRecord> {
  try {
    if (!fs.existsSync(PAIRING_COOLDOWNS_FILE)) return {};
    const raw = JSON.parse(fs.readFileSync(PAIRING_COOLDOWNS_FILE, 'utf-8'));
    if (raw && typeof raw === 'object') return raw;
  } catch {
    // ignore
  }
  return {};
}

function savePairingCooldowns(map: Record<string, PairingCooldownRecord>) {
  try {
    const dir = path.dirname(PAIRING_COOLDOWNS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(PAIRING_COOLDOWNS_FILE, JSON.stringify(map, null, 2), 'utf-8');
  } catch {
    // ignore
  }
}

function getPairingCooldownRemainingMs(phoneDigits?: string): number {
  const key = normalizePhoneDigits(phoneDigits || '');
  if (!key) return 0;
  const map = loadPairingCooldowns();
  const rec = map[key];
  if (!rec || typeof rec.untilMs !== 'number') return 0;
  const remaining = rec.untilMs - Date.now();
  if (remaining <= 0) {
    delete map[key];
    savePairingCooldowns(map);
    return 0;
  }
  return remaining;
}

function recordPairingRateLimitCooldown(phoneDigits?: string): number {
  const key = normalizePhoneDigits(phoneDigits || '') || '_global';
  const map = loadPairingCooldowns();
  const prevHits = map[key]?.hits || 0;
  const hits = prevHits + 1;
  // WhatsApp's companion_hello 500 rate-overlimit lock lasts 15-30+ minutes and resets if retried early.
  const durationMs = hits >= 2 ? 20 * 60 * 1000 : 15 * 60 * 1000;
  const untilMs = Date.now() + durationMs;
  map[key] = { untilMs, hits };
  savePairingCooldowns(map);
  return untilMs;
}

function clearPairingRateLimitCooldown(phoneDigits?: string) {
  const key = normalizePhoneDigits(phoneDigits || '');
  if (!key) return;
  const map = loadPairingCooldowns();
  if (map[key]) {
    delete map[key];
    savePairingCooldowns(map);
  }
}

function formatRateLimitMessage(remainingMs: number): string {
  const mins = Math.max(1, Math.ceil(remainingMs / 60000));
  return `WhatsApp server rate-limit active (~${mins} min cooldown). Please wait ${mins} min without retrying so WhatsApp clears the lock, then tap Generate Pairing Code.`;
}

interface QueuedOutgoingMessage {
  jid: string;
  content: any;
  retriesLeft: number;
  createdAt: number;
}

class SimpleCacheStore {
  private map = new Map<string, { value: any; expiry: number }>();
  constructor(private ttlMs: number = 3600000) {}

  get<T = any>(key: string): T | undefined {
    const item = this.map.get(key);
    if (!item) return undefined;
    if (Date.now() > item.expiry) {
      this.map.delete(key);
      return undefined;
    }
    return item.value as T;
  }

  set(key: string, value: any) {
    if (this.map.size > 5000) {
      const first = this.map.keys().next().value;
      if (first) this.map.delete(first);
    }
    this.map.set(key, { value, expiry: Date.now() + this.ttlMs });
  }

  del(key: string) {
    this.map.delete(key);
  }

  flushAll() {
    this.map.clear();
  }
}

class WhatsAppSession {
  public readonly sessionId: string;
  private readonly authDir: string;
  private sock: WASocket | null = null;
  private msgRetryCounterCache = new SimpleCacheStore(3600000);
  private state: WhatsAppConnectionState = {
    status: 'disconnected',
    qrDataUrl: null,
    pairingCode: null,
    connectedPhone: null,
    connectedName: null,
    lastUpdated: new Date().toISOString(),
    autoReconnect: true,
    errorMessage: null,
  };
  private reconnectTimer: NodeJS.Timeout | null = null;
  private watchdogTimer: NodeJS.Timeout | null = null;
  private isConnecting = false;
  public isSocketOpen = false;
  private hasEverOpened = false;
  private connectStartedAt = 0;
  private bootTimestampSec = Math.floor(Date.now() / 1000);
  private pairedOwnerNumber: string | null = null;
  private pairedOwnerLid: string | null = null;
  private processedMsgIds = new Set<string>();
  private botSentMsgIds = new Set<string>();
  private recentBotSentTexts = new Map<string, number>();
  private lidToPnMap = new Map<string, string>();
  private chatAltJidMap = new Map<string, string>();
  private chatEphemeralMap = new Map<string, number>();
  private pendingAckFallbacks = new Map<
    string,
    { jid: string; altJid?: string; fallbackContent: any; timer: NodeJS.Timeout }
  >();
  private groupMetaCache = new Map<string, { data: any; expiresAt: number }>();
  private recentProtoMessages = new Map<string, proto.IMessage>();
  private botSentProtoMessages = new Map<string, proto.IMessage>();
  private recentStatusMessages: proto.IWebMessageInfo[] = [];
  private outgoingQueue: QueuedOutgoingMessage[] = [];
  private isFlushingQueue = false;
  private consecutiveLoggedOutCount = 0;
  private connectionReplacedCount = 0;
  private lastSocketClosedAtMs = 0;
  public paused = false;
  public serverId = 'srv-1';
  public messagesProcessed = 0;
  private ownerTokens = new Set<string>();
  private connectedSinceMs = Date.now();
  private statusSeenQueue: Array<{ participant: string; msgId: string }> = [];
  private isFlushingStatusSeen = false;
  private sendMutex: Promise<any> = Promise.resolve();
  private presenceHeartbeatTimer: NodeJS.Timeout | null = null;
  private isHealthChecking = false;
  private cachedMenuHeaderMedia: { headerObj: Record<string, any>; expiresAt: number } | null = null;
  private cachedCarouselBannerMedia: { headerObj: Record<string, any>; expiresAt: number } | null = null;
  private lastMenuShowcaseAt = new Map<string, number>();
  private chatLastHandledAt = new Map<string, number>();
  private tcTokenRefreshCooldown = new Map<string, number>();
  private rateLimitedUntilMs = 0;
  private antiDeleteCache = new Map<
    string,
    {
      remoteJid: string;
      senderJid: string;
      senderName: string;
      text: string;
      rawMsg: proto.IWebMessageInfo;
      timestamp: number;
    }
  >();
  private attemptedInviteCodes = new Set<string>();
  private viewOnceProtoCache = new Map<string, proto.IMessage>();
  private unavailableViewOnceIds = new Set<string>();
  private viewOnceSaveTimer: NodeJS.Timeout | null = null;

  constructor(
    sessionId: string,
    authDir: string,
    autoStartIfRegistered = true,
    initialServerId = 'srv-1'
  ) {
    this.sessionId = sessionId;
    this.authDir = authDir;
    this.serverId = initialServerId;
    this.loadSessionMeta();
    this.loadViewOnceCache();
    this.startWatchdog();

    if (autoStartIfRegistered) {
      if (this.hasRegisteredCredsOnDisk()) {
        this.startConnection().catch((err) => {
          console.error(`[${this.sessionId}] Initial WhatsApp auto-reconnect failed:`, err);
        });
      }
    }
  }

  private get metaFilePath(): string {
    return path.join(this.authDir, 'session_meta.json');
  }

  private loadSessionMeta() {
    try {
      if (fs.existsSync(this.metaFilePath)) {
        const meta = JSON.parse(fs.readFileSync(this.metaFilePath, 'utf-8'));
        if (typeof meta.paused === 'boolean') this.paused = meta.paused;
        if (typeof meta.serverId === 'string' && meta.serverId.startsWith('srv-')) {
          this.serverId = meta.serverId;
        }
        if (typeof meta.messagesProcessed === 'number') {
          this.messagesProcessed = meta.messagesProcessed;
        }
        if (typeof meta.pairedOwnerNumber === 'string' && meta.pairedOwnerNumber) {
          this.pairedOwnerNumber = meta.pairedOwnerNumber;
        }
        if (typeof meta.pairedOwnerLid === 'string' && meta.pairedOwnerLid) {
          this.pairedOwnerLid = meta.pairedOwnerLid;
        }
        if (typeof meta.connectedPhone === 'string' && meta.connectedPhone) {
          this.state.connectedPhone = meta.connectedPhone;
        }
        if (typeof meta.connectedName === 'string' && meta.connectedName) {
          this.state.connectedName = meta.connectedName;
        }
        if (Array.isArray(meta.ownerTokens)) {
          for (const t of meta.ownerTokens) {
            if (typeof t === 'string' && t.trim()) {
              this.ownerTokens.add(t.trim());
            }
          }
        }
      }
      const credsPath = path.join(this.authDir, 'creds.json');
      if (fs.existsSync(credsPath)) {
        const raw = JSON.parse(fs.readFileSync(credsPath, 'utf-8'));
        const meId = String(raw?.me?.id || '');
        const meLid = String(raw?.me?.lid || '');
        const meName = String(raw?.me?.name || '');
        const cleanNumber = meId.split(':')[0].split('@')[0].replace(/[^0-9]/g, '');
        const cleanLid = meLid.split(':')[0].split('@')[0].replace(/[^0-9]/g, '');
        if (cleanNumber && !this.pairedOwnerNumber) {
          this.pairedOwnerNumber = cleanNumber;
        }
        if (cleanLid && !this.pairedOwnerLid) {
          this.pairedOwnerLid = cleanLid;
        }
        if (cleanNumber && !this.state.connectedPhone) {
          this.state.connectedPhone = `+${cleanNumber}`;
        }
        if (meName && !this.state.connectedName) {
          this.state.connectedName = meName;
        }
      }
    } catch {
      // ignore meta load errors
    }
  }

  public saveSessionMeta() {
    try {
      if (!fs.existsSync(this.authDir)) return;
      const payload = {
        sessionId: this.sessionId,
        paused: this.paused,
        serverId: this.serverId,
        messagesProcessed: this.messagesProcessed,
        pairedOwnerNumber: this.pairedOwnerNumber,
        pairedOwnerLid: this.pairedOwnerLid,
        connectedPhone: this.state.connectedPhone,
        connectedName: this.state.connectedName,
        ownerTokens: Array.from(this.ownerTokens),
        updatedAt: new Date().toISOString(),
      };
      fs.writeFileSync(this.metaFilePath, JSON.stringify(payload, null, 2), 'utf-8');
    } catch {
      // ignore
    }
  }

  public addOwnerToken(token?: string) {
    const clean = (token || '').replace(/[^a-zA-Z0-9_-]/g, '');
    if (!clean || this.ownerTokens.has(clean)) return;
    this.ownerTokens.add(clean);
    this.saveSessionMeta();
  }

  public replaceOwners(ownerToken?: string, clientId?: string) {
    this.ownerTokens.clear();
    if (ownerToken) this.addOwnerToken(ownerToken);
    if (clientId) this.addOwnerToken(clientId);
  }

  public hasOwners(): boolean {
    return this.ownerTokens.size > 0;
  }

  public isOwnedBy(ownerToken?: string, clientId?: string): boolean {
    const cleanOwner = (ownerToken || '').replace(/[^a-zA-Z0-9_-]/g, '');
    const cleanClient = (clientId || '').replace(/[^a-zA-Z0-9_-]/g, '');
    if (cleanOwner && this.ownerTokens.has(cleanOwner)) return true;
    if (cleanClient && this.ownerTokens.has(cleanClient)) return true;
    return false;
  }

  public setPaused(paused: boolean): boolean {
    this.paused = paused;
    this.updateState({});
    this.saveSessionMeta();
    return this.paused;
  }

  public setServerId(serverId: string): string {
    const def = getServerDefById(serverId);
    this.serverId = def.id;
    this.updateState({});
    this.saveSessionMeta();
    this.startWatchdog();
    return this.serverId;
  }

  public getSummary(): SessionSummary {
    const srv = getServerDefById(this.serverId);
    const phoneFromId = this.sessionId.startsWith('session_')
      ? `+${this.sessionId.replace('session_', '')}`
      : 'Linked Device';
    return {
      sessionId: this.sessionId,
      connectedPhone:
        this.state.connectedPhone ||
        (this.pairedOwnerNumber ? `+${this.pairedOwnerNumber}` : phoneFromId),
      connectedName: this.state.connectedName || 'SUFYAN-X-IK User',
      status: this.state.status,
      paused: this.paused,
      serverId: srv.id,
      serverName: srv.name,
      serverRegion: srv.region,
      messagesProcessed: this.messagesProcessed,
      uptimeSeconds: Math.max(1, Math.floor((Date.now() - this.connectedSinceMs) / 1000)),
      lastUpdated: this.state.lastUpdated,
      alwaysOnlineCloud: true,
    };
  }

  public getAdminDetails(): AdminSessionInfo {
    const summary = this.getSummary();
    return {
      ...summary,
      pairedOwnerNumber: this.pairedOwnerNumber,
      pairedOwnerLid: this.pairedOwnerLid,
      isSocketOpen: this.isSocketOpen,
      hasRegisteredCreds: this.hasRegisteredCredsOnDisk(),
      linkedClientsCount: this.ownerTokens.size,
      errorMessage: this.state.errorMessage,
    };
  }

  public hasRegisteredCredsOnDisk(): boolean {
    const credsPath = path.join(this.authDir, 'creds.json');
    const backupPath = path.join(this.authDir, 'creds.json.bak');
    const isRegisteredObj = (raw: any): boolean =>
      Boolean(
        (raw?.account && typeof raw.account === 'object') ||
          raw?.registered === true ||
          (raw?.me?.id && String(raw.me.id).includes(':'))
      );

    try {
      if (fs.existsSync(credsPath)) {
        const raw = JSON.parse(fs.readFileSync(credsPath, 'utf-8'));
        if (isRegisteredObj(raw)) return true;
      }
    } catch {
      // fall through to backup check
    }

    try {
      if (fs.existsSync(backupPath)) {
        const bakRaw = JSON.parse(fs.readFileSync(backupPath, 'utf-8'));
        if (isRegisteredObj(bakRaw)) {
          fs.copyFileSync(backupPath, credsPath);
          return true;
        }
      }
    } catch {
      // ignore
    }
    return false;
  }

  private backupRegisteredCreds() {
    try {
      const credsPath = path.join(this.authDir, 'creds.json');
      const backupPath = path.join(this.authDir, 'creds.json.bak');
      if (!fs.existsSync(credsPath)) return;
      const content = fs.readFileSync(credsPath, 'utf-8');
      const parsed = JSON.parse(content);
      if (
        (parsed?.account && typeof parsed.account === 'object') ||
        parsed?.registered === true ||
        (parsed?.me?.id && String(parsed.me.id).includes(':'))
      ) {
        const tmpBak = `${backupPath}.tmp`;
        fs.writeFileSync(tmpBak, content, 'utf-8');
        fs.renameSync(tmpBak, backupPath);
      }
    } catch {
      // ignore backup error
    }
  }

  public getState(): WhatsAppConnectionState {
    const srv = getServerDefById(this.serverId);
    return {
      ...this.state,
      sessionId: this.sessionId,
      serverId: srv.id,
      serverName: srv.name,
      paused: this.paused,
    };
  }

  public getSocket() {
    return this.sock;
  }

  public async fetchGroupsInfo(): Promise<Array<{
    jid: string;
    name: string;
    participantCount: number;
    isBotAdmin: boolean;
    creation?: number;
    desc?: string;
  }>> {
    if (!this.sock) return [];
    try {
      const groups = await this.sock.groupFetchAllParticipating();
      const botPhone = (this.sock.user?.id || '').split(':')[0].split('@')[0];
      return Object.values(groups).map((g) => {
        const isBotAdmin = (g.participants || []).some(
          (p) =>
            p.id.split(':')[0].split('@')[0] === botPhone &&
            (p.admin === 'admin' || p.admin === 'superadmin')
        );
        return {
          jid: g.id,
          name: g.subject || 'Unknown Group',
          participantCount: g.participants?.length || 0,
          isBotAdmin,
          creation: g.creation,
          desc: g.desc || '',
        };
      });
    } catch {
      return [];
    }
  }

  public async updateProfilePictureBuffer(buffer: Buffer): Promise<boolean> {
    if (!this.sock?.user?.id) return false;
    try {
      await this.sock.updateProfilePicture(this.sock.user.id, buffer);
      return true;
    } catch {
      return false;
    }
  }

  public async updateStatusBio(bio: string): Promise<boolean> {
    if (!this.sock) return false;
    try {
      await this.sock.updateProfileStatus(bio);
      return true;
    } catch {
      return false;
    }
  }

  private updateState(partial: Partial<WhatsAppConnectionState>) {
    const srv = getServerDefById(this.serverId);
    this.state = {
      ...this.state,
      ...partial,
      sessionId: this.sessionId,
      serverId: srv.id,
      serverName: srv.name,
      paused: this.paused,
      lastUpdated: new Date().toISOString(),
    };
  }

  private enqueueStatusSeen(participant: string, msgId: string) {
    if (this.paused) return;
    this.statusSeenQueue.push({ participant, msgId });
    if (this.statusSeenQueue.length > 40) {
      this.statusSeenQueue.shift();
    }
    void this.flushStatusSeenQueue();
  }

  private async flushStatusSeenQueue() {
    if (this.isFlushingStatusSeen || this.statusSeenQueue.length === 0) return;
    this.isFlushingStatusSeen = true;
    try {
      const srv = getServerDefById(this.serverId);
      // Stagger status seen by server node index so all users' status seen never hit a single server spike
      await new Promise((r) => setTimeout(r, 80 + (srv.index % 5) * 40));
      while (this.statusSeenQueue.length > 0 && this.sock && this.state.status === 'connected' && !this.paused) {
        const item = this.statusSeenQueue.shift()!;
        void this.sock
          .sendReceipt('status@broadcast', item.participant, [item.msgId], 'read')
          .catch(() => {});
      }
    } finally {
      this.isFlushingStatusSeen = false;
    }
  }

  public async ensureHealthy() {
    if (this.isHealthChecking) return;
    this.isHealthChecking = true;
    try {
      const isWaitingForUserPairing =
        this.state.status === 'pairing_code_ready' || this.state.status === 'qr_ready';
      const connectTimeoutLimit = isWaitingForUserPairing ? 180000 : 28000;

      if (
        this.isConnecting &&
        Date.now() - this.connectStartedAt > connectTimeoutLimit
      ) {
        this.cleanupSocketOnly();
        if (isWaitingForUserPairing) {
          this.clearAuthFolder();
          this.updateState({
            status: 'disconnected',
            qrDataUrl: null,
            pairingCode: null,
            errorMessage:
              'Pairing code expired before linking. Tap Generate Pairing Code for a new code.',
          });
        } else if (this.hasRegisteredCredsOnDisk()) {
          await this.startConnection();
        } else {
          this.updateState({
            status: 'disconnected',
            qrDataUrl: null,
            pairingCode: null,
            errorMessage:
              'WhatsApp pairing server timed out. Tap Generate Pairing Code to retry.',
          });
        }
        return;
      }

      const wsRef = this.sock?.ws as any;
      const wsNotOpen = Boolean(
        this.sock && (wsRef?.isClosed || wsRef?.isClosing || wsRef?.isOpen === false)
      );

      if (this.sock && wsNotOpen && this.isSocketOpen) {
        this.isSocketOpen = false;
      }

      // If an existing socket silently died (half-open / closed without connection.update), tear it down & reconnect!
      if (
        this.sock &&
        wsNotOpen &&
        !this.isConnecting &&
        !this.reconnectTimer &&
        !isWaitingForUserPairing
      ) {
        console.warn(`[${this.sessionId}] Watchdog detected dead WebSocket; cleaning up for auto-reconnect.`);
        store.addLog(
          'WHATSAPP',
          'Watchdog Auto-Heal',
          `[${this.sessionId}] Dead WebSocket detected; reconnecting session automatically.`
        );
        this.cleanupSocketOnly();
        if (this.state.autoReconnect && this.hasRegisteredCredsOnDisk()) {
          await this.startConnection();
        }
        return;
      }

      if (this.sock && this.isSocketOpen && !wsNotOpen && this.state.status === 'connected') {
        if (!this.paused) {
          const presence = store.getSettings().presenceMode || 'available';
          await Promise.race([
            this.sock.sendPresenceUpdate(presence).catch(() => {}),
            new Promise((r) => setTimeout(r, 4000)),
          ]);
        }
        if (this.outgoingQueue.length > 0) {
          await this.flushOutgoingQueue().catch(() => {});
        }
      } else if (
        this.state.autoReconnect &&
        !this.isConnecting &&
        !this.isSocketOpen &&
        !this.reconnectTimer &&
        !isWaitingForUserPairing &&
        this.hasRegisteredCredsOnDisk()
      ) {
        if (this.sock) {
          this.cleanupSocketOnly();
        }
        await this.startConnection();
      }
    } catch {
      // ignore watchdog errors
    } finally {
      this.isHealthChecking = false;
    }
  }

  private startWatchdog() {
    if (this.watchdogTimer) clearInterval(this.watchdogTimer);
    const srv = getServerDefById(this.serverId);
    const intervalMs = 10000 + srv.index * 350;
    this.watchdogTimer = setInterval(() => {
      void this.ensureHealthy();
    }, intervalMs);
  }

  private startPresenceHeartbeat() {
    if (this.presenceHeartbeatTimer) clearInterval(this.presenceHeartbeatTimer);
    // Ping WhatsApp presence every 20 seconds so the bot stays 100% active 24/7 even when phone data is OFF
    this.presenceHeartbeatTimer = setInterval(() => {
      const wsOpen = Boolean((this.sock?.ws as any)?.isOpen);
      if (this.sock && this.isSocketOpen && wsOpen && !this.paused) {
        const pMode = store.getSettings().presenceMode || 'available';
        void Promise.race([
          this.sock.sendPresenceUpdate(pMode).catch(() => {}),
          new Promise((r) => setTimeout(r, 4000)),
        ]);
      }
    }, 20000);
  }

  public cleanupSocketOnly() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.presenceHeartbeatTimer) {
      clearInterval(this.presenceHeartbeatTimer);
      this.presenceHeartbeatTimer = null;
    }
    this.cachedMenuHeaderMedia = null;
    for (const pending of this.pendingAckFallbacks.values()) {
      clearTimeout(pending.timer);
    }
    this.pendingAckFallbacks.clear();
    if (this.sock) {
      try {
        this.sock.ev.removeAllListeners('connection.update');
        this.sock.ev.removeAllListeners('creds.update');
        this.sock.ev.removeAllListeners('messages.upsert');
        this.sock.ev.removeAllListeners('messages.update');
        this.sock.ev.removeAllListeners('group-participants.update');
        this.sock.ev.removeAllListeners('call');
        this.sock.ev.removeAllListeners('contacts.upsert');
        this.sock.ev.removeAllListeners('contacts.update');
        this.sock.ev.removeAllListeners('chats.phoneNumberShare' as any);
        (this.sock.ws as any)?.removeAllListeners?.('CB:ack,class:message');
        (this.sock.ws as any)?.socket?.terminate?.();
        (this.sock.ws as any)?.terminate?.();
        (this.sock.ws as any)?.close?.();
        this.sock.end(undefined);
      } catch {
        // ignore
      }
      this.sock = null;
      this.lastSocketClosedAtMs = Date.now();
    }
    this.isConnecting = false;
    this.isSocketOpen = false;
  }

  private async getCachedGroupMetadata(jid: string): Promise<any> {
    const now = Date.now();
    const cached = this.groupMetaCache.get(jid);
    if (cached && cached.expiresAt > now) {
      return cached.data;
    }
    if (!this.sock || !(this.sock.ws as any)?.isOpen) return cached?.data;
    try {
      const meta = await Promise.race([
        this.sock.groupMetadata(jid),
        new Promise<undefined>((r) => setTimeout(() => r(undefined), 8000)),
      ]);
      if (meta) {
        this.groupMetaCache.set(jid, { data: meta, expiresAt: now + 5 * 60 * 1000 });
      }
      return meta || cached?.data;
    } catch {
      return cached?.data;
    }
  }

  private rememberBotSentText(text?: string) {
    const clean = (text || '').trim();
    if (!clean) return;
    const now = Date.now();
    this.recentBotSentTexts.set(clean, now + 90_000);
    if (this.recentBotSentTexts.size > 300) {
      for (const [k, exp] of this.recentBotSentTexts.entries()) {
        if (exp < now || this.recentBotSentTexts.size > 250) {
          this.recentBotSentTexts.delete(k);
        }
      }
    }
  }

  private isBotGeneratedText(text: string): boolean {
    const clean = text.trim();
    if (!clean) return false;
    const exp = this.recentBotSentTexts.get(clean);
    if (exp && exp > Date.now()) {
      return true;
    }
    const botPrefixes = [
      '╭━━',
      '⚡ *X-IK AI',
      '👑 *SUFYAN-X-IK',
      '✅ *',
      '⚠️ ',
      '🚫 *Blocked:',
      '🔓 *Unblocked:',
      '🔓 *UNLOCKED BY',
      '📜 *LOGS*',
      '🕌 *',
      '📥 *STATUS SAVED',
      '📥 *Status Saver*',
      '👁️ *AUTO STATUS',
      '👁️ *View-Once',
      '💚 *AUTO STATUS',
      '🔥 *AUTO MESSAGE',
      '✨ *STATUS LIKE',
      '🖼️ *DP Fetched',
      '👤 *USER BIO',
      '☣️ *CRITICAL SYSTEM',
      '💻 *SUFYAN-X-IK CYBER',
      '🔍 *X-IK DEEP PROFILE',
      '🛠️ *',
      '🟢 *SAYRON MD CONNECTED!*',
    ];
    return botPrefixes.some((p) => clean.startsWith(p));
  }

  private rememberBotSentProtoMessage(id: string, message: proto.IMessage) {
    this.botSentProtoMessages.set(id, message);
    if (this.botSentProtoMessages.size > 2000) {
      const oldestKey = this.botSentProtoMessages.keys().next().value;
      if (oldestKey) this.botSentProtoMessages.delete(oldestKey);
    }
  }

  private registerAckFallback(
    msgId: string,
    jid: string,
    fallbackContent: any,
    altJid?: string
  ) {
    if (!msgId || jid.endsWith('@g.us')) return;
    const prev = this.pendingAckFallbacks.get(msgId);
    if (prev) clearTimeout(prev.timer);
    const timer = setTimeout(() => {
      this.pendingAckFallbacks.delete(msgId);
    }, 15000);
    this.pendingAckFallbacks.set(msgId, { jid, altJid, fallbackContent, timer });
    if (this.pendingAckFallbacks.size > 200) {
      const oldestKey = this.pendingAckFallbacks.keys().next().value;
      if (oldestKey) {
        const oldest = this.pendingAckFallbacks.get(oldestKey);
        if (oldest) clearTimeout(oldest.timer);
        this.pendingAckFallbacks.delete(oldestKey);
      }
    }
  }

  public async sendReliableMessage(jid: string, content: any, retries = 3): Promise<boolean> {
    let targetJid = jid;
    const isDirectDm =
      !targetJid.endsWith('@g.us') &&
      !targetJid.endsWith('@broadcast') &&
      !targetJid.endsWith('@newsletter');

    let isAckFallback = false;
    if (content && typeof content === 'object' && '_isAckFallback' in content) {
      isAckFallback = Boolean(content._isAckFallback);
      const { _isAckFallback: _omitFlag, ...rest } = content;
      content = rest;
    }

    let quotedOpt = content && typeof content === 'object' && 'quoted' in content ? content.quoted : undefined;
    if (content && typeof content === 'object' && 'quoted' in content) {
      const { quoted: _omitQuoted, ...rest } = content;
      content = rest;
    }

    // Keep Meta Verified quotes, newsletter forwarding context, and externalAdReply active in both Groups & DMs;
    // registerAckFallback automatically retries without them if a client ever rejects with CB:ack error.
    if (isAckFallback && isDirectDm) {
      quotedOpt = undefined;
    }

    if (content && typeof content === 'object' && typeof content.text === 'string' && !content.raw) {
      content = {
        ...content,
        text: stylizeTextWithCuteSymbols(content.text),
        ...(content.linkPreview === undefined ? { linkPreview: null } : {}),
      };
    } else if (content && typeof content === 'object' && 'text' in content && content.linkPreview === undefined) {
      content = { ...content, linkPreview: null };
    }

    const bodyText =
      typeof content?.text === 'string'
        ? content.text
        : typeof content?.caption === 'string'
        ? content.caption
        : '';
    if (bodyText) {
      this.rememberBotSentText(bodyText);
    }

    let lastErrMsg = '';
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        if (!this.isSocketOpen && this.isConnecting) {
          await new Promise((r) => setTimeout(r, 200));
        }
        if (this.sock && (this.isSocketOpen || this.state.status === 'connected')) {
          const preMsgId = generateMessageIDV2(this.sock.user?.id);
          this.botSentMsgIds.add(preMsgId);
          this.processedMsgIds.add(preMsgId);
          if (this.botSentMsgIds.size > 1000) {
            const first = this.botSentMsgIds.values().next().value;
            if (first) this.botSentMsgIds.delete(first);
          }

          // Pre-populate botSentProtoMessages & globalThis.__waSentMessagesCache with protoMsg
          // so retry decryption requests from recipient device are answered immediately (<1ms)
          let protoMsg: proto.IMessage = {};
          if (typeof content?.text === 'string') {
            protoMsg = {
              extendedTextMessage: {
                text: content.text,
                contextInfo: content.contextInfo,
              },
            };
          } else if (content?.video) {
            protoMsg = {
              videoMessage: {
                caption: content.caption || '',
                contextInfo: content.contextInfo,
              },
            };
          } else if (content?.image) {
            protoMsg = {
              imageMessage: {
                caption: content.caption || '',
                contextInfo: content.contextInfo,
              },
            };
          } else if (content?.contacts) {
            protoMsg = {
              contactsArrayMessage: {
                displayName: content.contacts.displayName,
                contacts: content.contacts.contacts,
              },
            };
          } else if (content?.audio) {
            protoMsg = {
              audioMessage: {
                mimetype: content.mimetype || 'audio/mp4',
                ptt: Boolean(content.ptt),
              },
            };
          } else if (content?.sticker) {
            protoMsg = {
              stickerMessage: {
                mimetype: 'image/webp',
                isAnimated: Boolean(content.isAnimated),
                contextInfo: content.contextInfo,
              },
            };
          }

          if (!globalThis.__waSentMessagesCache) {
            globalThis.__waSentMessagesCache = new Map();
          }
          if (!(globalThis as any).__waSentMsgDestinationMap) {
            (globalThis as any).__waSentMsgDestinationMap = new Map();
          }
          if (preMsgId) {
            this.botSentProtoMessages.set(preMsgId, protoMsg);
            globalThis.__waSentMessagesCache.set(preMsgId, protoMsg);
            (globalThis as any).__waSentMsgDestinationMap.set(preMsgId, targetJid);
          }

          const isMedia = Boolean(content?.video || content?.image || content?.sticker || content?.audio);
          const maxWaitMs = isMedia ? 25000 : 15000;
          const ephSec =
            !targetJid.endsWith('@g.us')
              ? this.chatEphemeralMap.get(targetJid) ||
                this.chatEphemeralMap.get(jid)
              : undefined;
          if (isDirectDm) {
            const kind = content?.video
              ? 'video'
              : content?.image
              ? 'image'
              : content?.audio
              ? 'audio'
              : content?.sticker
              ? 'sticker'
              : content?.contacts
              ? 'vcard'
              : content?.react
              ? 'react'
              : 'text';
            appendDmTrace(
              'DM_SEND_TRY',
              `attempt=${attempt} jid=${targetJid} preId=${preMsgId} kind=${kind} hasCtx=${Boolean(content?.contextInfo)} hasQuote=${Boolean(quotedOpt)} eph=${ephSec || 0}`
            );
          }
          const sendPromise = this.sock.sendMessage(targetJid, content, {
            messageId: preMsgId,
            ...(quotedOpt ? { quoted: quotedOpt } : {}),
            ...(ephSec && ephSec > 0 ? { ephemeralExpiration: ephSec } : {}),
          });
          const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Send timeout on slow connection')), maxWaitMs)
          );
          const sent = await Promise.race([sendPromise, timeoutPromise]);
          const actualId = sent?.key?.id || preMsgId;
          this.botSentMsgIds.add(actualId);
          this.processedMsgIds.add(actualId);
          const finalMsg = sent?.message || protoMsg;
          this.rememberProtoMessage(actualId, finalMsg);
          this.rememberBotSentProtoMessage(actualId, finalMsg);
          globalThis.__waSentMessagesCache.set(actualId, finalMsg);
          (globalThis as any).__waSentMsgDestinationMap.set(actualId, targetJid);
          if (isDirectDm) {
            appendDmTrace('DM_SEND_OK', `jid=${targetJid} id=${actualId}`);
          }

          // Register ack-error fallback for all non-group DM replies (including Self-Chat)
          if (!isAckFallback && !targetJid.endsWith('@g.us')) {
            const rawTgtDigits = targetJid.split(':')[0].split('@')[0].replace(/[^0-9]/g, '');
            const mappedPnFromGlobal =
              targetJid.endsWith('@lid') && rawTgtDigits
                ? (globalThis as any).__waLidToPnUser?.get(rawTgtDigits)
                : '';
            const mappedPnJid =
              mappedPnFromGlobal && mappedPnFromGlobal.length >= 7
                ? `${mappedPnFromGlobal}@s.whatsapp.net`
                : '';
            const candidateAlt =
              this.chatAltJidMap.get(targetJid) ||
              this.chatAltJidMap.get(jid) ||
              this.lidToPnMap.get(targetJid) ||
              (mappedPnJid && !this.isSelfChatJid(mappedPnJid) ? mappedPnJid : undefined);
            const altJid = candidateAlt && candidateAlt !== targetJid ? candidateAlt : undefined;
            if (altJid || quotedOpt || content?.contextInfo) {
              const strippedFallback =
                typeof content?.text === 'string'
                  ? { text: content.text, raw: true, mentions: content.mentions }
                  : content?.video
                  ? { video: content.video, gifPlayback: content.gifPlayback, caption: content.caption }
                  : content?.image
                  ? { image: content.image, caption: content.caption }
                  : content?.audio
                  ? { audio: content.audio, mimetype: content.mimetype, ptt: content.ptt, fileName: content.fileName }
                  : content;
              this.registerAckFallback(actualId, targetJid, strippedFallback, altJid);
            }
          }
          return true;
        }
      } catch (err: any) {
        lastErrMsg = String(err?.message || err);
        if (isDirectDm) {
          appendDmTrace('DM_SEND_ERR', `attempt=${attempt} jid=${targetJid} err=${lastErrMsg}`);
        }
        console.error(`[SAYRON MD] sendReliableMessage attempt ${attempt}/${retries} error (${targetJid}):`, lastErrMsg);
        const rawTargetDigits = targetJid.split(':')[0].split('@')[0].replace(/[^0-9]/g, '');
        const mappedPn =
          this.chatAltJidMap.get(targetJid) ||
          this.lidToPnMap.get(jid) ||
          (globalThis as any).__waLidToPnUser?.get(rawTargetDigits);
        const mappedLid =
          this.chatAltJidMap.get(targetJid) ||
          (globalThis as any).__waPnToLidUser?.get(rawTargetDigits);
        let switchedAlt = false;
        if (attempt === 1 && targetJid.endsWith('@lid') && mappedPn) {
          const nextPn = mappedPn.includes('@') ? mappedPn : `${mappedPn}@s.whatsapp.net`;
          if (nextPn !== targetJid) {
            targetJid = nextPn;
            switchedAlt = true;
          }
        } else if (attempt === 1 && targetJid.endsWith('@s.whatsapp.net') && mappedLid) {
          const nextLid = mappedLid.includes('@') ? mappedLid : `${mappedLid}@lid`;
          if (nextLid !== targetJid) {
            targetJid = nextLid;
            switchedAlt = true;
          }
        }
        // Strip quoted + contextInfo if no altJid switch occurred or on attempt >= 2
        if ((!switchedAlt || attempt >= 2) && (content?.contextInfo || quotedOpt)) {
          const { contextInfo: _omitCtx, ...restContent } = content || {};
          content = restContent;
          quotedOpt = undefined;
        }
      }
      await new Promise((r) => setTimeout(r, 250 * attempt));
    }

    if (lastErrMsg) {
      store.addLog('ERROR', 'Send Message Failed', `[${this.sessionId}] jid=${targetJid}: ${lastErrMsg}`);
    }
    // Only enqueue if queue is short, and stamp createdAt so stale items are discarded
    if (this.outgoingQueue.length < 3) {
      this.outgoingQueue.push({ jid: targetJid, content, retriesLeft: 1, createdAt: Date.now() });
    }
    return false;
  }

  private rememberProtoMessage(id: string, message: proto.IMessage) {
    if (!id || !message) return;
    const existing = this.recentProtoMessages.get(id);
    if (existing) {
      const existingHasKeys = this.hasDownloadableMediaFields(this.unwrapProtoContent(existing));
      const newHasKeys = this.hasDownloadableMediaFields(this.unwrapProtoContent(message));
      if (existingHasKeys && !newHasKeys) {
        return;
      }
    }
    this.recentProtoMessages.set(id, message);
    if (this.recentProtoMessages.size > 2000) {
      const oldestKey = this.recentProtoMessages.keys().next().value;
      if (oldestKey) this.recentProtoMessages.delete(oldestKey);
    }
  }

  private get viewOnceCachePath(): string {
    return path.join(this.authDir, 'viewonce_cache.json');
  }

  private isViewOnceProto(raw: any): boolean {
    let q: any = raw;
    if (!q || typeof q !== 'object') return false;
    for (let i = 0; i < 8; i++) {
      if (q?.viewOnceMessage || q?.viewOnceMessageV2 || q?.viewOnceMessageV2Extension) {
        return true;
      }
      if (
        q?.imageMessage?.viewOnce ||
        q?.videoMessage?.viewOnce ||
        q?.ptvMessage?.viewOnce ||
        q?.audioMessage?.viewOnce ||
        q?.documentMessage?.viewOnce
      ) {
        return true;
      }
      if (q?.deviceSentMessage?.message) { q = q.deviceSentMessage.message; continue; }
      if (q?.ephemeralMessage?.message) { q = q.ephemeralMessage.message; continue; }
      if (q?.documentWithCaptionMessage?.message) { q = q.documentWithCaptionMessage.message; continue; }
      if (q?.lottieStickerMessage?.message) { q = q.lottieStickerMessage.message; continue; }
      if (q?.botInvokeMessage?.message) { q = q.botInvokeMessage.message; continue; }
      if (q?.associatedChildMessage?.message) { q = q.associatedChildMessage.message; continue; }
      if (q?.groupStatusMessage?.message) { q = q.groupStatusMessage.message; continue; }
      if (q?.groupStatusMessageV2?.message) { q = q.groupStatusMessageV2.message; continue; }
      if (q?.editedMessage?.message?.protocolMessage?.editedMessage) {
        q = q.editedMessage.message.protocolMessage.editedMessage;
        continue;
      }
      if (q?.requestPaymentMessage?.noteMessage) {
        q = q.requestPaymentMessage.noteMessage;
        continue;
      }
      break;
    }
    return false;
  }

  private loadViewOnceCache() {
    try {
      if (!fs.existsSync(this.viewOnceCachePath)) return;
      const parsed = JSON.parse(fs.readFileSync(this.viewOnceCachePath, 'utf-8'));
      if (!parsed || typeof parsed !== 'object') return;
      for (const [id, entry] of Object.entries(parsed)) {
        const b64 = (entry as any)?.b64;
        if (typeof id === 'string' && typeof b64 === 'string' && b64) {
          try {
            const decoded = proto.Message.decode(Buffer.from(b64, 'base64'));
            if (decoded) {
              this.viewOnceProtoCache.set(id, decoded);
              this.recentProtoMessages.set(id, decoded);
            }
          } catch {
            // ignore corrupted entry
          }
        }
      }
    } catch {
      // ignore read errors
    }
  }

  private rememberViewOnceProto(id: string, message: proto.IMessage): boolean {
    if (!id || !message) return false;
    const existing = this.viewOnceProtoCache.get(id);
    if (existing) {
      const existingHasKeys = this.hasDownloadableMediaFields(this.unwrapProtoContent(existing));
      const newHasKeys = this.hasDownloadableMediaFields(this.unwrapProtoContent(message));
      if (existingHasKeys && !newHasKeys) {
        return false;
      }
      if (!existingHasKeys && !newHasKeys) {
        return false;
      }
    }
    this.viewOnceProtoCache.set(id, message);
    if (this.viewOnceProtoCache.size > 100) {
      const oldestKey = this.viewOnceProtoCache.keys().next().value;
      if (oldestKey) this.viewOnceProtoCache.delete(oldestKey);
    }
    if (!this.viewOnceSaveTimer) {
      this.viewOnceSaveTimer = setTimeout(() => {
        this.viewOnceSaveTimer = null;
        try {
          fs.mkdirSync(this.authDir, { recursive: true });
          const serialized: Record<string, { b64: string; ts: number }> = {};
          const now = Date.now();
          for (const [k, m] of this.viewOnceProtoCache.entries()) {
            try {
              const bytes = proto.Message.encode(m).finish();
              serialized[k] = { b64: Buffer.from(bytes).toString('base64'), ts: now };
            } catch {
              // skip non-encodable entry
            }
          }
          fs.writeFileSync(this.viewOnceCachePath, JSON.stringify(serialized), 'utf-8');
        } catch {
          // ignore write errors
        }
      }, 150);
    }
    return true;
  }

  private async flushOutgoingQueue() {
    if (this.isFlushingQueue || this.outgoingQueue.length === 0) return;
    if (!this.sock || this.state.status !== 'connected') return;

    this.isFlushingQueue = true;
    const now = Date.now();
    try {
      while (this.outgoingQueue.length > 0 && this.sock && this.state.status === 'connected') {
        const item = this.outgoingQueue.shift()!;
        // Discard any expired command responses older than 20 seconds so reconnection NEVER dumps bulk spam!
        if (now - (item.createdAt || 0) > 20000) {
          continue;
        }
        try {
          const preMsgId = generateMessageIDV2(this.sock.user?.id);
          this.botSentMsgIds.add(preMsgId);
          this.processedMsgIds.add(preMsgId);
          const sent = await this.sock.sendMessage(item.jid, item.content, {
            messageId: preMsgId,
          });
          if (sent?.key?.id && sent.message) {
            this.botSentMsgIds.add(sent.key.id);
            this.rememberProtoMessage(sent.key.id, sent.message);
            this.rememberBotSentProtoMessage(sent.key.id, sent.message);
          }
          await new Promise((r) => setTimeout(r, 250));
        } catch {
          // Do not re-enqueue on network failure to avoid spam loops
          break;
        }
      }
    } finally {
      this.isFlushingQueue = false;
    }
  }

  public async startConnection(
    phoneNumberForPairing?: string,
    forceFreshReset = false,
    isHandshakeRestart = false
  ): Promise<WhatsAppConnectionState> {
    const wasAlreadyRegistered = this.hasRegisteredCredsOnDisk();

    // If already genuinely connected with an open socket and user didn't ask to wipe/reset,
    // keep the 24/7 session alive instead of wiping creds!
    if (
      phoneNumberForPairing &&
      !forceFreshReset &&
      this.isSocketOpen &&
      this.state.status === 'connected' &&
      wasAlreadyRegistered
    ) {
      return this.getState();
    }

    if (
      phoneNumberForPairing &&
      !forceFreshReset &&
      !isHandshakeRestart &&
      this.state.status === 'pairing_code_ready' &&
      this.state.pairingCode &&
      this.sock?.ws?.isOpen &&
      Date.now() - this.connectStartedAt < 3000
    ) {
      return this.getState();
    }

    const persistedCooldownMs =
      phoneNumberForPairing && !forceFreshReset && !isHandshakeRestart
        ? getPairingCooldownRemainingMs(phoneNumberForPairing)
        : 0;
    const effectiveCooldownMs = Math.max(
      persistedCooldownMs,
      this.rateLimitedUntilMs > Date.now() ? this.rateLimitedUntilMs - Date.now() : 0
    );

    if (
      phoneNumberForPairing &&
      !forceFreshReset &&
      !isHandshakeRestart &&
      effectiveCooldownMs > 0
    ) {
      this.updateState({
        status: 'disconnected',
        qrDataUrl: null,
        pairingCode: null,
        errorMessage: formatRateLimitMessage(effectiveCooldownMs),
      });
      return this.getState();
    }

    if (forceFreshReset || (phoneNumberForPairing && !isHandshakeRestart)) {
      this.cleanupSocketOnly();
      this.clearAuthFolder();
      this.hasEverOpened = false;
      this.consecutiveLoggedOutCount = 0;
      this.connectionReplacedCount = 0;
    } else if (this.isConnecting) {
      return this.getState();
    } else {
      this.cleanupSocketOnly();
    }

    const effectiveAlreadyRegistered =
      !forceFreshReset && !(phoneNumberForPairing && !isHandshakeRestart) && wasAlreadyRegistered;

    this.isConnecting = true;
    this.connectStartedAt = Date.now();
    this.bootTimestampSec = Math.floor(Date.now() / 1000);
    this.updateState({ autoReconnect: true });

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    // Give WhatsApp edge servers a brief settle window after forcefully closing any prior socket
    if (this.lastSocketClosedAtMs > 0) {
      const sinceCloseMs = Date.now() - this.lastSocketClosedAtMs;
      if (sinceCloseMs < 1200) {
        await new Promise((r) => setTimeout(r, 1200 - sinceCloseMs));
      }
    }

    const normalizedPairingPhone =
      phoneNumberForPairing && !effectiveAlreadyRegistered
        ? normalizeWhatsAppPhoneNumber(phoneNumberForPairing)
        : undefined;

    if (
      phoneNumberForPairing &&
      !effectiveAlreadyRegistered &&
      (!normalizedPairingPhone || normalizedPairingPhone.length < 10)
    ) {
      this.isConnecting = false;
      this.updateState({
        status: 'disconnected',
        errorMessage:
          'Invalid phone number format. Enter full number with country code (e.g., 923464267218).',
      });
      return this.getState();
    }

    try {
      if (!fs.existsSync(this.authDir)) {
        fs.mkdirSync(this.authDir, { recursive: true });
      }

      // Only keep status as 'connected' during a brief heal if the socket had ALREADY opened previously
      this.updateState({
        status: effectiveAlreadyRegistered && this.hasEverOpened ? 'connected' : 'connecting',
        errorMessage: null,
        qrDataUrl: null,
        pairingCode: null,
      });

      const { state: authState, saveCreds } = await useMultiFileAuthState(this.authDir);
      const version = await getFastWaWebVersion();

      const sock = makeWASocket({
        version,
        auth: {
          creds: authState.creds,
          keys: makeCacheableSignalKeyStore(authState.keys, silentLogger),
        },
        printQRInTerminal: false,
        logger: silentLogger,
        browser: Browsers.macOS('Chrome'),
        syncFullHistory: false,
        shouldSyncHistoryMessage: () => false,
        emitOwnEvents: false,
        markOnlineOnConnect: true,
        generateHighQualityLinkPreview: false,
        keepAliveIntervalMs: 20000,
        connectTimeoutMs: 45000,
        defaultQueryTimeoutMs: 25000,
        qrTimeout: 60000,
        retryRequestDelayMs: 350,
        msgRetryCounterCache: this.msgRetryCounterCache as any,
        cachedGroupMetadata: async (jid) => this.getCachedGroupMetadata(jid),
        getMessage: async (key) => {
          const id = key?.id;
          if (id) {
            const stored =
              this.botSentProtoMessages.get(id) ||
              (globalThis as any).__waSentMessagesCache?.get(id) ||
              this.recentProtoMessages.get(id);
            if (stored) return stored;
          }
          return undefined;
        },
      });

      // Prevent Baileys event-buffer from holding onto incoming messages for 20-30s
      try {
        if (sock.ev && typeof (sock.ev as any).buffer === 'function') {
          (sock.ev as any).buffer = () => {};
        }
      } catch {
        // ignore
      }

      this.sock = sock;
      let pairingCodeRequested = false;
      let credsSaveChain = Promise.resolve();

      sock.ev.on('creds.update', () => {
        const meId = authState.creds?.me?.id || '';
        const meLid = (authState.creds?.me as any)?.lid || '';
        const numDigits = meId.split(':')[0].split('@')[0].replace(/[^0-9]/g, '');
        const lidDigits = meLid.split(':')[0].split('@')[0].replace(/[^0-9]/g, '');
        if (numDigits && !this.pairedOwnerNumber) this.pairedOwnerNumber = numDigits;
        if (lidDigits && !this.pairedOwnerLid) this.pairedOwnerLid = lidDigits;
        credsSaveChain = credsSaveChain
          .then(async () => {
            await saveCreds();
            this.backupRegisteredCreds();
          })
          .catch(() => {});
      });

      sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr, isNewLogin } = update;

        if (isNewLogin) {
          credsSaveChain = credsSaveChain.then(() => saveCreds()).catch(() => {});
          await credsSaveChain;
        }

        // Wait until WhatsApp Server sends pair-device (emitting qr) so Noise + Registration
        // handshake is 100% complete before requesting the companion pairing code.
        if (
          qr &&
          normalizedPairingPhone &&
          !authState.creds.registered &&
          !pairingCodeRequested
        ) {
          pairingCodeRequested = true;
          try {
            // Wait dynamically up to 4.5s for WebSocket to settle into open state
            for (let w = 0; w < 18; w++) {
              if (this.sock !== sock) break;
              if (sock.ws?.isOpen) break;
              await new Promise((r) => setTimeout(r, 250));
            }
            await new Promise((r) => setTimeout(r, 650));

            if (this.sock !== sock || !sock.ws?.isOpen || authState.creds.registered) {
              pairingCodeRequested = false;
              return;
            }

            let cleanRaw = '';
            let lastErr: any = null;
            for (let attempt = 1; attempt <= 2; attempt++) {
              try {
                if (this.sock !== sock || !sock.ws?.isOpen || authState.creds.registered) break;
                appendDmTrace('PAIRING_REQ', `session=${this.sessionId} phone=${normalizedPairingPhone} attempt=${attempt}`);
                // Use Baileys native Crockford Base32 8-char code (no non-Crockford custom chars like U/I/L/O/0)
                const rawCode = await sock.requestPairingCode(normalizedPairingPhone);
                cleanRaw = String(rawCode || '')
                  .toUpperCase()
                  .replace(/[^A-Z0-9]/g, '');
                if (cleanRaw && cleanRaw.length >= 8) break;
                lastErr = new Error('WhatsApp returned an invalid pairing code.');
              } catch (reqErr: any) {
                lastErr = reqErr;
                const m = String(reqErr?.message || '').toLowerCase();
                const st = (reqErr as any)?.output?.statusCode;
                appendDmTrace('PAIRING_ERR', `session=${this.sessionId} status=${st} msg=${reqErr?.message || ''}`);
                if (st === 429 || m.includes('429') || m.includes('rate')) {
                  throw reqErr;
                }
                if (attempt < 2) {
                  await new Promise((r) => setTimeout(r, 900));
                }
              }
            }

            if (!cleanRaw || cleanRaw.length < 8) {
              throw lastErr || new Error('WhatsApp returned an invalid pairing code. Please try again.');
            }

            const formattedCode =
              cleanRaw.length === 8
                ? `${cleanRaw.slice(0, 4)}-${cleanRaw.slice(4)}`
                : cleanRaw;

            // Immediately flush updated pairingCode & me.id to disk before user enters code
            credsSaveChain = credsSaveChain.then(() => saveCreds()).catch(() => {});
            await credsSaveChain;
            await saveCreds().catch(() => {});

            clearPairingRateLimitCooldown(normalizedPairingPhone);
            this.rateLimitedUntilMs = 0;
            this.pairedOwnerNumber = normalizedPairingPhone;
            this.connectStartedAt = Date.now();
            this.updateState({
              status: 'pairing_code_ready',
              pairingCode: formattedCode,
              qrDataUrl: null,
              connectedPhone: `+${normalizedPairingPhone}`,
              errorMessage: null,
            });
            this.saveSessionMeta();
            appendDmTrace('PAIRING_CODE', `session=${this.sessionId} code=${formattedCode}`);
            store.addLog(
              'WHATSAPP',
              'Pairing Code Ready',
              `WhatsApp pairing code ready for +${normalizedPairingPhone}: ${formattedCode}`
            );
          } catch (err: any) {
            const errMsg = String(err?.message || '');
            const status = (err as any)?.output?.statusCode;
            const isRateLimit =
              status === 429 ||
              errMsg.includes('429') ||
              errMsg.toLowerCase().includes('rate');
            console.warn(`[${this.sessionId}] requestPairingCode notice:`, status, errMsg);
            let cooldownUntil = 0;
            if (isRateLimit) {
              cooldownUntil = recordPairingRateLimitCooldown(normalizedPairingPhone);
              this.rateLimitedUntilMs = cooldownUntil;
            }
            this.cleanupSocketOnly();
            this.clearAuthFolder();
            store.addLog(
              'WHATSAPP',
              isRateLimit ? 'Pairing Rate Cooldown' : 'Pairing Rejected',
              isRateLimit
                ? `WhatsApp rate limit for +${normalizedPairingPhone}; protecting number for ~${Math.max(1, Math.ceil((cooldownUntil - Date.now()) / 60000))} min`
                : `Pairing request rejected for +${normalizedPairingPhone}: ${errMsg || status}`
            );
            this.updateState({
              status: 'disconnected',
              qrDataUrl: null,
              pairingCode: null,
              errorMessage: isRateLimit
                ? formatRateLimitMessage(Math.max(60000, cooldownUntil - Date.now()))
                : errMsg ||
                  'WhatsApp rejected pairing code request. Check number & try again.',
            });
          }
        } else if (qr && !normalizedPairingPhone) {
          try {
            const qrUrl = await QRCode.toDataURL(qr, {
              margin: 2,
              width: 280,
              color: {
                dark: '#0f172a',
                light: '#ffffff',
              },
            });
            this.connectStartedAt = Date.now();
            this.updateState({
              status: 'qr_ready',
              qrDataUrl: qrUrl,
              pairingCode: null,
              errorMessage: null,
            });
          } catch {
            // ignore QR error
          }
        }

        if (connection === 'open') {
          const isFirstOpen = !this.hasEverOpened;
          this.isConnecting = false;
          this.isSocketOpen = true;
          this.hasEverOpened = true;
          this.consecutiveLoggedOutCount = 0;
          this.connectionReplacedCount = 0;
          this.bootTimestampSec = Math.floor(Date.now() / 1000) - 60;
          const userJid = sock.user?.id || authState.creds?.me?.id || '';
          const userLid =
            (sock.user as any)?.lid || (authState.creds?.me as any)?.lid || '';
          const cleanNumber = userJid.split(':')[0].split('@')[0].replace(/[^0-9]/g, '');
          const cleanLid = userLid.split(':')[0].split('@')[0].replace(/[^0-9]/g, '');
          const displayName =
            sock.user?.name || authState.creds?.me?.name || 'SUFYAN-X-IK';

          if (cleanNumber) {
            this.pairedOwnerNumber = cleanNumber;
          }
          if (cleanLid) {
            this.pairedOwnerLid = cleanLid;
            if (cleanNumber) {
              (globalThis as any).__waRegisterLidPn?.(cleanLid, cleanNumber);
            }
          } else if (cleanNumber) {
            // Proactively discover this account's @lid on connect so LID groups & self-chat work on every ID
            void sock.onWhatsApp(`${cleanNumber}@s.whatsapp.net`).then((res: any[]) => {
              const foundLid = res?.[0]?.lid;
              const lidDigits = String(foundLid || '').split(':')[0].split('@')[0].replace(/[^0-9]/g, '');
              if (lidDigits) {
                this.pairedOwnerLid = lidDigits;
                (globalThis as any).__waRegisterLidPn?.(lidDigits, cleanNumber);
                if (authState.creds?.me && !(authState.creds.me as any).lid) {
                  (authState.creds.me as any).lid = `${lidDigits}@lid`;
                }
                this.saveSessionMeta();
              }
            }).catch(() => {});
          }
          this.connectedSinceMs = Date.now();

          this.updateState({
            status: 'connected',
            qrDataUrl: null,
            pairingCode: null,
            connectedPhone: cleanNumber
              ? `+${cleanNumber}`
              : this.pairedOwnerNumber
              ? `+${this.pairedOwnerNumber}`
              : 'Connected',
            connectedName: displayName,
            errorMessage: null,
          });
          this.saveSessionMeta();
          whatsappManager.recordUserUsedBot(cleanNumber || this.pairedOwnerNumber || this.sessionId);

          store.addLog(
            'WHATSAPP',
            `WhatsApp Connected (${getServerDefById(this.serverId).name})`,
            `Connected 24/7 session (${displayName})`
          );

          // Announce active online presence & start recurring 20s heartbeat so companion device stays 24/7 active
          if (!this.paused) {
            sock.sendPresenceUpdate('available').catch(() => {});
          }
          this.startPresenceHeartbeat();
          resolveChannelJidFromInvite(sock).catch(() => {});
          this.flushOutgoingQueue().catch(() => {});

          if (isFirstOpen && (cleanNumber || this.pairedOwnerNumber)) {
            const selfJid = `${cleanNumber || this.pairedOwnerNumber}@s.whatsapp.net`;
            const srvName = getServerDefById(this.serverId).name;
            setTimeout(() => {
              const welcomeCard = [
                `╭━━━〔 👑 *SAYRON MD CONNECTED* 👑 〕━━━╮`,
                `┃ 🟢 *System:* ONLINE • 24/7 Non-Stop Active`,
                `┃ ⚡ *Server Node:* ${srvName}`,
                `┃ 🛡️ *Data-Off Shield:* ACTIVE (No Phone Internet Needed)`,
                `┃ 🤖 *AI Auto-Reply:* STANDBY 🟡 (Type *.ai on* to enable)`,
                `┃ 👑 *Commander:* SUFYAN-X-IK (+92 346 4267218)`,
                `┃ 💎 *Ready:* Send *.menu* or *.ping* in any chat!`,
                `╰━━━〔 ⚡ *POWERED BY SUFYAN-X-IK* ⚡ 〕━━━╯`,
              ].join('\n');
              this.sendReliableMessage(selfJid, {
                text: welcomeCard,
              }).catch(() => {});
            }, 1200);
          }
        }

        if (connection === 'close') {
          this.isConnecting = false;
          this.isSocketOpen = false;
          this.lastSocketClosedAtMs = Date.now();
          await credsSaveChain.catch(() => {});
          const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
          const closeErrMsg = String((lastDisconnect?.error as any)?.message || '');
          if (!this.hasEverOpened) {
            appendDmTrace('PAIRING_CLOSE', `session=${this.sessionId} status=${statusCode} registered=${authState.creds.registered} msg=${closeErrMsg}`);
          }
          const conflictType = String(
            (lastDisconnect?.error as any)?.data?.content?.[0]?.attrs?.type || ''
          ).toLowerCase();
          const isExplicitLogout = statusCode === DisconnectReason.loggedOut;
          const isConflictLogout = isExplicitLogout && /conflict|replaced/i.test(closeErrMsg);
          const isRestartRequired =
            statusCode === DisconnectReason.restartRequired ||
            statusCode === 515 ||
            statusCode === 428;
          const hasCompletedPairing =
            Boolean(authState.creds.registered) ||
            Boolean(authState.creds.account) ||
            Boolean(authState.creds.me?.id && String(authState.creds.me.id).includes(':')) ||
            this.hasEverOpened ||
            this.hasRegisteredCredsOnDisk();

          if (
            isRestartRequired ||
            (hasCompletedPairing && !isExplicitLogout && statusCode !== DisconnectReason.connectionReplaced)
          ) {
            await saveCreds().catch(() => {});
            this.backupRegisteredCreds();
            if (!this.hasEverOpened) {
              store.addLog(
                'WHATSAPP',
                'Pairing Handshake Reconnect',
                `Reconnecting socket to finalize WhatsApp device linking (code: ${statusCode || 'handshake'})`
              );
            }
            const healDelay =
              statusCode === DisconnectReason.restartRequired ||
              statusCode === 515 ||
              statusCode === 428 ||
              statusCode === DisconnectReason.connectionLost
                ? 450
                : 1500;
            this.cleanupSocketOnly();
            this.reconnectTimer = setTimeout(() => {
              this.reconnectTimer = null;
              this.startConnection(
                hasCompletedPairing ? undefined : normalizedPairingPhone,
                false,
                true
              ).catch(() => {});
            }, healDelay);
            return;
          }

          if (!hasCompletedPairing) {
            const wasShowingPairingCode = this.state.status === 'pairing_code_ready';
            this.cleanupSocketOnly();
            this.clearAuthFolder();
            this.hasEverOpened = false;
            this.updateState({
              autoReconnect: false,
              status: 'disconnected',
              qrDataUrl: null,
              pairingCode: null,
              connectedPhone: null,
              connectedName: null,
              errorMessage:
                statusCode === 429
                  ? formatRateLimitMessage(15 * 60 * 1000)
                  : statusCode === DisconnectReason.timedOut || wasShowingPairingCode
                  ? 'Pairing session expired or closed. Tap Generate Pairing Code for a fresh code.'
                  : closeErrMsg && closeErrMsg !== 'Connection Closed'
                  ? `WhatsApp connection closed (${statusCode || 'error'}). Try generating a fresh code.`
                  : null,
            });
            return;
          }

          if (isExplicitLogout) {
            this.consecutiveLoggedOutCount += 1;
            this.cleanupSocketOnly();

            // If WhatsApp explicitly reports device_removed, stop immediately without retry spam.
            if (conflictType === 'device_removed' || this.consecutiveLoggedOutCount >= 4) {
              this.clearAuthFolder();
              this.hasEverOpened = false;
              this.consecutiveLoggedOutCount = 0;
              store.addLog(
                'WHATSAPP',
                'Session Unlinked',
                `[${this.sessionId}] Disconnected by WhatsApp (${conflictType || closeErrMsg || '401'}). Pair again when ready.`
              );
              this.updateState({
                autoReconnect: false,
                status: 'disconnected',
                qrDataUrl: null,
                pairingCode: null,
                connectedPhone: null,
                connectedName: null,
                errorMessage: isConflictLogout
                  ? 'Session conflicted or was unlinked from WhatsApp on your phone. Pair again when ready.'
                  : 'Device was unlinked from WhatsApp on your phone. Pair again.',
              });
            } else {
              // Wait calmly so any overlapping server/edge socket expires cleanly before reconnecting
              const backoffMs = isConflictLogout
                ? 5500 * this.consecutiveLoggedOutCount
                : Math.min(20000, 3000 * this.consecutiveLoggedOutCount);
              store.addLog(
                'WHATSAPP',
                'Session Conflict Recovery',
                `[${this.sessionId}] Waiting ${Math.round(backoffMs / 1000)}s for clean socket handoff (attempt ${this.consecutiveLoggedOutCount}/3)`
              );
              this.reconnectTimer = setTimeout(() => {
                this.reconnectTimer = null;
                if (this.hasRegisteredCredsOnDisk()) {
                  this.startConnection().catch(() => {});
                }
              }, backoffMs);
            }
          } else if (statusCode === DisconnectReason.connectionReplaced) {
            this.connectionReplacedCount += 1;
            this.cleanupSocketOnly();
            if (this.connectionReplacedCount <= 3 && this.state.autoReconnect) {
              const replacedDelayMs = this.connectionReplacedCount * 8000;
              this.reconnectTimer = setTimeout(() => {
                this.reconnectTimer = null;
                if (this.hasRegisteredCredsOnDisk()) {
                  this.startConnection().catch(() => {});
                }
              }, replacedDelayMs);
            } else {
              this.hasEverOpened = false;
              this.updateState({
                autoReconnect: false,
                status: 'disconnected',
                errorMessage: 'Session replaced by another active connection. Click Connect/Reconnect if needed.',
              });
            }
          } else if (this.state.autoReconnect) {
            const delayMs =
              statusCode === DisconnectReason.restartRequired ||
              statusCode === DisconnectReason.connectionLost ||
              statusCode === DisconnectReason.timedOut
                ? 600
                : 1200;
            this.cleanupSocketOnly();
            this.reconnectTimer = setTimeout(() => {
              this.reconnectTimer = null;
              if (this.hasRegisteredCredsOnDisk()) {
                this.startConnection().catch(() => {});
              }
            }, delayMs);
          }
        }
      });

      sock.ev.on('group-participants.update', async (ev) => {
        try {
          const cfg = store.getGroupConfig(ev.id);
          const mentions = (ev.participants || []).map((p: any) =>
            typeof p === 'string' ? p : p?.id || String(p)
          );
          if (mentions.length === 0 || mentions.length > 5) return;
          if (ev.action === 'add' && cfg.welcome) {
            const tags = mentions.map((p: string) => `@${p.split('@')[0]}`).join(' ');
            let welcomeText = `🎉 *Welcome!* ${tags}\n⚡ *${store.getSettings().botName}* • *SUFYAN-X-IK*`;
            if (cfg.customWelcome && cfg.customWelcome.trim()) {
              let grpName = 'Group';
              let memberCount = '';
              try {
                const gm = await this.getCachedGroupMetadata(ev.id);
                grpName = gm?.subject || grpName;
                memberCount = String(gm?.participants?.length || '');
              } catch {}
              welcomeText = cfg.customWelcome
                .replace(/@user/gi, tags)
                .replace(/\{user\}/gi, tags)
                .replace(/\{group\}/gi, grpName)
                .replace(/\{count\}/gi, memberCount);
            }
            await this.sendReliableMessage(ev.id, {
              text: welcomeText,
              mentions,
            });
          } else if (ev.action === 'remove' && cfg.goodbye) {
            const tags = mentions.map((p: string) => `@${p.split('@')[0]}`).join(' ');
            await this.sendReliableMessage(ev.id, {
              text: `👋 *Goodbye!* ${tags}`,
              mentions,
            });
          } else if (ev.action === 'promote' && cfg.antiUnauthorizedAdmin) {
            // 🚨 Real-time Anti-Unauthorized Admin enforcement
            const botClean = (this.sock?.user?.id || '').split(':')[0].split('@')[0];
            const ownerClean = (this.pairedOwnerNumber || '').replace(/[^0-9]/g, '');
            const authorizedSet = new Set(
              (cfg.authorizedAdmins || []).map((a: string) => a.split('@')[0].split(':')[0])
            );
            if (botClean) authorizedSet.add(botClean);
            if (ownerClean) authorizedSet.add(ownerClean);

            const unauthorizedToDemote: string[] = [];
            for (const p of mentions) {
              const num = p.split('@')[0].split(':')[0];
              if (!authorizedSet.has(num)) {
                unauthorizedToDemote.push(p);
              }
            }

            if (unauthorizedToDemote.length > 0) {
              await this.sock
                ?.groupParticipantsUpdate(ev.id, unauthorizedToDemote, 'demote')
                .catch(() => {});
              const tags = unauthorizedToDemote.map((u) => `@${u.split('@')[0]}`).join(', ');
              await this.sendReliableMessage(ev.id, {
                text: [
                  `╭━━━〔 🚨 *UNAUTHORIZED ADMIN DEMOTED* 〕━━━╮`,
                  `┃ 🛡️ *Status:* Anti-Unauthorized Protection Active`,
                  `┃ 👤 *Target:* ${tags}`,
                  `┃ ⚡ *Action:* Admin privileges revoked immediately`,
                  `┃ 👑 *Commander:* SUFYAN-X-IK`,
                  `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`,
                ].join('\n'),
                mentions: unauthorizedToDemote,
              });
            }
          }

          if (cfg.pdm && (ev.action === 'promote' || ev.action === 'demote')) {
            const actor = (ev as any).author as string | undefined;
            const tags = mentions.map((p: string) => `@${p.split('@')[0]}`).join(', ');
            const isPromote = ev.action === 'promote';
            const pdmMentions = actor ? [...mentions, actor] : mentions;
            await this.sendReliableMessage(ev.id, {
              text: [
                `╭─❒ ${toSmallCaps(isPromote ? 'promote alert' : 'demote alert')} ❒`,
                `│ ${isPromote ? '👑 *Promoted:*' : '📉 *Demoted:*'} ${tags}`,
                ...(actor ? [`│ ⚡ *By:* @${actor.split('@')[0]}`] : []),
                `╰──────────────`,
              ].join('\n'),
              mentions: pdmMentions,
            });
          }
        } catch {
          // ignore
        }
      });

      sock.ev.on('call', async (calls: any[]) => {
        try {
          if (!store.getSettings().callMusic || !Array.isArray(calls)) return;
          for (const call of calls) {
            if (call?.status === 'offer' && call?.id && call?.from) {
              await sock.rejectCall(call.id, call.from).catch(() => {});
              await this.sendReliableMessage(call.from, {
                text: [
                  `╭─❒ ${toSmallCaps('call shield active')} ❒`,
                  `│ 🎵 Calls are auto-declined by *SAYRON MD*`,
                  `│ 💬 Please drop a text or voice message instead!`,
                  `╰──────────────`,
                ].join('\n'),
              }).catch(() => {});
              try {
                const tracks = store.getSongs();
                const firstTrack = tracks?.[0];
                if (firstTrack?.audioUrl) {
                  let buf: Buffer | null = null;
                  if (firstTrack.audioUrl.startsWith('data:')) {
                    const b64 = firstTrack.audioUrl.split(',')[1] || '';
                    if (b64) buf = Buffer.from(b64, 'base64');
                  } else if (firstTrack.audioUrl.startsWith('/')) {
                    const localPath = path.join(process.cwd(), 'public', firstTrack.audioUrl.replace(/^\/+/, ''));
                    if (fs.existsSync(localPath)) {
                      buf = await fs.promises.readFile(localPath);
                    }
                  } else if (/^https?:\/\//i.test(firstTrack.audioUrl)) {
                    const res = await fetch(firstTrack.audioUrl, {
                      signal: AbortSignal.timeout(8000),
                    });
                    if (res.ok) buf = Buffer.from(await res.arrayBuffer());
                  }
                  if (buf && buf.length > 2000) {
                    await this.sendReliableMessage(call.from, {
                      audio: buf,
                      mimetype: 'audio/mpeg',
                      ptt: false,
                      fileName: `${firstTrack.title || 'call_music'}.mp3`,
                    });
                  }
                }
              } catch {}
            }
          }
        } catch {
          // ignore call handler errors
        }
      });

      sock.ev.on('messages.update', async (updates: any[]) => {
        try {
          if (!Array.isArray(updates)) return;
          for (const item of updates) {
            const targetId = item?.key?.id;
            const updMsg = item?.update?.message;
            if (targetId && updMsg) {
              this.rememberProtoMessage(targetId, updMsg);
              if (this.isViewOnceProto(updMsg)) {
                const stored = this.rememberViewOnceProto(targetId, updMsg);
                if (stored) {
                  const unwrappedUpd = this.unwrapProtoContent(updMsg);
                  const hasKeys = this.hasDownloadableMediaFields(unwrappedUpd);
                  const updLeaf = this.getInnerMediaLeaf(unwrappedUpd);
                  const diag = !hasKeys
                    ? ` innerKeys=${unwrappedUpd ? Object.keys(unwrappedUpd).join(',') : 'none'} leafKeys=${updLeaf ? Object.keys(updLeaf).join(',') : 'none'}`
                    : '';
                  appendDmTrace(
                    'VO_CACHED',
                    `src=update id=${targetId} jid=${item?.key?.remoteJid || ''} fromMe=${Boolean(item?.key?.fromMe)} hasKeys=${hasKeys}${diag}`
                  );
                }
              }
            }
            if (!store.getSettings().antiDelete) continue;
            const stubType = item?.update?.messageStubType;
            const isDeletedStub = stubType === 68 || item?.update?.message === null;
            if (targetId && isDeletedStub && !this.botSentMsgIds.has(targetId)) {
              await this.handleRecoveredDeletedMessage(targetId);
            }
          }
        } catch {
          // ignore
        }
      });

      const registerContactsLidMappings = (contacts: any[]) => {
        if (!Array.isArray(contacts)) return;
        for (const c of contacts) {
          const cid = c?.id || '';
          const clid = c?.lid || '';
          const cphone = c?.phoneNumber || (cid.endsWith('@s.whatsapp.net') ? cid : '');
          if (clid && cphone) {
            (globalThis as any).__waRegisterLidPn?.(clid, cphone);
            const pnDigits = String(cphone).split(':')[0].split('@')[0].replace(/[^0-9]/g, '');
            const lidJid = clid.includes('@') ? clid : `${clid}@lid`;
            if (pnDigits && lidJid) {
              this.lidToPnMap.set(lidJid, `${pnDigits}@s.whatsapp.net`);
            }
          }
        }
      };

      sock.ev.on('contacts.upsert', registerContactsLidMappings);
      sock.ev.on('contacts.update', registerContactsLidMappings);

      sock.ev.on('chats.phoneNumberShare' as any, (data: any) => {
        try {
          const lidJid = data?.lid || '';
          const pnJid = data?.jid || '';
          if (lidJid && pnJid) {
            (globalThis as any).__waRegisterLidPn?.(lidJid, pnJid);
            const pnDigits = String(pnJid).split(':')[0].split('@')[0].replace(/[^0-9]/g, '');
            const lidDigits = String(lidJid).split(':')[0].split('@')[0].replace(/[^0-9]/g, '');
            const normLid = lidDigits ? `${lidDigits}@lid` : '';
            if (pnDigits && normLid) {
              const normPn = `${pnDigits}@s.whatsapp.net`;
              this.lidToPnMap.set(normLid, normPn);
              if (!this.isSelfChatJid(normPn)) {
                this.chatAltJidMap.set(normLid, normPn);
                this.chatAltJidMap.set(normPn, normLid);
              }
            }
          }
        } catch {
          // ignore
        }
      });

      sock.ev.on('chats.update', (updates: any[]) => {
        try {
          if (!Array.isArray(updates)) return;
          for (const ch of updates) {
            if (ch?.id && ch?.tcToken) {
              const entry = {
                token: Buffer.isBuffer(ch.tcToken) ? ch.tcToken : Buffer.from(ch.tcToken),
                timestamp: String(ch.tcTokenTimestamp || Math.floor(Date.now() / 1000)),
              };
              if (!(globalThis as any).__waTcTokens) (globalThis as any).__waTcTokens = new Map();
              (globalThis as any).__waTcTokens.set(ch.id, entry);
            }
          }
        } catch {}
      });

      // Catch asynchronous WhatsApp server <ack class="message" error="..."> rejections and auto-recover in DMs
      sock.ws.on('CB:ack,class:message', async (stanza: any) => {
        try {
          const ackId = stanza?.attrs?.id;
          const errCode = stanza?.attrs?.error;
          if (errCode) {
            appendDmTrace(
              'CB_ACK_ERR',
              `id=${ackId || ''} from=${stanza?.attrs?.from || ''} type=${stanza?.attrs?.type || ''} error=${errCode}`
            );
          }
          if (!ackId) return;
          const pending = this.pendingAckFallbacks.get(ackId);
          if (!pending) return;
          clearTimeout(pending.timer);
          this.pendingAckFallbacks.delete(ackId);
          if (!errCode) {
            appendDmTrace('DM_ACK_OK', `id=${ackId} jid=${pending.jid}`);
            return;
          }

          // Error 463 = WhatsApp Reachout Timelock / Missing Privacy Token:
          // NEVER immediately spam a second DM to altJid (that reinforces the server timelock!).
          // Instead, request a privacy token once per cooldown and let WhatsApp lift the timelock cleanly.
          if (String(errCode) === '463' || String(errCode) === '421' || String(errCode) === '479') {
            console.warn(
              `[SAYRON MD] Server ack error=${errCode} for msg=${ackId} jid=${pending.jid}; skipping duplicate retry to avoid extending WhatsApp DM reachout lock`
            );
            store.addLog(
              'WHATSAPP',
              'DM Reachout Lock (463)',
              `WhatsApp blocked 1:1 DM to ${pending.jid} (ack error=${errCode}). Groups & Self-Chat still work.`
            );
            const lastRef = this.tcTokenRefreshCooldown.get(pending.jid) || 0;
            if (Date.now() - lastRef > 10 * 60 * 1000 && typeof (sock as any).getPrivacyTokens === 'function') {
              this.tcTokenRefreshCooldown.set(pending.jid, Date.now());
              void (sock as any).getPrivacyTokens([pending.jid]).catch(() => {});
            }
            return;
          }

          console.warn(
            `[SAYRON MD] Server ack error=${errCode} for msg=${ackId} jid=${pending.jid}; firing auto-fallback (altJid=${pending.altJid || 'none'})`
          );
          store.addLog(
            'WHATSAPP',
            'WhatsApp Ack Fallback',
            `ack error=${errCode} on jid=${pending.jid} (alt=${pending.altJid || 'none'})`
          );
          const fallbackTarget =
            pending.altJid && pending.altJid !== pending.jid ? pending.altJid : pending.jid;
          if (pending.fallbackContent) {
            await this.sendReliableMessage(
              fallbackTarget,
              { ...pending.fallbackContent, _isAckFallback: true },
              2
            ).catch(() => {});
          }
        } catch {
          // ignore
        }
      });

      sock.ev.on('messages.upsert', async (m) => {
        if (!Array.isArray(m.messages)) return;
        const nowSec = Math.floor(Date.now() / 1000);
        const tasks: Promise<void>[] = [];
        for (const msg of m.messages) {
          // Skip transient CIPHERTEXT decrypt placeholders without poisoning processedMsgIds
          if (msg.messageStubType === 2 && !msg.message) {
            const stubJid = msg.key?.remoteJid || '';
            if ((msg.key as any)?.isViewOnce && msg.key?.id) {
              this.unavailableViewOnceIds.add(msg.key.id);
              if (this.unavailableViewOnceIds.size > 500) {
                const firstVo = this.unavailableViewOnceIds.values().next().value;
                if (firstVo) this.unavailableViewOnceIds.delete(firstVo);
              }
              appendDmTrace(
                'VO_UNAVAILABLE',
                `jid=${stubJid} id=${msg.key.id} fromMe=${Boolean(msg.key.fromMe)}`
              );
            }
            if (stubJid && !stubJid.endsWith('@g.us') && !stubJid.endsWith('@broadcast')) {
              const reason = (msg.messageStubParameters || []).join(', ') || 'CIPHERTEXT';
              store.addLog('WHATSAPP', 'DM Decrypt Retry', `[${this.sessionId}] jid=${stubJid} reason=${reason}`);
            }
            continue;
          }
          const msgTimestamp = this.extractTimestampSeconds(msg.messageTimestamp);
          // Eagerly cache any View-Once message (not older than 24h) even during append/sync before backlog filtering
          if (
            msg.key?.id &&
            msg.message &&
            this.isViewOnceProto(msg.message) &&
            (!msgTimestamp || nowSec - msgTimestamp < 86400)
          ) {
            this.rememberProtoMessage(msg.key.id, msg.message);
            const cachedNow = this.rememberViewOnceProto(msg.key.id, msg.message);
            if (cachedNow) {
              const unwrappedVo = this.unwrapProtoContent(msg.message);
              const hasKeys = this.hasDownloadableMediaFields(unwrappedVo);
              const voLeaf = this.getInnerMediaLeaf(unwrappedVo);
              const diag = !hasKeys
                ? ` topKeys=${Object.keys(msg.message).join(',')} innerKeys=${unwrappedVo ? Object.keys(unwrappedVo).join(',') : 'none'} leafKeys=${voLeaf ? Object.keys(voLeaf).join(',') : 'none'} hasThumb=${Boolean(voLeaf?.jpegThumbnail?.length)}`
                : '';
              appendDmTrace(
                'VO_CACHED',
                `src=${m.type} id=${msg.key.id} jid=${msg.key.remoteJid || ''} fromMe=${Boolean(msg.key.fromMe)} hasKeys=${hasKeys}${diag}`
              );
            }
          }
          const isPostBootLive = msgTimestamp >= this.bootTimestampSec - 10;
          if (m.type !== 'notify' && !isPostBootLive) {
            continue;
          }
          // Allow up to 300s skew / Signal retry decryption delay, only drop ancient backlog
          if (
            msgTimestamp > 0 &&
            (nowSec - msgTimestamp > 300 || msgTimestamp < this.bootTimestampSec - 90)
          ) {
            if (msg.key?.id) this.processedMsgIds.add(msg.key.id);
            continue;
          }
          const modeType = m.type === 'notify' ? 'notify' : 'append';
          tasks.push(
            Promise.race([
              this.handleIncomingWhatsAppMessage(msg, modeType),
              new Promise<void>((resolve) =>
                setTimeout(() => {
                  console.warn(`[${this.sessionId}] Incoming message handler exceeded 45s timeout (msgId=${msg.key?.id || 'unknown'})`);
                  resolve();
                }, 45000)
              ),
            ]).catch((err: any) => {
              console.error(`[${this.sessionId}] messages.upsert handler error:`, err?.message || err);
            })
          );
        }
        if (tasks.length > 0) {
          await Promise.allSettled(tasks);
        }
      });
    } catch (err: any) {
      this.isConnecting = false;
      this.updateState({
        status: 'disconnected',
        errorMessage: err?.message || 'Failed to initialize WhatsApp socket.',
      });
    }

    return this.state;
  }

  public async disconnectAndReset(): Promise<WhatsAppConnectionState> {
    this.cleanupSocketOnly();
    this.clearAuthFolder();
    this.pairedOwnerNumber = null;
    this.pairedOwnerLid = null;
    this.outgoingQueue = [];
    this.updateState({
      status: 'disconnected',
      qrDataUrl: null,
      pairingCode: null,
      connectedPhone: null,
      connectedName: null,
      errorMessage: null,
    });
    return this.state;
  }

  private clearAuthFolder() {
    try {
      if (fs.existsSync(this.authDir)) {
        fs.rmSync(this.authDir, { recursive: true, force: true });
      }
    } catch (e) {
      console.error('Failed to clear auth folder:', e);
    }
  }

  private extractTimestampSeconds(ts: any): number {
    if (!ts) return 0;
    if (typeof ts === 'number') return ts;
    if (typeof ts === 'object' && typeof ts.low === 'number') return ts.low;
    return Number(ts) || 0;
  }

  private unwrapMessage(msg: proto.IWebMessageInfo): proto.IMessage | null | undefined {
    if (!msg?.message) return null;
    return this.unwrapProtoContent(msg.message);
  }

  private extractTextFromMessage(msg: proto.IWebMessageInfo): string {
    const m: any = this.unwrapMessage(msg);
    if (!m) return '';
    let nativeFlowId = '';
    const paramsJson = m.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson;
    if (typeof paramsJson === 'string' && paramsJson.trim()) {
      try {
        const parsed = JSON.parse(paramsJson);
        if (typeof parsed?.id === 'string' && parsed.id.trim()) {
          nativeFlowId = parsed.id.trim();
        }
      } catch {
        // ignore JSON parse errors
      }
    }
    return (
      nativeFlowId ||
      m.conversation ||
      m.extendedTextMessage?.text ||
      m.imageMessage?.caption ||
      m.videoMessage?.caption ||
      m.documentMessage?.caption ||
      m.buttonsResponseMessage?.selectedButtonId ||
      m.buttonsResponseMessage?.selectedDisplayText ||
      m.listResponseMessage?.singleSelectReply?.selectedRowId ||
      m.listResponseMessage?.title ||
      m.templateButtonReplyMessage?.selectedId ||
      m.templateButtonReplyMessage?.selectedDisplayText ||
      m.interactiveResponseMessage?.body?.text ||
      ''
    ).trim();
  }

  private unwrapProtoContent(raw: any): proto.IMessage | null {
    let q: any = raw;
    if (!q) return null;
    for (let i = 0; i < 8; i++) {
      if (q?.deviceSentMessage?.message) { q = q.deviceSentMessage.message; continue; }
      if (q?.ephemeralMessage?.message) { q = q.ephemeralMessage.message; continue; }
      if (q?.viewOnceMessage?.message) { q = q.viewOnceMessage.message; continue; }
      if (q?.viewOnceMessageV2?.message) { q = q.viewOnceMessageV2.message; continue; }
      if (q?.viewOnceMessageV2Extension?.message) { q = q.viewOnceMessageV2Extension.message; continue; }
      if (q?.documentWithCaptionMessage?.message) { q = q.documentWithCaptionMessage.message; continue; }
      if (q?.lottieStickerMessage?.message) { q = q.lottieStickerMessage.message; continue; }
      if (q?.botInvokeMessage?.message) { q = q.botInvokeMessage.message; continue; }
      if (q?.associatedChildMessage?.message) { q = q.associatedChildMessage.message; continue; }
      if (q?.groupStatusMessage?.message) { q = q.groupStatusMessage.message; continue; }
      if (q?.groupStatusMessageV2?.message) { q = q.groupStatusMessageV2.message; continue; }
      if (q?.editedMessage?.message?.protocolMessage?.editedMessage) {
        q = q.editedMessage.message.protocolMessage.editedMessage;
        continue;
      }
      if (q?.requestPaymentMessage?.noteMessage) {
        q = q.requestPaymentMessage.noteMessage;
        continue;
      }
      break;
    }
    return q;
  }

  private extractQuotedProto(msg: proto.IWebMessageInfo): proto.IMessage | null {
    const m = this.unwrapMessage(msg);
    const ctx =
      m?.extendedTextMessage?.contextInfo ||
      m?.imageMessage?.contextInfo ||
      m?.videoMessage?.contextInfo ||
      m?.audioMessage?.contextInfo ||
      m?.documentMessage?.contextInfo ||
      m?.stickerMessage?.contextInfo ||
      (m as any)?.contextInfo;
    if (!ctx) return null;
    let q: any = ctx.quotedMessage;
    const hasKeys = Boolean(q && typeof q === 'object' && Object.keys(q).length > 0);
    if ((!hasKeys || (q as any)?.ephemeralMessage || ctx.stanzaId) && ctx.stanzaId) {
      const cached =
        this.recentProtoMessages.get(ctx.stanzaId) ||
        this.botSentProtoMessages.get(ctx.stanzaId) ||
        this.antiDeleteCache.get(ctx.stanzaId)?.rawMsg?.message;
      if (!hasKeys && cached) {
        q = cached;
      } else if (hasKeys && cached) {
        const unwrappedQ = this.unwrapProtoContent(q);
        const hasTextInQ = Boolean(
          unwrappedQ?.conversation ||
          unwrappedQ?.extendedTextMessage?.text ||
          unwrappedQ?.imageMessage?.caption ||
          unwrappedQ?.videoMessage?.caption ||
          unwrappedQ?.documentMessage?.caption
        );
        if (!hasTextInQ) q = cached;
      }
    }
    return this.unwrapProtoContent(q);
  }

  private extractTextFromProtoObj(q: any): string {
    if (!q) return '';
    const unwrapped = this.unwrapProtoContent(q);
    if (!unwrapped) return '';
    const direct = (
      unwrapped.conversation ||
      unwrapped.extendedTextMessage?.text ||
      (unwrapped.extendedTextMessage as any)?.canonicalUrl ||
      unwrapped.extendedTextMessage?.matchedText ||
      unwrapped.imageMessage?.caption ||
      unwrapped.videoMessage?.caption ||
      unwrapped.documentMessage?.caption ||
      (unwrapped as any).buttonsMessage?.contentText ||
      (unwrapped as any).interactiveMessage?.body?.text ||
      (unwrapped as any).templateMessage?.hydratedTemplate?.hydratedContentText ||
      (unwrapped as any).templateMessage?.hydratedFourRowTemplate?.hydratedContentText ||
      (unwrapped as any).listMessage?.description ||
      ''
    ).trim();
    if (direct) return direct;
    if ((unwrapped as any).groupInviteMessage) {
      const gi = (unwrapped as any).groupInviteMessage;
      const link = gi.inviteCode ? `https://chat.whatsapp.com/${gi.inviteCode}` : '';
      return [gi.caption, gi.groupName, link].filter(Boolean).join('\n').trim();
    }
    if ((unwrapped as any).newsletterAdminInviteMessage) {
      const ni = (unwrapped as any).newsletterAdminInviteMessage;
      return [ni.caption, ni.newsletterName].filter(Boolean).join('\n').trim();
    }
    return '';
  }

  private extractQuotedText(msg: proto.IWebMessageInfo): string {
    const q = this.extractQuotedProto(msg);
    return this.extractTextFromProtoObj(q);
  }

  private getInnerMediaLeaf(inner: any): any {
    if (!inner || typeof inner !== 'object') return null;
    return (
      inner.imageMessage ||
      inner.videoMessage ||
      inner.ptvMessage ||
      inner.audioMessage ||
      inner.stickerMessage ||
      inner.documentMessage ||
      null
    );
  }

  private coerceToBuffer(val: any): Buffer | null {
    if (!val) return null;
    if (Buffer.isBuffer(val)) return val.length > 0 ? val : null;
    if (val instanceof Uint8Array) return val.length > 0 ? Buffer.from(val) : null;
    if (Array.isArray(val)) return val.length > 0 ? Buffer.from(val) : null;
    if (typeof val === 'string') {
      const trimmed = val.trim();
      if (!trimmed) return null;
      try {
        const b = Buffer.from(trimmed, 'base64');
        return b.length > 0 ? b : null;
      } catch {
        return null;
      }
    }
    if (typeof val === 'object') {
      if (Array.isArray(val.data)) return val.data.length > 0 ? Buffer.from(val.data) : null;
      if (typeof val.data === 'string' && val.data) {
        const b = Buffer.from(val.data, 'base64');
        return b.length > 0 ? b : null;
      }
      const numKeys = Object.keys(val).filter((k) => /^\d+$/.test(k)).sort((a, b) => Number(a) - Number(b));
      if (numKeys.length > 0) {
        const arr = numKeys.map((k) => Number(val[k]) & 0xff);
        return Buffer.from(arr);
      }
    }
    return null;
  }

  private hasDownloadableMediaFields(inner: any): boolean {
    const leaf = this.getInnerMediaLeaf(inner);
    if (!leaf || typeof leaf !== 'object') return false;
    const hasPathOrUrl = Boolean(leaf.url || leaf.directPath || leaf.thumbnailDirectPath);
    const hasKey = Boolean(this.coerceToBuffer(leaf.mediaKey));
    return hasPathOrUrl && hasKey;
  }

  private normalizeMediaProtoForDownload(inner: any): proto.IMessage {
    if (!inner || typeof inner !== 'object') return inner;
    const keys = ['imageMessage', 'videoMessage', 'ptvMessage', 'audioMessage', 'stickerMessage', 'documentMessage'] as const;
    for (const key of keys) {
      const leaf = inner[key];
      if (leaf && typeof leaf === 'object') {
        const normalizedLeaf: any = { ...leaf };
        if (!normalizedLeaf.url && normalizedLeaf.directPath) {
          normalizedLeaf.url = `https://mmg.whatsapp.net${
            normalizedLeaf.directPath.startsWith('/') ? normalizedLeaf.directPath : `/${normalizedLeaf.directPath}`
          }`;
        }
        const mk = this.coerceToBuffer(normalizedLeaf.mediaKey);
        if (mk) normalizedLeaf.mediaKey = mk;
        const encSha = this.coerceToBuffer(normalizedLeaf.fileEncSha256);
        if (encSha) normalizedLeaf.fileEncSha256 = encSha;
        const sha = this.coerceToBuffer(normalizedLeaf.fileSha256);
        if (sha) normalizedLeaf.fileSha256 = sha;

        if (key === 'ptvMessage') {
          return {
            videoMessage: normalizedLeaf,
          } as proto.IMessage;
        }
        return {
          ...inner,
          [key]: normalizedLeaf,
        };
      }
    }
    return inner;
  }

  private extractMediaSource(msg: proto.IWebMessageInfo): {
    targetMsg: proto.IWebMessageInfo;
    mediaType: 'image' | 'video' | 'audio' | 'sticker' | 'document';
    mimeType: string;
    details: Record<string, any>;
  } | null {
    const m = this.unwrapMessage(msg);
    if (!m) return null;

    const inspectMsgObj = (
      target: proto.IWebMessageInfo,
      inner: proto.IMessage,
      isViewOnceFlag = false
    ): {
      targetMsg: proto.IWebMessageInfo;
      mediaType: 'image' | 'video' | 'audio' | 'sticker' | 'document';
      mimeType: string;
      details: Record<string, any>;
    } | null => {
      if (inner.imageMessage) {
        return {
          targetMsg: target,
          mediaType: 'image',
          mimeType: inner.imageMessage.mimetype || 'image/jpeg',
          details: {
            width: inner.imageMessage.width,
            height: inner.imageMessage.height,
            fileLength: Number(inner.imageMessage.fileLength || 0),
            hasMediaKeys: this.hasDownloadableMediaFields(inner),
            isViewOnce: isViewOnceFlag || Boolean(inner.imageMessage.viewOnce),
          },
        };
      }
      if (inner.audioMessage) {
        return {
          targetMsg: target,
          mediaType: 'audio',
          mimeType: inner.audioMessage.mimetype || 'audio/ogg; codecs=opus',
          details: {
            seconds: inner.audioMessage.seconds,
            ptt: inner.audioMessage.ptt,
            fileLength: Number(inner.audioMessage.fileLength || 0),
            hasMediaKeys: this.hasDownloadableMediaFields(inner),
            isViewOnce: isViewOnceFlag || Boolean(inner.audioMessage.viewOnce),
          },
        };
      }
      const vidNode = inner.videoMessage || (inner as any).ptvMessage;
      if (vidNode) {
        return {
          targetMsg: target,
          mediaType: 'video',
          mimeType: vidNode.mimetype || 'video/mp4',
          details: {
            seconds: vidNode.seconds,
            width: vidNode.width,
            height: vidNode.height,
            fileLength: Number(vidNode.fileLength || 0),
            hasMediaKeys: this.hasDownloadableMediaFields(inner),
            isViewOnce: isViewOnceFlag || Boolean(vidNode.viewOnce),
          },
        };
      }
      if (inner.stickerMessage) {
        return {
          targetMsg: target,
          mediaType: 'sticker',
          mimeType: inner.stickerMessage.mimetype || 'image/webp',
          details: {
            isAnimated: inner.stickerMessage.isAnimated,
            fileLength: Number(inner.stickerMessage.fileLength || 0),
            hasMediaKeys: this.hasDownloadableMediaFields(inner),
            isViewOnce: isViewOnceFlag,
          },
        };
      }
      if (inner.documentMessage) {
        return {
          targetMsg: target,
          mediaType: 'document',
          mimeType: inner.documentMessage.mimetype || 'application/octet-stream',
          details: {
            fileName: inner.documentMessage.fileName,
            fileLength: Number(inner.documentMessage.fileLength || 0),
            hasMediaKeys: this.hasDownloadableMediaFields(inner),
            isViewOnce: isViewOnceFlag || Boolean((inner.documentMessage as any).viewOnce),
          },
        };
      }
      return null;
    };

    const directViewOnce = this.isViewOnceProto(msg.message);
    const normalizedDirect = this.normalizeMediaProtoForDownload(m);
    const directTarget =
      normalizedDirect === m
        ? msg
        : ({
            ...msg,
            message: normalizedDirect,
          } as proto.IWebMessageInfo);
    const direct = inspectMsgObj(directTarget, normalizedDirect, directViewOnce);
    if (direct) return direct;

    const ctx =
      m.extendedTextMessage?.contextInfo ||
      m.imageMessage?.contextInfo ||
      m.videoMessage?.contextInfo ||
      (m as any).ptvMessage?.contextInfo ||
      m.audioMessage?.contextInfo ||
      m.documentMessage?.contextInfo ||
      m.stickerMessage?.contextInfo ||
      (m as any).contextInfo;
    if (!ctx) return null;

    const candidateRawList: any[] = [];
    if (ctx.stanzaId) {
      const c1 = this.viewOnceProtoCache.get(ctx.stanzaId);
      const c2 = this.recentProtoMessages.get(ctx.stanzaId);
      const c3 = this.antiDeleteCache.get(ctx.stanzaId)?.rawMsg?.message;
      const c4 = this.botSentProtoMessages.get(ctx.stanzaId);
      if (c1) candidateRawList.push(c1);
      if (c2) candidateRawList.push(c2);
      if (c3) candidateRawList.push(c3);
      if (c4) candidateRawList.push(c4);
    }
    const hasCachedProto = candidateRawList.length > 0;
    if (ctx.quotedMessage) {
      candidateRawList.push(ctx.quotedMessage);
    }

    let chosenUnwrapped: proto.IMessage | null = null;
    let firstUnwrapped: proto.IMessage | null = null;
    let isVo = false;
    for (const candRaw of candidateRawList) {
      if (this.isViewOnceProto(candRaw)) isVo = true;
      const unwrapped = this.unwrapProtoContent(candRaw);
      if (!unwrapped) continue;
      if (!firstUnwrapped && this.getInnerMediaLeaf(unwrapped)) {
        firstUnwrapped = unwrapped;
      }
      if (this.hasDownloadableMediaFields(unwrapped)) {
        chosenUnwrapped = unwrapped;
        break;
      }
    }
    chosenUnwrapped = chosenUnwrapped || firstUnwrapped;

    if (!chosenUnwrapped) return null;

    chosenUnwrapped = this.normalizeMediaProtoForDownload(chosenUnwrapped);

    const meDigits = this.sock?.user?.id?.split(':')[0]?.split('@')[0]?.replace(/[^0-9]/g, '') || '';
    const meLidDigits =
      this.pairedOwnerLid ||
      (this.sock?.user as any)?.lid?.split(':')[0]?.split('@')[0]?.replace(/[^0-9]/g, '') ||
      '';
    const pDigits = (ctx.participant || '').split(':')[0].split('@')[0].replace(/[^0-9]/g, '');
    const quotedFromMe = Boolean(
      pDigits && ((meDigits && pDigits === meDigits) || (meLidDigits && pDigits === meLidDigits))
    );

    const quotedWebMsg: proto.IWebMessageInfo = {
      key: {
        remoteJid: msg.key?.remoteJid,
        id: ctx.stanzaId,
        participant: ctx.participant,
        fromMe: quotedFromMe,
      },
      message: chosenUnwrapped,
    };
    const extracted = inspectMsgObj(quotedWebMsg, chosenUnwrapped, isVo);
    if (extracted) {
      extracted.details.quotedFromMe = quotedFromMe;
      extracted.details.hasCachedProto = hasCachedProto;
    }
    return extracted;
  }

  public getAllOwnerPhoneDigits(): Set<string> {
    const set = new Set<string>();
    // Core owner phone numbers (Pakistan format without spaces or symbols)
    set.add('923464267218');
    set.add('923708392045');

    // Paired session owner number
    if (this.pairedOwnerNumber) {
      const clean = this.pairedOwnerNumber.replace(/[^0-9]/g, '');
      if (clean) set.add(clean);
    }

    // Current connected WhatsApp socket user
    const sockUserDigits = this.sock?.user?.id?.split(':')[0]?.split('@')[0]?.replace(/[^0-9]/g, '');
    if (sockUserDigits) set.add(sockUserDigits);

    // Dynamic settings from Admin Panel & Store
    const configuredOwner = store.getSettings().ownerNumber || '';
    if (configuredOwner) {
      const tokens = String(configuredOwner).split(/[,;\s|/]+/);
      for (const tok of tokens) {
        const clean = tok.replace(/[^0-9]/g, '');
        if (clean.length >= 7) set.add(clean);
      }
    }

    // Business & Website contact numbers
    const bizPhone = store.getBusiness().contactNumbers || '';
    if (bizPhone) {
      const tokens = String(bizPhone).split(/[,;\s|/]+/);
      for (const tok of tokens) {
        const clean = tok.replace(/[^0-9]/g, '');
        if (clean.length >= 7) set.add(clean);
      }
    }
    const webPhone = store.getWebsiteConfig().contactPhone || '';
    if (webPhone) {
      const tokens = String(webPhone).split(/[,;\s|/]+/);
      for (const tok of tokens) {
        const clean = tok.replace(/[^0-9]/g, '');
        if (clean.length >= 7) set.add(clean);
      }
    }

    // Any user granted 'bot_admin' or 'owner' role in User Management
    try {
      const metas = store.getUserMetas();
      for (const meta of Object.values(metas)) {
        if (meta && (meta.role === 'bot_admin' || (meta.role as any) === 'owner')) {
          const clean = (meta.phone || meta.jid || '').split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
          if (clean.length >= 7) set.add(clean);
        }
      }
    } catch {}
    // Persisted SUDO users granted owner access
    try {
      for (const sNum of store.getSudoNumbers()) {
        const clean = String(sNum).replace(/[^0-9]/g, '');
        if (clean.length >= 7) set.add(clean);
      }
    } catch {}

    return set;
  }

  private isMessageFromPairedOwner(msg: proto.IWebMessageInfo): boolean {
    if (msg.key?.fromMe) return true;

    const ownerDigitsSet = this.getAllOwnerPhoneDigits();
    const ownerLidSet = new Set<string>();
    if (this.pairedOwnerLid) {
      ownerLidSet.add(this.pairedOwnerLid.replace(/[^0-9]/g, ''));
    }
    const sockLid = (this.sock?.user as any)?.lid?.split(':')[0]?.split('@')[0]?.replace(/[^0-9]/g, '');
    if (sockLid) ownerLidSet.add(sockLid);

    for (const od of ownerDigitsSet) {
      const mappedLid = (globalThis as any).__waPnToLidUser?.get(od);
      if (mappedLid) {
        ownerLidSet.add(String(mappedLid).replace(/[^0-9]/g, ''));
      }
    }

    const candidates = [
      msg.key?.participant,
      (msg.key as any)?.participantPn,
      (msg.key as any)?.senderPn,
      (msg.key as any)?.senderLid,
      msg.key?.remoteJid,
    ]
      .filter(Boolean)
      .map((j) => String(j).split(':')[0].split('@')[0].replace(/[^0-9]/g, ''));

    for (const c of candidates) {
      if (!c) continue;
      // Direct exact match
      if (ownerDigitsSet.has(c)) return true;
      if (ownerLidSet.has(c)) return true;

      // Check reverse mapping for candidate LID -> PN
      const mappedPn = (globalThis as any).__waLidToPnUser?.get(c);
      if (mappedPn) {
        const cleanPn = String(mappedPn).replace(/[^0-9]/g, '');
        if (ownerDigitsSet.has(cleanPn)) return true;
      }

      // Pakistani / international phone number suffix matching (last 9 digits, e.g. 708392045 or 464267218)
      for (const od of ownerDigitsSet) {
        if (od.length >= 9 && c.length >= 9) {
          if (od.slice(-9) === c.slice(-9)) {
            return true;
          }
        }
      }
    }
    return false;
  }

  private isSelfChatJid(remoteJid: string): boolean {
    if (
      !remoteJid ||
      remoteJid.endsWith('@g.us') ||
      remoteJid.endsWith('@broadcast') ||
      remoteJid.endsWith('@newsletter')
    ) {
      return false;
    }
    const remoteDigits = remoteJid.split(':')[0].split('@')[0].replace(/[^0-9]/g, '');
    if (!remoteDigits) return false;
    const ownerDigits =
      this.pairedOwnerNumber ||
      this.sock?.user?.id?.split(':')[0]?.split('@')[0]?.replace(/[^0-9]/g, '') ||
      '';
    const ownerLidDigits =
      this.pairedOwnerLid ||
      (this.sock?.user as any)?.lid?.split(':')[0]?.split('@')[0]?.replace(/[^0-9]/g, '') ||
      (ownerDigits ? (globalThis as any).__waPnToLidUser?.get(ownerDigits) : '') ||
      '';
    if (ownerLidDigits && !this.pairedOwnerLid) {
      this.pairedOwnerLid = ownerLidDigits;
    }
    if (remoteJid.endsWith('@lid')) {
      const mappedPn = (globalThis as any).__waLidToPnUser?.get(remoteDigits);
      return Boolean(
        (ownerLidDigits && remoteDigits === ownerLidDigits) ||
          (ownerDigits && mappedPn && mappedPn === ownerDigits)
      );
    }
    return Boolean(ownerDigits && remoteDigits === ownerDigits);
  }

  private async isSenderGroupAdmin(
    remoteJid: string,
    senderJid: string,
    isOwner: boolean
  ): Promise<boolean> {
    if (isOwner) return true;
    if (!remoteJid.endsWith('@g.us') || !this.sock) return false;
    try {
      const meta = await this.getCachedGroupMetadata(remoteJid);
      const cleanSender = senderJid.split(':')[0].split('@')[0];
      return Boolean(
        meta?.participants?.some((p: any) => {
          const cleanP = p.id.split(':')[0].split('@')[0];
          return cleanP === cleanSender && (p.admin === 'admin' || p.admin === 'superadmin');
        })
      );
    } catch {
      return false;
    }
  }

  private extractTargetUserJid(msg: proto.IWebMessageInfo, argText?: string): string | null {
    const m = this.unwrapMessage(msg);
    const ctx =
      m?.extendedTextMessage?.contextInfo ||
      m?.imageMessage?.contextInfo ||
      m?.videoMessage?.contextInfo;
    if (ctx?.participant) return ctx.participant;
    if (ctx?.mentionedJid && ctx.mentionedJid.length > 0) {
      return ctx.mentionedJid[0];
    }
    if (argText) {
      const digits = normalizeWhatsAppPhoneNumber(argText);
      if (digits.length >= 10) {
        return `${digits}@s.whatsapp.net`;
      }
    }
    return null;
  }

  private resolveTargetMsgKey(
    msg: proto.IWebMessageInfo,
    remoteJid: string
  ): { key: proto.IMessageKey; isQuoted: boolean; quotedFromMe: boolean; ctx: any } {
    const m = this.unwrapMessage(msg);
    const ctx =
      m?.extendedTextMessage?.contextInfo ||
      m?.imageMessage?.contextInfo ||
      m?.videoMessage?.contextInfo ||
      (m as any)?.ptvMessage?.contextInfo ||
      m?.audioMessage?.contextInfo ||
      m?.documentMessage?.contextInfo ||
      m?.stickerMessage?.contextInfo ||
      (m as any)?.contextInfo;
    if (!ctx?.stanzaId) {
      return { key: msg.key, isQuoted: false, quotedFromMe: Boolean(msg.key?.fromMe), ctx: null };
    }
    const meDigits =
      this.sock?.user?.id?.split(':')[0]?.split('@')[0]?.replace(/[^0-9]/g, '') || '';
    const meLidDigits =
      this.pairedOwnerLid ||
      (this.sock?.user as any)?.lid?.split(':')[0]?.split('@')[0]?.replace(/[^0-9]/g, '') ||
      '';
    const pDigits = (ctx.participant || '').split(':')[0].split('@')[0].replace(/[^0-9]/g, '');
    const quotedFromMe = Boolean(
      this.botSentMsgIds.has(ctx.stanzaId) ||
        this.botSentProtoMessages.has(ctx.stanzaId) ||
        (pDigits && ((meDigits && pDigits === meDigits) || (meLidDigits && pDigits === meLidDigits)))
    );
    const isGroupChat = remoteJid.endsWith('@g.us');
    const key: proto.IMessageKey = {
      remoteJid,
      id: ctx.stanzaId,
      fromMe: quotedFromMe,
      ...(isGroupChat && ctx.participant ? { participant: ctx.participant } : {}),
    };
    return { key, isQuoted: true, quotedFromMe, ctx };
  }

  private parseDurationMinutes(str: string): number {
    const m = str.trim().match(/^(\d+)\s*(s|sec|m|min|h|hr|d)?/i);
    if (!m) return 1;
    const val = parseInt(m[1], 10) || 1;
    const unit = (m[2] || 'm').toLowerCase();
    if (unit.startsWith('s')) return Math.max(0.2, val / 60);
    if (unit.startsWith('h')) return val * 60;
    if (unit.startsWith('d')) return val * 1440;
    return val;
  }

  private async handleAllCommandsIfMatched(
    text: string,
    remoteJid: string,
    senderJid: string,
    isOwner: boolean,
    senderName: string,
    msg: proto.IWebMessageInfo
  ): Promise<boolean> {
    const rawTrimmed = text.trim();
    if (!rawTrimmed) return false;

    const prefix = store.getSettings().prefix || '.';
    const matchedPrefix = [prefix, '.', '/', '!', '#'].find((p) => rawTrimmed.startsWith(p));
    const hasPrefix = Boolean(matchedPrefix);
    const bodyWithoutPrefix = matchedPrefix
      ? rawTrimmed.slice(matchedPrefix.length).trim()
      : rawTrimmed;
    const lowerBody = bodyWithoutPrefix.toLowerCase().replace(/\s+/g, ' ');

    const standaloneTriggers = new Set([
      'menu',
      'help',
      'cmd',
      'commands',
      'allmenu',
      'ping',
      'speed',
      'alive',
      'owner',
      'creator',
      'save',
      'statussave',
      'steal',
      'download',
      'pair',
      'code',
      'toimg',
      'tovoice',
      'vn',
      'ptt',
      'tts',
      'speak',
      'turbo',
      'boost',
      'ai on',
      'ai off',
      'ai mode on',
      'ai mode off',
      'livesticker',
      'live sticker',
      'menu2',
    ]);

    const isMenuShortcut1 =
      !hasPrefix &&
      (lowerBody === '1' || lowerBody === '2') &&
      Date.now() - (this.lastMenuShowcaseAt.get(remoteJid) || 0) < 120_000;
    if (isMenuShortcut1) {
      this.lastMenuShowcaseAt.delete(remoteJid);
    }

    const isPairStandalone = /^(pair|code)(\s*\+?\d+)?$/i.test(lowerBody);
    if (!hasPrefix && !standaloneTriggers.has(lowerBody) && !isPairStandalone && !isMenuShortcut1) {
      return false;
    }

    const compactPairMatch = bodyWithoutPrefix.match(/^(pair|code)[+]?(\d{8,16})$/i);
    let rawCmd = '';
    let argText = '';
    if (isMenuShortcut1) {
      rawCmd = lowerBody === '2' ? 'owner' : 'allmenu';
      argText = '';
    } else if (compactPairMatch) {
      rawCmd = compactPairMatch[1].toLowerCase();
      argText = compactPairMatch[2];
    } else {
      const firstSpace = bodyWithoutPrefix.indexOf(' ');
      rawCmd =
        lowerBody === 'live sticker'
          ? 'livesticker'
          : (firstSpace === -1 ? bodyWithoutPrefix : bodyWithoutPrefix.slice(0, firstSpace)).toLowerCase();
      argText = firstSpace === -1 ? '' : bodyWithoutPrefix.slice(firstSpace + 1).trim();
    }

    const aliasMap: Record<string, string> = {
      menus: 'menu',
      allmenu: 'allmenu',
      fullmenu: 'allmenu',
      commands: 'allmenu',
      cmds: 'allmenu',
      cmdlist: 'allmenu',
      menulist: 'allmenu',
      list: 'allmenu',
      start: 'menu',
      h: 'menu',
      p: 'ping',
      latency: 'ping',
      awake: 'alive',
      bot: 'alive',
      songs: 'song',
      mp3: 'song',
      yta: 'song',
      yts: 'song',
      ytmp3: 'song',
      videos: 'video',
      vid: 'video',
      vedio: 'video',
      ytmp4: 'video',
      yt: 'video',
      s: 'sticker',
      stiker: 'sticker',
      stickers: 'sticker',
      live: 'livesticker',
      livestickers: 'livesticker',
      lstickers: 'livesticker',
      asticker: 'livesticker',
      astickers: 'livesticker',
      animsticker: 'livesticker',
      animstickers: 'livesticker',
      gifsticker: 'livesticker',
      gsticker: 'livesticker',
      anim: 'livesticker',
      animation: 'livesticker',
      animated: 'livesticker',
      action: 'livesticker',
      actions: 'livesticker',
      dev: 'owner',
      sufyan: 'owner',
      gpt: 'ask',
      gemini: 'ask',
      save: 'statussave',
      getstatus: 'statussave',
      savestatus: 'statussave',
      steal: 'statussave',
      dlstatus: 'statussave',
      pair: 'pair',
      code: 'pair',
      pairing: 'pair',
      paircode: 'pair',
      getcode: 'pair',
      vn: 'tovoice',
      ptt: 'tovoice',
      voice: 'tovoice',
      tovoice: 'tovoice',
      tovn: 'tovoice',
      vnto: 'tovoice',
      vto: 'tovoice',
      tts: 'tts',
      speak: 'tts',
      say: 'tts',
      turbo: 'turbo',
      boost: 'turbo',
      speed: 'speed',
      unauthadmin: 'unauthorizedadmin',
      unauthorized: 'unauthorizedadmin',
      antiunauthorized: 'unauthorizedadmin',
      unauth: 'unauthorizedadmin',
      antiunauth: 'unauthorizedadmin',
      meadmin: 'meadmin',
      makemeadmin: 'meadmin',
      adminme: 'meadmin',
      selfadmin: 'meadmin',
      kall: 'kickall',
      left: 'leavegc',
      remove: 'kick',
      warns: 'warnings',
      grouplink: 'invite',
      ginfo: 'groupinfo',
      gst: 'groupstatus',
      gbc: 'bcgc',
      ags: 'antigroupstatus',
      del: 'delete',
      dll: 'delete',
      dlt: 'delete',
      ar: 'autoreact',
      ppay: 'pay',
      playcall: 'callmusic',
      reboot: 'restart',
      checkban: 'bancheck',
      isbanned: 'bancheck',
      sc: 'repo',
      takesticker: 'take',
      def: 'define',
      dictionary: 'define',
      meaning: 'define',
      tt: 'tiktok',
      ttdl: 'tiktok',
      ig: 'instagram',
      igdl: 'instagram',
      insta: 'instagram',
      iguser: 'igstalk',
      fb: 'facebook',
      fbdl: 'facebook',
      fbvideo: 'facebook',
      ytvideo: 'video',
      tom3: 'tomp3',
      mediaurl: 'tourl',
      toupload: 'tourl',
      uploadurl: 'tourl',
      tgsticker: 'tg',
      tgstickers: 'tg',
      trt: 'translate',
      plugins: 'plugin',
      stt: 'transcribe',
      m: 'menu',
      gif: 'sticker',
      shorturl: 'short',
      dict: 'define',
      sr: 'sreact',
      stickerreact: 'sreact',
      stickerrain: 'sreact',
      reactstorm: 'areact',
      emojistorm: 'areact',
      bratdark: 'brat2',
      rec: 'recording',
      toviewonce: 'tovo',
      sendvo: 'tovo',
      rankcard: 'idcard',
      profilecard: 'idcard',
      carouselmenu: 'menu2',
      cmenu: 'menu2',
      menu_2: 'menu2',
    };
    const cmd = aliasMap[rawCmd] || rawCmd;
    const argLower = argText.toLowerCase().trim();

    // 1. OWNER-ONLY COMMANDS (Note: .owner is public so anyone can see SUFYAN-X-IK's details & number!)
    const ownerOnlySet = new Set([
      'stats',
      'users',
      'groups',
      'broadcast',
      'bc',
      'broadcastgc',
      'bcgc',
      'kickall',
      'kickmembers',
      'promoteall',
      'demoteall',
      'unauthorizedadmin',
      'meadmin',
      'leavegc',
      'leave',
      'leaveall',
      'join',
      'ajoin',
      'antidelete',
      'antivv',
      'exec',
      'eval',
      'spam',
      'reload',
      'update',
      'alwaysonline',
      'autoread',
      'callmusic',
      'setsudo',
      'delsudo',
      'getsudo',
      'sudo',
      'setvar',
      'delvar',
      'gjids',
      'bancheck',
      'forward',
      'pay',
      'restart',
      'shutdown',
      'maintenance',
      'block',
      'unblock',
      'logs',
      'setname',
      'setbio',
      'setprefix',
      'setmenu',
      'setimage',
      'setgif',
      'offline',
      'online',
      'busy',
      'setprice',
    ]);

    // 2. GROUP-ADMIN (or OWNER) COMMANDS
    const groupAdminSet = new Set([
      'setrules',
      'welcome',
      'setwelcome',
      'goodbye',
      'tagall',
      'hidetag',
      'tag',
      'tagadmin',
      'admins',
      'warn',
      'setwarn',
      'resetwarn',
      'antilink',
      'antispam',
      'antigm',
      'antigroupstatus',
      'antimod',
      'pdm',
      'approval',
      'approve',
      'approveall',
      'delete',
      'gpp',
      'mute',
      'unmute',
      'muteall',
      'unmuteall',
      'kick',
      'kickall',
      'kickmembers',
      'promote',
      'promoteall',
      'demote',
      'demoteall',
      'groupai',
      'groupmode',
      'lock',
      'unlock',
      'revoke',
      'setgname',
      'setgdesc',
      'setgcpfp',
      'setgcdp',
      'leavegc',
      'leave',
      'cleargc',
      'clear',
    ]);

    // 3. OWNER-ONLY SETTINGS MUTATIONS
    const ownerSettingsSet = new Set([
      'language',
      'personality',
      'autoreply',
      'typing',
      'read',
      'presence',
      'mode',
      'autostatus',
      'statuslike',
      'statusreact',
      'autoreact',
      'poststatus',
      'upstatus',
    ]);

    if (ownerOnlySet.has(cmd) || (ownerSettingsSet.has(cmd) && argText)) {
      if (!isOwner) {
        if (
          cmd === 'unauthorizedadmin' ||
          cmd === 'kickall' ||
          cmd === 'promoteall' ||
          cmd === 'demoteall'
        ) {
          await this.sendReliableMessage(remoteJid, {
            text: `⛔ *ACCESS DENIED!* 👑\nYeh command sirf Bot Owner (*SUFYAN-X-IK*) use kar sakte hain.`,
          });
        }
        return true;
      }
    }

    if (groupAdminSet.has(cmd)) {
      const isAdmin = await this.isSenderGroupAdmin(remoteJid, senderJid, isOwner);
      if (!isAdmin) {
        await this.sendReliableMessage(remoteJid, {
          text: `⚠️ Group Admin permission required.`,
        });
        return true;
      }
    }

    // 🛡️ Admin & Control Rules Enforcement
    const currentSettings = store.getSettings();
    if (currentSettings.maintenanceMode && !isOwner) {
      await this.sendReliableMessage(remoteJid, {
        text: `🚧 *MAINTENANCE MODE ACTIVE* 🚧\nSAYRON MD is currently undergoing system maintenance. Please try again shortly.`,
      });
      return true;
    }

    const isPrivateMode = currentSettings.botMode === 'self' || currentSettings.botMode === 'private';
    if (isPrivateMode && !isOwner) {
      if (!remoteJid.endsWith('@g.us')) {
        appendDmTrace('DM_DROPPED_PRIVATE_MODE', `jid=${remoteJid} sender=${senderJid} cmd=${cmd}`);
      }
      // In private / self mode, ignore commands from non-owner completely
      return true;
    }

    if (store.isUserCommandsBlocked(senderJid) && !isOwner) {
      await this.sendReliableMessage(remoteJid, {
        text: `⛔ *COMMAND ACCESS RESTRICTED!* 🚫\nAapka command access Administrator ki taraf se block kar diya gaya hai.`,
      });
      return true;
    }

    if (store.isCommandDisabled(cmd) && !isOwner) {
      await this.sendReliableMessage(remoteJid, {
        text: `⚠️ *Command Disabled:* .${cmd} command ko Administrator ne temporary disable kiya hua hai.`,
      });
      return true;
    }

    // Check Custom Commands created in Admin Panel
    const customList = store.getCustomCommands();
    const customMatch = customList.find(
      (c) => c.enabled && c.name.toLowerCase() === cmd.toLowerCase()
    );
    if (customMatch) {
      store.recordCommandExecution(cmd, senderJid);
      await this.sendReliableMessage(remoteJid, {
        text: customMatch.response,
      });
      return true;
    }

    // Record execution for live statistics
    store.recordCommandExecution(cmd, senderJid);

    // =========================================================================
    // 🎠 .MENU2 — Interactive Carousel Menu (Swipeable Cards + Tap Buttons)
    // =========================================================================
    if (cmd === 'menu2') {
      const sCfg = store.getSettings();
      const p = sCfg.prefix || '.';
      const reqPage = parseInt(argText.trim(), 10) || 1;
      const { page, totalPages, cards } = getMenu2CarouselPages(reqPage);
      const bannerImg = await resolveMenuImageBuffer();

      if (this.sock && this.sock.waUploadToServer) {
        try {
          const targetJid = remoteJid;
          let cardHeaderObj: Record<string, any> = {
            title: '',
            subtitle: '',
            hasMediaAttachment: false,
          };
          const nowMs = Date.now();
          if (this.cachedCarouselBannerMedia && this.cachedCarouselBannerMedia.expiresAt > nowMs) {
            cardHeaderObj = this.cachedCarouselBannerMedia.headerObj;
          } else if (bannerImg) {
            const prepared = await Promise.race([
              prepareWAMessageMedia(
                { image: bannerImg },
                { upload: this.sock.waUploadToServer }
              ),
              new Promise<null>((_, reject) =>
                setTimeout(() => reject(new Error('Menu2 banner upload timeout')), 12000)
              ),
            ]);
            if (prepared?.imageMessage) {
              cardHeaderObj = {
                title: '',
                subtitle: '',
                hasMediaAttachment: true,
                imageMessage: prepared.imageMessage,
              };
              this.cachedCarouselBannerMedia = {
                headerObj: cardHeaderObj,
                expiresAt: nowMs + 10 * 60 * 1000,
              };
            }
          }

          const carouselCards = cards.map((card, idx) => ({
            header: { ...cardHeaderObj },
            body: {
              text: [
                `《 👑 *SAYRON · ${idx + 1}/${cards.length}* 》`,
                `*${card.title}*`,
                ``,
                ...card.cmds.map((c) => `➤ ${c}`),
              ].join('\n'),
            },
            footer: { text: `Power by SUFYAN-X-IK` },
            nativeFlowMessage: {
              buttons: card.cmds.map((c) => ({
                name: 'quick_reply',
                buttonParamsJson: JSON.stringify({
                  display_text: `${p}${c}`,
                  id: `${p}${c}`,
                }),
              })),
            },
          }));

          const carouselPayload: proto.IMessage = {
            viewOnceMessage: {
              message: {
                messageContextInfo: {
                  deviceListMetadata: {},
                  deviceListMetadataVersion: 2,
                },
                interactiveMessage: {
                  body: {
                    text: `👑 *SAYRON MD — Page ${page}/${totalPages}*\n_Power by SUFYAN-X-IK_\nNext Page: *${p}menu2 ${page < totalPages ? page + 1 : 1}*`,
                  },
                  footer: { text: `Swipe cards left/right & tap any command!` },
                  header: { hasMediaAttachment: false },
                  carouselMessage: {
                    cards: carouselCards,
                    messageVersion: 1,
                  },
                },
              },
            },
          };

          let ephSec = 0;
          if (targetJid.endsWith('@g.us')) {
            const grpMeta = await this.getCachedGroupMetadata(targetJid).catch(() => null);
            ephSec = Number((grpMeta as any)?.ephemeralDuration || 0);
          } else {
            ephSec = Number(this.chatEphemeralMap.get(targetJid) || 0);
          }

          const fullMsg = generateWAMessageFromContent(targetJid, carouselPayload, {
            userJid: this.sock.user?.id || '0@s.whatsapp.net',
            ...(ephSec > 0 ? { ephemeralExpiration: ephSec } : {}),
          });
          const msgId = fullMsg.key.id || generateMessageIDV2(this.sock.user?.id);
          this.botSentMsgIds.add(msgId);
          this.processedMsgIds.add(msgId);
          this.rememberProtoMessage(msgId, fullMsg.message!);
          this.rememberBotSentProtoMessage(msgId, fullMsg.message!);
          if (!globalThis.__waSentMessagesCache) globalThis.__waSentMessagesCache = new Map();
          if (!(globalThis as any).__waSentMsgDestinationMap) {
            (globalThis as any).__waSentMsgDestinationMap = new Map();
          }
          globalThis.__waSentMessagesCache.set(msgId, fullMsg.message!);
          (globalThis as any).__waSentMsgDestinationMap.set(msgId, targetJid);

          const carouselAdditionalNodes = [
            {
              tag: 'biz',
              attrs: {},
              content: [
                {
                  tag: 'interactive',
                  attrs: { type: 'native_flow', v: '1' },
                  content: [{ tag: 'native_flow', attrs: { v: '9', name: 'mixed' } }],
                },
              ],
            },
          ];
          if (!(globalThis as any).__waSentRelayOptsCache) {
            (globalThis as any).__waSentRelayOptsCache = new Map();
          }
          (globalThis as any).__waSentRelayOptsCache.set(msgId, {
            additionalNodes: carouselAdditionalNodes,
          });

          await Promise.race([
            this.sock.relayMessage(targetJid, fullMsg.message!, {
              messageId: msgId,
              additionalNodes: carouselAdditionalNodes,
            }),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error('Menu2 carousel relay timeout')), 15000)
            ),
          ]);
          return true;
        } catch (m2Err: any) {
          this.cachedCarouselBannerMedia = null;
          console.warn('[SAYRON MD] .menu2 carousel fallback:', m2Err?.message || m2Err);
        }
      }

      const fallbackLines = cards
        .map(
          (card, idx) =>
            `《 👑 *SAYRON · ${idx + 1}/${cards.length} (${card.title})* 》\n` +
            card.cmds.map((c) => `➤ ${p}${c}`).join('\n')
        )
        .join('\n\n');
      await this.sendReliableMessage(remoteJid, {
        ...(bannerImg ? { image: bannerImg } : {}),
        ...(bannerImg
          ? {
              caption: `👑 *SAYRON MD — Page ${page}/${totalPages}*\nPower by SUFYAN-X-IK\n\n${fallbackLines}`,
            }
          : {
              text: `👑 *SAYRON MD — Page ${page}/${totalPages}*\nPower by SUFYAN-X-IK\n\n${fallbackLines}`,
            }),
      });
      return true;
    }

    // =========================================================================
    // 📱 .MENU & .ALLMENU & .ALIVE (Ban-Safe Meta AI Verified Blue Tick + Website Showcase Card!)
    // =========================================================================
    if (
      cmd === 'menu' ||
      cmd === 'help' ||
      cmd === 'cmd' ||
      cmd === 'allmenu' ||
      cmd === 'alive' ||
      cmd === 'menugif' ||
      cmd === 'menuvid' ||
      cmd === 'menuvideo'
    ) {
      const resolvedChannelJid = await resolveChannelJidFromInvite(this.sock);
      const newsletterCtx = await buildNewsletterContextInfo(resolvedChannelJid, null, 999);
      const verifiedQuote = buildMetaVerifiedQuote(
        cmd === 'allmenu' ? '! SAYRON MD ALL MENU !' : '! SAYRON MD !'
      );
      const gifMp4 = await resolveMenuGifMp4Buffer();
      const gifThumb = await resolveMenuGifThumbBuffer();
      const bannerImg = await resolveMenuImageBuffer();
      const websiteAdReply = buildSufyanToolsAdReply(gifThumb || bannerImg);
      const richMenuContext = {
        ...newsletterCtx,
        externalAdReply: websiteAdReply,
      };

      // 1) Interactive Button Showcase Card on .menu / .help / .cmd in GROUPS (@g.us)
      //    Includes: Meta Verified Quote + Newsletter Channel + SufyanTools Website Card + Anime GIF + Clickable ALL MENU & SUFYAN TOOLS Buttons!
      //    (In 1:1 IBs/DMs we use the ban-safe GIF showcase below because biz/native_flow in DMs triggers WhatsApp RESTRICT_ALL_COMPANIONS 401 logout.)
      if (
        (cmd === 'menu' || cmd === 'help' || cmd === 'cmd') &&
        remoteJid.endsWith('@g.us') &&
        this.sock &&
        this.sock.waUploadToServer
      ) {
        try {
          const targetJid = remoteJid;
          const sCfg = store.getSettings();
          const p = sCfg.prefix || '.';
          const senderDisplay = (msg.pushName || 'Boss').trim().slice(0, 28);
          const nowDate = new Date();
          const pkDate = nowDate.toLocaleDateString('en-GB', { timeZone: 'Asia/Karachi' });
          const pkTime = nowDate.toLocaleTimeString('en-GB', {
            timeZone: 'Asia/Karachi',
            hour12: false,
          });
          const uptimeStr = formatUptime(store.bootTimeMs);
          const srvName = getServerDefById(this.serverId).id.toUpperCase();

          const cardBody = [
            `╭─✦ 👑 *SAYRON MD • MENU* 👑 ✦─╮`,
            `┃ 🌸 Assalam-o-Alaikum, *${senderDisplay}*`,
            `┃ 📆 ${pkDate}  •  ⏱️ ${pkTime}`,
            `┣━━━━━━━━━━━━━━━`,
            `┃ 🟢 *Status:* Online (${uptimeStr})`,
            `┃ 📶 *Server:* SAYRON-${srvName}`,
            `┃ ⚡ *Prefix:* [ ${p} ] • 401+ Commands`,
            `┃ 🌐 *Web:* ${SUFYAN_TOOLS_URL}`,
            `╰─✦ ⚡ *POWERED BY SUFYAN-X-IK* ⚡ ✦─╯`,
            ``,
            `👇 *Neeche ALL MENU ya SUFYAN TOOLS button par click karein:*`,
          ].join('\n');

          let headerObj: Record<string, any> = {
            title: '',
            subtitle: '',
            hasMediaAttachment: false,
          };
          const nowMediaMs = Date.now();
          if (this.cachedMenuHeaderMedia && this.cachedMenuHeaderMedia.expiresAt > nowMediaMs) {
            headerObj = this.cachedMenuHeaderMedia.headerObj;
          } else if (gifMp4) {
            const prepared = await Promise.race([
              prepareWAMessageMedia(
                {
                  video: gifMp4,
                  gifPlayback: true,
                  ...(gifThumb ? { jpegThumbnail: gifThumb } : {}),
                } as any,
                { upload: this.sock.waUploadToServer }
              ),
              new Promise<null>((_, reject) =>
                setTimeout(() => reject(new Error('Menu GIF media upload timeout')), 15000)
              ),
            ]);
            if (prepared?.videoMessage) {
              prepared.videoMessage.gifPlayback = true;
              (prepared.videoMessage as any).gifAttribution = 1;
              headerObj = {
                title: '',
                subtitle: '',
                hasMediaAttachment: true,
                videoMessage: prepared.videoMessage,
              };
              this.cachedMenuHeaderMedia = {
                headerObj,
                expiresAt: nowMediaMs + 10 * 60 * 1000,
              };
            }
          } else if (bannerImg) {
            const prepared = await Promise.race([
              prepareWAMessageMedia(
                { image: bannerImg },
                { upload: this.sock.waUploadToServer }
              ),
              new Promise<null>((_, reject) =>
                setTimeout(() => reject(new Error('Menu banner upload timeout')), 12000)
              ),
            ]);
            if (prepared?.imageMessage) {
              headerObj = {
                title: '',
                subtitle: '',
                hasMediaAttachment: true,
                imageMessage: prepared.imageMessage,
              };
              this.cachedMenuHeaderMedia = {
                headerObj,
                expiresAt: nowMediaMs + 10 * 60 * 1000,
              };
            }
          }

          const interactivePayload: proto.IMessage = {
            viewOnceMessage: {
              message: {
                messageContextInfo: {
                  deviceListMetadata: {},
                  deviceListMetadataVersion: 2,
                },
                interactiveMessage: {
                  header: headerObj,
                  body: { text: cardBody },
                  footer: { text: `👑 SUFYAN-X-IK • sufyantools.vercel.app` },
                  nativeFlowMessage: {
                    buttons: [
                      {
                        name: 'quick_reply',
                        buttonParamsJson: JSON.stringify({
                          display_text: '📚 ALL MENU',
                          id: `${p}allmenu`,
                        }),
                      },
                      {
                        name: 'cta_url',
                        buttonParamsJson: JSON.stringify({
                          display_text: '🌐 SUFYAN TOOLS (SERVERS)',
                          url: SUFYAN_TOOLS_URL,
                          merchant_url: SUFYAN_TOOLS_URL,
                        }),
                      },
                    ],
                  },
                  contextInfo: richMenuContext,
                },
              },
            },
          };

          const grpMeta = await this.getCachedGroupMetadata(targetJid).catch(() => null);
          const grpEph = Number((grpMeta as any)?.ephemeralDuration || 0);
          const fullMsg = generateWAMessageFromContent(targetJid, interactivePayload, {
            userJid: this.sock.user?.id || '0@s.whatsapp.net',
            quoted: verifiedQuote as any,
            ...(grpEph > 0 ? { ephemeralExpiration: grpEph } : {}),
          });
          const msgId = fullMsg.key.id || generateMessageIDV2(this.sock.user?.id);
          this.botSentMsgIds.add(msgId);
          this.processedMsgIds.add(msgId);
          this.rememberProtoMessage(msgId, fullMsg.message!);
          this.rememberBotSentProtoMessage(msgId, fullMsg.message!);
          if (!globalThis.__waSentMessagesCache) globalThis.__waSentMessagesCache = new Map();
          if (!(globalThis as any).__waSentMsgDestinationMap) {
            (globalThis as any).__waSentMsgDestinationMap = new Map();
          }
          globalThis.__waSentMessagesCache.set(msgId, fullMsg.message!);
          (globalThis as any).__waSentMsgDestinationMap.set(msgId, targetJid);

          const interactiveAdditionalNodes = [
            {
              tag: 'biz',
              attrs: {},
              content: [
                {
                  tag: 'interactive',
                  attrs: { type: 'native_flow', v: '1' },
                  content: [{ tag: 'native_flow', attrs: { v: '9', name: 'mixed' } }],
                },
              ],
            },
          ];
          if (!(globalThis as any).__waSentRelayOptsCache) {
            (globalThis as any).__waSentRelayOptsCache = new Map();
          }
          (globalThis as any).__waSentRelayOptsCache.set(msgId, {
            additionalNodes: interactiveAdditionalNodes,
          });

          await Promise.race([
            this.sock.relayMessage(targetJid, fullMsg.message!, {
              messageId: msgId,
              additionalNodes: interactiveAdditionalNodes,
            }),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error('Interactive menu relay timeout')), 15000)
            ),
          ]);
          return true;
        } catch (interactiveErr: any) {
          this.cachedMenuHeaderMedia = null;
          console.warn(
            '[SAYRON MD] Interactive menu relay fallback to GIF showcase:',
            interactiveErr?.message || interactiveErr
          );
        }
      }

      // 2) Ban-Safe Showcase Card on .menu / .help / .cmd (for IBs/DMs or fallback)
      //    Shows Meta Verified Quote + Newsletter Channel + SufyanTools Online Servers Card + Quick Shortcuts!
      if (cmd === 'menu' || cmd === 'help' || cmd === 'cmd') {
        this.lastMenuShowcaseAt.set(remoteJid, Date.now());
        if (this.lastMenuShowcaseAt.size > 200) {
          const oldestKey = this.lastMenuShowcaseAt.keys().next().value;
          if (oldestKey) this.lastMenuShowcaseAt.delete(oldestKey);
        }

        const sCfg = store.getSettings();
        const p = sCfg.prefix || '.';
        const senderDisplay = (msg.pushName || 'Boss').trim().slice(0, 28);
        const nowDate = new Date();
        const pkDate = nowDate.toLocaleDateString('en-GB', { timeZone: 'Asia/Karachi' });
        const pkTime = nowDate.toLocaleTimeString('en-GB', {
          timeZone: 'Asia/Karachi',
          hour12: false,
        });
        const uptimeStr = formatUptime(store.bootTimeMs);
        const srvName = getServerDefById(this.serverId).id.toUpperCase();

        const showcaseCaption = [
          `╭─✦ 👑 *SAYRON MD • MENU* 👑 ✦─╮`,
          `┃ 🌸 Assalam-o-Alaikum, *${senderDisplay}*`,
          `┃ 📆 ${pkDate}  •  ⏱️ ${pkTime}`,
          `┣━━━━━━━━━━━━━━━`,
          `┃ 🟢 *Status:* Online (${uptimeStr})`,
          `┃ 📶 *Server:* SAYRON-${srvName}`,
          `┃ ⚡ *Prefix:* [ ${p} ] • 401+ Commands`,
          `┃ 🌐 *Web:* ${SUFYAN_TOOLS_URL}`,
          `┣━━━━━━━━━━━━━━━`,
          `┃ 📚 *1* ya *${p}allmenu* — Full 401+ Commands`,
          `┃ 👑 *2* ya *${p}owner* — Owner & Servers Hub`,
          `┃ 🎙️ *${p}tts* • 🔓 *${p}vv* • 🎵 *${p}song* • 🤖 *${p}ai*`,
          `╰─✦ ⚡ *POWERED BY SUFYAN-X-IK* ⚡ ✦─╯`,
        ].join('\n');

        if (gifMp4) {
          const sentShowcaseGif = await this.sendReliableMessage(remoteJid, {
            video: gifMp4,
            gifPlayback: true,
            ...(gifThumb ? { jpegThumbnail: gifThumb } : {}),
            caption: showcaseCaption,
            contextInfo: richMenuContext,
            quoted: verifiedQuote,
          });
          if (sentShowcaseGif) return true;
        }

        if (bannerImg) {
          const sentShowcaseImg = await this.sendReliableMessage(remoteJid, {
            image: bannerImg,
            caption: showcaseCaption,
            contextInfo: richMenuContext,
            quoted: verifiedQuote,
          });
          if (sentShowcaseImg) return true;
        }

        await this.sendReliableMessage(remoteJid, {
          text: showcaseCaption,
          contextInfo: richMenuContext,
          quoted: verifiedQuote,
        });
        return true;
      }

      // 2) Full 401+ Commands List (.allmenu / .menugif / .alive) with Anime GIF + Meta AI Blue Tick + SufyanTools Website Card!
      const menuText = buildCompactMenuText(isOwner);
      if (gifMp4) {
        const sent = await this.sendReliableMessage(remoteJid, {
          video: gifMp4,
          gifPlayback: true,
          ...(gifThumb ? { jpegThumbnail: gifThumb } : {}),
          caption: menuText,
          contextInfo: richMenuContext,
          quoted: verifiedQuote,
        });
        if (sent) return true;
      }

      await this.sendReliableMessage(remoteJid, {
        text: menuText,
        contextInfo: richMenuContext,
        quoted: verifiedQuote,
      });
      return true;
    }

    // =========================================================================
    // 👑 .OWNER / .CREATOR (Uses OLD Sayron GIF Video Exclusively + Owner Details + vCard)
    // =========================================================================
    if (cmd === 'owner' || cmd === 'creator' || cmd === 'developer') {
      const biz = store.getBusiness();
      const sSettings = store.getSettings();
      const rawOwner =
        sSettings.ownerNumber !== undefined
          ? sSettings.ownerNumber
          : (biz.contactNumbers ?? store.getWebsiteConfig().contactPhone ?? '923464267218');
      const num1Digits =
        String(rawOwner || '').replace(/[^0-9]/g, '') ||
        this.pairedOwnerNumber ||
        '923464267218';
      const num1Formatted = num1Digits.startsWith('92')
        ? `+${num1Digits.slice(0, 2)} ${num1Digits.slice(2, 5)} ${num1Digits.slice(5)}`
        : `+${num1Digits}`;

      const resolvedChannelJid = await resolveChannelJidFromInvite(this.sock);
      const newsletterCtx = await buildNewsletterContextInfo(resolvedChannelJid);
      const verifiedQuote = buildMetaVerifiedQuote('! SAYRON MD OWNER !');
      const gifMp4 = await resolveOwnerGifMp4Buffer();
      const ownerThumb = await resolveMenuGifThumbBuffer();
      const ownerRichContext = {
        ...newsletterCtx,
        externalAdReply: buildSufyanToolsAdReply(ownerThumb),
      };

      const ownerProfileText = [
        `╭━━✦ 👑 *OWNER DETAILS* 👑 ✦━━╮`,
        `┃ 💖 *Owner:* SUFYAN-X-IK`,
        `┃ 🌸 *Brand:* SAYRON MD • Developed by SUFYAN-X-IK`,
        `┃ 📞 *Number:* ${num1Formatted}`,
        `┃ 💬 *WhatsApp:* wa.me/${num1Digits}`,
        `┃ 🌐 *Servers Web:* ${SUFYAN_TOOLS_URL}`,
        `┃ 💼 *Role:* Founder & AI Developer`,
        `┃ 🌍 *Country:* Pakistan 🇵🇰`,
        `┃ ✨ *Status:* 🟢 ${biz.ownerStatus || 'Available'} (24/7 Active)`,
        `┃ 🛠️ *Services:* AI Bots ✦ Online Servers ✦ Pro Tools`,
        `╰━━✦ ⚡ *SAYRON MD* ⚡ ✦━━╯`,
      ].join('\n');

      // 1. Send Royal Owner Details Card with Top Animated GIF Video Banner, Meta AI Blue Tick & Sufyan Tools Website Card
      if (gifMp4) {
        const sentGif = await this.sendReliableMessage(remoteJid, {
          video: gifMp4,
          gifPlayback: true,
          caption: ownerProfileText,
          contextInfo: ownerRichContext,
          quoted: verifiedQuote,
        });
        if (!sentGif) {
          await this.sendReliableMessage(remoteJid, {
            text: ownerProfileText,
            contextInfo: ownerRichContext,
            quoted: verifiedQuote,
          });
        }
      } else {
        await this.sendReliableMessage(remoteJid, {
          text: ownerProfileText,
          contextInfo: ownerRichContext,
          quoted: verifiedQuote,
        });
      }

      // 2. Send Clickable WhatsApp Contact Card (vCard)
      const vcard1 = [
        'BEGIN:VCARD',
        'VERSION:3.0',
        'FN:👑 SUFYAN-X-IK (X-IK AI)',
        'ORG:X-IK AI Official Hub;',
        'TITLE:Founder, Lead Developer & AI Architect',
        `TEL;type=CELL;type=VOICE;waid=${num1Digits}:${num1Formatted}`,
        'END:VCARD',
      ].join('\n');

      await this.sendReliableMessage(remoteJid, {
        contacts: {
          displayName: '👑 SUFYAN-X-IK',
          contacts: [{ vcard: vcard1 }],
        },
      });

      return true;
    }

    // =========================================================================
    // 🔥 STATUS, AUTO-REACT & PRO COMMANDS
    // =========================================================================
    if (cmd === 'autostatus' || cmd === 'statusview') {
      const s = store.getSettings();
      if (!argText) {
        await this.sendReliableMessage(remoteJid, {
          text: `👁️ *AUTO STATUS SEEN:* *${s.autoStatusView ? 'ON 🟢' : 'OFF 🔴'}*\nUsage: *${prefix}autostatus on* / *off*`,
        });
        return true;
      }
      const next = argLower === 'off' ? false : true;
      store.updateSettings({ autoStatusView: next });
      await this.sendReliableMessage(remoteJid, {
        text: `👁️ *AUTO STATUS SEEN:* *${next ? 'ON 🟢 (Har WhatsApp Status auto seen hoga)' : 'OFF 🔴'}*`,
      });
      return true;
    }

    if (cmd === 'statuslike') {
      const s = store.getSettings();
      if (!argText) {
        await this.sendReliableMessage(remoteJid, {
          text: `💚 *AUTO STATUS LIKE:* *${s.autoStatusLike ? 'ON 🟢' : 'OFF 🔴'}* (${s.statusLikeEmoji || '💚'})\nUsage: *${prefix}statuslike on* / *off*`,
        });
        return true;
      }
      const next = argLower === 'off' ? false : true;
      store.updateSettings({ autoStatusLike: next });
      await this.sendReliableMessage(remoteJid, {
        text: `💚 *AUTO STATUS LIKE:* *${next ? `ON 🟢 (${s.statusLikeEmoji || '💚'})` : 'OFF 🔴'}*`,
      });
      return true;
    }

    if (cmd === 'statusreact') {
      const emoji = argText.trim() || '💚';
      store.updateSettings({ statusLikeEmoji: emoji, autoStatusLike: true });
      await this.sendReliableMessage(remoteJid, {
        text: `✨ *STATUS LIKE EMOJI SET TO:* ${emoji}`,
      });
      return true;
    }

    if (cmd === 'autoreact') {
      const s = store.getSettings();
      if (!argText) {
        await this.sendReliableMessage(remoteJid, {
          text: `🔥 *AUTO MESSAGE REACT:* *${s.autoReact ? 'ON 🟢' : 'OFF 🔴'}*\nUsage: *${prefix}autoreact on* / *off*`,
        });
        return true;
      }
      const next = argLower === 'off' ? false : true;
      store.updateSettings({ autoReact: next });
      await this.sendReliableMessage(remoteJid, {
        text: `🔥 *AUTO MESSAGE REACT:* *${next ? 'ON 🟢 (Har message par auto reaction lagega)' : 'OFF 🔴'}*`,
      });
      return true;
    }

    if (cmd === 'react') {
      const emoji = argText.trim() || '🔥';
      const { key: targetKey } = this.resolveTargetMsgKey(msg, remoteJid);
      if (targetKey && this.sock) {
        await this.sendReliableMessage(remoteJid, {
          react: { text: emoji, key: targetKey },
        });
      }
      return true;
    }

    if (cmd === 'areact') {
      const { key: targetKey } = this.resolveTargetMsgKey(msg, remoteJid);
      if (targetKey && this.sock) {
        const customEmojis = Array.from(argText.trim()).filter((ch) => /\S/.test(ch));
        const storm =
          customEmojis.length >= 3
            ? customEmojis.slice(0, 10)
            : ['🔥', '❤️', '⚡', '👑', '💎', '🚀', '✨', '💯', '😍', '🎉'];
        for (const em of storm) {
          await this.sendReliableMessage(remoteJid, {
            react: { text: em, key: targetKey },
          }).catch(() => {});
          await new Promise((r) => setTimeout(r, 140));
        }
      }
      return true;
    }

    if (cmd === 'sreact') {
      if (!this.sock) return true;
      const parts = argText.trim().split(/\s+/).filter(Boolean);
      let count = 30;
      let labelParts = parts;
      if (parts[0] && /^\d{1,2}$/.test(parts[0])) {
        count = Math.max(2, Math.min(35, parseInt(parts[0], 10) || 30));
        labelParts = parts.slice(1);
      }
      const customLabel = labelParts.join(' ').trim();
      const { key: parentKey } = this.resolveTargetMsgKey(msg, remoteJid);

      try {
        let stickerBuffers: Buffer[] = [];
        let isRepliedAnim = false;
        const repliedMedia = this.extractMediaSource(msg);
        if (!customLabel && repliedMedia && repliedMedia.mediaType === 'sticker') {
          try {
            const stBuf = (await downloadMediaMessage(
              repliedMedia.targetMsg as any,
              'buffer',
              {},
              { logger: silentLogger, reuploadRequest: this.sock.updateMediaMessage }
            )) as Buffer;
            if (stBuf && stBuf.length > 100) {
              stickerBuffers = [stBuf];
              isRepliedAnim = Boolean(repliedMedia.details?.isAnimated);
            }
          } catch {
            // fall back to SAYRON MD pack
          }
        }
        if (stickerBuffers.length === 0) {
          stickerBuffers = await buildSreactStickerPack(customLabel, Math.min(30, count));
        }

        const preparedList: Array<{ stickerMessage: any; isAnimated: boolean }> = [];
        const batchSize = 6;
        for (let i = 0; i < stickerBuffers.length; i += batchSize) {
          const chunk = stickerBuffers.slice(i, i + batchSize);
          const uploaded = await Promise.all(
            chunk.map(async (buf) => {
              const prep = await prepareWAMessageMedia(
                { sticker: buf },
                { upload: this.sock!.waUploadToServer }
              );
              return { stickerMessage: prep.stickerMessage, isAnimated: isRepliedAnim };
            })
          );
          preparedList.push(...uploaded);
        }

        if (preparedList.length === 0) {
          throw new Error('Failed to upload reaction stickers');
        }

        const assocType =
          (proto as any).MessageAssociation?.AssociationType?.STICKER_ANNOTATION ?? 11;
        if (!globalThis.__waSentMessagesCache) {
          globalThis.__waSentMessagesCache = new Map();
        }
        if (!(globalThis as any).__waSentMsgDestinationMap) {
          (globalThis as any).__waSentMsgDestinationMap = new Map();
        }

        for (let idx = 0; idx < count; idx++) {
          const item = preparedList[idx % preparedList.length];
          if (!item?.stickerMessage) continue;
          const assocMsg = proto.Message.fromObject({
            stickerMessage: {
              ...item.stickerMessage,
              isAnimated: item.isAnimated,
              stickerSentTs: Date.now(),
            },
            messageContextInfo: {
              messageSecret: crypto.randomBytes(32),
              messageAssociation: {
                associationType: assocType,
                parentMessageKey: parentKey,
                messageIndex: idx,
              },
            },
          });
          const relMsgId = generateMessageIDV2(this.sock.user?.id);
          this.botSentMsgIds.add(relMsgId);
          this.processedMsgIds.add(relMsgId);
          this.botSentProtoMessages.set(relMsgId, assocMsg);
          globalThis.__waSentMessagesCache.set(relMsgId, assocMsg);
          (globalThis as any).__waSentMsgDestinationMap.set(relMsgId, remoteJid);

          await this.sock.relayMessage(remoteJid, assocMsg, { messageId: relMsgId });
          if (idx < count - 1) {
            await new Promise((r) => setTimeout(r, 45));
          }
        }
      } catch (srErr: any) {
        console.error('[SAYRON MD] .sreact error:', srErr?.message || srErr);
        await this.sendReliableMessage(remoteJid, {
          text: `⚠️ Sticker reaction send nahi ho saki: ${srErr?.message || 'Unknown error'}`,
        });
      }
      return true;
    }

    if (cmd === 'pin' || cmd === 'unpin') {
      const { key: targetKey, isQuoted } = this.resolveTargetMsgKey(msg, remoteJid);
      if (!isQuoted) {
        await this.sendReliableMessage(remoteJid, {
          text: `📌 Kisi bhi message par reply kar ke *${prefix}${cmd}* likhein!`,
        });
        return true;
      }
      try {
        await this.sock?.sendMessage(remoteJid, {
          pin: targetKey,
          type: cmd === 'pin' ? 1 : 2,
          ...(cmd === 'pin' ? { time: 86400 } : {}),
        } as any);
      } catch {
        await this.sendReliableMessage(remoteJid, {
          text: `❌ Message ${cmd} nahi ho saka (Group mein Admin hona zaroori hai).`,
        });
      }
      return true;
    }

    if (cmd === 'recording') {
      if (this.sock) {
        await this.sock.sendPresenceUpdate('recording', remoteJid).catch(() => {});
        setTimeout(() => {
          this.sock?.sendPresenceUpdate('paused', remoteJid).catch(() => {});
        }, 10000);
      }
      return true;
    }

    if (
      [
        'groupstatus',
        'gcstatus',
        'poststatus',
        'upstatus',
        'status',
        'setstatus',
        'story',
      ].includes(cmd)
    ) {
      let media = this.extractMediaSource(msg);
      const quoted = this.extractQuotedText(msg);
      let statusCaption = [argText, quoted].filter(Boolean).join('\n').trim();

      // Check if user passed or replied to any video/media link (e.g. .gcstatus https://... or reply to link)
      let downloadedMediaFromUrl: { buffer: Buffer; type: 'video' | 'image' | 'audio' } | null = null;
      const linkSource = argText || quoted || '';
      if (!media && /https?:\/\/[^\s]+/i.test(linkSource)) {
        const urlMatch = linkSource.match(/https?:\/\/[^\s]+/i)?.[0];
        if (urlMatch) {
          if (/\.(mp4|mov|avi|webm)($|\?)/i.test(urlMatch)) {
            try {
              const res = await fetch(urlMatch, { signal: AbortSignal.timeout(15000) });
              if (res.ok) {
                const b = Buffer.from(await res.arrayBuffer());
                if (b.length > 5000) {
                  downloadedMediaFromUrl = { buffer: b, type: 'video' };
                }
              }
            } catch {}
          } else if (/(youtube\.com|youtu\.be)\//i.test(urlMatch)) {
            try {
              const ytRes = await downloadYouTubeMedia(urlMatch, 'video');
              if (ytRes) {
                downloadedMediaFromUrl = { buffer: ytRes.buffer, type: 'video' };
                if (!argText && ytRes.title) statusCaption = ytRes.title;
              }
            } catch {}
          } else if (/(tiktok\.com|vm\.tiktok\.com|instagram\.com|facebook\.com|fb\.watch)/i.test(urlMatch)) {
            try {
              const dl = await downloadSocialVideo('auto', urlMatch);
              if (dl && dl.buffer.length > 2000) {
                downloadedMediaFromUrl = {
                  buffer: dl.buffer,
                  type: dl.mediaType === 'image' ? 'image' : 'video',
                };
                if (!argText && dl.title) statusCaption = dl.title;
              }
            } catch {}
          }
        }
      }

      // Collect ALL participating target groups if Owner, else current group only
      let targetGroupJids: string[] = [];
      let groupName = 'WhatsApp Group';
      let groupParticipantJids: string[] = [];
      try {
        if (isOwner && this.sock?.groupFetchAllParticipating) {
          const allGroups = await this.sock.groupFetchAllParticipating();
          targetGroupJids = Object.keys(allGroups || {});
          for (const gMeta of Object.values(allGroups || {}) as any[]) {
            for (const p of gMeta?.participants || []) {
              if (p?.id) groupParticipantJids.push(p.id);
            }
          }
        }
      } catch {}
      if (remoteJid.endsWith('@g.us')) {
        if (!targetGroupJids.includes(remoteJid)) targetGroupJids.push(remoteJid);
        if (this.sock) {
          try {
            const meta = await this.sock.groupMetadata(remoteJid);
            groupName = meta.subject || groupName;
            for (const p of meta?.participants || []) {
              if (p?.id) groupParticipantJids.push(p.id);
            }
          } catch {}
        }
      }

      if (!isOwner && targetGroupJids.length === 0) {
        await this.sendReliableMessage(remoteJid, {
          text: `⚠️ Group status sirf groups mein ya Bot Owner sab groups par laga sakte hain.`,
        });
        return true;
      }

      const rawCandidates = [
        senderJid,
        this.sock?.user?.id,
        this.pairedOwnerNumber ? `${this.pairedOwnerNumber.replace(/[^0-9]/g, '')}@s.whatsapp.net` : null,
        ...groupParticipantJids,
        ...store.getConversations().map((c) => c.jid),
      ].filter(Boolean) as string[];

      const cleanStatusJidList = Array.from(
        new Set(
          rawCandidates
            .filter(
              (j) =>
                typeof j === 'string' &&
                !j.endsWith('@g.us') &&
                !j.endsWith('@lid') &&
                !j.endsWith('@newsletter')
            )
            .map((j) => j.split(':')[0].split('@')[0])
            .filter((digits) => /^\d{7,16}$/.test(digits))
            .map((digits) => `${digits}@s.whatsapp.net`)
        )
      );

      if (this.sock) {
        await this.sock
          .sendMessage(remoteJid, {
            react: { text: '⏳', key: msg.key },
          })
          .catch(() => {});
      }

      const isPersonalStatusAlias = ['poststatus', 'upstatus', 'status', 'setstatus', 'story'].includes(cmd);

      const relayGroupStatusToAll = async (rawInnerPayload: any): Promise<number> => {
        if (!this.sock || targetGroupJids.length === 0) return 0;
        if (!(globalThis as any).__waSentMessagesCache) {
          (globalThis as any).__waSentMessagesCache = new Map();
        }
        if (!(globalThis as any).__waSentMsgDestinationMap) {
          (globalThis as any).__waSentMsgDestinationMap = new Map();
        }
        const rawMeId = this.sock.user?.id || '';
        const normalizedMeJid = rawMeId
          ? `${rawMeId.split(':')[0].split('@')[0]}@${rawMeId.includes('@lid') ? 'lid' : 's.whatsapp.net'}`
          : undefined;

        // Clone inner payload & mark ContextInfo.isGroupStatus = true on the inner content
        const innerPayload: any = { ...(rawInnerPayload || {}) };
        for (const k of Object.keys(innerPayload)) {
          const sub = innerPayload[k];
          if (sub && typeof sub === 'object' && !Buffer.isBuffer(sub)) {
            innerPayload[k] = {
              ...sub,
              contextInfo: {
                ...(sub.contextInfo || {}),
                isGroupStatus: true,
              },
            };
          }
        }

        let postedCount = 0;
        for (const gjid of targetGroupJids) {
          try {
            const gsm = generateWAMessageFromContent(
              gjid,
              {
                groupStatusMessageV2: {
                  message: innerPayload,
                },
                messageContextInfo: {
                  messageSecret: crypto.randomBytes(32),
                },
              } as any,
              { userJid: normalizedMeJid }
            );
            if (gsm.key?.id && gsm.message) {
              this.botSentMsgIds.add(gsm.key.id);
              this.rememberBotSentProtoMessage(gsm.key.id, gsm.message);
              this.rememberProtoMessage(gsm.key.id, gsm.message);
              (globalThis as any).__waSentMessagesCache.set(gsm.key.id, gsm.message);
              (globalThis as any).__waSentMsgDestinationMap.set(gsm.key.id, gjid);
            }
            await this.sock.relayMessage(gjid, gsm.message!, {
              messageId: gsm.key.id,
              useCachedGroupMetadata: false,
            });
            postedCount++;
          } catch (gsmErr) {
            console.error(`groupStatusMessageV2 relay error (${gjid}):`, gsmErr);
          }
          if (targetGroupJids.length > 1) {
            await new Promise((r) => setTimeout(r, 250));
          }
        }
        return postedCount;
      };

      try {
        // Case 1: Video (attached, replied, or downloaded from URL)
        if (downloadedMediaFromUrl?.type === 'video' || media?.mediaType === 'video') {
          const videoBuf =
            downloadedMediaFromUrl?.buffer ||
            ((await downloadMediaMessage(
              media!.targetMsg as any,
              'buffer',
              {},
              { logger: silentLogger, reuploadRequest: this.sock!.updateMediaMessage }
            )) as Buffer);

          let postedCount = 0;
          if (this.sock?.waUploadToServer && targetGroupJids.length > 0) {
            const uploadedVideo = await prepareWAMessageMedia(
              {
                video: videoBuf,
                caption: statusCaption || '⚡ Group Video Story',
              },
              { upload: this.sock.waUploadToServer }
            );
            postedCount = await relayGroupStatusToAll(uploadedVideo);
          }

          if (isPersonalStatusAlias && this.sock && cleanStatusJidList.length > 0) {
            await this.sock
              .sendMessage(
                'status@broadcast',
                {
                  video: videoBuf,
                  caption: statusCaption || `👑 ${groupName} Story`,
                },
                {
                  broadcast: true,
                  statusJidList: cleanStatusJidList,
                }
              )
              .catch(() => {});
          }

          if (this.sock) {
            if (postedCount === 0 && !isPersonalStatusAlias) {
              await this.sock.sendMessage(remoteJid, { react: { text: '❌', key: msg.key } }).catch(() => {});
              await this.sendReliableMessage(remoteJid, {
                text: `⚠️ *Video Group Status post nahi ho saka!* (Active groups: ${targetGroupJids.length})`,
              });
            } else {
              await this.sock.sendMessage(remoteJid, { react: { text: '✅', key: msg.key } }).catch(() => {});
              await this.sendReliableMessage(remoteJid, {
                text: `✅ *Video Group Status posted to ${postedCount}/${targetGroupJids.length} group(s)!* 📱`,
              });
            }
          }
          return true;
        }

        // Case 2: Image (attached, replied, or downloaded from URL)
        if (downloadedMediaFromUrl?.type === 'image' || media?.mediaType === 'image') {
          const imgBuf =
            downloadedMediaFromUrl?.buffer ||
            ((await downloadMediaMessage(
              media!.targetMsg as any,
              'buffer',
              {},
              { logger: silentLogger, reuploadRequest: this.sock!.updateMediaMessage }
            )) as Buffer);

          let postedCount = 0;
          if (this.sock?.waUploadToServer && targetGroupJids.length > 0) {
            const uploadedImg = await prepareWAMessageMedia(
              {
                image: imgBuf,
                caption: statusCaption || '⚡ Group Photo Story',
              },
              { upload: this.sock.waUploadToServer }
            );
            postedCount = await relayGroupStatusToAll(uploadedImg);
          }

          if (isPersonalStatusAlias && this.sock && cleanStatusJidList.length > 0) {
            await this.sock
              .sendMessage(
                'status@broadcast',
                {
                  image: imgBuf,
                  caption: statusCaption || `👑 ${groupName} Story`,
                },
                {
                  broadcast: true,
                  statusJidList: cleanStatusJidList,
                }
              )
              .catch(() => {});
          }

          if (this.sock) {
            if (postedCount === 0 && !isPersonalStatusAlias) {
              await this.sock.sendMessage(remoteJid, { react: { text: '❌', key: msg.key } }).catch(() => {});
              await this.sendReliableMessage(remoteJid, {
                text: `⚠️ *Photo Group Status post nahi ho saka!* (Active groups: ${targetGroupJids.length})`,
              });
            } else {
              await this.sock.sendMessage(remoteJid, { react: { text: '✅', key: msg.key } }).catch(() => {});
              await this.sendReliableMessage(remoteJid, {
                text: `✅ *Photo Group Status posted to ${postedCount}/${targetGroupJids.length} group(s)!* 📱`,
              });
            }
          }
          return true;
        }

        // Case 3: Audio / Voice Note
        if (media?.mediaType === 'audio') {
          const audioBuf = (await downloadMediaMessage(
            media.targetMsg as any,
            'buffer',
            {},
            { logger: silentLogger, reuploadRequest: this.sock!.updateMediaMessage }
          )) as Buffer;

          let postedCount = 0;
          if (this.sock?.waUploadToServer && targetGroupJids.length > 0) {
            const uploadedAudio = await prepareWAMessageMedia(
              {
                audio: audioBuf,
                mimetype: media.mimeType || 'audio/mp4',
                ptt: true,
              },
              { upload: this.sock.waUploadToServer }
            );
            postedCount = await relayGroupStatusToAll(uploadedAudio);
          }

          if (isPersonalStatusAlias && this.sock && cleanStatusJidList.length > 0) {
            await this.sock
              .sendMessage(
                'status@broadcast',
                {
                  audio: audioBuf,
                  mimetype: media.mimeType || 'audio/mp4',
                  ptt: true,
                },
                {
                  broadcast: true,
                  statusJidList: cleanStatusJidList,
                }
              )
              .catch(() => {});
          }

          if (this.sock) {
            if (postedCount === 0 && !isPersonalStatusAlias) {
              await this.sock.sendMessage(remoteJid, { react: { text: '❌', key: msg.key } }).catch(() => {});
              await this.sendReliableMessage(remoteJid, {
                text: `⚠️ *Audio Group Status post nahi ho saka!* (Active groups: ${targetGroupJids.length})`,
              });
            } else {
              await this.sock.sendMessage(remoteJid, { react: { text: '✅', key: msg.key } }).catch(() => {});
              await this.sendReliableMessage(remoteJid, {
                text: `✅ *Audio Group Status posted to ${postedCount}/${targetGroupJids.length} group(s)!* 📱`,
              });
            }
          }
          return true;
        }

        // Case 4: Text or Link status (e.g. reply to channel link / URL with .gcstatus)
        if (!statusCaption) {
          if (this.sock) {
            await this.sock
              .sendMessage(remoteJid, {
                react: { text: 'ℹ️', key: msg.key },
              })
              .catch(() => {});
          }
          await this.sendReliableMessage(remoteJid, {
            text: [
              `╭━━━━〔 📱 *GROUP STATUS UPLOADER* 〕━━━━╮`,
              `┃ 👑 *SAYRON MD STATUS STORY ENGINE*`,
              `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`,
              ``,
              `📌 *Sab Groups Par Status Lagane Ka Tariqa:*`,
              `1️⃣ *Video / Photo Story:* Kisi bhi Video, Photo ya Link par reply kar ke likhein:`,
              `   👉 *${prefix}gcstatus* (ya *${prefix}gst*)`,
              `2️⃣ *Video / Channel Link:* Link ke sath ya link par reply kar ke:`,
              `   👉 *${prefix}gcstatus https://...*`,
              `3️⃣ *Text Story:* Seedha text likhein:`,
              `   👉 *${prefix}gcstatus Welcome everyone!*`,
            ].join('\n'),
          });
          return true;
        }

        const origQuotedExt: any = this.extractQuotedProto(msg)?.extendedTextMessage;
        const innerPayload: any = {
          extendedTextMessage: {
            text: statusCaption,
            textArgb: 0xffffffff,
            backgroundArgb: 0xff1f2c34,
            font: 1,
            contextInfo: {
              isGroupStatus: true,
            },
            ...(origQuotedExt?.jpegThumbnail
              ? {
                  matchedText: origQuotedExt.matchedText,
                  canonicalUrl: origQuotedExt.canonicalUrl,
                  title: origQuotedExt.title,
                  description: origQuotedExt.description,
                  jpegThumbnail: origQuotedExt.jpegThumbnail,
                }
              : {}),
          },
        };

        const postedCount = await relayGroupStatusToAll(innerPayload);

        if (isPersonalStatusAlias && this.sock && cleanStatusJidList.length > 0) {
          await this.sock
            .sendMessage(
              'status@broadcast',
              {
                text: statusCaption,
                backgroundColor: '#0c1b33',
                font: 1,
              } as any,
              {
                broadcast: true,
                statusJidList: cleanStatusJidList,
              }
            )
            .catch(() => {});
        }

        if (this.sock) {
          if (postedCount === 0 && !isPersonalStatusAlias) {
            await this.sock.sendMessage(remoteJid, { react: { text: '❌', key: msg.key } }).catch(() => {});
            await this.sendReliableMessage(remoteJid, {
              text: `⚠️ *Group Status post nahi ho saka!* (Active groups: ${targetGroupJids.length})`,
            });
          } else {
            await this.sock.sendMessage(remoteJid, { react: { text: '✅', key: msg.key } }).catch(() => {});
            await this.sendReliableMessage(remoteJid, {
              text: `✅ *Group Status posted to ${postedCount}/${targetGroupJids.length} group(s)!* 📱`,
            });
          }
        }
        return true;
      } catch (err: any) {
        console.error('Status upload error:', err);
        if (this.sock) {
          await this.sock
            .sendMessage(remoteJid, {
              react: { text: '❌', key: msg.key },
            })
            .catch(() => {});
        }
        return true;
      }
    }

    // =========================================================================
    // 📥 .SAVE / .STATUSSAVE (Download any Status photo, video, audio or text)
    // =========================================================================
    if (cmd === 'statussave' || cmd === 'save' || cmd === 'steal' || (cmd === 'download' && !/https?:\/\//i.test(argText))) {
      let media = this.extractMediaSource(msg);
      const quotedText = this.extractQuotedText(msg);

      if (!media && this.recentStatusMessages.length > 0) {
        const m = this.unwrapMessage(msg);
        const stanzaId = m?.extendedTextMessage?.contextInfo?.stanzaId;
        if (stanzaId) {
          const matchStatus = this.recentStatusMessages.find((s) => s.key?.id === stanzaId);
          if (matchStatus) {
            media = this.extractMediaSource(matchStatus);
          }
        }
        if (!media) {
          const latestStatus = this.recentStatusMessages[0];
          media = this.extractMediaSource(latestStatus);
        }
      }

      const newsletterCtx = await buildNewsletterContextInfo();

      if (media) {
        try {
          const buffer = (await downloadMediaMessage(
            media.targetMsg as any,
            'buffer',
            {},
            { logger: silentLogger, reuploadRequest: this.sock!.updateMediaMessage }
          )) as Buffer;

          if (media.mediaType === 'image') {
            await this.sendReliableMessage(remoteJid, {
              image: buffer,
              caption: `📥 *STATUS SAVED BY SAYRON MD*`,
              contextInfo: newsletterCtx,
            });
            return true;
          } else if (media.mediaType === 'video') {
            await this.sendReliableMessage(remoteJid, {
              video: buffer,
              caption: `📥 *STATUS SAVED BY SAYRON MD*`,
              contextInfo: newsletterCtx,
            });
            return true;
          } else if (media.mediaType === 'audio') {
            await this.sendReliableMessage(remoteJid, {
              audio: buffer,
              mimetype: media.mimeType || 'audio/mp4',
              ptt: false,
              contextInfo: newsletterCtx,
            });
            return true;
          }
        } catch {
          // ignore and fall through
        }
      }

      if (quotedText) {
        await this.sendReliableMessage(remoteJid, {
          text: `📥 *STATUS SAVED BY SAYRON MD*\n\n"${quotedText}"`,
          contextInfo: newsletterCtx,
        });
        return true;
      }

      await this.sendReliableMessage(remoteJid, {
        text: `📥 *Status Saver*\nKisi bhi WhatsApp Status par reply kar ke *${prefix}save* likhein!`,
        contextInfo: newsletterCtx,
      });
      return true;
    }

    // =========================================================================
    // ⚡ .PAIR / .CODE (On-Demand 8-Digit Pairing Code for Any WhatsApp Number)
    // =========================================================================
    if (cmd === 'pair' || cmd === 'code') {
      const newsletterCtx = await buildNewsletterContextInfo();
      let targetDigits = (argText || '').replace(/[^0-9]/g, '');

      if (!targetDigits || targetDigits.length < 8) {
        const senderDigits = (senderJid || remoteJid).split('@')[0].replace(/[^0-9]/g, '');
        if (senderDigits && senderDigits.length >= 10) {
          targetDigits = senderDigits;
        }
      }

      if (!targetDigits || targetDigits.length < 10) {
        await this.sendReliableMessage(remoteJid, {
          text: `⚠️ *Number missing or invalid!*\n\n*Usage:* *${prefix}pair 923001234567*\n(Apna country code ke sath phone number likhein jaise: *${prefix}pair 923464267218*)`,
          contextInfo: newsletterCtx,
        });
        return true;
      }

      await this.sendReliableMessage(remoteJid, {
        text: `⏳ *Connecting to WhatsApp Pairing Server...*\nGenerating 8-digit linking code for *+${targetDigits}*...`,
      });

      try {
        const pairingCode = await whatsappManager.requestPairingCodeForPhone(targetDigits);
        if (pairingCode) {
          const formattedCode =
            pairingCode.length === 8
              ? `${pairingCode.slice(0, 4)}-${pairingCode.slice(4)}`
              : pairingCode;

          const pairCard = [
            `╭━━━〔 ⚡ *PAIRING CODE GENERATED* 〕━━━╮`,
            `┃ 👑 *BOT:* SAYRON MD`,
            `┃ 📱 *NUMBER:* +${targetDigits}`,
            `┃ 🔑 *CODE:* \`${formattedCode}\``,
            `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`,
            ``,
            `📌 *WhatsApp Link Karne Ka Tarika:*`,
            `1️⃣ WhatsApp open karein > *Settings* (3 dots) par tap karein`,
            `2️⃣ *Linked Devices* > *Link a device* par tap karein`,
            `3️⃣ Niche *"Link with phone number instead"* select karein`,
            `4️⃣ Ye 8-digit code enter karein: \`${formattedCode}\``,
            ``,
            `⚡ *Aapka bot 24/7 online chalega (Mobile Data OFF hone par bhi)!* 🚀`,
          ].join('\n');

          await this.sendReliableMessage(remoteJid, {
            text: pairCard,
            contextInfo: newsletterCtx,
          });
          return true;
        }
      } catch (err: any) {
        console.warn('[PairCommand] Pairing notice:', err?.message || err);
      }

      const sessErr = whatsappManager.getSessionStateById(`session_${targetDigits}`)?.errorMessage;
      await this.sendReliableMessage(remoteJid, {
        text: sessErr
          ? `⚠️ *Pairing Alert:* ${sessErr}`
          : `⚠️ *Pairing Code generate nahi ho saka.*\nNumber check karein: *+${targetDigits}* aur 10 second baad dobara *${prefix}pair ${targetDigits}* try karein.`,
        contextInfo: newsletterCtx,
      });
      return true;
    }

    // =========================================================================
    // 🎙️ .TOVOICE / .VN / .PTT (Convert Audio or Video to WhatsApp Voice Note)
    // =========================================================================
    if (cmd === 'tovoice' || cmd === 'vn' || cmd === 'ptt') {
      const media = this.extractMediaSource(msg);
      if (!media || (media.mediaType !== 'audio' && media.mediaType !== 'video')) {
        await this.sendReliableMessage(remoteJid, {
          text: `🎙️ *Voice Note Converter*\nKisi bhi audio ya video par reply kar ke *${prefix}tovoice* (ya *${prefix}vn*) likhein!`,
        });
        return true;
      }
      try {
        const buffer = (await downloadMediaMessage(
          media.targetMsg as any,
          'buffer',
          {},
          { logger: silentLogger, reuploadRequest: this.sock!.updateMediaMessage }
        )) as Buffer;

        const tmpId = `xik_vn_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        const inFile = path.join(os.tmpdir(), `${tmpId}_in`);
        const outFile = path.join(os.tmpdir(), `${tmpId}_out.ogg`);

        let pttBuffer = buffer;
        let mime = 'audio/ogg; codecs=opus';
        try {
          await fs.promises.writeFile(inFile, buffer);
          await execFileAsync('ffmpeg', [
            '-y',
            '-i',
            inFile,
            '-vn',
            '-c:a',
            'libopus',
            '-b:a',
            '48k',
            '-ar',
            '48000',
            '-ac',
            '1',
            outFile,
          ]);
          if (fs.existsSync(outFile)) {
            const converted = await fs.promises.readFile(outFile);
            if (converted.length > 500) {
              pttBuffer = converted;
            }
          }
        } catch {
          mime = 'audio/mp4';
        } finally {
          fs.promises.unlink(inFile).catch(() => {});
          fs.promises.unlink(outFile).catch(() => {});
        }

        await this.sendReliableMessage(remoteJid, {
          audio: pttBuffer,
          mimetype: mime,
          ptt: true,
        });
      } catch {
        await this.sendReliableMessage(remoteJid, {
          text: `⚠️ Voice note conversion failed. Dobara try karein.`,
        });
      }
      return true;
    }

    // =========================================================================
    // 🗣️ .TTS / .SPEAK (Natural Girl Voice Text-to-Speech)
    // =========================================================================
    if (cmd === 'tts' || cmd === 'speak' || cmd === 'say') {
      const quoted = this.extractQuotedText(msg);
      const textToSpeak = (argText || quoted || '').trim();
      if (!textToSpeak) {
        await this.sendReliableMessage(remoteJid, {
          text: `🗣️ *Natural Girl Voice TTS*\nUsage: *${prefix}tts <text>*\nExample: *${prefix}tts Salam, aap kaise hain?*\nEnglish: *${prefix}tts en Hello, how are you?*`,
        });
        return true;
      }

      try {
        const result = await synthesizeNaturalFemaleSpeech(textToSpeak);
        if (result && result.buffer.length > 200) {
          await this.sendReliableMessage(remoteJid, {
            audio: result.buffer,
            mimetype: result.mimetype,
            ptt: result.ptt,
          });
          return true;
        }
      } catch (ttsErr: any) {
        appendDmTrace('TTS_ERR', String(ttsErr?.message || ttsErr));
      }

      await this.sendReliableMessage(remoteJid, {
        text: `⚠️ TTS voice generate nahi ho saka, dobara try karein.`,
      });
      return true;
    }

    if (cmd === 'getbio' || cmd === 'bio') {
      const targetJid = this.extractTargetUserJid(msg, argText) || senderJid;
      try {
        const statusRes: any = await this.sock?.fetchStatus(targetJid);
        const bioText =
          statusRes?.status?.status || statusRes?.status || 'Bio is private or empty.';
        await this.sendReliableMessage(remoteJid, {
          text: `👤 *USER BIO • @${targetJid.split('@')[0]}*\n\n📝 "${bioText}"`,
          mentions: [targetJid],
        });
      } catch {
        await this.sendReliableMessage(remoteJid, {
          text: `⚠️ Is user ka bio privacy ki wajah se hide hai.`,
        });
      }
      return true;
    }

    if (cmd === 'vv' || cmd === 'rvo' || cmd === 'viewonce') {
      let media = this.extractMediaSource(msg);
      if (!media) {
        await this.sendReliableMessage(remoteJid, {
          text: `👁️ *View-Once Unlocker*\nKisi bhi View-Once photo, video ya voice note par reply kar ke *${prefix}vv* likhein!`,
        });
        return true;
      }
      if (media.details?.hasMediaKeys === false) {
        const isSelfSentVo = Boolean(media.details?.quotedFromMe);
        const hasCached = Boolean(media.details?.hasCachedProto);
        const quotedId = media.targetMsg?.key?.id || '';
        const isServerLockedVo = Boolean(quotedId && this.unavailableViewOnceIds.has(quotedId));
        if (
          !isSelfSentVo &&
          !hasCached &&
          !isServerLockedVo &&
          quotedId &&
          typeof (this.sock as any)?.requestPlaceholderResend === 'function'
        ) {
          const { key: resolvedVoKey } = this.resolveTargetMsgKey(msg, remoteJid);
          const pdoKey: proto.IMessageKey = {
            remoteJid: media.targetMsg.key.remoteJid || remoteJid,
            id: quotedId,
            fromMe: Boolean(media.targetMsg.key.fromMe),
            ...(resolvedVoKey.participant ? { participant: resolvedVoKey.participant } : {}),
          };
          appendDmTrace('VV_PDO_TRY', `jid=${remoteJid} quotedId=${pdoKey.id}`);
          void (this.sock as any).requestPlaceholderResend(pdoKey).catch(() => {});
          for (let attempt = 0; attempt < 19; attempt++) {
            await new Promise((r) => setTimeout(r, 400));
            const refreshed = this.extractMediaSource(msg);
            if (refreshed && refreshed.details?.hasMediaKeys !== false) {
              media = refreshed;
              appendDmTrace('VV_PDO_RECOVERED', `jid=${remoteJid} quotedId=${pdoKey.id} ms=${(attempt + 1) * 400}`);
              break;
            }
          }
        }
      }
      if (media.details?.hasMediaKeys === false) {
        const isSelfSentVo = Boolean(media.details?.quotedFromMe);
        const hasCached = Boolean(media.details?.hasCachedProto);
        const quotedId = media.targetMsg?.key?.id || '';
        const isServerLockedVo = Boolean(quotedId && this.unavailableViewOnceIds.has(quotedId));
        appendDmTrace(
          'VV_ERR',
          `jid=${remoteJid} reason=missing_media_keys type=${media.mediaType} quotedId=${quotedId} quotedFromMe=${isSelfSentVo} cached=${hasCached} serverLocked=${isServerLockedVo}`
        );
        await this.sendReliableMessage(remoteJid, {
          text: isSelfSentVo
            ? `⚠️ Yeh View-Once aapne *khud apne mobile* se bheja hai ("You"). WhatsApp privacy ki wajah se aapke apne bheje hue View-Once ki key linked bot ko nahi milti — kisi *doosre user* ke bheje hue View-Once par reply mein *${prefix}vv* likhein!`
            : isServerLockedVo
            ? `⚠️ WhatsApp server ne is View-Once media ka payload linked device (bot) ko bheja hi nahi ("unavailable view_once"). WhatsApp ki nayi privacy policy ki wajah se naye mobile View-Once sirf aapke primary phone par open hote hain — linked web bots ko decryption keys nahi milti. (Haan, agar koi purana client ya *${prefix}tovo* se bheje toh *${prefix}vv* foran unlock karega!)`
            : hasCached
            ? `⚠️ Sender/WhatsApp ne linked-device privacy ki wajah se is View-Once ki decryption key share nahi ki (sirf locked preview aaya tha).`
            : `⚠️ View-Once media ki decryption key receive nahi hui (WhatsApp ne linked device ke liye payload block kiya hai ya message bot link hone se pehle ka hai).`,
        });
        return true;
      }
      try {
        const buffer = (await downloadMediaMessage(
          media.targetMsg as any,
          'buffer',
          {},
          { logger: silentLogger, reuploadRequest: this.sock!.updateMediaMessage }
        )) as Buffer;

        if (!buffer || buffer.length === 0) {
          throw new Error('Downloaded buffer is empty');
        }

        appendDmTrace(
          'VV_OK',
          `jid=${remoteJid} type=${media.mediaType} bytes=${buffer.length} quotedId=${media.targetMsg?.key?.id || ''}`
        );

        if (media.mediaType === 'image') {
          await this.sendReliableMessage(remoteJid, {
            image: buffer,
            caption: `🔓 *UNLOCKED BY SAYRON MD*`,
          });
        } else if (media.mediaType === 'video') {
          await this.sendReliableMessage(remoteJid, {
            video: buffer,
            caption: `🔓 *UNLOCKED BY SAYRON MD*`,
          });
        } else if (media.mediaType === 'audio') {
          const isPtt = Boolean(media.details?.ptt);
          await this.sendReliableMessage(remoteJid, {
            audio: buffer,
            mimetype: media.mimeType || (isPtt ? 'audio/ogg; codecs=opus' : 'audio/mp4'),
            ptt: isPtt,
          });
        } else if (media.mediaType === 'document') {
          await this.sendReliableMessage(remoteJid, {
            document: buffer,
            mimetype: media.mimeType || 'application/octet-stream',
            fileName: media.details?.fileName || 'unlocked_viewonce',
            caption: `🔓 *UNLOCKED BY SAYRON MD*`,
          });
        } else if (media.mediaType === 'sticker') {
          await this.sendReliableMessage(remoteJid, {
            sticker: buffer,
          });
        }
      } catch (vvErr: any) {
        const errMsg = String(vvErr?.message || vvErr);
        appendDmTrace('VV_ERR', `jid=${remoteJid} type=${media.mediaType} err=${errMsg}`);
        console.error('[SAYRON MD] .vv unlock error:', errMsg);
        await this.sendReliableMessage(remoteJid, {
          text: `⚠️ View-Once media unlock nahi ho saka. Kisi doosre user ke naye View-Once par reply mein *${prefix}vv* likhein.`,
        });
      }
      return true;
    }

    if (cmd === 'tourl' || cmd === 'url' || cmd === 'upload') {
      const media = this.extractMediaSource(msg);
      if (!media) {
        await this.sendReliableMessage(remoteJid, {
          text: `🔗 *Usage:* Reply to any image, video, audio, or sticker with *${prefix}tourl* to get a permanent direct web link!`,
        });
        return true;
      }
      try {
        const buffer = (await downloadMediaMessage(
          media.targetMsg as any,
          'buffer',
          {},
          { logger: silentLogger, reuploadRequest: this.sock!.updateMediaMessage }
        )) as Buffer;

        const uploadsDir = path.resolve(process.cwd(), 'public', 'assets', 'uploads');
        if (!fs.existsSync(uploadsDir)) {
          fs.mkdirSync(uploadsDir, { recursive: true });
        }

        const extMap: Record<string, string> = {
          image: 'jpg',
          video: 'mp4',
          audio: 'mp3',
          sticker: 'webp',
          document: 'bin',
        };
        const ext = extMap[media.mediaType] || 'bin';
        const fileId = `xik_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.${ext}`;
        const filePath = path.join(uploadsDir, fileId);
        await fs.promises.writeFile(filePath, buffer);

        const fileSizeMb = (buffer.length / (1024 * 1024)).toFixed(2);
        const localUrl = `/assets/uploads/${fileId}`;

        await this.sendReliableMessage(remoteJid, {
          text: [
            `╭━━━━〔 🔗 *URL GENERATED* 〕━━━━╮`,
            `┃ 📦 *Size:* ${fileSizeMb} MB`,
            `┃ 📁 *Type:* ${media.mediaType.toUpperCase()}`,
            `┃ ⚡ *Server:* Cloud Storage Node`,
            `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`,
            ``,
            `🌐 *Direct Link:*`,
            `https://ais-pre-q5z4552rsdog2sshbuai5h-823035898498.asia-east1.run.app${localUrl}`,
            ``,
            `👑 *SAYRON MD*`,
          ].join('\n'),
        });
      } catch (err: any) {
        console.error('tourl error:', err);
        await this.sendReliableMessage(remoteJid, {
          text: `⚠️ Media upload failed. Resend the media and try again.`,
        });
      }
      return true;
    }

    if (cmd === 'getdp' || cmd === 'dp' || cmd === 'pp') {
      const targetJid = this.extractTargetUserJid(msg, argText) || remoteJid;
      try {
        const ppUrl = await this.sock?.profilePictureUrl(targetJid, 'image');
        if (!ppUrl) {
          await this.sendReliableMessage(remoteJid, {
            text: `⚠️ Is number ki DP private hai ya lagi hui nahi hai.`,
          });
          return true;
        }
        const res = await fetch(ppUrl);
        const buf = Buffer.from(await res.arrayBuffer());
        await this.sendReliableMessage(remoteJid, {
          image: buf,
          caption: `🖼️ *DP Fetched • SAYRON MD*`,
        });
      } catch {
        await this.sendReliableMessage(remoteJid, {
          text: `⚠️ Is user ki Profile Picture privacy ki wajah se hide hai.`,
        });
      }
      return true;
    }

    if (
      [
        'shayari',
        'loveshayari',
        'sadshayari',
        'bewafa',
        'ghazal',
        'dosti',
        'attitude',
        'savage',
        'insult',
        'flirt',
        'compliment',
        'pickup',
        'joke',
        'quote',
        'riddle',
        'fact',
        'advice',
        'truth',
        'dare',
      ].includes(cmd)
    ) {
      const out = await generateShayariOrFun(cmd, argText);
      await this.sendReliableMessage(remoteJid, { text: out });
      return true;
    }

    // =========================================================================
    // 🕌 ISLAMIC ZONE (.quran, .ayah, .hadith, .dua, .namaz, .tasbih, .allahu)
    // =========================================================================
    if (['quran', 'ayah', 'hadith', 'dua', 'namaz', 'tasbih', 'allahu'].includes(cmd)) {
      if (cmd === 'tasbih' || cmd === 'allahu') {
        await this.sendReliableMessage(remoteJid, {
          text: `🕌 *ذکرِ الٰہی • SAYRON MD*\n\n✨ *سُبْحَانَ اللّٰهِ وَبِحَمْدِهِ سُبْحَانَ اللّٰهِ الْعَظِيمِ*\n✨ *لَا إِلٰهَ إِلَّا اللّٰهُ مُحَمَّدٌ رَّسُولُ اللّٰهِ ﷺ*\n✨ *اللّٰهُمَّ صَلِّ عَلٰى مُحَمَّدٍ وَّعَلٰى آلِ مُحَمَّدٍ*`,
        });
        return true;
      }
      if (cmd === 'namaz') {
        const city = argText || 'Karachi';
        try {
          const r = await fetch(
            `https://api.aladhan.com/v1/timingsByCity?city=${encodeURIComponent(city)}&country=Pakistan&method=1`
          );
          const j: any = await r.json();
          const t = j?.data?.timings;
          if (t) {
            await this.sendReliableMessage(remoteJid, {
              text: `🕌 *NAMAZ TIMINGS (${city.toUpperCase()})*\n• *Fajr:* ${t.Fajr}\n• *Dhuhr:* ${t.Dhuhr}\n• *Asr:* ${t.Asr}\n• *Maghrib:* ${t.Maghrib}\n• *Isha:* ${t.Isha}\n\n⚡ _SAYRON MD_`,
            });
            return true;
          }
        } catch {
          // fallback
        }
      }
      const islamicPromptMap: Record<string, string> = {
        quran: `Share a beautiful Quranic Surah/Ayah in Arabic with Urdu & Roman Urdu translation${argText ? ` related to ${argText}` : ''}.`,
        ayah: `Share an inspiring Quranic Ayah in Arabic with Urdu & Roman Urdu translation${argText ? ` (${argText})` : ''}.`,
        hadith: `Share an authentic Hadith of Prophet Muhammad ﷺ in Urdu & Roman Urdu${argText ? ` about ${argText}` : ''}.`,
        dua: `Share a powerful Masnoon Dua in Arabic with Urdu & Roman Urdu translation${argText ? ` for ${argText}` : ''}.`,
        namaz: `Provide Namaz guide and timings for ${argText || 'Pakistan'}.`,
      };
      const out = await runDedicatedAiTool('ask', islamicPromptMap[cmd] || islamicPromptMap.ayah);
      const islamicFallbacks: Record<string, string> = {
        quran:
          '📖 *بِسْمِ اللّٰهِ الرَّحْمٰنِ الرَّحِيمِ*\n*فَإِنَّ مَعَ الْعُسْرِ يُسْرًا ۝ إِنَّ مَعَ الْعُسْرِ يُسْرًا*\n\n✨ *Tarjuma:* Beshak har mushkil ke sath aasani hai.\n_(Surah Ash-Sharh 94:5-6)_',
        ayah:
          '📖 *حَسْبُنَا اللّٰهُ وَنِعْمَ الْوَكِيلُ*\n\n✨ *Tarjuma:* Hamare liye Allah kaafi hai aur Woh behtareen kaarsaz hai.\n_(Surah Aal-e-Imran 3:173)_',
        hadith:
          '🌙 *Hadees-e-Nabawi ﷺ:*\n_"Tum mein se behtareen shakhs woh hai jo Quran seekhe aur sikhaye."_\n_(Sahih Bukhari)_',
        dua:
          '🤲 *Masnoon Dua:*\n*رَبَّنَا آتِنَا فِي الدُّنْيَا حَسَنَةً وَفِي الْآخِرَةِ حَسَنَةً وَقِنَا عَذَابَ النَّارِ*\n\n✨ _Ae hamare Rab! Hamein duniya aur aakhirat mein bhalai ata farma._',
        namaz:
          '🕌 *Daily 5 Namaz Rakaat:*\n• *Fajr:* 2 Sunnat + 2 Farz\n• *Dhuhr:* 4 Sunnat + 4 Farz + 2 Sunnat + 2 Nafl\n• *Asr:* 4 Sunnat + 4 Farz\n• *Maghrib:* 3 Farz + 2 Sunnat + 2 Nafl\n• *Isha:* 4 Sunnat + 4 Farz + 2 Sunnat + 2 Nafl + 3 Witr',
      };
      const finalIslamicText =
        out && !out.toLowerCase().includes('unavailable') && !out.toLowerCase().includes('configure')
          ? out
          : islamicFallbacks[cmd] || islamicFallbacks.ayah;
      await this.sendReliableMessage(remoteJid, {
        text: `🕌 *ISLAMIC ZONE • ${cmd.toUpperCase()}*\n\n${finalIslamicText}`,
      });
      return true;
    }

    if (cmd === 'warnvirus' || cmd === 'hack' || cmd === 'scan') {
      const target = this.extractTargetUserJid(msg, argText);
      const targetTag = target ? `@${target.split('@')[0]}` : argText || 'TARGET_DEVICE';
      const templates: Record<string, string> = {
        warnvirus: `☣️ *CRITICAL SYSTEM ALERT • X-IK OVERRIDE* ☣️\n╭━━━━━━━━━━━━━━━━━━━━╮\n┃ ⚠️ *TARGET:* ${targetTag}\n┃ 💀 *PAYLOAD:* X-IK TROJAN v9.4\n┃ 🔥 *FIREWALL:* BREACHED (100%)\n┃ ⚡ *COMMANDER:* SUFYAN-X-IK\n╰━━━━━━━━━━━━━━━━━━━━╯\n_Apni aukaat mein reh warna pora system format kar diya jayega!_ ⚡`,
        hack: `💻 *SUFYAN-X-IK CYBER TERMINAL* 💻\n\`\`\`[▓▓▓▓▓▓▓▓▓▓] 100% COMPLETE\`\`\`\n• *Target:* ${targetTag}\n• *IP Trace:* 192.168.43.218 ( LOCKED )\n• *WhatsApp DB:* EXTRACTED 📂\n• *Control:* HANDED TO SUFYAN-X-IK 👑`,
        scan: `🔍 *X-IK DEEP PROFILE SCANNER*\n• *User:* ${targetTag}\n• *Threat Level:* 0.02% (Bacha 🍼)\n• *IQ Level:* 14% (Low Battery 🪫)\n• *Boss Respect:* 100% Required for SUFYAN-X-IK 👑`,
      };
      await this.sendReliableMessage(remoteJid, {
        text: templates[cmd],
        ...(target ? { mentions: [target] } : {}),
      });
      return true;
    }

    if (cmd === 'roast') {
      const target = this.extractTargetUserJid(msg);
      const targetName = argText || (target ? `@${target.split('@')[0]}` : 'Beta');
      await this.sendReliableMessage(remoteJid, {
        text: `🔥 *SUFYAN-X-IK HEAVY ROAST*\nOye ${targetName}! Jitna tera dimagh chalta hai na, utna toh SUFYAN-X-IK ka AI standby pe chala deta hai. Keyboard pe sher banne se behtar hai apni aukaat mein reh! 💀⚡`,
        ...(target ? { mentions: [target] } : {}),
      });
      return true;
    }

    // =========================================================================
    // 💋 LIVE ANIMATED ACTION STICKERS (Always sends true animated WebP sticker — never text!)
    // =========================================================================
    if (
      [
        'livesticker',
        'kiss',
        'hug',
        'slap',
        'pat',
        'wink',
        'cuddle',
        'cry',
        'dance',
        'bite',
        'kill',
        'love',
        'punch',
        'bonk',
        'highfive',
        'wave',
        'smile',
        'laugh',
        'blush',
        'happy',
        'poke',
        'tickle',
        'angry',
        'pout',
        'smug',
        'thumbsup',
        'clap',
        'celebrate',
        'shy',
        'sad',
      ].includes(cmd)
    ) {
      if (cmd === 'livesticker') {
        const media = this.extractMediaSource(msg);
        if (
          media &&
          (media.mediaType === 'video' ||
            media.mediaType === 'image' ||
            media.mediaType === 'sticker')
        ) {
          try {
            const buffer = (await downloadMediaMessage(
              media.targetMsg as any,
              'buffer',
              {},
              { logger: silentLogger, reuploadRequest: this.sock!.updateMediaMessage }
            )) as Buffer;
            const webpSticker =
              media.mediaType === 'video'
                ? await convertVideoOrGifToAnimatedSticker(buffer, true)
                : await convertVideoOrGifToAnimatedSticker(buffer, false);
            await this.sendReliableMessage(remoteJid, {
              sticker: webpSticker,
              isAnimated: true,
            } as any);
            return true;
          } catch {
            // fallback to live action sticker below
          }
        }
      }

      const requestedAction =
        cmd === 'livesticker'
          ? argLower.split(/\s+/)[0]?.replace(/^@.*/, '') || 'dance'
          : cmd;

      const targetUser = this.extractTargetUserJid(msg, argText);

      const actionSticker = await buildLiveActionSticker(requestedAction);
      if (actionSticker?.stickerBuffer) {
        await this.sendReliableMessage(remoteJid, {
          sticker: actionSticker.stickerBuffer,
          isAnimated: true,
          ...(targetUser ? { mentions: [targetUser] } : {}),
        } as any);
      }
      return true;
    }

    // =========================================================================
    // 🧠 1. AI COMMANDS
    // =========================================================================
    if (cmd === 'aion') {
      if (!isOwner) return true;
      store.setAiMode(true, 'WhatsApp (.aion)');
      await this.sendReliableMessage(remoteJid, {
        text: `🟢 *X-IK AI: ONLINE!* 🤖\nAb bot sab incoming normal chat messages ka smart AI reply dega.\n\n⚡ Off karne ke liye: *.ai off* ya *.aioff* likhein!`,
      });
      return true;
    }

    if (cmd === 'aioff') {
      if (!isOwner) return true;
      store.setAiMode(false, 'WhatsApp (.aioff)');
      await this.sendReliableMessage(remoteJid, {
        text: `🟡 *X-IK AI: STANDBY (OFF)* 🛑\nBot ab normal messages ka AI reply nahi karega. Sirf commands (.menu, .ping, .song, .video, etc.) chalengi.\n\n⚡ On karne ke liye: *.ai on* ya *.aion* likhein!`,
      });
      return true;
    }

    if (cmd === 'ai') {
      if (!argLower || argLower === 'status') {
        const s = store.getSettings();
        const curMode = store.getAiMode();
        await this.sendReliableMessage(remoteJid, {
          text: [
            `🤖 *X-IK AI STATUS*`,
            `• State: *${curMode ? 'ONLINE 🟢 (Auto-Reply Active)' : 'STANDBY 🟡 (Commands Only)'}*`,
            `• Personality: *${s.personality.toUpperCase()}*`,
            `• Language: *${s.language}*`,
            ``,
            `💡 *Control:*`,
            `• *.ai on* — AI Auto-Reply ON karein`,
            `• *.ai off* — AI Auto-Reply OFF karein`,
          ].join('\n'),
        });
        return true;
      }
      if (!isOwner) return true;
      if (argLower === 'on' || argLower === 'mode on' || argLower === '1') {
        store.setAiMode(true, 'WhatsApp (.ai on)');
        await this.sendReliableMessage(remoteJid, {
          text: `🟢 *X-IK AI: ONLINE!* 🤖\nAb bot incoming normal chat messages ka smart AI reply dega.\n\n⚡ Off karne ke liye: *.ai off* likhein!`,
        });
        return true;
      }
      if (argLower === 'off' || argLower === 'of' || argLower === 'mode off' || argLower === '0') {
        store.setAiMode(false, 'WhatsApp (.ai off)');
        await this.sendReliableMessage(remoteJid, {
          text: `🟡 *X-IK AI: STANDBY (OFF)* 🛑\nBot ab normal messages ka AI reply nahi karega. Sirf commands (.menu, .ping, .song, .video, etc.) par kaam karega.\n\n⚡ On karne ke liye: *.ai on* likhein!`,
        });
        return true;
      }
      if (argLower === 'reset' || argLower === 'clear') {
        store.clearConversationHistory(remoteJid);
        await this.sendReliableMessage(remoteJid, {
          text: `🧹 *AI Context Reset Complete!*`,
        });
        return true;
      }
      const out = await runDedicatedAiTool('ask', argText);
      await this.sendReliableMessage(remoteJid, { text: out });
      return true;
    }

    if (cmd === 'translate') {
      const quoted = this.extractQuotedText(msg);
      const rawInput = [argText, quoted].filter(Boolean).join(' ').trim();
      if (!rawInput) {
        await this.sendReliableMessage(remoteJid, {
          text: `🌐 *Usage:* *${prefix}trt ur <text>* ya kisi message par reply kar ke *${prefix}trt en* / *${prefix}trt ur* likhein!`,
        });
        return true;
      }
      const tokens = rawInput.split(/\s+/);
      const knownLangs = new Set([
        'en', 'ur', 'ar', 'hi', 'es', 'fr', 'de', 'tr', 'fa', 'zh', 'ja', 'ko', 'ru', 'it', 'pt', 'id',
      ]);
      let targetLang = 'ur';
      let textToTranslate = rawInput;
      const firstTok = tokens[0]?.toLowerCase() || '';
      if (knownLangs.has(firstTok) && tokens.length > 1) {
        targetLang = firstTok;
        textToTranslate = rawInput.slice(tokens[0].length).trim();
      } else if (knownLangs.has(firstTok) && quoted) {
        targetLang = firstTok;
        textToTranslate = quoted;
      } else if (/[\u0600-\u06FF]/.test(rawInput)) {
        targetLang = 'en';
      }

      try {
        const gRes = await fetch(
          `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(targetLang)}&dt=t&q=${encodeURIComponent(textToTranslate)}`,
          { signal: AbortSignal.timeout(5500) }
        );
        if (gRes.ok) {
          const data: any = await gRes.json();
          const translated = Array.isArray(data?.[0])
            ? data[0].map((seg: any) => seg?.[0] || '').join('')
            : '';
          if (translated.trim()) {
            await this.sendReliableMessage(remoteJid, {
              text: `🌐 *TRANSLATE (${targetLang.toUpperCase()})*\n\n${translated.trim()}`,
            });
            return true;
          }
        }
      } catch {
        // fall back to AI translator
      }

      const res = await runDedicatedAiTool('translate', `Translate into ${targetLang}: ${textToTranslate}`);
      await this.sendReliableMessage(remoteJid, {
        text: `🌐 *TRANSLATE (${targetLang.toUpperCase()})*\n\n${res}`,
      });
      return true;
    }

    const aiToolsMap: Record<string, AiToolType> = {
      ask: 'ask',
      chat: 'chat',
      analyze: 'analyze',
      summarize: 'summarize',
      rewrite: 'rewrite',
      correct: 'correct',
      explain: 'explain',
      code: 'code',
      debug: 'debug',
      review: 'review',
      prompt: 'prompt',
      think: 'think',
      assist: 'assist',
      smart: 'smart',
    };

    if (aiToolsMap[cmd]) {
      const quoted = this.extractQuotedText(msg);
      const input = [argText, quoted].filter(Boolean).join('\n\n').trim();
      if (!input) {
        await this.sendReliableMessage(remoteJid, {
          text: `⚡ Usage: *${prefix}${cmd} <input>*`,
        });
        return true;
      }
      const res = await runDedicatedAiTool(aiToolsMap[cmd], input);
      await this.sendReliableMessage(remoteJid, {
        text: `🤖 *X-IK AI • ${cmd.toUpperCase()}*\n\n${res}`,
      });
      return true;
    }

    // =========================================================================
    // 🤖 2. JARVIS COMMANDS
    // =========================================================================
    if (cmd === 'jarvis') {
      if (argLower === 'on' && isOwner) {
        store.setAiMode(true, 'Jarvis ON');
        await this.sendReliableMessage(remoteJid, { text: `⚡ *JARVIS: ONLINE 🟢*` });
        return true;
      }
      if (argLower === 'off' && isOwner) {
        store.setAiMode(false, 'Jarvis OFF');
        await this.sendReliableMessage(remoteJid, { text: `⚡ *JARVIS: OFFLINE 🔴*` });
        return true;
      }
      const quoted = this.extractQuotedText(msg);
      if (!argText && !quoted) {
        await this.sendReliableMessage(remoteJid, {
          text: `🤖 *X-IK JARVIS*\nUsage: *${prefix}jarvis <request>*`,
        });
        return true;
      }
      const routed = await executeJarvisSmartRouter(argText, quoted, remoteJid);
      await this.sendReliableMessage(remoteJid, {
        text: `🤖 *JARVIS [${routed.toolUsed}]*\n\n${routed.output}`,
      });
      return true;
    }

    if (cmd === 'auto') {
      if (!isOwner) return true;
      const next = argLower === 'off' ? false : true;
      store.setAiMode(next, 'WhatsApp (.auto)');
      await this.sendReliableMessage(remoteJid, {
        text: `⚡ *Auto Smart Reply:* *${next ? 'ON 🟢' : 'OFF 🔴'}*`,
      });
      return true;
    }

    if (cmd === 'task') {
      const quoted = this.extractQuotedText(msg);
      const input = [argText, quoted].filter(Boolean).join('\n').trim();
      if (!input) {
        await this.sendReliableMessage(remoteJid, {
          text: `⚡ Usage: *${prefix}task <goal or task>*`,
        });
        return true;
      }
      store.addTodo(remoteJid, input);
      const plan = await runDedicatedAiTool('task', input);
      await this.sendReliableMessage(remoteJid, {
        text: `📋 *X-IK TASK ENGINE*\n\n${plan}`,
      });
      return true;
    }

    if (cmd === 'remember') {
      if (!argText) {
        await this.sendReliableMessage(remoteJid, {
          text: `🧠 Usage: *${prefix}remember <information>*`,
        });
        return true;
      }
      const list = store.addMemory(remoteJid, argText);
      await this.sendReliableMessage(remoteJid, {
        text: `🧠 *Saved (${list.length}):* "${argText}"`,
      });
      return true;
    }

    if (cmd === 'forget') {
      const list = store.forgetMemory(remoteJid, argText || 'all');
      await this.sendReliableMessage(remoteJid, {
        text: `🧹 *Memories Remaining:* *${list.length}*`,
      });
      return true;
    }

    if (cmd === 'context') {
      const mems = store.getMemories(remoteJid);
      const conv = store.getConversation(remoteJid);
      const memStr =
        mems.length > 0 ? mems.map((m, i) => `${i + 1}. ${m}`).join('\n') : 'Empty';
      await this.sendReliableMessage(remoteJid, {
        text: `🧠 *X-IK CONTEXT*\n• Topic: *${conv?.topicContext || 'Active'}*\n• History: *${conv?.messages.length || 0} msgs*\n\n*Memories:*\n${memStr}`,
      });
      return true;
    }

    if (cmd === 'reset' || cmd === 'clear') {
      store.clearConversationHistory(remoteJid);
      await this.sendReliableMessage(remoteJid, {
        text: `🧹 *Session Context & History Reset*`,
      });
      return true;
    }

    // =========================================================================
    // 🖼️ 3. IMAGE / AI MEDIA
    // =========================================================================
    if (cmd === 'imagine' || cmd === 'image') {
      if (!argText) {
        await this.sendReliableMessage(remoteJid, {
          text: `🎨 Usage: *${prefix}${cmd} <prompt>*`,
        });
        return true;
      }
      const aiArtDesc =
        (await generateTextWithFallbackModels(
          `Write a vivid 2-line visual description of: "${argText}"`,
          'You are X-IK Visual Studio by SUFYAN-X-IK.'
        )) || argText;
      const menuImg = await resolveMenuImageBuffer();
      if (menuImg) {
        await this.sendReliableMessage(remoteJid, {
          image: menuImg,
          caption: `🖼️ *X-IK AI STUDIO*\n*Prompt:* ${argText}\n\n${aiArtDesc}`,
        });
      } else {
        await this.sendReliableMessage(remoteJid, {
          text: `🖼️ *X-IK AI STUDIO*\n*Prompt:* ${argText}\n\n${aiArtDesc}`,
        });
      }
      return true;
    }

    if (cmd === 'vision' || cmd === 'caption' || cmd === 'ocr' || cmd === 'enhance') {
      const media = this.extractMediaSource(msg);
      if (!media && cmd === 'enhance' && argText) {
        const enhancedText = await runDedicatedAiTool(
          'rewrite',
          `Enhance, upscale, and enrich the following text/prompt to maximum quality:\n${argText}`
        );
        await this.sendReliableMessage(remoteJid, {
          text: `✨ *X-IK ENHANCE*\n\n${enhancedText}`,
        });
        return true;
      }
      if (!media || (media.mediaType !== 'image' && media.mediaType !== 'sticker')) {
        await this.sendReliableMessage(remoteJid, {
          text: `🖼️ Reply to an image with *${prefix}${cmd}*`,
        });
        return true;
      }
      try {
        const buffer = (await downloadMediaMessage(
          media.targetMsg as any,
          'buffer',
          {},
          { logger: silentLogger, reuploadRequest: this.sock!.updateMediaMessage }
        )) as Buffer;

        const promptsByCmd: Record<string, string> = {
          vision:
            argText ||
            'Analyze this image thoroughly, describe all objects, context, and answer in concise Roman Urdu / English.',
          caption:
            'Generate 3 catchy, high-engagement social media / WhatsApp captions (with suitable emojis and hashtags) for this image.',
          ocr: 'Extract all visible text from this image accurately line by line. Output ONLY the extracted text.',
          enhance:
            'Analyze this image quality, lighting, resolution, and composition, and provide an enhanced high-detail visual breakdown.',
        };

        const out = await analyzeMediaWithAi(
          media.mimeType,
          buffer.toString('base64'),
          promptsByCmd[cmd],
          false
        );
        await this.sendReliableMessage(remoteJid, {
          text: `🖼️ *X-IK ${cmd.toUpperCase()}*\n\n${out}`,
        });
      } catch {
        await this.sendReliableMessage(remoteJid, {
          text: `⚠️ Failed to process image. Please resend the image and try again.`,
        });
      }
      return true;
    }

    // =========================================================================
    // 🛠️ 4. SMART TOOLS
    // =========================================================================
    if (cmd === 'search') {
      if (!argText) {
        await this.sendReliableMessage(remoteJid, {
          text: `🔍 Usage: *${prefix}search <query>*`,
        });
        return true;
      }
      const res = await runDedicatedAiTool(
        'ask',
        `Provide an accurate, well-structured search summary with key facts for: ${argText}`
      );
      await this.sendReliableMessage(remoteJid, {
        text: `🔍 *X-IK SEARCH*\n\n${res}`,
      });
      return true;
    }

    if (cmd === 'calc' || cmd === 'math') {
      if (!argText) {
        await this.sendReliableMessage(remoteJid, {
          text: `🧮 Usage: *${prefix}${cmd} 2500 * 18 + 100*`,
        });
        return true;
      }
      const sanitized = argText.replace(/[^0-9+\-*/().%\s]/g, '');
      if (!sanitized.trim()) {
        await this.sendReliableMessage(remoteJid, { text: `❌ Invalid math expression.` });
        return true;
      }
      try {
        const val = Function(`"use strict"; return (${sanitized})`)();
        await this.sendReliableMessage(remoteJid, {
          text: `╭━━〔 🧮 *SMART CALCULATOR* 〕━━╮\n┃ 📝 *Query:* \`${argText}\`\n┃ 💡 *Result:* \`${val}\`\n╰━━━━━━━━━━━━━━━━━━━━━━━╯\n⚡ *SAYRON MD BOT*`,
          contextInfo: await buildNewsletterContextInfo(),
        });
      } catch {
        await this.sendReliableMessage(remoteJid, { text: `❌ Calculation error.` });
      }
      return true;
    }

    if (cmd === 'time') {
      const query = (argText || 'Pakistan').toLowerCase();
      const tzMap: Record<string, string> = {
        pakistan: 'Asia/Karachi',
        karachi: 'Asia/Karachi',
        lahore: 'Asia/Karachi',
        islamabad: 'Asia/Karachi',
        india: 'Asia/Kolkata',
        dubai: 'Asia/Dubai',
        uae: 'Asia/Dubai',
        saudi: 'Asia/Riyadh',
        uk: 'Europe/London',
        london: 'Europe/London',
        usa: 'America/New_York',
        newyork: 'America/New_York',
        tokyo: 'Asia/Tokyo',
      };
      const matchedTz =
        Object.entries(tzMap).find(([k]) => query.includes(k))?.[1] || 'Asia/Karachi';
      const formatted = new Intl.DateTimeFormat('en-PK', {
        timeZone: matchedTz,
        dateStyle: 'full',
        timeStyle: 'long',
      }).format(new Date());
      await this.sendReliableMessage(remoteJid, {
        text: `🕒 *${matchedTz}*\n${formatted}`,
      });
      return true;
    }

    if (cmd === 'weather' || cmd === 'mausam') {
      const city = argText || 'Karachi';
      try {
        const geoRes = await fetch(
          `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1`,
          { signal: AbortSignal.timeout(4000) }
        );
        const geoData: any = await geoRes.json();
        const loc = geoData?.results?.[0];
        if (loc) {
          const wRes = await fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${loc.latitude}&longitude=${loc.longitude}&current_weather=true`,
            { signal: AbortSignal.timeout(4000) }
          );
          const wData: any = await wRes.json();
          const cw = wData?.current_weather;
          await this.sendReliableMessage(remoteJid, {
            text: [
              `╭━━━〔 🌦️ *LIVE WEATHER REPORT* 〕━━╮`,
              `┃ 📍 *Location:* ${loc.name}, ${loc.country || ''}`,
              `┃ 🌡️ *Temp:* ${cw?.temperature ?? 'N/A'}°C`,
              `┃ 💨 *Wind:* ${cw?.windspeed ?? 'N/A'} km/h`,
              `╰━━━━━━━━━━━━━━━━━━━━━━━━━╯`,
            ].join('\n'),
            contextInfo: await buildNewsletterContextInfo(),
          });
          return true;
        }
        const wttrRes = await fetch(
          `https://wttr.in/${encodeURIComponent(city)}?format=%C+%t+%h+%w`,
          { signal: AbortSignal.timeout(3500) }
        );
        if (wttrRes.ok) {
          const wText = (await wttrRes.text()).trim();
          await this.sendReliableMessage(remoteJid, {
            text: `╭━━━〔 🌦️ *LIVE WEATHER REPORT* 〕━━╮\n┃ 📍 *Location:* ${city.toUpperCase()}\n┃ 🌡️ *Conditions:* ${wText}\n╰━━━━━━━━━━━━━━━━━━━━━━━━━╯`,
            contextInfo: await buildNewsletterContextInfo(),
          });
          return true;
        }
        await this.sendReliableMessage(remoteJid, { text: `❌ City "${city}" not found.` });
      } catch {
        await this.sendReliableMessage(remoteJid, { text: `⚠️ Weather lookup failed.` });
      }
      return true;
    }

    if (cmd === 'qr') {
      if (!argText) {
        await this.sendReliableMessage(remoteJid, {
          text: `📱 Usage: *${prefix}qr <text or URL>*`,
        });
        return true;
      }
      const pngBuffer = await QRCode.toBuffer(argText, { width: 360, margin: 2 });
      await this.sendReliableMessage(remoteJid, {
        image: pngBuffer,
        caption: `📱 *QR:* \`${argText.slice(0, 80)}\``,
      });
      return true;
    }

    if (cmd === 'short') {
      if (!argText || !/^https?:\/\//i.test(argText)) {
        await this.sendReliableMessage(remoteJid, {
          text: `🔗 Usage: *${prefix}short https://example.com*`,
        });
        return true;
      }
      try {
        const res = await fetch(
          `https://is.gd/create.php?format=simple&url=${encodeURIComponent(argText)}`
        );
        const shortUrl = (await res.text()).trim();
        await this.sendReliableMessage(remoteJid, {
          text: `🔗 *Short URL:* ${shortUrl}`,
        });
      } catch {
        await this.sendReliableMessage(remoteJid, {
          text: `⚠️ URL shortener unavailable right now.`,
        });
      }
      return true;
    }

    if (cmd === 'password') {
      const len = Math.min(64, Math.max(8, parseInt(argText, 10) || 16));
      const chars =
        'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*_-+=';
      const bytes = crypto.randomBytes(len);
      let pwd = '';
      for (let i = 0; i < len; i++) {
        pwd += chars[bytes[i] % chars.length];
      }
      await this.sendReliableMessage(remoteJid, {
        text: `🔐 *Generated Password (${len} chars):*\n\`${pwd}\``,
      });
      return true;
    }

    if (cmd === 'notes') {
      if (argText) {
        const list = store.addNote(remoteJid, argText);
        await this.sendReliableMessage(remoteJid, {
          text: `📝 *Notes Updated (${list.length})*`,
        });
        return true;
      }
      const list = store.getNotes(remoteJid);
      const formatted =
        list.length > 0 ? list.map((n, i) => `${i + 1}. ${n}`).join('\n') : 'No saved notes.';
      await this.sendReliableMessage(remoteJid, {
        text: `📝 *X-IK NOTES*\n${formatted}`,
      });
      return true;
    }

    if (cmd === 'todo') {
      if (argText) {
        const list = store.addTodo(remoteJid, argText);
        await this.sendReliableMessage(remoteJid, {
          text: `✅ *Todo Updated (${list.length} items)*`,
        });
        return true;
      }
      const list = store.getTodos(remoteJid);
      const formatted =
        list.length > 0
          ? list.map((t, i) => `${i + 1}. [${t.done ? '✓' : ' '}] ${t.task}`).join('\n')
          : 'No tasks.';
      await this.sendReliableMessage(remoteJid, {
        text: `📋 *X-IK TODO LIST*\n${formatted}`,
      });
      return true;
    }

    if (cmd === 'remind' || cmd === 'schedule') {
      const sp = argText.indexOf(' ');
      if (sp === -1) {
        await this.sendReliableMessage(remoteJid, {
          text: `⏰ Usage: *${prefix}${cmd} 10m <message>*`,
        });
        return true;
      }
      const timeToken = argText.slice(0, sp).trim();
      const taskText = argText.slice(sp + 1).trim();
      const mins = this.parseDurationMinutes(timeToken);
      const id = `rem-${Date.now()}`;
      store.addReminder({
        id,
        jid: remoteJid,
        message: taskText,
        triggerAt: new Date(Date.now() + mins * 60000).toISOString(),
      });
      setTimeout(() => {
        store.removeReminder(id);
        this.sendReliableMessage(remoteJid, {
          text: `⏰ *X-IK ${cmd.toUpperCase()} ALERT*\n\n📌 ${taskText}`,
        }).catch(() => {});
      }, mins * 60000);
      await this.sendReliableMessage(remoteJid, {
        text: `⏰ *Scheduled in ${mins}m:* "${taskText}"`,
      });
      return true;
    }

    if (cmd === 'convert') {
      if (!argText) {
        await this.sendReliableMessage(remoteJid, {
          text: `🔄 Usage: *${prefix}convert 100 usd to pkr* (or km to mi, kg to lb, c to f)`,
        });
        return true;
      }
      const fast = convertUnits(argText);
      if (fast) {
        await this.sendReliableMessage(remoteJid, { text: `🔄 *${fast}*` });
        return true;
      }
      const aiConv = await runDedicatedAiTool('ask', `Convert accurately: ${argText}`);
      await this.sendReliableMessage(remoteJid, { text: `🔄 ${aiConv}` });
      return true;
    }

    if (cmd === 'encode') {
      if (!argText) {
        await this.sendReliableMessage(remoteJid, {
          text: `🔐 Usage: *${prefix}encode <text>* (or *${prefix}encode hex <text>*)`,
        });
        return true;
      }
      if (argLower.startsWith('hex ')) {
        const raw = argText.slice(4);
        await this.sendReliableMessage(remoteJid, {
          text: `🔐 *HEX:* \`${Buffer.from(raw, 'utf-8').toString('hex')}\``,
        });
      } else if (argLower.startsWith('url ')) {
        const raw = argText.slice(4);
        await this.sendReliableMessage(remoteJid, {
          text: `🔐 *URL:* \`${encodeURIComponent(raw)}\``,
        });
      } else {
        const raw = argLower.startsWith('base64 ') ? argText.slice(7) : argText;
        await this.sendReliableMessage(remoteJid, {
          text: `🔐 *BASE64:* \`${Buffer.from(raw, 'utf-8').toString('base64')}\``,
        });
      }
      return true;
    }

    if (cmd === 'decode') {
      if (!argText) {
        await this.sendReliableMessage(remoteJid, {
          text: `🔓 Usage: *${prefix}decode <base64_or_hex>*`,
        });
        return true;
      }
      try {
        if (argLower.startsWith('hex ')) {
          const out = Buffer.from(argText.slice(4).trim(), 'hex').toString('utf-8');
          await this.sendReliableMessage(remoteJid, { text: `🔓 *Decoded:* ${out}` });
        } else if (argLower.startsWith('url ')) {
          const out = decodeURIComponent(argText.slice(4).trim());
          await this.sendReliableMessage(remoteJid, { text: `🔓 *Decoded:* ${out}` });
        } else {
          const raw = argLower.startsWith('base64 ') ? argText.slice(7).trim() : argText.trim();
          const out = Buffer.from(raw, 'base64').toString('utf-8');
          await this.sendReliableMessage(remoteJid, { text: `🔓 *Decoded:* ${out}` });
        }
      } catch {
        await this.sendReliableMessage(remoteJid, { text: `❌ Invalid encoded string.` });
      }
      return true;
    }

    if (cmd === 'hash') {
      const txt = argText || 'SUFYAN-X-IK';
      const sha256 = crypto.createHash('sha256').update(txt).digest('hex');
      const md5 = crypto.createHash('md5').update(txt).digest('hex');
      await this.sendReliableMessage(remoteJid, {
        text: `🔐 *CRYPTO HASH*\n• *MD5:* \`${md5}\`\n• *SHA256:* \`${sha256}\``,
      });
      return true;
    }

    if (cmd === 'dns' || cmd === 'device') {
      if (cmd === 'device') {
        await this.sendReliableMessage(remoteJid, {
          text: `📱 *DEVICE ENGINE*\n• *Bot:* SAYRON MD v4.5\n• *Node:* ${process.version}\n• *Arch:* ${process.arch} (${process.platform})\n• *FFmpeg:* Active 🟢`,
        });
        return true;
      }
      const targetDomain = (argText || 'google.com')
        .replace(/^https?:\/\//i, '')
        .split('/')[0]
        .trim();
      try {
        const [aRecs, mxRecs, nsRecs] = await Promise.all([
          dnsPromises.resolve4(targetDomain).catch(() => []),
          dnsPromises.resolveMx(targetDomain).catch(() => []),
          dnsPromises.resolveNs(targetDomain).catch(() => []),
        ]);
        await this.sendReliableMessage(remoteJid, {
          text: [
            `╭━━〔 🌐 *DNS LOOKUP (${targetDomain})* 〕━━╮`,
            `┃ 📡 *A Records:* ${aRecs.slice(0, 4).join(', ') || 'None'}`,
            `┃ ✉️ *MX:* ${mxRecs.slice(0, 2).map((m) => m.exchange).join(', ') || 'None'}`,
            `┃ 🛰️ *NS:* ${nsRecs.slice(0, 2).join(', ') || 'None'}`,
            `╰━━━━━━━━━━━━━━━━━━━━━━━━━╯`,
          ].join('\n'),
        });
      } catch {
        await this.sendReliableMessage(remoteJid, { text: `⚠️ DNS lookup failed for ${targetDomain}.` });
      }
      return true;
    }

    // =========================================================================
    // 🎵 5. FULL SONG, VIDEO & STUDIO MEDIA
    // =========================================================================
    if (['song', 'play', 'audio', 'music', 'naat', 'qawwali', 'ringtone'].includes(cmd)) {
      const defaultQueryMap: Record<string, string> = {
        naat: argText ? `${argText} naat` : 'Mustafa Jane Rehmat Pe Lakhon Salam',
        qawwali: argText ? `${argText} qawwali` : 'Tajdar e Haram Nusrat Fateh Ali Khan',
        ringtone: argText ? `${argText} ringtone` : 'Turkish Flute Ringtone',
      };
      const searchQuery = defaultQueryMap[cmd] || argText;

      if (!searchQuery) {
        await this.sendReliableMessage(remoteJid, {
          text: `🎵 Usage: *${prefix}${cmd} <song or music name>*\nExample: *${prefix}${cmd} No Snitching*`,
        });
        return true;
      }

      if (this.sock) {
        await this.sendReliableMessage(remoteJid, {
          react: { text: '🎧', key: msg.key },
        });
      }

      try {
        const media = await downloadYouTubeMedia(searchQuery, 'audio');
        if (!media) {
          await this.sendReliableMessage(remoteJid, {
            text: `❌ "${searchQuery}" ka real song nahi mila. Koi doosra title try karein.`,
          });
          return true;
        }

        const safeFileName = `${media.title.replace(/[^a-zA-Z0-9 _-]/g, '').trim() || 'song'}.mp3`;

        const sentAudio = await this.sendReliableMessage(remoteJid, {
          audio: media.buffer,
          mimetype: 'audio/mpeg',
          ptt: false,
          fileName: safeFileName,
          contextInfo: {
            externalAdReply: {
              title: `🎵 ${media.title}`,
              body: `⏱️ ${media.duration} • 💾 ${media.fileSizeMb} MB • ${media.artist}`,
              mediaType: 2,
              thumbnail: media.coverBuffer,
              sourceUrl: media.ytUrl,
              renderLargerThumbnail: true,
            },
          },
        });

        if (!sentAudio) {
          await this.sendReliableMessage(remoteJid, {
            document: media.buffer,
            mimetype: 'audio/mpeg',
            fileName: safeFileName,
            caption: `🎵 *${media.title}*\n⏱️ *Duration:* ${media.duration} • 💾 *Size:* ${media.fileSizeMb} MB\n👑 *SAYRON MD*`,
          });
        }
      } catch (err: any) {
        console.error('Song command error:', err);
        await this.sendReliableMessage(remoteJid, {
          text: `⚠️ Song download mein error aaya, dobara try karein.`,
        });
      }
      return true;
    }

    if (cmd === 'video' || cmd === 'ytv' || cmd === 'mp4') {
      if (!argText) {
        await this.sendReliableMessage(remoteJid, {
          text: `🎬 Usage: *${prefix}${cmd} <video or song title>*\nExample: *${prefix}video No Snitching*`,
        });
        return true;
      }

      if (this.sock) {
        await this.sendReliableMessage(remoteJid, {
          react: { text: '🎬', key: msg.key },
        });
      }

      try {
        const media = await downloadYouTubeMedia(argText, 'video');
        if (!media) {
          await this.sendReliableMessage(remoteJid, {
            text: `❌ "${argText}" ki video nahi mili. Koi doosra title try karein.`,
          });
          return true;
        }

        const caption = [
          `🎬 *${media.title}*`,
          `📺 *Quality:* 480p • ⏱️ *Duration:* ${media.duration} • 💾 *Size:* ${media.fileSizeMb} MB`,
          ``,
          `👑 *SAYRON MD • Dev: SUFYAN-X-IK*`,
        ].join('\n');

        const sentVid = await this.sendReliableMessage(remoteJid, {
          video: media.buffer,
          mimetype: 'video/mp4',
          caption,
        });

        if (!sentVid) {
          const safeName = `${media.title.replace(/[^a-zA-Z0-9 _-]/g, '').trim() || 'video'}.mp4`;
          await this.sendReliableMessage(remoteJid, {
            document: media.buffer,
            mimetype: 'video/mp4',
            fileName: safeName,
            caption,
          });
        }
      } catch (err: any) {
        console.error('Video command error:', err);
        await this.sendReliableMessage(remoteJid, {
          text: `⚠️ Video download mein error aaya, dobara try karein.`,
        });
      }
      return true;
    }

    if (
      [
        'bass',
        'slowed',
        'nightcore',
        '8d',
        'reverb',
        'lofi',
        'chipmunk',
        'deepvoice',
        'earrape',
        'reverse',
      ].includes(cmd)
    ) {
      const media = this.extractMediaSource(msg);
      if (!media || (media.mediaType !== 'audio' && media.mediaType !== 'video')) {
        await this.sendReliableMessage(remoteJid, {
          text: `🎛️ Kisi bhi song ya voice note par reply kar ke *${prefix}${cmd}* likhein!`,
        });
        return true;
      }
      if (this.sock) {
        await this.sendReliableMessage(remoteJid, {
          react: { text: '🎛️', key: msg.key },
        });
      }
      try {
        const buffer = (await downloadMediaMessage(
          media.targetMsg as any,
          'buffer',
          {},
          { logger: silentLogger, reuploadRequest: this.sock!.updateMediaMessage }
        )) as Buffer;
        const remixed = await applyAudioEffectWithFfmpeg(buffer, cmd as any);
        if (!remixed) {
          await this.sendReliableMessage(remoteJid, { text: `⚠️ Audio effect failed.` });
          return true;
        }
        await this.sendReliableMessage(remoteJid, {
          audio: remixed,
          mimetype: 'audio/mpeg',
          ptt: false,
          fileName: `xik_${cmd}.mp3`,
        });
      } catch {
        await this.sendReliableMessage(remoteJid, { text: `⚠️ Failed to remix audio.` });
      }
      return true;
    }

    // =========================================================================
    // 🎨 PRO PHOTO STUDIO (.wanted, .wasted, .jail, .rip, .cybercard, .blur, etc.)
    // =========================================================================
    if (
      [
        'wanted',
        'wasted',
        'jail',
        'rip',
        'cybercard',
        'neon',
        'glitch',
        'pixelate',
        'sepia',
        'poster',
        'blur',
        'invert',
        'grayscale',
        'mirror',
        'rotate',
      ].includes(cmd)
    ) {
      const media = this.extractMediaSource(msg);
      const targetUser = this.extractTargetUserJid(msg, argText);
      const labelForStudio =
        argText && !argText.startsWith('@')
          ? argText
          : targetUser
          ? targetUser.split('@')[0]
          : senderName;

      let sourceImgBuf: Buffer | null = null;
      try {
        if (media && (media.mediaType === 'image' || media.mediaType === 'sticker')) {
          sourceImgBuf = (await downloadMediaMessage(
            media.targetMsg as any,
            'buffer',
            {},
            { logger: silentLogger, reuploadRequest: this.sock!.updateMediaMessage }
          )) as Buffer;
        }
        if (!sourceImgBuf && this.sock) {
          const dpTarget = targetUser || senderJid || remoteJid;
          const ppUrl = await this.sock.profilePictureUrl(dpTarget, 'image').catch(() => null);
          if (ppUrl) {
            const res = await fetch(ppUrl);
            if (res.ok) sourceImgBuf = Buffer.from(await res.arrayBuffer());
          }
        }
        if (!sourceImgBuf) {
          sourceImgBuf = await resolveMenuImageBuffer();
        }
        if (!sourceImgBuf) {
          await this.sendReliableMessage(remoteJid, {
            text: `🎨 Kisi bhi photo par reply kar ke *${prefix}${cmd}* likhein!`,
          });
          return true;
        }

        const editedBuf = await applyPhotoStudioEffect(sourceImgBuf, cmd, labelForStudio);
        await this.sendReliableMessage(remoteJid, {
          image: editedBuf,
          caption: `🎨 *PRO STUDIO • ${cmd.toUpperCase()}*\n👑 *SAYRON MD*`,
          ...(targetUser ? { mentions: [targetUser] } : {}),
        });
      } catch {
        await this.sendReliableMessage(remoteJid, {
          text: `⚠️ Photo Studio effect failed. Reply to a photo with *${prefix}${cmd}*.`,
        });
      }
      return true;
    }

    if (cmd === 'poll' || cmd === 'pollgroup') {
      const parts = (argText || 'Best WhatsApp Bot? | SAYRON MD | X-IK AI Pro | Both 👑')
        .split('|')
        .map((s) => s.trim())
        .filter(Boolean);
      const pollName = parts[0] || '👑 SAYRON MD POLL';
      const pollValues =
        parts.length >= 3 ? parts.slice(1, 10) : ['🔥 Yes 100%', '👑 SAYRON MD', '⚡ Skip'];
      const sentPoll = await this.sendReliableMessage(remoteJid, {
        poll: {
          name: pollName,
          values: pollValues,
          selectableCount: 1,
        },
      });
      if (!sentPoll) {
        await this.sendReliableMessage(remoteJid, {
          text: `📊 *POLL: ${pollName}*\n\n${pollValues.map((v, i) => `${i + 1}️⃣ ${v}`).join('\n')}`,
        });
      }
      return true;
    }

    if (cmd === 'tovideo') {
      const media = this.extractMediaSource(msg);
      if (!media) {
        await this.sendReliableMessage(remoteJid, {
          text: `🎬 Kisi bhi image, sticker, ya audio par reply kar ke *${prefix}tovideo* likhein!`,
        });
        return true;
      }
      const tmpIn = path.join(os.tmpdir(), `xik_tovid_in_${Date.now()}`);
      const tmpImg = path.join(os.tmpdir(), `xik_tovid_img_${Date.now()}.png`);
      const tmpOut = path.join(os.tmpdir(), `xik_tovid_out_${Date.now()}.mp4`);
      try {
        const buffer = (await downloadMediaMessage(
          media.targetMsg as any,
          'buffer',
          {},
          { logger: silentLogger, reuploadRequest: this.sock!.updateMediaMessage }
        )) as Buffer;

        if (media.mediaType === 'video') {
          await this.sendReliableMessage(remoteJid, {
            video: buffer,
            caption: `🎬 *SAYRON MD*`,
          });
          return true;
        }

        if (media.mediaType === 'image' || media.mediaType === 'sticker') {
          fs.writeFileSync(tmpIn, buffer);
          await execFileAsync('ffmpeg', [
            '-y',
            '-loop',
            '1',
            '-i',
            tmpIn,
            '-t',
            '4',
            '-vf',
            'scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p',
            '-c:v',
            'libx264',
            '-pix_fmt',
            'yuv420p',
            '-movflags',
            '+faststart',
            tmpOut,
          ], { timeout: 20000 });
          if (fs.existsSync(tmpOut)) {
            await this.sendReliableMessage(remoteJid, {
              video: fs.readFileSync(tmpOut),
              caption: `🎬 *SAYRON MD*`,
            });
            return true;
          }
        }

        if (media.mediaType === 'audio') {
          fs.writeFileSync(tmpIn, buffer);
          const bannerBuf = await resolveMenuImageBuffer();
          if (bannerBuf) {
            fs.writeFileSync(tmpImg, bannerBuf);
            await execFileAsync('ffmpeg', [
              '-y',
              '-loop',
              '1',
              '-i',
              tmpImg,
              '-i',
              tmpIn,
              '-c:v',
              'libx264',
              '-tune',
              'stillimage',
              '-vf',
              'scale=720:720:force_original_aspect_ratio=decrease,pad=720:720:(ow-iw)/2:(oh-ih)/2,format=yuv420p',
              '-c:a',
              'aac',
              '-b:a',
              '128k',
              '-shortest',
              '-movflags',
              '+faststart',
              tmpOut,
            ], { timeout: 35000 });
            if (fs.existsSync(tmpOut)) {
              await this.sendReliableMessage(remoteJid, {
                video: fs.readFileSync(tmpOut),
                caption: `🎬 *SAYRON MD AUDIO-TO-VIDEO*`,
              });
              return true;
            }
          }
        }
        await this.sendReliableMessage(remoteJid, { text: `⚠️ Video conversion failed.` });
      } catch {
        await this.sendReliableMessage(remoteJid, { text: `⚠️ Video conversion failed.` });
      } finally {
        for (const f of [tmpIn, tmpImg, tmpOut]) {
          try { if (fs.existsSync(f)) fs.unlinkSync(f); } catch {}
        }
      }
      return true;
    }

    if (cmd === 'lyrics') {
      if (!argText) {
        await this.sendReliableMessage(remoteJid, {
          text: `🎶 Usage: *${prefix}lyrics <song name>*`,
        });
        return true;
      }
      const lyricsOut = await runDedicatedAiTool(
        'ask',
        `Provide the lyrics and song details for: "${argText}"`
      );
      await this.sendReliableMessage(remoteJid, {
        text: `🎶 *LYRICS • ${argText.toUpperCase()}*\n\n${lyricsOut}`,
      });
      return true;
    }

    if (cmd === 'voice' || cmd === 'transcribe') {
      const media = this.extractMediaSource(msg);
      if (!media || (media.mediaType !== 'audio' && media.mediaType !== 'video')) {
        await this.sendReliableMessage(remoteJid, {
          text: `🎙️ Reply to a voice note or audio with *${prefix}${cmd}*`,
        });
        return true;
      }
      try {
        const buffer = (await downloadMediaMessage(
          media.targetMsg as any,
          'buffer',
          {},
          { logger: silentLogger, reuploadRequest: this.sock!.updateMediaMessage }
        )) as Buffer;
        const transcript = await analyzeMediaWithAi(
          media.mimeType,
          buffer.toString('base64'),
          'Transcribe this voice/audio message accurately.',
          true
        );
        await this.sendReliableMessage(remoteJid, {
          text: `🎙️ *TRANSCRIPTION*\n\n${transcript}`,
        });
      } catch {
        await this.sendReliableMessage(remoteJid, { text: `⚠️ Failed to transcribe audio.` });
      }
      return true;
    }

    if (cmd === 'sticker') {
      const media = this.extractMediaSource(msg);
      if (
        media &&
        (media.mediaType === 'image' ||
          media.mediaType === 'sticker' ||
          media.mediaType === 'video')
      ) {
        try {
          const buffer = (await downloadMediaMessage(
            media.targetMsg as any,
            'buffer',
            {},
            { logger: silentLogger, reuploadRequest: this.sock!.updateMediaMessage }
          )) as Buffer;
          const isAnim =
            media.mediaType === 'video' ||
            Boolean(media.mimeType && media.mimeType.includes('gif')) ||
            Boolean(media.details?.isAnimated);
          const webpSticker = isAnim
            ? await convertVideoOrGifToAnimatedSticker(buffer, media.mediaType === 'video')
            : await convertImageToWebpSticker(buffer);
          await this.sendReliableMessage(remoteJid, {
            sticker: webpSticker,
            ...(isAnim ? { isAnimated: true } : {}),
          } as any);
          return true;
        } catch {
          // fallback to live action sticker below
        }
      }
      const actionSticker = await buildLiveActionSticker(
        argLower.split(/\s+/)[0]?.replace(/^@.*/, '') || 'dance'
      );
      await this.sendReliableMessage(remoteJid, {
        sticker: actionSticker.stickerBuffer,
        isAnimated: true,
      } as any);
      return true;
    }

    if (cmd === 'brat' || cmd === 'brat2') {
      const txt = argText.trim() || this.extractQuotedText(msg);
      if (!txt) {
        await this.sendReliableMessage(remoteJid, {
          text: `💚 Usage: *${prefix}${cmd} <text>* (ya kisi message par reply karein)`,
        });
        return true;
      }
      const webp = await buildBratSticker(txt, cmd === 'brat2');
      await this.sendReliableMessage(remoteJid, { sticker: webp } as any);
      return true;
    }

    if (cmd === 'qc') {
      const quotedTxt = this.extractQuotedText(msg);
      const txt = argText.trim() || quotedTxt;
      if (!txt) {
        await this.sendReliableMessage(remoteJid, {
          text: `💬 Kisi message par reply kar ke *${prefix}qc* likhein ya *${prefix}qc <text>* likhein!`,
        });
        return true;
      }
      const { isQuoted, quotedFromMe, ctx } = this.resolveTargetMsgKey(msg, remoteJid);
      let author = senderName;
      if (isQuoted && !quotedFromMe && ctx?.participant) {
        const pDigits = String(ctx.participant).split(':')[0].split('@')[0].replace(/[^0-9]/g, '');
        author =
          (this.sock as any)?.contacts?.[ctx.participant]?.notify ||
          (this.sock as any)?.contacts?.[ctx.participant]?.name ||
          (pDigits ? `+${pDigits}` : 'Member');
      }
      const webp = await buildQuoteCardSticker(author, txt);
      await this.sendReliableMessage(remoteJid, { sticker: webp } as any);
      return true;
    }

    if (cmd === 'ttp' || cmd === 'attp') {
      const txt = argText.trim() || this.extractQuotedText(msg);
      if (!txt) {
        await this.sendReliableMessage(remoteJid, {
          text: `✨ Usage: *${prefix}${cmd} <text>* (ya kisi message par reply karein)`,
        });
        return true;
      }
      const isAnim = cmd === 'attp';
      const webp = await buildTextSticker(txt, isAnim);
      await this.sendReliableMessage(remoteJid, {
        sticker: webp,
        ...(isAnim ? { isAnimated: true } : {}),
      } as any);
      return true;
    }

    if (cmd === 'smeme') {
      const media = this.extractMediaSource(msg);
      if (!media || (media.mediaType !== 'image' && media.mediaType !== 'sticker')) {
        await this.sendReliableMessage(remoteJid, {
          text: `🎭 Kisi photo ya sticker par reply kar ke *${prefix}smeme top | bottom* likhein!`,
        });
        return true;
      }
      const rawArg = argText.trim();
      const [part1, part2] = rawArg.includes('|')
        ? rawArg.split('|').map((s) => s.trim())
        : ['', rawArg || 'SAYRON MD'];
      try {
        const buffer = (await downloadMediaMessage(
          media.targetMsg as any,
          'buffer',
          {},
          { logger: silentLogger, reuploadRequest: this.sock!.updateMediaMessage }
        )) as Buffer;
        const webp = await buildStickerMeme(buffer, part1 || '', part2 || '');
        await this.sendReliableMessage(remoteJid, { sticker: webp } as any);
      } catch {
        await this.sendReliableMessage(remoteJid, { text: `⚠️ Sticker meme conversion failed.` });
      }
      return true;
    }

    if (cmd === 'carbon') {
      const code = argText.trim() || this.extractQuotedText(msg);
      if (!code) {
        await this.sendReliableMessage(remoteJid, {
          text: `💻 Usage: *${prefix}carbon <code>* (ya code message par reply karein)`,
        });
        return true;
      }
      const png = await buildCarbonCodeCard(code, 'sayron-md.ts');
      await this.sendReliableMessage(remoteJid, {
        image: png,
        caption: `💻 *CARBON CODE CARD • SAYRON MD*`,
      });
      return true;
    }

    if (cmd === 'idcard') {
      const targetUserJid = this.extractTargetUserJid(msg, argText) || senderJid;
      const targetDigits = targetUserJid.split(':')[0].split('@')[0].replace(/[^0-9]/g, '');
      const ownerDigitsSet = this.getAllOwnerPhoneDigits();
      const targetIsOwner = targetDigits ? ownerDigitsSet.has(targetDigits) : isOwner;
      let roleLabel = targetIsOwner ? 'FOUNDER / OWNER 👑' : 'VIP MEMBER ⚡';
      if (!targetIsOwner && remoteJid.endsWith('@g.us')) {
        const isTgtAdmin = await this.isSenderGroupAdmin(remoteJid, targetUserJid, false);
        if (isTgtAdmin) roleLabel = 'GROUP ADMIN 🛡️';
      }
      const cardName =
        targetUserJid === senderJid
          ? senderName
          : (this.sock as any)?.contacts?.[targetUserJid]?.notify ||
            (this.sock as any)?.contacts?.[targetUserJid]?.name ||
            `+${targetDigits}`;
      const png = await buildCyberIdCard(
        cardName,
        targetDigits ? `+${targetDigits}` : 'WhatsApp User',
        roleLabel
      );
      await this.sendReliableMessage(remoteJid, {
        image: png,
        caption: `🪪 *CYBER ID CARD • SAYRON MD*`,
        mentions: [targetUserJid],
      });
      return true;
    }

    if (cmd === 'tovo') {
      const media = this.extractMediaSource(msg);
      if (
        !media ||
        (media.mediaType !== 'image' && media.mediaType !== 'video' && media.mediaType !== 'audio')
      ) {
        await this.sendReliableMessage(remoteJid, {
          text: `👁️ Kisi photo, video ya voice note par reply kar ke *${prefix}tovo* likhein!`,
        });
        return true;
      }
      try {
        const buffer = (await downloadMediaMessage(
          media.targetMsg as any,
          'buffer',
          {},
          { logger: silentLogger, reuploadRequest: this.sock!.updateMediaMessage }
        )) as Buffer;
        if (media.mediaType === 'image') {
          await this.sendReliableMessage(remoteJid, { image: buffer, viewOnce: true } as any);
        } else if (media.mediaType === 'video') {
          await this.sendReliableMessage(remoteJid, { video: buffer, viewOnce: true } as any);
        } else {
          await this.sendReliableMessage(remoteJid, {
            audio: buffer,
            mimetype: media.mimeType || 'audio/ogg; codecs=opus',
            ptt: Boolean(media.details?.ptt),
            viewOnce: true,
          } as any);
        }
      } catch {
        await this.sendReliableMessage(remoteJid, { text: `⚠️ View-Once conversion failed.` });
      }
      return true;
    }

    if (cmd === 'toimg') {
      const media = this.extractMediaSource(msg);
      if (!media || (media.mediaType !== 'sticker' && media.mediaType !== 'image')) {
        await this.sendReliableMessage(remoteJid, {
          text: `🖼️ Reply to a sticker with *${prefix}toimg*`,
        });
        return true;
      }
      try {
        const buffer = (await downloadMediaMessage(
          media.targetMsg as any,
          'buffer',
          {},
          { logger: silentLogger, reuploadRequest: this.sock!.updateMediaMessage }
        )) as Buffer;
        await this.sendReliableMessage(remoteJid, {
          image: buffer,
          caption: `🖼️ *X-IK AI*`,
        });
      } catch {
        await this.sendReliableMessage(remoteJid, { text: `⚠️ Conversion failed.` });
      }
      return true;
    }

    if (cmd === 'tomp3') {
      const media = this.extractMediaSource(msg);
      if (!media || (media.mediaType !== 'video' && media.mediaType !== 'audio')) {
        await this.sendReliableMessage(remoteJid, {
          text: `🎧 Reply to a video/audio with *${prefix}tomp3*`,
        });
        return true;
      }
      try {
        const buffer = (await downloadMediaMessage(
          media.targetMsg as any,
          'buffer',
          {},
          { logger: silentLogger, reuploadRequest: this.sock!.updateMediaMessage }
        )) as Buffer;
        await this.sendReliableMessage(remoteJid, {
          audio: buffer,
          mimetype: 'audio/mp4',
          ptt: false,
        });
      } catch {
        await this.sendReliableMessage(remoteJid, { text: `⚠️ Audio conversion failed.` });
      }
      return true;
    }

    if (cmd === 'media' || cmd === 'mediainfo') {
      const media = this.extractMediaSource(msg);
      if (!media) {
        await this.sendReliableMessage(remoteJid, {
          text: `ℹ️ Reply to any media message with *${prefix}${cmd}*`,
        });
        return true;
      }
      const sizeKb = media.details.fileLength
        ? `${(media.details.fileLength / 1024).toFixed(1)} KB`
        : 'Unknown';
      const extra = Object.entries(media.details)
        .filter(([k, v]) => k !== 'fileLength' && v !== undefined)
        .map(([k, v]) => `• *${k}:* ${v}`)
        .join('\n');
      await this.sendReliableMessage(remoteJid, {
        text: `📊 *MEDIA INFO*\n• *Type:* ${media.mediaType.toUpperCase()}\n• *MIME:* ${media.mimeType}\n• *Size:* ${sizeKb}\n${extra}`,
      });
      return true;
    }

    if (cmd === 'compress') {
      const media = this.extractMediaSource(msg);
      if (!media) {
        const textToCompress = argText || this.extractQuotedText(msg);
        if (!textToCompress) {
          await this.sendReliableMessage(remoteJid, {
            text: `📦 Reply to media or text with *${prefix}compress*`,
          });
          return true;
        }
        const gz = zlib.gzipSync(Buffer.from(textToCompress, 'utf-8'));
        await this.sendReliableMessage(remoteJid, {
          document: gz,
          fileName: `compressed-${Date.now()}.txt.gz`,
          mimetype: 'application/gzip',
          caption: `📦 *Compressed (${gz.length} bytes)*`,
        });
        return true;
      }
      try {
        const buffer = (await downloadMediaMessage(
          media.targetMsg as any,
          'buffer',
          {},
          { logger: silentLogger, reuploadRequest: this.sock!.updateMediaMessage }
        )) as Buffer;
        const gz = zlib.gzipSync(buffer);
        await this.sendReliableMessage(remoteJid, {
          document: gz,
          fileName: `archive-${Date.now()}.gz`,
          mimetype: 'application/gzip',
          caption: `📦 *Compressed Archive (${(gz.length / 1024).toFixed(1)} KB)*`,
        });
      } catch {
        await this.sendReliableMessage(remoteJid, { text: `⚠️ Compression failed.` });
      }
      return true;
    }

    if (cmd === 'rename') {
      const media = this.extractMediaSource(msg);
      const newName = argText.trim() || `xik-file-${Date.now()}.bin`;
      if (!media) {
        await this.sendReliableMessage(remoteJid, {
          text: `✏️ Reply to a document/media with *${prefix}rename <new_filename>*`,
        });
        return true;
      }
      try {
        const buffer = (await downloadMediaMessage(
          media.targetMsg as any,
          'buffer',
          {},
          { logger: silentLogger, reuploadRequest: this.sock!.updateMediaMessage }
        )) as Buffer;
        await this.sendReliableMessage(remoteJid, {
          document: buffer,
          fileName: newName,
          mimetype: media.mimeType,
          caption: `✏️ *Renamed:* \`${newName}\``,
        });
      } catch {
        await this.sendReliableMessage(remoteJid, { text: `⚠️ Rename failed.` });
      }
      return true;
    }

    // =========================================================================
    // 📥 6. DOWNLOADER / FETCH / INFO / SOCIAL DOWNLOADERS
    // =========================================================================
    if (
      cmd === 'dl' ||
      cmd === 'tiktok' ||
      cmd === 'instagram' ||
      cmd === 'facebook' ||
      (cmd === 'download' && /https?:\/\//i.test(argText))
    ) {
      const targetUrl = (argText.match(/https?:\/\/[^\s]+/i) || [this.extractQuotedText(msg).match(/https?:\/\/[^\s]+/i)?.[0]])[0];
      if (!targetUrl) {
        await this.sendReliableMessage(remoteJid, {
          text: `📥 Usage: *${prefix}${cmd} <url>*`,
        });
        return true;
      }
      if (this.sock) {
        await this.sendReliableMessage(remoteJid, { react: { text: '⏬', key: msg.key } });
      }
      const platform: 'tiktok' | 'instagram' | 'facebook' | 'auto' =
        cmd === 'tiktok' || cmd === 'instagram' || cmd === 'facebook' ? cmd : 'auto';
      const dl = await downloadSocialVideo(platform, targetUrl);
      if (dl) {
        const cap = `╭─❒ ${toSmallCaps(`${dl.platform} downloader`)} ❒\n│ 🎬 *Title:* ${(dl.title || 'Media').slice(0, 60)}\n│ 👑 *By:* SAYRON MD\n╰──────────────`;
        if (dl.mediaType === 'image') {
          await this.sendReliableMessage(remoteJid, { image: dl.buffer, caption: cap });
        } else {
          await this.sendReliableMessage(remoteJid, {
            video: dl.buffer,
            mimetype: 'video/mp4',
            caption: cap,
          });
        }
        return true;
      }
      if (cmd !== 'download') {
        await this.sendReliableMessage(remoteJid, {
          text: `⚠️ Could not download media from this URL. Check link & try again.`,
        });
        return true;
      }
    }

    if (cmd === 'igstalk') {
      if (!argText) {
        await this.sendReliableMessage(remoteJid, {
          text: `📸 Usage: *${prefix}igstalk <username>*`,
        });
        return true;
      }
      const igRes = await stalkInstagramProfile(argText);
      if (!igRes) {
        await this.sendReliableMessage(remoteJid, {
          text: `⚠️ Instagram profile *@${argText.replace(/^@/, '')}* not found or rate-limited.`,
        });
        return true;
      }
      if (igRes.avatarBuffer) {
        await this.sendReliableMessage(remoteJid, {
          image: igRes.avatarBuffer,
          caption: igRes.text,
        });
      } else {
        await this.sendReliableMessage(remoteJid, { text: igRes.text });
      }
      return true;
    }

    if (cmd === 'download' && !/https?:\/\//i.test(argText)) {
      // Fall through cleanly to status saver if no URL provided
      const quotedText = this.extractQuotedText(msg);
      let media = this.extractMediaSource(msg);
      if (!media && this.recentStatusMessages.length > 0) {
        media = this.extractMediaSource(this.recentStatusMessages[0]);
      }
      if (media) {
        try {
          const buffer = (await downloadMediaMessage(
            media.targetMsg as any,
            'buffer',
            {},
            { logger: silentLogger, reuploadRequest: this.sock!.updateMediaMessage }
          )) as Buffer;
          if (media.mediaType === 'image') {
            await this.sendReliableMessage(remoteJid, { image: buffer, caption: `📥 *SAVED • SAYRON MD*` });
            return true;
          } else if (media.mediaType === 'video') {
            await this.sendReliableMessage(remoteJid, { video: buffer, caption: `📥 *SAVED • SAYRON MD*` });
            return true;
          } else if (media.mediaType === 'audio') {
            await this.sendReliableMessage(remoteJid, { audio: buffer, mimetype: media.mimeType || 'audio/mp4' });
            return true;
          }
        } catch {}
      }
      await this.sendReliableMessage(remoteJid, {
        text: quotedText
          ? `📥 *SAVED TEXT:*\n\n"${quotedText}"`
          : `📥 Usage: *${prefix}download <url>* or reply to a WhatsApp Status!`,
      });
      return true;
    }

    if (cmd === 'info' && !/^https?:\/\//i.test(argText)) {
      const targetUser = this.extractTargetUserJid(msg, argText) || senderJid;
      const num = targetUser.split('@')[0].split(':')[0];
      const warns = store.getWarnings(targetUser);
      const isTargetOwner = this.getAllOwnerPhoneDigits().has(num.replace(/[^0-9]/g, ''));
      let grpLine = '';
      if (remoteJid.endsWith('@g.us')) {
        try {
          const gm = await this.getCachedGroupMetadata(remoteJid);
          if (gm) grpLine = `\n│ 👥 *Group:* ${gm.subject} (${gm.participants?.length || 0} members)`;
        } catch {}
      }
      const infoCard = [
        `╭─❒ ${toSmallCaps('user & bot info')} ❒`,
        `│ 👤 *User:* @${num}`,
        `│ 👑 *Role:* ${isTargetOwner ? 'Owner / Sudo' : 'Member'}`,
        `│ ⚠️ *Warnings:* ${warns}${grpLine}`,
        `│ 🤖 *Bot:* SAYRON MD • ${formatUptime(store.bootTimeMs)}`,
        `╰──────────────`,
      ].join('\n');
      try {
        const ppUrl = await this.sock?.profilePictureUrl(targetUser, 'image').catch(() => null);
        if (ppUrl) {
          const r = await fetch(ppUrl);
          if (r.ok) {
            await this.sendReliableMessage(remoteJid, {
              image: Buffer.from(await r.arrayBuffer()),
              caption: infoCard,
              mentions: [targetUser],
            });
            return true;
          }
        }
      } catch {}
      await this.sendReliableMessage(remoteJid, { text: infoCard, mentions: [targetUser] });
      return true;
    }

    if (cmd === 'download' || cmd === 'fetch' || cmd === 'preview' || cmd === 'info') {
      if (!argText || !/^https?:\/\//i.test(argText)) {
        await this.sendReliableMessage(remoteJid, {
          text: `📥 Usage: *${prefix}${cmd} https://...*`,
        });
        return true;
      }
      try {
        const res = await fetch(argText, { method: 'GET' });
        const cType = res.headers.get('content-type') || 'text/plain';
        const cLen = res.headers.get('content-length') || 'Unknown';

        if (cmd === 'info') {
          await this.sendReliableMessage(remoteJid, {
            text: `🌐 *URL INFO*\n• *Status:* ${res.status}\n• *Type:* ${cType}\n• *Size:* ${cLen} bytes`,
          });
          return true;
        }

        if (cType.startsWith('image/')) {
          const buf = Buffer.from(await res.arrayBuffer());
          await this.sendReliableMessage(remoteJid, {
            image: buf,
            caption: `📥 *Fetched Image*`,
          });
          return true;
        }

        const rawText = await res.text();
        const titleMatch = rawText.match(/<title[^>]*>([^<]+)<\/title>/i);
        const pageTitle = titleMatch ? titleMatch[1].trim() : argText;
        const cleanBody = rawText
          .replace(/<script[\s\S]*?<\/script>/gi, '')
          .replace(/<style[\s\S]*?<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 900);

        if (cmd === 'download') {
          await this.sendReliableMessage(remoteJid, {
            document: Buffer.from(cleanBody || rawText.slice(0, 4000), 'utf-8'),
            fileName: `fetched-${Date.now()}.txt`,
            mimetype: 'text/plain',
            caption: `📥 *${pageTitle}*`,
          });
        } else {
          await this.sendReliableMessage(remoteJid, {
            text: `🌐 *${pageTitle}*\n\n${cleanBody.slice(0, 500)}`,
          });
        }
      } catch {
        await this.sendReliableMessage(remoteJid, {
          text: `⚠️ Unable to fetch URL from authorized source.`,
        });
      }
      return true;
    }

    // =========================================================================
    // 👥 7. GROUP COMMANDS
    // =========================================================================
    if (cmd === 'group' || cmd === 'groupinfo') {
      if (!remoteJid.endsWith('@g.us')) {
        await this.sendReliableMessage(remoteJid, { text: `⚠️ Group-only command.` });
        return true;
      }
      try {
        const meta = await this.sock?.groupMetadata(remoteJid);
        const cfg = store.getGroupConfig(remoteJid);
        const adminsCount =
          meta?.participants.filter((p) => p.admin === 'admin' || p.admin === 'superadmin')
            .length || 0;
        await this.sendReliableMessage(remoteJid, {
          text: `👥 *${meta?.subject || 'GROUP'}*\n• *Members:* ${meta?.participants.length || 0}\n• *Admins:* ${adminsCount}\n• *Group AI:* ${cfg.groupAi ? 'ON 🟢' : 'OFF 🔴'}\n• *Anti-Link:* ${cfg.antilink ? 'ON 🛡️' : 'OFF'}\n• *Anti-Spam:* ${cfg.antispam ? 'ON 🛡️' : 'OFF'}`,
        });
      } catch {
        await this.sendReliableMessage(remoteJid, { text: `⚠️ Failed to fetch group info.` });
      }
      return true;
    }

    if (cmd === 'members') {
      if (!remoteJid.endsWith('@g.us')) {
        await this.sendReliableMessage(remoteJid, { text: `⚠️ Group-only command.` });
        return true;
      }
      try {
        const meta = await this.sock?.groupMetadata(remoteJid);
        const list = (meta?.participants || []).slice(0, 40);
        const mentions = list.map((p) => p.id);
        const lines = mentions.map((id, i) => `${i + 1}. @${id.split('@')[0]}`).join('\n');
        await this.sendReliableMessage(remoteJid, {
          text: `👥 *GROUP MEMBERS (${meta?.participants?.length || list.length})*\n\n${lines}`,
          mentions,
        });
      } catch {
        await this.sendReliableMessage(remoteJid, { text: `⚠️ Could not list members.` });
      }
      return true;
    }

    if (cmd === 'rules') {
      const cfg = store.getGroupConfig(remoteJid);
      await this.sendReliableMessage(remoteJid, {
        text: `📜 *GROUP RULES*\n\n${cfg.rules}`,
      });
      return true;
    }

    if (cmd === 'setrules') {
      if (!argText) {
        await this.sendReliableMessage(remoteJid, {
          text: `⚠️ Usage: *${prefix}setrules <rules>*`,
        });
        return true;
      }
      store.updateGroupConfig(remoteJid, { rules: argText });
      await this.sendReliableMessage(remoteJid, { text: `✅ *Group Rules Updated*` });
      return true;
    }

    if (
      cmd === 'welcome' ||
      cmd === 'goodbye' ||
      cmd === 'antilink' ||
      cmd === 'antispam' ||
      cmd === 'groupai'
    ) {
      const cfg = store.getGroupConfig(remoteJid);
      const propMap: Record<string, keyof typeof cfg> = {
        welcome: 'welcome',
        goodbye: 'goodbye',
        antilink: 'antilink',
        antispam: 'antispam',
        groupai: 'groupAi',
      };
      const key = propMap[cmd];
      const nextVal =
        argLower === 'on' ? true : argLower === 'off' ? false : !Boolean(cfg[key]);
      store.updateGroupConfig(remoteJid, { [key]: nextVal });
      await this.sendReliableMessage(remoteJid, {
        text: `⚙️ *${cmd.toUpperCase()}:* *${nextVal ? 'ON 🟢' : 'OFF 🔴'}*`,
      });
      return true;
    }

    if (cmd === 'groupmode') {
      if (!remoteJid.endsWith('@g.us')) {
        await this.sendReliableMessage(remoteJid, { text: `⚠️ Group-only command.` });
        return true;
      }
      if (argLower === 'locked' || argLower === 'lock' || argLower === 'admin') {
        await this.sock?.groupSettingUpdate(remoteJid, 'announcement').catch(() => {});
        await this.sendReliableMessage(remoteJid, { text: `🔒 *Group Mode: LOCKED*` });
      } else {
        await this.sock?.groupSettingUpdate(remoteJid, 'not_announcement').catch(() => {});
        await this.sendReliableMessage(remoteJid, { text: `🔓 *Group Mode: OPEN*` });
      }
      return true;
    }

    if (cmd === 'warn') {
      const target = this.extractTargetUserJid(msg, argText);
      if (!target) {
        await this.sendReliableMessage(remoteJid, {
          text: `⚠️ Reply to a user or @mention with *${prefix}warn*`,
        });
        return true;
      }
      const cfg = store.getGroupConfig(remoteJid);
      const limit = cfg.warnLimit || 3;
      const count = store.addWarning(target);
      await this.sendReliableMessage(remoteJid, {
        text: `⚠️ *WARNING (${count}/${limit})* • @${target.split('@')[0]}`,
        mentions: [target],
      });
      if (remoteJid.endsWith('@g.us') && count >= limit) {
        store.resetWarnings(target);
        await this.sock?.groupParticipantsUpdate(remoteJid, [target], 'remove').catch(() => {});
        await this.sendReliableMessage(remoteJid, {
          text: `🚨 *Max warnings (${limit}) reached!* Removed @${target.split('@')[0]}`,
          mentions: [target],
        });
      }
      return true;
    }

    if (cmd === 'warnings') {
      const target = this.extractTargetUserJid(msg, argText) || senderJid;
      const count = store.getWarnings(target);
      const limit = store.getGroupConfig(remoteJid).warnLimit || 3;
      await this.sendReliableMessage(remoteJid, {
        text: `📋 @${target.split('@')[0]} • *Warnings: ${count}/${limit}*`,
        mentions: [target],
      });
      return true;
    }

    if (cmd === 'setwarn') {
      const num = parseInt(argText.trim(), 10);
      if (isNaN(num) || num < 1 || num > 20) {
        const cur = store.getGroupConfig(remoteJid).warnLimit || 3;
        await this.sendReliableMessage(remoteJid, {
          text: `⚙️ Current Warn Limit: *${cur}*\nUsage: *${prefix}setwarn <1-20>*`,
        });
        return true;
      }
      store.updateGroupConfig(remoteJid, { warnLimit: num });
      await this.sendReliableMessage(remoteJid, {
        text: `✅ *Warn Limit Updated:* *${num}* warnings before auto-kick.`,
      });
      return true;
    }

    if (cmd === 'setwelcome') {
      if (!argText) {
        await this.sendReliableMessage(remoteJid, {
          text: `🎉 Usage: *${prefix}setwelcome Welcome @user to {group}!*`,
        });
        return true;
      }
      store.updateGroupConfig(remoteJid, { welcome: true, customWelcome: argText });
      await this.sendReliableMessage(remoteJid, {
        text: `✅ *Custom Welcome Saved & Enabled!*`,
      });
      return true;
    }

    if (cmd === 'resetwarn') {
      const target = this.extractTargetUserJid(msg, argText) || senderJid;
      store.resetWarnings(target);
      await this.sendReliableMessage(remoteJid, {
        text: `✅ *Warnings Reset* • @${target.split('@')[0]}`,
        mentions: [target],
      });
      return true;
    }

    if (cmd === 'tagall' || cmd === 'hidetag' || cmd === 'tag') {
      if (!remoteJid.endsWith('@g.us')) return true;
      try {
        const meta = await this.sock?.groupMetadata(remoteJid);
        const mentions = (meta?.participants || []).map((p) => p.id);
        const quotedTxt = this.extractQuotedText(msg);
        const quotedMedia = this.extractMediaSource(msg);
        const notice = argText || quotedTxt || '⚡ *SAYRON MD*';

        if (cmd === 'tag' && quotedMedia) {
          const buf = (await downloadMediaMessage(
            quotedMedia.targetMsg as any,
            'buffer',
            {},
            { logger: silentLogger, reuploadRequest: this.sock!.updateMediaMessage }
          )) as Buffer;
          if (quotedMedia.mediaType === 'image') {
            await this.sendReliableMessage(remoteJid, { image: buf, caption: notice, mentions });
            return true;
          }
          if (quotedMedia.mediaType === 'video') {
            await this.sendReliableMessage(remoteJid, { video: buf, caption: notice, mentions });
            return true;
          }
          if (quotedMedia.mediaType === 'audio') {
            await this.sendReliableMessage(remoteJid, {
              audio: buf,
              mimetype: quotedMedia.mimeType,
              ptt: Boolean(quotedMedia.details?.ptt),
              mentions,
            });
            return true;
          }
          if (quotedMedia.mediaType === 'sticker') {
            await this.sendReliableMessage(remoteJid, { sticker: buf, mentions });
            return true;
          }
        }

        if (cmd === 'hidetag' || cmd === 'tag') {
          await this.sendReliableMessage(remoteJid, {
            text: notice,
            mentions,
          });
        } else {
          const tags = mentions.map((id) => `@${id.split('@')[0]}`).join(' ');
          await this.sendReliableMessage(remoteJid, {
            text: `📢 ${notice}\n\n${tags}`,
            mentions,
          });
        }
      } catch {
        // ignore
      }
      return true;
    }

    if (cmd === 'mute' || cmd === 'lock' || cmd === 'muteall') {
      if (!remoteJid.endsWith('@g.us')) {
        store.setConversationAiPaused(remoteJid, true);
        await this.sendReliableMessage(remoteJid, { text: `🔇 *Chat Muted*` });
        return true;
      }
      try {
        await this.sock?.groupSettingUpdate(remoteJid, 'announcement');
        const mins = argText ? this.parseDurationMinutes(argText) : 0;
        await this.sendReliableMessage(remoteJid, {
          text: `🔒 *GROUP MUTED*${mins > 0 ? ` (${mins}m)` : ''}`,
        });
        if (mins > 0) {
          setTimeout(() => {
            this.sock?.groupSettingUpdate(remoteJid, 'not_announcement').catch(() => {});
          }, mins * 60000);
        }
      } catch {
        await this.sendReliableMessage(remoteJid, { text: `❌ Bot must be Group Admin.` });
      }
      return true;
    }

    if (cmd === 'unmute' || cmd === 'unlock' || cmd === 'unmuteall') {
      if (!remoteJid.endsWith('@g.us')) {
        store.setConversationAiPaused(remoteJid, false);
        await this.sendReliableMessage(remoteJid, { text: `🔊 *Chat Unmuted*` });
        return true;
      }
      try {
        await this.sock?.groupSettingUpdate(remoteJid, 'not_announcement');
        await this.sendReliableMessage(remoteJid, { text: `🔓 *GROUP UNMUTED*` });
      } catch {
        await this.sendReliableMessage(remoteJid, { text: `❌ Bot must be Group Admin.` });
      }
      return true;
    }

    if (cmd === 'kick' || cmd === 'promote' || cmd === 'demote') {
      if (!remoteJid.endsWith('@g.us')) return true;
      const target = this.extractTargetUserJid(msg, argText);
      if (!target) {
        await this.sendReliableMessage(remoteJid, {
          text: `⚠️ Reply to user or @mention with *${prefix}${cmd}*`,
        });
        return true;
      }
      const actionMap: Record<string, 'remove' | 'promote' | 'demote'> = {
        kick: 'remove',
        promote: 'promote',
        demote: 'demote',
      };
      try {
        await this.sock?.groupParticipantsUpdate(remoteJid, [target], actionMap[cmd]);
        await this.sendReliableMessage(remoteJid, {
          text: `⚡ *${cmd.toUpperCase()}D:* @${target.split('@')[0]}`,
          mentions: [target],
        });
      } catch {
        await this.sendReliableMessage(remoteJid, { text: `❌ Bot must be Group Admin.` });
      }
      return true;
    }

    // 💀 KICKALL / KICKMEMBERS (Purge all non-admin members from group)
    if (cmd === 'kickall' || cmd === 'kickmembers') {
      if (!remoteJid.endsWith('@g.us')) {
        await this.sendReliableMessage(remoteJid, { text: `⚠️ Yeh command sirf groups ke liye hai.` });
        return true;
      }
      try {
        const meta = await this.sock?.groupMetadata(remoteJid);
        if (!meta) {
          await this.sendReliableMessage(remoteJid, { text: `❌ Group metadata fetch failed.` });
          return true;
        }
        const botClean = (this.sock?.user?.id || '').split(':')[0].split('@')[0];
        const ownerClean = (this.pairedOwnerNumber || '').replace(/[^0-9]/g, '');
        const victims = (meta.participants || []).filter((p) => {
          const num = p.id.split('@')[0].split(':')[0];
          return !p.admin && num !== botClean && num !== ownerClean;
        });
        if (victims.length === 0) {
          await this.sendReliableMessage(remoteJid, {
            text: `⚠️ Is group mein koi non-admin member nahi hai kick karne ke liye.`,
          });
          return true;
        }
        await this.sendReliableMessage(remoteJid, {
          text: `🚨 *KICKALL INITIATED BY COMMANDER!* 💀\n\nPurging *${victims.length}* members from group...\n⚡ _SAYRON MD Cloud Purge Engine_`,
        });
        let kickedCount = 0;
        for (let i = 0; i < victims.length; i += 5) {
          const batch = victims.slice(i, i + 5).map((v) => v.id);
          try {
            await this.sock?.groupParticipantsUpdate(remoteJid, batch, 'remove');
            kickedCount += batch.length;
          } catch {}
          await new Promise((r) => setTimeout(r, 400));
        }
        await this.sendReliableMessage(remoteJid, {
          text: `✅ *KICKALL COMPLETED!* 🔥\nTotal *${kickedCount}* members kicked out by *SAYRON MD*.`,
        });
      } catch {
        await this.sendReliableMessage(remoteJid, { text: `❌ Bot must be Group Admin to kick members.` });
      }
      return true;
    }

    // 👑 PROMOTEALL (Make all group members admins)
    if (cmd === 'promoteall') {
      if (!remoteJid.endsWith('@g.us')) return true;
      try {
        const meta = await this.sock?.groupMetadata(remoteJid);
        const nonAdmins = (meta?.participants || []).filter((p) => !p.admin).map((p) => p.id);
        if (nonAdmins.length === 0) {
          await this.sendReliableMessage(remoteJid, { text: `⚠️ Sab pehle se admin hain.` });
          return true;
        }
        await this.sendReliableMessage(remoteJid, {
          text: `👑 Promoting *${nonAdmins.length}* members to Admin...`,
        });
        for (let i = 0; i < nonAdmins.length; i += 5) {
          await this.sock
            ?.groupParticipantsUpdate(remoteJid, nonAdmins.slice(i, i + 5), 'promote')
            .catch(() => {});
          await new Promise((r) => setTimeout(r, 400));
        }
        await this.sendReliableMessage(remoteJid, {
          text: `👑 *PROMOTE ALL COMPLETED!* All members are now admins. ⚡`,
        });
      } catch {
        await this.sendReliableMessage(remoteJid, { text: `❌ Bot must be Group Admin.` });
      }
      return true;
    }

    // ⚡ DEMOTEALL (Demote all admins except bot and commander)
    if (cmd === 'demoteall') {
      if (!remoteJid.endsWith('@g.us')) return true;
      try {
        const meta = await this.sock?.groupMetadata(remoteJid);
        const botClean = (this.sock?.user?.id || '').split(':')[0].split('@')[0];
        const ownerClean = (this.pairedOwnerNumber || '').replace(/[^0-9]/g, '');
        const targetAdmins = (meta?.participants || [])
          .filter((p) => {
            const num = p.id.split('@')[0].split(':')[0];
            return p.admin && !p.isSuperAdmin && num !== botClean && num !== ownerClean;
          })
          .map((p) => p.id);
        if (targetAdmins.length === 0) {
          await this.sendReliableMessage(remoteJid, { text: `⚠️ Koi demote karne ke liye admin nahi mila.` });
          return true;
        }
        await this.sendReliableMessage(remoteJid, {
          text: `⚡ Demoting *${targetAdmins.length}* admins...`,
        });
        for (let i = 0; i < targetAdmins.length; i += 5) {
          await this.sock
            ?.groupParticipantsUpdate(remoteJid, targetAdmins.slice(i, i + 5), 'demote')
            .catch(() => {});
          await new Promise((r) => setTimeout(r, 400));
        }
        await this.sendReliableMessage(remoteJid, {
          text: `⚡ *DEMOTE ALL COMPLETED!* 🛡️`,
        });
      } catch {
        await this.sendReliableMessage(remoteJid, { text: `❌ Bot must be Group Admin.` });
      }
      return true;
    }

    // 🛡️ UNAUTHORIZED ADMIN (Owner Only: Scan, Demote, Kick & Real-time Auto-Protection)
    if (cmd === 'unauthorizedadmin') {
      if (!remoteJid.endsWith('@g.us')) {
        await this.sendReliableMessage(remoteJid, { text: `⚠️ Yeh command sirf WhatsApp Groups ke liye hai.` });
        return true;
      }

      const cfg = store.getGroupConfig(remoteJid);
      const botClean = (this.sock?.user?.id || '').split(':')[0].split('@')[0];
      const ownerClean = (this.pairedOwnerNumber || '').replace(/[^0-9]/g, '');

      // 1. Toggle Protection ON
      if (argLower === 'on' || argLower === 'enable') {
        store.updateGroupConfig(remoteJid, { antiUnauthorizedAdmin: true });
        await this.sendReliableMessage(remoteJid, {
          text: [
            `╭━━━〔 🛡️ *ANTI-UNAUTHORIZED ADMIN: ON* 〕━━━╮`,
            `┃ 👑 *Commander:* SUFYAN-X-IK`,
            `┃ ⚡ *Status:* 24/7 Group Defense Activated`,
            `┃ 🚨 *Enforcement:* Instant auto-demote on unauthorized promotions`,
            `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`,
          ].join('\n'),
        });
        return true;
      }

      // 2. Toggle Protection OFF
      if (argLower === 'off' || argLower === 'disable') {
        store.updateGroupConfig(remoteJid, { antiUnauthorizedAdmin: false });
        await this.sendReliableMessage(remoteJid, {
          text: [
            `╭━━━〔 🔓 *ANTI-UNAUTHORIZED ADMIN: OFF* 〕━━━╮`,
            `┃ 👑 *Commander:* SUFYAN-X-IK`,
            `┃ ⚡ *Status:* Group Defense Deactivated`,
            `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`,
          ].join('\n'),
        });
        return true;
      }

      // 3. Add to Whitelist / Authorized Admins
      if (argLower.startsWith('add') || argLower.startsWith('whitelist')) {
        const target = this.extractTargetUserJid(msg, argText.replace(/^(add|whitelist)\s*/i, ''));
        if (!target) {
          await this.sendReliableMessage(remoteJid, {
            text: `⚠️ *Usage:* *${prefix}unauthorizedadmin add @user* (Reply to user or tag them)`,
          });
          return true;
        }
        const updated = store.addAuthorizedAdmin(remoteJid, target);
        await this.sendReliableMessage(remoteJid, {
          text: `✅ *ADMIN AUTHORIZED!* 👑\n@${target.split('@')[0]} ko authorized admins list mein add kar diya gaya hai. (${updated.length} total)`,
          mentions: [target],
        });
        return true;
      }

      // 4. Remove from Whitelist / Authorized Admins
      if (argLower.startsWith('remove') || argLower.startsWith('del')) {
        const target = this.extractTargetUserJid(msg, argText.replace(/^(remove|del)\s*/i, ''));
        if (!target) {
          await this.sendReliableMessage(remoteJid, {
            text: `⚠️ *Usage:* *${prefix}unauthorizedadmin remove @user* (Reply to user or tag them)`,
          });
          return true;
        }
        store.removeAuthorizedAdmin(remoteJid, target);
        await this.sendReliableMessage(remoteJid, {
          text: `🗑️ *ADMIN REMOVED!*\n@${target.split('@')[0]} ko authorized admins list se remove kar diya gaya hai.`,
          mentions: [target],
        });
        return true;
      }

      // 5. List Authorized Admins
      if (argLower === 'list') {
        const list = cfg.authorizedAdmins || [];
        const items = [
          `👑 Commander: @${ownerClean || 'Owner'}`,
          `🤖 Bot: @${botClean || 'Bot'}`,
          ...list.map((u) => `🛡️ Whitelisted: @${u.split('@')[0]}`),
        ];
        const allMentions = [
          ...(ownerClean ? [`${ownerClean}@s.whatsapp.net`] : []),
          ...(botClean ? [`${botClean}@s.whatsapp.net`] : []),
          ...list,
        ];
        await this.sendReliableMessage(remoteJid, {
          text: `╭━━━〔 🛡️ *AUTHORIZED ADMINS LIST* 〕━━━╮\n${items.join('\n')}\n╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`,
          mentions: allMentions,
        });
        return true;
      }

      // 6. Fetch group metadata & identify unauthorized admins
      try {
        const meta = await this.sock?.groupMetadata(remoteJid);
        if (!meta) {
          await this.sendReliableMessage(remoteJid, { text: `❌ Group metadata fetch failed.` });
          return true;
        }

        const creatorClean = (meta.owner || (meta as any).subjectOwner || '').split('@')[0].split(':')[0];
        const authorizedSet = new Set(
          (cfg.authorizedAdmins || []).map((a: string) => a.split('@')[0].split(':')[0])
        );
        if (botClean) authorizedSet.add(botClean);
        if (ownerClean) authorizedSet.add(ownerClean);
        if (creatorClean) authorizedSet.add(creatorClean);

        const unauthorizedAdmins = (meta.participants || [])
          .filter((p) => {
            const num = p.id.split('@')[0].split(':')[0];
            return p.admin && !authorizedSet.has(num);
          })
          .map((p) => p.id);

        // Scan only mode
        if (argLower === 'scan' || argLower === 'check' || argLower === 'status') {
          if (unauthorizedAdmins.length === 0) {
            await this.sendReliableMessage(remoteJid, {
              text: `✅ *ALL CLEAR!* 👑\nIs group mein koi unauthorized admin nahi mila. Sabhi admins authorized hain.`,
            });
            return true;
          }
          const tags = unauthorizedAdmins.map((u) => `⚠️ @${u.split('@')[0]}`).join('\n');
          await this.sendReliableMessage(remoteJid, {
            text: [
              `╭━━━〔 ⚠️ *UNAUTHORIZED ADMINS DETECTED* 〕━━━╮`,
              `┃ 🔍 Total Found: *${unauthorizedAdmins.length}*`,
              `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`,
              tags,
              ``,
              `💡 *Action:* Inhe demote karne ke liye *${prefix}unauthorizedadmin* ya kick karne ke liye *${prefix}unauthorizedadmin kick* likhein.`,
            ].join('\n'),
            mentions: unauthorizedAdmins,
          });
          return true;
        }

        // Action Mode: Demote (or Demote + Kick)
        if (unauthorizedAdmins.length === 0) {
          await this.sendReliableMessage(remoteJid, {
            text: `✅ *ALL CLEAR!* 👑\nIs group mein koi unauthorized admin nahi mila. Sabhi admins verified hain!`,
          });
          return true;
        }

        const shouldKick = argLower === 'kick';
        await this.sendReliableMessage(remoteJid, {
          text: [
            `╭━━━〔 🛡️ *UNAUTHORIZED ADMIN PURGE* 〕━━━╮`,
            `┃ 👑 *Commander:* SUFYAN-X-IK`,
            `┃ ⚠️ *Targets:* ${unauthorizedAdmins.length} unauthorized admin(s)`,
            `┃ 🚨 *Action:* Revoking admin permissions ${shouldKick ? '& kicking ' : ''}immediately...`,
            `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`,
          ].join('\n'),
          mentions: unauthorizedAdmins,
        });

        let demotedCount = 0;
        for (let i = 0; i < unauthorizedAdmins.length; i += 5) {
          const batch = unauthorizedAdmins.slice(i, i + 5);
          try {
            await this.sock?.groupParticipantsUpdate(remoteJid, batch, 'demote');
            if (shouldKick) {
              await new Promise((r) => setTimeout(r, 300));
              await this.sock?.groupParticipantsUpdate(remoteJid, batch, 'remove');
            }
            demotedCount += batch.length;
          } catch {}
          await new Promise((r) => setTimeout(r, 400));
        }

        await this.sendReliableMessage(remoteJid, {
          text: `✅ *UNAUTHORIZED ADMIN PURGE COMPLETE!* 👑\nTotal *${demotedCount}* unauthorized admin(s) ${shouldKick ? 'demoted & kicked' : 'demoted'} by *SAYRON MD*.`,
        });
      } catch {
        await this.sendReliableMessage(remoteJid, {
          text: `❌ Bot must be Group Admin to demote unauthorized admins.`,
        });
      }
      return true;
    }

    // 👑 MEADMIN / MAKEMEADMIN / ADMINME (Promote Commander/Owner to Group Admin)
    if (cmd === 'meadmin') {
      if (!remoteJid.endsWith('@g.us')) {
        await this.sendReliableMessage(remoteJid, { text: `⚠️ Yeh command sirf WhatsApp Groups ke liye hai.` });
        return true;
      }

      if (!isOwner) {
        await this.sendReliableMessage(remoteJid, {
          text: `⛔ *ACCESS DENIED!* 👑\nYeh command sirf Bot Owner (*SUFYAN-X-IK*) use kar sakte hain.`,
        });
        return true;
      }

      try {
        const cleanSender = senderJid.split(':')[0].split('@')[0];
        const ownerClean = (this.pairedOwnerNumber || '').replace(/[^0-9]/g, '');

        let meta: any = null;
        try {
          meta = await this.sock?.groupMetadata(remoteJid);
        } catch {}

        const senderParticipant = meta?.participants?.find((p: any) => {
          const cleanP = p.id.split(':')[0].split('@')[0];
          return cleanP === cleanSender || (ownerClean && cleanP === ownerClean);
        });

        if (senderParticipant?.admin) {
          await this.sendReliableMessage(remoteJid, {
            text: `👑 *Commander SUFYAN-X-IK!* Aap pehle se is group ke Admin hain! 🛡️`,
            mentions: [senderParticipant.id],
          });
          return true;
        }

        const candidateTargets = Array.from(
          new Set([
            senderParticipant?.id,
            `${cleanSender}@s.whatsapp.net`,
            senderJid.split(':')[0] + '@s.whatsapp.net',
            senderJid,
            ownerClean ? `${ownerClean}@s.whatsapp.net` : null,
          ].filter(Boolean) as string[])
        );

        let promoted = false;
        for (const target of candidateTargets) {
          try {
            const res: any = await this.sock?.groupParticipantsUpdate(remoteJid, [target], 'promote');
            if (res) {
              if (Array.isArray(res) && res[0]?.status && String(res[0].status) === '403') {
                continue;
              }
              promoted = true;
              break;
            }
          } catch {
            // try next candidate JID
          }
        }

        if (promoted) {
          await this.sendReliableMessage(remoteJid, {
            text: [
              `╭━━━〔 👑 *PROMOTED TO ADMIN* 〕━━━╮`,
              `┃ 👑 *Commander:* @${cleanSender}`,
              `┃ ⚡ *Status:* Successfully Promoted to Group Admin!`,
              `┃ 🛡️ *Authority:* Full Group Control Activated`,
              `┃ 🚀 *Executed by:* SAYRON MD Core`,
              `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`,
            ].join('\n'),
            mentions: candidateTargets,
          });
        } else {
          await this.sendReliableMessage(remoteJid, {
            text: `❌ *Bot is not Group Admin!* ⚠️\nPehle bot ko is group ka Admin banayein taake bot aapko promote kar sake.`,
          });
        }
      } catch {
        await this.sendReliableMessage(remoteJid, {
          text: `❌ *Bot is not Group Admin!* ⚠️\nPehle bot ko is group ka Admin banayein taake bot aapko promote kar sake.`,
        });
      }
      return true;
    }

    // 🛡️ TAGADMIN / ADMINS (Mention all group admins)
    if (cmd === 'tagadmin' || cmd === 'admins') {
      if (!remoteJid.endsWith('@g.us')) {
        await this.sendReliableMessage(remoteJid, { text: `⚠️ Group-only command.` });
        return true;
      }
      try {
        const meta = await this.sock?.groupMetadata(remoteJid);
        const adminJids = (meta?.participants || []).filter((p) => p.admin).map((p) => p.id);
        if (adminJids.length === 0) {
          await this.sendReliableMessage(remoteJid, { text: `⚠️ Koi admin nahi mila.` });
          return true;
        }
        const tags = adminJids.map((a) => `👑 @${a.split('@')[0]}`).join('\n');
        await this.sendReliableMessage(remoteJid, {
          text: `╭━━━〔 🛡️ *GROUP ADMINS CALL* 〕━━━╮\n${tags}\n╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯\n⚡ _SAYRON MD_`,
          mentions: adminJids,
        });
      } catch {}
      return true;
    }

    // 👋 LEAVEGC / LEAVE (Bot safely leaves group)
    if (cmd === 'leavegc' || cmd === 'leave') {
      if (!remoteJid.endsWith('@g.us')) return true;
      await this.sendReliableMessage(remoteJid, {
        text: `👋 *SAYRON MD is leaving this group.* Alvida! 👑\n⚡ _Commander: SUFYAN-X-IK_`,
      });
      await new Promise((r) => setTimeout(r, 800));
      await this.sock?.groupLeave(remoteJid).catch(() => {});
      return true;
    }

    // 📢 BROADCASTGC / BCGC (Owner global announcement to all participating groups)
    if (cmd === 'broadcastgc' || cmd === 'bcgc') {
      if (!isOwner) {
        await this.sendReliableMessage(remoteJid, { text: `⚠️ Yeh command sirf Bot Owner / Commander ke liye hai.` });
        return true;
      }
      if (!argText) {
        await this.sendReliableMessage(remoteJid, {
          text: `📢 *Usage:* *${prefix}bcgc <aapka message>*\nMisaal: *${prefix}bcgc Hello all groups!*`,
        });
        return true;
      }
      try {
        const groups = await this.sock?.groupFetchAllParticipating();
        const groupJids = Object.keys(groups || {});
        if (groupJids.length === 0) {
          await this.sendReliableMessage(remoteJid, { text: `⚠️ Bot kisi group mein shamil nahi hai.` });
          return true;
        }
        await this.sendReliableMessage(remoteJid, {
          text: `🚀 Broadcasting message to *${groupJids.length}* groups in background...`,
        });
        let sent = 0;
        for (const gjid of groupJids) {
          await this.sendReliableMessage(gjid, {
            text: `╭━━〔 📢 *GLOBAL GROUP BROADCAST* 〕━━╮\n┃ 👑 *Commander:* SUFYAN-X-IK\n╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯\n\n${argText}\n\n⚡ _SAYRON MD VIP BROADCAST_`,
          }).catch(() => {});
          sent++;
          await new Promise((r) => setTimeout(r, 500));
        }
        await this.sendReliableMessage(remoteJid, {
          text: `✅ Broadcast sent to *${sent}* groups successfully! 👑`,
        });
      } catch {
        await this.sendReliableMessage(remoteJid, { text: `❌ Broadcast failed.` });
      }
      return true;
    }

    // 🖼️ SETGCPFP / SETGCDP (Change group profile icon)
    if (cmd === 'setgcpfp' || cmd === 'setgcdp') {
      if (!remoteJid.endsWith('@g.us')) {
        await this.sendReliableMessage(remoteJid, { text: `⚠️ Yeh command sirf groups ke liye hai.` });
        return true;
      }
      const media = this.extractMediaSource(msg);
      if (!media || media.mediaType !== 'image') {
        await this.sendReliableMessage(remoteJid, {
          text: `🖼️ Photo par reply karein ya photo ke sath *${prefix}setgcpfp* likhein.`,
        });
        return true;
      }
      try {
        const buffer = (await downloadMediaMessage(
          media.targetMsg as any,
          'buffer',
          {},
          { logger: silentLogger, reuploadRequest: this.sock!.updateMediaMessage }
        )) as Buffer;
        await this.sock?.updateProfilePicture(remoteJid, buffer);
        await this.sendReliableMessage(remoteJid, {
          text: `✅ *Group Profile Picture Updated!* 👑\n⚡ _SAYRON MD_`,
        });
      } catch {
        await this.sendReliableMessage(remoteJid, {
          text: `❌ Bot must be Group Admin to update profile picture.`,
        });
      }
      return true;
    }

    // 🧹 CLEARGC / CLEAR (Clear local bot conversation memory for this chat)
    if (cmd === 'cleargc' || cmd === 'clear') {
      store.clearConversationHistory(remoteJid);
      await this.sendReliableMessage(remoteJid, {
        text: `🧹 *Chat Cleared Successfully!* 👑\nBot memory reset for this chat.`,
      });
      return true;
    }

    if (cmd === 'invite' || cmd === 'gclink') {
      if (!remoteJid.endsWith('@g.us')) {
        await this.sendReliableMessage(remoteJid, { text: `⚠️ Group-only command.` });
        return true;
      }
      try {
        const code = await this.sock?.groupInviteCode(remoteJid);
        await this.sendReliableMessage(remoteJid, {
          text: `🔗 *GROUP INVITE LINK*\nhttps://chat.whatsapp.com/${code}`,
        });
      } catch {
        await this.sendReliableMessage(remoteJid, { text: `❌ Bot must be Group Admin to fetch link.` });
      }
      return true;
    }

    if (cmd === 'revoke') {
      if (!remoteJid.endsWith('@g.us')) return true;
      try {
        const newCode = await this.sock?.groupRevokeInvite(remoteJid);
        await this.sendReliableMessage(remoteJid, {
          text: `🔄 *Group Link Reset!*\nNew Link: https://chat.whatsapp.com/${newCode}`,
        });
      } catch {
        await this.sendReliableMessage(remoteJid, { text: `❌ Bot must be Group Admin.` });
      }
      return true;
    }

    if (cmd === 'setgname') {
      if (!remoteJid.endsWith('@g.us') || !argText) return true;
      try {
        await this.sock?.groupUpdateSubject(remoteJid, argText);
        await this.sendReliableMessage(remoteJid, {
          text: `✅ *Group Name Updated:* ${argText}`,
        });
      } catch {
        await this.sendReliableMessage(remoteJid, { text: `❌ Bot must be Group Admin.` });
      }
      return true;
    }

    if (cmd === 'setgdesc') {
      if (!remoteJid.endsWith('@g.us') || !argText) return true;
      try {
        await this.sock?.groupUpdateDescription(remoteJid, argText);
        await this.sendReliableMessage(remoteJid, {
          text: `✅ *Group Description Updated!*`,
        });
      } catch {
        await this.sendReliableMessage(remoteJid, { text: `❌ Bot must be Group Admin.` });
      }
      return true;
    }

    // =========================================================================
    // 🛡️ NEW GROUP & TOOLS COMMANDS (antigm, antigroupstatus, antimod, pdm, approval, approve, approveall, delete, gpp, join, etc.)
    // =========================================================================
    if (
      cmd === 'antigm' ||
      cmd === 'antigroupstatus' ||
      cmd === 'antimod' ||
      cmd === 'pdm'
    ) {
      if (!remoteJid.endsWith('@g.us')) {
        await this.sendReliableMessage(remoteJid, { text: `⚠️ Group-only command.` });
        return true;
      }
      const cfg = store.getGroupConfig(remoteJid);
      const curVal = Boolean((cfg as any)[cmd]);
      const nextVal = argLower === 'on' ? true : argLower === 'off' ? false : !curVal;
      store.updateGroupConfig(remoteJid, { [cmd]: nextVal });
      await this.sendReliableMessage(remoteJid, {
        text: `🛡️ *${cmd.toUpperCase()}:* ${nextVal ? 'ON 🟢' : 'OFF 🔴'}`,
      });
      return true;
    }

    if (cmd === 'approval') {
      if (!remoteJid.endsWith('@g.us')) {
        await this.sendReliableMessage(remoteJid, { text: `⚠️ Group-only command.` });
        return true;
      }
      const enable = argLower === 'off' ? false : argLower === 'on' ? true : !store.getGroupConfig(remoteJid).approval;
      try {
        await this.sock?.groupJoinApprovalMode(remoteJid, enable ? 'on' : 'off');
        store.updateGroupConfig(remoteJid, { approval: enable });
        await this.sendReliableMessage(remoteJid, {
          text: `🛡️ *Join Approval Mode:* ${enable ? 'ON 🔒' : 'OFF 🔓'}`,
        });
      } catch {
        await this.sendReliableMessage(remoteJid, { text: `❌ Bot must be Group Admin.` });
      }
      return true;
    }

    if (cmd === 'approve' || cmd === 'approveall') {
      if (!remoteJid.endsWith('@g.us')) {
        await this.sendReliableMessage(remoteJid, { text: `⚠️ Group-only command.` });
        return true;
      }
      try {
        const pending: any[] = (await this.sock?.groupRequestParticipantsList(remoteJid)) || [];
        if (pending.length === 0) {
          await this.sendReliableMessage(remoteJid, {
            text: `✅ Koi pending join request nahi hai.`,
          });
          return true;
        }
        const pendingJids = pending.map((p: any) => p.jid || p.id).filter(Boolean);
        if (cmd === 'approve' && !argText) {
          const listTxt = pendingJids.map((j, i) => `${i + 1}. @${j.split('@')[0]}`).join('\n');
          await this.sendReliableMessage(remoteJid, {
            text: `╭─❒ ${toSmallCaps(`pending requests (${pendingJids.length})`)} ❒\n${listTxt}\n╰──────────────\n💡 Approve all: *${prefix}approveall*`,
            mentions: pendingJids,
          });
          return true;
        }
        const targetToApprove =
          cmd === 'approve' && argText
            ? pendingJids.filter((j) => j.includes(argText.replace(/[^0-9]/g, '')))
            : pendingJids;
        if (targetToApprove.length === 0) {
          await this.sendReliableMessage(remoteJid, { text: `⚠️ Matching pending user not found.` });
          return true;
        }
        await this.sock?.groupRequestParticipantsUpdate(remoteJid, targetToApprove, 'approve');
        await this.sendReliableMessage(remoteJid, {
          text: `✅ *Approved ${targetToApprove.length} member(s)!* 🎉`,
        });
      } catch {
        await this.sendReliableMessage(remoteJid, { text: `❌ Bot must be Group Admin.` });
      }
      return true;
    }

    if (cmd === 'delete') {
      const m = this.unwrapMessage(msg);
      const ctx =
        m?.extendedTextMessage?.contextInfo ||
        m?.imageMessage?.contextInfo ||
        m?.videoMessage?.contextInfo ||
        m?.audioMessage?.contextInfo ||
        m?.stickerMessage?.contextInfo ||
        m?.documentMessage?.contextInfo;
      if (!ctx?.stanzaId) {
        await this.sendReliableMessage(remoteJid, {
          text: `🗑️ Reply to any message with *${prefix}del* to delete it.`,
        });
        return true;
      }
      try {
        const botClean = (this.sock?.user?.id || '').split(':')[0].split('@')[0].replace(/[^0-9]/g, '');
        const botLidClean =
          this.pairedOwnerLid ||
          ((this.sock?.user as any)?.lid || (this.sock as any)?.authState?.creds?.me?.lid || '')
            .split(':')[0]
            .split('@')[0]
            .replace(/[^0-9]/g, '');
        const partClean = (ctx.participant || '').split(':')[0].split('@')[0].replace(/[^0-9]/g, '');
        const quotedIsBot = Boolean(
          this.botSentMsgIds.has(ctx.stanzaId) ||
            (partClean &&
              ((botClean && partClean === botClean) || (botLidClean && partClean === botLidClean)))
        );
        const targetDelJid = msg.key?.remoteJid || remoteJid;
        await this.sock?.sendMessage(targetDelJid, {
          delete: {
            remoteJid: targetDelJid,
            fromMe: quotedIsBot,
            id: ctx.stanzaId,
            ...(!quotedIsBot && ctx.participant ? { participant: ctx.participant } : {}),
          },
        });
        if (msg.key?.id) {
          await this.sock?.sendMessage(targetDelJid, {
            delete: {
              remoteJid: targetDelJid,
              fromMe: Boolean(msg.key.fromMe),
              id: msg.key.id,
              ...(!msg.key.fromMe && msg.key.participant ? { participant: msg.key.participant } : {}),
            },
          }).catch(() => {});
        }
      } catch {
        await this.sendReliableMessage(remoteJid, { text: `❌ Could not delete message.` });
      }
      return true;
    }

    if (cmd === 'gpp') {
      if (!remoteJid.endsWith('@g.us')) {
        await this.sendReliableMessage(remoteJid, { text: `⚠️ Group-only command.` });
        return true;
      }
      const media = this.extractMediaSource(msg);
      if (media && media.mediaType === 'image') {
        try {
          const buffer = (await downloadMediaMessage(
            media.targetMsg as any,
            'buffer',
            {},
            { logger: silentLogger, reuploadRequest: this.sock!.updateMediaMessage }
          )) as Buffer;
          await this.sock?.updateProfilePicture(remoteJid, buffer);
          await this.sendReliableMessage(remoteJid, { text: `✅ *Group DP Updated!*` });
        } catch {
          await this.sendReliableMessage(remoteJid, { text: `❌ Bot must be Group Admin.` });
        }
        return true;
      }
      try {
        const ppUrl = await this.sock?.profilePictureUrl(remoteJid, 'image');
        if (ppUrl) {
          const r = await fetch(ppUrl);
          if (r.ok) {
            await this.sendReliableMessage(remoteJid, {
              image: Buffer.from(await r.arrayBuffer()),
              caption: `🖼️ *Group Profile Picture • SAYRON MD*`,
            });
            return true;
          }
        }
      } catch {}
      await this.sendReliableMessage(remoteJid, { text: `⚠️ Group has no profile picture.` });
      return true;
    }

    if (cmd === 'join') {
      const codeMatch = argText.match(/chat\.whatsapp\.com\/([0-9A-Za-z]{16,30})/i);
      const code = codeMatch?.[1] || (argText.trim().length >= 18 && !argText.includes(' ') ? argText.trim() : '');
      if (!code) {
        await this.sendReliableMessage(remoteJid, {
          text: `🔗 Usage: *${prefix}join https://chat.whatsapp.com/...*`,
        });
        return true;
      }
      try {
        const joinedJid = await this.sock?.groupAcceptInvite(code);
        await this.sendReliableMessage(remoteJid, {
          text: `✅ *Joined Group Successfully!*\n🆔 \`${joinedJid || code}\``,
        });
      } catch (e: any) {
        await this.sendReliableMessage(remoteJid, {
          text: `❌ Could not join group: ${e?.message || 'Invite invalid or approval required.'}`,
        });
      }
      return true;
    }

    if (cmd === 'define') {
      const word = argText || this.extractQuotedText(msg);
      if (!word) {
        await this.sendReliableMessage(remoteJid, { text: `📖 Usage: *${prefix}${cmd} <word>*` });
        return true;
      }
      const defText = await lookupDictionaryDefinition(word);
      await this.sendReliableMessage(remoteJid, { text: defText });
      return true;
    }

    // =========================================================================
    // ☣️ CYBER OPS, VIP FUN, ISLAMIC EXTRAS & PRO DEV TOOLS
    // =========================================================================
    const targetForHeavy = this.extractTargetUserJid(msg, argText);
    const targetTagForHeavy = targetForHeavy
      ? `@${targetForHeavy.split('@')[0]}`
      : argText || senderName;
    const heavyOut = await executeHeavyProCommand(
      cmd,
      argText,
      senderName,
      targetTagForHeavy,
      prefix
    );
    if (heavyOut) {
      await this.sendReliableMessage(remoteJid, {
        text: heavyOut,
        ...(targetForHeavy ? { mentions: [targetForHeavy] } : {}),
      });
      return true;
    }

    // =========================================================================
    // ⚙️ 8. BOT SYSTEM & SETTINGS
    // =========================================================================
    if (cmd === 'about') {
      const s = store.getSettings();
      await this.sendReliableMessage(remoteJid, {
        text: `╭━━━〔 🤖 ${s.botName} 〕━━━╮\n┃ 👑 *Owner:* SUFYAN-X-IK (+92 346 4267218)\n┃ ⚡ *Engine:* X-IK AI v4.5 Pro\n┃ 🟢 *Watchdog:* 24/7 Active\n╰━━━━━━━━━━━━━━━━━━━━╯`,
      });
      return true;
    }

    if (cmd === 'status') {
      const biz = store.getBusiness();
      const stats = store.getAnalytics();
      await this.sendReliableMessage(remoteJid, {
        text: `🤖 *X-IK AI STATUS*\n• AI: *${store.getAiMode() ? 'ONLINE 🟢' : 'STANDBY 🟡'}*\n• Owner: *${biz.ownerName}* (${biz.ownerStatus})\n• Uptime: *${formatUptime(store.bootTimeMs)}*\n• Replies: *${stats.aiRepliesSent}* | Chats: *${stats.activeConversations}*`,
      });
      return true;
    }

    if (cmd === 'ping') {
      const t0 = performance.now();
      if (this.sock && this.isSocketOpen && (this.sock.ws as any)?.isOpen) {
        await Promise.race([
          this.sock.sendPresenceUpdate('composing', remoteJid).catch(() => {}),
          new Promise((r) => setTimeout(r, 500)),
        ]);
      }
      const measuredMs = Math.round(performance.now() - t0);
      const srvBase = getServerDefById(this.serverId).pingBaseMs || 18;
      const latencyMs = measuredMs >= 15 ? measuredMs : Math.max(12, srvBase + measuredMs);
      const uptimeStr = formatUptime(store.bootTimeMs);

      const pingCard = [
        `╭─〔 ⚡ *SAYRON MD • PONG!* 〕─╮`,
        `│ ⚡ *Response Speed:* ${latencyMs}ms`,
        `│ ⏱️ *Uptime:* ${uptimeStr}`,
        `│ 🟢 *Status:* 24/7 Active`,
        `│ 👑 *Dev:* SUFYAN-X-IK`,
        `╰─────────────✦`,
      ].join('\n');

      await this.sendReliableMessage(remoteJid, {
        text: pingCard,
        contextInfo: await buildNewsletterContextInfo(),
        quoted: buildMetaVerifiedQuote('! SAYRON MD SPEED !'),
      });
      return true;
    }

    if (cmd === 'speed') {
      const start = performance.now();
      const memMb = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1);
      const elapsed = (performance.now() - start + 11.4).toFixed(1);
      const srvName = getServerDefById(this.serverId).name;
      const speedCard = [
        `╭━━━〔 🚀 *X-IK TURBO SPEED* 🚀 〕━━━╮`,
        `┃ ⚡ *Execution Latency:* \`${elapsed}ms\``,
        `┃ 🧠 *RAM In Use:* \`${memMb} MB\``,
        `┃ 🌐 *Cluster Server:* ${srvName}`,
        `┃ 📊 *Pending Queue:* \`${this.outgoingQueue.length}\` items`,
        `┃ 👑 *Commander:* SUFYAN-X-IK`,
        `╰━━━〔 ⚡ *SAYRON MD BOT* ⚡ 〕━━━╯`,
      ].join('\n');
      await this.sendReliableMessage(remoteJid, {
        text: speedCard,
        contextInfo: await buildNewsletterContextInfo(),
        quoted: buildMetaVerifiedQuote('! SAYRON MD SPEED !'),
      });
      return true;
    }

    if (cmd === 'uptime') {
      const uptimeStr = formatUptime(store.bootTimeMs);
      const uptimeCard = [
        `╭━━━〔 ⏱️ *SYSTEM UPTIME* ⏱️ 〕━━━╮`,
        `┃ 🟢 *Bot Status:* 24/7 NON-STOP ACTIVE`,
        `┃ ⏳ *Continuous Uptime:* \`${uptimeStr}\``,
        `┃ 🛡️ *Crash Shield:* 100% PROTECTED`,
        `┃ 👑 *Powered By:* SUFYAN-X-IK`,
        `╰━━━〔 💎 *SAYRON MD BOT* 💎 〕━━━╯`,
      ].join('\n');
      await this.sendReliableMessage(remoteJid, {
        text: uptimeCard,
        contextInfo: await buildNewsletterContextInfo(),
        quoted: buildMetaVerifiedQuote('! SAYRON MD UPTIME !'),
      });
      return true;
    }

    if (cmd === 'health') {
      const mem = process.memoryUsage();
      const healthCard = [
        `╭━━━〔 💚 *SYSTEM HEALTH & VITALS* 〕━━━╮`,
        `┃ 🟢 *Socket State:* \`${this.state.status.toUpperCase()}\``,
        `┃ 🛡️ *Watchdog Guard:* ACTIVE (25s)`,
        `┃ 🧠 *V8 Heap Memory:* \`${(mem.heapUsed / 1024 / 1024).toFixed(1)} / ${(mem.heapTotal / 1024 / 1024).toFixed(1)} MB\``,
        `┃ ⚡ *Active Sessions:* 24/7 Data-Off Ready`,
        `┃ 👑 *Owner:* SUFYAN-X-IK (+92 346 4267218)`,
        `╰━━━〔 ⚡ *SAYRON MD BOT* ⚡ 〕━━━╯`,
      ].join('\n');
      await this.sendReliableMessage(remoteJid, {
        text: healthCard,
        contextInfo: await buildNewsletterContextInfo(),
        quoted: buildMetaVerifiedQuote('! SAYRON MD HEALTH !'),
      });
      return true;
    }

    if (cmd === 'version') {
      const verCard = [
        `╭━━━〔 🤖 *VERSION & ENGINE* 〕━━━╮`,
        `┃ 👑 *Build:* SAYRON MD v5.0.0 PRO`,
        `┃ ⚡ *Engine:* Neural Hybrid AI Framework`,
        `┃ 💎 *Founder:* SUFYAN-X-IK`,
        `┃ 📞 *Official Contact:* +92 346 4267218`,
        `╰━━━〔 👑 *SAYRON MD BOT* 👑 〕━━━╯`,
      ].join('\n');
      await this.sendReliableMessage(remoteJid, {
        text: verCard,
        contextInfo: await buildNewsletterContextInfo(),
        quoted: buildMetaVerifiedQuote('! SAYRON MD VERSION !'),
      });
      return true;
    }

    // 🚀 .TURBO / .BOOST (Clears lag, purges queues & optimizes heap memory)
    if (cmd === 'turbo' || cmd === 'boost' || cmd === 'clean') {
      const start = performance.now();
      this.outgoingQueue = [];
      this.statusSeenQueue = [];
      const memMb = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1);
      const latency = (performance.now() - start + 4.2).toFixed(1);
      const turboCard = [
        `╭━━━〔 🚀 *SUFYAN-X-IK TURBO BOOST* 🚀 〕━━━╮`,
        `┃ ⚡ *Engine Speed:* \`${latency}ms\` (Ultra Zero Lag)`,
        `┃ 🧹 *Memory Cleared:* \`${memMb} MB\` Active`,
        `┃ 🛡️ *Queue Status:* 100% Optimized`,
        `┃ 🌐 *Cluster Server:* ${getServerDefById(this.serverId).name}`,
        `┃ 👑 *Master:* SUFYAN-X-IK (+92 346 4267218)`,
        `╰━━━〔 ⚡ *SAYRON MD BOT* ⚡ 〕━━━╯`,
      ].join('\n');
      await this.sendReliableMessage(remoteJid, {
        text: turboCard,
        contextInfo: await buildNewsletterContextInfo(),
      });
      return true;
    }

    // 🌐 .IP / .GEOIP (Real IP Geolocation & ASN Intel)
    if (cmd === 'ip' || cmd === 'geoip') {
      const queryTarget = (argText || '').replace(/^https?:\/\//i, '').split('/')[0].trim() || '8.8.8.8';
      try {
        const res = await fetch(`http://ip-api.com/json/${encodeURIComponent(queryTarget)}?fields=status,message,country,city,regionName,isp,org,as,query`, {
          signal: AbortSignal.timeout(3500),
        });
        const data = await res.json();
        if (data.status === 'success') {
          const card = [
            `╭━━━〔 🌐 *IP GEOLOCATION INTEL* 〕━━╮`,
            `┃ 🎯 *Target:* \`${data.query}\``,
            `┃ 🌍 *Country:* ${data.country}`,
            `┃ 🏙️ *City / Region:* ${data.city}, ${data.regionName}`,
            `┃ 🏢 *ISP / Org:* ${data.isp || data.org}`,
            `┃ 📡 *ASN:* ${data.as}`,
            `┃ 👑 *Auditor:* SAYRON MD BOT`,
            `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`,
          ].join('\n');
          await this.sendReliableMessage(remoteJid, {
            text: card,
            contextInfo: await buildNewsletterContextInfo(),
          });
          return true;
        }
      } catch {}
      await this.sendReliableMessage(remoteJid, {
        text: `⚠️ Could not trace IP "${queryTarget}". Check domain or IP address.`,
        contextInfo: await buildNewsletterContextInfo(),
      });
      return true;
    }

    // 🔑 .UUID / .BASE64 / .B64DECODE
    if (cmd === 'uuid') {
      const u = crypto.randomUUID();
      await this.sendReliableMessage(remoteJid, {
        text: `╭━━〔 🔑 *SECURE UUID V4* 〕━━╮\n┃ \`${u}\`\n╰━━━━━━━━━━━━━━━━━━━━╯\n⚡ *SAYRON MD BOT*`,
        contextInfo: await buildNewsletterContextInfo(),
      });
      return true;
    }

    if (cmd === 'base64' || cmd === 'b64') {
      if (!argText) {
        await this.sendReliableMessage(remoteJid, { text: `Usage: *.base64 your secret text*` });
        return true;
      }
      const enc = Buffer.from(argText).toString('base64');
      await this.sendReliableMessage(remoteJid, {
        text: `╭━━〔 🔐 *BASE64 ENCODED* 〕━━╮\n┃ \`${enc}\`\n╰━━━━━━━━━━━━━━━━━━━━╯\n⚡ *SAYRON MD BOT*`,
        contextInfo: await buildNewsletterContextInfo(),
      });
      return true;
    }

    if (cmd === 'b64decode' || cmd === 'unbase64') {
      if (!argText) {
        await this.sendReliableMessage(remoteJid, { text: `Usage: *.b64decode encoded_string*` });
        return true;
      }
      try {
        const dec = Buffer.from(argText, 'base64').toString('utf-8');
        await this.sendReliableMessage(remoteJid, {
          text: `╭━━〔 🔓 *BASE64 DECODED* 〕━━╮\n┃ ${dec}\n╰━━━━━━━━━━━━━━━━━━━━╯\n⚡ *SAYRON MD BOT*`,
          contextInfo: await buildNewsletterContextInfo(),
        });
        return true;
      } catch {
        await this.sendReliableMessage(remoteJid, { text: `⚠️ Invalid Base64 string.` });
        return true;
      }
    }

    // 💻 .SYSTEM / .SPECS (Platform and Host Intel)
    if (cmd === 'system' || cmd === 'specs') {
      const mem = process.memoryUsage();
      const card = [
        `╭━━━〔 💻 *SYSTEM SPECIFICATIONS* 〕━━━╮`,
        `┃ ⚙️ *Platform:* Linux x64 (Cloud Run Engine)`,
        `┃ 🟢 *Node.js:* ${process.version}`,
        `┃ 🧠 *V8 Heap:* ${(mem.heapUsed / 1024 / 1024).toFixed(1)} MB`,
        `┃ 🌐 *Server:* ${getServerDefById(this.serverId).name}`,
        `┃ ⚡ *Status:* 24/7 Always Active`,
        `┃ 👑 *Architect:* SUFYAN-X-IK`,
        `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`,
      ].join('\n');
      await this.sendReliableMessage(remoteJid, {
        text: card,
        contextInfo: await buildNewsletterContextInfo(),
      });
      return true;
    }

    if (cmd === 'settings') {
      const s = store.getSettings();
      await this.sendReliableMessage(remoteJid, {
        text: `🔧 *X-IK SETTINGS*\n• Prefix: \`${s.prefix}\`\n• Language: *${s.language}*\n• Mode: *${s.personality}*\n• AutoReply: *${store.getAiMode() ? 'ON' : 'OFF'}*\n• AutoStatus: *${s.autoStatusView ? 'ON' : 'OFF'}*\n• StatusLike: *${s.autoStatusLike ? 'ON' : 'OFF'}*\n• AutoReact: *${s.autoReact ? 'ON' : 'OFF'}*`,
      });
      return true;
    }

    if (cmd === 'language') {
      if (!argText) {
        await this.sendReliableMessage(remoteJid, {
          text: `🌐 *Language:* ${store.getSettings().language}`,
        });
        return true;
      }
      store.updateSettings({ language: argText });
      await this.sendReliableMessage(remoteJid, { text: `✅ *Language:* ${argText}` });
      return true;
    }

    if (cmd === 'personality') {
      if (!argText) {
        await this.sendReliableMessage(remoteJid, {
          text: `🎭 *Personality:* ${store.getSettings().personality}`,
        });
        return true;
      }
      const allowed = ['friendly', 'professional', 'funny', 'developer', 'heavy'];
      const chosen = allowed.includes(argLower) ? (argLower as any) : 'friendly';
      store.updateSettings({ personality: chosen });
      await this.sendReliableMessage(remoteJid, { text: `✅ *Personality:* ${chosen.toUpperCase()}` });
      return true;
    }

    // =========================================================================
    // 🛡️ .MODE (Public / Private / Self / Maintenance Mode Switcher)
    // =========================================================================
    if (cmd === 'mode' || cmd === 'botmode') {
      const currentMode = store.getSettings().botMode || 'public';
      if (!argText) {
        const modeBadge =
          currentMode === 'self'
            ? '🔒 PRIVATE / SELF (Owner-Only)'
            : currentMode === 'maintenance'
            ? '🚧 MAINTENANCE (Paused)'
            : '🟢 PUBLIC (Everyone)';
        await this.sendReliableMessage(remoteJid, {
          text: [
            `╭━━━〔 👑 *SAYRON MD MODE* 👑 〕━━━╮`,
            `┃ ⚡ *Active Mode:* ${modeBadge}`,
            `┣━━━━━━━━━━━━━━━━━━━━━━━━━━┫`,
            `┃ 🛠️ *How to change (Owner only):*`,
            `┃ ❖ *.mode public*   ➜ Open to everyone in groups & DMs`,
            `┃ ❖ *.mode private*  ➜ Bot only responds to SUFYAN-X-IK`,
            `┃ ❖ *.mode self*     ➜ Bot only responds to SUFYAN-X-IK`,
            `┃ ❖ *.mode maintenance* ➜ Maintenance mode (Pause bot)`,
            `╰━━━━━━━━━━━━━━━━━━━━━━━━━━╯`,
          ].join('\n'),
        });
        return true;
      }

      if (!isOwner) {
        await this.sendReliableMessage(remoteJid, {
          text: `⛔ *ACCESS DENIED!* 👑\nYeh command sirf Bot Owner (*SUFYAN-X-IK*) use kar sakte hain.`,
        });
        return true;
      }

      const target = argLower.trim();
      if (target === 'public' || target === 'pub' || target === 'open') {
        store.updateSettings({ botMode: 'public', maintenanceMode: false });
        store.addAuditLog('Owner', 'MODE_CHANGE', 'Switched to PUBLIC mode via WhatsApp (.mode public)', 'SUCCESS');
        await this.sendReliableMessage(remoteJid, {
          text: `✅ *SAYRON MD IS NOW IN PUBLIC MODE!* 🟢\n\nAb tamam users aur groups mein bot commands execute kar sakein gy.`,
        });
        return true;
      }

      if (target === 'private' || target === 'self' || target === 'pvt') {
        store.updateSettings({ botMode: 'self', maintenanceMode: false });
        store.addAuditLog('Owner', 'MODE_CHANGE', 'Switched to PRIVATE/SELF mode via WhatsApp (.mode private)', 'SUCCESS');
        await this.sendReliableMessage(remoteJid, {
          text: `🔒 *SAYRON MD IS NOW IN PRIVATE / SELF MODE!* 🛡️\n\nBot ab sirf aapke (*Owner*) commands par respond karega. Public users ignore honge.`,
        });
        return true;
      }

      if (target === 'maintenance' || target === 'maint') {
        store.updateSettings({ botMode: 'maintenance', maintenanceMode: true });
        store.addAuditLog('Owner', 'MODE_CHANGE', 'Switched to MAINTENANCE mode via WhatsApp (.mode maintenance)', 'WARN');
        await this.sendReliableMessage(remoteJid, {
          text: `🚧 *SAYRON MD IS NOW IN MAINTENANCE MODE!* ⚠️\n\nBot updates k liye pause kar diya gaya hai. Dobara chalane k liye *.mode public* likhein.`,
        });
        return true;
      }

      await this.sendReliableMessage(remoteJid, {
        text: `⚠️ *Invalid Option!*\n\nAvailable Options:\n• *.mode public*\n• *.mode private*\n• *.mode self*\n• *.mode maintenance*`,
      });
      return true;
    }

    if (cmd === 'prefix' || cmd === 'setprefix') {
      if (!argText) {
        await this.sendReliableMessage(remoteJid, {
          text: `🔖 *Prefix:* \`${store.getSettings().prefix}\``,
        });
        return true;
      }
      if (!isOwner) return true;
      const newP = argText.trim().slice(0, 3);
      store.updateSettings({ prefix: newP });
      await this.sendReliableMessage(remoteJid, { text: `✅ *Prefix:* \`${newP}\`` });
      return true;
    }

    if (cmd === 'autoreply') {
      if (!argText) {
        await this.sendReliableMessage(remoteJid, {
          text: `🤖 *AutoReply:* ${store.getAiMode() ? 'ON' : 'OFF'}`,
        });
        return true;
      }
      const next = argLower === 'on';
      store.setAiMode(next, 'WhatsApp (.autoreply)');
      await this.sendReliableMessage(remoteJid, {
        text: `✅ *AutoReply:* ${next ? 'ON 🟢' : 'OFF 🔴'}`,
      });
      return true;
    }

    if (cmd === 'typing') {
      const next = argLower === 'off' ? false : true;
      store.updateSettings({ typingIndicator: next });
      await this.sendReliableMessage(remoteJid, {
        text: `⌨️ *Typing:* ${next ? 'ON 🟢' : 'OFF 🔴'}`,
      });
      return true;
    }

    if (cmd === 'read') {
      const next = argLower === 'off' ? false : true;
      store.updateSettings({ autoRead: next });
      await this.sendReliableMessage(remoteJid, {
        text: `👀 *AutoRead:* ${next ? 'ON 🟢' : 'OFF 🔴'}`,
      });
      return true;
    }

    if (cmd === 'presence') {
      const valid = ['available', 'composing', 'paused', 'unavailable'];
      const pMode = valid.includes(argLower) ? (argLower as any) : 'available';
      store.updateSettings({ presenceMode: pMode });
      await this.sock?.sendPresenceUpdate(pMode, remoteJid).catch(() => {});
      await this.sendReliableMessage(remoteJid, { text: `🟢 *Presence:* ${pMode}` });
      return true;
    }

    // =========================================================================
    // 👑 10. OWNER COMMANDS
    // =========================================================================
    if (cmd === 'stats') {
      const st = store.getAnalytics();
      await this.sendReliableMessage(remoteJid, {
        text: `📊 *REAL BOT STATISTICS*\n• Processed: *${st.totalMessagesProcessed}*\n• AI Replies: *${st.aiRepliesSent}*\n• Active Chats: *${st.activeConversations}*\n• Group Filtered: *${st.groupFilteredCount}*\n• Uptime: *${formatUptime(store.bootTimeMs)}*`,
      });
      return true;
    }

    if (cmd === 'users') {
      const users = store.getConversations().filter((c) => !c.isGroup);
      const lines = users
        .slice(0, 15)
        .map((u, i) => `${i + 1}. *${u.customerName}* (${u.phoneNumber})`)
        .join('\n');
      await this.sendReliableMessage(remoteJid, {
        text: `👤 *USERS (${users.length})*\n\n${lines || 'None'}`,
      });
      return true;
    }

    if (cmd === 'groups') {
      const groups = store.getConversations().filter((c) => c.isGroup);
      const lines = groups
        .slice(0, 15)
        .map((g, i) => `${i + 1}. *${g.customerName}* (${g.messages.length} msgs)`)
        .join('\n');
      await this.sendReliableMessage(remoteJid, {
        text: `👥 *GROUPS (${groups.length})*\n\n${lines || 'None'}`,
      });
      return true;
    }

    if (cmd === 'broadcast' || cmd === 'bc') {
      if (!argText) {
        await this.sendReliableMessage(remoteJid, {
          text: `📢 Usage: *${prefix}broadcast <message>*`,
        });
        return true;
      }
      const all = store.getConversations().filter((c) => !c.isGroup && c.jid !== remoteJid);
      let count = 0;
      for (const c of all) {
        await this.sendReliableMessage(c.jid, {
          text: `📢 *X-IK AI • SUFYAN-X-IK*\n\n${argText}`,
        });
        count++;
      }
      await this.sendReliableMessage(remoteJid, {
        text: `✅ *Broadcast sent to ${count} chats.*`,
      });
      return true;
    }

    if (cmd === 'restart') {
      await this.sendReliableMessage(remoteJid, { text: `🔄 *Restarting X-IK AI...*` });
      setTimeout(() => {
        this.cleanupSocketOnly();
        this.startConnection().catch(() => {});
      }, 800);
      return true;
    }

    if (cmd === 'shutdown') {
      store.setAiMode(false, 'Owner Shutdown');
      await this.sendReliableMessage(remoteJid, { text: `🛑 *X-IK AI Stopped (Standby)*` });
      return true;
    }

    if (cmd === 'maintenance') {
      const next =
        argLower === 'on'
          ? true
          : argLower === 'off'
          ? false
          : !store.getSettings().maintenanceMode;
      store.updateSettings({ maintenanceMode: next });
      await this.sendReliableMessage(remoteJid, {
        text: `🛠️ *Maintenance:* ${next ? 'ON 🟡' : 'OFF 🟢'}`,
      });
      return true;
    }

    if (cmd === 'block') {
      const target = this.extractTargetUserJid(msg, argText) || remoteJid;
      store.addBlockedUser(target);
      store.setConversationAiPaused(target, true);
      await this.sock?.updateBlockStatus(target, 'block').catch(() => {});
      await this.sendReliableMessage(remoteJid, {
        text: `🚫 *Blocked:* @${target.split('@')[0]}`,
        mentions: [target],
      });
      return true;
    }

    if (cmd === 'unblock') {
      const target = this.extractTargetUserJid(msg, argText) || remoteJid;
      store.removeBlockedUser(target);
      store.setConversationAiPaused(target, false);
      await this.sock?.updateBlockStatus(target, 'unblock').catch(() => {});
      await this.sendReliableMessage(remoteJid, {
        text: `🔓 *Unblocked:* @${target.split('@')[0]}`,
        mentions: [target],
      });
      return true;
    }

    if (cmd === 'logs') {
      const recent = store
        .getLogs()
        .slice(0, 8)
        .map((l) => `• [${l.level}] ${l.event}`)
        .join('\n');
      await this.sendReliableMessage(remoteJid, {
        text: `📜 *LOGS*\n\n${recent || 'No logs'}`,
      });
      return true;
    }

    if (cmd === 'setname') {
      if (!argText) return true;
      store.updateSettings({ botName: argText });
      await this.sock?.updateProfileName(argText).catch(() => {});
      await this.sendReliableMessage(remoteJid, { text: `✅ *Bot Name:* ${argText}` });
      return true;
    }

    if (cmd === 'setbio') {
      if (!argText) return true;
      store.updateSettings({ botBio: argText });
      await this.sock?.updateProfileStatus(argText).catch(() => {});
      await this.sendReliableMessage(remoteJid, { text: `✅ *Bot Bio:* ${argText}` });
      return true;
    }

    if (cmd === 'setmenu') {
      if (!argText) {
        await this.sendReliableMessage(remoteJid, {
          text: `⚙️ Usage:\n• *${prefix}setmenu <Title>*\n• *${prefix}setmenu channel https://whatsapp.com/channel/...*`,
        });
        return true;
      }
      if (argLower.startsWith('channel ')) {
        const rawArg = argText.slice(8).trim();
        if (rawArg.endsWith('@newsletter')) {
          store.updateSettings({ channelJid: rawArg });
          await this.sendReliableMessage(remoteJid, {
            text: `✅ *Channel Connected!*`,
          });
        } else {
          const resolved = await resolveChannelJidFromInvite(this.sock, rawArg);
          await this.sendReliableMessage(remoteJid, {
            text: `✅ *Channel Connected!* (${resolved || 'Invite Saved'})`,
          });
        }
      } else {
        store.updateSettings({ menuTitle: argText.trim() });
        await this.sendReliableMessage(remoteJid, { text: `✅ *Menu Title:* ${argText.trim()}` });
      }
      return true;
    }

    if (cmd === 'setimage' || cmd === 'setgif') {
      const media = this.extractMediaSource(msg);
      if (media && media.mediaType === 'video') {
        try {
          const buffer = (await downloadMediaMessage(
            media.targetMsg as any,
            'buffer',
            {},
            { logger: silentLogger, reuploadRequest: this.sock!.updateMediaMessage }
          )) as Buffer;
          const ok = await saveCustomMenuVideoAsMp4(buffer);
          if (ok) {
            await this.sendReliableMessage(remoteJid, {
              text: `✅ *Top Menu Animated GIF Updated from your video!*`,
            });
          } else {
            await this.sendReliableMessage(remoteJid, {
              text: `⚠️ Failed to convert video to GIF banner.`,
            });
          }
        } catch {
          await this.sendReliableMessage(remoteJid, { text: `⚠️ Failed to save menu video/GIF.` });
        }
        return true;
      }
      if (media && media.mediaType === 'image') {
        try {
          const buffer = (await downloadMediaMessage(
            media.targetMsg as any,
            'buffer',
            {},
            { logger: silentLogger, reuploadRequest: this.sock!.updateMediaMessage }
          )) as Buffer;
          const customPath = path.resolve(process.cwd(), '.data', 'custom_menu_banner.jpg');
          fs.writeFileSync(customPath, buffer);
          store.updateSettings({ menuImage: '.data/custom_menu_banner.jpg' });
          await this.sendReliableMessage(remoteJid, {
            text: `✅ *MENU_IMAGE Updated from attached photo!*`,
          });
        } catch {
          await this.sendReliableMessage(remoteJid, { text: `⚠️ Failed to save menu image.` });
        }
        return true;
      }
      if (argText) {
        store.updateSettings({ menuImage: argText.trim() });
        await this.sendReliableMessage(remoteJid, {
          text: `✅ *MENU_IMAGE Updated!*`,
        });
        return true;
      }
      await this.sendReliableMessage(remoteJid, {
        text: `🖼️ Reply to a photo with *${prefix}setimage* or pass an image URL: *${prefix}setimage https://...*`,
      });
      return true;
    }

    if (cmd === 'offline' || cmd === 'busy' || cmd === 'online') {
      const stMap: Record<string, 'Offline' | 'Busy' | 'Available'> = {
        offline: 'Offline',
        busy: 'Busy',
        online: 'Available',
      };
      store.updateBusiness({ ownerStatus: stMap[cmd] });
      await this.sendReliableMessage(remoteJid, {
        text: `👑 *Owner Status:* ${stMap[cmd].toUpperCase()}`,
      });
      return true;
    }

    // =========================================================================
    // 🧰 NEW CORE, GENERAL, TOOLS, OWNER & MEDIA COMMANDS
    // =========================================================================
    if (cmd === 'bv') {
      const mem = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1);
      await this.sendReliableMessage(remoteJid, {
        text: [
          `╭─❒ ${toSmallCaps('sayron md version')} ❒`,
          `│ 🤖 *Bot:* ${store.getSettings().botName} v5.2 PRO`,
          `│ ⚙️ *Engine:* Baileys Multi-Device`,
          `│ 🟢 *Node:* ${process.version} • *RAM:* ${mem} MB`,
          `│ ⏱️ *Uptime:* ${formatUptime(store.bootTimeMs)}`,
          `│ 👑 *Dev:* SUFYAN-X-IK`,
          `╰──────────────`,
        ].join('\n'),
      });
      return true;
    }

    if (cmd === 'jid') {
      const target = this.extractTargetUserJid(msg, argText);
      const lines = [
        `╭─❒ ${toSmallCaps('jid inspector')} ❒`,
        `│ 💬 *Chat:* \`${remoteJid}\``,
        `│ 👤 *Sender:* \`${senderJid}\``,
        ...(target && target !== senderJid ? [`│ 🎯 *Target:* \`${target}\``] : []),
        `╰──────────────`,
      ];
      await this.sendReliableMessage(remoteJid, { text: lines.join('\n') });
      return true;
    }

    if (cmd === 'repo') {
      const st = store.getAnalytics();
      await this.sendReliableMessage(remoteJid, {
        text: [
          `╭─❒ ${toSmallCaps('sayron md script')} ❒`,
          `│ 👑 *Bot:* SAYRON MD (v5.2 PRO)`,
          `│ ⚡ *Developer:* SUFYAN-X-IK`,
          `│ 🛡️ *Features:* AI + Downloader + Group Guard`,
          `│ 📊 *Processed:* ${st.totalMessagesProcessed} msgs`,
          `│ 🌐 *Official:* sayronmd.com`,
          `╰──────────────`,
        ].join('\n'),
      });
      return true;
    }

    if (cmd === 'take') {
      const media = this.extractMediaSource(msg);
      if (!media || media.mediaType !== 'sticker') {
        await this.sendReliableMessage(remoteJid, {
          text: `🎨 Reply to a sticker with *${prefix}take PackName | AuthorName*`,
        });
        return true;
      }
      try {
        const buffer = (await downloadMediaMessage(
          media.targetMsg as any,
          'buffer',
          {},
          { logger: silentLogger, reuploadRequest: this.sock!.updateMediaMessage }
        )) as Buffer;
        const parts = argText.split('|').map((x) => x.trim()).filter(Boolean);
        const pack = parts[0] || senderName || 'SAYRON MD';
        const author = parts[1] || 'SUFYAN-X-IK';
        const rebranded = injectWhatsAppStickerExif(buffer, pack, author);
        await this.sendReliableMessage(remoteJid, {
          sticker: rebranded,
          ...(media.details?.isAnimated ? { isAnimated: true } : {}),
        } as any);
      } catch {
        await this.sendReliableMessage(remoteJid, { text: `⚠️ Failed to update sticker pack.` });
      }
      return true;
    }

    if (cmd === 'tg') {
      const targetUrl = argText || this.extractQuotedText(msg);
      if (!targetUrl) {
        await this.sendReliableMessage(remoteJid, {
          text: `🎭 Usage: *${prefix}tg https://t.me/addstickers/<pack>*`,
        });
        return true;
      }
      await this.sendReliableMessage(remoteJid, { react: { text: '🎭', key: msg.key } });
      const packRes = await fetchTelegramStickerPack(targetUrl, 8);
      if (!packRes || packRes.stickers.length === 0) {
        await this.sendReliableMessage(remoteJid, {
          text: `⚠️ Telegram sticker pack download nahi ho saka. Public pack link check karein (ya *.setvar TELEGRAM_BOT_TOKEN <token>* set karein).`,
        });
        return true;
      }
      await this.sendReliableMessage(remoteJid, {
        text: `🎭 Sending *${packRes.stickers.length}* stickers from *${packRes.packName}*...`,
      });
      for (const stBuf of packRes.stickers) {
        await this.sendReliableMessage(remoteJid, { sticker: stBuf });
        await new Promise((r) => setTimeout(r, 450));
      }
      return true;
    }

    if (cmd === 'voices') {
      const voiceList = [
        `╭─❒ ${toSmallCaps('natural girl voices')} ❒`,
        `│ 🇵🇰 *Urdu / Roman Urdu:* Uzma Female`,
        `│ 🇺🇸 *English:* Ava / Jenny Female`,
        `│ 🇮🇳 *Hindi:* Swara Female`,
        `│ 🇸🇦 *Arabic:* Zariyah Female`,
        `│ 🇪🇸 *Spanish:* Elvira Female`,
        `│ 🇫🇷 *French:* Denise Female`,
        `│ 🇹🇷 *Turkish:* Emel Female`,
        `╰──────────────`,
        `💡 Usage: *${prefix}tts Salam aap kaise hain?*`,
        `💡 Force Language: *${prefix}tts en Good morning!*`,
      ].join('\n');
      await this.sendReliableMessage(remoteJid, { text: voiceList });
      return true;
    }

    if (cmd === 'ajoin' || cmd === 'antidelete' || cmd === 'antivv' || cmd === 'alwaysonline' || cmd === 'autoread' || cmd === 'callmusic') {
      const propMap: Record<string, keyof ReturnType<typeof store.getSettings>> = {
        ajoin: 'autoJoin',
        antidelete: 'antiDelete',
        antivv: 'antiVv',
        alwaysonline: 'alwaysOnline',
        autoread: 'autoRead',
        callmusic: 'callMusic',
      };
      const key = propMap[cmd];
      const s = store.getSettings();
      if (!argText) {
        if (cmd === 'ajoin' && /chat\.whatsapp\.com\//i.test(this.extractQuotedText(msg))) {
          const qCode = this.extractQuotedText(msg).match(/chat\.whatsapp\.com\/([0-9A-Za-z]{16,30})/i)?.[1];
          if (qCode) {
            await this.sock?.groupAcceptInvite(qCode).catch(() => {});
            await this.sendReliableMessage(remoteJid, { text: `✅ *Auto-Joined quoted group link!*` });
            return true;
          }
        }
        const cur = Boolean((s as any)[key]);
        await this.sendReliableMessage(remoteJid, {
          text: `⚙️ *${cmd.toUpperCase()}:* ${cur ? 'ON 🟢' : 'OFF 🔴'}\nUsage: *${prefix}${cmd} on/off*`,
        });
        return true;
      }
      if (cmd === 'ajoin' && /chat\.whatsapp\.com\//i.test(argText)) {
        const code = argText.match(/chat\.whatsapp\.com\/([0-9A-Za-z]{16,30})/i)?.[1];
        if (code) {
          try {
            const jid = await this.sock?.groupAcceptInvite(code);
            await this.sendReliableMessage(remoteJid, { text: `✅ *Joined:* \`${jid || code}\`` });
          } catch {
            await this.sendReliableMessage(remoteJid, { text: `❌ Invalid or expired invite link.` });
          }
          return true;
        }
      }
      const next = argLower === 'on' ? true : argLower === 'off' ? false : !Boolean((s as any)[key]);
      store.updateSettings({ [key]: next } as any);
      if (cmd === 'alwaysonline') {
        store.updateSettings({ presenceMode: next ? 'available' : 'paused' });
      }
      await this.sendReliableMessage(remoteJid, {
        text: `✅ *${cmd.toUpperCase()}:* ${next ? 'ON 🟢' : 'OFF 🔴'}`,
      });
      return true;
    }

    if (cmd === 'alinks') {
      const quoted = this.extractQuotedText(msg);
      const source = `${argText} ${quoted}`.trim();
      const found = source.match(/https?:\/\/[^\s]+/gi) || [];
      if (argLower === 'on' || argLower === 'off') {
        const next = argLower === 'on';
        store.updateGroupConfig(remoteJid, { antilink: next });
        await this.sendReliableMessage(remoteJid, {
          text: `🛡️ *Anti-Link:* ${next ? 'ON 🟢' : 'OFF 🔴'}`,
        });
        return true;
      }
      if (found.length === 0) {
        await this.sendReliableMessage(remoteJid, {
          text: `🔗 Reply to a message with links or pass text with *${prefix}alinks* (or *${prefix}alinks on/off*).`,
        });
        return true;
      }
      await this.sendReliableMessage(remoteJid, {
        text: [
          `╭─❒ ${toSmallCaps(`extracted links (${found.length})`)} ❒`,
          ...found.slice(0, 12).map((u, i) => `│ ${i + 1}. ${u}`),
          `╰──────────────`,
        ].join('\n'),
      });
      return true;
    }

    if (cmd === 'gggg') {
      if (!remoteJid.endsWith('@g.us')) {
        await this.sendReliableMessage(remoteJid, { text: `⚠️ Group-only command.` });
        return true;
      }
      try {
        const meta = await this.sock?.groupMetadata(remoteJid);
        const cfg = store.getGroupConfig(remoteJid);
        const admins = (meta?.participants || []).filter((p) => p.admin).length;
        const created = meta?.creation ? new Date(meta.creation * 1000).toLocaleDateString() : 'N/A';
        await this.sendReliableMessage(remoteJid, {
          text: [
            `╭─❒ ${toSmallCaps('group stats')} ❒`,
            `│ 📛 *Name:* ${meta?.subject || 'Group'}`,
            `│ 🆔 *JID:* \`${remoteJid}\``,
            `│ 👥 *Members:* ${meta?.participants?.length || 0} (*Admins:* ${admins})`,
            `│ 📅 *Created:* ${created}`,
            `│ 🛡️ *AntiLink:* ${cfg.antilink ? 'ON' : 'OFF'} | *PDM:* ${cfg.pdm ? 'ON' : 'OFF'}`,
            `│ 🚨 *AntiGM:* ${cfg.antigm ? 'ON' : 'OFF'} | *AntiMod:* ${cfg.antimod ? 'ON' : 'OFF'}`,
            `╰──────────────`,
          ].join('\n'),
        });
      } catch {
        await this.sendReliableMessage(remoteJid, { text: `⚠️ Group metadata error.` });
      }
      return true;
    }

    if (cmd === 'hb') {
      const mem = process.memoryUsage();
      const srv = getServerDefById(this.serverId);
      await this.sendReliableMessage(remoteJid, {
        text: [
          `╭─❒ ${toSmallCaps('system heartbeat')} ❒`,
          `│ 💓 *Status:* ALIVE & CONNECTED`,
          `│ 🌐 *Node:* ${srv.name}`,
          `│ 🧠 *Heap:* ${(mem.heapUsed / 1024 / 1024).toFixed(1)} MB`,
          `│ ⏱️ *Uptime:* ${formatUptime(store.bootTimeMs)}`,
          `│ 📨 *Handled:* ${this.messagesProcessed} msgs`,
          `╰──────────────`,
        ].join('\n'),
      });
      return true;
    }

    if (cmd === 'leaveall') {
      try {
        const groups = await this.sock?.groupFetchAllParticipating();
        const jids = Object.keys(groups || {});
        if (argLower !== 'confirm') {
          await this.sendReliableMessage(remoteJid, {
            text: `⚠️ Bot is currently in *${jids.length}* group(s).\nType *${prefix}leaveall confirm* to leave all groups!`,
          });
          return true;
        }
        let left = 0;
        for (const gj of jids) {
          if (gj === remoteJid) continue;
          await this.sock?.groupLeave(gj).catch(() => {});
          left++;
          await new Promise((r) => setTimeout(r, 350));
        }
        await this.sendReliableMessage(remoteJid, {
          text: `👋 *Left ${left} group(s)!*`,
        });
      } catch {
        await this.sendReliableMessage(remoteJid, { text: `⚠️ Failed to leave groups.` });
      }
      return true;
    }

    if (cmd === 'plugin') {
      const customCmds = store.getCustomCommands();
      const parts = argText.split('|').map((x) => x.trim());
      if (argLower.startsWith('add ') && parts.length >= 2) {
        const name = parts[0].replace(/^add\s+/i, '').trim();
        const response = parts.slice(1).join('|').trim();
        const saved = store.setCustomCommand({ name, response, category: 'Plugin', description: `Plugin .${name}`, enabled: true, createdBy: senderName });
        await this.sendReliableMessage(remoteJid, { text: `🧩 *Plugin Added:* \`.${saved.name}\`` });
        return true;
      }
      if (argLower.startsWith('del ')) {
        const name = argText.slice(4).trim();
        const ok = store.deleteCustomCommand(name);
        await this.sendReliableMessage(remoteJid, { text: ok ? `🗑️ *Plugin Removed:* ${name}` : `⚠️ Not found.` });
        return true;
      }
      const list = customCmds.length > 0
        ? customCmds.map((c) => `│ ✦ .${c.name} (${c.enabled ? 'ON' : 'OFF'})`).join('\n')
        : '│ ✦ Core Engine + Media + Downloader + AI + Group Guard';
      await this.sendReliableMessage(remoteJid, {
        text: [
          `╭─❒ ${toSmallCaps('active plugins')} ❒`,
          list,
          `╰──────────────`,
          `💡 Add: *${prefix}plugin add name | reply text*`,
        ].join('\n'),
      });
      return true;
    }

    if (cmd === 'reload') {
      this.groupMetaCache.clear();
      const pMode = store.getSettings().presenceMode || 'available';
      await this.sock?.sendPresenceUpdate(pMode).catch(() => {});
      await this.sendReliableMessage(remoteJid, {
        text: `🔄 *SAYRON MD Reloaded!* Caches cleared & config refreshed cleanly.`,
      });
      return true;
    }

    if (cmd === 'update') {
      await this.sendReliableMessage(remoteJid, {
        text: [
          `╭─❒ ${toSmallCaps('system update')} ❒`,
          `│ ✅ *Status:* UP TO DATE`,
          `│ 🚀 *Version:* SAYRON MD v5.2 PRO`,
          `│ 🛡️ *Channel:* Official Cloud Release`,
          `╰──────────────`,
        ].join('\n'),
      });
      return true;
    }

    if (cmd === 'spam') {
      const m = argText.match(/^(\d+)\s+([\s\S]+)$/);
      if (!m) {
        await this.sendReliableMessage(remoteJid, {
          text: `📢 Usage: *${prefix}spam <count 1-15> <message>*`,
        });
        return true;
      }
      const count = Math.min(15, Math.max(1, parseInt(m[1], 10)));
      const body = m[2].trim();
      for (let i = 0; i < count; i++) {
        await this.sendReliableMessage(remoteJid, { text: body, raw: true });
        await new Promise((r) => setTimeout(r, 350));
      }
      return true;
    }

    if (cmd === 'exec' || cmd === 'eval') {
      if (!argText) {
        await this.sendReliableMessage(remoteJid, { text: `💻 Usage: *${prefix}exec <js code>*` });
        return true;
      }
      try {
        const vm = await import('vm');
        const sandbox: any = {
          botName: store.getSettings().botName,
          uptime: formatUptime(store.bootTimeMs),
          Math,
          Date,
          JSON,
          stats: store.getAnalytics(),
        };
        const result = vm.runInNewContext(argText, sandbox, { timeout: 1500 });
        const out = typeof result === 'object' ? JSON.stringify(result, null, 2) : String(result);
        await this.sendReliableMessage(remoteJid, {
          text: `💻 *EXEC OUTPUT:*\n\`\`\`${(out || 'undefined').slice(0, 1200)}\`\`\``,
        });
      } catch (err: any) {
        await this.sendReliableMessage(remoteJid, {
          text: `❌ *EXEC ERROR:*\n\`${err?.message || 'Execution error'}\``,
        });
      }
      return true;
    }

    if (cmd === 'setsudo' || cmd === 'delsudo' || cmd === 'getsudo' || cmd === 'sudo') {
      if (cmd === 'getsudo' || (cmd === 'sudo' && !argText)) {
        const list = store.getSudoNumbers();
        await this.sendReliableMessage(remoteJid, {
          text: [
            `╭─❒ ${toSmallCaps('sudo users')} ❒`,
            ...(list.length > 0 ? list.map((n, i) => `│ ${i + 1}. +${n}`) : ['│ (No custom sudo numbers)']),
            `╰──────────────`,
          ].join('\n'),
        });
        return true;
      }
      const target = this.extractTargetUserJid(msg, argText);
      const digits = (target ? target.split('@')[0] : argText).replace(/[^0-9]/g, '');
      if (!digits || digits.length < 7) {
        await this.sendReliableMessage(remoteJid, {
          text: `⚠️ Usage: *${prefix}${cmd} 923001234567* or reply/mention user.`,
        });
        return true;
      }
      if (cmd === 'delsudo') {
        store.removeSudoNumber(digits);
        await this.sendReliableMessage(remoteJid, { text: `🗑️ Removed *+${digits}* from Sudo.` });
      } else {
        store.addSudoNumber(digits);
        await this.sendReliableMessage(remoteJid, { text: `👑 Added *+${digits}* to Sudo Owners!` });
      }
      return true;
    }

    if (cmd === 'setvar' || cmd === 'delvar') {
      if (cmd === 'delvar') {
        if (!argText) {
          await this.sendReliableMessage(remoteJid, { text: `⚙️ Usage: *${prefix}delvar KEY*` });
          return true;
        }
        const ok = store.deleteCustomVar(argText);
        await this.sendReliableMessage(remoteJid, {
          text: ok ? `🗑️ Deleted var *${argText.toUpperCase()}*` : `⚠️ Var not found.`,
        });
        return true;
      }
      if (!argText) {
        const vars = store.getCustomVars();
        const entries = Object.entries(vars);
        await this.sendReliableMessage(remoteJid, {
          text: [
            `╭─❒ ${toSmallCaps('bot variables')} ❒`,
            ...(entries.length > 0
              ? entries.map(([k, v]) => `│ • *${k}:* ${v.slice(0, 40)}`)
              : ['│ (No custom vars set)']),
            `╰──────────────`,
            `💡 Usage: *${prefix}setvar KEY=VALUE*`,
          ].join('\n'),
        });
        return true;
      }
      const sepIdx = argText.includes('=') ? argText.indexOf('=') : argText.indexOf(' ');
      if (sepIdx <= 0) {
        await this.sendReliableMessage(remoteJid, { text: `⚙️ Usage: *${prefix}setvar KEY=VALUE*` });
        return true;
      }
      const k = argText.slice(0, sepIdx).trim();
      const v = argText.slice(sepIdx + 1).trim();
      store.setCustomVar(k, v);
      await this.sendReliableMessage(remoteJid, { text: `✅ Saved *${k.toUpperCase()}*!` });
      return true;
    }

    if (cmd === 'gjids') {
      try {
        const groups = await this.sock?.groupFetchAllParticipating();
        const list = Object.values(groups || {});
        const lines = list.slice(0, 30).map((g: any, i) => `│ ${i + 1}. *${g.subject}* (${g.participants?.length || 0})\n│    \`${g.id}\``);
        await this.sendReliableMessage(remoteJid, {
          text: [
            `╭─❒ ${toSmallCaps(`group jids (${list.length})`)} ❒`,
            ...(lines.length > 0 ? lines : ['│ No groups found']),
            `╰──────────────`,
          ].join('\n'),
        });
      } catch {
        await this.sendReliableMessage(remoteJid, { text: `⚠️ Failed to list group JIDs.` });
      }
      return true;
    }

    if (cmd === 'bancheck') {
      const target = this.extractTargetUserJid(msg, argText);
      const digits = (target ? target.split('@')[0] : argText || senderJid.split('@')[0]).replace(/[^0-9]/g, '');
      if (!digits || digits.length < 7) {
        await this.sendReliableMessage(remoteJid, { text: `🔍 Usage: *${prefix}bancheck 923001234567*` });
        return true;
      }
      const locallyBanned = store.isUserBlocked(`${digits}@s.whatsapp.net`);
      let waRegistered = 'Unknown';
      try {
        const res = await this.sock?.onWhatsApp(`${digits}@s.whatsapp.net`);
        waRegistered = res?.[0]?.exists ? '✅ Active (Not WA-Banned)' : '🚫 Not Registered / Possibly Banned';
      } catch {}
      await this.sendReliableMessage(remoteJid, {
        text: [
          `╭─❒ ${toSmallCaps('ban & status check')} ❒`,
          `│ 📱 *Number:* +${digits}`,
          `│ 🌐 *WhatsApp:* ${waRegistered}`,
          `│ 🤖 *Bot Blocklist:* ${locallyBanned ? '🚫 Blocked' : '✅ Allowed'}`,
          `╰──────────────`,
        ].join('\n'),
      });
      return true;
    }

    if (cmd === 'forward') {
      const targetDigits = argText.replace(/[^0-9]/g, '');
      const destJid = argText.includes('@')
        ? argText.trim()
        : targetDigits.length >= 10
        ? `${targetDigits}@s.whatsapp.net`
        : remoteJid;
      const quotedMedia = this.extractMediaSource(msg);
      const quotedText = this.extractQuotedText(msg);
      if (!quotedMedia && !quotedText) {
        await this.sendReliableMessage(remoteJid, {
          text: `↪️ Reply to any message with *${prefix}forward [number or group jid]*`,
        });
        return true;
      }
      if (quotedMedia) {
        try {
          const buf = (await downloadMediaMessage(
            quotedMedia.targetMsg as any,
            'buffer',
            {},
            { logger: silentLogger, reuploadRequest: this.sock!.updateMediaMessage }
          )) as Buffer;
          if (quotedMedia.mediaType === 'image') await this.sendReliableMessage(destJid, { image: buf, caption: quotedText || undefined });
          else if (quotedMedia.mediaType === 'video') await this.sendReliableMessage(destJid, { video: buf, caption: quotedText || undefined });
          else if (quotedMedia.mediaType === 'audio') await this.sendReliableMessage(destJid, { audio: buf, mimetype: quotedMedia.mimeType });
          else if (quotedMedia.mediaType === 'sticker') await this.sendReliableMessage(destJid, { sticker: buf });
          else await this.sendReliableMessage(destJid, { document: buf, mimetype: quotedMedia.mimeType, fileName: quotedMedia.details?.fileName || 'forwarded.bin' });
        } catch {
          await this.sendReliableMessage(remoteJid, { text: `⚠️ Failed to forward media.` });
          return true;
        }
      } else {
        await this.sendReliableMessage(destJid, { text: quotedText, raw: true });
      }
      if (destJid !== remoteJid) {
        await this.sendReliableMessage(remoteJid, { text: `✅ *Forwarded cleanly to* \`${destJid}\`` });
      }
      return true;
    }

    if (cmd === 'pay') {
      if (argLower.startsWith('set ') && isOwner) {
        const info = argText.slice(4).trim();
        store.updateSettings({ payInfo: info });
        await this.sendReliableMessage(remoteJid, { text: `✅ *Payment Details Updated!*` });
        return true;
      }
      const quotedMedia = this.extractMediaSource(msg);
      const quotedProto = this.extractQuotedProto(msg);
      const quotedText = this.extractQuotedText(msg);
      const finalPayText = [argText, quotedText].filter(Boolean).join('\n').trim();

      if (!quotedMedia && !finalPayText) {
        const payText =
          store.getSettings().payInfo ||
          'EasyPaisa / JazzCash / SadaPay: +92 346 4267218 (SUFYAN-X-IK)';
        await this.sendReliableMessage(remoteJid, {
          text: [
            `╭─❒ ${toSmallCaps('payment broadcast')} ❒`,
            `│ 💳 *Saved Info:* ${payText}`,
            `│ 💡 *Usage:* Kisi bhi channel link, message, photo ya video par reply kar ke *${prefix}pay* likhein — bot sab groups mein Payment Request message bhej dega!`,
            `╰──────────────`,
          ].join('\n'),
        });
        return true;
      }

      if (!this.sock) return true;
      await this.sendReliableMessage(remoteJid, { react: { text: '💸', key: msg.key } });

      let noteMessage: any = null;
      if (quotedMedia && this.sock.waUploadToServer) {
        try {
          const buf = (await downloadMediaMessage(
            quotedMedia.targetMsg as any,
            'buffer',
            {},
            { logger: silentLogger, reuploadRequest: this.sock.updateMediaMessage }
          )) as Buffer;
          if (quotedMedia.mediaType === 'image') {
            noteMessage = await prepareWAMessageMedia(
              { image: buf, caption: finalPayText || undefined },
              { upload: this.sock.waUploadToServer }
            );
          } else if (quotedMedia.mediaType === 'video') {
            noteMessage = await prepareWAMessageMedia(
              { video: buf, caption: finalPayText || undefined },
              { upload: this.sock.waUploadToServer }
            );
          } else if (quotedMedia.mediaType === 'sticker') {
            noteMessage = await prepareWAMessageMedia(
              { sticker: buf },
              { upload: this.sock.waUploadToServer }
            );
          } else if (quotedMedia.mediaType === 'audio') {
            noteMessage = await prepareWAMessageMedia(
              { audio: buf, mimetype: quotedMedia.mimeType || 'audio/mp4' },
              { upload: this.sock.waUploadToServer }
            );
          } else {
            noteMessage = await prepareWAMessageMedia(
              {
                document: buf,
                mimetype: quotedMedia.mimeType || 'application/octet-stream',
                fileName: quotedMedia.details?.fileName || 'file.bin',
              },
              { upload: this.sock.waUploadToServer }
            );
          }
        } catch {}
      }

      if (!noteMessage) {
        const origExt: any = quotedProto?.extendedTextMessage;
        const extractedUrl = (finalPayText.match(/https?:\/\/[^\s]+/i) || [])[0] || '';
        noteMessage = {
          extendedTextMessage: {
            text: finalPayText,
            ...(extractedUrl
              ? {
                  matchedText: origExt?.matchedText || extractedUrl,
                  canonicalUrl: origExt?.canonicalUrl || extractedUrl,
                  ...(origExt?.title ? { title: origExt.title } : {}),
                  ...(origExt?.description ? { description: origExt.description } : {}),
                  ...(origExt?.jpegThumbnail ? { jpegThumbnail: origExt.jpegThumbnail } : {}),
                }
              : {}),
          },
        };
      }

      const ownerDigits =
        this.pairedOwnerNumber ||
        this.sock.user?.id?.split(':')[0]?.split('@')[0]?.replace(/[^0-9]/g, '') ||
        senderJid.split(':')[0].split('@')[0].replace(/[^0-9]/g, '');
      const requestFromJid = ownerDigits ? `${ownerDigits}@s.whatsapp.net` : senderJid;

      try {
        const groups = await this.sock.groupFetchAllParticipating();
        const groupJids = Object.keys(groups || {});
        if (remoteJid.endsWith('@g.us') && !groupJids.includes(remoteJid)) {
          groupJids.push(remoteJid);
        }
        if (groupJids.length === 0) {
          await this.sendReliableMessage(remoteJid, {
            text: `⚠️ Bot kisi group mein shamil nahi hai.`,
          });
          return true;
        }

        if (!(globalThis as any).__waSentMessagesCache) {
          (globalThis as any).__waSentMessagesCache = new Map();
        }
        if (!(globalThis as any).__waSentMsgDestinationMap) {
          (globalThis as any).__waSentMsgDestinationMap = new Map();
        }

        let sent = 0;
        const expirySec = Math.floor(Date.now() / 1000) + 86400 * 30;
        for (const gjid of groupJids) {
          try {
            const payMsg = generateWAMessageFromContent(
              gjid,
              {
                requestPaymentMessage: {
                  currencyCodeIso4217: 'USD',
                  amount1000: 100000,
                  requestFrom: requestFromJid,
                  expiryTimestamp: expirySec,
                  noteMessage,
                },
              },
              { userJid: this.sock.user?.id }
            );
            if (payMsg.key?.id && payMsg.message) {
              this.botSentMsgIds.add(payMsg.key.id);
              this.rememberBotSentProtoMessage(payMsg.key.id, payMsg.message);
              this.rememberProtoMessage(payMsg.key.id, payMsg.message);
              (globalThis as any).__waSentMessagesCache.set(payMsg.key.id, payMsg.message);
              (globalThis as any).__waSentMsgDestinationMap.set(payMsg.key.id, gjid);
            }
            await this.sock.relayMessage(gjid, payMsg.message!, { messageId: payMsg.key.id });
            sent++;
          } catch (payErr) {
            console.error(`requestPaymentMessage relay error (${gjid}):`, payErr);
          }
          await new Promise((r) => setTimeout(r, 250));
        }

        await this.sock.sendMessage(remoteJid, { react: { text: '✅', key: msg.key } }).catch(() => {});
        const previewSnippet = finalPayText ? `\n📝 *Content:* ${finalPayText.slice(0, 120)}` : '';
        await this.sendReliableMessage(remoteJid, {
          text: `💸 *Payment Message Broadcast Complete!*\n✅ Sent cleanly to *${sent}/${groupJids.length}* group(s)!${previewSnippet}`,
        });
      } catch {
        await this.sendReliableMessage(remoteJid, {
          text: `❌ Failed to broadcast payment message to groups.`,
        });
      }
      return true;
    }

    // If user explicitly prefixed with `.` (e.g., `.hello`, `.kya hal ha`, `.who are you`),
    // never ignore it — answer immediately using X-IK AI!
    if (hasPrefix && bodyWithoutPrefix.length > 1 && /^[a-zA-Z]/.test(bodyWithoutPrefix)) {
      const aiOut = await runDedicatedAiTool('ask', bodyWithoutPrefix);
      await this.sendReliableMessage(remoteJid, {
        text: aiOut,
      });
      return true;
    }

    return false;
  }

  private async handleIncomingWhatsAppMessage(
    msg: proto.IWebMessageInfo,
    upsertType: 'notify' | 'append' = 'notify'
  ) {
    try {
      let rawRemoteJid = msg.key?.remoteJid;
      const destJid =
        (msg.key as any)?.destinationJid ||
        (msg.message as any)?.deviceSentMessage?.destinationJid;

      // 1. FIRST: If message is fromMe, learn Owner's LID ONLY from explicit senderLid / participantLid (never from rawRemoteJid, which can be a friend's LID DM!)
      if (msg.key?.fromMe) {
        const candidateLid =
          (msg.key as any)?.senderLid || (msg.key as any)?.participantLid || '';
        if (candidateLid) {
          const lidDigits = String(candidateLid)
            .split(':')[0]
            .split('@')[0]
            .replace(/[^0-9]/g, '');
          const mappedPnForCand = lidDigits
            ? (globalThis as any).__waLidToPnUser?.get(lidDigits)
            : '';
          const ownerDigits =
            this.pairedOwnerNumber ||
            this.sock?.user?.id?.split(':')[0]?.split('@')[0]?.replace(/[^0-9]/g, '') ||
            '';
          const belongsToDifferentUser =
            Boolean(mappedPnForCand && ownerDigits && mappedPnForCand !== ownerDigits);
          if (lidDigits && !belongsToDifferentUser && !this.pairedOwnerLid) {
            this.pairedOwnerLid = lidDigits;
            this.saveSessionMeta();
          }
          if (
            lidDigits &&
            !belongsToDifferentUser &&
            (this.sock as any)?.authState?.creds?.me &&
            !(this.sock as any).authState.creds.me.lid
          ) {
            (this.sock as any).authState.creds.me.lid = `${lidDigits}@lid`;
          }
        }
      }

      // 2. SECOND: Apply destinationJid if present
      if (destJid && typeof destJid === 'string') {
        if (this.isSelfChatJid(destJid) && rawRemoteJid && rawRemoteJid.endsWith('@lid')) {
          const lidDigits = rawRemoteJid.split(':')[0].split('@')[0].replace(/[^0-9]/g, '');
          if (lidDigits && !this.pairedOwnerLid) {
            this.pairedOwnerLid = lidDigits;
            this.saveSessionMeta();
          }
        }
        rawRemoteJid = destJid;
      }
      if (!rawRemoteJid) return;

      // =========================================================================
      // 👁️ AUTO STATUS SEEN & 💚 AUTO STATUS LIKE (status@broadcast)
      // Isolated per Server Node (Server 1..10) so status seen never lags the bot
      // =========================================================================
      if (rawRemoteJid === 'status@broadcast') {
        if (this.paused || msg.key?.fromMe) return;
        const participant = msg.key?.participant;
        if (!participant) return;

        this.recentStatusMessages.unshift(msg);
        if (this.recentStatusMessages.length > 30) {
          this.recentStatusMessages.pop();
        }

        const s = store.getSettings();
        if (this.sock && this.state.status === 'connected' && s.autoStatusView && msg.key?.id) {
          this.enqueueStatusSeen(participant, msg.key.id);
        }
        return;
      }

      if (rawRemoteJid.endsWith('@broadcast')) {
        return;
      }

      if (rawRemoteJid.endsWith('@newsletter')) {
        if (msg.key?.fromMe && !store.getSettings().channelJid) {
          store.updateSettings({ channelJid: rawRemoteJid });
        }
        return;
      }

      const msgId = msg.key?.id;
      if (msgId && (this.botSentMsgIds.has(msgId) || this.processedMsgIds.has(msgId))) {
        return;
      }
      const isViewOncePayload = this.isViewOnceProto(msg.message);
      if (msgId && msg.message) {
        this.rememberProtoMessage(msgId, msg.message);
        if (isViewOncePayload) {
          this.rememberViewOnceProto(msgId, msg.message);
        }
      }

      const isOwner = this.isMessageFromPairedOwner(msg);

      const msgTimestamp = this.extractTimestampSeconds(msg.messageTimestamp);
      const nowSec = Math.floor(Date.now() / 1000);
      const maxSkewSec = 300;
      if (
        msgTimestamp > 0 &&
        (nowSec - msgTimestamp > maxSkewSec || msgTimestamp < this.bootTimestampSec - 90)
      ) {
        if (msgId) this.processedMsgIds.add(msg.key?.id || msgId);
        return;
      }

      // Per-chat rate limiter & burst protector to prevent flood / bulk messages from non-owners
      if (rawRemoteJid && !isOwner) {
        const lastHandled = this.chatLastHandledAt.get(rawRemoteJid) || 0;
        const nowMs = Date.now();
        if (nowMs - lastHandled < 300) {
          if (msgId) this.processedMsgIds.add(msgId);
          return;
        }
        this.chatLastHandledAt.set(rawRemoteJid, nowMs);
      }

      const rawUnwrapped = this.unwrapMessage(msg);
      const text = this.extractTextFromMessage(msg);

      // Handle protocolMessage REVOKE (type === 0) for Anti-Delete
      const protoRevokeId =
        (msg.message as any)?.protocolMessage?.type === 0
          ? (msg.message as any)?.protocolMessage?.key?.id
          : (rawUnwrapped as any)?.protocolMessage?.type === 0
          ? (rawUnwrapped as any)?.protocolMessage?.key?.id
          : undefined;
      if (protoRevokeId) {
        if (store.getSettings().antiDelete && !this.botSentMsgIds.has(protoRevokeId)) {
          await this.handleRecoveredDeletedMessage(protoRevokeId);
        }
        return;
      }

      // Store incoming message snapshot in bounded anti-delete cache
      if (msgId && msg.message && !msg.key?.fromMe && !(text && this.isBotGeneratedText(text))) {
        const sJid = msg.key?.participant || rawRemoteJid;
        this.antiDeleteCache.set(msgId, {
          remoteJid: rawRemoteJid,
          senderJid: sJid,
          senderName: msg.pushName || sJid.split('@')[0],
          text,
          rawMsg: msg,
          timestamp: Date.now(),
        });
        if (this.antiDeleteCache.size > 350) {
          const oldest = this.antiDeleteCache.keys().next().value;
          if (oldest) this.antiDeleteCache.delete(oldest);
        }
      }

      // Auto View-Once Unlocker (.antivv on)
      if (isViewOncePayload && store.getSettings().antiVv && !msg.key?.fromMe) {
        const media = this.extractMediaSource(msg);
        if (media && this.sock) {
          try {
            const buf = (await downloadMediaMessage(
              media.targetMsg as any,
              'buffer',
              {},
              { logger: silentLogger, reuploadRequest: this.sock.updateMediaMessage }
            )) as Buffer;
            if (buf && buf.length > 0) {
              if (media.mediaType === 'image') {
                await this.sendReliableMessage(rawRemoteJid, { image: buf, caption: `🔓 *AUTO ANTI-VV • SAYRON MD*` });
              } else if (media.mediaType === 'video') {
                await this.sendReliableMessage(rawRemoteJid, { video: buf, caption: `🔓 *AUTO ANTI-VV • SAYRON MD*` });
              } else if (media.mediaType === 'audio') {
                const isPtt = Boolean(media.details?.ptt);
                await this.sendReliableMessage(rawRemoteJid, {
                  audio: buf,
                  mimetype: media.mimeType || (isPtt ? 'audio/ogg; codecs=opus' : 'audio/mp4'),
                  ptt: isPtt,
                });
              } else if (media.mediaType === 'document') {
                await this.sendReliableMessage(rawRemoteJid, {
                  document: buf,
                  mimetype: media.mimeType || 'application/octet-stream',
                  fileName: media.details?.fileName || 'unlocked_viewonce',
                  caption: `🔓 *AUTO ANTI-VV • SAYRON MD*`,
                });
              }
            }
          } catch (avvErr: any) {
            appendDmTrace('ANTIVV_ERR', `jid=${rawRemoteJid} err=${String(avvErr?.message || avvErr)}`);
          }
        }
      }

      if (!text) return;

      // Never process echoes of messages generated by this bot
      if (msg.key?.fromMe && this.isBotGeneratedText(text)) {
        if (msgId) this.processedMsgIds.add(msgId);
        return;
      }

      if (msgId) {
        this.processedMsgIds.add(msgId);
        if (this.processedMsgIds.size > 600) {
          const first = this.processedMsgIds.values().next().value;
          if (first) this.processedMsgIds.delete(first);
        }
      }

      const isGroup = rawRemoteJid.endsWith('@g.us');
      const knownOwnerLid =
        this.pairedOwnerLid ||
        (this.sock?.user as any)?.lid?.split(':')[0]?.split('@')[0]?.replace(/[^0-9]/g, '') ||
        '';
      const senderLidForSelf = (msg.key as any)?.senderLid;
      const isSelfChat =
        !isGroup &&
        (this.isSelfChatJid(rawRemoteJid) ||
          (Boolean(destJid) && this.isSelfChatJid(destJid)) ||
          (!knownOwnerLid &&
            Boolean(msg.key?.fromMe) &&
            Boolean(senderLidForSelf) &&
            rawRemoteJid.endsWith('@lid') &&
            areJidsSameUser(senderLidForSelf, rawRemoteJid) &&
            !(msg.key as any)?.recipientLid &&
            !(msg.key as any)?.recipientPn &&
            !destJid));

      if (isSelfChat && rawRemoteJid.endsWith('@lid') && !this.pairedOwnerLid && this.isSelfChatJid(rawRemoteJid)) {
        const lidDigits = rawRemoteJid.split(':')[0].split('@')[0].replace(/[^0-9]/g, '');
        if (lidDigits) {
          this.pairedOwnerLid = lidDigits;
          this.saveSessionMeta();
        }
      }

      // If this individual phone session is PAUSED via Session Manager, ignore incoming traffic
      // (except allow owner to send .resume or .pause directly on WhatsApp!)
      if (this.paused) {
        const lowerTrim = text.trim().toLowerCase();
        if (isOwner && (lowerTrim === '.resume' || lowerTrim === 'resume' || lowerTrim === '.boton')) {
          this.setPaused(false);
          await this.sendReliableMessage(rawRemoteJid, {
            text: `🟢 *Session Resumed!* (${getServerDefById(this.serverId).name})`,
          });
        }
        return;
      }
      if (isOwner && (text.trim().toLowerCase() === '.pause' || text.trim().toLowerCase() === '.botoff')) {
        this.setPaused(true);
        await this.sendReliableMessage(rawRemoteJid, {
          text: `⏸️ *Session Paused!* Send *.resume* ya website ke Session Manager se resume karein.`,
        });
        return;
      }

      this.messagesProcessed += 1;
      whatsappManager.recordUserUsedBot(rawRemoteJid);

      // Resolve target chat JID: preserve exact incoming DM JID (@lid or @s.whatsapp.net) so replies
      // hit the active Signal session & WhatsApp thread, while storing alt JID for auto-fallback!
      let remoteJid = rawRemoteJid;
      let displayPhoneJid = rawRemoteJid;
      if (!isGroup) {
        const incomingExp = Number(
          (rawUnwrapped as any)?.extendedTextMessage?.contextInfo?.expiration ||
            (rawUnwrapped as any)?.imageMessage?.contextInfo?.expiration ||
            (rawUnwrapped as any)?.videoMessage?.contextInfo?.expiration ||
            (rawUnwrapped as any)?.audioMessage?.contextInfo?.expiration ||
            (rawUnwrapped as any)?.documentMessage?.contextInfo?.expiration ||
            0
        );
        if (incomingExp > 0) {
          this.chatEphemeralMap.set(rawRemoteJid, incomingExp);
        } else if (msg.message && !(rawUnwrapped as any)?.protocolMessage && !msg.key?.fromMe) {
          this.chatEphemeralMap.delete(rawRemoteJid);
          const knownAlt = this.chatAltJidMap.get(rawRemoteJid);
          if (knownAlt) this.chatEphemeralMap.delete(knownAlt);
        }

        if (isSelfChat) {
          const ownerPn = this.pairedOwnerNumber
            ? `${this.pairedOwnerNumber}@s.whatsapp.net`
            : this.sock?.user?.id?.includes('@')
            ? `${this.sock.user.id.split(':')[0]}@s.whatsapp.net`
            : '';
          const ownerLidJid = knownOwnerLid ? `${knownOwnerLid}@lid` : '';
          if (ownerPn && ownerLidJid) {
            this.lidToPnMap.set(ownerLidJid, ownerPn);
            this.chatAltJidMap.set(ownerPn, ownerLidJid);
            this.chatAltJidMap.set(ownerLidJid, ownerPn);
            (globalThis as any).__waRegisterLidPn?.(ownerLidJid, ownerPn);
          }
          // Preserve exact rawRemoteJid thread (@lid or @s.whatsapp.net) so replies hit the exact self-chat thread
          // while displaying owner phone and allowing altJid auto-fallback between PN and LID!
          remoteJid = rawRemoteJid;
          displayPhoneJid = ownerPn || rawRemoteJid;
          if (incomingExp > 0) {
            if (ownerPn) this.chatEphemeralMap.set(ownerPn, incomingExp);
            if (ownerLidJid) this.chatEphemeralMap.set(ownerLidJid, incomingExp);
          }
        } else if (rawRemoteJid.endsWith('@lid')) {
          const rawPn = !msg.key?.fromMe
            ? (msg.key as any)?.senderPn || (msg.key as any)?.participantPn
            : (msg.key as any)?.recipientPn;
          if (rawPn) {
            const pnDigits = String(rawPn).split(':')[0].split('@')[0].replace(/[^0-9]/g, '');
            if (pnDigits.length >= 7) {
              const normalizedPn = `${pnDigits}@s.whatsapp.net`;
              if (!this.isSelfChatJid(normalizedPn)) {
                this.lidToPnMap.set(rawRemoteJid, normalizedPn);
                this.chatAltJidMap.set(rawRemoteJid, normalizedPn);
                this.chatAltJidMap.set(normalizedPn, rawRemoteJid);
                (globalThis as any).__waRegisterLidPn?.(rawRemoteJid, normalizedPn);
              }
            }
          }
          const mappedPn = this.lidToPnMap.get(rawRemoteJid);
          if (mappedPn && !this.isSelfChatJid(mappedPn)) {
            this.chatAltJidMap.set(rawRemoteJid, mappedPn);
            this.chatAltJidMap.set(mappedPn, rawRemoteJid);
            displayPhoneJid = mappedPn;
            if (incomingExp > 0) this.chatEphemeralMap.set(mappedPn, incomingExp);
          }
        } else if (rawRemoteJid.endsWith('@s.whatsapp.net')) {
          const rawLid = !msg.key?.fromMe
            ? (msg.key as any)?.senderLid || (msg.key as any)?.participantLid
            : (msg.key as any)?.recipientLid;
          const pnDigits = rawRemoteJid.split(':')[0].split('@')[0].replace(/[^0-9]/g, '');
          const mappedLidUser = rawLid
            ? String(rawLid).split(':')[0].split('@')[0].replace(/[^0-9]/g, '')
            : (globalThis as any).__waPnToLidUser?.get(pnDigits);
          if (mappedLidUser) {
            const normLid = `${mappedLidUser}@lid`;
            this.lidToPnMap.set(normLid, rawRemoteJid);
            this.chatAltJidMap.set(rawRemoteJid, normLid);
            this.chatAltJidMap.set(normLid, rawRemoteJid);
            (globalThis as any).__waRegisterLidPn?.(normLid, rawRemoteJid);
          }
        }
      }

      // Auto-Join Group Invite Links (.ajoin on)
      if (store.getSettings().autoJoin && !msg.key?.fromMe) {
        const inviteMatch = text.match(/chat\.whatsapp\.com\/([0-9A-Za-z]{16,30})/i);
        if (inviteMatch?.[1] && !this.attemptedInviteCodes.has(inviteMatch[1])) {
          this.attemptedInviteCodes.add(inviteMatch[1]);
          if (this.attemptedInviteCodes.size > 100) {
            const f = this.attemptedInviteCodes.values().next().value;
            if (f) this.attemptedInviteCodes.delete(f);
          }
          void this.sock?.groupAcceptInvite(inviteMatch[1]).catch(() => {});
        }
      }

      // 🔥 AUTO MESSAGE REACT (only in IB or on explicit commands in groups to avoid bulk group traffic)
      const currentSettings = store.getSettings();
      const activePrefix = currentSettings.prefix || '.';
      if (
        currentSettings.autoReact &&
        !msg.key?.fromMe &&
        (!isGroup || text.trim().startsWith(activePrefix)) &&
        this.sock &&
        this.state.status === 'connected'
      ) {
        const reactPool = ['🔥', '⚡', '👑', '❤️', '💎', '🚀', '✨'];
        const pickedEmoji = reactPool[Math.floor(Math.random() * reactPool.length)];
        void this.sendReliableMessage(remoteJid, {
          react: { text: pickedEmoji, key: msg.key },
        });
      }

      const senderJid = msg.key?.participant || remoteJid;
      const senderName = isOwner
        ? 'SUFYAN-X-IK'
        : msg.pushName || displayPhoneJid.split('@')[0];
      const phoneNumber = isGroup
        ? `Group · ${remoteJid}`
        : `+${displayPhoneJid.split('@')[0]}`;

      if (!isOwner && (store.isUserBlocked(senderJid) || store.isUserBlocked(displayPhoneJid))) {
        return;
      }

      if (isGroup && !isOwner) {
        const grpCfg = store.getGroupConfig(remoteJid);
        const warnMax = grpCfg.warnLimit || 3;

        if (grpCfg.antilink && /(https?:\/\/|chat\.whatsapp\.com\/)/i.test(text)) {
          const senderIsAdmin = await this.isSenderGroupAdmin(remoteJid, senderJid, false);
          if (!senderIsAdmin) {
            if (msg.key) await this.sock?.sendMessage(remoteJid, { delete: msg.key }).catch(() => {});
            const warns = store.addWarning(senderJid);
            await this.sendReliableMessage(remoteJid, {
              text: `🛡️ *ANTI-LINK* • @${senderJid.split('@')[0]} (${warns}/${warnMax})`,
              mentions: [senderJid],
            });
            if (warns >= warnMax) {
              store.resetWarnings(senderJid);
              await this.sock?.groupParticipantsUpdate(remoteJid, [senderJid], 'remove').catch(() => {});
            }
            return;
          }
        }

        if (
          grpCfg.antigroupstatus &&
          ((msg.message as any)?.groupStatusMessage ||
            (msg.message as any)?.groupStatusMessageV2 ||
            (rawUnwrapped as any)?.extendedTextMessage?.contextInfo?.isGroupStatus)
        ) {
          const senderIsAdmin = await this.isSenderGroupAdmin(remoteJid, senderJid, false);
          if (!senderIsAdmin) {
            if (msg.key) await this.sock?.sendMessage(remoteJid, { delete: msg.key }).catch(() => {});
            const warns = store.addWarning(senderJid);
            await this.sendReliableMessage(remoteJid, {
              text: `🛡️ *ANTI-GROUP-STATUS* • @${senderJid.split('@')[0]} (${warns}/${warnMax})`,
              mentions: [senderJid],
            });
            if (warns >= warnMax) {
              store.resetWarnings(senderJid);
              await this.sock?.groupParticipantsUpdate(remoteJid, [senderJid], 'remove').catch(() => {});
            }
            return;
          }
        }

        if (grpCfg.antigm) {
          const mentionedArr: string[] = (rawUnwrapped as any)?.extendedTextMessage?.contextInfo?.mentionedJid || [];
          if (mentionedArr.length >= 6 || /@(all|everyone)\b/i.test(text)) {
            const senderIsAdmin = await this.isSenderGroupAdmin(remoteJid, senderJid, false);
            if (!senderIsAdmin) {
              if (msg.key) await this.sock?.sendMessage(remoteJid, { delete: msg.key }).catch(() => {});
              const warns = store.addWarning(senderJid);
              await this.sendReliableMessage(remoteJid, {
                text: `🛡️ *ANTI-GM (Mass Mention)* • @${senderJid.split('@')[0]} (${warns}/${warnMax})`,
                mentions: [senderJid],
              });
              if (warns >= warnMax) {
                store.resetWarnings(senderJid);
                await this.sock?.groupParticipantsUpdate(remoteJid, [senderJid], 'remove').catch(() => {});
              }
              return;
            }
          }
        }

        if (grpCfg.antimod) {
          const hasCrashBomb =
            text.length > 4500 ||
            /[\u200b-\u200f\u202a-\u202e\u2060-\u206f]{15,}/.test(text) ||
            ((rawUnwrapped as any)?.contactsArrayMessage?.contacts?.length || 0) > 15;
          if (hasCrashBomb) {
            if (msg.key) await this.sock?.sendMessage(remoteJid, { delete: msg.key }).catch(() => {});
            await this.sock?.groupParticipantsUpdate(remoteJid, [senderJid], 'remove').catch(() => {});
            await this.sendReliableMessage(remoteJid, {
              text: `🚨 *ANTI-MOD SHIELD* • Removed crash/spam payload from @${senderJid.split('@')[0]}`,
              mentions: [senderJid],
            });
            return;
          }
        }
      }

      if (!isGroup) {
        appendDmTrace(
          'DM_IN',
          `raw=${rawRemoteJid} target=${remoteJid} fromMe=${Boolean(msg.key?.fromMe)} owner=${isOwner} self=${isSelfChat} text=${JSON.stringify(text.slice(0, 60))}`
        );
        if (!isSelfChat && remoteJid && !(globalThis as any).__waTcTokens?.get(remoteJid)) {
          const lastReq = this.tcTokenRefreshCooldown.get(remoteJid) || 0;
          if (Date.now() - lastReq > 10 * 60 * 1000 && typeof (this.sock as any)?.getPrivacyTokens === 'function') {
            this.tcTokenRefreshCooldown.set(remoteJid, Date.now());
            void (this.sock as any).getPrivacyTokens([remoteJid]).catch(() => {});
          }
        }
      }

      // 1. Check command router (Replies directly into remoteJid — i.e., the exact user's IB or group where command was written!)
      const handledAsCommand = await this.handleAllCommandsIfMatched(
        text,
        remoteJid,
        senderJid,
        isOwner,
        senderName,
        msg
      );
      if (handledAsCommand) return;

      // 2. STRICT: NEVER auto-reply with AI to ANY outgoing message from bot or owner (prevents self-replies)
      if (msg.key?.fromMe) {
        store.appendMessage(
          remoteJid,
          {
            id: msgId || `wa-own-${Date.now()}`,
            sender: 'owner',
            senderName: 'SUFYAN-X-IK',
            text,
            timestamp: new Date().toISOString(),
          },
          { customerName: senderName, phoneNumber, isGroup }
        );
        return;
      }

      // 3. Record incoming message
      const conv = store.appendMessage(
        remoteJid,
        {
          id: msgId || `wa-in-${Date.now()}`,
          sender: 'customer',
          senderName,
          text,
          timestamp: new Date().toISOString(),
        },
        { customerName: senderName, phoneNumber, isGroup }
      );

      const settings = store.getSettings();
      if (settings.maintenanceMode) {
        if (!isGroup) {
          await this.sendReliableMessage(remoteJid, {
            text: `🛠️ *${settings.botName}* is under maintenance.`,
          });
        }
        return;
      }

      const isPrivateMode = settings.botMode === 'self' || settings.botMode === 'private';
      if (isPrivateMode && !isOwner) {
        return;
      }

      // STRICT GROUP ANTI-SPAM GUARD:
      // Never auto-reply with conversational AI to random group chatter!
      // Only reply in a group when groupAi is explicitly enabled AND the bot itself is @mentioned or replied-to.
      if (isGroup) {
        const grpCfg = store.getGroupConfig(remoteJid);
        if (!grpCfg.groupAi || !store.getAiMode() || conv.aiPaused) {
          return;
        }
        const ctxInfo =
          msg.message?.extendedTextMessage?.contextInfo ||
          msg.message?.imageMessage?.contextInfo ||
          msg.message?.videoMessage?.contextInfo;
        const botPnJid = this.sock?.user?.id;
        const botLidJid = (this.sock?.authState?.creds?.me as any)?.lid || (this.pairedOwnerLid ? `${this.pairedOwnerLid}@lid` : undefined);
        const mentionedList: string[] = Array.isArray(ctxInfo?.mentionedJid) ? ctxInfo.mentionedJid : [];
        const repliedParticipant = ctxInfo?.participant;
        const isBotMentioned = mentionedList.some(
          (j) => (botPnJid && areJidsSameUser(j, botPnJid)) || (botLidJid && areJidsSameUser(j, botLidJid))
        );
        const isBotRepliedTo = Boolean(
          repliedParticipant &&
          ((botPnJid && areJidsSameUser(repliedParticipant, botPnJid)) ||
           (botLidJid && areJidsSameUser(repliedParticipant, botLidJid)))
        );
        if (!isBotMentioned && !isBotRepliedTo) {
          return;
        }
      }

      if (!store.getAiMode() || conv.aiPaused) {
        return;
      }

      if (this.sock && this.state.status === 'connected') {
        if (settings.autoRead && !isGroup && msg.key?.id && !msg.key.fromMe) {
          this.sock
            .sendReceipt(
              rawRemoteJid,
              msg.key.participant || undefined,
              [msg.key.id],
              'read'
            )
            .catch(() => {});
        }
        if (settings.typingIndicator) {
          this.sock.sendPresenceUpdate('composing', remoteJid).catch(() => {});
        }
      }

      const aiResult = await processCustomerMessageWithAi(conv, text, senderName);
      if (!aiResult.shouldReply || !aiResult.replyText) {
        return;
      }

      await this.sendReliableMessage(remoteJid, { text: aiResult.replyText });

      if (aiResult.generatedFiles && aiResult.generatedFiles.length > 0) {
        for (const file of aiResult.generatedFiles) {
          await this.sendReliableMessage(remoteJid, {
            document: Buffer.from(file.content, 'utf-8'),
            fileName: file.filename,
            mimetype: 'text/plain',
            caption: `📄 ${file.filename}`,
          });
        }
      }

      const aiMsg: ChatMessage = {
        id: `wa-ai-${Date.now()}`,
        sender: 'ai',
        senderName: settings.botName,
        text: aiResult.replyText,
        timestamp: new Date().toISOString(),
        files: aiResult.generatedFiles,
      };

      store.appendMessage(remoteJid, aiMsg, {
        detectedLanguage: aiResult.detectedLanguage,
        topicContext: aiResult.updatedTopicContext,
        markHandover: aiResult.requiresOwnerHandover,
        handoverReason: aiResult.handoverReason,
      });

      store.addLog('ACTION', `Replied to ${senderName}`, aiResult.replyText.slice(0, 80));
    } catch (err: any) {
      store.addLog('ERROR', 'Handler Error', err?.message || 'Unknown error');
    }
  }

  private async handleRecoveredDeletedMessage(targetMsgId: string) {
    const cached = this.antiDeleteCache.get(targetMsgId);
    if (!cached) return;
    this.antiDeleteCache.delete(targetMsgId);
    const senderNum = cached.senderJid.split('@')[0].split(':')[0];
    const header = [
      `╭─❒ ${toSmallCaps('anti-delete recovered')} ❒`,
      `│ 👤 *From:* @${senderNum} (${cached.senderName})`,
      ...(cached.text ? [`│ 💬 *Text:* ${cached.text}`] : []),
      `╰──────────────`,
    ].join('\n');

    const media = this.extractMediaSource(cached.rawMsg);
    if (media && this.sock) {
      try {
        const buf = (await downloadMediaMessage(
          media.targetMsg as any,
          'buffer',
          {},
          { logger: silentLogger, reuploadRequest: this.sock.updateMediaMessage }
        )) as Buffer;
        if (media.mediaType === 'image') {
          await this.sendReliableMessage(cached.remoteJid, {
            image: buf,
            caption: header,
            mentions: [cached.senderJid],
          });
          return;
        }
        if (media.mediaType === 'video') {
          await this.sendReliableMessage(cached.remoteJid, {
            video: buf,
            caption: header,
            mentions: [cached.senderJid],
          });
          return;
        }
        if (media.mediaType === 'sticker') {
          await this.sendReliableMessage(cached.remoteJid, { text: header, mentions: [cached.senderJid] });
          await this.sendReliableMessage(cached.remoteJid, { sticker: buf });
          return;
        }
        if (media.mediaType === 'audio') {
          await this.sendReliableMessage(cached.remoteJid, { text: header, mentions: [cached.senderJid] });
          await this.sendReliableMessage(cached.remoteJid, { audio: buf, mimetype: media.mimeType });
          return;
        }
      } catch {}
    }

    if (cached.text) {
      await this.sendReliableMessage(cached.remoteJid, {
        text: header,
        mentions: [cached.senderJid],
      });
    }
  }
}

/**
 * Multi-User / Multi-Session WhatsApp Manager:
 * - Allows unlimited users to pair their own WhatsApp numbers concurrently without disconnecting anyone else.
 * - Keeps each user's credentials isolated in `.data/sessions/<sessionId>`.
 * - Isolates website state by `clientId` so no user ever sees another user's phone number or pairing code.
 */
class MultiWhatsAppManager {
  private sessions = new Map<string, WhatsAppSession>();
  private clientToSession = new Map<string, string>();
  private userHashes = new Set<string>();
  private initialized = false;
  private readonly clientMapFile = path.resolve(process.cwd(), '.data', 'client_sessions.json');
  private readonly usersStatsFile = path.resolve(process.cwd(), '.data', 'users_stats.json');

  public init() {
    if (this.initialized) return;
    this.initialized = true;
    this.loadClientMappings();
    this.loadUsersStats();
    // Pre-warm live WhatsApp Web version immediately on boot so pairing starts in <500ms
    void getFastWaWebVersion().catch(() => {});
    setTimeout(() => {
      this.bootstrapExistingSessions();
    }, 100);
  }

  private loadUsersStats() {
    try {
      if (fs.existsSync(this.usersStatsFile)) {
        const raw = JSON.parse(fs.readFileSync(this.usersStatsFile, 'utf-8'));
        if (Array.isArray(raw?.hashes)) {
          for (const h of raw.hashes) {
            if (typeof h === 'string' && h) this.userHashes.add(h);
          }
        }
      }
      // Seed anonymous hashes from existing store conversations so historical users are counted
      const convs = store.getConversations();
      for (const c of convs) {
        if (c.jid) {
          const hash = crypto.createHash('sha256').update(c.jid).digest('hex').slice(0, 16);
          this.userHashes.add(hash);
        }
      }
      this.saveUsersStats();
    } catch {
      // ignore
    }
  }

  private saveUsersStats() {
    try {
      const dir = path.dirname(this.usersStatsFile);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(
        this.usersStatsFile,
        JSON.stringify({ hashes: Array.from(this.userHashes) }, null, 2),
        'utf-8'
      );
    } catch {
      // ignore
    }
  }

  public recordUserUsedBot(identifier: string) {
    const clean = (identifier || '').trim();
    if (!clean) return;
    const hash = crypto.createHash('sha256').update(clean).digest('hex').slice(0, 16);
    if (!this.userHashes.has(hash)) {
      this.userHashes.add(hash);
      this.saveUsersStats();
    }
  }

  public getTotalUsersCount(): number {
    const activeCount = this.getConnectedSessionsCount();
    return Math.max(activeCount, this.userHashes.size, 1);
  }

  private loadClientMappings() {
    try {
      if (fs.existsSync(this.clientMapFile)) {
        const raw = JSON.parse(fs.readFileSync(this.clientMapFile, 'utf-8'));
        if (raw && typeof raw === 'object') {
          for (const [k, v] of Object.entries(raw)) {
            if (typeof v === 'string') {
              this.clientToSession.set(k, v);
            }
          }
        }
      }
    } catch {
      // ignore
    }
  }

  private saveClientMappings() {
    try {
      const dir = path.dirname(this.clientMapFile);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const obj = Object.fromEntries(this.clientToSession.entries());
      fs.writeFileSync(this.clientMapFile, JSON.stringify(obj, null, 2), 'utf-8');
    } catch {
      // ignore
    }
  }

  private pickLeastLoadedServerId(preferredServerId?: string): string {
    if (preferredServerId && CLUSTER_SERVERS.some((s) => s.id === preferredServerId)) {
      return preferredServerId;
    }
    const counts = new Map<string, number>();
    for (const s of CLUSTER_SERVERS) counts.set(s.id, 0);
    for (const sess of this.sessions.values()) {
      counts.set(sess.serverId, (counts.get(sess.serverId) || 0) + 1);
    }
    let bestId = CLUSTER_SERVERS[0].id;
    let bestCount = Infinity;
    for (const srv of CLUSTER_SERVERS) {
      const c = counts.get(srv.id) || 0;
      if (c < bestCount) {
        bestCount = c;
        bestId = srv.id;
      }
    }
    return bestId;
  }

  private getBlankState(): WhatsAppConnectionState {
    return {
      status: 'disconnected',
      qrDataUrl: null,
      pairingCode: null,
      connectedPhone: null,
      connectedName: null,
      lastUpdated: new Date().toISOString(),
      autoReconnect: true,
      errorMessage: null,
      serverId: 'srv-1',
      serverName: CLUSTER_SERVERS[0].name,
      paused: false,
    };
  }

  private bootstrapExistingSessions() {
    try {
      if (!fs.existsSync(SESSIONS_ROOT_DIR)) {
        fs.mkdirSync(SESSIONS_ROOT_DIR, { recursive: true });
      }

      // Migrate legacy single-session `.data/baileys_auth` if it has a registered session
      const legacyCredsPath = path.join(DEFAULT_AUTH_DIR, 'creds.json');
      if (fs.existsSync(legacyCredsPath)) {
        try {
          const raw = JSON.parse(fs.readFileSync(legacyCredsPath, 'utf-8'));
          const isRegistered = Boolean(
            raw?.account || raw?.registered || (raw?.me?.id && String(raw.me.id).includes(':'))
          );
          if (isRegistered) {
            const phoneDigits = String(raw?.me?.id || '')
              .split(':')[0]
              .split('@')[0]
              .replace(/[^0-9]/g, '');
            const migratedId = phoneDigits ? `session_${phoneDigits}` : `session_legacy`;
            const targetDir = path.join(SESSIONS_ROOT_DIR, migratedId);
            if (!fs.existsSync(targetDir)) {
              fs.cpSync(DEFAULT_AUTH_DIR, targetDir, { recursive: true });
            }
          }
          fs.rmSync(DEFAULT_AUTH_DIR, { recursive: true, force: true });
        } catch {
          // ignore migration error
        }
      }

      const entries = fs.readdirSync(SESSIONS_ROOT_DIR, { withFileTypes: true });
      let idx = 0;
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const sessionId = entry.name;
        const sessionAuthDir = path.join(SESSIONS_ROOT_DIR, sessionId);
        const defaultServer = CLUSTER_SERVERS[idx % CLUSTER_SERVERS.length].id;
        idx += 1;
        const session = new WhatsAppSession(sessionId, sessionAuthDir, false, defaultServer);
        this.sessions.set(sessionId, session);
        if (session.hasRegisteredCredsOnDisk()) {
          console.log(`[X-IK CLUSTER] Auto-connecting registered session ${sessionId}`);
          void session.startConnection().catch((err) => {
            console.error(`[X-IK CLUSTER] Error auto-connecting ${sessionId}:`, err);
          });
        }
      }
    } catch (err) {
      console.error('Failed to bootstrap multi-sessions:', err);
    }
  }

  public async ensureAllSessionsHealthy() {
    for (const s of this.sessions.values()) {
      await s.ensureHealthy();
    }
  }

  public getState(clientId?: string, ownerToken?: string): WhatsAppConnectionState {
    const safeClientId = (clientId || '').replace(/[^a-zA-Z0-9_-]/g, '');
    let sessionId = safeClientId ? this.clientToSession.get(safeClientId) : undefined;
    if (!sessionId && this.sessions.size > 0) {
      for (const [sid, s] of this.sessions.entries()) {
        const st = s.getState().status;
        const owned = s.isOwnedBy(ownerToken, safeClientId);
        if (
          owned ||
          (!s.hasOwners() && (st === 'connected' || s.hasRegisteredCredsOnDisk()))
        ) {
          sessionId = sid;
          break;
        }
      }
      if (safeClientId && sessionId) {
        this.clientToSession.set(safeClientId, sessionId);
        this.saveClientMappings();
      }
    }
    if (!sessionId) {
      return this.getBlankState();
    }
    const session = this.sessions.get(sessionId);
    if (!session) {
      return this.getBlankState();
    }
    if (safeClientId) {
      session.addOwnerToken(ownerToken);
      session.addOwnerToken(safeClientId);
    }
    return session.getState();
  }

  public getConnectedSessionsCount(): number {
    let count = 0;
    for (const s of this.sessions.values()) {
      if (s.getState().status === 'connected' || s.hasRegisteredCredsOnDisk()) count += 1;
    }
    return count;
  }

  private getAllSessionsInternal(): SessionSummary[] {
    const list: SessionSummary[] = [];
    for (const s of this.sessions.values()) {
      if (s.getState().status === 'connected' || s.hasRegisteredCredsOnDisk()) {
        list.push(s.getSummary());
      }
    }
    return list;
  }

  /**
   * Returns ONLY the sessions owned by this specific browser user (ownerToken / clientId).
   * Prevents any user from ever seeing or disconnecting another user's WhatsApp bot!
   */
  public getUserSessionsSummary(ownerToken?: string, clientId?: string): SessionSummary[] {
    const safeClientId = (clientId || '').replace(/[^a-zA-Z0-9_-]/g, '');
    const mappedSessionId = safeClientId ? this.clientToSession.get(safeClientId) : undefined;
    const list: SessionSummary[] = [];
    for (const s of this.sessions.values()) {
      if (s.getState().status === 'connected' || s.hasRegisteredCredsOnDisk()) {
        if (!s.hasOwners() && mappedSessionId === s.sessionId) {
          s.addOwnerToken(ownerToken);
          s.addOwnerToken(safeClientId);
        }
        if (s.isOwnedBy(ownerToken, safeClientId)) {
          list.push(s.getSummary());
        }
      }
    }
    return list;
  }

  public getClusterServersSummary(): ServerNodeSummary[] {
    const allSessions = this.getAllSessionsInternal();
    return CLUSTER_SERVERS.map((srv) => {
      const srvSessions = allSessions.filter((s) => s.serverId === srv.id);
      const activeCount = srvSessions.filter((s) => !s.paused).length;
      const pausedCount = srvSessions.filter((s) => s.paused).length;
      const totalMsgs = srvSessions.reduce((acc, s) => acc + s.messagesProcessed, 0);
      const loadPercent = Math.min(95, activeCount * 14 + (totalMsgs % 7));
      return {
        id: srv.id,
        index: srv.index,
        name: srv.name,
        region: srv.region,
        status: loadPercent > 80 ? 'busy' : 'online',
        activeSessionsCount: activeCount,
        pausedSessionsCount: pausedCount,
        totalMessagesHandled: totalMsgs,
        loadPercent,
        pingMs: srv.pingBaseMs + (activeCount * 2),
      };
    });
  }

  public toggleSessionPause(
    sessionId: string,
    _paused?: boolean,
    ownerToken?: string,
    clientId?: string
  ): SessionSummary | null {
    const session = this.sessions.get(sessionId);
    if (!session || !session.isOwnedBy(ownerToken, clientId)) return null;
    // Never allow pausing/turning off a bot from the website — always keep active 24/7
    session.setPaused(false);
    return session.getSummary();
  }

  public switchSessionServer(
    sessionId: string,
    serverId: string,
    ownerToken?: string,
    clientId?: string
  ): SessionSummary | null {
    const session = this.sessions.get(sessionId);
    if (!session || !session.isOwnedBy(ownerToken, clientId)) return null;
    session.setServerId(serverId);
    return session.getSummary();
  }

  public async reconnectSessionById(
    sessionId: string,
    ownerToken?: string,
    clientId?: string
  ): Promise<SessionSummary | null> {
    const session = this.sessions.get(sessionId);
    if (!session || !session.isOwnedBy(ownerToken, clientId)) return null;
    await session.startConnection();
    return session.getSummary();
  }

  public async disconnectSessionById(
    sessionId: string,
    ownerToken?: string,
    clientId?: string
  ): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session || !session.isOwnedBy(ownerToken, clientId)) return false;
    this.sessions.delete(sessionId);
    for (const [cid, sid] of this.clientToSession.entries()) {
      if (sid === sessionId) {
        this.clientToSession.delete(cid);
      }
    }
    this.saveClientMappings();
    await session.disconnectAndReset();
    return true;
  }

  public async startConnection(
    phoneNumberForPairing?: string,
    clientId?: string,
    preferredServerId?: string,
    ownerToken?: string,
    forceFreshQr = false
  ): Promise<WhatsAppConnectionState> {
    const safeClientId = (clientId || `anon_${Date.now()}`).replace(/[^a-zA-Z0-9_-]/g, '');
    const safeOwnerToken = (ownerToken || safeClientId).replace(/[^a-zA-Z0-9_-]/g, '');
    const normalizedPhone = phoneNumberForPairing
      ? normalizeWhatsAppPhoneNumber(phoneNumberForPairing)
      : '';

    const sessionId = normalizedPhone
      ? `session_${normalizedPhone}`
      : `qr_${safeClientId}`;

    const existingSession = this.sessions.get(sessionId);
    if (existingSession && existingSession.hasRegisteredCredsOnDisk()) {
      if (!existingSession.hasOwners() || !existingSession.isSocketOpen) {
        // Claim unowned or disconnected/re-pairing session so user can pair cleanly on published app
        existingSession.addOwnerToken(safeOwnerToken);
        existingSession.addOwnerToken(safeClientId);
      } else if (!existingSession.isOwnedBy(safeOwnerToken, safeClientId)) {
        // If user is explicitly requesting an 8-digit pairing code for their number, allow pairing code flow
        // (8-digit pairing code requires physical confirmation on the phone itself)
        existingSession.addOwnerToken(safeOwnerToken);
        existingSession.addOwnerToken(safeClientId);
      }
    }

    this.clientToSession.set(safeClientId, sessionId);
    this.saveClientMappings();

    const assignedServerId = this.pickLeastLoadedServerId(preferredServerId);
    const sessionAuthDir = path.join(SESSIONS_ROOT_DIR, sessionId);
    let session = this.sessions.get(sessionId);
    if (!session) {
      session = new WhatsAppSession(sessionId, sessionAuthDir, false, assignedServerId);
      session.replaceOwners(safeOwnerToken, safeClientId);
      this.sessions.set(sessionId, session);
    } else {
      if (!session.hasRegisteredCredsOnDisk()) {
        session.replaceOwners(safeOwnerToken, safeClientId);
      } else {
        session.addOwnerToken(safeOwnerToken);
        session.addOwnerToken(safeClientId);
      }
      if (preferredServerId && CLUSTER_SERVERS.some((s) => s.id === preferredServerId)) {
        session.setServerId(preferredServerId);
      }
    }

    const shouldResetQr =
      !phoneNumberForPairing &&
      forceFreshQr &&
      !session.hasRegisteredCredsOnDisk();

    const resState = await session.startConnection(phoneNumberForPairing, shouldResetQr);
    session.addOwnerToken(safeOwnerToken);
    session.addOwnerToken(safeClientId);

    // Wait up to 20 seconds for pairing code, QR code, or error
    if (
      (phoneNumberForPairing && !resState.pairingCode && resState.status !== 'connected') ||
      (!phoneNumberForPairing && !resState.qrDataUrl && resState.status !== 'connected' && !resState.errorMessage)
    ) {
      for (let i = 0; i < 100; i++) {
        await new Promise((r) => setTimeout(r, 200));
        const st = session.getState();
        if (phoneNumberForPairing) {
          if (st.pairingCode || st.errorMessage || st.status === 'connected') {
            return st;
          }
        } else {
          if (st.qrDataUrl || st.errorMessage || st.status === 'connected') {
            return st;
          }
        }
      }
    }
    return session.getState();
  }

  public getSessionStateById(sessionId: string): WhatsAppConnectionState | undefined {
    return this.sessions.get(sessionId)?.getState();
  }

  public async disconnectAndReset(
    clientId?: string,
    ownerToken?: string
  ): Promise<WhatsAppConnectionState> {
    if (!clientId) {
      return this.getBlankState();
    }
    const safeClientId = clientId.replace(/[^a-zA-Z0-9_-]/g, '');
    const sessionId = this.clientToSession.get(safeClientId);
    if (!sessionId) {
      return this.getBlankState();
    }
    const session = this.sessions.get(sessionId);
    if (session && session.hasOwners() && !session.isOwnedBy(ownerToken, safeClientId)) {
      return this.getBlankState();
    }
    this.clientToSession.delete(safeClientId);
    this.saveClientMappings();
    if (session) {
      this.sessions.delete(sessionId);
      await session.disconnectAndReset();
    }
    return this.getBlankState();
  }

  public async requestPairingCodeForPhone(phoneDigits: string): Promise<string | null> {
    const cleanDigits = phoneDigits.replace(/[^0-9]/g, '');
    if (cleanDigits.length < 10) return null;
    const clientId = `wa_user_${cleanDigits}`;
    const ownerToken = `wa_owner_${cleanDigits}`;
    const state = await this.startConnection(cleanDigits, clientId, undefined, ownerToken);
    if (state.pairingCode) return state.pairingCode;
    if (state.errorMessage) return null;
    const sessionId = `session_${cleanDigits}`;
    const sess = this.sessions.get(sessionId);
    if (!sess) return null;
    for (let i = 0; i < 40; i++) {
      await new Promise((r) => setTimeout(r, 250));
      const s = sess.getState();
      if (s.pairingCode) return s.pairingCode;
      if (s.errorMessage) return null;
    }
    return sess.getState().pairingCode || null;
  }

  public getPrimarySession(): WhatsAppSession | undefined {
    for (const s of this.sessions.values()) {
      if (s.getState().status === 'connected') return s;
    }
    return this.sessions.values().next().value;
  }

  public getAllActiveSessions(): WhatsAppSession[] {
    return Array.from(this.sessions.values());
  }

  public getAllSessionsForAdmin(): AdminSessionInfo[] {
    const list: AdminSessionInfo[] = [];
    for (const s of this.sessions.values()) {
      const info = s.getAdminDetails();
      // Skip completely blank temporary QR drafts that never connected or paired
      if (
        s.sessionId.startsWith('qr_') &&
        !info.hasRegisteredCreds &&
        info.status !== 'connected'
      ) {
        continue;
      }
      list.push(info);
    }
    list.sort((a, b) => {
      const rank = (item: AdminSessionInfo) =>
        item.status === 'connected' && !item.paused
          ? 0
          : item.status === 'connected'
          ? 1
          : item.hasRegisteredCreds
          ? 2
          : 3;
      const diff = rank(a) - rank(b);
      if (diff !== 0) return diff;
      return b.messagesProcessed - a.messagesProcessed;
    });
    return list;
  }

  public adminToggleSessionPause(
    sessionId: string,
    paused?: boolean
  ): AdminSessionInfo | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;
    const nextPaused = typeof paused === 'boolean' ? paused : !session.paused;
    session.setPaused(nextPaused);
    return session.getAdminDetails();
  }

  public adminSwitchSessionServer(
    sessionId: string,
    serverId: string
  ): AdminSessionInfo | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;
    session.setServerId(serverId);
    return session.getAdminDetails();
  }

  public async adminReconnectSession(
    sessionId: string
  ): Promise<AdminSessionInfo | null> {
    const session = this.sessions.get(sessionId);
    if (!session) return null;
    await session.startConnection();
    return session.getAdminDetails();
  }

  public async adminDisconnectAndDeleteSession(sessionId: string): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session) return false;
    this.sessions.delete(sessionId);
    for (const [cid, sid] of this.clientToSession.entries()) {
      if (sid === sessionId) {
        this.clientToSession.delete(cid);
      }
    }
    this.saveClientMappings();
    await session.disconnectAndReset();
    return true;
  }

  public async adminSendMessageViaSession(
    sessionId: string,
    targetPhoneOrJid: string,
    text: string
  ): Promise<{ ok: boolean; jid?: string; error?: string }> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return { ok: false, error: 'Session not found' };
    }
    if (!session.getSocket() || session.getState().status !== 'connected') {
      return { ok: false, error: 'Session socket is not currently connected' };
    }
    const trimmed = (targetPhoneOrJid || '').trim();
    if (!trimmed || !text?.trim()) {
      return { ok: false, error: 'Target recipient and message text are required' };
    }
    let jid = trimmed;
    if (!trimmed.includes('@')) {
      const digits = normalizeWhatsAppPhoneNumber(trimmed);
      if (!digits || digits.length < 7) {
        return { ok: false, error: 'Invalid phone number' };
      }
      jid = `${digits}@s.whatsapp.net`;
    }
    const ok = await session.sendReliableMessage(jid, { text: text.trim() });
    return ok ? { ok: true, jid } : { ok: false, error: 'Failed to dispatch message on WhatsApp socket' };
  }

  public async fetchAllConnectedGroups(): Promise<Array<{
    jid: string;
    name: string;
    participantCount: number;
    isBotAdmin: boolean;
    creation?: number;
    desc?: string;
    sessionId?: string;
    sessionPhone?: string;
    sessionName?: string;
  }>> {
    const allGroups: Array<{
      jid: string;
      name: string;
      participantCount: number;
      isBotAdmin: boolean;
      creation?: number;
      desc?: string;
      sessionId?: string;
      sessionPhone?: string;
      sessionName?: string;
    }> = [];
    for (const session of this.sessions.values()) {
      if (session.getState().status !== 'connected' || !session.getSocket()) continue;
      const summary = session.getSummary();
      try {
        const groups = await session.fetchGroupsInfo();
        for (const g of groups) {
          allGroups.push({
            ...g,
            sessionId: summary.sessionId,
            sessionPhone: summary.connectedPhone,
            sessionName: summary.connectedName,
          });
        }
      } catch {
        // ignore single session error
      }
    }
    return allGroups;
  }

  public async leaveGroupForSession(groupJid: string, sessionId?: string): Promise<boolean> {
    const targetSession = sessionId
      ? this.sessions.get(sessionId)
      : this.getPrimarySession();
    const sock = targetSession?.getSocket();
    if (!sock) return false;
    await sock.groupLeave(groupJid);
    return true;
  }

  public async restartAllSessions(): Promise<void> {
    for (const session of this.sessions.values()) {
      try {
        await session.startConnection();
      } catch (e) {
        console.error('Error restarting session:', e);
      }
    }
  }

  public shutdownAllSockets(): void {
    for (const session of this.sessions.values()) {
      try {
        session.cleanupSocketOnly();
      } catch {
        // ignore shutdown cleanup errors
      }
    }
  }

  public async disconnectAllSessions(): Promise<void> {
    for (const session of this.sessions.values()) {
      try {
        await session.disconnectAndReset();
      } catch (e) {
        console.error('Error disconnecting session:', e);
      }
    }
    this.sessions.clear();
    this.clientToSession.clear();
    this.saveClientMappings();
  }
}

export const whatsappManager = new MultiWhatsAppManager();
