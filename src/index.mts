#!/usr/bin/env node

import * as readline from "node:readline";

import Anthropic, { type ParsedMessage } from "@anthropic-ai/sdk";

import { runTool, tools, webSearchTool } from "./tools.mjs";
import { getSkills } from "./skills.mjs";
import { getSystemPrompt } from "./utils.mjs";

const client = new Anthropic();
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const SYSTEM_PROMPT = `You are a coding agent. You help users write, edit, and reason about code.

You have access to tools to read and write files, run shell commands, and search the web. Use them to get things done, not just to advise.

When you complete a task, say so clearly and briefly.

Do not use emojis in your responses.`;

const MODEL = "claude-sonnet-4-6";

const contextWindow: Anthropic.MessageParam[] = [];

async function main() {
  while (true) {
    const maxContextWindowTokens = await getMaxContextWindowTokens(
      client,
      MODEL,
    );

    const prompt = await getPrompt();

    if (prompt === ".exit") {
      break;
    }

    contextWindow.push({ role: "user", content: prompt });

    while (true) {
      const stream = client.messages
        .stream({
          model: "claude-sonnet-4-6",
          max_tokens: 64000,
          tools: [...tools, webSearchTool],
          system: getSystemPrompt() + "\n\n" + (await getSkills()),
          messages: contextWindow,
        })
        .on("text", (text) => {
          process.stdout.write(text);
        });

      const response = await stream.finalMessage();

      contextWindow.push({ role: "assistant", content: response.content });

      if (response.stop_reason === "end_turn") {
        getTokenUsage(response, maxContextWindowTokens);
        break;
      }

      for (const toolUseBlock of getToolUses(response.content)) {
        const { content, isError } = await runTool(toolUseBlock);
        contextWindow.push({
          role: "user",
          content: [
            {
              type: "tool_result",
              tool_use_id: toolUseBlock.id,
              content,
              is_error: isError,
            },
          ],
        });
      }
    }
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => {
    rl.close();
  });

function getPrompt() {
  return new Promise<string>((resolve) => rl.question("\nYou: ", resolve));
}

function getToolUses(
  content: Anthropic.Messages.ContentBlock[],
): Anthropic.Messages.ToolUseBlock[] {
  return content.filter((contentBlock) => contentBlock.type === "tool_use");
}

function getTokenUsage(
  response: ParsedMessage<null>,
  maxContextWindowTokens: number,
) {
  const tokenCount = countTokens(response.usage);
  process.stdout.write(
    `\n ${tokenCount} / ${maxContextWindowTokens} (${Math.round((tokenCount / maxContextWindowTokens) * 100)}%)\n`,
  );
}

async function getMaxContextWindowTokens(
  client: Anthropic,
  model: string,
): Promise<number> {
  const DEFAULT_CONTEXT_WINDOW_TOKENS = 1_000_000;
  const { max_input_tokens } = await client.models.retrieve(model);
  const contextWindowTokens = max_input_tokens ?? DEFAULT_CONTEXT_WINDOW_TOKENS;
  return contextWindowTokens;
}

function countTokens(usage: Anthropic.Messages.Usage): number {
  const { input_tokens, output_tokens } = usage;
  return input_tokens + output_tokens;
}
