import { ideaChartLevels } from "./idea-timeline-model";
import type { TradeIdea } from "./ideas-model";
import type { IdeaDraft, PublicIdeaFields } from "./workspace-model";

/** Existing rough ideas open in the same editor without a migration or publication. */
export function ideaEditorFields(idea:TradeIdea,draft?:IdeaDraft):PublicIdeaFields {
  if(draft) {
    const {updates:legacyUpdates,chart:legacyChart,...fields}=draft.fields;
    void legacyChart;
    void legacyUpdates; // Prior timeline revisions remain in history; the editor saves one current thesis.
    return {...fields,charts:ideaChartLevels(draft.fields)};
  }
  return {title:idea.name,thesis:idea.thesis,target:idea.target,invalidation:idea.invalidation,status:"active",ideaAt:idea.createdAt,articleUrl:""};
}
