export type WorkspaceCoreEnv = {
  url: string;
  secretKey: string;
};

export function getWorkspaceCoreEnv(): WorkspaceCoreEnv {
  const url = (process.env.WORKSPACE_CORE_SUPABASE_URL?.trim() || "").replace(/\/+$/, "");
  const secretKey =
    process.env.WORKSPACE_CORE_SUPABASE_SECRET_KEY?.trim() ||
    process.env.WORKSPACE_CORE_SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    "";

  return { url, secretKey };
}

export function isWorkspaceCoreConfigured(): boolean {
  const { url, secretKey } = getWorkspaceCoreEnv();
  return Boolean(url && secretKey);
}
