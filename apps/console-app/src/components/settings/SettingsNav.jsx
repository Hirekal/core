import { NavLink } from 'react-router-dom';
import { Settings, Heart, Layers, Mail, Webhook } from 'lucide-react';
import SidePanel, { SidePanelItem } from '../common/SidePanel';

const settingsNavItems = [
  { to: 'general', label: 'General Settings', description: 'Labels & branding', icon: Settings },
  { to: 'thank-you', label: 'Thank You Page', description: 'Post-submit message', icon: Heart },
  { to: 'stages', label: 'Custom Stages', description: 'Pipeline stages', icon: Layers },
  { to: 'email-automation', label: 'Email Automation', description: 'Automated emails', icon: Mail },
  { to: 'webhook', label: 'Webhook Integration', description: 'External integrations', icon: Webhook },
];

export default function SettingsNav({ basePath }) {
  return (
    <SidePanel title="Job settings" subtitle="Configure your job">
      <div className="space-y-1.5">
        {settingsNavItems.map(({ to, label, description, icon }) => (
          <NavLink key={to} to={`${basePath}/${to}`} className="block">
            {({ isActive }) => (
              <SidePanelItem
                as="div"
                active={isActive}
                icon={icon}
                label={label}
                description={description}
              />
            )}
          </NavLink>
        ))}
      </div>
    </SidePanel>
  );
}
