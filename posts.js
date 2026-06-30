// posts.js — blog posts data. This file is the single source of truth for the
// blog and is the ONLY file the in-browser editor rewrites + commits to GitHub.
// Keep it as a plain `window.BLOG_POSTS = [...]` assignment so it can be
// regenerated deterministically (and still load offline via file://).
window.BLOG_POSTS = [
  {
    "slug": "a-better-system-to-run-the-world",
    "title": "In Search of a Better System to Run the World",
    "date": "2026-06-30",
    "year": 2026,
    "tags": [
      "systems",
      "motive",
      "first post"
    ],
    "summary": "Two non-negotiables — no one sleeps hungry, and no one sleeps without a smile — and the search for a system that can actually deliver them.",
    "body": [
      "I spend most of my days making machines behave. You write the constraints, define what 'good' means, and let the system optimize toward it. When it misbehaves, you don't blame the motor — you go back and check the objective you gave it. After enough of this, you start looking at the world the same way.",
      "And the world, looked at honestly, is just a very large system being run on a very old objective function. We optimize for growth, for output, for whoever is already winning. The system isn't broken; it's doing exactly what it was told to do. That's the uncomfortable part — the suffering isn't a bug, it's the optimum of the wrong loss.",
      "So I keep coming back to a simpler question: what would we be optimizing for, if we were honest about it? I've narrowed mine down to two motives. No one sleeps hungry. No one sleeps without a smile. One is about the floor — the bare minimum a civilization owes every person it contains. The other is about whether that life is actually worth living once the floor is met.",
      "They sound soft until you try to engineer them. 'No one sleeps hungry' is a logistics and distribution problem we already have the resources to solve — the bottleneck is allocation, incentives, and will, not capacity. 'No one sleeps without a smile' is harder, because dignity, belonging, and meaning don't show up on a balance sheet, and the moment you try to mass-produce them you usually destroy them.",
      "I don't have the system yet. I'm suspicious of anyone who claims they do — utopias tend to be brittle, centralized, and one bad actor away from collapse. What I trust more is the engineering mindset: state the objective clearly, instrument the thing so you can actually see who's being left out, run small experiments, keep what survives contact with reality, and stay honest about the failure modes.",
      "This blog is where I'll think out loud about that search — economics, incentives, technology, robotics, the boring infrastructure of a good life, and the occasional half-formed idea I'm not sure about yet. Some of it will be wrong. That's the point of writing it down: a wrong idea you can see is a wrong idea you can fix.",
      "If both motives sound naive to you, good. Keep that reaction. I'd rather aim at something obviously worth wanting and miss, than optimize cleanly toward something that was never worth building in the first place."
    ]
  }
];
