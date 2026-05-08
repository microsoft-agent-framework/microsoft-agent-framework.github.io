import fs from 'node:fs';
import path from 'node:path';
import { getCollection, render, type CollectionEntry } from 'astro:content';
import type { MarkdownHeading } from 'astro';

export const GITHUB_SAMPLES_URL = 'https://github.com/microsoft/agent-framework/tree/main/dotnet/samples';

export type Difficulty = 'Beginner' | 'Intermediate' | 'Advanced';

export interface Tutorial {
  id: string;
  slug: string;
  url: string;
  Content?: any;
  headings: MarkdownHeading[];
  isAuthored: boolean;
  title: string;
  description: string;
  category: string;
  categorySlug: string;
  series: string;
  seriesSlug: string;
  seriesOrder: number;
  difficulty: Difficulty;
  time: string;
  samplePath?: string;
  projectFile?: string;
  sourceUrl?: string;
  concepts: string[];
  provider: string;
  hosting: string;
  prerequisites: string[];
  envVars: string[];
  runCommands: string[];
  expectedOutput: string[];
  troubleshooting: string[];
  next?: string;
  companionProjects: CompanionProject[];
}

export interface CompanionProject {
  title: string;
  samplePath: string;
  projectFile: string;
  command: string;
}

export interface Series {
  title: string;
  slug: string;
  description: string;
  categorySlug: string;
  tutorials: Tutorial[];
}

export interface LearningPath {
  title: string;
  slug: string;
  folder?: string;
  description: string;
  plannedCount: number;
  isPhaseOne: boolean;
  tutorials: Tutorial[];
  series: Series[];
}

interface ProjectUnit {
  categoryFolder: string;
  relativeProjectFile: string;
  samplePath: string;
  projectFile: string;
  segments: string[];
  sourceText: string;
}

const CATEGORY_ORDER = ['agent-essentials', 'advanced-orchestration'];
const PHASE_ONE_SAMPLE_FOLDER = '01-get-started';

const CATEGORY_META: Record<string, Omit<LearningPath, 'plannedCount' | 'isPhaseOne' | 'tutorials' | 'series'>> = {
  'agent-essentials': {
    title: 'Agent Essentials',
    slug: 'agent-essentials',
    folder: 'agent-essentials',
    description: 'Master the core pillars of the Microsoft Agent Framework. Build a production-ready triage assistant from scratch, mastering tools, memory, and hosting.'
  },
  'advanced-orchestration': {
    title: 'Advanced Orchestration',
    slug: 'advanced-orchestration',
    folder: 'advanced-orchestration',
    description: 'Move beyond single agents to build reliable Compound AI Systems using deterministic workflows and multi-agent patterns.'
  }
};

let cachedTutorials: Promise<Tutorial[]> | undefined;
let cachedProjectUnits: ProjectUnit[] | undefined;

export function getTutorials() {
  if (!cachedTutorials) {
    cachedTutorials = buildTutorials();
  }

  return cachedTutorials;
}

export async function getLearningPaths(): Promise<LearningPath[]> {
  const tutorials = await getTutorials();
  const plannedCounts = getPlannedCounts();
  const categorySlugs = [
    ...CATEGORY_ORDER,
    ...[...new Set(tutorials.map((tutorial) => tutorial.categorySlug))].filter((slug) => !CATEGORY_ORDER.includes(slug))
  ];

  return categorySlugs.map((slug) => {
    const categoryTutorials = tutorials.filter((tutorial) => tutorial.categorySlug === slug);
    const series = groupSeries(categoryTutorials);
    const meta = CATEGORY_META[slug] ?? {
      title: titleize(slug),
      slug,
      description: `Authored tutorials for ${titleize(slug).toLowerCase()}.`
    };

    return {
      ...meta,
      plannedCount: plannedCounts.get(slug) ?? 0,
      isPhaseOne: 'folder' in meta && meta.folder === PHASE_ONE_SAMPLE_FOLDER,
      tutorials: categoryTutorials,
      series
    };
  });
}

