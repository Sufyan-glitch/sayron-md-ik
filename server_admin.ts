import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import os from 'os';
import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';
import { store } from './server_store.ts';
import { whatsappManager } from './server_whatsapp.ts';

export const adminRouter = Router();

// =============================================================================
// 🔐 ADMIN SECURITY & RATE-LIMITING CONFIGURATION
// =============================================================================
const ADMIN_PASSWORD_PLAIN = process.env.ADMIN_PASSWORD || 'SUFYANHYEE';
const ADMIN_PASSWORD_HASH = crypto
  .createHash('sha256')
  .update(`sufyan_salt_v9_${ADMIN_PASSWORD_PLAIN}`)
  .digest('hex');

const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 Hours
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 Minutes

interface ActiveSession {
  token: string;
  createdAt: number;
  expiresAt: number;
  ip: string;
  userAgent: string;
}

const ADMIN_SESSIONS_FILE = path.resolve(process.cwd(), '.data', 'admin_sessions.json');
const activeSessions = new Map<string, ActiveSession>();

function loadPersistedAdminSessions() {
  try {
    if (!fs.existsSync(ADMIN_SESSIONS_FILE)) return;
    const raw = JSON.parse(fs.readFileSync(ADMIN_SESSIONS_FILE, 'utf-8'));
    if (Array.isArray(raw)) {
      const now = Date.now();
      for (const s of raw) {
        if (s?.token && typeof s.expiresAt === 'number' && s.expiresAt > now) {
          activeSessions.set(s.token, s);
        }
      }
    }
  } catch {
    // ignore
  }
}

function savePersistedAdminSessions() {
  try {
    const dir = path.dirname(ADMIN_SESSIONS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const now = Date.now();
    const list = Array.from(activeSessions.values()).filter((s) => s.expiresAt > now);
    fs.writeFileSync(ADMIN_SESSIONS_FILE, JSON.stringify(list, null, 2), 'utf-8');
  } catch {
    // ignore
  }
}

loadPersistedAdminSessions();

const failedLoginTracker = new Map<
  string,
  { count: number; lockedUntilMs?: number; lastAttemptMs: number }
>();

function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress || '127.0.0.1';
}

function parseCookie(req: Request, name: string): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  const match = header
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.split('=')[1]) : undefined;
}

export function isValidAdminToken(token?: string | null): boolean {
  if (!token || typeof token !== 'string') return false;
  const session = activeSessions.get(token);
  if (!session) return false;
  if (Date.now() > session.expiresAt) {
    activeSessions.delete(token);
    return false;
  }
  return true;
}

// Security Middleware: Protects all admin API routes
export function requireAdminAuth(req: Request, res: Response, next: NextFunction) {
  const token =
    req.headers['x-admin-token'] ||
    (typeof req.headers.authorization === 'string' &&
    req.headers.authorization.startsWith('Bearer ')
      ? req.headers.authorization.slice(7)
      : undefined) ||
    parseCookie(req, 'xik_admin_token');

  if (!token || typeof token !== 'string') {
    return res.status(401).json({
      error: 'Unauthorized: Admin authentication token required.',
      requiresLogin: true,
    });
  }

  const session = activeSessions.get(token);
  if (!session) {
    return res.status(401).json({
      error: 'Session expired or invalid. Please login again.',
      requiresLogin: true,
    });
  }

  if (Date.now() > session.expiresAt) {
    activeSessions.delete(token);
    return res.status(401).json({
      error: 'Admin session expired. Please re-authenticate.',
      requiresLogin: true,
    });
  }

  // Refresh active session TTL on activity
  session.expiresAt = Date.now() + SESSION_TTL_MS;
  (req as any).adminSession = session;
  next();
}

// =============================================================================
// 🚪 1. AUTHENTICATION & LOGIN / LOGOUT
// =============================================================================
adminRouter.post('/login', async (req: Request, res: Response) => {
  const ip = getClientIp(req);
  const userAgent = req.headers['user-agent'] || 'Unknown';
  const { password } = req.body || {};

  // Rate Limiting & Lockout Check
  const tracker = failedLoginTracker.get(ip) || { count: 0, lastAttemptMs: Date.now() };
  if (tracker.lockedUntilMs && tracker.lockedUntilMs > Date.now()) {
    const remainingMinutes = Math.ceil((tracker.lockedUntilMs - Date.now()) / 60000);
    store.addLoginAttempt(ip, userAgent, false, `Locked out (${remainingMinutes}m remaining)`);
    return res.status(429).json({
      error: `Too many failed login attempts. Access temporarily locked for ${remainingMinutes} minute(s) to protect SUFYAN-X-IK Cyber Core.`,
      locked: true,
      remainingMinutes,
    });
  }

  if (!password || typeof password !== 'string') {
    return res.status(400).json({ error: 'Admin security password is required.' });
  }

  const cleanInput = password.trim();
  const inputHash = crypto
    .createHash('sha256')
    .update(`sufyan_salt_v9_${cleanInput}`)
    .digest('hex');
  const inputHashUpper = crypto
    .createHash('sha256')
    .update(`sufyan_salt_v9_${cleanInput.toUpperCase()}`)
    .digest('hex');

  const isValid =
    crypto.timingSafeEqual(Buffer.from(inputHash, 'utf-8'), Buffer.from(ADMIN_PASSWORD_HASH, 'utf-8')) ||
    crypto.timingSafeEqual(Buffer.from(inputHashUpper, 'utf-8'), Buffer.from(ADMIN_PASSWORD_HASH, 'utf-8'));

  if (!isValid) {
    tracker.count += 1;
    tracker.lastAttemptMs = Date.now();
    if (tracker.count >= MAX_FAILED_ATTEMPTS) {
      tracker.lockedUntilMs = Date.now() + LOCKOUT_DURATION_MS;
      store.addAuditLog('Security', 'LOCKOUT_TRIGGERED', `IP ${ip} locked out after 5 failed login attempts.`, 'WARN', ip);
    }
    failedLoginTracker.set(ip, tracker);
    store.addLoginAttempt(ip, userAgent, false, 'Invalid password');

    const attemptsLeft = Math.max(0, MAX_FAILED_ATTEMPTS - tracker.count);
    return res.status(401).json({
      error: attemptsLeft > 0
        ? `Access Denied: Invalid Security Password. (${attemptsLeft} attempt(s) remaining before lockout).`
        : `Access Denied: Account locked for 15 minutes due to repeated security failures.`,
      attemptsLeft,
    });
  }

  // Login Success
  failedLoginTracker.delete(ip);
  const token = crypto.randomBytes(32).toString('hex');
  const session: ActiveSession = {
    token,
    createdAt: Date.now(),
    expiresAt: Date.now() + SESSION_TTL_MS,
    ip,
    userAgent,
  };
  activeSessions.set(token, session);
  savePersistedAdminSessions();

  store.addLoginAttempt(ip, userAgent, true);
  store.addAuditLog('Admin', 'LOGIN_SUCCESS', `Master authenticated from IP ${ip}.`, 'SUCCESS', ip);

  // Set secure cookie
  res.cookie('xik_admin_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_TTL_MS,
  });

  return res.json({
    success: true,
    token,
    user: {
      username: 'SUFYAN-X-IK',
      role: 'SUPER_ADMIN',
      title: 'Ultimate WhatsApp Bot Supreme Commander',
    },
    expiresIn: SESSION_TTL_MS / 1000,
  });
});

