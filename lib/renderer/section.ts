import { Theme } from "../../models/feed";

export interface SectionData {
  feedTitle: string;
  articleCount: number;
  theme: Theme;
  accentColor?: string;
}

export function renderSection(data: SectionData): string {
  const accentStyle = data.accentColor
    ? ` style="--accent: ${data.accentColor}"`
    : "";

  return `
    <div class="section-divider theme-${data.theme}"${accentStyle}>
      <h2 class="section-title">${data.feedTitle}</h2>
      <p class="section-count">${data.articleCount} article${data.articleCount !== 1 ? "s" : ""}</p>
    </div>
  `;
}