export async function getLearningPath(slug: string) {
  return (await getLearningPaths()).find((path) => path.slug === slug);
}

export async function getSeries(categorySlug: string, seriesSlug: string) {
  return (await getLearningPath(categorySlug))?.series.find((series) => series.slug === seriesSlug);
}

export async function getTutorial(categorySlug: string, seriesSlug: string, tutorialSlug: string) {
  return (await getTutorials()).find(
    (tutorial) => tutorial.categorySlug === categorySlug && tutorial.seriesSlug === seriesSlug && tutorial.slug === tutorialSlug
  );
}

export function difficultyClass(difficulty: string) {
  return `difficulty-${difficulty.toLowerCase()}`;
}

export function pathClass(slug: string) {
  const classes: Record<string, string> = {
    'agent-essentials': 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200',
    'advanced-orchestration': 'bg-rose-50 text-rose-700 ring-1 ring-rose-200',
    workflows: 'bg-teal-50 text-teal-700 ring-1 ring-teal-200',
    tools: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200'
  };
  return classes[slug] ?? 'bg-slate-100 text-slate-700 ring-1 ring-slate-200';
}

async function buildTutorials(): Promise<Tutorial[]> {
  return buildAuthoredTutorials();
}

async function buildAuthoredTutorials(): Promise<Tutorial[]> {
  const entries = await getCollection('tutorials');
  const tutorials = await Promise.all(entries.map((entry) => tutorialFromContentEntry(entry)));
  return withNextTutorials(tutorials.sort(compareTutorials));
}

async function tutorialFromContentEntry(entry: CollectionEntry<'tutorials'>): Promise<Tutorial> {
  const { data } = entry;
  const { Content, headings } = await render(entry);
  const categorySlug = slugify(data.category);
  const seriesSlug = slugify(data.series);
  const slug = tutorialSlugFromEntry(entry);
  const samplePath = data.samplePath;

  return {
    id: entry.id,
    slug,
    url: `${import.meta.env.BASE_URL === '/' ? '' : import.meta.env.BASE_URL}/learn/${categorySlug}/${slug}`,
    Content,
    headings,
    isAuthored: true,
    title: data.title,
    description: data.description,
    category: CATEGORY_META[categorySlug]?.title ?? titleize(data.category),
    categorySlug,
    series: titleize(data.series),
    seriesSlug,
    seriesOrder: data.seriesOrder,
    difficulty: data.difficulty,
    time: data.time,
    samplePath,
    sourceUrl: data.sourceUrl ?? (samplePath ? `${GITHUB_SAMPLES_URL}/${encodeURI(samplePath).replaceAll('%2F', '/')}` : undefined),
    concepts: data.concepts,
    provider: data.provider,
    hosting: data.hosting,
    prerequisites: data.prerequisites,
    envVars: data.envVars,
    runCommands: data.runCommands,
    expectedOutput: data.expectedOutput,
    troubleshooting: data.troubleshooting,
    next: data.next,
    companionProjects: []
  };
}

function tutorialSlugFromEntry(entry: CollectionEntry<'tutorials'>) {
  const fileName = entry.id.split('/').at(-1) ?? entry.id;
  return slugify(fileName.replace(/\.[^.]+$/, '').replace(/^\d+[_\-\s]+/, ''));
}

function withNextTutorials(tutorials: Tutorial[]) {
  tutorials.forEach((tutorial) => {
    const next = tutorials.find(
      (candidate) =>
        candidate.categorySlug === tutorial.categorySlug &&
        candidate.seriesSlug === tutorial.seriesSlug &&
        candidate.seriesOrder === tutorial.seriesOrder + 1
    );
    tutorial.next = next?.url;
  });

  return tutorials;
}

