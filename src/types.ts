// Shape of the JSON Claude Code passes to a statusLine command via stdin.
// Many fields are optional or null — see https://code.claude.com/docs/en/statusline
// ("Fields that may be absent" / "Fields that may be null"). Access defensively.

export interface StatuslineInput {
  cwd?: string;
  session_id?: string;
  session_name?: string;
  transcript_path?: string;
  version?: string;
  exceeds_200k_tokens?: boolean;

  model?: { id?: string; display_name?: string };

  workspace?: {
    current_dir?: string;
    project_dir?: string;
    added_dirs?: string[];
    git_worktree?: string;
    repo?: { host?: string; owner?: string; name?: string };
  };

  output_style?: { name?: string };

  cost?: {
    total_cost_usd?: number;
    total_duration_ms?: number;
    total_api_duration_ms?: number;
    total_lines_added?: number;
    total_lines_removed?: number;
  };

  // `used_percentage` is input-only and may be null early in a session / after /compact.
  context_window?: {
    total_input_tokens?: number;
    total_output_tokens?: number;
    context_window_size?: number;
    used_percentage?: number | null;
    remaining_percentage?: number | null;
    current_usage?: {
      input_tokens?: number;
      output_tokens?: number;
      cache_creation_input_tokens?: number;
      cache_read_input_tokens?: number;
    } | null;
  };

  effort?: { level?: string };
  thinking?: { enabled?: boolean };

  // Only for Claude.ai Pro/Max, and only after the first API response.
  rate_limits?: {
    five_hour?: { used_percentage?: number; resets_at?: number };
    seven_day?: { used_percentage?: number; resets_at?: number };
  };

  vim?: { mode?: string };
  agent?: { name?: string };
  pr?: { number?: number; url?: string; review_state?: string };
  worktree?: {
    name?: string;
    path?: string;
    branch?: string;
    original_cwd?: string;
    original_branch?: string;
  };
}

// ---- Transcript-derived state (parsed from transcript_path JSONL) ----

export type TodoStatus = "pending" | "in_progress" | "completed";

export interface TodoState {
  total: number;
  completed: number;
  inProgress: number;
  pending: number;
  active?: string; // content of the in_progress item, if any
}

export interface AgentState {
  type: string; // subagent_type
  description: string;
  running: boolean;
}

export interface TranscriptState {
  activeTool?: string; // tool currently in-flight (tool_use without a result)
  recentTools: string[]; // most-recent distinct tool names, newest first
  todos?: TodoState;
  agents: AgentState[]; // Task subagents seen in the tail window
  runningAgents: number;
}

// Assembled context handed to every segment renderer.
export interface Ctx {
  input: StatuslineInput;
  transcript: TranscriptState;
  cwd: string;
  sessionId: string;
  config: import("./config").Config;
  theme: import("./theme").Theme;
}
