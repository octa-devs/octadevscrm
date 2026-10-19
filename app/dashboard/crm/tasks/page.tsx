'use client';
import CrudResource from '@/components/CrudResource';

export default function TasksPage() {
  return (
    <CrudResource
      entity="tasks"
      title="Tasks"
      intro="Short-term work for the team. Anything longer than a week belongs in a deal."
      emptyLine="Add the first task so nothing sits on one person's laptop."
      fields={[
        { key: 'title', label: 'Task', placeholder: 'Send revised proposal' },
        { key: 'assignee', label: 'Assignee', placeholder: 'Akshansh' },
        { key: 'due_date', label: 'Due date', type: 'date' },
        { key: 'priority', label: 'Priority', type: 'select', options: ['Low', 'Medium', 'High'] },
        { key: 'status', label: 'Status', type: 'select', options: ['To do', 'In progress', 'Done'] },
        { key: 'notes', label: 'Notes', type: 'textarea', full: true, placeholder: 'What done looks like.' },
      ]}
      chips={[
        { key: 'priority', map: { High: 'signal' } },
        { key: 'status', map: { Done: 'ok', 'In progress': 'signal' } },
      ]}
      primary={(i) => i.title || 'Untitled task'}
      secondary={(i) => [i.assignee, i.due_date].filter(Boolean).join(' · ')}
    />
  );
}
