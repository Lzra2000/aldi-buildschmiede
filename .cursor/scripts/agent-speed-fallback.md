# Agent-Speed-Fallback

Parent-Agenten nutzen dieses Skript, wenn ein Task-Subagent zu langsam ist oder hängt.

**Regel (verbindlich):** `.cursor/rules/fast-model-fallback.mdc`

## Schnellwahl

```powershell
python .cursor/scripts/agent-speed-fallback.py --work ui_css --from cursor-grok-4.6-high-fast --reason stall
python .cursor/scripts/agent-speed-fallback.py --work js_lua --from composer-2.5-fast --reason interrupt
python .cursor/scripts/agent-speed-fallback.py --work calc_re --from cursor-grok-4.6-high-fast --reason timeout
python .cursor/scripts/agent-speed-fallback.py --list-work
```

## Schwellen (Parent beobachtet)

| Signal | Schwelle |
|---|---|
| Kein Fortschritt | ~2–3 Minuten |
| Wiederholte Interrupts | 2× |
| Resume-Timeout | sofort neu starten |

## Erlaubte Modelle

- `cursor-grok-4.6-high-fast` — Standard-Qualität (Erststart)
- `composer-2.5-fast` — maximale Geschwindigkeit (UI, Verify, Organize)
- `cursor-grok-4.5-high-fast` — schnelleres Grok (Calc/RE nach Stall)
- `claude-opus-5-thinking-high` — **nur** schwere Reasoning-Aufgaben, **nie** Speed-Fallback
- `gpt-5.6-sol-medium` — nicht für Stall-Fallback
- `inherit` — Parent-Modell; nicht für gezielten Fallback

## Parent-Verhalten

1. Background-Task läuft mit `run_in_background: true`.
2. Parent arbeitet parallel weiter (Multitask, max 50).
3. Bei Stall: Task **interrupten** → Script → **neuer** Task mit empfohlenem Modell.
4. Kein Doppel-Schreiben: erst interrupten, dann Twin starten.

## Hook

`.cursor/hooks/subagent-stop-fallback.py` (Event `subagentStop`) misst Laufzeit und injiziert bei langsamen Stops eine `followup_message` für den Parent. Hooks **erinnern** nur — der Neustart passiert durch den Parent gemäß Regel.
