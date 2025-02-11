import { z } from "zod";

export const embeddingsCreateSchema = z
  .object({
    data: z.array(
      z
        .object({
          embedding: z.array(z.number()).nonempty(),
        })
        .strip(),
    ),
    model: z.string(),
  })
  .strip();

export const chatCompletionSchema = z.object({
  choices: z.array(
    z.object({
      message: z.object({ content: z.string() }),
    }),
  ),
});
