// Effort/urgency estimation from a short task request, using simple keyword
// rules — no network, no AI. Returns { effort, urgency }.

function ruleFallback(text) {
  const t = text.toLowerCase();

  // effort: catch explicit "2 days", "1 hr", "a month", or #tags
  let effort = null;
  const m = t.match(/\b(\d+)\s*(min|minute|hr|hour|day|week|month)s?\b/);
  if (m) {
    const unit = m[2].replace('minute', 'min').replace('hour', 'hr');
    effort = `${m[1]} ${unit}${Number(m[1]) > 1 ? 's' : ''}`;
  } else if (/\bmonths?\b/.test(t)) effort = 'a month';
  else if (/#mins|quick|tiny|trivial/.test(t)) effort = '~mins';
  else if (/#days|couple of days|few days/.test(t)) effort = '~days';
  else if (/#hrs|#hours/.test(t)) effort = '~hrs';

  // urgency
  let urgency = 'no-rush';
  if (/\bnow\b|urgent|asap|right away|blocker|blocking/.test(t)) urgency = 'now';
  else if (/\beod\b|end of day|by today|tonight|today/.test(t)) urgency = 'EOD';
  else if (/no.?rush|whenever|someday|backlog/.test(t)) urgency = 'no-rush';

  return { effort: effort || '~hrs', urgency };
}

async function parseEffortUrgency(text) {
  return ruleFallback(text);
}

module.exports = { parseEffortUrgency };
