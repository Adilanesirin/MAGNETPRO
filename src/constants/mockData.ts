import { FeeItem, Subject, Event, TeacherRemark } from '../types';

export const STUDENT_NAME = 'Alexander';

export const FEES: FeeItem[] = [
  { id: '1', title: 'Tuition Fee - Term 3', amount: 1200, dueDate: 'Oct 15, 2023', status: 'pending' },
  { id: '2', title: 'Transportation (Bus)', amount: 150, dueDate: 'Oct 20, 2023', status: 'pending' },
  { id: '3', title: 'Laboratory Materials', amount: 100, dueDate: 'Nov 01, 2023', status: 'pending' },
  { id: '4', title: 'Tuition - Term 2', amount: 1200, dueDate: 'Aug 12, 2023', status: 'paid' },
  { id: '5', title: 'Library Fine', amount: 15, dueDate: 'Jul 25, 2023', status: 'paid' },
  { id: '6', title: 'Field Trip - Zoo', amount: 45, dueDate: 'Jul 05, 2023', status: 'paid' },
];

export const TOTAL_PAID = 4500;
export const TOTAL_PENDING = 1500;
export const PAID_PERCENT = 75;

export const SUBJECTS: Subject[] = [
  { name: 'English Literature', teacher: 'Mrs. Henderson', grade: 'B+', percentage: 88 },
  { name: 'Advanced Mathematics', teacher: 'Dr. Aris', grade: 'A', percentage: 94 },
  { name: 'Biological Sciences', teacher: 'Mr. Thompson', grade: 'A-', percentage: 91 },
  { name: 'World History', teacher: 'Ms. Garcia', grade: 'B', percentage: 82 },
];

export const EVENTS: Event[] = [
  { id: '1', date: '15', month: 'MAR', title: 'Term 2 Tuition Balance Due', description: 'Standard deadline for all grade 9-12 students.' },
  { id: '2', date: '22', month: 'MAR', title: 'Annual Science & Tech Fair', description: 'Campus Auditorium · 10:00 AM - 4:00 PM' },
  { id: '3', date: '05', month: 'APR', title: 'Parent-Teacher Conference', description: 'Virtual meeting room access will be emailed.' },
];

export const REMARKS: TeacherRemark[] = [
  {
    teacher: 'Mrs. Henderson',
    subject: 'English',
    remark: 'Alexander has shown significant improvement in his analytical essays this month. His participation in class discussions is exemplary.',
    date: 'OCT 24, 2023',
    avatar: 'H',
  },
  {
    teacher: 'Dr. Aris',
    subject: 'Math',
    remark: 'Mastering calculus concepts quickly. I recommend he joins the upcoming Math Olympiad prep sessions on Wednesdays.',
    date: 'OCT 19, 2023',
    avatar: 'A',
  },
];

export const ATTENDANCE = { totalDays: 140, present: 133, percentage: 95 };