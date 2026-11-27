import { createContext, useContext, useState } from "react";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem("rti_user");
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState(() => localStorage.getItem("rti_token") || "");

  const loginUser = (newToken, newUser) => {
    localStorage.setItem("rti_token", newToken);
    localStorage.setItem("rti_user", JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  };

  const logoutUser = () => {
    localStorage.removeItem("rti_token");
    localStorage.removeItem("rti_user");
    setToken("");
    setUser(null);
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, loginUser, logoutUser , logout}}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
