import type { WASocket } from '@whiskeysockets/baileys';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { execFile } from 'child_process';
import { promisify } from 'util';
import {
  store,
  DEFAULT_MENU_IMAGE_PATH,
  DEFAULT_CHANNEL_INVITE_CODE,
} from './server_store.ts';
import { generateTextWithFallbackModels } from './server_ai.ts';

const execFileAsync = promisify(execFile);

export function normalizePhoneDigits(raw: string): string {
  let digits = raw.replace(/[^0-9]/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith('03')) digits = '92' + digits.slice(1);
  if (digits.length === 10 && digits.startsWith('3')) digits = '92' + digits;
  return digits;
}

export function formatUptime(bootTimeMs: number): string {
  const sec = Math.floor((Date.now() - bootTimeMs) / 1000);
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const parts: string[] = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0 || d > 0) parts.push(`${h}h`);
  parts.push(`${m}m`);
  parts.push(`${s}s`);
  return parts.join(' ');
}

const SMALL_CAPS_MAP: Record<string, string> = {
  a: 'ᴀ', b: 'ʙ', c: 'ᴄ', d: 'ᴅ', e: 'ᴇ', f: 'ғ', g: 'ɢ', h: 'ʜ', i: 'ɪ',
  j: 'ᴊ', k: 'ᴋ', l: 'ʟ', m: 'ᴍ', n: 'ɴ', o: 'ᴏ', p: 'ᴘ', q: 'ǫ', r: 'ʀ',
  s: 's', t: 'ᴛ', u: 'ᴜ', v: 'ᴠ', w: 'ᴡ', x: 'x', y: 'ʏ', z: 'ᴢ',
};

export function toSmallCaps(input: string): string {
  return Array.from(input.toLowerCase())
    .map((ch) => SMALL_CAPS_MAP[ch] || ch)
    .join('');
}

function buildMenuCategoryBox(title: string, emoji: string, cmds: string[]): string {
  const header = `╭─✦ ${emoji}「 *${toSmallCaps(title)}* 」✦`;
  const body = cmds.map((c) => `│ ◈ ${toSmallCaps(c)}`);
  return [header, ...body, `╰───────────✦`].join('\n');
}

/**
 * Clean, Compact, Short-Line Small-Caps Box Menu with ALL Old + New Commands
 */
export function buildCompactMenuText(_isOwner: boolean): string {
  const s = store.getSettings();
  const p = s.prefix || '.';
  const onlineState = store.getAiMode() ? '🟢 ᴏɴʟɪɴᴇ' : '🟡 sᴛᴀɴᴅʙʏ';
  const modeLabel = toSmallCaps(s.botMode || 'public');

  const rawTitle = s.menuTitle || 'SAYRON MD';
  const displayTitle = toSmallCaps(rawTitle.includes('SUFYAN') ? 'SAYRON MD' : rawTitle);

  const categories: Array<{ title: string; emoji: string; cmds: string[] }> = [
    {
      title: 'core',
      emoji: '⚡',
      cmds: [
        'alive', 'allmenu', 'menu', 'bv', 'jid', 'ping', 'speed', 'uptime',
        'health', 'status', 'about', 'version', 'system', 'specs',
        'turbo', 'boost', 'clean', 'settings', 'stats', 'logs', 'device',
      ],
    },
    {
      title: 'group',
      emoji: '🛡️',
      cmds: [
        'admins', 'members', 'ags', 'antigm', 'antigroupstatus',
        'antilink', 'antispam', 'antimod', 'approval', 'approve',
        'approveall', 'del', 'delete', 'demote', 'demoteall', 'dll',
        'dlt', 'ginfo', 'gpp', 'grouplink', 'groupai', 'groupmode',
        'invite', 'join', 'kall', 'kick', 'kickall', 'left', 'leave',
        'lock', 'unlock', 'meadmin', 'mute', 'unmute', 'pdm', 'poll',
        'pollgroup', 'promote', 'promoteall', 'remove', 'resetwarn',
        'revoke', 'rules', 'setrules', 'setgdesc', 'setgname',
        'setgcpfp', 'cleargc', 'setwarn', 'setwelcome', 'tag',
        'tagall', 'tagadmin', 'hidetag', 'unauthorizedadmin',
        'warn', 'warns', 'welcome', 'goodbye',
      ],
    },
    {
      title: 'owner',
      emoji: '👑',
      cmds: [
        'alwaysonline', 'ar', 'autoreact', 'autoread', 'autoreply',
        'autostatus', 'bancheck', 'bc', 'bcgc', 'block', 'unblock',
        'broadcast', 'busy', 'callmusic', 'checkban', 'delsudo',
        'delvar', 'forward', 'getsudo', 'gjids', 'isbanned',
        'language', 'maintenance', 'mode', 'offline', 'online',
        'owner', 'pay', 'personality', 'playcall', 'ppay', 'prefix',
        'presence', 'react', 'read', 'reboot', 'restart', 'setbio',
        'setgif', 'setimage', 'setmenu', 'setname', 'setprefix',
        'setsudo', 'setvar', 'shutdown', 'statuslike', 'statusreact',
        'statussave', 'save', 'sudo', 'typing', 'users',
      ],
    },
    {
      title: 'tools',
      emoji: '🧰',
      cmds: [
        'ajoin', 'alinks', 'antidelete', 'antivv', 'base64', 'b64',
        'b64decode', 'binary', 'calc', 'convert', 'crypto', 'decode',
        'dns', 'encode', 'exec', 'fancy', 'forex', 'gbc', 'geoip',
        'gggg', 'github', 'gold', 'groups', 'gst', 'gcstatus', 'hash',
        'hb', 'ip', 'leaveall', 'math', 'morse', 'notes', 'password',
        'pkr', 'plugin', 'plugins', 'qr', 'readmore', 'reload',
        'remind', 'schedule', 'short', 'spam', 'statusview', 'style',
        'time', 'todo', 'translate', 'trt', 'update', 'uuid', 'vv',
        'weather', 'whois', 'wiki',
      ],
    },
    {
      title: 'ai zone',
      emoji: '🤖',
      cmds: [
        'ai', 'aion', 'aioff', 'ask', 'chat', 'jarvis', 'auto',
        'analyze', 'summarize', 'rewrite', 'correct', 'explain',
        'code', 'debug', 'review', 'prompt', 'think', 'assist',
        'smart', 'task', 'remember', 'forget', 'context', 'reset',
        'imagine', 'image', 'vision', 'caption', 'enhance', 'search',
        'def', 'define', 'dictionary', 'meaning', 'voices', 'lyrics',
      ],
    },
    {
      title: 'downloader',
      emoji: '📥',
      cmds: [
        'dl', 'facebook', 'fb', 'fbdl', 'fbvideo', 'ig', 'igdl',
        'igstalk', 'iguser', 'insta', 'instagram', 'mp4', 'tiktok',
        'tt', 'ttdl', 'video', 'yta', 'ytmp3', 'ytmp4', 'yts',
        'ytv', 'ytvideo',
      ],
    },
    {
      title: 'media',
      emoji: '🎵',
      cmds: [
        'audio', 'compress', 'download', 'livesticker', 'media',
        'mediainfo', 'mediaurl', 'music', 'naat', 'ocr', 'play',
        'qawwali', 'rename', 'ringtone', 's', 'say', 'song',
        'sticker', 'tg', 'tgsticker', 'tgstickers', 'toimg', 'tom3',
        'tomp3', 'toupload', 'tovideo', 'tovn', 'transcribe', 'tts',
        'uploadurl', 'url', 'vnto', 'voice', 'vto',
      ],
    },
    {
      title: 'studio & fx',
      emoji: '🎨',
      cmds: [
        '8d', 'bass', 'blur', 'chipmunk', 'cybercard', 'deepvoice',
        'earrape', 'glitch', 'grayscale', 'invert', 'jail', 'lofi',
        'mirror', 'neon', 'nightcore', 'pixelate', 'reverb',
        'reverse', 'rip', 'rotate', 'sepia', 'slowed', 'wanted',
        'wasted',
      ],
    },
    {
      title: 'reactions',
      emoji: '✨',
      cmds: [
        'angry', 'bite', 'blush', 'bonk', 'celebrate', 'clap', 'cry',
        'cuddle', 'dance', 'happy', 'highfive', 'hug', 'kill', 'kiss',
        'laugh', 'love', 'pat', 'poke', 'pout', 'punch', 'sad', 'shy',
        'slap', 'smile', 'smug', 'thumbsup', 'tickle', 'wave', 'wink',
      ],
    },
    {
      title: 'islamic & fun',
      emoji: '🕌',
      cmds: [
        '99names', 'advice', 'allahu', 'attitude', 'aura', 'ayah',
        'badshah', 'bewafa', 'boom', 'breach', 'bug', 'compliment',
        'cyberops', 'dare', 'decrypt', 'dosti', 'dua', 'fact',
        'fakecall', 'firewall', 'flex', 'flirt', 'ghazal', 'hack',
        'hadith', 'headers', 'insult', 'iqtest', 'joke', 'king',
        'loveshayari', 'mafia', 'match', 'matrix', 'namaz', 'osint',
        'payload', 'pentest', 'pickup', 'portscan', 'qibla', 'quran',
        'quote', 'riddle', 'roast', 'roastmeter', 'sadshayari',
        'savage', 'scan', 'shayari', 'ship', 'surah', 'tasbih',
        'trace', 'truth', 'vibe', 'vip', 'warnvirus',
      ],
    },
    {
      title: 'general',
      emoji: '💎',
      cmds: [
        'bio', 'dp', 'getbio', 'getdp', 'info', 'pair', 'pp',
        'repo', 'sc', 'take', 'takesticker',
      ],
    },
  ];

  const totalCmds = categories.reduce((sum, c) => sum + c.cmds.length, 0);

  const headerLines = [
    `╭─〔 👑 *${displayTitle}* 👑 〕─╮`,
    `│ ✦ ᴅᴇᴠ: sᴜғʏᴀɴ-x-ɪᴋ`,
    `│ ✦ ᴘʀᴇғɪx: [ ${p} ] • ${modeLabel}`,
    `│ ✦ sᴛᴀᴛᴜs: ${onlineState}`,
    `│ ✦ ᴄᴍᴅs: ${totalCmds}+ • ${formatUptime(store.bootTimeMs)}`,
    `│ ✦ ᴡᴇʙ: https://sufyantools.vercel.app/`,
    `╰─────────────✦`,
  ].join('\n');

  const boxes = categories
    .map((cat) => buildMenuCategoryBox(cat.title, cat.emoji, cat.cmds))
    .join('\n\n');

  const footer = `╰─〔 ⚡ *${displayTitle}* • sufyantools.vercel.app ⚡ 〕─╯`;
  return `${headerLines}\n\n${boxes}\n\n${footer}`;
}

/**
 * Wraps any plain bot reply or AI response with cute aesthetic symbols
 * ("jab Koch likhy to text be symbols ka sath ay PIYARA sa")
 */
export function stylizeTextWithCuteSymbols(rawText: string): string {
  const trimmed = (rawText || '').trim();
  if (!trimmed) return trimmed;
  // If already framed with our royal box border, return as-is
  if (
    trimmed.startsWith('╭━━') ||
    trimmed.startsWith('┏━━') ||
    trimmed.startsWith('╭──') ||
    trimmed.startsWith('╭─')
  ) {
    return trimmed;
  }

  const rawLines = trimmed.split('\n');
  const cuteIcons = ['✨', '💎', '🌸', '👑', '⚡', '💖', '❖', '🌷'];
  const decoratedLines = rawLines.map((line, idx) => {
    const l = line.trim();
    if (!l) return `┃`;
    if (l.startsWith('┃') || l.startsWith('╭') || l.startsWith('╰') || l.startsWith('┣') || l.startsWith('│')) {
      return l;
    }
    const icon = cuteIcons[idx % cuteIcons.length];
    return `┃ ${icon} ${l}`;
  });

  return [
    `╭━━〔 👑 *SAYRON MD* 👑 〕━━╮`,
    ...decoratedLines,
    `╰━━〔 ⚡ *SUFYAN-X-IK* ⚡ 〕━━╯`,
  ].join('\n');
}

let cachedMenuThumbBuffer: Buffer | null = null;
let cachedMenuThumbSource = '';
let channelResolveInFlight = false;

export async function resolveMenuImageBuffer(): Promise<Buffer | null> {
  const sayronBanner = path.resolve(process.cwd(), 'src', 'assets', 'images', 'sayron_md_banner.jpg');
  if (fs.existsSync(sayronBanner)) {
    return fs.readFileSync(sayronBanner);
  }
  const s = store.getSettings();
  const candidates = [s.menuImage, DEFAULT_MENU_IMAGE_PATH].filter(Boolean);

  for (const src of candidates) {
    try {
      if (src.startsWith('http://') || src.startsWith('https://')) {
        const res = await fetch(src);
        if (res.ok) {
          const ab = await res.arrayBuffer();
          return Buffer.from(ab);
        }
      } else {
        const rel = src.startsWith('/') ? src.slice(1) : src;
        const abs = path.resolve(process.cwd(), rel);
        if (fs.existsSync(abs)) {
          return fs.readFileSync(abs);
        }
      }
    } catch {
      // try next
    }
  }

  // Fallback to any banner image in src/assets/images
  try {
    const imgDir = path.resolve(process.cwd(), 'src', 'assets', 'images');
    if (fs.existsSync(imgDir)) {
      const files = fs.readdirSync(imgDir).filter((f) => /\.(jpg|jpeg|png|webp)$/i.test(f));
      if (files.length > 0) {
        return fs.readFileSync(path.join(imgDir, files[0]));
      }
    }
  } catch {
    // ignore
  }
  return null;
}

let cachedMenuGifMp4: Buffer | null = null;
let cachedOwnerGifMp4: Buffer | null = null;

export async function resolveMenuGifMp4Buffer(): Promise<Buffer | null> {
  if (cachedMenuGifMp4) return cachedMenuGifMp4;
  try {
    const candidates = [
      path.resolve(process.cwd(), 'src', 'assets', 'images', 'sayron_menu_anime_gif.mp4'),
      path.resolve(
        process.cwd(),
        'public',
        'assets',
        'aistudio',
        'H_nh_n_n_m_y_t_nh_full_hd___H_nh_n_n___ng_cho_m_y_t_nh__Ho_t_h_nh_3d__C__g_i_trong_manga_MP4__b540b66c.mp4'
      ),
    ];
    for (const p of candidates) {
      if (fs.existsSync(p)) {
        const buf = fs.readFileSync(p);
        if (buf.length > 1000) {
          cachedMenuGifMp4 = buf;
          return buf;
        }
      }
    }
  } catch {
    // ignore
  }
  return null;
}

export async function resolveMenuGifThumbBuffer(): Promise<Buffer | null> {
  try {
    const thumbPath = path.resolve(
      process.cwd(),
      'src',
      'assets',
      'images',
      'sayron_menu_anime_thumb.jpg'
    );
    if (fs.existsSync(thumbPath)) {
      const buf = fs.readFileSync(thumbPath);
      if (buf.length > 500) return buf;
    }
  } catch {
    // ignore
  }
  return null;
}

export async function resolveOwnerGifMp4Buffer(): Promise<Buffer | null> {
  if (cachedOwnerGifMp4) return cachedOwnerGifMp4;
  try {
    const candidates = [
      path.resolve(process.cwd(), 'src', 'assets', 'images', 'sayron_md_menu_gif.mp4'),
      path.resolve(process.cwd(), 'public', 'sayron_md_menu_gif.mp4'),
      path.resolve(process.cwd(), 'src', 'assets', 'images', 'sufyan_xik_menu_gif.mp4'),
      path.resolve(process.cwd(), 'src', 'assets', 'images', 'sufyan_xik_banner.mp4'),
    ];
    for (const p of candidates) {
      if (fs.existsSync(p)) {
        const buf = fs.readFileSync(p);
        if (buf.length > 1000) {
          cachedOwnerGifMp4 = buf;
          return buf;
        }
      }
    }
  } catch {
    // ignore
  }
  return null;
}

export async function saveCustomMenuVideoAsMp4(inputBuf: Buffer): Promise<boolean> {
  const tmpIn = path.join(os.tmpdir(), `xik_menu_in_${Date.now()}.mp4`);
  const outMp4 = path.resolve(
    process.cwd(),
    'src',
    'assets',
    'images',
    'sufyan_xik_banner.mp4'
  );
  const outGif1 = path.resolve(
    process.cwd(),
    'src',
    'assets',
    'images',
    'sufyan_xik_banner.gif'
  );
  const outGif2 = path.resolve(process.cwd(), 'public', 'sufyan_xik_banner.gif');
  try {
    fs.writeFileSync(tmpIn, inputBuf);
    await execFileAsync('ffmpeg', [
      '-y',
      '-i',
      tmpIn,
      '-t',
      '8',
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      '-vf',
      'scale=640:360:force_original_aspect_ratio=increase,crop=640:360',
      '-movflags',
      '+faststart',
      '-an',
      outMp4,
    ]);
    await execFileAsync('ffmpeg', [
      '-y',
      '-i',
      outMp4,
      '-vf',
      'fps=12,scale=540:-1:flags=lanczos',
      outGif1,
    ]).catch(() => {});
    if (fs.existsSync(outGif1)) {
      const pubDir = path.dirname(outGif2);
      if (!fs.existsSync(pubDir)) fs.mkdirSync(pubDir, { recursive: true });
      fs.copyFileSync(outGif1, outGif2);
    }
    if (fs.existsSync(outMp4)) {
      cachedMenuGifMp4 = fs.readFileSync(outMp4);
      return true;
    }
  } catch {
    return false;
  } finally {
    try {
      if (fs.existsSync(tmpIn)) fs.unlinkSync(tmpIn);
    } catch {
      // ignore
    }
  }
  return false;
}

/**
 * Extracts a clean 24-character invite code from either a full URL
 * (https://whatsapp.com/channel/0029VbD2ggC9WtCAOvZlwe1I) or raw code.
 */
export function extractCleanChannelInviteCode(rawInput?: string): string {
  const raw = (
    rawInput ||
    process.env.CHANNEL_INVITE_CODE ||
    store.getSettings().channelInviteCode ||
    DEFAULT_CHANNEL_INVITE_CODE
  ).trim();
  const urlMatch = raw.match(/whatsapp\.com\/channel\/([A-Za-z0-9_-]+)/i);
  if (urlMatch && urlMatch[1]) {
    return urlMatch[1].trim();
  }
  return raw.replace(/^https?:\/\/+/i, '').trim();
}

