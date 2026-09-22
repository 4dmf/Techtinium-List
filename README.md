# Techtinium SafeList

![](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/Ealenn/AdGuard-Home-List/gh-pages/badge-allow.json&style=for-the-badge&logo=firefox)
![](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/Ealenn/AdGuard-Home-List/gh-pages/badge-block.json&style=for-the-badge&logo=AdBlock)

Fork of [Ealenn/AdGuard-Home-List](https://github.com/Ealenn/AdGuard-Home-List), focused on one goal: formatting and curating safelist/allowlist data according to Technitium standards for use in [Technitium](https://technitium.com/dns/).

This repository keeps the upstream list-building workflow while adapting structure and content conventions for Technitium's SafeList requirements.

## Table of Contents

- [Techtinium SafeList](#techtinium-safelist)
  - [How to use this project](#how-to-use-this-project)
  - [About this fork](#about-this-fork)
  - [Custom List Provider](#custom-list-provider)
  - [External List Provider](#external-list-provider)
    - [Adding an external source](#adding-an-external-source)
    - [Current sources](#current-sources)
    - [Provider summary](#provider-summary)
    - [DNS Providers](#dns-providers)
    - [Building locally](#building-locally)
    - [Linting & formatting](#linting--formatting)

## How to use this project

Once you have Techtinium ready and are logged in, go to Settings -> Blocking to add one blocklist and one allowlist.

Use the generated list URLs from this fork's release output.

```sh
# BlockList
https://raw.githubusercontent.com/4dmf/Techtinium-List/gh-pages/Techtinium-List.Block.txt

# AllowList (note the leading "!" on the URL)
! https://raw.githubusercontent.com/4dmf/Techtinium-List/gh-pages/Techtinium-List.Allow.txt
```

Technitium marks a list as an **allow** list by prefixing its **URL** with `!` (a single `!` and a space before the URL, exactly as shown above). Nothing else is needed.

The generated allow file is a plain hostname list, one hostname per line. Do **not** prefix the lines inside the file — a line starting with `!` is treated as a comment and ignored, so doing that would turn the whole allow list into a no-op. In short:

- **Block list:** paste the URL as-is.
- **Allow list:** paste `!` followed by the URL.
- **List file contents:** plain hostnames only, never `!`-prefixed.

## About this fork

- Purpose: maintain a Techtinium-formatted SafeList based on the upstream AdGuard Home list ecosystem.
- Scope: keep upstream-compatible list generation while refining safelist formatting and organization for Techtinium standards.
- Upstream: [Ealenn/AdGuard-Home-List](https://github.com/Ealenn/AdGuard-Home-List)

## Custom List Provider

The folders `allowlist/custom/**` and `blocklist/custom/**` contain handwritten entries. Every `*.txt`
file is read recursively, so you can organize them into sub-folders (`cdn/`, `dns/`, `services/`, ...)
without changing anything else.

A custom file is simply a list of rules, one per line. All of these forms are accepted and are
normalized to a bare hostname:

| You write                           | Result                                         |
| ----------------------------------- | ---------------------------------------------- |
| `example.com`                       | `example.com`                                  |
| `0.0.0.0 example.com` (hosts)       | `example.com`                                  |
| `127.0.0.1 example.com` (hosts)     | `example.com`                                  |
| `\|\|example.com^` (AdGuard)        | `example.com`                                  |
| `\|\|example.com^$important`        | `example.com`                                  |
| `*.example.com` (wildcard)          | `example.com`                                  |
| `https://example.com/path`          | `example.com`                                  |
| `@@\|\|example.com^` (exception)    | allow list: `example.com`, block list: skipped |
| `# comment` / `! comment`           | ignored                                        |
| `example.com##.selector` (cosmetic) | ignored                                        |
| `1.2.3.4` / `10.0.0.0/8`            | dropped from the domain lists                  |

Notes:

- `@@` (AdGuard exception) rules are kept **only** when generating the allow list. In the block list they are skipped, because an exception is not a block.
- Cosmetic/scriptlet rules (`##`, `#@#`, `#?#`, `#$#`, `#%#`, `#+js`, ...), regex rules and AdGuard headers are ignored; only network/host rules produce entries.
- IP addresses and CIDRs are dropped from the domain lists, because Technitium's Settings -> Blocking lists are hostname-only and skip IPs.
- Subdomains are collapsed: if both `example.com` and `ads.example.com` are present, only `example.com` is kept (Technitium matches suffixes, so it already covers the subdomain).
- Output is lowercased, deduplicated and sorted. Punycode (`xn--...`) is used for IDN hostnames.

Example custom entries:

```sh
# blocklist/custom/services/amazon.txt
# Amazon
||device-metrics-us-2.amazon.com^$important

# allowlist/custom/services/google.txt
# Google
@@||www.google.com^$important
```

## External List Provider

External sources are configured through **manifest** files. Each manifest contains one URL per line,
and is named `{TYPE}.external.{FORMAT}.list`. The `{FORMAT}` part (`hosts`, `pihole`, `adguard`, ...)
is only a label used to keep the manifests organized — every fetched line goes through the same
normalizer, so a `hosts` manifest may also contain AdGuard rules and vice-versa.

```sh
allowlist/
├── custom/
│   └── **/*.txt              # handwritten entries (see Custom List Provider)
├── external/
│   └── allowlist.external.hosts.list   # hosts/plain lists (--external)
│   └── allowlist.external.pihole.list  # Pi-hole/plain lists (--external)
└── concat/
    └── allowlist.external.adguard.list # AdGuard/ABP/uBO filter lists (--concatExternal)

blocklist/
├── custom/
│   └── **/*.txt
├── external/
│   └── blocklist.external.hosts.list
│   └── blocklist.external.pihole.list
│   └── blocklist.external.ip.list
└── concat/
    └── blocklist.external.adguard.list
```

These lists are downloaded, cleaned, deduplicated and combined during a release.

### Adding an external source

1. Decide whether it is a **plain/hosts** list or a **filter** list:
   - Plain/hosts/domains lists belong in `external/` (loaded via `--external`).
   - AdGuard/Adblock/ABP/uBO filter lists belong in `concat/` (loaded via `--concatExternal`).
2. Append the URL on its own line to the matching manifest, e.g. `blocklist/external/blocklist.external.hosts.list`.
3. Rebuild and regenerate (see [Building locally](#building-locally)). The new source is fetched at build time; no other change is required.

Rules:

- One URL per line; lines that do not match the URL pattern are ignored.
- Downloads are retried up to three times; a source that returns a non-200 status is logged and skipped instead of failing the build.
- The normalizer strips comments, host prefixes, `*.` wildcards, `$modifiers`, `^` separators, ports and paths, and keeps only bare hostnames (see [Custom List Provider](#custom-list-provider) for the full list of accepted forms).
- For the **allow** list, keep using `@@` exception rules (or plain hostnames). They are ignored in the block list.
- IP addresses and CIDRs are not usable in these domain manifests; they are dropped.

### Current sources

#### BlockList

`blocklist/external/blocklist.external.hosts.list` (hosts/plain):

- <https://adaway.org/hosts.txt>
- <https://pgl.yoyo.org/adservers/serverlist.php?hostformat=hosts&showintro=0&mimetype=plaintext>
- <https://raw.githubusercontent.com/FadeMind/hosts.extras/master/CoinBlockerList/hosts>
- <https://raw.githubusercontent.com/FadeMind/hosts.extras/master/GoodbyeAds-YouTube-Adblock-Extension/hosts>
- <https://raw.githubusercontent.com/FadeMind/hosts.extras/master/add.Dead/hosts>
- <https://raw.githubusercontent.com/FadeMind/hosts.extras/master/add.Spam/hosts>
- <https://raw.githubusercontent.com/FadeMind/hosts.extras/master/add.Risk/hosts>
- <https://raw.githubusercontent.com/StevenBlack/hosts/master/hosts>
- <https://raw.githubusercontent.com/anudeepND/blacklist/master/adservers.txt>
- <https://raw.githubusercontent.com/anudeepND/blacklist/master/CoinMiner.txt>
- <https://raw.githubusercontent.com/Yhonay/antipopads/master/hosts>
- <https://raw.githubusercontent.com/FadeMind/hosts.extras/master/antipopads-re/hosts>
- <https://blocklistproject.github.io/Lists/ads.txt>
- <https://blocklistproject.github.io/Lists/piracy.txt>
- <https://blocklistproject.github.io/Lists/ransomware.txt>
- <https://blocklistproject.github.io/Lists/tracking.txt>
- <https://blocklistproject.github.io/Lists/scam.txt>
- <https://blocklistproject.github.io/Lists/phishing.txt>
- <https://blocklistproject.github.io/Lists/abuse.txt>
- <https://blocklistproject.github.io/Lists/fraud.txt>
- <https://hblock.molinero.dev/hosts_domains.txt>
- <https://raw.githubusercontent.com/crazy-max/WindowsSpyBlocker/refs/heads/master/data/hosts/spy.txt>
- <https://raw.githubusercontent.com/Phishing-Database/Phishing.Database/master/phishing-domains-ACTIVE.txt>
- <https://cdn.jsdelivr.net/gh/hagezi/dns-blocklists@latest/wildcard/pro-onlydomains.txt>
- <https://raw.githubusercontent.com/hagezi/dns-blocklists/main/wildcard/tif-onlydomains.txt> (full Threat Intelligence Feed)
- <https://urlhaus.abuse.ch/downloads/hostfile/>

`blocklist/external/blocklist.external.pihole.list` (plain domains):

- <https://v.firebog.net/hosts/static/w3kbl.txt>
- <https://v.firebog.net/hosts/AdguardDNS.txt>
- <https://s3.amazonaws.com/lists.disconnect.me/simple_ad.txt>
- <https://s3.amazonaws.com/lists.disconnect.me/simple_malvertising.txt>
- <https://s3.amazonaws.com/lists.disconnect.me/simple_malware.txt>
- <https://s3.amazonaws.com/lists.disconnect.me/simple_tracking.txt>
- <https://phishing.army/download/phishing_army_blocklist.txt>
- <https://raw.githubusercontent.com/Spam404/lists/master/main-blacklist.txt>
- <https://raw.githubusercontent.com/Dogino/Discord-Phishing-URLs/main/scam-urls.txt>

`blocklist/concat/blocklist.external.adguard.list` (AdGuard/ABP filters):

- <https://adguardteam.github.io/AdguardFilters/BaseFilter/sections/adservers.txt>
- <https://adguardteam.github.io/AdguardFilters/MobileFilter/sections/adservers.txt>
- <https://raw.githubusercontent.com/easylist/easylist/master/easylist/easylist_adservers.txt>
- <https://raw.githubusercontent.com/Perflyst/PiHoleBlocklist/master/SmartTV-AGH.txt>
- <https://raw.githubusercontent.com/AdguardTeam/cname-trackers/master/data/combined_disguised_trackers.txt>
- <https://raw.githubusercontent.com/reek/anti-adblock-killer/master/anti-adblock-killer-filters.txt>
- <https://big.oisd.nl>

`blocklist/custom/**` (handwritten): `scam.txt`, `typo-squatting.txt` and `services/{amazon,apple,sonos,urban-vpn}.txt`.

#### AllowList

`allowlist/external/allowlist.external.hosts.list` (hosts/plain):

- <https://raw.githubusercontent.com/GoodnessJSON/PiHole-Whitelist/refs/heads/master/lists/whitelist.txt>
- <https://raw.githubusercontent.com/GoodnessJSON/PiHole-Whitelist/master/lists/optional-list.txt>
- <https://raw.githubusercontent.com/Dogino/Discord-Phishing-URLs/main/official-domains.txt>
- <https://raw.githubusercontent.com/anudeepND/whitelist/master/domains/whitelist.txt>

`allowlist/external/allowlist.external.pihole.list` (plain domains): currently empty (placeholder).

`allowlist/concat/allowlist.external.adguard.list` (AdGuard/ABP filters):

- <https://raw.githubusercontent.com/hl2guide/AdGuard-Home-Whitelist/main/Modules/Tech/ipfs_whitelist.txt>
- <https://raw.githubusercontent.com/hl2guide/AdGuard-Home-Whitelist/main/Modules/Tech/linux_whitelist.txt>
- <https://raw.githubusercontent.com/hl2guide/AdGuard-Home-Whitelist/main/Modules/Tech/redirectors_whitelist.txt>
- <https://raw.githubusercontent.com/hl2guide/AdGuard-Home-Whitelist/main/Modules/Tech/remote_access_whitelist.txt>
- <https://raw.githubusercontent.com/hl2guide/AdGuard-Home-Whitelist/main/Modules/Apps/brave_whitelist.txt>
- <https://raw.githubusercontent.com/hl2guide/AdGuard-Home-Whitelist/main/Modules/Apps/discord_whitelist.txt>
- <https://raw.githubusercontent.com/hl2guide/AdGuard-Home-Whitelist/main/Modules/Entertainment/games_whitelist.txt>
- <https://raw.githubusercontent.com/hl2guide/AdGuard-Home-Whitelist/main/Modules/Managers/password_managers_whitelist.txt>
- <https://raw.githubusercontent.com/hl2guide/AdGuard-Home-Whitelist/main/Modules/Organizations/apple_whitelist.txt>
- <https://raw.githubusercontent.com/hl2guide/AdGuard-Home-Whitelist/main/Modules/Organizations/microsoft_whitelist.txt>
- <https://raw.githubusercontent.com/hl2guide/AdGuard-Home-Whitelist/main/Modules/Organizations/mozilla_whitelist.txt>
- <https://raw.githubusercontent.com/hl2guide/AdGuard-Home-Whitelist/main/Modules/Organizations/nvidia_whitelist.txt>
- <https://raw.githubusercontent.com/hl2guide/AdGuard-Home-Whitelist/main/Modules/Shopping/payment_providers_whitelist.txt>
- <https://raw.githubusercontent.com/hl2guide/AdGuard-Home-Whitelist/main/Modules/Tech/cloud_storage_whitelist.txt>
- <https://raw.githubusercontent.com/hl2guide/AdGuard-Home-Whitelist/main/Modules/Tech/coding_whitelist.txt>
- <https://raw.githubusercontent.com/AdguardTeam/AdGuardSDNSFilter/refs/heads/master/Filters/exceptions.txt>
- <https://raw.githubusercontent.com/AdguardTeam/AdguardFilters/master/BaseFilter/sections/allowlist.txt>

`allowlist/custom/**` (handwritten): `url-shorteners.txt` and `cdn/`, `dns/`, `government/`, `services/` sub-folders.

### Provider summary

#### Services

- [AdGuardSDNSFilter/Filters](https://adguardteam.github.io/AdGuardSDNSFilter/Filters/filter.txt)
- [AdguardTeam/cname-trackers](https://github.com/AdguardTeam/cname-trackers) ![GitHub Repo stars](https://img.shields.io/github/stars/AdguardTeam/cname-trackers?style=flat-square)
- [Adaway](https://adaway.org)
- [Yoyo.org](https://pgl.yoyo.org/adservers/)
- [firebog.net](https://firebog.net)
- [disconnect.me](https://disconnect.me)
- [phishing.army](https://phishing.army)
- [hagezi/dns-blocklists](https://github.com/hagezi/dns-blocklists) ![GitHub Repo stars](https://img.shields.io/github/stars/hagezi/dns-blocklists?style=flat-square) ![GitHub Last Commit](https://img.shields.io/github/last-commit/hagezi/dns-blocklists?style=flat-square) (Wildcard/PRO + TIF lists)
- [OISD](https://oisd.nl) (Big list)
- [URLhaus (abuse.ch)](https://urlhaus.abuse.ch/)
- [AdguardTeam/AdguardFilters](https://github.com/AdguardTeam/AdguardFilters) ![GitHub Repo stars](https://img.shields.io/github/stars/AdguardTeam/AdguardFilters?style=flat-square) ![GitHub Last Commit](https://img.shields.io/github/last-commit/AdguardTeam/AdguardFilters?style=flat-square) (BaseFilter allowlist)

#### Community

- [StevenBlack/hosts](https://github.com/StevenBlack/hosts) ![GitHub Repo stars](https://img.shields.io/github/stars/StevenBlack/hosts?style=flat-square) ![GitHub Last Commit](https://img.shields.io/github/last-commit/StevenBlack/hosts?style=flat-square)
- [crazy-max/WindowsSpyBlocker](https://github.com/crazy-max/WindowsSpyBlocker) ![GitHub Repo stars](https://img.shields.io/github/stars/crazy-max/WindowsSpyBlocker?style=flat-square) ![GitHub Last Commit](https://img.shields.io/github/last-commit/crazy-max/WindowsSpyBlocker?style=flat-square) (Only Spy lists)
- [blocklistproject/Lists](https://github.com/blocklistproject/Lists) ![GitHub Repo stars](https://img.shields.io/github/stars/blocklistproject/Lists?style=flat-square) ![GitHub Last Commit](https://img.shields.io/github/last-commit/blocklistproject/Lists?style=flat-square)
- [anudeepND/blacklist](https://github.com/anudeepND/blacklist) ![GitHub Repo stars](https://img.shields.io/github/stars/anudeepND/blacklist?style=flat-square) ![GitHub Last Commit](https://img.shields.io/github/last-commit/anudeepND/blacklist?style=flat-square)
- [Phishing-Database/Phishing.Database](https://github.com/Phishing-Database/Phishing.Database) ![GitHub Repo stars](https://img.shields.io/github/stars/Phishing-Database/Phishing.Database?style=flat-square) ![GitHub Last Commit](https://img.shields.io/github/last-commit/Phishing-Database/Phishing.Database?style=flat-square)
- [FadeMind/hosts.extras](https://github.com/FadeMind/hosts.extras) ![GitHub Repo stars](https://img.shields.io/github/stars/FadeMind/hosts.extras?style=flat-square) ![GitHub Last Commit](https://img.shields.io/github/last-commit/FadeMind/hosts.extras?style=flat-square)
- [Yhonay/antipopads](https://github.com/Yhonay/antipopads) ![GitHub Repo stars](https://img.shields.io/github/stars/Yhonay/antipopads?style=flat-square) ![GitHub Last Commit](https://img.shields.io/github/last-commit/Yhonay/antipopads?style=flat-square)
- [Spam404/lists](https://github.com/Spam404/lists) ![GitHub Repo stars](https://img.shields.io/github/stars/Spam404/lists?style=flat-square) ![GitHub Last Commit](https://img.shields.io/github/last-commit/Spam404/lists?style=flat-square)
- [Perflyst/PiHoleBlocklist](https://github.com/Perflyst/PiHoleBlocklist) ![GitHub Repo stars](https://img.shields.io/github/stars/Perflyst/PiHoleBlocklist?style=flat-square) ![GitHub Last Commit](https://img.shields.io/github/last-commit/Perflyst/PiHoleBlocklist?style=flat-square)
- [Dogino/Discord-Phishing-URLs](https://github.com/Dogino/Discord-Phishing-URLs) ![GitHub Repo stars](https://img.shields.io/github/stars/Dogino/Discord-Phishing-URLs?style=flat-square) ![GitHub Last Commit](https://img.shields.io/github/last-commit/Dogino/Discord-Phishing-URLs?style=flat-square)
- [reek/anti-adblock-killer](https://github.com/reek/anti-adblock-killer) ![GitHub Repo stars](https://img.shields.io/github/stars/reek/anti-adblock-killer?style=flat-square) ![GitHub Last Commit](https://img.shields.io/github/last-commit/reek/anti-adblock-killer?style=flat-square) (Network rules only)

#### AllowList

- [hl2guide/AdGuard-Home-Whitelist](https://github.com/hl2guide/AdGuard-Home-Whitelist) ![GitHub Repo stars](https://img.shields.io/github/stars/hl2guide/AdGuard-Home-Whitelist?style=flat-square) ![GitHub Last Commit](https://img.shields.io/github/last-commit/hl2guide/AdGuard-Home-Whitelist?style=flat-square) (Only selected lists)
- [GoodnessJSON/PiHole-Whitelist](https://github.com/GoodnessJSON/PiHole-Whitelist) ![GitHub Repo stars](https://img.shields.io/github/stars/GoodnessJSON/PiHole-Whitelist?style=flat-square) ![GitHub Last Commit](https://img.shields.io/github/last-commit/GoodnessJSON/PiHole-Whitelist?style=flat-square)
- [anudeepND/whitelist](https://github.com/anudeepND/whitelist) ![GitHub Repo stars](https://img.shields.io/github/stars/anudeepND/whitelist?style=flat-square) ![GitHub Last Commit](https://img.shields.io/github/last-commit/anudeepND/whitelist?style=flat-square)

## DNS Providers

```sh
# AdGuard
94.140.14.14
94.140.15.15
https://dns.adguard.com/dns-query
tls://dns.adguard.com
# Google
8.8.8.8
8.8.4.4
https://dns.google/dns-query
tls://dns.google
# Cisco OpenDNS
208.67.222.222
208.67.220.220
https://doh.opendns.com/dns-query
# Cloudflare DNS
1.1.1.1
1.0.0.1
https://dns.cloudflare.com/dns-query
tls://1.1.1.1
# Dyn DNS
216.146.35.35
216.146.36.36
```

## Building locally

1. `cd modules/cli`
2. `npm install`
3. `npm run build`
4. From the repo root, create the output directory: `mkdir public`

This will generate the js files needed to run below from repo root. The `--output` directory must already exist.

```sh
node ./modules/cli/dist/main.js generate \
--name Techtinium-List.Allow.txt \
--badge badge-allow.json \
--external ./allowlist/external \
--custom ./allowlist/custom \
--concatExternal ./allowlist/concat \
--convertToAllow true \
--output ./public

node ./modules/cli/dist/main.js generate \
--name Techtinium-List.Block.txt \
--badge badge-block.json \
--external ./blocklist/external \
--custom ./blocklist/custom \
--concatExternal ./blocklist/concat \
--allowList ./public/Techtinium-List.Allow.txt \
--output ./public
```

The block generation is run **after** the allow generation. `--allowList` removes any block entry that is already covered by the allow list (Technitium lets an allow entry override a block, so those entries are dead weight). Pass `--debug false` to skip writing the large `debug.*` files (used for troubleshooting only); the Publish workflow does this and no longer publishes them.

## Linting & formatting

The repository ships an OS-agnostic lint/format setup (works the same on Windows, Linux and macOS; it only needs Node.js and npm):

```sh
# Check everything (no files are modified)
npm install
npm run lint

# Fix everything that can be fixed automatically
npm run lint:fix   # or: npm run format
```

`npm run lint` validates three things:

| Check           | What it covers                                     | Tool                            |
| --------------- | -------------------------------------------------- | ------------------------------- |
| `lint:prettier` | Markdown, YAML workflows, JSON and TS config files | [Prettier](https://prettier.io) |
| `lint:lists`    | List data files (`allowlist/**`, `blocklist/**`)   | `scripts/lint-lists.mjs`        |
| `lint:cli`      | The TypeScript CLI under `modules/cli`             | ESLint + Prettier               |

The data-file linter (`scripts/lint-lists.mjs`, zero dependencies) enforces the `.editorconfig` rules on every `*.txt` / `*.list` / `*.hosts` file: LF line endings, no trailing whitespace, a single final newline and no UTF-8 BOM. It can also be run directly on a subset:

```sh
node scripts/lint-lists.mjs --fix allowlist/custom
```

The [`Lint` workflow](.github/workflows/lint.yml) runs the same checks (check-only) on GitHub Actions on both Ubuntu and Windows for every pull request, so formatting issues fail CI before they are merged. `.gitattributes` keeps every text file at LF line endings regardless of the contributor's OS.
