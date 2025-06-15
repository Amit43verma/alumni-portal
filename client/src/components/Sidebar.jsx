"use client"

import { Link, useLocation } from "react-router-dom"
import { Home, MessageCircle, Users, Search, User, X } from "lucide-react"

const Sidebar = ({ onClose }) => {
  const location = useLocation()

  const menuItems = [
    { path: "/feed", icon: Home, label: "Feed" },
    { path: "/chat", icon: MessageCircle, label: "Messages" },
    { path: "/groups", icon: Users, label: "Groups" },
    { path: "/search", icon: Search, label: "Search" },
    { path: "/edit-profile", icon: User, label: "Profile" },
  ]

  return (
    <div className="h-full flex flex-col bg-base-200">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-base-300">
        <h2 className="text-lg font-semibold">Menu</h2>
        <button onClick={onClose} className="lg:hidden btn btn-ghost btn-sm">
          <X size={20} />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4">
        <ul className="space-y-2">
          {menuItems.map(({ path, icon: Icon, label }) => (
            <li key={path}>
              <Link
                to={path}
                onClick={onClose}
                className={`
                  flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors
                  ${location.pathname === path ? "bg-primary text-primary-content" : "hover:bg-base-300"}
                `}
              >
                <Icon size={20} />
                <span>{label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-base-300">
        <div className="text-sm text-base-content/60 text-center">Alumni Portal v1.0</div>
      </div>
    </div>
  )
}

export default Sidebar
