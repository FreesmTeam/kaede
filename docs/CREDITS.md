[<<< Back](../docs/README.md#credits-and-ai-usage)

# Credits and AI Usage

## Tools used

- [Vue.js 3](https://vuejs.org/)
- [Tauri v2](https://v2.tauri.app/)
- ...
- [Wails v3](https://v3.wails.io/)

## Used parts of code

- [Hash from a string](https://stackoverflow.com/a/65239086), by amirhe (CC BY-SA 4.0) / [Usage](../src/lib/hashing/hash-string.ts)
- [UUID generator like in Java](https://stackoverflow.com/a/51732778), by Mahesh Bongani (CC BY-SA 4.0) / [Usage](../src/lib/hashing/hash-offline-nickname.ts)
- [Greatest Common Divisor](https://stackoverflow.com/a/17445322), by Yannis (CC BY-SA 3.0) / [Usage](../src/lib/general/scopes/gcd.ts)
- [Process ID of very own process](https://stackoverflow.com/a/7690178), by Martin (CC BY-SA 3.0) / [Usage](../src/lib/launcher/scopes/__applet/src/Main.java)

## Assets used in README showcase

- [Blue Archive](https://www.nexon.com/main/en/Blue%20Archive/details)
- ...

## AI models used

All AI-generated code parts are specified in [AGENTS.md](../AGENTS.md), and you can also search for them by using a `ATTENTION: AI-generated` string. In summary, no AI was used for generating documentation, assets, etc. Almost every line of code was written by me, and ideas and implementation details were thought of by me as well.

- [Claude Fable 5](https://www.anthropic.com/claude/fable) - GitHub CI for Windows 7 builds, scripts for Windows 7 build verification and TypeBox validators compilation, Rust code, and reviewing.
- [Claude Opus 5](https://www.anthropic.com/news/claude-opus-5) - Tauri backend replica in Wails v3.
- [GPT-5.6-Sol](https://openai.com/en-US/index/gpt-5-6/) - GitHub CI for Windows 7, scripts for Windows 7 build verification, and Rust code.
- [Qwen 3.8-Max](https://chat.qwen.ai/) - Rust code, reviewing, and documentation proofreading.
- [Qwen 3.6-Plus](https://chat.qwen.ai/) - `verify_file_hash`.
- [DeepSeek V4 Flash/Pro](https://chat.deepseek.com/) - reviewing and documentation proofreading.
