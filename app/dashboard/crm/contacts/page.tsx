'use client';
import CrudResource from '@/components/CrudResource';

export default function ContactsPage() {
  return (
    <CrudResource
      entity="contacts"
      title="Contacts"
      intro="Everyone the team has spoken with, including people attached to existing deals."
      emptyLine="Save a contact so the whole team has the same email and phone number."
      fields={[
        { key: 'name', label: 'Name', placeholder: 'Rahul Verma' },
        { key: 'role', label: 'Role', placeholder: 'Product Lead' },
        { key: 'company', label: 'Company', placeholder: 'Lumen Labs' },
        { key: 'email', label: 'Email', type: 'email', placeholder: 'rahul@lumenlabs.io' },
        { key: 'phone', label: 'Phone', placeholder: '+91 90000 11111' },
        { key: 'notes', label: 'Notes', type: 'textarea', full: true, placeholder: 'How you know them, preferred channel.' },
      ]}
      primary={(i) => i.name || 'Untitled contact'}
      secondary={(i) => [[i.role, i.company].filter(Boolean).join(', '), i.email].filter(Boolean).join(' · ')}
    />
  );
}
