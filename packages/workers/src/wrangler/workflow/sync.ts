// <docs-tag name="full-workflow-example">
import type { WorkflowEvent, WorkflowStep } from "cloudflare:workers";
import { WorkflowEntrypoint } from "cloudflare:workers";

type Env = {
  // Add your bindings here, e.g. Workers KV, D1, Workers AI, etc.
  SYNC_WORKFLOW: Workflow;
};

// User-defined params passed to your workflow
type Params = {
  email: string;
  metadata: Record<string, string>;
};

// <docs-tag name="workflow-entrypoint">
export class SyncWorkflow extends WorkflowEntrypoint<Env, Params> {
  async run(event: WorkflowEvent<Params>, step: WorkflowStep) {
    // Can access bindings on `this.env`
    // Can access params on `event.payload`
    const files = await step.do("my first step", async () => {
      // Fetch a list of files from $SOME_SERVICE
      return {
        inputParams: event,
        files: [
          "doc_7392_rev3.pdf",
          "report_x29_final.pdf",
          "memo_2024_05_12.pdf",
          "file_089_update.pdf",
          "proj_alpha_v2.pdf",
          "data_analysis_q2.pdf",
          "notes_meeting_52.pdf",
          "summary_fy24_draft.pdf",
        ],
      };
    });

    await step.sleep("wait on something", "1 minute");

    await step.do("log", async () => {
      console.log(files);
      console.log("done");
    });
  }
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    let url = new URL(req.url);

    if (url.pathname.startsWith("/favicon")) {
      return Response.json({}, { status: 404 });
    }

    // Get the status of an existing instance, if provided
    let id = url.searchParams.get("instanceId");
    if (id) {
      let instance = await env.SYNC_WORKFLOW.get(id);
      return Response.json({
        status: await instance.status(),
      });
    }

    // Spawn a new instance and return the ID and status
    let instance = await env.SYNC_WORKFLOW.create();
    return Response.json({
      id: instance.id,
      details: await instance.status(),
    });
  },
};