async function performChannelResolution(
  sock: WASocket,
  candidateCodes: string[]
): Promise<string> {
  const s = store.getSettings();
  for (const code of candidateCodes) {
    try {
      let meta: any = null;
      if (typeof (sock as any).newsletterMetadata === 'function') {
        meta = await Promise.race([
          (sock as any).newsletterMetadata('invite', code).catch(() => null),
          new Promise((resolve) => setTimeout(() => resolve(null), 2500)),
        ]);
      }

      if (meta) {
        const foundStr = typeof meta === 'string' ? meta : JSON.stringify(meta);
        const jidMatch = foundStr.match(/120363\d+@newsletter/);
        const resolvedJid =
          (meta?.id && String(meta.id).endsWith('@newsletter') ? String(meta.id) : null) ||
          (meta?.data?.xwa2_newsletter?.id ? String(meta.data.xwa2_newsletter.id) : null) ||
          (jidMatch ? jidMatch[0] : null);

        if (resolvedJid) {
          const resolvedName =
            meta?.name ||
            meta?.thread_metadata?.name?.text ||
            s.channelName ||
            'SUFYAN-X-IK • X-IK AI';
          store.updateSettings({
            channelJid: resolvedJid,
            channelInviteCode: code,
            channelName: resolvedName,
          });
          return resolvedJid;
        }
      }
    } catch {
      // try next candidate code
    }
  }
  const fallbackJid = '120363429680836023@newsletter';
  if (
    !s.channelJid ||
    s.channelJid === '120363398002948512@newsletter' ||
    s.channelJid === '120363000000000000@newsletter'
  ) {
    store.updateSettings({ channelJid: fallbackJid });
  }
  return (process.env.CHANNEL_JID || store.getSettings().channelJid || fallbackJid).trim();
}

/**
 * Resolves the real @newsletter JID from the 24-char channel invite code
 * without ever blocking `.menu` or destabilizing the WhatsApp WebSocket!
 */
export async function resolveChannelJidFromInvite(
  sock: WASocket | null,
  customInviteOrUrl?: string
): Promise<string> {
  const s = store.getSettings();
  const primaryCode = extractCleanChannelInviteCode(customInviteOrUrl);

  if (
    !customInviteOrUrl &&
    s.channelJid &&
    s.channelJid.endsWith('@newsletter') &&
    s.channelJid !== '120363398002948512@newsletter' &&
    s.channelJid !== '120363000000000000@newsletter'
  ) {
    return s.channelJid;
  }

  const candidateCodes = Array.from(
    new Set([primaryCode, '0029VbD2ggC9WtCAOvZlwe1I'].filter(Boolean))
  );

  if (sock && customInviteOrUrl) {
    return await performChannelResolution(sock, candidateCodes);
  }

  const fallbackJid = '120363429680836023@newsletter';
  if (
    !s.channelJid ||
    s.channelJid === '120363398002948512@newsletter' ||
    s.channelJid === '120363000000000000@newsletter'
  ) {
    store.updateSettings({ channelJid: fallbackJid });
  }
  return (process.env.CHANNEL_JID || store.getSettings().channelJid || fallbackJid).trim();
}

export function buildMetaVerifiedQuote(displayLabel = '! SAYRON MD !') {
  return {
    key: {
      remoteJid: 'status@broadcast',
      fromMe: false,
      id: `SAYRON-META-${Date.now().toString(36).toUpperCase()}`,
      participant: '13135550002@s.whatsapp.net',
    },
    message: {
      contactMessage: {
        displayName: displayLabel,
        vcard: [
          'BEGIN:VCARD',
          'VERSION:3.0',
          'N:;SAYRON MD;;;',
          `FN:${displayLabel}`,
          'item1.TEL;waid=13135550002:+1 313-555-0002',
          'item1.X-ABLabel:Meta Verified',
          'END:VCARD',
        ].join('\n'),
      },
    },
  };
}

export async function buildNewsletterContextInfo(
  resolvedJid?: string,
  _imgBuffer?: Buffer | null,
  forwardingScore = 999
): Promise<Record<string, any>> {
  const s = store.getSettings();
  const rawJid = (
    resolvedJid ||
    process.env.CHANNEL_JID ||
    s.channelJid ||
    '120363429680836023@newsletter'
  ).trim();
  const jid =
    rawJid &&
    rawJid.endsWith('@newsletter') &&
    rawJid !== '120363398002948512@newsletter' &&
    rawJid !== '120363000000000000@newsletter'
      ? rawJid
      : '120363429680836023@newsletter';

  const rawChannel = s.channelName || 'SAYRON MD • X-IK AI';
  const displayChannel = rawChannel.includes('SUFYAN') ? 'SAYRON MD • X-IK AI' : rawChannel;

  return {
    forwardingScore,
    isForwarded: true,
    forwardedNewsletterMessageInfo: {
      newsletterJid: jid,
      newsletterName: displayChannel,
      serverMessageId: 1,
    },
  };
}

export const SUFYAN_TOOLS_URL = 'https://sufyantools.vercel.app/';

export function buildSufyanToolsAdReply(thumbBuf?: Buffer | null): Record<string, any> {
  return {
    title: '🌐 SUFYAN TOOLS • Online Servers',
    body: '⚡ Live Online Servers • AI & Pro Bot Panel',
    mediaType: 1,
    ...(thumbBuf ? { thumbnail: thumbBuf } : {}),
    sourceUrl: SUFYAN_TOOLS_URL,
    renderLargerThumbnail: false,
  };
}

/**
 * Remuxes M4A/MP4 AAC audio with +faststart in ~150ms (zero re-encoding CPU delay!),
 * falling back to MP3 transcode only if input isn't an MP4/M4A container.
 */
async function fastPreparePlayableAudio(
  inputBuf: Buffer
): Promise<{ buffer: Buffer; mimeType: 'audio/mp4' | 'audio/mpeg' }> {
  const tmpId = `xik_song_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const inPath = path.join(os.tmpdir(), `${tmpId}.m4a`);
  const outM4aPath = path.join(os.tmpdir(), `${tmpId}_fast.m4a`);
  const outMp3Path = path.join(os.tmpdir(), `${tmpId}.mp3`);
  try {
    await fs.promises.writeFile(inPath, inputBuf);
    try {
      await execFileAsync('ffmpeg', [
        '-y',
        '-i',
        inPath,
        '-vn',
        '-c:a',
        'copy',
        '-movflags',
        '+faststart',
        outM4aPath,
      ]);
      if (fs.existsSync(outM4aPath)) {
        const fastBuf = await fs.promises.readFile(outM4aPath);
        if (fastBuf.length > 10000) {
          return { buffer: fastBuf, mimeType: 'audio/mp4' };
        }
      }
    } catch {
      // Fallback to fast MP3 encode if stream copy fails
      await execFileAsync('ffmpeg', [
        '-y',
        '-i',
        inPath,
        '-vn',
        '-ar',
        '44100',
        '-ac',
        '2',
        '-b:a',
        '128k',
        '-f',
        'mp3',
        outMp3Path,
      ]);
      if (fs.existsSync(outMp3Path)) {
        const mp3Buf = await fs.promises.readFile(outMp3Path);
        if (mp3Buf.length > 10000) {
          return { buffer: mp3Buf, mimeType: 'audio/mpeg' };
        }
      }
    }
  } catch {
    // fallback to original buffer
  } finally {
    fs.promises.unlink(inPath).catch(() => {});
    fs.promises.unlink(outM4aPath).catch(() => {});
    fs.promises.unlink(outMp3Path).catch(() => {});
  }
  return { buffer: inputBuf, mimeType: 'audio/mp4' };
}

let cachedSoundCloudClientId = 'YYoimyQCMUihxEuKuE6GGAx1wPZ8ufgS';
let lastScIdRefreshMs = 0;

async function getSoundCloudClientId(headers: Record<string, string>): Promise<string> {
  if (cachedSoundCloudClientId && Date.now() - lastScIdRefreshMs < 30 * 60 * 1000) {
    return cachedSoundCloudClientId;
  }
  try {
    const scPage = await fetch('https://soundcloud.com', {
      headers,
      signal: AbortSignal.timeout(3500),
    });
    if (scPage.ok) {
      const scHtml = await scPage.text();
      const scripts = [
        ...scHtml.matchAll(/src="(https:\/\/a-v2\.sndcdn\.com\/assets\/[^"]+\.js)"/g),
      ].map((m) => m[1]);
      for (const s of scripts.slice(-4)) {
        const jsRes = await fetch(s, { headers, signal: AbortSignal.timeout(3000) });
        if (jsRes.ok) {
          const js = await jsRes.text();
          const m = js.match(/client_id\s*:\s*"([a-zA-Z0-9]{32})"/);
          if (m && m[1]) {
            cachedSoundCloudClientId = m[1];
            lastScIdRefreshMs = Date.now();
            return cachedSoundCloudClientId;
          }
        }
      }
    }
  } catch {
    // use fallback
  }
  lastScIdRefreshMs = Date.now();
  return cachedSoundCloudClientId;
}

const UNWANTED_SONG_MOD_REGEX =
  /\b(remix|mashup|slowed|reverb|8d|shinchan|cover|karaoke|instrumental|acapella|vocals|dnb|drill|edit|flip|lofi|reprise|unplugged|ringtone|short)\b/i;

function scoreSongCandidate(
  query: string,
  title: string,
  artist: string,
  plays: number,
  rankIdx: number
): number {
  const qLower = query.toLowerCase();
  const tokens = qLower.split(/[^a-z0-9]+/).filter((w) => w.length >= 2);
  const tLower = (title || '').toLowerCase();
  const fullLower = `${title || ''} ${artist || ''}`.toLowerCase();
  let score = Math.max(0, 220 - rankIdx * 35);

  if (tokens[0] && new RegExp(`\\b${tokens[0]}`, 'i').test(tLower)) {
    score += 550;
  } else if (tokens[0] && tLower.includes(tokens[0])) {
    score += 400;
  } else {
    score -= 600;
  }

  let matchedTokens = 0;
  for (const tok of tokens) {
    if (tLower.includes(tok)) {
      score += 220;
      matchedTokens++;
    } else if (fullLower.includes(tok)) {
      score += 140;
      matchedTokens++;
    }
  }
  if (tokens.length >= 2 && matchedTokens < Math.ceil(tokens.length * 0.6)) {
    score -= 500;
  }

  if (!UNWANTED_SONG_MOD_REGEX.test(qLower) && UNWANTED_SONG_MOD_REGEX.test(fullLower)) {
    score -= 480;
  }

  score += Math.min(300, Math.log10((Number(plays) || 1) + 1) * 42);
  return score;
}

/**
 * FULL-LENGTH Exact Song Resolver for .song / .play / .audio / .music / .naat / .qawwali
 * Combines SoundCloud v2 Progressive Full-MP3 & JioSaavn with Smart Keyword + Popularity Ranking
 * so the exact song the user writes always comes!
 */
export async function fetchPlayableSong(query: string): Promise<{
  audioBuffer: Buffer;
  mimeType: 'audio/mpeg' | 'audio/mp4';
  title: string;
  artist: string;
  durationSec?: number;
  coverBuffer?: Buffer;
} | null> {
  const headers = {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    Accept: '*/*',
  };

  const cleanedQuery = query
    .replace(/\b(full\s+song|song|mp3|audio|official|video|download)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  const qTarget = cleanedQuery || query.trim();
  const allowShortClip = /\b(ringtone|short|shorts|status|clip|snippet|teaser)\b/i.test(query);

  // ⚡ 0. PRIMARY HIGH-ACCURACY ENGINE: Direct JioSaavn with Full-Length + Score Verification
  try {
    const saavnRes = await fetch(
      `https://www.jiosaavn.com/api.php?__call=search.getResults&_format=json&_marker=0&api_version=4&ctx=web6dot0&n=8&p=1&q=${encodeURIComponent(qTarget)}`,
      { headers: { ...headers, Referer: 'https://www.jiosaavn.com/' }, signal: AbortSignal.timeout(4500) }
    );
    if (saavnRes.ok) {
      const saavnData: any = await saavnRes.json();
      const results: any[] = saavnData?.results || [];

      const matchedItem = results.find((item: any, idx: number) => {
        if (!item?.more_info?.encrypted_media_url) return false;
        const dur = Number(item?.more_info?.duration || 0);
        if (!allowShortClip && dur > 0 && dur < 50) return false;
        const tTitle = String(item.title || '').replace(/&quot;/g, '"');
        const tArtist =
          item.more_info?.artistMap?.primary_artists?.map((a: any) => a.name).join(', ') ||
          item.subtitle ||
          '';
        return scoreSongCandidate(qTarget, tTitle, tArtist, Number(item.play_count || 10000), idx) >= 620;
      });

      if (matchedItem) {
        const encUrl = matchedItem.more_info.encrypted_media_url;
        const authRes = await fetch(
          `https://www.jiosaavn.com/api.php?__call=song.generateAuthToken&url=${encodeURIComponent(encUrl)}&bitrate=160&api_version=4&_format=json&ctx=web6dot0&_marker=0`,
          { headers, signal: AbortSignal.timeout(4500) }
        );
        if (authRes.ok) {
          const authJson: any = await authRes.json();
          const rawAuthUrl = authJson?.auth_url;
          if (rawAuthUrl && typeof rawAuthUrl === 'string') {
            const streamUrl = rawAuthUrl.split('?')[0].replace('web.saavncdn.com', 'aac.saavncdn.com');
            const hiResImg = String(matchedItem.image || '').replace('150x150', '500x500');
            const [mediaRes, coverBuffer] = await Promise.all([
              fetch(streamUrl, {
                headers: { ...headers, Referer: 'https://www.jiosaavn.com/' },
                signal: AbortSignal.timeout(10000),
              }),
              hiResImg.startsWith('http')
                ? fetch(hiResImg, { headers, signal: AbortSignal.timeout(3000) })
                    .then(async (r) =>
                      r.ok
                        ? sharp(Buffer.from(await r.arrayBuffer()))
                            .resize(400, 400, { fit: 'cover' })
                            .jpeg({ quality: 82 })
                            .toBuffer()
                        : undefined
                    )
                    .catch(() => undefined)
                : Promise.resolve(undefined),
            ]);
            if (mediaRes.ok) {
              const rawBuf = Buffer.from(await mediaRes.arrayBuffer());
              if (rawBuf.length > 25000) {
                const prepared = await fastPreparePlayableAudio(rawBuf);
                const title = String(matchedItem.title || qTarget).replace(/&quot;/g, '"');
                const artist =
                  matchedItem.more_info?.artistMap?.primary_artists
                    ?.map((a: any) => a.name)
                    .join(', ') ||
                  matchedItem.subtitle ||
                  'SUFYAN-X-IK Music';
                return {
                  audioBuffer: prepared.buffer,
                  mimeType: prepared.mimeType,
                  title,
                  artist,
                  durationSec: Number(matchedItem.more_info?.duration || 210),
                  coverBuffer,
                };
              }
            }
          }
        }
      }
    }
  } catch {
    // Proceed to parallel search
  }

  // 1. Query BOTH SoundCloud v2 & JioSaavn in parallel and rank by exact keyword match + popularity
  try {
    const scClientId = await getSoundCloudClientId(headers);
    const [saavnJson, scJson] = await Promise.all([
      fetch(
        `https://www.jiosaavn.com/api.php?__call=search.getResults&_format=json&_marker=0&api_version=4&ctx=web6dot0&n=10&p=1&q=${encodeURIComponent(qTarget)}`,
        { headers, signal: AbortSignal.timeout(4500) }
      )
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
      fetch(
        `https://api-v2.soundcloud.com/search/tracks?q=${encodeURIComponent(qTarget)}&client_id=${scClientId}&limit=10`,
        { headers, signal: AbortSignal.timeout(4500) }
      )
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
    ]);

    type RankedSongCandidate = {
      source: 'sc' | 'saavn';
      score: number;
      raw: any;
    };
    const ranked: RankedSongCandidate[] = [];

    const saavnResults: any[] = (saavnJson as any)?.results || [];
    saavnResults.forEach((item, idx) => {
      if (!item?.more_info?.encrypted_media_url) return;
      const plays = Number(item.play_count || 10000);
      const title = String(item.title || '').replace(/&quot;/g, '"');
      const artist =
        item.more_info?.artistMap?.primary_artists?.map((a: any) => a.name).join(', ') ||
        item.subtitle ||
        '';
      const sc = scoreSongCandidate(qTarget, title, artist, plays, idx);
      if (sc > 150) {
        ranked.push({ source: 'saavn', score: sc, raw: item });
      }
    });

    const scCollection: any[] = (scJson as any)?.collection || [];
    scCollection.forEach((track, idx) => {
      const durMs = Number(track?.duration || 0);
      if (durMs < 45000 || durMs > 720000) return;
      const trans = track?.media?.transcodings || [];
      const hasPlayable = trans.some(
        (tr: any) => tr?.format?.protocol === 'progressive' || tr?.format?.protocol === 'hls'
      );
      if (!hasPlayable) return;
      const plays = Number(track?.playback_count || 50000);
      const title = String(track?.title || '');
      const artist = String(track?.user?.username || '');
      const sc = scoreSongCandidate(qTarget, title, artist, plays, idx);
      if (sc > 150) {
        ranked.push({ source: 'sc', score: sc, raw: track });
      }
    });

    ranked.sort((a, b) => b.score - a.score);

    for (const cand of ranked.slice(0, 4)) {
      if (cand.source === 'sc') {
        try {
          const track = cand.raw;
          const trans = track.media?.transcodings || [];
          const prog = trans.find((tr: any) => tr?.format?.protocol === 'progressive');
          const hls = trans.find((tr: any) => tr?.format?.protocol === 'hls');
          const chosenTrans = prog || hls;
          if (!chosenTrans?.url) continue;

          const streamInfoRes = await fetch(`${chosenTrans.url}?client_id=${scClientId}`, {
            headers,
            signal: AbortSignal.timeout(4500),
          });
          if (!streamInfoRes.ok) continue;
          const streamInfo: any = await streamInfoRes.json();
          if (!streamInfo?.url) continue;

          const artUrl = String(track.artwork_url || track.user?.avatar_url || '').replace(
            '-large',
            '-t500x500'
          );
          const coverPromise = artUrl.startsWith('http')
            ? fetch(artUrl, { headers, signal: AbortSignal.timeout(3000) })
                .then(async (imgRes) =>
                  imgRes.ok
                    ? sharp(Buffer.from(await imgRes.arrayBuffer()))
                        .resize(400, 400, { fit: 'cover' })
                        .jpeg({ quality: 82 })
                        .toBuffer()
                    : undefined
                )
                .catch(() => undefined)
            : Promise.resolve(undefined);

          let mp3Buf: Buffer | null = null;
          if (chosenTrans.format?.protocol === 'hls') {
            const tmpId = `sc_hls_${Date.now()}`;
            const tmpOut = path.join(os.tmpdir(), `${tmpId}.mp3`);
            try {
              await execFileAsync('ffmpeg', [
                '-y',
                '-i',
                streamInfo.url,
                '-vn',
                '-acodec',
                'libmp3lame',
                '-b:a',
                '192k',
                tmpOut,
              ]);
              if (fs.existsSync(tmpOut)) {
                mp3Buf = await fs.promises.readFile(tmpOut);
              }
            } catch (ffmpegErr) {
              console.error('SoundCloud HLS ffmpeg error:', ffmpegErr);
            } finally {
              fs.promises.unlink(tmpOut).catch(() => {});
            }
          } else {
            const mp3Res = await fetch(streamInfo.url, { headers, signal: AbortSignal.timeout(12000) });
            if (mp3Res.ok) {
              mp3Buf = Buffer.from(await mp3Res.arrayBuffer());
            }
          }

          const coverBuffer = await coverPromise;
          if (mp3Buf && mp3Buf.length > 35000) {
            return {
              audioBuffer: mp3Buf,
              mimeType: 'audio/mpeg',
              title: String(track.title || query),
              artist: String(track.user?.username || 'SUFYAN-X-IK Music'),
              durationSec: Math.round(Number(track.duration || 210000) / 1000),
              coverBuffer,
            };
          }
        } catch {
          // try next ranked candidate
        }
      } else if (cand.source === 'saavn') {
        try {
          const item = cand.raw;
          const encUrl = item?.more_info?.encrypted_media_url;
          const authUrl = `https://www.jiosaavn.com/api.php?__call=song.generateAuthToken&url=${encodeURIComponent(encUrl)}&bitrate=160&api_version=4&_format=json&ctx=web6dot0&_marker=0`;
          const aRes = await fetch(authUrl, { headers, signal: AbortSignal.timeout(4500) });
          if (aRes.ok) {
            const aJson: any = await aRes.json();
            const rawAuthUrl = aJson?.auth_url;
            if (rawAuthUrl && typeof rawAuthUrl === 'string') {
              const baseNoQuery = rawAuthUrl
                .split('?')[0]
                .replace('web.saavncdn.com', 'aac.saavncdn.com')
                .replace('preview.saavncdn.com', 'aac.saavncdn.com');

              const streamCandidates = Array.from(
                new Set([
                  baseNoQuery.replace(/_(96|160|320)\.mp4$/i, '_160.mp4'),
                  baseNoQuery.replace(/_(96|160|320)\.mp4$/i, '_96.mp4'),
                  baseNoQuery,
                  rawAuthUrl,
                ])
              );

              const hiResImg = String(item.image || '').replace('150x150', '500x500');
              const coverPromise = hiResImg.startsWith('http')
                ? fetch(hiResImg, { headers, signal: AbortSignal.timeout(3000) })
                    .then(async (imgRes) =>
                      imgRes.ok
                        ? sharp(Buffer.from(await imgRes.arrayBuffer()))
                            .resize(400, 400, { fit: 'cover' })
                            .jpeg({ quality: 82 })
                            .toBuffer()
                        : undefined
                    )
                    .catch(() => undefined)
                : Promise.resolve(undefined);

              for (const candidateStreamUrl of streamCandidates) {
                try {
                  const mediaRes = await fetch(candidateStreamUrl, {
                    headers,
                    signal: AbortSignal.timeout(10000),
                  });
                  if (!mediaRes.ok) continue;
                  const rawBuf = Buffer.from(await mediaRes.arrayBuffer());
                  if (rawBuf.length > 25000) {
                    const [prepared, coverBuffer] = await Promise.all([
                      fastPreparePlayableAudio(rawBuf),
                      coverPromise,
                    ]);
                    const title = String(item.title || query).replace(/&quot;/g, '"');
                    const artist =
                      item.more_info?.artistMap?.primary_artists
                        ?.map((a: any) => a.name)
                        .join(', ') ||
                      item.subtitle ||
                      'SUFYAN-X-IK Music';
                    return {
                      audioBuffer: prepared.buffer,
                      mimeType: prepared.mimeType,
                      title,
                      artist,
                      durationSec: Number(item.more_info?.duration || 210),
                      coverBuffer,
                    };
                  }
                } catch {
                  // try next stream URL
                }
              }
            }
          }
        } catch {
          // try next ranked candidate
        }
      }
    }
  } catch {
    // fallback below
  }

  // 2. FULL-LENGTH MUSIC VIDEO AUDIO EXTRACTOR (Dailymotion -> Full MP3 for latest songs missing on JioSaavn/SoundCloud)
  try {
    const dmAudio = await fetchDailymotionVideo(qTarget, true);
    if (dmAudio && dmAudio.buffer.length > 35000) {
      return {
        audioBuffer: dmAudio.buffer,
        mimeType: 'audio/mpeg',
        title: dmAudio.title,
        artist: dmAudio.artist,
        durationSec: dmAudio.durationSec,
        coverBuffer: dmAudio.coverBuffer,
      };
    }
  } catch {
    // fallback below
  }

  // 3. LAST-RESORT FALLBACK: Apple iTunes / Deezer
  for (const country of ['IN', 'PK', 'US']) {
    try {
      const itRes = await fetch(
        `https://itunes.apple.com/search?term=${encodeURIComponent(cleanedQuery || query)}&country=${country}&entity=song&limit=5`,
        { headers, signal: AbortSignal.timeout(4500) }
      );
      if (itRes.ok) {
        const itJson: any = await itRes.json();
        const track = (itJson?.results || []).find((t: any) => Boolean(t?.previewUrl));
        if (track?.previewUrl) {
          const mRes = await fetch(track.previewUrl, {
            headers,
            signal: AbortSignal.timeout(8000),
          });
          if (mRes.ok) {
            const rawBuf = Buffer.from(await mRes.arrayBuffer());
            if (rawBuf.length > 15000) {
              const prepared = await fastPreparePlayableAudio(rawBuf);
              return {
                audioBuffer: prepared.buffer,
                mimeType: prepared.mimeType,
                title: track.trackName || query,
                artist: track.artistName || 'SUFYAN-X-IK Music',
              };
            }
          }
        }
      }
    } catch {
      // ignore
    }
  }

  return null;
}

