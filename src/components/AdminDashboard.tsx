import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Shield,
  Activity,
  Bot,
  Terminal,
  Users,
  MessageSquare,
  Cpu,
  HardDrive,
  RefreshCw,
  Power,
  LogOut,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Radio,
  Search,
  Plus,
  Trash2,
  Lock,
  Unlock,
  Volume2,
  VolumeX,
  Sparkles,
  Zap,
  Globe,
  Download,
  Upload,
  Settings,
  ChevronRight,
  Menu,
  X,
  Copy,
  Check,
  ShieldCheck,
  Layers,
  Database,
  FileText,
  UserX,
  ExternalLink,
  Smartphone,
  Music,
  Play,
  Pause,
  ListMusic,
  Send,
  Megaphone,
  Server,
  Wifi,
  WifiOff,
  PowerOff,
} from 'lucide-react';
import type { AdminSessionInfo, ServerNodeSummary } from '../types';

interface AdminDashboardProps {
  token: string;
  onLogout: () => void;
  onExitToMain: () => void;
}

type TabType =
  | 'overview'
  | 'devices'
  | 'bot_control'
  | 'commands'
  | 'users'
  | 'groups'
  | 'ai_api'
  | 'media_dl'
  | 'website'
  | 'music'
  | 'logs'
  | 'database';

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  token,
  onLogout,
  onExitToMain,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [loading, setLoading] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Live Backend Data States
  const [overview, setOverview] = useState<any>(null);
  const [pairedDevices, setPairedDevices] = useState<AdminSessionInfo[]>([]);
  const [clusterServers, setClusterServers] = useState<ServerNodeSummary[]>([]);
  const [botSettings, setBotSettings] = useState<any>(null);
  const [commandsList, setCommandsList] = useState<any[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [groupsList, setGroupsList] = useState<any[]>([]);
  const [aiConfig, setAiConfig] = useState<any>(null);
  const [downloaderConfig, setDownloaderConfig] = useState<any>(null);
  const [websiteConfig, setWebsiteConfig] = useState<any>(null);
  const [logsData, setLogsData] = useState<any>(null);
  const [dbData, setDbData] = useState<any>(null);

  // Paired Devices Fleet Control States
  const [deviceSearch, setDeviceSearch] = useState('');
  const [deviceStatusFilter, setDeviceStatusFilter] = useState<'all' | 'online' | 'paused' | 'offline'>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [msgModalSession, setMsgModalSession] = useState<AdminSessionInfo | null>(null);
  const [msgTarget, setMsgTarget] = useState('');
  const [msgBody, setMsgBody] = useState('');
  const [sendingMsg, setSendingMsg] = useState(false);
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [broadcastText, setBroadcastText] = useState('');
  const [broadcastScope, setBroadcastScope] = useState<'paired_owners' | 'recent_chats'>('paired_owners');
  const [broadcastSending, setBroadcastSending] = useState(false);

  // Form & Filter States
  const [commandSearch, setCommandSearch] = useState('');
  const [commandCategory, setCommandCategory] = useState('All');
  const [userSearch, setUserSearch] = useState('');
  const [customCmdName, setCustomCmdName] = useState('');
  const [customCmdResponse, setCustomCmdResponse] = useState('');
  const [customCmdCategory, setCustomCmdCategory] = useState('Custom');
  const [dpFileBase64, setDpFileBase64] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Website Cyber Music Playlist States
  const [musicList, setMusicList] = useState<any[]>([]);
  const [newSongTitle, setNewSongTitle] = useState('');
  const [newSongArtist, setNewSongArtist] = useState('');
  const [newSongCategory, setNewSongCategory] = useState('Cyber Phonk');
  const [adminAudioFileBase64, setAdminAudioFileBase64] = useState<string | null>(null);
  const [adminAudioFileName, setAdminAudioFileName] = useState('');
  const [adminCoverFileBase64, setAdminCoverFileBase64] = useState<string | null>(null);
  const adminAudioInputRef = useRef<HTMLInputElement>(null);
  const adminCoverInputRef = useRef<HTMLInputElement>(null);
  const [playingSongId, setPlayingSongId] = useState<string | null>(null);
  const adminAudioRef = useRef<HTMLAudioElement | null>(null);

  // Play Cyber Sound FX
  const playSfx = useCallback(
    (type: 'click' | 'success' | 'alert') => {
      if (!soundEnabled) return;
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        const t = ctx.currentTime;
        if (type === 'click') {
          osc.type = 'sine';
          osc.frequency.setValueAtTime(800, t);
          gain.gain.setValueAtTime(0.04, t);
          gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
          osc.start(t);
          osc.stop(t + 0.05);
        } else if (type === 'success') {
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(520, t);
          osc.frequency.exponentialRampToValueAtTime(880, t + 0.12);
          gain.gain.setValueAtTime(0.06, t);
          gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
          osc.start(t);
          osc.stop(t + 0.15);
        } else {
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(320, t);
          gain.gain.setValueAtTime(0.05, t);
          gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
          osc.start(t);
          osc.stop(t + 0.18);
        }
      } catch {
        // ignore audio errors
      }
    },
    [soundEnabled]
  );

  const notify = (msg: string, isError = false) => {
    if (isError) {
      setActionError(msg);
      playSfx('alert');
      setTimeout(() => setActionError(null), 4000);
    } else {
      setActionSuccess(msg);
      playSfx('success');
      setTimeout(() => setActionSuccess(null), 3500);
    }
  };

  // Helper fetch with Admin Auth headers
  const adminFetch = useCallback(
    async (url: string, options: RequestInit = {}) => {
      const headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'x-admin-token': token,
        ...(options.headers || {}),
      };
      const res = await fetch(url, { ...options, headers });
      if (res.status === 401) {
        onLogout();
        throw new Error('Unauthorized');
      }
      return res;
    },
    [token, onLogout]
  );

  // 1. Fetch Overview & Paired Fleet (Polls every 6 seconds for real-time stats)
  const fetchOverview = useCallback(async () => {
    try {
      const res = await adminFetch('/api/admin/overview');
      if (res.ok) {
        const data = await res.json();
        setOverview(data);
        if (Array.isArray(data.pairedDevices)) {
          setPairedDevices(data.pairedDevices);
        }
        if (Array.isArray(data.clusterServers)) {
          setClusterServers(data.clusterServers);
        }
      }
    } catch {
      // ignore
    }
  }, [adminFetch]);

  useEffect(() => {
    fetchOverview();
    const iv = setInterval(fetchOverview, 6000);
    return () => clearInterval(iv);
  }, [fetchOverview]);

  // 2. Fetch specific tab data on tab change
  const loadTabData = useCallback(
    async (tab: TabType) => {
      setLoading(true);
      try {
        if (tab === 'devices') {
          const res = await adminFetch('/api/admin/sessions');
          const d = await res.json();
          setPairedDevices(d.sessions || []);
          setClusterServers(d.clusterServers || []);
        } else if (tab === 'bot_control') {
          const res = await adminFetch('/api/admin/bot/settings');
          const d = await res.json();
          setBotSettings(d.settings);
        } else if (tab === 'commands') {
          const res = await adminFetch('/api/admin/commands');
          const d = await res.json();
          setCommandsList(d.commands || []);
        } else if (tab === 'users') {
          const res = await adminFetch('/api/admin/users');
          const d = await res.json();
          setUsersList(d.users || []);
        } else if (tab === 'groups') {
          const res = await adminFetch('/api/admin/groups');
          const d = await res.json();
          setGroupsList(d.groups || []);
        } else if (tab === 'ai_api') {
          const res = await adminFetch('/api/admin/ai');
          const d = await res.json();
          setAiConfig(d.ai);
        } else if (tab === 'media_dl') {
          const res = await adminFetch('/api/admin/downloader');
          const d = await res.json();
          setDownloaderConfig(d.downloader);
        } else if (tab === 'website') {
          const res = await adminFetch('/api/admin/website');
          const d = await res.json();
          setWebsiteConfig(d.website);
        } else if (tab === 'music') {
          const res = await adminFetch('/api/admin/music');
          const d = await res.json();
          setMusicList(d.songs || []);
        } else if (tab === 'logs') {
          const res = await adminFetch('/api/admin/logs');
          const d = await res.json();
          setLogsData(d);
        } else if (tab === 'database') {
          const res = await adminFetch('/api/admin/database');
          const d = await res.json();
          setDbData(d.database);
        }
      } catch (err: any) {
        notify(err?.message || 'Failed to load section data', true);
      } finally {
        setLoading(false);
      }
    },
    [adminFetch]
  );

  // Copy text helper
  const handleCopyText = (id: string, value: string) => {
    if (!value) return;
    navigator.clipboard?.writeText(value).catch(() => {});
    setCopiedId(id);
    playSfx('click');
    setTimeout(() => setCopiedId((prev) => (prev === id ? null : prev)), 1500);
  };

  // Paired Devices Fleet Actions
  const handleDeviceAction = async (
    sessionId: string,
    action: 'pause' | 'resume' | 'reconnect' | 'switch_server' | 'unpair',
    serverId?: string,
    label?: string
  ) => {
    if (
      action === 'unpair' &&
      !confirm(`Unpair & remove WhatsApp session ${label || sessionId}? The user will need to pair again.`)
    ) {
      return;
    }
    playSfx(action === 'unpair' ? 'alert' : 'click');
    setLoading(true);
    try {
      const res = await adminFetch('/api/admin/sessions/action', {
        method: 'POST',
        body: JSON.stringify({ sessionId, action, serverId }),
      });
      const d = await res.json();
      if (res.ok) {
        notify(d.message || `Session action ${action} completed.`);
        await fetchOverview();
        if (activeTab === 'devices') {
          await loadTabData('devices');
        }
      } else {
        notify(d.error || 'Session action failed', true);
      }
    } catch (err: any) {
      notify(err?.message || 'Failed to run session action', true);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenSendMessage = (device: AdminSessionInfo) => {
    playSfx('click');
    setMsgModalSession(device);
    const defaultPhone = (device.pairedOwnerNumber || device.connectedPhone || '').replace(/[^0-9]/g, '');
    setMsgTarget(defaultPhone);
    setMsgBody('');
  };

  const handleDispatchDirectMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!msgModalSession || !msgTarget.trim() || !msgBody.trim()) return;
    setSendingMsg(true);
    playSfx('click');
    try {
      const res = await adminFetch('/api/admin/sessions/action', {
        method: 'POST',
        body: JSON.stringify({
          sessionId: msgModalSession.sessionId,
          action: 'send_message',
          target: msgTarget.trim(),
          message: msgBody.trim(),
        }),
      });
      const d = await res.json();
      if (res.ok) {
        notify(d.message || 'Direct WhatsApp message dispatched!');
        setMsgModalSession(null);
        setMsgBody('');
      } else {
        notify(d.error || 'Failed to dispatch message', true);
      }
    } catch (err: any) {
      notify(err?.message || 'Dispatch failed', true);
    } finally {
      setSendingMsg(false);
    }
  };

  const handleAdminBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastText.trim()) return;
    setBroadcastSending(true);
    playSfx('click');
    try {
      const res = await adminFetch('/api/admin/broadcast', {
        method: 'POST',
        body: JSON.stringify({
          message: broadcastText.trim(),
          scope: broadcastScope,
        }),
      });
      const d = await res.json();
      if (res.ok) {
        notify(d.message || `Broadcast sent to ${d.sentCount} device(s).`);
        setBroadcastText('');
        setBroadcastOpen(false);
      } else {
        notify(d.error || 'Broadcast failed', true);
      }
    } catch (err: any) {
      notify(err?.message || 'Broadcast error', true);
    } finally {
      setBroadcastSending(false);
    }
  };

  // Music handlers for Admin Panel
  const handleAdminAudioSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAdminAudioFileName(file.name);
    if (!newSongTitle.trim()) {
      const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
      setNewSongTitle(cleanName);
    }
    const reader = new FileReader();
    reader.onload = () => {
      setAdminAudioFileBase64(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleAdminCoverSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setAdminCoverFileBase64(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleAddSong = async () => {
    if (!newSongTitle.trim()) {
      notify('Please enter a track title.', true);
      return;
    }
    if (!adminAudioFileBase64) {
      notify('Please choose an audio file from your device.', true);
      return;
    }
    playSfx('click');
    setLoading(true);
    try {
      const res = await adminFetch('/api/admin/music/add', {
        method: 'POST',
        body: JSON.stringify({
          title: newSongTitle.trim(),
          artist: newSongArtist.trim() || 'SUFYAN-X-IK Beats',
          audioBase64: adminAudioFileBase64,
          coverBase64: adminCoverFileBase64 || undefined,
          category: newSongCategory.trim() || 'Cyber Phonk',
        }),
      });
      const d = await res.json();
      if (res.ok) {
        notify('Track uploaded & added to website deck successfully!');
        setNewSongTitle('');
        setNewSongArtist('');
        setAdminAudioFileBase64(null);
        setAdminAudioFileName('');
        setAdminCoverFileBase64(null);
        if (adminAudioInputRef.current) adminAudioInputRef.current.value = '';
        if (adminCoverInputRef.current) adminCoverInputRef.current.value = '';
        loadTabData('music');
      } else {
        notify(d.error || 'Failed to add song', true);
      }
    } catch (err: any) {
      notify(err?.message || 'Error adding song', true);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSong = async (id: string, title: string) => {
    playSfx('alert');
    try {
      const res = await adminFetch(`/api/admin/music/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        notify(`Song "${title}" deleted permanently.`);
        if (playingSongId === id && adminAudioRef.current) {
          adminAudioRef.current.pause();
          setPlayingSongId(null);
        }
        loadTabData('music');
      } else {
        notify('Failed to delete song', true);
      }
    } catch (err: any) {
      notify(err?.message || 'Error deleting song', true);
    }
  };

  const toggleAdminAudioPreview = (song: any) => {
    if (playingSongId === song.id) {
      adminAudioRef.current?.pause();
      setPlayingSongId(null);
    } else {
      if (adminAudioRef.current) {
        adminAudioRef.current.pause();
      }
      const audio = new Audio(song.audioUrl);
      adminAudioRef.current = audio;
      audio.play().then(() => {
        setPlayingSongId(song.id);
      }).catch(() => {
        notify('Audio preview could not play. Please verify the audio file.', true);
        setPlayingSongId(null);
      });
      audio.onended = () => setPlayingSongId(null);
    }
  };

  useEffect(() => {
    loadTabData(activeTab);
  }, [activeTab, loadTabData]);

  // Handler: Bot Actions (restart, disconnect, mode)
  const handleBotAction = async (action: string, payload?: any) => {
    playSfx('click');
    setLoading(true);
    try {
      const res = await adminFetch('/api/admin/bot/action', {
        method: 'POST',
        body: JSON.stringify({ action, payload }),
      });
      const d = await res.json();
      if (res.ok) {
        notify(d.message || `Action ${action.toUpperCase()} executed successfully!`);
        fetchOverview();
        loadTabData(activeTab);
      } else {
        notify(d.error || 'Action failed', true);
      }
    } catch {
      notify('Network error', true);
    } finally {
      setLoading(false);
    }
  };

  // Handler: Update Bot Settings
  const handleUpdateBotSettings = async (patch: any) => {
    playSfx('click');
    setLoading(true);
    try {
      const res = await adminFetch('/api/admin/bot/settings', {
        method: 'POST',
        body: JSON.stringify(patch),
      });
      const d = await res.json();
      if (res.ok) {
        setBotSettings(d.settings);
        notify('Bot configurations updated and synchronized live!');
        fetchOverview();
      } else {
        notify(d.error || 'Failed to update settings', true);
      }
    } catch {
      notify('Network error', true);
    } finally {
      setLoading(false);
    }
  };

  // Handler: Command Toggle
  const handleToggleCommand = async (cmdName: string, currentEnabled: boolean) => {
    playSfx('click');
    try {
      const res = await adminFetch('/api/admin/commands/toggle', {
        method: 'POST',
        body: JSON.stringify({ command: cmdName, enabled: !currentEnabled }),
      });
      if (res.ok) {
        setCommandsList((prev) =>
          prev.map((c) => (c.name === cmdName ? { ...c, enabled: !currentEnabled } : c))
        );
        notify(`Command .${cmdName} ${!currentEnabled ? 'enabled' : 'disabled'}`);
      }
    } catch {
      notify('Failed to toggle command', true);
    }
  };

  // Handler: Add Custom Command
  const handleAddCustomCommand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customCmdName.trim() || !customCmdResponse.trim()) return;
    playSfx('click');
    try {
      const res = await adminFetch('/api/admin/commands/custom/add', {
        method: 'POST',
        body: JSON.stringify({
          name: customCmdName.trim(),
          response: customCmdResponse.trim(),
          category: customCmdCategory,
        }),
      });
      const d = await res.json();
      if (res.ok) {
        notify(`Custom command .${d.command.name} activated!`);
        setCustomCmdName('');
        setCustomCmdResponse('');
        loadTabData('commands');
      } else {
        notify(d.error || 'Failed to add custom command', true);
      }
    } catch {
      notify('Error adding custom command', true);
    }
  };

  // Handler: Delete Custom Command
  const handleDeleteCustomCommand = async (nameOrId: string) => {
    playSfx('click');
    if (!confirm(`Are you sure you want to delete custom command .${nameOrId}?`)) return;
    try {
      const res = await adminFetch('/api/admin/commands/custom/delete', {
        method: 'POST',
        body: JSON.stringify({ nameOrId }),
      });
      if (res.ok) {
        notify(`Custom command .${nameOrId} deleted`);
        loadTabData('commands');
      }
    } catch {
      notify('Delete failed', true);
    }
  };

  // Handler: User Action (ban, unban, block)
  const handleUserAction = async (jidOrPhone: string, action: string, role?: string) => {
    playSfx('click');
    try {
      const res = await adminFetch('/api/admin/users/action', {
        method: 'POST',
        body: JSON.stringify({ jidOrPhone, action, role }),
      });
      const d = await res.json();
      if (res.ok) {
        notify(`User action ${action} executed successfully`);
        loadTabData('users');
      } else {
        notify(d.error || 'Action failed', true);
      }
    } catch {
      notify('User action error', true);
    }
  };

  // Handler: Group Antilink/Antispam Toggle
  const handleToggleGroupSecurity = async (groupJid: string, key: string, currentVal: boolean) => {
    playSfx('click');
    try {
      const res = await adminFetch('/api/admin/groups/config', {
        method: 'POST',
        body: JSON.stringify({
          groupJid,
          patch: { [key]: !currentVal },
        }),
      });
      if (res.ok) {
        notify(`Group ${key} set to ${!currentVal ? 'ON' : 'OFF'}`);
        loadTabData('groups');
      }
    } catch {
      notify('Failed to update group', true);
    }
  };

  // Handler: Group Leave
  const handleLeaveGroup = async (groupJid: string, sessionId?: string) => {
    playSfx('alert');
    if (!confirm(`Are you sure you want the bot to LEAVE this group?`)) return;
    try {
      const res = await adminFetch('/api/admin/groups/leave', {
        method: 'POST',
        body: JSON.stringify({ groupJid, sessionId }),
      });
      const d = await res.json();
      if (res.ok) {
        notify(`Bot has left the group: ${groupJid}`);
        loadTabData('groups');
      } else {
        notify(d.error || 'Failed to leave group', true);
      }
    } catch {
      notify('Error leaving group', true);
    }
  };

  // Handler: Profile Picture Upload
  const handleProfilePictureUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    playSfx('click');
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      setDpFileBase64(base64);
      setLoading(true);
      try {
        const res = await adminFetch('/api/admin/bot/profile-picture', {
          method: 'POST',
          body: JSON.stringify({ base64Data: base64 }),
        });
        const d = await res.json();
        if (res.ok) {
          notify('Bot WhatsApp profile picture updated live!');
        } else {
          notify(d.error || 'Failed to update profile photo', true);
        }
      } catch {
        notify('Network error uploading profile photo', true);
      } finally {
        setLoading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  // Handler: Database Backup
  const handleCreateBackup = async () => {
    playSfx('click');
    setLoading(true);
    try {
      const res = await adminFetch('/api/admin/database/backup', { method: 'POST' });
      const d = await res.json();
      if (res.ok) {
        notify(`Database snapshot ${d.backup.filename} created!`);
        loadTabData('database');
      } else {
        notify(d.error || 'Backup creation failed', true);
      }
    } catch {
      notify('Backup error', true);
    } finally {
      setLoading(false);
    }
  };

  // Handler: Database Restore
  const handleRestoreBackup = async (filename: string) => {
    playSfx('alert');
    if (!confirm(`WARNING: Restore database snapshot from ${filename}? Current state will be replaced.`)) {
      return;
    }
    setLoading(true);
    try {
      const res = await adminFetch('/api/admin/database/restore', {
        method: 'POST',
        body: JSON.stringify({ filename }),
      });
      const d = await res.json();
      if (res.ok) {
        notify(`Database restored successfully from ${filename}!`);
        fetchOverview();
        loadTabData('database');
      } else {
        notify(d.error || 'Restore failed', true);
      }
    } catch {
      notify('Restore error', true);
    } finally {
      setLoading(false);
    }
  };

  // Filter commands
  const filteredCommands = commandsList.filter((cmd) => {
    const matchesSearch =
      cmd.name.toLowerCase().includes(commandSearch.toLowerCase()) ||
      cmd.description.toLowerCase().includes(commandSearch.toLowerCase());
    const matchesCategory =
      commandCategory === 'All' || cmd.category.toLowerCase().includes(commandCategory.toLowerCase());
    return matchesSearch && matchesCategory;
  });

  // Filter users
  const filteredUsers = usersList.filter((u) => {
    return (
      u.phone?.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.name?.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.jid?.toLowerCase().includes(userSearch.toLowerCase())
    );
  });

  const categories = ['All', 'AI', 'Downloader', 'Photo', 'Group', 'Cyber', 'Tools', 'Custom'];

  const filteredDevices = pairedDevices.filter((d) => {
    const q = deviceSearch.trim().toLowerCase();
    const matchesSearch =
      !q ||
      (d.connectedPhone || '').toLowerCase().includes(q) ||
      (d.connectedName || '').toLowerCase().includes(q) ||
      (d.sessionId || '').toLowerCase().includes(q) ||
      (d.pairedOwnerLid || '').toLowerCase().includes(q) ||
      (d.serverName || '').toLowerCase().includes(q);
    const matchesStatus =
      deviceStatusFilter === 'all'
        ? true
        : deviceStatusFilter === 'online'
        ? d.status === 'connected' && !d.paused
        : deviceStatusFilter === 'paused'
        ? d.paused
        : d.status !== 'connected';
    return matchesSearch && matchesStatus;
  });

  const formatDurationShort = (sec: number) => {
    const s = Math.max(0, Math.floor(sec || 0));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s % 60}s`;
    return `${s}s`;
  };

  const onlineFleetCount = pairedDevices.filter((d) => d.status === 'connected' && !d.paused).length;
  const pausedFleetCount = pairedDevices.filter((d) => d.paused).length;
  const totalFleetMsgs = pairedDevices.reduce((sum, d) => sum + (d.messagesProcessed || 0), 0);

  return (
    <div className="min-h-screen bg-[#060913] text-slate-100 flex flex-col font-sans selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Toast Notifications */}
      {actionSuccess && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2.5 px-4 py-3 rounded-lg bg-[#0a1322] border border-cyan-500/60 text-cyan-200 text-xs font-mono shadow-lg">
          <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}
      {actionError && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2.5 px-4 py-3 rounded-lg bg-[#1a0a10] border border-rose-500/70 text-rose-200 text-xs font-mono shadow-lg">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Top Ultra Pro Max Command Bar */}
      <header className="h-16 border-b border-slate-800/90 bg-[#080d1a]/95 backdrop-blur-md sticky top-0 z-40 px-4 sm:px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="md:hidden p-2 rounded-lg bg-slate-900 border border-slate-800 text-cyan-400 cursor-pointer"
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-slate-900 border border-cyan-500/40 flex items-center justify-center">
              <Bot className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <div className="flex items-center gap-2 text-xs">
                <span className="font-mono font-bold text-sm tracking-wide text-white">
                  SUFYAN-X-IK
                </span>
                <span className="text-slate-600">·</span>
                <span className="text-[11px] font-mono uppercase tracking-wider text-cyan-400">
                  SUPER ADMIN PRO MAX
                </span>
              </div>
              <span className="text-[11px] text-slate-400 hidden sm:inline">
                SAYRON MD Multi-Device Fleet &amp; Command Telemetry
              </span>
            </div>
          </div>
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Live Fleet Readout */}
          <button
            type="button"
            onClick={() => setActiveTab('devices')}
            className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-cyan-500/40 text-xs font-mono tabular-nums cursor-pointer transition-colors"
            title="View All Paired User Devices"
          >
            <span
              className={`w-2 h-2 rounded-full ${
                onlineFleetCount > 0 ? 'bg-emerald-400' : 'bg-amber-400'
              }`}
            />
            <span className="text-slate-300">
              {onlineFleetCount}/{pairedDevices.length} FLEET ONLINE
            </span>
          </button>

          {/* Sound Toggle */}
          <button
            type="button"
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-2 rounded-lg bg-slate-900 border border-slate-800 hover:border-cyan-500/40 text-slate-300 hover:text-cyan-400 transition-colors cursor-pointer"
            title={soundEnabled ? 'Mute Console SFX' : 'Enable Console SFX'}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-cyan-400" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
          </button>

          {/* Download Bot Source ZIP */}
          <a
            href={`/api/admin/download-source-zip?token=${encodeURIComponent(token)}`}
            download="SUFYAN-X-IK_MD_BOT_DEPLOYMENT.zip"
            onClick={() => playSfx('click')}
            title="Download Complete Bot Code ZIP (Railway & VPS Ready)"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-indigo-500/40 hover:border-indigo-400 text-indigo-200 text-xs font-mono font-medium transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-indigo-400" />
            <span className="hidden md:inline">Bot ZIP</span>
          </a>

          {/* Back to Public App */}
          <button
            type="button"
            onClick={onExitToMain}
            className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-600 text-xs font-mono text-slate-300 transition-colors cursor-pointer"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Website</span>
          </button>

          {/* Logout */}
          <button
            type="button"
            onClick={() => {
              playSfx('alert');
              onLogout();
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-950/50 border border-rose-500/30 hover:bg-rose-900/50 text-rose-300 text-xs font-mono transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </header>

      {/* Main Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar Navigation */}
        <aside
          className={`fixed inset-y-16 left-0 z-30 w-64 bg-[#080d1a] border-r border-slate-800/90 flex flex-col justify-between transition-transform duration-200 md:static md:translate-x-0 ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="p-3.5 space-y-1 overflow-y-auto max-h-[calc(100vh-128px)]">
            <div className="text-[10px] font-mono uppercase tracking-widest text-slate-500 px-3 py-1.5">
              Control Modules
            </div>

            {[
              { id: 'overview', label: 'Main Dashboard', icon: Activity },
              {
                id: 'devices',
                label: 'Paired Devices Fleet',
                icon: Smartphone,
                count: pairedDevices.length,
              },
              { id: 'bot_control', label: 'Bot Controller', icon: Bot },
              { id: 'commands', label: 'Command Manager', icon: Terminal },
              { id: 'users', label: 'User Directory', icon: Users },
              { id: 'groups', label: 'Group Control', icon: MessageSquare },
              { id: 'ai_api', label: 'AI & API Core', icon: Sparkles },
              { id: 'media_dl', label: 'Media & Download', icon: Download },
              { id: 'website', label: 'Website Settings', icon: Globe },
              { id: 'music', label: 'Website Cyber Music', icon: Music },
              { id: 'logs', label: 'Audit & Logs', icon: FileText },
              { id: 'database', label: 'Database & Backup', icon: Database },
            ].map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    playSfx('click');
                    setActiveTab(item.id as TabType);
                    setSidebarOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-cyan-500/12 border border-cyan-500/40 text-cyan-300 font-semibold'
                      : 'border border-transparent text-slate-400 hover:text-slate-100 hover:bg-slate-900/70'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-cyan-400' : 'text-slate-500'}`} />
                    <span className="truncate">{item.label}</span>
                  </div>
                  {typeof item.count === 'number' ? (
                    <span className="font-mono text-[11px] tabular-nums text-cyan-400">
                      {item.count}
                    </span>
                  ) : isActive ? (
                    <ChevronRight className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  ) : null}
                </button>
              );
            })}
          </div>

          {/* Bottom Cluster Status Footer */}
          <div className="p-4 border-t border-slate-800/80 bg-[#050811]">
            <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 mb-1.5">
              <span>FLEET NODES</span>
              <span className="text-emerald-400 font-semibold tabular-nums">
                {onlineFleetCount} LIVE · 10 CLUSTERS
              </span>
            </div>
            <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-cyan-400 h-full transition-all"
                style={{
                  width: `${
                    pairedDevices.length > 0
                      ? Math.max(12, Math.round((onlineFleetCount / pairedDevices.length) * 100))
                      : 100
                  }%`,
                }}
              />
            </div>
            <div className="mt-2 text-[10px] font-mono text-slate-500 flex items-center justify-between">
              <span>SUFYAN-X-IK PRO MAX</span>
              <span className="tabular-nums">{overview?.system?.nodeVersion || 'v20'}</span>
            </div>
          </div>
        </aside>

        {/* Main Dynamic Content Area */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto w-full">
          {/* ========================================================================= */}
          {/* TAB 1: OVERVIEW / MAIN DASHBOARD */}
          {/* ========================================================================= */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Hero Command Summary + Live Monitor */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                <div className="lg:col-span-2 rounded-xl bg-[#0b111e] border border-slate-800/90 p-6 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-wider text-cyan-400 mb-2">
                      <Zap className="w-3.5 h-3.5" />
                      <span>24/7 MULTI-DEVICE COMMAND CENTER · {pairedDevices.length} PAIRED USERS</span>
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                      Commander{' '}
                      <span className="text-cyan-400">SUFYAN-X-IK</span>
                    </h2>
                    <p className="text-sm text-slate-400 mt-1.5 max-w-xl leading-relaxed">
                      Real-time control across every WhatsApp device paired to SAYRON MD — inspect active phones,
                      switch cluster nodes, pause/unpair sessions, broadcast messages, and audit system metrics.
                    </p>
                  </div>

                  {/* Quick Actions */}
                  <div className="mt-6 pt-4 border-t border-slate-800/80 flex flex-wrap gap-2.5">
                    <button
                      type="button"
                      onClick={() => setActiveTab('devices')}
                      className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-mono font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Smartphone className="w-3.5 h-3.5" />
                      <span>Inspect Paired Fleet ({pairedDevices.length})</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleBotAction('restart')}
                      className="px-3.5 py-2 rounded-lg bg-slate-900 border border-slate-700 hover:border-cyan-500/50 text-slate-200 text-xs font-mono font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Restart All Nodes</span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        handleBotAction('set_mode', {
                          mode: overview?.stats?.maintenanceMode ? 'public' : 'maintenance',
                        })
                      }
                      className={`px-3.5 py-2 rounded-lg border text-xs font-mono font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                        overview?.stats?.maintenanceMode
                          ? 'bg-amber-500/15 border-amber-500/60 text-amber-300'
                          : 'bg-slate-900 border-slate-700 hover:border-slate-500 text-slate-300'
                      }`}
                    >
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>
                        {overview?.stats?.maintenanceMode
                          ? 'Maintenance: ON'
                          : 'Maintenance Mode'}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={fetchOverview}
                      className="px-3.5 py-2 rounded-lg bg-slate-900 border border-slate-700 hover:border-cyan-500/40 text-slate-300 text-xs font-mono flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Activity className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Sync Telemetry</span>
                    </button>
                  </div>
                </div>

                {/* Live Cyber Bot Video Monitor */}
                <div className="lg:col-span-1 rounded-xl overflow-hidden border border-slate-800/90 bg-black flex flex-col justify-between relative">
                  <div className="relative aspect-[16/10] sm:aspect-auto sm:h-[220px] w-full overflow-hidden">
                    <video
                      autoPlay
                      loop
                      muted
                      playsInline
                      poster="/sayron_md_banner.gif"
                      className="w-full h-full object-cover block"
                    >
                      <source src="/sayron_md_menu_gif.mp4" type="video/mp4" />
                      <img
                        src="/sayron_md_banner.gif"
                        alt="SAYRON MD Live Bot Banner"
                        className="w-full h-full object-cover"
                      />
                    </video>
                    <div className="absolute inset-0 bg-gradient-to-t from-[#060913] via-transparent to-black/50 pointer-events-none" />
                    <div className="absolute top-3 left-3 pointer-events-none text-[10px] font-mono font-semibold text-slate-200 bg-black/75 px-2.5 py-1 rounded border border-slate-700/80 flex items-center gap-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full ${onlineFleetCount > 0 ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                      <span>SAYRON MD CORE · {onlineFleetCount > 0 ? 'LIVE' : 'STANDBY'}</span>
                    </div>
                    <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-[11px] font-mono pointer-events-none">
                      <span className="text-emerald-300 font-semibold tabular-nums">
                        {onlineFleetCount} Active Socket(s)
                      </span>
                      <span className="text-slate-300">SUFYAN-X-IK</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 4 Key KPI Metrics */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  {
                    label: 'PAIRED USER DEVICES',
                    value: `${onlineFleetCount} / ${pairedDevices.length}`,
                    sub: `${pausedFleetCount} Paused · 10 Cluster Nodes`,
                    icon: Smartphone,
                    color: 'text-cyan-400',
                    onClick: () => setActiveTab('devices'),
                  },
                  {
                    label: 'TOTAL USERS SEEN',
                    value: (overview?.stats?.totalUsers || 1).toLocaleString(),
                    sub: 'Unique WhatsApp Contacts',
                    icon: Users,
                    color: 'text-indigo-400',
                    onClick: () => setActiveTab('users'),
                  },
                  {
                    label: 'CONNECTED GROUPS',
                    value: (overview?.stats?.totalGroups || 0).toLocaleString(),
                    sub: 'Across All Paired Bots',
                    icon: MessageSquare,
                    color: 'text-emerald-400',
                    onClick: () => setActiveTab('groups'),
                  },
                  {
                    label: 'FLEET TRAFFIC & CMDS',
                    value: Math.max(
                      overview?.stats?.messagesReceived || 0,
                      totalFleetMsgs
                    ).toLocaleString(),
                    sub: `${(overview?.stats?.commandsExecuted || 0).toLocaleString()} Commands Executed`,
                    icon: Layers,
                    color: 'text-amber-400',
                    onClick: () => setActiveTab('logs'),
                  },
                ].map((stat, idx) => {
                  const Icon = stat.icon;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={stat.onClick}
                      className="text-left p-4 rounded-xl bg-[#0b111e] border border-slate-800/90 hover:border-slate-700 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">
                          {stat.label}
                        </span>
                        <Icon className={`w-4 h-4 ${stat.color}`} />
                      </div>
                      <div className="text-2xl sm:text-3xl font-bold font-mono tabular-nums tracking-tight text-white">
                        {stat.value}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-1">{stat.sub}</div>
                    </button>
                  );
                })}
              </div>

              {/* Live Paired User Devices Fleet Preview */}
              <div className="rounded-xl bg-[#0b111e] border border-slate-800/90 overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <Smartphone className="w-4 h-4 text-cyan-400" />
                      <h3 className="text-sm font-semibold text-white">
                        Live Paired User Devices Fleet
                      </h3>
                      <span className="text-[11px] font-mono text-slate-400 tabular-nums">
                        ({pairedDevices.length} registered)
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Every user currently pairing or running SAYRON MD on their WhatsApp number.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('devices')}
                    className="text-xs font-mono text-cyan-400 hover:text-cyan-300 flex items-center gap-1 cursor-pointer self-start sm:self-center"
                  >
                    <span>Manage All Devices &amp; Send Messages</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {pairedDevices.length === 0 ? (
                  <div className="p-8 text-center text-xs font-mono text-slate-500">
                    No user devices paired yet. When users connect via Pairing Code or QR on the website, their sessions appear live here.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-800/70">
                    {pairedDevices.slice(0, 6).map((dev) => {
                      const isOnline = dev.status === 'connected' && !dev.paused;
                      return (
                        <div
                          key={dev.sessionId}
                          className="px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-900/50 transition-colors"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-9 h-9 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center font-mono font-bold text-xs text-cyan-300 shrink-0">
                              {(dev.connectedName || 'U')[0]?.toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold text-sm text-white truncate">
                                  {dev.connectedName || 'SAYRON MD User'}
                                </span>
                                <span className="font-mono text-xs text-cyan-400 tabular-nums">
                                  {dev.connectedPhone}
                                </span>
                                <span className="text-slate-600">·</span>
                                <span
                                  className={`inline-flex items-center gap-1.5 text-[11px] font-mono font-semibold uppercase ${
                                    isOnline
                                      ? 'text-emerald-400'
                                      : dev.paused
                                      ? 'text-amber-400'
                                      : 'text-slate-400'
                                  }`}
                                >
                                  <span
                                    className={`w-1.5 h-1.5 rounded-full ${
                                      isOnline
                                        ? 'bg-emerald-400'
                                        : dev.paused
                                        ? 'bg-amber-400'
                                        : 'bg-slate-500'
                                    }`}
                                  />
                                  {isOnline ? 'Online' : dev.paused ? 'Paused' : dev.status}
                                </span>
                              </div>
                              <div className="text-[11px] font-mono text-slate-400 mt-0.5 truncate tabular-nums">
                                {dev.serverName} · {(dev.messagesProcessed || 0).toLocaleString()} msgs · Uptime {formatDurationShort(dev.uptimeSeconds)}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleOpenSendMessage(dev)}
                              disabled={dev.status !== 'connected'}
                              className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 hover:border-cyan-500/50 text-xs font-mono text-slate-200 disabled:opacity-40 cursor-pointer flex items-center gap-1"
                            >
                              <Send className="w-3 h-3 text-cyan-400" />
                              <span>Msg</span>
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                handleDeviceAction(dev.sessionId, dev.paused ? 'resume' : 'pause')
                              }
                              className={`px-2.5 py-1.5 rounded-lg border text-xs font-mono cursor-pointer ${
                                dev.paused
                                  ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                                  : 'bg-slate-900 border-slate-700 text-amber-300 hover:border-amber-500/40'
                              }`}
                            >
                              {dev.paused ? 'Resume' : 'Pause'}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* System Performance & Hardware Load */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Hardware Telemetry */}
                <div className="p-5 rounded-xl bg-[#0b111e] border border-slate-800/90">
                  <div className="flex items-center justify-between mb-4 border-b border-slate-800/80 pb-3">
                    <div className="flex items-center gap-2">
                      <Cpu className="w-4 h-4 text-cyan-400" />
                      <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-200">
                        Node Hardware Telemetry
                      </span>
                    </div>
                    <span className="text-[11px] font-mono text-emerald-400 uppercase">
                      Healthy · Online
                    </span>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between text-xs font-mono mb-1.5 tabular-nums">
                        <span className="text-slate-400">RAM Memory Used</span>
                        <span className="text-cyan-300 font-semibold">
                          {overview?.system?.ramUsedMb || 120} MB / {overview?.system?.ramTotalMb || 2048} MB
                        </span>
                      </div>
                      <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
                        <div
                          className="bg-cyan-400 h-full rounded-full transition-all"
                          style={{ width: `${overview?.system?.ramPercent || 35}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex justify-between text-xs font-mono tabular-nums">
                      <span className="text-slate-400">Process Uptime</span>
                      <span className="text-slate-200 font-semibold">
                        {formatDurationShort(overview?.bot?.uptimeSeconds || 60)}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-1 text-xs font-mono">
                      <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800/80">
                        <span className="text-[10px] text-slate-400 block">CPU ARCH</span>
                        <span className="text-slate-200 font-semibold">{overview?.system?.platform}</span>
                      </div>
                      <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800/80">
                        <span className="text-[10px] text-slate-400 block">NODE RUNTIME</span>
                        <span className="text-slate-200 font-semibold">{overview?.system?.nodeVersion}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Live Activity & Security Audit Snippet */}
                <div className="p-5 rounded-xl bg-[#0b111e] border border-slate-800/90">
                  <div className="flex items-center justify-between mb-4 border-b border-slate-800/80 pb-3">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-indigo-400" />
                      <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-200">
                        Recent Admin &amp; Security Events
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTab('logs')}
                      className="text-[11px] font-mono text-cyan-400 hover:underline cursor-pointer"
                    >
                      View All →
                    </button>
                  </div>

                  <div className="space-y-2 overflow-hidden">
                    {(overview?.recentAudit || []).slice(0, 5).map((audit: any) => (
                      <div
                        key={audit.id}
                        className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800/70 flex items-center justify-between text-xs font-mono"
                      >
                        <div className="flex items-center gap-2 truncate">
                          <span
                            className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                              audit.status === 'SUCCESS' ? 'bg-emerald-400' : 'bg-amber-400'
                            }`}
                          />
                          <span className="text-cyan-300 font-semibold shrink-0">{audit.action}</span>
                          <span className="text-slate-400 truncate">{audit.details}</span>
                        </div>
                        <span className="text-[10px] text-slate-500 shrink-0 ml-2 tabular-nums">
                          {new Date(audit.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 1B: PAIRED USER DEVICES FLEET (ULTRA PRO MAX) */}
          {/* ========================================================================= */}
          {activeTab === 'devices' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
                <div>
                  <h3 className="text-xl font-bold text-white flex items-center gap-2">
                    <Smartphone className="w-5 h-5 text-cyan-400" />
                    <span>Paired User Devices Fleet &amp; Cluster Command</span>
                  </h3>
                  <p className="text-xs font-mono text-slate-400 mt-1">
                    Monitor every WhatsApp device using SAYRON MD, move users across server nodes, pause/resume, or message directly.
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => {
                      playSfx('click');
                      setBroadcastOpen(!broadcastOpen);
                    }}
                    className="px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-mono font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Megaphone className="w-3.5 h-3.5" />
                    <span>Admin Broadcast</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => loadTabData('devices')}
                    className="px-3.5 py-2 rounded-lg bg-slate-900 border border-slate-700 hover:border-cyan-500/50 text-slate-200 text-xs font-mono flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${loading ? 'animate-spin' : ''}`} />
                    <span>Refresh Fleet</span>
                  </button>
                </div>
              </div>

              {/* Fleet KPI Strip */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl bg-[#0b111e] border border-slate-800/90">
                  <span className="text-[11px] font-mono text-slate-400 uppercase">ONLINE DEVICES</span>
                  <div className="text-2xl font-bold font-mono tabular-nums text-emerald-400 mt-1">
                    {onlineFleetCount}
                  </div>
                  <span className="text-[11px] text-slate-500">Live connected sockets</span>
                </div>
                <div className="p-4 rounded-xl bg-[#0b111e] border border-slate-800/90">
                  <span className="text-[11px] font-mono text-slate-400 uppercase">TOTAL PAIRED FLEET</span>
                  <div className="text-2xl font-bold font-mono tabular-nums text-white mt-1">
                    {pairedDevices.length}
                  </div>
                  <span className="text-[11px] text-slate-500">All user sessions on disk</span>
                </div>
                <div className="p-4 rounded-xl bg-[#0b111e] border border-slate-800/90">
                  <span className="text-[11px] font-mono text-slate-400 uppercase">PAUSED / STANDBY</span>
                  <div className="text-2xl font-bold font-mono tabular-nums text-amber-400 mt-1">
                    {pausedFleetCount}
                  </div>
                  <span className="text-[11px] text-slate-500">Temporarily held by admin</span>
                </div>
                <div className="p-4 rounded-xl bg-[#0b111e] border border-slate-800/90">
                  <span className="text-[11px] font-mono text-slate-400 uppercase">FLEET MESSAGES</span>
                  <div className="text-2xl font-bold font-mono tabular-nums text-cyan-400 mt-1">
                    {totalFleetMsgs.toLocaleString()}
                  </div>
                  <span className="text-[11px] text-slate-500">Messages handled across devices</span>
                </div>
              </div>

              {/* Global Broadcast Panel (Expandable) */}
              {broadcastOpen && (
                <form
                  onSubmit={handleAdminBroadcast}
                  className="p-5 rounded-xl bg-[#0b111e] border border-indigo-500/40 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm font-semibold text-white">
                      <Megaphone className="w-4 h-4 text-indigo-400" />
                      <span>Send Global Admin Broadcast</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setBroadcastOpen(false)}
                      className="text-slate-400 hover:text-white cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <select
                      value={broadcastScope}
                      onChange={(e) => setBroadcastScope(e.target.value as 'paired_owners' | 'recent_chats')}
                      className="px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs font-mono text-slate-200 outline-none focus:border-indigo-400"
                    >
                      <option value="paired_owners">All Paired User Owners ({onlineFleetCount} online)</option>
                      <option value="recent_chats">Recent Active Chats (Up to 30)</option>
                    </select>
                    <input
                      type="text"
                      placeholder="Write broadcast announcement for WhatsApp..."
                      value={broadcastText}
                      onChange={(e) => setBroadcastText(e.target.value)}
                      className="sm:col-span-2 px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs font-mono text-slate-100 outline-none focus:border-indigo-400"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="submit"
                      disabled={broadcastSending || !broadcastText.trim()}
                      className="px-4 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-mono font-bold disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{broadcastSending ? 'Dispatching...' : 'Dispatch Broadcast'}</span>
                    </button>
                  </div>
                </form>
              )}

              {/* Inline Direct Message Modal / Card */}
              {msgModalSession && (
                <form
                  onSubmit={handleDispatchDirectMessage}
                  className="p-5 rounded-xl bg-[#0b111e] border border-cyan-500/50 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-semibold text-white flex items-center gap-2">
                        <Send className="w-4 h-4 text-cyan-400" />
                        <span>
                          Send WhatsApp Message via {msgModalSession.connectedPhone} ({msgModalSession.connectedName})
                        </span>
                      </div>
                      <p className="text-[11px] font-mono text-slate-400 mt-0.5">
                        Session: {msgModalSession.sessionId} · Enter target phone digits or group JID
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setMsgModalSession(null)}
                      className="text-slate-400 hover:text-white cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <input
                      type="text"
                      placeholder="Recipient phone (e.g. 923001234567) or JID"
                      value={msgTarget}
                      onChange={(e) => setMsgTarget(e.target.value)}
                      className="px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs font-mono text-cyan-300 outline-none focus:border-cyan-400"
                    />
                    <input
                      type="text"
                      placeholder="Message content..."
                      value={msgBody}
                      onChange={(e) => setMsgBody(e.target.value)}
                      className="sm:col-span-2 px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs font-mono text-slate-100 outline-none focus:border-cyan-400"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setMsgModalSession(null)}
                      className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs font-mono text-slate-300 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={sendingMsg || !msgTarget.trim() || !msgBody.trim()}
                      className="px-4 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-mono font-bold disabled:opacity-50 cursor-pointer"
                    >
                      {sendingMsg ? 'Sending...' : 'Send via Device Socket'}
                    </button>
                  </div>
                </form>
              )}

              {/* Search & Filter Toolbar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="relative flex-1 max-w-md">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search phone number, WhatsApp name, session ID, LID..."
                    value={deviceSearch}
                    onChange={(e) => setDeviceSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 rounded-lg bg-[#0b111e] border border-slate-800 text-xs font-mono text-slate-100 placeholder-slate-500 outline-none focus:border-cyan-500"
                  />
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  {(['all', 'online', 'paused', 'offline'] as const).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => {
                        playSfx('click');
                        setDeviceStatusFilter(st);
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-mono uppercase transition-colors cursor-pointer ${
                        deviceStatusFilter === st
                          ? 'bg-cyan-500 text-slate-950 font-bold'
                          : 'bg-[#0b111e] border border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              {/* Paired Devices Table / Fleet List */}
              <div className="rounded-xl bg-[#0b111e] border border-slate-800/90 overflow-hidden">
                <div className="px-4 py-3 bg-slate-950/70 border-b border-slate-800 flex items-center justify-between text-[11px] font-mono text-slate-400 uppercase tracking-wider">
                  <span>SHOWING {filteredDevices.length} OF {pairedDevices.length} PAIRED DEVICES</span>
                  <span>NODE ASSIGNMENT &amp; CONTROLS</span>
                </div>

                {filteredDevices.length === 0 ? (
                  <div className="p-10 text-center space-y-2">
                    <Smartphone className="w-8 h-8 text-slate-600 mx-auto" />
                    <p className="text-xs font-mono text-slate-400">
                      No paired WhatsApp devices match the current filter.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-800/80">
                    {filteredDevices.map((dev) => {
                      const isOnline = dev.status === 'connected' && !dev.paused;
                      return (
                        <div
                          key={dev.sessionId}
                          className="p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-slate-900/40 transition-colors"
                        >
                          {/* Identity & Telemetry */}
                          <div className="flex items-start gap-3.5 min-w-0">
                            <div
                              className={`w-10 h-10 rounded-lg border flex items-center justify-center shrink-0 ${
                                isOnline
                                  ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-400'
                                  : dev.paused
                                  ? 'bg-amber-950/40 border-amber-500/40 text-amber-400'
                                  : 'bg-slate-900 border-slate-700 text-slate-500'
                              }`}
                            >
                              {isOnline ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
                            </div>

                            <div className="min-w-0 space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold text-sm text-white">
                                  {dev.connectedName || 'SAYRON MD User'}
                                </span>
                                <span className="font-mono text-xs text-cyan-400 font-semibold tabular-nums">
                                  {dev.connectedPhone}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleCopyText(dev.sessionId, dev.connectedPhone)}
                                  className="text-slate-500 hover:text-cyan-400 cursor-pointer"
                                  title="Copy phone number"
                                >
                                  {copiedId === dev.sessionId ? (
                                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                                  ) : (
                                    <Copy className="w-3.5 h-3.5" />
                                  )}
                                </button>
                                <span className="text-slate-600">·</span>
                                <span
                                  className={`text-[11px] font-mono font-bold uppercase ${
                                    isOnline
                                      ? 'text-emerald-400'
                                      : dev.paused
                                      ? 'text-amber-400'
                                      : 'text-rose-400'
                                  }`}
                                >
                                  {isOnline ? 'ONLINE' : dev.paused ? 'PAUSED' : dev.status.toUpperCase()}
                                </span>
                              </div>

                              <div className="flex items-center gap-2 flex-wrap text-[11px] font-mono text-slate-400 tabular-nums">
                                <span>ID: {dev.sessionId}</span>
                                {dev.pairedOwnerLid && (
                                  <>
                                    <span className="text-slate-600">·</span>
                                    <span>LID: {dev.pairedOwnerLid}</span>
                                  </>
                                )}
                                <span className="text-slate-600">·</span>
                                <span>{(dev.messagesProcessed || 0).toLocaleString()} msgs</span>
                                <span className="text-slate-600">·</span>
                                <span>Uptime {formatDurationShort(dev.uptimeSeconds)}</span>
                                <span className="text-slate-600">·</span>
                                <span>{dev.linkedClientsCount || 1} web token(s)</span>
                              </div>

                              {dev.errorMessage && (
                                <div className="text-[11px] font-mono text-rose-400 truncate">
                                  Last socket note: {dev.errorMessage}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Server Switch & Controls */}
                          <div className="flex items-center gap-2 flex-wrap shrink-0">
                            <select
                              value={dev.serverId}
                              onChange={(e) =>
                                handleDeviceAction(dev.sessionId, 'switch_server', e.target.value)
                              }
                              aria-label="Assigned Cluster Node"
                              className="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-[11px] font-mono text-slate-200 outline-none focus:border-cyan-400 cursor-pointer"
                            >
                              {(clusterServers.length > 0
                                ? clusterServers
                                : [{ id: dev.serverId, name: dev.serverName }]
                              ).map((srv) => (
                                <option key={srv.id} value={srv.id}>
                                  {srv.name}
                                </option>
                              ))}
                            </select>

                            <button
                              type="button"
                              onClick={() => handleOpenSendMessage(dev)}
                              disabled={dev.status !== 'connected'}
                              className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 hover:border-cyan-500/50 text-xs font-mono text-cyan-300 disabled:opacity-40 cursor-pointer flex items-center gap-1"
                              title="Send a WhatsApp message using this device"
                            >
                              <Send className="w-3 h-3" />
                              <span>Send Msg</span>
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                handleDeviceAction(dev.sessionId, dev.paused ? 'resume' : 'pause')
                              }
                              className={`px-2.5 py-1.5 rounded-lg border text-xs font-mono font-semibold cursor-pointer ${
                                dev.paused
                                  ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                                  : 'bg-amber-950/40 border-amber-500/30 text-amber-300 hover:border-amber-400'
                              }`}
                            >
                              {dev.paused ? 'Resume' : 'Pause'}
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeviceAction(dev.sessionId, 'reconnect')}
                              className="p-1.5 rounded-lg bg-slate-900 border border-slate-700 hover:border-cyan-400 text-slate-300 hover:text-cyan-300 cursor-pointer"
                              title="Force Reconnect Socket"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                handleDeviceAction(dev.sessionId, 'unpair', undefined, dev.connectedPhone)
                              }
                              className="p-1.5 rounded-lg bg-rose-950/50 border border-rose-500/30 hover:border-rose-400 text-rose-300 hover:text-white cursor-pointer"
                              title="Unpair & Wipe Device Session"
                            >
                              <PowerOff className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 10-Node Cluster Server Load Matrix */}
              <div className="rounded-xl bg-[#0b111e] border border-slate-800/90 p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                  <div className="flex items-center gap-2">
                    <Server className="w-4 h-4 text-cyan-400" />
                    <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-200">
                      10-Node Multi-Region Cluster Telemetry
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-slate-400 tabular-nums">
                    {clusterServers.length} Nodes Active
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                  {clusterServers.map((srv) => (
                    <div
                      key={srv.id}
                      className="p-3 rounded-lg bg-slate-950/70 border border-slate-800/80 space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-xs font-semibold text-white truncate">
                          {srv.name}
                        </span>
                        <span
                          className={`text-[10px] font-mono uppercase tabular-nums ${
                            srv.status === 'busy' ? 'text-amber-400' : 'text-emerald-400'
                          }`}
                        >
                          {srv.pingMs}ms
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 truncate">{srv.region}</div>
                      <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
                        <div
                          className={`h-full ${
                            srv.loadPercent > 75 ? 'bg-amber-400' : 'bg-cyan-400'
                          }`}
                          style={{ width: `${Math.max(8, srv.loadPercent)}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 tabular-nums">
                        <span>{srv.activeSessionsCount} live · {srv.pausedSessionsCount} held</span>
                        <span>{srv.totalMessagesHandled} msgs</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 2: BOT CONTROLLER & SETTINGS */}
          {/* ========================================================================= */}
          {activeTab === 'bot_control' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div>
                  <h3 className="text-xl font-mono font-bold text-slate-100 flex items-center gap-2">
                    <Bot className="w-5 h-5 text-cyan-400" />
                    <span>WhatsApp Bot Master Controller</span>
                  </h3>
                  <p className="text-xs font-mono text-slate-400 mt-0.5">
                    Live operational modes, profile parameters, and automated behaviors.
                  </p>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleBotAction('restart')}
                    className="px-3 py-1.5 rounded-xl bg-cyan-950 border border-cyan-500/40 text-cyan-300 text-xs font-mono font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Restart Socket</span>
                  </button>
                </div>
              </div>

              {/* Bot Operational Mode Switcher */}
              <div className="p-5 rounded-2xl bg-slate-900/80 border border-cyan-500/30 backdrop-blur-xl">
                <span className="text-xs font-mono uppercase tracking-wider text-slate-400 block mb-3">
                  Operational Mode Selection
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    {
                      id: 'public',
                      title: 'Public Mode 🟢',
                      desc: 'Anyone in groups or DMs can execute bot commands.',
                    },
                    {
                      id: 'self',
                      title: 'Private / Self Mode 🔒',
                      desc: 'Bot only responds to SUFYAN-X-IK (ignores public commands).',
                    },
                    {
                      id: 'maintenance',
                      title: 'Maintenance Mode 🚧',
                      desc: 'Commands disabled for updates with auto-notice.',
                    },
                  ].map((m) => {
                    const isSelected =
                      (botSettings?.botMode || 'public') === m.id ||
                      (m.id === 'maintenance' && botSettings?.maintenanceMode);
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => handleBotAction('set_mode', { mode: m.id })}
                        className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-cyan-500/15 border-cyan-400 text-white shadow-[0_0_20px_rgba(0,240,255,0.2)]'
                            : 'bg-black/40 border-slate-800 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <div className="font-mono font-bold text-sm text-slate-100 mb-1">
                          {m.title}
                        </div>
                        <div className="text-[11px] font-mono text-slate-400">{m.desc}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Profile Details & Prefix Editor */}
              <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 backdrop-blur-xl space-y-4">
                <span className="text-xs font-mono uppercase tracking-wider text-slate-400 block">
                  Identity & Profile Parameters
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-[11px] font-mono text-slate-400 mb-1">Bot Name</label>
                    <input
                      type="text"
                      value={botSettings?.botName || ''}
                      onChange={(e) => setBotSettings({ ...botSettings, botName: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-black/60 border border-slate-700 text-sm font-mono text-slate-100 focus:border-cyan-400 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-mono text-slate-400 mb-1">
                      Command Trigger Prefix
                    </label>
                    <input
                      type="text"
                      value={botSettings?.prefix || '.'}
                      onChange={(e) => setBotSettings({ ...botSettings, prefix: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-black/60 border border-slate-700 text-sm font-mono text-slate-100 focus:border-cyan-400 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-mono text-cyan-400 font-bold mb-1 flex items-center justify-between gap-1">
                      <span className="flex items-center gap-1">
                        <Shield className="w-3 h-3 text-cyan-400" />
                        <span>Owner Number (wa.me)</span>
                      </span>
                      {botSettings?.ownerNumber ? (
                        <button
                          type="button"
                          onClick={() => setBotSettings({ ...botSettings, ownerNumber: '' })}
                          className="text-[10px] font-mono text-rose-400 hover:text-rose-300 cursor-pointer"
                        >
                          Clear
                        </button>
                      ) : null}
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="e.g. 923464267218 (or leave blank)"
                        value={botSettings?.ownerNumber ?? ''}
                        onChange={(e) => setBotSettings({ ...botSettings, ownerNumber: e.target.value })}
                        className="w-full px-3 py-2 pr-8 rounded-xl bg-black/60 border border-cyan-500/50 text-sm font-mono text-cyan-200 focus:border-cyan-400 outline-none shadow-[0_0_10px_rgba(0,240,255,0.15)]"
                      />
                      {botSettings?.ownerNumber ? (
                        <button
                          type="button"
                          title="Delete owner number"
                          onClick={() => setBotSettings({ ...botSettings, ownerNumber: '' })}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-rose-400 text-xs font-mono cursor-pointer"
                        >
                          ✕
                        </button>
                      ) : null}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-mono text-slate-400 mb-1">
                      Auto-Status Like Emoji
                    </label>
                    <input
                      type="text"
                      value={botSettings?.statusLikeEmoji || '💚'}
                      onChange={(e) =>
                        setBotSettings({ ...botSettings, statusLikeEmoji: e.target.value })
                      }
                      className="w-full px-3 py-2 rounded-xl bg-black/60 border border-slate-700 text-sm font-mono text-slate-100 focus:border-cyan-400 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-mono text-slate-400 mb-1">
                    Bot Bio / Description
                  </label>
                  <input
                    type="text"
                    value={botSettings?.botBio || ''}
                    onChange={(e) => setBotSettings({ ...botSettings, botBio: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-black/60 border border-slate-700 text-sm font-mono text-slate-100 focus:border-cyan-400 outline-none"
                  />
                </div>

                {/* Profile Picture Uploader */}
                <div className="pt-2 flex items-center justify-between border-t border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 overflow-hidden flex items-center justify-center">
                      {dpFileBase64 ? (
                        <img src={dpFileBase64} alt="DP" className="w-full h-full object-cover" />
                      ) : (
                        <Bot className="w-5 h-5 text-cyan-400" />
                      )}
                    </div>
                    <div>
                      <span className="text-xs font-mono font-bold block text-slate-200">
                        Update Bot Profile Picture (DP)
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">
                        Uploads directly to WhatsApp via Baileys socket
                      </span>
                    </div>
                  </div>

                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleProfilePictureUpload}
                    accept="image/*"
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3.5 py-2 rounded-xl bg-purple-950/70 border border-purple-500/40 hover:bg-purple-900/50 text-purple-200 text-xs font-mono font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload New DP</span>
                  </button>
                </div>

                <div className="pt-3">
                  <button
                    type="button"
                    onClick={() =>
                      handleUpdateBotSettings({
                        ...botSettings,
                        ownerNumber: botSettings?.ownerNumber ?? '',
                      })
                    }
                    className="px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-mono font-bold text-xs tracking-wider uppercase transition-colors cursor-pointer"
                  >
                    Save & Deploy Bot Settings
                  </button>
                </div>
              </div>

              {/* Behavior Switches */}
              <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 backdrop-blur-xl">
                <span className="text-xs font-mono uppercase tracking-wider text-slate-400 block mb-3">
                  Automated Behavior Toggles
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {[
                    { key: 'autoRead', label: 'Auto-Read Messages (Blue Tick)' },
                    { key: 'autoTyping', label: 'Auto-Typing / Composing Presence' },
                    { key: 'autoRecording', label: 'Auto-Recording Voice Presence' },
                    { key: 'autoStatusView', label: 'Auto-View Contacts Status Story' },
                    { key: 'autoStatusLike', label: 'Auto-Like & React to Status' },
                    { key: 'autoReact', label: 'Auto-React Emojis to Commands' },
                  ].map((item) => {
                    const isChecked = Boolean(botSettings?.[item.key]);
                    return (
                      <div
                        key={item.key}
                        className="p-3.5 rounded-xl bg-black/40 border border-slate-800 flex items-center justify-between"
                      >
                        <span className="text-xs font-mono text-slate-300">{item.label}</span>
                        <button
                          type="button"
                          onClick={() => {
                            const updated = { ...botSettings, [item.key]: !isChecked };
                            setBotSettings(updated);
                            handleUpdateBotSettings({ [item.key]: !isChecked });
                          }}
                          className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                            isChecked ? 'bg-cyan-500' : 'bg-slate-800'
                          }`}
                        >
                          <span
                            className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${
                              isChecked ? 'translate-x-5' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 3: COMMAND MANAGER */}
          {/* ========================================================================= */}
          {activeTab === 'commands' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
                <div>
                  <h3 className="text-xl font-mono font-bold text-slate-100 flex items-center gap-2">
                    <Terminal className="w-5 h-5 text-cyan-400" />
                    <span>Command Registry & Policy Manager</span>
                  </h3>
                  <p className="text-xs font-mono text-slate-400 mt-0.5">
                    Enable, disable, configure cooldowns, and add custom auto-reply commands.
                  </p>
                </div>

                {/* Filter & Search Bar */}
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search commands..."
                      value={commandSearch}
                      onChange={(e) => setCommandSearch(e.target.value)}
                      className="pl-8 pr-3 py-1.5 rounded-xl bg-black/60 border border-slate-700 text-xs font-mono text-slate-100 placeholder-slate-500 outline-none focus:border-cyan-400"
                    />
                  </div>
                </div>
              </div>

              {/* Category Pills */}
              <div className="flex flex-wrap gap-1.5">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => {
                      playSfx('click');
                      setCommandCategory(cat);
                    }}
                    className={`px-3 py-1 rounded-lg text-xs font-mono transition-colors cursor-pointer ${
                      commandCategory === cat
                        ? 'bg-cyan-500 text-black font-bold shadow-[0_0_12px_rgba(0,240,255,0.3)]'
                        : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Add Custom Command Card */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-950/30 to-slate-900/60 border border-purple-500/30 backdrop-blur-xl">
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-purple-300 block mb-2 flex items-center gap-1.5">
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create Custom Auto-Response Command</span>
                </span>
                <form onSubmit={handleAddCustomCommand} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <input
                    type="text"
                    placeholder="Command name (e.g. price, promo)"
                    value={customCmdName}
                    onChange={(e) => setCustomCmdName(e.target.value)}
                    className="px-3 py-2 rounded-xl bg-black/60 border border-slate-700 text-xs font-mono text-slate-100 placeholder-slate-500 outline-none focus:border-purple-400"
                  />
                  <input
                    type="text"
                    placeholder="Auto reply message response..."
                    value={customCmdResponse}
                    onChange={(e) => setCustomCmdResponse(e.target.value)}
                    className="px-3 py-2 rounded-xl bg-black/60 border border-slate-700 text-xs font-mono text-slate-100 placeholder-slate-500 outline-none focus:border-purple-400"
                  />
                  <button
                    type="submit"
                    className="py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-mono font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer"
                  >
                    + Add Command
                  </button>
                </form>
              </div>

              {/* Commands Table / List */}
              <div className="rounded-2xl bg-slate-900/70 border border-slate-800 overflow-hidden">
                <div className="p-3 bg-black/40 border-b border-slate-800 flex items-center justify-between text-xs font-mono text-slate-400">
                  <span>SHOWING {filteredCommands.length} COMMANDS</span>
                  <span>PERMISSIONS & COOLDOWNS</span>
                </div>

                <div className="divide-y divide-slate-800/80 max-h-[500px] overflow-y-auto">
                  {filteredCommands.map((cmd) => (
                    <div
                      key={cmd.name}
                      className="p-3.5 flex items-center justify-between gap-3 hover:bg-slate-800/30 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <button
                          type="button"
                          onClick={() => handleToggleCommand(cmd.name, cmd.enabled)}
                          className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer shrink-0 ${
                            cmd.enabled ? 'bg-cyan-500' : 'bg-slate-800'
                          }`}
                        >
                          <span
                            className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                              cmd.enabled ? 'translate-x-4' : 'translate-x-0'
                            }`}
                          />
                        </button>
                        <div className="truncate">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-sm text-cyan-300">
                              .{cmd.name}
                            </span>
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                              {cmd.category}
                            </span>
                            {cmd.isCustom && (
                              <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-purple-950 text-purple-300 border border-purple-500/40">
                                CUSTOM
                              </span>
                            )}
                          </div>
                          <p className="text-xs font-mono text-slate-400 truncate mt-0.5">
                            {cmd.description}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-[11px] font-mono text-slate-400 hidden sm:inline">
                          Uses: <strong className="text-slate-200">{cmd.usageCount || 0}</strong>
                        </span>
                        <span
                          className={`text-[10px] font-mono px-2 py-0.5 rounded uppercase ${
                            cmd.permission === 'owner'
                              ? 'bg-rose-950 text-rose-300 border border-rose-500/40'
                              : cmd.permission === 'admin'
                              ? 'bg-amber-950 text-amber-300 border border-amber-500/40'
                              : 'bg-emerald-950 text-emerald-300 border border-emerald-500/40'
                          }`}
                        >
                          {cmd.permission}
                        </span>

                        {cmd.isCustom && (
                          <button
                            type="button"
                            onClick={() => handleDeleteCustomCommand(cmd.customId || cmd.name)}
                            className="p-1 text-slate-500 hover:text-rose-400 transition-colors cursor-pointer"
                            title="Delete custom command"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 4: USER MANAGEMENT */}
          {/* ========================================================================= */}
          {activeTab === 'users' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
                <div>
                  <h3 className="text-xl font-mono font-bold text-slate-100 flex items-center gap-2">
                    <Users className="w-5 h-5 text-cyan-400" />
                    <span>Registered User Directory & Access Control</span>
                  </h3>
                  <p className="text-xs font-mono text-slate-400 mt-0.5">
                    Monitor user interactions, block command access, or ban malicious numbers.
                  </p>
                </div>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search by phone/number..."
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    className="pl-8 pr-3 py-1.5 rounded-xl bg-black/60 border border-slate-700 text-xs font-mono text-slate-100 placeholder-slate-500 outline-none focus:border-cyan-400"
                  />
                </div>
              </div>

              {/* Users List */}
              <div className="rounded-2xl bg-slate-900/70 border border-slate-800 overflow-hidden">
                <div className="p-3 bg-black/40 border-b border-slate-800 flex items-center justify-between text-xs font-mono text-slate-400">
                  <span>TOTAL CONTACTS: {filteredUsers.length}</span>
                  <span>ACTION CONTROLS</span>
                </div>

                <div className="divide-y divide-slate-800 max-h-[550px] overflow-y-auto">
                  {filteredUsers.length === 0 ? (
                    <div className="p-8 text-center text-xs font-mono text-slate-500">
                      No matching user records found.
                    </div>
                  ) : (
                    filteredUsers.map((user) => (
                      <div
                        key={user.jid}
                        className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-800/30 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center font-mono font-bold text-cyan-400 text-sm">
                            {user.name ? user.name[0]?.toUpperCase() : '#'}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-sm text-slate-200">
                                {user.name}
                              </span>
                              <span className="text-xs font-mono text-cyan-400">{user.phone}</span>
                              {user.isBanned && (
                                <span className="text-[10px] font-mono px-2 py-0.2 rounded bg-rose-950 border border-rose-500/50 text-rose-300 font-bold">
                                  BANNED
                                </span>
                              )}
                              {user.commandsBlocked && (
                                <span className="text-[10px] font-mono px-2 py-0.2 rounded bg-amber-950 border border-amber-500/50 text-amber-300 font-bold">
                                  CMD BLOCKED
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] font-mono text-slate-500">
                              Commands: {user.commandCount || 0} • Warnings: {user.warnings || 0} •
                              Last: {new Date(user.lastActive).toLocaleDateString()}
                            </span>
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              handleUserAction(
                                user.jid,
                                user.commandsBlocked ? 'unblock_commands' : 'block_commands'
                              )
                            }
                            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-colors cursor-pointer ${
                              user.commandsBlocked
                                ? 'bg-amber-950 border border-amber-500 text-amber-300'
                                : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                            }`}
                          >
                            {user.commandsBlocked ? 'Unblock CMD' : 'Block CMD'}
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              handleUserAction(user.jid, user.isBanned ? 'unban' : 'ban')
                            }
                            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-colors cursor-pointer ${
                              user.isBanned
                                ? 'bg-emerald-950 border border-emerald-500 text-emerald-300'
                                : 'bg-rose-950/80 hover:bg-rose-900 border border-rose-600/50 text-rose-200'
                            }`}
                          >
                            {user.isBanned ? 'Unban User' : 'Ban User'}
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 5: GROUP MANAGEMENT */}
          {/* ========================================================================= */}
          {activeTab === 'groups' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div>
                  <h3 className="text-xl font-mono font-bold text-slate-100 flex items-center gap-2">
                    <MessageSquare className="w-5 h-5 text-cyan-400" />
                    <span>WhatsApp Group Administration</span>
                  </h3>
                  <p className="text-xs font-mono text-slate-400 mt-0.5">
                    Real groups connected to the bot with anti-link, anti-spam, and welcome controls.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => loadTabData('groups')}
                  className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 hover:border-cyan-400 text-slate-300 text-xs font-mono flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Refresh Groups</span>
                </button>
              </div>

              {groupsList.length === 0 ? (
                <div className="p-8 rounded-2xl bg-slate-900/60 border border-slate-800 text-center space-y-2">
                  <Bot className="w-8 h-8 text-slate-600 mx-auto" />
                  <p className="text-xs font-mono text-slate-400">
                    No active WhatsApp groups discovered yet on the current socket.
                  </p>
                  <p className="text-[11px] font-mono text-slate-500">
                    Add the bot to a WhatsApp group or verify the session is connected.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {groupsList.map((g) => (
                    <div
                      key={`${g.sessionId || 'primary'}:${g.jid}`}
                      className="p-5 rounded-xl bg-[#0b111e] border border-slate-800 hover:border-cyan-500/40 space-y-3 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h4 className="font-semibold text-base text-white truncate">{g.name}</h4>
                          <span className="text-[11px] font-mono text-cyan-400 block mt-0.5 tabular-nums">
                            {g.participantCount} Participants · {g.isBotAdmin ? 'Bot Admin' : 'Member'}
                            {g.sessionPhone ? ` · Device ${g.sessionPhone}` : ''}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleLeaveGroup(g.jid, g.sessionId)}
                          className="px-2.5 py-1 rounded-lg bg-rose-950/60 border border-rose-500/40 hover:bg-rose-900 text-rose-300 text-[10px] font-mono cursor-pointer shrink-0"
                        >
                          Leave Group
                        </button>
                      </div>

                      {/* Security switches */}
                      <div className="pt-2 border-t border-slate-800 grid grid-cols-2 gap-2 text-xs font-mono">
                        <button
                          type="button"
                          onClick={() =>
                            handleToggleGroupSecurity(g.jid, 'antilink', g.config?.antilink)
                          }
                          className={`p-2 rounded-xl border flex items-center justify-between cursor-pointer ${
                            g.config?.antilink
                              ? 'bg-cyan-950/70 border-cyan-400 text-cyan-300'
                              : 'bg-black/40 border-slate-800 text-slate-500'
                          }`}
                        >
                          <span>Anti-Link</span>
                          <span className="font-bold">{g.config?.antilink ? 'ON' : 'OFF'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            handleToggleGroupSecurity(g.jid, 'antispam', g.config?.antispam)
                          }
                          className={`p-2 rounded-xl border flex items-center justify-between cursor-pointer ${
                            g.config?.antispam
                              ? 'bg-purple-950/70 border-purple-400 text-purple-300'
                              : 'bg-black/40 border-slate-800 text-slate-500'
                          }`}
                        >
                          <span>Anti-Spam</span>
                          <span className="font-bold">{g.config?.antispam ? 'ON' : 'OFF'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            handleToggleGroupSecurity(g.jid, 'welcome', g.config?.welcome)
                          }
                          className={`p-2 rounded-xl border flex items-center justify-between cursor-pointer ${
                            g.config?.welcome
                              ? 'bg-emerald-950/70 border-emerald-400 text-emerald-300'
                              : 'bg-black/40 border-slate-800 text-slate-500'
                          }`}
                        >
                          <span>Welcome Card</span>
                          <span className="font-bold">{g.config?.welcome ? 'ON' : 'OFF'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            handleToggleGroupSecurity(g.jid, 'goodbye', g.config?.goodbye)
                          }
                          className={`p-2 rounded-xl border flex items-center justify-between cursor-pointer ${
                            g.config?.goodbye
                              ? 'bg-amber-950/70 border-amber-400 text-amber-300'
                              : 'bg-black/40 border-slate-800 text-slate-500'
                          }`}
                        >
                          <span>Goodbye Msg</span>
                          <span className="font-bold">{g.config?.goodbye ? 'ON' : 'OFF'}</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 6: AI & BRAIN API MANAGEMENT */}
          {/* ========================================================================= */}
          {activeTab === 'ai_api' && (
            <div className="space-y-6">
              <div className="border-b border-slate-800 pb-4">
                <h3 className="text-xl font-mono font-bold text-slate-100 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-cyan-400" />
                  <span>AI Engine & API Architecture</span>
                </h3>
                <p className="text-xs font-mono text-slate-400 mt-0.5">
                  Configure Gemini LLM parameters, token safety limits, and custom prompt templates.
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 backdrop-blur-xl space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-mono text-slate-400 mb-1">
                      AI Model Selection
                    </label>
                    <select
                      value={aiConfig?.model || 'gemini-2.5-flash'}
                      onChange={(e) => setAiConfig({ ...aiConfig, model: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-black/60 border border-slate-700 text-sm font-mono text-slate-100 outline-none focus:border-cyan-400"
                    >
                      <option value="gemini-2.5-flash">Gemini 2.5 Flash (Ultra Fast & Smart)</option>
                      <option value="gemini-2.5-pro">Gemini 2.5 Pro (Deep Reasoning)</option>
                      <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-mono text-slate-400 mb-1">
                      Daily AI Rate Limit Per User
                    </label>
                    <input
                      type="number"
                      value={aiConfig?.rateLimitPerUser || 40}
                      onChange={(e) =>
                        setAiConfig({ ...aiConfig, rateLimitPerUser: Number(e.target.value) })
                      }
                      className="w-full px-3 py-2 rounded-xl bg-black/60 border border-slate-700 text-sm font-mono text-slate-100 outline-none focus:border-cyan-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-mono text-slate-400 mb-1">
                    Custom AI System Persona Prompt
                  </label>
                  <textarea
                    rows={3}
                    value={aiConfig?.customSystemPrompt || ''}
                    onChange={(e) =>
                      setAiConfig({ ...aiConfig, customSystemPrompt: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-black/60 border border-slate-700 text-xs font-mono text-slate-100 outline-none focus:border-cyan-400"
                  />
                </div>

                <div className="pt-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${
                        aiConfig?.hasServerKey ? 'bg-emerald-400' : 'bg-amber-400'
                      }`}
                    />
                    <span className="text-xs font-mono text-slate-300">
                      Server API Key Status:{' '}
                      <strong className="text-cyan-300">
                        {aiConfig?.hasServerKey ? 'SECURED & MASKED' : 'USING DEFAULT ENV'}
                      </strong>
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={async () => {
                      playSfx('click');
                      await adminFetch('/api/admin/ai', {
                        method: 'POST',
                        body: JSON.stringify(aiConfig),
                      });
                      notify('AI configurations updated successfully!');
                    }}
                    className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-mono font-bold text-xs uppercase cursor-pointer"
                  >
                    Save AI Settings
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 7: MEDIA & DOWNLOADER MANAGEMENT */}
          {/* ========================================================================= */}
          {activeTab === 'media_dl' && (
            <div className="space-y-6">
              <div className="border-b border-slate-800 pb-4">
                <h3 className="text-xl font-mono font-bold text-slate-100 flex items-center gap-2">
                  <Download className="w-5 h-5 text-cyan-400" />
                  <span>Media Studio & High-Speed Download Engines</span>
                </h3>
                <p className="text-xs font-mono text-slate-400 mt-0.5">
                  Control audio bitrates, maximum file download ceilings, and platform support.
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 backdrop-blur-xl space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-mono text-slate-400 mb-1">
                      Max Media Download Limit (MB)
                    </label>
                    <input
                      type="number"
                      value={downloaderConfig?.maxFileSizeMb || 100}
                      onChange={(e) =>
                        setDownloaderConfig({
                          ...downloaderConfig,
                          maxFileSizeMb: Number(e.target.value),
                        })
                      }
                      className="w-full px-3 py-2 rounded-xl bg-black/60 border border-slate-700 text-sm font-mono text-slate-100 outline-none focus:border-cyan-400"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-mono text-slate-400 mb-1">
                      Default Audio Bitrate
                    </label>
                    <select
                      value={downloaderConfig?.audioBitrate || '192k'}
                      onChange={(e) =>
                        setDownloaderConfig({ ...downloaderConfig, audioBitrate: e.target.value })
                      }
                      className="w-full px-3 py-2 rounded-xl bg-black/60 border border-slate-700 text-sm font-mono text-slate-100 outline-none focus:border-cyan-400"
                    >
                      <option value="128k">128 kbps (Fastest bandwidth)</option>
                      <option value="192k">192 kbps (Studio balanced)</option>
                      <option value="320k">320 kbps (Supreme master quality)</option>
                    </select>
                  </div>
                </div>

                <div className="pt-3">
                  <button
                    type="button"
                    onClick={async () => {
                      playSfx('click');
                      await adminFetch('/api/admin/downloader', {
                        method: 'POST',
                        body: JSON.stringify(downloaderConfig),
                      });
                      notify('Downloader settings saved!');
                    }}
                    className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-mono font-bold text-xs uppercase cursor-pointer"
                  >
                    Save Downloader Config
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 8: WEBSITE CONFIGURATION */}
          {/* ========================================================================= */}
          {activeTab === 'website' && (
            <div className="space-y-6">
              <div className="border-b border-slate-800 pb-4">
                <h3 className="text-xl font-mono font-bold text-slate-100 flex items-center gap-2">
                  <Globe className="w-5 h-5 text-cyan-400" />
                  <span>Website Branding & Announcements</span>
                </h3>
                <p className="text-xs font-mono text-slate-400 mt-0.5">
                  Update public headings, live banner announcements, and contact information.
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 backdrop-blur-xl space-y-4">
                <div>
                  <label className="block text-[11px] font-mono text-slate-400 mb-1">
                    Website Title
                  </label>
                  <input
                    type="text"
                    value={websiteConfig?.title || ''}
                    onChange={(e) =>
                      setWebsiteConfig({ ...websiteConfig, title: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-black/60 border border-slate-700 text-sm font-mono text-slate-100 outline-none focus:border-cyan-400"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-mono text-slate-400 mb-1">
                    Announcement Banner Message
                  </label>
                  <input
                    type="text"
                    value={websiteConfig?.announcement || ''}
                    onChange={(e) =>
                      setWebsiteConfig({ ...websiteConfig, announcement: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-black/60 border border-slate-700 text-sm font-mono text-slate-100 outline-none focus:border-cyan-400"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-mono text-slate-400 mb-1">
                      Owner Contact Phone
                    </label>
                    <input
                      type="text"
                      value={websiteConfig?.contactPhone || ''}
                      onChange={(e) =>
                        setWebsiteConfig({ ...websiteConfig, contactPhone: e.target.value })
                      }
                      className="w-full px-3 py-2 rounded-xl bg-black/60 border border-slate-700 text-sm font-mono text-slate-100 outline-none focus:border-cyan-400"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-mono text-slate-400 mb-1">
                      WhatsApp Channel Link
                    </label>
                    <input
                      type="text"
                      value={websiteConfig?.channelUrl || ''}
                      onChange={(e) =>
                        setWebsiteConfig({ ...websiteConfig, channelUrl: e.target.value })
                      }
                      className="w-full px-3 py-2 rounded-xl bg-black/60 border border-slate-700 text-sm font-mono text-slate-100 outline-none focus:border-cyan-400"
                    />
                  </div>
                </div>

                <div className="pt-3">
                  <button
                    type="button"
                    onClick={async () => {
                      playSfx('click');
                      await adminFetch('/api/admin/website', {
                        method: 'POST',
                        body: JSON.stringify(websiteConfig),
                      });
                      notify('Website settings updated!');
                    }}
                    className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-mono font-bold text-xs uppercase cursor-pointer"
                  >
                    Save Website Config
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB: WEBSITE CYBER MUSIC PLAYLIST (Admin can add/remove tracks) */}
          {/* ========================================================================= */}
          {activeTab === 'music' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
                <div>
                  <h3 className="text-xl font-mono font-bold text-slate-100 flex items-center gap-2">
                    <Music className="w-5 h-5 text-emerald-400" />
                    <span>Website Cyber Music & Audio Deck</span>
                  </h3>
                  <p className="text-xs font-mono text-slate-400 mt-0.5">
                    Live songs played on SAYRON MD pairing portal. Admin can add new MP3 tracks anytime.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-emerald-400 font-mono text-xs font-bold tabular-nums">
                    {musicList.length} Tracks in Deck
                  </span>
                </div>
              </div>

              {/* Add New Song Form Card */}
              <div className="rounded-2xl bg-slate-900/70 border border-emerald-500/30 p-5 backdrop-blur-xl shadow-[0_0_25px_rgba(16,185,129,0.1)]">
                <div className="text-sm font-mono font-bold text-emerald-400 mb-3 flex items-center gap-2">
                  <Plus className="w-4 h-4" />
                  <span>Add New Track to Website Deck</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-mono text-slate-300 mb-1">
                      Track Title <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. SAYRON VIP Cyber Phonk"
                      value={newSongTitle}
                      onChange={(e) => setNewSongTitle(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-black/60 border border-slate-700 text-sm font-mono text-slate-100 outline-none focus:border-emerald-400"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-mono text-slate-300 mb-1">
                      Artist / Producer
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. SUFYAN-X-IK Beats"
                      value={newSongArtist}
                      onChange={(e) => setNewSongArtist(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-black/60 border border-slate-700 text-sm font-mono text-slate-100 outline-none focus:border-emerald-400"
                    />
                  </div>

                  {/* Direct Audio File Picker */}
                  <div className="rounded-xl border border-dashed border-emerald-500/40 bg-emerald-950/20 p-3.5 flex flex-col justify-between">
                    <div>
                      <div className="text-[11px] font-mono font-bold text-emerald-300 flex items-center gap-1.5 mb-1">
                        <Upload className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Select Audio File (MP3 / Audio)</span>
                        <span className="text-rose-400">*</span>
                      </div>
                      <p className="text-[10px] font-mono text-slate-400 truncate">
                        {adminAudioFileName ? `Selected: ${adminAudioFileName}` : 'Pick MP3 / Audio file directly from device storage'}
                      </p>
                    </div>
                    <div className="mt-2.5 flex items-center gap-2">
                      <input
                        ref={adminAudioInputRef}
                        type="file"
                        accept="audio/*,.mp3,.wav,.ogg,.m4a"
                        onChange={handleAdminAudioSelect}
                        className="hidden"
                        id="admin-audio-picker"
                      />
                      <label
                        htmlFor="admin-audio-picker"
                        className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-mono font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-sm transition-all"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>{adminAudioFileName ? 'Change Audio File' : 'Browse Audio File'}</span>
                      </label>
                      {adminAudioFileName && (
                        <span className="text-[11px] font-mono text-emerald-400 flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" /> Ready
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Direct Cover Picture Picker */}
                  <div className="rounded-xl border border-dashed border-cyan-500/40 bg-cyan-950/20 p-3.5 flex flex-col justify-between">
                    <div>
                      <div className="text-[11px] font-mono font-bold text-cyan-300 flex items-center gap-1.5 mb-1">
                        <Upload className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Select Cover Picture (Gallery / Storage)</span>
                      </div>
                      <p className="text-[10px] font-mono text-slate-400">
                        {adminCoverFileBase64 ? 'Custom track picture loaded' : 'Pick track photo from phone gallery or files'}
                      </p>
                    </div>
                    <div className="mt-2.5 flex items-center gap-2">
                      <input
                        ref={adminCoverInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleAdminCoverSelect}
                        className="hidden"
                        id="admin-cover-picker"
                      />
                      <label
                        htmlFor="admin-cover-picker"
                        className="px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-black font-mono font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-sm transition-all"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>{adminCoverFileBase64 ? 'Change Picture' : 'Browse Picture'}</span>
                      </label>
                      {adminCoverFileBase64 && (
                        <div className="flex items-center gap-2">
                          <img src={adminCoverFileBase64} alt="Cover Preview" className="w-6 h-6 rounded object-cover border border-cyan-400" />
                          <span className="text-[11px] font-mono text-cyan-400 flex items-center gap-1">
                            <Check className="w-3.5 h-3.5" /> Loaded
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-[11px] font-mono text-slate-300 mb-1">
                      Category Genre
                    </label>
                    <select
                      value={newSongCategory}
                      onChange={(e) => setNewSongCategory(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-black/60 border border-slate-700 text-sm font-mono text-slate-100 outline-none focus:border-emerald-400"
                    >
                      <option value="Cyber Phonk">Cyber Phonk (High Drift)</option>
                      <option value="Midnight Lo-Fi">Midnight Lo-Fi (Chill)</option>
                      <option value="Synthwave">80s Retro Synthwave</option>
                      <option value="Arabic Trap">Arabic Trap & Bass</option>
                      <option value="Slowed & Reverb">Slowed & Reverb Beats</option>
                      <option value="Sad Shayari BGM">Sad Shayari Aesthetic BGM</option>
                      <option value="Electro EDM">Electro Cyber EDM</option>
                    </select>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between">
                  <span className="text-[11px] font-mono text-slate-500">
                    Track will immediately sync to the website audio deck upon adding.
                  </span>
                  <button
                    type="button"
                    onClick={handleAddSong}
                    disabled={loading || !newSongTitle.trim() || !adminAudioFileBase64}
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-black font-mono font-bold text-xs uppercase transition-all shadow-[0_0_18px_rgba(16,185,129,0.4)] disabled:opacity-50 cursor-pointer"
                  >
                    + Add Track to Deck
                  </button>
                </div>
              </div>

              {/* Active Tracks List */}
              <div className="rounded-2xl bg-slate-900/60 border border-slate-800 p-5 backdrop-blur-xl">
                <div className="flex items-center justify-between mb-4">
                  <div className="text-sm font-mono font-bold text-slate-200 flex items-center gap-2">
                    <ListMusic className="w-4 h-4 text-cyan-400" />
                    <span>Current Website Playlist ({musicList.length} Tracks)</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => loadTabData('music')}
                    className="text-xs font-mono text-cyan-400 hover:text-cyan-300 flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Refresh List</span>
                  </button>
                </div>

                {musicList.length === 0 ? (
                  <div className="text-center py-8 text-slate-500 font-mono text-xs">
                    No songs in deck yet. Use the form above to add your first track!
                  </div>
                ) : (
                  <div className="divide-y divide-slate-800/80">
                    {musicList.map((song: any, idx: number) => {
                      const isPreviewPlaying = playingSongId === song.id;
                      return (
                        <div
                          key={song.id || idx}
                          className="py-3 flex items-center justify-between gap-3 hover:bg-slate-800/30 px-2 rounded-xl transition-colors"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            {/* Track Index or Play Button */}
                            <button
                              type="button"
                              onClick={() => toggleAdminAudioPreview(song)}
                              title={isPreviewPlaying ? 'Pause Audio Preview' : 'Play Audio Preview'}
                              className={`w-9 h-9 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                                isPreviewPlaying
                                  ? 'bg-emerald-500 text-black shadow-[0_0_12px_#10b981]'
                                  : 'bg-black/60 border border-slate-700 text-slate-300 hover:border-emerald-400 hover:text-emerald-300'
                              }`}
                            >
                              {isPreviewPlaying ? (
                                <Pause className="w-4 h-4 fill-current" />
                              ) : (
                                <Play className="w-4 h-4 fill-current translate-x-0.5" />
                              )}
                            </button>

                            {/* Cover Thumbnail */}
                            <img
                              src={song.coverUrl || '/sayron_md_banner.jpg'}
                              alt={song.title}
                              className="w-10 h-10 rounded-lg object-cover border border-slate-700 flex-shrink-0"
                              onError={(e) => {
                                (e.target as HTMLElement).style.display = 'none';
                              }}
                            />

                            {/* Details */}
                            <div className="flex flex-col min-w-0">
                              <span className="font-mono text-sm font-bold text-white truncate">
                                {song.title}
                              </span>
                              <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400">
                                <span>{song.artist}</span>
                                <span>•</span>
                                <span className="text-cyan-400 font-semibold">{song.category || 'Cyber'}</span>
                                {song.duration && (
                                  <>
                                    <span>•</span>
                                    <span>{song.duration}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Actions: Delete Button */}
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <button
                              type="button"
                              onClick={() => handleDeleteSong(song.id, song.title)}
                              title="Delete from playlist"
                              className="p-2 rounded-xl bg-rose-950/40 border border-rose-500/30 hover:border-rose-400 text-rose-300 hover:text-white transition-all cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 9: LOGS & SECURITY AUDIT */}
          {/* ========================================================================= */}
          {activeTab === 'logs' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div>
                  <h3 className="text-xl font-mono font-bold text-slate-100 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-cyan-400" />
                    <span>Master Security Audit & Activity Logs</span>
                  </h3>
                  <p className="text-xs font-mono text-slate-400 mt-0.5">
                    Real administrative mutation trail, bot errors, and authentication attempts.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    playSfx('alert');
                    if (!confirm('Are you sure you want to clear old audit logs?')) return;
                    await adminFetch('/api/admin/logs/clear', { method: 'POST' });
                    notify('Audit logs purged with Master confirmation.');
                    loadTabData('logs');
                  }}
                  className="px-3 py-1.5 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-300 text-xs font-mono cursor-pointer"
                >
                  Clear Logs
                </button>
              </div>

              {/* Logs Stream */}
              <div className="rounded-2xl bg-black/60 border border-slate-800 overflow-hidden font-mono text-xs">
                <div className="p-3 bg-slate-950 border-b border-slate-800 text-slate-400 flex items-center justify-between">
                  <span>TIMESTAMP / ACTOR / EVENT</span>
                  <span>STATUS</span>
                </div>

                <div className="divide-y divide-slate-800/80 max-h-[550px] overflow-y-auto p-2">
                  {(logsData?.auditLogs || []).map((l: any) => (
                    <div
                      key={l.id}
                      className="p-2.5 flex items-center justify-between gap-3 hover:bg-slate-900/40 transition-colors"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span className="text-slate-500 text-[10px]">
                          [{new Date(l.timestamp).toLocaleTimeString()}]
                        </span>
                        <span className="text-purple-300 font-bold">{l.actor}</span>
                        <span className="text-cyan-400 font-bold">{l.action}:</span>
                        <span className="text-slate-300 truncate">{l.details}</span>
                      </div>
                      <span
                        className={`text-[9px] px-2 py-0.5 rounded uppercase font-bold shrink-0 ${
                          l.status === 'SUCCESS'
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40'
                            : 'bg-amber-950 text-amber-300 border border-amber-500/40'
                        }`}
                      >
                        {l.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 10: DATABASE & BACKUP */}
          {/* ========================================================================= */}
          {activeTab === 'database' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div>
                  <h3 className="text-xl font-mono font-bold text-slate-100 flex items-center gap-2">
                    <Database className="w-5 h-5 text-cyan-400" />
                    <span>Database State & Snapshot Management</span>
                  </h3>
                  <p className="text-xs font-mono text-slate-400 mt-0.5">
                    Safe snapshot creation, backup restore, and persistence health checks.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleCreateBackup}
                  className="px-3.5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-mono font-bold text-xs uppercase flex items-center gap-1.5 cursor-pointer shadow-[0_0_15px_rgba(0,240,255,0.3)]"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Create Snapshot Backup</span>
                </button>
              </div>

              {/* DB Status metrics */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800">
                  <span className="text-[10px] font-mono text-slate-400 uppercase">
                    Storage Engine
                  </span>
                  <div className="text-lg font-mono font-bold text-slate-100 mt-0.5">
                    Atomic JSON Store
                  </div>
                  <span className="text-[10px] font-mono text-emerald-400">HEALTHY • SYNCED</span>
                </div>

                <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800">
                  <span className="text-[10px] font-mono text-slate-400 uppercase">
                    Store File Size
                  </span>
                  <div className="text-lg font-mono font-bold text-cyan-400 mt-0.5">
                    {dbData?.fileSizeKb || 24} KB
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">Zero latency in RAM</span>
                </div>

                <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800">
                  <span className="text-[10px] font-mono text-slate-400 uppercase">
                    Saved Snapshots
                  </span>
                  <div className="text-lg font-mono font-bold text-purple-400 mt-0.5">
                    {dbData?.backupsCount || 0} Backups
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">Available on disk</span>
                </div>
              </div>

              {/* Railway & 24/7 VPS Deployment Export Box */}
              <div className="p-6 rounded-2xl bg-gradient-to-br from-purple-950/40 via-slate-900/90 to-cyan-950/40 border border-purple-500/40 shadow-[0_0_30px_rgba(168,85,247,0.15)] space-y-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-purple-500/20 border border-purple-400/50 flex items-center justify-center text-purple-300 shrink-0 shadow-lg">
                      <Download className="w-6 h-6 animate-bounce" />
                    </div>
                    <div>
                      <h4 className="text-base font-mono font-bold text-white flex items-center gap-2">
                        <span>FULL BOT CODE ZIP (RAILWAY & 24/7 VPS DEPLOYMENT READY)</span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/50 text-emerald-300">
                          ALL-IN-ONE
                        </span>
                      </h4>
                      <p className="text-xs font-mono text-slate-300 mt-0.5">
                        Includes complete source code, Procfile, railway.json, Dockerfile &amp; deploy guide.
                      </p>
                    </div>
                  </div>

                  <a
                    href={`/api/admin/download-source-zip?token=${encodeURIComponent(token)}`}
                    download="SUFYAN-X-IK_MD_BOT_DEPLOYMENT.zip"
                    onClick={() => playSfx('click')}
                    className="w-full sm:w-auto px-5 py-3 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 text-white font-mono font-bold text-xs uppercase flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(168,85,247,0.4)] transition-all cursor-pointer shrink-0"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download Full Bot ZIP</span>
                  </a>
                </div>

                <div className="p-4 rounded-xl bg-black/50 border border-slate-800 text-xs font-mono space-y-2">
                  <span className="text-cyan-400 font-bold block">
                    ⚡ How to Deploy on Railway.app for 24/7 Non-Stop Online:
                  </span>
                  <ol className="list-decimal list-inside text-slate-300 space-y-1.5 leading-relaxed">
                    <li>Click <strong className="text-purple-300">"Download Full Bot ZIP"</strong> above.</li>
                    <li>Extract the downloaded zip on your computer or phone.</li>
                    <li>Upload all files to a new repository on <strong className="text-white">GitHub.com</strong>.</li>
                    <li>Open <strong className="text-white">Railway.app</strong> &gt; New Project &gt; <strong className="text-cyan-300">Deploy from GitHub repo</strong>.</li>
                    <li>Railway automatically uses the included <code className="text-purple-300">Dockerfile</code> &amp; <code className="text-purple-300">railway.json</code>. Your bot will run 24/7 without turning off!</li>
                  </ol>
                </div>
              </div>

              {/* Backups List */}
              <div className="rounded-2xl bg-slate-900/70 border border-slate-800 overflow-hidden">
                <div className="p-3 bg-black/40 border-b border-slate-800 text-xs font-mono text-slate-400">
                  AVAILABLE DISK BACKUPS
                </div>
                <div className="divide-y divide-slate-800 max-h-[400px] overflow-y-auto">
                  {(dbData?.backups || []).length === 0 ? (
                    <div className="p-8 text-center text-xs font-mono text-slate-500">
                      No manual backups created yet. Click "Create Snapshot Backup" above.
                    </div>
                  ) : (
                    (dbData?.backups || []).map((b: any) => (
                      <div
                        key={b.filename}
                        className="p-3.5 flex items-center justify-between text-xs font-mono hover:bg-slate-800/30"
                      >
                        <div>
                          <span className="font-bold text-slate-200">{b.filename}</span>
                          <span className="text-[10px] text-slate-500 block">
                            Size: {Math.round(b.size / 1024)} KB • Created:{' '}
                            {new Date(b.timestamp).toLocaleString()}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRestoreBackup(b.filename)}
                          className="px-3 py-1.5 rounded-lg bg-amber-950/70 border border-amber-500/40 hover:bg-amber-900 text-amber-200 text-xs font-mono cursor-pointer"
                        >
                          Restore Snapshot
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};
