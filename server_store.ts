import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import type {
  BusinessKnowledge,
  Conversation,
  LogEntry,
  ProductItem,
  FaqItem,
  ChatMessage,
} from './src/types.ts';

const DATA_DIR = path.resolve(process.cwd(), '.data');
const STORE_PATH = path.join(DATA_DIR, 'xik_store.json');
const STORE_BACKUP_PATH = path.join(DATA_DIR, 'xik_store.bak.json');
// Workspace-persistent config directory (NOT in .gitignore so songs, settings & admin edits survive container rebuilds)
const DURABLE_DIR = path.resolve(process.cwd(), 'data');
const DURABLE_CONFIG_PATH = path.join(DURABLE_DIR, 'admin_persisted_state.json');

function writeJsonAtomic(filePath: string, obj: any) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const tmpPath = `${filePath}.tmp.${process.pid}.${Date.now()}`;
  fs.writeFileSync(tmpPath, JSON.stringify(obj, null, 2), 'utf-8');
  fs.renameSync(tmpPath, filePath);
}

export const DEFAULT_MENU_IMAGE_PATH =
  process.env.MENU_IMAGE || '/src/assets/images/sayron_md_banner_1794054357635.jpg';
export const DEFAULT_CHANNEL_INVITE_CODE =
  process.env.CHANNEL_INVITE_CODE || '0029VbD2ggC9WtCAOvZlwe1I';
export const DEFAULT_CHANNEL_URL = `https://whatsapp.com/channel/${DEFAULT_CHANNEL_INVITE_CODE}`;
export const DEFAULT_CHANNEL_JID =
  process.env.CHANNEL_JID || '120363429680836023@newsletter';

export interface BotSettings {
  prefix: string;
  botName: string;
  botBio: string;
  language: string;
  personality: 'friendly' | 'professional' | 'funny' | 'developer' | 'heavy';
  typingIndicator: boolean;
  autoRead: boolean;
  autoReact: boolean;
  autoStatusView: boolean;
  autoStatusLike: boolean;
  statusLikeEmoji: string;
  presenceMode: 'available' | 'composing' | 'paused' | 'unavailable';
  autoTyping?: boolean;
  autoRecording?: boolean;
  maintenanceMode?: boolean;
  botMode: 'public' | 'self' | 'private' | 'maintenance';
  ownerNumber?: string;
  channelJid: string;
  channelInviteCode: string;
  channelName: string;
  menuImage: string;
  menuTitle: string;
  antiDelete?: boolean;
  antiVv?: boolean;
  autoJoin?: boolean;
  callMusic?: boolean;
  alwaysOnline?: boolean;
  payInfo?: string;
}

export interface CustomCommandItem {
  id: string;
  name: string;
  response: string;
  category: string;
  description: string;
  enabled: boolean;
  createdBy: string;
  createdAt: string;
}

export interface CommandRule {
  command: string;
  enabled: boolean;
  cooldownSec: number;
  permission: 'all' | 'admin' | 'owner';
  maxDailyUses?: number;
  usageCount: number;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  details: string;
  status: 'SUCCESS' | 'WARN' | 'FAIL';
  ip?: string;
}

export interface LoginAttempt {
  id: string;
  timestamp: string;
  ip: string;
  userAgent: string;
  success: boolean;
  reason?: string;
}

export interface WebsiteConfig {
  title: string;
  subtitle: string;
  description: string;
  announcement: string;
  showAnnouncement: boolean;
  bannerUrl: string;
  contactPhone: string;
  channelUrl: string;
  theme: 'cyberpunk-neon' | 'matrix-green' | 'royal-gold';
}

export interface SongItem {
  id: string;
  title: string;
  artist: string;
  audioUrl: string;
  coverUrl?: string;
  duration?: string;
  category?: string;
}

export const DEFAULT_SONGS: SongItem[] = [
  {
    id: 'song-1',
    title: 'SAYRON Cyber Phonk (VIP Drift)',
    artist: 'X-IK Beats • SUFYAN-X-IK',
    audioUrl: 'https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=phonk-drift-112269.mp3',
    coverUrl: '/sayron_md_banner.jpg',
    duration: '2:15',
    category: 'Cyber Phonk',
  },
  {
    id: 'song-2',
    title: 'Neon Tokyo Midnight Lo-Fi',
    artist: 'Cyber Dreamscape',
    audioUrl: 'https://cdn.pixabay.com/download/audio/2022/03/15/audio_c8c8a73467.mp3?filename=lofi-study-112191.mp3',
    coverUrl: '/sayron_md_banner.jpg',
    duration: '2:40',
    category: 'Midnight Lo-Fi',
  },
  {
    id: 'song-3',
    title: 'Electronic Synthwave Overdrive',
    artist: 'SAYRON MD Audio Core',
    audioUrl: 'https://cdn.pixabay.com/download/audio/2022/01/18/audio_d0a13f69d2.mp3?filename=synthwave-80s-110045.mp3',
    coverUrl: '/sayron_md_banner.jpg',
    duration: '3:10',
    category: 'Synthwave',
  },
  {
    id: 'song-4',
    title: 'Arabic Trap & Slowed Reverb',
    artist: 'Sufyan Audio Lab',
    audioUrl: 'https://cdn.pixabay.com/download/audio/2021/08/04/audio_bb630cc098.mp3?filename=middle-eastern-beat-9689.mp3',
    coverUrl: '/sayron_md_banner.jpg',
    duration: '2:30',
    category: 'Slowed & Reverb',
  },
];

export interface AiConfig {
  provider: 'gemini' | 'openai' | 'custom';
  apiKeyMasked?: string;
  model: string;
  maxOutputTokens: number;
  temperature: number;
  enabled: boolean;
  rateLimitPerUser: number;
  customSystemPrompt?: string;
}

export interface DownloaderConfig {
  enabled: boolean;
  maxFileSizeMb: number;
  audioBitrate: '128k' | '192k' | '320k';
  allowVideo: boolean;
  allowAudio: boolean;
  supportedPlatforms: string[];
}

export interface UserMeta {
  jid: string;
  phone: string;
  name?: string;
  role: 'normal' | 'vip' | 'bot_admin' | 'banned';
  commandsBlocked: boolean;
  commandCount: number;
  lastActive: string;
  warnings: number;
  notes?: string;
}