adminRouter.post('/logout', requireAdminAuth, (req: Request, res: Response) => {
  const session = (req as any).adminSession as ActiveSession;
  if (session?.token) {
    activeSessions.delete(session.token);
    savePersistedAdminSessions();
  }
  res.clearCookie('xik_admin_token');
  store.addAuditLog('Admin', 'LOGOUT', 'Master session ended cleanly.', 'SUCCESS');
  res.json({ success: true, message: 'Logged out successfully.' });
});

adminRouter.get('/me', requireAdminAuth, (_req: Request, res: Response) => {
  res.json({
    authenticated: true,
    user: {
      username: 'SUFYAN-X-IK',
      role: 'SUPER_ADMIN',
      title: 'Ultimate WhatsApp Bot Supreme Commander',
      permissions: ['ALL_PERMISSIONS', 'BOT_CONTROL', 'COMMANDS_MANAGE', 'USERS_MANAGE', 'AI_MANAGE'],
    },
  });
});

// =============================================================================
// 📊 2. MAIN DASHBOARD LIVE STATS & OVERVIEW
// =============================================================================
adminRouter.get('/overview', requireAdminAuth, async (_req: Request, res: Response) => {
  try {
    const memory = process.memoryUsage();
    const cpus = os.cpus();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;

    const primarySession = whatsappManager.getPrimarySession();
    const state = primarySession ? primarySession.getState() : whatsappManager.getState();
    const connectedSessions = whatsappManager.getConnectedSessionsCount();
    const totalUsers = whatsappManager.getTotalUsersCount();

    const analytics = store.getAnalytics();
    const commandExecutions = store.getCommandExecutions();
    const totalCommandsExecuted = Object.values(commandExecutions).reduce((a, b) => a + b, 0);

    const connectedGroups = await whatsappManager.fetchAllConnectedGroups();
    const pairedDevices = whatsappManager.getAllSessionsForAdmin();
    const clusterServers = whatsappManager.getClusterServersSummary();
    const totalMessagesAcrossSessions = pairedDevices.reduce(
      (sum, d) => sum + (d.messagesProcessed || 0),
      0
    );

    res.json({
      status: 'ok',
      bot: {
        status: state.status,
        connectedPhone: state.connectedPhone,
        connectedName: state.connectedName,
        serverName: state.serverName || 'Server 01 • PK-Turbo',
        serverId: state.serverId || 'srv-1',
        connectedSessions,
        uptimeSeconds: Math.floor(process.uptime()),
        lastUpdated: state.lastUpdated,
      },
      stats: {
        totalUsers,
        totalGroups: connectedGroups.length,
        commandsExecuted: totalCommandsExecuted,
        messagesReceived: Math.max(analytics.totalMessagesProcessed, totalMessagesAcrossSessions),
        messagesSent: analytics.aiRepliesSent + totalCommandsExecuted,
        aiRepliesCount: analytics.aiRepliesSent,
        totalPairedDevices: pairedDevices.length,
        onlinePairedDevices: pairedDevices.filter((d) => d.status === 'connected' && !d.paused).length,
        totalMessagesAcrossSessions,
        botMode: store.getSettings().botMode || 'public',
        maintenanceMode: Boolean(store.getSettings().maintenanceMode),
        autoRead: Boolean(store.getSettings().autoRead),
        autoTyping: Boolean(store.getSettings().autoTyping),
        autoRecording: Boolean(store.getSettings().autoRecording),
      },
      system: {
        cpuCount: cpus.length,
        cpuModel: cpus[0]?.model || 'Cloud Intel/AMD vCPU',
        cpuUsagePercent: Math.min(100, Math.round((os.loadavg()[0] / (cpus.length || 1)) * 100)),
        ramUsedMb: Math.round(memory.heapUsed / 1024 / 1024),
        ramTotalMb: Math.round(totalMem / 1024 / 1024),
        ramPercent: Math.min(100, Math.round((usedMem / totalMem) * 100)),
        nodeVersion: process.version,
        platform: `${os.type()} ${os.arch()}`,
      },
      pairedDevices,
      clusterServers,
      recentAudit: store.getAuditLogs().slice(0, 6),
      recentLogs: store.getLogs().slice(0, 8),
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to generate overview' });
  }
});

// =============================================================================
// 📱 2B. PAIRED USER DEVICES FLEET & CLUSTER CONTROL (ULTRA PRO MAX)
// =============================================================================
adminRouter.get('/sessions', requireAdminAuth, (_req: Request, res: Response) => {
  try {
    const sessions = whatsappManager.getAllSessionsForAdmin();
    const clusterServers = whatsappManager.getClusterServersSummary();
    const onlineCount = sessions.filter((s) => s.status === 'connected' && !s.paused).length;
    const pausedCount = sessions.filter((s) => s.paused).length;
    const offlineCount = sessions.filter((s) => s.status !== 'connected').length;
    const totalMessages = sessions.reduce((acc, s) => acc + (s.messagesProcessed || 0), 0);

    res.json({
      sessions,
      clusterServers,
      totalSessions: sessions.length,
      onlineCount,
      pausedCount,
      offlineCount,
      totalMessages,
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to fetch paired devices fleet' });
  }
});

adminRouter.post('/sessions/action', requireAdminAuth, async (req: Request, res: Response) => {
  const { sessionId, action, serverId, target, message } = req.body || {};
  if (!sessionId || !action) {
    return res.status(400).json({ error: 'sessionId and action are required' });
  }

  try {
    if (action === 'pause') {
      const updated = whatsappManager.adminToggleSessionPause(sessionId, true);
      if (!updated) return res.status(404).json({ error: 'Paired session not found' });
      store.addAuditLog('Admin', 'SESSION_PAUSE', `Paused paired device ${updated.connectedPhone} (${sessionId})`, 'WARN');
      return res.json({ success: true, session: updated, message: `Paused ${updated.connectedPhone}` });
    }

    if (action === 'resume') {
      const updated = whatsappManager.adminToggleSessionPause(sessionId, false);
      if (!updated) return res.status(404).json({ error: 'Paired session not found' });
      store.addAuditLog('Admin', 'SESSION_RESUME', `Resumed paired device ${updated.connectedPhone} (${sessionId})`, 'SUCCESS');
      return res.json({ success: true, session: updated, message: `Resumed ${updated.connectedPhone}` });
    }

    if (action === 'switch_server') {
      if (!serverId) return res.status(400).json({ error: 'serverId is required' });
      const updated = whatsappManager.adminSwitchSessionServer(sessionId, serverId);
      if (!updated) return res.status(404).json({ error: 'Paired session not found' });
      store.addAuditLog('Admin', 'SESSION_SERVER_SWITCH', `Moved ${updated.connectedPhone} to ${updated.serverName}`, 'SUCCESS');
      return res.json({ success: true, session: updated, message: `Switched node to ${updated.serverName}` });
    }

    if (action === 'reconnect') {
      const updated = await whatsappManager.adminReconnectSession(sessionId);
      if (!updated) return res.status(404).json({ error: 'Paired session not found' });
      store.addAuditLog('Admin', 'SESSION_RECONNECT', `Forced reconnect for ${updated.connectedPhone} (${sessionId})`, 'SUCCESS');
      return res.json({ success: true, session: updated, message: `Reconnecting ${updated.connectedPhone}...` });
    }

    if (action === 'unpair') {
      const ok = await whatsappManager.adminDisconnectAndDeleteSession(sessionId);
      if (!ok) return res.status(404).json({ error: 'Paired session not found' });
      store.addAuditLog('Admin', 'SESSION_UNPAIR', `Unpaired and deleted device session ${sessionId}`, 'WARN');
      return res.json({ success: true, message: `Session ${sessionId} unpaired and cleaned up.` });
    }

    if (action === 'send_message') {
      if (!target || !message) {
        return res.status(400).json({ error: 'target phone/JID and message text are required' });
      }
      const result = await whatsappManager.adminSendMessageViaSession(sessionId, target, message);
      if (!result.ok) {
        return res.status(400).json({ error: result.error || 'Failed to send message' });
      }
      store.addAuditLog('Admin', 'SESSION_DIRECT_MSG', `Sent message via ${sessionId} to ${result.jid}`, 'SUCCESS');
      return res.json({ success: true, jid: result.jid, message: `Dispatched to ${result.jid}` });
    }

    return res.status(400).json({ error: 'Unknown session action' });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Session action failed' });
  }
});

adminRouter.post('/broadcast', requireAdminAuth, async (req: Request, res: Response) => {
  const { message, scope = 'paired_owners', sessionId } = req.body || {};
  if (!message || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: 'Broadcast message text is required' });
  }

  try {
    const cleanText = `📢 *SAYRON MD ADMIN BROADCAST*\n\n${message.trim()}\n\n_Powered by SUFYAN-X-IK_`;
    let sentCount = 0;
    let failedCount = 0;

    if (scope === 'paired_owners') {
      const sessions = whatsappManager.getAllSessionsForAdmin();
      const targets = sessionId
        ? sessions.filter((s) => s.sessionId === sessionId)
        : sessions;
      for (const s of targets) {
        if (s.status !== 'connected') continue;
        const phone = (s.pairedOwnerNumber || s.connectedPhone || '').replace(/[^0-9]/g, '');
        if (!phone) continue;
        const result = await whatsappManager.adminSendMessageViaSession(s.sessionId, phone, cleanText);
        if (result.ok) sentCount += 1;
        else failedCount += 1;
      }
    } else {
      const activeSessions = whatsappManager.getAllActiveSessions().filter(
        (s) => s.getState().status === 'connected' && (!sessionId || s.sessionId === sessionId)
      );
      const senderSession = activeSessions[0];
      if (!senderSession) {
        return res.status(400).json({ error: 'No active connected session available to dispatch broadcast' });
      }
      const conversations = store.getConversations().slice(0, 30);
      for (const conv of conversations) {
        if (!conv.jid) continue;
        const ok = await senderSession.sendReliableMessage(conv.jid, { text: cleanText });
        if (ok) sentCount += 1;
        else failedCount += 1;
        await new Promise((r) => setTimeout(r, 350));
      }
    }

    store.addAuditLog(
      'Admin',
      'ADMIN_BROADCAST',
      `Broadcast (${scope}) completed: ${sentCount} sent, ${failedCount} failed`,
      sentCount > 0 ? 'SUCCESS' : 'WARN'
    );

    res.json({
      success: true,
      sentCount,
      failedCount,
      message: `Broadcast delivered to ${sentCount} recipient(s).`,
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Broadcast failed' });
  }
});

// =============================================================================
// 🤖 3. BOT CONTROLS & SETTINGS
// =============================================================================
adminRouter.get('/bot/settings', requireAdminAuth, (_req: Request, res: Response) => {
  const s = store.getSettings();
  const biz = store.getBusiness();
  const web = store.getWebsiteConfig();
  res.json({
    settings: {
      botName: s.botName,
      botBio: s.botBio,
      prefix: s.prefix,
      botMode: s.botMode || 'public',
      maintenanceMode: Boolean(s.maintenanceMode),
      ownerNumber: s.ownerNumber !== undefined ? s.ownerNumber : (biz.contactNumbers ?? web.contactPhone ?? '923464267218'),
      autoRead: Boolean(s.autoRead),
      autoTyping: Boolean(s.autoTyping),
      autoRecording: Boolean(s.autoRecording),
      autoReact: Boolean(s.autoReact),
      autoStatusView: Boolean(s.autoStatusView),
      autoStatusLike: Boolean(s.autoStatusLike),
      statusLikeEmoji: s.statusLikeEmoji || '💚',
      presenceMode: s.presenceMode || 'available',
      language: s.language || 'Roman Urdu',
      personality: s.personality || 'friendly',
      channelJid: s.channelJid,
      channelInviteCode: s.channelInviteCode,
    },
  });
});

adminRouter.post('/bot/settings', requireAdminAuth, (req: Request, res: Response) => {
  try {
    const patch = req.body || {};
    const updated = store.updateSettings(patch);
    store.addAuditLog(
      'Admin',
      'SETTINGS_UPDATE',
      `Updated bot settings: mode=${updated.botMode}, prefix=${updated.prefix}, ownerNumber=${updated.ownerNumber === '' ? '(cleared)' : updated.ownerNumber}`,
      'SUCCESS'
    );
    res.json({ success: true, settings: updated });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'Failed to update settings' });
  }
});

adminRouter.post('/bot/action', requireAdminAuth, async (req: Request, res: Response) => {
  const { action, payload } = req.body || {};
  try {
    if (action === 'restart') {
      store.addAuditLog('Admin', 'BOT_RESTART', 'Triggered full socket restart for active sessions', 'WARN');
      await whatsappManager.restartAllSessions();
      return res.json({ success: true, message: 'Bot sessions restarting...' });
    }

    if (action === 'disconnect') {
      store.addAuditLog('Admin', 'BOT_DISCONNECT', 'Triggered disconnect for all bot sessions', 'WARN');
      await whatsappManager.disconnectAllSessions();
      return res.json({ success: true, message: 'All bot sessions disconnected.' });
    }

    if (action === 'set_mode') {
      const mode = payload?.mode;
      if (mode && ['public', 'self', 'maintenance'].includes(mode)) {
        store.updateSettings({
          botMode: mode,
          maintenanceMode: mode === 'maintenance',
        });
        store.addAuditLog('Admin', 'MODE_CHANGE', `Bot operational mode switched to: ${mode.toUpperCase()}`, 'SUCCESS');
        return res.json({ success: true, mode });
      }
      return res.status(400).json({ error: 'Invalid mode' });
    }

    if (action === 'set_profile_bio') {
      const bio = payload?.bio;
      if (typeof bio === 'string') {
        const primary = whatsappManager.getPrimarySession();
        if (primary) {
          await primary.updateStatusBio(bio);
        }
        store.updateSettings({ botBio: bio });
        store.addAuditLog('Admin', 'BIO_CHANGE', `WhatsApp bio updated to: "${bio}"`, 'SUCCESS');
        return res.json({ success: true, bio });
      }
      return res.status(400).json({ error: 'Bio text required' });
    }

    res.status(400).json({ error: 'Unknown bot action' });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'Action failed' });
  }
});

