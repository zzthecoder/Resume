import { cn } from '@/lib/utils';
import { ExternalLink, Globe, Book, FileText } from 'lucide-react';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  sources?: Array<{ title: string; url: string; type: string }>;
}

interface MessageBubbleProps {
  message: Message;
  isTyping?: boolean;
}

export function MessageBubble({ message, isTyping }: MessageBubbleProps) {
  const isUser = message.role === 'user';

  const getSourceIcon = (type: string) => {
    switch (type) {
      case 'web': return <Globe className="w-3 h-3" />;
      case 'knowledge': return <Book className="w-3 h-3" />;
      case 'page': return <FileText className="w-3 h-3" />;
      default: return <ExternalLink className="w-3 h-3" />;
    }
  };

  const getSourceColor = (type: string) => {
    switch (type) {
      case 'web': return 'text-blue-600 hover:text-blue-800';
      case 'knowledge': return 'text-green-600 hover:text-green-800';
      case 'page': return 'text-purple-600 hover:text-purple-800';
      default: return 'text-gray-600 hover:text-gray-800';
    }
  };

  return (
    <div
      className={cn(
        'flex items-start gap-3 mb-4 animate-fade-in',
        isUser ? 'flex-row-reverse' : 'flex-row'
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold',
          isUser
            ? 'bg-chat-user text-foreground'
            : 'bg-gradient-to-br from-primary to-secondary text-primary-foreground'
        )}
      >
        {isUser ? 'Y' : 'A'}
      </div>

      {/* Message content */}
      <div className={cn('max-w-[70%]', isUser ? 'items-end' : 'items-start', 'flex flex-col gap-2')}>
        <div
          className={cn(
            'px-4 py-3 rounded-2xl',
            isUser
              ? 'bg-chat-user text-foreground rounded-tr-sm'
              : 'bg-chat-assistant text-foreground rounded-tl-sm border border-chat-border'
          )}
        >
          {isTyping ? (
            <div className="flex gap-1">
              <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce [animation-delay:-0.3s]" />
              <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce [animation-delay:-0.15s]" />
              <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" />
            </div>
          ) : (
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
          )}
        </div>

        {/* Sources */}
        {!isUser && !isTyping && message.sources && message.sources.length > 0 && (
          <div className="text-xs space-y-1 max-w-full">
            <div className="text-muted-foreground font-medium">Sources:</div>
            <div className="flex flex-wrap gap-2">
              {message.sources.map((source, index) => (
                <a
                  key={index}
                  href={source.url !== '#' ? source.url : undefined}
                  target={source.url !== '#' ? "_blank" : undefined}
                  rel={source.url !== '#' ? "noopener noreferrer" : undefined}
                  className={cn(
                    'inline-flex items-center gap-1 px-2 py-1 rounded-md bg-muted/50 border border-border',
                    source.url !== '#' ? getSourceColor(source.type) + ' hover:bg-muted cursor-pointer' : 'text-muted-foreground cursor-default',
                    'transition-colors duration-200'
                  )}
                  title={source.title}
                >
                  {getSourceIcon(source.type)}
                  <span className="truncate max-w-[120px]">
                    [{index + 1}] {source.title}
                  </span>
                  {source.url !== '#' && <ExternalLink className="w-2 h-2 ml-1" />}
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
