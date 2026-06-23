import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  TextareaHTMLAttributes,
} from "react";
import { forwardRef } from "react";

type Tone = "blue" | "green" | "orange" | "red" | "purple" | "neutral";
type BannerTone = "info" | "success" | "warning" | "error";
type ButtonVariant = "primary" | "secondary" | "danger" | "ghost" | "icon";

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export type OutreachShellProps = {
  sidebar: ReactNode;
  children: ReactNode;
  detail?: ReactNode;
  className?: string;
};

export function OutreachShell({ sidebar, children, detail, className }: OutreachShellProps) {
  return (
    <div className={cx("outreach-ui-shell", detail ? "has-detail" : "", className)}>
      {sidebar}
      <main className="outreach-main">{children}</main>
      {detail ? <aside className="outreach-detail-panel">{detail}</aside> : null}
    </div>
  );
}

export type OutreachSidebarItem = {
  id: string;
  label: string;
  icon?: ReactNode;
  badge?: ReactNode;
};

export type OutreachSidebarProps = {
  brand: string;
  subtitle: string;
  activeId: string;
  items: OutreachSidebarItem[];
  footer?: ReactNode;
  onSelect?: (id: string) => void;
};

export function OutreachSidebar({ brand, subtitle, activeId, items, footer, onSelect }: OutreachSidebarProps) {
  return (
    <aside className="outreach-sidebar" aria-label="外联导航">
      <div className="outreach-brand">
        <div className="outreach-brand-mark" aria-hidden="true">M</div>
        <div>
          <strong>{brand}</strong>
          <span>{subtitle}</span>
        </div>
      </div>
      <nav className="outreach-nav">
        {items.map((item) => {
          const active = item.id === activeId;
          return (
            <button
              aria-current={active ? "page" : undefined}
              className={cx("outreach-nav-item", active && "active")}
              key={item.id}
              onClick={() => onSelect?.(item.id)}
              type="button"
            >
              {item.icon ? <span className="outreach-nav-icon">{item.icon}</span> : null}
              <span>{item.label}</span>
              {item.badge ? <span className="outreach-nav-badge">{item.badge}</span> : null}
            </button>
          );
        })}
      </nav>
      {footer ? <div className="outreach-sidebar-footer">{footer}</div> : null}
    </aside>
  );
}

export type OutreachPageHeaderProps = {
  title: string;
  description?: string;
  action?: ReactNode;
};

export function OutreachPageHeader({ title, description, action }: OutreachPageHeaderProps) {
  return (
    <header className="outreach-page-header">
      <div>
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </div>
      {action ? <div className="outreach-page-action">{action}</div> : null}
    </header>
  );
}

export type OutreachButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  loading?: boolean;
};

export function OutreachButton({
  variant = "secondary",
  loading = false,
  className,
  children,
  disabled,
  type = "button",
  ...props
}: OutreachButtonProps) {
  const busy = Boolean(loading || props["aria-busy"]);

  return (
    <button
      {...props}
      aria-busy={busy ? true : undefined}
      className={cx("outreach-button", variant, loading && "loading", className)}
      data-feedback="button"
      data-loading={busy ? true : undefined}
      disabled={disabled || loading}
      type={type}
    >
      {loading ? <span className="outreach-button-spinner" aria-hidden="true" /> : null}
      <span className="outreach-button-label">{children}</span>
    </button>
  );
}

export type OutreachFieldProps = {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
};

export function OutreachField({ id, label, hint, error, children }: OutreachFieldProps) {
  return (
    <div className={cx("outreach-field", error && "has-error")}>
      <label htmlFor={id}>{label}</label>
      {children}
      {error ? <span className="outreach-field-error">{error}</span> : null}
      {!error && hint ? <span className="outreach-field-hint">{hint}</span> : null}
    </div>
  );
}

export const OutreachInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function OutreachInput(props, ref) {
    return <input {...props} ref={ref} className={cx("outreach-input", props.className)} />;
  },
);

export function OutreachTextarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cx("outreach-textarea", props.className)} />;
}

export type OutreachBadgeProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: Tone;
};

export function OutreachBadge({ tone = "neutral", className, children, ...props }: OutreachBadgeProps) {
  return (
    <span className={cx("outreach-badge", tone, className)} {...props}>
      {children}
    </span>
  );
}

