import "./globals.css";

import ReactDOM from "react-dom/client";

import { Layout } from "./components/Layout";
import { Providers } from "./components/Providers";
import { Search } from "./components/Search";

const App = () => {
  return (
    <Providers>
      <Layout>
        <Search />
      </Layout>
    </Providers>
  );
};

const rootElement = document.getElementById("app")!;

const root = ReactDOM.createRoot(rootElement);
root.render(<App />);
