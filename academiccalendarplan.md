# Academic Calendar Redesign Plan

## Goal

Redesign the current Holiday Calendar into a full Academic Calendar that supports:

- holidays
- events
- academic activities
- meetings
- important school dates

The redesigned module must work for all roles (`admin`, `teacher`, `parent`, and where applicable `student`) and must support scheduled in-app notifications and push notifications for upcoming items:

- 3 days before
- 2 days before
- 1 day before

It must also rename the feature from **Holiday Calendar** to **Academic Calendar** across backend, frontend, navigation, APIs, and notification messaging.

---

## Current State

Existing implementation is holiday-only and already has a usable base:

- Database table: `backend/database/migrations/2026_03_14_100000_create_holidays_table.php`
- Backend controller: `backend/app/Http/Controllers/Api/HolidayCalendarController.php`
- Model: `backend/app/Models/Holiday.php`
- API routes: `backend/routes/api.php`
- Frontend types: `src/components/holiday-calendar/types.ts`
- Frontend pages/routes/sidebar labels currently use `Holiday Calendar`
- Notification infrastructure already exists:
  - `backend/app/Services/NotificationService.php`
  - `backend/app/Services/PushNotificationService.php`
  - `backend/app/Http/Controllers/Api/PushNotificationController.php`
  - `src/hooks/usePushNotifications.ts`

This means the calendar feature should be expanded, not rebuilt from scratch.

---

## Recommended Functional Scope

### Calendar entry types

Replace holiday-only classification with a broader academic calendar model.

Recommended `category` values:

- `holiday`
- `event`
- `academic_activity`
- `meeting`
- `important_date`

Optional second-level subtype can be added later if needed.

Examples:

- Holiday: Diwali, Winter Break
- Event: Annual Day, Sports Day
- Academic activity: Unit Test Week, Science Exhibition
- Meeting: PTA Meeting, Staff Meeting
- Important date: Admission Deadline, Result Declaration

---

## Recommended Data Model

### Rename strategy

Preferred target table name:

- `academic_calendar_entries`

This is clearer than keeping a misleading `holidays` table after the feature becomes multi-purpose.

### Migration approach

Create a migration that:

1. Renames `holidays` to `academic_calendar_entries`
2. Converts the current `type` column usage
3. Adds new fields required for category, audience, notifications, and status
4. Migrates old holiday rows into the new structure

### Proposed table structure

| Column | Type | Purpose |
|---|---|---|
| `id` | bigint | Primary key |
| `title` | string | Replaces `name` |
| `category` | enum/string | `holiday`, `event`, `academic_activity`, `meeting`, `important_date` |
| `subcategory` | string nullable | Optional finer classification |
| `start_date` | date | Entry start |
| `end_date` | date nullable | Entry end |
| `all_day` | boolean | True for holidays and most date-based items |
| `start_time` | time nullable | For meetings/events |
| `end_time` | time nullable | For meetings/events |
| `description` | text nullable | Details |
| `image_url` | string nullable | Existing support retained |
| `location` | string nullable | Meeting/event location |
| `is_recurring` | boolean | Keep existing recurrence support |
| `recurrence_rule` | string nullable | Optional later support for advanced recurrence |
| `audience_type` | string | `all`, `roles`, `classes`, `users` |
| `audience_roles` | json nullable | Example: `["admin","teacher","parent"]` |
| `audience_class_ids` | json nullable | For class-specific visibility if needed later |
| `notify_enabled` | boolean | Master notification toggle |
| `notify_offsets_days` | json nullable | Example: `[3,2,1]` |
| `status` | string | `draft`, `published`, `cancelled` |
| `created_by` | bigint nullable | Existing creator tracking |
| `updated_by` | bigint nullable | Audit improvement |
| `created_at` | timestamp | Standard |
| `updated_at` | timestamp | Standard |

### Minimum viable restructure

If a full rename is considered risky for phase 1, keep the physical table temporarily and expand it with these columns, then rename the UI/API domain first.  
But the preferred end state is still `academic_calendar_entries`.

---

## Data Mapping From Existing Holidays

Current holiday data can map as follows:

- `name` -> `title`
- current holiday `type` -> either:
  - `category = holiday`
  - move old `type` value into `subcategory` or `legacy_type`
- `start_date` -> `start_date`
- `end_date` -> `end_date`
- `description` -> `description`
- `image_url` -> `image_url`
- `is_recurring` -> `is_recurring`
- `created_by` -> `created_by`

For all migrated existing records:

- `category = holiday`
- `all_day = true`
- `audience_type = all`
- `notify_enabled = true`
- `notify_offsets_days = [3,2,1]`
- `status = published`

---

## Backend Changes

### 1. Model layer

Replace or evolve `Holiday` into something like:

- `AcademicCalendarEntry`

Responsibilities:

- casts for dates, booleans, JSON arrays
- reusable scopes for date range, published items, role visibility
- audience filtering helpers

