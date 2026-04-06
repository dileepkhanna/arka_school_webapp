<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class CertificateRequest extends Model
{
    use HasFactory;

    protected $fillable = [
        'student_id',
        'certificate_type',
        'requested_by',
        'approved_by',
        'attachment_url',
        'status',
    ];
}
