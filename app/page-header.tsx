export default function PageHeader({
  householdName,
  stat
}: {
  householdName: string;
  stat?: string;
}) {
  return (
    <div style={{ marginBottom: 22 }}>
      <h1 style={{ marginBottom: 2 }}>{householdName}</h1>
      {stat ? <p className="sub" style={{ margin: 0 }}>{stat}</p> : null}
    </div>
  );
}
