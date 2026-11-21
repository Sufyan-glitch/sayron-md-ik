import React, { useState, useEffect, useRef } from 'react';
import {
  Music,
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Volume2,
  VolumeX,
  X,
  Disc3,
  ListMusic,
  Sparkles,
  Radio,
  Maximize2,
} from 'lucide-react';

export interface SongItem {
  id: string;
  title: string;
  artist: string;
  audioUrl: string;
  coverUrl?: string;
  duration?: string;
  category?: string;
}

const FALLBACK_SONGS: SongItem[] = [
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

interface CyberMusicPlayerProps {
  isOpen: boolean;
  onClose: () => void;
  onOpen?: () => void;
  accentColor?: string;
  isPlayingGlobal?: boolean;
  onPlayingStateChange?: (playing: boolean) => void;
}

export const CyberMusicPlayer: React.FC<CyberMusicPlayerProps> = ({
  isOpen,
  onClose,
  onOpen,
  accentColor = '#ef4444',
  onPlayingStateChange,
}) => {
  const [playlist, setPlaylist] = useState<SongItem[]>(FALLBACK_SONGS);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(150);
  const [volume, setVolume] = useState(0.85);
  const [isMuted, setIsMuted] = useState(false);
  const [activeTab, setActiveTab] = useState<'deck' | 'playlist'>('deck');
  const [isMiniDismissed, setIsMiniDismissed] = useState(false);
  const [usingSynth, setUsingSynth] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const synthTimerRef = useRef<number | null>(null);
  const synthAudioCtxRef = useRef<AudioContext | null>(null);

  const currentSong: SongItem =
    (playlist && playlist.length > 0 && playlist[currentIndex]) ||
    FALLBACK_SONGS[0] || {
      id: 'placeholder',
      title: 'No Track Loaded',
      artist: 'SUFYAN-X-IK Beats',
      audioUrl: '',
      coverUrl: '/sayron_md_banner.jpg',
    };

  // Fetch playlist from server on mount & whenever Music Deck opens
  const fetchPlaylist = () => {
    fetch('/api/music/playlist')
      .then((res) => res.json())
      .then((data) => {
        if (data?.ok && Array.isArray(data.playlist)) {
          setPlaylist(data.playlist);
          setCurrentIndex((prev) => (prev >= data.playlist.length ? 0 : prev));
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    fetchPlaylist();
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchPlaylist();
    }
  }, [isOpen]);

  // Sync playing state with global handler for animated header button
  useEffect(() => {
    onPlayingStateChange?.(isPlaying);
  }, [isPlaying, onPlayingStateChange]);

  // Handle Audio Element Listeners
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onLoadedMetadata = () => {
      if (audio.duration && !isNaN(audio.duration)) {
        setDuration(audio.duration);
      }
    };
    const onEnded = () => handleNext();
    const onError = () => {
      if (isPlaying && currentSong.audioUrl) {
        startCyberSynth();
      }
    };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
    };
  }, [currentIndex, isPlaying, currentSong]);

  // Web Audio Synthesizer Fallback
  const startCyberSynth = () => {
    try {
      setUsingSynth(true);
      if (!synthAudioCtxRef.current) {
        synthAudioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = synthAudioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume();

      const notes = [220, 261.63, 293.66, 329.63, 392, 440, 523.25];
      let step = 0;

      if (synthTimerRef.current) clearInterval(synthTimerRef.current);

      synthTimerRef.current = window.setInterval(() => {
        if (!isPlaying || isMuted) return;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        const freq = notes[step % notes.length];
        osc.type = step % 4 === 0 ? 'sawtooth' : 'triangle';
        osc.frequency.setValueAtTime(freq, ctx.currentTime);

        const currentVol = isMuted ? 0 : volume * 0.15;
        gain.gain.setValueAtTime(currentVol, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start();
        osc.stop(ctx.currentTime + 0.35);
        step++;
      }, 240);
    } catch {}
  };

  const stopCyberSynth = () => {
    setUsingSynth(false);
    if (synthTimerRef.current) {
      clearInterval(synthTimerRef.current);
      synthTimerRef.current = null;
    }
  };

  const togglePlay = () => {
    if (!currentSong.audioUrl) return;
    if (isPlaying) {
      if (audioRef.current) audioRef.current.pause();
      stopCyberSynth();
      setIsPlaying(false);
    } else {
      setIsPlaying(true);
      setIsMiniDismissed(false);
      if (audioRef.current) {
        audioRef.current.play().catch(() => startCyberSynth());
      } else {
        startCyberSynth();
      }
    }
  };

  const handleNext = () => {
    if (playlist.length === 0) return;
    const next = (currentIndex + 1) % playlist.length;
    setCurrentIndex(next);
    setCurrentTime(0);
    stopCyberSynth();
    setIsPlaying(true);
    setTimeout(() => {
      if (audioRef.current) {
        audioRef.current.play().catch(() => startCyberSynth());
      }
    }, 120);
  };

  const handlePrev = () => {
    if (playlist.length === 0) return;
    const prev = (currentIndex - 1 + playlist.length) % playlist.length;
    setCurrentIndex(prev);
    setCurrentTime(0);
    stopCyberSynth();
    setIsPlaying(true);
    setTimeout(() => {
      if (audioRef.current) {
        audioRef.current.play().catch(() => startCyberSynth());
      }
    }, 120);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    setCurrentTime(time);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
  };

  const handleVolume = (e: React.ChangeEvent<HTMLInputElement>) => {
    const vol = parseFloat(e.target.value);
    setVolume(vol);
    if (audioRef.current) audioRef.current.volume = vol;
    setIsMuted(vol === 0);
  };

  const toggleMute = () => {
    if (isMuted) {
      setIsMuted(false);
      if (audioRef.current) audioRef.current.volume = volume || 0.85;
    } else {
      setIsMuted(true);
      if (audioRef.current) audioRef.current.volume = 0;
    }
  };

  const formatTime = (sec: number) => {
    if (isNaN(sec)) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };



  return (
    <>
      {/* =========================================================================
          PERSISTENT GLOBAL AUDIO TAG (Always mounted so song NEVER stops on close)
         ========================================================================= */}
      <audio
        ref={audioRef}
        src={currentSong.audioUrl ? currentSong.audioUrl : undefined}
        preload="auto"
      />

      {/* =========================================================================
          FLOATING CYBER MINI-PLAYER BAR (Visible when modal is closed & song is playing)
         ========================================================================= */}
      {!isOpen && isPlaying && !isMiniDismissed && (
        <div
          className="fixed bottom-3 left-1/2 -translate-x-1/2 z-40 w-[94%] max-w-md rounded-2xl p-2.5 backdrop-blur-2xl bg-[#090b1c]/95 border shadow-[0_10px_35px_rgba(0,0,0,0.85)] flex items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom-3 duration-200 transition-all cursor-pointer group"
          style={{
            borderColor: `${accentColor}70`,
            boxShadow: `0 0 24px ${accentColor}40`,
          }}
          onClick={() => onOpen?.()}
        >
          {/* Left: Spinning Vinyl Icon + Song Info */}
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div
              className="relative w-10 h-10 rounded-full p-0.5 flex-shrink-0 animate-spin-slow overflow-hidden border"
              style={{ borderColor: accentColor }}
            >
              <img
                src={currentSong.coverUrl || '/sayron_md_banner.jpg'}
                alt={currentSong.title}
                className="w-full h-full object-cover rounded-full"
              />
              <div
                className="absolute inset-0 rounded-full border border-dashed opacity-75"
                style={{ borderColor: accentColor }}
              />
            </div>

            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-xs font-bold text-white truncate">
                  {currentSong.title}
                </span>
                <span
                  className="w-1.5 h-1.5 rounded-full animate-ping flex-shrink-0"
                  style={{ backgroundColor: accentColor }}
                />
              </div>
              <span className="text-[10px] font-mono text-slate-400 truncate">
                {currentSong.artist} • {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>
          </div>

          {/* Right: Controls & Maximize */}
          <div className="flex items-center gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={togglePlay}
              className="w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer"
              style={{
                backgroundColor: accentColor,
                color: '#000000',
                boxShadow: `0 0 12px ${accentColor}`,
              }}
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
            </button>

            <button
              type="button"
              onClick={handleNext}
              className="p-1.5 rounded-lg text-slate-300 hover:text-white transition-colors cursor-pointer"
              title="Next Track"
            >
              <SkipForward className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => onOpen?.()}
              className="p-1.5 rounded-lg text-slate-300 hover:text-white transition-colors cursor-pointer"
              title="Open Full Deck"
            >
              <Maximize2 className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => setIsMiniDismissed(true)}
              className="p-1 rounded-lg text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
              title="Dismiss Player"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* =========================================================================
          FULL CYBER MUSIC PLAYER DECK MODAL
         ========================================================================= */}
      {isOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div
            className="relative w-full max-w-sm rounded-3xl bg-[#090b1e]/98 border p-5 shadow-[0_0_50px_rgba(0,0,0,0.9)] flex flex-col gap-3.5 overflow-hidden transition-all duration-500"
            style={{
              borderColor: `${accentColor}55`,
              boxShadow: `0 0 35px ${accentColor}30`,
            }}
          >
            {/* Ambient Reactive Neon Light in Background */}
            <div
              className="absolute -top-20 -left-20 w-52 h-52 rounded-full blur-3xl opacity-35 pointer-events-none transition-colors duration-500"
              style={{ backgroundColor: accentColor }}
            />
            <div
              className="absolute -bottom-20 -right-20 w-52 h-52 rounded-full blur-3xl opacity-20 pointer-events-none transition-colors duration-500"
              style={{ backgroundColor: accentColor }}
            />

            {/* Modal Header + Tab Switcher */}
            <div className="relative z-10 flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div
                  className="w-8 h-8 rounded-lg border flex items-center justify-center shadow-sm"
                  style={{
                    backgroundColor: `${accentColor}20`,
                    borderColor: `${accentColor}60`,
                    color: accentColor,
                  }}
                >
                  <Music className="w-4 h-4 animate-bounce" />
                </div>
                <div>
                  <div className="text-xs font-bold font-mono tracking-wider text-white uppercase flex items-center gap-1.5">
                    <span>SAYRON CYBER DECK</span>
                    <span
                      className="w-1.5 h-1.5 rounded-full animate-ping"
                      style={{ backgroundColor: accentColor }}
                    />
                  </div>
                  <div className="text-[10px] font-mono text-slate-400">
                    {usingSynth ? 'Synthesizer Active' : 'Live High-Res Audio'}
                  </div>
                </div>
              </div>

              {/* Tab Navigation Buttons */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setActiveTab('deck')}
                  title="DJ Deck View"
                  className={`p-2 rounded-xl border text-xs font-mono transition-all cursor-pointer ${
                    activeTab === 'deck'
                      ? 'text-white'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                  style={
                    activeTab === 'deck'
                      ? {
                          backgroundColor: `${accentColor}30`,
                          borderColor: accentColor,
                          color: '#ffffff',
                          boxShadow: `0 0 10px ${accentColor}60`,
                        }
                      : {}
                  }
                >
                  <Disc3 className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('playlist')}
                  title="Playlist Tracks"
                  className={`p-2 rounded-xl border text-xs font-mono transition-all cursor-pointer ${
                    activeTab === 'playlist'
                      ? 'text-white'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                  style={
                    activeTab === 'playlist'
                      ? {
                          backgroundColor: `${accentColor}30`,
                          borderColor: accentColor,
                          color: '#ffffff',
                          boxShadow: `0 0 10px ${accentColor}60`,
                        }
                      : {}
                  }
                >
                  <ListMusic className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700 transition-colors cursor-pointer"
                  title="Minimize (Keep playing)"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* TAB 1: DJ DECK VIEW */}
            {activeTab === 'deck' && (
              <div className="relative z-10 flex flex-col items-center gap-3.5 py-1">
                {/* Holographic Rotating Vinyl with Dynamic Reactive LED Glow */}
                <div className="relative w-40 h-40 flex items-center justify-center select-none">
                  {/* Outer Pulsing Soundwave Orbit Rings */}
                  <div
                    className={`absolute inset-0 rounded-full border border-dashed transition-all duration-700 ${
                      isPlaying ? 'animate-spin-slow opacity-90' : 'opacity-30'
                    }`}
                    style={{ borderColor: accentColor }}
                  />
                  <div
                    className={`absolute inset-2 rounded-full border transition-all duration-500 ${
                      isPlaying ? 'animate-ping opacity-25' : 'opacity-10'
                    }`}
                    style={{ borderColor: accentColor }}
                  />

                  {/* Vinyl Disc Body with Grooves */}
                  <div
                    className={`relative w-36 h-36 rounded-full p-1 bg-gradient-to-tr from-black via-slate-900 to-black border shadow-2xl ${
                      isPlaying ? 'animate-spin-slow' : ''
                    }`}
                    style={{
                      borderColor: `${accentColor}80`,
                      boxShadow: `0 0 25px ${accentColor}40`,
                    }}
                  >
                    {/* Concentric Vinyl Grooves */}
                    <div className="w-full h-full rounded-full overflow-hidden bg-slate-950 flex items-center justify-center relative border border-slate-800">
                      <img
                        src={currentSong.coverUrl || '/sayron_md_banner.jpg'}
                        alt={currentSong.title}
                        className="w-full h-full object-cover opacity-85"
                      />
                      {/* Center Spindle & Cyber Label */}
                      <div
                        className="absolute w-10 h-10 rounded-full bg-slate-950 border-2 flex items-center justify-center shadow-inner"
                        style={{ borderColor: accentColor }}
                      >
                        <Disc3
                          className="w-5 h-5 animate-spin"
                          style={{ color: accentColor }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Song Meta Information */}
                <div className="text-center w-full px-2">
                  <span
                    className="text-[10px] font-mono tracking-widest uppercase px-2.5 py-0.5 rounded-full border inline-block mb-1"
                    style={{
                      color: accentColor,
                      backgroundColor: `${accentColor}15`,
                      borderColor: `${accentColor}45`,
                    }}
                  >
                    {currentSong.category || 'CYBER BEAT'}
                  </span>
                  <h3 className="text-sm font-extrabold text-white truncate drop-shadow-md">
                    {currentSong.title}
                  </h3>
                  <p className="text-xs font-mono text-slate-400 truncate mt-0.5">
                    {currentSong.artist}
                  </p>
                </div>

                {/* Real-time Dynamic Equalizer Frequency Waveform Bars */}
                <div className="flex items-end justify-center gap-1.5 h-7 w-full px-4 py-0.5 select-none">
                  {[40, 75, 55, 90, 60, 100, 45, 80, 65, 95, 50, 85, 70, 45].map((height, i) => (
                    <div
                      key={i}
                      className="w-1.5 rounded-full transition-all duration-150"
                      style={{
                        backgroundColor: isPlaying ? accentColor : '#334155',
                        height: isPlaying
                          ? `${Math.max(15, (height * (1 + Math.sin(currentTime * 4 + i))) % 100)}%`
                          : '15%',
                        boxShadow: isPlaying ? `0 0 6px ${accentColor}` : 'none',
                      }}
                    />
                  ))}
                </div>

                {/* Timeline Progress Slider */}
                <div className="w-full flex flex-col gap-1 px-1">
                  <input
                    type="range"
                    min="0"
                    max={duration || 100}
                    value={currentTime}
                    onChange={handleSeek}
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer"
                    style={{ accentColor }}
                  />
                  <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 px-0.5">
                    <span>{formatTime(currentTime)}</span>
                    <span>{formatTime(duration)}</span>
                  </div>
                </div>

                {/* Transport Controls */}
                <div className="flex items-center justify-center gap-6 mt-0.5">
                  <button
                    type="button"
                    onClick={handlePrev}
                    title="Previous Track"
                    className="p-3 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white transition-all hover:scale-105 cursor-pointer"
                  >
                    <SkipBack className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={togglePlay}
                    title={isPlaying ? 'Pause' : 'Play'}
                    className="w-13 h-13 rounded-full text-black flex items-center justify-center font-bold hover:scale-105 active:scale-95 transition-all cursor-pointer shadow-lg"
                    style={{
                      backgroundColor: accentColor,
                      boxShadow: `0 0 22px ${accentColor}90`,
                    }}
                  >
                    {isPlaying ? (
                      <Pause className="w-6 h-6 fill-black" />
                    ) : (
                      <Play className="w-6 h-6 fill-black ml-0.5" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleNext}
                    title="Next Track"
                    className="p-3 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white transition-all hover:scale-105 cursor-pointer"
                  >
                    <SkipForward className="w-4 h-4" />
                  </button>
                </div>

                {/* Volume Slider & Mute Toggle */}
                <div className="w-full flex items-center gap-2 px-2 pt-1">
                  <button
                    type="button"
                    onClick={toggleMute}
                    className="text-slate-400 hover:text-white cursor-pointer"
                  >
                    {isMuted || volume === 0 ? (
                      <VolumeX className="w-4 h-4 text-rose-400" />
                    ) : (
                      <Volume2 className="w-4 h-4" style={{ color: accentColor }} />
                    )}
                  </button>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={isMuted ? 0 : volume}
                    onChange={handleVolume}
                    className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer"
                    style={{ accentColor }}
                  />
                </div>
              </div>
            )}

            {/* TAB 2: PLAYLIST TRACK LIST */}
            {activeTab === 'playlist' && (
              <div className="relative z-10 flex flex-col gap-2 max-h-80 overflow-y-auto pr-1 py-1">
                <div className="flex items-center justify-between text-xs font-mono text-slate-400 pb-1 border-b border-slate-800">
                  <span>PLAYLIST TRACKS ({playlist.length})</span>
                  <span className="text-[10px] text-emerald-400 font-mono flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>Live Deck</span>
                  </span>
                </div>

                {playlist.length === 0 ? (
                  <div className="py-8 text-center text-xs font-mono text-slate-500">
                    No songs in deck yet. Admin can add songs from /sufyan-control.
                  </div>
                ) : (
                  playlist.map((song, idx) => {
                    const active = idx === currentIndex;
                    return (
                      <div
                        key={song.id}
                        onClick={() => {
                          setCurrentIndex(idx);
                          setCurrentTime(0);
                          setIsPlaying(true);
                          stopCyberSynth();
                          setActiveTab('deck');
                          setTimeout(() => {
                            if (audioRef.current) {
                              audioRef.current.play().catch(() => startCyberSynth());
                            }
                          }, 100);
                        }}
                        className={`w-full flex items-center justify-between p-2 rounded-2xl text-left transition-all cursor-pointer group ${
                          active
                            ? 'border'
                            : 'bg-slate-900/60 hover:bg-slate-800/80 border border-slate-800/80'
                        }`}
                        style={
                          active
                            ? {
                                backgroundColor: `${accentColor}20`,
                                borderColor: `${accentColor}80`,
                                boxShadow: `0 0 12px ${accentColor}30`,
                              }
                            : {}
                        }
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <div className="w-9 h-9 rounded-lg overflow-hidden bg-slate-950 flex-shrink-0 border border-slate-700">
                            <img
                              src={song.coverUrl || '/sayron_md_banner.jpg'}
                              alt={song.title}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div
                              className={`text-xs font-bold truncate ${
                                active ? 'text-white' : 'text-slate-200'
                              }`}
                            >
                              {song.title}
                            </div>
                            <div className="text-[10px] font-mono text-slate-400 truncate">
                              {song.artist}
                            </div>
                          </div>
                        </div>

                        {/* Right: Sparkle or Category */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {active && isPlaying ? (
                            <Sparkles
                              className="w-3.5 h-3.5 animate-spin"
                              style={{ color: accentColor }}
                            />
                          ) : (
                            <span className="text-[10px] font-mono text-slate-500">
                              {song.duration || 'Track'}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* Footer Note */}
            <div className="relative z-10 text-[10px] font-mono text-slate-500 text-center border-t border-slate-800 pt-2 flex items-center justify-center gap-2">
              <span>👑 SAYRON MD Audio Core</span>
              <span>•</span>
              <span className="text-slate-400">Back karne par song bnd nahi hoga</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
