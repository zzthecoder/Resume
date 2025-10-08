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
  contact: {
    email: string;
    github: string;
    linkedin: string;
    twitter: string;
  };
}

let cachedData: KnowledgeBase | null = null;

export async function loadKnowledgeBase(): Promise<KnowledgeBase> {
  if (cachedData) return cachedData;
  
  const response = await fetch('/data/me.json');
  cachedData = await response.json();
  return cachedData!;
}

export async function getAnswer(question: string): Promise<string> {
  const data = await loadKnowledgeBase();
  const q = question.toLowerCase();

  // Skills
  if (q.includes('skill') || q.includes('technology') || q.includes('tech stack')) {
    return `I specialize in ${data.skills.slice(0, 5).join(', ')}, and more. I love working with modern web technologies and constantly learning new tools.`;
  }

  // Experience
  if (q.includes('experience') || q.includes('work') || q.includes('job')) {
    const latest = data.experience[0];
    return `I'm currently a ${latest.role} at ${latest.company}. ${latest.impact} I've been in the industry for several years, with experience across full-stack development, AI integration, and team leadership.`;
  }

  // Projects
  if (q.includes('project') || q.includes('built') || q.includes('portfolio')) {
    const projects = data.projects.map(p => `**${p.title}**: ${p.description}`).join('\n\n');
    return `Here are some projects I'm proud of:\n\n${projects}`;
  }

  // About me / bio
  if (q.includes('about') || q.includes('who') || q.includes('tell me')) {
    return `I'm ${data.name}. ${data.bio} ${data.tagline}`;
  }

  // Fun facts
  if (q.includes('fun') || q.includes('hobby') || q.includes('interest')) {
    const facts = data.fun_facts.slice(0, 2).join(' ');
    return facts;
  }

  // Contact
  if (q.includes('contact') || q.includes('email') || q.includes('reach')) {
    return `You can reach me at ${data.contact.email}. I'm also on GitHub, LinkedIn, and Twitter. Feel free to connect!`;
  }

  // Default
  return `Great question! You can ask me about my skills, experience, projects, or just to tell you more about myself. What would you like to know?`;
}
