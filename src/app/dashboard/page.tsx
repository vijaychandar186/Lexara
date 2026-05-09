import { Metadata } from 'next';
import Dashboard from '@/features/dashboard/dashboard-view';

export const metadata: Metadata = {
  title: 'Dashboard | Uploaded Files',
  description: 'View and manage your uploaded files in the dashboard.'
};

export default function Page() {
  return <Dashboard />;
}