adminRouter.post('/bot/profile-picture', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const { base64Data } = req.body || {};
    if (!base64Data || typeof base64Data !== 'string') {
      return res.status(400).json({ error: 'base64Data image is required' });
    }
    const clean = base64Data.replace(/^data:image\/[a-z]+;base64,/, '');
    const buffer = Buffer.from(clean, 'base64');
    if (buffer.length < 500) {
      return res.status(400).json({ error: 'Invalid image buffer' });
    }

    const primary = whatsappManager.getPrimarySession();
    if (!primary) {
      return res.status(400).json({ error: 'No active WhatsApp bot session connected' });
    }

    const ok = await primary.updateProfilePictureBuffer(buffer);
    if (!ok) {
      return res.status(500).json({ error: 'Failed to update WhatsApp profile picture via Baileys' });
    }

    store.addAuditLog('Admin', 'DP_CHANGE', 'Bot profile picture changed successfully', 'SUCCESS');
    res.json({ success: true, message: 'Profile picture updated successfully.' });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'Failed to upload profile picture' });
  }
});

// =============================================================================
// ⚡ 4. COMMAND MANAGER
// =============================================================================
adminRouter.get('/commands', requireAdminAuth, (_req: Request, res: Response) => {
  const rules = store.getCommandRules();
  const custom = store.getCustomCommands();
  const executions = store.getCommandExecutions();

  // All 260+ registered commands categorized
  const BUILTIN_COMMANDS: Array<{
    name: string;
    category: string;
    description: string;
    defaultPermission: 'all' | 'admin' | 'owner';
  }> = [
    // AI
    { name: 'ai', category: 'AI Engine', description: 'Ask questions to Gemini AI Brain', defaultPermission: 'all' },
    { name: 'ask', category: 'AI Engine', description: 'Quick AI answer & explanations', defaultPermission: 'all' },
    { name: 'chat', category: 'AI Engine', description: 'Conversational chat with AI', defaultPermission: 'all' },
    { name: 'imagine', category: 'AI Engine', description: 'AI Image synthesis and generation', defaultPermission: 'all' },
    { name: 'vision', category: 'AI Engine', description: 'AI Photo analysis and description', defaultPermission: 'all' },
    { name: 'code', category: 'AI Engine', description: 'Generate software source code', defaultPermission: 'all' },
    { name: 'debug', category: 'AI Engine', description: 'Debug code snippets & fix errors', defaultPermission: 'all' },
    { name: 'jarvis', category: 'Jarvis', description: 'Autonomous Jarvis Assistant Engine', defaultPermission: 'all' },
    // Media & Download
    { name: 'song', category: 'Downloader', description: 'Download High-Res 320k Studio MP3', defaultPermission: 'all' },
    { name: 'video', category: 'Downloader', description: 'Download Real Playable MP4 Video', defaultPermission: 'all' },
    { name: 'ytmp3', category: 'Downloader', description: 'YouTube Audio fast extractor', defaultPermission: 'all' },
    { name: 'ytmp4', category: 'Downloader', description: 'YouTube Video MP4 download', defaultPermission: 'all' },
    { name: 'tiktok', category: 'Downloader', description: 'TikTok Video without watermark', defaultPermission: 'all' },
    { name: 'ig', category: 'Downloader', description: 'Instagram Reels and Carousel download', defaultPermission: 'all' },
    { name: 'fb', category: 'Downloader', description: 'Facebook HD Video download', defaultPermission: 'all' },
    { name: 'play', category: 'Downloader', description: 'Search and play any track', defaultPermission: 'all' },
    { name: 'sticker', category: 'Photo Studio', description: 'Convert photo to WhatsApp sticker', defaultPermission: 'all' },
    { name: 'toimg', category: 'Photo Studio', description: 'Convert sticker back to image', defaultPermission: 'all' },
    { name: 'vv', category: 'Status & Auto', description: 'Download View-Once media secretly', defaultPermission: 'all' },
    { name: 'gcstatus', category: 'Status & Auto', description: 'Post group status & update group icon', defaultPermission: 'all' },
    { name: 'save', category: 'Status & Auto', description: 'Save status story media directly', defaultPermission: 'all' },
    { name: 'pair', category: 'Status & Auto', description: 'Generate 8-digit WhatsApp pairing code', defaultPermission: 'all' },
    { name: 'ping', category: 'Tools', description: 'Check real server latency in ms', defaultPermission: 'all' },
    { name: 'speed', category: 'Tools', description: 'Check server network transfer speed', defaultPermission: 'all' },
    { name: 'menu', category: 'General', description: 'Display animated bot command menu', defaultPermission: 'all' },
    { name: 'owner', category: 'General', description: 'Display SUFYAN-X-IK contact info', defaultPermission: 'all' },
    { name: 'alive', category: 'General', description: 'Check if bot node is active', defaultPermission: 'all' },
    // Group Moderation
    { name: 'kick', category: 'Group Admin', description: 'Remove member from group', defaultPermission: 'admin' },
    { name: 'promote', category: 'Group Admin', description: 'Promote member to admin', defaultPermission: 'admin' },
    { name: 'demote', category: 'Group Admin', description: 'Demote admin to normal member', defaultPermission: 'admin' },
    { name: 'tagall', category: 'Group Admin', description: 'Mention all group participants', defaultPermission: 'admin' },
    { name: 'hidetag', category: 'Group Admin', description: 'Invisible mention for announcements', defaultPermission: 'admin' },
    { name: 'antilink', category: 'Group Admin', description: 'Toggle link deletion & auto-kick', defaultPermission: 'admin' },
    { name: 'antispam', category: 'Group Admin', description: 'Toggle anti-spam flooder detector', defaultPermission: 'admin' },
    { name: 'mute', category: 'Group Admin', description: 'Close group chat (admins only)', defaultPermission: 'admin' },
    { name: 'unmute', category: 'Group Admin', description: 'Open group chat for everyone', defaultPermission: 'admin' },
    { name: 'welcome', category: 'Group Admin', description: 'Toggle custom member welcome card', defaultPermission: 'admin' },
    { name: 'goodbye', category: 'Group Admin', description: 'Toggle member leave notification', defaultPermission: 'admin' },
    // Cyber & OSINT
    { name: 'pentest', category: 'Cyber Ops', description: 'Network security scanning report', defaultPermission: 'all' },
    { name: 'trace', category: 'Cyber Ops', description: 'IP geolocation & ASN tracer', defaultPermission: 'all' },
    { name: 'breach', category: 'Cyber Ops', description: 'Data breach lookup detector', defaultPermission: 'all' },
    { name: 'whois', category: 'Cyber Ops', description: 'Domain registrar & DNS intelligence', defaultPermission: 'all' },
    { name: 'matrix', category: 'Cyber Ops', description: 'Cyber matrix terminal animation', defaultPermission: 'all' },
    // Islamic
    { name: 'quran', category: 'Islamic', description: 'Quranic Surah and Verse recitations', defaultPermission: 'all' },
    { name: 'hadith', category: 'Islamic', description: 'Authentic Hadith collection lookup', defaultPermission: 'all' },
    { name: 'namaz', category: 'Islamic', description: 'Daily prayer times by city', defaultPermission: 'all' },
    // Owner Only
    { name: 'restart', category: 'Owner Only', description: 'Reboot bot node and clean cache', defaultPermission: 'owner' },
    { name: 'broadcast', category: 'Owner Only', description: 'Broadcast message to all chats', defaultPermission: 'owner' },
    { name: 'setprefix', category: 'Owner Only', description: 'Change command trigger prefix', defaultPermission: 'owner' },
    { name: 'setname', category: 'Owner Only', description: 'Change bot public title', defaultPermission: 'owner' },
  ];

  const merged = BUILTIN_COMMANDS.map((cmd) => {
    const rule = rules[cmd.name];
    return {
      name: cmd.name,
      category: cmd.category,
      description: cmd.description,
      permission: rule?.permission || cmd.defaultPermission,
      enabled: rule ? rule.enabled : true,
      cooldownSec: rule?.cooldownSec ?? 2,
      usageCount: (executions[cmd.name] || 0) + (rule?.usageCount || 0),
      isCustom: false,
    };
  });

  const customMerged = custom.map((c) => ({
    name: c.name,
    category: c.category || 'Custom',
    description: c.description || c.response.slice(0, 40),
    permission: 'all' as const,
    enabled: c.enabled,
    cooldownSec: 2,
    usageCount: executions[c.name] || 0,
    isCustom: true,
    customId: c.id,
    response: c.response,
  }));

  res.json({
    commands: [...merged, ...customMerged],
    totalCount: merged.length + customMerged.length,
    activeCount: [...merged, ...customMerged].filter((c) => c.enabled).length,
  });
});

