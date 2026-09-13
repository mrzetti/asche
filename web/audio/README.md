# Background music

`asche-zu-asche.mp3` is a browser-friendly copy of the user-supplied
`/home/mrzetti/downloads/04 - Asche zu Asche.flac` (231.45 seconds).
It is an added website soundtrack, separate from the preserved game's files.

Rebuild with:

```sh
ffmpeg -nostdin -i '/home/mrzetti/downloads/04 - Asche zu Asche.flac' \
  -map 0:a:0 -map_metadata -1 -c:a libmp3lame -q:a 2 \
  web/audio/asche-zu-asche.mp3
```

Music loops at 25% of the master volume (17.5% at the default 70%). It begins
2.5 seconds after the first click in the emulator canvas, leaving room for the
short original opening excerpt. Restart stops/resets it. The separate music
button pauses/resumes without affecting effects and remembers the preference
in localStorage. An explicit Play music retry handles autoplay restrictions.
