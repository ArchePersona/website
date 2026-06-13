# Brunel skins

This folder holds the Brunel appearance layer.

Mechanics stay universal in `Chat.jsx`.
Skins should only alter presentation: colors, fonts, borders, shadows, spacing, bubble treatment, backgrounds, and drawer/input styling.

Current production default: `desk`.

Available skin concepts:

- `desk` — warm bronze and ivory, old master builder's study.
- `phosphor` — classic green CRT / terminal legacy skin.
- `ledger` — parchment, notebook, record-keeping style.
- `night-study` — blue-black late-night study skin.
- `fireplace` — warm amber library / companion skin.

Core layout values currently used by Brunel:

```yaml
single_chat_width: 1180px
double_chat_width: 1240px
input_width: 980px
drawer_width: 280px
drawer_max_width: 86vw
bubble_width: min(76%, 76ch)
conversation_font: EB Garamond
ui_font: Inter
title_font: Audiowide
```

Do not put behavior, memory, model routing, auth, or chat mechanics in skin files.
