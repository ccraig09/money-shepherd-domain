# New Machine Setup

Guide to set up a new development machine for Money Shepherd so Claude Code has full context from the start.

## 1. Prerequisites

```bash
# Homebrew (if not installed)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Node.js (LTS)
brew install node

# GitHub CLI
brew install gh
gh auth login

# Clone the repo
git clone git@github.com:ccraig09/money-shepherd-domain.git
cd money-shepherd-domain
npm install
```

## 2. Environment Variables

Copy `.env` from the old machine into the repo root. This file contains Firebase and Plaid keys and is not committed to git.

```bash
# On old machine
scp .env <new-machine>:~/Development/.../money-shepherd-domain/.env

# Or copy manually — the file has EXPO_PUBLIC_FIREBASE_* and Plaid sandbox vars.
# See DEV_CHEATSHEET.md for the full list of required variables.
```

## 3. Claude Code Official Plugins

Install these from the Claude marketplace (run inside Claude Code):

```
/install-plugin context7
/install-plugin firebase
/install-plugin frontend-design
```

## 4. Claude Code Community Skills

```bash
# sickn33/antigravity-awesome-skills
claude skill add --from github:sickn33/antigravity-awesome-skills --skill plaid-fintech
claude skill add --from github:sickn33/antigravity-awesome-skills --skill prisma-expert
claude skill add --from github:sickn33/antigravity-awesome-skills --skill github-actions-templates
claude skill add --from github:sickn33/antigravity-awesome-skills --skill git-pushing
claude skill add --from github:sickn33/antigravity-awesome-skills --skill react-native-architecture
claude skill add --from github:sickn33/antigravity-awesome-skills --skill firebase

# google-labs-code/stitch-skills
claude skill add --from github:google-labs-code/stitch-skills --skill react-components
claude skill add --from github:google-labs-code/stitch-skills --skill design-md

# ramziddin/solid-skills
claude skill add --from github:ramziddin/solid-skills --skill solid

# BenedictKing/context7-auto-research
claude skill add --from github:BenedictKing/context7-auto-research --skill context7-auto-research

# vercel-labs/skills
claude skill add --from github:vercel-labs/skills --skill find-skills
```

## 5. Custom `/done` Command

Create `~/.claude/commands/done.md`:

```bash
mkdir -p ~/.claude/commands
cat > ~/.claude/commands/done.md << 'EOF'
Close the GitHub issue for the ticket(s) just completed, mark them [x] in PHASE_PLAN.MD, commit each ticket as its own git commit with a conventional commit message (feat/fix/docs + ticket ID in the body), then push to origin/main. Verify git status is clean after pushing.
EOF
```

## 6. Verify

Open Claude Code in the repo directory and send:

> Read CLAUDE.md, PHASE_PLAN.MD, and run `git log --oneline -20`. Next ticket is MS-19.15.

Claude should:
- Know the `/done` workflow without being told
- Not flag the `getReactNativePersistence` TS error as a regression
- Quote `(tabs)` paths in git commands
- Answer "What's the next ticket?" with MS-19.15
