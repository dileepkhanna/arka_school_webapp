## User

Create the file `E:\School_Modification\check\studentpromotionplan.md` with the exact content shown below. Do not modify or summarize — write it verbatim.

---

# Student Promotion Plan — SmartEduConnect

> **Feature:** In-place bulk student promotion across classes with full audit history.
> **Stack:** Laravel 11 (PHP) backend · React 18 + TypeScript + Vite + shadcn/ui frontend · MySQL database.

---

## Project Structure Quick Reference

```
check/
├── backend/
│   ├── app/
│   │   ├── Http/Controllers/Api/   ← one controller per feature
│   │   ├── Models/                 ← Eloquent models
│   │   └── Services/               ← optional service layer
│   ├── database/
│   │   └── migrations/             ← dated migration files
│   └── routes/
│       └── api.php                 ← ALL API routes (token-guarded group)
└── src/
    ├── pages/admin/                ← one TSX page per admin feature
    ├── config/adminSidebar.tsx     ← sidebar nav entries
    ├── lib/apiClient.ts            ← central fetch wrapper
    └── App.tsx                     ← React Router route registry
```

---

## Phase 1 — Database & Schema

### Task 1.1 — Create `promotion_history` Migration

**New file:**
`backend/database/migrations/2026_04_01_100000_create_promotion_history_table.php`

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('promotion_history', function (Blueprint $table): void {
            $table->id();

            $table->foreignId('student_id')
                  ->constrained('students')
                  ->cascadeOnDelete();

            $table->foreignId('from_class_id')
                  ->nullable()
                  ->constrained('classes')
                  ->nullOnDelete();

            $table->foreignId('to_class_id')
                  ->nullable()
                  ->constrained('classes')
                  ->nullOnDelete();

            $table->string('academic_year', 20);          // e.g. "2025-2026"
            $table->unsignedBigInteger('promoted_by');     // admin user id (soft ref)
            $table->timestamps();                          // created_at doubles as timestamp

            // Fast historical look-ups
            $table->index('student_id');
            $table->index('academic_year');
            $table->index(['from_class_id', 'to_class_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('promotion_history');
    }
};
```

**Run command (inside `backend/`):**
```
php artisan migrate
```

---

### Task 1.2 — Verify Existing Constraints

Open `backend/database/migrations/2026_03_10_220000_create_school_core_tables.php` and confirm the following (already in the codebase — **no changes needed**):

| Table | Column | Constraint | Impact |
|---|---|---|---|
| `students` | `class_id` | `nullable()->constrained('classes')->nullOnDelete()` | Changing `class_id` to a new value is safe; no cascade issues. |
| `attendance` | `student_id` | `constrained('students')->cascadeOnDelete()` | Tied to **student**, not class — records survive a class change. |
| `fees` | `student_id` | `constrained('students')->cascadeOnDelete()` | Same — fee history stays intact after promotion. |
| `exam_marks` | `student_id` | index, no FK cascade on class | Same — marks stay linked to student. |

> **Conclusion:** The `students.class_id` FK is already mutable. Historical data in `attendance`, `fees`, and `exam_marks` all reference `student_id` directly, so an in-place update of `students.class_id` is completely safe.

---

### Task 1.3 — Create `PromotionHistory` Eloquent Model

**New file:** `backend/app/Models/PromotionHistory.php`

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PromotionHistory extends Model
{
    use HasFactory;

    protected $table = 'promotion_history';

    protected $fillable = [
        'student_id',
        'from_class_id',
        'to_class_id',
        'academic_year',
        'promoted_by',
    ];

    public function student()
    {
        return $this->belongsTo(Student::class);
    }

    public function fromClass()
    {
        return $this->belongsTo(SchoolClass::class, 'from_class_id');
    }

    public function toClass()
    {
        return $this->belongsTo(SchoolClass::class, 'to_class_id');
    }
}
```

---

## Phase 2 — Backend API

### Task 2.1 — `PromotionController`

**New file:** `backend/app/Http/Controllers/Api/PromotionController.php`

```php
<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PromotionHistory;
use App\Models\Student;
use App\Models\SchoolClass;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PromotionController extends Controller
{
    // ------------------------------------------------------------------ //
    //  POST /api/promotion/execute
    // ------------------------------------------------------------------ //
    public function execute(Request $request)
    {
        $data = $request->validate([
            'source_class_id' => 'required|integer|exists:classes,id',
            'target_class_id' => 'required|integer|exists:classes,id|different:source_class_id',
            'academic_year'   => 'required|string|max:20',
        ]);

        // 1. Verify admin role
        $user = $request->user();
        if ($user->role?->role !== 'admin') {
            return response()->json(['message' => 'Insufficient privileges.'], 403);
        }

        // 2. Fetch active students in source class
        $students = Student::where('class_id', $data['source_class_id'])
                           ->where('status', 'active')
                           ->get();

        if ($students->isEmpty()) {
            return response()->json([
                'message' => 'No active students found in the selected source class.',
            ], 422);
        }

        // 3. Transactional promotion
        DB::transaction(function () use ($students, $data, $user) {
            $now       = now();
            $historyRows = $students->map(fn ($s) => [
                'student_id'   => $s->id,
                'from_class_id'=> $data['source_class_id'],
                'to_class_id'  => $data['target_class_id'],
                'academic_year'=> $data['academic_year'],
                'promoted_by'  => $user->id,
                'created_at'   => $now,
                'updated_at'   => $now,
            ])->toArray();

            // Bulk insert history
            PromotionHistory::insert($historyRows);

            // Bulk update class_id in-place
            Student::whereIn('id', $students->pluck('id'))
                   ->update(['class_id' => $data['target_class_id']]);
        });

        $targetClass = SchoolClass::find($data['target_class_id']);

        return response()->json([
            'message'          => 'Promotion completed successfully.',
            'promoted_count'   => $students->count(),
            'target_class'     => $targetClass?->name . ' ' . $targetClass?->section,
        ]);
    }

    // ------------------------------------------------------------------ //
    //  GET /api/promotion/history
    //  Optional query params: ?student_id=X  |  ?academic_year=2025-2026
    // ------------------------------------------------------------------ //
    public function history(Request $request)
    {
        $query = PromotionHistory::with([
            'student:id,full_name,admission_number',
            'fromClass:id,name,section',
            'toClass:id,name,section',
        ])->orderByDesc('created_at');

        if ($request->filled('student_id')) {
            $query->where('student_id', $request->integer('student_id'));
        }

        if ($request->filled('academic_year')) {
            $query->where('academic_year', $request->string('academic_year'));
        }

        return response()->json($query->paginate(50));
    }

    // ------------------------------------------------------------------ //
    //  POST /api/promotion/rollback   (optional safety net)
    //  Body: { "batch_academic_year": "2025-2026", "source_class_id": X,
    //          "target_class_id": Y }
    //  Reverses the most-recent batch matching those three values.
    // ------------------------------------------------------------------ //
    public function rollback(Request $request)
    {
        $data = $request->validate([
            'batch_academic_year' => 'required|string|max:20',
            'source_class_id'     => 'required|integer|exists:classes,id',
            'target_class_id'     => 'required|integer|exists:classes,id',
        ]);

        $user = $request->user();
        if ($user->role?->role !== 'admin') {
            return response()->json(['message' => 'Insufficient privileges.'], 403);
        }

        $batch = PromotionHistory::where('academic_year',  $data['batch_academic_year'])
                                  ->where('from_class_id', $data['source_class_id'])
                                  ->where('to_class_id',   $data['target_class_id'])
                                  ->get();

        if ($batch->isEmpty()) {
            return response()->json(['message' => 'No matching promotion batch found.'], 404);
        }

        DB::transaction(function () use ($batch, $data) {
            Student::whereIn('id', $batch->pluck('student_id'))
                   ->where('class_id', $data['target_class_id'])   // safety guard
                   ->update(['class_id' => $data['source_class_id']]);

            PromotionHistory::whereIn('id', $batch->pluck('id'))->delete();
        });

        return response()->json([
            'message'         => 'Rollback completed successfully.',
            'restored_count'  => $batch->count(),
        ]);
    }
}
```

---

### Task 2.2 — Register Routes

**Edit file:** `backend/routes/api.php`

Inside the existing `Route::middleware('api.token')->group(function (): void { ... })` block, add the following three lines (after the existing `students` routes is a natural placement):

```php
use App\Http\Controllers\Api\PromotionController;

// Student Promotion
Route::post('/promotion/execute',  [PromotionController::class, 'execute']);
Route::get('/promotion/history',   [PromotionController::class, 'history']);
Route::post('/promotion/rollback', [PromotionController::class, 'rollback']);
```

Also add the `use` import near the top of `api.php` alongside the other controller imports.

---

## Phase 3 — Frontend (React + TypeScript + shadcn/ui)

### Task 3.1 — New Admin Page

**New file:** `src/pages/admin/StudentPromotion.tsx`

The page must follow the exact same layout and import pattern as every other admin page (e.g., `FeesManagement.tsx`, `ClassesManagement.tsx`):

```
DashboardLayout  ← wraps entire page
  adminSidebarItems  ← sidebar prop
  useAuth + useNavigate  ← auth guard redirect
  apiClient.get / apiClient.post  ← data fetching
  useToast  ← success / error notifications
  Card / CardContent / CardHeader / CardTitle  ← page card
  Dialog / DialogContent / DialogHeader  ← modals
  Select / SelectTrigger / SelectContent / SelectItem  ← dropdowns
  Table / TableBody / TableCell …  ← history data table
  Button  ← actions
  Loader2  ← spinner (lucide-react)
  AlertCircle  ← empty-state / warning icon
```

**State variables needed:**

| State | Type | Purpose |
|---|---|---|
| `classes` | `Class[]` | Populated from `GET /api/classes` |
| `sourceClassId` | `string` | Bound to "From Class" select |
| `targetClassId` | `string` | Bound to "To Class" select |
| `academicYear` | `string` | Text input, e.g. `"2025-2026"` |
| `previewCount` | `number \| null` | Students in source class (shown in confirm modal) |
| `isConfirmOpen` | `boolean` | Controls the confirmation dialog |
| `isLoading` | `boolean` | Spinner during API call |
| `isHistoryOpen` | `boolean` | Controls history modal |
| `history` | `PromotionRecord[]` | Data for history table |
| `historyLoading` | `boolean` | Spinner for history fetch |

**Interfaces:**

```typescript
interface Class {
  id: number;
  name: string;
  section: string;
  academic_year: string;
}

interface PromotionRecord {
  id: number;
  student: { id: number; full_name: string; admission_number: string };
  from_class: { id: number; name: string; section: string } | null;
  to_class:   { id: number; name: string; section: string } | null;
  academic_year: string;
  created_at: string;
}
```

**Key behaviours:**

1. On mount → `GET /api/classes` → populate both dropdowns.
2. When source class changes → count students in `classes` list for the confirmation preview.
3. "Promote" button is **disabled** when `sourceClassId === targetClassId` OR either is empty OR `academicYear` is blank.
4. On "Promote" click → open confirmation `Dialog` showing:
   *"You are about to promote **[N] students** from **[Source Name Section]** to **[Target Name Section]** for academic year **[Year]**. Their existing attendance, fee, and exam records will remain linked to their profiles. Do you wish to continue?"*
5. On confirm → `POST /api/promotion/execute` with `{ source_class_id, target_class_id, academic_year }` → show success/error toast → close dialog.
6. "View History" button → `GET /api/promotion/history` → open history `Dialog` with a table of records.
7. Loading spinner (`Loader2 animate-spin`) replaces button text during API calls.

---

### Task 3.2 — Register Route

**Edit file:** `src/App.tsx`

Add the import:
```typescript
import StudentPromotion from "./pages/admin/StudentPromotion";
```

Add the route inside the `{/* Admin Routes */}` block:
```tsx
<Route path="/admin/promotion" element={<StudentPromotion />} />
```

---

### Task 3.3 — Add Sidebar Entry

**Edit file:** `src/config/adminSidebar.tsx`

Add the `TrendingUp` icon to the existing `lucide-react` import line:
```typescript
import { ..., TrendingUp } from 'lucide-react';
```

Add the sidebar item inside `adminSidebarItems` array (logically after the `Students` entry):
```typescript
{ icon: <TrendingUp className="h-5 w-5" />, label: 'Promotion', path: '/admin/promotion' },
```

---

### Task 3.4 — Tooltip / Help Text

Inside `StudentPromotion.tsx`, below the page title, add an info banner:

```tsx
<div className="flex items-start gap-2 rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700">
  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
  <span>
    <strong>In-Place Update:</strong> Promoting students updates their active class record directly.
    All attendance logs, fee invoices, and exam marks remain attached to each student's profile.
    Ensure all grades and fees for the current year are finalised before promoting.
  </span>
</div>
```

---

## Phase 4 — Testing & QA

### Test Case 1 — Standard Happy Path

1. Log in as admin → navigate to **Promotion** (`/admin/promotion`).
2. Select **From Class**: `Class 5 – A` | **To Class**: `Class 6 – A` | Year: `2025-2026`.
3. Click **Promote** → confirm in modal.
4. **Expected:** toast "Promotion completed successfully", students now appear in Class 6 when viewed at `/admin/students`.
5. **DB check:** `SELECT * FROM promotion_history WHERE academic_year = '2025-2026';` returns one row per promoted student.

### Test Case 2 — Data Persistence Verification

1. Before promotion, note `student_id = 12` has 30 attendance records in `attendance` table and 2 fee invoices in `fees`.
2. Run promotion.
3. **DB check:** `SELECT COUNT(*) FROM attendance WHERE student_id = 12;` still returns 30. Fee records still present.
4. Verify via the student detail view at `/admin/students` that attendance summary and fee history are intact.

### Test Case 3 — Empty Source Class

1. Select a class with 0 active students as **From Class**.
2. Click **Promote**.
3. **Expected (API):** `422` response with `message: "No active students found in the selected source class."`.
4. **Expected (UI):** Error toast appears. No data changes. No crash.

### Test Case 4 — Same Source and Target Class

1. Select the same class for both **From** and **To**.
2. **Expected (UI):** The **Promote** button remains disabled — no API call is made at all.
3. **Expected (API):** If somehow called directly, Laravel validation `different:source_class_id` returns `422`.

### Test Case 5 — Transaction Failure / Rollback

1. Temporarily break the DB connection mid-request (e.g., kill the DB during the `DB::transaction` in `PromotionController::execute`).
2. **Expected:** The transaction rolls back atomically. No rows in `promotion_history` are inserted and no `students.class_id` values are updated. The API returns a `500` error and the UI shows a failure toast.

---

## Phase 5 — Deployment & Post-Launch

### Task 5.1 — Pre-Deploy Backup

Before merging to production, run a full MySQL dump:
```bash
mysqldump -u root -p school_db > school_db_backup_$(date +%Y%m%d_%H%M%S).sql
```
Store the snapshot in a safe off-server location before executing:
```bash
php artisan migrate --force   # inside backend/
```

### Task 5.2 — Deployment Checklist

| Step | Command / Action |
|---|---|
| 1. Pull latest code | `git pull origin main` |
| 2. Install PHP deps | `composer install --no-dev --optimize-autoloader` (inside `backend/`) |
| 3. Run migrations | `php artisan migrate --force` (inside `backend/`) |
| 4. Build frontend | `npm run build` (inside project root) |
| 5. Clear caches | `php artisan config:cache && php artisan route:cache` |

### Task 5.3 — Monitor Logs

- Watch Laravel logs at `backend/storage/logs/laravel.log` in the days following the end of each academic year.
- Set up a log alert for any `500` responses on `POST /api/promotion/execute`.
- Monitor DB query time on `promotion_history` — if the table grows large, consider adding a composite index on `(academic_year, to_class_id)`.

---

## Summary of All Files to Create / Edit

| Action | Path |
|---|---|
| **CREATE** | `backend/database/migrations/2026_04_01_100000_create_promotion_history_table.php` |
| **CREATE** | `backend/app/Models/PromotionHistory.php` |
| **CREATE** | `backend/app/Http/Controllers/Api/PromotionController.php` |
| **CREATE** | `src/pages/admin/StudentPromotion.tsx` |
| **EDIT** | `backend/routes/api.php` — add 3 routes + `use` import |
| **EDIT** | `src/App.tsx` — import page + register `/admin/promotion` route |
| **EDIT** | `src/config/adminSidebar.tsx` — add `TrendingUp` icon + sidebar entry |


## Assistant

<thinking>
The user wants me to create a specific file with exact content. Let me create the file `E:\School_Modification\check\studentpromotionplan.md` with the exact content provided.

I need to use a tool to write/create this file. Let me look at what tools are available... I have `find_path`, `grep`, `read_file`, `list_directory`, `diagnostics`, `fetch`, `web_search`, `open`, and `now` tools. 

I don't see a direct "write file" or "create file" tool. However, I can see the project structure mentions `E:\School_Modification\check` as a root directory. 


Looking back at the available tools, none of them explicitly support creating or writing files—I have read and search capabilities, but no write functionality. I'm checking the available tools again to see if there's a way to create files, but the list only includes read and diagnostic operations—no write capability. Since I can't directly create the file, I'll provide the content for the user to set up manually.
</thinking>

I don't have a file-writing tool available in my current toolset — the tools I have access to are read-only (reading files, searching, fetching URLs, diagnostics, etc.). I can't directly create or write files on disk.

Here's what you can do to create the file yourself. Copy the content below exactly into a new file saved at `E:\School_Modification\check\studentpromotionplan.md`:

```E:\School_Modification\check\studentpromotionplan.md#L1-999
# Student Promotion Plan — SmartEduConnect

> **Feature:** In-place bulk student promotion across classes with full audit history.
> **Stack:** Laravel 11 (PHP) backend · React 18 + TypeScript + Vite + shadcn/ui frontend · MySQL database.

---

## Project Structure Quick Reference

```
check/
├── backend/
│   ├── app/
│   │   ├── Http/Controllers/Api/   ← one controller per feature
│   │   ├── Models/                 ← Eloquent models
│   │   └── Services/               ← optional service layer
│   ├── database/
│   │   └── migrations/             ← dated migration files
│   └── routes/
│       └── api.php                 ← ALL API routes (token-guarded group)
└── src/
    ├── pages/admin/                ← one TSX page per admin feature
    ├── config/adminSidebar.tsx     ← sidebar nav entries
    ├── lib/apiClient.ts            ← central fetch wrapper
    └── App.tsx                     ← React Router route registry
```

---

## Phase 1 — Database & Schema

### Task 1.1 — Create `promotion_history` Migration

**New file:**
`backend/database/migrations/2026_04_01_100000_create_promotion_history_table.php`

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('promotion_history', function (Blueprint $table): void {
            $table->id();

            $table->foreignId('student_id')
                  ->constrained('students')
                  ->cascadeOnDelete();

            $table->foreignId('from_class_id')
                  ->nullable()
                  ->constrained('classes')
                  ->nullOnDelete();

            $table->foreignId('to_class_id')
                  ->nullable()
                  ->constrained('classes')
                  ->nullOnDelete();

            $table->string('academic_year', 20);          // e.g. "2025-2026"
            $table->unsignedBigInteger('promoted_by');     // admin user id (soft ref)
            $table->timestamps();                          // created_at doubles as timestamp

            // Fast historical look-ups
            $table->index('student_id');
            $table->index('academic_year');
            $table->index(['from_class_id', 'to_class_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('promotion_history');
    }
};
```

**Run command (inside `backend/`):**
```
php artisan migrate
```

---

### Task 1.2 — Verify Existing Constraints

Open `backend/database/migrations/2026_03_10_220000_create_school_core_tables.php` and confirm the following (already in the codebase — **no changes needed**):

| Table | Column | Constraint | Impact |
|---|---|---|---|
| `students` | `class_id` | `nullable()->constrained('classes')->nullOnDelete()` | Changing `class_id` to a new value is safe; no cascade issues. |
| `attendance` | `student_id` | `constrained('students')->cascadeOnDelete()` | Tied to **student**, not class — records survive a class change. |
| `fees` | `student_id` | `constrained('students')->cascadeOnDelete()` | Same — fee history stays intact after promotion. |
| `exam_marks` | `student_id` | index, no FK cascade on class | Same — marks stay linked to student. |

> **Conclusion:** The `students.class_id` FK is already mutable. Historical data in `attendance`, `fees`, and `exam_marks` all reference `student_id` directly, so an in-place update of `students.class_id` is completely safe.

---

### Task 1.3 — Create `PromotionHistory` Eloquent Model

**New file:** `backend/app/Models/PromotionHistory.php`

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PromotionHistory extends Model
{
    use HasFactory;

    protected $table = 'promotion_history';

    protected $fillable = [
        'student_id',
        'from_class_id',
        'to_class_id',
        'academic_year',
        'promoted_by',
    ];

    public function student()
    {
        return $this->belongsTo(Student::class);
    }

    public function fromClass()
    {
        return $this->belongsTo(SchoolClass::class, 'from_class_id');
    }

    public function toClass()
    {
        return $this->belongsTo(SchoolClass::class, 'to_class_id');
    }
}
```

---

## Phase 2 — Backend API

### Task 2.1 — `PromotionController`

**New file:** `backend/app/Http/Controllers/Api/PromotionController.php`

```php
<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PromotionHistory;
use App\Models\Student;
use App\Models\SchoolClass;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PromotionController extends Controller
{
    // ------------------------------------------------------------------ //
    //  POST /api/promotion/execute
    // ------------------------------------------------------------------ //
    public function execute(Request $request)
    {
        $data = $request->validate([
            'source_class_id' => 'required|integer|exists:classes,id',
            'target_class_id' => 'required|integer|exists:classes,id|different:source_class_id',
            'academic_year'   => 'required|string|max:20',
        ]);

        // 1. Verify admin role
        $user = $request->user();
        if ($user->role?->role !== 'admin') {
            return response()->json(['message' => 'Insufficient privileges.'], 403);
        }

        // 2. Fetch active students in source class
        $students = Student::where('class_id', $data['source_class_id'])
                           ->where('status', 'active')
                           ->get();

        if ($students->isEmpty()) {
            return response()->json([
                'message' => 'No active students found in the selected source class.',
            ], 422);
        }

        // 3. Transactional promotion
        DB::transaction(function () use ($students, $data, $user) {
            $now       = now();
            $historyRows = $students->map(fn ($s) => [
                'student_id'   => $s->id,
                'from_class_id'=> $data['source_class_id'],
                'to_class_id'  => $data['target_class_id'],
                'academic_year'=> $data['academic_year'],
                'promoted_by'  => $user->id,
                'created_at'   => $now,
                'updated_at'   => $now,
            ])->toArray();

            // Bulk insert history
            PromotionHistory::insert($historyRows);

            // Bulk update class_id in-place
            Student::whereIn('id', $students->pluck('id'))
                   ->update(['class_id' => $data['target_class_id']]);
        });

        $targetClass = SchoolClass::find($data['target_class_id']);

        return response()->json([
            'message'          => 'Promotion completed successfully.',
            'promoted_count'   => $students->count(),
            'target_class'     => $targetClass?->name . ' ' . $targetClass?->section,
        ]);
    }

    // ------------------------------------------------------------------ //
    //  GET /api/promotion/history
    //  Optional query params: ?student_id=X  |  ?academic_year=2025-2026
    // ------------------------------------------------------------------ //
    public function history(Request $request)
    {
        $query = PromotionHistory::with([
            'student:id,full_name,admission_number',
            'fromClass:id,name,section',
            'toClass:id,name,section',
        ])->orderByDesc('created_at');

        if ($request->filled('student_id')) {
            $query->where('student_id', $request->integer('student_id'));
        }

        if ($request->filled('academic_year')) {
            $query->where('academic_year', $request->string('academic_year'));
        }

        return response()->json($query->paginate(50));
    }

    // ------------------------------------------------------------------ //
    //  POST /api/promotion/rollback   (optional safety net)
    //  Body: { "batch_academic_year": "2025-2026", "source_class_id": X,
    //          "target_class_id": Y }
    //  Reverses the most-recent batch matching those three values.
    // ------------------------------------------------------------------ //
    public function rollback(Request $request)
    {
        $data = $request->validate([
            'batch_academic_year' => 'required|string|max:20',
            'source_class_id'     => 'required|integer|exists:classes,id',
            'target_class_id'     => 'required|integer|exists:classes,id',
        ]);

        $user = $request->user();
        if ($user->role?->role !== 'admin') {
            return response()->json(['message' => 'Insufficient privileges.'], 403);
        }

        $batch = PromotionHistory::where('academic_year',  $data['batch_academic_year'])
                                  ->where('from_class_id', $data['source_class_id'])
                                  ->where('to_class_id',   $data['target_class_id'])
                                  ->get();

        if ($batch->isEmpty()) {
            return response()->json(['message' => 'No matching promotion batch found.'], 404);
        }

        DB::transaction(function () use ($batch, $data) {
            Student::whereIn('id', $batch->pluck('student_id'))
                   ->where('class_id', $data['target_class_id'])   // safety guard
                   ->update(['class_id' => $data['source_class_id']]);

            PromotionHistory::whereIn('id', $batch->pluck('id'))->delete();
        });

        return response()->json([
            'message'         => 'Rollback completed successfully.',
            'restored_count'  => $batch->count(),
        ]);
    }
}
```

---

### Task 2.2 — Register Routes

**Edit file:** `backend/routes/api.php`

Inside the existing `Route::middleware('api.token')->group(function (): void { ... })` block, add the following three lines (after the existing `students` routes is a natural placement):

```php
use App\Http\Controllers\Api\PromotionController;

// Student Promotion
Route::post('/promotion/execute',  [PromotionController::class, 'execute']);
Route::get('/promotion/history',   [PromotionController::class, 'history']);
Route::post('/promotion/rollback', [PromotionController::class, 'rollback']);
```

Also add the `use` import near the top of `api.php` alongside the other controller imports.

---

## Phase 3 — Frontend (React + TypeScript + shadcn/ui)

### Task 3.1 — New Admin Page

**New file:** `src/pages/admin/StudentPromotion.tsx`

The page must follow the exact same layout and import pattern as every other admin page (e.g., `FeesManagement.tsx`, `ClassesManagement.tsx`):

```
DashboardLayout  ← wraps entire page
  adminSidebarItems  ← sidebar prop
  useAuth + useNavigate  ← auth guard redirect
  apiClient.get / apiClient.post  ← data fetching
  useToast  ← success / error notifications
  Card / CardContent / CardHeader / CardTitle  ← page card
  Dialog / DialogContent / DialogHeader  ← modals
  Select / SelectTrigger / SelectContent / SelectItem  ← dropdowns
  Table / TableBody / TableCell …  ← history data table
  Button  ← actions
  Loader2  ← spinner (lucide-react)
  AlertCircle  ← empty-state / warning icon
```

**State variables needed:**

| State | Type | Purpose |
|---|---|---|
| `classes` | `Class[]` | Populated from `GET /api/classes` |
| `sourceClassId` | `string` | Bound to "From Class" select |
| `targetClassId` | `string` | Bound to "To Class" select |
| `academicYear` | `string` | Text input, e.g. `"2025-2026"` |
| `previewCount` | `number \| null` | Students in source class (shown in confirm modal) |
| `isConfirmOpen` | `boolean` | Controls the confirmation dialog |
| `isLoading` | `boolean` | Spinner during API call |
| `isHistoryOpen` | `boolean` | Controls history modal |
| `history` | `PromotionRecord[]` | Data for history table |
| `historyLoading` | `boolean` | Spinner for history fetch |

**Interfaces:**

```typescript
interface Class {
  id: number;
  name: string;
  section: string;
  academic_year: string;
}

interface PromotionRecord {
  id: number;
  student: { id: number; full_name: string; admission_number: string };
  from_class: { id: number; name: string; section: string } | null;
  to_class:   { id: number; name: string; section: string } | null;
  academic_year: string;
  created_at: string;
}
```

**Key behaviours:**

1. On mount → `GET /api/classes` → populate both dropdowns.
2. When source class changes → count students in `classes` list for the confirmation preview.
3. "Promote" button is **disabled** when `sourceClassId === targetClassId` OR either is empty OR `academicYear` is blank.
4. On "Promote" click → open confirmation `Dialog` showing:
   *"You are about to promote **[N] students** from **[Source Name Section]** to **[Target Name Section]** for academic year **[Year]**. Their existing attendance, fee, and exam records will remain linked to their profiles. Do you wish to continue?"*
5. On confirm → `POST /api/promotion/execute` with `{ source_class_id, target_class_id, academic_year }` → show success/error toast → close dialog.
6. "View History" button → `GET /api/promotion/history` → open history `Dialog` with a table of records.
7. Loading spinner (`Loader2 animate-spin`) replaces button text during API calls.

---

### Task 3.2 — Register Route

**Edit file:** `src/App.tsx`

Add the import:
```typescript
import StudentPromotion from "./pages/admin/StudentPromotion";
```

Add the route inside the `{/* Admin Routes */}` block:
```tsx
<Route path="/admin/promotion" element={<StudentPromotion />} />
```

---

### Task 3.3 — Add Sidebar Entry

**Edit file:** `src/config/adminSidebar.tsx`

Add the `TrendingUp` icon to the existing `lucide-react` import line:
```typescript
import { ..., TrendingUp } from 'lucide-react';
```

Add the sidebar item inside `adminSidebarItems` array (logically after the `Students` entry):
```typescript
{ icon: <TrendingUp className="h-5 w-5" />, label: 'Promotion', path: '/admin/promotion' },
```

---

### Task 3.4 — Tooltip / Help Text

Inside `StudentPromotion.tsx`, below the page title, add an info banner:

```tsx
<div className="flex items-start gap-2 rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700">
  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
  <span>
    <strong>In-Place Update:</strong> Promoting students updates their active class record directly.
    All attendance logs, fee invoices, and exam marks remain attached to each student's profile.
    Ensure all grades and fees for the current year are finalised before promoting.
  </span>
</div>
```

---

## Phase 4 — Testing & QA

### Test Case 1 — Standard Happy Path

1. Log in as admin → navigate to **Promotion** (`/admin/promotion`).
2. Select **From Class**: `Class 5 – A` | **To Class**: `Class 6 – A` | Year: `2025-2026`.
3. Click **Promote** → confirm in modal.
4. **Expected:** toast "Promotion completed successfully", students now appear in Class 6 when viewed at `/admin/students`.
5. **DB check:** `SELECT * FROM promotion_history WHERE academic_year = '2025-2026';` returns one row per promoted student.

### Test Case 2 — Data Persistence Verification

1. Before promotion, note `student_id = 12` has 30 attendance records in `attendance` table and 2 fee invoices in `fees`.
2. Run promotion.
3. **DB check:** `SELECT COUNT(*) FROM attendance WHERE student_id = 12;` still returns 30. Fee records still present.
4. Verify via the student detail view at `/admin/students` that attendance summary and fee history are intact.

### Test Case 3 — Empty Source Class

1. Select a class with 0 active students as **From Class**.
2. Click **Promote**.
3. **Expected (API):** `422` response with `message: "No active students found in the selected source class."`.
4. **Expected (UI):** Error toast appears. No data changes. No crash.

### Test Case 4 — Same Source and Target Class

1. Select the same class for both **From** and **To**.
2. **Expected (UI):** The **Promote** button remains disabled — no API call is made at all.
3. **Expected (API):** If somehow called directly, Laravel validation `different:source_class_id` returns `422`.

### Test Case 5 — Transaction Failure / Rollback

1. Temporarily break the DB connection mid-request (e.g., kill the DB during the `DB::transaction` in `PromotionController::execute`).
2. **Expected:** The transaction rolls back atomically. No rows in `promotion_history` are inserted and no `students.class_id` values are updated. The API returns a `500` error and the UI shows a failure toast.

---

## Phase 5 — Deployment & Post-Launch

### Task 5.1 — Pre-Deploy Backup

Before merging to production, run a full MySQL dump:
```bash
mysqldump -u root -p school_db > school_db_backup_$(date +%Y%m%d_%H%M%S).sql
```
Store the snapshot in a safe off-server location before executing:
```bash
php artisan migrate --force   # inside backend/
```

### Task 5.2 — Deployment Checklist

| Step | Command / Action |
|---|---|
| 1. Pull latest code | `git pull origin main` |
| 2. Install PHP deps | `composer install --no-dev --optimize-autoloader` (inside `backend/`) |
| 3. Run migrations | `php artisan migrate --force` (inside `backend/`) |
| 4. Build frontend | `npm run build` (inside project root) |
| 5. Clear caches | `php artisan config:cache && php artisan route:cache` |

### Task 5.3 — Monitor Logs

- Watch Laravel logs at `backend/storage/logs/laravel.log` in the days following the end of each academic year.
- Set up a log alert for any `500` responses on `POST /api/promotion/execute`.
- Monitor DB query time on `promotion_history` — if the table grows large, consider adding a composite index on `(academic_year, to_class_id)`.

---

## Summary of All Files to Create / Edit

| Action | Path |
|---|---|
| **CREATE** | `backend/database/migrations/2026_04_01_100000_create_promotion_history_table.php` |
| **CREATE** | `backend/app/Models/PromotionHistory.php` |
| **CREATE** | `backend/app/Http/Controllers/Api/PromotionController.php` |
| **CREATE** | `src/pages/admin/StudentPromotion.tsx` |
| **EDIT** | `backend/routes/api.php` — add 3 routes + `use` import |
| **EDIT** | `src/App.tsx` — import page + register `/admin/promotion` route |
| **EDIT** | `src/config/adminSidebar.tsx` — add `TrendingUp` icon + sidebar entry |
```

---

**Why I can't do this automatically:** The tools available to me in this session are read-only (file reading, path searching, grep, diagnostics, web fetch, etc.) — there is no `write_file` or `create_file` tool provided. To create the file, you can:

1. **Quickest option:** Open a terminal in `E:\School_Modification\check\` and run:
   ```/dev/null/cmd.txt#L1-1
   type nul > studentpromotionplan.md
   ```
   Then paste the content from the block above into the file using your editor (VS Code, Notepad++, etc.).

2. **PowerShell one-liner** (paste content via clipboard): Open the file in VS Code with `code studentpromotionplan.md` from within that directory and paste.

