export interface Exam {
  id: string;
  name: string;
  exam_date: string | null;
  exam_time: string | null;
  max_marks: number | null;
  class_id: string | null;
  subject_id: string | null;
  classes?: { name: string; section: string } | null;
  subjects?: { name: string } | null;
}

export interface ClassItem {
  id: string;
  name: string;
  section: string;
}

export interface SubjectItem {
  id: string;
  name: string;
  category?: string | null;
}

export interface ExamSlot {
  id: string;
  startTime: string;
  endTime: string;
  label: string;
}

export interface ExamScheduleEntry {
  date: string;
  slotId: string;
  classId: string;
  subjectId: string;
  className: string;
  subjectName: string;
}

export interface ExamFormData {
  name: string;
  term: string;
  startDate: string;
  endDate: string;
  maxMarks: string;
  duration: string;
  selectedClasses: string[];
  slots: ExamSlot[];
  classSubjects: Record<string, string[]>;
  schedule: ExamScheduleEntry[];
  mode: 'auto' | 'manual' | null;
}

export interface StudentMark {
  studentId: string;
  studentName: string;
  admissionNumber: string;
  photoUrl: string | null;
  marks: number | null;
  grade: string | null;
  remarks: string | null;
}

export interface ExamWithMarks extends Exam {
  marksEntered?: number;
  totalStudents?: number;
}
