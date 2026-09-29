import React from "react";
import ReactDOM from "react-dom/client";
// import App from "./App.tsx";
import "./index.css";
import { Amplify } from "aws-amplify";
import outputs from "../amplify_outputs.json";

import { Authenticator } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';

import ModeRouter from "./ModeRouter";
import { isUiTestMode } from "./testMode";

Amplify.configure(outputs);

ReactDOM.createRoot(document.getElementById("root")!).render(
  
  <React.StrictMode>
  {isUiTestMode ? (
    <Authenticator.Provider>
      <ModeRouter />
    </Authenticator.Provider>
  ) : <Authenticator>
    <ModeRouter />
  </Authenticator>}
  </React.StrictMode>
);
