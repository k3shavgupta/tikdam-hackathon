import { CustomerAuthProvider, CustomerAuthPage } from './auth/CustomerAuth.jsx';
import React, {lazy, Suspense} from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "@fontsource/bricolage-grotesque/latin-700.css";
import "@fontsource/bricolage-grotesque/latin-800.css";
import "@fontsource/space-grotesk/latin-400.css";
import "@fontsource/space-grotesk/latin-500.css";
import "@fontsource/space-grotesk/latin-700.css";
import "./style.css";
import "./app-theme.css";
const AdminApp = lazy(()=>import("./admin/AdminApp.jsx"));
const adminPath = /^\/admin(?:\/|$)/i.test(window.location.pathname);
const signInPath = /^\/app\/sign-in(?:\/|$)/i.test(window.location.pathname);
const signUpPath = /^\/app\/sign-up(?:\/|$)/i.test(window.location.pathname);
createRoot(document.getElementById("root")).render(adminPath ? <Suspense fallback={<main><p>Loading owner dashboard…</p></main>}><AdminApp /></Suspense> : <CustomerAuthProvider>
  {signInPath || signUpPath ? <CustomerAuthPage signUp={signUpPath} /> : <App />}
</CustomerAuthProvider>);
