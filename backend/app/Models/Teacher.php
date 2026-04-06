<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Teacher extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'teacher_id',
        'subjects',
        'qualification',
        'status',
        'joining_date',
    ];

    protected $casts = [
        'subjects' => 'array',
        'joining_date' => 'date',
    ];
}
