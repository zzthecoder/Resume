import { useEffect, useRef, useState } from 'react';
import { Hero } from '@/components/Hero';
import { ChatWindow } from '@/components/ChatWindow';
import { Sections } from '@/components/Sections';
import { ParticlesBackground } from '@/components/ParticlesBackground';
import { loadKnowledgeBase } from '@/lib/chatLogic';

const Index = () => {
  const [data, setData] = useState<any>(null);
  const chatRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadKnowledgeBase().then(setData);
  }, []);

  const scrollToChat = () => {
    chatRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-48 h-48 rounded-full bg-gradient-to-br from-primary to-secondary animate-pulse" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground relative">
      <ParticlesBackground className="absolute inset-0 z-0" />
      
      <div className="relative z-10">
        <Hero
          onStartChat={scrollToChat}
          name={data.name}
          bio={data.bio}
          tagline={data.tagline}
        />
        
        {/* Page Separator */}
        <div className="h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent mx-auto w-full max-w-4xl"></div>
        
        <div ref={chatRef}>
          <ChatWindow />
        </div>
        
        {/* Page Separator */}
        <div className="h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent mx-auto w-full max-w-4xl mt-16"></div>
        
        <Sections
          skills={data.skills}
          experience={data.experience}
          projects={data.projects}
          contact={data.contact}
        />

        <footer className="py-8 text-center text-muted-foreground border-t border-chat-border">
          <p>© 2024 {data.name}. Built with React, Three.js, and Web Speech API.</p>
        </footer>
      </div>
    </div>
  );
};

export default Index;
