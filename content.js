// content.js — single source of truth for every page on the site.
// Plain data only. Rendering lives in app.js.
// Loaded as a classic script (no ES modules) so the site also works when
// opened directly from disk via file:// — these become shared globals.

const profile = {
  name: "Mohd Alqama Shaikh",
  role: "Robotics & Embedded Systems Engineer",
  handle: "aPR0T0",
  tagline: "I build robots that have to survive contact with the real world.",
  location: "Mumbai, India",
};

const about = {
  title: "about",
  paragraphs: [
    "Robotics and embedded-systems engineer. I like the hard, physical end of the field — legged robots, aerial platforms, in-hand manipulation, and the human side of how people actually use machines.",
    "Most of my work has come out of SRA-VJTI (Society of Robotics and Automation, VJTI), where projects tend to start as ridiculous ideas and end as soldered, slightly scorched hardware. I spent a stretch as a research intern at NUS working on assistive robotics, which ended up published at CHI 2024.",
    "Across projects I keep ending up in the same role: jump into a moving build, stabilize it, and push it across the line — under deadlines that are usually too short.",
    "Tools I reach for: ESP32, Raspberry Pi, ROS, Gazebo, Python, CAD and 3D printing, and computer vision when a robot needs to see what it's holding.",
  ],
  facts: [
    ["focus", "legged + aerial robots, manipulation, human-robot interaction"],
    ["stack", "ESP32 · Raspberry Pi · ROS · Gazebo · Python · CAD"],
    ["affiliation", "SRA-VJTI · former research intern, NUS"],
    ["published", "CHI 2024"],
  ],
};

