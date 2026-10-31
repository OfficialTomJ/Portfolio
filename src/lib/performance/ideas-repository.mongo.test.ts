import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { config } from "dotenv";
import { MongoClient } from "mongodb";
import { EMPTY_IDEA_FIELDS } from "./ideas-model";
import { IdeaConflictError, IdeaInputError, IdeasRepository } from "./ideas-repository";

test("idea saves are atomic, persistent, scoped, audited and protected from stale edits", { skip: process.env.IDEAS_MONGO_TEST !== "1" }, async () => {
  config({ path: ".env.local", quiet: true });
  const client = new MongoClient(process.env.MONGODB_URI!, { serverSelectionTimeoutMS: 8000 });
  const db = client.db(process.env.MONGODB_DB ?? "blueprint_dev");
  const prefix = `ideas_test_${randomUUID().replaceAll("-", "")}`;
  const a = new IdeasRepository(db, client, { environment: "test", sourceAccountId: "a" }, prefix);
  const b = new IdeasRepository(db, client, { environment: "test", sourceAccountId: "b" }, prefix);
  const ids = ["trade-11111111111111111111", "trade-22222222222222222222"];
  const eligible = new Set(ids);
  try {
    // Pre-create disposable namespaces so Mongo versions that restrict implicit
    // collection creation in transactions can run the same behavioural checks.
    for (const name of a.names) await db.createCollection(name);
    assert.deepEqual(await a.load(), { revision: 0, ideas: [], assignments: {} });
    let group = await a.mutate({ action: "create", revision: 0, fields: { ...EMPTY_IDEA_FIELDS, name: "First" }, tradeIds: ids }, eligible, "test");
    const first = group.ideas[0].id;
    assert.equal(group.revision, 1);
    assert.deepEqual(group.assignments, { [ids[0]]: first, [ids[1]]: first });
    assert.deepEqual(await a.load(), group);
    assert.deepEqual(await b.load(), { revision: 0, ideas: [], assignments: {} });
    await assert.rejects(() => a.mutate({ action: "assign", revision: 0, ideaId: null, tradeIds: ids }, eligible, "test"), IdeaConflictError);
    assert.deepEqual(await a.load(), group);
    await assert.rejects(() => a.mutate({ action: "create", revision: 1, fields: { ...EMPTY_IDEA_FIELDS, name: "Invalid batch" }, tradeIds: [...ids, "trade-33333333333333333333"] }, eligible, "test"), IdeaInputError);
    assert.deepEqual(await a.load(), group);
    await assert.rejects(() => b.mutate({ action: "assign", revision: 0, ideaId: first, tradeIds: ids }, eligible, "test"), IdeaInputError);
    group = await a.mutate({ action: "create", revision: 1, fields: { ...EMPTY_IDEA_FIELDS, name: "Second" }, tradeIds: [ids[1]] }, eligible, "test");
    const second = group.ideas[1].id;
    assert.equal(group.assignments[ids[0]], first); assert.equal(group.assignments[ids[1]], second);
    group = await a.mutate({ action: "update", revision: 2, ideaId: first, fields: { ...EMPTY_IDEA_FIELDS, name: "Renamed", target: "100" } }, eligible, "test");
    assert.equal(group.ideas[0].target, "100");
    group = await a.mutate({ action: "assign", revision: 3, ideaId: null, tradeIds: [ids[0]] }, eligible, "test");
    assert.equal(group.assignments[ids[0]], undefined);
    group = await a.mutate({ action: "delete", revision: 4, ideaId: first }, eligible, "test");
    assert.equal(group.ideas.length, 1);
    // Two tabs racing from one revision cannot silently overwrite one another.
    const concurrent = await Promise.allSettled([
      a.mutate({ action: "assign", revision: 5, ideaId: second, tradeIds: [ids[0]] }, eligible, "test"),
      a.mutate({ action: "assign", revision: 5, ideaId: null, tradeIds: [ids[1]] }, eligible, "test"),
    ]);
    assert.equal(concurrent.filter(r => r.status === "fulfilled").length, 1);
    assert.ok(concurrent.some(r => r.status === "rejected" && r.reason instanceof IdeaConflictError));
    assert.equal((await a.load()).revision, 6);
    assert.equal(await db.collection(a.names[3]).countDocuments({ scope: a.scope }), 6);
    const savedBefore = await a.load();
    const session = client.startSession();
    try {
      // A surrounding editor transaction must roll back assignment + history
      // when any later part of the trade save fails.
      await assert.rejects(() => session.withTransaction(async () => {
        await a.mutateInSession({ action: "create", revision: 6, fields: { ...EMPTY_IDEA_FIELDS, name: "Must roll back" }, tradeIds: ids }, eligible, "test", session);
        throw new Error("Simulated review save failure");
      }), /Simulated review save failure/);
      assert.deepEqual(await a.load(), savedBefore);
      assert.equal(await db.collection(a.names[3]).countDocuments({ scope: a.scope }), 6);
      const joined = await session.withTransaction(() => a.mutateInSession({ action: "assign", revision: 6, ideaId: second, tradeIds: ids }, eligible, "test", session));
      assert.equal(joined.revision, 7);
      assert.deepEqual(joined.assignments, { [ids[0]]: second, [ids[1]]: second });
      const deleted=await a.mutate({action:"delete",revision:7,ideaId:second},eligible,"test");
      assert.deepEqual(deleted.ideas,[]);assert.deepEqual(deleted.assignments,{});
      assert.ok((await db.collection(a.names[0]).findOne({id:second}))?.deletedAt,"deleted idea retained for audit recovery");
      await assert.rejects(a.mutate({action:"assign",revision:8,ideaId:second,tradeIds:ids},eligible,"test"),IdeaInputError);
    } finally { await session.endSession(); }

  } finally {
    for (const name of a.names) await db.collection(name).drop().catch(error => { if (error.codeName !== "NamespaceNotFound") throw error; });
    await client.close();
  }
});
