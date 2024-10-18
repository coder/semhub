import { createFileRoute } from "@tanstack/react-router";

import { Search } from "@/components/Search";

const Root = () => {
  return <Search />;
};

export const Route = createFileRoute("/")({
  component: () => <Root />,
});
