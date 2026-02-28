export type SSEEvent =
  | { type: 'system_init'; message: string; session_id: string }
  | { type: 'assistant_text'; message: string }
  | { type: 'tool_use'; id: string; tool_name: string; tool_input: Record<string, unknown> }
  | { type: 'tool_result'; tool_use_id: string; content: string; is_error: boolean }
  | { type: 'skill_written'; path: string }
  | { type: 'complete'; message: string; cost?: number }
  | { type: 'error'; message: string }

export interface Session {
  id: string
  created_at: string
  claude_session_id?: string
  workspace: string
  title?: string
  has_skill_md?: boolean
  skill_title?: string
  video_path?: string
  video_name?: string
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'tool_use' | 'tool_result'
  content: string
  tool_name?: string
  tool_id?: string
  tool_input?: Record<string, unknown>
  is_error?: boolean
  video_name?: string
  timestamp: number
}

export interface WorkflowStep {
  id: string
  stepNumber: number
  title: string
  description: string
  type: 'navigate' | 'action' | 'wait' | 'verify' | 'error'
  details?: string[]
  code?: string
  branches?: WorkflowStep[]
}

export interface StackTraceEntry {
  timestamp: string
  level: 'info' | 'success' | 'warn' | 'error' | 'debug'
  message: string
  details?: string
}
