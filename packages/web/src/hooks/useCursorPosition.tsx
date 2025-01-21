import { useEffect, useState } from "react";

export function useCursorPosition(inputRef: React.RefObject<HTMLInputElement | null>) {
  const [cursorPosition, setCursorPosition] = useState(0);

  const handleCursorPosition = () => {
    if (inputRef.current) {
      setCursorPosition(inputRef.current.selectionStart ?? 0);
    }
  };

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;

    input.addEventListener("click", handleCursorPosition);
    input.addEventListener("keyup", handleCursorPosition);
    input.addEventListener("select", handleCursorPosition);

    return () => {
      input.removeEventListener("click", handleCursorPosition);
      input.removeEventListener("keyup", handleCursorPosition);
      input.removeEventListener("select", handleCursorPosition);
    };
  }, []);

  return { cursorPosition, setCursorPosition };
}
