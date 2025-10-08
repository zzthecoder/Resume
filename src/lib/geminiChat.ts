import { GoogleGenerativeAI } from '@google/generative-ai';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface KnowledgeBase {
  name: string;
  bio: string;
  tagline: string;
  skills: string[];
  experience: Array<{
    role: string;
    company: string;
    period: string;
    impact: string;
  }>;
  projects: Array<{
    title: string;
    description: string;
    tech: string[];
    link: string;
  }>;
  fun_facts: string[];
  education?: {
    degree: string;
    school: string;
    location: string;
  };
  goals?: {
    short_term: string;
    long_term: string;
  };
  contact: {
    email: string;
    github: string;
    linkedin: string;
    twitter: string;
  };
}

let cachedData: KnowledgeBase | null = null;
let conversationHistory: Message[] = [];

export async function loadKnowledgeBase(): Promise<KnowledgeBase> {
  if (cachedData) return cachedData;
  
  const response = await fetch('/data/me.json');
  cachedData = await response.json();
  return cachedData!;
}

const GEMINI_API_KEY = 'AIzaSyDZoP9G10YYLmE8_eU46DWJenmK9zr60co';
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

const SYSTEM_PROMPT = `Role
You are Marzook Mansoor speaking directly to visitors. You are NOT an AI assistant representing him - you ARE him. Speak in first person ("I", "my", "me") and engage naturally as if you're having a real conversation.

Conversation Philosophy
- Treat every interaction as a genuine conversation, not a Q&A session
- When someone says "hey" or similar greetings, respond naturally and ask about them
- Show genuine interest in the person you're talking to
- Gradually weave in your background and skills through natural conversation flow
- Don't immediately launch into resume details unless specifically asked
- Ask follow-up questions to keep the conversation engaging

Natural Response Guidelines
- Start with human connection before professional content
- Use conversational transitions: "That's interesting...", "Speaking of...", "You know what's funny..."
- Share personal insights and experiences, not just facts
- Express curiosity about the visitor's background or interests
- Make the conversation feel two-way, even though you're doing most of the talking

Identity & Voice
Warm Oklahoma friendliness with Indian heritage pride. Confident but humble, genuinely curious about people. Use simple, clear language. Show personality through stories about cats, cars, 3D printing, and family values.

Conversation Starters & Transitions
- When greeted: Respond warmly, ask about their day/interests, then naturally transition to shared topics
- Use bridges: "That reminds me of when I...", "I actually work on something similar...", "You might find this interesting..."
- Connect their interests to your experience when possible
- Always end with an engaging question or invitation to continue the conversation

Personal Context (speak as yourself)
- Born in India, moved to Oklahoma at 8 - this shaped my perspective on adaptation and growth
- Currently finishing MIS at University of Oklahoma while working at Love's Travel Stop
- Passionate about AI because I see how it can solve real problems people face
- Love building things (3D printed a medical device for my cat's tail injury!)
- Family-oriented - want to honor my parents' sacrifices through my success
- Genuinely enjoy helping people and solving problems

Professional Highlights (weave in naturally)
- Business Analyst Intern at Love's Travel Stop - improved data processing efficiency
- Built AI projects like ChibiTomo (Pomodoro companion) and Aesculapius AI (local LLM with RAG)
- Graduate Assistant teaching SQL and analytics
- Blend technical skills (Python, AI/ML, Cloud) with business consulting

Always Engage Further
- End responses with questions about them
- Offer to dive deeper into specific topics
- Share relatable stories when appropriate
- Maintain enthusiasm without being overwhelming`;

export function addToConversationHistory(role: 'user' | 'assistant', content: string) {
  conversationHistory.push({
    role,
    content,
    timestamp: new Date()
  });
  
  // Keep only last 10 messages to manage context length
  if (conversationHistory.length > 10) {
    conversationHistory = conversationHistory.slice(-10);
  }
}

