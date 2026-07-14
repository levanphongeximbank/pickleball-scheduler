# PR-5 Visual Evidence Checklist

Local/worktree only — **no Production deploy**.

| # | Screen | How to capture |
|---|--------|----------------|
| 1 | Rule set list | Open `/admin/ai-pairing/private-rules` with flags ON as SUPER_ADMIN |
| 2 | Create rule set | Click **Tạo bộ quy tắc** |
| 3 | Rule form Hard | Add rule, severity Hard — warning banner visible |
| 4 | Rule form Soft | Severity Soft — weight enabled |
| 5 | Conflict fatal | Tab **Xung đột / Version** → Kiểm tra xung đột |
| 6 | Simulation Top N | Tab **Mô phỏng** (sim flag ON) |
| 7 | Candidate explanation | Expand “Tại sao AI ghép như vậy?” |
| 8 | Audit log | Tab Audit (`.audit` permission) |
| 9 | 403 other role | Open route as non–super-admin → `403_FORBIDDEN` |
| 10 | Feature flag OFF | Menu hidden; page warning |
| 11 | Mobile view | Narrow viewport — single column stacks |

If Staging RPC unavailable: UI shows backend error; simulation/list can use test mocks.
