# Learning Games

Four games that are school work underneath. They're the teaching half of
[Homework Launchpad](https://github.com/silocell/HEH-Homework), a homework
site built for a Year 7 class, split out here so the site repo stays about
the site.

**Play them:** they need a Launchpad account, because each one keeps your
level, points and progress. Opening a page signed out sends you back to
the Launchpad.

---

## The games

**Level Up** (`levelup.html`) — daily practice that follows you. The tasks
get harder as you get better rather than on a fixed schedule, and points
buy things in a shop. Maths, English and Science.

**Times Table Tycoon** (`tables.html`) — 60-second rounds that watch which
facts you're slow on and ask those more. Collect all the Numlings.

**Word Dragons** (`dragons.html`) — hatch and grow dragons by doing
English. Keep them healthy, then battle someone else by email.

**Battle Stories** (`history.html`) — watch a battle re-enacted, then
explain why it happened. Episode 1 is Hastings, 1066.

## How they fit the site

These aren't standalone files the way the
[Scratch games](https://github.com/silocell/HEH-Launchpad-Scratch) are.
They talk to the Launchpad's backend for sign-in, points and levels, which
means two things worth knowing before moving anything:

**They share the Launchpad's sign-in because they share an origin.** All
of these repos are published under the same host, so the browser treats
them as one site and the session carries across. Put them on a different
domain and everyone gets logged out.

**Links back to the site are root-relative on purpose.** Every `href` to
the Launchpad is written `/HEH-Homework/...` rather than `./`, so it
resolves correctly from this repo's path, and keeps working on the custom
domain as well as on github.io.

`games-gate.js` — the script that checks you're signed in and allowed in —
is deliberately *not* copied here. These pages load it from
`/HEH-Homework/games-gate.js`, so there's one copy of the access rules
rather than two that can drift apart.

## Licence

[GNU GPL v3](https://www.gnu.org/licenses/gpl-3.0.html) — see `LICENSE`.