export type OutreachCardProps = HTMLAttributes<HTMLElement> & {
  title?: string;
  description?: string;
  icon?: ReactNode;
  actions?: ReactNode;
};

export function OutreachCard({ title, description, icon, actions, className, children, ...props }: OutreachCardProps) {
  return (
    <section className={cx("outreach-card", className)} {...props}>
      {title || description || actions ? (
        <div className="outreach-card-header">
          <div className="outreach-card-title-row">
            {icon ? <span className="outreach-card-icon">{icon}</span> : null}
            <div>
              {title ? <h2>{title}</h2> : null}
              {description ? <p>{description}</p> : null}
            </div>
          </div>
          {actions ? <div className="outreach-card-actions">{actions}</div> : null}
        </div>
      ) : null}
      <div className="outreach-card-body">{children}</div>
    </section>
  );
}

export type OutreachStatCardProps = {
  label: string;
  value: number | string;
  detail?: string;
  tone?: Tone;
  icon?: ReactNode;
};

export function OutreachStatCard({ label, value, detail, tone = "blue", icon }: OutreachStatCardProps) {
  return (
    <article className={cx("outreach-stat-card", tone)}>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        {detail ? <em>{detail}</em> : null}
      </div>
      <i aria-hidden="true">{icon}</i>
    </article>
  );
}

export type OutreachStatusBannerProps = {
  tone?: BannerTone;
  title: string;
  action?: ReactNode;
  children?: ReactNode;
};

export function OutreachStatusBanner({ tone = "info", title, action, children }: OutreachStatusBannerProps) {
  return (
    <div className={cx("outreach-status-banner", tone)} role={tone === "error" ? "alert" : "status"}>
      <div>
        <strong>{title}</strong>
        {children ? <p>{children}</p> : null}
      </div>
      {action ? <span className="outreach-status-action">{action}</span> : null}
    </div>
  );
}

export type OutreachSkeletonProps = {
  label: string;
  rows?: number;
};

export function OutreachSkeleton({ label, rows = 4 }: OutreachSkeletonProps) {
  return (
    <div className="outreach-skeleton" aria-label={label} aria-busy="true">
      {Array.from({ length: rows }).map((_, index) => (
        <span className="outreach-skeleton-row" key={index} />
      ))}
    </div>
  );
}

export type OutreachErrorStateProps = {
  title: string;
  action?: ReactNode;
  technicalDetails?: string;
  children?: ReactNode;
};

export function OutreachErrorState({ title, action, technicalDetails, children }: OutreachErrorStateProps) {
  return (
    <section className="outreach-error-state" role="alert">
      <div>
        <strong>{title}</strong>
        {children ? <p>{children}</p> : null}
        {technicalDetails ? (
          <details>
            <summary>技术详情</summary>
            <pre>{technicalDetails}</pre>
          </details>
        ) : null}
      </div>
      {action ? <div className="outreach-error-action">{action}</div> : null}
    </section>
  );
}

export type OutreachUploadDropzoneProps = {
  title: string;
  description: string;
  action?: ReactNode;
};

export function OutreachUploadDropzone({ title, description, action }: OutreachUploadDropzoneProps) {
  return (
    <div className="outreach-upload-dropzone">
      <strong>{title}</strong>
      <p>{description}</p>
      {action ? <span className="outreach-upload-action">{action}</span> : null}
    </div>
  );
}

export type OutreachEvidenceCardProps = {
  title: string;
  sourceUrl?: string;
  confidence?: string;
  children?: ReactNode;
};

export function OutreachEvidenceCard({ title, sourceUrl, confidence, children }: OutreachEvidenceCardProps) {
  return (
    <article className="outreach-evidence-card">
      <div className="outreach-evidence-heading">
        <strong>{title}</strong>
        {confidence ? <OutreachBadge tone="blue">{confidence}</OutreachBadge> : null}
      </div>
      <p>{children}</p>
      {sourceUrl ? <a href={sourceUrl}>{sourceUrl}</a> : null}
    </article>
  );
}

export type OutreachEmailEditorProps = {
  subject: string;
  body: string;
  subjectLabel?: string;
  bodyLabel?: string;
  onSubjectChange?: (value: string) => void;
  onBodyChange?: (value: string) => void;
};

