import { useMemo } from "react";

export const useAudio = (audioSrc: string) => {
  const audio = useMemo(() => new Audio(audioSrc), [audioSrc]);
  return {
    play: () => audio.play(),
    audio, // Expose audio element for more control if needed
  };
};
