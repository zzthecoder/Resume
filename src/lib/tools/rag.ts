// RAG (Retrieval-Augmented Generation) system for local knowledge
export interface RAGMatch {
  text: string;
  score: number;
  source: string;
  meta?: Record<string, any>;
}

export interface RAGResult {
  matches: RAGMatch[];
  query: string;
  timestamp: Date;
}

// Simple in-memory vector store using cosine similarity
class SimpleVectorStore {
  private documents: Array<{
    id: string;
    text: string;
    embedding: number[];
    meta: Record<string, any>;
  }> = [];

  // Simple embedding using character frequency (replace with proper embeddings later)
  private embed(text: string): number[] {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789 ';
    const vector = new Array(chars.length).fill(0);
    
    const normalizedText = text.toLowerCase();
    for (const char of normalizedText) {
      const index = chars.indexOf(char);
      if (index !== -1) {
        vector[index]++;
      }
    }
    
    // Normalize
    const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    return magnitude > 0 ? vector.map(val => val / magnitude) : vector;
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    let dotProduct = 0;
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
    }
    return dotProduct;
  }

  addDocument(id: string, text: string, meta: Record<string, any> = {}): void {
    const embedding = this.embed(text);
    this.documents.push({ id, text, embedding, meta });
  }

  search(query: string, topK = 5): RAGMatch[] {
    const queryEmbedding = this.embed(query);
    
    const results = this.documents
      .map(doc => ({
        text: doc.text,
        score: this.cosineSimilarity(queryEmbedding, doc.embedding),
        source: doc.meta.source || doc.id,
        meta: doc.meta
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);

    return results;
  }

  clear(): void {
    this.documents = [];
  }

  getDocumentCount(): number {
    return this.documents.length;
  }
}

// Global vector store instance
const vectorStore = new SimpleVectorStore();

// Initialize the knowledge base
export async function initializeRAG(): Promise<void> {
  try {
    console.log('Initializing RAG system...');
    
    // Load the existing knowledge base
    const response = await fetch('/data/me.json');
    if (!response.ok) {
      throw new Error(`Failed to fetch knowledge base: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('Knowledge base loaded successfully');

    // Clear existing documents
    vectorStore.clear();

    // Index different sections of the knowledge base
    if (data.bio) {
      vectorStore.addDocument('bio', data.bio, { source: 'Personal Bio', type: 'about' });
    }
    
    if (data.tagline) {
      vectorStore.addDocument('tagline', data.tagline, { source: 'Professional Tagline', type: 'about' });
    }
    
    // Index skills
    if (data.skills && Array.isArray(data.skills)) {
      data.skills.forEach((skill: string, index: number) => {
        vectorStore.addDocument(`skill_${index}`, skill, { source: 'Skills', type: 'skill' });
      });
    }

    // Index experience
    if (data.experience && Array.isArray(data.experience)) {
      data.experience.forEach((exp: any, index: number) => {
        const expText = `${exp.role} at ${exp.company} (${exp.period}): ${exp.impact}`;
        vectorStore.addDocument(`experience_${index}`, expText, { 
          source: 'Professional Experience', 
          type: 'experience',
          company: exp.company,
          role: exp.role
        });
      });
    }

    // Index projects
    if (data.projects && Array.isArray(data.projects)) {
      data.projects.forEach((project: any, index: number) => {
        const projectText = `${project.title}: ${project.description}. Technologies: ${project.tech?.join(', ')}`;
        vectorStore.addDocument(`project_${index}`, projectText, { 
          source: 'Projects', 
          type: 'project',
          title: project.title,
          link: project.link
        });
      });
    }

    // Index fun facts
    if (data.fun_facts && Array.isArray(data.fun_facts)) {
      data.fun_facts.forEach((fact: string, index: number) => {
        vectorStore.addDocument(`fun_fact_${index}`, fact, { source: 'Personal Interests', type: 'personal' });
      });
    }

    // Index education
    if (data.education) {
      const eduText = `${data.education.degree} from ${data.education.school} in ${data.education.location}`;
      vectorStore.addDocument('education', eduText, { source: 'Education', type: 'education' });
    }

    // Index goals
    if (data.goals) {
      if (data.goals.short_term) {
        vectorStore.addDocument('short_term_goal', data.goals.short_term, { source: 'Career Goals', type: 'goals' });
      }
      if (data.goals.long_term) {
        vectorStore.addDocument('long_term_goal', data.goals.long_term, { source: 'Career Goals', type: 'goals' });
      }
    }

    console.log(`RAG initialized successfully with ${vectorStore.getDocumentCount()} documents`);
  } catch (error) {
    console.error('Failed to initialize RAG:', error);
    // Continue without RAG - the system should still work with fallback
  }
}

// Query the RAG system
export async function ragQuery(question: string, topK = 5): Promise<RAGResult> {
  // Ensure RAG is initialized
  if (vectorStore.getDocumentCount() === 0) {
    await initializeRAG();
  }

  const matches = vectorStore.search(question, topK);
  
  return {
    matches,
    query: question,
    timestamp: new Date()
  };
}

// Get specific type of information
export async function ragQueryByType(question: string, type: string, topK = 3): Promise<RAGResult> {
  const allMatches = await ragQuery(question, 20); // Get more results first
  
  // Filter by type
  const filteredMatches = allMatches.matches
    .filter(match => match.meta?.type === type)
    .slice(0, topK);

  return {
    matches: filteredMatches,
    query: question,
    timestamp: new Date()
  };
}

// Add new document to the RAG system (for future expansion)
export function addToRAG(id: string, text: string, meta: Record<string, any> = {}): void {
  vectorStore.addDocument(id, text, meta);
}

// Initialize RAG when the module loads
initializeRAG().catch(console.error);