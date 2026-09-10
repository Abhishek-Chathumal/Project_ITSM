/**
 * The permission catalogue — the versioned manifest the `Permission` table is seeded from.
 *
 * Constitution 7.3.5 is explicit that this is a **manifest checked into the repo, not created
 * by hand** in a seed script, and that each release reconciles it with the database. The
 * authoritative content is Functional Reference **I2**; this file encodes it, and the seed
 * applies it. Adding a permission means adding a row here.
 *
 * ## The two rules that make an upgrade safe
 *
 * 1. **A new permission is added disabled-by-default for existing custom roles** (7.3.5), so
 *    upgrading the software never silently widens anyone's access. System roles are
 *    permission-locked and re-asserted from their definition instead.
 * 2. **A removed permission is soft-deleted, with a warning naming the roles that referenced
 *    it** — never hard-deleted, because a grant that vanishes silently is indistinguishable
 *    from one that was never made when someone later audits access.
 *
 * ## Naming
 *
 * `module.action[.qualifier]` (Ref I2). The `key` is the contract between code and data and
 * never changes; everything else about a permission is data. **Scope is not part of the
 * name** — `request.view` at `own` or `department` scope is one permission with a scope
 * attached per assignment (Ref I3.1, Amendment A-001). The pre-A-001 shape,
 * `request.view.own` / `.team` / `.all` as three keys, is superseded and must not come back.
 */

/** Bump when the catalogue changes. Recorded against the seeded rows so a database can be
 *  told apart from the manifest that produced it. */
export const PERMISSION_MANIFEST_VERSION = 1;

/** Coarse grouping, used by the admin UI to render the catalogue and by `is_sensitive`
 *  reporting. Mirrors the section structure of Functional Reference I2. */
export const PERMISSION_MODULES = [
  'access',
  'approval',
  'asset',
  'automation',
  'change',
  'config',
  'kb',
  'org',
  'problem',
  'reporting',
  'request',
  'security',
  'task',
] as const;

export type PermissionModule = (typeof PERMISSION_MODULES)[number];

export interface PermissionDefinition {
  /** The stable contract. Never changes. */
  readonly key: string;
  readonly module: string;
  readonly description: string;
  /**
   * Drives step-up MFA re-challenge (Ref I5) and optional approval-gating on the grant
   * itself (constitution 7.3.1). Marked on anything that destroys data, escalates privilege,
   * executes code, or reaches outside the tenant.
   */
  readonly isSensitive: boolean;
}

/**
 * The catalogue itself, keyed by the constant name code refers to.
 *
 * This object is the single source: `PERMISSIONS` (the key lookup) and `PERMISSION_MANIFEST`
 * (the seedable list) are both derived from it, so they cannot drift apart.
 */
