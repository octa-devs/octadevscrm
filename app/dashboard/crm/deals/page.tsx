'use client';
import CrudResource from '@/components/CrudResource';

export default function DealsPage() {
  return (
    <CrudResource
      entity="deals"
      title="Deals"
      intro="Work in flight. Values are what the client agreed to, before taxes and retainers."
      emptyLine="Log the first deal so the team can see what is close to closing."
      fields={[
        { key: 'title', label: 'Deal', placeholder: 'Lumen Labs — mobile app' },
        { key: 'value', label: 'Value', placeholder: '₹2,40,000' },
        { key: 'stage', label: 'Stage', type: 'select', options: ['Prospecting', 'Qualified', 'Proposal', 'Negotiation', 'Won', 'Lost'] },
        { key: 'contact', label: 'Contact', placeholder: 'Rahul Verma' },
        { key: 'close_date', label: 'Close date', type: 'date' },
        { key: 'notes', label: 'Notes', type: 'textarea', full: true, placeholder: 'Scope, objections, next step.' },
      ]}
      chips={[{ key: 'stage', map: { Negotiation: 'signal', Won: 'ok', Lost: 'danger' } }]}
      primary={(i) => i.title || 'Untitled deal'}
      secondary={(i) => [i.contact, i.value, i.close_date].filter(Boolean).join(' · ')}
    />
  );
}
