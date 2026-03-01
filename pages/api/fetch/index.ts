import "../../../lib/crypto-shim";
import cheerio from "cheerio";
import { NextApiRequest, NextApiResponse } from "next";
import { remarkable } from "rmapi-js";
import Parser from "rss-parser";
import pdf from "html-pdf";
import UserModel from "../../../models/user";
import buildRouteHandler, { handlers } from "../../../util/buildRouteHandler";

const handlers: handlers = {
  GET: async (req: NextApiRequest, res: NextApiResponse) => {
    const parser = new Parser();

    const users = await UserModel.find({ deviceToken: { $ne: null } });

    for (const user of users) {
      if (!user.deviceToken) continue;

      const api = await remarkable(user.deviceToken);

      const items = await api.listItems();
      const rssFolder = items.find(
        (item: any) =>
          item.visibleName === "remarkable-rss" && item.parent !== "trash"
      );
      const rssFolderId =
        rssFolder?.id ||
        (await api.putFolder("remarkable-rss")).id;

      const feeds = user.feeds;
      for (const feed of feeds) {
        const parsed = await parser.parseURL(feed.url);
        console.log(feed.lastParsed);

        const itemsToConvert = parsed.items.filter(
          (item) => new Date(item.isoDate as string) > new Date(feed.lastParsed)
        );

        feed.lastParsed = new Date();
        if (itemsToConvert.length === 0) continue;

        const feedFolder = items.find(
          (item: any) =>
            item.visibleName === feed.title &&
            item.parent === rssFolderId
        );
        const feedFolderId =
          feedFolder?.id ||
          (await api.putFolder(feed.title, { parent: rssFolderId })).id;

        for (const item of itemsToConvert) {
          if (!item.link) continue;
          const response = await fetch(item.link);
          const rawHtml = await response.text();
          const $ = cheerio.load(rawHtml);
          $(
            [
              "script",
              "footer",
              "head",
              "svg",
              "nav",
              "input",
              "button",
              "img",
              "*[class*=menu]",
              "*[class*=navigation]",
              "*[class*=nav]",
              "*[class*=sidebar]",
              "*[class*=recommendation]",
              "*[class*=newsletter]",
              "*[class*=cookie]",
            ].join(", ")
          ).remove();
          const body = $.html();
          const minified = body.replace(/>\s+|\s+</g, (m) => m.trim());
          const pdfOptions = {
            border: "1cm",
          };
          await pdf
            .create(minified, pdfOptions)
            .toBuffer(async function (err, buffer) {
              await api.putPdf(
                item.title as string,
                new Uint8Array(buffer),
                { parent: feedFolderId }
              );
            });
        }
      }
      await user.save();
    }

    return res.status(200).json({ success: true });
  },
};

export default buildRouteHandler(handlers);
