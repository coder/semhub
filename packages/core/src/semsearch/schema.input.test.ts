import { describe, expect, it } from "vitest";

import { operatorSchema, searchQuerySchema } from "./schema.input";
import { modifyUserQuery } from "./util";

describe("operatorQuoteSchema", () => {
  it("should pass when quoted operators have quotes", () => {
    const validQueries = [
      'title:"hello world"',
      'body:"some description"',
      'label:"bug"',
      'collection:"my collection"',
      // Mixed with unquoted operators
      'title:"hello" author:coder',
      'state:open body:"detailed explanation"',
      // Multiple quoted operators
      'title:"hello" body:"world"',
      // With other content
      'title:"hello world" some other text',
    ];

    validQueries.forEach((query) => {
      expect(() => operatorSchema.parse(query)).not.toThrow();
    });
  });

  it("should fail when quoted operators lack quotes", () => {
    const invalidQueries = [
      "title:hello world",
      "body:some description",
      "label:bug",
      "collection:my collection",
      // Mixed cases
      'title:"valid" body:invalid',
      'title:invalid body:"valid"',
      // With other content
      "title:hello some other text",
    ];

    invalidQueries.forEach((query) => {
      expect(() => operatorSchema.parse(query)).toThrow(/requires quotes/);
    });
  });

  it("should fail when operators have no value after colon", () => {
    const invalidQueries = [
      "title:",
      "body:",
      "label:",
      "collection:",
      "author:",
      "state:",
      // Mixed with valid operators
      'title:"hello" body:',
      "hello world title:",
    ];

    invalidQueries.forEach((query) => {
      expect(() => operatorSchema.parse(query)).toThrow(/requires a value/);
    });
  });

  it("should pass when unquoted operators are used without quotes", () => {
    const validQueries = [
      "author:coder",
      "state:open",
      "repo:semhub",
      "org:coder",
      // Mixed with quoted operators
      'author:coder title:"hello"',
      // Multiple unquoted operators
      "state:open author:coder",
    ];

    validQueries.forEach((query) => {
      expect(() => operatorSchema.parse(query)).not.toThrow();
    });
  });
});

describe("searchQuerySchema", () => {
  describe("multiple operator validation", () => {
    it("should fail when conflicting instances of unique operators are used", () => {
      const invalidQueries = [
        "state:open state:closed org:a abc",
        "org:a repo:a repo:b abc",
        "org:a author:x author:y abc",
        "org:a org:b abc",
      ];

      invalidQueries.forEach((query) => {
        expect(() => searchQuerySchema.parse(query)).toThrow(/Conflicting/);
      });
    });
  });

  describe("empty query validation", () => {
    it("should fail when query is not specific", () => {
      const emptyQueries = [
        "",
        " ",
        "state:open", // only filter, no search content
        "repo:a/b ",
        "org:a repo:b ",
        "repo:a/b state:open",
      ];

      emptyQueries.forEach((query) => {
        expect(() => searchQuerySchema.parse(modifyUserQuery(query))).toThrow(
          /something specific/,
        );
      });
    });

    it("should pass when query is specific and specifies org or repo", () => {
      const validQueries = [
        "repo:a/b hello world",
        "org:a repo:b hello world",
        'repo:a/b title:"hello"',
        'org:a repo:b body:"description"',
        "repo:a/b state:open hello",
        'repo:a/b state:open title:"exact match"',
      ];

      validQueries.forEach((query) => {
        expect(() =>
          searchQuerySchema.parse(modifyUserQuery(query)),
        ).not.toThrow();
      });
    });
  });
});
