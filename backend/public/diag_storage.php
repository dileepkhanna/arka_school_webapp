<?php
// Diagnostic script to check storage setup on Hostinger
$results = [];

// 1. Check if storage symlink exists
$symlinkPath = __DIR__ . '/storage';
$results['public_storage_is_symlink'] = is_link($symlinkPath);
$results['public_storage_exists'] = file_exists($symlinkPath);
$results['public_storage_is_dir'] = is_dir($symlinkPath);
if (is_link($symlinkPath)) {
    $results['symlink_target'] = readlink($symlinkPath);
}

// 2. Check directory contents
$messageAttachmentsPath = $symlinkPath . '/message-attachments';
if (is_dir($messageAttachmentsPath)) {
    $results['message_attachments_exists'] = true;
    $results['message_attachments_subdirs'] = array_diff(scandir($messageAttachmentsPath), ['.', '..']);
} else {
    $results['message_attachments_exists'] = false;
}

// 3. Check actual storage path
$storagePath = dirname(__DIR__) . '/storage/app/public';
$results['storage_app_public_exists'] = is_dir($storagePath);
if (is_dir($storagePath)) {
    $msgPath = $storagePath . '/message-attachments';
    $results['storage_message_attachments_exists'] = is_dir($msgPath);
    if (is_dir($msgPath)) {
        $results['storage_message_attachments_subdirs'] = array_diff(scandir($msgPath), ['.', '..']);
    }
}

// 4. Try writing a test file to see if storage is writable
$testFile = $storagePath . '/test_write_' . time() . '.txt';
$writeResult = @file_put_contents($testFile, 'test');
$results['storage_writable'] = ($writeResult !== false);
if ($writeResult !== false) {
    @unlink($testFile);
}

// 5. Check current directory
$results['current_dir'] = __DIR__;

header('Content-Type: application/json');
echo json_encode($results, JSON_PRETTY_PRINT);
