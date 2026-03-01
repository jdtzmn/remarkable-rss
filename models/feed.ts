import mongoose from "mongoose";

export const THEMES = [
  "default",
  "minimal",
  "magazine",
  "newspaper",
  "academic",
] as const;

export type Theme = (typeof THEMES)[number];

export interface IFeed extends mongoose.Document {
  title: string;
  url: string;
  lastParsed: Date;
  theme: Theme;
  maxArticles: number;
  fetchFullContent: boolean;
  includeImages: boolean;
  accentColor?: string;
}

export const FeedSchema = new mongoose.Schema<IFeed>({
  url: { type: String, required: true },
  title: { type: String, required: true },
  lastParsed: Date,
  theme: { type: String, default: "default", enum: THEMES },
  maxArticles: { type: Number, default: 10 },
  fetchFullContent: { type: Boolean, default: true },
  includeImages: { type: Boolean, default: true },
  accentColor: { type: String },
});

const FeedModel: mongoose.Model<IFeed> =
  mongoose.models.Feed || mongoose.model("Feed", FeedSchema);

export default FeedModel;
