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
        'from_admission_number',
        'to_admission_number',
        'from_login_id',
        'to_login_id',
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
