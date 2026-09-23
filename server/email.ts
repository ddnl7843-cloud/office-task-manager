/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import nodemailer from 'nodemailer';

interface EmailTaskData {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: string;
  startDate: string;
  deadline: string;
  expectedCompletionDate?: string;
  createdByName: string;
  assignedToName: string;
  approverName: string;
}

interface UserEmailInfo {
  name: string;
  email: string;
}

function getTransporter() {
  const host = process.env.SMTP_HOST || 'smtp.hostinger.com';
  const port = Number(process.env.SMTP_PORT) || 465;
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass,
    },
    tls: {
      rejectUnauthorized: false,
    },
  });
}

function getFromAddress(): string {
  const fromName = process.env.SMTP_FROM_NAME || 'PaisaFin Task Management';
  const fromEmail = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || 'notifications@paisafin.com';
  return `"${fromName}" <${fromEmail}>`;
}

function getPriorityColor(priority: string): { bg: string; text: string; border: string } {
  switch (priority.toLowerCase()) {
    case 'urgent':
      return { bg: '#fee2e2', text: '#991b1b', border: '#f87171' };
    case 'high':
      return { bg: '#ffedd5', text: '#9a3412', border: '#fb923c' };
    case 'medium':
      return { bg: '#fef3c7', text: '#92400e', border: '#fcd34d' };
    default:
      return { bg: '#f1f5f9', text: '#334155', border: '#cbd5e1' };
  }
}

/**
 * Generates an executive, respectful, and highly professional HTML email
 */