adminRouter.post('/commands/toggle', requireAdminAuth, (req: Request, res: Response) => {
  const { command, enabled } = req.body || {};
  if (!command || typeof enabled !== 'boolean') {
    return res.status(400).json({ error: 'Command name and enabled boolean required' });
  }

  const clean = command.toLowerCase().trim();
  // Check if it's custom
  const custom = store.getCustomCommands().find((c) => c.name === clean);
  if (custom) {
    custom.enabled = enabled;
    store.setCustomCommand(custom);
  } else {
    store.setCommandRule({ command: clean, enabled });
  }

  store.addAuditLog(
    'Admin',
    'COMMAND_TOGGLE',
    `Command .${clean} ${enabled ? 'ENABLED' : 'DISABLED'} by Master`,
    'SUCCESS'
  );

  res.json({ success: true, command: clean, enabled });
});

adminRouter.post('/commands/rule', requireAdminAuth, (req: Request, res: Response) => {
  const { command, cooldownSec, permission } = req.body || {};
  if (!command) return res.status(400).json({ error: 'Command name required' });

  const updated = store.setCommandRule({
    command,
    cooldownSec: typeof cooldownSec === 'number' ? cooldownSec : 2,
    permission: ['all', 'admin', 'owner'].includes(permission) ? permission : 'all',
  });

  store.addAuditLog(
    'Admin',
    'COMMAND_RULE_UPDATE',
    `Updated rule for .${command}: cooldown=${updated.cooldownSec}s, permission=${updated.permission}`,
    'SUCCESS'
  );

  res.json({ success: true, rule: updated });
});

