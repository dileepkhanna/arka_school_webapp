<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('attendance')) {
            Schema::table('attendance', function (Blueprint $table): void {
                if (! Schema::hasColumn('attendance', 'class_id_snapshot')) {
                    $table->unsignedBigInteger('class_id_snapshot')->nullable()->after('student_id');
                }
                if (! Schema::hasColumn('attendance', 'class_name_snapshot')) {
                    $table->string('class_name_snapshot')->nullable()->after('class_id_snapshot');
                }
                if (! Schema::hasColumn('attendance', 'class_section_snapshot')) {
                    $table->string('class_section_snapshot')->nullable()->after('class_name_snapshot');
                }
            });
        }

        if (Schema::hasTable('exam_marks')) {
            Schema::table('exam_marks', function (Blueprint $table): void {
                if (! Schema::hasColumn('exam_marks', 'class_id_snapshot')) {
                    $table->unsignedBigInteger('class_id_snapshot')->nullable()->after('student_id');
                }
                if (! Schema::hasColumn('exam_marks', 'class_name_snapshot')) {
                    $table->string('class_name_snapshot')->nullable()->after('class_id_snapshot');
                }
                if (! Schema::hasColumn('exam_marks', 'class_section_snapshot')) {
                    $table->string('class_section_snapshot')->nullable()->after('class_name_snapshot');
                }
            });
        }

        $this->backfillExamMarks();
        $this->backfillAttendance();
    }

    public function down(): void
    {
        if (Schema::hasTable('attendance')) {
            Schema::table('attendance', function (Blueprint $table): void {
                foreach (['class_id_snapshot', 'class_name_snapshot', 'class_section_snapshot'] as $column) {
                    if (Schema::hasColumn('attendance', $column)) {
                        $table->dropColumn($column);
                    }
                }
            });
        }

        if (Schema::hasTable('exam_marks')) {
            Schema::table('exam_marks', function (Blueprint $table): void {
                foreach (['class_id_snapshot', 'class_name_snapshot', 'class_section_snapshot'] as $column) {
                    if (Schema::hasColumn('exam_marks', $column)) {
                        $table->dropColumn($column);
                    }
                }
            });
        }
    }

    private function backfillExamMarks(): void
    {
        if (! Schema::hasTable('exam_marks') || ! Schema::hasTable('exams') || ! Schema::hasTable('classes')) {
            return;
        }

        $rows = DB::table('exam_marks')
            ->leftJoin('exams', 'exams.id', '=', 'exam_marks.exam_id')
            ->leftJoin('classes', 'classes.id', '=', 'exams.class_id')
            ->select('exam_marks.id', 'exams.class_id', 'classes.name as class_name', 'classes.section as class_section')
            ->get();

        foreach ($rows as $row) {
            DB::table('exam_marks')->where('id', $row->id)->update([
                'class_id_snapshot' => $row->class_id,
                'class_name_snapshot' => $row->class_name,
                'class_section_snapshot' => $row->class_section,
            ]);
        }
    }

    private function backfillAttendance(): void
    {
        if (! Schema::hasTable('attendance') || ! Schema::hasTable('students')) {
            return;
        }

        $promotionByStudent = Schema::hasTable('promotion_history')
            ? DB::table('promotion_history')
                ->select('student_id', 'from_class_id', 'to_class_id', 'created_at')
                ->orderBy('created_at')
                ->get()
                ->groupBy('student_id')
            : collect();

        $classMap = Schema::hasTable('classes')
            ? DB::table('classes')->select('id', 'name', 'section')->get()->keyBy('id')
            : collect();

        $studentMap = DB::table('students')->select('id', 'class_id')->get()->keyBy('id');

        $rows = DB::table('attendance')->select('id', 'student_id', 'date')->get();

        foreach ($rows as $row) {
            $currentClassId = $studentMap[$row->student_id]->class_id ?? null;
            $historyRows = $promotionByStudent[$row->student_id] ?? collect();
            $recordDate = (string) $row->date;

            foreach ($historyRows->sortByDesc('created_at') as $history) {
                if ($recordDate < substr((string) $history->created_at, 0, 10)) {
                    $currentClassId = $history->from_class_id;
                }
            }

            $class = $currentClassId ? ($classMap[$currentClassId] ?? null) : null;

            DB::table('attendance')->where('id', $row->id)->update([
                'class_id_snapshot' => $currentClassId,
                'class_name_snapshot' => $class->name ?? null,
                'class_section_snapshot' => $class->section ?? null,
            ]);
        }
    }
};
