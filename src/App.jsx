import { Routes, Route, NavLink, useNavigate } from "react-router-dom";
import "./App.css";
import { useState, useEffect } from "react";


import Profile from "./pages/Profile";
import Home from "./pages/Home";


import { FiSun, FiBarChart2, FiUser } from "react-icons/fi";

// To browse icons:
// https://react-icons.github.io/react-icons/ 




// to → the route path
// label → text under icon
// icon → emoji icon

function TabBar() {
  const tabs = [
    { to: "/", label: "Home", icon: <FiSun /> },
    { to: "/profile", label: "Profile", icon: <FiUser />},
  ];

  return (
    <nav className="tabbar" aria-label="Bottom Navigation">
      {tabs.map((t) => (
        <NavLink
          key={t.to}
          to={t.to}
          end={t.to === "/"} // makes "/" not stay active on every route
          className={({ isActive }) => (isActive ? "tab active" : "tab")}
        >
          <span className="tab-icon" aria-hidden="true">
            {t.icon}
          </span>
          <span className="tab-label">{t.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}


export default function App() {
  const [open, setOpen] = useState(false);
  return (
    <div className="app">
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/profile" element={<Profile />} />
      </Routes>

      <TabBar />
    </div>
  );
}