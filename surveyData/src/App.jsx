import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Login from "./components/Login";
import Dashboard from "./pages/Dashboard";

const App = () => {
  const [isAuth, setIsAuth] = useState(false);

  useEffect(() => {
    const authStatus = localStorage.getItem("auth") === "true";
    setIsAuth(authStatus);
  }, []);

  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login setIsAuth={setIsAuth} />} />
        <Route
          path="/response"
          element={isAuth ? <Dashboard /> : <Navigate to="/" />}
        />
      </Routes>
    </Router>
  );
};

export default App;
