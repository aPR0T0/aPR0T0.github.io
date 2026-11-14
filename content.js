// content.js — single source of truth for every page on the site.
// Plain data only. Rendering lives in app.js.
// Loaded as a classic script (no ES modules) so the site also works when
// opened directly from disk via file:// — these become shared globals.

const profile = {
  name: "Mohd Alqama Shaikh",
  role: "Robotics & Embedded Systems Engineer",
  handle: "aPR0T0",
  tagline: "Building robots that survive the real world — and searching for a better way to run it.",
  location: "Mumbai, India",
};

const about = {
  title: "about",
  paragraphs: [
    "Robotics and embedded-systems engineer. I like the hard, physical end of the field — legged robots, aerial platforms, in-hand manipulation, and the human side of how people actually use machines.",
    "Most of my work has come out of SRA-VJTI (Society of Robotics and Automation, VJTI), where projects tend to start as ridiculous ideas and end as soldered, slightly scorched hardware. I spent a stretch as a research intern at NUS working on assistive robotics, which ended up published at CHI 2024.",
    "Across projects I keep ending up in the same role: jump into a moving build, stabilize it, and push it across the line — under deadlines that are usually too short.",
    "Tools I reach for: ESP32, Raspberry Pi, ROS, Gazebo, Python, CAD and 3D printing, and computer vision when a robot needs to see what it's holding.",
    "Beyond the hardware, I'm in search of the best way to run this world. I stand for two motives: that no one sleeps hungry, and that no one sleeps without a smile. Everything else — the robots, the systems, the writing — is in service of that. More on the search in ./blogs.",
  ],
  facts: [
    ["focus", "legged + aerial robots, manipulation, human-robot interaction"],
    ["stack", "ESP32 · Raspberry Pi · ROS · Gazebo · Python · CAD"],
    ["affiliation", "SRA-VJTI · former research intern, NUS"],
    ["published", "CHI 2024"],
    ["motive", "no one sleeps hungry, no one sleeps without a smile"],
  ],
};

