type BaseSearchParams = {
  query: string;
  page: number;
  pageSize: number;
};

type PublicSearchParams = BaseSearchParams & {
  mode: "public";
  lucky?: boolean;
};

type MeSearchParams = BaseSearchParams & {
  mode: "me";
  userId: string;
};

export type SearchParams = PublicSearchParams | MeSearchParams;
