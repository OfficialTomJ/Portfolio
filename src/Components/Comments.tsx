"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { FaRegThumbsUp, FaThumbsUp } from "react-icons/fa";
import { authClient } from "../lib/auth-client";

interface CommentView {
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

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

function Avatar({ name, image, size = 36 }: { name: string; image: string | null; size?: number }) {
  if (image) {
    return (
      <Image
        src={image}
        alt=""
        width={size}
        height={size}
        style={{ width: size, height: size }}
        className="rounded-full object-cover shrink-0"
      />
    );
  }
  return (
    <span
      className="grid place-items-center rounded-full bg-[var(--bp-accent)] text-black font-semibold shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {(name || "?").charAt(0).toUpperCase()}
    </span>
  );
}

export default function Comments({ episodeSlug }: { episodeSlug: string }) {
  const { data: session } = authClient.useSession();
  const meId = session?.user?.id;

  const [comments, setComments] = useState<CommentView[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [posting, setPosting] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/comments?episodeSlug=${episodeSlug}`);
      const d = await r.json();
      setComments(d.comments ?? []);
    } finally {
      setLoading(false);
    }
  }, [episodeSlug]);

  useEffect(() => {
    load();
  }, [load]);

  async function post(body: string, parentId: string | null) {
    const r = await fetch("/api/comments", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ episodeSlug, body, parentId }),
    });
    if (r.ok) await load();
    return r.ok;
  }

  async function submitTop(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || posting) return;
    setPosting(true);
    const ok = await post(text.trim(), null);
    setPosting(false);
    if (ok) setText("");
  }

  const tops = comments
    .filter((c) => !c.parentId)
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  const repliesOf = (id: string) =>
    comments
      .filter((c) => c.parentId === id)
      .sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt));

  const total = comments.filter((c) => !c.deleted).length;

  return (
    <section className="mt-12">
      <h2 className="text-xl font-semibold mb-5">
        {total} {total === 1 ? "comment" : "comments"}
      </h2>

      {/* Composer */}
      <form onSubmit={submitTop} className="flex gap-3 mb-8">
        <Avatar name={session?.user?.name ?? "?"} image={session?.user?.image ?? null} />
        <div className="flex-1">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Add a comment…"
            rows={2}
            maxLength={2000}
            className="w-full rounded-md bg-black border border-[var(--bp-border-strong)] px-3 py-2 outline-none focus:border-[var(--bp-accent)] transition-colors resize-y"
          />
          <div className="mt-2 flex justify-end">
            <button
              type="submit"
              disabled={!text.trim() || posting}
              className="rounded-md bg-white text-black font-medium px-5 py-2 text-sm hover:bg-zinc-200 transition-colors disabled:opacity-50"
            >
              {posting ? "Posting…" : "Comment"}
            </button>
          </div>
        </div>
      </form>

      {loading ? (
        <p className="text-[var(--bp-text-dim)]">Loading comments…</p>
      ) : tops.length === 0 ? (
        <p className="text-[var(--bp-text-dim)]">Be the first to comment.</p>
      ) : (
        <div className="space-y-6">
          {tops.map((c) => (
            <CommentItem
              key={c.id}
              comment={c}
              replies={repliesOf(c.id)}
              meId={meId}
              onChanged={load}
              onReply={post}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function CommentItem({
  comment,
  replies,
  meId,
  onChanged,
  onReply,
}: {
  comment: CommentView;
  replies?: CommentView[];
  meId?: string;
  onChanged: () => Promise<void>;
  onReply: (body: string, parentId: string | null) => Promise<boolean>;
}) {
  const [liked, setLiked] = useState(comment.likedByMe);
  const [likeCount, setLikeCount] = useState(comment.likeCount);
  const [replying, setReplying] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(comment.body);

  const mine = meId && meId === comment.userId;

  async function toggleLike() {
    const pl = liked;
    const pc = likeCount;
    setLiked(!pl);
    setLikeCount(pc + (pl ? -1 : 1));
    try {
      const r = await fetch(`/api/comments/${comment.id}/like`, { method: "POST" });
      const d = await r.json();
      if (r.ok) {
        setLiked(d.liked);
        setLikeCount(d.likeCount);
      } else {
        setLiked(pl);
        setLikeCount(pc);
      }
    } catch {
      setLiked(pl);
      setLikeCount(pc);
    }
  }

  async function saveEdit() {
    const r = await fetch(`/api/comments/${comment.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ body: editText.trim() }),
    });
    if (r.ok) {
      setEditing(false);
      await onChanged();
    }
  }

  async function remove() {
    if (!confirm("Delete this comment?")) return;
    const r = await fetch(`/api/comments/${comment.id}`, { method: "DELETE" });
    if (r.ok) await onChanged();
  }

  async function submitReply() {
    if (!replyText.trim()) return;
    const ok = await onReply(replyText.trim(), comment.id);
    if (ok) {
      setReplyText("");
      setReplying(false);
    }
  }

  return (
    <div className="flex gap-3">
      <Avatar name={comment.authorName} image={comment.authorImage} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 text-sm">
          <span className="font-medium">
            {comment.deleted ? "—" : comment.authorName}
          </span>
          <span className="text-[var(--bp-text-dim)] text-xs">
            {timeAgo(comment.createdAt)}
            {comment.edited && !comment.deleted ? " · edited" : ""}
          </span>
        </div>

        {comment.deleted ? (
          <p className="text-[var(--bp-text-dim)] italic mt-1">[deleted]</p>
        ) : editing ? (
          <div className="mt-2">
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              rows={2}
              maxLength={2000}
              className="w-full rounded-md bg-black border border-[var(--bp-border-strong)] px-3 py-2 outline-none focus:border-[var(--bp-accent)] resize-y"
            />
            <div className="mt-2 flex gap-2">
              <button
                onClick={saveEdit}
                disabled={!editText.trim()}
                className="rounded-md bg-white text-black px-3 py-1 text-sm font-medium disabled:opacity-50"
              >
                Save
              </button>
              <button
                onClick={() => {
                  setEditing(false);
                  setEditText(comment.body);
                }}
                className="text-sm text-[var(--bp-text-dim)] hover:text-white"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <p className="mt-1 whitespace-pre-wrap break-words">{comment.body}</p>
        )}

        {!comment.deleted && !editing && (
          <div className="mt-2 flex items-center gap-4 text-xs text-[var(--bp-text-dim)]">
            <button
              onClick={toggleLike}
              className={`inline-flex items-center gap-1.5 hover:text-white transition-colors ${
                liked ? "text-[var(--bp-accent)]" : ""
              }`}
            >
              {liked ? <FaThumbsUp /> : <FaRegThumbsUp />}
              {likeCount > 0 ? likeCount : ""}
            </button>
            {comment.parentId === null && (
              <button
                onClick={() => setReplying((v) => !v)}
                className="hover:text-white transition-colors"
              >
                Reply
              </button>
            )}
            {mine && (
              <>
                <button
                  onClick={() => setEditing(true)}
                  className="hover:text-white transition-colors"
                >
                  Edit
                </button>
                <button
                  onClick={remove}
                  className="hover:text-red-400 transition-colors"
                >
                  Delete
                </button>
              </>
            )}
          </div>
        )}

        {replying && (
          <div className="mt-3">
            <textarea
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="Reply…"
              rows={2}
              maxLength={2000}
              className="w-full rounded-md bg-black border border-[var(--bp-border-strong)] px-3 py-2 outline-none focus:border-[var(--bp-accent)] resize-y"
            />
            <div className="mt-2 flex gap-2">
              <button
                onClick={submitReply}
                disabled={!replyText.trim()}
                className="rounded-md bg-white text-black px-3 py-1 text-sm font-medium disabled:opacity-50"
              >
                Reply
              </button>
              <button
                onClick={() => setReplying(false)}
                className="text-sm text-[var(--bp-text-dim)] hover:text-white"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Replies */}
        {replies && replies.length > 0 && (
          <div className="mt-4 space-y-4 pl-4 border-l border-[var(--bp-border)]">
            {replies.map((r) => (
              <CommentItem
                key={r.id}
                comment={r}
                meId={meId}
                onChanged={onChanged}
                onReply={onReply}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
