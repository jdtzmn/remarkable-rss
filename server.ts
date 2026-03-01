import next from "next";
import http from "http";
import connectToDatabase from "./lib/mongoose";
import { initScheduler } from "./lib/scheduler";

const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(async () => {
  await connectToDatabase();
  await initScheduler();

  const server = http.createServer((req, res) => {
    handle(req, res);
  });

  const port = process.env.PORT || 3000;
  server.listen(port, () => {
    console.log(`> Server ready on http://localhost:${port}`);
    console.log(`> Scheduler initialized`);
  });
});