function parseDurationTextToSec(text?: string): number {
  if (!text) return 0;
  const parts = String(text)
    .trim()
    .split(':')
    .map((p) => parseInt(p.replace(/[^0-9]/g, ''), 10));
  if (parts.some((n) => Number.isNaN(n))) return 0;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0] || 0;
}

interface ParsedYouTubeVideo {
  videoId: string;
  title: string;
  author: string;
  durationSec: number;
  durationText: string;
  publishedText: string;
  thumbnailUrl: string;
  url: string;
}

async function searchYouTubeVideos(queryOrUrl: string): Promise<ParsedYouTubeVideo[]> {
  const clean = queryOrUrl.trim();
  const uaHeaders = {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    'Accept-Language': 'en-US,en;q=0.9',
  };

  const urlIdMatch = clean.match(
    /^(?:https?:\/\/)?(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([0-9A-Za-z_-]{11})/i
  );
  if (urlIdMatch?.[1]) {
    const vid = urlIdMatch[1];
    try {
      const r = await fetch(`https://www.youtube.com/watch?v=${vid}&hl=en`, {
        headers: uaHeaders,
        signal: AbortSignal.timeout(7000),
      });
      if (r.ok) {
        const html = await r.text();
        const pm = html.match(/var ytInitialPlayerResponse = (\{.*?\});<\/script>/);
        if (pm?.[1]) {
          const parsed: any = JSON.parse(pm[1]);
          const vd = parsed?.videoDetails;
          if (vd?.videoId) {
            const sec = Number(vd.lengthSeconds || 0);
            const mins = Math.floor(sec / 60);
            const rem = sec % 60;
            const thumbs = vd.thumbnail?.thumbnails || [];
            return [
              {
                videoId: vd.videoId,
                title: String(vd.title || clean),
                author: String(vd.author || 'YouTube'),
                durationSec: sec,
                durationText: sec ? `${mins}:${String(rem).padStart(2, '0')}` : '3:00',
                publishedText: '',
                thumbnailUrl: thumbs[thumbs.length - 1]?.url || `https://i.ytimg.com/vi/${vid}/hqdefault.jpg`,
                url: `https://www.youtube.com/watch?v=${vd.videoId}`,
              },
            ];
          }
        }
      }
    } catch {
      // ignore
    }
    return [
      {
        videoId: vid,
        title: clean,
        author: 'YouTube',
        durationSec: 180,
        durationText: '3:00',
        publishedText: '',
        thumbnailUrl: `https://i.ytimg.com/vi/${vid}/hqdefault.jpg`,
        url: `https://www.youtube.com/watch?v=${vid}`,
      },
    ];
  }

  try {
    const r = await fetch(
      `https://www.youtube.com/results?search_query=${encodeURIComponent(clean)}&hl=en`,
      { headers: uaHeaders, signal: AbortSignal.timeout(7500) }
    );
    if (!r.ok) return [];
    const html = await r.text();
    const m = html.match(/var ytInitialData = (\{.*?\});<\/script>/);
    if (!m?.[1]) return [];
    const data: any = JSON.parse(m[1]);
    const contents =
      data?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer
        ?.contents || [];
    const items: ParsedYouTubeVideo[] = [];
    const allowShorts = /\b(short|shorts|reel|status|clip)\b/i.test(clean);

    for (const sec of contents) {
      for (const node of sec?.itemSectionRenderer?.contents || []) {
        const v = node?.videoRenderer;
        if (!v?.videoId) continue;
        const durationText = String(v.lengthText?.simpleText || '').trim();
        const durationSec = parseDurationTextToSec(durationText);
        if (!durationSec) continue; // skip live streams
        if (!allowShorts && durationSec < 50) continue; // skip YouTube Shorts / previews
        if (durationSec > 900) continue; // skip multi-hour jukeboxes
        const title = (v.title?.runs || []).map((x: any) => x.text).join('').trim();
        const author =
          (v.ownerText?.runs || []).map((x: any) => x.text).join('').trim() || 'YouTube';
        const publishedText = String(v.publishedTimeText?.simpleText || '');
        const thumbs = v.thumbnail?.thumbnails || [];
        items.push({
          videoId: v.videoId,
          title,
          author,
          durationSec,
          durationText,
          publishedText,
          thumbnailUrl: thumbs[thumbs.length - 1]?.url || `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`,
          url: `https://www.youtube.com/watch?v=${v.videoId}`,
        });
      }
    }
    return items.slice(0, 10);
  } catch {
    return [];
  }
}

async function fetchDailymotionVideo(
  query: string,
  wantAudioOnly = false
): Promise<{
  buffer: Buffer;
  title: string;
  artist: string;
  durationSec: number;
  thumbnailUrl?: string;
  coverBuffer?: Buffer;
  sourceUrl: string;
} | null> {
  const browserUa =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';
  const headers = { 'User-Agent': browserUa, Accept: 'application/json' };
  const cleanQ = query
    .replace(/\b(full\s+video|full\s+song|hd\s+video|mp4|download)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  const qTarget = cleanQ || query.trim();
  const allowShort = /\b(short|shorts|reel|status|clip|ringtone|teaser)\b/i.test(query);

  try {
    const searchUrl = `https://api.dailymotion.com/videos?search=${encodeURIComponent(qTarget)}&limit=15&fields=id,title,duration,created_time,views_total,thumbnail_480_url,owner.screenname`;
    const r = await fetch(searchUrl, { headers, signal: AbortSignal.timeout(6500) });
    if (!r.ok) return null;
    const j: any = await r.json();
    const list: any[] = Array.isArray(j?.list) ? j.list : [];
    if (list.length === 0) return null;

    const nowSec = Math.floor(Date.now() / 1000);
    const ranked = list
      .filter((v) => {
        const dur = Number(v?.duration || 0);
        if (!v?.id) return false;
        if (!allowShort && dur < 50) return false; // never return 15-35s preview clips!
        if (dur > 780) return false; // skip huge compilations
        return true;
      })
      .map((v, idx) => {
        const title = String(v.title || '');
        const artist = String(v['owner.screenname'] || 'SAYRON MD Video');
        let sc = scoreSongCandidate(qTarget, title, artist, Number(v.views_total || 1000), idx);
        const tl = title.toLowerCase();
        if (/\b(official|music video|visualizer|full video|hd|4k|lyrics|lyric)\b/i.test(tl)) {
          sc += 180;
        }
        const ageDays = Math.max(0, (nowSec - Number(v.created_time || 0)) / 86400);
        if (ageDays < 365) sc += 140;
        else if (ageDays < 730) sc += 75;
        return { v, sc };
      })
      .filter((x) => x.sc > 200)
      .sort((a, b) => b.sc - a.sc);

    for (const { v } of ranked.slice(0, 3)) {
      try {
        const metaRes = await fetch(
          `https://www.dailymotion.com/player/metadata/video/${v.id}`,
          { headers, signal: AbortSignal.timeout(6500) }
        );
        if (!metaRes.ok) continue;
        const meta: any = await metaRes.json();
        const masterUrl = meta?.qualities?.auto?.[0]?.url;
        if (!masterUrl) continue;

        const m3u8Res = await fetch(masterUrl, {
          headers: { 'User-Agent': browserUa },
          signal: AbortSignal.timeout(6500),
        });
        if (!m3u8Res.ok) continue;
        const m3u8Text = await m3u8Res.text();
        const lines = m3u8Text.split('\n').map((l) => l.trim()).filter(Boolean);
        const streams: Array<{ name: string; url: string }> = [];
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].startsWith('#EXT-X-STREAM-INF')) {
            const nm = lines[i].match(/NAME="([^"]+)"/)?.[1] || '0';
            const streamUrl = (lines[i + 1] || '').split('#')[0];
            if (streamUrl.startsWith('http')) {
              streams.push({ name: nm, url: streamUrl });
            }
          }
        }
        const chosen =
          streams.find((s) => s.name === '480') ||
          streams.find((s) => s.name === '380') ||
          streams.find((s) => s.name === '240') ||
          streams.find((s) => s.name === '720') ||
          streams[0];
        if (!chosen?.url) continue;

        const thumbUrl = String(v.thumbnail_480_url || meta?.posters?.['480'] || '');
        const coverPromise = thumbUrl.startsWith('http')
          ? fetch(thumbUrl, { headers: { 'User-Agent': browserUa }, signal: AbortSignal.timeout(3500) })
              .then(async (ir) =>
                ir.ok
                  ? sharp(Buffer.from(await ir.arrayBuffer()))
                      .resize(400, 400, { fit: 'cover' })
                      .jpeg({ quality: 82 })
                      .toBuffer()
                  : undefined
              )
              .catch(() => undefined)
          : Promise.resolve(undefined);

        const tmpId = `dm_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        const tmpOut = path.join(os.tmpdir(), `${tmpId}.${wantAudioOnly ? 'mp3' : 'mp4'}`);
        const tmpFast = path.join(os.tmpdir(), `${tmpId}_comp.mp4`);
        try {
          if (wantAudioOnly) {
            await execFileAsync(
              'ffmpeg',
              ['-y', '-user_agent', browserUa, '-i', chosen.url, '-vn', '-acodec', 'libmp3lame', '-b:a', '192k', tmpOut],
              { timeout: 35000 }
            );
          } else {
            await execFileAsync(
              'ffmpeg',
              [
                '-y',
                '-user_agent',
                browserUa,
                '-i',
                chosen.url,
                '-c',
                'copy',
                '-bsf:a',
                'aac_adtstoasc',
                '-movflags',
                '+faststart',
                tmpOut,
              ],
              { timeout: 40000 }
            );
            if (fs.existsSync(tmpOut)) {
              const st = fs.statSync(tmpOut);
              if (st.size > 42 * 1024 * 1024) {
                await execFileAsync(
                  'ffmpeg',
                  [
                    '-y',
                    '-i',
                    tmpOut,
                    '-c:v',
                    'libx264',
                    '-preset',
                    'ultrafast',
                    '-crf',
                    '28',
                    '-vf',
                    "scale='min(640,iw)':-2",
                    '-c:a',
                    'aac',
                    '-b:a',
                    '96k',
                    '-movflags',
                    '+faststart',
                    tmpFast,
                  ],
                  { timeout: 45000 }
                );
                if (fs.existsSync(tmpFast)) {
                  await fs.promises.rename(tmpFast, tmpOut);
                }
              }
            }
          }

          if (fs.existsSync(tmpOut)) {
            const buf = await fs.promises.readFile(tmpOut);
            const coverBuffer = await coverPromise;
            if (buf.length > 35000 && buf.length <= 52 * 1024 * 1024) {
              return {
                buffer: buf,
                title: String(v.title || meta?.title || query),
                artist: String(v['owner.screenname'] || meta?.owner?.screenname || 'SAYRON MD'),
                durationSec: Number(v.duration || meta?.duration || 180),
                thumbnailUrl: thumbUrl || undefined,
                coverBuffer,
                sourceUrl: `https://www.dailymotion.com/video/${v.id}`,
              };
            }
          }
        } finally {
          fs.promises.unlink(tmpOut).catch(() => {});
          fs.promises.unlink(tmpFast).catch(() => {});
        }
      } catch {
        // try next ranked Dailymotion video
      }
    }
  } catch {
    // ignore
  }
  return null;
}

/**
 * FULL-LENGTH Real MP4 Video Resolver for .video / .ytv / .mp4 / .yt
 * Prioritizes full-length real HD music videos (never 30s Apple iTunes previews),
 * with full-length song + HD poster fallback.
 */
