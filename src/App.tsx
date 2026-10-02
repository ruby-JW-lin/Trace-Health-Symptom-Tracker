import { useEffect, useMemo, useRef, useState } from "react";

type Page = "Home" | "Timeline" | "Patterns" | "My Cases" | "Case Summaries";
type Profile = {
  id: string;
  name: string;
  relationship: string;
  initials: string;
  color: string;
  child?: boolean;
};
type Account = {
  name: string;
  email: string;
};
type PrivacyPreferences = {
  lockOnClose: boolean;
  stripPhotoMetadata: boolean;
  expiringShareLinks: boolean;
};
type Episode = {
  id: number;
  caseId?: string;
  date: string;
  title: string;
  place: string;
  severity: number;
  detail: string;
  tags: string[];
  treatment: string;
  attachment?: {
    name: string;
    url: string;
  };
};
type HealthCase = {
  id: string;
  profileId: string;
  title: string;
  started: string;
  updated: string;
  updatedOrder: number;
  entries: number;
  status: "Active" | "Improving" | "Resolved";
  concern: string;
  locations: string[];
  symptoms: string[];
  severity: string;
  treatments: string[];
  changes: string[];
  patterns: string[];
  cover?: "skin" | "stomach" | "arm";
};

type StoredAccount = Account & { password: string };
type Workspace = {
  profiles: Profile[];
  activeProfileId: string;
  cases: HealthCase[];
  episodes: Record<string, Episode[]>;
};

const privacyDefaults: PrivacyPreferences = { lockOnClose: true, stripPhotoMetadata: true, expiringShareLinks: true };

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch {
    return fallback;
  }
}

function readAccounts(): StoredAccount[] {
  const accounts = readJson<StoredAccount[]>("trace-accounts", []);
  if (accounts.length) return accounts;
  const legacy = readJson<Account | null>("trace-account", null);
  if (!legacy?.email || !legacy.name) return [];
  return [{ name: legacy.name, email: legacy.email.toLowerCase(), password: "" }];
}

function writeAccounts(accounts: StoredAccount[]) {
  localStorage.setItem("trace-accounts", JSON.stringify(accounts));
  const latest = accounts[accounts.length - 1];
  if (latest) localStorage.setItem("trace-account", JSON.stringify({ name: latest.name, email: latest.email }));
}

function privacyKey(email: string) {
  return `trace-privacy:${email}`;
}

function workspaceKey(email: string) {
  return `trace-workspace:${email}`;
}

function persistentKey(email: string) {
  return `trace-persistent-session:${email}`;
}

function onboardingKey(email: string) {
  return `trace-onboarding:${email}`;
}

function selfProfile(account: Account): Profile {
  const name = account.name.trim();
  return {
    id: "me",
    name,
    relationship: "Myself",
    initials: (name[0] || "M").toUpperCase(),
    color: "sage",
  };
}

function freshWorkspace(account: Account): Workspace {
  const profile = selfProfile(account);
  return { profiles: [profile], activeProfileId: profile.id, cases: [], episodes: { [profile.id]: [] } };
}

function loadWorkspace(account: Account): Workspace {
  const saved = readJson<Workspace | null>(workspaceKey(account.email), null);
  if (!saved?.profiles?.length) return freshWorkspace(account);
  const active = saved.profiles.find((profile) => profile.id === saved.activeProfileId) || saved.profiles[0];
  return { ...saved, activeProfileId: active.id, cases: saved.cases || [], episodes: saved.episodes || {} };
}

function loadPrivacy(email: string): PrivacyPreferences {
  return { ...privacyDefaults, ...readJson<Partial<PrivacyPreferences>>(privacyKey(email), {}) };
}

function sessionAccount(): Account | null {
  const accounts = readAccounts();
  const sessionActive = sessionStorage.getItem("trace-session") === "active";
  if (sessionActive) {
    const email = sessionStorage.getItem("trace-session-email") || readJson<Account | null>("trace-account", null)?.email?.toLowerCase();
    const match = accounts.find((account) => account.email === email);
    if (match) return { name: match.name, email: match.email };
  }
  const persistent = accounts.find((account) => localStorage.getItem(persistentKey(account.email)) === "active" && !loadPrivacy(account.email).lockOnClose);
  if (persistent) return { name: persistent.name, email: persistent.email };
  return null;
}

function startSession(account: Account, persistent: boolean) {
  sessionStorage.setItem("trace-session", "active");
  sessionStorage.setItem("trace-session-email", account.email);
  if (persistent) localStorage.setItem(persistentKey(account.email), "active");
  else localStorage.removeItem(persistentKey(account.email));
}

const navItems: Page[] = ["Home", "Timeline", "Patterns", "My Cases", "Case Summaries"];

