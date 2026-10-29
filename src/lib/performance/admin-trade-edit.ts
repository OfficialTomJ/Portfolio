import "server-only";
import { AnnotationInputError, saveTradeAnnotation } from "./annotations";
import { getIdeaHistory, getIdeasContext } from "./ideas-data";
import { tradeIdeaEditSchema, type IdeaEditorData, type IdeaGroups } from "./ideas-model";

export async function getTradeIdeaEditor(id: string): Promise<IdeaEditorData | null> {
  const context = await getIdeasContext();
  if (!context) return null;
  const [groups, trades] = await Promise.all([context.repository.load(), getIdeaHistory(context)]);
  return { ...groups, eligible: trades.some(t => t.id === id && !t.duplicateOf) };
}

/** Public metadata and private idea records remain separate, but commit atomically. */
export async function saveAdminTradeEdit(id: string, value: unknown, actor: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new AnnotationInputError("Invalid edit");
  const { ideaEdit, ...annotation } = value as Record<string, unknown>;
  if (ideaEdit === undefined) return { annotation: await saveTradeAnnotation(id, annotation, actor) };
  const parsed = tradeIdeaEditSchema.safeParse(ideaEdit);
  if (!parsed.success) throw new AnnotationInputError(parsed.error.issues[0]?.message ?? "Invalid idea edit");
  const context = await getIdeasContext();
  if (!context) throw new AnnotationInputError("No synced account is available for ideas.");
  const history = await getIdeaHistory(context);
  const eligible = new Set(history.filter(t => !t.duplicateOf).map(t => t.id));
  let ideaGroups: IdeaGroups | undefined;
  const saved = await saveTradeAnnotation(id, annotation, actor, async session => {
    ideaGroups = await context.repository.mutateInSession({ ...parsed.data, tradeIds: [id] }, eligible, actor, session);
  });
  return { annotation: saved, ideaGroups };
}