export interface GroupConfig {
  rules: string;
  welcome: boolean;
  goodbye: boolean;
  antilink: boolean;
  antispam: boolean;
  groupAi: boolean;
  antiUnauthorizedAdmin?: boolean;
  authorizedAdmins?: string[];
  antigm?: boolean;
  antigroupstatus?: boolean;
  antimod?: boolean;
  pdm?: boolean;
  approval?: boolean;
  warnLimit?: number;
  customWelcome?: string;
}

export interface ReminderItem {
  id: string;
  jid: string;
  message: string;
  triggerAt: string;
}

export interface TodoItem {
  id: string;
  task: string;
  done: boolean;
  createdAt: string;
}

interface PersistedStore {
  storeVersion?: number;
  aiMode: boolean;
  adminPinHash: string;
  settings: BotSettings;
  groupConfigs: Record<string, GroupConfig>;
  warnings: Record<string, number>;
  memories: Record<string, string[]>;
  notes: Record<string, string[]>;
  todos: Record<string, TodoItem[]>;
  blockedUsers: string[];
  business: BusinessKnowledge;
  conversations: Conversation[];
  logs: LogEntry[];
  customCommands: Record<string, CustomCommandItem>;
  commandRules: Record<string, CommandRule>;
  userMetas: Record<string, UserMeta>;
  auditLogs: AuditLogEntry[];
  loginAttempts: LoginAttempt[];
  aiConfig: AiConfig;
  downloaderConfig: DownloaderConfig;
  websiteConfig: WebsiteConfig;
  songsPlaylist: SongItem[];
  commandExecutions: Record<string, number>;
  sudoNumbers?: string[];
  customVars?: Record<string, string>;
  analytics: {
    totalMessagesProcessed: number;
    aiRepliesSent: number;
    ownerTakeovers: number;
    groupFilteredCount: number;
    codeSnippetsGenerated: number;
  };
}

const CURRENT_STORE_VERSION = 9;

function hashPin(pin: string): string {
  return crypto.createHash('sha256').update(`xik_salt_${pin}`).digest('hex');
}

const DEFAULT_SETTINGS: BotSettings = {
  prefix: '.',
  botName: 'SAYRON MD',
  botBio: 'Official SAYRON MD • Developed by SUFYAN-X-IK',
  language: 'Roman Urdu',
  personality: 'friendly',
  typingIndicator: true,
  autoRead: true,
  autoReact: false,
  autoStatusView: true,
  autoStatusLike: true,
  statusLikeEmoji: '💚',
  presenceMode: 'available',
  maintenanceMode: false,
  autoTyping: true,
  autoRecording: false,
  botMode: 'public',
  ownerNumber: '923464267218, 923708392045',
  channelJid: DEFAULT_CHANNEL_JID,
  channelInviteCode: DEFAULT_CHANNEL_INVITE_CODE,
  channelName: 'SAYRON MD • X-IK AI',
  menuImage: DEFAULT_MENU_IMAGE_PATH,
  menuTitle: 'SAYRON MD BOT',
  antiDelete: false,
  antiVv: false,
  autoJoin: false,
  callMusic: false,
  alwaysOnline: true,
  payInfo:
    'EasyPaisa / JazzCash / SadaPay: +92 346 4267218 (SUFYAN-X-IK)\nSend payment screenshot after transfer.',
};

const DEFAULT_PRODUCTS: ProductItem[] = [
  {
    id: 'prod-capcut-pro',
    name: 'CapCut Pro Official Subscription',
    description:
      'Full access to CapCut Pro cloud storage, premium transitions, AI captions, 4K 60fps export, and no watermark on PC & Mobile.',
    price: 'PKR 350 / Month (Shared) or PKR 600 / Month (Private Account)',
    features: [
      '4K Ultra HD Export without watermark',
      'All Pro effects, auto-captions & background removal',
      'Works on Android, iOS, Windows & Mac',
      'Full 28-Day replacement warranty included',
    ],
    availability: 'Available',
    paymentMethods: 'EasyPaisa, JazzCash, SadaPay, NayaPay, Bank Transfer',
    deliveryMethod:
      'Instant delivery on WhatsApp within 5–10 minutes after payment verification.',
    supportInfo: '24/7 warranty support via WhatsApp.',
    category: 'AI & Digital Tools',
  },
  {
    id: 'prod-chatgpt-plus',
    name: 'ChatGPT Plus / Pro AI Workspace Access',
    description:
      'High-speed access to latest GPT-4o / Pro models, coding assistant, file analysis, and image generation.',
    price: 'PKR 800 / Month',
    features: [
      'Unlimited fast responses & code generation',
      'Custom GPTs and file uploads',
      'Full 30-day warranty by SUFYAN-X-IK',
    ],
    availability: 'Available',
    paymentMethods: 'EasyPaisa, JazzCash, SadaPay, NayaPay',
    deliveryMethod: 'Instant activation within 10 minutes.',
    supportInfo: 'Full replacement & login support.',
    category: 'AI & Digital Tools',
  },
  {
    id: 'prod-web-dev',
    name: 'Website, Bot & Custom Coding Services',
    description:
      'Full-stack websites, WhatsApp automation bots, Python/Node.js scripts, and custom AI integrations built by SUFYAN-X-IK.',
    price: 'Starting from PKR 3,500 (Custom quote based on project)',
    features: [
      'Modern responsive UI + fast backend',
      'Complete source code & deployment help',
      'Direct technical support from SUFYAN-X-IK',
    ],
    availability: 'Available',
    paymentMethods: 'EasyPaisa, JazzCash, Bank Transfer, USDT',
    deliveryMethod: 'Delivered via GitHub / ZIP / Live Deployment.',
    supportInfo: 'Free bug fixes & maintenance support.',
    category: 'Development & Coding',
  },
];

const DEFAULT_FAQS: FaqItem[] = [
  {
    id: 'faq-payment',
    question: 'Payment kaise karni hai aur account kab milega?',
    answer:
      'Aap EasyPaisa, JazzCash, SadaPay ya NayaPay par payment bhej kar screenshot send karein. Verification ke foran baad 5 se 10 minute mein aapka account/service activate kar di jati hai.',
  },
  {
    id: 'faq-warranty',
    question: 'Agar account mein koi issue aaye to kya warranty hai?',
    answer:
      'Bilkul! Har subscription ke sath full warranty hoti hai. Agar koi bhi login ya subscription issue aaye to foran replacement ya fix diya jata hai.',
  },
];

