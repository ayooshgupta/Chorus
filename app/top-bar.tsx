import SettingsSheet, { type HeaderMembership } from './settings-sheet';

export type { HeaderMembership };

export default function TopBar({
  email,
  avatarUrl,
  active,
  memberships
}: {
  email: string;
  avatarUrl: string;
  active: HeaderMembership;
  memberships: HeaderMembership[];
}) {
  return (
    <SettingsSheet email={email} avatarUrl={avatarUrl} active={active} memberships={memberships} />
  );
}
