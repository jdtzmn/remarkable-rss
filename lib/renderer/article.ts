import { Theme } from "../../models/feed";
import { estimateReadTime } from "../readability";

export interface ArticleData {
  title: string;
  content: string;
  textContent: string;
  feedTitle: string;
  date?: string;
  byline?: string | null;
  theme: Theme;
  accentColor?: string;
  includeImages: boolean;
}

export function renderArticle(article: ArticleData): string {
  const readTime = estimateReadTime(article.textContent);
  const accentStyle = article.accentColor
    ? ` style="--accent: ${article.accentColor}"`
    : "";

  let content = article.content;
  if (!article.includeImages) {
    content = content.replace(/<img[^>]*>/gi, "");
    content = content.replace(/<figure[^>]*>[\s\S]*?<\/figure>/gi, "");
  }

  return `
    <div class="article theme-${article.theme}"${accentStyle}>
      <h2 class="article-title">${article.title}</h2>
      <div class="article-meta">
        <span class="article-source">${article.feedTitle}</span>
        ${article.byline ? `<span class="article-byline"> · ${article.byline}</span>` : ""}
        ${article.date ? `<span class="article-date"> · ${article.date}</span>` : ""}
        <span class="article-readtime"> · ${readTime} min read</span>
      </div>
      <div class="article-body">
        ${content}
      </div>
    </div>
  `;
}
