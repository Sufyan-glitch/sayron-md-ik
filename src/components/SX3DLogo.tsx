import React from 'react';

interface S3DLogoProps {
  size?: number;
  className?: string;
  glow?: boolean;
  animated?: boolean;
}

export const S3DLogo: React.FC<S3DLogoProps> = ({
  size = 48,
  className = '',
  glow = true,
  animated = true,
}) => {
  const idPrefix = React.useId().replace(/:/g, '');

  return (
    <div
      className={`relative inline-flex items-center justify-center select-none ${className}`}
      style={{ width: size, height: size }}
    >
      {/* Background Ambient Radial Glow */}
      {glow && (
        <div
          className={`absolute inset-0 rounded-full bg-gradient-to-tr from-cyan-500/35 via-blue-600/30 to-purple-600/40 blur-md -z-10 ${
            animated ? 'animate-pulse' : ''
          }`}
          style={{ transform: 'scale(1.25)' }}
        />
      )}

      <svg
        viewBox="0 0 200 200"
        width={size}
        height={size}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`w-full h-full drop-shadow-[0_4px_18px_rgba(0,240,255,0.5)] ${
          animated ? 'hover:scale-105 transition-transform duration-300' : ''
        }`}
      >
        <defs>
          {/* Cyan to Electric Blue Gradient */}
          <linearGradient id={`${idPrefix}-cyan-blue`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#00f0ff" />
            <stop offset="45%" stopColor="#0077fe" />
            <stop offset="100%" stopColor="#6366f1" />
          </linearGradient>

          {/* Electric Purple to Neon Magenta Gradient */}
          <linearGradient id={`${idPrefix}-purple-magenta`} x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#9333ea" />
            <stop offset="50%" stopColor="#c026d3" />
            <stop offset="100%" stopColor="#00f0ff" />
          </linearGradient>

          {/* Crown Royal Gradient */}
          <linearGradient id={`${idPrefix}-crown-grad`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="35%" stopColor="#818cf8" />
            <stop offset="70%" stopColor="#c084fc" />
            <stop offset="100%" stopColor="#ec4899" />
          </linearGradient>

          {/* 3D Bevel Dark Depth */}
          <linearGradient id={`${idPrefix}-bevel-dark`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#030712" />
            <stop offset="100%" stopColor="#0c183b" />
          </linearGradient>

          {/* Orbital Ring Gradient */}
          <linearGradient id={`${idPrefix}-orbit-grad`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#00f0ff" stopOpacity="0.95" />
            <stop offset="35%" stopColor="#38bdf8" stopOpacity="0.8" />
            <stop offset="70%" stopColor="#c084fc" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#00f0ff" stopOpacity="0.15" />
          </linearGradient>

          {/* Specular White Highlight */}
          <linearGradient id={`${idPrefix}-specular`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0.05" />
          </linearGradient>

          {/* Glow Filter */}
          <filter id={`${idPrefix}-glow`} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3.5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* 1. BACK ORBIT RING (Passes behind S) */}
        <g opacity="0.85">
          <ellipse
            cx="100"
            cy="114"
            rx="82"
            ry="29"
            transform="rotate(-22 100 114)"
            stroke={`url(#${idPrefix}-orbit-grad)`}
            strokeWidth="4.5"
            strokeDasharray="180 120"
            strokeDashoffset="60"
            strokeLinecap="round"
            filter={`url(#${idPrefix}-glow)`}
          />
        </g>

        {/* 2. THE 3D CENTERED "S" MONOGRAM (Bold, Sleek & Beautiful) */}
        <g id="letter-s-group">
          {/* S 3D Depth Shadow (Bevel Drop) */}
          <path
            d="M 125 70 C 95 68 70 78 70 100 C 70 128 118 123 118 141 C 118 152 104 158 88 158 C 72 158 60 151 56 141 L 38 148 C 45 167 65 178 88 178 C 122 178 144 163 144 141 C 144 111 96 115 96 98 C 96 88 107 83 120 83 C 132 83 143 87 149 96 L 164 84 C 154 73 141 68 125 70 Z"
            fill={`url(#${idPrefix}-bevel-dark)`}
            transform="translate(4, 5)"
            opacity="0.85"
          />

          {/* S Main Body (Dual Cyber Gradient Cyan to Blue & Purple) */}
          <path
            d="M 125 70 C 95 68 70 78 70 100 C 70 128 118 123 118 141 C 118 152 104 158 88 158 C 72 158 60 151 56 141 L 38 148 C 45 167 65 178 88 178 C 122 178 144 163 144 141 C 144 111 96 115 96 98 C 96 88 107 83 120 83 C 132 83 143 87 149 96 L 164 84 C 154 73 141 68 125 70 Z"
            fill={`url(#${idPrefix}-cyan-blue)`}
          />

          {/* S Purple Accent Edge (Lower Half) */}
          <path
            d="M 88 158 C 72 158 60 151 56 141 L 38 148 C 45 167 65 178 88 178 C 122 178 144 163 144 141 C 144 125 128 119 112 124 C 120 134 118 148 100 154 C 95 156 91 158 88 158 Z"
            fill={`url(#${idPrefix}-purple-magenta)`}
            opacity="0.75"
          />

          {/* S Top Specular Highlight */}
          <path
            d="M 122 75 C 98 73 78 82 78 100 C 78 112 92 115 106 119 C 90 114 74 108 74 98 C 74 84 94 76 122 77 Z"
            fill={`url(#${idPrefix}-specular)`}
            opacity="0.75"
          />

          {/* Center Energy Sparkle at Core of S */}
          <circle cx="100" cy="116" r="3.5" fill="#ffffff" filter={`url(#${idPrefix}-glow)`} />
          <circle cx="100" cy="116" r="1.8" fill="#00f0ff" />
        </g>

        {/* 3. FRONT ORBIT RING (Crosses in front of S with glowing satellite orb) */}
        <g>
          <ellipse
            cx="100"
            cy="114"
            rx="82"
            ry="29"
            transform="rotate(-22 100 114)"
            stroke={`url(#${idPrefix}-orbit-grad)`}
            strokeWidth="4.2"
            strokeDasharray="130 170"
            strokeDashoffset="245"
            strokeLinecap="round"
          />
          {/* Satellite Sparkle Orb */}
          <circle
            cx="170"
            cy="84"
            r="4.8"
            fill="#00f0ff"
            filter={`url(#${idPrefix}-glow)`}
          />
          <circle cx="170" cy="84" r="2.2" fill="#ffffff" />
        </g>

        {/* 4. THE 3D ROYAL CROWN (Centered directly on top of "S") */}
        <g id="royal-crown" transform="translate(0, -4)">
          {/* Crown Base Rim */}
          <path
            d="M 68 56 C 78 59 122 59 132 56 C 130 60 126 62 100 63 C 74 62 70 60 68 56 Z"
            fill={`url(#${idPrefix}-cyan-blue)`}
          />
          {/* Crown 5-Spike Body */}
          <path
            d="M 68 56 L 62 36 L 80 47 L 100 24 L 120 47 L 138 36 L 132 56 C 124 59 108 61 100 61 C 92 61 76 59 68 56 Z"
            fill={`url(#${idPrefix}-crown-grad)`}
            filter={`url(#${idPrefix}-glow)`}
          />

          {/* Top Jewels */}
          <circle cx="62" cy="35" r="3" fill="#38bdf8" />
          <circle cx="62" cy="35" r="1.4" fill="#ffffff" />

          <circle cx="80" cy="46" r="2.5" fill="#818cf8" />

          {/* Central Imperial Diamond */}
          <circle cx="100" cy="23" r="4.5" fill="#00f0ff" filter={`url(#${idPrefix}-glow)`} />
          <circle cx="100" cy="23" r="2" fill="#ffffff" />

          <circle cx="120" cy="46" r="2.5" fill="#c084fc" />

          <circle cx="138" cy="35" r="3" fill="#ec4899" />
          <circle cx="138" cy="35" r="1.4" fill="#ffffff" />

          {/* Base Rim Jewels */}
          <circle cx="84" cy="59" r="1.8" fill="#00f0ff" />
          <circle cx="100" cy="60" r="2.2" fill="#ffffff" />
          <circle cx="116" cy="59" r="1.8" fill="#f43f5e" />
        </g>
      </svg>
    </div>
  );
};

// Backwards compatibility alias for SX3DLogo
export const SX3DLogo = S3DLogo;
