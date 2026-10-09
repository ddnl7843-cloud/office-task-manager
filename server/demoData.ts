const DEMO_TASK_IDS = new Set([
  'TASK-20260922-0001',
  'TASK-20260922-0002',
  'TASK-20260922-0003',
  'TASK-20260922-0004',
  'TASK-20260922-0005',
]);

export function removeDemoTasks(data: {
  tasks: { id: string }[];
  comments: { taskId: string }[];
  notifications: { taskId?: string }[];
  activityLogs: { taskId?: string }[];
}): boolean {
  const hadDemoData = data.tasks.some(task => DEMO_TASK_IDS.has(task.id)) ||
    data.comments.some(comment => DEMO_TASK_IDS.has(comment.taskId)) ||
    data.notifications.some(notification => notification.taskId && DEMO_TASK_IDS.has(notification.taskId)) ||
    data.activityLogs.some(log => log.taskId && DEMO_TASK_IDS.has(log.taskId));
  if (!hadDemoData) return false;

  data.tasks = data.tasks.filter(task => !DEMO_TASK_IDS.has(task.id));
  data.comments = data.comments.filter(comment => !DEMO_TASK_IDS.has(comment.taskId));
  data.notifications = data.notifications.filter(notification =>
    !notification.taskId || !DEMO_TASK_IDS.has(notification.taskId));
  data.activityLogs = data.activityLogs.filter(log => !log.taskId || !DEMO_TASK_IDS.has(log.taskId));
  return true;
}
