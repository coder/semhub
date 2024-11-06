import { z } from "zod";

export namespace Response {
  export type SuccessResponse<T = void> = {
    success: true;
    message: string;
  } & (T extends void ? {} : { data: T });

  export type ErrorResponse = {
    success: false;
    error: string;
    // isFormError?: boolean;
  };

  export function isErrorResponse(
    response: unknown,
  ): response is ErrorResponse {
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
    p: z.number({ coerce: true }).optional().default(1), // page
    limit: z.number({ coerce: true }).optional().default(10),
    order: orderSchema.optional().default("desc"),
    // sortBy: sortBySchema.optional().default("created"),
    // author: z.optional(z.string()),
  });

  export type PaginatedResponse<T> = {
    pagination: {
      page: number;
      totalPages: number;
    };
    data: T;
  } & Omit<SuccessResponse, "data">;
}
