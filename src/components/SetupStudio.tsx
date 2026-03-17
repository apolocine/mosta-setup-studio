// Author: Dr Hamid MADANI drmdh@msn.com
'use client'

import { useState, useEffect, useCallback, Fragment } from 'react'
import {
  Settings, Shield, Database, Eye, Download, Plus, Trash2, Copy, Check,
  GripVertical, ChevronDown, ChevronUp, Upload, FileJson, Package, Loader2,
  ArrowRight, ExternalLink, CheckCircle2, XCircle, AlertTriangle,
} from 'lucide-react'

// ── Types matching setup.schema.json ─────────────────────

interface Category {
  name: string; label: string; description: string; icon: string; order: number; system: boolean
}
interface Permission {
  code: string; name: string; description: string; category: string
}
interface Role {
  name: string; description: string; system: boolean; permissions: string[]
}
interface SeedItem {
  key: string; label: string; description: string; icon: string
  default: boolean; collection: string; match: string; hashField: string
  roleField: string; defaults: Record<string, unknown>; data: Record<string, unknown>[]
}
interface ModuleItem {
  key: string; packageName: string; label: string; description: string
  icon: string; required: boolean; dependsOn: string[]
}
interface SetupJson {
  $schema: string
  app: { name: string; port: number; dbNamePrefix: string }
  env: Record<string, string>
  modules: ModuleItem[]
  rbac: { categories: Category[]; permissions: Permission[]; roles: Role[] }
  seeds: SeedItem[]
}

// ── Defaults ─────────────────────────────────────────────

const EMPTY_SETUP: SetupJson = {
  $schema: 'https://mostajs.dev/schemas/setup.v1.json',
  app: { name: '', port: 3000, dbNamePrefix: '' },
  env: {},
  modules: [],
  rbac: { categories: [], permissions: [], roles: [] },
  seeds: [],
}

const LUCIDE_ICONS = [
  'Settings', 'Users', 'Activity', 'KeyRound', 'Ticket', 'ScanLine',
  'Lock', 'CreditCard', 'LayoutDashboard', 'FileText', 'Shield',
  'Package', 'Database', 'Wrench', 'Star', 'Heart', 'Zap', 'Globe',
]

const TABS = [
  { key: 'app', label: 'App', icon: Settings },
  { key: 'modules', label: 'Modules', icon: Package },
  { key: 'rbac', label: 'RBAC', icon: Shield },
  { key: 'seeds', label: 'Seeds', icon: Database },
  { key: 'preview', label: 'Preview', icon: Eye },
  { key: 'export', label: 'Export', icon: Download },
] as const
type Tab = typeof TABS[number]['key']

// ── Known @mostajs modules ───────────────────────────────

interface ModuleDef {
  key: string
  packageName: string
  label: string
  description: string
  icon: string
  required?: boolean
  default?: boolean
  dependsOn?: string[]
  standalone?: boolean
}

const KNOWN_MODULES: ModuleDef[] = [
  { key: 'orm', packageName: '@mostajs/orm', label: 'ORM', description: 'Couche d\'acces aux donnees multi-dialecte (13 SGBD)', icon: '🗄️', required: true, default: true },
  { key: 'auth', packageName: '@mostajs/auth', label: 'Authentification', description: 'NextAuth, sessions, gestion des mots de passe', icon: '🔐', required: true, default: true, dependsOn: ['orm'] },
  { key: 'audit', packageName: '@mostajs/audit', label: 'Audit & Logs', description: 'Journalisation des actions, tracabilite', icon: '📋', default: true, dependsOn: ['orm'] },
  { key: 'rbac', packageName: '@mostajs/rbac', label: 'Roles & Permissions', description: 'Gestion RBAC : roles, permissions, matrice', icon: '🛡️', default: true, dependsOn: ['auth', 'audit'] },
  { key: 'settings', packageName: '@mostajs/settings', label: 'Parametres', description: 'Parametres cle-valeur, formulaire auto', icon: '⚙️', default: true, dependsOn: ['orm'] },
  { key: 'setup', packageName: '@mostajs/setup', label: 'Setup Wizard', description: 'Assistant d\'installation, test DB, seeds', icon: '🧙', required: true, default: true, dependsOn: ['orm'] },
  { key: 'face', packageName: '@mostajs/face', label: 'Reconnaissance faciale', description: 'Detection visage, matching 1:N', icon: '👤', standalone: true },
  { key: 'init', packageName: '@mostajs/init', label: 'Init & Bootstrap', description: 'Chargement automatique des modules au demarrage', icon: '🚀', dependsOn: ['orm'] },
  { key: 'ui', packageName: '@mostajs/ui', label: 'Composants UI', description: 'Composants React reutilisables', icon: '🎨' },
  { key: 'menu', packageName: '@mostajs/menu', label: 'Menu dynamique', description: 'Sidebar et navigation modulaire', icon: '📑', dependsOn: ['orm'] },
  { key: 'ticketing', packageName: '@mostajs/ticketing', label: 'Ticketing', description: 'Gestion des tickets et entrees', icon: '🎫', dependsOn: ['orm'] },
  { key: 'media', packageName: '@mostajs/media', label: 'Media', description: 'Upload et gestion des fichiers', icon: '📷', dependsOn: ['orm'] },
  { key: 'scan', packageName: '@mostajs/scan', label: 'Scan QR/RFID', description: 'Lecture QR codes et cartes RFID', icon: '📱', dependsOn: ['orm'] },
]

function resolveModuleDeps(selected: string[]): string[] {
  const resolved = new Set(selected)
  let changed = true
  while (changed) {
    changed = false
    for (const key of resolved) {
      const mod = KNOWN_MODULES.find(m => m.key === key)
      if (mod?.dependsOn) {
        for (const dep of mod.dependsOn) {
          if (!resolved.has(dep)) { resolved.add(dep); changed = true }
        }
      }
    }
  }
  for (const mod of KNOWN_MODULES) {
    if (mod.required) resolved.add(mod.key)
  }
  return Array.from(resolved)
}

const STORAGE_KEY = 'mosta-setup-studio'