const DEFAULT_BUSINESS: BusinessKnowledge = {
  businessName: 'X-IK AI Official Hub',
  ownerName: 'SUFYAN-X-IK',
  ownerRole: 'Founder, Lead Developer & AI Architect',
  ownerBio:
    'SUFYAN-X-IK is a full-stack developer, AI automation specialist, and digital entrepreneur.',
  ownerStatus: 'Available',
  contactNumbers: '+92 346 4267218',
  workingHours: '24/7 Active',
  supportedLanguages: ['Urdu', 'Roman Urdu', 'English', 'Punjabi', 'Hindi'],
  toneOfVoice:
    'Mirror the user: sweet & respectful when spoken to nicely; savage heavy roast if someone is abusive or disrespectful.',
  customInstructions:
    'Always represent X-IK AI and owner SUFYAN-X-IK with loyalty. Keep normal replies short (1-3 lines).',
  products: DEFAULT_PRODUCTS,
  faqs: DEFAULT_FAQS,
};

class StoreManager {
  private data: PersistedStore;
  private activeReminders: ReminderItem[] = [];
  public readonly bootTimeMs = Date.now();

  constructor() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    const defaults: PersistedStore = {
      storeVersion: CURRENT_STORE_VERSION,
      aiMode: false,
      adminPinHash: hashPin('1234'),
      settings: DEFAULT_SETTINGS,
      groupConfigs: {},
      warnings: {},
      memories: {},
      notes: {},
      todos: {},
      blockedUsers: [],
      business: DEFAULT_BUSINESS,
      conversations: [],
      logs: [
        {
          id: `log-${Date.now()}`,
          timestamp: new Date().toISOString(),
          level: 'INFO',
          event: 'X-IK AI System Online',
          details: 'SUFYAN-X-IK Official Bot initialized.',
        },
      ],
      customCommands: {},
      commandRules: {},
      userMetas: {},
      auditLogs: [
        {
          id: `audit-${Date.now()}`,
          timestamp: new Date().toISOString(),
          actor: 'System',
          action: 'INIT',
          details: 'SUFYAN-X-IK 3D Cyber Admin Engine initialized.',
          status: 'SUCCESS',
        },
      ],
      loginAttempts: [],
      aiConfig: {
        provider: 'gemini',
        model: 'gemini-2.5-flash',
        maxOutputTokens: 2048,
        temperature: 0.7,
        enabled: true,
        rateLimitPerUser: 40,
        customSystemPrompt: 'You are SUFYAN-X-IK AI, an elite, helpful cyber AI assistant.',
      },
      downloaderConfig: {
        enabled: true,
        maxFileSizeMb: 100,
        audioBitrate: '192k',
        allowVideo: true,
        allowAudio: true,
        supportedPlatforms: ['YouTube', 'SoundCloud', 'JioSaavn', 'TikTok', 'Instagram', 'Facebook', 'Spotify'],
      },
      websiteConfig: {
        title: 'SAYRON MD BOT • Supreme Cyber AI',
        subtitle: '24/7 Heavy WhatsApp AI Bot & Multi-Device Automation Engine',
        description: 'SAYRON MD BOT - Supreme 24/7 Heavy WhatsApp AI Bot developed by SUFYAN-X-IK.',
        announcement: '🔥 SAYRON MD Active • Developed by SUFYAN-X-IK',
        showAnnouncement: true,
        bannerUrl: DEFAULT_MENU_IMAGE_PATH,
        contactPhone: '+92 346 4267218',
        channelUrl: DEFAULT_CHANNEL_URL,
        theme: 'cyberpunk-neon',
      },
      songsPlaylist: [...DEFAULT_SONGS],
      commandExecutions: {},
      sudoNumbers: [],
      customVars: {},
      analytics: {
        totalMessagesProcessed: 0,
        aiRepliesSent: 0,
        ownerTakeovers: 0,
        groupFilteredCount: 0,
        codeSnippetsGenerated: 0,
      },
    };

    let loadedLocal: any = null;
    for (const candidatePath of [STORE_PATH, STORE_BACKUP_PATH]) {
      if (fs.existsSync(candidatePath)) {
        try {
          loadedLocal = JSON.parse(fs.readFileSync(candidatePath, 'utf-8'));
          break;
        } catch {
          loadedLocal = null;
        }
      }
    }

    let loadedDurable: any = null;
    if (fs.existsSync(DURABLE_CONFIG_PATH)) {
      try {
        loadedDurable = JSON.parse(fs.readFileSync(DURABLE_CONFIG_PATH, 'utf-8'));
      } catch {
        loadedDurable = null;
      }
    }

    // Prefer whichever durable state exists: if local store was wiped on restart, hydrate from data/admin_persisted_state.json!
    const parsed = loadedLocal || {};
    const durableTimestamp = Date.parse(loadedDurable?.durableUpdatedAt || '') || 0;
    const localTimestamp = Date.parse(parsed?.durableUpdatedAt || '') || 0;
    const useDurableOverride =
      Boolean(loadedDurable) && (!loadedLocal || durableTimestamp >= localTimestamp);

    const effective = useDurableOverride
      ? {
          ...parsed,
          ...loadedDurable,
          settings: {
            ...(parsed?.settings || {}),
            ...(loadedDurable?.settings || {}),
          },
          websiteConfig: {
            ...(parsed?.websiteConfig || {}),
            ...(loadedDurable?.websiteConfig || {}),
          },
          aiConfig: {
            ...(parsed?.aiConfig || {}),
            ...(loadedDurable?.aiConfig || {}),
          },
          downloaderConfig: {
            ...(parsed?.downloaderConfig || {}),
            ...(loadedDurable?.downloaderConfig || {}),
          },
          business: {
            ...(parsed?.business || {}),
            ...(loadedDurable?.business || {}),
          },
        }
      : parsed;

