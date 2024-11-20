export function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function toTitleCase(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
