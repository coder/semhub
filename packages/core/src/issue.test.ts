import { describe, expect, it } from "vitest";

import { Issue } from "./issue";

describe("Issue.parseSearchQuery", () => {
  const testQueries = [
    {
      query: '"simple quote" title:"test" body:"content"',
      expected: {
        substringQueries: ["simple quote"],
        titleQueries: ["test"],
        bodyQueries: ["content"],
      },
    },
    {
      query:
        'normal text title:"multiple words" "general quote" body:"more content"',
      expected: {
        substringQueries: ["general quote"],
        titleQueries: ["multiple words"],
        bodyQueries: ["more content"],
      },
    },
    {
      query: "no quotes here",
      expected: {
        substringQueries: [],
        titleQueries: [],
        bodyQueries: [],
      },
    },
    {
      query: 'title:"bug" title:"crash" body:"firefox" body:"console"',
      expected: {
        substringQueries: [],
        titleQueries: ["bug", "crash"],
        bodyQueries: ["firefox", "console"],
      },
    },
    {
      query:
        '"general search" title:"bug" title:"urgent" body:"steps" "another general"',
      expected: {
        substringQueries: ["general search", "another general"],
        titleQueries: ["bug", "urgent"],
        bodyQueries: ["steps"],
      },
    },
    {
      query: 'body:"first" title:"second" body:"third" title:"fourth" "fifth"',
      expected: {
        substringQueries: ["fifth"],
        titleQueries: ["second", "fourth"],
        bodyQueries: ["first", "third"],
      },
    },
    {
      query: 'title:"spaces  preserved" body:"multiple    spaces"',
      expected: {
        substringQueries: [],
        titleQueries: ["spaces  preserved"],
        bodyQueries: ["multiple    spaces"],
      },
    },
  ];

  testQueries.forEach(({ query, expected }) => {
    it(`correctly parses: ${query}`, () => {
      const result = Issue.parseSearchQuery(query);
      expect(result).toEqual(expected);
    });
  });
});
