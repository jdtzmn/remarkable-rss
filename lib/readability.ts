import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";

export interface ExtractedArticle {
  title: string;
  content: string; // cleaned HTML
  textContent: string; // plain text
  excerpt: string;
  byline: string | null;
  length: number;
}

/**
 * Fetch a URL and extract the article content using Mozilla Readability.
 * Falls back to a basic paragraph with the excerpt if Readability fails.
 */
export async function extractArticle(
  url: string,
  fetchFullContent: boolean = true
): Promise<ExtractedArticle | null> {
  try {
    const response = await fetch(url);
    const html = await response.text();
    const doc = new JSDOM(html, { url });
    const reader = new Readability(doc.window.document);
    const article = reader.parse();

    if (!article) {
      return null;
    }

    const title = article.title || "";
    const content = article.content || "";
    const textContent = article.textContent || "";
    const excerpt = article.excerpt || "";
    const byline = article.byline || null;
    const length = article.length || textContent.length;

    if (!fetchFullContent) {
      return {
        title,
        content: `<p>${excerpt}</p>`,
        textContent: excerpt,
        excerpt,
        byline,
        length: excerpt.length,
      };
    }

    return {
      title,
      content,
      textContent,
      excerpt,
      byline,
      length,
    };
  } catch (e) {
    console.error(`Failed to extract article from ${url}:`, e);
    return null;
  }
}

/**
 * Estimate reading time in minutes based on word count.
 */
export function estimateReadTime(textContent: string): number {
  const words = textContent.trim().split(/\s+/).length;
  return Math.max(1, Math.round(words / 230));
}
