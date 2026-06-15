import { getProjectById } from './site-data.js';

// See site-data.js: `new URL(variablePath, import.meta.url)` is not analyzable
// by Vite, so referenced files are never emitted. Resolve via glob instead.
const assetUrls = import.meta.glob('../projects/**/*', {
  eager: true,
  query: '?url',
  import: 'default',
});

const asset = (path) => {
  const url = assetUrls[path];
  if (!url) {
    console.warn(`[mission-briefings] missing asset: ${path}`);
    return new URL(path, import.meta.url).href;
  }
  return url;
};

function projectMission(projectId, overrides) {
  const project = getProjectById(projectId);

  if (!project) {
    throw new Error(`Missing project metadata for mission '${projectId}'`);
  }

  return {
    id: project.id,
    projectId: project.id,
    code: project.code,
    title: project.title,
    year: project.year,
    status: project.status,
    accent: project.accent,
    grid: project.grid,
    loadout: project.loadout,
    summary: project.intel,
    media: project.media,
    ...overrides,
  };
}

export const missionBriefings = {
  evoborne: projectMission('evoborne', {
    pageTitle: 'EvoBorne — Mission Briefing',
    mission: 'HALLELUJAH ASCENT',
    classification: 'Live Test / Competition Build',
    theater: 'SRA-VJTI · MassRobotics Form and Function Challenge 2024',
    callSign: 'EVOBORNE',
    operator: 'Alqama Shaikh + SRA team',
    objectives: [
      'Build a morphing ground-air robot with 2 DOF per limb and integrated thrusters under an aggressive competition deadline.',
      'Translate an ambitious Caltech-inspired concept into a printable, modular chassis that could actually be assembled and maintained in-house.',
      'Reach a real tethered flight-test stage instead of stopping at CAD or partial subsystem validation.',
    ],
    constraints: [
      'The original Morphobot concept had years of maturity behind it; this build had only weeks and a student-team budget.',
      '3D-print turnaround, vendor quality, and exam schedules repeatedly broke the intended integration cadence.',
      'Flight bring-up happened while the team was still learning older flight-control hardware and practical test discipline.',
    ],
    fieldNotes: [
      {
        stamp: 'Trigger',
        title: 'Caltech planted the seed',
        body: [
          'The project started from the immediate pull of seeing an iconic Caltech robot and asking whether a single platform could meaningfully behave like more than one machine.',
          'When the MassRobotics Form and Function Challenge appeared, the idea stopped being a daydream and became a deadline-backed mission worth mobilizing a team around.',
        ],
      },
      {
        stamp: 'Design Friction',
        title: 'The first design pass was too optimistic',
        body: [
          'Early design choices around the leg and arm sections were far rougher than they looked on paper; even bearing strategy had to be rethought after time was already burned.',
          'A later redesign with outsourced bearings finally gave the leg architecture a path that looked mechanically believable instead of just exciting in CAD.',
        ],
      },
      {
        stamp: 'Assembly Phase',
        title: 'Printing and integration became the real battlefield',
        body: [
          'Even after geometry improved, making the whole assembly truly printable and modular was harder than expected, and the vendor cycle kept colliding with exams and deadlines.',
          'By the time parts arrived, assembly itself became a multi-day endurance task just to complete a single leg in hardware.',
        ],
      },
      {
        stamp: 'Recovery',
        title: 'The team kept iterating under bad manufacturing conditions',
        body: [
          'When later prints showed up late and underwhelming, the team still pushed through with corrective integration, chassis rework, and late-night physical validation rather than treating the build as lost.',
          'The important milestone was not a perfect competition finish; it was proving a mini monster could exist as a working electromechanical body instead of staying a concept.',
        ],
      },
      {
        stamp: 'Flight Test',
        title: 'Tethered air tests exposed the next mountain',
        body: [
          'Flight verification happened with a rope, an old controller from the SRA inventory, and rookie instincts in a domain where mistakes are immediately visible.',
          'The platform did not end with the clean triumphant flight clip everyone wants, but it reached the point where full system bring-up, motor behavior, and chassis integration were undeniably real.',
        ],
      },
    ],
    debrief: [
      {
        title: 'Outcome',
        body: [
          'EvoBorne did not close the loop with a polished final demonstration before graduation, but it cleared the hardest psychological barrier: turning a ridiculous dream vehicle into physical hardware that could be assembled, powered, and tested.',
          'That makes the mission incomplete, not failed. The platform remains active because the core body, lessons, and ambition survived contact with reality.',
        ],
      },
      {
        title: 'Mission Value',
        body: [
          'The real win was learning how brutal hardware iteration becomes once printing, vendors, electronics, integration, and team coordination all collide at once.',
          'The project also carries a strong human footprint: friends, seniors, midnight soldering, and the kind of chaos that makes a robotics mission memorable even when the final scene is still unwritten.',
        ],
      },
    ],
    closingNote: 'Mission remains live. Full air capability is still a target, not a closed chapter.',
    evidenceNote: 'Cleared evidence includes concept art, CAD evolution, corrected chassis frames, and tethered flight-test footage.',
  }),
  'acti-v-link': projectMission('acti-v-link', {
    pageTitle: 'Acti-V-Link — Mission Briefing',
    mission: 'PALM LOCK',
    classification: 'Published / Manipulation Systems',
    theater: 'SRA-VJTI · FYP Support / ROBCE 2024',
    callSign: 'ACTI-V-LINK',
    operator: 'Alqama Shaikh + Karthik + Saad',
    objectives: [
      'Support the rapid development of an active-surface gripper capable of meaningful in-hand manipulation rather than just static grasping.',
      'Bring mechanical, control, and presentation layers together quickly enough for an academic final-year milestone and later publication.',
      'Use visual feedback and practical actuation to turn an interesting mechanism into something credible enough to defend and publish.',
    ],
    constraints: [
      'Mechanical iteration was compressed into days, not months, which forced design rescue and late-stage integration under pressure.',
      'The project depended on distributed collaboration across different people and locations, which made publishing feel harder than the hardware itself at times.',
      'Explaining a non-intuitive mechanism to outside reviewers was almost its own separate mission.',
    ],
    fieldNotes: [
      {
        stamp: 'Build Window',
        title: 'A rescue mission for an underactuated finger concept',
        body: [
          'The mission started when Alqama was pulled into a final-year project owned by seniors Karthik and Saad, after being too interested in everything the club was building around him.',
          'A weak early finger-design attempt forced a faster and better response: Saad redesigned the gripper quickly, and the team pushed through assembly in time for the final presentation.',
        ],
      },
      {
        stamp: 'Presentation',
        title: 'The hardware made it to the room in time',
        body: [
          'One key image from the mission captures the prototype only minutes before the final presentation, which says a lot about the operating tempo.',
          'Controller configuration and just-enough system bring-up turned the mechanism into something that could actually be shown instead of merely described.',
        ],
      },
      {
        stamp: 'External Review',
        title: 'Explaining the mechanism was part of the job',
        body: [
          'A later iteration was shown to Prof. Phalle, where the team had to translate a mechanically unusual surface-gripping concept into language other people could follow and critique.',
          'That friction did not kill the mission. It sharpened the paper and clarified how much of the project’s value came from persistence as much as from the mechanism itself.',
        ],
      },
      {
        stamp: 'Publication',
        title: 'The mission crossed the academic line',
        body: [
          'Despite coordination headaches across Hyderabad, IIT Bombay, and VJTI, the work made it into publication and became proof that the team had pushed beyond a lab demo.',
          'That outcome matters because it validates both the mechanism and the follow-through required to document it properly.',
        ],
      },
    ],
    debrief: [
      {
        title: 'Outcome',
        body: [
          'Acti-V-Link finished with more than a prototype; it ended with a published record and a strong story about rebuilding under pressure instead of pretending the first pass was enough.',
          'It also stands as a clean example of how manipulation work is never just mechanics: control, presentation, and explanation all have to survive the same deadline.',
        ],
      },
      {
        title: 'Mission Value',
        body: [
          'The project shows Alqama operating effectively as the person who jumps into a moving mission, stabilizes it, and helps push it across the finish line.',
          'That support role still carried real engineering weight: controller setup, mechanism understanding, and the grind of turning a clever idea into a defensible system.',
        ],
      },
    ],
    closingNote: 'Mission closed as published, with the mechanism validated through both hardware iteration and external review.',
    evidenceNote: 'Cleared evidence includes the presentation-day configuration, the phase-one render, and a stripped visual of the assembly logic.',
  }),
  anuvadak: projectMission('anuvadak', {
    pageTitle: 'Anuvadak — Mission Briefing',
    mission: 'TUNNEL VOICE',
    classification: 'Rapid Response / Rescue Robotics',
    theater: 'VJTI · Himachal tunnel emergency response request',
    callSign: 'ANUVADAK',
    operator: 'Alqama Shaikh + 7-member response team',
    objectives: [
      'Deliver a functional pipe-traversing robot fast enough to help establish communication with trapped workers during a real emergency context.',
      'Move from concept to hardware in roughly three days while balancing coursework, recent travel fatigue, and zero room for ceremonial engineering.',
      'Keep iteration practical: use whatever materials, fabrication paths, and mechanical hacks were necessary to get a working machine on the table.',
    ],
    constraints: [
      'The mission began with urgency from an external request rather than a comfortable internal timeline.',
      'Early design flaws forced rethinking of the chassis and fabrication process almost immediately after the first print cycle.',
      'The team had to mix 3D printing, laser-cut aluminum, soldering, and improvised structural choices just to keep momentum alive.',
    ],
    fieldNotes: [
      {
        stamp: 'Call-In',
        title: 'The mission arrived right after internship re-entry',
        body: [
          'Anuvadak began when Alqama had barely returned from an NUS internship and was still catching up to coursework, only to get pulled into an urgent robotics ask relayed through Prof. N. P. Gulhane.',
          'The ask was not abstract: provide a robotic path toward communication support during the Himachal tunnel incident.',
        ],
      },
      {
        stamp: 'Mobilization',
        title: 'Seven people, immediate concept work',
        body: [
          'A seven-person team formed quickly and started splitting attention between concept selection, basic circuitry, and the first workable packaging decisions.',
          'The pace was high enough that ordinary schedules stopped mattering; the only useful question was what could be fabricated before the next deadline hit.',
        ],
      },
      {
        stamp: 'Fabrication Pivot',
        title: 'The first print was only the first correction',
        body: [
          'After printing the first version, flaws in the main chassis became obvious, and the team abandoned the idea of keeping that part purely printed.',
          'Switching the main chassis toward laser-cut aluminum was not elegant on paper, but it was the correct operational move for strength and speed.',
        ],
      },
      {
        stamp: 'Improvisation',
        title: 'Bolts became arms because the mission needed motion, not perfection',
        body: [
          'Night-long soldering, multiple iterations, improvised hardware substitutions, and even suspension ideas for pipe diameter changes became part of the final push.',
          'That willingness to replace fragile printed arms with bolts says everything about the spirit of the mission: brutal pragmatism over aesthetic purity.',
        ],
      },
    ],
    debrief: [
      {
        title: 'Outcome',
        body: [
          'Anuvadak is one of the cleanest examples in the portfolio of emergency-minded engineering: form a team, compress the design cycle, cut what does not matter, and get to a functioning machine fast.',
          'The mission matters because the context demanded usefulness first, elegance second.',
        ],
      },
      {
        title: 'Mission Value',
        body: [
          'The page is short because the mission itself moved too fast for polished storytelling, but that brevity fits the build: fast thinking, fast fabrication, and fast corrective action.',
          'It is a strong briefing precisely because it reads like a response unit, not a leisurely campus project.',
        ],
      },
    ],
    closingNote: 'Mission accomplished as a rapid-response build; the value lies in speed, adaptation, and operational urgency.',
    evidenceNote: 'Cleared evidence includes the primary field build, collaboration snapshot, and a surviving working animation from the deployment window.',
  }),
  rdog: projectMission('rdog', {
    pageTitle: 'RDog Guidance System — Mission Briefing',
    mission: 'GUIDE HOUND',
    classification: 'Published / Human-Robot Interaction',
    theater: 'CHI 2024 · Assistive navigation research',
    callSign: 'RDOG',
    operator: 'Alqama Shaikh + NUS research team',
    referenceHref: 'https://dl.acm.org/doi/abs/10.1145/3674746.3674796',
    referenceLabel: 'Open Paper',
    objectives: [
      'Build and evaluate a quadruped robot capable of guiding blind and visually impaired users through unfamiliar indoor and outdoor environments.',
      'Combine navigation, mapping, force feedback, and preemptive voice guidance into a single assistive system that reduces cognitive load during movement.',
      'Validate the platform against more familiar mobility aids and publish the outcome in a high-visibility HCI venue.',
    ],
    constraints: [
      'Assistive robotics lives under much stricter real-world expectations than ordinary demos because user trust, safety, and cognitive burden all matter simultaneously.',
      'The system had to function across diverse environments rather than being tuned for a single clean lab route.',
      'Public repo evidence is lighter than the actual research effort, so this briefing leans on the preserved publication summary and image rather than a full internal lab notebook.',
    ],
    fieldNotes: [
      {
        stamp: 'Problem Space',
        title: 'Mobility support needed more than obstacle avoidance',
        body: [
          'RDog was framed around a harder question than simple navigation: how can a quadruped guidance robot support blind and visually impaired users in real environments without becoming another source of uncertainty?',
          'That widened the mission from mapping and locomotion into guidance quality, feedback design, and user confidence.',
        ],
      },
      {
        stamp: 'System Stack',
        title: 'Navigation, force feedback, and voice cues worked as one unit',
        body: [
          'The preserved publication summary shows a system where advanced mapping and navigation were paired with force feedback and preemptive voice guidance rather than treated as separate features.',
          'That integration matters because assistive mobility is not solved by robot autonomy alone; the human has to understand and trust what the robot is doing.',
        ],
      },
      {
        stamp: 'Evaluation',
        title: 'The platform was compared against familiar mobility aids',
        body: [
          'Experiments comparing a white cane, a smart cane, and RDog showed the robot improving navigation speed, smoothness, and perceived cognitive ease for users.',
          'That gives this mission a strong debrief position: it was not just an engineered artifact, it was tested against meaningful human outcomes.',
        ],
      },
      {
        stamp: 'Publication',
        title: 'The mission closed with CHI 2024 visibility',
        body: [
          'Publication at CHI 2024 marks this dossier as one of the clearest research outcomes in the portfolio, bridging robotics implementation with human-centered validation.',
          'It also broadens the site narrative by showing that the portfolio is not only about building machines, but also about studying whether those machines help people well.',
        ],
      },
    ],
    debrief: [
      {
        title: 'Outcome',
        body: [
          'RDog stands as a published assistive-robotics mission with direct human impact, grounded in both system integration and user-centered evaluation.',
          'Compared with the more raw build logs elsewhere in the portfolio, this briefing reads like a mature research operation that reached external validation cleanly.',
        ],
      },
      {
        title: 'Mission Value',
        body: [
          'The project strengthens the portfolio by proving competence in HRI and research, not only hardware hustle. It shows engineering that must be correct socially as well as technically.',
          'That makes RDog a key bridge between robotics enthusiasm and evidence-backed real-world usefulness.',
        ],
      },
    ],
    closingNote: 'Mission closed as published research with clear assistive impact and a strong human-centered validation story.',
    evidenceNote: 'Cleared evidence includes the publication figure and the external paper record.',
  }),
  'hexacopter-control': projectMission('hexacopter-control', {
    pageTitle: 'Hexacopter Control — Mission Briefing',
    mission: 'VECTOR SWARM',
    classification: 'Archived / Simulation Stack',
    theater: 'ROS + Gazebo · Overactuated flight simulation',
    callSign: 'HEXACOPTER CONTROL',
    operator: 'Alqama Shaikh',
    media: [],
    objectives: [
      'Simulate omnidirectional flight on a tilt-rotor hexacopter using an overactuated control architecture rather than a simple textbook setup.',
      'Implement the control system in Python and ROS/Gazebo while owning the math instead of treating the stack like a black box.',
      'Derive and use allocation logic, pseudoinverse computation, and supporting linear-algebra routines from scratch to understand the system deeply.',
    ],
    constraints: [
      'Only a thin archive of notes survived in the public repo, so this briefing is based on preserved summary intel rather than a full narrative lab log.',
      'The mission lived more in simulation and math than in field imagery, which leaves fewer dramatic artifacts than hardware-heavy pages.',
      'No cleared media set is currently attached to the public briefing.',
    ],
    fieldNotes: [
      {
        stamp: 'Model',
        title: 'Control first, spectacle second',
        body: [
          'The surviving record shows a project centered on successful omnidirectional flight simulation for a coaxial tilt-rotor hexacopter using Python and ROS/Gazebo.',
          'That alone makes it distinct from simpler multicopter exercises because actuation redundancy changes how control allocation has to be reasoned about.',
        ],
      },
      {
        stamp: 'Math Stack',
        title: 'Owning the allocation math was part of the mission',
        body: [
          'Relevant literature was reviewed to derive control-allocation matrices, and the project explicitly preserved the challenge of writing mathematical tooling from scratch.',
          'The surviving notes call out Moore-Penrose pseudoinverse work and direct linear-system handling, which makes this mission as much about internalizing the math as about running a simulator.',
        ],
      },
      {
        stamp: 'Archive Status',
        title: 'Public dossier reconstructed from limited surviving notes',
        body: [
          'This mission is presented as an archived technical dossier because the repo still lacks the richer media and narrative that the mechanical projects retain.',
          'The intent here is accuracy over drama: preserve what is known, mark what is missing, and keep the page ready for deeper notes later.',
        ],
      },
    ],
    debrief: [
      {
        title: 'Outcome',
        body: [
          'Even with sparse surviving artifacts, the mission reads clearly as a serious control-and-simulation exercise rather than a shallow simulator demo.',
          'Its value is in the math ownership, ROS/Gazebo systems work, and the willingness to derive core tools instead of outsourcing understanding.',
        ],
      },
      {
        title: 'Mission Value',
        body: [
          'This is a technically dense mission presented in limited-public form. The page is intentionally dossier-like rather than cinematic because the evidence trail is mostly conceptual and computational.',
          'If fuller notes or plots are recovered later, this briefing can expand without changing its structure.',
        ],
      },
    ],
    notice:
      'Public archive remains thin. Additional plots, simulation captures, or derivation notes can be slotted into this briefing later without redesigning the page.',
    closingNote: 'Mission archived with partial public intel, but the core technical intent is clear and preserved.',
    evidenceNote: 'No cleared field media is currently attached to this mission file.',
  }),
  tb3: {
    id: 'tb3',
    pageTitle: 'TB3 — Restricted Dossier',
    mission: 'TERRAIN NODE',
    classification: 'Intel Pending / Platform Archive',
    theater: 'TurtleBot3 platform archive',
    callSign: 'TB3',
    operator: 'Archive pending release',
    code: 'WP-06',
    title: 'TB3 Platform Notes',
    year: 2024,
    status: 'CLASSIFIED',
    accent: '#2ee6ff',
    grid: '06-NOVA',
    loadout: ['ROS', 'Mobile Base', 'Archive', 'Intel Pending'],
    summary:
      'This file preserves the path for a TurtleBot3 mission briefing, but the public archive currently retains only the platform image and not the deeper build or experiment log.',
    media: [{ type: 'image', src: asset('../projects/tb3/tb3.jpg'), alt: 'TB3 platform archive image' }],
    objectives: [
      'Retain a stable dossier endpoint for the TB3 platform inside the new mission-briefing theme.',
      'Preserve the surviving visual artifact while the detailed experiment notes are cleaned and restored.',
    ],
    constraints: [
      'Only one cleared image is currently attached to the public archive.',
      'Original field logs and engineering notes are not present in the repo right now.',
    ],
    fieldNotes: [
      {
        stamp: 'Archive Lock',
        title: 'Only the platform image survived public cleanup',
        body: [
          'TB3 is currently represented as a restricted dossier because the repo contains a named image but not the full context needed for a richer mission log.',
          'Rather than inventing details, this page intentionally treats the mission as pending declassification.',
        ],
      },
      {
        stamp: 'Ready State',
        title: 'Structure exists for later expansion',
        body: [
          'Once navigation notes, ROS experiments, or deployment logs are restored, this file can absorb them immediately without another design pass.',
        ],
      },
    ],
    debrief: [
      {
        title: 'Outcome',
        body: [
          'The dossier is honest and intentionally sparse: a platform placeholder rendered with the same seriousness as the full missions, without pretending the archive is richer than it is.',
        ],
      },
    ],
    notice:
      'Detailed notes are not cleared for public release yet. This page is acting as a classified shell rather than a fabricated retrospective.',
    closingNote: 'Mission file preserved. Declassification pending.',
    evidenceNote: 'Single cleared archive image attached.',
  },
  'sra-journey': {
    id: 'sra-journey',
    pageTitle: 'SRA Journey — Restricted Dossier',
    mission: 'UNIT ORIGIN',
    classification: 'Archive Locked / Community Brief',
    theater: 'SRA-VJTI internal journey log',
    callSign: 'SRA JOURNEY',
    operator: 'Archive pending release',
    code: 'WP-07',
    title: 'SRA Journey',
    year: 2024,
    status: 'CLASSIFIED',
    accent: '#8f7dff',
    grid: '13-ORBIT',
    loadout: ['Team Culture', 'Club History', 'Archive', 'Intel Pending'],
    summary:
      'This dossier is reserved for a future briefing on the SRA journey and team environment that shaped many of the portfolio missions, but the public narrative has not been restored yet.',
    media: [],
    objectives: [
      'Hold a stable mission-briefing slot for the community and journey narrative behind the robotics work.',
      'Keep the page in-theme now so the archive can be expanded later without another visual migration.',
    ],
    constraints: [
      'No cleared longform text or media specific to this mission is currently present in the public repo.',
      'The page therefore stays intentionally limited rather than borrowing unrelated project material.',
    ],
    fieldNotes: [
      {
        stamp: 'Status',
        title: 'Journey log not yet republished',
        body: [
          'The mission exists because the story of a robotics unit matters, but the public-facing notes are still missing after earlier template-era cleanup and reshuffling.',
        ],
      },
    ],
    debrief: [
      {
        title: 'Outcome',
        body: [
          'This dossier currently functions as a reserved archive endpoint, not a fabricated origin story. Once the real narrative is ready, it should land here.',
        ],
      },
    ],
    notice:
      'The community story behind the projects deserves its own mission file, but this version remains intentionally locked until the real notes are restored.',
    closingNote: 'Archive slot reserved for future release.',
    evidenceNote: 'No cleared evidence attached.',
  },
  'general-guide-series': {
    id: 'general-guide-series',
    pageTitle: 'General Guide Series — Restricted Dossier',
    mission: 'FIELD MANUAL',
    classification: 'Intel Pending / Reference File',
    theater: 'Reference notes and workflow guides',
    callSign: 'GUIDE SERIES',
    operator: 'Archive pending release',
    code: 'WP-08',
    title: 'General Guide Series',
    year: 2024,
    status: 'CLASSIFIED',
    accent: '#ffd166',
    grid: '15-DELPHI',
    loadout: ['Guides', 'Reference', 'Process', 'Intel Pending'],
    summary:
      'This page is a tactical shell for a future reference and guidance series. The path exists, the theme is aligned, and the content is waiting for proper declassification.',
    media: [],
    objectives: [
      'Reserve a styled destination for process notes, repeatable workflows, and future robotics guidance writeups.',
      'Avoid leaving the old placeholder page live while still being honest about the missing content.',
    ],
    constraints: [
      'No public guide content is currently attached to this file in the repo.',
      'The mission therefore prioritizes structural readiness over narrative depth.',
    ],
    fieldNotes: [
      {
        stamp: 'Placeholder',
        title: 'Framework ready, content pending',
        body: [
          'The goal here is not to fake a guidebook. It is to keep the route alive and visually coherent until the actual field manual entries are written.',
        ],
      },
    ],
    debrief: [
      {
        title: 'Outcome',
        body: [
          'This mission page is intentionally sparse, but it now belongs to the same visual system as the rest of the portfolio and can grow without another redesign.',
        ],
      },
    ],
    notice:
      'Reference content has not been published yet. This is a prepared shell, not a fake manual.',
    closingNote: 'Field manual slot preserved for future deployment.',
    evidenceNote: 'No cleared evidence attached.',
  },
};

export function getMissionBriefing(id) {
  return missionBriefings[id] ?? null;
}
