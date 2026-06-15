import { MongoClient, Db } from "mongodb";

// Serverless-safe MongoClient. The modern driver connects lazily on first
// operation, so we can construct the client once and reuse it across hot
// reloads (dev) and lambda invocations (prod) via a global cache.

const uri = process.env.MONGODB_URI ?? "";
const dbName = process.env.MONGODB_DB ?? "blueprint_dev";

declare global {
  // eslint-disable-next-line no-var
  var _blueprintMongoClient: MongoClient | undefined;
}

function getClient(): MongoClient {
  if (!uri) {
    throw new Error("Missing MONGODB_URI environment variable");
  }
  if (!global._blueprintMongoClient) {
    // Fail fast (clear 500) instead of hanging to a 504 if Atlas is
    // unreachable (e.g. IP not allowlisted).
    global._blueprintMongoClient = new MongoClient(uri, {
      serverSelectionTimeoutMS: 8000,
    });
  }
  return global._blueprintMongoClient;
}

/** Returns the Blueprint database (name from MONGODB_DB, defaults to dev). */
export function getDb(): Db {
  return getClient().db(dbName);
}
