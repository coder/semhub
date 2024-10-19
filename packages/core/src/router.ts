import { Hono } from "hono";
import type { Env } from "hono";
import { HTTPException } from "hono/http-exception";

import { ErrorResponse } from "./routes/schema";
import { searchRouter } from "./routes/search";

export interface Context extends Env {
  Variables: {
    // user: User | null;
    // session: Session | null;
  };
}

export const app = new Hono<Context>();

// TODO: set up auth and CORS

const routes = app.basePath("/api").route("/search", searchRouter);

export type ApiRoutes = typeof routes;

app.onError((err, c) => {
  if (err instanceof HTTPException) {
    const errResponse =
      err.res ??
      c.json<ErrorResponse>(
        {
          success: false,
          error: err.message,
          // isFormError:
          //   err.cause && typeof err.cause === "object" && "form" in err.cause
          //     ? err.cause.form === true
          //     : false,
        },
        err.status,
      );
    return errResponse;
  }
  return c.json<ErrorResponse>(
    {
      success: false,
      error:
        process.env.NODE_ENV === "production"
          ? "Interal Server Error"
          : (err.stack ?? err.message),
    },
    500,
  );
});

// export default app;