const projects = [
  {
    id: "robot-learning",
    title: "robot-learning",
    year: 2026,
    status: "active",
    kind: "Node-based VLA pipeline lab: every stage swappable, every paper a plugin",
    tags: ["Robotics", "VLA", "Machine Learning", "Tooling"],
    summary:
      "A working base for each stage of my VLA post, from the VLM to the control loop, where every paper is a component you swap from YAML or Python.",
    body: [
      "robot-learning turns the eight stages of my VLA post into a pipeline of nodes. Each stage has a working base, and papers plug into it as components: four action heads (pi0 flow matching, diffusion, OpenVLA-OFT L1 regression, RT-2 bins), a SmolVLM2 or from-scratch backbone, post-training recipes (full, frozen backbone, head-only, LoRA), filtered self-imitation and DSRL for refinement, ACT and RTC-style chunk execution, safety filters and robot drivers. LeRobot's policies, datasets and simulators come in through adapters.",
      "Everything is configured from YAML or Python and managed with uv. A robot is a spec file, so adding a wrist force/torque sensor or a tactile pad is a few lines and the policy grows an encoder for it. One setup script brings up a Linux GPU machine or cloud VM.",
      "On one NVIDIA L4 the smoke pipeline runs all eight stages in about three and a half minutes. A policy trained from scratch reaches the colours it saw 98% of the time but only 2% on an unseen one; post-training on 24 demos lifts that to 28%, self-imitation RL to 78% over 200 fresh trials, and five flow steps instead of ten cut inference latency 1.8x without losing success. Swap in a SmolVLM2 backbone and the same recipe gets 34% on the unseen colour before any post-training, because the web-pretrained VLM already knows the word, and finishes at 93.5%. Published Diffusion Policy and ACT checkpoints, run through the same evaluation node, land within their confidence intervals of the reported numbers.",
      "The node map lists every stage, component and pipeline. Click one and the files that implement it light up.",
    ],
    links: [
      { label: "Open the node map", href: "/robot-learning/" },
      { label: "Read the VLA post it implements", href: "/vla/" },
      { label: "Source on GitHub", href: "https://github.com/aPR0T0/robot-learning" },
    ],
    media: [{ type: "image", src: "media/robot-learning/node-map.png", alt: "robot-learning node map: the eight VLA stages, a pipeline DAG and the highlighted source files" }],
  },
  {
    id: "microchooser",
    title: "microchooser",
    year: 2026,
    status: "active",
    kind: "Microcontroller chooser with KiCad symbol and footprint generation",
    tags: ["Embedded", "KiCad", "PCB", "Tooling"],
    summary:
      "Tell it what you're wiring up (UARTs, CAN-FD, USB, an SD card, Wi-Fi, BLE) and it picks the cheapest, easiest microcontroller or dev board, with buy links and KiCad files.",
    body: [
      "Picking a microcontroller usually means a dozen datasheet tabs. microchooser checks 149 MCU families, 453 orderable parts and 130 dev boards against the devices you plan to connect, works out the buses and the pin budget, and ranks what fits by price plus convenience: needing a programmer, a QFN-only package or no Arduino support all count against a part.",
      "When a chip is one controller short it suggests the add-on, such as three native CAN-FD controllers plus an MCP2518FD, and prices it in. Every pick comes with LCSC, DigiKey and Mouser links and a KiCad symbol and footprint. Parts in the official KiCad library are linked; missing ones are generated from the package dimensions and datasheet pin tables, then checked with kicad-cli.",
      "It also runs as a JSON API, a CLI and an MCP server, so coding agents can pick parts and drop KiCad libraries straight into a project.",
    ],
    links: [
      { label: "Open microchooser", href: "https://apr0t0.github.io/microchooser/" },
      { label: "Browse the MCU and dev-board library", href: "https://apr0t0.github.io/microchooser/#/library/mcus" },
      { label: "Use it from agents: MCP, API and CLI", href: "https://apr0t0.github.io/microchooser/#/api" },
      { label: "Source on GitHub", href: "https://github.com/aPR0T0/microchooser" },
    ],
    media: [{ type: "image", src: "media/microchooser/screenshot.png", alt: "microchooser recommending a chip for a 4x CAN-FD board" }],
  },
  {
    id: "rk3566",
    title: "RK3566 Circuit Simulation Lab",
    year: 2026,
    status: "active",
    kind: "Revision 4 PCB analysis and simulation evidence",
    tags: ["RK3566", "PCB", "SPICE", "Power Electronics"],
    summary:
      "Explore the RK3566 board, saved circuit simulation runs, manufacturer model studies, and time-domain electromagnetic analysis.",
    body: [
      "The circuit lab connects the Revision 4 board geometry with saved power-rail waveforms, startup and brownout scenarios, component inventories, and a review of every PCB section.",
      "Interactive 2D and 3D views, model studies, electromagnetic field playback, and downloadable evidence retain their source identities and stated model boundaries. The published snapshot supports exploration and comparison; new solver runs use the local simulation service.",
    ],
    links: [
      { label: "Open RK3566 circuit lab", href: "/rk3566/" },
      { label: "Explore the whole-board magnetic field", href: "/rk3566/#magnetic" },
      { label: "Review manufacturer model studies", href: "/rk3566/#models" },
      { label: "Explore saved simulation runs", href: "/rk3566/#iterations" },
    ],
    media: [],
  },
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
      { label: "Open paper (ACM, CHI 2024)", href: "https://dl.acm.org/doi/abs/10.1145/3613904.3642227" },
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
  {
    id: "sem",
    title: "DIY Scanning Electron Microscope",
    year: 2026,
    status: "active",
    kind: "Beam Lab simulator, electronics design, and build journal",
    tags: ["Electron Optics", "Vacuum", "Instrumentation", "ESP32"],
    summary:
      "An interactive electron microscope simulator with programmable scanning, electrical connections, and a detailed butterfly-wing preset, alongside the staged hardware build plan.",
    body: [
      "Beam Lab brings the source, vacuum, electron optics, electric and magnetic fields, and electrical connections into one interactive instrument. The current design pairs an LMC662 specimen-current detector and ADS1115 ADC with an ESP32 and a dual 16-bit DAC80502 for scanning.",
      "The detailed butterfly preset scans 512 × 512 points over a 140 µm field. Its modeled acquisition takes about 109 minutes; 500× browser playback previews it in about 13 seconds. Generated specimens and unbuilt electronics remain explicitly separated from measured hardware performance.",
      "The monthly review starts on September 26, 2026. The plan targets ₹118k in spend across twelve months, with a ₹2k buffer, milestone gates, procurement rules, and an engineering log that keeps each experiment reproducible.",
    ],
    links: [
      { label: "Launch Beam Lab simulator", href: "/sem/lab/" },
      { label: "Read the Beam Lab project journal", href: "/#blogs/building-a-simple-electron-microscope" },
      { label: "Open interactive SEM build map", href: "sem/" },
      { label: "Open BOM + project plan", href: "https://docs.google.com/spreadsheets/d/1AfX9gYdlI-TkqT5ylKq-bTIvdbrJS6h3LjZdvysLuyg/edit?usp=sharing" },
    ],
    media: [],
  },
];

