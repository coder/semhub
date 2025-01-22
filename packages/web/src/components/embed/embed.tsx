import { CheckIcon, CopyIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";

// using coder logo; cannot use self-hosted svg
// base64 URL too long and ugly?
export const SEMHUB_BADGE_IMG_SRC =
  "https://img.shields.io/badge/search-semhub-orange?style=flat&logo=coder&logoColor=blue";

export const getEmbedCode = (owner: string, repo: string) => {
  return `<a href="https://semhub.dev/r/${owner}/${repo}"><img src="${SEMHUB_BADGE_IMG_SRC}" alt="Search with SemHub"></a>`;
};

export function useCopyToClipboard(text: string) {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = () => {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return { copied, copyToClipboard };
}

interface CopyButtonProps {
  copied: boolean;
  onClick: () => void;
}

export function CopyButton({ copied, onClick }: CopyButtonProps) {
  return (
    <Button
      variant="secondary"
      size="sm"
      className="shrink-0 gap-1.5"
      onClick={onClick}
    >
      {copied ? (
        <>
          <CheckIcon className="size-3 text-green-500" />
          <span className="text-xs">Copied!</span>
        </>
      ) : (
        <>
          <CopyIcon className="size-3" />
          <span className="text-xs">Copy</span>
        </>
      )}
    </Button>
  );
}