function getProjectUnits() {
  if (!cachedProjectUnits) {
    const sampleRoot = getSampleRoot();
    cachedProjectUnits = sampleRoot ? collectProjectFiles(sampleRoot).map((projectFile) => createProjectUnit(sampleRoot, projectFile)) : [];
  }

  return cachedProjectUnits;
}

function getPlannedCounts() {
  const counts = new Map<string, number>();

  for (const unit of getProjectUnits()) {
    const slug = categorySlugFor(unit.categoryFolder);
    counts.set(slug, (counts.get(slug) ?? 0) + 1);
  }

  return counts;
}

function getSampleRoot() {
  const candidates = [
    path.resolve(process.cwd(), '..', 'code', 'agent-framework', 'dotnet', 'samples'),
    path.resolve(process.cwd(), 'code', 'agent-framework', 'dotnet', 'samples')
  ];

  return candidates.find((candidate) => fs.existsSync(candidate));
}

function collectProjectFiles(root: string) {
  const results: string[] = [];

  function walk(current: string) {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (entry.name === 'bin' || entry.name === 'obj' || entry.name.startsWith('.')) continue;
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.csproj')) {
        results.push(fullPath);
      }
    }
  }

  walk(root);
  return results.sort((a, b) => pathRelative(root, a).localeCompare(pathRelative(root, b), undefined, { numeric: true }));
}

function createProjectUnit(sampleRoot: string, projectFilePath: string): ProjectUnit {
  const relativeProjectFile = pathRelative(sampleRoot, projectFilePath);
  const samplePath = path.dirname(relativeProjectFile).replaceAll('\\', '/');
  const projectFile = path.basename(projectFilePath);
  const segments = samplePath.split('/');
  const sourceText = readSourceText(path.dirname(projectFilePath));

  return {
    categoryFolder: segments[0],
    relativeProjectFile,
    samplePath,
    projectFile,
    segments: segments.slice(1),
    sourceText
  };
}

function readSourceText(projectDirectory: string) {
  const files = ['README.md', 'Program.cs', 'local.settings.json', 'appsettings.json']
    .map((file) => path.join(projectDirectory, file))
    .filter((file) => fs.existsSync(file));

  return files.map((file) => fs.readFileSync(file, 'utf8')).join('\n');
}

function buildScenarioGroups(units: ProjectUnit[]) {
  const groups = new Map<string, ProjectUnit[]>();

  for (const unit of units) {
    const key = scenarioKeyFor(unit);
    const group = groups.get(key) ?? [];
    group.push(unit);
    groups.set(key, group);
  }

  return groups;
}

function scenarioKeyFor(unit: ProjectUnit) {
  if (unit.categoryFolder === '05-end-to-end') {
    return [unit.categoryFolder, unit.segments[0]].filter(Boolean).join('/');
  }

  if (unit.categoryFolder === '02-agents' && unit.segments[0] === 'AGUI') {
    return [unit.categoryFolder, unit.segments[0], unit.segments[1]].filter(Boolean).join('/');
  }

  return unit.samplePath;
}

function companionProjectsFor(unit: ProjectUnit, groups: Map<string, ProjectUnit[]>): CompanionProject[] {
  const group = groups.get(scenarioKeyFor(unit)) ?? [];
  if (group.length <= 1) return [];

  const scenarioRoot = scenarioKeyFor(unit);
  return group.map((project) => ({
    title: titleFor(project),
    samplePath: project.samplePath,
    projectFile: project.projectFile,
    command: `dotnet run --project ${pathRelative(scenarioRoot, `${project.samplePath}/${project.projectFile}`)}`
  }));
}

function categorySlugFor(folder: string) {
  return folder.replace(/^\d+-/, '');
}

function seriesSlugFor(unit: ProjectUnit) {
  if (unit.categoryFolder === '01-get-started') return 'first-steps';

  const seriesSegments = unit.segments.length <= 1 ? unit.segments : unit.segments.slice(0, -1);
  return slugify(seriesSegments.join('-'));
}

