export function newInviteToken(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

export function inviteUrl(host: string, token: string): string {
  const proto = host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https";
  return `${proto}://${host}/invite/${token}`;
}
