import type { WorkflowStep } from './types'

/**
 * Parse a WORKFLOW.md file into WorkflowStep[].
 *
 * Handles multiple formats Claude generates:
 *
 * Format A (numbered list with bold title and separator):
 *   1. **Navigate to login page** — Open `https://example.com`
 *
 * Format B (numbered list, plain text, sub-bullets):
 *   1. Navigate to `https://lu.ma/signin`
 *      - The page loads with options...
 *
 * Format C (heading per step):
 *   ### 1. Navigate to Luma sign-in page
 *   - **Action:** Open `https://lu.ma/signin`
 */
export function parseSkillMd(content: string): WorkflowStep[] {
  // Normalize line endings
  content = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

  // Try to isolate the ## Steps section; fall back to full content
  const stepsMatch = content.match(/##\s*Steps\s*\n([\s\S]*?)(?=\n##[^#]|\n---|$)/)
  const body = stepsMatch ? stepsMatch[1] : content

  // Try heading-based format first (### N. Title)
  const headingSteps = parseHeadingSteps(body)
  if (headingSteps.length > 0) return headingSteps

  // Try numbered list format (1. ...)
  const listSteps = parseNumberedList(body)
  if (listSteps.length > 0) return listSteps

  return []
}

/**
 * Parse steps defined as ### headings:
 *   ### 1. Title here
 *   - **Action:** do something
 */
function parseHeadingSteps(text: string): WorkflowStep[] {
  const steps: WorkflowStep[] = []
  // Split on ### N. headings, keeping the heading text
  const parts = text.split(/^###\s+(\d+)\.\s+(.+)$/m)

  // parts: [preamble, num1, title1, body1, num2, title2, body2, ...]
  for (let i = 1; i + 2 <= parts.length; i += 3) {
    const num = parseInt(parts[i])
    const title = parts[i + 1].trim()
    const body = (parts[i + 2] ?? '').trim()

    // Extract description from body lines
    const description = extractDescription(body)
    const outcome = extractOutcome(body)
    const code = extractCode(description || body)
    const type = inferStepType(title + ' ' + description)

    steps.push({
      id: `step-${num}`,
      stepNumber: num,
      title,
      description,
      type,
      code,
      outcome,
    })
  }

  return steps
}

/**
 * Parse numbered list items:
 *   1. **Bold title** — description
 *   1. Plain title text
 *      - Sub-bullet detail
 */
function parseNumberedList(text: string): WorkflowStep[] {
  const steps: WorkflowStep[] = []
  const lines = text.split('\n')

  let i = 0
  while (i < lines.length) {
    const line = lines[i]

    // Match: N. rest-of-line (with optional bold and separator)
    const match = line.match(/^\s*(\d+)\.\s+(.+)/)
    if (!match) { i++; continue }

    const num = parseInt(match[1])
    let rest = match[2].trim()

    // Collect sub-bullets that follow (indented or starting with -)
    const subLines: string[] = []
    let j = i + 1
    while (j < lines.length) {
      const next = lines[j]
      // Continuation: indented line or sub-bullet
      if (/^\s{2,}/.test(next) || /^\s+-\s/.test(next)) {
        subLines.push(next.trim().replace(/^-\s*/, ''))
        j++
      } else {
        break
      }
    }
    i = j

    // Parse title and description from rest
    let title: string
    let description: string

    // Try: **Bold title** — description
    const boldSepMatch = rest.match(/^\*\*(.+?)\*\*\s*[-—–:]\s*(.*)/)
    if (boldSepMatch) {
      title = boldSepMatch[1].trim()
      description = boldSepMatch[2].trim()
    } else {
      // Try: **Bold title** (no separator)
      const boldMatch = rest.match(/^\*\*(.+?)\*\*\s*(.*)/)
      if (boldMatch) {
        title = boldMatch[1].trim()
        description = boldMatch[2].trim()
      } else {
        // Try: Plain text — description
        const sepMatch = rest.match(/^(.+?)\s*[-—–]\s+(.+)/)
        if (sepMatch) {
          title = sepMatch[1].replace(/\*\*/g, '').trim()
          description = sepMatch[2].trim()
        } else {
          // Plain text, no separator — entire line is the title
          title = rest.replace(/\*\*/g, '').trim()
          description = subLines.join('. ').replace(/\*\*/g, '').trim()
        }
      }
    }

    // Append sub-line info to description if we have a title already
    if (subLines.length > 0 && description) {
      description = description + ' | ' + subLines.map(s => s.replace(/\*\*/g, '')).join('. ')
    } else if (subLines.length > 0 && !description) {
      description = subLines.map(s => s.replace(/\*\*/g, '')).join('. ')
    }

    const code = extractCode(title + ' ' + description)
    const type = inferStepType(title + ' ' + description)

    // Search sub-lines for **Expected:** value
    const outcome = extractOutcome(subLines.join('\n'))

    steps.push({
      id: `step-${num}`,
      stepNumber: num,
      title,
      description,
      type,
      code,
      outcome,
    })
  }

  return steps
}

/** Extract the **Expected:** value from a block of text. */
function extractOutcome(text: string): string | undefined {
  const m = text.match(/\*\*Expected:\*\*\s*(.+)/)
  return m ? m[1].trim() : undefined
}

/** Pull the first **Action:** or **Expected:** value, or first sentence. */
function extractDescription(body: string): string {
  // Try **Action:** line
  const actionMatch = body.match(/\*\*Action:\*\*\s*(.+)/)
  if (actionMatch) return actionMatch[1].trim()

  // First non-empty line
  const firstLine = body.split('\n').find(l => l.trim().length > 0)
  return firstLine?.trim().replace(/^-\s*/, '').replace(/\*\*/g, '') ?? ''
}

/** Extract the first backtick-delimited code from text. */
function extractCode(text: string): string | undefined {
  const m = text.match(/`([^`]+)`/)
  return m ? m[1] : undefined
}

function inferStepType(text: string): WorkflowStep['type'] {
  const lower = text.toLowerCase()
  if (/\b(navigate|open|go\s+to|visit|browse|url|load)\b/.test(lower)) return 'navigate'
  if (/\b(wait|delay|pause|timeout|sleep|loading|linking)\b/.test(lower)) return 'wait'
  if (/\b(verify|check|assert|confirm|validate|expect|ensure)\b/.test(lower)) return 'verify'
  if (/\b(error|fail|exception|crash)\b/.test(lower)) return 'error'
  return 'action'
}
