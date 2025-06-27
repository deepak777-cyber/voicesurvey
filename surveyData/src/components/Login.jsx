import React, { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import '../styles/styles.css'

const Login = () => {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");

    try {
      const res = await axios.post("http://localhost:5000/api/auth/login", {
        username,
        password,
      });

      const { token } = res.data;
      localStorage.setItem("token", token);
      navigate("/dashboard");
    } catch (err) {
      setError(err.response?.data?.message || "Login failed");
    }
  };

return (
  <div className="login-container">
    <h2>Login</h2>
    <form className="login-form" onSubmit={handleLogin}>
      <label>Username:</label>
      <input
        type="text"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        required
      />

      <label>Password:</label>
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />

      {error && <p style={{ color: "red" }}>{error}</p>}

      <button type="submit">Login</button>
    </form>
  </div>
);

};

export default Login;
