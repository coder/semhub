import type { WorkflowEvent, WorkflowStep } from "cloudflare:workers";
import { WorkflowEntrypoint } from "cloudflare:workers";

type Env = {
  SYNC_WORKFLOW: Workflow;
};

// User-defined params passed to your workflow
export interface SyncWorkflowParams {
  email: string;
  metadata: Record<string, string>;
}

export class SyncWorkflow extends WorkflowEntrypoint<Env, SyncWorkflowParams> {
  async run(event: WorkflowEvent<SyncWorkflowParams>, step: WorkflowStep) {
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
  async fetch(): Promise<Response> {
    // Return 400 for direct HTTP requests since workflows should be triggered via bindings
    return Response.json(
      { error: "Workflows must be triggered via bindings" },
      { status: 400 },
    );
  },
};
