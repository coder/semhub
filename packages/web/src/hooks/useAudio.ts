import { useMemo } from "react";

export const useAudio = (url: string) => {
  const audio = useMemo(() => new Audio(url), [url]);
  return { play: () => audio.play() };
};
