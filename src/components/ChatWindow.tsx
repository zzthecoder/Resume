import { useState, useRef, useEffect } from 'react';
import { MessageBubble, Message } from './MessageBubble';
import { VoiceControls } from './VoiceControls';
import { SimpleAvatar } from '@/components/SimpleAvatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, ExternalLink } from 'lucide-react';
import { getEnhancedAnswer } from '@/lib/enhancedChat';

export function ChatWindow() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: "Hi! I'm Marzook's AI assistant. Ask me anything about my skills, experience, projects, or just to tell you more about me!",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<SpeechSynthesisVoice | null>(null);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Load voices
  useEffect(() => {
    const loadVoices = () => {
      const availableVoices = window.speechSynthesis.getVoices();
      setVoices(availableVoices);
      
      // Try to select a good English voice
      const preferred = availableVoices.find(
        (v) => v.lang.startsWith('en') && v.name.includes('Google')
      ) || availableVoices.find((v) => v.lang.startsWith('en'));
      
      if (preferred) setSelectedVoice(preferred);
    };

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }, []);

  // Auto scroll to bottom - only for assistant messages and typing indicator
  useEffect(() => {
    // Only auto-scroll if we should (not disabled by user action)
    if (shouldAutoScroll && messagesContainerRef.current) {
      // Small delay to ensure DOM is updated
      setTimeout(() => {
        const container = messagesContainerRef.current;
        if (container) {
          container.scrollTop = container.scrollHeight;
        }
      }, 100);
    }
  }, [isTyping, shouldAutoScroll]);

  // Separate effect for assistant messages only
  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    // Only auto-scroll for assistant messages, not user messages
    if (lastMessage?.role === 'assistant' && shouldAutoScroll && messagesContainerRef.current) {
      setTimeout(() => {
        const container = messagesContainerRef.current;
        if (container) {
          container.scrollTop = container.scrollHeight;
        }
      }, 100);
    }
  }, [messages, shouldAutoScroll]);

  // Reset auto-scroll when user scrolls up manually
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const element = e.currentTarget;
    const isAtBottom = element.scrollHeight - element.scrollTop <= element.clientHeight + 100;
    setShouldAutoScroll(isAtBottom);
  };

  const speak = (text: string) => {
    if (isMuted) return;

    // Stop any ongoing speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utteranceRef.current = utterance;
    
    if (selectedVoice) {
      utterance.voice = selectedVoice;
    }
    
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    utterance.onstart = () => {
      setIsSpeaking(true);
      if ((window as any).chat_avatar_startTalking) {
        (window as any).chat_avatar_startTalking();
      }
    };

    utterance.onend = () => {
      setIsSpeaking(false);
      if ((window as any).chat_avatar_stopTalking) {
        (window as any).chat_avatar_stopTalking();
      }
    };

    utterance.onerror = () => {
      setIsSpeaking(false);
      if ((window as any).chat_avatar_stopTalking) {
        (window as any).chat_avatar_stopTalking();
      }
    };

    window.speechSynthesis.speak(utterance);
  };

  const stopSpeech = () => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
    if ((window as any).chat_avatar_stopTalking) {
      (window as any).chat_avatar_stopTalking();
    }
  };

  const suggestedQuestions = [
    "What are your key skills?",
    "Tell me about your projects",
    "What's new in AI today?", // Tests web search
    "What's your experience with AI?",
    "How can I contact you?",
    "What technologies do you use?",
    "What are current AI trends?", // Tests web search
    "Tell me about your achievements"
  ];

  const handleSuggestedQuestion = async (question: string) => {
    setInput(question);
    
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: question,
      timestamp: new Date(),
    };

    // Disable auto-scroll completely for user messages
    setShouldAutoScroll(false);
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);

    try {
      const { answer, sources } = await getEnhancedAnswer(question);
      
      setTimeout(() => {
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: answer,
          timestamp: new Date(),
          sources: sources.length > 0 ? sources : undefined,
        };
        
        setMessages((prev) => [...prev, assistantMessage]);
        setIsTyping(false);
        
        // Re-enable auto-scroll only after assistant responds
        setTimeout(() => {
          setShouldAutoScroll(true);
        }, 200);
        
        speak(answer);
      }, 500);
    } catch (error) {
      console.error('Error getting answer:', error);
      setIsTyping(false);
      setShouldAutoScroll(true);
    }
  };

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    // Disable auto-scroll completely for user messages
    setShouldAutoScroll(false);
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);

    // play quick click sound for immediate feedback (silent fallback if blocked)
    try {
      const audio = new Audio('data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQgAAAAA');
      audio.volume = 0.6;
      audio.play().catch(() => {});
    } catch (err) {
      // ignore audio playback errors
    }

    try {
      const { answer, sources } = await getEnhancedAnswer(input);
      
      setTimeout(() => {
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: answer,
          timestamp: new Date(),
          sources: sources.length > 0 ? sources : undefined,
        };
        
        setMessages((prev) => [...prev, assistantMessage]);
        setIsTyping(false);
        
        // Re-enable auto-scroll only after assistant responds
        setTimeout(() => {
          setShouldAutoScroll(true);
        }, 200);
        
        speak(answer);
      }, 500);
    } catch (error) {
      console.error('Error getting answer:', error);
      setIsTyping(false);
      setShouldAutoScroll(true);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      e.stopPropagation();
      handleSend();
    }
  };

  return (
    <section className="min-h-screen py-6 px-4 md:py-20 md:pl-2 md:pr-6 flex flex-col bg-gradient-to-br from-background via-background/50 to-primary/5">
      <div className="w-full flex flex-col lg:flex-row gap-6 h-[80vh]">
        {/* Avatar Section - Outmost Left */}
        <div className="lg:w-80 flex-shrink-0">
          <div className="sticky top-24">
            <div className="relative w-full mb-4 lg:h-96 rounded-2xl overflow-hidden bg-gradient-to-br from-primary/10 to-accent/10 backdrop-blur-sm border border-primary/20 shadow-2xl">
              <SimpleAvatar 
                className="w-full h-full" 
                id="chat-avatar"
                avatarUrl="https://models.readyplayer.me/68e66b471df78dfe0fa9c541.glb?morphTargets=ARKit,Oculus+Visemes,mouthOpen,mouthSmile,eyesClosed,eyesLookUp,eyesLookDown&textureSizeLimit=1024&textureFormat=png"
                animationSet="A2"
                isHero={false}
              />
            </div>
            
            <VoiceControls
              isSpeaking={isSpeaking}
              isMuted={isMuted}
              onToggleMute={() => setIsMuted(!isMuted)}
              onStopSpeech={stopSpeech}
              voices={voices}
              selectedVoice={selectedVoice}
              onVoiceChange={setSelectedVoice}
            />
            
            <div className="text-center mt-4 p-4 bg-card/50 rounded-xl backdrop-blur-sm border border-primary/10">
              <h3 className="text-lg font-semibold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">AI Assistant</h3>
              <p className="text-sm text-muted-foreground">Chat Companion</p>
            </div>
          </div>
        </div>

        {/* Chat Section */}
        <div className="flex-1 flex flex-col min-h-0">
          {/* Header */}
          <div className="mb-6 p-4 md:p-6 bg-gradient-to-r from-card/50 to-accent/5 rounded-xl backdrop-blur-sm border border-primary/10">
            <h2 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Chat with Marzook</h2>
            <p className="text-muted-foreground mt-2">
              Ask me anything about my work, background, and AI projects
            </p>
          </div>

          {/* Mobile suggested questions: horizontal scroll */}
          <div className="block lg:hidden mb-4">
            <div className="flex gap-3 overflow-x-auto px-1 py-2">
              {suggestedQuestions.map((question, index) => (
                <Button
                  key={index}
                  variant="outline"
                  size="sm"
                  className="flex-shrink-0 whitespace-normal min-w-[160px] text-sm h-auto p-2 bg-background/50 border-primary/20"
                  onClick={() => handleSuggestedQuestion(question)}
                  disabled={isTyping}
                >
                  {question}
                </Button>
              ))}
            </div>
          </div>

          {/* Messages */}
          <div 
            ref={messagesContainerRef}
            className="flex-1 overflow-y-auto space-y-4 mb-4 bg-gradient-to-br from-card/80 to-accent/5 rounded-xl p-4 md:p-6 border border-primary/10 backdrop-blur-sm shadow-lg"
            onScroll={handleScroll}
          >
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
            {isTyping && (
              <MessageBubble
                message={{
                  id: 'typing',
                  role: 'assistant',
                  content: '',
                  timestamp: new Date(),
                }}
                isTyping
              />
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="flex gap-3 p-4 md:p-4 bg-gradient-to-r from-card/50 to-accent/5 rounded-xl backdrop-blur-sm border border-primary/10 fixed bottom-4 left-4 right-4 md:static md:rounded-xl md:backdrop-blur-sm md:border md:pl-0">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              inputMode="text"
              enterKeyHint="send"
              placeholder="Ask me anything..."
              className="flex-1 bg-background/50 border-primary/20 focus:border-primary/40 backdrop-blur-sm"
              disabled={isTyping}
            />
            <Button
              type="submit"
              disabled={!input.trim() || isTyping}
              size="icon"
              className="bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 shadow-lg"
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>

        {/* Suggested Questions Panel */}
        <div className="lg:w-64 flex-shrink-0 hidden lg:block">
          <div className="sticky top-24">
            <div className="p-4 bg-gradient-to-br from-card/50 to-accent/5 rounded-xl backdrop-blur-sm border border-primary/10 shadow-lg">
              <h3 className="text-lg font-semibold mb-4 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Suggested Questions</h3>
              <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                {suggestedQuestions.map((question, index) => (
                  <Button
                    key={index}
                    variant="outline"
                    size="sm"
                    className="w-full text-left justify-start h-auto p-3 text-wrap whitespace-normal bg-background/50 border-primary/20 hover:bg-primary/10 hover:border-primary/40 backdrop-blur-sm transition-all duration-200"
                    onClick={() => handleSuggestedQuestion(question)}
                    disabled={isTyping}
                  >
                    {question}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