const CATALOGUE = {
  REQUEST_VIEW: {
    key: 'request.view',
    module: 'request',
    description: 'View requests',
    isSensitive: false,
  },
  REQUEST_CREATE: {
    key: 'request.create',
    module: 'request',
    description: 'Create a request',
    isSensitive: false,
  },
  REQUEST_CREATE_ON_BEHALF: {
    key: 'request.create.on_behalf',
    module: 'request',
    description: 'Create a request on behalf of another requester',
    isSensitive: false,
  },
  REQUEST_EDIT: {
    key: 'request.edit',
    module: 'request',
    description: 'Edit request fields',
    isSensitive: false,
  },
  REQUEST_EDIT_DESCRIPTION: {
    key: 'request.edit.description',
    module: 'request',
    description: 'Edit the original description — the record of what was reported',
    isSensitive: false,
  },
  REQUEST_ASSIGN: {
    key: 'request.assign',
    module: 'request',
    description: 'Assign a request to a technician',
    isSensitive: false,
  },
  REQUEST_ASSIGN_SELF: {
    key: 'request.assign.self',
    module: 'request',
    description: 'Claim a request for oneself',
    isSensitive: false,
  },
  REQUEST_ASSIGN_OTHER: {
    key: 'request.assign.other',
    module: 'request',
    description: 'Assign a request to someone other than oneself',
    isSensitive: false,
  },
  REQUEST_REASSIGN_OUT_OF_GROUP: {
    key: 'request.reassign.out_of_group',
    module: 'request',
    description: "Reassign outside one's own technician group",
    isSensitive: false,
  },
  REQUEST_TRANSITION: {
    key: 'request.transition',
    module: 'request',
    description: 'Change a request status (further gated per transition)',
    isSensitive: false,
  },
  REQUEST_RESOLVE: {
    key: 'request.resolve',
    module: 'request',
    description: 'Move a request to Resolved',
    isSensitive: false,
  },
  REQUEST_CLOSE: {
    key: 'request.close',
    module: 'request',
    description: 'Move a request to Closed',
    isSensitive: false,
  },
  REQUEST_REOPEN: {
    key: 'request.reopen',
    module: 'request',
    description: 'Reopen a resolved or closed request',
    isSensitive: false,
  },
  REQUEST_MERGE: {
    key: 'request.merge',
    module: 'request',
    description: 'Merge requests',
    isSensitive: false,
  },
  REQUEST_SPLIT: {
    key: 'request.split',
    module: 'request',
    description: 'Split a request',
    isSensitive: false,
  },
  REQUEST_CONVERT_TYPE: {
    key: 'request.convert_type',
    module: 'request',
    description: 'Convert between Incident and Service Request',
    isSensitive: false,
  },
  REQUEST_PRIORITY_OVERRIDE: {
    key: 'request.priority.override',
    module: 'request',
    description: 'Set priority manually, overriding the matrix',
    isSensitive: false,
  },
  REQUEST_SLA_OVERRIDE: {
    key: 'request.sla.override',
    module: 'request',
    description: 'Change or exempt the SLA on a specific request',
    isSensitive: true,
  },
  REQUEST_REPLY_PUBLIC: {
    key: 'request.reply.public',
    module: 'request',
    description: 'Send a reply visible to the requester',
    isSensitive: false,
  },
  REQUEST_NOTE_INTERNAL: {
    key: 'request.note.internal',
    module: 'request',
    description: 'Add an internal note',
    isSensitive: false,
  },
  REQUEST_NOTE_VIEW_INTERNAL: {
    key: 'request.note.view_internal',
    module: 'request',
    description: 'See internal notes — distinct from adding them',
    isSensitive: false,
  },
  REQUEST_WORKLOG_ADD: {
    key: 'request.worklog.add',
    module: 'request',
    description: 'Log time against a request',
    isSensitive: false,
  },
  REQUEST_WORKLOG_EDIT_OTHER: {
    key: 'request.worklog.edit_other',
    module: 'request',
    description: "Edit another technician's work log",
    isSensitive: false,
  },
  REQUEST_ATTACHMENT_ADD: {
    key: 'request.attachment.add',
    module: 'request',
    description: 'Attach a file to a request',
    isSensitive: false,
  },
  REQUEST_ATTACHMENT_DELETE: {
    key: 'request.attachment.delete',
    module: 'request',
    description: 'Delete an attachment from a request',
    isSensitive: false,
  },
  REQUEST_WATCHER_MANAGE: {
    key: 'request.watcher.manage',
    module: 'request',
    description: 'Add or remove watchers',
    isSensitive: false,
  },
  REQUEST_COLLABORATOR_MANAGE: {
    key: 'request.collaborator.manage',
    module: 'request',
    description: 'Add or remove collaborators',
    isSensitive: false,
  },
  REQUEST_LINK_ASSET: {
    key: 'request.link.asset',
    module: 'request',
    description: 'Link a request to an asset or CI',
    isSensitive: false,
  },
  REQUEST_LINK_PROBLEM: {
    key: 'request.link.problem',
    module: 'request',
    description: 'Link a request to a problem',
    isSensitive: false,
  },
  REQUEST_LINK_CHANGE: {
    key: 'request.link.change',
    module: 'request',
    description: 'Link a request to a change',
    isSensitive: false,
  },
  REQUEST_SPAM_MARK: {
    key: 'request.spam.mark',
    module: 'request',
    description: 'Mark a request as spam',
    isSensitive: false,
  },
  REQUEST_ARCHIVE: {
    key: 'request.archive',
    module: 'request',
    description: 'Archive a request',
    isSensitive: false,
  },
  REQUEST_RESTORE: {
    key: 'request.restore',
    module: 'request',
    description: 'Restore an archived request',
    isSensitive: false,
  },
  REQUEST_DELETE: {
    key: 'request.delete',
    module: 'request',
    description: 'Hard delete an archived request',
    isSensitive: true,
  },
  REQUEST_BULK: {
    key: 'request.bulk',
    module: 'request',
    description: 'Perform bulk operations on requests',
    isSensitive: true,
  },
  REQUEST_EXPORT: {
    key: 'request.export',
    module: 'request',
    description: 'Export request data',
    isSensitive: true,
  },
  REQUEST_AUDIT_VIEW: {
    key: 'request.audit.view',
    module: 'request',
    description: "View a request's audit trail",
    isSensitive: false,
  },
  REQUEST_MAJOR_INCIDENT_DECLARE: {
    key: 'request.major_incident.declare',
    module: 'request',
    description: 'Declare a major incident',
    isSensitive: true,
  },
  PROBLEM_VIEW: {
    key: 'problem.view',
    module: 'problem',
    description: 'View problems',
    isSensitive: false,
  },
  PROBLEM_CREATE: {
    key: 'problem.create',
    module: 'problem',
    description: 'Create a problem',
    isSensitive: false,
  },
  PROBLEM_EDIT: {
    key: 'problem.edit',
    module: 'problem',
    description: 'Edit problem fields',
    isSensitive: false,
  },
  PROBLEM_TRANSITION: {
    key: 'problem.transition',
    module: 'problem',
    description: 'Change a problem status',
    isSensitive: false,
  },
  PROBLEM_ASSIGN: {
    key: 'problem.assign',
    module: 'problem',
    description: 'Assign a problem',
    isSensitive: false,
  },
  PROBLEM_DELETE: {
    key: 'problem.delete',
    module: 'problem',
    description: 'Delete a problem',
    isSensitive: true,
  },
  PROBLEM_EXPORT: {
    key: 'problem.export',
    module: 'problem',
    description: 'Export problem data',
    isSensitive: true,
  },
  PROBLEM_AUDIT_VIEW: {
    key: 'problem.audit.view',
    module: 'problem',
    description: "View a problem's audit trail",
    isSensitive: false,
  },
  CHANGE_VIEW: {
    key: 'change.view',
    module: 'change',
    description: 'View changes',
    isSensitive: false,
  },
  CHANGE_CREATE: {
    key: 'change.create',
    module: 'change',
    description: 'Create a change',
    isSensitive: false,
  },
  CHANGE_EDIT: {
    key: 'change.edit',
    module: 'change',
    description: 'Edit change fields',
    isSensitive: false,
  },
  CHANGE_TRANSITION: {
    key: 'change.transition',
    module: 'change',
    description: 'Change a change status',
    isSensitive: false,
  },
  CHANGE_ASSIGN: {
    key: 'change.assign',
    module: 'change',
    description: 'Assign a change',
    isSensitive: false,
  },
  CHANGE_DELETE: {
    key: 'change.delete',
    module: 'change',
    description: 'Delete a change',
    isSensitive: true,
  },
  CHANGE_EXPORT: {
    key: 'change.export',
    module: 'change',
    description: 'Export change data',
    isSensitive: true,
  },
  CHANGE_AUDIT_VIEW: {
    key: 'change.audit.view',
    module: 'change',
    description: "View a change's audit trail",
    isSensitive: false,
  },
  KB_VIEW: {
    key: 'kb.view',
    module: 'kb',
    description: 'View knowledge articles',
    isSensitive: false,
  },
  KB_CREATE: {
    key: 'kb.create',
    module: 'kb',
    description: 'Create a knowledge article',
    isSensitive: false,
  },
  KB_EDIT: {
    key: 'kb.edit',
    module: 'kb',
    description: 'Edit knowledge article fields',
    isSensitive: false,
  },
  KB_TRANSITION: {
    key: 'kb.transition',
    module: 'kb',
    description: 'Change a knowledge article status',
    isSensitive: false,
  },
  KB_ASSIGN: {
    key: 'kb.assign',
    module: 'kb',
    description: 'Assign a knowledge article',
    isSensitive: false,
  },
  KB_DELETE: {
    key: 'kb.delete',
    module: 'kb',
    description: 'Delete a knowledge article',
    isSensitive: true,
  },
  KB_EXPORT: {
    key: 'kb.export',
    module: 'kb',
    description: 'Export knowledge article data',
    isSensitive: true,
  },
  KB_AUDIT_VIEW: {
    key: 'kb.audit.view',
    module: 'kb',
    description: "View a knowledge article's audit trail",
    isSensitive: false,
  },
  TASK_VIEW: {
    key: 'task.view',
    module: 'task',
    description: 'View tasks',
    isSensitive: false,
  },
  TASK_CREATE: {
    key: 'task.create',
    module: 'task',
    description: 'Create a task',
    isSensitive: false,
  },
  TASK_EDIT: {
    key: 'task.edit',
    module: 'task',
    description: 'Edit task fields',
    isSensitive: false,
  },
  TASK_TRANSITION: {
    key: 'task.transition',
    module: 'task',
    description: 'Change a task status',
    isSensitive: false,
  },
  TASK_ASSIGN: {
    key: 'task.assign',
    module: 'task',
    description: 'Assign a task',
    isSensitive: false,
  },
  TASK_DELETE: {
    key: 'task.delete',
    module: 'task',
    description: 'Delete a task',
    isSensitive: true,
  },
  TASK_EXPORT: {
    key: 'task.export',
    module: 'task',
    description: 'Export task data',
    isSensitive: true,
  },
  TASK_AUDIT_VIEW: {
    key: 'task.audit.view',
    module: 'task',
    description: "View a task's audit trail",
    isSensitive: false,
  },
  PROBLEM_RCA_EDIT: {
    key: 'problem.rca.edit',
    module: 'problem',
    description: 'Edit the root cause analysis',
    isSensitive: false,
  },
  PROBLEM_KNOWN_ERROR_PUBLISH: {
    key: 'problem.known_error.publish',
    module: 'problem',
    description: 'Publish a known error to the KEDB',
    isSensitive: false,
  },
  PROBLEM_LINK_INCIDENTS: {
    key: 'problem.link_incidents',
    module: 'problem',
    description: 'Link incidents to a problem',
    isSensitive: false,
  },
  CHANGE_SUBMIT: {
    key: 'change.submit',
    module: 'change',
    description: 'Submit a change for approval',
    isSensitive: false,
  },
  CHANGE_APPROVE: {
    key: 'change.approve',
    module: 'change',
    description: 'Approve or reject a change',
    isSensitive: true,
  },
  CHANGE_CAB_PARTICIPATE: {
    key: 'change.cab.participate',
    module: 'change',
    description: 'Participate in the CAB',
    isSensitive: false,
  },
  CHANGE_SCHEDULE: {
    key: 'change.schedule',
    module: 'change',
    description: 'Schedule a change',
    isSensitive: false,
  },
  CHANGE_IMPLEMENT: {
    key: 'change.implement',
    module: 'change',
    description: 'Implement a change',
    isSensitive: false,
  },
  CHANGE_REVIEW: {
    key: 'change.review',
    module: 'change',
    description: 'Perform the post-implementation review',
    isSensitive: false,
  },
  CHANGE_EMERGENCY_DECLARE: {
    key: 'change.emergency.declare',
    module: 'change',
    description: 'Declare an emergency change',
    isSensitive: true,
  },
  CHANGE_CALENDAR_VIEW: {
    key: 'change.calendar.view',
    module: 'change',
    description: 'View the change calendar',
    isSensitive: false,
  },
  CHANGE_BLACKOUT_OVERRIDE: {
    key: 'change.blackout.override',
    module: 'change',
    description: 'Override a blackout window',
    isSensitive: true,
  },
  KB_ARTICLE_CREATE: {
    key: 'kb.article.create',
    module: 'kb',
    description: 'Create a knowledge article',
    isSensitive: false,
  },
  KB_ARTICLE_EDIT_OWN: {
    key: 'kb.article.edit_own',
    module: 'kb',
    description: 'Edit own knowledge articles',
    isSensitive: false,
  },
  KB_ARTICLE_EDIT_ANY: {
    key: 'kb.article.edit_any',
    module: 'kb',
    description: "Edit anyone's knowledge articles",
    isSensitive: false,
  },
  KB_ARTICLE_APPROVE: {
    key: 'kb.article.approve',
    module: 'kb',
    description: 'Approve a knowledge article',
    isSensitive: false,
  },
  KB_ARTICLE_PUBLISH: {
    key: 'kb.article.publish',
    module: 'kb',
    description: 'Publish a knowledge article',
    isSensitive: false,
  },
  KB_ARTICLE_ARCHIVE: {
    key: 'kb.article.archive',
    module: 'kb',
    description: 'Archive a knowledge article',
    isSensitive: false,
  },
  KB_FOLDER_MANAGE: {
    key: 'kb.folder.manage',
    module: 'kb',
    description: 'Manage the knowledge folder tree',
    isSensitive: false,
  },
  KB_VISIBILITY_SET_PUBLIC: {
    key: 'kb.visibility.set_public',
    module: 'kb',
    description: 'Make an article externally visible — a separate trust level from writing it',
    isSensitive: true,
  },
  TASK_COMPLETE: {
    key: 'task.complete',
    module: 'task',
    description: 'Complete a task',
    isSensitive: false,
  },
  TASK_EDIT_OTHER: {
    key: 'task.edit_other',
    module: 'task',
    description: "Edit another user's task",
    isSensitive: false,
  },
  APPROVAL_REQUEST: {
    key: 'approval.request',
    module: 'approval',
    description: 'Request an approval',
    isSensitive: false,
  },
  APPROVAL_ACT: {
    key: 'approval.act',
    module: 'approval',
    description: 'Approve, reject or refer back an approval',
    isSensitive: true,
  },
  APPROVAL_ACT_DELEGATE: {
    key: 'approval.act.delegate',
    module: 'approval',
    description: 'Act on an approval as a delegate',
    isSensitive: true,
  },
  APPROVAL_IGNORE: {
    key: 'approval.ignore',
    module: 'approval',
    description: 'Ignore an approval',
    isSensitive: true,
  },
  APPROVAL_DELETE: {
    key: 'approval.delete',
    module: 'approval',
    description: 'Delete an approval',
    isSensitive: true,
  },
  APPROVAL_PREAPPROVE: {
    key: 'approval.preapprove',
    module: 'approval',
    description: 'Pre-approve a catalog item or change type',
    isSensitive: true,
  },
  APPROVAL_VIEW_ALL: {
    key: 'approval.view_all',
    module: 'approval',
    description: 'View all approvals, not only one’s own',
    isSensitive: false,
  },
  ASSET_VIEW: {
    key: 'asset.view',
    module: 'asset',
    description: 'View assets and CIs',
    isSensitive: false,
  },
  ASSET_CREATE: {
    key: 'asset.create',
    module: 'asset',
    description: 'Create an asset or CI',
    isSensitive: false,
  },
  ASSET_EDIT: {
    key: 'asset.edit',
    module: 'asset',
    description: 'Edit an asset or CI',
    isSensitive: false,
  },
  ASSET_ASSIGN_USER: {
    key: 'asset.assign_user',
    module: 'asset',
    description: 'Assign an asset to a user',
    isSensitive: false,
  },
  ASSET_LINK_TICKET: {
    key: 'asset.link_ticket',
    module: 'asset',
    description: 'Link an asset to a request',
    isSensitive: false,
  },
  ASSET_IMPORT: {
    key: 'asset.import',
    module: 'asset',
    description: 'Import assets in bulk',
    isSensitive: true,
  },
  ASSET_EXPORT: {
    key: 'asset.export',
    module: 'asset',
    description: 'Export asset data',
    isSensitive: true,
  },
  ASSET_ARCHIVE: {
    key: 'asset.archive',
    module: 'asset',
    description: 'Archive an asset',
    isSensitive: false,
  },
  ASSET_DELETE: {
    key: 'asset.delete',
    module: 'asset',
    description: 'Delete an asset',
    isSensitive: true,
  },
  CI_RELATIONSHIP_MANAGE: {
    key: 'ci.relationship.manage',
    module: 'asset',
    description: 'Manage CI relationships',
    isSensitive: false,
  },
  USER_VIEW: {
    key: 'user.view',
    module: 'access',
    description: 'View users',
    isSensitive: false,
  },
  USER_CREATE: {
    key: 'user.create',
    module: 'access',
    description: 'Create a user',
    isSensitive: true,
  },
  USER_EDIT: {
    key: 'user.edit',
    module: 'access',
    description: 'Edit a user',
    isSensitive: true,
  },
  USER_IMPORT: {
    key: 'user.import',
    module: 'access',
    description: 'Import users in bulk',
    isSensitive: true,
  },
  USER_BLOCK: {
    key: 'user.block',
    module: 'access',
    description: 'Block or unblock a user',
    isSensitive: true,
  },
  USER_ARCHIVE: {
    key: 'user.archive',
    module: 'access',
    description: 'Archive a user',
    isSensitive: true,
  },
  USER_DELETE: {
    key: 'user.delete',
    module: 'access',
    description: 'Delete a user',
    isSensitive: true,
  },
  USER_CONVERT_TYPE: {
    key: 'user.convert_type',
    module: 'access',
    description: 'Convert a requester to a technician, or the reverse',
    isSensitive: true,
  },
  USER_PASSWORD_RESET_OTHER: {
    key: 'user.password.reset_other',
    module: 'access',
    description: "Reset another user's password",
    isSensitive: true,
  },
  USER_SESSION_REVOKE: {
    key: 'user.session.revoke',
    module: 'access',
    description: "Revoke another user's sessions",
    isSensitive: true,
  },
  USER_DELEGATE: {
    key: 'user.delegate',
    module: 'access',
    description: 'Delegate permissions to another user',
    isSensitive: true,
  },
  USER_PERMISSION_GRANT: {
    key: 'user.permission.grant',
    module: 'access',
    description: 'Grant a permission directly to a user',
    isSensitive: true,
  },
  USER_PERMISSION_REVOKE: {
    key: 'user.permission.revoke',
    module: 'access',
    description: 'Revoke a permission directly from a user',
    isSensitive: true,
  },
  ROLE_VIEW: {
    key: 'role.view',
    module: 'access',
    description: 'View roles and the permission catalogue',
    isSensitive: false,
  },
  ROLE_CREATE: {
    key: 'role.create',
    module: 'access',
    description: 'Create a role',
    isSensitive: true,
  },
  ROLE_EDIT: {
    key: 'role.edit',
    module: 'access',
    description: 'Edit a role’s permissions',
    isSensitive: true,
  },
  ROLE_DELETE: {
    key: 'role.delete',
    module: 'access',
    description: 'Delete a role',
    isSensitive: true,
  },
  ROLE_ASSIGN: {
    key: 'role.assign',
    module: 'access',
    description: 'Assign users to roles',
    isSensitive: true,
  },
  SCOPE_MANAGE: {
    key: 'scope.manage',
    module: 'access',
    description: 'Create and edit custom scopes',
    isSensitive: true,
  },
  AUTOMATION_WORKFLOW_VIEW: {
    key: 'automation.workflow.view',
    module: 'automation',
    description: 'View automation workflows',
    isSensitive: false,
  },
  AUTOMATION_WORKFLOW_CREATE: {
    key: 'automation.workflow.create',
    module: 'automation',
    description: 'Create an automation workflow',
    isSensitive: false,
  },
  AUTOMATION_WORKFLOW_EDIT: {
    key: 'automation.workflow.edit',
    module: 'automation',
    description: 'Edit an automation workflow',
    isSensitive: false,
  },
  AUTOMATION_WORKFLOW_PUBLISH: {
    key: 'automation.workflow.publish',
    module: 'automation',
    description: 'Publish an automation workflow — effectively code execution',
    isSensitive: true,
  },
  AUTOMATION_WORKFLOW_DELETE: {
    key: 'automation.workflow.delete',
    module: 'automation',
    description: 'Delete an automation workflow',
    isSensitive: true,
  },
  AUTOMATION_WORKFLOW_TEST: {
    key: 'automation.workflow.test',
    module: 'automation',
    description: 'Dry-run an automation workflow',
    isSensitive: false,
  },
  AUTOMATION_LOG_VIEW: {
    key: 'automation.log.view',
    module: 'automation',
    description: 'View automation execution logs',
    isSensitive: false,
  },
  AUTOMATION_SLA_MANAGE: {
    key: 'automation.sla.manage',
    module: 'automation',
    description: 'Manage SLA policies',
    isSensitive: true,
  },
  AUTOMATION_APPROVAL_WORKFLOW_MANAGE: {
    key: 'automation.approval_workflow.manage',
    module: 'automation',
    description: 'Manage approval workflows',
    isSensitive: true,
  },
  AUTOMATION_ASSIGNMENT_MANAGE: {
    key: 'automation.assignment.manage',
    module: 'automation',
    description: 'Manage auto-assignment rules',
    isSensitive: false,
  },
  AUTOMATION_NOTIFICATION_MANAGE: {
    key: 'automation.notification.manage',
    module: 'automation',
    description: 'Manage notification rules and templates',
    isSensitive: false,
  },
  AUTOMATION_SCENARIO_MANAGE: {
    key: 'automation.scenario.manage',
    module: 'automation',
    description: 'Manage scenarios',
    isSensitive: false,
  },
  AUTOMATION_SCHEDULE_MANAGE: {
    key: 'automation.schedule.manage',
    module: 'automation',
    description: 'Manage scheduled jobs',
    isSensitive: false,
  },
  AUTOMATION_SCRIPT_MANAGE: {
    key: 'automation.script.manage',
    module: 'automation',
    description: 'Manage custom scripts — treat as code execution',
    isSensitive: true,
  },
  CONFIG_FIELD_MANAGE: {
    key: 'config.field.manage',
    module: 'config',
    description: 'Manage custom fields',
    isSensitive: false,
  },
  CONFIG_FORM_MANAGE: {
    key: 'config.form.manage',
    module: 'config',
    description: 'Manage form layouts',
    isSensitive: false,
  },
  CONFIG_FORM_RULE_MANAGE: {
    key: 'config.form_rule.manage',
    module: 'config',
    description: 'Manage form rules',
    isSensitive: false,
  },
  CONFIG_CUSTOM_RULE_MANAGE: {
    key: 'config.custom_rule.manage',
    module: 'config',
    description: 'Manage custom rules — compliance gates on transitions',
    isSensitive: true,
  },
  CONFIG_STATUS_MANAGE: {
    key: 'config.status.manage',
    module: 'config',
    description: 'Manage statuses and workflows',
    isSensitive: true,
  },
  CONFIG_CATEGORY_MANAGE: {
    key: 'config.category.manage',
    module: 'config',
    description: 'Manage the category tree',
    isSensitive: false,
  },
  CONFIG_PRIORITY_MATRIX_MANAGE: {
    key: 'config.priority_matrix.manage',
    module: 'config',
    description: 'Manage the Impact x Urgency priority matrix',
    isSensitive: false,
  },
  CONFIG_TEMPLATE_MANAGE: {
    key: 'config.template.manage',
    module: 'config',
    description: 'Manage response, print and request templates',
    isSensitive: false,
  },
  CONFIG_CATALOG_MANAGE: {
    key: 'config.catalog.manage',
    module: 'config',
    description: 'Manage the service catalog',
    isSensitive: false,
  },
  CONFIG_SERVICE_MODEL_MANAGE: {
    key: 'config.service_model.manage',
    module: 'config',
    description: 'Manage service models — automatic state transitions',
    isSensitive: true,
  },
  ORG_SETTINGS_MANAGE: {
    key: 'org.settings.manage',
    module: 'org',
    description: 'Manage organization-wide settings',
    isSensitive: true,
  },
  ORG_BRANDING_MANAGE: {
    key: 'org.branding.manage',
    module: 'org',
    description: 'Manage branding',
    isSensitive: false,
  },
  ORG_DEPARTMENT_MANAGE: {
    key: 'org.department.manage',
    module: 'org',
    description: 'Manage the department tree',
    isSensitive: true,
  },
  ORG_LOCATION_MANAGE: {
    key: 'org.location.manage',
    module: 'org',
    description: 'Manage the location tree',
    isSensitive: true,
  },
  ORG_BUSINESS_HOURS_MANAGE: {
    key: 'org.business_hours.manage',
    module: 'org',
    description: 'Manage business hours and holidays',
    isSensitive: false,
  },
  ORG_CHANNEL_MANAGE: {
    key: 'org.channel.manage',
    module: 'org',
    description: 'Manage support channels (email, portal, chat)',
    isSensitive: true,
  },
  REPORT_VIEW: {
    key: 'report.view',
    module: 'reporting',
    description: 'View reports',
    isSensitive: false,
  },
  REPORT_CREATE: {
    key: 'report.create',
    module: 'reporting',
    description: 'Create a report',
    isSensitive: false,
  },
  REPORT_SCHEDULE: {
    key: 'report.schedule',
    module: 'reporting',
    description: 'Schedule a report',
    isSensitive: false,
  },
  REPORT_EXPORT: {
    key: 'report.export',
    module: 'reporting',
    description: 'Export report output',
    isSensitive: true,
  },
  DASHBOARD_VIEW: {
    key: 'dashboard.view',
    module: 'reporting',
    description: 'View dashboards',
    isSensitive: false,
  },
  DASHBOARD_CREATE: {
    key: 'dashboard.create',
    module: 'reporting',
    description: 'Create a dashboard',
    isSensitive: false,
  },
  DASHBOARD_SHARE: {
    key: 'dashboard.share',
    module: 'reporting',
    description: 'Share a dashboard',
    isSensitive: false,
  },
  DASHBOARD_PIN_ORG: {
    key: 'dashboard.pin_org',
    module: 'reporting',
    description: 'Pin a dashboard organization-wide',
    isSensitive: false,
  },
  SECURITY_AUDIT_VIEW: {
    key: 'security.audit.view',
    module: 'security',
    description: 'View the audit log',
    isSensitive: true,
  },
  SECURITY_AUDIT_EXPORT: {
    key: 'security.audit.export',
    module: 'security',
    description: 'Export the audit log',
    isSensitive: true,
  },
  SECURITY_SESSION_VIEW: {
    key: 'security.session.view',
    module: 'security',
    description: 'View active sessions',
    isSensitive: true,
  },
  SECURITY_POLICY_MANAGE: {
    key: 'security.policy.manage',
    module: 'security',
    description: 'Manage password and lockout policy',
    isSensitive: true,
  },
  SECURITY_IP_RULES_MANAGE: {
    key: 'security.ip_rules.manage',
    module: 'security',
    description: 'Manage IP allow and deny lists',
    isSensitive: true,
  },
  SECURITY_MFA_ENFORCE: {
    key: 'security.mfa.enforce',
    module: 'security',
    description: 'Enforce MFA per role',
    isSensitive: true,
  },
  SECURITY_APIKEY_MANAGE: {
    key: 'security.apikey.manage',
    module: 'security',
    description: 'Manage API keys',
    isSensitive: true,
  },
  SECURITY_DATA_RETENTION_MANAGE: {
    key: 'security.data_retention.manage',
    module: 'security',
    description: 'Manage data retention policy',
    isSensitive: true,
  },
} as const;

