<?php
// Check if uploads directory is set up correctly and files exist

$publicDir = __DIR__;
$uploadsDir = $publicDir . '/uploads';

$info = [
    'public_dir' => $publicDir,
    'uploads_dir' => $uploadsDir,
    'uploads_exists' => file_exists($uploadsDir),
    'uploads_is_dir' => is_dir($uploadsDir),
    'uploads_is_writable' => is_writable($uploadsDir),
    'uploads_is_readable' => is_readable($uploadsDir),
];

// List all files recursively in uploads/
function listFiles($dir, $base = '') {
    $files = [];
    if (!is_dir($dir)) return $files;
    foreach (array_diff(scandir($dir), ['.', '..']) as $item) {
        $path = $dir . '/' . $item;
        $rel = $base . '/' . $item;
        if (is_dir($path)) {
            $files = array_merge($files, listFiles($path, $rel));
        } else {
            $files[] = [
                'path' => $rel,
                'size' => filesize($path),
                'readable' => is_readable($path),
            ];
        }
    }
    return $files;
}

$info['files_in_uploads'] = listFiles($uploadsDir);

// Also check a specific file if provided
if (isset($_GET['file'])) {
    $checkPath = $uploadsDir . '/' . ltrim($_GET['file'], '/');
    $info['check_file'] = [
        'path' => $checkPath,
        'exists' => file_exists($checkPath),
        'size' => file_exists($checkPath) ? filesize($checkPath) : null,
        'readable' => file_exists($checkPath) ? is_readable($checkPath) : null,
    ];
}

// Try writing a test file
$testFile = $uploadsDir . '/test_write_' . time() . '.txt';
$written = @file_put_contents($testFile, 'test write ok');
$info['can_write_to_uploads'] = ($written !== false);
if ($written !== false) {
    $info['test_file_url'] = str_replace(__DIR__, '', $testFile);
    // Don't delete so we can test access
}

header('Content-Type: application/json');
echo json_encode($info, JSON_PRETTY_PRINT);
