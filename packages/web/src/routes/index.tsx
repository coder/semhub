import { createFileRoute } from "@tanstack/react-router";

import { Layout } from "@/components/Layout";
import { Providers } from "@/components/Providers";
import { Search } from "@/components/Search";

const Root = () => {
  return (
    <Providers>
      <Layout>
        <Search />
      </Layout>
    </Providers>
  );
};

export const Route = createFileRoute("/")({
  component: () => <Root />,
});