/**
 * Permission keys, for `@RequirePermission(...)` and the frontend's UX-only `isAllowed(...)`.
 *
 * Derived from `CATALOGUE` rather than written out again — a second hand-maintained list is a
 * second thing to forget to update. The mapped type preserves the literal key types, so a
 * typo in a guard is a compile error rather than a permanent 403.
 */
export const PERMISSIONS = Object.fromEntries(
  Object.entries(CATALOGUE).map(([name, def]) => [name, def.key]),
) as { [K in keyof typeof CATALOGUE]: (typeof CATALOGUE)[K]['key'] };

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

/** The seedable list. What the reconciliation in `seed-permissions.ts` walks. */
export const PERMISSION_MANIFEST: readonly PermissionDefinition[] = Object.values(CATALOGUE);

/** Every key in the catalogue, for validation and tests. */
export const ALL_PERMISSION_KEYS: readonly string[] = PERMISSION_MANIFEST.map((p) => p.key);

/**
 * Default system roles shipped out of the box.
 *
 * ⚠️ **Still the pre-A-001 six.** Amendment A-001 expands this to twelve permission-locked
 * roles (Ref G3.4) and that is **Phase 0 Slice 0d**, deliberately not this slice: the
 * catalogue has to exist before roles can be composed from it. Left unchanged here so the
 * manifest lands as one reviewable change rather than two entangled ones.
 *
 * Never hardcode a role name into an authorization decision — these seed initial data and
 * nothing else. Authorization asks about permissions, never about role membership.
 */
export const DEFAULT_ROLES = [
  'Requester',
  'Technician',
  'Team Lead',
  'Change Manager',
  'Admin',
  'Auditor',
] as const;

export type DefaultRoleName = (typeof DEFAULT_ROLES)[number];

/**
 * Scope values, mirroring the `Scope` enum in `schema.prisma` (Functional Reference I3.1).
 *
 * Scope is attached **per permission, not per role** (Amendment A-001). It is deliberately a
 * fixed set rather than admin-editable data: each value names a predicate `applyScope()` has
 * to be able to build, so an invented eighth value would be a filter no code can express.
 * The admin-authored escape hatch is `custom`, which points at a named `CustomScope`.
 */
export const SCOPES = [
  'own',
  'group',
  'department',
  'location',
  'hierarchy',
  'custom',
  'all',
] as const;

export type ScopeValue = (typeof SCOPES)[number];

/** Scopes whose meaning depends on walking a tree, and which therefore honour `scopeDepth`. */
export const SUBTREE_SCOPES: readonly ScopeValue[] = ['department', 'location', 'hierarchy'];
