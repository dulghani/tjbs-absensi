import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// Normalisasi user — pastikan selalu punya 'roles' array dan 'role' string
function normalizeStoredUser(u) {
  if (!u) return null
  const roleStr = u.role ?? u.roles?.[0] ?? ''
  return { ...u, role: roleStr, roles: [roleStr] }
}

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      company: null,

      setAuth: (user, token) => set({ user: normalizeStoredUser(user), token }),
      setCompany: (company) => set({ company }),
      logout: () => set({ user: null, token: null, company: null }),

      isLoggedIn: () => !!get().token,
      hasRole: (roles) => {
        const user = get().user
        if (!user) return false
        const r = Array.isArray(roles) ? roles : [roles]
        const roleStr = user.role ?? user.roles?.[0] ?? ''
        return r.includes(roleStr)
      },
      hasPermission: (perm) => {
        const user = get().user
        if (!user) return false
        if ((user.role ?? user.roles?.[0]) === 'super_admin') return true
        return user.permissions?.includes(perm) || false
      },
    }),
    {
      name: 'outsourcehr-auth',
      partialize: (s) => ({ user: s.user, token: s.token, company: s.company }),
      // Normalisasi user saat dibaca dari localStorage (rehydrate)
      onRehydrateStorage: () => (state) => {
        if (state?.user) state.user = normalizeStoredUser(state.user)
      },
    }
  )
)
