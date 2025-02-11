import { ServiceList } from '../components/ServiceList';
import { IncidentList } from '../components/IncidentList';

function Dashboard() {
  return (
    <div className="space-y-8">
      <ServiceList />
      <IncidentList />
    </div>
  );
}

export default Dashboard;
