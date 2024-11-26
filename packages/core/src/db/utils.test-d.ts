import type { PgColumn } from "drizzle-orm/pg-core";
import { expectType } from "tsd";

import { jsonArrayContains, jsonArraySome } from "@/db/utils";
import {
  type ExtractColumnData,
  type PathsToStringProperty,
  type PathsToStringPropertyInArray,
} from "@/db/utils.d";

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

// Mock Labels type
type Labels = {
  name: string;
  description: string | null;
}[];

// Mock Labels array column type
type MockLabelsColumn = PgColumn<
  {
    name: "labels";
    tableName: "issues";
    dataType: "json";
    columnType: "PgJsonb";
    data: Labels;
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

// Test PathsToStringPropertyInArray
type ArrayPaths = PathsToStringPropertyInArray<Labels>;
expectType<"name" | "description">({} as ArrayPaths);

// Test that jsonArraySome accepts correct paths
const mockLabelsColumn = {} as MockLabelsColumn;
const _someTest1 = jsonArraySome(mockLabelsColumn, "name");
// @ts-expect-error - should not allow invalid paths
const _someTestInvalid = jsonArraySome(mockLabelsColumn, "invalid");

// Test that jsonArrayContains accepts correct paths and value
const _containsTest1 = jsonArrayContains(mockLabelsColumn, "name", "bug");
const _containsTest2 = jsonArrayContains(
  mockLabelsColumn,
  "description",
  "test",
);
const _containsTestInvalid = jsonArrayContains(
  mockLabelsColumn,
  // @ts-expect-error - should not allow invalid paths
  "invalid",
  "test",
);

// Test with nested array type
type NestedArrayType = {
  items: {
    id: number;
    details: {
      name: string;
      value: string;
    };
  }[];
};

type MockNestedArrayColumn = PgColumn<
  {
    name: "nested";
    tableName: "test";
    dataType: "json";
    columnType: "PgJsonb";
    data: NestedArrayType;
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

// Test nested array paths
type NestedArrayPaths = PathsToStringPropertyInArray<NestedArrayType["items"]>;
expectType<"id" | "details.name" | "details.value">({} as NestedArrayPaths);

const mockNestedColumn = {} as MockNestedArrayColumn;
const nestedTest1 = jsonArraySome(mockNestedColumn, "items.details.name");
const nestedTest2 = jsonArrayContains(mockNestedColumn, "items.id", "test");
// @ts-expect-error - should not allow invalid paths
const nestedTestInvalid = jsonArraySome(mockNestedColumn, "items.invalid");
