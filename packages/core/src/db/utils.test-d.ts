import type { PgColumn } from "drizzle-orm/pg-core";
import { expectType } from "tsd";

import type { ExtractColumnData, PathsToStringProperty } from "./utils";

// Mock the Author type
type Author = {
  name: string;
  htmlUrl: string;
} | null;

// Mock a PgColumn type
type MockAuthorColumn = PgColumn<
  {
    name: "author";
    tableName: "issues";
    dataType: "json";
    columnType: "PgJsonb";
    data: Author;
    driverParam: unknown;
    notNull: false;
    hasDefault: false;
    isPrimaryKey: false;
    isAutoincrement: false;
    hasRuntimeDefault: false;
    enumValues: undefined;
    baseColumn: never;
    generated: undefined;
  },
  {},
  {}
>;

// Test ExtractColumnData
type ExtractedData = ExtractColumnData<MockAuthorColumn>;
expectType<Author>({} as ExtractedData);

// Test PathsToStringProperty with NonNullable<Author>
type ValidPaths = PathsToStringProperty<NonNullable<Author>>;
expectType<"name" | "htmlUrl">({} as ValidPaths);

// Test that invalid paths are excluded
type InvalidPathTest = "invalid" extends ValidPaths
  ? "should not happen"
  : "correct";
expectType<"correct">({} as InvalidPathTest);

// Test with nested object
type NestedType = {
  user: {
    name: string;
    details: {
      email: string;
    };
  };
};
type NestedPaths = PathsToStringProperty<NestedType>;
expectType<"user.name" | "user.details.email">({} as NestedPaths);
