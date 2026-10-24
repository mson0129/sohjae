# API compatibility fixture

`scv2-schema1.bin` is an immutable SCV2 operation log captured from the pre-stabilization collaborator WASM on 2026-10-24, before the schema-capability export was added. It contains Korean/emoji text, a structural table, a cell edit, and a row reorder (tag 9). `scv2-schema1.json` records its document identity and expected Markdown projection.

Do not regenerate this fixture as part of builds. `scripts/check_api_contracts.mjs` restores it into the current WASM and checks that incompatible or damaged envelopes cannot alter the restored document. Future codecs must preserve this reader path or provide an explicit, separately tested migration.

`scv2-all-operations.bin` is the collaboration stabilization baseline captured on 2026-10-24 with fixed document and actor identities. It covers every operation tag 0–9, including Unicode text, deletion, undo/redo activation, structural tables, row/column insertion/deletion/alignment and reordering. Its JSON companion records the expected projection, tables and operation count. `scripts/check_collab_contracts.mjs` reads it with an independent reference parser and checks exact WASM restore/re-export bytes. Do not regenerate this baseline during builds.