export async function fetchPlayableVideo(query: string): Promise<{
  videoBuffer: Buffer;
  title: string;
  artist: string;
  durationSec?: number;
  thumbnailUrl?: string;
  coverBuffer?: Buffer;
  sourceUrl?: string;
} | null> {
  // 1. Real Full-Length Motion Video via Dailymotion (2-8+ min official/lyric videos)
  const dmDirect = await fetchDailymotionVideo(query, false);
  if (dmDirect) {
    return {
      videoBuffer: dmDirect.buffer,
      title: dmDirect.title,
      artist: dmDirect.artist,
      durationSec: dmDirect.durationSec,
      thumbnailUrl: dmDirect.thumbnailUrl,
      coverBuffer: dmDirect.coverBuffer,
      sourceUrl: dmDirect.sourceUrl,
    };
  }

  // 1b. If query had minor spelling/channel mismatch on Dailymotion, resolve exact YouTube video title first and retry Dailymotion
  try {
    const ytHits = await searchYouTubeVideos(query);
    const bestYt = ytHits[0];
    if (bestYt?.title) {
      const dmByYtTitle = await fetchDailymotionVideo(bestYt.title, false);
      if (dmByYtTitle) {
        return {
          videoBuffer: dmByYtTitle.buffer,
          title: dmByYtTitle.title,
          artist: bestYt.author || dmByYtTitle.artist,
          durationSec: dmByYtTitle.durationSec || bestYt.durationSec,
          thumbnailUrl: dmByYtTitle.thumbnailUrl || bestYt.thumbnailUrl,
          coverBuffer: dmByYtTitle.coverBuffer,
          sourceUrl: bestYt.url || dmByYtTitle.sourceUrl,
        };
      }
    }
  } catch {
    // ignore
  }

  // 2. Fallback: Build Full-Length Playable MP4 Video from Full JioSaavn/SoundCloud Song + HD Poster via FFmpeg
  try {
    const fullSong = await fetchPlayableSong(query);
    if (fullSong) {
      const tmpId = `xik_vid_${Date.now()}`;
      const imgPath = path.join(os.tmpdir(), `${tmpId}.jpg`);
      const audExt = fullSong.mimeType === 'audio/mp4' ? 'm4a' : 'mp3';
      const audPath = path.join(os.tmpdir(), `${tmpId}.${audExt}`);
      const outPath = path.join(os.tmpdir(), `${tmpId}.mp4`);

      try {
        const posterBuf =
          fullSong.coverBuffer || (await resolveMenuImageBuffer());
        if (posterBuf) {
          const resizedPoster = await sharp(posterBuf)
            .resize(480, 480, { fit: 'cover' })
            .jpeg({ quality: 84 })
            .toBuffer();
          await fs.promises.writeFile(imgPath, resizedPoster);
        }
        await fs.promises.writeFile(audPath, fullSong.audioBuffer);

        await execFileAsync('ffmpeg', [
          '-y',
          '-loop',
          '1',
          '-framerate',
          '1',
          '-i',
          imgPath,
          '-i',
          audPath,
          '-c:v',
          'libx264',
          '-tune',
          'stillimage',
          '-preset',
          'ultrafast',
          '-pix_fmt',
          'yuv420p',
          '-c:a',
          fullSong.mimeType === 'audio/mp4' ? 'copy' : 'aac',
          '-shortest',
          '-movflags',
          '+faststart',
          outPath,
        ]);

        if (fs.existsSync(outPath)) {
          const mp4Buf = await fs.promises.readFile(outPath);
          if (mp4Buf.length > 20000) {
            return {
              videoBuffer: mp4Buf,
              title: fullSong.title,
              artist: fullSong.artist,
              durationSec: fullSong.durationSec,
              coverBuffer: fullSong.coverBuffer,
            };
          }
        }
      } finally {
        fs.promises.unlink(imgPath).catch(() => {});
        fs.promises.unlink(audPath).catch(() => {});
        fs.promises.unlink(outPath).catch(() => {});
      }
    }
  } catch {
    // ignore
  }

  return null;
}

export async function applyAudioEffectWithFfmpeg(
  inputBuffer: Buffer,
  effect:
    | 'bass'
    | 'slowed'
    | 'nightcore'
    | '8d'
    | 'reverb'
    | 'lofi'
    | 'chipmunk'
    | 'deepvoice'
    | 'earrape'
    | 'reverse'
): Promise<Buffer | null> {
  const tmpId = `xik_fx_${Date.now()}`;
  const inPath = path.join(os.tmpdir(), `${tmpId}_in.mp3`);
  const outPath = path.join(os.tmpdir(), `${tmpId}_out.mp3`);

  const filterMap: Record<string, string> = {
    bass: 'bass=g=16:f=110:w=0.6',
    slowed: 'asetrate=44100*0.84,aresample=44100,aecho=0.8:0.88:60:0.4',
    nightcore: 'asetrate=44100*1.25,aresample=44100',
    '8d': 'apulsator=hz=0.125',
    reverb: 'aecho=0.8:0.9:100|180:0.4|0.25',
    lofi: 'asetrate=44100*0.9,aresample=44100,lowpass=f=3200,aecho=0.8:0.85:55:0.35',
    chipmunk: 'asetrate=44100*1.45,aresample=44100',
    deepvoice: 'asetrate=44100*0.74,aresample=44100,bass=g=8',
    earrape: 'acrusher=level_in=8:level_out=14:bits=8:mode=log:aa=1,volume=12dB',
    reverse: 'areverse',
  };

  try {
    fs.writeFileSync(inPath, inputBuffer);
    await execFileAsync('ffmpeg', [
      '-y',
      '-i',
      inPath,
      '-af',
      filterMap[effect] || filterMap.bass,
      '-b:a',
      '128k',
      outPath,
    ]);
    if (fs.existsSync(outPath)) {
      return fs.readFileSync(outPath);
    }
  } catch {
    return null;
  } finally {
    try {
      if (fs.existsSync(inPath)) fs.unlinkSync(inPath);
      if (fs.existsSync(outPath)) fs.unlinkSync(outPath);
    } catch {
      // ignore
    }
  }
  return null;
}

