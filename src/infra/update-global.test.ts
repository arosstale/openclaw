import path from "node:path";
import { describe, it, expect } from "vitest";
import { detectGlobalInstallManagerForRoot } from "./update-global.js";

describe("detectGlobalInstallManagerForRoot", () => {
  it("detects pnpm when pkgRoot is in CAS store", async () => {
    // Simulate global root being .../node_modules
    const mockGlobalRoot = path.resolve("/mock/global/node_modules");
    // Simulate pkgRoot being in CAS
    const mockPkgRoot = path.resolve(
      "/mock/global/node_modules/.pnpm/openclaw@1.0.0/node_modules/openclaw",
    );

    const runCommand = async (argv: string[]) => {
      if (argv[0] === "pnpm" && argv[1] === "root" && argv[2] === "-g") {
        return { stdout: mockGlobalRoot, stderr: "", code: 0 };
      }
      return { stdout: "", stderr: "", code: 1 };
    };

    const manager = await detectGlobalInstallManagerForRoot(runCommand, mockPkgRoot, 1000);
    expect(manager).toBe("pnpm");
  });

  it("detects npm standard install", async () => {
    const mockGlobalRoot = path.resolve("/mock/global/node_modules");
    const mockPkgRoot = path.resolve("/mock/global/node_modules/openclaw");

    const runCommand = async (argv: string[]) => {
      if (argv[0] === "npm" && argv[1] === "root" && argv[2] === "-g") {
        return { stdout: mockGlobalRoot, stderr: "", code: 0 };
      }
      return { stdout: "", stderr: "", code: 1 };
    };

    const manager = await detectGlobalInstallManagerForRoot(runCommand, mockPkgRoot, 1000);
    expect(manager).toBe("npm");
  });
});
