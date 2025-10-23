// Advanced Local RAG system with semantic search and conversation memory
interface ResumeData {
  name: string;
  location: string;
  bio: string;
  tagline: string;
  professional_summary: string;
  skills: string[];
  experience?: Array<{ title: string; company: string; description: string; location?: string; duration?: string }>;
  projects?: Array<{ name: string; description: string; technologies?: string; link?: string }>;
  education?: Array<{ degree: string; school: string; location?: string; duration?: string }>;
  certifications?: string[];
  contact?: { email?: string; phone?: string; linkedin?: string; github?: string };
  leadership?: string[];
  honors?: string[];
  [key: string]: any;
}

interface ConversationContext {
  topics: string[];
  askedAbout: Set<string>;
  sentiment: 'curious' | 'professional' | 'casual';
  depth: 'overview' | 'detailed' | 'deep-dive';
}

// Response caching for efficiency
const responseCache = new Map<string, { response: string; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

let cachedResumeData: ResumeData | null = null;
let conversationContext: ConversationContext = {
  topics: [],
  askedAbout: new Set(),
  sentiment: 'curious',
  depth: 'overview'
};

// Common typo corrections
const TYPO_CORRECTIONS: Record<string, string> = {
  'experiance': 'experience',
  'expirience': 'experience',
  'experince': 'experience',
  'projct': 'project',
  'proyect': 'project',
  'skilz': 'skills',
  'skils': 'skills',
  'contct': 'contact',
  'contat': 'contact',
  'edcuation': 'education',
  'educaton': 'education',
  'resumee': 'resume',
  'resum': 'resume'
};

// Synonym expansion for better matching
const SYNONYMS: Record<string, string[]> = {
  'job': ['work', 'employment', 'position', 'role', 'career'],
  'project': ['app', 'application', 'build', 'creation', 'work'],
  'skill': ['ability', 'expertise', 'knowledge', 'capability', 'proficiency'],
  'contact': ['reach', 'connect', 'get in touch', 'email', 'call'],
  'education': ['degree', 'school', 'university', 'study', 'learning'],
  'achievement': ['accomplishment', 'success', 'award', 'honor', 'recognition']
};

// Semantic keyword mapping for better understanding
const SEMANTIC_KEYWORDS = {
  experience: ['work', 'job', 'career', 'role', 'position', 'internship', 'employed', 'worked at'],
  projects: ['built', 'created', 'developed', 'project', 'portfolio', 'made', 'app', 'application'],
  skills: ['skill', 'technology', 'tech', 'expertise', 'proficient', 'good at', 'know', 'can you'],
  education: ['study', 'studied', 'degree', 'university', 'college', 'school', 'education', 'graduated'],
  ai: ['ai', 'artificial intelligence', 'machine learning', 'ml', 'llm', 'rag', 'chatbot', 'neural'],
  contact: ['contact', 'reach', 'email', 'phone', 'linkedin', 'github', 'connect', 'get in touch'],
  achievements: ['achievement', 'accomplish', 'proud', 'award', 'honor', 'recognition', 'success'],
  personal: ['hobby', 'interest', 'personal', 'passion', 'love', 'enjoy', 'background', 'story'],
  leadership: ['leadership', 'leader', 'manage', 'team', 'coordinate', 'organize', 'motivate'],
  motivation: ['why', 'motivated', 'inspire', 'passion', 'drive', 'what sparked'],
  challenges: ['challenge', 'difficult', 'problem', 'obstacle', 'struggle', 'overcome'],
  future: ['future', 'vision', 'goal', 'plan', 'career path', 'long-term', 'aspiration'],
  resume: ['resume', 'cv', 'walk me through', 'background', 'tell me about yourself'],
  cloud: ['cloud', 'aws', 'azure', 'gcp', 'serverless', 'container', 'kubernetes'],
  consulting: ['consult', 'business architect', 'strategy', 'enterprise', 'client'],
  teaching: ['teach', 'graduate assistant', 'student', 'education', 'mentor'],
  retail: ['retail', 'evm', 'assistant manager', 'store', 'customer'],
  technical: ['technical', 'code', 'debug', 'implement', 'design', 'architecture']
};

export async function loadResumeData(): Promise<ResumeData> {
  if (cachedResumeData) {
    return cachedResumeData;
  }
  
  try {
    const response = await fetch('/data/me.json');
    if (!response.ok) throw new Error(`Failed to fetch me.json: ${response.status}`);
    cachedResumeData = await response.json();
    console.log('✅ Resume data loaded');
    return cachedResumeData;
  } catch (err) {
    console.error('❌ Failed to load resume data:', err);
    throw err;
  }
}

// Query normalization and cleaning
function normalizeQuery(query: string): string {
  let normalized = query.toLowerCase().trim();
  
  // Fix common typos
  Object.entries(TYPO_CORRECTIONS).forEach(([typo, correction]) => {
    const regex = new RegExp(`\\b${typo}\\b`, 'gi');
    normalized = normalized.replace(regex, correction);
  });
  
  // Expand with synonyms for better matching
  Object.entries(SYNONYMS).forEach(([word, synonyms]) => {
    if (normalized.includes(word)) {
      // Keep original but note synonyms for semantic matching
      normalized = `${normalized} ${synonyms.join(' ')}`;
    }
  });
  
  // Remove excessive punctuation and whitespace
  normalized = normalized.replace(/[?!.]+/g, ' ').replace(/\s+/g, ' ').trim();
  
  return normalized;
}

// Check response cache
function getCachedResponse(query: string): string | null {
  const cacheKey = query.toLowerCase().trim();
  const cached = responseCache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log('💾 Returning cached response');
    return cached.response;
  }
  
  // Clean expired entries
  if (cached && Date.now() - cached.timestamp >= CACHE_TTL) {
    responseCache.delete(cacheKey);
  }
  
  return null;
}

// Cache a response
function cacheResponse(query: string, response: string): void {
  const cacheKey = query.toLowerCase().trim();
  responseCache.set(cacheKey, { response, timestamp: Date.now() });
  
  // Limit cache size to 50 entries
  if (responseCache.size > 50) {
    const firstKey = responseCache.keys().next().value;
    responseCache.delete(firstKey);
  }
}

// Advanced similarity scoring with semantic understanding
function calculateAdvancedSimilarity(query: string, text: string, boost = 1.0): number {
  const queryLower = query.toLowerCase();
  const textLower = text.toLowerCase();
  const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2);
  
  let score = 0;
  
  // Exact phrase matching (highest weight)
  if (textLower.includes(queryLower)) {
    score += 3.0 * boost;
  }
  
  // Individual word matching with position awareness
  queryWords.forEach((word, idx) => {
    if (textLower.includes(word)) {
      // Earlier words in query are more important
      const positionWeight = 1 + (queryWords.length - idx) * 0.1;
      score += positionWeight * boost;
    }
  });
  
  // Partial word matching (for variations)
  queryWords.forEach(word => {
    const regex = new RegExp(`\\b${word}\\w*`, 'gi');
    const matches = textLower.match(regex);
    if (matches) {
      score += matches.length * 0.5 * boost;
    }
  });
  
  return score / Math.max(queryWords.length, 1);
}

// Detect question intent with semantic analysis
function detectIntent(query: string): string[] {
  const queryLower = query.toLowerCase();
  const intentScores: Map<string, number> = new Map();
  
  // Score each intent based on keyword matches
  for (const [intent, keywords] of Object.entries(SEMANTIC_KEYWORDS)) {
    let score = 0;
    for (const keyword of keywords) {
      if (queryLower.includes(keyword)) {
        // Longer keywords get higher scores (more specific)
        score += keyword.length > 4 ? 2 : 1;
        
        // Boost if keyword appears multiple times
        const occurrences = (queryLower.match(new RegExp(keyword, 'gi')) || []).length;
        score += (occurrences - 1) * 0.5;
      }
    }
    if (score > 0) {
      intentScores.set(intent, score);
    }
  }
  
  // Pattern-based intent detection with scoring
  if (/what (do|can|are) you/i.test(query)) intentScores.set('capabilities', 2);
  if (/tell me (about|more)/i.test(query)) intentScores.set('detailed', 1.5);
  if (/how (did|do|can)/i.test(query)) intentScores.set('process', 1.5);
  if (/why/i.test(query)) intentScores.set('motivation', 2);
  if (/when/i.test(query)) intentScores.set('timeline', 1);
  if (/where/i.test(query)) intentScores.set('location', 1);
  
  // Return intents sorted by score (highest first)
  const sortedIntents = Array.from(intentScores.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([intent]) => intent);
  
  if (sortedIntents.length > 0) {
    console.log('🎯 Intent scores:', Object.fromEntries(intentScores));
  }
  
  return sortedIntents;
}

// Update conversation context
function updateContext(query: string, intents: string[]) {
  conversationContext.topics = [...conversationContext.topics, ...intents].slice(-10);
  
  // Detect sentiment
  if (/\b(cool|awesome|interesting|great|amazing)\b/i.test(query)) {
    conversationContext.sentiment = 'casual';
  } else if (/\b(experience|professional|qualification|expertise)\b/i.test(query)) {
    conversationContext.sentiment = 'professional';
  }
  
  // Detect depth preference
  if (/\b(more|detail|specific|elaborate|deep)\b/i.test(query)) {
    conversationContext.depth = 'detailed';
  } else if (/\b(quickly|brief|summary|overview)\b/i.test(query)) {
    conversationContext.depth = 'overview';
  }
}

