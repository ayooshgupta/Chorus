import Link from 'next/link';

export default function PageHeader({
  householdName,
  subheading,
  settingsHref
}: {
  householdName: string;
  subheading: string;
  settingsHref?: string;
}) {
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ marginBottom: 2 }}>{householdName}</h1>
        {settingsHref ? (
          <Link
            href={settingsHref}
            aria-label="Household settings"
            style={{
              width: 34,
              height: 34,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-soft)',
              background: 'var(--surface-alt)',
              flex: 'none'
            }}
          >
            <span style={{ display: 'flex' }}>
              {
                // inline to avoid extra import cycles
              }
            </span>
          </Link>
        ) : null}
      </div>
      <p className="sub" style={{ margin: 0, fontSize: 13, fontWeight: 500, color: 'var(--accent-text)' }}>
        {subheading}
      </p>
    </div>
  );
}
