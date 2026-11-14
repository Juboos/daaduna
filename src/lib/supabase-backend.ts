// Supabase implementation of the Backend interface (Auth, Postgres with RLS, Storage, Realtime).
// The app reads synchronously, so this keeps a cache of the signed-in user's data and writes through.
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type {
  Attempt, Backend, Feedback, LessonProgress, Notification, OutboxEmail, Profile, Run, Settings, Submission,
  SubmissionFiles, SubmissionStatus,
} from './backend'
import { DEFAULT_SETTINGS } from './backend'

type Row = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

const toProfile = (r: Row): Profile => ({ id: r.id, email: r.email, nameEn: r.name_en, nameAr: r.name_ar, nameArTr: r.name_ar_tr, role: r.role, createdAt: r.created_at })
const toSub = (r: Row): Submission => ({
  id: r.id, userId: r.user_id, runId: r.run_id, lessonId: r.lesson_id, exerciseId: r.exercise_id, kind: r.kind, title: r.title,
  status: r.status, createdAt: r.created_at, reviewedAt: r.reviewed_at ?? undefined, selfRating: r.self_rating ?? undefined,
  durationMs: r.duration_ms ?? undefined, mime: r.mime ?? undefined, target: r.target ?? undefined,
})
const toFb = (r: Row): Feedback => ({ id: r.id, submissionId: r.submission_id, reviewerId: r.reviewer_id ?? "", reviewerName: r.reviewer_name, note: r.note, annotations: r.annotations ?? {}, status: r.status, createdAt: r.created_at })
const toNote = (r: Row): Notification => ({ id: r.id, userId: r.user_id, kind: r.kind, refId: r.ref_id, text: r.text, createdAt: r.created_at, readAt: r.read_at ?? undefined })
const toProgress = (r: Row): LessonProgress => ({ lessonId: r.lesson_id, status: r.status, lastSlide: r.last_slide, completedAt: r.completed_at ?? undefined })

const FILE_NAMES: Record<keyof SubmissionFiles, string> = { audio: 'audio', strokes: 'strokes.json', png: 'sheet.png' }

export class SupabaseBackend implements Backend {
  private sb: SupabaseClient
  private profile: Profile | null = null
  private settings: Settings = DEFAULT_SETTINGS
  private run: Run | null = null
  private progress: LessonProgress[] = []
  private attempts: Attempt[] = []
  private subs: Submission[] = []
  private fb: Feedback[] = []
  private notes: Notification[] = []
  private mail: OutboxEmail[] = []
  private listeners = new Set<() => void>()
  private channel: ReturnType<SupabaseClient['channel']> | null = null

  constructor(url: string, key: string) {
    this.sb = createClient(url, key)
  }

  private emit() { this.listeners.forEach((f) => f()) }
  subscribe(fn: () => void) { this.listeners.add(fn); return () => { this.listeners.delete(fn) } }
  private fail(where: string, error: unknown) { if (error) console.error(`[supabase] ${where}`, error) }

  /** Restore the session (if any) and load the user's data before the app renders. */
  async init() {
    const { data } = await this.sb.auth.getSession()
    if (data.session) await this.load(data.session.user.id)
  }

  private async load(userId: string) {
    const { data: p, error } = await this.sb.from('profiles').select('*').eq('id', userId).single()
    if (error || !p) { this.fail('load profile', error); this.profile = null; return }
    this.profile = toProfile(p)
    const staff = this.profile.role !== 'student'
    const [settings, runs] = await Promise.all([
      this.sb.from('user_settings').select('data').eq('user_id', userId).maybeSingle(),
      this.sb.from('path_runs').select('*').eq('user_id', userId).is('ended_at', null).order('started_at').limit(1),
    ])
    this.settings = { ...DEFAULT_SETTINGS, ...(settings.data?.data ?? {}) }
    this.run = runs.data?.[0] ? { id: runs.data[0].id, startedAt: runs.data[0].started_at, endedAt: null } : await this.newRun(userId)
    const prog = await this.sb.from('lesson_progress').select('*').eq('run_id', this.run.id)
    this.progress = (prog.data ?? []).map(toProgress)
    this.attempts = []
    await this.loadWork(staff)
    this.listen()
  }

