import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { checkWebGLSupport } from '@/lib/avatarControls';
import { useAnimationDriver } from './useAnimationDriver';

interface AvatarCanvasProps {
  rpmUrl?: string;
  onSpeaking?: (speaking: boolean) => void;
  className?: string;
}

// Marzook's ReadyPlayer.me Avatar URL
const DEFAULT_RPM_URL = "https://z-b8k5eq.readyplayer.me/avatar";

export function AvatarCanvas({ rpmUrl = DEFAULT_RPM_URL, className }: AvatarCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const avatarRef = useRef<THREE.Object3D | null>(null);
  const meshRef = useRef<THREE.SkinnedMesh | null>(null);
  const [hasWebGL, setHasWebGL] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const { startTalking, stopTalking, cleanup } = useAnimationDriver();

  useEffect(() => {
    if (!checkWebGLSupport()) {
      setHasWebGL(false);
      setLoading(false);
      return;
    }

    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    // Scene setup
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(
      35,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    );
    camera.position.set(0, 0.15, 0.8);
    camera.lookAt(0, 0.1, 0);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
    });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    rendererRef.current = renderer;

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
    directionalLight.position.set(0.5, 1, 1);
    scene.add(directionalLight);

    const fillLight = new THREE.DirectionalLight(0x7dd3fc, 0.5);
    fillLight.position.set(-0.5, 0, 0.5);
    scene.add(fillLight);

    // Load avatar
    const loader = new GLTFLoader();
    loader.load(
      rpmUrl,
      (gltf) => {
        const avatar = gltf.scene;
        avatarRef.current = avatar;
        
        // Find the head mesh with morphTargets
        avatar.traverse((child) => {
          if ((child as THREE.SkinnedMesh).isSkinnedMesh) {
            const mesh = child as THREE.SkinnedMesh;
            if (mesh.morphTargetDictionary && mesh.morphTargetInfluences) {
              meshRef.current = mesh;
            }
          }
        });

        // Position and scale avatar
        avatar.position.set(0, -0.5, 0);
        avatar.scale.set(1, 1, 1);
        scene.add(avatar);
        
        setLoading(false);
      },
      undefined,
      (err) => {
        console.error('Error loading avatar:', err);
        setError(true);
        setLoading(false);
      }
    );

    // Animation loop
    let animationId: number;
    const animate = () => {
      animationId = requestAnimationFrame(animate);
      
      // Gentle idle rotation
      if (avatarRef.current && meshRef.current?.morphTargetInfluences) {
        const influences = meshRef.current.morphTargetInfluences;
        const dict = meshRef.current.morphTargetDictionary;
        
        // Subtle idle breathing
        const breathe = Math.sin(Date.now() * 0.0008) * 0.02 + 0.02;
        if (dict && 'mouthOpen' in dict) {
          influences[dict['mouthOpen']] = breathe;
        }
      }

      renderer.render(scene, camera);
    };
    animate();

    // Handle resize
    const handleResize = () => {
      if (!container || !camera || !renderer) return;
      const width = container.clientWidth;
      const height = container.clientHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationId);
      cleanup();
      renderer.dispose();
    };
  }, [rpmUrl, cleanup]);

  const setMouthOpen = (value: number) => {
    if (!meshRef.current) return;
    const { morphTargetDictionary, morphTargetInfluences } = meshRef.current;
    if (!morphTargetDictionary || !morphTargetInfluences) return;
    
    if ('mouthOpen' in morphTargetDictionary) {
      morphTargetInfluences[morphTargetDictionary['mouthOpen']] = value;
    }
  };

  // Expose methods for external control
  useEffect(() => {
    (window as any).avatarStartTalking = () => {
      startTalking(setMouthOpen);
    };
    (window as any).avatarStopTalking = () => {
      stopTalking(setMouthOpen);
    };
  }, [startTalking, stopTalking]);

  if (!hasWebGL || error) {
    return (
      <div className={className}>
        <div className="flex items-center justify-center h-full">
          <div className="w-48 h-48 rounded-full bg-gradient-to-br from-primary to-secondary animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={className}>
      <canvas ref={canvasRef} className="w-full h-full" />
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-48 h-48 rounded-full bg-gradient-to-br from-primary to-secondary animate-pulse" />
        </div>
      )}
    </div>
  );
}