adminRouter.post('/commands/custom/add', requireAdminAuth, (req: Request, res: Response) => {
  const { name, response, category, description } = req.body || {};
  if (!name || !response) {
    return res.status(400).json({ error: 'Command trigger name and response are required' });
  }

  const created = store.setCustomCommand({
    name,
    response,
    category: category || 'Custom Auto-Reply',
    description: description || `Custom reply for .${name}`,
    enabled: true,
    createdBy: 'Master SUFYAN-X-IK',
  });

  store.addAuditLog(
    'Admin',
    'CUSTOM_COMMAND_ADD',
    `Added custom command .${created.name} (Response: "${created.response.slice(0, 30)}...")`,
    'SUCCESS'
  );

  res.json({ success: true, command: created });
});

adminRouter.post('/commands/custom/delete', requireAdminAuth, (req: Request, res: Response) => {
  const { nameOrId } = req.body || {};
  if (!nameOrId) return res.status(400).json({ error: 'nameOrId required' });
  const ok = store.deleteCustomCommand(nameOrId);
  if (ok) {
    store.addAuditLog('Admin', 'CUSTOM_COMMAND_DEL', `Deleted custom command ${nameOrId}`, 'WARN');
  }
  res.json({ success: ok });
});

// =============================================================================
// 👥 5. USER MANAGEMENT
// =============================================================================
adminRouter.get('/users', requireAdminAuth, (_req: Request, res: Response) => {
  const users = store.getUserMetas();
  const blocked = store.getBlockedUsers();

  const formatted = users.map((u) => {
    const isBanned = blocked.includes(u.jid) || u.role === 'banned';
    return {
      ...u,
      role: isBanned ? 'banned' : u.role,
      isBanned,
    };
  });

  res.json({
    users: formatted,
    totalUsers: formatted.length,
    bannedCount: formatted.filter((u) => u.isBanned).length,
  });
});

