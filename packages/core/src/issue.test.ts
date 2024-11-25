import { describe, expect, it } from "vitest";

import { parseSearchQuery } from "./issue.util";

describe("parseSearchQuery", () => {
  const testQueries = [
    {
      query: '"simple quote" title:"test" body:"content"',
      expected: {
        authorQueries: [],
        repoQueries: [],
        stateQueries: [],
        substringQueries: ["simple quote"],
        titleQueries: ["test"],
        bodyQueries: ["content"],
      },
    },
    {
      query:
        'normal text title:"multiple words" "general quote" body:"more content"',
      expected: {
        authorQueries: [],
        repoQueries: [],
        stateQueries: [],
        substringQueries: ["general quote"],
        titleQueries: ["multiple words"],
        bodyQueries: ["more content"],
      },
    },
    {
      query: "no quotes here",
      expected: {
        authorQueries: [],
        repoQueries: [],
        stateQueries: [],
        substringQueries: [],
        titleQueries: [],
        bodyQueries: [],
      },
    },
    {
      query: 'title:"bug" title:"crash" body:"firefox" body:"console"',
      expected: {
        authorQueries: [],
        repoQueries: [],
        stateQueries: [],
        substringQueries: [],
        titleQueries: ["bug", "crash"],
        bodyQueries: ["firefox", "console"],
      },
    },
    {
      query:
        '"general search" title:"bug" title:"urgent" body:"steps" "another general"',
      expected: {
        authorQueries: [],
        repoQueries: [],
        stateQueries: [],
        substringQueries: ["general search", "another general"],
        titleQueries: ["bug", "urgent"],
        bodyQueries: ["steps"],
      },
    },
    {
      query: 'body:"first" title:"second" body:"third" title:"fourth" "fifth"',
      expected: {
        authorQueries: [],
        repoQueries: [],
        stateQueries: [],
        substringQueries: ["fifth"],
        titleQueries: ["second", "fourth"],
        bodyQueries: ["first", "third"],
      },
    },
    {
      query: 'title:"spaces  preserved" body:"multiple    spaces"',
      expected: {
        authorQueries: [],
        repoQueries: [],
        stateQueries: [],
        substringQueries: [],
        titleQueries: ["spaces  preserved"],
        bodyQueries: ["multiple    spaces"],
      },
    },
    {
      query: 'state:open author:"johndoe" repo:frontend',
      expected: {
        authorQueries: ['"johndoe"'],
        repoQueries: ["frontend"],
        stateQueries: ["open"],
        substringQueries: [],
        titleQueries: [],
        bodyQueries: [],
      },
    },
    {
      query: 'state:closed repo:backend "urgent fix" author:janedoe',
      expected: {
        authorQueries: ["janedoe"],
        repoQueries: ["backend"],
        stateQueries: ["closed"],
        substringQueries: ["urgent fix"],
        titleQueries: [],
        bodyQueries: [],
      },
    },
    {
      query: 'state:invalid_state author:"john smith"',
      expected: {
        authorQueries: ['"john smith"'],
        repoQueries: [],
        stateQueries: [],
        substringQueries: [],
        titleQueries: [],
        bodyQueries: [],
      },
    },
    {
      query: 'repo:org/repo title:"bug" state:open state:closed',
      expected: {
        authorQueries: [],
        repoQueries: ["org/repo"],
        stateQueries: ["open", "closed"],
        substringQueries: [],
        titleQueries: ["bug"],
        bodyQueries: [],
      },
    },
    {
      query: "author:user1 author:user2 repo:repo1 repo:repo2",
      expected: {
        authorQueries: ["user1", "user2"],
        repoQueries: ["repo1", "repo2"],
        stateQueries: [],
        substringQueries: [],
        titleQueries: [],
        bodyQueries: [],
      },
    },
    {
      query: "",
      expected: {
        authorQueries: [],
        repoQueries: [],
        stateQueries: [],
        substringQueries: [],
        titleQueries: [],
        bodyQueries: [],
      },
    },
    {
      query: "state:ClOseD state:open state:closed state:CLOSED",
      expected: {
        authorQueries: [],
        repoQueries: [],
        stateQueries: ["closed", "open"],
        substringQueries: [],
        titleQueries: [],
        bodyQueries: [],
      },
    },
    {
      query: "author:USER repo:REPO/NAME repo:repo/name",
      expected: {
        authorQueries: ["USER"],
        repoQueries: ["REPO/NAME", "repo/name"],
        stateQueries: [],
        substringQueries: [],
        titleQueries: [],
        bodyQueries: [],
      },
    },
    {
      query: 'title:"MiXeD cAsE" body:"UPPER CASE"',
      expected: {
        authorQueries: [],
        repoQueries: [],
        stateQueries: [],
        substringQueries: [],
        titleQueries: ["MiXeD cAsE"],
        bodyQueries: ["UPPER CASE"],
      },
    },
    {
      query: 'state: open title:"bug" state:NOT_VALID state:closed',
      expected: {
        authorQueries: [],
        repoQueries: [],
        stateQueries: ["closed"],
        substringQueries: [],
        titleQueries: ["bug"],
        bodyQueries: [],
      },
    },
    {
      query: 'state:open"no space" title:"unterminated',
      expected: {
        authorQueries: [],
        repoQueries: [],
        stateQueries: [],
        // reasoning: state regex matches state:open"no and removes that substring
        substringQueries: [" title:"],
        titleQueries: [],
        bodyQueries: [],
      },
    },
    {
      query: "   state:open    title:  padded  ",
      expected: {
        authorQueries: [],
        repoQueries: [],
        stateQueries: ["open"],
        substringQueries: [],
        titleQueries: [],
        bodyQueries: [],
      },
    },
    {
      query: 'author: repo: state: title:"" body:"" ""',
      expected: {
        authorQueries: [],
        repoQueries: [],
        stateQueries: [],
        substringQueries: [],
        titleQueries: [],
        bodyQueries: [],
      },
    },
  ];

  testQueries.forEach(({ query, expected }) => {
    it(`correctly parses: ${query}`, () => {
      const result = parseSearchQuery(query);
      console.log(query);
      expect(result).toEqual(expected);
    });
  });
});
