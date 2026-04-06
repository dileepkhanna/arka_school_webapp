<?php

namespace App\Http\Controllers\Api;

use App\Support\HandlesUploadStorage;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;

class GalleryController extends Controller
{
    use HandlesUploadStorage;

    public function folders(): JsonResponse
    {
        $rows = Schema::hasTable('gallery_folders')
            ? DB::table('gallery_folders')->select('id', 'title', 'created_at')->orderByDesc('created_at')->get()->map(fn ($row) => [
                'id' => (string) $row->id,
                'title' => $row->title,
                'created_at' => $row->created_at,
            ])
            : collect();

        return response()->json($rows);
    }

    public function createFolder(Request $request): JsonResponse
    {
        if (! $this->isAdmin($request)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        if (! Schema::hasTable('gallery_folders')) {
            return response()->json(['message' => 'gallery_folders table not found'], 422);
        }

        $validated = $request->validate([
            'title' => ['required', 'string', 'max:255'],
        ]);

        $id = DB::table('gallery_folders')->insertGetId([
            'title' => $validated['title'],
            'created_by' => $request->user()->id,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return response()->json(['id' => $id], 201);
    }

    public function updateFolder(Request $request, int $id): JsonResponse
    {
        if (! $this->isAdmin($request)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        if (! Schema::hasTable('gallery_folders')) {
            return response()->json(['message' => 'gallery_folders table not found'], 422);
        }

        $validated = $request->validate([
            'title' => ['required', 'string', 'max:255'],
        ]);

        DB::table('gallery_folders')->where('id', $id)->update([
            'title' => $validated['title'],
            'updated_at' => now(),
        ]);

        return response()->json(['message' => 'Updated']);
    }

    public function deleteFolder(Request $request, int $id): JsonResponse
    {
        if (! $this->isAdmin($request)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        if (! Schema::hasTable('gallery_folders')) {
            return response()->json(['message' => 'gallery_folders table not found'], 422);
        }

        if (Schema::hasTable('gallery_images')) {
            $images = DB::table('gallery_images')->where('folder_id', $id)->select('id', 'image_url')->get();
            foreach ($images as $image) {
                $this->deleteImageFile($image->image_url);
            }
            DB::table('gallery_images')->where('folder_id', $id)->delete();
        }

        DB::table('gallery_folders')->where('id', $id)->delete();

        return response()->json(['message' => 'Deleted']);
    }

    public function images(int $folderId): JsonResponse
    {
        $rows = Schema::hasTable('gallery_images')
            ? DB::table('gallery_images')
                ->where('folder_id', $folderId)
                ->select('id', 'folder_id', 'image_url', 'caption', 'created_at')
                ->orderByDesc('created_at')
                ->get()
                ->map(fn ($row) => [
                    'id' => (string) $row->id,
                    'folder_id' => (string) $row->folder_id,
                    'image_url' => $this->normalizeImageUrl($row->image_url),
                    'caption' => $row->caption,
                    'created_at' => $row->created_at,
                ])
            : collect();

        return response()->json($rows);
    }

    public function uploadImage(Request $request, int $folderId): JsonResponse
    {
        if (! $this->isAdmin($request)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        if (! Schema::hasTable('gallery_images') || ! Schema::hasTable('gallery_folders')) {
            return response()->json(['message' => 'gallery tables not found'], 422);
        }

        $validated = $request->validate([
            'image' => ['required', 'image', 'max:10240'],
            'caption' => ['nullable', 'string', 'max:255'],
        ]);

        if (! DB::table('gallery_folders')->where('id', $folderId)->exists()) {
            return response()->json(['message' => 'Folder not found'], 404);
        }

        try {
            $path = $this->storeUploadedFile($request->file('image'), 'gallery/'.$folderId);
            $url = $this->buildUploadUrl($path);
        } catch (\Throwable $e) {
            Log::error('Gallery image upload failed', [
                'folder_id' => $folderId,
                'user_id' => $request->user()->id,
                'disk' => $this->uploadDisk(),
                'filename' => $request->file('image')?->getClientOriginalName(),
                'mime' => $request->file('image')?->getMimeType(),
                'message' => $e->getMessage(),
            ]);

            return response()->json(['message' => 'Image upload failed. Check storage permissions.'], 422);
        }

        $id = DB::table('gallery_images')->insertGetId([
            'folder_id' => $folderId,
            'image_url' => $url,
            'caption' => $validated['caption'] ?? null,
            'created_by' => $request->user()->id,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return response()->json(['id' => $id, 'image_url' => $url], 201);
    }

    public function updateImage(Request $request, int $id): JsonResponse
    {
        if (! $this->isAdmin($request)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        if (! Schema::hasTable('gallery_images')) {
            return response()->json(['message' => 'gallery_images table not found'], 422);
        }

        $validated = $request->validate([
            'caption' => ['nullable', 'string', 'max:255'],
        ]);

        DB::table('gallery_images')->where('id', $id)->update([
            'caption' => $validated['caption'] ?? null,
            'updated_at' => now(),
        ]);

        return response()->json(['message' => 'Updated']);
    }

    public function deleteImage(Request $request, int $id): JsonResponse
    {
        if (! $this->isAdmin($request)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        if (! Schema::hasTable('gallery_images')) {
            return response()->json(['message' => 'gallery_images table not found'], 422);
        }

        $image = DB::table('gallery_images')->where('id', $id)->first();
        if ($image) {
            $this->deleteImageFile($image->image_url);
            DB::table('gallery_images')->where('id', $id)->delete();
        }

        return response()->json(['message' => 'Deleted']);
    }

    private function deleteImageFile(?string $url): void
    {
        if (! $url) {
            return;
        }

        $this->deleteStoredFile($url);
    }

    private function normalizeImageUrl(?string $url): ?string
    {
        if (! $url) {
            return null;
        }

        $path = (string) parse_url($url, PHP_URL_PATH);
        if ($path === '') {
            return $url;
        }

        if (str_starts_with($path, '/backend/public/uploads/')) {
            return $this->buildUploadUrl(substr($path, strlen('/backend/public/uploads/')));
        }

        if (str_starts_with($path, '/uploads/')) {
            return $this->buildUploadUrl(substr($path, strlen('/uploads/')));
        }

        if (str_starts_with($path, '/backend/public/storage/')) {
            return $this->buildLegacyStorageUrl(substr($path, strlen('/backend/public/storage/')));
        }

        if (str_starts_with($path, '/public/storage/')) {
            return $this->buildLegacyStorageUrl(substr($path, strlen('/public/storage/')));
        }

        if (str_starts_with($path, '/storage/')) {
            return $this->buildLegacyStorageUrl(substr($path, strlen('/storage/')));
        }

        return $url;
    }

    private function isAdmin(Request $request): bool
    {
        return DB::table('user_roles')->where('user_id', $request->user()->id)->value('role') === 'admin';
    }
}