const publications = [
  {
    title: "RDog: Assistive Quadruped Guidance for Blind and Visually Impaired Users",
    venue: "CHI 2024",
    year: 2024,
    note: "Navigation, force feedback, and preemptive voice guidance, evaluated against cane-based mobility aids.",
    href: "https://dl.acm.org/doi/abs/10.1145/3613904.3642227",
  },
  {
    title: "Acti-V-Link: Active-Surface Underactuated Gripper for In-Hand Manipulation",
    venue: "ROBCE 2024",
    year: 2024,
    note: "ESP32-driven active-surface gripper with ArUco-based visual feedback.",
    href: "https://dl.acm.org/doi/abs/10.1145/3674746.3674796",
  },
];

// Resume page (./resume). Bullet strings are inline markdown, so they can link
// to site pages (#projects/..., #blogs/...) as well as external URLs. Swap the
// PDF at `pdf` when the resume changes.
const resume = {
  name: "Alqama Shaikh",
  location: "Mumbai, Maharashtra, India",
  pdf: "media/resume/alqama-shaikh-resume.pdf",
  pdfName: "Alqama_Shaikh_Resume.pdf",
  links: [
    { label: "email", href: "mailto:alqamascaptaina3@gmail.com" },
    { label: "linkedin", href: "https://www.linkedin.com/in/alqama-shaikh" },
    { label: "github", href: "https://github.com/aPR0T0" },
    { label: "google scholar", href: "https://scholar.google.com/citations?user=QXUl5ZAAAAAJ&hl=en" },
  ],
  sections: [
    {
      id: "education",
      items: [
        {
          title: "Veermata Jijabai Technological Institute",
          when: "2021 – 2025",
          role: "B.Tech in Mechanical Engineering · CGPA 8",
          where: "Mumbai, India",
          tags: [
            "CFD", "Heat Transfer", "FEM", "RPD", "Design of Mechanical Systems",
            "Thermodynamics (10/10)", "Material Science (9/10)", "Fluid Mechanics",
            "Manufacturing Processes (9/10)", "Engineering Mathematics", "Applied Physics (10/10)",
            "CAD Modelling", "Robotics", "Control Systems", "Computer Programming (9/10)",
          ],
          note: "extracurricular",
          bullets: [
            "Led a team to create a communication bot in 3 days for rescuing 40 workers during a construction hazard with L&T Corporation — [./projects/anuvadak](#projects/anuvadak).",
            "Co-led a 20+ member team in knowledge transfer for robotics, embedded systems, and machine vision via workshops, seminars, and mentorship under the Eklavya program. Mentored first-year students on Dynamixel MX64 motor control, quadruped leg design, and gait analysis.",
            "Organized and taught DH parameters, hardware assembly, and ROS-based workshops for 50+ students in [MARIO](https://github.com/aPR0T0/MARIO/tree/ros2).",
            "Instructed IMU operation and sensor fusion to 200+ students in Wall-E. Designed convolution and filtering content for SRA's image processing seminar, Pixel.",
          ],
        },
      ],
    },
    {
      id: "entrepreneurial experience",
      items: [
        {
          title: "Eyecandy Robotics",
          when: "June 2025 – Present",
          role: "Co-founder (Hardware)",
          where: "India",
          links: [
            { label: "./blogs/eyecandy-robotics", href: "#blogs/eyecandy-robotics" },
            { label: "launch video", href: "https://x.com/_raghuvamsi/status/2103724650215899259" },
          ],
          bullets: [
            "Built Mr. Tensaurs, Mini Tensaur, a replica of Disney's BD-X droids, and our own original character Piko — all within 8 months of starting up.",
            "Grew the team to 20+ people within one year and raised USD 500K+ in pre-seed funding from Founders, Inc. and Lightspeed India.",
            "Managed the hardware team and unblocked it across actuators and character-to-CAD design pipelines (including building an [in-house CAD tool](#blogs/vibe-cad) for these pipelines); set up electronics development workflows, led hiring, and delivered fun characters fast.",
          ],
        },
      ],
    },
    {
      id: "research experience",
      items: [
        {
          title: "Electric Machines and Electromagnetics Research Group",
          when: "June 2024 – August 2024",
          role: "Research Intern · Advisor: Dr. Himavarsha Dhulipati",
          where: "Ottawa, Canada",
          bullets: [
            "Conducted a comprehensive analysis of existing adaptive control techniques for soft robotics.",
            "Designed an MPC controller from scratch for non-linear systems.",
            "Compared the adaptive control algorithm with a traditional PI controller in MATLAB Simulink.",
          ],
        },
        {
          title: "Adaptive Computing Laboratory, NUS School of Computing",
          when: "July 2023 – October 2023",
          role: "Research Intern · Advisors: Dr. Kotaro Hara, Dr. Zhao Shengdong, and Dr. David Hsu",
          where: "Singapore",
          links: [
            { label: "./projects/rdog", href: "#projects/rdog" },
            { label: "CHI '24 paper", href: "https://doi.org/10.1145/3613904.3642227" },
          ],
          bullets: [
            "Part of the team that designed and implemented a collaborative and assistive modality for visually impaired people to navigate multi-terrain and dynamically changing surroundings.",
            "Devised trajectory interpretations using LiDAR-based 3D SLAM (Simultaneous Localization and Mapping).",
            "Conducted quantitative analysis to compare existing navigation methods with our approach.",
            "Conducted user surveys and experiments for iterative design.",
            "Continuously refined hardware components based on user feedback and data acquisition challenges.",
            "Co-authored and submitted a research paper to CHI 2024 as part of the collaborative project.",
            "Implemented ORB-SLAM3 for the Tello drone with a ROS interface and contributed to the Universidad de Zaragoza ORB-SLAM3 repository.",
          ],
        },
      ],
    },
    {
      id: "competitions",
      items: [
        {
          title: "MassRobotics' Form and Function Challenge 2024",
          when: "Feb 2024 – May 2024",
          role: "Team Leader",
          links: [
            { label: "./projects/evoborne", href: "#projects/evoborne" },
            { label: "github", href: "https://github.com/SRA-VJTI/Evo-Borne" },
          ],
          bullets: [
            "Implemented 2 DOF per limb with integrated thrusters for drone functionality, enabling versatile maneuverability. Manufactured the bot using laser-cut and 3D-printed parts, and utilized Pixhawk and SpeedyBee V405 v3 for flight control.",
          ],
        },
        {
          title: "e-Yantra Robotics Competition (eYRC), IIT Bombay — Semi-finalists",
          when: "Aug 2022 – Mar 2023",
          role: "Team Leader",
          links: [{ label: "github", href: "https://github.com/aPR0T0/e-Yantra-HolA-Bot" }],
          bullets: [
            "Constructed a \"HolA Bot\" (Holonomic and Art Bot) for use in an arena that represents an abstraction of a multimodal smart city.",
            "Made a three-wheeled holonomic drive controller in Embedded C using FreeRTOS.",
            "Used an OV5647 fisheye camera to localize with the help of ArUco markers.",
          ],
        },
      ],
    },
    {
      id: "projects",
      items: [
        {
          title: "Acti-V-Link: An Active Surface Gripper for In-Hand Manipulation",
          when: "Apr 2023 – Mar 2024",
          role: "Control Systems · Robotics · Mechanical Design",
          links: [
            { label: "./projects/acti-v-link", href: "#projects/acti-v-link" },
            { label: "project website", href: "https://activlink-grip.github.io/" },
          ],
          bullets: [
            "Designed a cost-effective gripper using SolidWorks and 3D printing with PLA material.",
            "Integrated an ESP32 microcontroller and FreeRTOS for precise motor control.",
            "Incorporated ArUco markers for visual feedback during object handling.",
            "Conducted experiments validating the gripper's ability to handle various objects with accurate rotational and translational movements.",
            "Optimized gear and linkage mechanisms for efficient manipulation.",
            "Maintained mechanical stress within safe limits using torque feedback.",
          ],
        },
        {
          title: "Anuvadak — A Collaboration with L&T Construction Ltd.",
          when: "Sept 2023",
          role: "Control Systems · Robotics · Mechanical Design",
          links: [{ label: "./projects/anuvadak", href: "#projects/anuvadak" }],
          bullets: [
            "Designed a pipe-traversing bot with 6 actuators and a Raspberry Pi 3B to control PWM signals through a TB66 motor driver. Fully developed in 3 days across two versions of the bot.",
          ],
        },
        {
          title: "Control System and Simulation of a Hexacopter with Tilt Rotors",
          when: "Aug 2022 – Sept 2022",
          role: "Control Systems · Robotics · Simulation · ROS · Gazebo · Python",
          links: [
            { label: "./projects/hexacopter", href: "#projects/hexacopter" },
            { label: "github", href: "https://github.com/aPR0T0/Eklavya-Copter-Control" },
          ],
          bullets: [
            "Developed and implemented an optimal PID control system for an overactuated hexacopter with co-axial tilt-rotors using Python and ROS (Gazebo).",
            "Simulated successful omnidirectional flight.",
            "Reviewed relevant literature to derive allocation matrices for control.",
            "Performed mathematical operations from scratch in Python, including the Moore–Penrose pseudoinverse and solving linear equations.",
          ],
        },
      ],
      footnote: "Additional projects: [MARIO](https://github.com/aPR0T0/MARIO/tree/ros2) (Manipulator on ROS-based Input/Output) on ROS2 and [Implementing Path Planning using BFS on TurtleBot3](https://github.com/aPR0T0/Visual_SLAM_on_TB3).",
    },
  ],
  skills: [
    ["languages", "Embedded C, C++, C#, Python, JavaScript, HTML, CSS"],
    ["frameworks", "ROS 1 & 2, Gazebo, RViz, OpenCV, FreeRTOS for ESP32"],
    ["software", "Fusion 360, Onshape, SolidWorks, Ansys, Fluent, KiCad, VS Code, Unity, MATLAB"],
    ["technologies", "Git/GitHub, Markdown, LaTeX, Office, Linux, Bootstrap, MongoDB, Vercel, CMake, GNU Make, uv, MuJoCo, Isaac Sim"],
    ["hands on", "3D Printing, Laser Cutting, Lathe, Milling, Shaping, Rapid Prototyping, CNC Programming, Schematic Design, Circuit Bring-up and Deployment"],
    ["other", "Adobe Creative Cloud (Photoshop, Illustrator, InDesign, XD, Premiere Pro)"],
  ],
  publications: [
    {
      authors: "Shaojun Cai, Ashwin Ram, Zhengtai Gou, **Mohd Alqama Wasim Shaikh**, Yu-An Chen, Yingjia Wan, Kotaro Hara, Shengdong Zhao, and David Hsu.",
      title: "Navigating real-world challenges: A quadruped robot guiding system for visually impaired people in diverse environments.",
      venue: "In Proceedings of the CHI Conference on Human Factors in Computing Systems (CHI '24), ACM, 2024.",
      short: "CHI '24",
      href: "https://doi.org/10.1145/3613904.3642227",
      project: "#projects/rdog",
    },
    {
      authors: "Karthik Swaminathan, Saad Hashmi, **Alqama Shaikh**, and Vikas Phalle.",
      title: "Next-gen manipulation: An active surface-based underactuated gripper with visual feedback.",
      venue: "In 2nd Workshop on Dexterous Manipulation: Design, Perception and Control (RSS), 2024.",
      short: "RSS '24 workshop",
      href: "https://openreview.net/forum?id=3deVq5EoIZ",
      project: "#projects/acti-v-link",
    },
    {
      authors: "Karthik Swaminathan, Mohammed Saad Hashmi, **Alqama Shaikh**, and Vikas Phalle.",
      title: "Acti-V-Link: An active surface, visual feedback based, mechanically underactuated gripper for in-hand manipulation.",
      venue: "In Proceedings of the 2024 4th International Conference on Robotics and Control Engineering (RobCE '24), pages 14–18, Edinburgh, UK, ACM, 2024.",
      short: "RobCE '24",
      href: "https://doi.org/10.1145/3674746.3674796",
      project: "#projects/acti-v-link",
    },
  ],
};

const contact = [
  { no: "01", name: "email", value: "alqamascaptaina3@gmail.com", href: "mailto:alqamascaptaina3@gmail.com" },
  { no: "02", name: "github", value: "github.com/aPR0T0", href: "https://github.com/aPR0T0" },
  { no: "03", name: "linkedin", value: "mohd-alqama-shaikh", href: "https://www.linkedin.com/in/mohd-alqama-shaikh-636587229/" },
];

// Blog posts live in posts.js (window.BLOG_POSTS) so the in-browser editor can
// rewrite + commit just that file. `blogs` shares the same array reference, so
// edits made in author mode show up live without a reload.
const blogs = (window.BLOG_POSTS = Array.isArray(window.BLOG_POSTS) ? window.BLOG_POSTS : []);

function getProject(id) {
  return projects.find((p) => p.id === id) || null;
}

function getPost(slug) {
  return blogs.find((b) => b.slug === slug) || null;
}