function Icon({ name, size = 20 }: { name: string; size?: number }) {
  const paths: Record<string, React.ReactNode> = {
    home: <><path d="M3 10.8 12 3l9 7.8" /><path d="M5.5 9.3V21h13V9.3M9 21v-7h6v7" /></>,
    timeline: <><path d="M12 8v4l2.8 1.8" /><circle cx="12" cy="12" r="9" /><path d="M5.6 5.6 3.8 3.8M18.4 5.6l1.8-1.8" /></>,
    pattern: <><path d="M4 18V9M10 18V5M16 18v-7M22 18V3" /><path d="M2 18h22" /></>,
    history: <><path d="M6 3h12v18H6z" /><path d="M9 7h6M9 11h6M9 15h4" /></>,
    care: <><path d="M5 3h14v18H5z" /><path d="M9 3v3h6V3M9 11h6M9 15h4" /></>,
    plus: <path d="M12 5v14M5 12h14" />,
    chevron: <path d="m8 10 4 4 4-4" />,
    spark: <><path d="m12 3 1.4 4.6L18 9l-4.6 1.4L12 15l-1.4-4.6L6 9l4.6-1.4L12 3Z" /><path d="m19 15 .7 2.3L22 18l-2.3.7L19 21l-.7-2.3L16 18l2.3-.7L19 15Z" /></>,
    lock: <><rect x="5" y="10" width="14" height="11" rx="3" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
    arrow: <path d="m9 5 7 7-7 7" />,
    close: <><path d="m6 6 12 12M18 6 6 18" /></>,
    camera: <><path d="M4 8h3l1.5-2h7L17 8h3v11H4z" /><circle cx="12" cy="13" r="3" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    edit: <><path d="m4 20 4.5-1 10-10-3.5-3.5-10 10L4 20Z" /><path d="m13.5 6.5 3.5 3.5" /></>,
    menu: <><path d="M4 7h16M4 12h16M4 17h16" /></>,
    back: <path d="m15 5-7 7 7 7" />,
    user: <><circle cx="12" cy="8" r="4" /><path d="M4.5 21a7.5 7.5 0 0 1 15 0" /></>,
    info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7h.01" /></>,
    paperclip: <path d="m20.5 11.5-8.9 8.9a5 5 0 0 1-7.1-7.1l9.6-9.6a3.5 3.5 0 0 1 5 5l-9.6 9.6a2 2 0 0 1-2.8-2.8l8.9-8.9" />,
    trash: <><path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14" /><path d="M10 11v6M14 11v6" /></>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}

function Button({ children, variant = "primary", onClick, type = "button", className = "" }: {
  children: React.ReactNode; variant?: "primary" | "secondary" | "ghost" | "soft" | "log"; onClick?: () => void; type?: "button" | "submit"; className?: string;
}) {
  return <button type={type} onClick={onClick} className={`button button-${variant} ${className}`}>{children}</button>;
}

function ProfileBadge({ profile, small = false }: { profile: Profile; small?: boolean }) {
  return <span className={`avatar avatar-${profile.color} ${small ? "avatar-small" : ""}`}>{profile.initials}</span>;
}

function Severity({ value }: { value: number }) {
  return (
    <span className="severity">
      <span className="severity-dot" /> {value}/10
    </span>
  );
}

function EmptyPhoto() {
  return (
    <div className="episode-photo" aria-label="Episode photo placeholder">
      <span className="photo-shape photo-one" />
      <span className="photo-shape photo-two" />
      <span className="photo-mark" />
    </div>
  );
}

function EpisodeAttachment({ attachment }: { attachment: NonNullable<Episode["attachment"]> }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="episode-attachment" onClick={() => setOpen(true)}>
        <span className="attachment-icon"><Icon name="paperclip" size={17} /></span>
        <span><strong>Photo attachment</strong><small>{attachment.name}</small></span>
        <Icon name="arrow" size={16} />
      </button>
      {open && (
        <div className="modal-layer attachment-layer" role="dialog" aria-modal="true" aria-label={`Photo attachment ${attachment.name}`}>
          <button className="scrim" onClick={() => setOpen(false)} aria-label="Close attachment" />
          <div className="attachment-viewer">
            <div className="attachment-viewer-head"><span><Icon name="paperclip" size={17} />{attachment.name}</span><button onClick={() => setOpen(false)} aria-label="Close attachment"><Icon name="close" /></button></div>
            <img src={attachment.url} alt={attachment.name} />
          </div>
        </div>
      )}
    </>
  );
}

function CaseCover({ kind }: { kind?: HealthCase["cover"] }) {
  return (
    <div className={`case-cover case-cover-${kind || "default"}`}>
      <span /><span /><span />
    </div>
  );
}

function StatusPill({ status }: { status: HealthCase["status"] }) {
  return <span className={`status-pill status-${status.toLowerCase()}`}><i />{status}</span>;
}

function useSwipeRight(onSwipe: () => void) {
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const wheelDistance = useRef({ x: 0, y: 0 });
  const wheelReset = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gestureHandled = useRef(false);

  const resetWheel = () => {
    wheelDistance.current = { x: 0, y: 0 };
    gestureHandled.current = false;
  };

  return {
    onTouchStart: (event: React.TouchEvent) => {
      const touch = event.touches[0];
      touchStart.current = { x: touch.clientX, y: touch.clientY };
      gestureHandled.current = false;
    },
    onTouchEnd: (event: React.TouchEvent) => {
      if (!touchStart.current || gestureHandled.current) return;
      const touch = event.changedTouches[0];
      const distanceX = touch.clientX - touchStart.current.x;
      const distanceY = Math.abs(touch.clientY - touchStart.current.y);
      touchStart.current = null;
      if (distanceX > 72 && distanceX > distanceY * 1.25) {
        gestureHandled.current = true;
        onSwipe();
      }
    },
    onWheel: (event: React.WheelEvent) => {
      if (gestureHandled.current || Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return;
      wheelDistance.current.x += event.deltaX;
      wheelDistance.current.y += event.deltaY;
      if (wheelReset.current) clearTimeout(wheelReset.current);
      wheelReset.current = setTimeout(resetWheel, 180);
      if (wheelDistance.current.x < -80 && Math.abs(wheelDistance.current.x) > Math.abs(wheelDistance.current.y) * 1.25) {
        gestureHandled.current = true;
        onSwipe();
      }
    },
  };
}

function CaseCard({ healthCase, onOpen }: { healthCase: HealthCase; onOpen: () => void }) {
  return (
    <button className="case-card" onClick={onOpen}>
      {healthCase.cover && <CaseCover kind={healthCase.cover} />}
      <div className="case-card-body">
        <div className="case-card-top"><StatusPill status={healthCase.status} /><span className="case-arrow"><Icon name="arrow" size={18} /></span></div>
        <h3>{healthCase.title}</h3>
        <p>{healthCase.concern}</p>
        <div className="case-meta">
          <span><small>STARTED</small><strong>{healthCase.started}</strong></span>
          <span><small>MOST RECENT</small><strong>{healthCase.updated}</strong></span>
          <span><small>ENTRIES</small><strong>{healthCase.entries} recorded</strong></span>
        </div>
      </div>
    </button>
  );
}

function AppHeader({ active, account, onProfile, onAccount, onLog, onMenu }: { active: Profile; account: Account; onProfile: () => void; onAccount: () => void; onLog: () => void; onMenu: () => void }) {
  const accountInitials = account.name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  return (
    <header className="app-header">
      <div className="header-inner">
        <button className="mobile-menu" onClick={onMenu} aria-label="Open navigation"><Icon name="menu" /></button>
        <button className="brand" onClick={() => location.reload()} aria-label="Trace home">
          <span className="brand-mark">
            <svg viewBox="0 0 32 32" aria-hidden="true">
              <path d="M7 20.5c2.1 0 2.8-8.8 5-8.8s2.7 12.2 5.1 12.2c2.2 0 2.8-16 5.2-16 1.2 0 1.8 3.2 2.7 5.3" />
              <circle cx="7" cy="20.5" r="1.4" />
              <circle cx="25" cy="13.2" r="1.4" />
            </svg>
          </span>
          <span className="brand-name">trace</span>
        </button>
        <div className="header-actions">
          <button className="profile-switch" onClick={onProfile}>
            <ProfileBadge profile={active} small />
            <span><strong>{active.name}</strong><small>{active.relationship}</small></span>
            <Icon name="chevron" size={17} />
          </button>
          <Button onClick={onLog}><Icon name="plus" size={18} /> New Case</Button>
          <button className="account-avatar" onClick={onAccount} aria-label="Open account and privacy settings">{accountInitials}</button>
        </div>
      </div>
    </header>
  );
}

function Sidebar({ page, active, open, onPage, onClose, onProfile, onPrivacy }: { page: Page; active: Profile; open: boolean; onPage: (page: Page) => void; onClose: () => void; onProfile: () => void; onPrivacy: () => void }) {
  const icons: Record<Page, string> = { Home: "home", Timeline: "timeline", Patterns: "pattern", "My Cases": "history", "Case Summaries": "care" };
  return (
    <>
      {open && <button className="scrim mobile-only" onClick={onClose} aria-label="Close navigation" />}
      <aside className={`sidebar ${open ? "sidebar-open" : ""}`}>
        <div className="mobile-sidebar-top">
          <span className="brand-name">trace</span>
          <button onClick={onClose} aria-label="Close"><Icon name="close" /></button>
        </div>
        <div className="active-person-label">Viewing history for</div>
        <button className="side-profile" onClick={() => { onClose(); onProfile(); }} aria-label={`Change or add profile. Currently viewing ${active.name}`}>
          <ProfileBadge profile={active} />
          <span className="side-profile-copy"><strong>{active.name}</strong><span>{active.relationship}</span></span>
          <span className="side-profile-action"><Icon name="chevron" size={17} /></span>
        </button>
        <nav className="nav-list">
          {navItems.map((item) => (
            <button key={item} className={page === item ? "nav-item active" : "nav-item"} onClick={() => { onPage(item); onClose(); }}>
              <Icon name={icons[item]} /> <span>{item}</span>
            </button>
          ))}
        </nav>
        <button className="privacy-settings-link" onClick={() => { onClose(); onPrivacy(); }}><Icon name="lock" size={18} /> Privacy settings</button>
        <div className="privacy-note"><Icon name="lock" size={18} /><span><strong>Private by design</strong>Your records stay separated by profile.</span></div>
      </aside>
    </>
  );
}

function Home({ profile, accountName, cases, onPage, onOpenCase, onNewCase }: { profile: Profile; accountName: string; cases: HealthCase[]; onPage: (page: Page) => void; onOpenCase: (healthCase: HealthCase) => void; onNewCase: () => void }) {
  const latestCase = cases[0];
  const greeting = (accountName.split(/\s+/)[0] || profile.name).toUpperCase();
  return (
    <div className="page-wrap">
      <section className="welcome-row">
        <div><div className="eyebrow">GOOD MORNING, {greeting}</div><h1>{profile.name}’s health, made clearer.</h1><p>Keep the small details together, so the bigger picture is easier to see.</p></div>
      </section>

      <section className="insight-card">
        <div className="insight-icon"><Icon name="spark" size={24} /></div>
        <div className="insight-copy">
          <span className="pill">PATTERN FROM “{latestCase?.title.toUpperCase() || "NEW CASE"}”</span>
          <h2>{latestCase?.patterns[0] || "Patterns will appear as this case’s history grows."}</h2>
          <p>This pattern uses only this case’s records. It is not a diagnosis or proof of cause.</p>
        </div>
        <Button variant="soft" onClick={() => latestCase ? onOpenCase(latestCase) : onNewCase()}>Open case <Icon name="arrow" size={17} /></Button>
      </section>

      <section className="cases-section">
        <div className="section-heading"><div><h2>{profile.name}’s cases</h2><p>Each health concern has its own complete history.</p></div><div className="section-actions"><button onClick={() => onPage("My Cases")}>View all cases <Icon name="arrow" size={16} /></button><Button onClick={onNewCase}><Icon name="plus" size={17} /> New Case</Button></div></div>
        {cases.length ? <div className="case-grid">{cases.slice(0, 3).map((healthCase) => <CaseCard key={healthCase.id} healthCase={healthCase} onOpen={() => onOpenCase(healthCase)} />)}</div> : <div className="empty-state"><p>No cases yet for {profile.name}.</p><Button onClick={onNewCase}>Start the first case</Button></div>}
      </section>

      <section className="quick-log">
        <div><span className="quick-icon"><Icon name="plus" /></span><div><h2>{latestCase ? `Continue “${latestCase.title}”` : "Start a health history"}</h2><p>{latestCase ? `Updated ${latestCase.updated.toLowerCase()} · ${latestCase.entries} entries` : "Keep each concern clear and separate."}</p></div></div>
        <Button onClick={() => latestCase ? onOpenCase(latestCase) : onNewCase()}>{latestCase ? "Open most recent case" : "New Case"}</Button>
      </section>
    </div>
  );
}

function Timeline({ profile, episodes, cases, onLog, onNewCase, onDelete }: { profile: Profile; episodes: Episode[]; cases: HealthCase[]; onLog: (healthCase: HealthCase) => void; onNewCase: () => void; onDelete: (episode: Episode) => void }) {
  const [selectedCaseId, setSelectedCaseId] = useState(cases[0]?.id || "");
  const selectedCase = cases.find((healthCase) => healthCase.id === selectedCaseId) || cases[0];
  const caseEpisodes = selectedCase ? episodes.filter((episode) => episode.caseId === selectedCase.id) : [];
  return (
    <div className="page-wrap narrow-page">
      <div className="page-title"><div><span className="eyebrow">{profile.name.toUpperCase()}’S RECORDS</span><h1>Timeline</h1><p>Every observation, kept in its corresponding case.</p></div>{selectedCase ? <Button variant="log" onClick={() => onLog(selectedCase)} className="log-episode-button"><Icon name="timeline" size={20} /><span className="button-copy"><strong>Log an episode</strong><small>Add to “{selectedCase.title}”</small></span></Button> : <Button onClick={onNewCase}><Icon name="plus" size={18} /> New Case</Button>}</div>
      {cases.length > 0 && <div className="case-picker timeline-case-picker">
        <div className="case-picker-label"><Icon name="history" size={16} />Choose a case for this timeline</div>
        <div className="case-picker-options">
          {cases.map((healthCase) => (
            <button key={healthCase.id} className={`case-picker-option${selectedCase?.id === healthCase.id ? " selected" : ""}`} onClick={() => setSelectedCaseId(healthCase.id)}>
              <StatusPill status={healthCase.status} />
              <span className="case-picker-title">{healthCase.title}</span>
              <span className="case-picker-meta">{healthCase.entries} entries · Updated {healthCase.updated.toLowerCase()}</span>
            </button>
          ))}
        </div>
      </div>}
      <div className="timeline-list">
        {caseEpisodes.map((ep, index) => (
          <article className="timeline-item" key={ep.id}>
            <div className="timeline-rail"><span>{index + 1}</span></div>
            <div className="timeline-card">
              <div className="episode-top"><span>{ep.date}</span><div className="episode-top-actions"><Severity value={ep.severity} /><button className="delete-entry-button" onClick={() => onDelete(ep)} aria-label={`Delete ${ep.title}`}><Icon name="trash" size={15} /></button></div></div>
              <h2>{ep.title}</h2><p className="location">{ep.place}</p><p>{ep.detail}</p>
              <div className="timeline-footer"><div className="tag-row">{ep.tags.map((tag) => <span className="tag" key={tag}>{tag}</span>)}</div><span className="tried">Tried: {ep.treatment}</span></div>
              {ep.attachment && <EpisodeAttachment attachment={ep.attachment} />}
            </div>
          </article>
        ))}
        {selectedCase && caseEpisodes.length === 0 && <div className="empty-state"><p>No timeline entries yet for “{selectedCase.title}”.</p><Button variant="log" onClick={() => onLog(selectedCase)}><Icon name="timeline" size={17} /> Log the first episode</Button></div>}
        {!selectedCase && <div className="empty-state"><p>Start a case before adding timeline entries.</p><Button onClick={onNewCase}>Start a new case</Button></div>}
      </div>
    </div>
  );
}

function Patterns({ profile, cases, onOpenCase }: { profile: Profile; cases: HealthCase[]; onOpenCase: (healthCase: HealthCase) => void }) {
  const patterns = cases.flatMap((healthCase) => healthCase.patterns.filter((pattern) => !pattern.startsWith("Not enough")).slice(0, 1).map((pattern) => ({ title: pattern, stat: `${healthCase.entries} case entries`, text: `Observed only within “${healthCase.title}”.`, healthCase })));
  return (
    <div className="page-wrap narrow-page">
      <div className="page-title"><div><span className="eyebrow">ONLY FROM {profile.name.toUpperCase()}’S RECORDS</span><h1>Observed patterns</h1><p>Connections in the details you’ve logged over time.</p></div></div>
      <div className="safety-banner"><Icon name="info" /><p><strong>Patterns, not conclusions.</strong> Trace highlights repeated details in {profile.name}’s records. These insights do not diagnose a condition or prove that one thing caused another.</p></div>
      <div className="patterns-grid">{patterns.map((pattern, i) => <article className="pattern-card" key={`${pattern.healthCase.id}-${pattern.title}`}><div className="pattern-number">0{i + 1}</div><span className="pill">{pattern.healthCase.title.toUpperCase()}</span><h2>{pattern.title}</h2><p>{pattern.text}</p><div className="pattern-stat"><Icon name="pattern" /><strong>{pattern.stat}</strong></div><Button variant="ghost" onClick={() => onOpenCase(pattern.healthCase)}>Open case <Icon name="arrow" size={16} /></Button></article>)}</div>
    </div>
  );
}

function History({ profile, cases, onOpenCase, onNewCase }: { profile: Profile; cases: HealthCase[]; onOpenCase: (healthCase: HealthCase) => void; onNewCase: () => void }) {
  return <div className="page-wrap narrow-page"><div className="page-title"><div><span className="eyebrow">{profile.name.toUpperCase()}’S SEPARATE HEALTH HISTORIES</span><h1>Cases</h1><p>One concern, one clear history. Most recently active cases appear first.</p></div><Button onClick={onNewCase}><Icon name="plus" size={18} /> New Case</Button></div>{cases.length ? <div className="history-case-list">{cases.map((healthCase, index) => <div className="numbered-case" key={healthCase.id}><span className="case-order">0{index + 1}</span><CaseCard healthCase={healthCase} onOpen={() => onOpenCase(healthCase)} /></div>)}</div> : <div className="empty-state"><p>No cases yet for {profile.name}.</p><Button onClick={onNewCase}>Start a new case</Button></div>}</div>;
}

function CaseDetail({ profile, healthCase, episodes, onBack, onAdd, onPrepare, onRemove, onDeleteEpisode, onStatusChange }: { profile: Profile; healthCase: HealthCase; episodes: Episode[]; onBack: () => void; onAdd: () => void; onPrepare: () => void; onRemove: () => void; onDeleteEpisode: (episode: Episode) => void; onStatusChange: (status: HealthCase["status"]) => void }) {
  const caseEpisodes = episodes.filter((episode) => episode.caseId === healthCase.id);
  const swipeBack = useSwipeRight(onBack);
  return (
    <div className="page-wrap case-detail-page" {...swipeBack}>
      <button className="case-back" onClick={onBack}><Icon name="back" size={17} /> All {profile.name}’s cases</button>
      <div className="case-hero">
        <div className="case-hero-copy">
          <div className="case-kicker"><StatusPill status={healthCase.status} /><span>Updated {healthCase.updated.toLowerCase()}</span></div>
          <span className="eyebrow">CASE · {profile.name.toUpperCase()}’S HISTORY</span>
          <h1>{healthCase.title}</h1>
          <p>{healthCase.concern}</p>
          <div className="case-hero-meta"><span><small>STARTED</small><strong>{healthCase.started}</strong></span><span><small>ENTRIES</small><strong>{healthCase.entries}</strong></span><span><small>SEVERITY</small><strong>{healthCase.severity}</strong></span></div>
        </div>
        {healthCase.cover && <CaseCover kind={healthCase.cover} />}
      </div>
      <div className="case-action-bar">
        <div className="status-control"><span>CASE STATUS</span><div>{(["Active", "Improving", "Resolved"] as HealthCase["status"][]).map((status) => <button key={status} className={healthCase.status === status ? `selected status-choice-${status.toLowerCase()}` : ""} onClick={() => onStatusChange(status)}><i />{status}</button>)}</div></div>
        <div><button className="remove-case-button" onClick={onRemove}>Remove case</button><Button variant="secondary" onClick={onPrepare}><Icon name="care" size={17} /> Prepare for Doctor</Button><Button variant="log" onClick={onAdd}><Icon name="timeline" size={17} /> Add to Case</Button></div>
      </div>
      <div className="case-detail-grid">
        <section className="case-timeline">
          <div className="section-heading"><div><h2>Case timeline</h2><p>Only entries connected to {healthCase.title.toLowerCase()}</p></div></div>
          {caseEpisodes.length ? caseEpisodes.map((episode, index) => <article className="case-entry" key={episode.id}><span className="entry-node">{index + 1}</span><div><div className="episode-top"><span>{episode.date}</span><div className="episode-top-actions"><Severity value={episode.severity} /><button className="delete-entry-button" onClick={() => onDeleteEpisode(episode)} aria-label={`Delete ${episode.title}`}><Icon name="trash" size={15} /></button></div></div><h3>{episode.title}</h3><span className="location">{episode.place}</span><p>{episode.detail}</p><div className="tag-row">{episode.tags.map((tag) => <span className="tag" key={tag}>{tag}</span>)}</div>{episode.attachment && <EpisodeAttachment attachment={episode.attachment} />}<div className="entry-treatment"><strong>Tried</strong>{episode.treatment}</div></div></article>) : <article className="case-entry"><span className="entry-node">1</span><div><div className="episode-top"><span>{healthCase.started}</span></div><h3>Case started</h3><p>{healthCase.concern}</p><div className="tag-row">{healthCase.symptoms.map((symptom) => <span className="tag" key={symptom}>{symptom}</span>)}</div></div></article>}
        </section>
        <aside className="case-facts">
          <section><span className="fact-icon"><Icon name="history" size={18} /></span><div><small>SYMPTOMS & LOCATIONS</small><h3>{healthCase.symptoms.join(", ")}</h3><p>{healthCase.locations.join(" · ")}</p></div></section>
          <section><span className="fact-icon"><Icon name="care" size={18} /></span><div><small>PRODUCTS & TREATMENTS</small><h3>{healthCase.treatments.join(", ")}</h3><p>What changed: {healthCase.changes.join(", ")}</p></div></section>
          <section className="pattern-fact"><span className="fact-icon"><Icon name="spark" size={18} /></span><div><small>PATTERNS FROM THIS CASE</small><h3>{healthCase.patterns[0]}</h3><p>Pattern from this case’s records, not a diagnosis or proof of cause.</p></div></section>
          <section><span className="fact-icon"><Icon name="camera" size={18} /></span><div><small>PHOTOS</small><h3>{healthCase.cover ? "2 photos saved" : "No photos yet"}</h3><p>Stored only with this case.</p></div></section>
        </aside>
      </div>
    </div>
  );
}

function RemoveCaseModal({ healthCase, onClose, onConfirm }: { healthCase: HealthCase; onClose: () => void; onConfirm: () => void }) {
  return (
    <div className="modal-layer"><button className="scrim" onClick={onClose} aria-label="Cancel removing case" />
      <div className="modal remove-modal">
        <button className="modal-close" onClick={onClose}><Icon name="close" /></button>
        <div className="remove-icon"><Icon name="history" /></div>
        <span className="eyebrow">REMOVE CASE</span>
        <h2>Remove “{healthCase.title}”?</h2>
        <p>This will permanently remove this case and its {healthCase.entries} entries from this person’s history. This action cannot be undone.</p>
        <div className="remove-actions"><Button variant="secondary" onClick={onClose}>Keep case</Button><button className="confirm-remove" onClick={onConfirm}>Remove case</button></div>
      </div>
    </div>
  );
}

function DeleteEpisodeModal({ episode, onClose, onConfirm }: { episode: Episode; onClose: () => void; onConfirm: () => void }) {
  return (
    <div className="modal-layer"><button className="scrim" onClick={onClose} aria-label="Cancel deleting entry" />
      <div className="modal remove-modal">
        <button className="modal-close" onClick={onClose}><Icon name="close" /></button>
        <div className="remove-icon"><Icon name="trash" /></div>
        <span className="eyebrow">DELETE TIMELINE ENTRY</span>
        <h2>Delete “{episode.title}”?</h2>
        <p>This entry{episode.attachment ? " and its photo attachment" : ""} will be permanently removed from the case timeline. This action cannot be undone.</p>
        <div className="remove-actions"><Button variant="secondary" onClick={onClose}>Keep entry</Button><button className="confirm-remove" onClick={onConfirm}>Delete entry</button></div>
      </div>
    </div>
  );
}

function CareSummary({ profile, allEpisodes, cases, initialCase }: { profile: Profile; allEpisodes: Episode[]; cases: HealthCase[]; initialCase?: HealthCase }) {
  const [selectedCase, setSelectedCase] = useState<HealthCase | undefined>(initialCase || cases[0]);
  const [editing, setEditing] = useState(false);
  const [included, setIncluded] = useState<Record<number, boolean>>({ 0: true, 1: true, 2: true, 3: true, 4: true });
  const [concern, setConcern] = useState(selectedCase?.concern || "");

  const healthCase = selectedCase;
  const episodes = allEpisodes.filter((ep) => !healthCase || ep.caseId === healthCase.id);

  const handleCaseSelect = (c: HealthCase) => {
    setSelectedCase(c);
    setConcern(c.concern);
    setEditing(false);
    setIncluded({ 0: true, 1: true, 2: true, 3: true, 4: true });
  };

  const sections = healthCase ? [
    ["Symptoms & locations", `${healthCase.symptoms.join(", ")}. Locations: ${healthCase.locations.join(", ")}.`],
    ["Products & treatments", healthCase.treatments.join(", ")],
    ["What changed", healthCase.changes.join(", ")],
    ["Observed patterns", healthCase.patterns.join(" ")],
    ["Questions for our clinician", profile.child ? "Could any current products be worth reviewing? What details would be most helpful to track next?" : "What signs would mean this needs further assessment? What details would be most helpful to track next?"],
  ] : [];

  return (
    <div className="page-wrap summary-page">
      <div className="page-title"><div><span className="eyebrow">PREPARED ONLY FROM THIS CASE</span><h1>Prepare for Doctor</h1><p>Review and control what is included before sharing.</p></div><div className="title-actions"><Button variant="secondary" onClick={() => setEditing(!editing)}><Icon name="edit" size={17} /> {editing ? "Done editing" : "Edit summary"}</Button><Button>Share summary</Button></div></div>

      <div className="case-picker">
        <div className="case-picker-label"><Icon name="care" size={16} />Choose a case to prepare</div>
        <div className="case-picker-options">
          {cases.map((c) => (
            <button key={c.id} className={`case-picker-option${selectedCase?.id === c.id ? " selected" : ""}`} onClick={() => handleCaseSelect(c)}>
              <StatusPill status={c.status} />
              <span className="case-picker-title">{c.title}</span>
              <span className="case-picker-meta">{c.entries} entries · {c.updated}</span>
            </button>
          ))}
        </div>
      </div>

      {healthCase ? (
        <div className="document">
          <div className="document-head"><div><span>TRACE · DOCTOR-READY CASE HISTORY</span><h2>{healthCase.title}</h2><p>{profile.name} · Started {healthCase.started} · {healthCase.entries} entries</p></div><ProfileBadge profile={profile} /></div>
          <section className="concern-block"><span>PRIMARY CONCERN</span>{editing ? <textarea value={concern} onChange={(e) => setConcern(e.target.value)} /> : <h3>{concern}</h3>}</section>
          <div className="document-stats"><div><span>Tracking since</span><strong>{healthCase.started}</strong></div><div><span>Severity range</span><strong>{healthCase.severity}</strong></div><div><span>Most recent entry</span><strong>{healthCase.updated}</strong></div></div>
          <div className="include-hint"><Icon name="check" size={16} /><span>Select what to include when this summary is shared.</span></div>
          <div className="document-sections">{sections.map(([title, text], i) => <section className={included[i] ? "" : "section-excluded"} key={title}><button className="include-toggle" onClick={() => setIncluded((current) => ({ ...current, [i]: !current[i] }))} aria-label={`${included[i] ? "Exclude" : "Include"} ${title}`}>{included[i] && <Icon name="check" size={13} />}</button><div><h3>{title}</h3>{editing ? <textarea defaultValue={text} /> : <p>{text}</p>}</div></section>)}</div>
          <div className="document-note"><Icon name="info" size={18} /><p>This summary reflects information recorded by the user. Observed patterns are not a diagnosis and do not establish cause.</p></div>
        </div>
      ) : (
        <div className="empty-state"><p>No cases yet for {profile.name}.</p></div>
      )}
    </div>
  );
}

function AuthScreen({ lastEmail, onSignup, onLogin }: { lastEmail: string; onSignup: (account: Account, password: string) => string | null; onLogin: (email: string, password: string) => string | null }) {
  const [mode, setMode] = useState<"signup" | "login">(lastEmail ? "login" : "signup");
  const [name, setName] = useState("");
  const [email, setEmail] = useState(lastEmail);
  const [password, setPassword] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState("");

  const changeMode = (nextMode: "signup" | "login") => {
    setMode(nextMode);
    setError("");
    setPassword("");
  };
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password) return setError("Enter your email and password.");
    if (password.length < 8) return setError("Use at least 8 characters for your password.");
    if (mode === "signup") {
      if (!name.trim()) return setError("Enter your name.");
      if (!agreed) return setError("Confirm that you agree to the privacy terms.");
      const errorMessage = onSignup({ name: name.trim(), email: cleanEmail }, password);
      if (errorMessage) setError(errorMessage);
      return;
    }
    const errorMessage = onLogin(cleanEmail, password);
    if (errorMessage) setError(errorMessage);
  };

  return (
    <main className="auth-shell">
      <section className="auth-intro">
        <div className="auth-brand"><span className="brand-mark"><img src="/assets/trace-logo-pulse.svg" alt="" /></span><span className="brand-name">trace</span></div>
        <div><span className="eyebrow">PRIVATE HEALTH HISTORIES</span><h1>Keep the details clear, private, and ready when they matter.</h1><p>Document recurring health concerns in separate cases for every person you care for.</p></div>
        <div className="auth-trust-list"><span><Icon name="lock" size={18} /><strong>Separate by profile</strong><small>Records never mix between people.</small></span><span><Icon name="care" size={18} /><strong>You control sharing</strong><small>Nothing is shared without your action.</small></span></div>
      </section>
      <section className="auth-panel">
        <div className="auth-card">
          <div className="auth-tabs"><button className={mode === "signup" ? "active" : ""} onClick={() => changeMode("signup")}>Create account</button><button className={mode === "login" ? "active" : ""} onClick={() => changeMode("login")}>Log in</button></div>
          <span className="eyebrow">{mode === "signup" ? "GET STARTED" : "WELCOME BACK"}</span>
          <h2>{mode === "signup" ? "Create your private space" : "Log in to Trace"}</h2>
          <p>{mode === "signup" ? "Your profiles and cases stay together under one account." : "Return to your profiles, cases, and timelines."}</p>
          <form onSubmit={submit}>
            {mode === "signup" && <label className="field"><span>Your name</span><input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" placeholder="Enter your name" /></label>}
            <label className="field"><span>Email address</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" placeholder="you@example.com" /></label>
            <label className="field"><span>Password</span><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === "signup" ? "new-password" : "current-password"} placeholder="At least 8 characters" /></label>
            {mode === "signup" && <label className="privacy-consent"><input type="checkbox" checked={agreed} onChange={(event) => setAgreed(event.target.checked)} /><span>I agree to Trace’s privacy terms and understand that I control what is shared.</span></label>}
            {error && <div className="auth-error"><Icon name="info" size={16} />{error}</div>}
            <Button type="submit" className="full-button">{mode === "signup" ? "Create private account" : "Log in securely"} <Icon name="arrow" size={17} /></Button>
          </form>
          <div className="auth-assurance"><Icon name="lock" size={15} />Your health records are private by default.</div>
        </div>
      </section>
    </main>
  );
}

