import { Hono } from "hono";

import { zValidator } from "@hono/zod-validator";
import { z } from "zod";

import { Context } from "../router";
import { PaginatedResponse, paginationSchema } from "./schema";

const issuesSearchSchema = paginationSchema.extend({
  q: z.string(),
});

export type Issue = {
  id: string;
  title: string;
  description: string;
  createdAt: Date;
  updatedAt: Date;
};

export const searchRouter = new Hono<Context>().get(
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
    return c.json<PaginatedResponse<Issue[]>>(
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
