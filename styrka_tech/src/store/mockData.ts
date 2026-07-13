// Employee Records
export interface Employee {
  id: string;
  name: string;
  role: 'employee' | 'admin';
  department: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'in-progress' | 'completed';
  assignedTo: string;
  dueDate: string;
}

export interface TimeRecord {
  id: string;
  employeeId: string;
  clockIn: string;
  clockOut: string | null;
  date: string;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  date: string;
}

export interface LocationRecord {
  id: string;
  employeeId: string;
  latitude: number;
  longitude: number;
  timestamp: string;
}

export const mockEmployees: Employee[] = [
  { id: 'e1', name: 'Alice Smith', role: 'employee', department: 'Logistics' },
  { id: 'e2', name: 'Bob Johnson', role: 'employee', department: 'Field Operations' },
  { id: 'a1', name: 'Admin Sarah', role: 'admin', department: 'Management' },
];

export const mockTasks: Task[] = [
  {
    id: 't1',
    title: 'Inspect Fertilizer Shipment A',
    description: 'Ensure quality standards are met for the incoming batch.',
    status: 'pending',
    assignedTo: 'e1',
    dueDate: '2026-07-15',
  },
  {
    id: 't2',
    title: 'Update Inventory Logs',
    description: 'Record the current stock levels in the warehouse.',
    status: 'in-progress',
    assignedTo: 'e2',
    dueDate: '2026-07-10',
  },
];

export const mockTimeRecords: TimeRecord[] = [
  {
    id: 'tr1',
    employeeId: 'e1',
    clockIn: '08:00:00',
    clockOut: '17:00:00',
    date: '2026-07-09',
  },
  {
    id: 'tr2',
    employeeId: 'e1',
    clockIn: '08:15:00',
    clockOut: null,
    date: '2026-07-10',
  },
];

export const mockAnnouncements: Announcement[] = [
  {
    id: 'an1',
    title: 'New Safety Protocols',
    content: 'Please review the updated safety guidelines for the warehouse by Friday.',
    date: '2026-07-08',
  },
  {
    id: 'an2',
    title: 'Company Picnic',
    content: 'Join us for the annual company picnic on August 1st!',
    date: '2026-07-01',
  },
];

export const mockLocations: LocationRecord[] = [
  {
    id: 'loc1',
    employeeId: 'e1',
    latitude: 37.7749,
    longitude: -122.4194,
    timestamp: '2026-07-10T08:30:00Z',
  },
  {
    id: 'loc2',
    employeeId: 'e2',
    latitude: 37.7849,
    longitude: -122.4094,
    timestamp: '2026-07-10T09:00:00Z',
  },
];
