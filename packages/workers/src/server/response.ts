import { z } from "zod";

export type SuccessResponse<T = void> = {
  success: true;
  message: string;
} & (T extends void ? {} : { data: T });

export type ErrorResponse = {
  success: false;
  error: string;
  // isFormError?: boolean;
};

export function isErrorResponse(response: unknown): response is ErrorResponse {
  return (
    typeof response === "object" &&
    response !== null &&
    "success" in response &&
    "error" in response &&
    response.success === false &&
    typeof response.error === "string"
  );
}

// export const sortBySchema = z.enum(["updated", "created"]);
export const orderSchema = z.enum(["asc", "desc"]);

// export type SortBy = z.infer<typeof sortBySchema>;
export type Order = z.infer<typeof orderSchema>;

export const paginationSchema = z.object({
  page: z.string().pipe(z.coerce.number().int().positive()).optional(),
  limit: z.string().pipe(z.coerce.number().int().positive()).optional(),
  // .default("10"),
  order: orderSchema.optional(), //.default("desc"),
  // sortBy: sortBySchema.optional().default("created"),
  // author: z.optional(z.string()),
});

type PaginatedResponse<T> = {
  pagination: {
    page: number;
    totalPages: number;
  };
  data: T;
} & Omit<SuccessResponse, "data">;

export function createPaginatedResponse<T>(
  data: T,
  page: number,
  totalPages: number,
  message: string = "Success",
): PaginatedResponse<T> {
  return {
    data,
    success: true,
    message,
    pagination: {
      page,
      totalPages,
    },
  };
}

export function createSuccessResponse(message: string): SuccessResponse;
export function createSuccessResponse<T>({
  data,
  message,
}: {
  data: T;
  message: string;
}): SuccessResponse<T>;
export function createSuccessResponse<T = void>(
  messageOrOptions:
    | string
    | { data?: T extends void ? never : T; message: string },
): SuccessResponse<T> {
  if (typeof messageOrOptions === "string") {
    return { success: true, message: messageOrOptions } as SuccessResponse<T>;
  }
  const { data, message } = messageOrOptions;
  return (
    data === undefined
      ? { success: true, message }
      : { success: true, message, data }
  ) as SuccessResponse<T>;
}
