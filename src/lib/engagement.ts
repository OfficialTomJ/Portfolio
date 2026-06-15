import "server-only";
import { ObjectId } from "mongodb";
import { getDb } from "./mongodb";

let idx = false;
async function ensureIndexes() {
  if (idx) return;
  const db = getDb();
  await Promise.all([
    db
      .collection("episodeLikes")
      .createIndex({ episodeSlug: 1, userId: 1 }, { unique: true }),
    db
      .collection("commentLikes")
      .createIndex({ commentId: 1, userId: 1 }, { unique: true }),
    db.collection("comments").createIndex({ episodeSlug: 1, createdAt: -1 }),
  ]);
  idx = true;
}

// ---------- Episode likes ----------

export async function getEpisodeLikeState(slug: string, userId?: string) {
  const db = getDb();
  const [count, mine] = await Promise.all([
    db.collection("episodeLikes").countDocuments({ episodeSlug: slug }),
    userId
      ? db.collection("episodeLikes").findOne({ episodeSlug: slug, userId })
      : Promise.resolve(null),
  ]);
  return { count, liked: !!mine };
}

export async function toggleEpisodeLike(slug: string, userId: string) {
  await ensureIndexes();
  const db = getDb();
  const existing = await db
    .collection("episodeLikes")
    .findOne({ episodeSlug: slug, userId });
  if (existing) {
    await db.collection("episodeLikes").deleteOne({ _id: existing._id });
  } else {
    await db
      .collection("episodeLikes")
      .insertOne({ episodeSlug: slug, userId, createdAt: new Date() });
  }
  const count = await db
    .collection("episodeLikes")
    .countDocuments({ episodeSlug: slug });
  return { liked: !existing, count };
}

// ---------- Comments ----------

export interface CommentView {
  id: string;
  userId: string;
  authorName: string;
  authorImage: string | null;
  body: string;
  parentId: string | null;
  createdAt: string;
  edited: boolean;
  deleted: boolean;
  likeCount: number;
  likedByMe: boolean;
}

export async function listComments(
  slug: string,
  userId?: string
): Promise<CommentView[]> {
  await ensureIndexes();
  const db = getDb();
  const docs = await db
    .collection("comments")
    .find({ episodeSlug: slug })
    .sort({ createdAt: 1 })
    .toArray();

  const ids = docs.map((d) => d._id.toString());
  const myLikes = userId
    ? await db
        .collection("commentLikes")
        .find({ userId, commentId: { $in: ids } })
        .toArray()
    : [];
  const likedSet = new Set(myLikes.map((l) => l.commentId));

  return docs.map((d) => ({
    id: d._id.toString(),
    userId: d.userId,
    authorName: d.authorName,
    authorImage: d.authorImage ?? null,
    body: d.deleted ? "" : d.body,
    parentId: d.parentId ?? null,
    createdAt:
      d.createdAt instanceof Date ? d.createdAt.toISOString() : d.createdAt,
    edited: !!d.editedAt,
    deleted: !!d.deleted,
    likeCount: d.likeCount ?? 0,
    likedByMe: likedSet.has(d._id.toString()),
  }));
}

export async function createComment(
  slug: string,
  user: { id: string; name?: string | null; image?: string | null },
  body: string,
  parentId?: string | null
) {
  await ensureIndexes();
  const db = getDb();
  // Only allow replying to an existing top-level comment (one level deep).
  let parent: string | null = null;
  if (parentId) {
    const p = await db
      .collection("comments")
      .findOne({ _id: new ObjectId(parentId) });
    if (p) parent = (p.parentId ? p.parentId : p._id).toString();
  }
  const doc = {
    episodeSlug: slug,
    userId: user.id,
    authorName: user.name || "Member",
    authorImage: user.image || null,
    body,
    parentId: parent,
    createdAt: new Date(),
    editedAt: null as Date | null,
    deleted: false,
    likeCount: 0,
  };
  const res = await db.collection("comments").insertOne(doc);
  return res.insertedId.toString();
}

export async function editComment(id: string, userId: string, body: string) {
  const db = getDb();
  const res = await db
    .collection("comments")
    .updateOne(
      { _id: new ObjectId(id), userId, deleted: false },
      { $set: { body, editedAt: new Date() } }
    );
  return res.matchedCount > 0;
}

export async function deleteComment(id: string, userId: string) {
  const db = getDb();
  const res = await db
    .collection("comments")
    .updateOne(
      { _id: new ObjectId(id), userId },
      { $set: { deleted: true, body: "" } }
    );
  return res.matchedCount > 0;
}

export async function toggleCommentLike(id: string, userId: string) {
  await ensureIndexes();
  const db = getDb();
  const existing = await db
    .collection("commentLikes")
    .findOne({ commentId: id, userId });
  if (existing) {
    await db.collection("commentLikes").deleteOne({ _id: existing._id });
    await db
      .collection("comments")
      .updateOne({ _id: new ObjectId(id) }, { $inc: { likeCount: -1 } });
  } else {
    await db
      .collection("commentLikes")
      .insertOne({ commentId: id, userId, createdAt: new Date() });
    await db
      .collection("comments")
      .updateOne({ _id: new ObjectId(id) }, { $inc: { likeCount: 1 } });
  }
  const doc = await db
    .collection("comments")
    .findOne({ _id: new ObjectId(id) });
  return { liked: !existing, likeCount: Math.max(0, doc?.likeCount ?? 0) };
}
