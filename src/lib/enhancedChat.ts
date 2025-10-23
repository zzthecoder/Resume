// Enhanced chat system using local RAG
import { generateRAGResponse, addToConversationHistory as addToHistory } from './localRAG';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

let conversationHistory: ChatMessage[] = [];

export function addToConversationHistory(role: ChatMessage['role'], content: string) {
  conversationHistory.push({
    role,
    content,
    timestamp: new Date(),
  });
  
  // Keep last 12 messages for better context
  if (conversationHistory.length > 12) {
    conversationHistory = conversationHistory.slice(-12);
  }
}

export function getConversationHistory(): ChatMessage[] {
  return [...conversationHistory];
}

export function clearConversationHistory(): void {
  conversationHistory = [];
}

export async function getEnhancedAnswer(question: string): Promise<{ answer: string }> {
  try {
    addToHistory('user', question);
    
    console.log('🔄 Processing question:', question);
    
    // Use local RAG to generate response
    const answer = await generateRAGResponse(question);
    
    console.log('✅ Response generated:', answer.substring(0, 80) + '...');
    
    // Add assistant response to history
    addToHistory('assistant', answer);
    
    return { answer };

  } catch (error) {
    console.error('❌ RAG chat error:', error);
    
    // Fallback response
    const fallbackAnswer = `Hey there! I'm Marzook Mansoor - an AI/ML engineer and Business Analyst passionate about solving real problems with technology. I've worked on everything from analytics automation at Love's Travel Stop to AI projects like ChibiTomo. What brings you here today?`;
    
    console.log('🔙 Using fallback response');
    addToHistory('assistant', fallbackAnswer);
    return { answer: fallbackAnswer };
  }
}
