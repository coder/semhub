import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";

import type { Router } from "..";
import { RouterSchema } from "./schema";

const issuesSearchSchema = RouterSchema.paginationSchema.extend({
  q: z.string(),
});

export type Issue = {
  id: string;
  title: string;
  description: string;
  createdAt: Date;
  updatedAt: Date;
};

export const searchRouter = new Hono<Router.Context>().get(
  "/",
  zValidator("query", issuesSearchSchema),
  async (c) => {
    const { q: query, p: pageNumber } = c.req.valid("query");
    const pageSize = 30;

    // TODO: Implement actual search logic here
    const data: Issue[] = [
      {
        id: "1",
        title: "Issue 1",
        description: "Description 1",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
    const totalResults = data.length;
    // infer type from data in future
    return c.json<RouterSchema.PaginatedResponse<Issue[]>>(
      {
        data,
        success: true,
        message: "Search results",
        pagination: {
          page: pageNumber,
          totalPages: Math.ceil(totalResults / pageSize),
        },
      },
      200,
    );
  },
);
