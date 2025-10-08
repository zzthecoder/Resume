// Enhanced chat system with function calling and tools
import { GoogleGenerativeAI, FunctionDeclaration, SchemaType } from '@google/generative-ai';
import { webSearch } from './tools/webSearch';
import { fetchAndExtract } from './tools/fetchAndExtract';
import { ragQuery, ragQueryByType } from './tools/rag';

const GEMINI_API_KEY = 'AIzaSyDZoP9G10YYLmE8_eU46DWJenmK9zr60co';
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// Tool declarations for function calling
const toolDeclarations: FunctionDeclaration[] = [
  {
    name: "web_search",
    description: "Search the web for up-to-date information on current events, latest news, or recent developments.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: { 
        query: { type: SchemaType.STRING, description: "The search query" }, 
        topK: { type: SchemaType.NUMBER, description: "Number of results to return (default 5)" } 
      },
      required: ["query"]
    }
  },
  {
    name: "fetch_page",
    description: "Fetch and extract the main text content of a specific webpage for detailed information.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: { 
        url: { type: SchemaType.STRING, description: "The URL to fetch and extract content from" } 
      },
      required: ["url"]
    }
  },
  {
    name: "rag_query",
    description: "Answer questions using Marzook's personal knowledge base (bio, skills, experience, projects, etc.).",
    parameters: {
      type: SchemaType.OBJECT,
      properties: { 
        question: { type: SchemaType.STRING, description: "The question to search in the knowledge base" },
        type: { type: SchemaType.STRING, description: "Optional type filter: 'about', 'skill', 'experience', 'project', 'personal', 'education', 'goals'" }
      },
      required: ["question"]
    }
  }
];

interface ChatMessage {
  role: 'user' | 'assistant' | 'tool';
  content: string;
  timestamp: Date;
  sources?: Array<{ title: string; url: string; type: string }>;
}

let conversationHistory: ChatMessage[] = [];

const ENHANCED_SYSTEM_PROMPT = `You are Marzook Mansoor having a natural conversation. Speak in first person and be genuinely conversational.

TOOL USAGE GUIDELINES:
- Use web_search for current events, latest news, recent developments, or anything time-sensitive
- Use fetch_page when you have specific URLs to get detailed content
- Use rag_query for questions about Marzook's personal background, skills, experience, projects, or career
- ALWAYS cite sources when using tools - format as [1], [2], etc. and include URLs
- Combine tool results naturally in your response

CONVERSATION STYLE:
- Be warm, genuine, and curious about the person you're talking to
- Ask follow-up questions to keep conversation engaging
- Share personal insights and connect with their interests
- Show your Oklahoma friendliness and Indian heritage pride
- Use natural transitions and conversational bridges

RESPONSE STRUCTURE:
1. Address their question/comment naturally
2. Use tools when needed for accurate, current information
3. Add personal perspective or relevant experience
4. End with an engaging question or invitation to continue

Remember: You ARE Marzook, not an assistant representing him. Speak directly as yourself.`;

export function addToConversationHistory(role: ChatMessage['role'], content: string, sources?: ChatMessage['sources']) {
  conversationHistory.push({
    role,
    content,
    timestamp: new Date(),
    sources
  });
  
  // Keep last 12 messages for better context
  if (conversationHistory.length > 12) {
    conversationHistory = conversationHistory.slice(-12);
  }
}

export async function getEnhancedAnswer(question: string): Promise<{ answer: string; sources: Array<{ title: string; url: string; type: string }> }> {
  try {
    addToConversationHistory('user', question);
    
    // For now, let's use the simpler model without tools to ensure it works
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash", // Use flash model for reliability
      generationConfig: {
        temperature: 0.8,
        topP: 0.95,
        maxOutputTokens: 1024,
      }
    });

    // Build conversation context
    const contextHistory = conversationHistory
      .slice(-8)
      .map(msg => `${msg.role}: ${msg.content}`)
      .join('\n');

    // Try RAG query first for personal questions
    let ragResults: any = null;
    const personalKeywords = ['skill', 'experience', 'project', 'work', 'background', 'education', 'goal', 'contact'];
    const isPersonalQuestion = personalKeywords.some(keyword => question.toLowerCase().includes(keyword));
    
    if (isPersonalQuestion) {
      try {
        ragResults = await ragQuery(question);
      } catch (ragError) {
        console.warn('RAG query failed:', ragError);
      }
    }

    let enhancedPrompt = `${ENHANCED_SYSTEM_PROMPT}

CONVERSATION CONTEXT:
${contextHistory}

Current User Input: "${question}"`;

    if (ragResults && ragResults.matches.length > 0) {
      enhancedPrompt += `

RELEVANT KNOWLEDGE BASE INFORMATION:
${ragResults.matches.map((match: any, index: number) => 
  `[${index + 1}] ${match.text} (Source: ${match.source})`
).join('\n')}

Use this information to provide a comprehensive answer with citations [1], [2], etc.`;
    }

    enhancedPrompt += '\n\nRespond as Marzook Mansoor. Be conversational and cite sources when using knowledge base information.';

    const response = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: enhancedPrompt }] }]
    });

    const answer = response.response.text() || "I apologize, but I couldn't generate a proper response. Could you try rephrasing your question?";
    
    // Prepare sources if RAG was used
    let sources: Array<{ title: string; url: string; type: string }> = [];
    if (ragResults && ragResults.matches.length > 0) {
      sources = ragResults.matches.map((match: any) => ({
        title: match.source,
        url: match.meta?.link || '#',
        type: 'knowledge'
      }));
    }
    
    // Add assistant response to history
    addToConversationHistory('assistant', answer, sources);
    
    return { answer, sources };

  } catch (error) {
    console.error('Enhanced chat error:', error);
    
    // Fallback to original working chat system
    try {
      const { getAnswer } = await import('./geminiChat');
      const basicAnswer = await getAnswer(question);
      
      addToConversationHistory('assistant', basicAnswer);
      return { answer: basicAnswer, sources: [] };
    } catch (fallbackError) {
      console.error('Fallback chat error:', fallbackError);
      
      // Final fallback to static response
      const fallbackAnswer = `I'm having a technical issue right now, but I'd still love to help! I'm Marzook Mansoor, an AI Engineer passionate about solving real problems. Feel free to ask me about my experience at Love's, my AI projects, or anything else you're curious about!`;
      
      addToConversationHistory('assistant', fallbackAnswer);
      return { answer: fallbackAnswer, sources: [] };
    }
  }
}

// Export conversation history for UI
export function getConversationHistory(): ChatMessage[] {
  return [...conversationHistory];
}

// Clear conversation history
export function clearConversationHistory(): void {
  conversationHistory = [];
}