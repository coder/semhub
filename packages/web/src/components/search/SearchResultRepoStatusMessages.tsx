import { Link } from "@tanstack/react-router";
import { AlertCircleIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

import { RepoPreview, type RepoPreviewProps } from "../repos/RepoPreview";

const MessageLayout = ({ children }: { children: React.ReactNode }) => (
  <div className="rounded-lg border bg-background p-4 text-mobile-base sm:p-6 sm:text-base">
    {children}
  </div>
);

export const NotFoundMessage = () => (
  <MessageLayout>
    This repo does not exist. Is it spelled correctly?
  </MessageLayout>
);

export const InitializingMessage = ({
  owner,
  repo,
}: {
  owner: string;
  repo: string;
}) => (
  <MessageLayout>
    This repository is being initialized. For more information,{" "}
    <Link
      to="/r/$owner/$repo"
      params={{ owner, repo }}
      className="text-primary underline"
    >
      click here
    </Link>
    .
  </MessageLayout>
);

export const ErrorMessage = ({
  owner,
  repo,
}: {
  owner: string;
  repo: string;
}) => (
  <MessageLayout>
    This repository is in an error state. For more information,{" "}
    <Link
      to="/r/$owner/$repo"
      params={{ owner, repo }}
      className="text-primary underline"
    >
      click here
    </Link>
    .
  </MessageLayout>
);

export const NoMatchesMessage = () => (
  <MessageLayout>No issues matched your search</MessageLayout>
);

type OnGithubMessageProps = {
  error: string | null;
  preview: RepoPreviewProps | null;
};

export const OnGithubMessage = ({ error, preview }: OnGithubMessageProps) => (
  <MessageLayout>
    <div className="space-y-4">
      <p>No issues matched your search</p>
      {error && (
        <>
          <div className="flex items-center gap-2 text-sm text-destructive">
            <AlertCircleIcon className="size-4" />
            <span>{error}</span>
          </div>
          {error.includes("rate limit") && preview && (
            <div className="flex justify-center">
              <Button asChild variant="default">
                <Link
                  to="/r/$owner/$repo"
                  params={{
                    owner: preview.owner.login,
                    repo: preview.name,
                  }}
                >
                  Load repo in SemHub
                </Link>
              </Button>
            </div>
          )}
        </>
      )}
      {preview && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            It looks like you&apos;re searching for this repository.
          </p>
          <RepoPreview {...preview} />
          <div className="flex justify-center">
            <Button asChild variant="default">
              <Link
                to="/r/$owner/$repo"
                params={{
                  owner: preview.owner.login,
                  repo: preview.name,
                }}
                // important, or we will load all repos immediately
                preload={false}
              >
                Load repo in SemHub
              </Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  </MessageLayout>
);
