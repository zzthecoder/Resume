import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

interface SimpleAvatarProps {
  className?: string;
  avatarUrl?: string;
  onLoading?: (loading: boolean) => void;
  id?: string;
  animationSet?: 'A1' | 'A2' | 'A3';
  isHero?: boolean;
}

export function SimpleAvatar({ 
  className, 
  avatarUrl = "https://models.readyplayer.me/68e66b471df78dfe0fa9c541.glb?morphTargets=ARKit,Oculus+Visemes,mouthOpen,mouthSmile,eyesClosed,eyesLookUp,eyesLookDown&textureSizeLimit=1024&textureFormat=png", 
  onLoading,
  id = "simple-avatar",
  animationSet = 'A2',
  isHero = false
}: SimpleAvatarProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const avatarRef = useRef<THREE.Object3D | null>(null);
  const meshRef = useRef<THREE.SkinnedMesh | null>(null);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const currentAnimationRef = useRef<THREE.AnimationAction | null>(null);
  const animationClipsRef = useRef<THREE.AnimationClip[]>([]);
  const a3ClipsRef = useRef<THREE.AnimationClip[]>([]);
  const isTalkingRef = useRef<boolean>(false);
  const animationLoopTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Animation file lists
  const animationFiles = {
    A1: [
      'M_Dances_001.glb', 'M_Dances_002.glb', 'M_Dances_004.glb', 'M_Dances_005.glb',
      'M_Dances_006.glb', 'M_Dances_007.glb', 'M_Dances_008.glb', 'M_Dances_009.glb',
      'M_Dances_011.glb', 'M_Falling_Idle_002.glb' // Only dance and falling idle animations - no walks/runs
    ],
    A2: [
      'M_Standing_Idle_Variations_001.glb' // Single idle dance for chat avatar
    ],
    A3: [
      'M_Talking_Variations_001.glb', 'M_Talking_Variations_002.glb',
      'M_Talking_Variations_003.glb', 'M_Talking_Variations_004.glb',
      'M_Talking_Variations_005.glb', 'M_Talking_Variations_006.glb',
      'M_Talking_Variations_007.glb', 'M_Talking_Variations_008.glb',
      'M_Talking_Variations_009.glb', 'M_Talking_Variations_010.glb'
    ]
  };

  useEffect(() => {
    let mounted = true;
    let animationId: number;

    const loadAnimations = async () => {
      const loader = new GLTFLoader();
      const clips: THREE.AnimationClip[] = [];
      
      console.log(`Loading ${animationSet} animations...`);
      
      for (const file of animationFiles[animationSet]) {
        try {
          const gltf = await loader.loadAsync(`/Animations/${animationSet}/${file}`);
          if (gltf.animations && gltf.animations.length > 0) {
            clips.push(...gltf.animations);
            console.log(`Loaded animation from ${file}:`, gltf.animations.length, 'clips');
          }
        } catch (err) {
          console.warn(`Failed to load animation: ${file}`, err);
        }
      }
      
      console.log(`Total clips loaded for ${animationSet}:`, clips.length);
      animationClipsRef.current = clips;
      
      // Also load A3 animations for chat avatars (for talking)
      if (animationSet === 'A2') {
        const a3Clips: THREE.AnimationClip[] = [];
        // Only load talking variations 2 and 3 for smoother talking loop
        const talkingFiles = ['M_Talking_Variations_002.glb', 'M_Talking_Variations_003.glb'];
        for (const file of talkingFiles) {
          try {
            const gltf = await loader.loadAsync(`/Animations/A3/${file}`);
            if (gltf.animations && gltf.animations.length > 0) {
              a3Clips.push(...gltf.animations);
            }
          } catch (err) {
            console.warn(`Failed to load A3 animation: ${file}`, err);
          }
        }
        a3ClipsRef.current = a3Clips;
        console.log(`Loaded A3 clips for talking:`, a3Clips.length);
      }
      
      return clips;
    };

    const fadeOut = (action: THREE.AnimationAction, duration: number = 0.5) => {
      return new Promise<void>((resolve) => {
        const startWeight = action.getEffectiveWeight();
        const startTime = Date.now();
        
        const fade = () => {
          const elapsed = (Date.now() - startTime) / 1000;
          const progress = Math.min(elapsed / duration, 1);
          // Use smooth cubic ease-out for more natural transitions
          const easedProgress = 1 - Math.pow(1 - progress, 4);
          const newWeight = startWeight * (1 - easedProgress);
          
          action.setEffectiveWeight(Math.max(newWeight, 0));
          
          if (progress >= 1) {
            action.stop();
            resolve();
          } else {
            requestAnimationFrame(fade);
          }
        };
        fade();
      });
    };

    const fadeIn = (action: THREE.AnimationAction, duration: number = 0.5) => {
      return new Promise<void>((resolve) => {
        action.setEffectiveWeight(0);
        action.play();
        
        const startTime = Date.now();
        
        const fade = () => {
          const elapsed = (Date.now() - startTime) / 1000;
          const progress = Math.min(elapsed / duration, 1);
          // Use smooth cubic ease-in for more natural transitions
          const easedProgress = Math.pow(progress, 3);
          
          action.setEffectiveWeight(Math.min(easedProgress, 1));
          
          if (progress >= 1) {
            resolve();
          } else {
            requestAnimationFrame(fade);
          }
        };
        fade();
      });
    };

    const playRandomAnimation = async (clipSet?: THREE.AnimationClip[], isLooping: boolean = false) => {
      if (!mixerRef.current || !avatarRef.current) {
        console.warn('Cannot play animation - missing mixer or avatar');
        return;
      }
      
      const clipsToUse = clipSet || animationClipsRef.current;
      if (clipsToUse.length === 0) {
        console.warn('No clips available to play');
        return;
      }
      // Clear any existing timeout
      if (animationLoopTimeoutRef.current) {
        clearTimeout(animationLoopTimeoutRef.current);
        animationLoopTimeoutRef.current = null;
      }

      // Pick a clip to play
      const randomClip = clipsToUse[Math.floor(Math.random() * clipsToUse.length)];
      console.log('Queuing animation:', randomClip.name, 'duration:', randomClip.duration, 'looping:', isLooping);

      const action = mixerRef.current.clipAction(randomClip);
      action.reset();

      // Ensure time scale tuned for hero animations
      if (isHero && animationSet === 'A1') {
        action.setEffectiveTimeScale(0.85);
      } else {
        action.setEffectiveTimeScale(1.0);
      }

      if (isLooping) {
        action.setLoop(THREE.LoopRepeat, Infinity);
      } else {
        action.setLoop(THREE.LoopOnce, 1);
        action.clampWhenFinished = true;
      }

      // Decide fade durations (seconds)
      const fadeDuration = isHero && animationSet === 'A1' ? 0.8 : (animationSet === 'A2' ? 0.6 : 0.4);

      // If there's a current action, cross-fade smoothly
      if (currentAnimationRef.current) {
        try {
          console.log('Crossfading from', currentAnimationRef.current.getClip().name, 'to', randomClip.name, 'duration', fadeDuration);
          // Fade out current, then fade in new action
          await fadeOut(currentAnimationRef.current, fadeDuration);
        } catch (err) {
          console.warn('Fade out failed, stopping previous action directly', err);
          try { currentAnimationRef.current.stop(); } catch {};
        }
      }

      // Fade in the new action (plays internally)
      await fadeIn(action, fadeDuration);
      currentAnimationRef.current = action;
      console.log('Animation crossfade complete:', randomClip.name);
      
      // Queue next animation based on type with ultra-smooth timing
      if (isLooping && isTalkingRef.current) {
        // For talking animations, switch between talking 2 and 3 every few seconds
        const nextDelay = Math.max(randomClip.duration * 1000, 3000) + Math.random() * 2000;
        animationLoopTimeoutRef.current = setTimeout(() => {
          if (mounted && isTalkingRef.current) {
            console.log('Switching talking animation...');
            playRandomAnimation(a3ClipsRef.current, true);
          }
        }, nextDelay);
      } else if (!isTalkingRef.current) {
        // For idle animations with ultra-smooth overlaps
          if (isHero && animationSet === 'A1') {
          // Ultra-smooth A1 transitions
          const animationDuration = randomClip.duration * 1000;
          const nextDelay = animationDuration - 800; // Start new animation 800ms before current ends
          
          console.log(`A1 hero (ULTRA-SMOOTH): "${randomClip.name}" duration: ${animationDuration}ms, next in: ${nextDelay}ms`);
          
            animationLoopTimeoutRef.current = setTimeout(() => {
              if (mounted && !isTalkingRef.current && isHero) {
                playRandomAnimation(animationClipsRef.current, false);
              }
            }, Math.max(nextDelay, 50)); // Minimum 50ms delay
        } else {
          // For chat avatars (A2/A3): A2 has only one idle dance animation
          if (animationSet === 'A2') {
            // Ultra-smooth A2 looping with significant overlap
            const animationDuration = randomClip.duration * 1000;
            const nextDelay = animationDuration - 500; // Start new animation 500ms before current ends
            
            console.log(`A2 idle dance (ULTRA-SMOOTH): "${randomClip.name}" duration: ${animationDuration}ms, next in: ${nextDelay}ms`);
            
            animationLoopTimeoutRef.current = setTimeout(() => {
              if (mounted && !isTalkingRef.current) {
                console.log('Ultra-smoothly looping A2 idle dance animation');
                playRandomAnimation(animationClipsRef.current, false);
              }
            }, Math.max(nextDelay, 50)); // Minimum 50ms delay
          } else {
            // For A3 talking animations: ultra-smooth transitions
            const animationDuration = randomClip.duration * 1000;
            const nextDelay = animationDuration - 400; // Start new animation 400ms before current ends
            
            animationLoopTimeoutRef.current = setTimeout(() => {
              if (mounted && !isTalkingRef.current) {
                console.log('Ultra-smoothly queuing next A3 animation');
                playRandomAnimation(animationClipsRef.current, false);
              }
            }, Math.max(nextDelay, 50)); // Minimum 50ms delay
          }
        }
      }
    };

    const initializeAvatar = async () => {
      if (!containerRef.current || !canvasRef.current) return;

      try {
        setLoading(true);
        onLoading?.(true);

        const canvas = canvasRef.current;
        const container = containerRef.current;

        // Scene setup
        const scene = new THREE.Scene();
        sceneRef.current = scene;

  // Camera - Adjusted for chest-up view
  // Use slightly wider FOV on small screens for better framing
  const isSmallScreen = container.clientWidth < 768; // treat tablets/phones as small
        const camera = new THREE.PerspectiveCamera(
          isHero ? (isSmallScreen ? 38 : 30) : (isSmallScreen ? 42 : 35),
          container.clientWidth / container.clientHeight,
          0.1,
          1000
        );
        
        if (isHero) {
          // On small screens, move camera closer for a more 'zoomed' avatar
          if (isSmallScreen) {
            // Move camera closer on small screens but keep a slightly higher Y to avoid crouch framing
            camera.position.set(0, 1.55, 1.0);
            camera.lookAt(0, 1.45, 0);
          } else {
            camera.position.set(0, 1.6, 2.5); // Position for chest-up view on desktop
            camera.lookAt(0, 1.4, 0); // Look at chest level
          }
        } else {
          camera.position.set(0, 1.6, 1.8); // Closer for chat
          camera.lookAt(0, 1.4, 0);
        }
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
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        rendererRef.current = renderer;

        // Lights
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
        scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
        directionalLight.position.set(0.5, 2, 1);
        directionalLight.castShadow = true;
        scene.add(directionalLight);

        const fillLight = new THREE.DirectionalLight(0x7dd3fc, 0.5);
        fillLight.position.set(-0.5, 1, 0.5);
        scene.add(fillLight);

        // Try multiple avatar URLs
        const fallbackUrls = [
          avatarUrl,
          "https://models.readyplayer.me/68e66b471df78dfe0fa9c541.glb?morphTargets=ARKit&textureSizeLimit=512",
          "https://models.readyplayer.me/68e66b471df78dfe0fa9c541.glb",
          "https://models.readyplayer.me/64bfa15f0e72c63d7c3934a6.glb?morphTargets=ARKit,Oculus+Visemes,mouthOpen,mouthSmile&textureSizeLimit=1024&textureFormat=png",
        ];

        let avatarLoaded = false;
        const loader = new GLTFLoader();

        for (const url of fallbackUrls) {
          if (avatarLoaded || !mounted) break;
          
          try {
            console.log('Trying to load avatar from:', url);
            const gltf = await loader.loadAsync(url);
            
            const avatar = gltf.scene;
            avatarRef.current = avatar;
            
            // Setup animation mixer
            const mixer = new THREE.AnimationMixer(avatar);
            mixerRef.current = mixer;
            console.log('Animation mixer created for avatar');
            
            // Find the head mesh with morphTargets
            avatar.traverse((child) => {
              if ((child as THREE.SkinnedMesh).isSkinnedMesh) {
                const mesh = child as THREE.SkinnedMesh;
                if (mesh.morphTargetDictionary && mesh.morphTargetInfluences) {
                  meshRef.current = mesh;
                  console.log('Found morph targets:', Object.keys(mesh.morphTargetDictionary));
                }
                mesh.castShadow = true;
                mesh.receiveShadow = true;
              }
            });

            // Position and scale avatar
            avatar.position.set(0, 0, 0);
            // On small screens for hero, scale avatar up so it visually fills more of the viewport
            if (isSmallScreen && isHero) {
              // Increase scale so avatar visually fills more of mobile viewport but avoid over-scaling
              avatar.scale.set(1.4, 1.4, 1.4);
              // Small upward nudge so model doesn't look crouched
              avatar.position.set(0, -0.12, 0);
            } else {
              avatar.scale.set(1, 1, 1);
            }
            scene.add(avatar);
            
            avatarLoaded = true;
            console.log('Avatar loaded successfully from:', url);
            break;
          } catch (err) {
            console.warn('Failed to load avatar from:', url, err);
          }
        }

        if (!avatarLoaded) {
          throw new Error('Failed to load avatar from all URLs');
        }

        // Load animations after avatar is loaded
        console.log('Loading animations for', animationSet, '...');
        const loadedClips = await loadAnimations();
        console.log('Animations loaded:', loadedClips.length);

        if (mounted) {
          setLoading(false);
          onLoading?.(false);
          
          // Start animation loop with much longer delay for A1 stability
          if (loadedClips.length > 0) {
            const startupDelay = (isHero && animationSet === 'A1') ? 5000 : (isHero ? 1500 : 3000); // Much longer delay for A1
            console.log(`Starting ${isHero ? 'hero' : 'chat'} animation loop in ${startupDelay}ms...`);
            setTimeout(() => {
              if (mounted) {
                console.log('Starting first animation');
                playRandomAnimation(animationClipsRef.current, false);
              }
            }, startupDelay);
          } else {
            console.warn('No animations loaded for', animationSet);
          }
        }

        // Animation loop
        const clock = new THREE.Clock();
        const animate = () => {
          if (!mounted) return;
          animationId = requestAnimationFrame(animate);
          
          const delta = clock.getDelta();
          
          // Update animation mixer
          if (mixerRef.current) {
            mixerRef.current.update(delta);
          }
          
          // Subtle idle animations when no animation is playing or as backup
          if (avatarRef.current && meshRef.current?.morphTargetInfluences) {
            const influences = meshRef.current.morphTargetInfluences;
            const dict = meshRef.current.morphTargetDictionary;
            
            // NO backup animations - let only scheduled animations handle everything
            // This prevents any default state animations from interfering
            
            // Add subtle breathing effect only
            const breathe = Math.sin(Date.now() * 0.001) * 0.02 + 0.02;
            if (dict && 'mouthOpen' in dict) {
              influences[dict['mouthOpen']] = Math.max(influences[dict['mouthOpen']] || 0, breathe);
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

        // Expose methods for external control
        (window as any)[`${id.replace('-', '_')}_startTalking`] = async () => {
          console.log('Starting talking animation (0.5s before speech)...');
          
          // Start talking state exactly 0.5 seconds before speech begins
          setTimeout(() => {
            isTalkingRef.current = true;
            
            // Clear any existing animation timeout
            if (animationLoopTimeoutRef.current) {
              clearTimeout(animationLoopTimeoutRef.current);
              animationLoopTimeoutRef.current = null;
            }
            
            // Immediately switch to A3 talking animations (variations 2 and 3 only)
            if (a3ClipsRef.current.length > 0) {
              playRandomAnimation(a3ClipsRef.current, true);
            }
            
            // Also do morph target animation for mouth movement
            if (meshRef.current?.morphTargetInfluences && meshRef.current.morphTargetDictionary) {
              const dict = meshRef.current.morphTargetDictionary;
              const influences = meshRef.current.morphTargetInfluences;
              
              const talkingAnimation = () => {
                if (isTalkingRef.current) {
                  const talkValue = Math.sin(Date.now() * 0.012) * 0.4 + 0.4;
                  if ('mouthOpen' in dict) {
                    influences[dict['mouthOpen']] = talkValue;
                  }
                }
              };
              
              (window as any)[`${id}_talkingInterval`] = setInterval(talkingAnimation, 40);
            }
          }, 500); // Start exactly 0.5 seconds before
        };

        (window as any)[`${id.replace('-', '_')}_stopTalking`] = async () => {
          console.log('Stopping talking animation (on time)...');
          
          // End exactly on time when speech ends
          isTalkingRef.current = false;
          
          // Stop morph target animation
          if ((window as any)[`${id}_talkingInterval`]) {
            clearInterval((window as any)[`${id}_talkingInterval`]);
          }
          
          // Clear any existing timeout
          if (animationLoopTimeoutRef.current) {
            clearTimeout(animationLoopTimeoutRef.current);
            animationLoopTimeoutRef.current = null;
          }
          
          // Reset mouth to idle
          if (meshRef.current?.morphTargetInfluences && meshRef.current.morphTargetDictionary) {
            const dict = meshRef.current.morphTargetDictionary;
            const influences = meshRef.current.morphTargetInfluences;
            if ('mouthOpen' in dict) {
              influences[dict['mouthOpen']] = 0.01;
            }
          }
          
          // Switch back to A2 (idle dance) animations smoothly  
          setTimeout(async () => {
            if (!isTalkingRef.current && animationClipsRef.current.length > 0) {
              console.log('Switching back to A2 idle dance (default stance)...');
              // For A2, we want to loop the single idle dance animation
              await playRandomAnimation(animationClipsRef.current, false);
            }
          }, 300); // Shorter delay for quicker return to default idle stance
        };

        return () => {
          window.removeEventListener('resize', handleResize);
          if (animationId) {
            cancelAnimationFrame(animationId);
          }
          if (animationLoopTimeoutRef.current) {
            clearTimeout(animationLoopTimeoutRef.current);
          }
          if ((window as any)[`${id}_talkingInterval`]) {
            clearInterval((window as any)[`${id}_talkingInterval`]);
          }
          renderer.dispose();
        };

      } catch (err) {
        console.error('Error initializing avatar:', err);
        if (mounted) {
          setError('Failed to load avatar. Showing fallback.');
          setLoading(false);
          onLoading?.(false);
        }
      }
    };

    initializeAvatar();

    return () => {
      mounted = false;
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
      if (mixerRef.current) {
        mixerRef.current.stopAllAction();
      }
    };
  }, [avatarUrl, onLoading, id, animationSet, isHero]);

  if (error) {
    return (
      <div className={className}>
        <div className="flex items-center justify-center h-full">
          <div className="w-48 h-48 rounded-full bg-gradient-to-br from-primary to-secondary animate-pulse flex items-center justify-center text-white text-sm text-center p-4">
            <div>
              <div className="w-16 h-16 bg-white/20 rounded-full mx-auto mb-2 flex items-center justify-center text-2xl">
                👤
              </div>
              <div className="text-xs">Marzook's Avatar</div>
              <div className="text-xs mt-1 opacity-70">Click to chat!</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={className}>
      <canvas ref={canvasRef} className="w-full h-full" />
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-48 h-48 rounded-full bg-gradient-to-br from-primary to-secondary animate-pulse flex items-center justify-center text-white text-sm">
            Loading Avatar...
          </div>
        </div>
      )}
    </div>
  );
}