function buildEmailTemplate({
  recipientName,
  greeting,
  headline,
  introParagraph,
  task,
  callToActionText,
  appUrl,
  note,
}: {
  recipientName: string;
  greeting?: string;
  headline: string;
  introParagraph: string;
  task: EmailTaskData;
  callToActionText?: string;
  appUrl: string;
  note?: string;
}): string {
  const priorityStyle = getPriorityColor(task.priority);
  const portalUrl = appUrl || 'https://ais-dev-n4qehoylq2c5g4lj2jugsm-952302280324.asia-east1.run.app';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${headline}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; line-height: 1.6;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; padding: 32px 16px;">
    <tr>
      <td align="center">
        <!-- Main Card Container -->
        <table role="presentation" width="100%" max-width="640" style="max-width: 640px; background-color: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
          
          <!-- Corporate Header Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #1e1b4b 0%, #312e81 100%); padding: 28px 32px; text-align: left;">
              <table width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <span style="display: inline-block; font-size: 20px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px;">PaisaFin</span>
                    <span style="display: inline-block; margin-left: 8px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; color: #a5b4fc; background-color: rgba(255,255,255,0.12); padding: 3px 8px; border-radius: 4px;">Task Operations</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding-top: 10px;">
                    <h1 style="margin: 0; font-size: 18px; font-weight: 600; color: #ffffff;">${headline}</h1>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Email Content Body -->
          <tr>
            <td style="padding: 32px;">
              <!-- Salutation -->
              <p style="margin: 0 0 16px 0; font-size: 15px; font-weight: 600; color: #0f172a;">
                ${greeting || `Dear ${recipientName},`}
              </p>
              
              <!-- Respectful Introduction -->
              <p style="margin: 0 0 24px 0; font-size: 14px; color: #334155; line-height: 1.6;">
                ${introParagraph}
              </p>

              <!-- Task Overview Card -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 20px;">
                    <table width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="padding-bottom: 12px; border-bottom: 1px solid #e2e8f0;">
                          <span style="font-family: monospace; font-size: 12px; font-weight: 700; color: #4338ca; background-color: #e0e7ff; padding: 2px 8px; border-radius: 4px;">${task.id}</span>
                          <span style="float: right; font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 12px; background-color: ${priorityStyle.bg}; color: ${priorityStyle.text}; border: 1px solid ${priorityStyle.border}; text-transform: uppercase;">
                            ${task.priority} Priority
                          </span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding-top: 14px; padding-bottom: 14px;">
                          <h2 style="margin: 0; font-size: 16px; font-weight: 700; color: #0f172a;">${task.title}</h2>
                          ${task.description ? `<p style="margin: 8px 0 0 0; font-size: 13px; color: #475569; line-height: 1.5;">${task.description}</p>` : ''}
                        </td>
                      </tr>
                      <tr>
                        <td style="padding-top: 12px; border-top: 1px solid #e2e8f0;">
                          <table width="100%" cellspacing="0" cellpadding="0" style="font-size: 12px; color: #334155;">
                            <tr>
                              <td width="50%" style="padding: 4px 0;"><strong>Category:</strong> ${task.category || 'General'}</td>
                              <td width="50%" style="padding: 4px 0;"><strong>Assigned By:</strong> ${task.createdByName}</td>
                            </tr>
                            <tr>
                              <td width="50%" style="padding: 4px 0;"><strong>Target Deadline:</strong> <span style="color: #b91c1c; font-weight: 700;">${task.deadline}</span></td>
                              <td width="50%" style="padding: 4px 0;"><strong>Approver:</strong> ${task.approverName}</td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              ${note ? `
              <!-- Additional Note or Remark -->
              <div style="background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 12px 16px; margin-bottom: 24px; border-radius: 4px;">
                <p style="margin: 0; font-size: 13px; color: #92400e;"><strong>Remark / Details:</strong> ${note}</p>
              </div>` : ''}

              <!-- Respectful Guidance -->
              <p style="margin: 0 0 24px 0; font-size: 13px; color: #475569; line-height: 1.6;">
                ${callToActionText || 'Please log in to the PaisaFin Task Portal to review instructions, update your progress milestones (0% to 100%), and submit for approval upon completion.'}
              </p>

              <!-- Action Button -->
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin-bottom: 32px;">
                <tr>
                  <td align="center" style="border-radius: 6px; background-color: #4338ca;">
                    <a href="${portalUrl}" target="_blank" style="font-size: 13px; font-weight: 600; color: #ffffff; text-decoration: none; padding: 12px 24px; display: inline-block; border-radius: 6px;">
                      Open Task in Portal &rarr;
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Polite Corporate Sign-off -->
              <div style="border-top: 1px solid #e2e8f0; padding-top: 20px;">
                <p style="margin: 0; font-size: 13px; color: #475569;">With warm regards,</p>
                <p style="margin: 4px 0 0 0; font-size: 14px; font-weight: 700; color: #0f172a;">PaisaFin Operations Team</p>
                <p style="margin: 2px 0 0 0; font-size: 12px; color: #64748b;">PaisaFin Solutions | Internal Work Management</p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f1f5f9; padding: 16px 32px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0; font-size: 11px; color: #64748b;">
                This is an automated operational notification sent via PaisaFin Hostinger Webmail SMTP.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

export const emailService = {
  /**
   * Check if SMTP is configured
   */
  isConfigured(): boolean {
    return Boolean(process.env.SMTP_USER && process.env.SMTP_PASS);
  },

  /**
   * Send Task Assignment Email to Employee
   */
  async sendTaskAssignedEmail(task: EmailTaskData, assignee: UserEmailInfo, appUrl: string): Promise<boolean> {
    const transporter = getTransporter();
    if (!transporter) {
      console.log(`[Email Notice] SMTP not configured. Skipped sending task assignment email to ${assignee.email}`);
      return false;
    }

    try {
      const html = buildEmailTemplate({
        recipientName: assignee.name,
        headline: `New Task Assignment: ${task.id}`,
        introParagraph: `I hope this email finds you well. You have been assigned a new office responsibility by <strong>${task.createdByName}</strong>. Please find the complete task specifications outlined below for your review and execution:`,
        task,
        callToActionText: `Kindly acknowledge receipt by logging in to the portal and updating your work status. If you face any obstacles or require team assistance, please utilize the <strong>"Need Help"</strong> feature on the task.`,
        appUrl,
      });

      await transporter.sendMail({
        from: getFromAddress(),
        to: assignee.email,
        subject: `[Task Assigned] ${task.id} - ${task.title} (${task.priority} Priority)`,
        html,
      });

      console.log(`[Email Success] Task assignment email sent to ${assignee.email}`);
      return true;
    } catch (err) {
      console.error(`[Email Error] Failed to send assignment email:`, err);
      return false;
    }
  },

  /**
   * Send Completion Request Email to Approver
   */
  async sendCompletionRequestEmail(task: EmailTaskData, approver: UserEmailInfo, appUrl: string): Promise<boolean> {
    const transporter = getTransporter();
    if (!transporter) return false;

    try {
      const html = buildEmailTemplate({
        recipientName: approver.name,
        headline: `Completion Approval Requested: ${task.id}`,
        introParagraph: `Greetings. <strong>${task.assignedToName}</strong> has completed 100% of the assigned work on task <strong>${task.id}</strong> and submitted a formal request for your review and approval.`,
        task,
        callToActionText: `Please inspect the deliverables and status in the <strong>Pending Approvals</strong> section to grant completion sign-off or provide feedback if further revisions are needed.`,
        appUrl,
      });

      await transporter.sendMail({
        from: getFromAddress(),
        to: approver.email,
        subject: `[Action Required] Review & Approval Request: ${task.id} (${task.assignedToName})`,
        html,
      });

      return true;
    } catch (err) {
      console.error(`[Email Error] Failed to send completion request email:`, err);
      return false;
    }
  },

  /**
   * Send Approval Decision Email to Employee (Approved or Rejected)
   */
  async sendApprovalDecisionEmail(
    task: EmailTaskData,
    decision: 'approved' | 'rejected',
    assignee: UserEmailInfo,
    approverName: string,
    comment: string | undefined,
    appUrl: string
  ): Promise<boolean> {
    const transporter = getTransporter();
    if (!transporter) return false;

    try {
      const isApproved = decision === 'approved';
      const headline = isApproved
        ? `Task Approved & Completed: ${task.id}`
        : `Task Revision Requested: ${task.id}`;

      const introParagraph = isApproved
        ? `We are pleased to inform you that <strong>${approverName}</strong> has reviewed and approved your completion submission for task <strong>${task.id}</strong>. The task has officially been recorded as <strong>Completed</strong>.`
        : `Please be advised that <strong>${approverName}</strong> reviewed your completion submission for task <strong>${task.id}</strong> and has requested revisions before final sign-off can be granted.`;

      const html = buildEmailTemplate({
        recipientName: assignee.name,
        headline,
        introParagraph,
        task,
        note: comment,
        callToActionText: isApproved
          ? `Thank you for your dedicated work and timely delivery on this assignment.`
          : `Kindly review the approver's remarks above, address the necessary items, and resubmit for approval once completed.`,
        appUrl,
      });

      await transporter.sendMail({
        from: getFromAddress(),
        to: assignee.email,
        subject: isApproved
          ? `[Completed] Task ${task.id} Approved by ${approverName}`
          : `[Action Needed] Task ${task.id} Revision Requested`,
        html,
      });

      return true;
    } catch (err) {
      console.error(`[Email Error] Failed to send decision email:`, err);
      return false;
    }
  },

  /**
   * Send Help Request Email
   */
  async sendHelpRequestEmail(
    task: EmailTaskData,
    requesterName: string,
    targetUser: UserEmailInfo,
    problemDescription: string,
    appUrl: string
  ): Promise<boolean> {
    const transporter = getTransporter();
    if (!transporter) return false;

    try {
      const html = buildEmailTemplate({
        recipientName: targetUser.name,
        headline: `Assistance Requested: ${task.id}`,
        introParagraph: `Please note that <strong>${requesterName}</strong> has requested your assistance on task <strong>${task.id}</strong>.`,
        task,
        note: problemDescription,
        callToActionText: `Please coordinate with ${requesterName} or post a comment on the task card to help unblock this work.`,
        appUrl,
      });

      await transporter.sendMail({
        from: getFromAddress(),
        to: targetUser.email,
        subject: `[Assistance Needed] ${requesterName} requested help on ${task.id}`,
        html,
      });

      return true;
    } catch (err) {
      console.error(`[Email Error] Failed to send help email:`, err);
      return false;
    }
  },

  /**
   * Test SMTP connection and send a test verification email
   */
  async sendTestEmail(targetEmail: string): Promise<{ success: boolean; message: string }> {
    const transporter = getTransporter();
    if (!transporter) {
      return {
        success: false,
        message:
          'Hostinger SMTP credentials (SMTP_USER & SMTP_PASS) are not yet configured in environment variables.',
      };
    }

    try {
      await transporter.verify();
      await transporter.sendMail({
        from: getFromAddress(),
        to: targetEmail,
        subject: 'PaisaFin Task Manager - Hostinger Webmail Test Successful',
        html: `
          <div style="font-family: sans-serif; padding: 20px; color: #1e293b;">
            <h2 style="color: #4338ca;">Hostinger Webmail Connected Successfully!</h2>
            <p>Dear Administrator,</p>
            <p>This test email confirms that your <strong>Hostinger Webmail SMTP connection</strong> is active and functioning properly for <strong>@paisafin.com</strong>.</p>
            <p>Your team members will now receive automated task assignments, review requests, and status alerts.</p>
            <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;">
            <p style="font-size: 12px; color: #64748b;">PaisaFin Task Manager &bull; Hostinger SMTP Integration</p>
          </div>
        `,
      });
      return { success: true, message: `Test email sent successfully to ${targetEmail}` };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, message: `SMTP connection failed: ${msg}` };
    }
  },
};