function PrivacySettingsModal({ account, preferences, onChange, onClose, onSignOut }: { account: Account; preferences: PrivacyPreferences; onChange: (key: keyof PrivacyPreferences) => void; onClose: () => void; onSignOut: () => void }) {
  const settings: Array<{ key: keyof PrivacyPreferences; title: string; detail: string }> = [
    { key: "lockOnClose", title: "Require login when I return", detail: "End your session when this browser closes." },
    { key: "stripPhotoMetadata", title: "Remove photo location data", detail: "Strip location metadata from new photo attachments." },
    { key: "expiringShareLinks", title: "Automatically expire summary links", detail: "If you choose to create and send a private case-summary link, it will stop working after 7 days. Trace never sends a link or shares a summary unless you explicitly choose to do so." },
  ];
  return (
    <div className="modal-layer"><button className="scrim" onClick={onClose} aria-label="Close privacy settings" />
      <div className="modal privacy-modal">
        <button className="modal-close" onClick={onClose} aria-label="Close privacy settings"><Icon name="close" /></button>
        <div className="modal-icon"><Icon name="lock" /></div>
        <span className="eyebrow">ACCOUNT & PRIVACY</span>
        <h2>Privacy settings</h2>
        <p>Control access, attachments, and how information can leave Trace.</p>
        <div className="privacy-account"><span className="account-avatar">{account.name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase()}</span><span><strong>{account.name}</strong><small>{account.email}</small></span></div>
        <div className="privacy-fixed"><Icon name="lock" size={18} /><span><strong>Profiles stay separate</strong><small>Cases, timelines, photos, and summaries belong only to their selected profile.</small></span></div>
        <div className="privacy-options">
          {settings.map((setting) => <div className="privacy-option" key={setting.key}><span><strong>{setting.title}</strong><small>{setting.detail}</small></span><button className={`toggle ${preferences[setting.key] ? "on" : ""}`} role="switch" aria-checked={preferences[setting.key]} onClick={() => onChange(setting.key)}><span /></button></div>)}
        </div>
        <div className="privacy-actions"><button className="sign-out-button" onClick={onSignOut}><Icon name="back" size={17} /> Sign out of Trace</button></div>
      </div>
    </div>
  );
}