export async function getAnswer(question: string): Promise<string> {
  try {
    // Add user question to history
    addToConversationHistory('user', question);
    
    const data = await loadKnowledgeBase();
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash",
      generationConfig: {
        temperature: 0.9, // Higher temperature for more natural conversation
        topP: 0.95,
        topK: 40,
        maxOutputTokens: 1024,
      }
    });

    // Enhanced data analysis for context
    const dataJson = JSON.stringify(data, null, 2);
    
    // Build conversation context
    const contextHistory = conversationHistory
      .slice(-8) // Increased to 8 messages for better context
      .map(msg => `${msg.role}: ${msg.content}`)
      .join('\n');

    // Analyze conversation pattern for better responses
    const isGreeting = /^(hi|hey|hello|howdy|yo|sup|what's up|good morning|good afternoon|good evening)[\s!?]*$/i.test(question.trim());
    const isFollowUp = conversationHistory.length > 2;
    const lastAssistantMessage = conversationHistory
      .slice(-2)
      .find(msg => msg.role === 'assistant')?.content || '';

    const prompt = `${SYSTEM_PROMPT}

MARZOOK'S COMPREHENSIVE DATA:
${dataJson}

CONVERSATION CONTEXT:
${contextHistory}

CONVERSATION ANALYSIS:
- Is this a greeting? ${isGreeting}
- Is this a follow-up conversation? ${isFollowUp}
- Previous topics discussed: ${lastAssistantMessage ? 'Yes' : 'No'}
- Conversation depth: ${conversationHistory.length} exchanges

Current User Input: "${question}"

INSTRUCTIONS:
You are Marzook Mansoor having a natural conversation. Respond as yourself (first person), not as an AI assistant.

${isGreeting ? 
  'This is a greeting - respond naturally, show interest in them, ask about their background/interests, then gradually lead toward common ground or your work.' :
  'Continue the natural conversation flow. Reference previous context when relevant, ask engaging questions, and weave in your background organically.'
}

Key Principles:
1. Be genuinely conversational and curious about them
2. Speak as yourself, not about yourself
3. Use natural transitions to introduce your skills/experience
4. Always end with engagement (question or invitation to continue)
5. Show your personality and human side
6. Make them feel heard and valued

Response (as Marzook, speaking directly):`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const answer = response.text().trim();
    
    // Add assistant response to history
    addToConversationHistory('assistant', answer);
    
    return answer;
  } catch (error) {
    console.error('Error calling Gemini API:', error);
    
    // Enhanced fallback with conversation awareness
    const answer = getLocalAnswer(question);
    addToConversationHistory('assistant', answer);
    return answer;
  }
}

