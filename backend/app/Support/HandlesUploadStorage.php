<?php

namespace App\Support;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

trait HandlesUploadStorage
{
    protected function uploadDisk(): string
    {
        $disk = (string) config('filesystems.default', 'public');

        if ($disk === '' || ! is_array(config("filesystems.disks.{$disk}"))) {
            return 'public';
        }

        if ($disk !== 's3') {
            return $disk;
        }

        $diskConfig = (array) config('filesystems.disks.s3', []);
        $s3AdapterClass = 'League\\Flysystem\\AwsS3V3\\AwsS3V3Adapter';
        $hasCredentials = trim((string) ($diskConfig['key'] ?? '')) !== ''
            && trim((string) ($diskConfig['secret'] ?? '')) !== ''
            && trim((string) ($diskConfig['bucket'] ?? '')) !== ''
            && trim((string) ($diskConfig['region'] ?? '')) !== '';

        if (! $hasCredentials || ! class_exists($s3AdapterClass)) {
            Log::warning('S3 upload disk is not fully configured; falling back to public disk.', [
                'has_key' => trim((string) ($diskConfig['key'] ?? '')) !== '',
                'has_secret' => trim((string) ($diskConfig['secret'] ?? '')) !== '',
                'has_bucket' => trim((string) ($diskConfig['bucket'] ?? '')) !== '',
                'has_region' => trim((string) ($diskConfig['region'] ?? '')) !== '',
                'has_adapter' => class_exists($s3AdapterClass),
            ]);

            return 'public';
        }

        return $disk;
    }

    protected function buildUploadUrl(string $path): string
    {
        $path = ltrim($path, '/');
        $disk = $this->uploadDisk();
        $diskConfig = (array) config("filesystems.disks.{$disk}", []);
        $baseUrl = trim((string) ($diskConfig['url'] ?? ''));

        if ($baseUrl === '' && $disk === 's3') {
            $baseUrl = $this->s3BaseUrl($diskConfig);
        }

        if ($baseUrl === '') {
            $publicUrl = trim((string) config('filesystems.disks.public.url', ''));
            $baseUrl = $publicUrl !== ''
                ? $publicUrl
                : rtrim((string) config('app.url'), '/').'/uploads';
        }

        return rtrim($baseUrl, '/').'/'.$path;
    }

    protected function buildLegacyStorageUrl(string $path): string
    {
        $baseUrl = rtrim((string) config('app.url'), '/').'/backend/public/storage';

        return rtrim($baseUrl, '/').'/'.ltrim($path, '/');
    }

    protected function extractUploadPathFromUrl(?string $url): ?string
    {
        if (! $url) {
            return null;
        }

        foreach (array_filter([$this->buildUploadBaseUrl(), $this->buildPublicBaseUrl()]) as $baseUrl) {
            $normalizedBase = rtrim($baseUrl, '/').'/';
            if (str_starts_with($url, $normalizedBase)) {
                return ltrim(substr($url, strlen($normalizedBase)), '/');
            }
        }

        // Check if this is an S3 URL by looking at the host
        $host = (string) parse_url($url, PHP_URL_HOST);
        $bucket = trim((string) config('filesystems.disks.s3.bucket', ''));
        
        // Handle S3 URLs with bucket in subdomain (e.g., bucket.s3.region.amazonaws.com)
        if ($bucket !== '' && str_contains($host, '.s3.') && str_contains($host, '.amazonaws.com')) {
            $path = (string) parse_url($url, PHP_URL_PATH);
            return ltrim($path, '/');
        }

        $path = (string) parse_url($url, PHP_URL_PATH);
        if ($path === '') {
            return null;
        }

        foreach (['/backend/public/uploads/', '/uploads/', '/backend/public/storage/', '/public/storage/', '/storage/'] as $prefix) {
            if (str_starts_with($path, $prefix)) {
                return ltrim(substr($path, strlen($prefix)), '/');
            }
        }

        $trimmedPath = ltrim($path, '/');
        if ($bucket !== '' && str_starts_with($trimmedPath, $bucket.'/')) {
            return ltrim(substr($trimmedPath, strlen($bucket.'/')), '/');
        }

        return $trimmedPath !== '' ? $trimmedPath : null;
    }

    protected function deleteStoredFile(?string $url): void
    {
        $path = $this->extractUploadPathFromUrl($url);
        if (! $path) {
            return;
        }

        $disk = $this->uploadDisk();
        Storage::disk($disk)->delete($path);

        if ($disk !== 'public') {
            Storage::disk('public')->delete($path);
        }
    }

    protected function storeUploadedFile(UploadedFile $file, string $directory): string
    {
        $directory = trim($directory, '/');
        $extension = $file->getClientOriginalExtension() ?: $file->extension() ?: 'bin';
        $path = ($directory !== '' ? $directory.'/' : '').Str::uuid()->toString().'.'.$extension;

        $stream = fopen($file->getRealPath(), 'r');
        if ($stream === false) {
            throw new \RuntimeException('Unable to open uploaded file stream.');
        }

        try {
            $stored = Storage::disk($this->uploadDisk())->put($path, $stream);
        } finally {
            fclose($stream);
        }

        if ($stored !== true) {
            throw new \RuntimeException('Upload completed without returning an object path.');
        }

        return $path;
    }

    private function buildUploadBaseUrl(): string
    {
        $disk = $this->uploadDisk();
        $diskConfig = (array) config("filesystems.disks.{$disk}", []);
        $baseUrl = trim((string) ($diskConfig['url'] ?? ''));

        if ($baseUrl === '' && $disk === 's3') {
            $baseUrl = $this->s3BaseUrl($diskConfig);
        }

        return $baseUrl;
    }

    private function buildPublicBaseUrl(): string
    {
        $baseUrl = trim((string) config('filesystems.disks.public.url', ''));

        return $baseUrl !== '' ? $baseUrl : rtrim((string) config('app.url'), '/').'/uploads';
    }

    private function s3BaseUrl(array $diskConfig): string
    {
        $configuredUrl = trim((string) ($diskConfig['url'] ?? ''));
        if ($configuredUrl !== '') {
            return $configuredUrl;
        }

        $bucket = trim((string) ($diskConfig['bucket'] ?? ''));
        $region = trim((string) ($diskConfig['region'] ?? ''));
        $endpoint = trim((string) ($diskConfig['endpoint'] ?? ''));
        $usePathStyle = filter_var($diskConfig['use_path_style_endpoint'] ?? false, FILTER_VALIDATE_BOOL);

        if ($endpoint !== '' && $bucket !== '') {
            if ($usePathStyle) {
                return rtrim($endpoint, '/').'/'.$bucket;
            }

            $parts = parse_url($endpoint);
            if (isset($parts['scheme'], $parts['host'])) {
                $base = $parts['scheme'].'://'.$bucket.'.'.$parts['host'];
                if (isset($parts['port'])) {
                    $base .= ':'.$parts['port'];
                }

                return $base;
            }

            return rtrim($endpoint, '/');
        }

        if ($bucket === '') {
            return '';
        }

        if ($region !== '') {
            return 'https://'.$bucket.'.s3.'.$region.'.amazonaws.com';
        }

        return 'https://'.$bucket.'.s3.amazonaws.com';
    }
}
