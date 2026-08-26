/**
 * `interlace-ui` — argv → plan. Pure; no I/O, no process, no network.
 *
 * The CLI is deliberately a THIN FRONT DOOR over the shadcn CLI, not a
 * reimplementation of it. shadcn already owns the hard part — resolving an
 * item, reading `components.json`, rewriting aliases, installing npm
 * dependencies, writing files to the right targets. Re-doing any of that here
 * would mean re-doing it forever, one shadcn release behind, and the first
 * divergence would be a consumer whose install works with one CLI and not the
 * other.
 *
 * So `add` and `init` produce a shadcn ARGV that this process then spawns, and
 * this module's whole job is deciding what that argv should be. Keeping it
 * pure is what makes the interesting behaviour — name resolution, passthrough,
 * the shadcn-compatibility rule below — testable without a network or a
 * scratch directory.
 *
 * ─── The resolution rule ──────────────────────────────────────────────────
 *
 * `interlace-ui add` is a SUPERSET of `shadcn add`, never a replacement:
 *
 *   button              → https://ds.interlace.tools/r/button.json  (ours)
 *   @interlace/button   → https://ds.interlace.tools/r/button.json  (ours)
 *   @shadcn/button      → passed through verbatim
 *   https://x/y.json    → passed through verbatim
 *
 * A bare name is the only form we claim. Every other form is somebody else's
 * namespace and we hand it to shadcn untouched, so a consumer can install from
 * us and from anywhere else in one command and never has to choose a CLI.
 */

/** Production registry. Overridable so a branch deploy can be installed from. */
export const DEFAULT_REGISTRY = 'https://ds.interlace.tools';

/**
 * The shadcn CLI is fetched at spawn time rather than declared as a dependency.
 *
 * Declaring it would pin every consumer to whatever version we last shipped,
 * and a component registry has no business deciding which shadcn a consumer's
 * project runs. `npx` resolves it against their cache like it would if they
 * had typed `npx shadcn@latest` themselves — which is exactly the command our
 * registry pages already tell them to type.
 */
export const SHADCN_SPEC = process.env.INTERLACE_SHADCN_SPEC ?? 'shadcn@latest';

export type Plan =
  | { kind: 'help'; exitCode: number }
  | { kind: 'version' }
  | { kind: 'list'; registry: string }
  | { kind: 'info'; registry: string; name: string }
  | { kind: 'shadcn'; registry: string; argv: string[]; dryRun: boolean; alias: boolean }
  | { kind: 'error'; message: string };

const COMMANDS = new Set(['init', 'add', 'list', 'ls', 'info', 'help']);

/**
 * True when `token` names a component in OUR registry rather than somebody
 * else's. Bare names and the `@interlace/` alias are ours; a URL or any other
 * `@namespace/` prefix is not.
 */
export const isOurs = (token: string): boolean => {
  if (/^[a-z]+:\/\//i.test(token)) return false;
  if (token.startsWith('@')) return token.startsWith('@interlace/');
  return true;
};

/** Absolute registry-item URL for a bare or `@interlace/`-prefixed name. */
export const itemUrl = (registry: string, token: string): string => {
  const name = token.startsWith('@interlace/') ? token.slice('@interlace/'.length) : token;
  return `${registry.replace(/\/+$/, '')}/r/${name}.json`;
};

/**
 * Resolve one `add` argument.
 *
 * Flags (`--overwrite`, `-y`) and everything that is not ours pass through
 * untouched — see the header. A flag is anything starting with `-`, which is
 * also why `isOurs` is never asked about one.
 */
export const resolveToken = (registry: string, token: string): string =>
  token.startsWith('-') || !isOurs(token) ? token : itemUrl(registry, token);

/**
 * Our own options. Everything else in argv belongs to shadcn.
 *
 * This is walked by hand rather than handed to `node:util`'s `parseArgs`,
 * which cannot express it: in strict mode it REJECTS an unknown flag, and in
 * non-strict mode it CONSUMES one into `values` instead of leaving it in the
 * positionals — either way `interlace-ui add button --overwrite` loses the
 * `--overwrite` that the user expects shadcn to receive. Walking the tokens
 * ourselves also preserves argument order, which `parseArgs` discards and
 * which matters because shadcn reads its arguments positionally.
 */
const OWN_FLAGS = new Set(['--help', '-h', '--version', '-v', '--dry-run']);

type Parsed = {
  help: boolean;
  version: boolean;
  dryRun: boolean;
  registry?: string;
  rest: string[];
  error?: string;
};

const parse = (argv: readonly string[]): Parsed => {
  const out: Parsed = { help: false, version: false, dryRun: false, rest: [] };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i]!;

    if (token === '--registry' || token.startsWith('--registry=')) {
      const inline = token.startsWith('--registry=') ? token.slice('--registry='.length) : undefined;
      const value = inline ?? argv[++i];
      // `--registry=` with nothing after it would otherwise resolve every
      // item against a relative `/r/<name>.json` — a request to nowhere.
      if (!value || value.startsWith('-')) {
        out.error = '--registry needs a URL';
        return out;
      }
      out.registry = value;
      continue;
    }

    if (OWN_FLAGS.has(token)) {
      if (token === '--help' || token === '-h') out.help = true;
      else if (token === '--version' || token === '-v') out.version = true;
      else out.dryRun = true;
      continue;
    }

    out.rest.push(token);
  }

  return out;
};

export const planFromArgv = (argv: readonly string[]): Plan => {
  const parsed = parse(argv);
  if (parsed.error) return { kind: 'error', message: parsed.error };

  const registry = parsed.registry ?? DEFAULT_REGISTRY;
  const command = parsed.rest[0];

  if (parsed.version) return { kind: 'version' };
  // `--help` with no command is a successful request for help; an unknown or
  // missing command is a usage error. Same text, different exit code, because
  // `interlace-ui --help | head` should not report failure.
  if (parsed.help && !command) return { kind: 'help', exitCode: 0 };
  if (!command) return { kind: 'help', exitCode: 1 };
  if (!COMMANDS.has(command)) {
    return { kind: 'error', message: `Unknown command: ${command}` };
  }
  if (command === 'help' || parsed.help) return { kind: 'help', exitCode: 0 };

  const rest = parsed.rest.slice(1);
  const dryRun = parsed.dryRun;

  if (command === 'list' || command === 'ls') return { kind: 'list', registry };

  if (command === 'info') {
    const name = rest.find((t) => !t.startsWith('-'));
    if (!name) return { kind: 'error', message: 'info needs a component name' };
    return { kind: 'info', registry, name };
  }

  if (command === 'init') {
    // `alias` asks the caller to write the `@interlace` entry into
    // components.json once shadcn has created it — that is what makes plain
    // `shadcn add @interlace/button` work afterwards, so a consumer is never
    // locked into this CLI by having used it.
    return { kind: 'shadcn', registry, argv: ['init', ...rest], dryRun, alias: true };
  }

  // add
  if (rest.every((t) => t.startsWith('-'))) {
    return { kind: 'error', message: 'add needs at least one component name' };
  }
  return {
    kind: 'shadcn',
    registry,
    argv: ['add', ...rest.map((t) => resolveToken(registry, t))],
    dryRun,
    alias: false,
  };
};
