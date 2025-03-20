import { createFileRoute, useRouter } from "@tanstack/react-router";

import {
  COMMENT_COUNT_CAP,
  NORMALIZATION_ANCHOR,
  RANKING_WEIGHTS,
} from "@/core/constants/ranking.constant";

export const Route = createFileRoute("/ranking")({
  component: RankingPage,
});

function RankingPage() {
  const { history } = useRouter();

  return (
    <main className="mx-auto max-w-3xl px-4 pt-4">
      <div className="mb-12 text-center">
        <h1 className="mb-8 font-serif text-4xl tracking-tight">
          How <span className="text-blue-600 dark:text-blue-400">Sem</span>
          <span className="text-orange-500">Hub</span> ranks results
        </h1>

        <section className="rounded-lg border bg-muted/30 p-6 text-left text-muted-foreground">
          <div className="flex flex-col gap-3">
            <div>
              <strong>Normalized scores</strong>
              <ul className="mt-2 list-disc pl-5 marker:text-blue-600/40">
                <li>
                  <span>
                    Raw scores are normalized to a 0-100% scale to make them
                    more intuitive, with {NORMALIZATION_ANCHOR * 100}% as the
                    anchor point. We picked this anchor point as it seems like
                    perfect matches more or less tops out at this number.
                  </span>
                </li>
              </ul>
            </div>
            <div>
              <strong>
                Semantic Similarity ({RANKING_WEIGHTS.SEMANTIC_SIMILARITY * 100}
                %)
              </strong>
              <ul className="mt-2 list-disc pl-5 marker:text-blue-600/40">
                <li>
                  <span>
                    We use a shortened version of OpenAI&apos;s{" "}
                    <a
                      href="https://platform.openai.com/docs/guides/embeddings"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline"
                    >
                      <code>text-embedding-3-small</code> embeddings
                    </a>{" "}
                    to perform semantic similarity search. This is the primary
                    factor in determining result relevance.
                  </span>
                </li>
              </ul>
            </div>

            <div>
              <strong>
                Issue Activity ({RANKING_WEIGHTS.COMMENT_COUNT * 100}%)
              </strong>
              <ul className="mt-2 list-disc pl-5 marker:text-blue-600/40">
                <li>
                  <span>
                    Issues with more comments are ranked higher using a
                    logarithmic scale.
                  </span>
                </li>
                <li>
                  <span>
                    In other words, the first few comments make a difference,
                    but additional comments have diminishing impact, until the
                    score caps out at {COMMENT_COUNT_CAP} comments.
                  </span>
                </li>
                <li>
                  <span>
                    We currently do not use reaction counts for ranking.
                  </span>
                </li>
                <li>
                  <span>
                    Due to GitHub GraphQL&apos;s limitation, we only save the
                    first 100 comments of a given issue.
                  </span>
                </li>
              </ul>
            </div>

            <div>
              <strong>Recency ({RANKING_WEIGHTS.RECENCY * 100}%)</strong>
              <ul className="mt-2 list-disc pl-5 marker:text-blue-600/40">
                <li>
                  <span>
                    <span>
                      Recent issues are ranked higher, with the score gradually
                      decreasing over time. Older issues still appear in results
                      but with lower priority.
                    </span>
                  </span>
                </li>
                <li>
                  <span>
                    This helps surface fresh issues while keeping relevant older
                    issues accessible.
                  </span>
                </li>
              </ul>
            </div>

            <div>
              <strong>
                Issue State ({RANKING_WEIGHTS.ISSUE_STATE * 100}%)
              </strong>
              <ul className="mt-2 list-disc pl-5 marker:text-blue-600/40">
                <li>
                  <span>
                    Open issues receive a slight boost compared to closed ones.
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </section>

        <button
          onClick={() => history.go(-1)}
          className="mt-8 rounded-md bg-muted px-4 py-2 text-sm font-medium hover:bg-muted/80"
        >
          ← Go Back
        </button>
      </div>
    </main>
  );
}
