import { exec } from "node:child_process";
import type { ProcessEnvOptions } from "node:child_process";
import { readdir, readFile, writeFile } from "node:fs/promises";

import type Anthropic from "@anthropic-ai/sdk";

export const tools: Anthropic.Tool[] = [
  {
    name: "list_files",
    description: "List files and directories at a given path.",
    input_schema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Directory path to list. Defaults to current directory.",
        },
      },
      required: [],
    },
  },
  {
    name: "read_file",
    description: "Read the contents of a file.",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Path to the file to read." },
      },
      required: ["path"],
    },
  },
  {
    name: "write_file",
    description: "Write content to a file, creating it if it doesn't exist.",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Path to the file to write." },
        content: {
          type: "string",
          description: "Content to write to the file.",
        },
      },
      required: ["path", "content"],
    },
  },
  {
    name: "run_command",
    description: "Run a shell command and return its output.",
    input_schema: {
      type: "object",
      properties: {
        command: { type: "string", description: "Shell command to execute." },
      },
      required: ["command"],
    },
  },
];

export const webSearchTool: Anthropic.WebSearchTool20260209 = {
  type: "web_search_20260209",
  name: "web_search",
};

export function getTools(mode: string): Anthropic.Tool[] {
  return [
    ...tools.filter((tool) => {
      if (mode === "read-only") {
        return ["list_files", "read_file"].includes(tool.name);
      }
      return true;
    }),
  ];
}

type ToolResult = { content: string; isError: boolean };

export const runTool = async ({
  name,
  input,
}: {
  name: string;
  input: unknown;
}): Promise<ToolResult> => {
  const args: Record<string, string> =
    typeof input === "object" && input !== null
      ? (input as Record<string, string>)
      : {};

  try {
    switch (name) {
      case "list_files":
        return await listFiles(args);
      case "read_file":
        return await readFileTool(args);
      case "write_file":
        return await writeFileTool(args);
      case "run_command":
        return await runCommandTool(args);
      default:
        return { content: `Unknown tool: ${name}`, isError: true };
    }
  } catch (error) {
    return {
      content: error instanceof Error ? error.message : String(error),
      isError: true,
    };
  }
};

const listFiles = async (args: Record<string, string>): Promise<ToolResult> => {
  const { path = "." } = args;
  process.stdout.write(`\n[Tool: list_files] ${path}\n`);
  const entries = await readdir(path, { withFileTypes: true });
  const lines = entries.map((entry) =>
    entry.isDirectory() ? `${entry.name}/` : entry.name,
  );
  return { content: lines.join("\n"), isError: false };
};

const readFileTool = async (
  args: Record<string, string>,
): Promise<ToolResult> => {
  const { path } = args;
  process.stdout.write(`\n[Tool: read_file] ${path}\n`);
  if (!path) {
    return { content: "read_file requires a 'path' string.", isError: true };
  }
  return { content: await readFile(path, "utf-8"), isError: false };
};

const writeFileTool = async (
  args: Record<string, string>,
): Promise<ToolResult> => {
  const { content, path } = args;
  process.stdout.write(`\n[Tool: write_file] ${path}\n`);
  if (content === undefined) {
    return {
      content: "write_file requires a 'content' string.",
      isError: true,
    };
  }
  if (!path)
    return { content: "write_file requires a 'path' string.", isError: true };
  await writeFile(path, content, "utf-8");
  return {
    content: `Wrote ${content.length} bytes to ${path}.`,
    isError: false,
  };
};

const runCommandTool = async (
  args: Record<string, string>,
): Promise<ToolResult> => {
  const { command } = args;
  process.stdout.write(`\n[Tool: run_command] ${command}\n`);
  if (!command)
    return {
      content: "run_command requires a 'command' string.",
      isError: true,
    };
  const output = await runCommand(command, process.cwd());
  return { content: output || "(no output)", isError: false };

  function runCommand(
    command: string,
    cwd: ProcessEnvOptions["cwd"],
  ): Promise<string> {
    const config = { cwd };
    return new Promise((resolve, reject) => {
      exec(command, config, (error, stdout, stderr) => {
        if (error) {
          reject(stderr);
        } else {
          resolve(stdout.trim());
        }
      });
    });
  }
};
