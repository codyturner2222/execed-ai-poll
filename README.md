# AI Ethics in Business: live polling

Anonymous live polling for the two-session Bentley Executive Education program.
No login. Participants join by scanning the QR code on the projected screen or
by entering the four-digit code. The presenter controls which poll is open and
when the room sees the aggregate. Nothing is visible on any phone until the
presenter presses Reveal.

## The polls

Session 1
- Poll 1, Personalized pricing. Five-point agreement scale.
- Poll 2a, Which AI ethics concern worries you most in general. Five options
  plus a free-text Other.
- Poll 2b, Which AI risk worries you most for your own business. Same options.
  Revealing this one shows 2a beside it, so the general answer and the
  business-specific answer sit side by side.
- Poll 3, round 1. OptiWork, before discussion. A / B / C.
- Poll 3, round 2. OptiWork, after discussion. Revealing round 2 shows round 1
  above it with the net change per option, which is the shift you are after.
- Poll 4, optional. Rank three OptiWork variants from most to least ethically
  problematic.

Session 2
- Polls 5 and 6, four sycophancy statements on the same five-point scale.

## Deploy on Render (once)
1. Create an empty GitHub repo with no README, no .gitignore, and no license.
2. Upload the *contents* of this folder, so that server.js, package.json, and
   the public folder sit at the top level of the repo.
3. On render.com: New -> Web Service -> connect the repo.
4. Runtime Node, Build command `npm install`, Start command `node server.js`,
   free plan. Leave Root Directory blank.
5. Open the service URL. That URL is what you project.

## Running a session
1. Open the URL on your own device and press Create room.
2. Project the top card. The QR code and the four-digit code are both there.
   The QR encodes the join link with the code already in it, so a scan drops
   the participant straight onto the open poll with nothing to type.
3. Click a poll in the list to open it. The response count climbs live.
4. Press Reveal results when you want the room to see the aggregate. It appears
   on the projected screen and on every phone at the same moment. Hide takes it
   back off both.
5. Close ends voting. Opening the next poll hides the previous results
   automatically.

For the OptiWork revote, open round 1, reveal it or not as you prefer, run your
discussion, then open round 2. Everyone votes again and the reveal shows both.

## Editing the polls
Change the QUESTIONS array at the top of server.js. Three types:

- `likert`: an `options` array rendered as one scale. AGREE5 is defined above
  the array and reused, so editing it changes every agreement question at once.
- `choice`: an `options` array as a vertical list. Add `allowOther: true` for a
  free-text box, whose answers appear as a list on the presenter screen.
- `rank`: an `items` array. Participants order them with arrows and submit. The
  presenter screen reports mean rank, lowest first, plus how many people put
  each item first. The starting order is shuffled per person so position is not
  a nudge.

Add `compareWith: '<earlier question id>'` to show two polls together on reveal.
Add `note: '...'` for text that appears only on the presenter screen, behind its
own button.

## Notes
- Votes live in server memory, so a restart clears every room. On Render's free
  plan the service sleeps after about fifteen minutes idle. Open the URL ten
  minutes before the session to wake it, then create the room.
- Session 2 will need a new room unless the service happens to have stayed warm.
  Nothing is lost that matters: screenshot anything from session 1 you want to
  carry forward.
- Nothing identifying is stored. Each phone generates a random token that exists
  only to stop double voting and to let someone change an answer.
