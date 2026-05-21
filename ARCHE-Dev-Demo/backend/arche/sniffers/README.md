# ARCHE Sniffer Domains

This folder separates ARCHE sniffers by the kind of input they observe.

## Domains

- `text/` watches conversational or text payload input. This is where lexical, semantic, entropy, repetition, rupture-language, and later relational-pattern sniffers belong.
- `network/` watches infrastructure/security events. This is where packet metadata, topology rupture, origin IDs, and distributed sensor input belong.
- `../signals.py` defines the shared signal contract that all sniffer domains emit.

## Rule

Sniffers should not talk directly to the UI and should not decide final behavior by themselves.

They emit normalized signals. The Core, Tribunal, Memory Manager, and Expression Gate decide what to do with those signals.

## Current staging

The uploaded ARCHE sniffer package has been split into staged text/security and network/security domains instead of being dropped into the demo root. This keeps BRUNEL stable while giving ARCHE a cleaner path toward multi-domain signal detection.
