# Condense README Files

## Goal
Make all README files concise and scannable. Remove fluff, not information. Keep everything devs and users need.

## Core Rule
**Condense = reduce verbosity, NOT omit content.** Every feature, API, prop, gotcha, and example purpose must remain. Only the words used to describe them get shorter.

## Steps

1. **Scan all READMEs**
   - Read every `@*-README.md` and `@README.md`
   - Map current structure and content
   - Note redundancies across files

2. **Analyze each README**
   - Identify verbose sections
   - Find repeated information
   - Flag unnecessary explanations
   - Mark essential vs nice-to-have content

3. **Condense content**
   - Cut filler words and phrases
   - Merge overlapping sections
   - Convert paragraphs to bullet points where clearer
   - Shorten code examples to minimum viable
   - Remove obvious statements

4. **Verify completeness**
   - All APIs/interfaces still documented
   - Usage examples still work
   - Setup instructions still complete
   - No broken references

5. **Apply direct tone**
   - Remove hedging language ("might", "could", "generally")
   - Use imperative mood ("Run X" not "You can run X")
   - Cut introductory fluff
   - State facts directly

## Condensing Rules

**REPHRASE (cut words, keep meaning):**
- "This component/function is used to..." → Just state what it does
- "In order to..." → "To..."
- "Please note that..." → Just state the note
- "It's important to remember..." → State the fact
- Redundant section intros → Remove or merge
- Over-explained obvious patterns → One-liner

**KEEP (never remove):**
- Function signatures and props
- Required setup steps
- Non-obvious gotchas
- Breaking change notes
- All usage examples (condense code, not quantity)
- Type definitions
- Error handling guidance
- Edge cases and warnings
- All documented features

**CONVERT (same info, tighter format):**
- Long paragraphs → Concise bullets
- Verbose explanations → Direct statements
- Nested lists → Flat structure where possible
- Wordy examples → Minimal but complete examples

## Target Format

```markdown
## ComponentName

Brief one-liner purpose.

### Props
| Prop | Type | Required | Description |
|------|------|----------|-------------|

### Usage
\`\`\`tsx
// Minimal working example
\`\`\`

### Notes
- Key gotcha 1
- Key gotcha 2
```

## Quality Checks
- [ ] No section longer than necessary
- [ ] No repeated information across READMEs
- [ ] All code examples are minimal but complete
- [ ] Direct tone throughout
- [ ] Essential info preserved
- [ ] Scannable in under 2 minutes per file

## Do NOT
- Remove any type definitions
- Skip any error handling docs
- Cut any setup/install steps
- Delete any API signatures
- Remove any breaking change notes
- Omit any required props/params
- Drop any usage examples
- Remove any edge case documentation
- Delete any warnings or gotchas
- Truncate any essential information

## Final Check
Before saving any README, verify: "Did I remove any actual information, or just unnecessary words?" If any info was lost, restore it.
