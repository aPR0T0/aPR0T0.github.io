// Vite can only fingerprint + emit assets it can discover statically.
// `new URL(variablePath, import.meta.url)` is NOT analyzable, so those files
// were never copied into the build and 404'd in production. `import.meta.glob`
// eagerly resolves every project asset to its final (hashed) URL instead.
const assetUrls = import.meta.glob('../projects/**/*', {
  eager: true,
  query: '?url',
  import: 'default',
});

const asset = (path) => {
  const url = assetUrls[path];
  if (!url) {
    console.warn(`[site-data] missing asset: ${path}`);
    return new URL(path, import.meta.url).href;
  }
  return url;
};

export const projects = [
  {
    id: 'evoborne',
    code: 'WP-01',
    title: 'EvoBorne',
    kind: 'Project Blog',
    year: 2024,
    status: 'ACTIVE',
    grid: '07-ALPHA',
    accent: '#ffc24d',
    intel:
      'Hybrid quadruped-drone platform built for MassRobotics\' Form and Function Challenge 2024, combining legged mechanics, iterative CAD, integrated thrusters, and repeated flight-test loops.',
    loadout: ['Robotics', 'CAD', 'Control', 'Flight Test'],
    link: './src/Blogs/EvoBorne.html',
    x: 28,
    y: 34,
    images: [
      asset('../projects/evoborne/evoborne-fears.jpg'),
      asset('../projects/evoborne/caltech.png'),
      asset('../projects/evoborne/morpher.png'),
      asset('../projects/evoborne/monster-rising.png'),
    ],
    media: [
      { type: 'image', src: asset('../projects/evoborne/evoborne-fears.jpg'), alt: 'EvoBorne concept frame' },
      { type: 'image', src: asset('../projects/evoborne/caltech.png'), alt: 'EvoBorne early concept art' },
      { type: 'image', src: asset('../projects/evoborne/morpher.png'), alt: 'EvoBorne CAD exploration' },
      { type: 'image', src: asset('../projects/evoborne/new-designed-bot.png'), alt: 'EvoBorne refined design' },
      { type: 'image', src: asset('../projects/evoborne/monster-rising.png'), alt: 'EvoBorne corrected prototype render' },
      { type: 'video', src: asset('../projects/evoborne/flight-tests.mp4'), poster: asset('../projects/evoborne/v1-monster.jpg') },
    ],
  },
  {
    id: 'acti-v-link',
    code: 'WP-02',
    title: 'Acti-V-Link',
    kind: 'Project + Publication',
    year: 2024,
    status: 'PUBLISHED',
    grid: '04-DELTA',
    accent: '#3ff5e0',
    intel:
      'Active-surface underactuated gripper for in-hand manipulation with visual feedback, built with 3D-printed mechanics, ESP32 control, torque-aware actuation, and ArUco-based pose estimation.',
    loadout: ['ESP32', 'Mechanical Design', 'Vision', 'Manipulation'],
    link: './src/Blogs/Acti-V-Link.html',
    x: 58,
    y: 28,
    images: [
      asset('../projects/acti-v-link/in-hand-1.jpg'),
      asset('../projects/acti-v-link/in-hand-phase-1.png'),
      asset('../projects/acti-v-link/in-hand-cutout.png'),
    ],
    media: [
      { type: 'image', src: asset('../projects/acti-v-link/in-hand-1.jpg'), alt: 'Acti-V-Link prototype' },
      { type: 'image', src: asset('../projects/acti-v-link/in-hand-phase-1.png'), alt: 'Acti-V-Link phase one render' },
      { type: 'image', src: asset('../projects/acti-v-link/in-hand-cutout.png'), alt: 'Acti-V-Link isolated assembly' },
    ],
  },
  {
    id: 'anuvadak',
    code: 'WP-03',
    title: 'Anuvadak',
    kind: 'Rapid Response Build',
    year: 2023,
    status: 'ACTIVE',
    grid: '11-SIERRA',
    accent: '#9a7bff',
    intel:
      'Pipe-traversing rescue robot built in three days to help establish communication in a tunnel emergency, using a Raspberry Pi control stack, custom actuation, and fast mechanical iteration.',
    loadout: ['Raspberry Pi', 'Rescue Robotics', 'Rapid Prototyping', 'Actuation'],
    link: './src/Blogs/Anuvadak.html',
    x: 44,
    y: 62,
    images: [
      asset('../projects/anuvadak/anuvadak.jpg'),
      asset('../projects/anuvadak/collaboration.jpg'),
    ],
    media: [
      { type: 'image', src: asset('../projects/anuvadak/anuvadak.jpg'), alt: 'Anuvadak tunnel robot' },
      { type: 'image', src: asset('../projects/anuvadak/collaboration.jpg'), alt: 'Anuvadak collaboration snapshot' },
      { type: 'image', src: asset('../projects/anuvadak/working.gif'), alt: 'Anuvadak working demonstration' },
    ],
  },
  {
    id: 'rdog',
    code: 'WP-04',
    title: 'RDog Guidance System',
    kind: 'Publication',
    year: 2024,
    status: 'PUBLISHED',
    grid: '02-ECHO',
    accent: '#5ad1ff',
    intel:
      'Quadruped guidance system for blind and visually impaired users, combining mapping, navigation, force feedback, and preemptive voice guidance in a published CHI 2024 research effort.',
    loadout: ['HRI', 'Navigation', 'Research', 'Publication'],
    link: './src/Blogs/RDog.html',
    x: 72,
    y: 56,
    images: [asset('../projects/rdog/rdog.png')],
    media: [{ type: 'image', src: asset('../projects/rdog/rdog.png'), alt: 'RDog quadruped guidance system' }],
  },
  {
    id: 'hexacopter-control',
    code: 'WP-05',
    title: 'Hexacopter Control',
    kind: 'Simulation Project',
    year: 2024,
    status: 'ARCHIVED',
    grid: '09-FOXTROT',
    accent: '#ff7a59',
    intel:
      'Tilt-rotor hexacopter simulation with omnidirectional control, ROS and Gazebo integration, control allocation math, and core linear algebra routines implemented from scratch.',
    loadout: ['ROS', 'Gazebo', 'Python', 'Control'],
    link: './src/Blogs/Hexacopter.html',
    x: 22,
    y: 68,
    images: [],
    media: [],
  },
];

export const channels = [
  {
    no: '01',
    name: 'Gmail',
    val: 'alqamascaptaina3@gmail.com',
    href: 'mailto:alqamascaptaina3@gmail.com',
  },
  {
    no: '02',
    name: 'GitHub',
    val: 'github.com/aPR0T0',
    href: 'https://github.com/aPR0T0',
  },
  {
    no: '03',
    name: 'LinkedIn',
    val: 'mohd-alqama-shaikh',
    href: 'https://www.linkedin.com/in/mohd-alqama-shaikh-636587229/',
  },
];

export function getProjectById(id) {
  return projects.find((project) => project.id === id) ?? null;
}

export function getProjectIndex(id) {
  return projects.findIndex((project) => project.id === id);
}

export function getStudioHref(project) {
  return `./studio.html?id=${encodeURIComponent(project.id)}`;
}

export function getProjectImages(project, limit = 4) {
  return (project.images ?? []).slice(0, limit);
}
