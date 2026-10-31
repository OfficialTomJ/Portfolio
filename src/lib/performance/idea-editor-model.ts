import type { TradeIdea } from "./ideas-model";
import type { IdeaDraft, PublicIdeaFields } from "./workspace-model";

/** Existing rough ideas open in the same editor without a migration or publication. */
export function ideaEditorFields(idea:TradeIdea,draft?:IdeaDraft):PublicIdeaFields {
  return draft?.fields ?? {title:idea.name,thesis:idea.thesis,target:idea.target,invalidation:idea.invalidation,status:"active",ideaAt:idea.createdAt,articleUrl:""};
}
