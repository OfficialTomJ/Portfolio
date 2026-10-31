import type { IdeaDraft } from "./workspace-model";
export function ideaPublicationState(draft?: IdeaDraft): "private" | "draft" | "published" | "changes" {
  return !draft ? "private" : !draft.published ? "draft" : draft.revision !== draft.publishedRevision ? "changes" : "published";
}
export const ideaPublicationLabel = {
  private: "Private working idea", draft: "Draft · not public", published: "Published", changes: "Published · draft changes",
};
