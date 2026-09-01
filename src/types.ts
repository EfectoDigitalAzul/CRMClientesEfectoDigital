export type UserRole = 'setter' | 'commercial' | 'director' | 'account_manager' | 'designer' | 'copywriter' | 'client';

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TaskCategory = 'design' | 'copy' | 'account_management' | 'pauta' | 'general';
export type TaskStatus = 
  | 'pending_receipt'         // Pendiente de confirmación/visto por el asignado
  | 'in_progress'             // En proceso de elaboración
  | 'internal_review'         // En revisión interna por AM / Equipo
  | 'waiting_client_feedback' // Esperando feedback del cliente
  | 'completed'               // Tarea completada y aprobada
  | 'cancelled';              // Cancelada

export interface TaskAttachment {
  id: string;
  name: string;
  url: string;
  type: 'figma' | 'drive' | 'canva' | 'loom' | 'image' | 'doc' | 'link' | 'file';
  size?: string;
  uploadedAt: string;
  uploadedBy: string;
}

export interface TaskComment {
  id: string;
  authorId: string;
  authorName: string;
  authorRole: UserRole;
  authorPhotoURL?: string;
  content: string;
  createdAt: string;
  attachments?: TaskAttachment[];
}

export interface TeamTask {
  id: string;
  title: string;
  description: string;
  category: TaskCategory;
  priority: TaskPriority;
  status: TaskStatus;
  
  // Who created & who is assigned
  creatorId: string;
  creatorName: string;
  creatorRole: UserRole;
  
  assigneeId: string;
  assigneeName: string;
  assigneeRole: UserRole;
  
  // Client association (or internal)
  clientId?: string;
  clientName?: string;
  
  // Receipt tracking ("Visto / Enterado")
  isReceived: boolean;
  receivedAt?: string;
  receivedBy?: string;
  
  // Client feedback & approval flow
  visibleToClient: boolean;
  clientFeedback?: string;
  clientFeedbackDate?: string;
  clientApproved?: boolean;
  clientApprovedAt?: string;

  // Deliverable link & notes
  deliverableUrl?: string;
  deliverableNotes?: string;

  // Deadlines & Completion
  dueDate?: string; // YYYY-MM-DD
  dueTime?: string; // HH:mm
  completedAt?: string;
  completedBy?: string;
  
  attachments: TaskAttachment[];
  comments: TaskComment[];
  
  createdAt: string;
  updatedAt: string;
  isDeleted?: boolean;
  deletedAt?: string;
  deletedBy?: string;
}

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
  hideFromTeam?: boolean; // Toggles visibility in team performance & team list views
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
  sharedAccountManagerIds?: string[]; // Additional AMs who can view/manage this client
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
  contractReconsultDate?: string;
  budget?: number;
  adspend?: number;
  targetLeads?: number;
  templatesEnabled?: boolean;
  pitchTemplates?: PitchTemplate[];
  // Pauta & Paid Media Service fields
  hasPautaService?: boolean;
  metaAdAccountId?: string;
  metaAccessToken?: string;
  pautaTargetCPL?: number;
  pautaCurrency?: 'ARS' | 'USD' | 'EUR' | 'MXN' | 'CLP' | 'COP';
  pautaTargetWeeklyLeads?: number;
  isDeleted?: boolean;
  deletedAt?: string;
  deletedBy?: string;
}

export interface PautaWeekData {
  startDate?: string;
  endDate?: string;
  // Campañas de form
  formSpend: number;
  formLeads: number;
  formContacted: number;
  formOpportunities: number;
  formMeetings: number;
  formSales: number;
  // Campañas de wpp
  wppSpend: number;
  wppLeads: number;
  wppContacted: number;
  wppOpportunities: number;
  wppMeetings: number; // or visitas pactadas
  wppSales: number;
  // Meta sync tracking
  syncedWithMeta?: boolean;
  lastMetaSync?: string;
  notes?: string;
}

export interface PautaScorecard {
  id: string; // e.g. "2026-06"
  clientId: string;
  month: number; // 1 - 12
  year: number; // e.g. 2026
  weeks: {
    week1: PautaWeekData;
    week2: PautaWeekData;
    week3: PautaWeekData;
    week4: PautaWeekData;
  };
  notes?: string;
  createdAt?: string;
  updatedAt: string;
  updatedBy?: string;
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
