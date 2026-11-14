import { getFile, putFile } from './blobstore'
import { SupabaseBackend } from './supabase-backend'

// Backend interface. Phase 1 uses LocalBackend (this browser only).
// SupabaseBackend implements the same interface once the project exists (PLAN.md §1.2).

export type Role = 'student' | 'tutor' | 'admin'
export type Profile = { id: string; email: string; nameEn: string; nameAr: string | null; nameArTr: string | null; role: Role; createdAt: string }
export type Settings = {
  narration: boolean; fontScale: number; theme: 'system' | 'light' | 'dark'
  translit: 'auto' | 'on' | 'off'; showVowels: boolean; arFont: 'noto' | 'amiri'; slow: boolean; penOnly: boolean
}
export type Run = { id: string; startedAt: string; endedAt: string | null }
export type LessonProgress = { lessonId: string; status: 'in_progress' | 'completed'; lastSlide: number; completedAt?: string }

export type Attempt = { lessonId: string; exerciseId: string; type: string; correct: boolean | null; response: unknown; at: string }

export type SubmissionKind = 'sheet' | 'recording'
export type SubmissionStatus = 'pending' | 'reviewed' | 'needs_redo'
export type Submission = {
  id: string; userId: string; runId: string; lessonId: string; exerciseId: string; kind: SubmissionKind; title: string
  status: SubmissionStatus; createdAt: string; reviewedAt?: string; selfRating?: string; durationMs?: number; mime?: string
  /** For recordings: the Arabic text the student was shadowing. */
  target?: string
}
/** Reviewer marks: ink + text pins in sheet coordinates, or time markers on a recording. */
export type Annotations = {
  ink?: [number, number][][]
  pins?: { x: number; y: number; text: string }[]
  markers?: { tMs: number; text: string }[]
}
export type Feedback = { id: string; submissionId: string; reviewerId: string; reviewerName: string; note: string; annotations: Annotations; status: Exclude<SubmissionStatus, 'pending'>; createdAt: string }
export type Notification = { id: string; userId: string; kind: 'submission' | 'feedback'; refId: string; text: string; createdAt: string; readAt?: string }
export type OutboxEmail = { id: string; to: string; subject: string; body: string; createdAt: string }
export type SubmissionFiles = { audio?: Blob; strokes?: string; png?: Blob }

export const DEFAULT_SETTINGS: Settings = {
  narration: false, fontScale: 1, theme: 'system', translit: 'auto', showVowels: true, arFont: 'noto', slow: false, penOnly: false,
}

export interface Backend {
  /** Load the signed-in user's data before the app renders (Supabase). */
  init?(): Promise<void>
  signUp(email: string, password: string, nameEn: string): Promise<Profile>
  signIn(email: string, password: string): Promise<Profile>
  signOut(): Promise<void>
  /** Email a password-reset link that opens /reset-password. */
  requestPasswordReset(email: string): Promise<void>
  /** Set a new password for the signed-in user (after following the reset link). */
  updatePassword(password: string): Promise<void>
  currentUser(): Profile | null
  listProfiles(): Promise<Profile[]>
  setArabicName(userId: string, nameAr: string, nameArTr: string): Promise<void>
  getSettings(userId: string): Settings
  saveSettings(userId: string, s: Settings): void
  getProgress(userId: string): LessonProgress[]
  saveProgress(userId: string, p: LessonProgress): void
  resetProgress(userId: string): void
  logAttempt(userId: string, a: Omit<Attempt, 'at'>): void
  getAttempts(userId: string): Attempt[]
  // Submissions and review (Phase 1c)
  createSubmission(userId: string, s: Omit<Submission, 'id' | 'userId' | 'runId' | 'status' | 'createdAt'>, files: SubmissionFiles): Promise<Submission>
  listSubmissions(filter?: { userId?: string; status?: SubmissionStatus }): Submission[]
  getSubmission(id: string): Submission | undefined
  getSubmissionFile(id: string, kind: keyof SubmissionFiles): Promise<Blob | string | undefined>
  addFeedback(reviewerId: string, submissionId: string, f: Pick<Feedback, 'note' | 'annotations' | 'status'>): Promise<Feedback>
  getFeedback(submissionId: string): Feedback[]
  notifications(userId: string): Notification[]
  markRead(userId: string, ids?: string[]): void
  outbox(): OutboxEmail[]
  /** Called whenever stored data changes (also from other tabs). Returns an unsubscribe function. */
  subscribe(fn: () => void): () => void
}

