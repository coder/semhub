import React from "react";
import ReactDOM from "react-dom/client";

const App = () => {
  return (
    <div>
      <h1>Hello, World!</h1>
      <p>Welcome to my React application!</p>
    </div>
  );
};

const rootElement = document.getElementById("app")!;

const root = ReactDOM.createRoot(rootElement);
root.render(<App />);