adminRouter.post('/users/action', requireAdminAuth, (req: Request, res: Response) => {
  const { jidOrPhone, action, role } = req.body || {};
  if (!jidOrPhone || !action) {
    return res.status(400).json({ error: 'jidOrPhone and action are required' });
  }

  if (action === 'ban') {
    store.setUserBanned(jidOrPhone, true);
    store.addAuditLog('Admin', 'USER_BAN', `User ${jidOrPhone} BANNED from bot`, 'WARN');
    return res.json({ success: true, action: 'ban', jidOrPhone });
  }

  if (action === 'unban') {
    store.setUserBanned(jidOrPhone, false);
    store.addAuditLog('Admin', 'USER_UNBAN', `User ${jidOrPhone} UNBANNED`, 'SUCCESS');
    return res.json({ success: true, action: 'unban', jidOrPhone });
  }

  if (action === 'block_commands') {
    store.setUserCommandsBlocked(jidOrPhone, true);
    store.addAuditLog('Admin', 'USER_CMD_BLOCK', `User ${jidOrPhone} blocked from running commands`, 'WARN');
    return res.json({ success: true, action: 'block_commands', jidOrPhone });
  }

  if (action === 'unblock_commands') {
    store.setUserCommandsBlocked(jidOrPhone, false);
    store.addAuditLog('Admin', 'USER_CMD_UNBLOCK', `User ${jidOrPhone} unblocked from running commands`, 'SUCCESS');
    return res.json({ success: true, action: 'unblock_commands', jidOrPhone });
  }

  if (action === 'set_role' && role) {
    store.setUserRole(jidOrPhone, role);
    store.addAuditLog('Admin', 'USER_ROLE_CHANGE', `User ${jidOrPhone} role set to ${role}`, 'SUCCESS');
    return res.json({ success: true, action: 'set_role', jidOrPhone, role });
  }

  res.status(400).json({ error: 'Invalid user action' });
});

// =============================================================================
// 👥 6. GROUP MANAGEMENT
// =============================================================================
adminRouter.get('/groups', requireAdminAuth, async (_req: Request, res: Response) => {
  try {
    const rawGroups = await whatsappManager.fetchAllConnectedGroups();
    const groupConfigs = store.getGroupConfigs();

    const enriched = rawGroups.map((g) => {
      const cfg = groupConfigs[g.jid] || {
        rules: '',
        welcome: false,
        goodbye: false,
        antilink: false,
        antispam: false,
        groupAi: true,
      };
      return {
        ...g,
        config: cfg,
      };
    });

    res.json({
      groups: enriched,
      totalGroups: enriched.length,
      adminCount: enriched.filter((g) => g.isBotAdmin).length,
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to fetch groups' });
  }
});

adminRouter.post('/groups/config', requireAdminAuth, (req: Request, res: Response) => {
  const { groupJid, patch } = req.body || {};
  if (!groupJid || !patch) {
    return res.status(400).json({ error: 'groupJid and patch are required' });
  }

  const updated = store.updateGroupConfig(groupJid, patch);
  store.addAuditLog(
    'Admin',
    'GROUP_CONFIG_UPDATE',
    `Updated security config for group ${groupJid} (antilink=${updated.antilink}, antispam=${updated.antispam})`,
    'SUCCESS'
  );

  res.json({ success: true, config: updated });
});

adminRouter.post('/groups/leave', requireAdminAuth, async (req: Request, res: Response) => {
  const { groupJid, sessionId } = req.body || {};
  if (!groupJid || !groupJid.endsWith('@g.us')) {
    return res.status(400).json({ error: 'Valid groupJid required' });
  }

  try {
    const ok = await whatsappManager.leaveGroupForSession(groupJid, sessionId);
    if (!ok) {
      return res.status(400).json({ error: 'No active WhatsApp socket connection for this group session' });
    }
    store.addAuditLog('Admin', 'GROUP_LEAVE', `Bot instructed to leave group: ${groupJid} (${sessionId || 'primary'})`, 'WARN');
    res.json({ success: true, message: `Left group ${groupJid}` });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'Failed to leave group' });
  }
});

