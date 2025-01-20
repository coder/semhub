import { useEffect, useRef } from "react";

export function useDebounce<TArgs extends unknown[]>(
  callback: (...args: TArgs) => void,
  delay: number,
) {
  const timeoutRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== undefined) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (...args: TArgs) => {
    if (timeoutRef.current !== undefined) {
      window.clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = window.setTimeout(() => {
      callback(...args);
    }, delay);
  };
}
