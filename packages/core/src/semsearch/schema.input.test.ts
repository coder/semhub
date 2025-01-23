import { describe, expect, it } from "vitest";

import { operatorQuoteSchema, searchQuerySchema } from "./schema.input";

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
      expect(() => operatorQuoteSchema.parse(query)).not.toThrow();
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
      expect(() => operatorQuoteSchema.parse(query)).toThrow(/requires quotes/);
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
      expect(() => operatorQuoteSchema.parse(query)).not.toThrow();
    });
  });
});

describe("searchQuerySchema", () => {
  describe("multiple operator validation", () => {
    it("should fail when multiple instances of unique operators are used", () => {
      const invalidQueries = [
        "state:open state:closed",
        "repo:a repo:b",
        "author:x author:y",
        "org:a org:b",
      ];

      invalidQueries.forEach((query) => {
        expect(() => searchQuerySchema.parse(query)).toThrow(/more than one/);
      });
    });
  });

  describe("empty query validation", () => {
    it("should fail when no substantive query is provided", () => {
      const emptyQueries = [
        "",
        " ",
        "state:open", // only filter, no search content
      ];

      emptyQueries.forEach((query) => {
        expect(() => searchQuerySchema.parse(query)).toThrow(
          /no substantive query/,
        );
      });
    });

    it("should pass when substantive query is provided", () => {
      const validQueries = [
        "hello world",
        'title:"hello"',
        'body:"description"',
        "state:open hello",
        '"exact match"',
      ];

      validQueries.forEach((query) => {
        expect(() => searchQuerySchema.parse(query)).not.toThrow();
      });
    });
  });
});