// ---------- LocalBackend ----------
type Db = {
  users: (Profile & { pwHash: string })[]
  session: string | null
  settings: Record<string, Settings>
  runs: Record<string, Run[]>
  progress: Record<string, LessonProgress[]> // keyed by run id
  attempts?: Record<string, Attempt[]> // keyed by run id
  submissions?: Submission[] // keyed by user, NOT by run: they survive a reset
  feedback?: Feedback[]
  notifications?: Notification[]
  outbox?: OutboxEmail[]
}

const KEY = 'daaduna.local.v1'
const uid = () => crypto.randomUUID()
const now = () => new Date().toISOString()

async function hash(pw: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('daaduna:' + pw))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function load(): Db {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* storage blocked */ }
  return { users: [], session: null, settings: {}, runs: {}, progress: {} }
}

class LocalBackend implements Backend {
  private db = load()
  private listeners = new Set<() => void>()
  constructor() {
    // Another tab (e.g. the reviewer's) changed data: reload and tell the UI.
    if (typeof window !== 'undefined') window.addEventListener('storage', (e) => { if (e.key === KEY) { this.db = load(); this.emit() } })
  }
  private emit() { this.listeners.forEach((f) => f()) }
  subscribe(fn: () => void) { this.listeners.add(fn); return () => { this.listeners.delete(fn) } }
  private save() { try { localStorage.setItem(KEY, JSON.stringify(this.db)) } catch { /* ignore */ } this.emit() }
  private notify(userId: string, n: Omit<Notification, 'id' | 'userId' | 'createdAt'>, email: { subject: string; body: string }) {
    ;(this.db.notifications ??= []).push({ id: uid(), userId, createdAt: now(), ...n })
    const to = this.db.users.find((u) => u.id === userId)?.email
    // Email goes to an outbox until Supabase + Resend are connected; the Edge Function will send these.
    if (to) (this.db.outbox ??= []).push({ id: uid(), to, createdAt: now(), ...email })
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private strip = ({ pwHash: _pw, ...p }: Profile & { pwHash: string }): Profile => p
  private activeRun(userId: string): Run {
    const runs = (this.db.runs[userId] ??= [])
    let run = runs.find((r) => !r.endedAt)
    if (!run) { run = { id: uid(), startedAt: now(), endedAt: null }; runs.push(run); this.save() }
    return run
  }

  async signUp(email: string, password: string, nameEn: string) {
    email = email.trim().toLowerCase()
    if (this.db.users.some((u) => u.email === email)) throw new Error('An account with this email already exists.')
    if (password.length < 8) throw new Error('Use at least 8 characters for the password.')
    // The first account on this device is the admin (you), everyone after is a student.
    const role: Role = this.db.users.length === 0 ? 'admin' : 'student'
    const user = { id: uid(), email, nameEn: nameEn.trim(), nameAr: null, nameArTr: null, role, createdAt: now(), pwHash: await hash(password) }
    this.db.users.push(user)
    this.db.session = user.id
    this.save()
    return this.strip(user)
  }
  async signIn(email: string, password: string) {
    const u = this.db.users.find((x) => x.email === email.trim().toLowerCase())
    if (!u || u.pwHash !== (await hash(password))) throw new Error('Email or password is not right.')
    this.db.session = u.id
    this.save()
    return this.strip(u)
  }
  async signOut() { this.db.session = null; this.save() }
  async requestPasswordReset() { throw new Error('Password reset needs the online version (Supabase).') }
  async updatePassword(password: string) {
    const u = this.db.users.find((x) => x.id === this.db.session)
    if (!u) throw new Error('Not signed in.')
    u.pwHash = await hash(password)
    this.save()
  }
  currentUser() {
    const u = this.db.users.find((x) => x.id === this.db.session)
    return u ? this.strip(u) : null
  }
  async listProfiles() { return this.db.users.map(this.strip) }
  async setArabicName(userId: string, nameAr: string, nameArTr: string) {
    const u = this.db.users.find((x) => x.id === userId)
    if (u) { u.nameAr = nameAr || null; u.nameArTr = nameArTr || null; this.save() }
  }
  getSettings(userId: string) { return { ...DEFAULT_SETTINGS, ...this.db.settings[userId] } }
  saveSettings(userId: string, s: Settings) { this.db.settings[userId] = s; this.save() }
  getProgress(userId: string) { return this.db.progress[this.activeRun(userId).id] ?? [] }
  saveProgress(userId: string, p: LessonProgress) {
    const run = this.activeRun(userId)
    const list = (this.db.progress[run.id] ??= [])
    const i = list.findIndex((x) => x.lessonId === p.lessonId)
    if (i >= 0) {
      if (list[i].status === 'completed' && p.status !== 'completed') list[i] = { ...p, status: 'completed', completedAt: list[i].completedAt }
      else list[i] = p
    } else list.push(p)
    this.save()
  }
  logAttempt(userId: string, a: Omit<Attempt, 'at'>) {
    const run = this.activeRun(userId)
    const all = (this.db.attempts ??= {})
    ;(all[run.id] ??= []).push({ ...a, at: now() })
    this.save()
  }
  getAttempts(userId: string) { return this.db.attempts?.[this.activeRun(userId).id] ?? [] }
  async createSubmission(userId: string, input: Omit<Submission, 'id' | 'userId' | 'runId' | 'status' | 'createdAt'>, files: SubmissionFiles) {
    const sub: Submission = { ...input, id: uid(), userId, runId: this.activeRun(userId).id, status: 'pending', createdAt: now() }
    if (files.audio) await putFile(`${sub.id}:audio`, files.audio)
    if (files.strokes) await putFile(`${sub.id}:strokes`, files.strokes)
    if (files.png) await putFile(`${sub.id}:png`, files.png)
    ;(this.db.submissions ??= []).push(sub)
    const student = this.db.users.find((u) => u.id === userId)
    for (const r of this.db.users.filter((u) => u.role !== 'student')) {
      this.notify(r.id, { kind: 'submission', refId: sub.id, text: `${student?.nameEn ?? 'A student'} sent ${sub.kind === 'sheet' ? 'a writing sheet' : 'a recording'}: ${sub.title}` }, {
        subject: `New ${sub.kind} to review from ${student?.nameEn}`,
        body: `${student?.nameEn} submitted "${sub.title}" (${sub.lessonId}). Open the review queue to give feedback.`,
      })
    }
    this.save()
    return sub
  }
  listSubmissions(filter: { userId?: string; status?: SubmissionStatus } = {}) {
    return (this.db.submissions ?? []).filter((s) => (!filter.userId || s.userId === filter.userId) && (!filter.status || s.status === filter.status))
  }
  getSubmission(id: string) { return this.db.submissions?.find((s) => s.id === id) }
  getSubmissionFile(id: string, kind: keyof SubmissionFiles) { return getFile(`${id}:${kind}`) }
  async addFeedback(reviewerId: string, submissionId: string, f: Pick<Feedback, 'note' | 'annotations' | 'status'>) {
    const sub = this.getSubmission(submissionId)
    if (!sub) throw new Error('Submission not found')
    const reviewer = this.db.users.find((u) => u.id === reviewerId)
    const fb: Feedback = { id: uid(), submissionId, reviewerId, reviewerName: reviewer?.nameEn ?? 'Your tutor', createdAt: now(), ...f }
    ;(this.db.feedback ??= []).push(fb)
    sub.status = f.status
    sub.reviewedAt = fb.createdAt
    const text = f.status === 'needs_redo' ? `Please try "${sub.title}" again. Your tutor left a note.` : `Your tutor reviewed "${sub.title}".`
    this.notify(sub.userId, { kind: 'feedback', refId: sub.id, text }, { subject: text, body: `${f.note || 'Open Daaduna to see the feedback on your work.'}` })
    this.save()
    return fb
  }
  getFeedback(submissionId: string) { return (this.db.feedback ?? []).filter((f) => f.submissionId === submissionId) }
  notifications(userId: string) { return (this.db.notifications ?? []).filter((n) => n.userId === userId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)) }
  markRead(userId: string, ids?: string[]) {
    for (const n of this.db.notifications ?? []) if (n.userId === userId && !n.readAt && (!ids || ids.includes(n.id))) n.readAt = now()
    this.save()
  }
  outbox() { return [...(this.db.outbox ?? [])].reverse() }
  /** Reset = close the run and open a new one. Submissions and feedback (Phase 1c) hang off the user, not the run. */
  resetProgress(userId: string) {
    const run = this.activeRun(userId)
    run.endedAt = now()
    this.save()
    this.activeRun(userId)
  }
}

// Supabase when keys are configured (.env.local), otherwise the browser-only preview backend.
const SB_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined
const SB_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
export const backendKind: 'supabase' | 'local' = SB_URL && SB_KEY ? 'supabase' : 'local'
export const backend: Backend = SB_URL && SB_KEY ? new SupabaseBackend(SB_URL, SB_KEY) : new LocalBackend()

// Dev only: lets test scripts drive the app's own backend instance instead of creating a second client.
if (import.meta.env.DEV && typeof window !== 'undefined') (window as unknown as { __daaduna: Backend }).__daaduna = backend