    if (loadedLocal || loadedDurable) {
      try {
        const isUpgradeToV7 = (effective.storeVersion || 0) < 7;
        const oldJid = effective?.settings?.channelJid || '';
        const isFakePlaceholderJid =
          oldJid === '120363398002948512@newsletter' ||
          oldJid === '120363000000000000@newsletter';

        const hasExplicitOwner = Boolean(
          effective?.settings &&
            Object.prototype.hasOwnProperty.call(effective.settings, 'ownerNumber')
        );
        const savedOwnerNumber = hasExplicitOwner
          ? String(effective.settings.ownerNumber ?? '')
          : (effective?.business?.contactNumbers ??
            effective?.websiteConfig?.contactPhone ??
            '923464267218');

        this.data = {
          ...defaults,
          ...effective,
          songsPlaylist: Array.isArray(effective.songsPlaylist)
            ? effective.songsPlaylist
            : [...DEFAULT_SONGS],
          storeVersion: CURRENT_STORE_VERSION,
          settings: {
            ...DEFAULT_SETTINGS,
            ...(effective.settings || {}),
            ownerNumber: savedOwnerNumber,
            menuImage: effective?.settings?.menuImage || DEFAULT_MENU_IMAGE_PATH,
            channelInviteCode:
              effective?.settings?.channelInviteCode || DEFAULT_CHANNEL_INVITE_CODE,
            channelJid: isFakePlaceholderJid || isUpgradeToV7 ? '' : oldJid,
          },
          groupConfigs: effective.groupConfigs || {},
          warnings: effective.warnings || {},
          memories: effective.memories || {},
          notes: effective.notes || {},
          todos: effective.todos || {},
          blockedUsers: effective.blockedUsers || [],
          customCommands: effective.customCommands || {},
          commandRules: effective.commandRules || {},
          userMetas: effective.userMetas || {},
          auditLogs: effective.auditLogs || defaults.auditLogs,
          loginAttempts: effective.loginAttempts || [],
          aiConfig: {
            ...defaults.aiConfig,
            ...(effective.aiConfig || {}),
          },
          downloaderConfig: {
            ...defaults.downloaderConfig,
            ...(effective.downloaderConfig || {}),
          },
          websiteConfig: {
            ...defaults.websiteConfig,
            ...(effective.websiteConfig || {}),
            contactPhone:
              effective?.websiteConfig?.contactPhone !== undefined
                ? effective.websiteConfig.contactPhone
                : savedOwnerNumber,
          },
          commandExecutions: effective.commandExecutions || {},
          sudoNumbers: Array.isArray(effective.sudoNumbers) ? effective.sudoNumbers : [],
          customVars:
            effective.customVars && typeof effective.customVars === 'object'
              ? effective.customVars
              : {},
          business: {
            ...DEFAULT_BUSINESS,
            ...(effective.business || {}),
            contactNumbers:
              effective?.business?.contactNumbers !== undefined
                ? effective.business.contactNumbers
                : savedOwnerNumber,
          },
          analytics: {
            ...defaults.analytics,
            ...(effective.analytics || {}),
          },
        };
        this.save(true, !loadedDurable);
      } catch {
        this.data = defaults;
        this.save(true, true);
      }
    } else {
      this.data = defaults;
      this.save(true, true);
    }

