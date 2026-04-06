<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Student extends Model
{
    use HasFactory;

    protected $fillable = [
        'admission_number',
        'full_name',
        'class_id',
        'user_id',
        'date_of_birth',
        'blood_group',
        'photo_url',
        'parent_name',
        'parent_phone',
        'address',
        'emergency_contact',
        'emergency_contact_name',
        'login_id',
        'password_hash',
        'status',
    ];

    protected $casts = [
        'date_of_birth' => 'date',
    ];
}
