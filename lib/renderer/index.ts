import fs from "fs";
import path from "path";
import { renderCover, CoverData } from "./cover";
import { renderToc, TocEntry } from "./toc";
import { renderSection, SectionData } from "./section";
import { renderArticle, ArticleData } from "./article";

export interface FeedSection {
  feedTitle: string;
  theme: string;
  accentColor?: string;
  articles: ArticleData[];
}

export interface DigestData {
  title: string;
  date: string;
  sections: FeedSection[];
}

function loadThemeCSS(): string {
  const themesDir = path.join(__dirname, "themes");
  const themeFiles = ["default", "minimal", "magazine", "newspaper", "academic"];
  return themeFiles
    .map((name) => {
      const filePath = path.join(themesDir, `${name}.css`);
      try {
        return fs.readFileSync(filePath, "utf-8");
      } catch {
        return "";
      }
    })
    .join("\n");
}

const BASE_CSS = `
  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    width: 1404px;
    font-family: -apple-system, "Segoe UI", Helvetica, Arial, sans-serif;
  }

  .cover {
    page-break-after: always;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    text-align: center;
    padding: 60px;
  }

  .cover-title {
    font-size: 48px;
    font-weight: 800;
    margin-bottom: 16px;
    color: #111;
    letter-spacing: -1px;
  }

  .cover-date {
    font-size: 20px;
    color: #666;
    margin-bottom: 8px;
  }

  .cover-count {
    font-size: 16px;
    color: #888;
    margin-bottom: 32px;
  }

  .cover-sources {
    list-style: none;
    padding: 0;
  }

  .cover-sources li {
    font-size: 16px;
    color: #555;
    padding: 4px 0;
  }

  .toc {
    page-break-after: always;
    padding: 60px;
  }

  .toc-title {
    font-size: 32px;
    font-weight: 700;
    margin-bottom: 24px;
    border-bottom: 2px solid #111;
    padding-bottom: 8px;
  }

  .toc-feed {
    font-size: 18px;
    font-weight: 700;
    margin: 20px 0 8px;
    color: #333;
  }

  .toc-articles {
    list-style: none;
    padding: 0;
  }

  .toc-articles li {
    font-size: 15px;
    padding: 4px 0;
    border-bottom: 1px dotted #ddd;
    color: #444;
  }

  .section-divider {
    page-break-before: always;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 30vh;
    text-align: center;
    padding: 60px;
    border-bottom: 3px solid var(--accent, #333);
    margin-bottom: 40px;
  }

  .section-title {
    font-size: 36px;
    font-weight: 800;
    color: var(--accent, #333);
  }

  .section-count {
    font-size: 16px;
    color: #888;
    margin-top: 8px;
  }

  .article {
    padding: 0 60px 40px;
    page-break-inside: avoid;
    margin-bottom: 40px;
  }

  .article + .article {
    border-top: 1px solid #ddd;
    padding-top: 40px;
  }

  a { color: inherit; text-decoration: underline; }
`;

export function buildDigestHtml(data: DigestData): string {
  const totalArticles = data.sections.reduce(
    (sum, s) => sum + s.articles.length,
    0
  );

  const coverData: CoverData = {
    title: data.title,
    date: data.date,
    sources: data.sections.map((s) => s.feedTitle),
    articleCount: totalArticles,
  };

  const tocEntries: TocEntry[] = data.sections.map((s) => ({
    feedTitle: s.feedTitle,
    articles: s.articles.map((a) => ({ title: a.title })),
  }));

  let bodyHtml = "";
  for (const section of data.sections) {
    const sectionData: SectionData = {
      feedTitle: section.feedTitle,
      articleCount: section.articles.length,
      theme: section.theme as any,
      accentColor: section.accentColor,
    };
    bodyHtml += renderSection(sectionData);
    for (const article of section.articles) {
      bodyHtml += renderArticle(article);
    }
  }

  const themeCSS = loadThemeCSS();

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    ${BASE_CSS}
    ${themeCSS}
  </style>
</head>
<body>
  ${renderCover(coverData)}
  ${renderToc(tocEntries)}
  ${bodyHtml}
</body>
</html>`;
}