function OnboardingTour({ page, onNavigate, onMobileMenu, onFinish }: { page: Page; onNavigate: (page: Page) => void; onMobileMenu: (open: boolean) => void; onFinish: () => void }) {
  const steps: Array<{ page?: Page; sidebar?: boolean; selector: string; eyebrow: string; title: string; detail: string }> = [
    { selector: ".profile-switch", eyebrow: "PROFILES", title: "One account, separate histories", detail: "Use the profile switcher whenever you need to document something for yourself, your child, or someone you care for. Cases and timelines never mix between profiles." },
    { selector: ".header-actions > .button", eyebrow: "NEW CONCERN", title: "Start a new case", detail: "Create a case when you begin tracking a distinct health concern. Each case gets its own symptoms, photos, timeline, patterns, and doctor-ready summary." },
    { page: "Home", selector: ".nav-item.active", eyebrow: "HOME", title: "Your current cases at a glance", detail: "Home brings forward the cases you are actively tracking. Open any card to review its history, add an episode, update its status, or prepare for an appointment." },
    { page: "Timeline", selector: ".nav-item.active", eyebrow: "TIMELINE", title: "Choose a case before reviewing entries", detail: "The timeline shows observations for one case at a time. Select the relevant case, then log episodes, open photo attachments, or remove an incorrect entry." },
    { page: "Patterns", selector: ".nav-item.active", eyebrow: "PATTERNS", title: "Notice repetition, not diagnoses", detail: "Trace surfaces details that appear repeatedly within a case. Patterns can support a conversation with a clinician, but they never claim a cause or diagnosis." },
    { page: "My Cases", selector: ".nav-item.active", eyebrow: "MY CASES", title: "Every concern stays distinct", detail: "This is the complete case library for the selected profile. Active, improving, and resolved concerns remain separate and easy to revisit." },
    { page: "Case Summaries", selector: ".nav-item.active", eyebrow: "CASE SUMMARIES", title: "Prepare one case for a clinician", detail: "Choose a case, review the generated summary, edit the wording, and control which sections are included before you decide to share anything." },
    { sidebar: true, selector: ".privacy-settings-link", eyebrow: "PRIVACY", title: "You stay in control", detail: "Open account and privacy settings whenever you need to manage session security, photo privacy, summary-link expiry, or sign out." },
  ];
  const [stepIndex, setStepIndex] = useState(0);
  const [spotlight, setSpotlight] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 18, left: 16, width: Math.min(390, window.innerWidth - 32) });
  const tourCardRef = useRef<HTMLElement>(null);
  const step = steps[stepIndex];

  useEffect(() => {
    const lockedElements = Array.from(document.querySelectorAll<HTMLElement>(".app-header, .sidebar, .main-content"));
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    lockedElements.forEach((element) => { element.inert = true; });
    return () => {
      document.body.style.overflow = previousOverflow;
      lockedElements.forEach((element) => { element.inert = false; });
    };
  }, []);

  useEffect(() => {
    if (step.page && step.page !== page) onNavigate(step.page);
  }, [page, step.page, onNavigate]);

  useEffect(() => {
    onMobileMenu(Boolean((step.page || step.sidebar) && window.innerWidth <= 820));
  }, [step.page, step.sidebar, onMobileMenu]);

  useEffect(() => {
    const measure = () => {
      const candidates = Array.from(document.querySelectorAll<HTMLElement>(step.selector));
      const target = candidates.find((element) => {
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      });
      if (!target) return setSpotlight(null);
      const rect = target.getBoundingClientRect();
      setSpotlight({ top: rect.top, left: rect.left, width: rect.width, height: rect.height });
    };
    const delay = window.innerWidth <= 820 && (step.page || step.sidebar) ? 300 : 0;
    const timer = window.setTimeout(measure, delay);
    window.addEventListener("resize", measure);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("resize", measure);
    };
  }, [stepIndex, step.selector, page]);

  useEffect(() => {
    const positionTooltip = () => {
      const width = Math.min(390, window.innerWidth - 32);
      const height = tourCardRef.current?.getBoundingClientRect().height || 250;
      const margin = 16;
      if (!spotlight) {
        setTooltipPosition({ top: Math.max(margin, (window.innerHeight - height) / 2), left: Math.max(margin, (window.innerWidth - width) / 2), width });
        return;
      }
      const target = { top: spotlight.top - 8, left: spotlight.left - 8, right: spotlight.left + spotlight.width + 8, bottom: spotlight.top + spotlight.height + 8 };
      const clampLeft = (left: number) => Math.min(Math.max(margin, left), window.innerWidth - width - margin);
      const clampTop = (top: number) => Math.min(Math.max(margin, top), window.innerHeight - height - margin);
      const candidates = [
        { top: target.bottom + 18, left: clampLeft(target.left) },
        { top: target.top - height - 18, left: clampLeft(target.left) },
        { top: clampTop(target.top), left: target.right + 18 },
        { top: clampTop(target.top), left: target.left - width - 18 },
      ];
      const fits = candidates.find((candidate) => {
        const right = candidate.left + width;
        const bottom = candidate.top + height;
        const inViewport = candidate.left >= margin && candidate.top >= margin && right <= window.innerWidth - margin && bottom <= window.innerHeight - margin;
        const overlapsTarget = candidate.left < target.right && right > target.left && candidate.top < target.bottom && bottom > target.top;
        return inViewport && !overlapsTarget;
      });
      const chosen = fits || { top: margin, left: clampLeft(window.innerWidth - width - margin) };
      setTooltipPosition({ ...chosen, width });
    };
    const frame = requestAnimationFrame(positionTooltip);
    window.addEventListener("resize", positionTooltip);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", positionTooltip);
    };
  }, [spotlight, stepIndex]);

  const next = () => {
    if (stepIndex === steps.length - 1) onFinish();
    else setStepIndex((current) => current + 1);
  };
  const gap = 8;

  return (
    <div className="onboarding-tour" aria-live="polite">
      {spotlight ? <>
        <div className="tour-shade" style={{ inset: `0 0 auto 0`, height: Math.max(0, spotlight.top - gap) }} />
        <div className="tour-shade" style={{ top: Math.max(0, spotlight.top - gap), left: 0, width: Math.max(0, spotlight.left - gap), height: spotlight.height + gap * 2 }} />
        <div className="tour-shade" style={{ top: Math.max(0, spotlight.top - gap), left: spotlight.left + spotlight.width + gap, right: 0, height: spotlight.height + gap * 2 }} />
        <div className="tour-shade" style={{ top: spotlight.top + spotlight.height + gap, right: 0, bottom: 0, left: 0 }} />
        <div className="tour-spotlight" style={{ top: spotlight.top - gap, left: spotlight.left - gap, width: spotlight.width + gap * 2, height: spotlight.height + gap * 2 }} />
      </> : <div className="tour-shade tour-shade-full" />}
      <section ref={tourCardRef} className="tour-card" style={tooltipPosition}>
        <div className="tour-progress"><span>{stepIndex + 1} of {steps.length}</span><button onClick={onFinish}>Skip tour</button></div>
        <span className="eyebrow">{step.eyebrow}</span>
        <h2>{step.title}</h2>
        <p>{step.detail}</p>
        <div className="tour-actions">{stepIndex > 0 ? <Button variant="ghost" onClick={() => setStepIndex((current) => current - 1)}><Icon name="back" size={16} /> Back</Button> : <span />}<Button onClick={next}>{stepIndex === steps.length - 1 ? "Finish" : "Next"} <Icon name="arrow" size={16} /></Button></div>
      </section>
    </div>
  );
}