// =============================================================================
// 🧠 7. AI & API MANAGEMENT
// =============================================================================
adminRouter.get('/ai', requireAdminAuth, (_req: Request, res: Response) => {
  const cfg = store.getAiConfig();
  res.json({
    ai: {
      provider: cfg.provider,
      model: cfg.model,
      maxOutputTokens: cfg.maxOutputTokens,
      temperature: cfg.temperature,
      enabled: cfg.enabled,
      rateLimitPerUser: cfg.rateLimitPerUser,
      customSystemPrompt: cfg.customSystemPrompt,
      hasServerKey: Boolean(process.env.GEMINI_API_KEY || process.env.API_KEY),
    },
  });
});

adminRouter.post('/ai', requireAdminAuth, (req: Request, res: Response) => {
  const patch = req.body || {};
  const updated = store.updateAiConfig(patch);
  store.addAuditLog('Admin', 'AI_CONFIG_UPDATE', `AI model set to ${updated.model}, enabled=${updated.enabled}`, 'SUCCESS');
  res.json({ success: true, ai: updated });
});

// =============================================================================
// 💾 8. MEDIA & DOWNLOADER MANAGEMENT
// =============================================================================
adminRouter.get('/downloader', requireAdminAuth, (_req: Request, res: Response) => {
  res.json({ downloader: store.getDownloaderConfig() });
});

adminRouter.post('/downloader', requireAdminAuth, (req: Request, res: Response) => {
  const patch = req.body || {};
  const updated = store.updateDownloaderConfig(patch);
  store.addAuditLog(
    'Admin',
    'DOWNLOADER_CONFIG_UPDATE',
    `Downloader max size: ${updated.maxFileSizeMb}MB, bitrate: ${updated.audioBitrate}`,
    'SUCCESS'
  );
  res.json({ success: true, downloader: updated });
});

// =============================================================================
// 🌐 9. WEBSITE MANAGEMENT
// =============================================================================
adminRouter.get('/website', requireAdminAuth, (_req: Request, res: Response) => {
  res.json({ website: store.getWebsiteConfig() });
});

adminRouter.post('/website', requireAdminAuth, (req: Request, res: Response) => {
  const patch = req.body || {};
  const updated = store.updateWebsiteConfig(patch);
  store.addAuditLog('Admin', 'WEBSITE_CONFIG_UPDATE', `Website announcement & branding updated`, 'SUCCESS');
  res.json({ success: true, website: updated });
});

// =============================================================================
// 📜 10. LOGS & AUDIT TRAIL
// =============================================================================
adminRouter.get('/logs', requireAdminAuth, (_req: Request, res: Response) => {
  res.json({
    auditLogs: store.getAuditLogs(),
    botLogs: store.getLogs(),
    loginAttempts: store.getLoginAttempts(),
  });
});

adminRouter.post('/logs/clear', requireAdminAuth, (_req: Request, res: Response) => {
  store.clearAuditLogs();
  res.json({ success: true, message: 'Logs purged with Master confirmation.' });
});

// =============================================================================
// 📦 11. DATABASE BACKUP & RESTORE
// =============================================================================
adminRouter.get('/database', requireAdminAuth, (_req: Request, res: Response) => {
  const storePath = path.resolve(process.cwd(), '.data', 'xik_store.json');
  let storeSize = 0;
  if (fs.existsSync(storePath)) {
    storeSize = fs.statSync(storePath).size;
  }
  const backups = store.listBackups();
  res.json({
    database: {
      status: 'HEALTHY',
      fileSizeBytes: storeSize,
      fileSizeKb: Math.round(storeSize / 1024),
      backupsCount: backups.length,
      backups,
    },
  });
});

adminRouter.post('/database/backup', requireAdminAuth, (_req: Request, res: Response) => {
  try {
    const backup = store.createBackupSnapshot();
    res.json({ success: true, backup });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'Failed to create backup' });
  }
});

adminRouter.post('/database/restore', requireAdminAuth, (req: Request, res: Response) => {
  const { filename } = req.body || {};
  if (!filename || typeof filename !== 'string') {
    return res.status(400).json({ error: 'Backup filename required' });
  }
  const ok = store.restoreBackupSnapshot(filename);
  if (!ok) {
    return res.status(500).json({ error: 'Failed to restore database from backup' });
  }
  res.json({ success: true, message: `Database restored from ${filename}` });
});