function seriesTitleFor(unit: ProjectUnit) {
  if (unit.categoryFolder === 'agent-essentials') return 'Agent Essentials';
  if (unit.categoryFolder === 'advanced-orchestration') return 'Advanced Orchestration';

  const seriesSegments = unit.segments.length <= 1 ? unit.segments : unit.segments.slice(0, -1);
  return titleize(seriesSegments.join(' '));
}

function groupSeries(tutorials: Tutorial[]) {
  const grouped = new Map<string, Series>();

  for (const tutorial of tutorials) {
    if (!grouped.has(tutorial.seriesSlug)) {
      grouped.set(tutorial.seriesSlug, {
        title: tutorial.series,
        slug: tutorial.seriesSlug,
        categorySlug: tutorial.categorySlug,
        description: seriesDescriptionFor(tutorial.series, tutorial.category),
        tutorials: []
      });
    }

    grouped.get(tutorial.seriesSlug)?.tutorials.push(tutorial);
  }

  return [...grouped.values()].map((series) => ({
    ...series,
    tutorials: series.tutorials.sort((a, b) => a.seriesOrder - b.seriesOrder)
  }));
}

function titleFor(unit: ProjectUnit) {
  const rawTitle = unit.segments.at(-1) ?? path.basename(unit.projectFile, '.csproj');
  return titleize(rawTitle.replace(/^\d+[_\-\s]+/, ''));
}

