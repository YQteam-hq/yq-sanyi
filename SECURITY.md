# Security Policy

## Supported versions

| Version | Supported |
| --- | --- |
| 0.3.x | yes |
| 0.2.x | security fixes only |
| < 0.2 | no |

Only the latest `0.3.x` patch receives fixes for functional defects. Older lines
are reviewed for security reports alone, and a fix is backported only when the
affected code is still present in that line.

## Reporting a vulnerability

Please do not open a public issue for a suspected vulnerability.

Use one of the following private channels:

1. GitHub Security Advisories — open the repository's Security tab and choose
   "Report a vulnerability". This is the preferred channel because it keeps the
   discussion private until a fix is published and lets us credit you.
2. A private security advisory draft if the Security tab is unavailable, sent to
   the maintainers through a direct message.

Include, as far as you can:

- the affected version and how it is consumed (bundle, source checkout);
- a minimal template or page that reproduces the problem;
- the impact you observed and, if known, the affected source file;
- any suggested fix, if you have one.

## Response expectations

- **First response:** within 7 days of the report. If the report is accepted we
  confirm the affected versions and the planned fix; if it is declined we explain
  why.
- **Fix and disclosure:** a fix is prepared on a private branch and released with
  the next patch version. We ask for at least 14 days between the private fix and
  public disclosure, and we coordinate the disclosure date with the reporter.
- **Credit:** reporters are credited in the release notes unless they ask to stay
  anonymous.

## Scope

yq-sanyi has zero runtime dependencies, so the dependency surface is limited to
the two development-only packages `typescript` and `esbuild`, which never ship in
the browser bundle. Reports about the runtime are therefore evaluated against
`packages/core/src`, `packages/scoper/src` and `packages/devtools/src`.

Out of scope, because they are documented non-goals of this release: server-side
rendering, non-browser targets, and the command line interface.
