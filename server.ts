import { applyBaileysPatchesSync } from './patch_baileys.ts';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';

// CRITICAL: Apply all Baileys patches on disk BEFORE dynamically importing server_whatsapp.ts
// so Node's ESM loader NEVER caches unpatched @whiskeysockets/baileys in V8 memory!
applyBaileysPatchesSync();

process.on('uncaughtException', (err) => {
  console.error('[X-IK AI] Uncaught Exception (handled):', err?.message || err);
});

process.on('unhandledRejection', (reason: any) => {
  console.error('[X-IK AI] Unhandled Rejection (handled):', reason?.message || reason);
});

async function startServer() {
  applyBaileysPatchesSync();
  const { store } = await import('./server_store.ts');
  const { whatsappManager } = await import('./server_whatsapp.ts');
  const { resolveMenuImageBuffer } = await import('./server_commands.ts');
  const { adminRouter } = await import('./server_admin.ts');

  const args = process.argv.slice(2);
  const portArgIdx = args.indexOf('--port');
  const portFromArg = portArgIdx !== -1 ? Number(args[portArgIdx + 1]) : null;
  const isProd = process.env.NODE_ENV === 'production';
  // AI Studio Dev Server must run on port 3000. In production (Railway/Docker), use process.env.PORT
  const PORT = portFromArg || (isProd && process.env.PORT ? Number(process.env.PORT) : 3000);

  const app = express();
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));
  app.use('/uploads', express.static(path.join(process.cwd(), 'public', 'uploads')));

  // Mount Supreme Cyber Admin API
  app.use('/api/admin', adminRouter);

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      uptime: Math.floor(process.uptime()),
      activeBotsCount: whatsappManager.getConnectedSessionsCount(),
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/api/state', (req, res) => {
    const s = store.getSettings();
    const clientId = typeof req.query.clientId === 'string' ? req.query.clientId : undefined;
    const ownerToken = typeof req.query.ownerToken === 'string' ? req.query.ownerToken : undefined;
    res.json({
      aiMode: store.getAiMode(),
      whatsapp: whatsappManager.getState(clientId, ownerToken),
      activeBotsCount: whatsappManager.getConnectedSessionsCount(),
      totalUsersCount: whatsappManager.getTotalUsersCount(),
      sessions: whatsappManager.getUserSessionsSummary(ownerToken, clientId),
      servers: whatsappManager.getClusterServersSummary(),
      channelJid: s.channelJid,
      channelInviteCode: s.channelInviteCode,
      menuImage: s.menuImage,
      logs: [],
    });
  });

  app.get('/api/menu-image', async (_req, res) => {
    const buf = await resolveMenuImageBuffer();
    if (buf) {
      res.setHeader('Content-Type', 'image/jpeg');
      res.setHeader('Cache-Control', 'no-cache');
      return res.send(buf);
    }
    res.status(404).send('Menu image not found');
  });

  app.get('/api/music/playlist', (_req, res) => {
    res.json({
      ok: true,
      playlist: store.getSongs(),
    });
  });

  // Direct Audio File & Picture Upload for Songs (No URL needed!)
  app.post('/api/music/add-direct', async (req, res) => {
    try {
      const { title, artist, audioBase64, coverBase64, category } = req.body || {};
      if (!title || !audioBase64) {
        return res.status(400).json({ error: 'Song title and audio file are required' });
      }

      const uploadsAudioDir = path.join(process.cwd(), 'public', 'uploads', 'audio');
      const uploadsCoversDir = path.join(process.cwd(), 'public', 'uploads', 'covers');
      if (!fs.existsSync(uploadsAudioDir)) fs.mkdirSync(uploadsAudioDir, { recursive: true });
      if (!fs.existsSync(uploadsCoversDir)) fs.mkdirSync(uploadsCoversDir, { recursive: true });

      let audioUrl = '';
      if (typeof audioBase64 === 'string' && (audioBase64.startsWith('http://') || audioBase64.startsWith('https://') || audioBase64.startsWith('/'))) {
        audioUrl = audioBase64;
      } else if (typeof audioBase64 === 'string') {
        let ext = 'mp3';
        let cleanBase64 = audioBase64;
        const commaIdx = audioBase64.indexOf(',');
        if (commaIdx !== -1) {
          const header = audioBase64.slice(0, commaIdx).toLowerCase();
          cleanBase64 = audioBase64.slice(commaIdx + 1);
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
        audioUrl = `/uploads/audio/${filename}`;
      }

      let coverUrl = '/sayron_md_banner.jpg';
      if (coverBase64) {
        if (typeof coverBase64 === 'string' && (coverBase64.startsWith('http://') || coverBase64.startsWith('https://') || coverBase64.startsWith('/'))) {
          coverUrl = coverBase64;
        } else if (typeof coverBase64 === 'string') {
          let ext = 'jpg';
          let cleanBase64 = coverBase64;
          const commaIdx = coverBase64.indexOf(',');
          if (commaIdx !== -1) {
            const header = coverBase64.slice(0, commaIdx).toLowerCase();
            cleanBase64 = coverBase64.slice(commaIdx + 1);
            if (header.includes('png')) ext = 'png';
            else if (header.includes('webp')) ext = 'webp';
            else if (header.includes('gif')) ext = 'gif';
          }
          const buffer = Buffer.from(cleanBase64, 'base64');
          const filename = `cover_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.${ext}`;
          fs.writeFileSync(path.join(uploadsCoversDir, filename), buffer);
          coverUrl = `/uploads/covers/${filename}`;
        }
      }

      const newSong = store.addSong({
        title: String(title).trim(),
        artist: String(artist || 'SUFYAN-X-IK Beats').trim(),
        audioUrl,
        coverUrl,
        duration: '2:45',
        category: category || 'Custom Audio',
      });

      res.json({ ok: true, song: newSong, playlist: store.getSongs() });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to add song' });
    }
  });

  // Direct Song Delete from Website or Player
  app.delete('/api/music/delete-direct/:id', (req, res) => {
    try {
      const { id } = req.params;
      const ok = store.deleteSong(id);
      res.json({ ok, playlist: store.getSongs() });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to delete track' });
    }
  });

  app.post('/api/whatsapp/connect', async (req, res) => {
    try {
      const { phoneNumber, clientId, serverId, ownerToken, mode } = req.body || {};
      const isQrMode = mode === 'qr';
      const cleanPhone = typeof phoneNumber === 'string' ? phoneNumber.replace(/[^0-9]/g, '') : '';
      if (!isQrMode && (!cleanPhone || cleanPhone.length < 7)) {
        return res.status(400).json({ error: 'Please enter a valid WhatsApp phone number with country code.' });
      }
      const state = await whatsappManager.startConnection(
        isQrMode ? undefined : phoneNumber,
        clientId,
        serverId,
        ownerToken,
        isQrMode
      );
      res.json({
        whatsapp: state,
        activeBotsCount: whatsappManager.getConnectedSessionsCount(),
        totalUsersCount: whatsappManager.getTotalUsersCount(),
        sessions: whatsappManager.getUserSessionsSummary(ownerToken, clientId),
        servers: whatsappManager.getClusterServersSummary(),
      });
    } catch (e: any) {
      res.status(500).json({ error: e?.message || 'Failed to start connection' });
    }
  });

  app.post('/api/whatsapp/disconnect', async (req, res) => {
    const { clientId, ownerToken } = req.body || {};
    res.json({
      whatsapp: whatsappManager.getState(clientId, ownerToken),
      sessions: whatsappManager.getUserSessionsSummary(ownerToken, clientId),
      servers: whatsappManager.getClusterServersSummary(),
    });
  });

  app.post('/api/sessions/pause', (req, res) => {
    try {
      const { sessionId, ownerToken, clientId } = req.body || {};
      if (!sessionId) {
        return res.status(400).json({ error: 'sessionId is required' });
      }
      const updated = whatsappManager.toggleSessionPause(sessionId, false, ownerToken, clientId);
      if (!updated) {
        return res.status(403).json({ error: 'Unauthorized: You can only control your own session' });
      }
      res.json({
        session: updated,
        sessions: whatsappManager.getUserSessionsSummary(ownerToken, clientId),
        servers: whatsappManager.getClusterServersSummary(),
      });
    } catch (e: any) {
      res.status(500).json({ error: e?.message || 'Failed to update session' });
    }
  });

  app.post('/api/sessions/server', (req, res) => {
    try {
      const { sessionId, serverId, ownerToken, clientId } = req.body || {};
      if (!sessionId || !serverId) {
        return res.status(400).json({ error: 'sessionId and serverId are required' });
      }
      const updated = whatsappManager.switchSessionServer(
        sessionId,
        serverId,
        ownerToken,
        clientId
      );
      if (!updated) {
        return res.status(403).json({ error: 'Unauthorized: You can only control your own session' });
      }
      res.json({
        session: updated,
        sessions: whatsappManager.getUserSessionsSummary(ownerToken, clientId),
        servers: whatsappManager.getClusterServersSummary(),
      });
    } catch (e: any) {
      res.status(500).json({ error: e?.message || 'Failed to switch server' });
    }
  });

  app.post('/api/sessions/reconnect', async (req, res) => {
    try {
      const { sessionId, ownerToken, clientId } = req.body || {};
      if (!sessionId) {
        return res.status(400).json({ error: 'sessionId is required' });
      }
      const updated = await whatsappManager.reconnectSessionById(sessionId, ownerToken, clientId);
      if (!updated) {
        return res.status(403).json({ error: 'Unauthorized: You can only control your own session' });
      }
      res.json({
        session: updated,
        sessions: whatsappManager.getUserSessionsSummary(ownerToken, clientId),
        servers: whatsappManager.getClusterServersSummary(),
      });
    } catch (e: any) {
      res.status(500).json({ error: e?.message || 'Failed to reconnect session' });
    }
  });

  app.post('/api/sessions/disconnect', async (req, res) => {
    const { ownerToken, clientId } = req.body || {};
    res.json({
      ok: true,
      sessions: whatsappManager.getUserSessionsSummary(ownerToken, clientId),
      servers: whatsappManager.getClusterServersSummary(),
    });
  });

  const publicPath = path.join(process.cwd(), 'public');
  if (fs.existsSync(publicPath)) {
    app.use(express.static(publicPath));
  }

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (_req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }
  }

  const httpServer = app.listen(PORT, '0.0.0.0', () => {
    console.log(`🤖 X-IK AI Server running on http://localhost:${PORT}`);
    whatsappManager.init();

    // 24/7 Cloud Self-Guard: keeps all paired sessions healthy even when mobile data is off
    setInterval(() => {
      whatsappManager.ensureAllSessionsHealthy().catch(() => {});
    }, 15_000);
  });

  const handleShutdown = () => {
    try {
      whatsappManager.shutdownAllSockets();
      httpServer.close(() => process.exit(0));
      setTimeout(() => process.exit(0), 600);
    } catch {
      process.exit(0);
    }
  };
  process.once('SIGINT', handleShutdown);
  process.once('SIGTERM', handleShutdown);
}

startServer();
