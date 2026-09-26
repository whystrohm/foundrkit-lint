# Contracts

Shared file formats for the WhyStrohm skills. Each skill stays in its own repo. They connect by
reading and writing the same files in a `brand/` folder in the user's project.

| File | Written by | Read by | Schema |
|---|---|---|---|
| `brand/voice-profile.json` | whystrohm-voice-extract | whystrohm-voice-scorer, `foundrkit-lint --from-brand` | `voice-profile.v1.schema.json` |
| `brand/foundrkit.rules.json` | `foundrkit-lint --from-brand`, or by hand | foundrkit-lint | `foundrkit-rules.v1.schema.json` |

The canonical schemas live in [whystrohm/shotkit](https://github.com/whystrohm/shotkit/tree/main/contracts).
Every other repo keeps a byte-identical copy, and its CI fails if the copy drifts. To change a
schema, change it in Shotkit first, then copy it into each repo that uses it.

A new version of a schema gets a new file (`v2`). A skill that reads the file checks `contract`
and `version` before it trusts the rest.

In this repo, `examples/foundrkit-rules.example.json` is a copy of Shotkit's example. The
`contracts` workflow checks that each schema is valid, that the example passes it, and that each
schema matches the canonical copy.

foundrkit-lint does not load these schemas at run time. It checks `contract`, `version` and the
required rule fields in plain JavaScript, so it keeps zero runtime dependencies.