const projects = [
  {
    id: "evoborne",
    title: "EvoBorne",
    year: 2024,
    status: "active",
    kind: "Hybrid quadruped-drone platform",
    tags: ["Robotics", "CAD", "Control", "Flight Test"],
    summary:
      "A morphing ground-air robot built for the MassRobotics Form and Function Challenge 2024 — legged mechanics plus integrated thrusters, with two degrees of freedom per limb.",
    body: [
      "EvoBorne started from a simple, stubborn question: could a single platform meaningfully behave like more than one machine? Seeing an iconic Caltech morphing robot planted the seed; when the MassRobotics Form and Function Challenge appeared, the daydream became a deadline.",
      "The first design pass was too optimistic. The leg and arm sections were rougher than they looked on paper, and even the bearing strategy had to be rethought after time was already burned. A later redesign with outsourced bearings finally gave the leg architecture a path that was mechanically believable instead of just exciting in CAD.",
      "Printing and integration turned out to be the real battlefield. Making the whole assembly genuinely printable and modular was harder than the geometry itself, and the vendor cycle kept colliding with exams and deadlines. Assembling a single leg in hardware became a multi-day endurance task.",
      "Flight bring-up happened with a rope, an old controller from the club inventory, and rookie instincts in a domain where mistakes are instantly visible. There was no clean triumphant flight clip at the end — but the platform reached real, tethered system bring-up, with motor behavior and chassis integration that were undeniably physical.",
      "The mission is incomplete, not failed. The hardest barrier — turning a ridiculous dream vehicle into hardware that can be assembled, powered, and tested — is behind it. Full air capability is still a target, not a closed chapter.",
    ],
    links: [],
    media: [
      { type: "image", src: "media/evoborne/concept.jpg", alt: "EvoBorne concept frame" },
      { type: "image", src: "media/evoborne/caltech.png", alt: "Caltech-inspired early concept" },
      { type: "image", src: "media/evoborne/prototype.png", alt: "Corrected prototype render" },
    ],
  },
  {
    id: "acti-v-link",
    title: "Acti-V-Link",
    year: 2024,
    status: "published",
    kind: "Active-surface manipulation gripper",
    tags: ["ESP32", "Mechanical Design", "Vision", "Manipulation"],
    summary:
      "An active-surface underactuated gripper for in-hand manipulation, driven by ESP32 control and ArUco-based pose estimation. Published at ROBCE 2024.",
    body: [
      "Acti-V-Link began as a rescue mission. I was pulled into a final-year project owned by seniors after being too curious about everything the club was building. A weak early finger design forced a faster, better response — a quick redesign, then a hard push through assembly in time for the final presentation.",
      "One image from the project shows the prototype minutes before that presentation, which says a lot about the tempo. Controller configuration and just-enough system bring-up turned a mechanism into something that could actually be demonstrated instead of merely described.",
      "Explaining a non-intuitive surface-gripping mechanism to outside reviewers was almost its own separate project. That friction didn't kill it — it sharpened the paper and clarified how much of the value came from persistence as much as from the mechanism.",
      "Despite coordination spread across multiple cities and institutes, the work made it into publication at ROBCE 2024. Manipulation is never just mechanics: control, presentation, and explanation all had to survive the same deadline.",
    ],
    links: [],
    media: [
      { type: "image", src: "media/acti-v-link/prototype.jpg", alt: "Acti-V-Link prototype" },
      { type: "image", src: "media/acti-v-link/assembly.png", alt: "Acti-V-Link assembly logic" },
    ],
  },
  {
    id: "anuvadak",
    title: "Anuvadak",
    year: 2023,
    status: "active",
    kind: "Rapid-response rescue robot",
    tags: ["Raspberry Pi", "Rescue Robotics", "Rapid Prototyping"],
    summary:
      "A pipe-traversing rescue robot built in roughly three days to help establish communication during a tunnel emergency. Brutal pragmatism over polish.",
    body: [
      "Anuvadak arrived right after I'd returned from an internship and was still catching up on coursework, when an urgent robotics request came through a professor: provide a robotic path toward communication support during the Himachal tunnel incident.",
      "A seven-person team formed almost immediately and split attention between concept selection, basic circuitry, and the first workable packaging decisions. Ordinary schedules stopped mattering — the only useful question was what could be fabricated before the next deadline.",
      "The first print was just the first correction. Flaws in the main chassis were obvious, so we abandoned keeping it purely printed and switched to laser-cut aluminum — inelegant on paper, but the right call for strength and speed.",
      "Night-long soldering, improvised hardware, and suspension ideas for changing pipe diameters became the final push. When fragile printed arms didn't hold, we replaced them with bolts. The mission needed motion, not perfection.",
      "This is one of the cleanest examples of emergency-minded engineering I've worked on: form a team, compress the design cycle, cut what doesn't matter, and get to a functioning machine fast.",
    ],
    links: [],
    media: [
      { type: "image", src: "media/anuvadak/build.jpg", alt: "Anuvadak field build" },
      { type: "image", src: "media/anuvadak/team.jpg", alt: "Anuvadak team collaboration" },
      { type: "image", src: "media/anuvadak/working.gif", alt: "Anuvadak working demonstration" },
    ],
  },
  {
    id: "rdog",
    title: "RDog Guidance System",
    year: 2024,
    status: "published",
    kind: "Assistive quadruped guidance",
    tags: ["HRI", "Navigation", "Research"],
    summary:
      "A quadruped robot that guides blind and visually impaired users through unfamiliar spaces, combining mapping, navigation, force feedback, and preemptive voice guidance. Published at CHI 2024.",
    body: [
      "RDog was framed around a harder question than simple navigation: how can a quadruped guidance robot support blind and visually impaired users in real environments without becoming another source of uncertainty? That widened the work from mapping and locomotion into guidance quality, feedback design, and user confidence.",
      "The system paired advanced mapping and navigation with force feedback and preemptive voice cues — treated as one unit, not separate features. Assistive mobility isn't solved by autonomy alone; the person has to understand and trust what the robot is doing.",
      "We compared a white cane, a smart cane, and RDog. The robot improved navigation speed, smoothness, and perceived cognitive ease for users — so this wasn't just an engineered artifact, it was tested against meaningful human outcomes.",
      "Publication at CHI 2024 makes this one of the clearest research outcomes I've been part of: robotics implementation bridged with human-centered validation. It's proof that the work isn't only about building machines, but about studying whether those machines actually help people.",
    ],
    links: [
      { label: "Open paper (ACM, CHI 2024)", href: "https://dl.acm.org/doi/abs/10.1145/3674746.3674796" },
    ],
    media: [
      { type: "image", src: "media/rdog/rdog.png", alt: "RDog quadruped guidance system" },
    ],
  },
  {
    id: "hexacopter",
    title: "Hexacopter Control",
    year: 2024,
    status: "archived",
    kind: "Overactuated flight simulation",
    tags: ["ROS", "Gazebo", "Python", "Control"],
    summary:
      "Omnidirectional flight simulation for a coaxial tilt-rotor hexacopter, with control allocation and core linear-algebra routines written from scratch.",
    body: [
      "The goal here was control first, spectacle second: omnidirectional flight simulation for a coaxial tilt-rotor hexacopter, implemented in Python with ROS and Gazebo. Actuation redundancy changes how control allocation has to be reasoned about, which sets it apart from simpler multicopter exercises.",
      "Owning the math was part of the point. I derived control-allocation matrices from the literature and wrote the supporting tooling by hand — Moore-Penrose pseudoinverse work and direct linear-system handling — rather than treating the stack as a black box.",
      "This one is archived with only a thin set of surviving notes, so it's presented honestly: preserve what's known, mark what's missing. If fuller derivations or simulation captures resurface, they slot in without a redesign. The core technical intent is clear and intact.",
    ],
    links: [],
    media: [],
  },
];

const publications = [
  {
    title: "RDog: Assistive Quadruped Guidance for Blind and Visually Impaired Users",
    venue: "CHI 2024",
    year: 2024,
    note: "Navigation, force feedback, and preemptive voice guidance, evaluated against cane-based mobility aids.",
    href: "https://dl.acm.org/doi/abs/10.1145/3674746.3674796",
  },
  {
    title: "Acti-V-Link: Active-Surface Underactuated Gripper for In-Hand Manipulation",
    venue: "ROBCE 2024",
    year: 2024,
    note: "ESP32-driven active-surface gripper with ArUco-based visual feedback.",
    href: "",
  },
];

const contact = [
  { no: "01", name: "email", value: "alqamascaptaina3@gmail.com", href: "mailto:alqamascaptaina3@gmail.com" },
  { no: "02", name: "github", value: "github.com/aPR0T0", href: "https://github.com/aPR0T0" },
  { no: "03", name: "linkedin", value: "mohd-alqama-shaikh", href: "https://www.linkedin.com/in/mohd-alqama-shaikh-636587229/" },
];

function getProject(id) {
  return projects.find((p) => p.id === id) || null;
}
