export default function Loading() {
  return (
    <main style={styles.page}>
      <div style={styles.shell}>
        <div style={styles.skeletonHero} />
        <div style={styles.skeletonPanel} />
        <div style={styles.skeletonTable} />
      </div>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    padding: "24px 16px 72px",
    background: "var(--color-bg)",
  },
  shell: {
    maxWidth: 1080,
    margin: "0 auto",
  },
  skeletonHero: {
    width: "min(720px, 100%)",
    height: 154,
    borderRadius: 18,
    background: "linear-gradient(90deg, var(--color-neutral-bg), var(--color-bg-subtle), var(--color-neutral-bg))",
    marginBottom: 20,
  },
  skeletonPanel: {
    height: 96,
    borderRadius: 18,
    background: "linear-gradient(90deg, var(--color-neutral-bg), var(--color-bg-subtle), var(--color-neutral-bg))",
    marginBottom: 16,
  },
  skeletonTable: {
    height: 320,
    borderRadius: 18,
    background: "linear-gradient(90deg, var(--color-neutral-bg), var(--color-bg-subtle), var(--color-neutral-bg))",
  },
};
