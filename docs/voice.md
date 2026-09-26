# Voice-over notes

VoidCrusade speaks through the browser's built-in **Web Speech API** (`speechSynthesis`).
No audio files are shipped, so the bundle stays small and the "no external assets" rule holds.

## How it works

- `src/systems/VoiceSystem.ts` picks the best installed voice for the current language
  (`ru-RU` in Russian, `en-US`/`en-GB` in English), preferring male voices when the name
  suggests one, and caches the choice. Voices load asynchronously; the list is refreshed on
  the `voiceschanged` event.
- Speakers have their own pitch/rate: the Commander is low and slow, Iron Guard deep,
  riflemen clipped, the announcer neutral.
- Lines have priorities (alerts > events > acknowledgements) and per-category cooldowns.
  Only one line plays at a time; a higher-priority line cancels a lower one; the same alert
  never repeats within 15 seconds. Voice stops when the game is paused, the window loses
  focus or the language changes. Music is ducked while a line plays.
- Lines live in the i18n dictionaries (`vo.*` keys, variants separated by `|`).
- **Subtitles** are always available (Settings → Subtitles). By default they turn on
  automatically when no voice exists for the chosen language or voice is switched off.

## Quality depends on the player's system

The voice you hear is whatever the operating system / browser provides:

| Platform | Russian voices usually available |
|----------|----------------------------------|
| Windows 10/11 (Edge, Chrome, Yandex Browser) | Microsoft Irina / Pavel (install "Russian" speech pack in Windows settings for more) |
| Chrome (any OS, online) | "Google русский" |
| macOS / iOS | Milena, Yuri (download in System Settings → Accessibility → Spoken Content) |
| Android | Google TTS Russian voice pack |
| Linux | often none → subtitles |

When no Russian voice is installed, Settings shows a note and the game falls back to
subtitles. Browsers do not allow routing `speechSynthesis` through Web Audio, so no
"radio" filter is applied — we deliberately do not fake it.

## Higher quality later (optional)

If studio-quality voice acting is wanted, pre-generated audio files could be added as an
optional voice pack (e.g. one Ogg/Opus file per line, loaded lazily). That would break the
"no assets" rule and add roughly 1–3 MB per language, so it is not part of this build.
