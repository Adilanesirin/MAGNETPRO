export interface FeeItem {
  id: string;
  title: string;
  amount: number;
  dueDate: string;
  status: 'pending' | 'paid';
}

export interface Subject {
  name: string;
  teacher: string;
  grade: string;
  percentage: number;
}

export interface Event {
  id: string;
  date: string;
  month: string;
  title: string;
  description: string;
}

export interface TeacherRemark {
  teacher: string;
  subject: string;
  remark: string;
  date: string;
  avatar: string;
}