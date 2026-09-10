import { create } from 'zustand'

export const useAppStore = create((set) => ({
  sidebarOpen: true,
  sidebarCollapsed: false,
  notifications: [],
  pendingApprovals: 0,
  appSettings: { app_name: 'OutsourceHR', app_logo: null },

  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  toggleCollapse: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setNotifications: (notifications) => set({ notifications }),
  setPendingApprovals: (n) => set({ pendingApprovals: n }),
  addNotification: (n) => set((s) => ({ notifications: [n, ...s.notifications] })),
  setAppSettings: (appSettings) => set({ appSettings }),
}))
