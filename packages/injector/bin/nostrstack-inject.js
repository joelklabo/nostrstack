#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

function usage() {
  console.log(`nostrstack-inject

Inject @nostrstack/embed tags into static HTML/MD/MDX output.

Options:
  -i, --input <path>     File or directory to process (default: dist)
  -t, --tenant <id>      Tenant/Lightning address (required)
  -a, --api-base <url>   nostrstack API base URL (optional)
  -H, --host <host>      Host header to send with embed requests (optional)
  -r, --relays <list>    Comma-separated relay URLs for comments (optional)
  --share               Add share button section (requires --share-url)
  --share-url <url>     URL to share for the Share button
  --share-title <title> Optional title for the Share button
  --profile <id>        Nostr profile identifier (npub or nip05)
  --blockchain          Add blockchain stats section
  --blockchain-title <title> Optional title for the blockchain stats section
  -h, --help             Show help

Idempotent: skips files already containing the nostrstack-inject marker.`);
}

function parseArgs(argv) {
  const args = {
    input: 'dist',
    tenant: null,
    apiBase: null,
    host: null,
    relays: null,
    share: false,
    shareUrl: null,
    shareTitle: null,
    profile: null,
    blockchain: false,
    blockchainTitle: null,
    help: false
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case '-i':
      case '--input':
        args.input = argv[++i];
        break;
      case '-t':
      case '--tenant':
        args.tenant = argv[++i];
        break;
      case '-a':
      case '--api-base':
        args.apiBase = argv[++i];
        break;
      case '-H':
      case '--host':
        args.host = argv[++i];
        break;
      case '-r':
      case '--relays':
        args.relays = argv[++i];
        break;
      case '--share':
        args.share = true;
        break;
      case '--share-url':
        args.shareUrl = argv[++i];
        break;
      case '--share-title':
        args.shareTitle = argv[++i];
        break;
      case '--profile':
        args.profile = argv[++i];
        break;
      case '--blockchain':
        args.blockchain = true;
        break;
      case '--blockchain-title':
        args.blockchainTitle = argv[++i];
        break;
      case '-h':
      case '--help':
        args.help = true;
        break;
      default:
        if (arg.startsWith('-')) {
          throw new Error(`Unknown option: ${arg}`);
        }
        args.input = arg;
    }
  }
  return args;
}

function collectFiles(target) {
  const stats = fs.statSync(target);
  if (stats.isFile()) return [target];
  const files = [];
  for (const entry of fs.readdirSync(target)) {
    const full = path.join(target, entry);
    const s = fs.statSync(full);
    if (s.isDirectory()) {
      files.push(...collectFiles(full));
    } else if (/\.(html?|md|mdx)$/i.test(entry)) {
      files.push(full);
    }
  }
  return files;
}

function hasMarker(content) {
  return content.includes('nostrstack-inject start');
}

function deriveThreadId(filePath, root) {
  const rel = path.relative(root, filePath).replace(/\\/g, '/');
  const noExt = rel.replace(/\.[^.]+$/, '');
  return `post-${noExt.replace(/\//g, '-')}`;
}

function buildSnippet({
  tenant,
  apiBase,
  host,
  relays,
  threadId,
  shareUrl,
  shareTitle,
  profileId,
  blockchainTitle,
  includeShare,
  includeProfile,
  includeBlockchain
}) {
  const attrsTip = [
    `data-nostrstack-tip="${tenant}"`,
    apiBase ? `data-base-url="${apiBase}"` : null,
    host ? `data-host="${host}"` : null,
  ].filter(Boolean).join(' ');
  const attrsComments = [
    `data-nostrstack-comments="${threadId}"`,
    relays ? `data-relays="${relays}"` : null,
  ].filter(Boolean).join(' ');
  const attrsShare = [
    shareUrl ? `data-nostrstack-share="${shareUrl}"` : null,
    shareTitle ? `data-title="${shareTitle}"` : null,
  ].filter(Boolean).join(' ');
  const attrsProfile = [
    profileId ? `data-nostrstack-profile="${profileId}"` : null,
    apiBase ? `data-base-url="${apiBase}"` : null,
    host ? `data-host="${host}"` : null,
  ].filter(Boolean).join(' ');
  const attrsBlockchain = [
    `data-nostrstack-blockchain="true"`,
    apiBase ? `data-base-url="${apiBase}"` : null,
    host ? `data-host="${host}"` : null,
    blockchainTitle ? `data-title="${blockchainTitle}"` : null,
  ].filter(Boolean).join(' ');

  const sections = [
    '<!-- nostrstack-inject start -->',
    '<script src="https://unpkg.com/@nostrstack/embed/dist/index.global.js"></script>',
    `<div ${attrsTip}></div>`,
    `<div ${attrsComments}></div>`,
    includeShare ? `<div ${attrsShare}></div>` : null,
    includeProfile ? `<div ${attrsProfile}></div>` : null,
    includeBlockchain ? `<div ${attrsBlockchain}></div>` : null,
    '<!-- nostrstack-inject end -->'
  ].filter(Boolean);

  return sections.join('\n');
}

function injectIntoContent(content, snippet) {
  if (hasMarker(content)) return null;
  const closeBody = content.lastIndexOf('</body>');
  if (closeBody !== -1) {
    return content.slice(0, closeBody) + snippet + '\n' + content.slice(closeBody);
  }
  return content.trimEnd() + '\n\n' + snippet + '\n';
}

function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(err.message);
    usage();
    process.exit(1);
  }

  if (args.help) {
    usage();
    process.exit(0);
  }

  if (!args.tenant) {
    console.error('Error: --tenant is required');
    usage();
    process.exit(1);
  }

  const includeShare = Boolean(args.share || args.shareUrl || args.shareTitle);
  const includeProfile = Boolean(args.profile);
  const includeBlockchain = Boolean(args.blockchain || args.blockchainTitle);

  if (includeShare && !args.shareUrl) {
    console.error('Error: --share-url is required when enabling share section');
    usage();
    process.exit(1);
  }

  if (includeProfile && !args.profile) {
    console.error('Error: --profile requires a profile identifier');
    usage();
    process.exit(1);
  }

  const target = path.resolve(process.cwd(), args.input);
  if (!fs.existsSync(target)) {
    console.error(`Input not found: ${target}`);
    process.exit(1);
  }

  const files = collectFiles(target);
  let touched = 0;
  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    const snippet = buildSnippet({
      tenant: args.tenant,
      apiBase: args.apiBase,
      host: args.host,
      relays: args.relays,
      threadId: deriveThreadId(file, target),
      shareUrl: args.shareUrl,
      shareTitle: args.shareTitle,
      profileId: args.profile,
      blockchainTitle: args.blockchainTitle,
      includeShare,
      includeProfile,
      includeBlockchain
    });
    const updated = injectIntoContent(content, snippet);
    if (updated) {
      fs.writeFileSync(file, updated, 'utf8');
      touched += 1;
      console.log(`Injected: ${path.relative(process.cwd(), file)}`);
    }
  }

  console.log(`Done. Processed ${files.length} files; injected ${touched}.`);
}

main();