function ProfileMenu({ active, profiles: profileList, onSelect, onClose, onAdd }: { active: Profile; profiles: Profile[]; onSelect: (profile: Profile) => void; onClose: () => void; onAdd: () => void }) {
  return <><button className="scrim" onClick={onClose} aria-label="Close profile switcher" /><div className="profile-menu"><div className="menu-label">Who are you keeping this history for?</div>{profileList.map((profile) => <button className="profile-option" key={profile.id} onClick={() => onSelect(profile)}><ProfileBadge profile={profile} /><span><strong>{profile.name}</strong><small>{profile.relationship}</small></span>{active.id === profile.id && <span className="selected-check"><Icon name="check" size={16} /></span>}</button>)}<button className="add-profile" onClick={onAdd}><span><Icon name="plus" /></span>Add another profile</button><p>Each person’s health history stays completely separate.</p></div></>;
}

function AddProfileModal({ onClose, onCreate }: { onClose: () => void; onCreate: (profile: Profile) => void }) {
  const [choice, setChoice] = useState("My child");
  const [name, setName] = useState("");
  const [relationship, setRelationship] = useState("");
  const create = () => {
    if (!name.trim()) return;
    onCreate({
      id: `${name.toLowerCase().replace(/\W+/g, "-")}-${Date.now()}`,
      name: name.trim(),
      relationship: relationship.trim() || (choice === "Myself" ? "Myself" : choice === "My child" ? "Child" : "Loved one"),
      initials: name.trim().slice(0, 1).toUpperCase(),
      color: "sage",
      child: choice === "My child",
    });
  };
  return <div className="modal-layer"><button className="scrim" onClick={onClose} aria-label="Close" /><div className="modal small-modal"><button className="modal-close" onClick={onClose}><Icon name="close" /></button><div className="modal-icon"><Icon name="user" /></div><span className="eyebrow">NEW PROFILE</span><h2>Who are you keeping this history for?</h2><div className="choice-grid">{["Myself", "My child", "Someone I care for"].map((item) => <button className={choice === item ? "choice selected" : "choice"} onClick={() => setChoice(item)} key={item}>{item}<span>{choice === item && <Icon name="check" size={15} />}</span></button>)}</div><label className="field"><span>Their name</span><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Enter name" /></label><label className="field"><span>Your relationship</span><input value={relationship} onChange={(event) => setRelationship(event.target.value)} placeholder={choice === "My child" ? "e.g. Daughter" : "e.g. Partner"} /></label><Button onClick={create} className="full-button">Create separate profile</Button></div></div>;
}

