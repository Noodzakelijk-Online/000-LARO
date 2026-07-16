import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildUser } from "../factories";
import { bootTestApp, sqliteAvailable, type TestApp } from "../helpers/app";

const suite = sqliteAvailable ? describe : describe.skip;

suite("case intake draft persistence", () => {
  let app: TestApp;
  const owner = { id: "USR_DRAFT_OWNER", name: "Draft Owner", role: "user", email: "draft@example.com" };
  const other = { id: "USR_DRAFT_OTHER", name: "Other", role: "user", email: "other-draft@example.com" };

  beforeAll(async () => {
    app = await bootTestApp();
    await app.db.insert(app.schema.users).values([
      buildUser({ id: owner.id, email: owner.email }),
      buildUser({ id: other.id, email: other.email }),
    ]);
  });

  afterAll(() => app?.cleanup());

  it("saves, replaces, and clears only the signed-in user's draft", async () => {
    const caller = app.makeCaller(owner);
    await caller.cases.saveDraft({ draft: { summary: "First version", profileSource: "account" } });
    await caller.cases.saveDraft({ draft: { summary: "Restored version", profileSource: "custom" } });

    expect(await caller.cases.getDraft()).toEqual({
      draft: { summary: "Restored version", profileSource: "custom" },
    });
    expect(await app.makeCaller(other).cases.getDraft()).toEqual({ draft: null });

    await caller.cases.clearDraft();
    expect(await caller.cases.getDraft()).toEqual({ draft: null });
  });
});
