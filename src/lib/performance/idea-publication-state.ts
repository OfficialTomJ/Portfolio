import type { IdeaDraft } from "./workspace-model";
export function ideaPublicationState(draft?: IdeaDraft): "draft" | "published" | "changes" {
  return !draft || !draft.published ? "draft" : draft.revision !== draft.publishedRevision ? "changes" : "published";
}
export const ideaPublicationLabel = {
  draft: "Draft", published: "Published", changes: "Published · unpublished edits",
};
