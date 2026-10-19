'use client';
import CrudResource from '@/components/CrudResource';

export default function LeadsPage() {
  return (
    <CrudResource
      entity="leads"
      title="Leads"
      intro="Inbound interest from octadevs.fun and referrals. Move a lead to Won once the deal page is signed."
      emptyLine="Add the first lead to start tracking conversations with potential clients."
      fields={[
        { key: 'name', label: 'Name', placeholder: 'Priya Nair' },
        { key: 'company', label: 'Company', placeholder: 'Northwind Studio' },
        { key: 'email', label: 'Email', type: 'email', placeholder: 'priya@northwind.co' },
        { key: 'phone', label: 'Phone', placeholder: '+91 98765 43210' },
        { key: 'status', label: 'Status', type: 'select', options: ['New', 'Contacted', 'Qualified', 'Won', 'Lost'] },
        { key: 'source', label: 'Source', type: 'select', options: ['Website', 'Referral', 'Social', 'Outbound', 'Event'] },
        { key: 'notes', label: 'Notes', type: 'textarea', full: true, placeholder: 'What they asked for, budget, timeline.' },
      ]}
      chips={[{ key: 'status', map: { New: 'signal', Qualified: 'ok', Won: 'ok', Lost: 'danger' } }]}
      primary={(i) => i.name || 'Untitled lead'}
      secondary={(i) => [i.company, i.email].filter(Boolean).join(' · ')}
    />
  );
}
