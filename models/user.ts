import mongoose, { Types } from "mongoose";
import { FeedSchema, IFeed } from "./feed";

export interface IUser extends mongoose.Document {
  username: string;
  password: string;
  deviceToken: string | null;
  feeds: Types.DocumentArray<IFeed>;
  cronSchedule: string;
  cronEnabled: boolean;
}

export const UserSchema = new mongoose.Schema<IUser>({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  deviceToken: { type: String },
  feeds: [FeedSchema],
  cronSchedule: { type: String, default: "0 7 * * *" },
  cronEnabled: { type: Boolean, default: false },
});

const UserModel: mongoose.Model<IUser> =
  mongoose.models.User || mongoose.model("User", UserSchema);

export default UserModel;
