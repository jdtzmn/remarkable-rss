import "../../../lib/crypto-shim";
import { NextApiRequest, NextApiResponse } from "next";
import { remarkable } from "rmapi-js";
import Parser from "rss-parser";
import UserModel, { IUser } from "../../../models/user";
import { extractArticle } from "../../../lib/readability";
import { buildDigestHtml, FeedSection } from "../../../lib/renderer";
import { renderPdf } from "../../../lib/pdf";
import { ArticleData } from "../../../lib/renderer/article";
import buildRouteHandler, { handlers } from "../../../util/buildRouteHandler";

/**
 * Run the digest pipeline for a single user.
 * Exported so the cron scheduler can call it directly.
 */
export async function runDigestForUser(user: IUser): Promise<boolean> {
  if (!user.deviceToken) return false;

  const parser = new Parser();
  const sections: FeedSection[] = [];

  for (const feed of user.feeds) {
    const parsed = await parser.parseURL(feed.url);

    const newItems = parsed.items
      .filter(
        (item) =>
          new Date(item.isoDate as string) > new Date(feed.lastParsed)
      )
      .slice(0, feed.maxArticles || 10);

    feed.lastParsed = new Date();
    if (newItems.length === 0) continue;

    const articles: ArticleData[] = [];
    for (const item of newItems) {
      if (!item.link) continue;

      const extracted = await extractArticle(
        item.link,
        feed.fetchFullContent !== false
      );

      if (!extracted) continue;

      articles.push({
        title: extracted.title || item.title || "Untitled",
        content: extracted.content,
        textContent: extracted.textContent,
        feedTitle: feed.title,
        date: item.isoDate
          ? new Date(item.isoDate).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })
          : undefined,
        byline: extracted.byline,
        theme: feed.theme || "default",
        accentColor: feed.accentColor,
        includeImages: feed.includeImages !== false,
      });
    }

    if (articles.length > 0) {
      sections.push({
        feedTitle: feed.title,
        theme: feed.theme || "default",
        accentColor: feed.accentColor,
        articles,
      });
    }
  }

  await user.save();

  if (sections.length === 0) {
    console.log(`No new articles for user ${user.username}, skipping digest`);
    return false;
  }

  const now = new Date();
  const dateStr = now.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const digestTitle = `RSS Digest – ${dateStr}`;

  const html = buildDigestHtml({
    title: digestTitle,
    date: dateStr,
    sections,
  });

  console.log(`Rendering digest PDF for ${user.username}...`);
  const pdfBuffer = await renderPdf(html);
  console.log(`PDF rendered: ${(pdfBuffer.length / 1024).toFixed(0)} KB`);

  const api = await remarkable(user.deviceToken);
  const items = await api.listItems();

  const rssFolder = items.find(
    (item: any) =>
      item.visibleName === "remarkable-rss" && item.parent !== "trash"
  );
  const rssFolderId =
    rssFolder?.id || (await api.putFolder("remarkable-rss")).id;

  await api.putPdf(digestTitle, new Uint8Array(pdfBuffer), {
    parent: rssFolderId,
  });

  console.log(`Uploaded "${digestTitle}" for ${user.username}`);
  return true;
}

const handlers: handlers = {
  GET: async (req: NextApiRequest, res: NextApiResponse) => {
    const users = await UserModel.find({ deviceToken: { $ne: null } });

    let digestsCreated = 0;
    for (const user of users) {
      try {
        const created = await runDigestForUser(user);
        if (created) digestsCreated++;
      } catch (e) {
        console.error(`Digest failed for user ${user.username}:`, e);
      }
    }

    return res
      .status(200)
      .json({ success: true, digestsCreated, usersProcessed: users.length });
  },
};

export default buildRouteHandler(handlers);
