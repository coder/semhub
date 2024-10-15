import { Hono } from "hono";

import { Resource } from "sst";

import { Context } from "./context";

const app = new Hono<Context>();

app.get("/", (c) => c.text("Hello World!"));

export default {
  async fetch(_request: Request) {
    console.log(Resource.Supabase);
    return app.fetch(_request);
  },
};