function titleize(value: string) {
  const normalized = value
    .replace(/\.[\d]+/g, (match) => match.replace('.', ' point '))
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\bA2 A\b/g, 'A2A')
    .replace(/\bA G U I\b/g, 'AGUI')
    .replace(/\bM C P\b/g, 'MCP')
    .replace(/\bR A G\b/g, 'RAG')
    .replace(/\bH I T L\b/g, 'HITL')
    .replace(/\bO N N X\b/g, 'ONNX')
    .replace(/\bM365\b/g, 'Microsoft 365')
    .trim();

  return normalized
    .split(/\s+/)
    .map((word) => {
      const upper = word.toUpperCase();
      if (['A2A', 'AGUI', 'MCP', 'RAG', 'HITL', 'ONNX', 'DI', 'API', 'HTTP', 'UI'].includes(upper)) return upper;
      if (/^\d+$/.test(word)) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}

function slugify(value: string) {
  return value
    .replace(/\./g, '-')
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

function conceptsFor(unit: ProjectUnit) {
  const haystack = `${unit.samplePath} ${unit.projectFile} ${unit.sourceText}`.toLowerCase();
  const concepts = new Set<string>();

  const checks: Array<[string, string[]]> = [
    ['Agents', ['agent']],
    ['Function tools', ['functiontool', 'function tools', 'tool']],
    ['Workflows', ['workflow']],
    ['Streaming', ['stream']],
    ['Human approval', ['humanintheloop', 'hitl', 'approval']],
    ['Memory', ['memory', 'chat history']],
    ['RAG', ['rag', 'vector', 'search']],
    ['Evaluation', ['evaluation', 'eval']],
    ['MCP', ['mcp', 'modelcontextprotocol']],
    ['A2A', ['a2a']],
    ['OpenTelemetry', ['telemetry', 'opentelemetry', 'observability']],
    ['Declarative configuration', ['declarative', 'yaml']],
    ['Durable execution', ['durable', 'checkpoint']],
    ['Client/server', ['client', 'server']],
    ['Security', ['authorization', 'auth', 'purview']],
    ['Microsoft 365', ['m365', 'microsoft 365']]
  ];

  for (const [concept, needles] of checks) {
    if (needles.some((needle) => haystack.includes(needle))) concepts.add(concept);
  }

  if (concepts.size < 3) {
    concepts.add(unit.categoryFolder.includes('workflow') ? 'Workflows' : 'Agents');
    concepts.add('Prompting');
    concepts.add('Sample structure');
  }

  return [...concepts].slice(0, 6);
}

function providerFor(unit: ProjectUnit) {
  const haystack = `${unit.samplePath} ${unit.sourceText}`.toLowerCase();
  if (haystack.includes('anthropic')) return 'Anthropic';
  if (haystack.includes('google') || haystack.includes('gemini')) return 'Google Gemini';
  if (haystack.includes('ollama')) return 'Ollama';
  if (haystack.includes('onnx')) return 'ONNX Runtime';
  if (haystack.includes('githubcopilot') || haystack.includes('github copilot')) return 'GitHub Copilot';
  if (haystack.includes('azureopenai') || haystack.includes('azure openai')) return 'Azure OpenAI';
  if (haystack.includes('foundry') || haystack.includes('azureai')) return 'Azure AI Foundry';
  if (haystack.includes('openai')) return 'OpenAI';
  if (haystack.includes('m365') || haystack.includes('microsoft 365')) return 'Microsoft 365';
  return 'Provider neutral';
}

function hostingFor(unit: ProjectUnit) {
  const haystack = `${unit.samplePath} ${unit.projectFile}`.toLowerCase();
  if (haystack.includes('azurefunctions')) return 'Azure Functions';
  if (haystack.includes('apphost') || haystack.includes('aspire')) return 'Aspire app host';
  if (haystack.includes('web') || haystack.includes('razor') || haystack.includes('service')) return 'ASP.NET Core';
  if (haystack.includes('hosted')) return 'Foundry hosted agent';
  return 'Console app';
}

function envVarsFor(unit: ProjectUnit) {
  const matches = [...unit.sourceText.matchAll(/(?:Environment\.GetEnvironmentVariable\(|%)(["']?)([A-Z][A-Z0-9_]{2,})\1/g)];
  const fromLocalSettings = [...unit.sourceText.matchAll(/"([A-Z][A-Z0-9_]{2,})"\s*:/g)];
  const all = [...matches.map((match) => match[2]), ...fromLocalSettings.map((match) => match[1])];

  return [...new Set(all)]
    .filter((name) => !['DEBUG', 'TRACE'].includes(name))
    .sort();
}

function prerequisitesFor(unit: ProjectUnit, provider: string, hosting: string, envVars: string[]) {
  const prereqs = ['.NET SDK that matches the sample target framework', 'A local clone of the Agent Framework samples repository'];

  if (provider !== 'Provider neutral') prereqs.push(`${provider} access and credentials for the configured model or service`);
  if (envVars.length > 0) prereqs.push('Environment variables from the configuration table below');
  if (hosting === 'Azure Functions') prereqs.push('Azure Functions Core Tools for local function hosting');
  if (hosting.includes('Aspire')) prereqs.push('.NET Aspire workload support for running the app host');
  if (unit.samplePath.toLowerCase().includes('durable')) prereqs.push('Durable Task Scheduler emulator or a configured Durable Task endpoint');

  return prereqs;
}

function runCommandsFor(unit: ProjectUnit, hosting: string, companionProjects: CompanionProject[]) {
  if (companionProjects.length > 1) {
    const scenarioRoot = scenarioKeyFor(unit);
    return [
      `cd code/agent-framework/dotnet/samples/${scenarioRoot}`,
      ...companionProjects.map((project, index) => `# Terminal ${index + 1}: ${project.title}\n${project.command}`)
    ];
  }

  const commands = [`cd code/agent-framework/dotnet/samples/${unit.samplePath}`, 'dotnet restore'];
  commands.push(hosting === 'Azure Functions' ? 'func start' : 'dotnet run');
  return commands;
}

function expectedOutputFor(title: string, hosting: string, companionProjects: CompanionProject[]) {
  const output = [
    `${title} starts without build errors.`,
    'The terminal shows model, agent, workflow, or HTTP activity that matches the sample scenario.'
  ];

  if (hosting === 'Azure Functions') output.push('The Functions host prints local endpoint URLs and durable orchestration logs.');
  if (companionProjects.length > 1) output.push('Each required process stays running, and the client process can reach the server or app host.');
  output.push('The run ends cleanly or waits for input according to the sample behavior.');

  return output;
}

function troubleshootingFor(hosting: string, provider: string, envVars: string[]) {
  const items = [
    'If restore fails, confirm you are running commands from the sample folder and that the configured .NET SDK is installed.',
    'If authentication fails, re-check the credential source and restart the terminal after setting environment variables.',
    'If model calls time out, verify the deployment name, endpoint, network access, and quota for the provider.'
  ];

  if (envVars.length > 0) items.push(`Missing configuration usually means one of these variables is not set: ${envVars.join(', ')}.`);
  if (hosting === 'Azure Functions') items.push('If `func start` is unavailable, install Azure Functions Core Tools and reopen the terminal.');
  if (provider === 'Ollama') items.push('For Ollama samples, start the local Ollama service and pull the model expected by the sample.');

  return items;
}

function difficultyFor(unit: ProjectUnit, hosting: string): Difficulty {
  const haystack = `${unit.samplePath} ${unit.projectFile}`.toLowerCase();
  if (hosting !== 'Console app' || haystack.includes('end-to-end') || haystack.includes('computeruse') || haystack.includes('sharepoint')) {
    return 'Advanced';
  }

  if (haystack.includes('step01') || haystack.includes('01_') || unit.categoryFolder === '01-get-started') return 'Beginner';
  return 'Intermediate';
}

function timeFor(unit: ProjectUnit, companionProjects: CompanionProject[]) {
  if (companionProjects.length > 1) return '45 min';
  if (unit.categoryFolder === '01-get-started') return '20 min';
  if (unit.categoryFolder === '04-hosting' || unit.categoryFolder === '05-end-to-end') return '40 min';
  return '30 min';
}

function descriptionFor(title: string, category: string, concepts: string[], hosting: string) {
  const authoredDescriptions: Record<string, string> = {
    'Hello Agent': 'Run your first console agent, watch it stream a response, and see how the client and server pieces fit together.',
    'Add Tools': 'Add function tools to an agent so it can call local code while handling a user request.',
    'Multi Turn': 'Keep a conversation going across turns and see how an agent session preserves context.',
    Memory: 'Connect memory to the agent flow and observe how stored context changes later responses.',
    'First Workflow': 'Build a small workflow with executors and edges, then run it to see each step move through the graph.',
    'Host Your Agent': 'Expose an agent through a host so the sample can receive requests outside a single console run.'
  };

  return (
    authoredDescriptions[title] ??
    `Run this ${category.toLowerCase()} lesson to explore ${concepts.slice(0, 2).join(' and ').toLowerCase()} in a ${hosting.toLowerCase()} sample.`
  );
}

function seriesDescriptionFor(series: string, category: string) {
  return `Ordered guided tutorials for ${series} in the ${category.toLowerCase()} learning path.`;
}

function compareTutorials(a: Tutorial, b: Tutorial) {
  const categoryCompare = categorySortValue(a.categorySlug) - categorySortValue(b.categorySlug);
  if (categoryCompare !== 0) return categoryCompare;

  const seriesCompare = a.seriesSlug.localeCompare(b.seriesSlug, undefined, { numeric: true });
  if (seriesCompare !== 0) return seriesCompare;

  const orderCompare = a.seriesOrder - b.seriesOrder;
  if (orderCompare !== 0) return orderCompare;

  return (a.samplePath ?? a.slug).localeCompare(b.samplePath ?? b.slug, undefined, { numeric: true });
}

function categorySortValue(slug: string) {
  const index = CATEGORY_ORDER.indexOf(slug);
  return index === -1 ? CATEGORY_ORDER.length : index;
}

function pathRelative(from: string, to: string) {
  return path.relative(from, to).replaceAll('\\', '/');
}
