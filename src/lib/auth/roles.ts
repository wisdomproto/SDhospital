export type Role = "staff" | "referring_vet" | "owner";

export function isStaff(role: Role | null | undefined): boolean {
  return role === "staff";
}

export function homePathForRole(role: Role): string {
  return role === "staff" ? "/" : "/portal";
}