function NewCaseModal({ profile, onClose, onCreate }: { profile: Profile; onClose: () => void; onCreate: (healthCase: HealthCase) => void }) {
  const [title, setTitle] = useState("");
  const [concern, setConcern] = useState("");
  const create = () => {
    if (!title.trim()) return;
    onCreate({
      id: `${title.toLowerCase().replace(/\W+/g, "-")}-${Date.now()}`,
      profileId: profile.id, title: title.trim(), concern: concern.trim() || "New health concern.",
      started: "Today", updated: "Today", updatedOrder: Date.now(), entries: 0, status: "Active",
      locations: [], symptoms: [], severity: "Not recorded", treatments: [], changes: [], patterns: ["Not enough entries to identify a pattern yet."],
    });
  };
  return (
    <div className="modal-layer"><button className="scrim" onClick={onClose} aria-label="Close new case" />
      <div className="modal small-modal"><button className="modal-close" onClick={onClose}><Icon name="close" /></button><div className="modal-icon"><Icon name="history" /></div><span className="eyebrow">NEW CASE FOR {profile.name.toUpperCase()}</span><h2>Start a separate health concern</h2><p>This creates its own timeline, photos, patterns and care summary.</p>
        <label className="field"><span>Case title</span><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Recurring facial irritation" /></label>
        <label className="field"><span>What’s the main concern?</span><textarea value={concern} onChange={(event) => setConcern(event.target.value)} placeholder="Briefly describe what you want to track" /></label>
        <div className="new-case-note"><Icon name="lock" size={17} /><span><strong>Kept separate by design</strong>This case will not mix with {profile.name}’s other health concerns.</span></div>
        <Button onClick={create} className="full-button"><Icon name="plus" size={17} /> Create New Case</Button>
      </div>
    </div>
  );
}