const EXAMPLE_SETUP: SetupJson = {
  $schema: 'https://mostajs.dev/schemas/setup.v1.json',
  app: { name: 'SecuAccessPro', port: 4567, dbNamePrefix: 'secuaccessdb' },
  env: {},
  modules: [
    { key: 'orm', packageName: '@mostajs/orm', label: 'ORM', description: 'Acces aux donnees multi-dialecte', icon: '🗄️', required: true, dependsOn: [] },
    { key: 'auth', packageName: '@mostajs/auth', label: 'Authentification', description: 'NextAuth, sessions', icon: '🔐', required: true, dependsOn: ['orm'] },
    { key: 'audit', packageName: '@mostajs/audit', label: 'Audit & Logs', description: 'Journalisation des actions', icon: '📋', required: false, dependsOn: ['orm'] },
    { key: 'rbac', packageName: '@mostajs/rbac', label: 'Roles & Permissions', description: 'Gestion RBAC, matrice', icon: '🛡️', required: false, dependsOn: ['auth', 'audit'] },
    { key: 'settings', packageName: '@mostajs/settings', label: 'Parametres', description: 'Cle-valeur, formulaire auto', icon: '⚙️', required: false, dependsOn: ['orm'] },
    { key: 'setup', packageName: '@mostajs/setup', label: 'Setup Wizard', description: 'Installation, test DB, seeds', icon: '🧙', required: true, dependsOn: ['orm'] },
  ],
  rbac: {
    categories: [
      { name: 'admin', label: 'Administration', description: 'Gestion du panneau d\'administration', icon: 'Settings', order: 0, system: true },
      { name: 'client', label: 'Clients', description: 'Gestion des clients', icon: 'Users', order: 1, system: true },
      { name: 'activity', label: 'Activites', description: 'Gestion des activites', icon: 'Activity', order: 2, system: true },
      { name: 'ticket', label: 'Tickets', description: 'Gestion des tickets', icon: 'Ticket', order: 3, system: true },
      { name: 'scan', label: 'Scan', description: 'Validation des entrees', icon: 'ScanLine', order: 4, system: true },
      { name: 'dashboard', label: 'Tableau de bord', description: 'Statistiques', icon: 'LayoutDashboard', order: 5, system: true },
    ],
    permissions: [
      { code: 'admin:access', name: 'admin:access', description: 'Acceder au panneau admin', category: 'admin' },
      { code: 'admin:settings', name: 'admin:settings', description: 'Gerer les parametres', category: 'admin' },
      { code: 'client:view', name: 'client:view', description: 'Voir les clients', category: 'client' },
      { code: 'client:create', name: 'client:create', description: 'Creer un client', category: 'client' },
      { code: 'client:update', name: 'client:update', description: 'Modifier un client', category: 'client' },
      { code: 'client:delete', name: 'client:delete', description: 'Supprimer un client', category: 'client' },
      { code: 'activity:view', name: 'activity:view', description: 'Voir les activites', category: 'activity' },
      { code: 'activity:create', name: 'activity:create', description: 'Creer une activite', category: 'activity' },
      { code: 'ticket:create', name: 'ticket:create', description: 'Creer un ticket', category: 'ticket' },
      { code: 'ticket:view', name: 'ticket:view', description: 'Voir les tickets', category: 'ticket' },
      { code: 'scan:validate', name: 'scan:validate', description: 'Valider un scan', category: 'scan' },
      { code: 'dashboard:view', name: 'dashboard:view', description: 'Voir le tableau de bord', category: 'dashboard' },
    ],
    roles: [
      { name: 'admin', description: 'Administrateur complet', system: true, permissions: ['*'] },
      { name: 'agent_accueil', description: 'Agent d\'accueil', system: true, permissions: ['client:view', 'client:create', 'client:update', 'activity:view', 'ticket:create', 'ticket:view', 'scan:validate', 'dashboard:view'] },
      { name: 'superviseur', description: 'Superviseur lecture seule', system: true, permissions: ['client:view', 'activity:view', 'ticket:view', 'dashboard:view'] },
    ],
  },
  seeds: [
    {
      key: 'activities', label: 'Activites', description: '4 activites de demonstration', icon: 'Activity',
      default: true, collection: 'activity', match: 'slug', hashField: '', roleField: '',
      defaults: { currency: 'DA', status: 'active' },
      data: [
        { name: 'Piscine', slug: 'piscine', color: '#0EA5E9', capacity: 100, price: 800 },
        { name: 'Tennis', slug: 'tennis', color: '#22C55E', capacity: 16, price: 1000 },
        { name: 'Football', slug: 'football', color: '#16A34A', capacity: 30, price: 500 },
        { name: 'Restaurant', slug: 'restaurant', color: '#D97706', capacity: 80, price: 0 },
      ],
    },
    {
      key: 'demoUsers', label: 'Utilisateurs demo', description: '2 agents de test', icon: 'Users',
      default: false, collection: 'user', match: 'email', hashField: 'password', roleField: 'role',
      defaults: { status: 'active' },
      data: [
        { email: 'accueil@app.dz', password: 'Agent@123456', firstName: 'Karim', lastName: 'Bensalem', role: 'agent_accueil' },
        { email: 'superviseur@app.dz', password: 'Super@123456', firstName: 'Nadia', lastName: 'Hamidi', role: 'superviseur' },
      ],
    },
  ],
}

// ── Main Component ───────────────────────────────────────

