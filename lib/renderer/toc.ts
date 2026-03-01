export interface TocEntry {
  feedTitle: string;
  articles: { title: string }[];
}

export function renderToc(entries: TocEntry[]): string {
  const sections = entries
    .map(
      (entry) => `
      <div class="toc-section">
        <h3 class="toc-feed">${entry.feedTitle}</h3>
        <ul class="toc-articles">
          ${entry.articles.map((a) => `<li>${a.title}</li>`).join("\n")}
        </ul>
      </div>
    `
    )
    .join("\n");

  return `
    <div class="toc">
      <h2 class="toc-title">Contents</h2>
      ${sections}
    </div>
  `;
}