  private async loadWork(staff: boolean) {
    const uid = this.profile!.id
    const subsQ = this.sb.from('submissions').select('*').order('created_at')
    const [subs, fb, notes, mail] = await Promise.all([
      staff ? subsQ : subsQ.eq('user_id', uid),
      this.sb.from('feedback').select('*').order('created_at'),
      this.sb.from('notifications').select('*').eq('user_id', uid).order('created_at', { ascending: false }).limit(100),
      staff ? this.sb.from('email_outbox').select('*').order('created_at', { ascending: false }).limit(100) : Promise.resolve({ data: [] }),
    ])
    this.subs = (subs.data ?? []).map(toSub)
    this.fb = (fb.data ?? []).map(toFb)
    this.notes = (notes.data ?? []).map(toNote)
    this.mail = ((mail.data ?? []) as Row[]).map((r) => ({ id: r.id, to: r.to_email, subject: r.subject, body: r.body, createdAt: r.created_at }))
  }

  /** Realtime: new submissions, feedback and notifications refresh the queue and the bell. */
  private listen() {
    this.channel?.unsubscribe()
    const refresh = async () => { if (this.profile) { await this.loadWork(this.profile.role !== 'student'); this.emit() } }
    this.channel = this.sb.channel(`user-${this.profile!.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${this.profile!.id}` }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'submissions' }, refresh)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'feedback' }, refresh)
      .subscribe()
  }

  private async newRun(userId: string): Promise<Run> {
    const { data, error } = await this.sb.from('path_runs').insert({ user_id: userId }).select().single()
    this.fail('new run', error)
    return { id: data?.id, startedAt: data?.started_at, endedAt: null }
  }

  // ───── Auth ─────
  async signUp(email: string, password: string, nameEn: string) {
    const { data, error } = await this.sb.auth.signUp({ email: email.trim().toLowerCase(), password, options: { data: { name_en: nameEn.trim() } } })
    if (error) throw new Error(error.message)
    if (!data.session) throw new Error('Check your email and click the confirmation link, then sign in.')
    await this.load(data.user!.id)
    if (!this.profile) throw new Error('Account created, but the profile could not be loaded. Has the database script been run?')
    this.emit()
    return this.profile
  }
  async signIn(email: string, password: string) {
    const { data, error } = await this.sb.auth.signInWithPassword({ email: email.trim().toLowerCase(), password })
    if (error) throw new Error(error.message === 'Invalid login credentials' ? 'Email or password is not right.' : error.message)
    await this.load(data.user.id)
    if (!this.profile) throw new Error('Signed in, but the profile could not be loaded.')
    this.emit()
    return this.profile
  }
  async signOut() {
    this.channel?.unsubscribe()
    await this.sb.auth.signOut()
    this.profile = null; this.run = null; this.progress = []; this.subs = []; this.fb = []; this.notes = []; this.mail = []
    this.emit()
  }
  async requestPasswordReset(email: string) {
    const { error } = await this.sb.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo: `${window.location.origin}/reset-password` })
    if (error) throw new Error(error.message)
  }
  async updatePassword(password: string) {
    if (password.length < 8) throw new Error('Use at least 8 characters for the password.')
    const { error } = await this.sb.auth.updateUser({ password })
    if (error) throw new Error(error.message)
  }
  currentUser() { return this.profile }
  async listProfiles() {
    const { data, error } = await this.sb.from('profiles').select('*').order('created_at')
    this.fail('list profiles', error)
    return (data ?? []).map(toProfile)
  }
  async setArabicName(userId: string, nameAr: string, nameArTr: string) {
    const { error } = await this.sb.from('profiles').update({ name_ar: nameAr || null, name_ar_tr: nameArTr || null }).eq('id', userId)
    if (error) throw new Error(error.message)
    if (this.profile?.id === userId) this.profile = { ...this.profile, nameAr: nameAr || null, nameArTr: nameArTr || null }
  }

  // ───── Settings and progress ─────
  getSettings() { return this.settings }
  saveSettings(userId: string, s: Settings) {
    this.settings = s
    this.sb.from('user_settings').upsert({ user_id: userId, data: s }).then(({ error }) => this.fail('save settings', error))
  }
  getProgress() { return this.progress }
  saveProgress(userId: string, p: LessonProgress) {
    if (!this.run) return
    const i = this.progress.findIndex((x) => x.lessonId === p.lessonId)
    let next = p
    if (i >= 0 && this.progress[i].status === 'completed' && p.status !== 'completed') next = { ...p, status: 'completed', completedAt: this.progress[i].completedAt }
    if (i >= 0) this.progress = this.progress.map((x, k) => (k === i ? next : x))
    else this.progress = [...this.progress, next]
    this.sb.from('lesson_progress').upsert({
      run_id: this.run.id, user_id: userId, lesson_id: next.lessonId, status: next.status, last_slide: next.lastSlide, completed_at: next.completedAt ?? null,
    }).then(({ error }) => this.fail('save progress', error))
  }
  resetProgress(userId: string) {
    const old = this.run
    this.progress = []
    this.attempts = []
    void (async () => {
      if (old) await this.sb.from('path_runs').update({ ended_at: new Date().toISOString() }).eq('id', old.id)
      this.run = await this.newRun(userId)
      this.emit()
    })()
  }
  logAttempt(userId: string, a: Omit<Attempt, 'at'>) {
    this.attempts.push({ ...a, at: new Date().toISOString() })
    if (!this.run) return
    this.sb.from('exercise_attempts').insert({
      user_id: userId, run_id: this.run.id, lesson_id: a.lessonId, exercise_id: a.exerciseId, type: a.type, correct: a.correct, response: a.response ?? null,
    }).then(({ error }) => this.fail('log attempt', error))
  }
  getAttempts() { return this.attempts }

  // ───── Submissions and review ─────
  async createSubmission(userId: string, input: Omit<Submission, 'id' | 'userId' | 'runId' | 'status' | 'createdAt'>, files: SubmissionFiles) {
    const id = crypto.randomUUID()
    for (const [kind, body] of Object.entries(files) as [keyof SubmissionFiles, Blob | string | undefined][]) {
      if (!body) continue
      const blob = typeof body === 'string' ? new Blob([body], { type: 'application/json' }) : body
      const { error } = await this.sb.storage.from('submissions').upload(`${userId}/${id}/${FILE_NAMES[kind]}`, blob, { contentType: blob.type || undefined })
      if (error) throw new Error(`Upload failed: ${error.message}`)
    }
    const { data, error } = await this.sb.from('submissions').insert({
      id, user_id: userId, run_id: this.run?.id ?? null, lesson_id: input.lessonId, exercise_id: input.exerciseId, kind: input.kind,
      title: input.title, self_rating: input.selfRating ?? null, duration_ms: input.durationMs ?? null, mime: input.mime ?? null, target: input.target ?? null,
    }).select().single()
    if (error) throw new Error(error.message)
    const sub = toSub(data)
    this.subs = [...this.subs, sub]
    this.emit()
    return sub
  }
  listSubmissions(filter: { userId?: string; status?: SubmissionStatus } = {}) {
    return this.subs.filter((s) => (!filter.userId || s.userId === filter.userId) && (!filter.status || s.status === filter.status))
  }
  getSubmission(id: string) { return this.subs.find((s) => s.id === id) }
  async getSubmissionFile(id: string, kind: keyof SubmissionFiles) {
    const sub = this.getSubmission(id)
    if (!sub) return undefined
    const { data, error } = await this.sb.storage.from('submissions').download(`${sub.userId}/${id}/${FILE_NAMES[kind]}`)
    if (error || !data) return undefined
    return kind === 'strokes' ? await data.text() : data
  }
  async addFeedback(reviewerId: string, submissionId: string, f: Pick<Feedback, 'note' | 'annotations' | 'status'>) {
    const { data, error } = await this.sb.from('feedback').insert({
      submission_id: submissionId, reviewer_id: reviewerId, reviewer_name: this.profile?.nameEn ?? '', note: f.note, annotations: f.annotations, status: f.status,
    }).select().single()
    if (error) throw new Error(error.message)
    const fb = toFb(data)
    this.fb = [...this.fb, fb]
    this.subs = this.subs.map((s) => (s.id === submissionId ? { ...s, status: f.status, reviewedAt: fb.createdAt } : s))
    this.emit()
    return fb
  }
  getFeedback(submissionId: string) { return this.fb.filter((f) => f.submissionId === submissionId) }
  notifications() { return this.notes }
  markRead(userId: string, ids?: string[]) {
    const now = new Date().toISOString()
    const target = this.notes.filter((n) => !n.readAt && (!ids || ids.includes(n.id))).map((n) => n.id)
    if (!target.length) return
    this.notes = this.notes.map((n) => (target.includes(n.id) ? { ...n, readAt: now } : n))
    this.emit()
    this.sb.from('notifications').update({ read_at: now }).in('id', target).eq('user_id', userId).then(({ error }) => this.fail('mark read', error))
  }
  outbox() { return this.mail }
}
