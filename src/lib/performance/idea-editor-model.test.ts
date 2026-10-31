import assert from "node:assert/strict";
import test from "node:test";
import { ideaEditorFields } from "./idea-editor-model";
import { ideaDraftSchema, publicIdeaSchema } from "./workspace-model";
const idea={id:"idea-one",name:"Existing rough title",thesis:"Rough thesis",target:"Daily highs",invalidation:"Daily close below support",notes:"Private legacy note",createdAt:"2026-01-01T00:00:00Z",updatedAt:"2026-01-01T00:00:00Z"};
test("existing rough idea content opens in the single editor without exposing legacy notes",()=>{
  const fields=ideaEditorFields(idea);
  assert.equal(fields.title,idea.name);assert.equal(fields.thesis,idea.thesis);assert.equal(fields.target,idea.target);assert.equal(fields.invalidation,idea.invalidation);
  assert.ok(!JSON.stringify(fields).includes(idea.notes));
  const draft={id:idea.id,revision:2,published:true,publishedRevision:1,fields:{...fields,title:"Edited title",updates:[{id:"old",at:idea.createdAt,title:"Old update",thesis:"Old thesis",target:"",invalidation:""}]}};
  assert.equal(ideaEditorFields(idea,draft).title,"Edited title");
  assert.equal(ideaEditorFields(idea,draft).updates,undefined,"hidden legacy timeline must not constrain current editing");
});
test("a title-only idea can remain a private draft but cannot pass publication validation",()=>{
  const fields={...ideaEditorFields(idea),thesis:"",target:"",invalidation:""};
  assert.ok(ideaDraftSchema.safeParse(fields).success);
  assert.equal(publicIdeaSchema.safeParse(fields).success,false);
});
