import assert from 'node:assert/strict';
import test from 'node:test';
import { removeDemoTasks } from './demoData';

test('removes seeded demo tasks and only their linked history', () => {
  const data = {
    tasks: [
      { id: 'TASK-20260922-0001' },
      { id: 'TASK-REAL-0001' },
    ],
    comments: [
      { taskId: 'TASK-20260922-0001' },
      { taskId: 'TASK-REAL-0001' },
    ],
    notifications: [
      { taskId: 'TASK-20260922-0001' },
      { taskId: 'TASK-REAL-0001' },
      { title: 'Unrelated notification' },
    ],
    activityLogs: [
      { taskId: 'TASK-20260922-0001' },
      { taskId: 'TASK-REAL-0001' },
      { action: 'LOGIN' },
    ],
  };

  assert.equal(removeDemoTasks(data), true);
  assert.deepEqual(data.tasks, [{ id: 'TASK-REAL-0001' }]);
  assert.deepEqual(data.comments, [{ taskId: 'TASK-REAL-0001' }]);
  assert.deepEqual(data.notifications, [{ taskId: 'TASK-REAL-0001' }, { title: 'Unrelated notification' }]);
  assert.deepEqual(data.activityLogs, [{ taskId: 'TASK-REAL-0001' }, { action: 'LOGIN' }]);
  assert.equal(removeDemoTasks(data), false);
});
