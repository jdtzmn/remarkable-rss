export interface CoverData {
  title: string;
  date: string;
  sources: string[];
  articleCount: number;
}

export function renderCover(data: CoverData): string {
  const sourceList = data.sources
    .map((s) => `<li>${s}</li>`)
    .join("\n");

  return `
    <div class="cover">
      <div class="cover-content">
        <h1 class="cover-title">${data.title}</h1>
        <p class="cover-date">${data.date}</p>
        <p class="cover-count">${data.articleCount} article${data.articleCount !== 1 ? "s" : ""}</p>
        <ul class="cover-sources">
          ${sourceList}
        </ul>
      </div>
    </div>
  `;
}
