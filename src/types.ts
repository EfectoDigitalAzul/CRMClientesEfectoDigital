export type UserRole = 'setter' | 'commercial' | 'director' | 'account_manager' | 'client';

export interface UserProfile {
  uid: string;
  username?: string; // For "username/password" based login for clients
  password?: string; // Stored password (plain text as requested by user logic)
  email: string;
  displayName: string;
  role: UserRole;
  photoURL?: string;
  assignedClientId?: string; // For 'client' role users
  isActive: boolean;
  createdAt: string;
}

export type LeadStatus = 'new' | 'contacted' | 'follow-up' | 'meeting-scheduled' | 'closed-won' | 'closed-lost' | 'reschedule' | 'qualified' | 'not-interested' | 'future';

export interface FollowUp {
  id: string;
  date: string;
  type: 'setter' | 'commercial';
  note: string;
  authorId: string;
  authorName: string;
}

export interface Meeting {
  id: string;
  leadId: string;
  leadName: string;
  clientId: string;
  date: string; // ISO string
  time: string; // HH:mm
  duration: number; // minutes
  status: 'pending' | 'completed' | 'cancelled' | 'no-show' | 'reschedule';
  clientConfirmed?: boolean;
  isQualified?: boolean;
  rescheduleReason?: string;
  feedback?: string;
  scheduledBy: string;
  meetingLink?: string;
  createdAt: string;
}

export type LeadStage = 'setter' | 'commercial';

export type ClientStatus = 'onboarding' | 'active' | 'paused' | 'completed' | 'cancelled';

export interface Client {
  id: string;
  name: string;
  status?: ClientStatus;
  description?: string;
  accountManagerId?: string; // The AM responsible for this client
  setterId?: string; // The Setter assigned to this client
  availableTags?: string[]; // Pre-defined tags for leads of this client
  createdAt: string;
  // New fields for complete client profile
  firstMeetingDate?: string;
  websiteUrl?: string;
  driveUrl?: string;
  contractStartDate?: string;
  contractEndDate?: string;
  planName?: string;
  hasSetter?: boolean;
  lhProfile?: string;
  lhUser?: string;
  lhPassword?: string;
  progress?: number; // 0-100
  weeklyNotes?: { [key: string]: string }; // Note per day of week
  notes?: string; // Persistent global notes
  planDuration?: string; // e.g., "3 meses"
  renewalDate?: string; // ISO string
  nextSteps?: string;
  feedback?: string;
  renewalCount?: number;
  renewalStatus?: 'unknown' | 'will_renew' | 'will_not_renew';
  budget?: number;
  adspend?: number;
  targetLeads?: number;
  templatesEnabled?: boolean;
  pitchTemplates?: PitchTemplate[];
  isDeleted?: boolean;
  deletedAt?: string;
  deletedBy?: string;
}

export interface PitchTemplate {
  id: string;
  title: string;
  content: string;
  category: 'pitch' | 'followup' | 'objection' | 'other';
}

export interface Attachment {
  name: string;
  url: string;
  type: string;
}

export type HistoryNoteType = 'note' | 'milestone' | 'blocker' | 'advance';

export interface ClientHistoryNote {
  id: string;
  clientId: string;
  date: string; // ISO string
  authorId: string;
  authorName: string;
  content: string;
  type: HistoryNoteType;
  isResolved?: boolean; // For blockers
  createdAt: string;
  attachments?: Attachment[];
}

export interface Lead {
  id: string;
  clientId: string; // To which client/project this lead belongs
  name: string;
  company: string;
  country: string;
  interest: string;
  contactInfo: string; // email or phone
  linkedinUrl?: string;
  position?: string;
  sector: string;
  status: LeadStatus;
  stage: LeadStage;
  assignedSetterId?: string;
  assignedCommercialId?: string;
  followUps: FollowUp[];
  meetings: Meeting[];
  nextFollowUpDate?: string;
  followUpSequence?: number; // 0: None, 1: Week 1, 2: Week 2, 3: Week 3
  tag?: string;
  lastAction: string;
  lastActionAuthorId?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  isDeleted?: boolean;
  deletedAt?: string;
  deletedBy?: string;
}

export interface Notification {
  id: string;
  userId: string;
  message: string;
  type: 'new_lead' | 'follow_up' | 'meeting';
  read: boolean;
  createdAt: string;
}
