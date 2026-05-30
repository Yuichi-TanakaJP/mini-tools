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
    background: "#f8fafc",
  },
  shell: {
    maxWidth: 1080,
    margin: "0 auto",
  },
  skeletonHero: {
    width: "min(720px, 100%)",
    height: 154,
    borderRadius: 18,
    background: "linear-gradient(90deg, #e2e8f0, #f1f5f9, #e2e8f0)",
    marginBottom: 20,
  },
  skeletonPanel: {
    height: 96,
    borderRadius: 18,
    background: "linear-gradient(90deg, #e2e8f0, #f1f5f9, #e2e8f0)",
    marginBottom: 16,
  },
  skeletonTable: {
    height: 320,
    borderRadius: 18,
    background: "linear-gradient(90deg, #e2e8f0, #f1f5f9, #e2e8f0)",
  },
};