### 2. Controller layer

Replace `HolidayCalendarController` with `AcademicCalendarController` or keep the old controller name temporarily and refactor internally.

Required endpoints:

- `GET /academic-calendar`
- `POST /academic-calendar`
- `PUT /academic-calendar/{id}`
- `DELETE /academic-calendar/{id}`
- optional: `GET /academic-calendar/{id}`

Admin actions:

- create/update/delete any entry
- publish/cancel entry
- define notification offsets
- define audience

Non-admin actions:

- view only entries visible to their role/class

### 3. Validation rules

Validation should support both all-day and timed entries.

Examples:

- `title` required
- `category` required
- `start_date` required
- `end_date >= start_date`
- `start_time` and `end_time` required for timed meetings/events when `all_day = false`
- `notify_offsets_days` must contain only allowed values:
  - `[3]`, `[2]`, `[1]`, `[3,2]`, `[2,1]`, `[3,2,1]`
- `audience_roles` must contain valid roles only

### 4. Visibility rules for all roles

Recommended first version:

- `admin` sees all entries
- `teacher` sees entries for:
  - `all`
  - teacher role
  - assigned class if class targeting is later introduced
- `parent` sees entries for:
  - `all`
  - parent role
  - their child class if class targeting is later introduced
- `student` can be added with same pattern if the app already supports student login

---

## Notification and Push Notification Plan

### Goal

Send reminders before the calendar item date:

- 3 days before
- 2 days before
- 1 day before

Channels:

- in-app notification
- push notification

### Use existing infrastructure

Existing notification services already support:

- in-app notifications
- push notifications
- deduplication keys
- entity metadata
- per-user delivery

Use:

- `backend/app/Services/NotificationService.php`
- `backend/app/Services/PushNotificationService.php`

### Recommended implementation

Create a scheduled command/job such as:

- `academic-calendar:send-reminders`

Run daily via Laravel scheduler.

### Scheduler logic

Every day:

1. Load all `published` academic calendar entries with `notify_enabled = true`
2. For each entry, calculate days remaining from `start_date`
3. If remaining days matches one of `notify_offsets_days`, prepare delivery
4. Resolve audience users by role/class rules
5. Send notifications using existing notification service
6. Use a deterministic `dedupe_key` to prevent duplicate reminders

Recommended dedupe pattern:

- `academic-calendar:{entry_id}:{days_before}:{user_id}`

### Notification payload example

Type:

- `academic_calendar`

Entity data:

- `entity_type = academic_calendar`
- `entity_id = {entry_id}`

Title examples:

- `Upcoming Holiday: Holi`
- `Upcoming Event: Annual Day`
- `Upcoming Meeting: PTA Meeting`

Message examples:

- `Holi starts in 3 days on 2026-03-20.`
- `Annual Day is scheduled in 2 days.`
- `PTA Meeting is tomorrow at 10:00 AM.`

Link examples:

- `/admin/academic-calendar`
- `/teacher/academic-calendar`
- `/parent/academic-calendar`

The existing notification service already rewrites role-prefixed links per user role.

### Important edge cases

- Do not notify cancelled entries
- Do not notify draft entries
- Do not notify after an event has started
- For recurring entries, generate reminders for the resolved occurrence date
- For multi-day holidays, reminder should be based on `start_date`
- Prevent duplicate reminders if scheduler runs multiple times in one day

---

## Frontend Changes

### Rename all UI references

Replace:

- `Holiday Calendar`

With:

- `Academic Calendar`

Files likely affected:

- `src/config/adminSidebar.tsx`
- `src/config/teacherSidebar.tsx`
- `src/config/parentSidebar.tsx`
- `src/App.tsx`
- `src/pages/admin/HolidayCalendar.tsx`
- `src/pages/teacher/TeacherHolidayCalendar.tsx`
- `src/pages/parent/ParentHolidayCalendar.tsx`
- `src/components/holiday-calendar/*`

### Recommended frontend restructure

Rename feature folder from holiday-specific naming to academic-calendar naming.

Suggested structure:

- `src/components/academic-calendar/`
- `src/pages/admin/AcademicCalendar.tsx`
- `src/pages/teacher/TeacherAcademicCalendar.tsx`
- `src/pages/parent/ParentAcademicCalendar.tsx`

### UI changes

Admin create/edit form must support:

- title
- category
- date range
- all-day toggle
- time fields for meetings/events
- description
- location
- recurring toggle
- audience selection
- notification toggle
- reminder day selection (`3`, `2`, `1`)
- image upload if still needed

Views should support:

- month calendar view
- list view
- color coding by category
- filters by category
- role-specific visibility
- badges like `Holiday`, `Meeting`, `Event`, `Important Date`

### Suggested category colors

- `holiday` -> red
- `event` -> blue
- `academic_activity` -> green
- `meeting` -> amber
- `important_date` -> slate or indigo

---

## API Transition Strategy