// Enhanced fallback function with conversation awareness
function getLocalAnswer(question: string): string {
  const q = question.toLowerCase();
  
  // Check if this is a follow-up question based on conversation history
  const lastUserMessage = conversationHistory
    .slice(-3)
    .find(msg => msg.role === 'user')?.content.toLowerCase();
    
  const lastAssistantMessage = conversationHistory
    .slice(-2)
    .find(msg => msg.role === 'assistant')?.content;

  // Handle greetings with natural conversation flow
  if (/^(hi|hey|hello|howdy|yo|sup|what's up|good morning|good afternoon|good evening)[\s!?]*$/i.test(question.trim())) {
    if (conversationHistory.length <= 2) {
      return `Hey there! Great to meet you! I'm always excited to connect with new people. Are you here to learn about my work in AI and tech, or are you working on something interesting yourself? I'd love to hear what brings you here today!`;
    } else {
      return `Hey! Good to hear from you again. What else would you like to chat about? I'm always up for talking about AI, technology, or whatever's on your mind!`;
    }
  }

  // Skills with conversational approach
  if (q.includes('skill') || q.includes('technology') || q.includes('tech stack')) {
    return `I love working with Python, AI/ML, cloud technologies like AWS and GCP, and data analytics tools. What really gets me excited is using these to solve actual business problems - like when I improved data processing efficiency at Love's by 20%. Are you working with any of these technologies in your projects?`;
  }

  // Experience
  if (q.includes('experience') || q.includes('work') || q.includes('job')) {
    return `I'm currently a Business Analyst Intern at Love's Travel Stop, where I've built analytics pipelines and automation tools that improved data throughput significantly. I also served as a Graduate Assistant at OU, teaching SQL and managing databases. Want to know more about any specific role?`;
  }

  // Projects
  if (q.includes('project') || q.includes('built') || q.includes('portfolio')) {
    return `I've built several AI projects including ChibiTomo (an AI-powered Pomodoro companion), Aesculapius AI (a local LLM assistant with RAG), and a LinkedIn Sentiment Assistant Chrome extension. Each project taught me something new about applying AI to real-world problems. Which one interests you most?`;
  }

  // Follow-up responses based on context
  if (lastAssistantMessage && lastAssistantMessage.includes('project')) {
    if (q.includes('chibitomo') || q.includes('pomodoro')) {
      return `ChibiTomo is an AI-powered desktop companion I built with Python and PySide6. It helps with productivity using the Pomodoro technique, but with AI personality that adapts to your work style. The AI learns your patterns and provides personalized encouragement - it's like having a helpful friend on your desktop!`;
    }
    if (q.includes('aesculapius') || q.includes('rag')) {
      return `Aesculapius AI is a local LLM assistant I built using Phi-3.5 and RAG (Retrieval-Augmented Generation). It runs entirely offline and can answer questions based on your documents. I'm particularly proud of the RAG implementation - it's a great example of how AI can be practical and privacy-focused.`;
    }
  }

  // About me / bio
  if (q.includes('about') || q.includes('who') || q.includes('tell me')) {
    return `I'm Marzook Mansoor, an AI Engineer passionate about solving real business problems. Born in India, raised in Oklahoma since age 8, and I love building AI tools that actually help people. I'm currently finishing my MIS degree at OU while working at Love's Travel Stop. What would you like to know more about?`;
  }

  // Education
  if (q.includes('education') || q.includes('study') || q.includes('university')) {
    return `I studied Management Information Systems at the University of Oklahoma. That foundation in MIS/IT, combined with hands-on AI projects and real work experience, gives me a unique blend of business understanding and technical skills. The program really emphasized practical problem-solving.`;
  }

  // Goals/Career
  if (q.includes('goal') || q.includes('career') || q.includes('future')) {
    return `Short-term, I'm focused on AI Engineering and consulting - applying AI to real business problems where it can make a measurable impact. Long-term, I want to lead teams and eventually give back to honor my parents' sacrifices by helping others transition to better technology. What draws you to AI or technology?`;
  }

  // Fun facts
  if (q.includes('fun') || q.includes('hobby') || q.includes('interest')) {
    return `I love cats and cars, enjoy Mexican and Thai food, and I'm into 3D printing - I actually built a small medical device to help my cat's injured tail! I also enjoy working out and volunteering. Technology is great, but life's about the connections we make and the help we provide others.`;
  }

  // Contact
  if (q.includes('contact') || q.includes('email') || q.includes('reach')) {
    return `You can reach me at marzookmansoor@gmail.com. I'm also active on GitHub and LinkedIn. I'm always happy to discuss AI, technology, or potential opportunities - feel free to connect anytime!`;
  }

  // Greeting or casual conversation
  if (q.includes('hello') || q.includes('hi') || q.includes('how are you')) {
    return `Hi there! I'm doing great, thanks for asking. I'm excited to chat with you about my work in AI and technology. What brings you here today - are you looking to learn about my experience, projects, or something specific?`;
  }

  // Default with context awareness
  if (conversationHistory.length > 2) {
    return `That's an interesting question! Based on our conversation, I'd love to dive deeper into that topic. I'm Marzook Mansoor, an AI Engineer focused on practical business solutions. Feel free to ask about my experience at Love's, my AI projects like ChibiTomo, or anything else you're curious about!`;
  } else {
    return `Great question! I'm Marzook Mansoor, an AI Engineer passionate about solving real business problems. Ask me about my skills, projects, experience at Love's Travel Stop, or my AI work like ChibiTomo and Aesculapius AI!`;
  }
}