    const flushSync = () => this.flushPendingSave();
    process.once('SIGTERM', flushSync);
    process.once('SIGINT', flushSync);
    process.once('beforeExit', flushSync);
  }

  private saveTimer: NodeJS.Timeout | null = null;

  private buildDurableSnapshot() {
    return {
      durableUpdatedAt: (this.data as any).durableUpdatedAt || new Date().toISOString(),
      storeVersion: CURRENT_STORE_VERSION,
      aiMode: this.data.aiMode,
      adminPinHash: this.data.adminPinHash,
      settings: this.data.settings,
      groupConfigs: this.data.groupConfigs,
      warnings: this.data.warnings,
      memories: this.data.memories,
      notes: this.data.notes,
      todos: this.data.todos,
      blockedUsers: this.data.blockedUsers,
      business: this.data.business,
      customCommands: this.data.customCommands,
      commandRules: this.data.commandRules,
      userMetas: this.data.userMetas,
      aiConfig: this.data.aiConfig,
      downloaderConfig: this.data.downloaderConfig,
      websiteConfig: this.data.websiteConfig,
      songsPlaylist: this.data.songsPlaylist,
      sudoNumbers: this.data.sudoNumbers || [],
      customVars: this.data.customVars || {},
    };
  }

  public flushPendingSave() {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    try {
      writeJsonAtomic(STORE_PATH, this.data);
    } catch {
      // ignore
    }
  }

  private save(immediate = false, persistDurable = false) {
    if (persistDurable) {
      (this.data as any).durableUpdatedAt = new Date().toISOString();
      try {
        writeJsonAtomic(DURABLE_CONFIG_PATH, this.buildDurableSnapshot());
      } catch (e) {
        console.error('Failed to persist durable admin config:', e);
      }
    }

    if (immediate) {
      if (this.saveTimer) {
        clearTimeout(this.saveTimer);
        this.saveTimer = null;
      }
      try {
        writeJsonAtomic(STORE_PATH, this.data);
        writeJsonAtomic(STORE_BACKUP_PATH, this.data);
      } catch (e) {
        console.error('Failed to persist store:', e);
      }
      return;
    }

    if (this.saveTimer) return;
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      try {
        writeJsonAtomic(STORE_PATH, this.data);
      } catch (e) {
        console.error('Failed to persist store async:', e);
      }
    }, 350);
  }

  public getAiMode(): boolean {
    return this.data.aiMode;
  }

  public setAiMode(enabled: boolean, source = 'Dashboard') {
    this.data.aiMode = enabled;
    this.addLog(
      'ACTION',
      `AI Mode turned ${enabled ? 'ON' : 'OFF'}`,
      `Changed via ${source}`
    );
    this.save(true, true);
  }

  public getSettings(): BotSettings {
    return this.data.settings;
  }

  public updateSettings(partial: Partial<BotSettings>): BotSettings {
    const patch: Partial<BotSettings> & { ownerPhone?: string } = { ...partial };
    const hasOwnerField =
      Object.prototype.hasOwnProperty.call(patch, 'ownerNumber') ||
      Object.prototype.hasOwnProperty.call(patch, 'ownerPhone');
    if (hasOwnerField) {
      const raw = String(patch.ownerNumber ?? patch.ownerPhone ?? '').trim();
      if (!raw) {
        patch.ownerNumber = '';
      } else if (raw.includes(',') || raw.includes(';') || raw.includes(' ') || raw.includes('+')) {
        const parts = raw
          .split(/[,;\s/]+/)
          .map((p) => p.replace(/[^0-9]/g, ''))
          .filter((p) => p.length >= 7);
        patch.ownerNumber = parts.length > 0 ? parts.join(', ') : raw;
      } else {
        const cleanDigits = raw.replace(/[^0-9]/g, '');
        patch.ownerNumber = cleanDigits || raw;
      }
      this.data.business.contactNumbers = String(patch.ownerNumber ?? '');
      this.data.websiteConfig.contactPhone = String(patch.ownerNumber ?? '');
    }
    delete patch.ownerPhone;
    this.data.settings = {
      ...this.data.settings,
      ...patch,
    };
    this.save(true, true);
    return this.data.settings;
  }

  public getGroupConfig(groupJid: string): GroupConfig {
    if (!this.data.groupConfigs[groupJid]) {
      this.data.groupConfigs[groupJid] = {
        rules:
          '1. Respect everyone & SUFYAN-X-IK.\n2. No spam or unauthorized links.\n3. Keep discussions clean.',
        welcome: false,
        goodbye: false,
        antilink: false,
        antispam: false,
        groupAi: false,
        antiUnauthorizedAdmin: false,
        authorizedAdmins: [],
        antigm: false,
        antigroupstatus: false,
        antimod: false,
        pdm: false,
        approval: false,
        warnLimit: 3,
      };
      this.save();
    }
    if (!Array.isArray(this.data.groupConfigs[groupJid].authorizedAdmins)) {
      this.data.groupConfigs[groupJid].authorizedAdmins = [];
    }
    if (!this.data.groupConfigs[groupJid].warnLimit) {
      this.data.groupConfigs[groupJid].warnLimit = 3;
    }
    return this.data.groupConfigs[groupJid];
  }

  public getGroupConfigs(): Record<string, GroupConfig> {
    return this.data.groupConfigs || {};
  }

  public updateGroupConfig(groupJid: string, partial: Partial<GroupConfig>): GroupConfig {
    const current = this.getGroupConfig(groupJid);
    this.data.groupConfigs[groupJid] = {
      ...current,
      ...partial,
    };
    this.save(true, true);
    return this.data.groupConfigs[groupJid];
  }

  public addAuthorizedAdmin(groupJid: string, userJid: string): string[] {
    const cfg = this.getGroupConfig(groupJid);
    const set = new Set(cfg.authorizedAdmins || []);
    set.add(userJid);
    cfg.authorizedAdmins = Array.from(set);
    this.save(true, true);
    return cfg.authorizedAdmins;
  }

  public removeAuthorizedAdmin(groupJid: string, userJid: string): string[] {
    const cfg = this.getGroupConfig(groupJid);
    const set = new Set(cfg.authorizedAdmins || []);
    set.delete(userJid);
    cfg.authorizedAdmins = Array.from(set);
    this.save(true, true);
    return cfg.authorizedAdmins;
  }

  public getSudoNumbers(): string[] {
    if (!Array.isArray(this.data.sudoNumbers)) this.data.sudoNumbers = [];
    return this.data.sudoNumbers;
  }

  public addSudoNumber(numOrJid: string): string[] {
    const clean = numOrJid.split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
    if (!clean || clean.length < 7) return this.getSudoNumbers();
    const set = new Set(this.getSudoNumbers());
    set.add(clean);
    this.data.sudoNumbers = Array.from(set);
    this.save(true, true);
    return this.data.sudoNumbers;
  }

  public removeSudoNumber(numOrJid: string): string[] {
    const clean = numOrJid.split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
    this.data.sudoNumbers = this.getSudoNumbers().filter(
      (n) => n !== clean && (n.length < 9 || clean.length < 9 || n.slice(-9) !== clean.slice(-9))
    );
    this.save(true, true);
    return this.data.sudoNumbers;
  }

  public getCustomVars(): Record<string, string> {
    if (!this.data.customVars) this.data.customVars = {};
    return this.data.customVars;
  }

  public setCustomVar(key: string, value: string): Record<string, string> {
    const cleanKey = key.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '');
    if (!cleanKey) return this.getCustomVars();
    if (!this.data.customVars) this.data.customVars = {};
    this.data.customVars[cleanKey] = value;
    if (cleanKey === 'PAY_INFO' || cleanKey === 'PAYMENT') {
      this.data.settings.payInfo = value;
    }
    this.save(true, true);
    return this.data.customVars;
  }

  public deleteCustomVar(key: string): boolean {
    const cleanKey = key.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '');
    if (!this.data.customVars || !(cleanKey in this.data.customVars)) return false;
    delete this.data.customVars[cleanKey];
    this.save(true, true);
    return true;
  }

  public addWarning(userJid: string): number {
    const current = this.data.warnings[userJid] || 0;
    this.data.warnings[userJid] = current + 1;
    this.save();
    return this.data.warnings[userJid];
  }

  public getWarnings(userJid: string): number {
    return this.data.warnings[userJid] || 0;
  }

  public resetWarnings(userJid: string): void {
    delete this.data.warnings[userJid];
    this.save();
  }

  public addMemory(jid: string, text: string): string[] {
    if (!this.data.memories[jid]) {
      this.data.memories[jid] = [];
    }
    this.data.memories[jid].push(text);
    if (this.data.memories[jid].length > 30) {
      this.data.memories[jid] = this.data.memories[jid].slice(-30);
    }
    this.save();
    return this.data.memories[jid];
  }

  public forgetMemory(jid: string, query: string): string[] {
    if (!this.data.memories[jid]) return [];
    if (!query || query.toLowerCase() === 'all') {
      this.data.memories[jid] = [];
    } else {
      const q = query.toLowerCase();
      this.data.memories[jid] = this.data.memories[jid].filter(
        (m) => !m.toLowerCase().includes(q)
      );
    }
    this.save();
    return this.data.memories[jid];
  }

  public getMemories(jid: string): string[] {
    return this.data.memories[jid] || [];
  }

  public addNote(jid: string, text: string): string[] {
    if (!this.data.notes[jid]) {
      this.data.notes[jid] = [];
    }
    if (text.toLowerCase() === 'clear' || text.toLowerCase() === 'reset') {
      this.data.notes[jid] = [];
    } else {
      this.data.notes[jid].push(text);
    }
    this.save();
    return this.data.notes[jid];
  }

  public getNotes(jid: string): string[] {
    return this.data.notes[jid] || [];
  }

  public addTodo(jid: string, text: string): TodoItem[] {
    if (!this.data.todos[jid]) {
      this.data.todos[jid] = [];
    }
    const lower = text.trim().toLowerCase();
    if (lower === 'clear' || lower === 'reset') {
      this.data.todos[jid] = [];
    } else if (lower.startsWith('done ')) {
      const idx = parseInt(lower.replace('done ', '').trim(), 10) - 1;
      if (this.data.todos[jid][idx]) {
        this.data.todos[jid][idx].done = true;
      }
    } else {
      this.data.todos[jid].push({
        id: `todo-${Date.now()}`,
        task: text.trim(),
        done: false,
        createdAt: new Date().toISOString(),
      });
    }
    this.save();
    return this.data.todos[jid];
  }

  public getTodos(jid: string): TodoItem[] {
    return this.data.todos[jid] || [];
  }

  public isUserBlocked(userJid: string): boolean {
    const clean = userJid.split(':')[0].split('@')[0];
    return this.data.blockedUsers.some((b) => b.includes(clean));
  }

  public addBlockedUser(userJid: string) {
    if (!this.isUserBlocked(userJid)) {
      this.data.blockedUsers.push(userJid);
      this.save();
    }
  }

  public removeBlockedUser(userJid: string) {
    const clean = userJid.split(':')[0].split('@')[0];
    this.data.blockedUsers = this.data.blockedUsers.filter((b) => !b.includes(clean));
    this.save();
  }

  public getBlockedUsers(): string[] {
    return this.data.blockedUsers;
  }

  public addReminder(item: ReminderItem) {
    this.activeReminders.push(item);
  }

  public removeReminder(id: string) {
    this.activeReminders = this.activeReminders.filter((r) => r.id !== id);
  }

  public getReminders(jid?: string): ReminderItem[] {
    if (!jid) return this.activeReminders;
    return this.activeReminders.filter((r) => r.jid === jid);
  }

  public clearConversationHistory(jid: string) {
    const conv = this.data.conversations.find((c) => c.jid === jid || c.id === jid);
    if (conv) {
      conv.messages = [];
      conv.topicContext = 'Fresh Session';
      conv.needsOwnerAttention = false;
      this.save();
    }
  }

  public verifyPin(pin: string): boolean {
    return hashPin(pin) === this.data.adminPinHash;
  }

  public updatePin(currentPin: string, newPin: string): boolean {
    if (!this.verifyPin(currentPin)) return false;
    this.data.adminPinHash = hashPin(newPin);
    this.addLog('SECURITY', 'Admin PIN Updated', 'Owner updated the security PIN.');
    this.save(true, true);
    return true;
  }

  public getBusiness(): BusinessKnowledge {
    return this.data.business;
  }

  public updateBusiness(partial: Partial<BusinessKnowledge>): BusinessKnowledge {
    this.data.business = {
      ...this.data.business,
      ...partial,
    };
    this.addLog('INFO', 'Knowledge Base Updated', 'Business profile settings updated.');
    this.save(true, true);
    return this.data.business;
  }

  public getConversations(): Conversation[] {
    return this.data.conversations;
  }

  public getConversation(idOrJid: string): Conversation | undefined {
    return this.data.conversations.find((c) => c.id === idOrJid || c.jid === idOrJid);
  }

  public upsertConversation(conv: Conversation) {
    const idx = this.data.conversations.findIndex(
      (c) => c.id === conv.id || c.jid === conv.jid
    );
    if (idx >= 0) {
      this.data.conversations[idx] = conv;
    } else {
      this.data.conversations.unshift(conv);
    }
    this.save();
  }

  public appendMessage(
    jid: string,
    msg: ChatMessage,
    meta?: {
      customerName?: string;
      phoneNumber?: string;
      isGroup?: boolean;
      detectedLanguage?: string;
      topicContext?: string;
      markHandover?: boolean;
      handoverReason?: string;
    }
  ): Conversation {
    let conv = this.getConversation(jid);
    if (!conv) {
      conv = {
        id: `conv-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        jid,
        customerName: meta?.customerName || 'WhatsApp User',
        phoneNumber: meta?.phoneNumber || jid.replace('@s.whatsapp.net', ''),
        isGroup: Boolean(meta?.isGroup),
        aiPaused: false,
        needsOwnerAttention: false,
        detectedLanguage: meta?.detectedLanguage || 'Roman Urdu',
        topicContext: meta?.topicContext || 'General Chat',
        lastUpdated: new Date().toISOString(),
        messages: [],
      };
      this.data.conversations.unshift(conv);
    }

    conv.messages.push(msg);
    if (conv.messages.length > 80) {
      conv.messages = conv.messages.slice(-80);
    }

    conv.lastUpdated = msg.timestamp;
    if (meta?.customerName) conv.customerName = meta.customerName;
    if (meta?.detectedLanguage) conv.detectedLanguage = meta.detectedLanguage;
    if (meta?.topicContext) conv.topicContext = meta.topicContext;
    if (meta?.markHandover !== undefined) {
      conv.needsOwnerAttention = meta.markHandover;
      conv.handoverReason = meta.handoverReason;
      if (meta.markHandover) {
        this.data.analytics.ownerTakeovers += 1;
      }
    }

    this.data.analytics.totalMessagesProcessed += 1;
    if (msg.sender === 'ai') {
      this.data.analytics.aiRepliesSent += 1;
      if (msg.files && msg.files.length > 0) {
        this.data.analytics.codeSnippetsGenerated += msg.files.length;
      }
    }

    this.data.conversations.sort(
      (a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime()
    );

    this.save();
    return conv;
  }

  public setConversationAiPaused(idOrJid: string, paused: boolean): Conversation | undefined {
    const conv = this.getConversation(idOrJid);
    if (!conv) return undefined;
    conv.aiPaused = paused;
    if (paused) {
      conv.needsOwnerAttention = false;
    }
    this.save();
    return conv;
  }

  public incrementGroupFiltered() {
    this.data.analytics.groupFilteredCount += 1;
    this.save();
  }

  public getLogs(): LogEntry[] {
    return this.data.logs;
  }

  public addLog(level: LogEntry['level'], event: string, details: string) {
    const entry: LogEntry = {
      id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
      level,
      event,
      details,
    };
    this.data.logs.unshift(entry);
    if (this.data.logs.length > 150) {
      this.data.logs = this.data.logs.slice(0, 150);
    }
    this.save();
  }

  public getAnalytics() {
    return {
      ...this.data.analytics,
      activeConversations: this.data.conversations.length,
      handoverPendingCount: this.data.conversations.filter((c) => c.needsOwnerAttention)
        .length,
    };
  }

  // =========================================================================
  // 🛡️ ADMIN AUDIT & LOGIN METHODS
  // =========================================================================
  public getAuditLogs(): AuditLogEntry[] {
    return this.data.auditLogs || [];
  }

  public addAuditLog(
    actor: string,
    action: string,
    details: string,
    status: 'SUCCESS' | 'WARN' | 'FAIL' = 'SUCCESS',
    ip?: string
  ) {
    const entry: AuditLogEntry = {
      id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
      actor,
      action,
      details,
      status,
      ip,
    };
    if (!this.data.auditLogs) this.data.auditLogs = [];
    this.data.auditLogs.unshift(entry);
    if (this.data.auditLogs.length > 250) {
      this.data.auditLogs = this.data.auditLogs.slice(0, 250);
    }
    this.save();
    return entry;
  }

  public clearAuditLogs() {
    this.data.auditLogs = [
      {
        id: `audit-${Date.now()}`,
        timestamp: new Date().toISOString(),
        actor: 'Admin',
        action: 'LOGS_PURGED',
        details: 'Audit logs history was purged with confirmation.',
        status: 'WARN',
      },
    ];
    this.save();
  }

  public getLoginAttempts(): LoginAttempt[] {
    return this.data.loginAttempts || [];
  }

  public addLoginAttempt(ip: string, userAgent: string, success: boolean, reason?: string) {
    const item: LoginAttempt = {
      id: `login-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
      ip,
      userAgent: userAgent.slice(0, 120),
      success,
      reason,
    };
    if (!this.data.loginAttempts) this.data.loginAttempts = [];
    this.data.loginAttempts.unshift(item);
    if (this.data.loginAttempts.length > 100) {
      this.data.loginAttempts = this.data.loginAttempts.slice(0, 100);
    }
    this.save();
  }

  // =========================================================================
  // ⚡ COMMAND MANAGEMENT
  // =========================================================================
  public getCustomCommands(): CustomCommandItem[] {
    return Object.values(this.data.customCommands || {});
  }

  public setCustomCommand(item: Omit<CustomCommandItem, 'id' | 'createdAt'> & { id?: string }): CustomCommandItem {
    const id = item.id || `custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const full: CustomCommandItem = {
      id,
      name: item.name.toLowerCase().replace(/[^a-z0-9_-]/g, ''),
      response: item.response,
      category: item.category || 'Custom',
      description: item.description || `Custom bot command .${item.name}`,
      enabled: item.enabled ?? true,
      createdBy: item.createdBy || 'Admin',
      createdAt: new Date().toISOString(),
    };
    if (!this.data.customCommands) this.data.customCommands = {};
    this.data.customCommands[full.name] = full;
    this.save(true, true);
    return full;
  }

  public deleteCustomCommand(nameOrId: string): boolean {
    if (!this.data.customCommands) return false;
    const clean = nameOrId.toLowerCase().replace(/[^a-z0-9_-]/g, '');
    if (this.data.customCommands[clean]) {
      delete this.data.customCommands[clean];
      this.save(true, true);
      return true;
    }
    for (const [k, v] of Object.entries(this.data.customCommands)) {
      if (v.id === nameOrId) {
        delete this.data.customCommands[k];
        this.save(true, true);
        return true;
      }
    }
    return false;
  }

  public getCommandRules(): Record<string, CommandRule> {
    return this.data.commandRules || {};
  }

  public setCommandRule(rule: Partial<CommandRule> & { command: string }): CommandRule {
    const cmd = rule.command.toLowerCase().replace(/[^a-z0-9_-]/g, '');
    if (!this.data.commandRules) this.data.commandRules = {};
    const existing = this.data.commandRules[cmd] || {
      command: cmd,
      enabled: true,
      cooldownSec: 2,
      permission: 'all',
      usageCount: 0,
    };
    const updated: CommandRule = {
      ...existing,
      ...rule,
      command: cmd,
    };
    this.data.commandRules[cmd] = updated;
    this.save(true, true);
    return updated;
  }

  public isCommandDisabled(cmdName: string): boolean {
    const clean = cmdName.toLowerCase().trim();
    const rule = this.data.commandRules?.[clean];
    if (rule && rule.enabled === false) return true;
    const custom = this.data.customCommands?.[clean];
    if (custom && custom.enabled === false) return true;
    return false;
  }

  public recordCommandExecution(cmdName: string, userJid?: string) {
    const clean = cmdName.toLowerCase().trim();
    if (!this.data.commandExecutions) this.data.commandExecutions = {};
    this.data.commandExecutions[clean] = (this.data.commandExecutions[clean] || 0) + 1;

    if (this.data.commandRules?.[clean]) {
      this.data.commandRules[clean].usageCount = (this.data.commandRules[clean].usageCount || 0) + 1;
    }

    if (userJid) {
      this.touchUserActivity(userJid, true);
    }
    this.save();
  }

  public getCommandExecutions(): Record<string, number> {
    return this.data.commandExecutions || {};
  }

  // =========================================================================
  // 👥 USER MANAGEMENT
  // =========================================================================
  public touchUserActivity(jid: string, incrementCommand = false, name?: string) {
    if (!this.data.userMetas) this.data.userMetas = {};
    const phone = jid.split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
    const existing = this.data.userMetas[jid] || {
      jid,
      phone: `+${phone}`,
      name: name || `User +${phone.slice(-4)}`,
      role: 'normal',
      commandsBlocked: false,
      commandCount: 0,
      lastActive: new Date().toISOString(),
      warnings: this.getWarnings(jid),
    };

    if (name) existing.name = name;
    if (incrementCommand) existing.commandCount = (existing.commandCount || 0) + 1;
    existing.lastActive = new Date().toISOString();
    existing.warnings = this.getWarnings(jid);

    this.data.userMetas[jid] = existing;
    this.save();
  }

  public getUserMetas(): UserMeta[] {
    if (!this.data.userMetas) this.data.userMetas = {};
    // Seed from conversations if empty
    for (const conv of this.data.conversations) {
      if (conv.jid && !this.data.userMetas[conv.jid]) {
        const phone = conv.jid.split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
        this.data.userMetas[conv.jid] = {
          jid: conv.jid,
          phone: `+${phone}`,
          name: conv.customerName || `User +${phone.slice(-4)}`,
          role: 'normal',
          commandsBlocked: false,
          commandCount: 0,
          lastActive: conv.lastUpdated,
          warnings: this.getWarnings(conv.jid),
        };
      }
    }
    return Object.values(this.data.userMetas);
  }

  public setUserBanned(jidOrPhone: string, banned: boolean) {
    const phoneDigits = jidOrPhone.replace(/[^0-9]/g, '');
    const cleanJid = jidOrPhone.includes('@') ? jidOrPhone : `${phoneDigits}@s.whatsapp.net`;
    if (banned) {
      if (!this.data.blockedUsers.includes(cleanJid)) {
        this.data.blockedUsers.push(cleanJid);
      }
    } else {
      this.data.blockedUsers = this.data.blockedUsers.filter(
        (u) => u !== cleanJid && !u.includes(phoneDigits)
      );
    }
    if (this.data.userMetas?.[cleanJid]) {
      this.data.userMetas[cleanJid].role = banned ? 'banned' : 'normal';
    }
    this.save(true, true);
  }

  public setUserCommandsBlocked(jidOrPhone: string, blocked: boolean) {
    const cleanJid = jidOrPhone.includes('@')
      ? jidOrPhone
      : `${jidOrPhone.replace(/[^0-9]/g, '')}@s.whatsapp.net`;
    if (!this.data.userMetas) this.data.userMetas = {};
    if (!this.data.userMetas[cleanJid]) {
      this.touchUserActivity(cleanJid);
    }
    if (this.data.userMetas[cleanJid]) {
      this.data.userMetas[cleanJid].commandsBlocked = blocked;
    }
    this.save(true, true);
  }

  public setUserRole(jidOrPhone: string, role: UserMeta['role']) {
    const cleanJid = jidOrPhone.includes('@')
      ? jidOrPhone
      : `${jidOrPhone.replace(/[^0-9]/g, '')}@s.whatsapp.net`;
    if (!this.data.userMetas) this.data.userMetas = {};
    if (!this.data.userMetas[cleanJid]) {
      this.touchUserActivity(cleanJid);
    }
    if (this.data.userMetas[cleanJid]) {
      this.data.userMetas[cleanJid].role = role;
    }
    this.save(true, true);
  }

  public isUserCommandsBlocked(jid: string): boolean {
    const meta = this.data.userMetas?.[jid];
    return Boolean(meta?.commandsBlocked);
  }

  // =========================================================================
  // 🧠 AI & 💾 DOWNLOADER CONFIGS
  // =========================================================================
  public getAiConfig(): AiConfig {
    return this.data.aiConfig;
  }

  public updateAiConfig(patch: Partial<AiConfig>): AiConfig {
    this.data.aiConfig = {
      ...this.data.aiConfig,
      ...patch,
    };
    this.save(true, true);
    return this.data.aiConfig;
  }

  public getDownloaderConfig(): DownloaderConfig {
    return this.data.downloaderConfig;
  }

  public updateDownloaderConfig(patch: Partial<DownloaderConfig>): DownloaderConfig {
    this.data.downloaderConfig = {
      ...this.data.downloaderConfig,
      ...patch,
    };
    this.save(true, true);
    return this.data.downloaderConfig;
  }

  // =========================================================================
  // 🌐 WEBSITE CONFIGURATION
  // =========================================================================
  public getWebsiteConfig(): WebsiteConfig {
    return this.data.websiteConfig;
  }

  public updateWebsiteConfig(patch: Partial<WebsiteConfig>): WebsiteConfig {
    if (Object.prototype.hasOwnProperty.call(patch, 'contactPhone')) {
      const raw = String(patch.contactPhone ?? '').trim();
      const cleanDigits = raw.replace(/[^0-9]/g, '');
      this.data.settings.ownerNumber = raw ? cleanDigits || raw : '';
      this.data.business.contactNumbers = raw;
    }
    this.data.websiteConfig = {
      ...this.data.websiteConfig,
      ...patch,
    };
    this.save(true, true);
    return this.data.websiteConfig;
  }

  // =========================================================================
  // 🎵 CYBER MUSIC & PLAYLIST ENGINE
  // =========================================================================
  public getSongs(): SongItem[] {
    if (!this.data.songsPlaylist) {
      this.data.songsPlaylist = [...DEFAULT_SONGS];
      this.save(true, true);
    }
    return this.data.songsPlaylist;
  }

  public addSong(song: Omit<SongItem, 'id'>): SongItem {
    const id = `song-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const newSong: SongItem = { id, ...song };
    if (!this.data.songsPlaylist) {
      this.data.songsPlaylist = [];
    }
    this.data.songsPlaylist.unshift(newSong);
    this.addAuditLog('Admin', 'SONG_ADDED', `Added track "${newSong.title}"`, 'SUCCESS');
    this.save(true, true);
    return newSong;
  }

  public deleteSong(id: string): boolean {
    if (!this.data.songsPlaylist) return false;
    const initialLen = this.data.songsPlaylist.length;
    this.data.songsPlaylist = this.data.songsPlaylist.filter((s) => s.id !== id);
    if (this.data.songsPlaylist.length !== initialLen) {
      this.addAuditLog('Admin', 'SONG_DELETED', `Deleted track ID ${id}`, 'WARN');
      this.save(true, true);
      return true;
    }
    return false;
  }

  // =========================================================================
  // 📦 DATABASE BACKUP & RESTORE
  // =========================================================================
  public createBackupSnapshot(): { filename: string; size: number; timestamp: string } {
    const backupDir = path.join(DATA_DIR, 'backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `xik_backup_${timestamp}.json`;
    const targetPath = path.join(backupDir, filename);

    const snapshot = JSON.stringify(this.data, null, 2);
    fs.writeFileSync(targetPath, snapshot, 'utf-8');
    const stat = fs.statSync(targetPath);

    this.addAuditLog(
      'Admin',
      'BACKUP_CREATED',
      `Manual snapshot ${filename} created (${Math.round(stat.size / 1024)} KB).`,
      'SUCCESS'
    );

    return {
      filename,
      size: stat.size,
      timestamp: new Date().toISOString(),
    };
  }

  public listBackups(): Array<{ filename: string; size: number; timestamp: string }> {
    const backupDir = path.join(DATA_DIR, 'backups');
    if (!fs.existsSync(backupDir)) return [];
    try {
      const files = fs.readdirSync(backupDir).filter((f) => f.endsWith('.json'));
      return files
        .map((f) => {
          const stat = fs.statSync(path.join(backupDir, f));
          return {
            filename: f,
            size: stat.size,
            timestamp: stat.mtime.toISOString(),
          };
        })
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    } catch {
      return [];
    }
  }

  public restoreBackupSnapshot(filename: string): boolean {
    const backupDir = path.join(DATA_DIR, 'backups');
    const targetPath = path.join(backupDir, filename);
    if (!fs.existsSync(targetPath)) return false;
    try {
      const raw = fs.readFileSync(targetPath, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        this.data = {
          ...this.data,
          ...parsed,
        };
        this.save(true);
        this.addAuditLog(
          'Admin',
          'BACKUP_RESTORED',
          `Restored database snapshot from ${filename}`,
          'WARN'
        );
        return true;
      }
      return false;
    } catch (e: any) {
      console.error('Failed to restore backup snapshot:', e);
      return false;
    }
  }
}

export const store = new StoreManager();
