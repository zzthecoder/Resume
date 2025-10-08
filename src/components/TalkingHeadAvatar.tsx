import { useEffect, useRef, useState } from 'react';

// Declare global types for TalkingHead
declare global {
  interface Window {
    TalkingHead?: new (container: HTMLElement, options?: any) => any;
  }
}

interface TalkingHeadAvatarProps {
  className?: string;
  avatarUrl?: string;
  onLoading?: (loading: boolean) => void;
  id?: string;
}

export function TalkingHeadAvatar({ 
  className, 
  avatarUrl = "https://models.readyplayer.me/z-b8k5eq.glb?morphTargets=ARKit,Oculus+Visemes,mouthOpen,mouthSmile,eyesClosed,eyesLookUp,eyesLookDown&textureSizeLimit=1024&textureFormat=png", 
  onLoading,
  id = "talkinghead-avatar"
}: TalkingHeadAvatarProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const headRef = useRef<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const loadTalkingHeadScript = (): Promise<any> => {
      return new Promise((resolve, reject) => {
        // Check if TalkingHead is already loaded
        if (window.TalkingHead) {
          resolve(window.TalkingHead);
          return;
        }

        // Create a timeout for loading
        const timeout = setTimeout(() => {
          reject(new Error('TalkingHead loading timeout'));
        }, 20000); // Increased timeout

        // Load the module script
        const moduleScript = document.createElement('script');
        moduleScript.type = 'module';
        moduleScript.textContent = `
          try {
            console.log('Loading TalkingHead...');
            const { TalkingHead } = await import("talkinghead");
            console.log('TalkingHead loaded successfully');
            window.TalkingHead = TalkingHead;
            window.dispatchEvent(new Event('talkinghead-loaded'));
          } catch (error) {
            console.error('TalkingHead import error:', error);
            window.dispatchEvent(new CustomEvent('talkinghead-error', { detail: error }));
          }
        `;

        moduleScript.onerror = (error) => {
          console.error('Script loading error:', error);
          reject(new Error('Failed to load TalkingHead script'));
        };
        document.head.appendChild(moduleScript);

        // Listen for the loaded event
        const handleLoaded = () => {
          clearTimeout(timeout);
          window.removeEventListener('talkinghead-loaded', handleLoaded);
          window.removeEventListener('talkinghead-error', handleError);
          console.log('TalkingHead ready for use');
          resolve(window.TalkingHead);
        };

        const handleError = (event: any) => {
          clearTimeout(timeout);
          window.removeEventListener('talkinghead-loaded', handleLoaded);
          window.removeEventListener('talkinghead-error', handleError);
          console.error('TalkingHead error event:', event.detail);
          reject(new Error('TalkingHead loading failed: ' + (event.detail?.message || 'Unknown error')));
        };

        window.addEventListener('talkinghead-loaded', handleLoaded);
        window.addEventListener('talkinghead-error', handleError);
      });
    };

    const initializeTalkingHead = async () => {
      if (!containerRef.current) return;

      try {
        setLoading(true);
        onLoading?.(true);

        // Load TalkingHead
        const TalkingHead = await loadTalkingHeadScript();

        if (!mounted) return;

        console.log('Creating TalkingHead instance...');
        // Create TalkingHead instance
        const head = new TalkingHead(containerRef.current, {
          ttsEndpoint: null, // Disable TTS for now
          cameraView: "head",
          lipsyncModules: ["en"],
          avatarMood: 'neutral',
          modelPixelRatio: 1,
          modelMovementFactor: 1
        });

        headRef.current = head;

        console.log('Loading avatar from:', avatarUrl);
        
        // Try loading the avatar with multiple fallback URLs
        const fallbackUrls = [
          avatarUrl,
          "https://models.readyplayer.me/64bfa15f0e72c63d7c3934a6.glb?morphTargets=ARKit,Oculus+Visemes,mouthOpen,mouthSmile,eyesClosed,eyesLookUp,eyesLookDown&textureSizeLimit=1024&textureFormat=png", // TalkingHead default
          "https://models.readyplayer.me/z-b8k5eq.glb?morphTargets=ARKit&textureSizeLimit=512", // Simplified version
        ];

        let avatarLoaded = false;
        
        for (const url of fallbackUrls) {
          if (avatarLoaded) break;
          
          try {
            console.log('Trying avatar URL:', url);
            await head.showAvatar({
              url: url,
              body: 'M',
              avatarMood: 'neutral',
              lipsyncLang: 'en'
            }, (progress: any) => {
              if (progress.lengthComputable) {
                const percent = Math.round((progress.loaded / progress.total) * 100);
                console.log(`Loading avatar: ${percent}%`);
              } else {
                console.log(`Loading avatar: ${Math.round(progress.loaded / 1024)} KB`);
              }
            });
            
            console.log('Avatar loaded successfully from:', url);
            avatarLoaded = true;
            break;
          } catch (avatarError) {
            console.warn('Failed to load avatar from:', url, avatarError);
            if (url === fallbackUrls[fallbackUrls.length - 1]) {
              throw new Error('Failed to load avatar from all URLs');
            }
          }
        }

        if (mounted) {
          setLoading(false);
          onLoading?.(false);
        }

        // Expose methods globally for speech control
        (window as any)[`${id.replace('-', '_')}_startTalking`] = () => {
          // TalkingHead has built-in lip sync, we can trigger it manually if needed
          console.log(`${id} started talking`);
        };

        (window as any)[`${id.replace('-', '_')}_stopTalking`] = () => {
          console.log(`${id} stopped talking`);
        };

      } catch (err) {
        console.error('Error initializing TalkingHead:', err);
        if (mounted) {
          setError('Failed to load avatar. Using fallback display.');
          setLoading(false);
          onLoading?.(false);
        }
      }
    };

    initializeTalkingHead();

    return () => {
      mounted = false;
      // Cleanup
      if (headRef.current && typeof headRef.current.dispose === 'function') {
        try {
          headRef.current.dispose();
        } catch (e) {
          console.warn('Error disposing TalkingHead:', e);
        }
      }
      headRef.current = null;
    };
  }, [avatarUrl, onLoading, id]);

  if (error) {
    return (
      <div className={className}>
        <div className="flex items-center justify-center h-full">
          <div className="w-48 h-48 rounded-full bg-gradient-to-br from-primary to-secondary animate-pulse flex items-center justify-center text-white text-sm text-center p-4">
            <div>
              <div className="w-16 h-16 bg-white/20 rounded-full mx-auto mb-2 flex items-center justify-center">
                👤
              </div>
              <div className="text-xs">Marzook's Avatar</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <div ref={containerRef} className="w-full h-full" />
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