// Advanced question pattern matching
function matchQuestionPattern(question: string): string | null {
  const q = question.toLowerCase();
  
  // Resume overview
  if (/walk (me )?through (your )?resume|tell me about yourself|your background/i.test(question)) return 'resume_overview';
  
  // Education motivations
  if (/why.*pursue.*bachelor.*master|motivated.*degree/i.test(question)) return 'education_motivation';
  if (/why.*university of oklahoma|why.*ou/i.test(question)) return 'why_ou';
  if (/why.*management information/i.test(question)) return 'why_mis';
  if (/integrate.*business.*technical|combine.*business.*tech/i.test(question)) return 'business_tech_integration';
  
  // Digital transformation
  if (/define.*digital transformation|what.*digital transformation/i.test(question)) return 'digital_transformation';
  if (/what sparked.*passion|why.*passionate/i.test(question)) return 'passion_origin';
  
  // Career direction
  if (/long[- ]?term.*vision|career.*vision|future.*career/i.test(question)) return 'career_vision';
  if (/which.*shaped.*most|most important.*experience/i.test(question)) return 'most_impactful';
  
  // Specific companies
  if (/objectstream|pega.*intern/i.test(question) && /what.*do|role|contribute/i.test(question)) return 'objectstream_role';
  if (/beats.*dre|consumer.*insight/i.test(question)) return 'beats_insights';
  if (/love'?s.*travel/i.test(question) && /21%|latency|reporting/i.test(question)) return 'loves_analytics';
  if (/graduate assistant|teaching.*sql/i.test(question)) return 'teaching_role';
  if (/evm|retail.*management/i.test(question)) return 'retail_experience';
  
  // Project specifics
  if (/(avatar.*portfolio|3d.*portfolio).*inspired|why.*3d/i.test(question)) return 'avatar_inspiration';
  if (/chibitomo.*problem|chibitomo.*solve/i.test(question)) return 'chibitomo_purpose';
  if (/aesculapius.*privacy|why.*privacy/i.test(question)) return 'aesculapius_privacy';
  if (/linkedin.*assistant.*inspired|why.*chrome/i.test(question)) return 'linkedin_motivation';
  
  // Technical depth
  if (/prefer.*cloud|which.*cloud.*platform/i.test(question)) return 'cloud_preference';
  if (/sql.*join|window function|cte/i.test(question)) return 'sql_proficiency';
  if (/debug.*python|debugging.*process/i.test(question)) return 'debugging_approach';
  if (/langchain.*hugging.*face|prefer.*ai.*library/i.test(question)) return 'ai_library_preference';
  
  // Leadership
  if (/cousins.*presidential.*club|events.*chair/i.test(question)) return 'leadership_club';
  if (/balance.*academic.*project|manage.*time/i.test(question)) return 'time_management';
  if (/motivate.*team|team.*motivation/i.test(question)) return 'team_motivation';
  
  // Values and fit
  if (/work.*culture|culture.*motivate/i.test(question)) return 'work_culture';
  if (/handle.*failure|deal.*criticism/i.test(question)) return 'handling_failure';
  if (/why.*hire.*you|why.*should.*we/i.test(question)) return 'why_hire';
  if (/mistake.*grew|learned.*from/i.test(question)) return 'learning_from_mistakes';
  if (/ethical.*use.*technology|ethics.*ai/i.test(question)) return 'tech_ethics';
  
  // Contact information
  if (/how.*contact|reach (out to )?you|get in touch|your (email|phone|linkedin|github)/i.test(question)) return 'contact';
  
  // Personal interests / hobbies
  if (/what.*do.*for fun|hobbies|interests|outside (of )?work|free time|enjoy doing|passion outside/i.test(question)) return 'hobbies';
  
  return null;
}

// Intelligent information extraction with relevance ranking
function extractRelevantInfo(resume: ResumeData, query: string): string {
  const queryLower = query.toLowerCase();
  const intents = detectIntent(query);
  updateContext(query, intents);
  
  let relevantInfo = '';
  const sections: Array<{ content: string; score: number; type: string }> = [];

  // Check for greetings/introductions
  if (/^(hi|hey|hello|howdy|who are you|tell me about yourself|about you)/.test(queryLower)) {
    conversationContext.askedAbout.add('intro');
    relevantInfo += `Name: ${resume.name}\n`;
    relevantInfo += `Location: ${resume.location}\n`;
    relevantInfo += `Contact: ${resume.contact?.email || 'marzook.mansoor@outlook.com'} | (405) 588-9434\n`;
    relevantInfo += `Bio: ${resume.bio}\n`;
    relevantInfo += `Professional Summary: ${resume.professional_summary}\n`;
    return relevantInfo;
  }

  // Projects with advanced matching
  if (intents.includes('projects') || queryLower.includes('project') || queryLower.includes('built')) {
    conversationContext.askedAbout.add('projects');
    if (resume.projects) {
      for (const project of resume.projects) {
        const score = calculateAdvancedSimilarity(query, `${project.name} ${project.description}`, 1.5);
        if (score > 0.3 || queryLower.includes(project.name.toLowerCase())) {
          sections.push({
            content: `PROJECT: ${project.name}\n${project.description}\n${project.technologies || ''}\n${project.link || ''}`,
            score,
            type: 'project'
          });
        }
      }
      
      // If no specific matches, include top projects
      if (sections.length === 0 && resume.projects.length > 0) {
        resume.projects.slice(0, 3).forEach(project => {
          sections.push({
            content: `PROJECT: ${project.name}\n${project.description}`,
            score: 0.5,
            type: 'project'
          });
        });
      }
    }
  }

  // Skills with category awareness
  if (intents.includes('skills') || queryLower.includes('skill') || queryLower.includes('expertise')) {
    conversationContext.askedAbout.add('skills');
    if (resume.skills) {
      const skillCategories = {
        ai: resume.skills.filter(s => /ai|ml|llm|rag|transformer|langchain|hugging/i.test(s)),
        languages: resume.skills.filter(s => /python|sql|javascript|r|php/i.test(s)),
        cloud: resume.skills.filter(s => /aws|azure|gcp|cloud/i.test(s)),
        data: resume.skills.filter(s => /tableau|power bi|snowflake|alteryx|data/i.test(s)),
        frameworks: resume.skills.filter(s => /pyside|react|pega|uipath|pyinstaller/i.test(s))
      };
      
      // Find most relevant category
      let bestCategory = 'all';
      let bestMatch = '';
      
      for (const [category, skills] of Object.entries(skillCategories)) {
        const categoryText = skills.join(' ').toLowerCase();
        if (skills.length > 0 && queryLower.includes(category)) {
          bestCategory = category;
          bestMatch = skills.join(', ');
          break;
        }
      }
      
      if (bestMatch) {
        sections.push({
          content: `${bestCategory.toUpperCase()} SKILLS: ${bestMatch}`,
          score: 2.0,
          type: 'skills'
        });
      } else {
        // Show top skills across categories
        sections.push({
          content: `KEY SKILLS:\n- AI/ML: ${skillCategories.ai.slice(0, 5).join(', ')}\n- Languages: ${skillCategories.languages.join(', ')}\n- Cloud: ${skillCategories.cloud.join(', ')}\n- Data: ${skillCategories.data.slice(0, 3).join(', ')}`,
          score: 1.5,
          type: 'skills'
        });
      }
    }
  }

  // Experience with company and role matching
  if (intents.includes('experience') || queryLower.includes('experience') || queryLower.includes('work') || queryLower.includes('job')) {
    conversationContext.askedAbout.add('experience');
    if (resume.experience) {
      for (const exp of resume.experience) {
        const score = calculateAdvancedSimilarity(query, `${exp.title} ${exp.company} ${exp.description}`, 1.3);
        
        // Boost score for specific company mentions
        const companyBoost = queryLower.includes(exp.company.toLowerCase()) ? 2.0 : 0;
        
        if (score + companyBoost > 0.4) {
          sections.push({
            content: `EXPERIENCE: ${exp.title} at ${exp.company}\n${exp.description}\n${exp.location || ''} | ${exp.duration || ''}`,
            score: score + companyBoost,
            type: 'experience'
          });
        }
      }
      
      // If no matches, show recent experiences
      if (sections.filter(s => s.type === 'experience').length === 0) {
        resume.experience.slice(0, 3).forEach(exp => {
          sections.push({
            content: `EXPERIENCE: ${exp.title} at ${exp.company}\n${exp.description}`,
            score: 0.5,
            type: 'experience'
          });
        });
      }
    }
  }

  // Education
  if (intents.includes('education') || queryLower.includes('education') || queryLower.includes('degree') || queryLower.includes('university') || queryLower.includes('master') || queryLower.includes('bachelor')) {
    conversationContext.askedAbout.add('education');
    if (resume.education) {
      sections.push({
        content: `EDUCATION:\n${resume.education.map(edu => `- ${edu.degree} from ${edu.school} ${edu.location || ''} ${edu.duration || ''}`).join('\n')}`,
        score: 1.5,
        type: 'education'
      });
    }
  }

  // Certifications
  if (queryLower.includes('certification') || queryLower.includes('certified') || queryLower.includes('cert')) {
    conversationContext.askedAbout.add('certifications');
    if (resume.certifications) {
      sections.push({
        content: `CERTIFICATIONS:\n${resume.certifications.map(cert => `- ${cert}`).join('\n')}`,
        score: 1.5,
        type: 'certifications'
      });
    }
  }

  // Leadership & Honors
  if (queryLower.includes('leadership') || queryLower.includes('leader') || queryLower.includes('honor') || queryLower.includes('award')) {
    conversationContext.askedAbout.add('achievements');
    if (resume.leadership) {
      sections.push({
        content: `LEADERSHIP: ${resume.leadership.join(' | ')}`,
        score: 1.3,
        type: 'leadership'
      });
    }
    if (resume.honors) {
      sections.push({
        content: `HONORS: ${resume.honors.join(' | ')}`,
        score: 1.3,
        type: 'honors'
      });
    }
  }

  // Sort by relevance score and combine
  sections.sort((a, b) => b.score - a.score);
  
  if (sections.length > 0) {
    relevantInfo = sections.slice(0, 5).map(s => s.content).join('\n\n');
  } else {
    // Fallback: provide general overview
    relevantInfo = `${resume.name} - ${resume.professional_summary}\n\nKey Skills: ${resume.skills?.slice(0, 10).join(', ') || 'Various'}`;
  }

  return relevantInfo;
}

// Comprehensive responses for matched patterns
function getPatternResponse(pattern: string, resume: ResumeData, context: ConversationContext): string {
  const responses: Record<string, string> = {
    // Resume & Background
    'resume_overview': `Great question! Let me walk you through my journey. I'm **Marzook Mansoor** from Edmond, OK. I completed both my **Bachelor's in BBA-MIS** (2021-2025) and **Master's in Management Information Technology** (2023-2025) at the University of Oklahoma. Currently, I'm a **Business Architect Intern at Objectstream working with Pega** on digital transformation and enterprise automation. Before this, I was a **Business Analyst Intern at Love's Travel Stop** where I built analytics pipelines that cut reporting time by 21%, and did consumer insights work at **Beats by Dre** using AI for sentiment analysis. I also served as a **Graduate Assistant at OU** teaching SQL and database admin, and managed retail operations at EVM LLC early in my career. My technical skills span **Python, SQL, AI/ML (LLMs, RAG, LangChain), cloud platforms (AWS, Azure, GCP), Pega, UiPath, and BI tools**. I've built projects like this **Avatar Chat Portfolio** (3D AI chatbot), **ChibiTomo** (AI Pomodoro app), **Aesculapius AI** (local LLM assistant), and a **LinkedIn Sentiment Assistant** Chrome extension. I'm passionate about bridging technology and business value, especially in AI, automation, and digital transformation.`,
    
    'education_motivation': `Excellent question! I pursued both degrees because I wanted a **complete foundation** - the Bachelor's gave me business fundamentals (strategy, finance, management) combined with IT systems thinking, while the Master's deepened my technical expertise in **AI, cloud computing, analytics programming, and business process automation**. The Bachelor's taught me *what* businesses need, and the Master's taught me *how* to build solutions. I also did them overlapping (started grad school in my senior year) because I was hungry to learn more and wanted to fast-track my technical depth. The combination makes me uniquely positioned - I can sit in C-suite meetings and discuss ROI and strategy, then turn around and architect the AI/cloud solution. Not many people bridge that gap effectively. Plus, working as a Graduate Assistant while earning my Master's reinforced my learning by teaching others. Best decision I ever made! .`,
    
    'why_ou': `University of Oklahoma was the perfect fit for me! **Academically**, the MIS program ranks in the top tier nationally with amazing professors who bring real industry experience. The **Price College of Business** has strong corporate relationships - that's how I landed internships at Love's, Objectstream, and the Beats by Dre externship. **Practically**, the cost-to-value ratio was unbeatable - I earned scholarships (Love's Scholar, OU MIS Department top 1/3) and made Dean's/President's Honor Roll 8 times, which made it financially sustainable. **Culturally**, I loved the collaborative environment - I got involved with Cousins Presidential Club, UI/UX Club, MIS Club, and Multicultural Business Program. **Location-wise**, Norman is close to OKC's growing tech scene but still has that college town energy. Plus, Boomer Sooner! 🎉 The combination of strong academics, industry connections, affordability, and community made OU the obvious choice. No regrets! .`,
    
    'why_mis': `I chose **Management Information Technology over pure Computer Science** because I wanted to solve business problems, not just write code. **MIS sits at the intersection** - we learn the technical depth (Python, SQL, cloud, AI) *plus* how to apply it strategically. Pure CS focuses on algorithms and theory; MIS focuses on **business value and ROI**. For example, in my Love's internship, success wasn't just "build a pipeline" - it was "reduce reporting latency by 21% and drive decisions." That requires understanding stakeholder needs, change management, and business context. **MIS curriculum** combines data science, business process automation, cloud architecture, consulting methodologies, and IT strategy. **Career-wise**, MIS opens doors to roles like Business Analyst, IT Consultant, Business Architect, Product Manager - roles where you influence strategy *and* execution. I can talk to executives about digital transformation and then build the solution. That's way more impactful than being siloed in pure development. Plus, consulting firms love MIS grads! .`,
    
    'business_tech_integration': `This is my superpower! I integrate business and technical thinking **every single day**. At **Objectstream**, I translate business requirements into Pega automation workflows - that means understanding process inefficiencies (business) and designing scalable architecture (technical). At **Love's**, I didn't just query data - I understood *why* stakeholders needed faster reporting (business impact) and architected cloud pipelines (technical solution). At **Beats by Dre**, I combined consumer psychology (business) with AI sentiment analysis (technical). **In projects**, Avatar Chat Portfolio demonstrates this - it's not just "cool 3D tech," it's a **business tool** for personal branding and networking. ChibiTomo solves productivity challenges (business need) with AI automation (technical execution). **My approach**: (1) Listen to business pain points, (2) Identify metrics that matter, (3) Design technical solutions that move those metrics, (4) Communicate value in business terms. I speak both languages fluently. That's rare and valuable! .`,
    
    'digital_transformation': `Based on my experiences, **digital transformation is fundamentally about using technology to reimagine how work gets done - not just automating old processes, but rethinking them entirely**. At **Objectstream with Pega**, we're not just digitizing manual forms - we're redesigning workflows so they're intelligent, adaptive, and scalable. At **Love's**, I didn't just move reports to the cloud - I automated data pipelines so analysts spend time on insights, not data gathering. **Three pillars I've learned**: (1) **People** - change management and adoption, (2) **Process** - redesigning workflows for digital-first thinking, (3) **Technology** - AI, cloud, automation as enablers. **It's not about tech for tech's sake** - it's about business outcomes: faster decisions, better customer experience, operational efficiency, new revenue streams. The companies that win are those who use technology to **compete differently**, not just compete better. That's what excites me - helping organizations make that leap.`,
    
    'passion_origin': `Great question! My passion for digital transformation sparked from **seeing inefficiency everywhere and knowing technology could fix it**. Early in my career at EVM (retail management), I saw teams drowning in manual processes - spreadsheets, paperwork, disconnected systems. I thought, "There has to be a better way." That's when I went back to school for my degrees. **The "aha moment"** came at Love's when my automation cut reporting time by 21% - I saw analysts' faces light up because they could finally do *analysis* instead of data wrangling. That's when I realized: **technology isn't about the tech, it's about giving people their time back to do meaningful work**. Then in my MIS courses, I learned about enterprise architecture, cloud, AI - and saw how these tools could transform entire organizations. Working with Pega now, I see digital transformation at scale. **Personal motivation**: My parents sacrificed everything to give me opportunities. I want to honor that by building solutions that genuinely help people and organizations thrive. That's what drives me every day.`,
    
    'career_vision': `My **long-term vision** is to become a **Digital Transformation Architect** or **AI Strategy Consultant** - someone who helps organizations reimagine their business models using AI and cloud technologies. **5-year horizon**: I see myself in a consulting role (Big 4, boutique firm, or tech company) leading digital transformation engagements, designing AI/cloud architectures, and advising C-suite on technology strategy. **10-year horizon**: I want to bridge leadership and deep technical expertise - think **Principal Architect or Practice Lead** who can win client deals *and* architect solutions. **Ultimate goal**: Maybe entrepreneurship - building AI-powered SaaS products that solve real business problems at scale. **Why this path?** I love the variety, intellectual challenge, and business impact of consulting. I'm energized by new problems, different industries, and the "blank canvas" of transformation projects. **I don't want to be pigeonholed** as just a coder or just a manager - I want to be the person who can envision the solution, sell it, architect it, and lead the team. That requires continuous learning and staying at the intersection of business and technology.`,
    
    'most_impactful': `The experience that shaped me most was honestly **my time at Love's Travel Stop**. Here's why: (1) **Real stakes** - My analytics directly impacted business decisions for a Fortune 150 company. When I cut reporting latency by 21%, that freed up analysts to find insights that saved real money. (2) **End-to-end ownership** - I went from understanding business requirements, to designing pipelines, to deploying dashboards, to presenting findings. That full-cycle experience taught me *how work actually gets done*. (3) **Cross-functional collaboration** - I worked with analysts, IT, business stakeholders - learned how to communicate technical concepts to non-technical people. (4) **Confidence boost** - Seeing my automation actually work and hearing "this changed how we operate" made me realize I can create real value. **Before Love's**, I had academic knowledge and small projects. **After Love's**, I had proof I could deliver in a professional environment under constraints. That internship validated my career pivot from retail to tech. It also taught me humility - enterprise systems are complex, stakeholder needs are nuanced, and "good enough shipped" beats "perfect never launched." Huge growth experience! .`,
    
    // Company-Specific Deep Dives
    'objectstream_role': `At **Objectstream as a Business Architect Intern with Pega**, my role is fascinating! **What I do**: I contribute to digital transformation initiatives by designing and supporting cloud-integrated business architecture solutions for enterprise clients. **Specifically**: (1) **Process Analysis** - I map current-state workflows, identify bottlenecks and inefficiencies, then design future-state automated processes using Pega. (2) **Architecture Design** - I create solution architectures that align with consulting best practices - scalability, security, integration patterns. (3) **Agile Collaboration** - I work in sprints with developers, business analysts, and project managers to deliver solutions iteratively. (4) **Client Engagement** - I participate in requirement gathering, design reviews, and demos. **Skills I use**: Critical thinking, communication, problem-solving, Pega platform knowledge, cloud integration concepts. **What I've learned**: Enterprise architecture is about trade-offs - speed vs. scalability, customization vs. standardization, cost vs. capability. Working in consulting teaches you to think like a business owner, not just a technologist. **Coolest part**: Seeing a manual 20-step approval process become a 2-click intelligent workflow. That's transformation! .`,
    
    'beats_insights': `The **Beats by Dre externship** was incredible! As a **Qualitative & Quantitative Insights Extern**, I explored how leading brands leverage consumer insights to guide strategy and innovation. **What I did**: (1) **Sentiment Analysis** - Used Python and AI tools (NLP libraries, sentiment models) to analyze consumer feedback from reviews, social media, and surveys. Uncovered patterns in what drives brand loyalty and emotional connection. (2) **Trend Identification** - Synthesized qualitative themes (why people love/hate features) with quantitative data (ratings, purchase behavior) to identify actionable insights. (3) **Storytelling** - Presented findings in compelling narratives that connected consumer emotions to business recommendations. **Key insight I discovered**: For Beats, it's not just about sound quality (table stakes) - it's about **identity and self-expression**. People buy Beats because they want to feel connected to music culture and make a statement. That emotional driver shapes everything from product design to marketing. **Skills gained**: Consumer psychology, data analytics, business strategy, presentation skills. **AI tools I used**: Python (pandas, nltk, transformers), sentiment analysis models, visualization libraries. This externship taught me how data becomes decisions in world-class brands. Fascinating work! .`,
    
    'loves_analytics': `Love's was such a defining experience! Let me break down that **21% reporting latency reduction** project: **The Problem**: Analytics team spent 60-70% of their time pulling data from multiple sources, cleaning it, and formatting reports. By the time reports reached decision-makers, data was often outdated. **My Solution**: I built **automated cloud-based reporting pipelines** using Python and SQL: (1) **Data Extraction** - Wrote Python scripts to pull data from various databases and APIs automatically on a schedule, (2) **Transformation** - Cleaned, validated, and aggregated data using pandas and SQL queries, (3) **Cloud Integration** - Deployed pipelines to cloud infrastructure for scalability and reliability, (4) **Dashboard Automation** - Connected processed data directly to Power BI and Tableau dashboards with real-time refresh. **The Impact**: Reporting time dropped from ~8 hours to ~6.5 hours (21% reduction). Analysts could focus on *analysis* instead of *data wrangling*. Stakeholders got fresher insights. **Biggest challenge**: Data quality and schema differences across systems - had to build robust error handling and validation. **What I learned**: Real-world data is messy, stakeholder communication is critical, and measuring business impact (not just technical success) is what matters. Proud of this one! .`,
    
    'teaching_role': `Being a **Graduate Assistant for Business Analysis & Database Admin** was incredibly rewarding! **My responsibilities**: (1) **Teaching Support** - Helped teach SQL, statistics, and dashboard development using PostgreSQL, Tableau, and Power BI. Held office hours, graded assignments, clarified concepts. (2) **Lab Design** - Created datasets and exercises simulating real-world business problems - supply chain analytics, financial reporting, customer segmentation. Made learning practical, not just theory. (3) **Database Management** - Maintained and optimized academic SQL Server databases for performance and reporting accuracy. Wrote complex queries, tuned indexes, ensured data integrity. **What students struggled with most**: (1) SQL joins - understanding inner vs outer vs cross joins, (2) Translating business questions into SQL queries, (3) Dashboard design principles - what makes a visualization effective vs cluttered. **How teaching helped me**: Explaining concepts forced me to understand them deeply. If you can't teach it simply, you don't truly understand it. Also strengthened my communication, patience, and leadership skills. **Most rewarding moment**: When a student who struggled initially sent me an email saying they got an analytics internship and thanked me for making SQL click. That feeling! .`,
    
    'retail_experience': `**Managing retail at EVM LLC** (2018-2022) was my first real leadership experience, and it shaped me more than you'd think! **Responsibilities**: (1) Day-to-day operations - supervising sales associates, opening/closing, inventory management, (2) Financial oversight - budgeting, revenue forecasting, P&L analysis, cost control, (3) Store modernization - integrated digital tools for inventory tracking, sales analytics, and process automation, (4) Team development - hired, trained, and mentored staff on customer service excellence and technology adoption. **Key lessons**: (1) **People management is hard** - balancing empathy with accountability, handling conflicts, motivating diverse personalities, (2) **Data-driven decisions** - even in retail, we used sales data to optimize inventory, staffing, and promotions, (3) **Technology adoption** - led digital transformation on a small scale - point-of-sale systems, inventory software, analytics dashboards. **How it prepared me for IT**: Running a store teaches you to **think like a business owner** - ROI, efficiency, customer experience, operational excellence. When I transitioned to tech, I already understood business context. I don't just build solutions - I build solutions that drive business value. That retail foundation makes me a better consultant! .`,
    
    // Project Deep Dives
    'avatar_inspiration': `This **Avatar Chat Portfolio** project came from a simple frustration: **traditional resumes and portfolios are boring and passive**! I wanted to create something memorable, interactive, and showcase my technical skills simultaneously. **The inspiration**: I saw AI chatbots everywhere, but they were generic. I thought, "What if visitors could have a conversation with *me* (or a digital version of me) that knows my entire background?" Combine that with **3D avatars** (cool factor), **RAG technology** (contextual answers), and **modern web development** (React, Three.js), and you get this experience. **Goals**: (1) Stand out from other candidates - hiring managers see hundreds of resumes, (2) Demonstrate full-stack skills - AI integration, 3D graphics, responsive design, (3) Make networking more engaging - instead of reading a static resume, people can ask questions naturally. **Tech highlights**: Google Gemini 1.5 Flash for conversational AI, RAG for context, ReadyPlayer.me for the avatar, Three.js for 3D rendering, React 18 + TypeScript + Vite for performance. **Reception**: People love it! It's sparked amazing conversations in networking events. Best portfolio decision ever! .`,
    
    'chibitomo_purpose': `**ChibiTomo solves a problem I personally experienced**: productivity tools are either too simple (basic timers) or too complex (project management overkill). I wanted something in between - a **Pomodoro companion that feels like a friend, not just a tool**. **Specific problems it solves**: (1) **Focus** - Uses Pomodoro technique (25 min work, 5 min break) to maintain concentration without burnout, (2) **Motivation** - AI-powered encouragement and contextual suggestions during breaks, (3) **Automation** - Integrates with system to auto-block distractions during focus sessions, (4) **Tracking** - Logs productivity patterns to help identify peak performance times. **Why desktop app?** I wanted something always accessible without browser tabs or internet dependency. **Tech stack**: Python (core logic), PySide6 (modern Qt UI), PyInstaller (standalone distribution), local AI models (contextual responses). **Feedback I've received**: Users love the personality - it's not robotic, it feels encouraging. Some want mobile versions (future feature!). **Business value**: Companies could use it for team productivity, remote work monitoring, or wellness programs. **What I learned**: UX design is hard - balancing features with simplicity, making AI feel natural not intrusive, desktop distribution challenges. Super proud of this project! .`,
    
    'aesculapius_privacy': `**Privacy was the core philosophy** behind Aesculapius AI. Here's why: I noticed that **every AI assistant requires internet, sends your data to cloud servers, and you have no idea what happens with it**. For household repairs or personal troubleshooting, people often describe problems that reveal information about their home, location, routines - sensitive stuff! **My solution**: Build an **entirely local LLM application** - all inference happens on your machine, no data ever leaves your device, no internet required after initial model download. **How it works**: (1) **Local LLM** - Uses Phi-3.5-mini (Microsoft's small but powerful model) running via llama-cpp, (2) **RAG Architecture** - Maintains a local vector database of repair manuals, troubleshooting guides, and parts catalogs, (3) **Contextual Memory** - Remembers your previous questions within a session (still local), (4) **API Integration** - Optionally queries parts databases or service providers (user controlled). **Benefits**: (1) Complete privacy and data ownership, (2) Works offline, (3) Faster inference (no network latency), (4) Free (no API costs). **Trade-offs**: Requires decent hardware, slightly less capable than GPT-4, more setup than cloud solutions. **Philosophy**: Privacy shouldn't be a premium feature - it should be the default. Users should own their data and their AI interactions. This project proves local AI is viable for real use cases! .`,
    
    'linkedin_motivation': `The **LinkedIn Sentiment Assistant** came from pure frustration: **manually engaging on LinkedIn is tedious, time-consuming, and you miss opportunities**! As someone building a professional brand, I wanted to engage authentically with my network, but reading every post, deciding what to comment, and crafting thoughtful responses took hours. **The idea**: What if AI could *assist* (not replace) me by: (1) **Analyzing sentiment** - Identify posts that align with my interests or need support, (2) **Smart automation** - Surface posts worth engaging with, suggest relevant comments, (3) **Toxicity filtering** - Avoid controversial or inappropriate content. **How it works**: Chrome extension that adds a layer to LinkedIn - analyzes posts in real-time using sentiment analysis models, provides engagement suggestions, has adaptive selectors that work even as LinkedIn updates their UI. **Value proposition**: Save time, engage more meaningfully, build network strategically. **Ethical considerations**: I'm very careful - it's an *assistant*, not a bot. Users review suggestions before posting. It enhances human interaction, doesn't fake it. **Technical challenges**: Chrome API limitations, LinkedIn's DOM complexity, real-time sentiment inference without slowing browsing, privacy (all analysis happens locally). **Reception**: Fellow students and professionals find it super useful for efficient networking! Future version could expand to Twitter, Reddit, etc.`,
    
    // Technical Deep Dives
    'cloud_preference': `Great technical question! I actually **prefer AWS, but I'm platform-agnostic** - each cloud has strengths. **Why AWS**: (1) **Maturity & breadth** - Most comprehensive service catalog, battle-tested at scale, (2) **Community & resources** - Best documentation, largest community, easier to find solutions, (3) **Career value** - Most in-demand certification and skill, (4) **Analytics/AI services** - SageMaker, Lambda, Redshift, Athena - powerful for my use cases. **But**: **Azure wins for enterprise integration** (seamless with Microsoft ecosystem), **GCP wins for ML/AI** (TensorFlow, BigQuery, Vertex AI) and pricing. **My approach**: Choose based on use case - AWS for general workloads, Azure for enterprise clients using Microsoft stacks, GCP for data science projects. **In practice at Love's**: We used multi-cloud (AWS for pipelines, Azure for BI integration). At Objectstream, we design cloud-agnostic architectures. **Certifications I'm pursuing**: AWS Cloud Practitioner → Solutions Architect, then Azure Fundamentals and GCP Digital Leader. **Philosophy**: Don't be dogmatic about cloud platforms - understand all three, master the concepts (IaaS, PaaS, serverless, containers), then adapt to client needs.`,
    
    'sql_proficiency': `SQL is one of my strongest skills! Let me break down my proficiency: **Joins**: Master all types - INNER (matching records), LEFT/RIGHT (preserve one side), FULL OUTER (preserve both), CROSS (cartesian product). I understand join performance implications (indexed columns, join order optimization) and when to use subqueries vs joins. **Window Functions**: Use extensively - ROW_NUMBER, RANK, DENSE_RANK for ranking, LAG/LEAD for time-series analysis, PARTITION BY for group calculations without GROUP BY, running totals with SUM() OVER(). These are game-changers for analytics! **CTEs (Common Table Expressions)**: Love them for readability and complex queries. Use WITH clauses to break logic into steps, recursive CTEs for hierarchical data. **Advanced concepts I use**: (1) Query optimization - EXPLAIN plans, index strategies, (2) Aggregate functions with HAVING, (3) CASE statements for conditional logic, (4) Temp tables vs CTEs vs subqueries - knowing when to use each, (5) Transaction management and data integrity. **Real-world application**: At Love's, wrote complex queries joining 5+ tables, using window functions for trend analysis, CTEs for multi-step transformations. As Graduate Assistant, taught these concepts - can explain simply! **Philosophy**: SQL is where business logic meets data - write queries that are correct, performant, AND readable.`,
    
    'debugging_approach': `My **debugging process for Python** is systematic: (1) **Reproduce consistently** - Understand exact steps to trigger the error, (2) **Read the error message carefully** - Stack trace tells you *where* and often *why*, (3) **Print debugging** - Strategic print statements to verify variable values and execution flow, (4) **Binary search** - Comment out half the code, narrow down problem area, (5) **Rubber duck method** - Explain the code out loud, often spotting the issue. **Tools I use**: (1) **Python debugger (pdb)** - Set breakpoints, step through code, inspect variables, (2) **Logging module** - Better than print for production code, (3) **Type hints + mypy** - Catch type errors before runtime, (4) **Unit tests** - Isolate and test individual functions, (5) **VS Code debugger** - Visual breakpoints and watch variables. **Common pitfalls I check**: (1) Variable scope issues, (2) Mutable default arguments, (3) Reference vs copy problems, (4) Off-by-one errors in loops, (5) None checks and exception handling. **Advanced techniques**: Memory profilers for performance, logging levels for different environments, assertion statements for sanity checks. **Philosophy**: Good debugging is about hypothesis testing - form a theory about what's wrong, test it, repeat. 80% of bugs are simple logic errors if you slow down and read carefully! .`,
    
    'ai_library_preference': `Tough choice, but here's my take: **For production systems: LangChain** - It's built for orchestration, chain-of-thought, and integration. Great for RAG architectures (like this Avatar Chat!), agent workflows, and connecting LLMs to external tools. Better abstractions for complex AI systems. **For research and fine-tuning: Hugging Face** - Unmatched model hub, best for custom models, fine-tuning pre-trained models, and staying on cutting edge. Transformers library is incredible. Better for going deep on specific models. **My typical usage**: (1) Prototyping - Hugging Face to test different models quickly, (2) Production - LangChain for orchestration + Hugging Face models as the engine, (3) RAG systems - LangChain (retrieval chains) + Hugging Face embeddings. **Example**: In Aesculapius AI, I use llama-cpp for inference (lightweight), but design follows LangChain patterns. In Avatar Chat, LangChain orchestrates the RAG pipeline with Gemini. **Other tools I use**: OpenAI API (for quick prototypes), LlamaIndex (alternative to LangChain, lighter weight), TensorFlow (when building custom models). **Philosophy**: Don't be dogmatic - use the right tool for the job. LangChain for systems, Hugging Face for models, both together for maximum power.`,
    
    // Leadership & Values
    'leadership_club': `Being **Events Chair for Cousins Presidential Club** was a fantastic leadership experience! **My role**: Plan and execute social, professional, and service events for 100+ members. **Specific responsibilities**: (1) Event ideation - networking mixers, tech workshops, community service projects, (2) Logistics - venues, catering, speakers, registration, budgets, (3) Marketing - promotion, sign-ups, attendance tracking, (4) Collaboration - worked with other officers, faculty advisors, external partners. **Key events I led**: (1) **Tech Career Panel** - Brought in alumni from Google, Microsoft, and startups to discuss career paths (100+ attendees), (2) **Hackathon Workshop** - Taught React and API integration to members, (3) **Community Service** - Organized food drive and volunteering at local tech non-profit. **Leadership lessons**: (1) **Delegation is key** - Can't do everything yourself, empower team members, (2) **Flexibility matters** - Plans change, venues cancel, speakers drop out - stay calm and adapt, (3) **Inclusive planning** - Consider diverse interests and schedules, make events accessible, (4) **Follow-through** - Ideas are easy, execution is hard - details matter. **Skills gained**: Public speaking, project management, budgeting, stakeholder communication, event logistics. **Impact**: Membership engagement increased 40% during my term! Proud of building community.`,
    
    'time_management': `**Balancing academics, internships, projects, and extracurriculars** required serious discipline! Here's my system: (1) **Prioritization Matrix** - Urgent vs Important. Focus on Important-Not-Urgent (learning, projects, networking) before they become urgent. (2) **Time Blocking** - Dedicated blocks for classes, work, projects, gym, sleep. Treat commitments like appointments. (3) **80/20 Rule** - Focus on high-impact activities. Not everything needs perfection - some tasks need "good enough." (4) **Say No Strategically** - Can't do everything. Decline opportunities that don't align with goals. (5) **Batch Similar Tasks** - All coding in one block, all meetings in another - reduces context switching. (6) **Use Dead Time** - Listen to podcasts during commutes, review flashcards between classes. **Tools I use**: Google Calendar (everything goes in), Notion (task management), ChibiTomo (focus sessions!), timers for deep work. **Real example**: During my Master's + Love's internship + Graduate Assistant + Objectstream - I had classes 3 days/week, internships on specific days, GA work 10hrs/week, projects on weekends. Strict schedule but flexible within blocks. **Key insight**: Energy management > time management. I protect sleep, exercise, and mental health because they multiply productivity. **Philosophy**: You have time for what you prioritize. If it matters, you'll make time.`,
    
    'team_motivation': `**Motivating teams is about understanding individual drivers and creating shared purpose**. Here's my approach: (1) **Know your people** - Some are motivated by recognition, others by growth, others by autonomy. Ask what matters to them. (2) **Clear vision** - People want to know *why* their work matters, not just *what* to do. Connect tasks to bigger impact. (3) **Celebrate wins** - Acknowledge progress publicly, give credit generously. Small wins build momentum. (4) **Remove blockers** - Nothing demotivates like bureaucracy or obstacles. Clear the path so team can focus on value work. (5) **Lead by example** - Work hard, stay positive, admit mistakes, ask for help. Vulnerability builds trust. **Real examples**: (1) **At EVM** - I implemented "Employee of the Month" based on peer nominations, gave team ownership of merchandising decisions, celebrated sales milestones with team lunches. Turnover dropped significantly. (2) **In student clubs** - Recognized volunteers publicly, showed how events impacted members, made planning inclusive and fun. (3) **As Graduate Assistant** - Celebrated student breakthroughs, shared success stories, made office hours welcoming and judgment-free. **Under pressure**: Stay calm, communicate transparently, break big goals into small wins, provide support and resources. Pressure is when leadership matters most. **Philosophy**: Motivation is internal, but leaders create the environment where it thrives.`,
    
    'work_culture': `Culture that motivates me has **four pillars**: (1) **Learning & Growth** - I want to work where I'm constantly challenged, where senior people mentor me, where I can make mistakes and learn. Stagnation kills my motivation. (2) **Impact & Ownership** - I need to see how my work drives business value. I thrive when given autonomy and accountability - tell me the goal, trust me to figure out how. (3) **Collaboration & Respect** - I love cross-functional teams where diverse perspectives are valued. No ego, no politics - just smart people solving hard problems together. (4) **Innovation & Experimentation** - I want to work where new ideas are encouraged, where "let's try it" beats "we've always done it this way." **Red flags for me**: (1) Micromanagement, (2) Blame culture, (3) No work-life balance, (4) Slow bureaucracy with no urgency. **Companies I admire**: Amazon (bias for action), Google (innovation time), Accenture/Deloitte (diverse projects), startups (fast-paced ownership). **Why**: They combine high standards with growth opportunities. **In practice**: I loved Love's culture (supportive, growth-focused), Objectstream's consulting environment (client-driven, fast-paced), OU's collaborative academic environment. **Philosophy**: Culture eats strategy for breakfast. I'd rather work for a great team with a mediocre product than a bad team with a great product.`,
    
    'handling_failure': `I handle failure and criticism through **four steps**: (1) **Pause & Process** - When I receive criticism, I take a breath. Initial reaction is often defensive - I let that pass before responding. (2) **Seek to Understand** - I ask clarifying questions: "Can you give me a specific example?" "What would success look like?" Criticism is vague, feedback is specific. (3) **Find the Truth** - Even harsh criticism usually has a kernel of truth. I separate the message from the delivery and identify what I can learn. (4) **Action Plan** - I decide what I will change. **Real examples**: (1) **At Love's internship**, my dashboard was criticized as "too cluttered." Initial reaction: defensive ("I worked hard on this!"). After processing: They were right - I prioritized showcasing skills over user experience. **Lesson**: Good design serves users, not ego. I redesigned for clarity, stakeholders loved it. (2) **As Graduate Assistant**, student complained my explanations were "too fast." Gut reaction: frustration. Reflection: I'm comfortable with SQL, they're learning. **Lesson**: Teaching requires meeting people where they are. I slowed down, used more examples, got better reviews. **Philosophy**: Criticism is a gift if you unwrap it right. Failure is data - what did I learn, what will I do differently? Ego is the enemy of growth. I'd rather be humble and improving than proud and stagnant.`,
    
    'why_hire': `You should hire me because I bring a **rare combination of technical depth, business acumen, and execution ability** that delivers immediate value: **1. Technical Skills**: I'm not just theoretical - I've built production systems. From AI-powered applications (Avatar Chat, ChibiTomo, Aesculapius AI) to enterprise analytics pipelines (Love's 21% efficiency gain) to automation workflows (Pega at Objectstream). I code in Python, SQL, JavaScript; work across AWS, Azure, GCP; implement LLMs, RAG, and ML models; build dashboards in Tableau and Power BI. **2. Business Value**: I don't just build tech - I drive outcomes. Reduced reporting time 21%, automated enterprise workflows, synthesized consumer insights at Beats. I understand ROI, stakeholder management, and translating technical solutions into business language. **3. Fast Learner**: Master's + Bachelor's simultaneously, while working 3 internships, building 4 major projects, and teaching as GA. I learn fast and apply immediately. **4. Cultural Fit**: I'm curious, collaborative, humble, and driven. I ask great questions, take feedback well, work across teams, and bring positive energy. **5. Passion**: This isn't just a job for me - I genuinely love solving problems with technology. I'll bring that enthusiasm every day. **Bottom line**: You're not just hiring someone who can do the job - you're hiring someone who will exceed expectations, grow fast, and make your team better. I'm ready to prove it.`,
    
    'learning_from_mistakes': `One of my biggest early mistakes: **Over-engineering solutions instead of solving problems**. **The situation**: In an early project (before Love's), I was building an analytics dashboard. I got excited about the tech - "Let's use microservices! Docker! Kubernetes! GraphQL!" The result? Weeks of work on architecture, minimal business value delivered. **The wake-up call**: My mentor asked, "Does this solve the user's problem faster than a simple Python script and Tableau?" I realized: **I was building for my resume, not for the user**. **What I learned**: (1) **Start with the problem, not the solution** - Understand pain points deeply before designing, (2) **Simplest solution that works wins** - You can always add complexity later if needed, (3) **Iterate with users** - Get feedback early and often, don't disappear for weeks, (4) **Technology is a means, not the end** - Users don't care about your tech stack, they care about their problem being solved. **How it changed me**: At Love's, I could have built a complex data platform, but stakeholders just needed faster reports. I automated with simple Python scripts - took 2 weeks, delivered immediate value. At Objectstream, I focus on business outcomes first, architecture second. **Philosophy**: The best engineers balance technical excellence with pragmatism. Perfect is the enemy of done. Shipping beats architecture astronautics. That mistake made me a better consultant! .`,
    
    'tech_ethics': `**Ethical technology use is critical, especially with AI**. My principles: (1) **Privacy by Design** - See Aesculapius AI - I built it entirely local because household data is sensitive. Users should control their data, period. Default should be privacy, not surveillance. (2) **Transparency & Explainability** - AI decisions that impact people (hiring, lending, healthcare) must be explainable. Black boxes are dangerous. I always document model logic and limitations. (3) **Bias Awareness** - AI models inherit biases from training data. I actively test for bias (gender, race, age), use diverse datasets, and question assumptions. At Beats, analyzing sentiment meant understanding cultural context. (4) **Human-in-the-Loop** - AI should augment humans, not replace judgment. My LinkedIn Assistant suggests, humans decide. Critical decisions need human oversight. (5) **Informed Consent** - Users should know when they're interacting with AI, how their data is used, and be able to opt out. No deceptive practices. **Real example**: In ChibiTomo, I could have collected user productivity data (valuable!), but didn't - privacy matters more than data monetization. **Philosophy**: Just because we *can* build something doesn't mean we *should*. As technologists, we have responsibility to consider societal impact. I want to build AI that empowers people, respects autonomy, and makes society better - not just profitable.`,
    
    'hobbies': `Great question! Outside of work and tech, I'm pretty well-rounded. I **love cats** 🐱 - in fact, I once 3D-printed a medical device to help my cat's injured tail (combining my love for animals with problem-solving!). I'm into **fitness** - staying active keeps my mind sharp for coding marathons. I'm a **foodie** - especially love Mexican and Thai cuisine. I also enjoy **cars** - there's something about the engineering and design that fascinates me. I volunteer when I can and stay involved in community activities. **Learning** is honestly a hobby too - whether it's exploring new AI frameworks, reading about business strategy, or just understanding how things work. I'm also big on **family time** - my parents sacrificed everything to give me opportunities, so I cherish time with them. Balance is important to me - tech is my passion, but life is about more than code.`,
    
    'contact': `I'd love to connect! Here's how to reach me:\n\n📧 **Email:** marzook.mansoor@outlook.com\n📱 **Phone:** (405) 588-9434\n💼 **LinkedIn:** linkedin.com/in/marzook-mansoor\n💻 **GitHub:** github.com/zzthecoder\n\nFeel free to reach out about opportunities, collaborations, technical discussions, or just to say hi! I'm always open to chatting about AI, digital transformation, cloud architecture, or any interesting tech challenges.`
  };
  
  return responses[pattern] || `Great question! Let me think about that... ${pattern}`;
}

// Advanced response generation with context and personality
export async function generateRAGResponse(question: string): Promise<string> {
  console.log('🔵 START generateRAGResponse - Question:', question);
  const startTime = performance.now();
  
  try {
    console.log('🔵 Step 0.1: Checking cache...');
    // Check cache first for identical questions
    const cachedResponse = getCachedResponse(question);
    if (cachedResponse) {
      const responseTime = (performance.now() - startTime).toFixed(2);
      console.log(`⚡ Response time: ${responseTime}ms (cached)`);
      return cachedResponse;
    }
    console.log('🔵 Step 0.2: No cache, continuing...');
    
    let resume: ResumeData;
    try {
      resume = await loadResumeData();
    } catch (error) {
      console.error('⚠️ Resume data load failed, using minimal fallback:', error);
      // Create minimal resume data as fallback
      resume = {
        name: 'Marzook Mansoor',
        location: 'Edmond, OK',
        bio: 'AI/ML Engineer and Business Analyst',
        tagline: 'Building AI solutions',
        professional_summary: 'Passionate about AI, automation, and digital transformation',
        skills: ['Python', 'SQL', 'AI/ML', 'React', 'TypeScript'],
        projects: [],
        experience: [],
        education: []
      };
    }
    
    console.log('✅ Step 1: Resume loaded');
    
    let normalizedQuestion: string;
    try {
      normalizedQuestion = normalizeQuery(question);
      console.log('✅ Step 2: Query normalized:', normalizedQuestion);
    } catch (error) {
      console.error('❌ normalizeQuery failed:', error);
      // Use the original question as fallback
      normalizedQuestion = question.toLowerCase().trim();
      console.log('⚠️ Using fallback normalization');
    }
    
    let intents: string[];
    try {
      intents = detectIntent(normalizedQuestion);
      console.log('✅ Step 3: Intents detected:', intents);
    } catch (error) {
      console.error('❌ detectIntent failed:', error);
      // Use empty array as fallback
      intents = [];
      console.log('⚠️ Using fallback intents (empty)');
    }
    
    let relevantInfo: string;
    try {
      relevantInfo = extractRelevantInfo(resume, normalizedQuestion);
      console.log('✅ Step 4: Relevant info extracted');
    } catch (error) {
      console.error('❌ extractRelevantInfo failed:', error);
      // Use empty string as fallback
      relevantInfo = '';
      console.log('⚠️ Using fallback relevant info (empty)');
    }
    
    const questionLower = question.toLowerCase();

    console.log('🎯 Detected intents:', intents);
    console.log('📊 Conversation context:', conversationContext);
    console.log('📝 Normalized question:', normalizedQuestion);
    console.log('📝 Original question:', question);
    console.log('📝 Question lower:', questionLower);
    
    // EMERGENCY FIX: Direct handling for project questions
    if (questionLower.includes('project')) {
      console.log('🚨 EMERGENCY: Direct project handler triggered');
      const projectResponse = `I've built some exciting projects! **Avatar Chat Portfolio** (you're in it!) - an interactive 3D portfolio with an AI avatar using RAG and Gemini 1.5 Flash. **ChibiTomo** - AI-powered desktop Pomodoro companion with Python and PySide6. **Aesculapius AI** - privacy-first household repair assistant using local LLMs with RAG (no internet needed!). **LinkedIn Sentiment Assistant** - Chrome extension with AI sentiment analysis for smarter LinkedIn engagement. Plus capstone projects at OU involving ML models, UiPath bots, and cloud dashboards. Each one taught me something about building solutions people actually want to use.`;
      cacheResponse(question, projectResponse);
      return projectResponse;
    }

    // Check for specific question patterns first
    const pattern = matchQuestionPattern(question);
    console.log('🔍 Pattern match result:', pattern);
    if (pattern) {
      console.log('✅ Pattern matched:', pattern);
      const response = getPatternResponse(pattern, resume, conversationContext);
      cacheResponse(question, response);
      const responseTime = (performance.now() - startTime).toFixed(2);
      console.log(`⚡ Response time: ${responseTime}ms (pattern-matched)`);
      return response;
    } else {
      console.log('❌ No pattern matched, falling through to generic handlers');
    }

    // Greeting responses with variety and personality
    if (/^(hi|hey|hello|howdy|yo|sup|what's up|good morning|good afternoon|good evening)[\s!?]*$/.test(questionLower.trim())) {
      const greetings = [
        `Hey there! I'm Marzook - great to meet you! ${conversationContext.sentiment === 'casual' ? "I'm loving this 3D avatar experience I built!" : "I'm an AI engineer and Business Architect passionate about solving real problems with technology."}`,
        `Hi! I'm Marzook Mansoor from Edmond, OK. ${conversationContext.depth === 'overview' ? "Quick intro:" : "Let me tell you a bit about myself:"} I'm finishing up my Master's in IT while working on exciting AI and automation projects.`,
        `Hello! ${conversationContext.askedAbout.size > 0 ? "Good to continue our chat!" : "Good to see you."} I'm Marzook, and I'm passionate about how AI and technology can drive real business value. ${conversationContext.sentiment === 'professional' ? "I have experience in digital transformation, cloud architecture, and analytics." : "I build everything from 3D portfolio sites to intelligent desktop assistants."}`,
        `Hey! Marzook here 👋 I blend AI, analytics, cloud architecture, and business strategy to create meaningful solutions. ${conversationContext.topics.includes('ai') ? "Since you're interested in AI, I work extensively with LLMs and RAG systems!" : "Currently exploring opportunities in AI and digital transformation."}`,
        `Hi there! I'm Marzook. ${conversationContext.askedAbout.has('projects') ? "You've already seen some of my projects - thanks for asking!" : "I love building AI-powered applications and automating complex business processes."} From analytics pipelines that cut reporting time by 21% to intelligent desktop assistants, I'm all about practical innovation.`
      ];
      return greetings[Math.floor(Math.random() * greetings.length)];
    }

    // Follow-up awareness
    const isFollowUp = conversationContext.topics.length > 0 && (
      /tell me more|what else|anything else|continue|go on|elaborate/i.test(question)
    );

    if (isFollowUp) {
      const lastTopic = conversationContext.topics[conversationContext.topics.length - 1];
      if (lastTopic === 'projects' || lastTopic === 'project') {
        return `Absolutely! So beyond the projects I mentioned, I also worked on capstone projects at OU - ML models for delivery prediction and SLA compliance, UiPath automation bots, and cloud-based dashboards integrated with SharePoint and Power Apps. Each project taught me something about the full development lifecycle - from ideation to deployment. I especially enjoyed the challenge of making complex tech actually usable for real people.`;
      }
    }

    // Projects - Enhanced with conversation awareness
    if (intents.includes('projects') || questionLower.includes('project')) {
      conversationContext.askedAbout.add('projects');
      
      if (conversationContext.depth === 'detailed') {
        return `Let me dive deeper into my projects! **Avatar Chat Portfolio** (what you're using now!) is my flagship - an interactive 3D experience using React, TypeScript, Three.js, Google Gemini 1.5 Flash, and RAG. You're chatting with an AI-powered avatar trained on my resume data. **ChibiTomo** is an AI-powered desktop Pomodoro companion built with Python and PySide6 - it combines productivity tracking with AI and automation, packaged as a standalone Windows app with PyInstaller. **Aesculapius AI** is privacy-first household repair assistant using Phi-3.5-mini (local LLM) with RAG architecture for personalized troubleshooting - no data leaves your machine. My **LinkedIn Sentiment Assistant** is a Chrome extension with AI-based sentiment analysis and smart automation for LinkedIn engagement. Each solves a real problem I experienced.`;
      }
      
      return `I've built some exciting projects! **Avatar Chat Portfolio** (you're in it!) - an interactive 3D portfolio with an AI avatar using RAG and Gemini 1.5 Flash. **ChibiTomo** - AI-powered desktop Pomodoro companion with Python and PySide6. **Aesculapius AI** - privacy-first household repair assistant using local LLMs with RAG (no internet needed!). **LinkedIn Sentiment Assistant** - Chrome extension with AI sentiment analysis for smarter LinkedIn engagement. Plus capstone projects at OU involving ML models, UiPath bots, and cloud dashboards. Each one taught me something about building solutions people actually want to use.`;
    }

    // Experience - Context-aware responses
    if (intents.includes('experience') || questionLower.includes('experience') || questionLower.includes('work') || questionLower.includes('job')) {
      conversationContext.askedAbout.add('experience');
      
      // Check if asking about specific company
      if (questionLower.includes('love')) {
        return `Love's Travel Stop was amazing! As a Business Analyst Intern (May-Aug 2025), I developed predictive analytics and reporting pipelines that supported data-driven decisions across the organization. My proudest achievement was automating cloud-based workflows with Python and SQL that reduced reporting latency by 21% - that's real time saved for the analytics team. I also built interactive Power BI and Tableau dashboards that made complex data actually actionable for stakeholders. Working there taught me how to bridge technical innovation with business impact.`;
      }
      
      if (questionLower.includes('pega') || questionLower.includes('objectstream')) {
        return `I'm currently a Business Architect Intern at Objectstream working with Pega (Sept-Dec 2025)! I'm contributing to digital transformation initiatives that automate and optimize enterprise workflows - think replacing manual 20-step processes with intelligent automation. I design cloud-integrated business architecture solutions using consulting best practices, and work in Agile teams to deliver scalable process improvements. Pega is fascinating because it's not just coding - it's understanding business logic and translating that into automated workflows. The consulting aspect taught me so much about communication and problem-solving.`;
      }
      
      return `I've had some incredible experiences! Right now I'm wrapping up my Master's in IT from OU while working as a **Business Architect Intern at Objectstream with Pega** (Sept-Dec 2025), focusing on digital transformation and enterprise workflow automation. Before that, I was a **Business Analyst Intern at Love's Travel Stop** (May-Aug 2025) where I built analytics pipelines that cut reporting time by 21%. I've also been a **Qualitative & Quantitative Insights Extern at Beats by Dre** (Sept-Dec 2025) doing consumer sentiment analysis with Python and AI, a **Graduate Assistant at OU** (May 2022-May 2025) teaching SQL and data viz, and an **Assistant Manager at EVM LLC** (2018-2022) managing retail operations before transitioning into tech. Each role taught me something about connecting technology with business value.`;
    }

    // Skills - Intelligent categorization
    if (intents.includes('skills') || questionLower.includes('skill') || questionLower.includes('expertise') || questionLower.includes('what can you do')) {
      conversationContext.askedAbout.add('skills');
      
      if (questionLower.includes('ai') || questionLower.includes('ml')) {
        return `AI/ML is my sweet spot! I specialize in **LLMs, RAG systems, LangChain, Transformers, Hugging Face models, and TensorFlow**. I've built everything from local LLM applications (Aesculapius AI with Phi-3.5-mini) to cloud-based AI chatbots (like this avatar using Gemini 1.5 Flash). I'm passionate about RAG because it grounds AI responses in real data - no hallucinations. I also work with scikit-learn for traditional ML and understand the full pipeline from data prep to model deployment. The coolest part is seeing AI solve actual problems, not just demos.`;
      }
      
      if (questionLower.includes('cloud')) {
        return `Cloud is where I thrive! I work across **AWS (pursuing Cloud Practitioner certification), Azure, and GCP**. I've architected cloud-integrated solutions, automated workflows in cloud environments, and built pipelines that process data at scale. At Love's, I automated cloud-based analytics workflows with Python that saved 21% reporting time. I understand cloud architecture patterns, cost optimization, and how to choose the right services for each use case. Planning to add Microsoft Fundamentals (MS-900) and Google Cloud Digital Leader certs next.`;
      }
      
      return `I'm pretty versatile! **Core strengths:** Python, SQL, AI/ML (LLMs, RAG, LangChain, Transformers), cloud platforms (AWS, Azure, GCP), and full-stack development (React, TypeScript, PySide6). **Business tools:** Pega Systems, UiPath, Tableau, Power BI, Snowflake, Alteryx. **Consulting competencies:** Digital transformation, cloud architecture, automation, analytics, Agile methodologies. What I love most is connecting these skills to solve actual business problems - whether that's cutting reporting time by 21%, automating enterprise workflows, or building AI assistants that actually help people.`;
    }

    // Education - Personal and detailed
    if (intents.includes('education') || questionLower.includes('education') || questionLower.includes('degree') || questionLower.includes('university') || /\bou\b/.test(questionLower) || questionLower.includes('oklahoma')) {
      conversationContext.askedAbout.add('education');
      return `I just completed my **Master of Science in Management Information Technology** at the University of Oklahoma (Aug 2023-May 2025), and I also have my **Bachelor of Business Administration in Management Information Systems** from OU (Aug 2021-May 2025). The Master's program was intense but amazing - courses in Data Science & Analytics, Business Process Automation & AI, Cloud Computing, Analytics Programming with Python, Databases & BI. I also worked as a Graduate Assistant teaching SQL, statistics, and dashboard development, which really deepened my understanding. But honestly, some of my best learning came from building projects outside class and working internships. The combination of academic foundation + real-world experience is what makes me effective. Boomer Sooner! 🎉 .`;
    }

    // AI/ML specific - Deep technical discussion (but not if asking about what's NEW/TRENDING)
    if ((intents.includes('ai') || questionLower.includes('ai') || questionLower.includes('machine learning') || questionLower.includes('llm')) 
        && !/what'?s (new|latest|trending|happening)|news|recent|today|current/i.test(questionLower)) {
      conversationContext.askedAbout.add('ai');
      return `AI is my absolute passion! I'm particularly excited about **LLMs and RAG (Retrieval-Augmented Generation)** - which is exactly what powers this conversation right now. I've built projects like **Aesculapius AI** using Phi-3.5-mini (local LLM with RAG) for privacy-first household assistance, and this **Avatar Chat Portfolio** integrating Gemini 1.5 Flash with RAG so the avatar knows my resume inside-out. I work with **LangChain for orchestration, Hugging Face for models, Transformers for fine-tuning, TensorFlow for training**. What fascinates me most is making AI actually useful - not just impressive demos but solutions that solve real problems. Like using sentiment analysis at Beats by Dre to understand consumer feedback at scale. The future is context-aware AI that understands your needs.`;
    }
    
    // AI news/trends questions - redirect appropriately
    if (/what'?s (new|latest|trending|happening)|news|recent|today|current/i.test(questionLower) && /ai|technology|tech/i.test(questionLower)) {
      return `That's a great question about current AI trends! Since I'm Marzook's portfolio chatbot focused on his background and experience, I can't give you real-time news updates. But I can tell you what **I'm** excited about and working on: **RAG systems** (like this conversation!), **local LLMs for privacy**, **AI-powered productivity tools**, and **practical business applications** of AI. I'm passionate about making AI actually useful, not just hyped.`;
    }

    // Contact - Warm and inviting
    if (intents.includes('contact') || questionLower.includes('contact') || questionLower.includes('reach') || questionLower.includes('email') || questionLower.includes('phone')) {
      conversationContext.askedAbout.add('contact');
      return `I'd love to connect! **Email:** marzook.mansoor@outlook.com | **Phone:** (405) 588-9434 | **LinkedIn:** linkedin.com/in/marzook-mansoor | **GitHub:** github.com/zzthecoder. ${conversationContext.sentiment === 'professional' ? "Feel free to reach out about opportunities, collaborations, or technical discussions." : "Whether it's a project idea, a question about tech, or just saying hi, I'm always open to chatting!"} ${conversationContext.askedAbout.size > 1 ? "Thanks for the great questions so far!" : ""} .`;
    }

    // Achievements - Authentic and humble
    if (intents.includes('achievements') || questionLower.includes('achievement') || questionLower.includes('proud') || questionLower.includes('accomplishment')) {
      conversationContext.askedAbout.add('achievements');
      return `I'm proud of a few things! 🎯 **Academically:** Completed my Master's while working full-time, earned the Love's Scholar award, received the OU MIS Department Scholarship (top 1/3), and made President's/Dean's Honor Roll 8 times. **Professionally:** Cut reporting latency by 21% at Love's through automation - that's real time saved. Built projects people actually use like ChibiTomo and Aesculapius AI. **Leadership:** Served as Events Chair for Cousins Presidential Club and UI/UX Club, managed the Edmond Soccer Club. But honestly, I'm most proud of my curiosity and drive - always wanting to learn more, push into new areas, and build things that matter. The journey is just getting started! .`;
    }

    // Personal/Background - Warm and relatable
    if (intents.includes('personal') || questionLower.includes('personal') || questionLower.includes('background') || questionLower.includes('story') || questionLower.includes('passion')) {
      return `Thanks for asking! I was born in India and moved to Oklahoma when I was 8 - that experience really shaped how I see adaptability and the value of family sacrifice. My parents gave up everything to give me opportunities, and I want to honor that by making an impact. I'm passionate about AI because I genuinely believe it can solve real problems - not just hype, but practical tools that help people. Outside tech, I love cats 🐱, cars, Mexican and Thai food, fitness, and volunteering. I even 3D-printed a medical device to help my cat's injured tail! I'm also big into continuous learning - whether it's new frameworks, business strategies, or just understanding how things work. Family-oriented, curious, and always building something.`;
    }

    // Consulting/Business side
    if (questionLower.includes('consult') || questionLower.includes('business') || questionLower.includes('strategy')) {
      return `Great question! My consulting experience comes from my work at **Objectstream with Pega** where I'm learning business architecture and digital transformation methodologies. I apply critical thinking, stakeholder communication, and problem-solving to design scalable process improvements. I collaborate in Agile teams, understand how to translate business requirements into technical solutions, and align technology with enterprise goals. My **Beats by Dre externship** also taught me about business strategy - how leading brands use consumer insights to guide decisions. I combine technical depth (Python, AI, cloud) with business acumen (process optimization, analytics, strategy) - that's what makes me effective. I don't just build tech; I build solutions that drive business value.`;
    }

    // "Why" questions - Motivation and philosophy (but NOT hiring questions or specific why questions)
    if ((intents.includes('motivation') || questionLower.includes('why')) 
        && !/hire|should we|choose you|pick you/i.test(questionLower)) {
      const response = `Great philosophical question! Why do I do this? **Honestly:** I'm driven by the idea that technology should make life genuinely better, not just more complicated. I saw my parents sacrifice everything to give me opportunities, so I want to build things that create value and help people. **Technically:** I'm fascinated by the intersection of AI and real-world problems - that sweet spot where smart algorithms meet actual human needs. Every project I build solves a problem I've experienced or seen others struggle with. **Practically:** I love the moment when someone uses something I built and says "this actually helps!" That's the validation. It's not about fancy tech for tech's sake - it's about impact.`;
      cacheResponse(question, response);
      return response;
    }

    // Smart fallback with keyword extraction
    const questionWords = questionLower.split(/\s+/).filter(w => w.length > 3);
    const relevantKeywords = questionWords.filter(word => 
      Object.values(SEMANTIC_KEYWORDS).flat().some(keyword => 
        keyword.includes(word) || word.includes(keyword)
      )
    );
    
    let smartFallback = `That's an interesting question`;
    
    if (relevantKeywords.length > 0) {
      smartFallback += ` about ${relevantKeywords.slice(0, 2).join(' and ')}`;
    }
    
    smartFallback += `! ${conversationContext.askedAbout.size > 0 ? `We've talked about ${Array.from(conversationContext.askedAbout).slice(-3).join(', ')} - ` : ''}`;
    
    if (intents.length > 0) {
      smartFallback += `It sounds like you're interested in my ${intents[0]}. `;
    }
    
    smartFallback += `I can tell you about my **work experience** (Love's, Objectstream/Pega, Beats), **AI projects** (Avatar Chat, ChibiTomo, Aesculapius AI), **technical skills** (Python, SQL, AI/ML, cloud), **education** (Master's & Bachelor's from OU), or **anything else**.`;
    
    cacheResponse(question, smartFallback);
    const responseTime = (performance.now() - startTime).toFixed(2);
    console.log(`⚡ Response time: ${responseTime}ms (fallback)`);
    return smartFallback;
  } catch (error) {
    console.error('❌ Advanced RAG error:', error);
    console.error('❌ Error details:', error instanceof Error ? error.message : String(error));
    console.error('❌ Stack trace:', error instanceof Error ? error.stack : 'No stack trace');
    return `I appreciate the question! ${conversationContext.askedAbout.size > 0 ? "We've had a great chat, but " : ""}I'm having a brief technical moment. Could you try rephrasing or asking about my projects, experience, skills, or education? I promise I'll give you a thoughtful answer!`;
  }
}

export interface ChatMessage {
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

  // Keep last 12 messages for context
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






