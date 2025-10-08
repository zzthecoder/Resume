import { Button } from '@/components/ui/button';
import { SimpleAvatar } from '@/components/SimpleAvatar';
import { ChevronDown } from 'lucide-react';

interface HeroProps {
  onStartChat: () => void;
  name: string;
  bio: string;
  tagline: string;
}

export function Hero({ onStartChat, name, bio, tagline }: HeroProps) {

  return (
    <section className="min-h-screen flex flex-col items-center justify-end px-4 py-12 md:py-30 relative bg-gradient-to-br from-background via-primary/5 to-secondary/10">
      {/* Avatar Background - Full Screen Overlay */}
  <div className="absolute inset-0 z-0 pointer-events-none">
        {/* On mobile we reduce the avatar visibility so text remains readable */}
        <div className="hidden sm:block w-full h-full">
          <SimpleAvatar 
            className="w-full h-full" 
            id="hero-avatar"
            avatarUrl="https://models.readyplayer.me/68e66b471df78dfe0fa9c541.glb?morphTargets=ARKit,Oculus+Visemes,mouthOpen,mouthSmile,eyesClosed,eyesLookUp,eyesLookDown&textureSizeLimit=1024&textureFormat=png"
            animationSet="A1"
            isHero={true}
          />
        </div>
        <div className="sm:hidden absolute inset-x-0 bottom-0 h-72 opacity-80 -z-10">
          {/* small decorative avatar block on mobile */}
          <SimpleAvatar 
            className="w-full h-full object-cover"
            id="hero-avatar-mobile"
            avatarUrl="https://models.readyplayer.me/68e66b471df78dfe0fa9c541.glb?morphTargets=ARKit,Oculus+Visemes,mouthOpen,mouthSmile,eyesClosed,eyesLookUp,eyesLookDown&textureSizeLimit=1024&textureFormat=png"
            animationSet="A1"
            isHero={true}
          />
        </div>
      </div>
      
      {/* Lighter overlay for better visibility */}
      <div className="absolute inset-0 bg-background/10 backdrop-blur-[1px] z-10"></div>

      {/* Content - Positioned at bottom */}
  <div className="relative z-30 max-w-4xl w-full flex flex-col items-center text-center space-y-4 animate-fade-in mb-12 md:mb-20">
        {/* Text */}
        <div className="space-y-4 bg-background/80 backdrop-blur-md rounded-2xl p-6 md:p-8 border border-primary/20 shadow-2xl shadow-primary/10">
          <h1 className="text-3xl md:text-6xl font-bold bg-gradient-to-r from-primary via-accent to-secondary bg-clip-text text-transparent drop-shadow-sm">
            {name}
          </h1>
          <p className="text-base md:text-xl text-foreground max-w-2xl font-medium">
            {tagline}
          </p>
          <p className="text-sm md:text-base text-muted-foreground max-w-xl">
            {bio}
          </p>
        </div>

        {/* CTA */}
        <div className="flex flex-col sm:flex-row gap-4 items-center w-full justify-center">
          <Button
            onClick={onStartChat}
            size="lg"
            className="group mx-auto px-6 py-4 sm:px-8 sm:py-6 text-base md:text-lg bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-primary-foreground rounded-full transition-all hover:scale-105 hover:shadow-xl hover:shadow-primary/40 border border-primary/20 w-full sm:w-auto"
          >
            Start Conversation
            <ChevronDown className="ml-2 h-5 w-5 group-hover:translate-y-1 transition-transform" />
          </Button>
        </div>
      </div>

      {/* Brighter scroll indicator */}
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 animate-bounce z-20">
        <ChevronDown className="h-6 w-6 text-primary/80 drop-shadow-md" />
      </div>
    </section>
  );
}
