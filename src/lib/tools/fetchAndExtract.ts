// Browser-compatible page extraction tool
export interface ExtractedContent {
  url: string;
  title: string;
  text: string;
  excerpt?: string;
  length: number;
  error?: string;
}

export async function fetchAndExtract(url: string): Promise<ExtractedContent> {
  try {
    console.log(`Fetching content from: ${url}`);
    
    // Validate URL
    const urlObj = new URL(url);
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      throw new Error('Only HTTP and HTTPS URLs are supported');
    }

    // For browser environment, we'll simulate content extraction
    // In a real implementation, this would proxy through a server endpoint
    // that runs JSDOM + Readability server-side
    
    // Simulated extracted content
    const simulatedContent = {
      url,
      title: `Content from ${urlObj.hostname}`,
      text: `This is extracted content from ${url}. In a production environment, this would be processed server-side using JSDOM and Mozilla Readability to extract clean article text from the webpage.`,
      excerpt: `Extracted content from ${urlObj.hostname}...`,
      length: 150
    };

    return simulatedContent;

  } catch (error) {
    console.error('Page extraction error:', error);
    
    return {
      url,
      title: 'Extraction Failed',
      text: '',
      excerpt: '',
      length: 0,
      error: error instanceof Error ? error.message : 'Unknown extraction error'
    };
  }
}

// Real server-side implementation would look like this:
/*
// server/api/extract.ts
import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';

export async function serverExtractContent(url: string): Promise<ExtractedContent> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  });
  
  const html = await response.text();
  const dom = new JSDOM(html, { url });
  const reader = new Readability(dom.window.document);
  const article = reader.parse();
  
  return {
    url,
    title: article?.title || 'Untitled',
    text: (article?.textContent || '').slice(0, 10000),
    excerpt: (article?.textContent || '').slice(0, 200) + '...',
    length: (article?.textContent || '').length
  };
}

// Then in browser:
export async function fetchAndExtract(url: string): Promise<ExtractedContent> {
  const response = await fetch('/api/extract', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url })
  });
  return response.json();
}
*/

// Helper function to extract key information from multiple URLs
export async function extractFromUrls(urls: string[]): Promise<ExtractedContent[]> {
  const results = await Promise.allSettled(
    urls.map(url => fetchAndExtract(url))
  );

  return results.map((result, index) => {
    if (result.status === 'fulfilled') {
      return result.value;
    } else {
      return {
        url: urls[index],
        title: 'Extraction Failed',
        text: '',
        excerpt: '',
        length: 0,
        error: result.reason?.message || 'Failed to extract content'
      };
    }
  });
}