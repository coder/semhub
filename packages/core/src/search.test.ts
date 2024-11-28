import { describe, expect, it } from "vitest";

import { parseSearchQuery } from "./search.util";

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
        labelQueries: [],
        ownerQueries: [],
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
        labelQueries: [],
        ownerQueries: [],
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
        labelQueries: [],
        ownerQueries: [],
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
        labelQueries: [],
        ownerQueries: [],
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
        labelQueries: [],
        ownerQueries: [],
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
        labelQueries: [],
        ownerQueries: [],
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
        labelQueries: [],
        ownerQueries: [],
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
        labelQueries: [],
        ownerQueries: [],
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
        labelQueries: [],
        ownerQueries: [],
      },
    },
    {
      query: "state:invalid_state",
      expected: {
        authorQueries: [],
        repoQueries: [],
        stateQueries: [],
        substringQueries: [],
        titleQueries: [],
        bodyQueries: [],
        labelQueries: [],
        ownerQueries: [],
      },
    },
    {
      // we match quoted value even though enclosedInQuotes is false because because it allows users to optionally use quotes even when they're not required, which is a common user expectation in search syntax.
      query: 'author:"john smith"',
      expected: {
        authorQueries: ['"john smith"'],
        repoQueries: [],
        stateQueries: [],
        substringQueries: [],
        titleQueries: [],
        bodyQueries: [],
        labelQueries: [],
        ownerQueries: [],
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
        labelQueries: [],
        ownerQueries: [],
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
        labelQueries: [],
        ownerQueries: [],
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
        labelQueries: [],
        ownerQueries: [],
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
        labelQueries: [],
        ownerQueries: [],
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
        labelQueries: [],
        ownerQueries: [],
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
        labelQueries: [],
        ownerQueries: [],
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
        labelQueries: [],
        ownerQueries: [],
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
        labelQueries: [],
        ownerQueries: [],
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
        labelQueries: [],
        ownerQueries: [],
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
        labelQueries: [],
        ownerQueries: [],
      },
    },
    {
      query: 'owner:microsoft repo:vscode title:"bug"',
      expected: {
        authorQueries: [],
        repoQueries: ["vscode"],
        stateQueries: [],
        substringQueries: [],
        titleQueries: ["bug"],
        bodyQueries: [],
        labelQueries: [],
        ownerQueries: ["microsoft"],
      },
    },
    {
      query: "owner:facebook owner:google repo:react",
      expected: {
        authorQueries: [],
        repoQueries: ["react"],
        stateQueries: [],
        substringQueries: [],
        titleQueries: [],
        bodyQueries: [],
        labelQueries: [],
        ownerQueries: ["facebook", "google"],
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
