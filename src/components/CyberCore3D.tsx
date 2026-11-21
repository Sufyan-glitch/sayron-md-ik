import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface CyberCore3DProps {
  height?: number | string;
  interactive?: boolean;
  intensity?: 'high' | 'medium' | 'subtle';
  subtitle?: string;
}

export const CyberCore3D: React.FC<CyberCore3DProps> = ({
  height = 240,
  interactive = true,
  intensity = 'high',
  subtitle = 'SUFYAN-X-IK CYBER CORE ACTIVE',
}) => {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 320;
    const h = typeof height === 'number' ? height : container.clientHeight || 240;

    // 1. Scene, Camera & WebGL Renderer
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(48, width / h, 0.1, 1000);
    camera.position.set(0, 0, 7.5);

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    container.appendChild(renderer.domElement);

    // 2. Lighting Rig
    const ambientLight = new THREE.AmbientLight(0x0a0f24, 2.5);
    scene.add(ambientLight);

    const cyanLight = new THREE.PointLight(0x00f0ff, 4.5, 20);
    cyanLight.position.set(4, 4, 5);
    scene.add(cyanLight);

    const purpleLight = new THREE.PointLight(0x9d4edd, 4.5, 20);
    purpleLight.position.set(-4, -3, 4);
    scene.add(purpleLight);

    const coreLight = new THREE.PointLight(0x00f0ff, 3, 10);
    coreLight.position.set(0, 0, 0);
    scene.add(coreLight);

    // 3. Central 3D Group
    const coreGroup = new THREE.Group();
    scene.add(coreGroup);

    // Geometry 1: Metallic Cyber Icosahedron Core
    const coreGeo = new THREE.IcosahedronGeometry(1.6, 1);
    const coreMat = new THREE.MeshStandardMaterial({
      color: 0x050814,
      metalness: 0.95,
      roughness: 0.15,
      wireframe: false,
    });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    coreGroup.add(coreMesh);

    // Geometry 2: Outer Holographic Wireframe Cage
    const wireMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      wireframe: true,
      transparent: true,
      opacity: intensity === 'high' ? 0.75 : 0.45,
    });
    const wireMesh = new THREE.Mesh(coreGeo, wireMat);
    wireMesh.scale.setScalar(1.02);
    coreGroup.add(wireMesh);

    // Geometry 3: Inner Pulsing Energy Nucleus
    const nucleusGeo = new THREE.OctahedronGeometry(0.85, 2);
    const nucleusMat = new THREE.MeshBasicMaterial({
      color: 0x9d4edd,
      wireframe: true,
      transparent: true,
      opacity: 0.9,
    });
    const nucleusMesh = new THREE.Mesh(nucleusGeo, nucleusMat);
    coreGroup.add(nucleusMesh);

    // Geometry 4: Concentric Gyroscopic Orbital Rings
    const ringGeo1 = new THREE.TorusGeometry(2.4, 0.028, 16, 96);
    const ringMat1 = new THREE.MeshStandardMaterial({
      color: 0x00f0ff,
      emissive: 0x00f0ff,
      emissiveIntensity: 0.8,
      metalness: 0.8,
      roughness: 0.2,
    });
    const ring1 = new THREE.Mesh(ringGeo1, ringMat1);
    ring1.rotation.x = Math.PI / 3;
    coreGroup.add(ring1);

    const ringGeo2 = new THREE.TorusGeometry(2.8, 0.024, 16, 96);
    const ringMat2 = new THREE.MeshStandardMaterial({
      color: 0x9d4edd,
      emissive: 0x9d4edd,
      emissiveIntensity: 0.9,
      metalness: 0.8,
      roughness: 0.2,
    });
    const ring2 = new THREE.Mesh(ringGeo2, ringMat2);
    ring2.rotation.y = Math.PI / 4;
    ring2.rotation.z = Math.PI / 6;
    coreGroup.add(ring2);

    // Geometry 5: Floating Cyber Particle Dust Field
    const particleCount = intensity === 'high' ? 380 : 160;
    const particlePositions = new Float32Array(particleCount * 3);
    const particleColors = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      const rad = 2.6 + Math.random() * 3.8;

      particlePositions[i * 3] = rad * Math.sin(phi) * Math.cos(theta);
      particlePositions[i * 3 + 1] = rad * Math.sin(phi) * Math.sin(theta);
      particlePositions[i * 3 + 2] = rad * Math.cos(phi);

      const isCyan = Math.random() > 0.45;
      particleColors[i * 3] = isCyan ? 0.0 : 0.61;
      particleColors[i * 3 + 1] = isCyan ? 0.94 : 0.3;
      particleColors[i * 3 + 2] = isCyan ? 1.0 : 0.86;
    }

    const particleGeo = new THREE.BufferGeometry();
    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    particleGeo.setAttribute('color', new THREE.BufferAttribute(particleColors, 3));

    const particleMat = new THREE.PointsMaterial({
      size: 0.075,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
    });
    const particles = new THREE.Points(particleGeo, particleMat);
    scene.add(particles);

    // 4. Interaction (Mouse / Touch tilt tracking)
    let targetRotX = 0;
    let targetRotY = 0;

    const handlePointerMove = (e: MouseEvent | TouchEvent) => {
      if (!interactive) return;
      const rect = container.getBoundingClientRect();
      let clientX = 0;
      let clientY = 0;
      if ('touches' in e && e.touches[0]) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      } else if ('clientX' in e) {
        clientX = e.clientX;
        clientY = e.clientY;
      }
      const x = ((clientX - rect.left) / rect.width) * 2 - 1;
      const y = -(((clientY - rect.top) / rect.height) * 2 - 1);
      targetRotY = x * 0.75;
      targetRotX = -y * 0.55;
    };

    window.addEventListener('mousemove', handlePointerMove, { passive: true });
    window.addEventListener('touchmove', handlePointerMove, { passive: true });

    // 5. Animation Loop
    let animationFrameId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const delta = clock.getDelta();
      const time = clock.getElapsedTime();

      // Smooth idle rotations
      coreGroup.rotation.y += delta * 0.45;
      coreGroup.rotation.x += delta * 0.22;

      // Smooth interactive lerp
      coreGroup.rotation.y += (targetRotY - coreGroup.rotation.y) * 0.05;
      coreGroup.rotation.x += (targetRotX - coreGroup.rotation.x) * 0.05;

      // Independent counter-rotation for gyroscopic rings
      ring1.rotation.z += delta * 0.85;
      ring2.rotation.x -= delta * 0.65;

      // Pulsing nucleus & core light
      const pulse = 1 + Math.sin(time * 3.2) * 0.12;
      nucleusMesh.scale.set(pulse, pulse, pulse);
      coreLight.intensity = 2.5 + Math.sin(time * 4) * 1.5;

      // Orbit particles slowly
      particles.rotation.y -= delta * 0.15;
      particles.rotation.x += delta * 0.08;

      renderer.render(scene, camera);
    };

    animate();

    // 6. Responsive Resize Handling
    const handleResize = () => {
      if (!container) return;
      const newWidth = container.clientWidth || 320;
      const newHeight = typeof height === 'number' ? height : container.clientHeight || 240;
      camera.aspect = newWidth / newHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(newWidth, newHeight);
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    // 7. Resource Cleanup & Memory Safety
    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('touchmove', handlePointerMove);
      resizeObserver.disconnect();

      coreGeo.dispose();
      coreMat.dispose();
      wireMat.dispose();
      nucleusGeo.dispose();
      nucleusMat.dispose();
      ringGeo1.dispose();
      ringMat1.dispose();
      ringGeo2.dispose();
      ringMat2.dispose();
      particleGeo.dispose();
      particleMat.dispose();

      renderer.dispose();
      if (renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [height, interactive, intensity]);

  return (
    <div className="relative w-full overflow-hidden rounded-2xl bg-gradient-to-b from-black/80 via-[#070b19]/90 to-black/90 border border-cyan-500/25 shadow-[0_0_35px_rgba(0,240,255,0.15)] flex flex-col items-center justify-center p-2">
      {/* 3D WebGL Canvas */}
      <div
        ref={mountRef}
        style={{ height: typeof height === 'number' ? `${height}px` : height }}
        className="w-full flex items-center justify-center"
      />

      {/* Cyberpunk HUD Overlay Brackets */}
      <div className="pointer-events-none absolute inset-0 p-3 flex flex-col justify-between">
        <div className="flex justify-between items-center text-[10px] font-mono tracking-widest text-cyan-400/80">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_8px_#00f0ff]" />
            <span>CORE::ONLINE</span>
          </div>
          <span className="text-purple-400/80 font-mono">NODE//3D_MESH</span>
        </div>

        <div className="flex justify-between items-center text-[9px] font-mono tracking-wider text-slate-400">
          <span className="text-cyan-300 font-bold tracking-widest">SUFYAN-X-IK</span>
          <span className="text-purple-300 tracking-wider">HOLO_STABILITY: 99.9%</span>
        </div>
      </div>

      {/* Bottom Glow Pill */}
      {subtitle && (
        <div className="mt-1 flex items-center gap-2 px-3 py-0.5 rounded-full bg-black/60 border border-cyan-500/30 text-[10px] font-mono text-cyan-300 uppercase tracking-widest shadow-[0_0_15px_rgba(0,240,255,0.2)]">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
          <span>{subtitle}</span>
        </div>
      )}
    </div>
  );
};