function LogModal({ profile, healthCase, onClose, onSave }: { profile: Profile; healthCase: HealthCase; onClose: () => void; onSave: (data: Partial<Episode>) => void }) {
  const [step, setStep] = useState(1);
  const [severity, setSeverity] = useState(5);
  const [notice, setNotice] = useState("");
  const [where, setWhere] = useState("");
  const [changes, setChanges] = useState<string[]>(["Product"]);
  const [tried, setTried] = useState("");
  const [attachment, setAttachment] = useState<Episode["attachment"]>();
  const [childNoteType, setChildNoteType] = useState<"observed" | "told">("observed");
  const fileRef = useRef<HTMLInputElement>(null);
  const toggle = (item: string) => setChanges((current) => current.includes(item) ? current.filter((x) => x !== item) : [...current, item]);
  const attachPhoto = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setAttachment({ name: file.name, url: String(reader.result) });
    reader.readAsDataURL(file);
  };
  return (
    <div className="modal-layer">
      <button className="scrim" onClick={onClose} aria-label="Close logging flow" />
      <div className="modal log-modal">
        <div className="modal-header">
          <div>{step > 1 && <button onClick={() => setStep(step - 1)} className="back-button"><Icon name="back" size={19} /></button>}<div><span>ADDING TO CASE · {profile.name.toUpperCase()}</span><strong>{healthCase.title}</strong></div></div>
          <button className="modal-close-inline" onClick={onClose}><Icon name="close" /></button>
        </div>
        <div className="progress"><span style={{ width: `${step * 33.333}%` }} /></div>
        <div className="modal-body">
          {step === 1 && <><span className="step-label">STEP 1 OF 3 · THE OBSERVATION</span><h2>What did you notice?</h2><p>Capture it in your own words. You can add detail as you go.</p>{profile.child && <div className="child-tabs"><button className={childNoteType === "observed" ? "active" : ""} onClick={() => setChildNoteType("observed")}>What I observed</button><button className={childNoteType === "told" ? "active" : ""} onClick={() => setChildNoteType("told")}>What they told me</button></div>}<label className="field"><span>{childNoteType === "told" ? `What did ${profile.name} tell you?` : "What did you notice?"}</span><textarea value={notice} onChange={(e) => setNotice(e.target.value)} placeholder={profile.child ? childNoteType === "told" ? `e.g. “It feels itchy and warm”` : "e.g. Red, dry patches that looked itchy" : "e.g. A dull headache that began after lunch"} /></label><label className="field"><span>Where?</span><input value={where} onChange={(e) => setWhere(e.target.value)} placeholder="e.g. Inside elbows" /></label><div className="field"><span>Severity <b>{severity}/10</b></span><div className="severity-scale">{Array.from({ length: 10 }, (_, i) => i + 1).map((n) => <button key={n} onClick={() => setSeverity(n)} className={severity === n ? "selected" : ""}>{n}</button>)}</div><div className="scale-labels"><span>Mild</span><span>Severe</span></div></div></>}
          {step === 2 && <><span className="step-label">STEP 2 OF 3 · CONTEXT</span><h2>What changed recently?</h2><p>Choose anything that might help you spot a pattern later. Trace won’t assume it caused the episode.</p><div className="chip-grid">{["Product", "Medication", "Stress", "Sleep", "Diet", "Weather", "Activity", "Nothing I can think of"].map((item) => <button key={item} className={changes.includes(item) ? "select-chip selected" : "select-chip"} onClick={() => toggle(item)}>{changes.includes(item) && <Icon name="check" size={15} />}{item}</button>)}</div><label className="field"><span>What did you try?</span><input value={tried} onChange={(e) => setTried(e.target.value)} placeholder="e.g. Moisturizer, rest, medication" /></label><label className="field"><span>Notes <small>Optional</small></span><textarea placeholder="Anything else you want to remember?" /></label><button className={`photo-upload${attachment ? " attached" : ""}`} onClick={() => fileRef.current?.click()}><span><Icon name={attachment ? "paperclip" : "camera"} /></span><div><strong>{attachment ? "Photo attached" : `Add a photo to ${profile.name}’s history`}</strong><small>{attachment ? attachment.name : `Photos are stored with “${healthCase.title}” and appear on this timeline entry.`}</small></div><Icon name={attachment ? "check" : "plus"} /></button><input ref={fileRef} type="file" accept="image/*" onChange={attachPhoto} hidden /></>}
          {step === 3 && <><span className="step-label">STEP 3 OF 3 · REVIEW</span><h2>Add this to “{healthCase.title}”?</h2><p>Check the details before adding them to this case.</p><div className="review-profile"><ProfileBadge profile={profile} /><div><strong>{healthCase.title}</strong><span>{profile.name} · Separate case history</span></div><Icon name="lock" /></div><div className="review-list"><div><span>OBSERVATION</span><strong>{notice || "Red, dry patches that looked itchy"}</strong></div><div><span>WHERE</span><strong>{where || "Inside elbows"}</strong></div><div><span>SEVERITY</span><Severity value={severity} /></div><div><span>RECENT CHANGES</span><strong>{changes.join(", ") || "None noted"}</strong></div><div><span>TRIED</span><strong>{tried || "Nothing recorded"}</strong></div></div><div className="safe-note"><Icon name="lock" size={18} />This entry will only belong to this case in {profile.name}’s history.</div></>}
        </div>
        <div className="modal-footer"><Button variant="ghost" onClick={onClose}>Save for later</Button><Button onClick={() => step < 3 ? setStep(step + 1) : onSave({ title: notice || "New observation", place: where || "Not specified", severity, tags: changes, treatment: tried || "Nothing recorded", attachment })}>{step === 3 ? <><Icon name="check" size={18} /> Add to Case</> : <>Continue <Icon name="arrow" size={17} /></>}</Button></div>
      </div>
    </div>
  );
}