export default function SetupStudio() {
  const [tab, setTab] = useState<Tab>('app')
  const [setup, setSetup] = useState<SetupJson>(EMPTY_SETUP)
  const [copied, setCopied] = useState(false)

  // Load from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) setSetup(JSON.parse(saved))
    } catch { /* ignore */ }
  }, [])

  // Save to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(setup))
    } catch { /* ignore */ }
  }, [setup])

  const updateApp = useCallback((patch: Partial<SetupJson['app']>) => {
    setSetup(s => ({ ...s, app: { ...s.app, ...patch } }))
  }, [])

  const updateRbac = useCallback((patch: Partial<SetupJson['rbac']>) => {
    setSetup(s => ({ ...s, rbac: { ...s.rbac, ...patch } }))
  }, [])

  const generateJson = useCallback(() => {
    const out: Record<string, unknown> = { $schema: setup.$schema }
    // App — only non-empty fields
    const app: Record<string, unknown> = { name: setup.app.name }
    if (setup.app.port && setup.app.port !== 3000) app.port = setup.app.port
    if (setup.app.dbNamePrefix) app.dbNamePrefix = setup.app.dbNamePrefix
    out.app = app
    // Env — merge MOSTAJS_MODULES from modules list
    const envOut = { ...setup.env }
    if (setup.modules.length > 0) {
      envOut.MOSTAJS_MODULES = setup.modules.map(m => m.key).join(',')
    } else {
      delete envOut.MOSTAJS_MODULES
    }
    if (Object.keys(envOut).length > 0) out.env = envOut
    // Modules
    if (setup.modules.length > 0) {
      out.modules = setup.modules.map(m => {
        const o: Record<string, unknown> = { key: m.key, packageName: m.packageName }
        if (m.label && m.label !== m.key) o.label = m.label
        if (m.description) o.description = m.description
        if (m.icon && m.icon !== '📦') o.icon = m.icon
        if (m.required) o.required = true
        if (m.dependsOn?.length) o.dependsOn = m.dependsOn
        return o
      })
    }
    // RBAC
    if (setup.rbac.categories.length || setup.rbac.permissions.length || setup.rbac.roles.length) {
      const rbac: Record<string, unknown> = {}
      if (setup.rbac.categories.length) rbac.categories = setup.rbac.categories.map(c => {
        const o: Record<string, unknown> = { name: c.name, label: c.label }
        if (c.description) o.description = c.description
        if (c.icon) o.icon = c.icon
        if (c.order !== undefined) o.order = c.order
        return o
      })
      if (setup.rbac.permissions.length) rbac.permissions = setup.rbac.permissions.map(p => {
        const o: Record<string, unknown> = { code: p.code, description: p.description, category: p.category }
        if (p.name && p.name !== p.code) o.name = p.name
        return o
      })
      if (setup.rbac.roles.length) rbac.roles = setup.rbac.roles.map(r => ({
        name: r.name, description: r.description, permissions: r.permissions,
      }))
      out.rbac = rbac
    }
    // Seeds
    if (setup.seeds.length) {
      out.seeds = setup.seeds.map(s => {
        const o: Record<string, unknown> = {
          key: s.key, label: s.label, collection: s.collection, data: s.data,
        }
        if (s.description) o.description = s.description
        if (s.icon) o.icon = s.icon
        if (s.default) o.default = true
        if (s.match) o.match = s.match
        if (s.hashField) o.hashField = s.hashField
        if (s.roleField) o.roleField = s.roleField
        if (Object.keys(s.defaults).length) o.defaults = s.defaults
        return o
      })
    }
    return JSON.stringify(out, null, 2)
  }, [setup])

  const copyJson = useCallback(() => {
    navigator.clipboard.writeText(generateJson())
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [generateJson])

  const downloadJson = useCallback(() => {
    const blob = new Blob([generateJson()], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'setup.json'
    a.click()
    URL.revokeObjectURL(url)
  }, [generateJson])

  const importJson = useCallback(() => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      const text = await file.text()
      try {
        const parsed = JSON.parse(text)
        setSetup({
          ...EMPTY_SETUP,
          ...parsed,
          app: { ...EMPTY_SETUP.app, ...(parsed.app ?? {}) },
          modules: parsed.modules ?? EMPTY_SETUP.modules,
          rbac: { ...EMPTY_SETUP.rbac, ...(parsed.rbac ?? {}) },
        })
      } catch { alert('JSON invalide') }
    }
    input.click()
  }, [])

  const loadExample = useCallback(() => {
    if (setup.app.name && !confirm('Remplacer par l\'exemple SecuAccessPro ?')) return
    setSetup(EXAMPLE_SETUP)
  }, [setup.app.name])

  const resetAll = useCallback(() => {
    if (confirm('Reinitialiser tout ?')) {
      setSetup(EMPTY_SETUP)
      localStorage.removeItem(STORAGE_KEY)
    }
  }, [])

  // ── Validation warnings ────────────────────────────────
  const warnings: string[] = []
  if (!setup.app.name) warnings.push('App: nom requis')
  const catNames = new Set(setup.rbac.categories.map(c => c.name))
  const permCodes = new Set(setup.rbac.permissions.map(p => p.code))
  for (const p of setup.rbac.permissions) {
    if (p.category && catNames.size > 0 && !catNames.has(p.category)) {
      warnings.push(`Permission "${p.code}" → categorie "${p.category}" inexistante`)
    }
  }
  for (const r of setup.rbac.roles) {
    for (const code of r.permissions) {
      if (code !== '*' && permCodes.size > 0 && !permCodes.has(code)) {
        warnings.push(`Role "${r.name}" → permission "${code}" inexistante`)
      }
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileJson className="h-7 w-7 text-sky-600" />
          <div>
            <h1 className="text-xl font-bold text-gray-900">MostaSetup Studio</h1>
            <p className="text-xs text-gray-500">Editeur visuel pour setup.json</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={loadExample} className="flex items-center gap-1 px-3 py-1.5 text-sm bg-sky-50 border border-sky-200 text-sky-700 rounded-lg hover:bg-sky-100">
            <Database className="h-4 w-4" /> Exemple
          </button>
          <button onClick={importJson} className="flex items-center gap-1 px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50">
            <Upload className="h-4 w-4" /> Importer
          </button>
          <button onClick={resetAll} className="flex items-center gap-1 px-3 py-1.5 text-sm border border-red-200 text-red-600 rounded-lg hover:bg-red-50">
            <Trash2 className="h-4 w-4" /> Reset
          </button>
        </div>
      </header>

      <div className="flex flex-1">
        {/* Sidebar tabs */}
        <nav className="w-48 bg-white border-r p-3 space-y-1">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                tab === t.key ? 'bg-sky-50 text-sky-700' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <t.icon className="h-4 w-4" />
              {t.label}
            </button>
          ))}
          {warnings.length > 0 && (
            <div className="mt-4 p-2 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-xs font-semibold text-amber-700 mb-1">{warnings.length} avertissement{warnings.length > 1 ? 's' : ''}</p>
              {warnings.slice(0, 3).map((w, i) => (
                <p key={i} className="text-xs text-amber-600 truncate">{w}</p>
              ))}
            </div>
          )}
        </nav>

        {/* Main content */}
        <main className="flex-1 p-6 overflow-y-auto">
          {tab === 'app' && <AppTab app={setup.app} env={setup.env} onAppChange={updateApp} onEnvChange={env => setSetup(s => ({ ...s, env }))} />}
          {tab === 'modules' && <ModulesTab modules={setup.modules} env={setup.env}
            onModulesChange={modules => setSetup(s => ({ ...s, modules }))} />}
          {tab === 'rbac' && <RbacTab rbac={setup.rbac} onChange={updateRbac} />}
          {tab === 'seeds' && <SeedsTab seeds={setup.seeds} categories={setup.rbac.categories} onChange={seeds => setSetup(s => ({ ...s, seeds }))} />}
          {tab === 'preview' && <PreviewTab json={generateJson()} warnings={warnings} />}
          {tab === 'export' && <ExportTab json={generateJson()} onCopy={copyJson} onDownload={downloadJson} copied={copied} />}
        </main>
      </div>
    </div>
  )
}

// ── Tab: Modules ─────────────────────────────────────────

