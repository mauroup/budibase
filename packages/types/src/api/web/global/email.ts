import { EmailAttachment, EmailInvite } from "../../../documents"

export enum EmailTemplatePurpose {
  CORE = "core",
  BASE = "base",
  PASSWORD_RECOVERY = "password_recovery",
  INVITATION = "invitation",
  WELCOME = "welcome",
  CUSTOM = "custom",
}

export interface SendEmailRequest {
  workspaceId?: string
  email: string
  userId?: string
  purpose: EmailTemplatePurpose
  contents?: string
  from?: string
  subject: string
  cc?: string
  bcc?: string
  automation?: boolean
  invite?: EmailInvite
  attachments?: EmailAttachment[]
}
export interface SendEmailResponse extends Record<string, any> {
  message: string
}
