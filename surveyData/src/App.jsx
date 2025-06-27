import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Login from "./components/Login";
import Dashboard from "./pages/Dashboard";

const App = () => {
  const isAuth = localStorage.getItem("auth") === "true";

  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route
          path="/dashboard"
          element={isAuth ? <Dashboard /> : <Navigate to="/" />}
        />
      </Routes>
    </Router>
  );
};

export default App;
