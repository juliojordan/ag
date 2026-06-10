import type { Dirent } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const SKILLS_DIR = fileURLToPath(new URL("../skills/", import.meta.url));

function getSkillMeta(
  src: string,
): [name: string | undefined, description: string | undefined] {
  const name = src.match(/^name:\s*(.+)$/m)?.[1]?.trim();
  const description = src.match(/^description:\s*(.+)$/m)?.[1]?.trim();
  return [name, description];
}

export const getSkills = async (): Promise<string> => {
  let directories: Dirent<string>[];
  try {
    directories = await readdir(SKILLS_DIR, { withFileTypes: true });
  } catch {
    return ""; // no skills/ dir
  }
  const lines: string[] = [];
  for (const directory of directories) {
    if (!directory.isDirectory()) continue;
    const path = `${SKILLS_DIR}${directory.name}/SKILL.md`;
    let [name, description] = getSkillMeta(await readFile(path, "utf-8"));
    name = name ?? directory.name;
    if (description) lines.push(`- ${name} (${path}): ${description}`);
  }
  if (lines.length === 0) return "";
  return [
    "Available skills. When one is relevant to the task, read its SKILL.md file",
    "with the read_file tool to load the full instructions, then follow them.",
    ...lines,
  ].join("\n");
};
