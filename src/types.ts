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

export interface Client {
  id: string;
  name: string;
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
}

export interface Attachment {
  name: string;
  url: string;
  type: string;
}

export interface ClientHistoryNote {
  id: string;
  clientId: string;
  date: string; // ISO string
  authorId: string;
  authorName: string;
  content: string;
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
}

export interface Notification {
  id: string;
  userId: string;
  message: string;
  type: 'new_lead' | 'follow_up' | 'meeting';
  read: boolean;
  createdAt: string;
}
