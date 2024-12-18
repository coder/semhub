import { eq } from "drizzle-orm";

import type { DbClient } from "@/db";
import { users } from "@/db/schema/entities/user.sql";
import { conflictUpdateOnly } from "@/db/utils/conflict";

export namespace User {
  export async function getByEmail(email: string, db: DbClient) {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user ?? null;
  }
  export async function upsert(email: string, name: string, db: DbClient) {
    const [user] = await db
      .insert(users)
      .values({ email, name, avatarUrl: "" })
      .onConflictDoUpdate({
        target: [users.email],
        set: conflictUpdateOnly(users, ["name"]),
      })
      .returning({
        id: users.id,
        email: users.email,
      });
    return user;
  }
}
