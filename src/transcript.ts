// Tail-read + parse of the transcript JSONL to derive live activity:
// active tool, recent tools, todo progress, running subagents.
//
// Performance: a session transcript grows to many MB. We never read the whole
// file — we seek to the last `tailBytes` and parse only those lines. Cost is
// O(tailBytes), flat regardless of session length. The first (likely partial)
// line in the window is discarded.
//
// Schema (observed from real transcripts):
//   { type, sessionId, uuid, parentUuid, isSidechain, message, toolUseResult, ... }
//   - assistant entries: message.content[] includes { type:"tool_use", id, name, input }
//   - user entries:      message.content[] includes { type:"tool_result", tool_use_id }
//   - isSidechain:true marks subagent (Task) transcript lines.

import type { TranscriptState, TodoState, AgentState, TodoStatus } from "./types";

interface ToolUse {
  id: string;
  name: string;
  input: Record<string, any>;
}

const EMPTY: TranscriptState = { recentTools: [], agents: [], runningAgents: 0 };

export async function parseTranscript(
  path: string | undefined,
  tailBytes: number,
  recentToolsN: number,
): Promise<TranscriptState> {
  if (!path) return EMPTY;

  let text: string;
  try {
    const file = Bun.file(path);
    const size = file.size;
    if (!size) return EMPTY;
    const start = Math.max(0, size - tailBytes);
    text = await file.slice(start).text();
  } catch {
    return EMPTY;
  }

  const lines = text.split("\n");
  // Drop the first line if we started mid-file — it is almost certainly partial.
  if (windowLikelyTruncated(text, tailBytes)) lines.shift();

  const toolUses: ToolUse[] = []; // in file order
  const completedIds = new Set<string>();
  let lastTodos: TodoState | undefined;

  for (const line of lines) {
    if (!line) continue;
    let o: any;
    try {
      o = JSON.parse(line);
    } catch {
      continue; // truncated / non-JSON line
    }
    const content = o?.message?.content;
    if (!Array.isArray(content)) continue;

    for (const c of content) {
      if (c?.type === "tool_use" && c.name) {
        toolUses.push({ id: c.id, name: c.name, input: c.input ?? {} });
        if (c.name === "TodoWrite") {
          const t = summarizeTodos(c.input?.todos);
          if (t) lastTodos = t; // keep the most recent TodoWrite
        }
      } else if (c?.type === "tool_result" && c.tool_use_id) {
        completedIds.add(c.tool_use_id);
      }
    }
  }

  // Active tool = the last tool_use that has no matching result yet.
  let activeTool: string | undefined;
  for (let i = toolUses.length - 1; i >= 0; i--) {
    if (!completedIds.has(toolUses[i].id)) {
      activeTool = toolUses[i].name;
      break;
    }
  }

  // Recent distinct tool names, newest first.
  const recentTools: string[] = [];
  for (let i = toolUses.length - 1; i >= 0 && recentTools.length < recentToolsN; i--) {
    const n = toolUses[i].name;
    if (!recentTools.includes(n)) recentTools.push(n);
  }

  // Subagents: Task tool_use entries; running = no result yet.
  const agents: AgentState[] = [];
  for (const tu of toolUses) {
    if (tu.name !== "Task" && tu.name !== "Agent") continue;
    agents.push({
      type: tu.input?.subagent_type ?? tu.input?.agentType ?? "agent",
      description: tu.input?.description ?? "",
      running: !completedIds.has(tu.id),
    });
  }

  return {
    activeTool,
    recentTools,
    todos: lastTodos,
    agents,
    runningAgents: agents.filter((a) => a.running).length,
  };
}

// We truncated if the tail window is smaller than the file — approximated by
// whether we asked for fewer bytes than the text we could hold. Kept simple:
// if the window is full-ish, assume the leading line is partial.
function windowLikelyTruncated(text: string, tailBytes: number): boolean {
  return text.length >= tailBytes - 1;
}

function summarizeTodos(todos: any): TodoState | undefined {
  if (!Array.isArray(todos) || todos.length === 0) return undefined;
  let completed = 0,
    inProgress = 0,
    pending = 0,
    active: string | undefined;
  for (const t of todos) {
    const s = t?.status as TodoStatus;
    if (s === "completed") completed++;
    else if (s === "in_progress") {
      inProgress++;
      active = t?.activeForm || t?.content || active;
    } else pending++;
  }
  return { total: todos.length, completed, inProgress, pending, active };
}