### Preferred route plan

Add new routes:

- `GET /academic-calendar`
- `POST /academic-calendar`
- `PUT /academic-calendar/{id}`
- `DELETE /academic-calendar/{id}`

Temporary backward compatibility:

- keep `/holidays` for one release cycle
- internally map `/holidays` to academic calendar entries filtered to `category = holiday`

This reduces breakage while frontend and mobile/web clients transition.

---

## Delivery Phases

## Phase 1 - Database and backend foundation

- create migration to rename and restructure `holidays`
- add new columns for category, audience, notifications, status
- migrate old records to `category = holiday`
- create/refactor model
- create/refactor API controller
- add role-aware query filtering

Deliverable:
- backend can store and return academic calendar entries of multiple categories

## Phase 2 - Frontend rename and feature expansion

- rename Holiday Calendar UI to Academic Calendar
- update routes and sidebars
- refactor types and API client
- update add/edit modal for multiple categories
- update calendar/list rendering and filtering

Deliverable:
- admins can add holidays, events, academic activities, meetings, and important dates
- all roles can view relevant items

## Phase 3 - Notifications and scheduler

- create scheduled reminder command/job
- connect to existing notification service
- add dedupe logic
- add reminder settings in admin form
- send in-app and push notifications for 3/2/1 day reminders

Deliverable:
- users receive upcoming academic calendar reminders automatically

## Phase 4 - Hardening and reporting

- add audit fields and logs
- add tests
- add status handling for cancelled/draft entries
- optionally add class-specific targeting and recurrence improvements

Deliverable:
- stable release-ready module

---

## Testing Plan

### Backend tests

- create holiday entry
- create event entry
- create meeting with time fields
- validate invalid date/time combinations
- fetch visible items by role
- verify old holiday data migration
- verify reminder job sends only for matching offsets
- verify duplicate notifications are blocked by dedupe key
- verify cancelled/draft items do not notify

### Frontend tests

- sidebar/menu label changed to Academic Calendar
- admin can create each category
- teacher/parent only see allowed items
- filters work by category
- calendar and list views render mixed item types correctly
- reminder settings save/load correctly

### Push tests

- subscribed browser receives reminder
- unsubscribed user gets in-app only
- denied browser permission does not break in-app delivery

---

## Risks and Mitigations

### Risk: breaking existing holiday screens
Mitigation:
- keep temporary `/holidays` compatibility
- migrate UI in one branch and validate routes carefully

### Risk: duplicate reminder delivery
Mitigation:
- use `dedupe_key`
- run scheduler once daily
- log reminder execution

### Risk: audience targeting complexity
Mitigation:
- start with `all` and role-based targeting
- add class/user targeting after core release if needed

### Risk: recurrence edge cases
Mitigation:
- preserve existing simple recurring behavior first
- postpone advanced recurrence rules to a later phase

---

## Recommended Defaults

For the first production release:

- `category` required
- `status = published` by default
- `audience_type = all` by default
- `notify_enabled = true` by default
- `notify_offsets_days = [3,2,1]` by default
- meetings/events may use time fields; holidays remain all-day
- reminders are based on `start_date`

---

## Expected Outcome

After implementation, the old Holiday Calendar becomes a full Academic Calendar that:

- supports all important school dates in one place
- works for admin, teacher, and parent roles
- allows admins to add holidays and events from one module
- supports academic activities and meetings
- sends automatic upcoming reminders through in-app and push notifications
- is scalable for future audience and recurrence enhancements

---

## Repo-Specific Files Expected To Change

### Backend

- `backend/database/migrations/2026_03_14_100000_create_holidays_table.php` or a new follow-up migration
- `backend/app/Models/Holiday.php`
- `backend/app/Http/Controllers/Api/HolidayCalendarController.php`
- `backend/routes/api.php`
- new scheduled command/job for reminders
- scheduler registration

### Frontend

- `src/App.tsx`
- `src/config/adminSidebar.tsx`
- `src/config/teacherSidebar.tsx`
- `src/config/parentSidebar.tsx`
- `src/components/holiday-calendar/types.ts`
- `src/components/holiday-calendar/holidayApi.ts`
- `src/components/holiday-calendar/HolidayCalendarContent.tsx`
- `src/components/holiday-calendar/AddEditHolidayModal.tsx`
- `src/components/holiday-calendar/CalendarView.tsx`
- `src/components/holiday-calendar/ListView.tsx`
- `src/pages/admin/HolidayCalendar.tsx`
- `src/pages/teacher/TeacherHolidayCalendar.tsx`
- `src/pages/parent/ParentHolidayCalendar.tsx`

---

## Implementation Recommendation

Use an expand-and-rename approach:

1. restructure data model first
2. add academic calendar APIs
3. rename frontend labels and routes
4. add reminder scheduler using the existing notification system
5. keep temporary holiday compatibility until rollout is complete

This gives the safest path with the least regression risk.
