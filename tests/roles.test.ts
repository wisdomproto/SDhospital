import { describe, it, expect } from "vitest";
import { isStaff, homePathForRole, type Role } from "@/lib/auth/roles";

describe("roles", () => {
  it("identifies staff", () => {
    expect(isStaff("staff")).toBe(true);
    expect(isStaff("owner")).toBe(false);
  });
  it("routes each role to its home", () => {
    const cases: [Role, string][] = [
      ["staff", "/"],
      ["referring_vet", "/portal"],
      ["owner", "/portal"],
    ];
    for (const [role, path] of cases) expect(homePathForRole(role)).toBe(path);
  });
});
