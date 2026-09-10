import { NavLink } from 'react-router-dom'
import { Factory, ChevronsLeft, ChevronsRight } from 'lucide-react'
import { useAuthStore } from '../../stores/authStore'
import { useAppStore } from '../../stores/appStore'
import { MENU_CONFIG } from '../../lib/menuConfig'
import { cn, ROLE_LABELS, initials } from '../../lib/utils'

export default function Sidebar() {
  const user = useAuthStore((s) => s.user)
  const { sidebarCollapsed, toggleCollapse, appSettings } = useAppStore()
  const role = user?.roles?.[0] || 'staff_dept'
  const menu = MENU_CONFIG[role] || []
  const appName = appSettings?.app_name || 'OutsourceHR'
  const appLogo = appSettings?.app_logo || null

  return (
    <aside className={cn(
      'bg-white border-r border-gray-200 flex flex-col flex-shrink-0 h-screen sticky top-0 transition-all duration-200',
      sidebarCollapsed ? 'w-[64px]' : 'w-[240px]'
    )}>
      <div className="h-14 flex items-center gap-2.5 px-4 border-b border-gray-100 flex-shrink-0">
        <div className="w-8 h-8 rounded-lg bg-brand flex items-center justify-center flex-shrink-0 overflow-hidden">
          {appLogo
            ? <img src={appLogo} alt="logo" className="w-full h-full object-cover" />
            : <Factory size={16} className="text-white" />
          }
        </div>
        {!sidebarCollapsed && (
          <div className="overflow-hidden">
            <p className="text-sm font-semibold text-gray-900 leading-none truncate">{appName}</p>
            <p className="text-[10px] text-gray-400 mt-0.5">v1.0.0</p>
          </div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto py-3">
        {menu.map((group) => (
          <div key={group.group} className="mb-1">
            {!sidebarCollapsed && (
              <p className="px-4 text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1 mt-3">{group.group}</p>
            )}
            {group.items.map((item) => (
              <NavLink
                key={item.id}
                to={item.path}
                className={({ isActive }) => cn(
                  'flex items-center gap-2.5 mx-2 px-3 py-2 rounded-lg text-sm transition-colors mb-0.5',
                  isActive ? 'bg-brand-light text-brand font-medium' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                )}
                title={sidebarCollapsed ? item.label : undefined}
              >
                <item.icon size={17} className="flex-shrink-0" />
                {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      <button onClick={toggleCollapse} className="mx-2 mb-2 flex items-center justify-center gap-2 py-2 rounded-lg text-gray-400 hover:bg-gray-50 hover:text-gray-600 text-xs">
        {sidebarCollapsed ? <ChevronsRight size={16} /> : <><ChevronsLeft size={16} /> Ciutkan</>}
      </button>

      <div className="p-3 border-t border-gray-100 flex items-center gap-2.5 flex-shrink-0">
        <div className="w-8 h-8 rounded-full bg-brand-light text-brand flex items-center justify-center text-xs font-semibold flex-shrink-0">
          {initials(user?.name)}
        </div>
        {!sidebarCollapsed && (
          <div className="overflow-hidden">
            <p className="text-xs font-medium text-gray-900 truncate">{user?.name}</p>
            <p className="text-[10px] text-gray-400 truncate">{ROLE_LABELS[role]}</p>
          </div>
        )}
      </div>
    </aside>
  )
}