export default function App() {
  const bootAccount = useState(sessionAccount)[0];
  const bootWorkspace = useState(() => bootAccount ? loadWorkspace(bootAccount) : freshWorkspace({ name: "You", email: "" }))[0];
  const [savedAccount, setSavedAccount] = useState<Account | null>(() => {
    const accounts = readAccounts();
    const latest = accounts[accounts.length - 1];
    return latest ? { name: latest.name, email: latest.email } : null;
  });
  const [account, setAccount] = useState<Account | null>(bootAccount);
  const [privacyPreferences, setPrivacyPreferences] = useState<PrivacyPreferences>(() => bootAccount ? loadPrivacy(bootAccount.email) : privacyDefaults);
  const [active, setActive] = useState(() => bootWorkspace.profiles.find((profile) => profile.id === bootWorkspace.activeProfileId) || bootWorkspace.profiles[0]);
  const [profileList, setProfileList] = useState(bootWorkspace.profiles);
  const [page, setPage] = useState<Page>("Home");
  const [episodes, setEpisodes] = useState(bootWorkspace.episodes);
  const [cases, setCases] = useState(bootWorkspace.cases);
  const [openedCase, setOpenedCase] = useState<HealthCase | null>(null);
  const [summaryCase, setSummaryCase] = useState<HealthCase | null>(null);
  const [caseToRemove, setCaseToRemove] = useState<HealthCase | null>(null);
  const [episodeToDelete, setEpisodeToDelete] = useState<Episode | null>(null);
  const [profileMenu, setProfileMenu] = useState(false);
  const [addProfile, setAddProfile] = useState(false);
  const [newCaseModal, setNewCaseModal] = useState(false);
  const [loggingCase, setLoggingCase] = useState<HealthCase | null>(null);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [onboarding, setOnboarding] = useState(() => bootAccount ? localStorage.getItem(onboardingKey(bootAccount.email)) === "true" : false);
  const [toast, setToast] = useState("");
  const activeEpisodes = useMemo(() => episodes[active.id] || [], [episodes, active.id]);
  const activeCases = useMemo(() => cases.filter((healthCase) => healthCase.profileId === active.id).sort((a, b) => b.updatedOrder - a.updatedOrder), [cases, active.id]);
  useEffect(() => {
    if (!account) return;
    const payload: Workspace = { profiles: profileList, activeProfileId: active.id, cases, episodes };
    localStorage.setItem(workspaceKey(account.email), JSON.stringify(payload));
  }, [account, profileList, active.id, cases, episodes]);
  const applyWorkspace = (workspace: Workspace) => {
    const profile = workspace.profiles.find((item) => item.id === workspace.activeProfileId) || workspace.profiles[0];
    setProfileList(workspace.profiles);
    setActive(profile);
    setCases(workspace.cases);
    setEpisodes(workspace.episodes);
    setOpenedCase(null);
    setSummaryCase(null);
    setCaseToRemove(null);
    setEpisodeToDelete(null);
    setProfileMenu(false);
    setAddProfile(false);
    setNewCaseModal(false);
    setLoggingCase(null);
    setMobileMenu(false);
    setPage("Home");
    setToast("");
  };
  const selectProfile = (profile: Profile) => { setActive(profile); setProfileMenu(false); setOpenedCase(null); setSummaryCase(null); setPage("Home"); };
  const navigate = (nextPage: Page) => { setOpenedCase(null); setSummaryCase(nextPage === "Case Summaries" ? activeCases[0] || null : null); setPage(nextPage); };
  const createProfile = (profile: Profile) => {
    setProfileList((current) => [...current, profile]);
    setEpisodes((current) => ({ ...current, [profile.id]: [] }));
    setActive(profile);
    setAddProfile(false);
    setPage("Home");
    setToast(`${profile.name} now has a separate history`);
    setTimeout(() => setToast(""), 3200);
  };
  const createCase = (healthCase: HealthCase) => {
    setCases((current) => [healthCase, ...current]);
    setNewCaseModal(false);
    setOpenedCase(healthCase);
    setToast(`Created “${healthCase.title}” for ${active.name}`);
    setTimeout(() => setToast(""), 3200);
  };
  const updateCaseStatus = (status: HealthCase["status"]) => {
    if (!openedCase || openedCase.status === status) return;
    const updatedCase = { ...openedCase, status, updated: "Today", updatedOrder: Date.now() };
    setCases((current) => current.map((healthCase) => healthCase.id === openedCase.id ? updatedCase : healthCase));
    setOpenedCase(updatedCase);
    setToast(`“${updatedCase.title}” marked ${status.toLowerCase()}`);
    setTimeout(() => setToast(""), 3200);
  };
  const removeCase = () => {
    if (!caseToRemove) return;
    const removedTitle = caseToRemove.title;
    setCases((current) => current.filter((healthCase) => healthCase.id !== caseToRemove.id));
    setEpisodes((current) => ({ ...current, [active.id]: (current[active.id] || []).filter((episode) => episode.caseId !== caseToRemove.id) }));
    setOpenedCase(null);
    setSummaryCase(null);
    setCaseToRemove(null);
    setPage("My Cases");
    setToast(`Removed “${removedTitle}”`);
    setTimeout(() => setToast(""), 3200);
  };
  const deleteEpisode = () => {
    if (!episodeToDelete) return;
    const deletedEpisode = episodeToDelete;
    setEpisodes((current) => ({ ...current, [active.id]: (current[active.id] || []).filter((episode) => episode.id !== deletedEpisode.id) }));
    if (deletedEpisode.caseId) {
      setCases((current) => current.map((healthCase) => healthCase.id === deletedEpisode.caseId ? { ...healthCase, entries: Math.max(0, healthCase.entries - 1) } : healthCase));
      setOpenedCase((current) => current?.id === deletedEpisode.caseId ? { ...current, entries: Math.max(0, current.entries - 1) } : current);
    }
    setEpisodeToDelete(null);
    setToast(`Deleted “${deletedEpisode.title}”`);
    setTimeout(() => setToast(""), 3200);
  };
  const saveEpisode = (data: Partial<Episode>) => {
    if (!loggingCase) return;
    const episode: Episode = { id: Date.now(), caseId: loggingCase.id, date: "Just now", title: data.title!, place: data.place!, severity: data.severity!, detail: "New observation added from the logging flow.", tags: data.tags || [], treatment: data.treatment!, attachment: data.attachment };
    setEpisodes((current) => ({ ...current, [active.id]: [episode, ...(current[active.id] || [])] }));
    const updatedCase = { ...loggingCase, updated: "Today", updatedOrder: Date.now(), entries: loggingCase.entries + 1 };
    setCases((current) => current.map((healthCase) => healthCase.id === loggingCase.id ? updatedCase : healthCase));
    setOpenedCase(updatedCase);
    setLoggingCase(null); setToast(`Added to “${loggingCase.title}”`);
    setTimeout(() => setToast(""), 3200);
  };
  const signup = (nextAccount: Account, password: string) => {
    const accounts = readAccounts();
    if (accounts.some((item) => item.email === nextAccount.email)) return "An account with that email already exists. Log in instead.";
    writeAccounts([...accounts, { ...nextAccount, password }]);
    applyWorkspace(freshWorkspace(nextAccount));
    localStorage.setItem(onboardingKey(nextAccount.email), "true");
    setPrivacyPreferences(privacyDefaults);
    setSavedAccount(nextAccount);
    setOnboarding(true);
    startSession(nextAccount, false);
    setAccount(nextAccount);
    return null;
  };
  const login = (email: string, password: string) => {
    const match = readAccounts().find((item) => item.email === email);
    if (!match) return "We couldn’t find a Trace account with that email.";
    if (match.password && match.password !== password) return "That password doesn’t match this account.";
    const nextAccount = { name: match.name, email: match.email };
    const privacy = loadPrivacy(nextAccount.email);
    applyWorkspace(loadWorkspace(nextAccount));
    setPrivacyPreferences(privacy);
    setSavedAccount(nextAccount);
    setOnboarding(localStorage.getItem(onboardingKey(nextAccount.email)) === "true");
    startSession(nextAccount, !privacy.lockOnClose);
    setAccount(nextAccount);
    return null;
  };
  const finishOnboarding = () => {
    if (account) localStorage.removeItem(onboardingKey(account.email));
    setMobileMenu(false);
    setOnboarding(false);
    navigate("Home");
  };
  const changePrivacyPreference = (key: keyof PrivacyPreferences) => {
    if (!account) return;
    setPrivacyPreferences((current) => {
      const updated = { ...current, [key]: !current[key] };
      localStorage.setItem(privacyKey(account.email), JSON.stringify(updated));
      if (key === "lockOnClose") {
        if (updated.lockOnClose) localStorage.removeItem(persistentKey(account.email));
        else localStorage.setItem(persistentKey(account.email), "active");
      }
      return updated;
    });
  };
  const signOut = () => {
    if (account) localStorage.removeItem(persistentKey(account.email));
    sessionStorage.removeItem("trace-session");
    sessionStorage.removeItem("trace-session-email");
    setPrivacyOpen(false);
    setToast("");
    setAccount(null);
  };
  if (!account) return <AuthScreen lastEmail={savedAccount?.email || ""} onSignup={signup} onLogin={login} />;
  return (
    <div className="app-shell">
      <AppHeader active={active} account={account} onProfile={() => setProfileMenu(true)} onAccount={() => setPrivacyOpen(true)} onLog={() => setNewCaseModal(true)} onMenu={() => setMobileMenu(true)} />
      <Sidebar page={page} active={active} open={mobileMenu} onPage={navigate} onClose={() => setMobileMenu(false)} onProfile={() => setProfileMenu(true)} onPrivacy={() => setPrivacyOpen(true)} />
      <main className="main-content">
        {openedCase ? <CaseDetail profile={active} healthCase={openedCase} episodes={activeEpisodes} onBack={() => setOpenedCase(null)} onAdd={() => setLoggingCase(openedCase)} onPrepare={() => { setSummaryCase(openedCase); setOpenedCase(null); setPage("Case Summaries"); }} onRemove={() => setCaseToRemove(openedCase)} onDeleteEpisode={setEpisodeToDelete} onStatusChange={updateCaseStatus} /> : <>
          {page === "Home" && <Home profile={active} accountName={account.name} cases={activeCases} onPage={navigate} onOpenCase={setOpenedCase} onNewCase={() => setNewCaseModal(true)} />}
          {page === "Timeline" && <Timeline profile={active} episodes={activeEpisodes} cases={activeCases} onLog={setLoggingCase} onNewCase={() => setNewCaseModal(true)} onDelete={setEpisodeToDelete} />}
          {page === "Patterns" && <Patterns profile={active} cases={activeCases} onOpenCase={setOpenedCase} />}
          {page === "My Cases" && <History profile={active} cases={activeCases} onOpenCase={setOpenedCase} onNewCase={() => setNewCaseModal(true)} />}
          {page === "Case Summaries" && <CareSummary key={active.id} profile={active} allEpisodes={activeEpisodes} cases={activeCases} initialCase={summaryCase || undefined} />}
        </>}
      </main>
      {profileMenu && <ProfileMenu active={active} profiles={profileList} onSelect={selectProfile} onClose={() => setProfileMenu(false)} onAdd={() => { setProfileMenu(false); setAddProfile(true); }} />}
      {addProfile && <AddProfileModal onClose={() => setAddProfile(false)} onCreate={createProfile} />}
      {newCaseModal && <NewCaseModal profile={active} onClose={() => setNewCaseModal(false)} onCreate={createCase} />}
      {loggingCase && <LogModal profile={active} healthCase={loggingCase} onClose={() => setLoggingCase(null)} onSave={saveEpisode} />}
      {caseToRemove && <RemoveCaseModal healthCase={caseToRemove} onClose={() => setCaseToRemove(null)} onConfirm={removeCase} />}
      {episodeToDelete && <DeleteEpisodeModal episode={episodeToDelete} onClose={() => setEpisodeToDelete(null)} onConfirm={deleteEpisode} />}
      {privacyOpen && <PrivacySettingsModal account={account} preferences={privacyPreferences} onChange={changePrivacyPreference} onClose={() => setPrivacyOpen(false)} onSignOut={signOut} />}
      {onboarding && <OnboardingTour page={page} onNavigate={navigate} onMobileMenu={setMobileMenu} onFinish={finishOnboarding} />}
      {toast && <div className="toast"><span><Icon name="check" size={17} /></span>{toast}</div>}
    </div>
  );
}
