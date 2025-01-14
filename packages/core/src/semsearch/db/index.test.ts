import { describe, expect, it } from "vitest";

import { modifyUserQuery, parseSearchQuery } from "../utils";

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
        collectionQueries: [],
        remainingQuery: '"simple quote"',
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
        collectionQueries: [],
        remainingQuery: 'normal text  "general quote"',
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
        collectionQueries: [],
        remainingQuery: "no quotes here",
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
        collectionQueries: [],
        remainingQuery: "",
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
        collectionQueries: [],
        remainingQuery: '"general search"    "another general"',
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
        collectionQueries: [],
        remainingQuery: '"fifth"',
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
        collectionQueries: [],
        remainingQuery: "",
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
        collectionQueries: [],
        remainingQuery: "",
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
        collectionQueries: [],
        remainingQuery: '"urgent fix"',
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
        collectionQueries: [],
        remainingQuery: "",
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
        collectionQueries: [],
        remainingQuery: "",
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
        collectionQueries: [],
        remainingQuery: "",
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
        collectionQueries: [],
        remainingQuery: "",
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
        collectionQueries: [],
        remainingQuery: "",
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
        collectionQueries: [],
        remainingQuery: "",
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
        collectionQueries: [],
        remainingQuery: "",
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
        collectionQueries: [],
        remainingQuery: "",
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
        collectionQueries: [],
        remainingQuery: "open",
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
        collectionQueries: [],
        remainingQuery: 'space" title:"unterminated',
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
        collectionQueries: [],
        remainingQuery: "title:  padded",
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
        collectionQueries: [],
        remainingQuery: '""',
      },
    },
    {
      query: 'org:microsoft repo:vscode title:"bug"',
      expected: {
        authorQueries: [],
        repoQueries: ["vscode"],
        stateQueries: [],
        substringQueries: [],
        titleQueries: ["bug"],
        bodyQueries: [],
        labelQueries: [],
        ownerQueries: ["microsoft"],
        collectionQueries: [],
        remainingQuery: "",
      },
    },
    {
      query: "org:facebook org:google repo:react",
      expected: {
        authorQueries: [],
        repoQueries: ["react"],
        stateQueries: [],
        substringQueries: [],
        titleQueries: [],
        bodyQueries: [],
        labelQueries: [],
        ownerQueries: ["facebook", "google"],
        collectionQueries: [],
        remainingQuery: "",
      },
    },
    {
      query: "repo:microsoft/vscode",
      expected: {
        authorQueries: [],
        repoQueries: ["microsoft/vscode"],
        stateQueries: [],
        substringQueries: [],
        titleQueries: [],
        bodyQueries: [],
        labelQueries: [],
        ownerQueries: [],
        collectionQueries: [],
        remainingQuery: "",
      },
    },
  ];

  testQueries.forEach(({ query, expected }) => {
    it(`correctly parses: ${query}`, () => {
      const result = parseSearchQuery(query);
      expect(result).toEqual(expected);
    });
  });
});

describe("modifyUserQuery", () => {
  const testCases = [
    {
      name: "adds state:open when no state specified",
      input: 'title:"bug"',
      expected: 'state:open title:"bug"',
    },
    {
      name: "transforms repo:org/repo format",
      input: 'repo:microsoft/vscode title:"bug"',
      expected: 'org:microsoft repo:vscode state:open title:"bug"',
    },
    {
      name: "transforms repo:org/repo and removes existing org",
      input: 'repo:microsoft/vscode org:google title:"bug"',
      expected: 'org:microsoft repo:vscode state:open title:"bug"',
    },
    {
      name: "handles multiple repo queries by using the one with org/repo format",
      input: 'repo:microsoft/vscode repo:other-repo title:"bug"',
      expected: 'org:microsoft repo:vscode state:open title:"bug"',
    },
    {
      name: "preserves state if specified",
      input: 'repo:microsoft/vscode state:closed title:"bug"',
      expected: 'org:microsoft repo:vscode state:closed title:"bug"',
    },
  ];

  testCases.forEach(({ name, input, expected }) => {
    it(name, () => {
      const result = modifyUserQuery(input);
      expect(result.trim()).toBe(expected);
    });
  });
});
