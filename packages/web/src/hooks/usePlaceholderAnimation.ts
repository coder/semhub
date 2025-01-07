import { useEffect, useState } from "react";

// need to be short for entire text to fit in mobile
const PLACEHOLDER_TEXTS = [
  "Semhub understands what you mean",
  "Search issues across multiple repos",
  "Login to add your private repos",
  "Create your own repo collections",
] as const;

const TYPING_DELAY_MS = 20;
const DELAY_BEFORE_DELETE_MS = 5000;
const DELAY_BEFORE_TYPE_MS = 1000;

export function usePlaceholderAnimation() {
  const [placeholderText, setPlaceholderText] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isTyping, setIsTyping] = useState(true);

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;

    const animatePlaceholder = () => {
      const safeIndex = currentIndex % PLACEHOLDER_TEXTS.length;
      const currentText = PLACEHOLDER_TEXTS[safeIndex];

      if (isTyping && currentText) {
        if (placeholderText.length < currentText.length) {
          timeoutId = setTimeout(() => {
            setPlaceholderText(
              currentText.slice(0, placeholderText.length + 1),
            );
          }, TYPING_DELAY_MS);
        } else {
          timeoutId = setTimeout(() => {
            setIsTyping(false);
          }, DELAY_BEFORE_DELETE_MS);
        }
      } else {
        if (placeholderText.length > 0) {
          timeoutId = setTimeout(() => {
            setPlaceholderText(placeholderText.slice(0, -1));
          }, TYPING_DELAY_MS);
        } else {
          setCurrentIndex(
            (prevIndex) => (prevIndex + 1) % PLACEHOLDER_TEXTS.length,
          );
          setIsTyping(true);
          timeoutId = setTimeout(() => {}, DELAY_BEFORE_TYPE_MS);
        }
      }
    };

    animatePlaceholder();

    return () => clearTimeout(timeoutId);
  }, [placeholderText, currentIndex, isTyping]);

  return placeholderText;
}
