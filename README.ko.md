# oh-my-cchud

> Claude Code용 성능 중심 HUD — 두 소스(native `statusLine` JSON(stdin) + 세션 transcript JSONL)를 빠른 세그먼트로 렌더링합니다.

[English](README.md) · **한국어**

```
[oh-my-cchud]  Opus  ⎇ main*3  ⇡ #1234 pending  ██████████░░░░ 73%  5h 41% (2h11m)  7d 88% (3d3h)
✱ high  ✻  code-reviewer ⟳1  ☑ 4/6 fixing transcript parser
```

터미널 하단 상태줄: 프로젝트 · 모델 · git · 컨텍스트 사용량 · rate limit · reasoning effort ·
서브에이전트 · todo 진행률. 별도 창/tmux 없음. Bun + TypeScript, 런타임 의존성 0개.

## 설치

### 플러그인

```bash
/plugin marketplace add choo121600/oh-my-cchud
/plugin install oh-my-cchud@oh-my-cchud
/reload-plugins          # 필수 — 플러그인 활성화. 이걸 안 하면 커맨드가 등록 안 됨
/oh-my-cchud:install     # 메인 statusLine 연결 — /plugin update 후 다시 실행
```

**Bun**이 PATH에 있어야 합니다(상태줄이 `bun`을 실행). 플러그인은 `subagentStatusLine`만 자동 적용하므로, `/oh-my-cchud:install`이 메인 HUD를 `~/.claude/settings.json`에 **업데이트에도 안 깨지는 고정 런처**로 연결합니다.
(푸시 전에 이미 마켓플레이스를 추가했다면 `/plugin marketplace update oh-my-cchud` 를 먼저 실행하세요.)

### 수동 연결 (clone)

`~/.claude/settings.json`:

```json
{
  "statusLine": {
    "type": "command",
    "command": "bun /절대경로/oh-my-cchud/src/statusline.ts",
    "refreshInterval": 2
  }
}
```

## 설정

`config.example.json` 을 `~/.claude/oh-my-cchud.json` 으로 복사해 덮어쓰면 됩니다 (기본값에 shallow-merge —
바꿀 키만 적어도 됨). `OH_MY_CCHUD_CONFIG` 또는 `${CLAUDE_PLUGIN_ROOT}/config.json` 도 인식합니다.

```json
{
  "theme": "default",
  "lines": [
    ["project", "model", "worktree", "git", "pr", "context", "rate"],
    ["effort", "thinking", "agents", "todos"]
  ],
  "context": { "barWidth": 14, "warn": 70, "crit": 90 },
  "rate": { "warn": 60, "crit": 85, "reset": "relative" },
  "transcript": { "tailBytes": 131072, "recentTools": 3 },
  "git": { "cacheMs": 3000 }
}
```

- **`lines`** — 각 배열이 한 줄, 값은 세그먼트 이름. 순서를 바꾸거나 한 줄로 합칠 수 있습니다. `worktree`/`pr`은 없으면 자동 생략.
- **`theme`** — `default`(Unicode) · `nerd`(Nerd Font) · `ascii`(평문). `OH_MY_CCHUD_THEME=ascii` 로 즉석 전환, `NO_COLOR` 존중.
- **`rate.reset`** — `relative`(in 2h12m) · `clock`(14:30) · `off`.

### 세그먼트

| 이름 | 표시 | 소스 | 기본 |
|------|------|------|:----:|
| `project` | `[이름]` 앵커 (project_dir basename) | stdin | ✅ |
| `model` | 모델 표시명 | stdin | ✅ |
| `context` | 컨텍스트 바 + % (녹→황→적), `/compact` 신호 | stdin | ✅ |
| `rate` | 5h/7d 소진율 + 초기화까지 남은 시간 `(2h12m)` | stdin (Pro/Max) | ✅ |
| `git` | 브랜치 + dirty 개수 (캐시됨, 브랜치는 리포 링크) | git + stdin | ✅ |
| `worktree` | worktree 이름:브랜치 | stdin | ✅ |
| `effort` | reasoning effort 레벨 (강도별 색) | stdin | ✅ |
| `thinking` | thinking 활성 (`✻`) | stdin | ✅ |
| `agents` | 실행 중 서브에이전트 | transcript | ✅ |
| `todos` | ☑ 완료/전체 + 진행 항목 | transcript | ✅ |
| `pr` | PR 번호 + 리뷰 상태 (클릭 링크, 열린 PR 있을 때만) | stdin | ✅ |
| `cost` | 비용 $ + 경과시간 `(12m34s)` | stdin | ⬜ |
| `tools` | ● 실행 중 / 최근 툴 | transcript | ⬜ |
| `output_style` | 비-default output style 이름 | stdin | ⬜ |

opt-in 세그먼트는 기본 비활성 — `lines`에 이름을 추가하면 켜집니다. ([왜 기본에서 뺐나](DESIGN.md#whats-shown-by-default--and-what-isnt))

**단일 라인** — 배열 하나로 합칩니다. 추론 상태를 모델 옆에 두면 읽기 좋습니다:

```json
{ "lines": [["project", "model", "effort", "thinking", "git", "context", "rate", "todos"]] }
```

## 단일 바이너리 빌드 (선택)

```bash
bun run build   # -> dist/cchud (자체 완결, bun 불필요)
```

## 미리보기

```bash
bun run scripts/demo.ts [transcript.jsonl]   # 라이브 세션 없이 테마 3종
```

## 더 보기

- 아키텍처 · 성능 · 설계 근거 — [DESIGN.md](DESIGN.md)
- 공식 statusLine 문서 — https://code.claude.com/docs/en/statusline
- 영감 — [jarrodwatts/claude-hud](https://github.com/jarrodwatts/claude-hud), [npow/oh-my-claude](https://github.com/npow/oh-my-claude)

## 라이센스

[MIT](LICENSE) © choo121600
