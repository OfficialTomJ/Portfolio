export const ENROLLMENT_VERSION = 1;
export const ENROLLMENT_NOTICE = "By verifying, you join Thomas Johnston’s community email list for updates and occasional educational content. You can unsubscribe from emails at any time. This does not create a Mentor account.";
export const FLOW_MS = 30 * 60_000;
export const CODE_MS = 5 * 60_000;
export const MANAGEMENT_MS = 15 * 60_000;
export const MAX_ATTEMPTS = 3;

export class CommunityError extends Error {
  constructor(public readonly code: string, message: string, public readonly status = 400) {
    super(message);
  }
}

export type DiscordIdentity = { id: string; name: string };
export type Flow = {
  _id: string;
  purpose: "connect" | "manage";
  state: "oauth" | "email" | "sending" | "sent" | "verified";
  expiresAt: Date;
  purgeAt?: Date;
  oauthHash?: string;
  discord?: DiscordIdentity;
  expectedDiscordId?: string;
  email?: string;
  codeHash?: string;
  codeExpiresAt?: Date;
  lastSentAt?: Date;
  attempts: number;
  verifiedAt?: Date;
  enrollmentAcceptedAt?: Date;
};
export type Job = {
  status: "pending" | "done" | "attention";
  attempts: number;
  nextAt: Date;
  error?: string;
};
export type Contact = {
  _id: string;
  email: string;
  createdAt: Date;
  verifiedAt: Date;
  enrollmentVersion: number;
  enrollmentAcceptedAt: Date;
  discordId?: string;
  discordName?: string;
  guildId: string;
  roleId: string;
  segmentId: string;
  state: "active" | "revoking" | "unlinked" | "blocked";
  lastVerificationFlowId: string;
  revokedAt?: Date;
  generation: number;
  roleJob: Job;
  listJob: Job;
  resendContactId?: string;
  unsubscribed?: boolean;
  claimedUserId?: string;
  revokedDiscordIds?: string[];
  retainedCommunityAccess?: boolean;
  lease?: { token: string; expiresAt: Date };
};
export type Destination = { guildId: string; roleId: string; segmentId: string };
export type ContactView = {
  discordName: string | null;
  state: Contact["state"];
  role: Job["status"];
  mailing: Job["status"];
  message: string | null;
  trustedMember: boolean;
};
export type AccountIdentity = { id: string; email: string; emailVerified: boolean };
export type ProfileView = { contact: ContactView | null; managementEmail: string };
export function contactView(contact: Contact | null, trustedMember = false): ContactView | null {
  if (!contact) return null;
  return {
    discordName: contact.discordName ?? null,
    state: contact.state,
    role: contact.roleJob.status,
    mailing: contact.listJob.status,
    trustedMember,
    message: contact.state === "blocked" ? "Community access is restricted. Contact support."
      : contact.roleJob.error ?? null,
  };
}
export type Repository = {
  putFlow(flow: Flow): Promise<void>;
  flow(id: string, now: Date): Promise<Flow | null>;
  takeOAuth(id: string, stateHash: string, now: Date): Promise<boolean>;
  setDiscord(id: string, discord: DiscordIdentity, now: Date): Promise<void>;
  reserveCode(id: string, email: string, codeHash: string, now: Date): Promise<boolean>;
  finishSend(id: string, codeHash: string, sent: boolean): Promise<void>;
  verifyCode(id: string, codeHash: string, now: Date, purpose: Flow["purpose"]): Promise<Flow | null>;
  pendingProofs(max: number): Promise<Flow[]>;
  finishEnrollment(id: string): Promise<void>;
  limit(key: string, max: number, seconds: number, now: Date): Promise<boolean>;
  enroll(flow: Flow, destination: Destination, now: Date): Promise<Contact>;
  contact(email: string): Promise<Contact | null>;
  lease(id: string, now: Date): Promise<{ contact: Contact; token: string } | null>;
  saveLease(contact: Contact, token: string): Promise<boolean>;
  release(id: string, token: string): Promise<void>;
  revoke(email: string, now: Date): Promise<Contact | null>;
  due(now: Date, max: number, destination?: Destination): Promise<Contact[]>;
  claim(email: string, userId: string): Promise<Contact | null>;
  trustedMember(guildId: string, discordId: string): Promise<boolean>;
};
export type Providers = {
  identity(code: string): Promise<DiscordIdentity>;
  member(guildId: string, discordId: string): Promise<{ pending: boolean }>;
  role(guildId: string, discordId: string, roleId: string, action: "grant" | "remove"): Promise<void>;
  email(email: string, code: string, purpose: Flow["purpose"], discordName?: string): Promise<void>;
  subscribe(email: string, segmentId: string): Promise<{ id: string; unsubscribed: boolean }>;
};
