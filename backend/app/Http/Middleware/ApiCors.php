<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class ApiCors
{
    public function handle(Request $request, Closure $next): Response
    {
        $isApiRoute = true;

        if ($isApiRoute && $request->getMethod() === 'OPTIONS') {
            return response('', 204, $this->headers($request));
        }

        $response = $next($request);

        if ($isApiRoute) {
            foreach ($this->headers($request) as $key => $value) {
                $response->headers->set($key, $value);
            }
        }

        return $response;
    }

    private function headers(Request $request): array
    {
        $origin = $request->headers->get('Origin');
        $allowedOrigin = $this->allowedOrigin($origin);

        return [
            'Access-Control-Allow-Origin' => $allowedOrigin,
            'Access-Control-Allow-Credentials' => 'true',
            'Access-Control-Allow-Methods' => 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
            'Access-Control-Allow-Headers' => 'Content-Type, Authorization, X-Requested-With',
            'Vary' => 'Origin',
        ];
    }

    private function allowedOrigin(?string $origin): string
    {
        $origin = is_string($origin) ? trim($origin) : '';
        $allowedOrigins = $this->allowedOrigins();

        if ($origin !== '' && in_array($origin, $allowedOrigins, true)) {
            return $origin;
        }

        if (app()->environment('local')) {
            return $origin !== '' ? $origin : '*';
        }

        return $allowedOrigins[0] ?? '*';
    }

    /**
     * FRONTEND_URL is the primary SPA origin.
     * ALLOWED_ORIGINS can be a comma-separated list for preview/staging domains.
     *
     * @return array<int, string>
     */
    private function allowedOrigins(): array
    {
        $origins = array_filter([
            env('FRONTEND_URL'),
            ...explode(',', (string) env('ALLOWED_ORIGINS', '')),
        ]);

        return array_values(array_unique(array_map(
            static fn ($value) => rtrim(trim((string) $value), '/'),
            $origins
        )));
    }
}
