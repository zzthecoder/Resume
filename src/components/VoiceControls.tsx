import { Button } from '@/components/ui/button';
import { Volume2, VolumeX } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface VoiceControlsProps {
  isSpeaking: boolean;
  isMuted: boolean;
  onToggleMute: () => void;
  onStopSpeech: () => void;
  voices: SpeechSynthesisVoice[];
  selectedVoice: SpeechSynthesisVoice | null;
  onVoiceChange: (voice: SpeechSynthesisVoice) => void;
}

export function VoiceControls({
  isSpeaking,
  isMuted,
  onToggleMute,
  onStopSpeech,
  voices,
  selectedVoice,
  onVoiceChange,
}: VoiceControlsProps) {
  return (
    <div className="flex flex-col gap-3 bg-card p-4 rounded-lg border border-chat-border">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Voice Settings</span>
        {isSpeaking && (
          <span className="text-xs text-primary animate-pulse">● Speaking</span>
        )}
      </div>
      
      {/* Voice selector */}
      <Select
        value={selectedVoice?.name || ''}
        onValueChange={(name) => {
          const voice = voices.find((v) => v.name === name);
          if (voice) onVoiceChange(voice);
        }}
      >
        <SelectTrigger className="w-full bg-background border-chat-border">
          <SelectValue placeholder="Select voice" />
        </SelectTrigger>
        <SelectContent>
          {voices.map((voice) => (
            <SelectItem key={voice.name} value={voice.name}>
              {voice.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="flex gap-2">
        {/* Mute toggle */}
        <Button
          variant="outline"
          className="flex-1 border-chat-border"
          onClick={onToggleMute}
        >
          {isMuted ? (
            <>
              <VolumeX className="h-4 w-4 mr-2" />
              Unmute
            </>
          ) : (
            <>
              <Volume2 className="h-4 w-4 mr-2" />
              Mute
            </>
          )}
        </Button>

        {/* Stop speaking */}
        {isSpeaking && (
          <Button
            variant="destructive"
            className="flex-1"
            onClick={onStopSpeech}
          >
            Stop
          </Button>
        )}
      </div>
    </div>
  );
}
