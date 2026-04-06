<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class LeaveRequest extends Model
{
    use HasFactory;

    protected $fillable = [
        'request_type',
        'student_id',
        'teacher_id',
        'from_date',
        'to_date',
        'reason',
        'attachment_url',
        'status',
        'approved_by',
    ];
}