export function OutreachEmailEditor({
  subject,
  body,
  subjectLabel = "邮件主题",
  bodyLabel = "邮件正文",
  onSubjectChange,
  onBodyChange,
}: OutreachEmailEditorProps) {
  return (
    <section className="outreach-email-editor">
      <OutreachField id="outreach-email-subject" label={subjectLabel}>
        <OutreachInput
          id="outreach-email-subject"
          value={subject}
          onChange={(event) => onSubjectChange?.(event.currentTarget.value)}
          readOnly={!onSubjectChange}
        />
      </OutreachField>
      <OutreachField id="outreach-email-body" label={bodyLabel}>
        <OutreachTextarea
          id="outreach-email-body"
          value={body}
          onChange={(event) => onBodyChange?.(event.currentTarget.value)}
          readOnly={!onBodyChange}
        />
      </OutreachField>
    </section>
  );
}

export type OutreachLeadRowProps = {
  company: string;
  email: string;
  website?: string;
  status: string;
  score?: number;
  selected?: boolean;
  checked?: boolean;
  mark?: ReactNode;
  selectLabel?: string;
  onToggle?: () => void;
  onSelect?: () => void;
};

export function OutreachLeadRow({
  company,
  email,
  website,
  status,
  score,
  selected = false,
  checked,
  mark,
  selectLabel,
  onToggle,
  onSelect,
}: OutreachLeadRowProps) {
  return (
    <article className={cx("outreach-lead-row", selected && "selected")}>
      {typeof checked === "boolean" ? (
        <input
          aria-label={selectLabel ?? `选择 ${company}`}
          checked={checked}
          className="outreach-lead-checkbox"
          onChange={onToggle}
          onClick={(event) => event.stopPropagation()}
          type="checkbox"
        />
      ) : (
        <span className="outreach-lead-checkbox" aria-hidden="true" />
      )}
      <button className="outreach-lead-content" onClick={onSelect} type="button">
        <span className="outreach-lead-mark" aria-hidden="true">{mark ?? "C"}</span>
        <span className="outreach-lead-main">
          <strong>{company}</strong>
          <span>{email}{website ? ` · ${website}` : ""}</span>
        </span>
        <span className="outreach-lead-meta">
          <em>{status}</em>
          {typeof score === "number" ? <OutreachQualityScore score={score} /> : null}
        </span>
      </button>
    </article>
  );
}

export type OutreachQualityScoreProps = {
  score: number;
  label?: string;
};

export function OutreachQualityScore({ score, label }: OutreachQualityScoreProps) {
  const tone = score >= 90 ? "excellent" : score >= 80 ? "good" : score >= 60 ? "warn" : "bad";
  return (
    <span className={cx("outreach-quality-score", tone)}>
      <strong>{score}</strong>
      <span>{label ?? (score >= 80 ? "可发送" : "需要重写")}</span>
    </span>
  );
}

export type OutreachEmptyStateProps = {
  title: string;
  description: string;
  action?: ReactNode;
  icon?: ReactNode;
};

export function OutreachEmptyState({ title, description, action, icon }: OutreachEmptyStateProps) {
  return (
    <div className="outreach-empty-state">
      <div className="outreach-empty-icon" aria-hidden="true">{icon}</div>
      <strong>{title}</strong>
      <p>{description}</p>
      {action ? <div className="outreach-empty-action">{action}</div> : null}
    </div>
  );
}

export type OutreachStickyActionBarProps = HTMLAttributes<HTMLDivElement> & {
  children?: ReactNode;
};

export function OutreachStickyActionBar({ className, children, ...props }: OutreachStickyActionBarProps) {
  return (
    <div className={cx("outreach-sticky-action-bar", className)} {...props}>
      {children}
    </div>
  );
}

export type OutreachTimelineStep = {
  label: string;
  detail?: string;
  state: "complete" | "current" | "waiting" | "failed";
};

export type OutreachTimelineProps = {
  steps: OutreachTimelineStep[];
};

export function OutreachTimeline({ steps }: OutreachTimelineProps) {
  return (
    <ol className="outreach-ai-timeline">
      {steps.map((step) => (
        <li className={cx("outreach-timeline-step", step.state)} key={step.label}>
          <span className="outreach-timeline-dot" aria-hidden="true" />
          <div>
            <strong>{step.label}</strong>
            {step.detail ? <p>{step.detail}</p> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
