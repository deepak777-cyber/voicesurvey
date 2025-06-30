import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Login from "./components/Login";
import Dashboard from "./pages/Dashboard";

const App = () => {
  const [isAuth, setIsAuth] = useState(null); // Initially null to show "loading" state

  useEffect(() => {
    const authStatus = localStorage.getItem("auth") === "true";
    setIsAuth(authStatus);
  }, []);

  if (isAuth === null) {
    return <div>Loading...</div>; // Or a spinner, loader component
  }

  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login setIsAuth={setIsAuth} />} />
        <Route
          path="/response"
          element={isAuth ? <Dashboard /> : <Navigate to="/" replace />}
        />
      </Routes>
    </Router>
  );
};

export default App;