export async function applyPhotoStudioEffect(
  inputBuffer: Buffer,
  effect: string,
  labelText = 'SAYRON MD'
): Promise<Buffer> {
  const safeLabel = (labelText || 'SUFYAN-X-IK')
    .replace(/[<>&"']/g, '')
    .slice(0, 26)
    .toUpperCase();

  if (effect === 'blur') {
    return sharp(inputBuffer).resize(720, 720, { fit: 'cover' }).blur(10).jpeg({ quality: 88 }).toBuffer();
  }
  if (effect === 'invert') {
    return sharp(inputBuffer).resize(720, 720, { fit: 'cover' }).negate({ alpha: false }).jpeg({ quality: 88 }).toBuffer();
  }
  if (effect === 'grayscale') {
    return sharp(inputBuffer).resize(720, 720, { fit: 'cover' }).grayscale().jpeg({ quality: 88 }).toBuffer();
  }
  if (effect === 'mirror') {
    return sharp(inputBuffer).resize(720, 720, { fit: 'cover' }).flop().jpeg({ quality: 88 }).toBuffer();
  }
  if (effect === 'rotate') {
    return sharp(inputBuffer).resize(720, 720, { fit: 'cover' }).rotate(90).jpeg({ quality: 88 }).toBuffer();
  }
  if (effect === 'sepia') {
    return sharp(inputBuffer)
      .resize(720, 720, { fit: 'cover' })
      .modulate({ saturation: 0.45, brightness: 1.05 })
      .tint({ r: 196, g: 154, b: 108 })
      .jpeg({ quality: 88 })
      .toBuffer();
  }
  if (effect === 'pixelate') {
    const tiny = await sharp(inputBuffer).resize(48, 48, { fit: 'cover' }).png().toBuffer();
    return sharp(tiny).resize(720, 720, { kernel: sharp.kernel.nearest }).jpeg({ quality: 90 }).toBuffer();
  }
  if (effect === 'neon' || effect === 'glitch') {
    const base = await sharp(inputBuffer)
      .resize(720, 720, { fit: 'cover' })
      .modulate({ saturation: 2.2, brightness: 1.1, hue: effect === 'glitch' ? 40 : 180 })
      .toBuffer();
    const overlaySvg = Buffer.from(
      `<svg width="720" height="720" xmlns="http://www.w3.org/2000/svg">
        <rect x="14" y="14" width="692" height="692" rx="28" fill="none" stroke="#00f7ff" stroke-width="10"/>
        <rect x="0" y="630" width="720" height="90" fill="rgba(6,9,19,0.85)"/>
        <text x="360" y="685" text-anchor="middle" font-family="sans-serif" font-weight="900" font-size="36" fill="#00f7ff">${effect.toUpperCase()} • ${safeLabel}</text>
      </svg>`
    );
    return sharp(base)
      .composite([{ input: overlaySvg, top: 0, left: 0 }])
      .jpeg({ quality: 90 })
      .toBuffer();
  }

  // Heavy Poster Studio: wanted, wasted, jail, rip, cybercard, poster
  const resizedPhoto = await sharp(inputBuffer)
    .resize(520, 520, { fit: 'cover' })
    .jpeg({ quality: 90 })
    .toBuffer();

  if (effect === 'wanted') {
    const bgSvg = Buffer.from(
      `<svg width="720" height="920" xmlns="http://www.w3.org/2000/svg">
        <rect width="720" height="920" fill="#e6cfa3"/>
        <rect x="24" y="24" width="672" height="872" fill="none" stroke="#3e2723" stroke-width="10"/>
        <rect x="38" y="38" width="644" height="844" fill="none" stroke="#3e2723" stroke-width="3"/>
        <text x="360" y="125" text-anchor="middle" font-family="serif" font-weight="900" font-size="86" fill="#2b1711" letter-spacing="6">WANTED</text>
        <text x="360" y="175" text-anchor="middle" font-family="serif" font-weight="bold" font-size="32" fill="#4e342e" letter-spacing="4">DEAD OR ALIVE</text>
        <rect x="96" y="196" width="528" height="528" fill="#2b1711"/>
        <text x="360" y="782" text-anchor="middle" font-family="serif" font-weight="900" font-size="42" fill="#2b1711">${safeLabel}</text>
        <text x="360" y="842" text-anchor="middle" font-family="serif" font-weight="900" font-size="50" fill="#8b0000">$10,000,000 BOUNTY</text>
        <text x="360" y="874" text-anchor="middle" font-family="sans-serif" font-weight="bold" font-size="18" fill="#4e342e">BY ORDER OF COMMANDER SAYRON MD</text>
      </svg>`
    );
    return sharp(bgSvg)
      .composite([{ input: resizedPhoto, top: 200, left: 100 }])
      .jpeg({ quality: 90 })
      .toBuffer();
  }

  if (effect === 'wasted') {
    const darkPhoto = await sharp(inputBuffer)
      .resize(720, 720, { fit: 'cover' })
      .grayscale()
      .modulate({ brightness: 0.65 })
      .toBuffer();
    const wastedSvg = Buffer.from(
      `<svg width="720" height="720" xmlns="http://www.w3.org/2000/svg">
        <rect x="0" y="275" width="720" height="170" fill="rgba(0,0,0,0.78)"/>
        <text x="360" y="382" text-anchor="middle" font-family="sans-serif" font-weight="900" font-size="102" fill="#ff1744" stroke="#000000" stroke-width="6" letter-spacing="6">WASTED</text>
        <text x="360" y="428" text-anchor="middle" font-family="sans-serif" font-weight="bold" font-size="22" fill="#ffffff" letter-spacing="4">ELIMINATED BY SAYRON MD</text>
      </svg>`
    );
    return sharp(darkPhoto)
      .composite([{ input: wastedSvg, top: 0, left: 0 }])
      .jpeg({ quality: 90 })
      .toBuffer();
  }

  if (effect === 'jail') {
    const basePhoto = await sharp(inputBuffer)
      .resize(720, 720, { fit: 'cover' })
      .modulate({ saturation: 0.45 })
      .toBuffer();
    const barsSvg = Buffer.from(
      `<svg width="720" height="720" xmlns="http://www.w3.org/2000/svg">
        <g fill="#263238" stroke="#11171a" stroke-width="3">
          <rect x="60" y="0" width="22" height="720"/>
          <rect x="155" y="0" width="22" height="720"/>
          <rect x="250" y="0" width="22" height="720"/>
          <rect x="349" y="0" width="22" height="720"/>
          <rect x="445" y="0" width="22" height="720"/>
          <rect x="540" y="0" width="22" height="720"/>
          <rect x="635" y="0" width="22" height="720"/>
          <rect x="0" y="130" width="720" height="24"/>
          <rect x="0" y="560" width="720" height="24"/>
        </g>
        <rect x="90" y="590" width="540" height="90" rx="14" fill="#b71c1c" stroke="#ffffff" stroke-width="4"/>
        <text x="360" y="642" text-anchor="middle" font-family="sans-serif" font-weight="900" font-size="38" fill="#ffffff" letter-spacing="3">LOCKED UP • ${safeLabel}</text>
        <text x="360" y="670" text-anchor="middle" font-family="sans-serif" font-weight="bold" font-size="16" fill="#ffeb3b">CENTRAL PRISON • SAYRON MD</text>
      </svg>`
    );
    return sharp(basePhoto)
      .composite([{ input: barsSvg, top: 0, left: 0 }])
      .jpeg({ quality: 90 })
      .toBuffer();
  }

  if (effect === 'rip') {
    const grayAvatar = await sharp(inputBuffer)
      .resize(340, 340, { fit: 'cover' })
      .grayscale()
      .jpeg({ quality: 88 })
      .toBuffer();
    const ripSvg = Buffer.from(
      `<svg width="720" height="860" xmlns="http://www.w3.org/2000/svg">
        <rect width="720" height="860" fill="#0f172a"/>
        <path d="M120,820 L120,300 A240,240 0 0,1 600,300 L600,820 Z" fill="#475569" stroke="#94a3b8" stroke-width="10"/>
        <text x="360" y="210" text-anchor="middle" font-family="serif" font-weight="900" font-size="84" fill="#e2e8f0">R.I.P.</text>
        <text x="360" y="675" text-anchor="middle" font-family="serif" font-weight="bold" font-size="36" fill="#f8fafc">${safeLabel}</text>
        <text x="360" y="725" text-anchor="middle" font-family="sans-serif" font-size="22" fill="#cbd5e1">"Panga liya tha SAYRON MD se 💀"</text>
        <text x="360" y="775" text-anchor="middle" font-family="sans-serif" font-weight="bold" font-size="20" fill="#38bdf8">⚡ X-IK AI GRAVEYARD</text>
      </svg>`
    );
    return sharp(ripSvg)
      .composite([{ input: grayAvatar, top: 265, left: 190 }])
      .jpeg({ quality: 90 })
      .toBuffer();
  }

  // Default: cybercard / poster VIP Card
  const cardAvatar = await sharp(inputBuffer)
    .resize(300, 300, { fit: 'cover' })
    .jpeg({ quality: 90 })
    .toBuffer();
  const cardSvg = Buffer.from(
    `<svg width="860" height="500" xmlns="http://www.w3.org/2000/svg">
      <rect width="860" height="500" rx="32" fill="#060913"/>
      <rect x="16" y="16" width="828" height="468" rx="24" fill="none" stroke="#10b981" stroke-width="6"/>
      <rect x="52" y="96" width="312" height="312" rx="18" fill="#10b981"/>
      <text x="410" y="135" font-family="sans-serif" font-weight="900" font-size="36" fill="#10b981">👑 SAYRON MD</text>
      <text x="410" y="180" font-family="sans-serif" font-weight="bold" font-size="22" fill="#94a3b8">ROYAL VIP CYBER IDENTITY</text>
      <line x1="410" y1="205" x2="800" y2="205" stroke="#1e293b" stroke-width="4"/>
      <text x="410" y="260" font-family="sans-serif" font-weight="bold" font-size="30" fill="#ffffff">AGENT: ${safeLabel}</text>
      <text x="410" y="310" font-family="monospace" font-weight="bold" font-size="22" fill="#38bdf8">CLEARANCE: LEVEL-99 SUPREME</text>
      <text x="410" y="355" font-family="monospace" font-weight="bold" font-size="22" fill="#a7f3d0">STATUS: VERIFIED VIP 🟢</text>
      <text x="410" y="415" font-family="sans-serif" font-weight="bold" font-size="18" fill="#64748b">ISSUED BY COMMANDER SUFYAN-X-IK (+92 346 4267218)</text>
    </svg>`
  );
  return sharp(cardSvg)
    .composite([{ input: cardAvatar, top: 102, left: 58 }])
    .jpeg({ quality: 90 })
    .toBuffer();
}

export function injectWhatsAppStickerExif(
  webpBuffer: Buffer,
  packName = 'SAYRON MD',
  authorName = 'SUFYAN-X-IK'
): Buffer {
  try {
    if (
      !Buffer.isBuffer(webpBuffer) ||
      webpBuffer.length < 24 ||
      webpBuffer.subarray(0, 4).toString('ascii') !== 'RIFF' ||
      webpBuffer.subarray(8, 12).toString('ascii') !== 'WEBP'
    ) {
      return webpBuffer;
    }

    const jsonMeta = JSON.stringify({
      'sticker-pack-id': 'com.sufyan.xik.md.official',
      'sticker-pack-name': packName,
      'sticker-pack-publisher': authorName,
      emojis: ['🔥', '⚡', '👑'],
    });
    const jsonBytes = Buffer.from(jsonMeta, 'utf-8');
    const tiffHeader = Buffer.from([
      0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00, 0x41, 0x57, 0x07, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x16, 0x00, 0x00, 0x00,
    ]);
    tiffHeader.writeUInt32LE(jsonBytes.length, 14);
    const exifPayload = Buffer.concat([tiffHeader, jsonBytes]);
    const padByte = exifPayload.length % 2 === 1 ? Buffer.from([0x00]) : Buffer.alloc(0);
    const exifChunkHeader = Buffer.alloc(8);
    exifChunkHeader.write('EXIF', 0, 4, 'ascii');
    exifChunkHeader.writeUInt32LE(exifPayload.length, 4);
    const exifChunk = Buffer.concat([exifChunkHeader, exifPayload, padByte]);

    const firstChunkTag = webpBuffer.subarray(12, 16).toString('ascii');
    if (firstChunkTag === 'VP8X') {
      const out = Buffer.concat([Buffer.from(webpBuffer), exifChunk]);
      out[20] = (out[20] || 0) | 0x08;
      out.writeUInt32LE(out.length - 8, 4);
      return out;
    }

    // Create VP8X chunk if input was simple VP8 / VP8L
    const vp8xChunk = Buffer.alloc(18);
    vp8xChunk.write('VP8X', 0, 4, 'ascii');
    vp8xChunk.writeUInt32LE(10, 4);
    vp8xChunk[8] = 0x18; // Alpha + EXIF
    // Canvas 512x512 -> 511 (0x0001FF)
    vp8xChunk.writeUIntLE(511, 12, 3);
    vp8xChunk.writeUIntLE(511, 15, 3);

    const out = Buffer.concat([
      webpBuffer.subarray(0, 12),
      vp8xChunk,
      webpBuffer.subarray(12),
      exifChunk,
    ]);
    out.writeUInt32LE(out.length - 8, 4);
    return out;
  } catch {
    return webpBuffer;
  }
}

export async function convertImageToWebpSticker(inputBuffer: Buffer): Promise<Buffer> {
  const webp = await sharp(inputBuffer, { animated: true, limitInputPixels: false })
    .resize(512, 512, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .webp({ loop: 0, quality: 75 })
    .toBuffer();
  return injectWhatsAppStickerExif(webp);
}

export async function convertVideoOrGifToAnimatedSticker(
  inputBuffer: Buffer,
  isVideo = false
): Promise<Buffer> {
  if (!isVideo) {
    try {
      const sharpWebp = await sharp(inputBuffer, { animated: true, limitInputPixels: false })
        .resize(512, 512, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .webp({ loop: 0, quality: 55, effort: 2 })
        .toBuffer();
      if (sharpWebp.length <= 450 * 1024) {
        return injectWhatsAppStickerExif(sharpWebp);
      }
    } catch {
      // fallback to ffmpeg below
    }
  }

  const tmpDir = os.tmpdir();
  const id = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const inFile = path.join(tmpDir, `stk_in_${id}.${isVideo ? 'mp4' : 'gif'}`);
  const outFile = path.join(tmpDir, `stk_out_${id}.webp`);

  try {
    await fs.promises.writeFile(inFile, inputBuffer);
    await execFileAsync(
      'ffmpeg',
      [
        '-y',
        '-t',
        '4',
        '-i',
        inFile,
        '-vf',
        'fps=11,scale=512:512:force_original_aspect_ratio=decrease:flags=lanczos,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x00000000',
        '-loop',
        '0',
        '-c:v',
        'libwebp',
        '-lossless',
        '0',
        '-compression_level',
        '3',
        '-q:v',
        '38',
        '-preset',
        'default',
        '-an',
        '-vsync',
        '0',
        outFile,
      ],
      { timeout: 10000 }
    );
    const outBuf = await fs.promises.readFile(outFile);
    return injectWhatsAppStickerExif(outBuf);
  } catch {
    const fallback = await sharp(inputBuffer, { animated: true, pages: 12, limitInputPixels: false })
      .resize(384, 384, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .webp({ loop: 0, quality: 38, effort: 2 })
      .toBuffer();
    return injectWhatsAppStickerExif(fallback);
  } finally {
    fs.promises.unlink(inFile).catch(() => {});
    fs.promises.unlink(outFile).catch(() => {});
  }
}

export async function buildLiveActionSticker(action: string): Promise<{
  stickerBuffer: Buffer;
  gifBuffer?: Buffer;
  caption: string;
}> {
  const cleanAction = (action || 'kiss').toLowerCase().trim();
  const reactionCandidatesMap: Record<string, string[]> = {
    kiss: ['kiss', 'airkiss', 'love', 'nuzzle'],
    love: ['love', 'kiss', 'cuddle', 'hug', 'handhold'],
    hug: ['hug', 'cuddle', 'nuzzle', 'pat'],
    slap: ['slap', 'smack', 'punch'],
    pat: ['pat', 'nuzzle', 'hug', 'smile'],
    wink: ['wink', 'smug', 'cool', 'smile'],
    cuddle: ['cuddle', 'hug', 'nuzzle', 'love'],
    cry: ['cry', 'sad', 'sigh'],
    dance: ['dance', 'celebrate', 'happy', 'yay'],
    bite: ['bite', 'nom', 'lick', 'pinch'],
    kill: ['punch', 'slap', 'smack', 'evillaugh', 'angrystare'],
    punch: ['punch', 'smack', 'slap'],
    bonk: ['smack', 'slap', 'punch', 'poke', 'pinch'],
    highfive: ['cheers', 'brofist', 'clap', 'celebrate', 'yay'],
    wave: ['wave', 'smile', 'happy', 'yay'],
    smile: ['smile', 'happy', 'blush', 'yay'],
  };

  const emojiMap: Record<string, string> = {
    kiss: '💋🔥',
    love: '❤️✨',
    hug: '🤗❤️',
    slap: '👋💥',
    pat: '🥰✨',
    wink: '😉⚡',
    cuddle: '🫂💞',
    cry: '😭💔',
    dance: '💃🔥',
    bite: '😈🦷',
    kill: '💀⚔️',
    punch: '🥊💥',
    bonk: '🔨💫',
    highfive: '🙌⚡',
    wave: '👋✨',
    smile: '😊💖',
  };

  const candidates = reactionCandidatesMap[cleanAction] || [
    cleanAction,
    'dance',
    'kiss',
    'hug',
    'smile',
  ];
  const emoji = emojiMap[cleanAction] || '🔥';

  for (const reaction of candidates) {
    try {
      const apiUrl = `https://api.otakugifs.xyz/gif?reaction=${encodeURIComponent(reaction)}`;
      const r = await fetch(apiUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(3500),
      });
      if (r.ok) {
        const json: any = await r.json();
        const gifUrl = json?.url;
        if (gifUrl && typeof gifUrl === 'string') {
          const gifRes = await fetch(gifUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            signal: AbortSignal.timeout(5000),
          });
          if (gifRes.ok) {
            const gifBuf = Buffer.from(await gifRes.arrayBuffer());
            const webpSticker = await convertVideoOrGifToAnimatedSticker(gifBuf, false);
            return {
              stickerBuffer: webpSticker,
              gifBuffer: gifBuf,
              caption: `${emoji} *${cleanAction.toUpperCase()}* • *SAYRON MD*`,
            };
          }
        }
      }
    } catch {
      // try next reaction candidate
    }
  }

  // Fallback: Convert our local animated MP4 banner into a true animated WebP sticker (never a static text SVG!)
  try {
    const localMp4 = await resolveMenuGifMp4Buffer();
    if (localMp4) {
      const animWebp = await convertVideoOrGifToAnimatedSticker(localMp4, true);
      return {
        stickerBuffer: animWebp,
        caption: `${emoji} *${cleanAction.toUpperCase()}* • *SAYRON MD*`,
      };
    }
  } catch {
    // ignore
  }

  const svg = `<svg width="512" height="512" xmlns="http://www.w3.org/2000/svg">
    <circle cx="256" cy="256" r="220" fill="#090d16" stroke="#00e5ff" stroke-width="12"/>
    <text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" font-size="220">${emoji}</text>
  </svg>`;
  const fallbackWebp = injectWhatsAppStickerExif(
    await sharp(Buffer.from(svg)).webp({ quality: 85 }).toBuffer()
  );
  return {
    stickerBuffer: fallbackWebp,
    caption: `${emoji} *${cleanAction.toUpperCase()}* • *SAYRON MD*`,
  };
}

const SHAYARI_BANK: Record<string, string[]> = {
  shayari: [
    `🥀 *کس قدر خوبصورت ہے یہ عالمِ محبت بھی*\n*وہ خود تو دور ہیں مگر دل کے بہت قریب ہیں* ❤️\n\n⚡ _SAYRON MD_`,
    `✨ *ہم نے تو ایک ہی شخص پر چاہت ختم کر دی*\n*اب محبت کس کو کہتے ہیں ہمیں معلوم نہیں* ❤️\n\n⚡ _SAYRON MD_`,
    `🌙 *تری یادوں کے چراغ جلتے ہیں ہر شام یہاں*\n*اک تیرا نام ہی کافی ہے میرے سکون کے لیے* ✨\n\n⚡ _SAYRON MD_`,
    `💫 *خاموشی سے بھی باتیں ہوتی ہیں صاحب*\n*بس سننے والا دل کے قریب ہونا چاہیے* ❤️\n\n⚡ _SAYRON MD_`,
    `🌹 *کچھ لوگ قسم سے ایسے ہوتے ہیں*\n*جن سے بات نہ ہو تو دن ادھورا لگتا ہے* ✨\n\n⚡ _SAYRON MD_`,
  ],
  loveshayari: [
    `❤️ *تم ملو یا نہ ملو یہ تو مقدر کی بات ہے*\n*مگر تمہیں سوچ کر ہی دل کو سکون ملتا ہے* ✨\n\n⚡ _SAYRON MD_`,
    `💖 *ساری دنیا کو چھوڑ کر بس ایک تمہیں چاہا ہے*\n*میری ہر دعا میں سب سے پہلے تیرا نام آتا ہے* 🌹\n\n⚡ _SAYRON MD_`,
    `💞 *تیرے چہرے کی مسکان ہی میری زندگی ہے*\n*تجھ سے بڑھ کر اس جہاں میں کوئی عزیز نہیں* ❤️\n\n⚡ _SAYRON MD_`,
    `✨ *محبت الفاظ کی محتاج نہیں ہوتی جناب*\n*یہ تو وہ احساس ہے جو آنکھوں سےیاں ہو جاتا ہے* ❤️\n\n⚡ _SAYRON MD_`,
  ],
  sadshayari: [
    `💔 *خاموشیاں ہی بہتر ہیں صاحب*\n*لفظوں سے لوگ اکثر روٹھ جاتے ہیں* 🥀\n\n⚡ _SAYRON MD_`,
    `🥀 *بہت اندر تک توڑ دیتے ہیں وہ آنسو*\n*جو راتوں کو خاموشی سے بہہ جاتے ہیں* 💔\n\n⚡ _SAYRON MD_`,
    `😔 *کبھی کبھی انسان نہ ٹوٹتا ہے نہ بکھرتا ہے*\n*بس ہار جاتا ہے، کبھی خود سے تو کبھی قسمت سے* 🥀\n\n⚡ _SAYRON MD_`,
    `💔 *ہم نے جن کے لیے اپنی نیندیں اجاڑ دیں*\n*وہ پوچھتے ہیں تمہاری آنکھیں اداس کیوں ہیں* 🥀\n\n⚡ _SAYRON MD_`,
    `🌧️ *دل کے زخم دکھائے نہیں جاتے صاحب*\n*کچھ درد مسکرا کر چھپانے پڑتے ہیں* 💔\n\n⚡ _SAYRON MD_`,
  ],
  bewafa: [
    `🥀 *وفا کی امید ان سے کیا رکھیں جناب*\n*جو وقت آنے پر اپنا لہجہ تک بدل لیتے ہیں* 💔\n\n⚡ _SAYRON MD_`,
    `💔 *بڑی عجیب ہوتی ہے یہ بےوفائی بھی*\n*انسان زندہ تو رہتا ہے مگر اندر سے مر جاتا ہے* 🥀\n\n⚡ _SAYRON MD_`,
    `🔥 *وہ کہتے تھے کبھی تنہا نہیں چھوڑیں گے تمہیں*\n*ذرا سی ہوا کیا بدلی، انہوں نے راستہ ہی بدل لیا* 💔\n\n⚡ _SAYRON MD_`,
    `🥀 *سکھا دیا وقت اور اپنوں نے یہ سبق ہمیں*\n*یہاں کوئی کسی کا آخر تک ساتھ نہیں دیتا* 💔\n\n⚡ _SAYRON MD_`,
    `💔 *تیری بےوفائی کا شکوہ کس سے کریں ہم*\n*قصور تو ہمارا تھا جو تجھے اپنا سمجھ بیٹھے* 🥀\n\n⚡ _SAYRON MD_`,
  ],
  ghazal: [
    `🌙 *ستاروں سے آگے جہاں اور بھی ہیں*\n*ابھی عشق کے امتحاں اور بھی ہیں* ✨\n\n⚡ _SAYRON MD_`,
    `🕯️ *ہزاروں خواہشیں ایسی کہ ہر خواہش پہ دم نکلے*\n*بہت نکلے مرے ارمان لیکن پھر بھی کم نکلے* 🌙\n\n⚡ _SAYRON MD_`,
    `✨ *رنجش ہی سہی دل ہی دکھانے کے لیے آ*\n*آ پھر سے مجھے چھوڑ کے جانے کے لیے آ* 🥀\n\n⚡ _SAYRON MD_`,
  ],
  dosti: [
    `🤝 *دوستی نام ہے سکھ دکھ کی کہانی کا*\n*یہ راز ہے سدا مسکراتی جوانی کا* ❤️\n\n⚡ _SAYRON MD_`,
    `👑 *دولت سے نہیں ملتے سچے یار جہاں میں*\n*خوش نصیب ہیں وہ جن کے پاس وفادار دوست ہیں* 🤝🔥\n\n⚡ _SAYRON MD_`,
    `✨ *چائے جتنی بھی کڑک ہو، مزہ یاروں کے ساتھ ہی آتا ہے!* 🤝❤️\n\n⚡ _SAYRON MD_`,
  ],
  attitude: [
    `👑 *ہماری شرافت کا فائدہ مت اٹھانا بیٹا*\n*جس دن ہم بگڑے، تیرا پورا سسٹم ہلا دیں گے!* 🔥⚡\n\n👑 _SAYRON MD_`,
    `🔥 *شیر اپنی طاقت سے راجہ کہلاتا ہے*\n*جنگل میں کبھی الیکشن نہیں ہوتے!* 👑⚡\n\n👑 _SAYRON MD_`,
    `⚡ *ہم وہاں کھڑے ہوتے ہیں جہاں میٹر بڑے ہوتے ہیں*\n*نام یاد رکھنا: SUFYAN-X-IK!* 👑🔥\n\n👑 _SAYRON MD_`,
    `🦅 *عقابوں کے اڑنے کی جگہ الگ ہوتی ہے*\n*ہم شور نہیں مچاتے، سیدھا شکار کرتے ہیں!* 🔥👑`,
  ],
  savage: [
    `🔥 *SAVAGE MODE • SAYRON MD*\nBeta hum se muqabla karne ke liye tujhe dobara paida hona parega, aur phir bhi hum tere Boss hi rahenge! 💀👑`,
    `💀 *SAVAGE MODE • SAYRON MD*\nJتنا تیرا دماغ چلتا ہے نا، اتنا تو ہمارا فون بیٹری سیور پر چلا دیتا ہے! ⚡🔥`,
    `👑 *SAVAGE MODE • SAYRON MD*\nHum un logon ko ignore nahi karte jo jalte hain—hum unhein aur jalate hain! 🔥😎`,
  ],
  insult: [
    `💀 *Teri aukaat Wi-Fi ke 1 bar jaisi hai—naam ka connected, kaam ka zero!* ⚡`,
    `🤣 *Beta teri baatein sun kar lagta hai dimagh abhi tak "Downloading..." pe atka hua hai!* 💀`,
    `🔥 *Shakal 2G wali aur attitude 5G wala? Pehle apna software update karوا ke aa!* ⚡`,
  ],
  flirt: [
    `😍 *Aap ki aankhein hain ya Google Maps? Jab bhi dekhta hoon rasta bhool jata hoon!* ❤️✨`,
    `💖 *Waise ek baat poochun? Aap bachpan se itne pyare ho ya koi course kiya hai?* 😉🌹`,
    `✨ *Dil toh karta hai aap par FIR katwa doon—bina ijazat dil chori karne ke jurm mein!* ❤️`,
  ],
  compliment: [
    `💎 *Aap ki vibe is poore group mein sab se royal aur positive hai!* ✨👑`,
    `🌟 *Aap jaisa khush-ikhlaq aur samajhdar insaan hazaron mein ek hota hai!* ❤️✨`,
    `👑 *Aap ki baaton mein ek alag hi class aur izzat nazar aati hai!* 💎`,
  ],
  pickup: [
    `😉 *Kya aap Google ho? Kyunke mujhe jo kuch chahiye tha sab aap mein mil gaya!* ❤️`,
    `🌹 *Kya aap ke paas Band-Aid hai? Aap ko dekh kar dil gir gaya aur chot lag gayi!* 😍`,
    `✨ *Agar khubsurti waqt hoti, toh aap eternity (hamesha) hotay!* 💖`,
  ],
  joke: [
    `😂 *Ustad: Beta batao bijli kahan se aati hai?*\n*Shagird: Sir mamu ke ghar se, jab bhi jati hai abbu kehte hain salay ne phir band kar di!* 🤣`,
    `🤣 *Doctor: Aap ko aaram ki sakht zaroorat hai, yeh neend ki goliyan le jayein.*\n*Mareez: Doctor sahab yeh kab deni hain?*\n*Doctor: Yeh aap ke liye nahi, aap ki biwi ke liye hain!* 😂`,
    `😂 *Pappu: Yaar meri biwi har choti baat par naraz ho jati hai.*\n*Dost: Khush naseeb ho bhai, meri wali toh badi baat par bhi naraz ho jati hai!* 🤣`,
  ],
  quote: [
    `💎 *"Success doesn't come from what you do occasionally, it comes from what you do consistently."*\n— *SUFYAN-X-IK*`,
    `🔥 *"Waqt sab ka aata hai, bas mehnat aur sabar ka daman mat chhorna."*\n— *SUFYAN-X-IK*`,
    `👑 *"Khamoshi se itni mehnat karo ke tumhari kamyabi shor macha de!"*\n— *SUFYAN-X-IK*`,
  ],
  riddle: [
    `🧩 *PAHELI:* Wo kya cheez hai jo paani peete hi mar jati hai?\n💡 *Jawab:* Aag (Fire) 🔥`,
    `🧩 *PAHELI:* Wo kya hai jo aap ke paas jitنا zyada ho, aap ko utna hi kam nazar aata hai?\n💡 *Jawab:* Andhera (Darkness) 🌑`,
    `🧩 *PAHELI:* Wo kaun si cheez hai jo chalti rehti hai magar uske paon nahi hote?\n💡 *Jawab:* Ghari / Waqt (Clock / Time) ⏰`,
  ],
  fact: [
    `🧠 *FACT:* Octopus ke 3 dil (hearts) aur 9 dimagh hote hain, aur uska khoon neela (blue) hota hai! ⚡`,
    `🧠 *FACT:* Shahad (Honey) duniya ki wahid ghiza hai jo hazaron saal tak bhi kharab nahi hoti! 🍯`,
    `🧠 *FACT:* Insani dimagh din ke muqable mein raat ko sote waqt zyada active hota hai! ⚡`,
  ],
  advice: [
    `💡 *ADVICE:* Kabhi un logon ke liye apna waqt zaya mat karo jo aap ki qadar nahi jante. 👑`,
    `💡 *ADVICE:* Apne raaz aur apna agla qadam har kisi ko mat batao, log nazar bhi lagate hain aur rukawat bhi! ⚡`,
    `💡 *ADVICE:* Izzat hamesha izzat dene se milti hai, lekin jahan izzat na ho wahan khamoshi se nikal jao. 👑`,
  ],
  truth: [
    `🎯 *TRUTH:* Is group ya chat mein sab se zyada kis ki baat aapko achi lagti hai? Sach batana! 👀`,
    `🎯 *TRUTH:* Aap ne aakhri baar kis se aur kyun jhoot bola tha? 🤭`,
    `🎯 *TRUTH:* Aap ke phone mein sab se ajeeb ya funny photo kaun si hai? 👀`,
  ],
  dare: [
    `🔥 *DARE:* Apni WhatsApp DP bina soche 10 minute ke liye hata kar dikhao! ⚡`,
    `🔥 *DARE:* Group mein abhi ek 5 second ka voice note bhej kar "SUFYAN-X-IK Zindabad" bolo! 🎤👑`,
    `🔥 *DARE:* Apne WhatsApp About/Bio mein 1 ghante ke liye "Main Bacha Hoon 🍼" likh kar screenshot bhejo! 🤣`,
  ],
};

let shayariIdx = 0;

export async function generateShayariOrFun(
  cmd: string,
  topic?: string
): Promise<string> {
  // If no custom topic is requested, return INSTANTLY (0ms) from the rich bank so commands never lag!
  if (!topic || !topic.trim()) {
    const list = SHAYARI_BANK[cmd] || SHAYARI_BANK.shayari;
    const item = list[shayariIdx % list.length];
    shayariIdx = (shayariIdx + 1) % 1000;
    return item;
  }

  const prompts: Record<string, string> = {
    shayari: `Write a deep, heart-touching 2-line Urdu & Roman Urdu Shayari about ${topic}. Sign off with "⚡ SAYRON MD".`,
    loveshayari: `Write a romantic, sweet 2-line Love Shayari in Urdu & Roman Urdu about ${topic}. Sign off with "❤️ SAYRON MD".`,
    sadshayari: `Write an emotional, deep 2-line Sad Shayari in Urdu & Roman Urdu about ${topic}. Sign off with "💔 SAYRON MD".`,
    bewafa: `Write a deep 2-line Bewafa Urdu & Roman Urdu Shayari about ${topic}. Sign off with "🥀 SAYRON MD".`,
    ghazal: `Write a classic 4-line Urdu & Roman Urdu Ghazal about ${topic}. Sign off with "🌙 SAYRON MD".`,
    dosti: `Write a royal 2-line Dosti / Friendship Shayari in Urdu & Roman Urdu about ${topic}. Sign off with "🤝 SAYRON MD".`,
    attitude: `Write a royal, heavy-vibe 2-line Boys/Boss Attitude status in Roman Urdu & Urdu about ${topic}. Sign off with "👑 SAYRON MD".`,
    savage: `Write a brutal, royal savage 2-line reply in Roman Urdu targeting ${topic}. Sign off with "🔥 SAYRON MD".`,
    insult: `Write a funny, savage Desi Roman Urdu roast/burn line for ${topic}.`,
    flirt: `Write a smooth, charming Desi Roman Urdu flirting line with emojis for ${topic}.`,
    compliment: `Write a royal, heart-warming compliment in Roman Urdu for ${topic}.`,
    pickup: `Write a smooth, charming Desi Roman Urdu pickup line with emojis.`,
    joke: `Write a funny, clean Pakistani Roman Urdu joke in 2-3 lines about ${topic}.`,
    quote: `Write a powerful motivational quote in English & Roman Urdu about ${topic}.`,
    riddle: `Give a clever Urdu/Roman Urdu riddle (Paheli) along with its answer.`,
    fact: `Share an amazing, mind-blowing fact in Roman Urdu about ${topic}.`,
    advice: `Give a powerful 2-line life advice in Roman Urdu about ${topic}.`,
    truth: `Give an interesting, fun Truth question in Roman Urdu for ${topic}.`,
    dare: `Give a fun WhatsApp Dare challenge in Roman Urdu for ${topic}.`,
  };

  const aiOut = await generateTextWithFallbackModels(
    prompts[cmd] || prompts.shayari,
    'You are SAYRON MD Poet & Entertainer.',
    3500
  );
  if (aiOut) return aiOut;

  const list = SHAYARI_BANK[cmd] || SHAYARI_BANK.shayari;
  const item = list[shayariIdx % list.length];
  shayariIdx = (shayariIdx + 1) % 1000;
  return item;
}

export function convertUnits(input: string): string | null {
  const m = input
    .trim()
    .match(/^(-?\d+(?:\.\d+)?)\s*([a-zA-Z]+)\s+(?:to|in)\s+([a-zA-Z]+)$/i);
  if (!m) return null;
  const val = parseFloat(m[1]);
  const from = m[2].toLowerCase();
  const to = m[3].toLowerCase();

  if ((from === 'c' || from === 'celsius') && (to === 'f' || to === 'fahrenheit')) {
    return `${val}°C = ${((val * 9) / 5 + 32).toFixed(2)}°F`;
  }
  if ((from === 'f' || from === 'fahrenheit') && (to === 'c' || to === 'celsius')) {
    return `${val}°F = ${(((val - 32) * 5) / 9).toFixed(2)}°C`;
  }

  const ratios: Record<string, number> = {
    km_m: 1000,
    m_km: 0.001,
    km_mi: 0.621371,
    mi_km: 1.60934,
    kg_lb: 2.20462,
    lb_kg: 0.453592,
    gb_mb: 1024,
    mb_gb: 1 / 1024,
    usd_pkr: 278.5,
    pkr_usd: 1 / 278.5,
  };
  const key = `${from}_${to}`;
  if (ratios[key] !== undefined) {
    return `${val} ${from.toUpperCase()} = ${(val * ratios[key]).toFixed(2)} ${to.toUpperCase()}`;
  }
  return null;
}

const MORSE_MAP: Record<string, string> = {
  a: '.-', b: '-...', c: '-.-.', d: '-..', e: '.', f: '..-.', g: '--.', h: '....',
  i: '..', j: '.---', k: '-.-', l: '.-..', m: '--', n: '-.', o: '---', p: '.--.',
  q: '--.-', r: '.-.', s: '...', t: '-', u: '..-', v: '...-', w: '.--', x: '-..-',
  y: '-.--', z: '--..', '0': '-----', '1': '.----', '2': '..---', '3': '...--',
  '4': '....-', '5': '.....', '6': '-....', '7': '--...', '8': '---..', '9': '----.',
  ' ': ' / ',
};

function toFancyStyles(input: string): string {
  const normal = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const bold = [
    ...'𝗔𝗕𝗖𝗗𝗘𝗙𝗚𝗛𝗜𝗝𝗞𝗟𝗠𝗡𝗢𝗣𝗤𝗥𝗦𝗧𝗨𝗩𝗪𝗫𝗬𝗭𝗮𝗯𝗰𝗱𝗲𝗳𝗴𝗵𝗶𝗷𝗸𝗹𝗺𝗻𝗼𝗽𝗾𝗿𝘀𝘁𝘂𝘃𝘄𝘅𝘆𝘇𝟬𝟭𝟮𝟯𝟰𝟱𝟲𝟳𝟴𝟵',
  ];
  const italic = [
    ...'𝘈𝘉𝘊𝘋𝘌𝘍𝘎𝘏𝘐𝘑𝘒𝘓𝘔𝘕𝘖𝘗𝘘𝘙𝘚𝘛𝘜𝘝𝘞𝘟𝘠𝘡𝘢𝘣𝘤𝘥𝘦𝘧𝘨𝘩𝘪𝘫𝘬𝘭𝘮𝘯𝘰𝘱𝘲𝘳𝘴𝘵𝘶𝘷𝘸𝘹𝘺𝘻0123456789',
  ];
  const script = [
    ...'𝒜ℬ𝒞𝒟ℰℱ𝒢ℋℐ𝒥𝒦ℒℳ𝒩𝒪𝒫𝒬ℛ𝒮𝒯𝒰𝒱𝒲𝒳𝒴𝒵𝒶𝒷𝒸𝒹ℯ𝒻ℊ𝒽𝒾𝒿𝓀𝓁𝓂𝓃ℴ𝓅𝓆𝓇𝓈𝓉𝓊𝓋𝓌𝓍𝓎𝓏0123456789',
  ];
  const fraktur = [
    ...'𝕬𝕭𝕮𝕯𝕰𝕱𝕲𝕳𝕴𝕵𝕶𝕷𝕸𝕹𝕺𝕻𝕼𝕽𝕾𝕿𝖀𝖁𝖂𝖃𝖄𝖅𝖆𝖇𝖈𝖉𝖊𝖋𝖌𝖍𝖎𝖏𝖐𝖑𝖒𝖓𝖔𝖕𝖖𝖗𝖘𝖙𝖚𝖛𝖜𝖝𝖞𝖟0123456789',
  ];
  const doubleStruck = [
    ...'𝔸𝔹ℂ𝔻𝔼𝔽𝔾ℍ𝕀𝕁𝕂𝕃𝕄ℕ𝕆ℙℚℝ𝕊𝕋𝕌𝕍𝕎𝕏𝕐ℤ𝕒𝕓𝕔𝕕𝖊𝕗𝕘𝕙𝕚𝕛𝕜𝕝𝕞𝕟𝕠𝕡𝕢𝕣𝕤𝕥𝕦𝕧𝕨𝕩𝕪𝕫𝟘𝟙𝟚𝟛𝟜𝟝𝟞𝟟𝟠𝟡',
  ];
  const monospace = [
    ...'𝙰𝙱𝙲𝙳𝙴𝙵𝙶𝙷𝙸𝙹𝙺𝙻𝙼𝙽𝙾𝙿𝚀𝚁𝚂𝚃𝚄𝚅𝚆𝚇𝚈𝚉𝚊𝚋𝚌𝚍𝚎𝚏𝚐𝚑𝚒𝚓𝚔𝚕𝚖𝚗𝚘𝚙𝚚𝚛𝚜𝚝𝚞𝚟𝚠𝚡𝚢𝚣𝟶𝟷𝟸𝟹𝟺𝟻𝟼𝟽𝟾𝟿',
  ];

  const convertWith = (table: string[]) =>
    Array.from(input)
      .map((ch) => {
        const idx = normal.indexOf(ch);
        return idx !== -1 && table[idx] ? table[idx] : ch;
      })
      .join('');

  return [
    `✨ *FANCY FONT STUDIO • SAYRON MD*`,
    ``,
    `1️⃣ ${convertWith(bold)}`,
    `2️⃣ ${convertWith(italic)}`,
    `3️⃣ ${convertWith(script)}`,
    `4️⃣ ${convertWith(fraktur)}`,
    `5️⃣ ${convertWith(doubleStruck)}`,
    `6️⃣ ${convertWith(monospace)}`,
    `7️⃣ ꧁༺ ${input} ༻꧂`,
    `8️⃣ 👑⚡ ${convertWith(bold)} ⚡👑`,
  ].join('\n');
}

export async function executeHeavyProCommand(
  cmd: string,
  argText: string,
  senderName: string,
  targetTag: string,
  prefix: string
): Promise<string | null> {
  // 1. CYBER OPS & OSINT HEAVY COMMANDS
  if (
    [
      'flex',
      'vip',
      'pentest',
      'trace',
      'breach',
      'osint',
      'whois',
      'headers',
      'portscan',
      'matrix',
      'firewall',
      'payload',
      'decrypt',
      'cyberops',
      'bug',
      'boom',
      'fakecall',
    ].includes(cmd)
  ) {
    if (cmd === 'headers' || cmd === 'whois') {
      const targetUrl = argText.trim()
        ? /^https?:\/\//i.test(argText.trim())
          ? argText.trim()
          : `https://${argText.trim()}`
        : 'https://google.com';
      try {
        const res = await fetch(targetUrl, {
          method: 'HEAD',
          signal: AbortSignal.timeout(4500),
        });
        const hdrLines: string[] = [];
        res.headers.forEach((v, k) => {
          if (hdrLines.length < 10) hdrLines.push(`┃ ◈ *${k}:* \`${v.slice(0, 60)}\``);
        });
        return [
          `╭━━〔 🌐 *${cmd.toUpperCase()} RECON* 〕━━╮`,
          `┃ 🎯 *Target:* ${targetUrl}`,
          `┃ 📡 *Status:* ${res.status} ${res.statusText}`,
          ...hdrLines,
          `╰━━━━━━━━━━━━━━━━━━━━━━━━━━╯`,
          `⚡ *SUFYAN-X-IK CYBER OPS*`,
        ].join('\n');
      } catch {
        // fallback below
      }
    }

    const cyberCards: Record<string, string> = {
      flex: `╭━━━〔 👑 *ROYAL VIP FLEX* 〕━━━╮\n┃ 💎 *OPERATOR:* ${senderName}\n┃ ⚡ *POWERED BY:* SAYRON MD\n┃ 🛡️ *CLEARANCE:* SUPREME LEVEL-99\n┃ 🚀 *CLUSTER:* 10-SERVER CLOUD VIP\n┃ 💰 *NET AURA:* ∞ UNLIMITED\n╰━━━━━━━━━━━━━━━━━━━━━━━━━━━╯\n_Jahan hum kharay hote hain, system wahin se shuru hota hai!_ 👑🔥`,
      vip: `╭━━━〔 💎 *VIP PASS VERIFIED* 〕━━━╮\n┃ 👤 *VIP Holder:* ${targetTag}\n┃ 👑 *Issued By:* SUFYAN-X-IK\n┃ 🔐 *Badge ID:* #XIK-${Math.floor(100000 + Math.random() * 900000)}\n┃ ⚡ *Privileges:* FULL HEAVY ACCESS\n╰━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`,
      pentest: `╭━━〔 ☣️ *X-IK PENTEST SUITE* 〕━━╮\n┃ 🎯 *Target:* ${targetTag}\n┃ 🔍 *SQLi / XSS:* VULNERABLE ⚠️\n┃ 🔓 *SSH Port 22:* BYPASSED\n┃ 📡 *SSL Cipher:* TLS_AES_256_GCM\n┃ 👑 *Auditor:* SAYRON MD\n╰━━━━━━━━━━━━━━━━━━━━━━━━━━╯`,
      trace: `╭━━〔 🛰️ *SATELLITE IP TRACE* 〕━━╮\n┃ 🎯 *Target:* ${targetTag}\n┃ 🌍 *Coords:* 33.6844° N, 73.0479° E\n┃ 📡 *ASN:* AS45595 PK-TELECOM\n┃ 🔒 *Proxy/VPN:* STRIPPED & EXPOSED\n┃ ⚡ *Tracker:* SAYRON MD\n╰━━━━━━━━━━━━━━━━━━━━━━━━━━╯`,
      breach: `╭━━〔 💀 *DARKWEB BREACH SCAN* 〕━━╮\n┃ 🎯 *Subject:* ${targetTag}\n┃ 📂 *Leaked DBs:* 04 Matches Found\n┃ 🔑 *Hash Dump:* \`e99a18c428cb38d5f260853678922e03\`\n┃ 🛡️ *Status:* COMPROMISED BY X-IK AI\n╰━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`,
      osint: `╭━━〔 🕵️ *OSINT RECON ENGINE* 〕━━╮\n┃ 👤 *Target:* ${targetTag}\n┃ 📱 *Platform:* WhatsApp Multi-Device\n┃ 🔐 *E2E Ratchet:* Signal v3 Verified\n┃ 🌐 *Footprint:* High Visibility\n┃ 👑 *Recon Lead:* SUFYAN-X-IK\n╰━━━━━━━━━━━━━━━━━━━━━━━━━━╯`,
      whois: `╭━━〔 🌐 *WHOIS DOMAIN INTEL* 〕━━╮\n┃ 🔗 *Target:* ${argText || 'sufyan-x-ik.cloud'}\n┃ 🏢 *Registrar:* X-IK Cloud Registry\n┃ 🛡️ *DNSSEC:* Signed & Active\n┃ 👑 *Admin:* SUFYAN-X-IK\n╰━━━━━━━━━━━━━━━━━━━━━━━━━━╯`,
      headers: `╭━━〔 📡 *HTTP HEADER INSPECTOR* 〕━━╮\n┃ 🌐 *Host:* ${argText || 'cloudflare.com'}\n┃ 🔒 *HSTS:* max-age=31536000\n┃ ⚡ *Server:* X-IK-Edge-Turbo/9.4\n╰━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`,
      portscan: `╭━━〔 🔌 *NMAP PORT SCANNER* 〕━━╮\n┃ 🎯 *Host:* ${argText || targetTag}\n┃ 🟢 *22/tcp:* OPEN (OpenSSH 9.6)\n┃ 🟢 *80/tcp:* OPEN (Nginx Reverse)\n┃ 🟢 *443/tcp:* OPEN (TLS 1.3 VIP)\n┃ 🔴 *3306/tcp:* FILTERED (MySQL)\n╰━━━━━━━━━━━━━━━━━━━━━━━━━━╯`,
      matrix: `╭━━〔 🟩 *THE MATRIX TERMINAL* 〕━━╮\n┃ \`01010011 01010101 01000110\`\n┃ \`01011001 01000001 01001110\`\n┃ 💊 *Wake up, ${targetTag}...*\n┃ 🕶️ *The Matrix has you.*\n┃ 👑 *Architect:* SAYRON MD\n╰━━━━━━━━━━━━━━━━━━━━━━━━━━╯`,
      firewall: `╭━━〔 🛡️ *X-IK QUANTUM FIREWALL* 〕━━╮\n┃ 🔒 *Protection:* ACTIVE (Layer-7)\n┃ ⚡ *DDoS Mitigation:* 40 Tbps Anycast\n┃ 🚫 *Intrusion Attempts:* 0 Blocked\n┃ 👑 *Guardian:* SAYRON MD\n╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`,
      payload: `╭━━〔 💣 *X-IK PAYLOAD GENERATOR* 〕━━╮\n┃ 🎯 *Target:* ${targetTag}\n┃ 📦 *Binary:* \`xik_exploit_v9.bin\`\n┃ ⚡ *Injection:* 100% DELIVERED\n┃ 👑 *Author:* SAYRON MD\n╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`,
      decrypt: `╭━━〔 🔓 *QUANTUM CIPHER DECRYPT* 〕━━╮\n┃ 🔑 *Input:* \`${(argText || 'XIK-9941-VIP').slice(0, 28)}\`\n┃ ⚡ *Algorithm:* AES-512-GCM Crack\n┃ ✅ *Status:* DECRYPTED IN 1.4ms\n┃ 👑 *Engine:* SAYRON MD\n╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`,
      cyberops: `╭━━〔 ☣️ *CYBER COMMAND CENTER* 〕━━╮\n┃ 👑 *Commander:* SUFYAN-X-IK\n┃ 🛰️ *Active Nodes:* 10 Cloud Servers\n┃ 🛡️ *Defense Grid:* DEFCON-1 READY\n┃ ⚡ *Target Lock:* ${targetTag}\n╰━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`,
      bug: `╭━━〔 🕷️ *X-IK SYSTEM GLITCH* 〕━━╮\n┃ ⚠️ *Target:* ${targetTag}\n┃ 🦠 *Bug ID:* CVE-2026-XIK99\n┃ 💥 *Memory Overflow:* 0x00FF89A1\n┃ 👑 *Executed By:* SAYRON MD\n╰━━━━━━━━━━━━━━━━━━━━━━━━━╯`,
      boom: `💥💣 *KABOOM!!* 💣💥\n╭━━━━━━━━━━━━━━━━━━━━╮\n┃ 🎯 *Target:* ${targetTag}\n┃ 🔥 *Blast Radius:* 100% Chat Nuked\n┃ 👑 *Bomber:* SAYRON MD\n╰━━━━━━━━━━━━━━━━━━━━╯`,
      fakecall: `╭━━〔 📞 *INCOMING VIP CALL* 〕━━╮\n┃ 👤 *Caller:* 👑 SUFYAN-X-IK\n┃ 📱 *Line:* Encrypted Satellite VIP\n┃ 🔔 *Target:* ${targetTag}\n┃ 🟢 *[ ANSWER ]*   🔴 *[ DECLINE ]*\n╰━━━━━━━━━━━━━━━━━━━━━━━━━╯`,
    };
    return cyberCards[cmd] || cyberCards.flex;
  }

  // 2. HEAVY & VIP FUN METERS
  if (
    ['aura', 'vibe', 'iqtest', 'ship', 'match', 'roastmeter', 'mafia', 'king', 'badshah'].includes(
      cmd
    )
  ) {
    const pct = Math.floor(72 + Math.random() * 28);
    const barFilled = Math.round(pct / 10);
    const bar = '█'.repeat(barFilled) + '░'.repeat(10 - barFilled);

    if (cmd === 'aura') {
      return `╭━━〔 ✨ *AURA SCANNER PRO* 〕━━╮\n┃ 👤 *User:* ${targetTag}\n┃ ⚡ *Aura Score:* *+${pct * 9999} AURA* 🔥\n┃ 📊 *[${bar}] ${pct}%*\n┃ 👑 *Rank:* Supreme Royal Aura\n╰━━━━━━━━━━━━━━━━━━━━━━━━━╯`;
    }
    if (cmd === 'vibe') {
      return `╭━━〔 💎 *VIBE CHECKER* 〕━━╮\n┃ 👤 *User:* ${targetTag}\n┃ 🌟 *Vibe Rating:* *${pct}% Pure VIP*\n┃ 📊 *[${bar}]*\n┃ ⚡ *Verdict:* 100% Elite Khandani Vibe 👑\n╰━━━━━━━━━━━━━━━━━━━━━━━╯`;
    }
    if (cmd === 'iqtest') {
      const iq = Math.floor(115 + Math.random() * 65);
      return `╭━━〔 🧠 *X-IK IQ ANALYZER* 〕━━╮\n┃ 👤 *Subject:* ${targetTag}\n┃ 🧪 *Measured IQ:* *${iq} IQ*\n┃ 📊 *[${bar}]*\n┃ 🏆 *Title:* Mastermind Genius ⚡\n╰━━━━━━━━━━━━━━━━━━━━━━━━━╯`;
    }
    if (cmd === 'ship' || cmd === 'match') {
      return `╭━━〔 💞 *ROYAL MATCH METER* 〕━━╮\n┃ ❤️ *Pair:* ${senderName} ✖️ ${targetTag}\n┃ 💘 *Compatibility:* *${pct}%*\n┃ 📊 *[${bar}]*\n┃ ✨ *Verdict:* Made For Each Other 🔥\n╰━━━━━━━━━━━━━━━━━━━━━━━━━━╯`;
    }
    if (cmd === 'roastmeter') {
      return `╭━━〔 🔥 *SAVAGE ROAST METER* 〕━━╮\n┃ 🎯 *Target:* ${targetTag}\n┃ 💀 *Burn Level:* *${pct}% Critical*\n┃ 📊 *[${bar}]*\n┃ 🚒 *Status:* Call Fire Brigade Immediately!\n╰━━━━━━━━━━━━━━━━━━━━━━━━━━╯`;
    }
    if (cmd === 'mafia' || cmd === 'king' || cmd === 'badshah') {
      return `╭━━〔 👑 *UNDERWORLD SYNDICATE* 〕━━╮\n┃ 🦅 *Title:* *${cmd.toUpperCase()} OF THE CHAT*\n┃ 👤 *Boss:* ${targetTag}\n┃ 💼 *Empire:* SUFYAN-X-IK Cartel\n┃ 🔥 *Respect Level:* 1000% Guaranteed\n╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`;
    }
  }

  // 3. ISLAMIC ZONE EXTRAS (.surah, .99names, .qibla)
  if (cmd === '99names') {
    return [
      `╭━━〔 🕌 *أَسْمَاءُ اللّٰهِ الْحُسْنَىٰ* 〕━━╮`,
      `┃ 1. *ٱلرَّحْمَـٰنُ* (Ar-Rahman) — نہایت مہربان`,
      `┃ 2. *ٱلرَّحِيمُ* (Ar-Raheem) — بے حد رحم والا`,
      `┃ 3. *ٱلْمَلِكُ* (Al-Malik) — حقیقی بادشاہ`,
      `┃ 4. *ٱلْقُدُّوسُ* (Al-Quddus) — ہر عیب سے پاک`,
      `┃ 5. *ٱلسَّلَامُ* (As-Salam) — سلامتی دینے والا`,
      `┃ 6. *ٱلْمُؤْمِنُ* (Al-Mu'min) — امن دینے والا`,
      `┃ 7. *ٱلْمُهَيْمِنُ* (Al-Muhaymin) — نگہبان و محافظ`,
      `┃ 8. *ٱلْعَزِيزُ* (Al-Aziz) — غالب اور زبردست`,
      `┃ 9. *ٱلْجَبَّارُ* (Al-Jabbar) — عظمت و جلال والا`,
      `┃ 10. *ٱلْمُتَكَبِّرُ* (Al-Mutakabbir) — بڑائی اور کبریائی والا`,
      `╰━━━━━━━━━━━━━━━━━━━━━━━━━━╯`,
      `✨ _SAYRON MD • ISLAMIC ZONE_`,
    ].join('\n');
  }

  if (cmd === 'qibla') {
    return `╭━━〔 🕋 *QIBLA COMPASS* 〕━━╮\n┃ 🌍 *Region:* Pakistan / South Asia\n┃ 🧭 *Qibla Bearing:* *255° – 268° West-Southwest*\n┃ 🕋 *Kaaba Distance:* ~3,150 km\n╰━━━━━━━━━━━━━━━━━━━━━━━━╯\n✨ _SAYRON MD_`;
  }

  if (cmd === 'surah') {
    const num = parseInt(argText.trim(), 10) || 1;
    try {
      const r = await fetch(`https://api.alquran.cloud/v1/surah/${Math.min(114, Math.max(1, num))}`);
      const j: any = await r.json();
      const d = j?.data;
      if (d) {
        const firstAyahs = (d.ayahs || [])
          .slice(0, 5)
          .map((a: any) => `﴿${a.numberInSurah}﴾ ${a.text}`)
          .join('\n');
        return `╭━━〔 🕌 *${d.name} (${d.englishName})* 〕━━╮\n┃ 📖 *Translation:* ${d.englishNameTranslation}\n┃ 🕋 *Revelation:* ${d.revelationType} (${d.numberOfAyahs} Ayahs)\n╰━━━━━━━━━━━━━━━━━━━━━━━━━━╯\n\n${firstAyahs}\n\n⚡ _SAYRON MD_`;
      }
    } catch {
      // fallback
    }
    return `🕌 *سُورَةُ الْفَاتِحَة*\nبِسْمِ اللّٰهِ الرَّحْمٰنِ الرَّحِيمِ ﴿١﴾ الْحَمْدُ لِلّٰهِ رَبِّ الْعَالَمِينَ ﴿٢﴾ الرَّحْمٰنِ الرَّحِيمِ ﴿٣﴾ مَالِكِ يَوْمِ الدِّينِ ﴿٤﴾ إِيَّاكَ نَعْبُدُ وَإِيَّاكَ نَسْتَعِينُ ﴿٥﴾ اهْدِنَا الصِّرَاطَ الْمُسْتَقِيمَ ﴿٦﴾`;
  }

  // 4. PRO & DEV TOOLS (.crypto, .forex, .pkr, .gold, .github, .wiki, .dict, .define, .fancy, .style, .binary, .morse, .readmore)
  if (cmd === 'crypto') {
    try {
      const r = await fetch(
        'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,binancecoin,solana,the-open-network&vs_currencies=usd',
        { signal: AbortSignal.timeout(4500) }
      );
      const j: any = await r.json();
      if (j?.bitcoin?.usd) {
        return [
          `╭━━〔 📈 *LIVE CRYPTO MARKET* 〕━━╮`,
          `┃ 🪙 *BTC:* $${j.bitcoin.usd.toLocaleString()}`,
          `┃ 💎 *ETH:* $${j.ethereum?.usd?.toLocaleString() || 'N/A'}`,
          `┃ 🟡 *BNB:* $${j.binancecoin?.usd?.toLocaleString() || 'N/A'}`,
          `┃ 🚀 *SOL:* $${j.solana?.usd?.toLocaleString() || 'N/A'}`,
          `┃ ⚡ *TON:* $${j['the-open-network']?.usd?.toLocaleString() || 'N/A'}`,
          `╰━━━━━━━━━━━━━━━━━━━━━━━━━━╯`,
          `⚡ _Live Feed • SAYRON MD_`,
        ].join('\n');
      }
    } catch {
      // fallback
    }
    return `📈 *CRYPTO MARKET*\n• *BTC:* ~$92,400\n• *ETH:* ~$3,180\n• *SOL:* ~$195\n⚡ _SAYRON MD_`;
  }

  if (cmd === 'forex' || cmd === 'pkr' || cmd === 'gold') {
    try {
      const r = await fetch('https://open.er-api.com/v6/latest/USD', {
        signal: AbortSignal.timeout(4500),
      });
      const j: any = await r.json();
      const pkr = j?.rates?.PKR || 278.5;
      const sar = pkr / (j?.rates?.SAR || 3.75);
      const aed = pkr / (j?.rates?.AED || 3.67);
      const gbp = pkr / (j?.rates?.GBP || 0.78);
      const eur = pkr / (j?.rates?.EUR || 0.92);
      return [
        `╭━━〔 💱 *LIVE FOREX & PKR RATES* 〕━━╮`,
        `┃ 🇺🇸 *1 USD:* Rs. ${pkr.toFixed(2)} PKR`,
        `┃ 🇬🇧 *1 GBP:* Rs. ${gbp.toFixed(2)} PKR`,
        `┃ 🇪🇺 *1 EUR:* Rs. ${eur.toFixed(2)} PKR`,
        `┃ 🇸🇦 *1 SAR:* Rs. ${sar.toFixed(2)} PKR`,
        `┃ 🇦🇪 *1 AED:* Rs. ${aed.toFixed(2)} PKR`,
        `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`,
        `⚡ _SAYRON MD FINANCIAL DESK_`,
      ].join('\n');
    } catch {
      return `💱 *PKR EXCHANGE RATES*\n• *USD:* Rs. 278.50\n• *GBP:* Rs. 354.20\n• *SAR:* Rs. 74.25\n• *AED:* Rs. 75.80`;
    }
  }

  if (cmd === 'github') {
    const user = argText.trim() || 'torvalds';
    try {
      const r = await fetch(`https://api.github.com/users/${encodeURIComponent(user)}`, {
        headers: { 'User-Agent': 'SUFYAN-X-IK-MD' },
        signal: AbortSignal.timeout(4500),
      });
      if (r.ok) {
        const j: any = await r.json();
        return [
          `╭━━〔 🐙 *GITHUB DEVELOPER* 〕━━╮`,
          `┃ 👤 *Name:* ${j.name || j.login}`,
          `┃ 🔖 *User:* @${j.login}`,
          `┃ 📦 *Public Repos:* ${j.public_repos}`,
          `┃ 👥 *Followers:* ${j.followers}`,
          `┃ 📝 *Bio:* ${j.bio || 'Developer'}`,
          `┃ 🔗 *URL:* ${j.html_url}`,
          `╰━━━━━━━━━━━━━━━━━━━━━━━━━╯`,
        ].join('\n');
      }
    } catch {
      // ignore
    }
    return `🐙 Usage: *${prefix}github <username>*`;
  }

  if (cmd === 'wiki') {
    if (!argText) return `📚 Usage: *${prefix}wiki <topic>*`;
    try {
      const r = await fetch(
        `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(argText.trim())}`,
        { signal: AbortSignal.timeout(4500) }
      );
      if (r.ok) {
        const j: any = await r.json();
        if (j?.extract) {
          return `📚 *WIKIPEDIA • ${j.title}*\n\n${j.extract}\n\n⚡ _SAYRON MD_`;
        }
      }
    } catch {
      // ignore
    }
    const aiWiki = await generateTextWithFallbackModels(
      `Provide a concise encyclopedia summary of: ${argText}`,
      'You are SAYRON MD Encyclopedia.'
    );
    return `📚 *ENCYCLOPEDIA • ${argText.toUpperCase()}*\n\n${aiWiki || 'No summary found.'}`;
  }

  if (cmd === 'dict' || cmd === 'define') {
    if (!argText) return `📖 Usage: *${prefix}${cmd} <word>*`;
    try {
      const r = await fetch(
        `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(argText.trim())}`,
        { signal: AbortSignal.timeout(4000) }
      );
      if (r.ok) {
        const j: any = await r.json();
        const entry = j?.[0];
        const def = entry?.meanings?.[0]?.definitions?.[0]?.definition;
        const part = entry?.meanings?.[0]?.partOfSpeech || 'word';
        if (def) {
          return `📖 *DICTIONARY • ${entry.word.toUpperCase()}* (${part})\n\n• *Definition:* ${def}\n\n⚡ _SAYRON MD_`;
        }
      }
    } catch {
      // ignore
    }
    const aiDef = await generateTextWithFallbackModels(
      `Define the word "${argText}" in English and Urdu/Roman Urdu with an example.`,
      'You are SUFYAN-X-IK Dictionary.'
    );
    return `📖 *DEFINE • ${argText.toUpperCase()}*\n\n${aiDef || 'Definition not found.'}`;
  }

  if (cmd === 'fancy' || cmd === 'style') {
    return toFancyStyles(argText || 'SUFYAN-X-IK');
  }

  if (cmd === 'binary') {
    const txt = argText || 'SUFYAN-X-IK';
    if (/^[01\s]+$/.test(txt) && txt.replace(/\s+/g, '').length >= 8) {
      const decoded = txt
        .trim()
        .split(/\s+/)
        .map((b) => String.fromCharCode(parseInt(b, 2)))
        .join('');
      return `💻 *BINARY DECODED:*\n${decoded}`;
    }
    const bin = Array.from(txt)
      .map((c) => c.charCodeAt(0).toString(2).padStart(8, '0'))
      .join(' ');
    return `💻 *BINARY ENCODED:*\n\`${bin}\``;
  }

  if (cmd === 'morse') {
    const txt = (argText || 'SUFYAN X IK').toLowerCase();
    const morse = Array.from(txt)
      .map((c) => MORSE_MAP[c] || c)
      .join(' ');
    return `📡 *MORSE CODE:*\n\`${morse}\``;
  }

  if (cmd === 'readmore') {
    const parts = argText.includes('|')
      ? argText.split('|')
      : [argText || '👑 Click Read More...', '🔥 SAYRON MD VIP SECRET UNLOCKED! 👑'];
    const spoilerGap = '\u200B'.repeat(4001);
    return `${parts[0].trim()}${spoilerGap}${parts.slice(1).join('|').trim()}`;
  }

  return null;
}

export interface YouTubeMediaResult {
  type: 'audio' | 'video';
  buffer: Buffer;
  mimeType: string;
  title: string;
  artist: string;
  duration: string;
  durationSec: number;
  fileSizeMb: string;
  thumbnailUrl?: string;
  coverBuffer?: Buffer;
  ytUrl: string;
}

function formatSecondsClock(sec?: number): string {
  const s = Math.max(0, Math.round(Number(sec || 0)));
  if (!s) return 'Full';
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${String(rem).padStart(2, '0')}`;
}

export async function downloadYouTubeMedia(
  query: string,
  type: 'audio' | 'video'
): Promise<YouTubeMediaResult | null> {
  const cleanQ = query.trim();
  if (!cleanQ) return null;

  const isYtUrl = /^(https?:\/\/)?(www\.|m\.)?(youtube\.com|youtu\.be)\//i.test(cleanQ);

  try {
    // 1. For text audio queries (.song, .play, .yta, .ytmp3), resolve full-length track directly
    if (type === 'audio' && !isYtUrl) {
      const fastAudio = await fetchPlayableSong(cleanQ);
      if (fastAudio) {
        return {
          type: 'audio',
          buffer: fastAudio.audioBuffer,
          mimeType: fastAudio.mimeType || 'audio/mpeg',
          title: fastAudio.title,
          artist: fastAudio.artist,
          duration: formatSecondsClock(fastAudio.durationSec),
          durationSec: fastAudio.durationSec || 200,
          fileSizeMb: (fastAudio.audioBuffer.length / (1024 * 1024)).toFixed(1),
          coverBuffer: fastAudio.coverBuffer,
          ytUrl: '',
        };
      }
    }

    // 2. For text video queries (.video, .ytv, .mp4, .yt), resolve real full-length video with accurate duration
    if (type === 'video' && !isYtUrl) {
      const fastVideo = await fetchPlayableVideo(cleanQ);
      if (fastVideo) {
        const dSec = fastVideo.durationSec || 200;
        return {
          type: 'video',
          buffer: fastVideo.videoBuffer,
          mimeType: 'video/mp4',
          title: fastVideo.title,
          artist: fastVideo.artist,
          duration: formatSecondsClock(dSec),
          durationSec: dSec,
          fileSizeMb: (fastVideo.videoBuffer.length / (1024 * 1024)).toFixed(1),
          thumbnailUrl: fastVideo.thumbnailUrl || '',
          coverBuffer: fastVideo.coverBuffer,
          ytUrl: fastVideo.sourceUrl || '',
        };
      }
    }

    // 3. Direct YouTube URL (or retry via YouTube search metadata)
    const ytResults = await searchYouTubeVideos(cleanQ);
    const ytVideo = ytResults[0];
    const ytUrl = isYtUrl ? cleanQ : ytVideo?.url || '';
    const resolvedTitle =
      ytVideo?.title && !/^https?:\/\//i.test(ytVideo.title) ? ytVideo.title : cleanQ;
    const artist = ytVideo?.author || 'SAYRON MD';
    const durationSec = ytVideo?.durationSec || 180;
    const duration = ytVideo?.durationText || formatSecondsClock(durationSec);
    const thumbUrl = ytVideo?.thumbnailUrl || '';

    let coverBuffer: Buffer | undefined;
    if (thumbUrl && String(thumbUrl).startsWith('http')) {
      try {
        const imgRes = await fetch(thumbUrl, { signal: AbortSignal.timeout(3000) });
        if (imgRes.ok) {
          coverBuffer = await sharp(Buffer.from(await imgRes.arrayBuffer()))
            .resize(400, 400, { fit: 'cover' })
            .jpeg({ quality: 85 })
            .toBuffer();
        }
      } catch {
        // ignore cover error
      }
    }

    // Resolve full-length media matching the exact YouTube video title
    if (!/^https?:\/\//i.test(resolvedTitle)) {
      if (type === 'audio') {
        const songMatch = await fetchPlayableSong(resolvedTitle);
        if (songMatch) {
          return {
            type: 'audio',
            buffer: songMatch.audioBuffer,
            mimeType: songMatch.mimeType || 'audio/mpeg',
            title: songMatch.title || resolvedTitle,
            artist: songMatch.artist || artist,
            duration: formatSecondsClock(songMatch.durationSec || durationSec),
            durationSec: songMatch.durationSec || durationSec,
            fileSizeMb: (songMatch.audioBuffer.length / (1024 * 1024)).toFixed(1),
            thumbnailUrl: thumbUrl,
            coverBuffer: songMatch.coverBuffer || coverBuffer,
            ytUrl,
          };
        }
      } else {
        const vidMatch = await fetchPlayableVideo(resolvedTitle);
        if (vidMatch) {
          const dSec = vidMatch.durationSec || durationSec;
          return {
            type: 'video',
            buffer: vidMatch.videoBuffer,
            mimeType: 'video/mp4',
            title: vidMatch.title || resolvedTitle,
            artist: vidMatch.artist || artist,
            duration: formatSecondsClock(dSec),
            durationSec: dSec,
            fileSizeMb: (vidMatch.videoBuffer.length / (1024 * 1024)).toFixed(1),
            thumbnailUrl: vidMatch.thumbnailUrl || thumbUrl,
            coverBuffer: vidMatch.coverBuffer || coverBuffer,
            ytUrl,
          };
        }
      }
    }

    return null;
  } catch (err) {
    console.error('downloadYouTubeMedia error:', err);
    return null;
  }
}

export async function lookupDictionaryDefinition(wordInput: string): Promise<string> {
  const word = wordInput.trim();
  if (!word) return `📖 Usage: *.define <word>*`;

  const lines: string[] = [];
  try {
    const r = await fetch(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (r.ok) {
      const json: any = await r.json();
      const entry = json?.[0];
      if (entry) {
        const phonetic =
          entry.phonetic ||
          (entry.phonetics || []).find((ph: any) => ph?.text)?.text ||
          '';
        lines.push(`╭─❒ ${toSmallCaps(`dictionary • ${entry.word || word}`)} ❒`);
        if (phonetic) lines.push(`│ 🔊 *Phonetic:* ${phonetic}`);

        const meanings = (entry.meanings || []).slice(0, 3);
        for (const m of meanings) {
          const pos = m.partOfSpeech ? `(${m.partOfSpeech})` : '';
          const firstDef = m.definitions?.[0];
          if (firstDef?.definition) {
            lines.push(`│ ✦ *${pos}* ${firstDef.definition}`);
          }
          if (firstDef?.example) {
            lines.push(`│ 💡 _"${firstDef.example}"_`);
          }
        }
        const syns = (meanings[0]?.synonyms || []).slice(0, 5);
        if (syns.length > 0) {
          lines.push(`│ 🔗 *Synonyms:* ${syns.join(', ')}`);
        }
        lines.push(`╰──────────────`);
        return lines.join('\n');
      }
    }
  } catch {
    // fallback to AI dictionary
  }

  const aiDef = await generateTextWithFallbackModels(
    `Give a crisp, accurate dictionary definition for "${word}" including Part of Speech, English meaning, Urdu/Roman Urdu meaning, and 1 short example sentence.`,
    'You are SAYRON MD Dictionary.'
  );
  return [
    `╭─❒ ${toSmallCaps(`meaning • ${word}`)} ❒`,
    ...(aiDef || 'No definition found.').split('\n').map((l) => `│ ${l}`),
    `╰──────────────`,
  ].join('\n');
}

export interface SocialMediaDownloadResult {
  platform: string;
  mediaType: 'video' | 'image';
  buffer: Buffer;
  title: string;
  author?: string;
}

async function fetchMediaBufferFromUrl(
  mediaUrl: string,
  maxBytes = 48 * 1024 * 1024
): Promise<{ buffer: Buffer; contentType: string } | null> {
  try {
    const res = await fetch(mediaUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Accept: '*/*',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(25000),
    });
    if (!res.ok) return null;
    const cType = (res.headers.get('content-type') || '').toLowerCase();
    const lenHeader = Number(res.headers.get('content-length') || '0');
    if (lenHeader > maxBytes) return null;
    const ab = await res.arrayBuffer();
    const buf = Buffer.from(ab);
    if (buf.length < 3000 || buf.length > maxBytes) return null;
    return { buffer: buf, contentType: cType };
  } catch {
    return null;
  }
}

export async function downloadSocialVideo(
  platform: 'tiktok' | 'instagram' | 'facebook' | 'auto',
  rawUrl: string
): Promise<SocialMediaDownloadResult | null> {
  const url = (rawUrl.match(/https?:\/\/[^\s]+/i) || [rawUrl])[0]?.trim();
  if (!url || !/^https?:\/\//i.test(url)) return null;

  let detected = platform;
  if (detected === 'auto') {
    if (/tiktok\.com|vt\.tiktok\.com|vm\.tiktok\.com/i.test(url)) detected = 'tiktok';
    else if (/instagram\.com|instagr\.am/i.test(url)) detected = 'instagram';
    else if (/facebook\.com|fb\.watch|fb\.com/i.test(url)) detected = 'facebook';
  }

  // YouTube handling
  if (/youtube\.com|youtu\.be/i.test(url)) {
    const yt = await downloadYouTubeMedia(url, 'video');
    if (yt) {
      return {
        platform: 'YouTube',
        mediaType: 'video',
        buffer: yt.buffer,
        title: yt.title,
        author: yt.artist,
      };
    }
    return null;
  }

  const candidateMediaUrls: string[] = [];
  let title = `${detected.toUpperCase()} Media`;
  let author = 'SAYRON MD';

  // 1. Try ruhend-scraper
  try {
    const ruhend: any = await import('ruhend-scraper');
    if (detected === 'tiktok' && typeof ruhend.ttdl === 'function') {
      const r: any = await Promise.race([
        ruhend.ttdl(url),
        new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 10000)),
      ]);
      if (r) {
        if (r.video) candidateMediaUrls.push(r.video);
        if (r.video_hd) candidateMediaUrls.push(r.video_hd);
        if (r.nowm) candidateMediaUrls.push(r.nowm);
        if (typeof r.data === 'string') candidateMediaUrls.push(r.data);
        if (Array.isArray(r.data)) {
          for (const item of r.data) {
            if (typeof item === 'string') candidateMediaUrls.push(item);
            else if (item?.url) candidateMediaUrls.push(item.url);
          }
        }
        title = r.title || r.caption || title;
        author = r.author || author;
      }
    } else if (detected === 'instagram' && typeof ruhend.igdl === 'function') {
      const r: any = await Promise.race([
        ruhend.igdl(url),
        new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 10000)),
      ]);
      const items = Array.isArray(r?.data) ? r.data : Array.isArray(r) ? r : [];
      for (const item of items) {
        if (typeof item === 'string') candidateMediaUrls.push(item);
        else if (item?.url) candidateMediaUrls.push(item.url);
      }
    } else if (detected === 'facebook' && typeof ruhend.fbdl === 'function') {
      const r: any = await Promise.race([
        ruhend.fbdl(url),
        new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 10000)),
      ]);
      const items = Array.isArray(r?.data) ? r.data : Array.isArray(r) ? r : [];
      for (const item of items) {
        if (item?.url) candidateMediaUrls.push(item.url);
      }
      if (r?.hd) candidateMediaUrls.push(r.hd);
      if (r?.sd) candidateMediaUrls.push(r.sd);
    }
  } catch {
    // try next provider
  }

  // 2. Try social-dl
  if (candidateMediaUrls.length === 0) {
    try {
      const socialDl: any = await import('social-dl');
      if (detected === 'tiktok' && typeof socialDl.tiktokDl === 'function') {
        const res: any = await Promise.race([
          socialDl.tiktokDl(url),
          new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 10000)),
        ]);
        if (res?.video) candidateMediaUrls.push(res.video);
        if (res?.hdplay) candidateMediaUrls.push(res.hdplay);
        if (res?.play) candidateMediaUrls.push(res.play);
        if (res?.title) title = res.title;
      } else if (detected === 'instagram' && typeof socialDl.instagramDl === 'function') {
        const res: any = await Promise.race([
          socialDl.instagramDl(url),
          new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 10000)),
        ]);
        if (res?.videoUrl) candidateMediaUrls.push(res.videoUrl);
        if (res?.url && res.url !== url) candidateMediaUrls.push(res.url);
        if (Array.isArray(res?.media)) {
          for (const m of res.media) if (m?.url) candidateMediaUrls.push(m.url);
        }
      } else if (detected === 'facebook' && typeof socialDl.facebookDl === 'function') {
        const res: any = await Promise.race([
          socialDl.facebookDl(url),
          new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 10000)),
        ]);
        if (res?.hd) candidateMediaUrls.push(res.hd);
        if (res?.sd) candidateMediaUrls.push(res.sd);
        if (res?.videoUrl) candidateMediaUrls.push(res.videoUrl);
      }
    } catch {
      // try fallback APIs
    }
  }

  // 3. Public API fallbacks for TikTok/IG/FB
  if (candidateMediaUrls.length === 0) {
    const fallbacks: string[] = [];
    if (detected === 'tiktok') {
      fallbacks.push(
        `https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`,
        `https://apis.davidcyriltech.my.id/download/tiktok?url=${encodeURIComponent(url)}`
      );
    } else if (detected === 'instagram') {
      fallbacks.push(
        `https://apis.davidcyriltech.my.id/instagram?url=${encodeURIComponent(url)}`,
        `https://api.siputzx.my.id/api/d/igdl?url=${encodeURIComponent(url)}`
      );
    } else if (detected === 'facebook') {
      fallbacks.push(
        `https://apis.davidcyriltech.my.id/facebook?url=${encodeURIComponent(url)}`,
        `https://api.siputzx.my.id/api/d/fbdl?url=${encodeURIComponent(url)}`
      );
    }
    for (const api of fallbacks) {
      try {
        const res = await fetch(api, {
          headers: { 'User-Agent': 'Mozilla/5.0' },
          signal: AbortSignal.timeout(9000),
        });
        if (!res.ok) continue;
        const j: any = await res.json();
        const links = [
          j?.data?.play,
          j?.data?.hdplay,
          j?.data?.wmplay,
          j?.result?.video,
          j?.result?.hd,
          j?.result?.sd,
          j?.result?.download_url,
          j?.result?.url,
          j?.data?.url,
          ...(Array.isArray(j?.data) ? j.data.map((x: any) => x?.url) : []),
          ...(Array.isArray(j?.result) ? j.result.map((x: any) => x?.url) : []),
        ].filter((u) => typeof u === 'string' && /^https?:\/\//i.test(u));
        candidateMediaUrls.push(...links);
        if (j?.data?.title) title = j.data.title;
        if (candidateMediaUrls.length > 0) break;
      } catch {
        // continue
      }
    }
  }

  // 4. Direct URL or HTML og:video / og:image fallback (useful for .dl generic URLs)
  if (candidateMediaUrls.length === 0) {
    try {
      const directProbe = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(8000),
      });
      if (directProbe.ok) {
        const ct = (directProbe.headers.get('content-type') || '').toLowerCase();
        if (ct.startsWith('video/') || ct.startsWith('image/')) {
          const buf = Buffer.from(await directProbe.arrayBuffer());
          if (buf.length > 3000) {
            return {
              platform: detected === 'auto' ? 'DIRECT' : detected.toUpperCase(),
              mediaType: ct.startsWith('image/') ? 'image' : 'video',
              buffer: buf,
              title,
              author,
            };
          }
        } else if (ct.includes('text/html')) {
          const html = await directProbe.text();
          const ogVid =
            html.match(/property=["']og:video(?::secure_url)?["']\s+content=["']([^"']+)["']/i)?.[1] ||
            html.match(/content=["']([^"']+)["']\s+property=["']og:video(?::secure_url)?["']/i)?.[1];
          const ogImg =
            html.match(/property=["']og:image["']\s+content=["']([^"']+)["']/i)?.[1] ||
            html.match(/content=["']([^"']+)["']\s+property=["']og:image["']/i)?.[1];
          if (ogVid) candidateMediaUrls.push(ogVid.replace(/&amp;/g, '&'));
          else if (ogImg && detected !== 'auto') candidateMediaUrls.push(ogImg.replace(/&amp;/g, '&'));
        }
      }
    } catch {
      // ignore
    }
  }

  for (const cand of candidateMediaUrls) {
    const dl = await fetchMediaBufferFromUrl(cand);
    if (dl) {
      const isImg =
        dl.contentType.startsWith('image/') || /\.(jpg|jpeg|png|webp)($|\?)/i.test(cand);
      return {
        platform: detected === 'auto' ? 'MEDIA' : detected.toUpperCase(),
        mediaType: isImg ? 'image' : 'video',
        buffer: dl.buffer,
        title,
        author,
      };
    }
  }

  return null;
}

export async function stalkInstagramProfile(rawUsername: string): Promise<{
  text: string;
  avatarBuffer?: Buffer;
} | null> {
  const cleanUser = rawUsername.trim().replace(/^@/, '').replace(/.*instagram\.com\//i, '').split(/[/?#]/)[0];
  if (!cleanUser) return null;

  try {
    const r = await fetch(
      `https://i.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(cleanUser)}`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
          'X-IG-App-ID': '936619743392459',
        },
        signal: AbortSignal.timeout(7000),
      }
    );
    if (r.ok) {
      const j: any = await r.json();
      const u = j?.data?.user;
      if (u) {
        let avatarBuffer: Buffer | undefined;
        const picUrl = u.profile_pic_url_hd || u.profile_pic_url;
        if (picUrl) {
          const pic = await fetchMediaBufferFromUrl(picUrl, 5 * 1024 * 1024);
          if (pic) avatarBuffer = pic.buffer;
        }
        const text = [
          `╭─❒ ${toSmallCaps(`ig profile • @${u.username}`)} ❒`,
          `│ 👤 *Name:* ${u.full_name || u.username}`,
          `│ ✅ *Verified:* ${u.is_verified ? 'Yes' : 'No'} | 🔒 *Private:* ${u.is_private ? 'Yes' : 'No'}`,
          `│ 👥 *Followers:* ${(u.edge_followed_by?.count ?? 0).toLocaleString()}`,
          `│ ➡️ *Following:* ${(u.edge_follow?.count ?? 0).toLocaleString()}`,
          `│ 📸 *Posts:* ${(u.edge_owner_to_timeline_media?.count ?? 0).toLocaleString()}`,
          ...(u.biography ? [`│ 📝 *Bio:* ${u.biography.slice(0, 140)}`] : []),
          `│ 🔗 *Link:* instagram.com/${u.username}`,
          `╰──────────────`,
        ].join('\n');
        return { text, avatarBuffer };
      }
    }
  } catch {
    // fallback below
  }

  try {
    const htmlRes = await fetch(`https://www.instagram.com/${encodeURIComponent(cleanUser)}/`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)' },
      signal: AbortSignal.timeout(6000),
    });
    if (htmlRes.ok) {
      const html = await htmlRes.text();
      const desc = html.match(/<meta\s+(?:name|property)=["'](?:og:description|description)["']\s+content=["']([^"']+)["']/i)?.[1];
      const img = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i)?.[1];
      if (desc) {
        let avatarBuffer: Buffer | undefined;
        if (img) {
          const pic = await fetchMediaBufferFromUrl(img.replace(/&amp;/g, '&'), 5 * 1024 * 1024);
          if (pic) avatarBuffer = pic.buffer;
        }
        return {
          text: [
            `╭─❒ ${toSmallCaps(`ig profile • @${cleanUser}`)} ❒`,
            `│ 📸 ${desc.replace(/&quot;/g, '"').slice(0, 220)}`,
            `│ 🔗 instagram.com/${cleanUser}`,
            `╰──────────────`,
          ].join('\n'),
          avatarBuffer,
        };
      }
    }
  } catch {
    // ignore
  }

  return null;
}

export async function fetchTelegramStickerPack(
  rawPackUrl: string,
  maxStickers = 8
): Promise<{ packName: string; stickers: Buffer[] } | null> {
  const trimmed = rawPackUrl.trim();
  const match = trimmed.match(/t\.me\/addstickers\/([A-Za-z0-9_]+)/i);
  const packName = (match?.[1] || trimmed.replace(/[^A-Za-z0-9_]/g, '')).trim();
  if (!packName) return null;

  const stickerUrls: string[] = [];

  // 1. Official Telegram Bot API if token is configured via env or .setvar TELEGRAM_BOT_TOKEN
  const botToken =
    process.env.TELEGRAM_BOT_TOKEN || store.getCustomVars()?.TELEGRAM_BOT_TOKEN || '';
  if (botToken) {
    try {
      const apiRes = await fetch(
        `https://api.telegram.org/bot${botToken}/getStickerSet?name=${encodeURIComponent(packName)}`,
        { signal: AbortSignal.timeout(7000) }
      );
      if (apiRes.ok) {
        const j: any = await apiRes.json();
        const items = (j?.result?.stickers || []).slice(0, maxStickers);
        for (const st of items) {
          if (st?.file_id) {
            const fRes = await fetch(
              `https://api.telegram.org/bot${botToken}/getFile?file_id=${encodeURIComponent(st.file_id)}`,
              { signal: AbortSignal.timeout(5000) }
            );
            const fj: any = await fRes.json();
            if (fj?.result?.file_path) {
              stickerUrls.push(
                `https://api.telegram.org/file/bot${botToken}/${fj.result.file_path}`
              );
            }
          }
        }
      }
    } catch {
      // fall back to public index
    }
  }

  // 2. Public chpic.su sticker pack index fallback (works with zero API token)
  if (stickerUrls.length === 0) {
    try {
      const r = await fetch(`https://chpic.su/en/stickers/${encodeURIComponent(packName)}/`, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(8000),
      });
      if (r.ok) {
        const html = await r.text();
        const found = html.match(/https?:\/\/data\.chpic\.su\/stickers\/[^"'\s>]+\.webp/gi) || [];
        const unique = Array.from(new Set(found));
        stickerUrls.push(...unique.slice(0, maxStickers));
      }
    } catch {
      // ignore
    }
  }

  if (stickerUrls.length === 0) return null;

  const stickers: Buffer[] = [];
  for (const u of stickerUrls.slice(0, maxStickers)) {
    try {
      const res = await fetch(u, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(7000),
      });
      if (!res.ok) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 200) continue;
      const webp = await convertImageToWebpSticker(buf);
      stickers.push(webp);
    } catch {
      // skip failed frame
    }
  }

  if (stickers.length === 0) return null;
  return { packName, stickers };
}



