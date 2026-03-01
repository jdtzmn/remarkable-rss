import jwt from "jsonwebtoken";
import cron from "node-cron";
import { NextApiRequest, NextApiResponse } from "next";
import { boolean, object, string } from "yup";
import config from "../../../../lib/config";
import { updateSchedule } from "../../../../lib/scheduler";
import UserModel from "../../../../models/user";
import buildRouteHandler, {
  handlers,
} from "../../../../util/buildRouteHandler";

const handlers: handlers = {
  GET: async (req: NextApiRequest, res: NextApiResponse) => {
    const { cookies } = req;
    const cookiesSchema = object({
      token: string().required(),
    });
    const { token } = cookiesSchema.validateSync(cookies);
    const decodedToken = jwt.verify(token, config.JWT_SECRET);
    const user = await UserModel.findOne({
      username: (<any>decodedToken).username as string,
    });

    if (!user) {
      throw new Error("401");
    }

    return res.status(200).json({
      success: true,
      cronSchedule: user.cronSchedule,
      cronEnabled: user.cronEnabled,
    });
  },
  PUT: async (req: NextApiRequest, res: NextApiResponse) => {
    const { cookies } = req;
    const cookiesSchema = object({
      token: string().required(),
    });
    const { token } = cookiesSchema.validateSync(cookies);
    const decodedToken = jwt.verify(token, config.JWT_SECRET);
    const user = await UserModel.findOne({
      username: (<any>decodedToken).username as string,
    });

    if (!user) {
      throw new Error("401");
    }

    const { body } = req;
    const bodySchema = object({
      cronSchedule: string().optional(),
      cronEnabled: boolean().optional(),
    });
    const { cronSchedule, cronEnabled } = bodySchema.validateSync(body);

    if (cronSchedule !== undefined) {
      if (!cron.validate(cronSchedule)) {
        return res
          .status(400)
          .json({ success: false, error: "Invalid cron expression" });
      }
      user.cronSchedule = cronSchedule;
    }

    if (cronEnabled !== undefined) {
      user.cronEnabled = cronEnabled;
    }

    await user.save();

    // Update the in-memory scheduler
    updateSchedule(
      user._id.toString(),
      user.cronSchedule,
      user.cronEnabled
    );

    return res.status(200).json({
      success: true,
      cronSchedule: user.cronSchedule,
      cronEnabled: user.cronEnabled,
    });
  },
};

export default buildRouteHandler(handlers);