// =============================================================================
// 📦 11. COMPLETE BOT SOURCE CODE ZIP EXPORT (Railway / VPS Deployment Ready)
// =============================================================================
adminRouter.get('/download-source-zip', (req: Request, res: Response) => {
  // Support both Authorization header and query token for direct browser <a> downloads
  const token =
    (req.headers.authorization && req.headers.authorization.replace('Bearer ', '').trim()) ||
    (req.cookies && req.cookies.xik_admin_token) ||
    (typeof req.query.token === 'string' ? req.query.token : '');

  if (!token || !isValidAdminToken(token)) {
    return res.status(401).json({ error: 'Unauthorized: Valid Admin session token required' });
  }

  try {
    const zip = new AdmZip();
    const rootDir = process.cwd();

    // Directories to exclude from the distribution zip to keep it clean and lightweight
    const excludeDirs = new Set([
      'node_modules',
      'dist',
      '.git',
      '.cache',
      '.npm',
      'backups',
      'sessions',
    ]);

    // Sensitive or temporary files to exclude
    const excludeFiles = new Set([
      'xik_admin_token',
      '.DS_Store',
    ]);

    function addDirRecursive(currentDir: string, zipRelativeDir: string) {
      if (!fs.existsSync(currentDir)) return;
      const entries = fs.readdirSync(currentDir, { withFileTypes: true });

      for (const ent of entries) {
        if (ent.name.startsWith('.') && ent.name !== '.env.example' && ent.name !== '.data') {
          continue;
        }

        if (ent.name === '.data') {
          // Inside .data, only include safe persistent configurations (skip session auth tokens & large backup snapshots)
          const dataPath = path.join(currentDir, ent.name);
          if (fs.existsSync(dataPath)) {
            const dataEntries = fs.readdirSync(dataPath, { withFileTypes: true });
            for (const de of dataEntries) {
              if (de.name === 'sessions' || de.name === 'backups') continue;
              const dePath = path.join(dataPath, de.name);
              if (de.isFile()) {
                zip.addFile(path.join('.data', de.name), fs.readFileSync(dePath));
              }
            }
          }
          continue;
        }

        if (ent.isDirectory()) {
          if (excludeDirs.has(ent.name)) continue;
          addDirRecursive(path.join(currentDir, ent.name), path.join(zipRelativeDir, ent.name));
        } else if (ent.isFile()) {
          if (excludeFiles.has(ent.name)) continue;
          const fullPath = path.join(currentDir, ent.name);
          const zipPath = zipRelativeDir ? path.join(zipRelativeDir, ent.name) : ent.name;
          zip.addFile(zipPath, fs.readFileSync(fullPath));
        }
      }
    }

    addDirRecursive(rootDir, '');

    const zipBuffer = zip.toBuffer();
    const timestamp = new Date().toISOString().slice(0, 10);
    const filename = `SUFYAN-X-IK_MD_BOT_RAILWAY_READY_${timestamp}.zip`;

    store.addAuditLog(
      'Admin',
      'SOURCE_EXPORT_ZIP',
      `Full bot deployment zip generated (${Math.round(zipBuffer.length / 1024)} KB) with Railway & Dockerfile configs`,
      'SUCCESS'
    );

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', zipBuffer.length.toString());
    res.send(zipBuffer);
  } catch (err: any) {
    console.error('Failed to create deployment zip:', err);
    res.status(500).json({ error: err?.message || 'Failed to generate deployment ZIP' });
  }
});

// =============================================================================
// 🎵 WEBSITE CYBER MUSIC MANAGEMENT
// =============================================================================
adminRouter.get('/music', requireAdminAuth, (_req, res) => {
  res.json({
    ok: true,
    songs: store.getSongs(),
  });
});

adminRouter.post('/music/add', requireAdminAuth, (req, res) => {
  try {
    const { title, artist, audioUrl, coverUrl, duration, category, url, audioBase64, coverBase64, cover } = req.body || {};
    const rawAudio = audioBase64 || audioUrl || url;
    if (!title || !rawAudio) {
      return res.status(400).json({ error: 'Title and Audio file are required' });
    }

    const uploadsAudioDir = path.join(process.cwd(), 'public', 'uploads', 'audio');
    const uploadsCoversDir = path.join(process.cwd(), 'public', 'uploads', 'covers');
    if (!fs.existsSync(uploadsAudioDir)) fs.mkdirSync(uploadsAudioDir, { recursive: true });
    if (!fs.existsSync(uploadsCoversDir)) fs.mkdirSync(uploadsCoversDir, { recursive: true });

    let finalAudioUrl = '';
    if (typeof rawAudio === 'string' && (rawAudio.startsWith('http://') || rawAudio.startsWith('https://') || rawAudio.startsWith('/'))) {
      finalAudioUrl = rawAudio;
    } else if (typeof rawAudio === 'string') {
      let ext = 'mp3';
      let cleanBase64 = rawAudio;
      const commaIdx = rawAudio.indexOf(',');
      if (commaIdx !== -1) {
        const header = rawAudio.slice(0, commaIdx).toLowerCase();
        cleanBase64 = rawAudio.slice(commaIdx + 1);
        if (header.includes('mp4') || header.includes('m4a')) ext = 'm4a';
        else if (header.includes('ogg')) ext = 'ogg';
        else if (header.includes('wav')) ext = 'wav';
        else if (header.includes('aac')) ext = 'aac';
        else if (header.includes('flac')) ext = 'flac';
        else if (header.includes('webm')) ext = 'webm';
      }
      const buffer = Buffer.from(cleanBase64, 'base64');
      const filename = `track_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.${ext}`;
      fs.writeFileSync(path.join(uploadsAudioDir, filename), buffer);
      finalAudioUrl = `/uploads/audio/${filename}`;
    }

    let finalCoverUrl = '/sayron_md_banner.jpg';
    const rawCover = coverBase64 || coverUrl || cover;
    if (rawCover) {
      if (typeof rawCover === 'string' && (rawCover.startsWith('http://') || rawCover.startsWith('https://') || rawCover.startsWith('/'))) {
        finalCoverUrl = rawCover;
      } else if (typeof rawCover === 'string') {
        let ext = 'jpg';
        let cleanBase64 = rawCover;
        const commaIdx = rawCover.indexOf(',');
        if (commaIdx !== -1) {
          const header = rawCover.slice(0, commaIdx).toLowerCase();
          cleanBase64 = rawCover.slice(commaIdx + 1);
          if (header.includes('png')) ext = 'png';
          else if (header.includes('webp')) ext = 'webp';
          else if (header.includes('gif')) ext = 'gif';
        }
        const buffer = Buffer.from(cleanBase64, 'base64');
        const filename = `cover_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.${ext}`;
        fs.writeFileSync(path.join(uploadsCoversDir, filename), buffer);
        finalCoverUrl = `/uploads/covers/${filename}`;
      }
    }

    const song = store.addSong({
      title: String(title).trim(),
      artist: String(artist || 'SUFYAN-X-IK Beats').trim(),
      audioUrl: finalAudioUrl,
      coverUrl: finalCoverUrl,
      duration: duration ? String(duration).trim() : '2:45',
      category: category ? String(category).trim() : 'Cyber Phonk',
    });
    res.json({ ok: true, song });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to add song' });
  }
});

adminRouter.delete('/music/:id', requireAdminAuth, (req, res) => {
  try {
    const { id } = req.params;
    const ok = store.deleteSong(id);
    res.json({ ok });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to delete song' });
  }
});