function ModulesTab({ modules, env, onModulesChange }: {
  modules: ModuleItem[]; env: Record<string, string>
  onModulesChange: (modules: ModuleItem[]) => void
}) {
  const [npmStatus, setNpmStatus] = useState<Record<string, 'loading' | 'found' | 'not_found' | 'error'>>({})
  const [customKey, setCustomKey] = useState('')
  const [customPkg, setCustomPkg] = useState('')

  const toggleModule = useCallback((key: string) => {
    const mod = modules.find(m => m.key === key)
    if (mod?.required) return
    if (mod) {
      // Remove — also remove dependents
      const toRemove = new Set([key])
      let changed = true
      while (changed) {
        changed = false
        for (const m of modules) {
          if (toRemove.has(m.key) || m.required) continue
          if (m.dependsOn?.some(d => toRemove.has(d))) { toRemove.add(m.key); changed = true }
        }
      }
      onModulesChange(modules.filter(m => !toRemove.has(m.key)))
    } else {
      // Add from KNOWN
      const known = KNOWN_MODULES.find(m => m.key === key)
      if (!known) return
      const newMod: ModuleItem = { key: known.key, packageName: known.packageName, label: known.label, description: known.description, icon: known.icon, required: !!known.required, dependsOn: known.dependsOn ?? [] }
      let result = [...modules, newMod]
      // Auto-add dependencies
      for (const dep of known.dependsOn ?? []) {
        if (!result.find(m => m.key === dep)) {
          const depMod = KNOWN_MODULES.find(m => m.key === dep)
          if (depMod) result.push({ key: depMod.key, packageName: depMod.packageName, label: depMod.label, description: depMod.description, icon: depMod.icon, required: !!depMod.required, dependsOn: depMod.dependsOn ?? [] })
        }
      }
      onModulesChange(result)
    }
  }, [modules, onModulesChange])

  const addCustom = useCallback(() => {
    const key = customKey.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '')
    const pkg = customPkg.trim() || `@mostajs/${key}`
    if (!key || modules.find(m => m.key === key)) return
    onModulesChange([...modules, { key, packageName: pkg, label: key, description: `Module ${key}`, icon: '📦', required: false, dependsOn: [] }])
    setCustomKey(''); setCustomPkg('')
  }, [customKey, customPkg, modules, onModulesChange])

  const removeModule = useCallback((key: string) => {
    const mod = modules.find(m => m.key === key)
    if (mod?.required) return
    onModulesChange(modules.filter(m => m.key !== key))
  }, [modules, onModulesChange])

  const checkNpm = useCallback(async (packageName: string, key: string) => {
    setNpmStatus(s => ({ ...s, [key]: 'loading' }))
    try {
      const res = await fetch(`https://registry.npmjs.org/${encodeURIComponent(packageName)}`, { mode: 'cors' })
      setNpmStatus(s => ({ ...s, [key]: res.ok ? 'found' : 'not_found' }))
    } catch {
      setNpmStatus(s => ({ ...s, [key]: 'error' }))
    }
  }, [])

  const checkAllNpm = useCallback(() => {
    modules.forEach(m => checkNpm(m.packageName, m.key))
  }, [modules, checkNpm])

  const selectedKeys = new Set(modules.map(m => m.key))

  return (
    <div className="space-y-6">
      <SectionTitle title="Modules" subtitle="Modules @mostajs a utiliser dans le projet (exportes dans setup.json)" />

      {/* Active modules summary */}
      <div className="flex items-center gap-3 p-3 bg-sky-50 border border-sky-200 rounded-lg">
        <Package className="h-5 w-5 text-sky-600" />
        <div className="flex-1">
          <p className="text-sm font-medium text-sky-800">{modules.length} module{modules.length !== 1 ? 's' : ''} selectionne{modules.length !== 1 ? 's' : ''}</p>
          <code className="text-xs text-sky-600">{modules.map(m => m.key).join(', ') || '(aucun)'}</code>
        </div>
        <button onClick={checkAllNpm} className="flex items-center gap-1 px-2 py-1 text-xs bg-white border border-sky-300 rounded-lg text-sky-700 hover:bg-sky-100">
          <ExternalLink className="h-3 w-3" /> Verifier npm
        </button>
      </div>

      {/* Catalogue @mostajs */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Catalogue @mostajs</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {KNOWN_MODULES.map(mod => {
            const selected = selectedKeys.has(mod.key)
            const status = npmStatus[mod.key]
            return (
              <div key={mod.key} onClick={() => toggleModule(mod.key)}
                className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                  selected ? 'border-sky-500 bg-sky-50 hover:shadow-md' :
                  'border-gray-200 hover:border-gray-300 hover:shadow-sm'
                }`}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{mod.icon}</span>
                    <span className="font-semibold text-sm text-gray-900">{mod.label}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {mod.required && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">requis</span>}
                    {mod.standalone && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-green-100 text-green-700">standalone</span>}
                    {status === 'loading' && <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-400" />}
                    {status === 'found' && <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />}
                    {status === 'not_found' && <XCircle className="h-3.5 w-3.5 text-red-400" />}
                    {status === 'error' && <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />}
                    <input type="checkbox" checked={selected} disabled={selected && mod.required} readOnly
                      className="rounded border-gray-300 text-sky-600 cursor-pointer" />
                  </div>
                </div>
                <p className="text-xs text-gray-500">{mod.description}</p>
                <div className="flex items-center gap-2 mt-2">
                  <code className="text-[10px] text-gray-400 font-mono">{mod.packageName}</code>
                  {mod.dependsOn?.length ? (
                    <span className="text-[10px] text-gray-400">depend de : {mod.dependsOn.join(', ')}</span>
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Modules selectionnes — liste editable */}
      {modules.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Modules du projet ({modules.length})</h3>
          <div className="space-y-2">
            {modules.map(mod => {
              const status = npmStatus[mod.key]
              return (
                <div key={mod.key} className="flex items-center gap-3 p-3 bg-white border rounded-lg">
                  <span className="text-lg">{mod.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">{mod.label}</span>
                      {mod.required && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">requis</span>}
                    </div>
                    <code className="text-[10px] text-gray-400 font-mono">{mod.packageName}</code>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {status === 'loading' && <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-400" />}
                    {status === 'found' && <span className="text-[10px] text-green-600 font-medium">npm OK</span>}
                    {status === 'not_found' && <span className="text-[10px] text-amber-600">local</span>}
                    <button onClick={(e) => { e.stopPropagation(); checkNpm(mod.packageName, mod.key) }}
                      className="text-[10px] text-sky-500 hover:text-sky-700 underline">verifier</button>
                    {!mod.required && (
                      <button onClick={() => removeModule(mod.key)}
                        className="p-1 text-red-400 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Ajouter un module personnalise */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Ajouter un module personnalise / tiers</h3>
        <div className="flex items-center gap-2">
          <input value={customKey} onChange={e => setCustomKey(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addCustom()}
            placeholder="cle (ex: notifications)" className="input-field w-36 font-mono text-xs" />
          <input value={customPkg} onChange={e => setCustomPkg(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addCustom()}
            placeholder="package (ex: @mostajs/notifications)" className="input-field flex-1 font-mono text-xs" />
          <button onClick={addCustom} disabled={!customKey.trim()}
            className="btn-sm bg-purple-600 text-white disabled:opacity-50">
            <Plus className="h-4 w-4" />
          </button>
        </div>
        <p className="text-[10px] text-gray-400 mt-1">
          Modules dans <code className="bg-gray-100 px-1 rounded">modules/</code> (local) ou via <code className="bg-gray-100 px-1 rounded">npm install</code>
        </p>
      </div>

      {/* Commande npm install */}
      {modules.length > 0 && (
        <div className="p-4 bg-gray-900 rounded-lg">
          <p className="text-xs text-gray-400 mb-2">Commande d'installation :</p>
          <code className="text-sm text-green-400 font-mono break-all">
            npm install {modules.map(m => m.packageName).join(' ')}
          </code>
        </div>
      )}
    </div>
  )
}

// ── Tab: App ─────────────────────────────────────────────

function AppTab({ app, env, onAppChange, onEnvChange }: {
  app: SetupJson['app']; env: Record<string, string>
  onAppChange: (p: Partial<SetupJson['app']>) => void
  onEnvChange: (env: Record<string, string>) => void
}) {
  const [newEnvKey, setNewEnvKey] = useState('')
  const [newEnvVal, setNewEnvVal] = useState('')

  return (
    <div className="max-w-xl space-y-6">
      <SectionTitle title="Application" subtitle="Informations generales affichees dans le wizard" />
      <Field label="Nom de l'application" required>
        <input value={app.name} onChange={e => onAppChange({ name: e.target.value })}
          placeholder="MonApp" className="input-field" />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Port HTTP">
          <input type="number" value={app.port} onChange={e => onAppChange({ port: parseInt(e.target.value) || 3000 })}
            className="input-field" />
        </Field>
        <Field label="Prefix DB">
          <input value={app.dbNamePrefix} onChange={e => onAppChange({ dbNamePrefix: e.target.value })}
            placeholder="myappdb" className="input-field" />
        </Field>
      </div>

      <SectionTitle title="Variables d'environnement" subtitle="Ajoutees a .env.local lors de l'installation" />
      <div className="space-y-2">
        {Object.entries(env).map(([k, v]) => (
          <div key={k} className="flex items-center gap-2">
            <code className="text-xs bg-gray-100 px-2 py-1 rounded font-mono min-w-[140px]">{k}</code>
            <input value={v} onChange={e => onEnvChange({ ...env, [k]: e.target.value })}
              className="input-field flex-1" />
            <button onClick={() => { const n = { ...env }; delete n[k]; onEnvChange(n) }}
              className="p-1 text-red-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
          </div>
        ))}
        <div className="flex items-center gap-2">
          <input value={newEnvKey} onChange={e => setNewEnvKey(e.target.value.toUpperCase())}
            placeholder="CLE" className="input-field w-36 font-mono text-xs" />
          <input value={newEnvVal} onChange={e => setNewEnvVal(e.target.value)}
            placeholder="valeur" className="input-field flex-1" />
          <button onClick={() => {
            if (newEnvKey.trim()) {
              onEnvChange({ ...env, [newEnvKey.trim()]: newEnvVal })
              setNewEnvKey(''); setNewEnvVal('')
            }
          }} className="btn-sm bg-sky-600 text-white"><Plus className="h-4 w-4" /></button>
        </div>
      </div>
    </div>
  )
}

// ── Tab: RBAC ────────────────────────────────────────────

function RbacTab({ rbac, onChange }: { rbac: SetupJson['rbac']; onChange: (p: Partial<SetupJson['rbac']>) => void }) {
  const [subTab, setSubTab] = useState<'categories' | 'permissions' | 'roles' | 'matrix'>('categories')

  return (
    <div className="space-y-4">
      <SectionTitle title="RBAC" subtitle="Categories, permissions et roles seeds a l'installation" />
      <div className="flex gap-2 border-b pb-2">
        {(['categories', 'permissions', 'roles', 'matrix'] as const).map(s => (
          <button key={s} onClick={() => setSubTab(s)}
            className={`px-3 py-1.5 text-sm rounded-t-lg ${subTab === s ? 'bg-sky-50 text-sky-700 border-b-2 border-sky-600' : 'text-gray-500 hover:text-gray-700'}`}>
            {s === 'categories' ? `Categories (${rbac.categories.length})` :
             s === 'permissions' ? `Permissions (${rbac.permissions.length})` :
             s === 'roles' ? `Roles (${rbac.roles.length})` :
             'Matrice'}
          </button>
        ))}
      </div>

      {subTab === 'categories' && (
        <CategoriesEditor categories={rbac.categories} onChange={cats => onChange({ categories: cats })} />
      )}
      {subTab === 'permissions' && (
        <PermissionsEditor permissions={rbac.permissions} categories={rbac.categories}
          onChange={perms => onChange({ permissions: perms })} />
      )}
      {subTab === 'roles' && (
        <RolesEditor roles={rbac.roles} permissions={rbac.permissions}
          onChange={roles => onChange({ roles })} />
      )}
      {subTab === 'matrix' && (
        <PermissionMatrix roles={rbac.roles} permissions={rbac.permissions} categories={rbac.categories}
          onChange={roles => onChange({ roles })} />
      )}
    </div>
  )
}

// ── Permission Matrix (roles x permissions) ──────────────

function PermissionMatrix({ roles, permissions, categories, onChange }: {
  roles: Role[]; permissions: Permission[]; categories: Category[]; onChange: (r: Role[]) => void
}) {
  // Group permissions by category
  const grouped: { cat: string; catLabel: string; perms: Permission[] }[] = []
  const catMap = new Map(categories.map(c => [c.name, c.label]))
  const seen = new Set<string>()
  for (const cat of categories) {
    const perms = permissions.filter(p => p.category === cat.name)
    if (perms.length > 0) {
      grouped.push({ cat: cat.name, catLabel: cat.label, perms })
      perms.forEach(p => seen.add(p.code))
    }
  }
  // Uncategorized
  const uncategorized = permissions.filter(p => !seen.has(p.code))
  if (uncategorized.length > 0) {
    grouped.push({ cat: '_other', catLabel: 'Autres', perms: uncategorized })
  }

  const toggleCell = (roleIdx: number, permCode: string) => {
    const role = roles[roleIdx]
    if (role.permissions.includes('*')) return // don't toggle individual if wildcard
    const has = role.permissions.includes(permCode)
    const updated = [...roles]
    updated[roleIdx] = {
      ...role,
      permissions: has ? role.permissions.filter(c => c !== permCode) : [...role.permissions, permCode],
    }
    onChange(updated)
  }

  const toggleAllForRole = (roleIdx: number) => {
    const role = roles[roleIdx]
    const allCodes = permissions.map(p => p.code)
    const hasAll = role.permissions.includes('*') || allCodes.every(c => role.permissions.includes(c))
    const updated = [...roles]
    updated[roleIdx] = { ...role, permissions: hasAll ? [] : ['*'] }
    onChange(updated)
  }

  const toggleCategoryForRole = (roleIdx: number, catPerms: Permission[]) => {
    const role = roles[roleIdx]
    if (role.permissions.includes('*')) return
    const codes = catPerms.map(p => p.code)
    const allChecked = codes.every(c => role.permissions.includes(c))
    const updated = [...roles]
    if (allChecked) {
      updated[roleIdx] = { ...role, permissions: role.permissions.filter(c => !codes.includes(c)) }
    } else {
      const newPerms = new Set([...role.permissions, ...codes])
      updated[roleIdx] = { ...role, permissions: [...newPerms] }
    }
    onChange(updated)
  }

  if (roles.length === 0 || permissions.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        <p>Ajoutez des roles et permissions pour voir la matrice</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto border rounded-lg bg-white">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-gray-50 border-b">
            <th className="sticky left-0 bg-gray-50 z-10 px-3 py-2 text-left min-w-[220px] text-gray-600">Permission</th>
            {roles.map((role, ri) => (
              <th key={ri} className="px-2 py-2 text-center min-w-[100px]">
                <div className="font-semibold text-gray-700">{role.name}</div>
                <button onClick={() => toggleAllForRole(ri)}
                  className={`mt-1 text-[10px] px-1.5 py-0.5 rounded ${role.permissions.includes('*') ? 'bg-sky-100 text-sky-700' : 'bg-gray-100 text-gray-500 hover:bg-sky-50'}`}>
                  {role.permissions.includes('*') ? 'Toutes *' : 'Tout cocher'}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {grouped.map(({ cat, catLabel, perms }) => (
            <Fragment key={cat}>
              {/* Category header */}
              <tr className="bg-gray-100/70">
                <td className="sticky left-0 bg-gray-100/70 z-10 px-3 py-1.5 font-semibold text-gray-600 text-xs uppercase tracking-wide">
                  {catLabel}
                </td>
                {roles.map((role, ri) => {
                  const codes = perms.map(p => p.code)
                  const isWildcard = role.permissions.includes('*')
                  const allChecked = isWildcard || codes.every(c => role.permissions.includes(c))
                  const someChecked = !allChecked && codes.some(c => role.permissions.includes(c))
                  return (
                    <td key={ri} className="px-2 py-1.5 text-center">
                      <button onClick={() => !isWildcard && toggleCategoryForRole(ri, perms)}
                        disabled={isWildcard}
                        className={`w-4 h-4 rounded border inline-flex items-center justify-center text-[10px] ${
                          allChecked ? 'bg-sky-500 border-sky-500 text-white' :
                          someChecked ? 'bg-sky-200 border-sky-300 text-sky-700' :
                          'bg-white border-gray-300'
                        } ${isWildcard ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-sky-400'}`}>
                        {allChecked ? '✓' : someChecked ? '−' : ''}
                      </button>
                    </td>
                  )
                })}
              </tr>
              {/* Permission rows */}
              {perms.map(perm => (
                <tr key={perm.code} className="border-t border-gray-100 hover:bg-sky-50/30">
                  <td className="sticky left-0 bg-white z-10 px-3 py-1.5">
                    <div className="flex items-center gap-2">
                      <code className="font-mono text-sky-700">{perm.code}</code>
                      {perm.description && <span className="text-gray-400 truncate max-w-[180px]">{perm.description}</span>}
                    </div>
                  </td>
                  {roles.map((role, ri) => {
                    const isWildcard = role.permissions.includes('*')
                    const checked = isWildcard || role.permissions.includes(perm.code)
                    return (
                      <td key={ri} className="px-2 py-1.5 text-center">
                        <input type="checkbox" checked={checked} disabled={isWildcard}
                          onChange={() => toggleCell(ri, perm.code)}
                          className={`rounded border-gray-300 text-sky-600 focus:ring-sky-500 ${isWildcard ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`} />
                      </td>
                    )
                  })}
                </tr>
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
      {/* Legend */}
      <div className="flex items-center gap-4 px-3 py-2 border-t bg-gray-50 text-[10px] text-gray-500">
        <span>{roles.length} roles</span>
        <span>{permissions.length} permissions</span>
        <span>{categories.length} categories</span>
      </div>
    </div>
  )
}

function CategoriesEditor({ categories, onChange }: { categories: Category[]; onChange: (c: Category[]) => void }) {
  const add = () => onChange([...categories, { name: '', label: '', description: '', icon: 'Settings', order: categories.length, system: true }])
  const update = (i: number, patch: Partial<Category>) => {
    const c = [...categories]; c[i] = { ...c[i], ...patch }; onChange(c)
  }
  const remove = (i: number) => onChange(categories.filter((_, j) => j !== i))

  return (
    <div className="space-y-3">
      {categories.map((cat, i) => (
        <div key={i} className="flex items-start gap-2 p-3 bg-white border rounded-lg">
          <div className="grid grid-cols-4 gap-2 flex-1">
            <input value={cat.name} onChange={e => update(i, { name: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })}
              placeholder="nom_cle" className="input-field font-mono text-xs" />
            <input value={cat.label} onChange={e => update(i, { label: e.target.value })}
              placeholder="Label" className="input-field" />
            <input value={cat.description} onChange={e => update(i, { description: e.target.value })}
              placeholder="Description" className="input-field" />
            <select value={cat.icon} onChange={e => update(i, { icon: e.target.value })}
              className="input-field text-xs">
              {LUCIDE_ICONS.map(ic => <option key={ic} value={ic}>{ic}</option>)}
            </select>
          </div>
          <button onClick={() => remove(i)} className="p-1 text-red-400 hover:text-red-600 mt-1">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}
      <button onClick={add} className="btn-sm border border-dashed border-gray-300 text-gray-500 hover:border-sky-400 hover:text-sky-600 w-full">
        <Plus className="h-4 w-4 mr-1" /> Ajouter une categorie
      </button>
    </div>
  )
}

function PermissionsEditor({ permissions, categories, onChange }: {
  permissions: Permission[]; categories: Category[]; onChange: (p: Permission[]) => void
}) {
  const add = () => onChange([...permissions, { code: '', name: '', description: '', category: categories[0]?.name ?? '' }])
  const update = (i: number, patch: Partial<Permission>) => {
    const p = [...permissions]; p[i] = { ...p[i], ...patch }; onChange(p)
  }
  const remove = (i: number) => onChange(permissions.filter((_, j) => j !== i))

  // Group by category
  const grouped: Record<string, { perm: Permission; idx: number }[]> = {}
  permissions.forEach((p, idx) => {
    const cat = p.category || '_uncategorized'
    if (!grouped[cat]) grouped[cat] = []
    grouped[cat].push({ perm: p, idx })
  })

  return (
    <div className="space-y-4">
      {Object.entries(grouped).map(([catName, items]) => {
        const catLabel = categories.find(c => c.name === catName)?.label ?? catName
        return (
          <div key={catName}>
            <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">{catLabel}</h4>
            <div className="space-y-2">
              {items.map(({ perm, idx }) => (
                <div key={idx} className="flex items-center gap-2 p-2 bg-white border rounded-lg">
                  <input value={perm.code} onChange={e => update(idx, { code: e.target.value.toLowerCase().replace(/[^a-z0-9_:]/g, '') })}
                    placeholder="module:action" className="input-field font-mono text-xs w-40" />
                  <input value={perm.description} onChange={e => update(idx, { description: e.target.value })}
                    placeholder="Description" className="input-field flex-1" />
                  <select value={perm.category} onChange={e => update(idx, { category: e.target.value })}
                    className="input-field text-xs w-32">
                    {categories.map(c => <option key={c.name} value={c.name}>{c.label}</option>)}
                  </select>
                  <button onClick={() => remove(idx)} className="p-1 text-red-400 hover:text-red-600">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )
      })}
      <button onClick={add} className="btn-sm border border-dashed border-gray-300 text-gray-500 hover:border-sky-400 hover:text-sky-600 w-full">
        <Plus className="h-4 w-4 mr-1" /> Ajouter une permission
      </button>
    </div>
  )
}

function RolesEditor({ roles, permissions, onChange }: {
  roles: Role[]; permissions: Permission[]; onChange: (r: Role[]) => void
}) {
  const [expanded, setExpanded] = useState<number | null>(null)
  const add = () => onChange([...roles, { name: '', description: '', system: true, permissions: [] }])
  const update = (i: number, patch: Partial<Role>) => {
    const r = [...roles]; r[i] = { ...r[i], ...patch }; onChange(r)
  }
  const remove = (i: number) => onChange(roles.filter((_, j) => j !== i))
  const togglePerm = (roleIdx: number, code: string) => {
    const r = roles[roleIdx]
    const has = r.permissions.includes(code)
    update(roleIdx, { permissions: has ? r.permissions.filter(c => c !== code) : [...r.permissions, code] })
  }
  const toggleAll = (roleIdx: number) => {
    const r = roles[roleIdx]
    if (r.permissions.includes('*')) {
      update(roleIdx, { permissions: [] })
    } else {
      update(roleIdx, { permissions: ['*'] })
    }
  }

  // Group permissions by category
  const groupedPerms: Record<string, Permission[]> = {}
  permissions.forEach(p => {
    if (!groupedPerms[p.category]) groupedPerms[p.category] = []
    groupedPerms[p.category].push(p)
  })

  return (
    <div className="space-y-3">
      {roles.map((role, i) => (
        <div key={i} className="bg-white border rounded-lg">
          <div className="flex items-center gap-2 p-3 cursor-pointer" onClick={() => setExpanded(expanded === i ? null : i)}>
            {expanded === i ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
            <input value={role.name} onClick={e => e.stopPropagation()}
              onChange={e => update(i, { name: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })}
              placeholder="nom_role" className="input-field font-mono text-xs w-36" />
            <input value={role.description} onClick={e => e.stopPropagation()}
              onChange={e => update(i, { description: e.target.value })}
              placeholder="Description" className="input-field flex-1" />
            <span className="text-xs text-gray-400">
              {role.permissions.includes('*') ? 'Toutes' : `${role.permissions.length} perms`}
            </span>
            <button onClick={(e) => { e.stopPropagation(); remove(i) }}
              className="p-1 text-red-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
          </div>
          {expanded === i && (
            <div className="px-3 pb-3 border-t">
              <div className="flex items-center gap-2 py-2">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={role.permissions.includes('*')}
                    onChange={() => toggleAll(i)} className="rounded" />
                  <span className="font-semibold">Toutes les permissions (*)</span>
                </label>
              </div>
              {!role.permissions.includes('*') && (
                <div className="grid grid-cols-1 gap-3 mt-2">
                  {Object.entries(groupedPerms).map(([cat, perms]) => (
                    <div key={cat}>
                      <p className="text-xs font-semibold text-gray-500 uppercase mb-1">{cat}</p>
                      <div className="flex flex-wrap gap-2">
                        {perms.map(p => (
                          <label key={p.code} className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full border cursor-pointer transition-colors ${
                            role.permissions.includes(p.code) ? 'bg-sky-50 border-sky-300 text-sky-700' : 'bg-gray-50 border-gray-200 text-gray-500'
                          }`}>
                            <input type="checkbox" checked={role.permissions.includes(p.code)}
                              onChange={() => togglePerm(i, p.code)} className="sr-only" />
                            {p.code}
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      ))}
      <button onClick={add} className="btn-sm border border-dashed border-gray-300 text-gray-500 hover:border-sky-400 hover:text-sky-600 w-full">
        <Plus className="h-4 w-4 mr-1" /> Ajouter un role
      </button>
    </div>
  )
}

// ── Tab: Seeds ───────────────────────────────────────────

function SeedsTab({ seeds, categories, onChange }: {
  seeds: SeedItem[]; categories: Category[]; onChange: (s: SeedItem[]) => void
}) {
  const [expanded, setExpanded] = useState<number | null>(null)

  const add = () => onChange([...seeds, {
    key: '', label: '', description: '', icon: 'Database', default: false,
    collection: '', match: '', hashField: '', roleField: '',
    defaults: {}, data: [{}],
  }])
  const update = (i: number, patch: Partial<SeedItem>) => {
    const s = [...seeds]; s[i] = { ...s[i], ...patch }; onChange(s)
  }
  const remove = (i: number) => onChange(seeds.filter((_, j) => j !== i))

  const addDataRow = (seedIdx: number) => {
    const s = seeds[seedIdx]
    const template = s.data.length > 0
      ? Object.fromEntries(Object.keys(s.data[0]).map(k => [k, '']))
      : {}
    update(seedIdx, { data: [...s.data, template] })
  }
  const removeDataRow = (seedIdx: number, rowIdx: number) => {
    update(seedIdx, { data: seeds[seedIdx].data.filter((_, j) => j !== rowIdx) })
  }
  const updateDataCell = (seedIdx: number, rowIdx: number, key: string, value: string) => {
    const data = [...seeds[seedIdx].data]
    data[rowIdx] = { ...data[rowIdx], [key]: tryParseValue(value) }
    update(seedIdx, { data })
  }
  const addDataColumn = (seedIdx: number) => {
    const colName = prompt('Nom du champ:')
    if (!colName) return
    update(seedIdx, { data: seeds[seedIdx].data.map(row => ({ ...row, [colName]: '' })) })
  }
  const removeDataColumn = (seedIdx: number, col: string) => {
    update(seedIdx, { data: seeds[seedIdx].data.map(row => {
      const { [col]: _, ...rest } = row; return rest
    }) })
  }

  return (
    <div className="space-y-4">
      <SectionTitle title="Seeds" subtitle="Donnees optionnelles proposees a l'installation (checkboxes dans le wizard)" />

      {seeds.map((seed, i) => (
        <div key={i} className="bg-white border rounded-lg">
          <div className="flex items-center gap-2 p-3 cursor-pointer" onClick={() => setExpanded(expanded === i ? null : i)}>
            {expanded === i ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
            <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">{seed.key || '...'}</span>
            <span className="text-sm font-medium">{seed.label || 'Nouveau seed'}</span>
            <span className="text-xs text-gray-400 ml-auto">{seed.data.length} lignes / {seed.collection || '?'}</span>
            <button onClick={e => { e.stopPropagation(); remove(i) }}
              className="p-1 text-red-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
          </div>
          {expanded === i && (
            <div className="px-3 pb-3 border-t space-y-3">
              {/* Metadata */}
              <div className="grid grid-cols-3 gap-2 pt-3">
                <Field label="Key"><input value={seed.key} onChange={e => update(i, { key: e.target.value })} className="input-field font-mono text-xs" /></Field>
                <Field label="Label"><input value={seed.label} onChange={e => update(i, { label: e.target.value })} className="input-field" /></Field>
                <Field label="Collection"><input value={seed.collection} onChange={e => update(i, { collection: e.target.value })} className="input-field font-mono text-xs" /></Field>
              </div>
              <div className="grid grid-cols-4 gap-2">
                <Field label="Match (upsert)"><input value={seed.match} onChange={e => update(i, { match: e.target.value })} placeholder="slug" className="input-field font-mono text-xs" /></Field>
                <Field label="Hash field"><input value={seed.hashField} onChange={e => update(i, { hashField: e.target.value })} placeholder="password" className="input-field font-mono text-xs" /></Field>
                <Field label="Role field"><input value={seed.roleField} onChange={e => update(i, { roleField: e.target.value })} placeholder="role" className="input-field font-mono text-xs" /></Field>
                <Field label="Default">
                  <label className="flex items-center gap-2 mt-2">
                    <input type="checkbox" checked={seed.default} onChange={e => update(i, { default: e.target.checked })} className="rounded" />
                    <span className="text-xs">Coche par defaut</span>
                  </label>
                </Field>
              </div>
              <Field label="Description"><input value={seed.description} onChange={e => update(i, { description: e.target.value })} className="input-field" /></Field>

              {/* Data table */}
              <div className="mt-3">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold text-gray-700">Donnees ({seed.data.length} lignes)</h4>
                  <div className="flex gap-1">
                    <button onClick={() => addDataColumn(i)} className="btn-sm text-xs border"><Plus className="h-3 w-3 mr-1" />Colonne</button>
                    <button onClick={() => addDataRow(i)} className="btn-sm text-xs bg-sky-600 text-white"><Plus className="h-3 w-3 mr-1" />Ligne</button>
                  </div>
                </div>
                {seed.data.length > 0 && (
                  <div className="overflow-x-auto border rounded-lg">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-gray-50">
                          {Object.keys(seed.data[0]).map(col => (
                            <th key={col} className="px-2 py-1.5 text-left font-mono text-gray-500">
                              <div className="flex items-center gap-1">
                                {col}
                                <button onClick={() => removeDataColumn(i, col)}
                                  className="text-red-300 hover:text-red-500"><Trash2 className="h-3 w-3" /></button>
                              </div>
                            </th>
                          ))}
                          <th className="w-8"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {seed.data.map((row, ri) => (
                          <tr key={ri} className="border-t hover:bg-gray-50">
                            {Object.keys(seed.data[0]).map(col => (
                              <td key={col} className="px-1 py-0.5">
                                <input value={stringifyValue(row[col])}
                                  onChange={e => updateDataCell(i, ri, col, e.target.value)}
                                  className="w-full px-1 py-0.5 text-xs border-0 bg-transparent focus:ring-1 focus:ring-sky-300 rounded" />
                              </td>
                            ))}
                            <td className="px-1">
                              <button onClick={() => removeDataRow(i, ri)}
                                className="text-red-300 hover:text-red-500"><Trash2 className="h-3 w-3" /></button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      ))}
      <button onClick={add} className="btn-sm border border-dashed border-gray-300 text-gray-500 hover:border-sky-400 hover:text-sky-600 w-full">
        <Plus className="h-4 w-4 mr-1" /> Ajouter un seed
      </button>
    </div>
  )
}

// ── Tab: Preview ─────────────────────────────────────────

function PreviewTab({ json, warnings }: { json: string; warnings: string[] }) {
  return (
    <div className="space-y-4">
      <SectionTitle title="Preview" subtitle="Apercu du setup.json genere" />
      {warnings.length > 0 && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-sm font-semibold text-amber-700 mb-1">Avertissements</p>
          {warnings.map((w, i) => <p key={i} className="text-xs text-amber-600">- {w}</p>)}
        </div>
      )}
      <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto text-sm font-mono leading-relaxed max-h-[70vh] overflow-y-auto">
        {json}
      </pre>
    </div>
  )
}

// ── Tab: Export ───────────────────────────────────────────

function ExportTab({ json, onCopy, onDownload, copied }: {
  json: string; onCopy: () => void; onDownload: () => void; copied: boolean
}) {
  const lines = json.split('\n').length
  const bytes = new Blob([json]).size

  return (
    <div className="max-w-xl space-y-6">
      <SectionTitle title="Export" subtitle="Telecharger ou copier le setup.json" />
      <div className="p-4 bg-white border rounded-lg space-y-4">
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>{lines} lignes, {bytes} octets</span>
          <span className="font-mono text-xs">setup.json</span>
        </div>
        <div className="flex gap-3">
          <button onClick={onDownload} className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-sky-600 text-white rounded-lg hover:bg-sky-700 font-medium">
            <Download className="h-5 w-5" /> Telecharger setup.json
          </button>
          <button onClick={onCopy} className="flex-1 flex items-center justify-center gap-2 px-4 py-3 border-2 border-sky-600 text-sky-600 rounded-lg hover:bg-sky-50 font-medium">
            {copied ? <Check className="h-5 w-5" /> : <Copy className="h-5 w-5" />}
            {copied ? 'Copie !' : 'Copier JSON'}
          </button>
        </div>
      </div>

      <div className="p-4 bg-gray-50 border rounded-lg">
        <h3 className="font-semibold text-gray-700 mb-2">Integration dans votre projet</h3>
        <ol className="text-sm text-gray-600 space-y-2 list-decimal list-inside">
          <li>Placer <code className="bg-gray-200 px-1 rounded">setup.json</code> a la racine du projet</li>
          <li>Dans la route install :
            <pre className="mt-1 bg-gray-900 text-green-400 p-2 rounded text-xs overflow-x-auto">{`import { loadSetupJson } from '@mostajs/setup'
const config = await loadSetupJson('./setup.json', repoFactory)`}</pre>
          </li>
          <li>Le wizard lira automatiquement les categories, permissions, roles et seeds</li>
        </ol>
      </div>
    </div>
  )
}

// ── Shared UI ────────────────────────────────────────────

function SectionTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-lg font-bold text-gray-900">{title}</h2>
      <p className="text-sm text-gray-500">{subtitle}</p>
    </div>
  )
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-gray-600">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}

function tryParseValue(v: string): unknown {
  if (v === 'true') return true
  if (v === 'false') return false
  if (v === 'null') return null
  if (/^-?\d+$/.test(v)) return parseInt(v)
  if (/^-?\d+\.\d+$/.test(v)) return parseFloat(v)
  return v
}

function stringifyValue(v: unknown): string {
  if (v === null || v === undefined) return 'null'
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}
