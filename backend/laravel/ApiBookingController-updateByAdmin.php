<?php

/**
 * Add to App\Http\Controllers\Api\ApiBookingController
 *
 * use App\Models\Booking;
 * use Illuminate\Http\Request;
 */

public function updateByAdmin(Request $request, int $id)
{
    $booking = Booking::findOrFail($id);
    $user = $request->user();

    if ($user && $user->role === 'branch_manager' && (int) $booking->branch_id !== (int) $user->branch_id) {
        return response()->json(['message' => 'Unauthorized.'], 403);
    }

    $validated = $request->validate([
        'name' => 'sometimes|string|max:255',
        'phone' => 'sometimes|string|max:50',
        'email' => 'nullable|string|max:255',
        'date' => 'sometimes|date',
        'time' => 'nullable|string|max:20',
        'start_time' => 'sometimes|string|max:20',
        'end_time' => 'sometimes|string|max:20',
        'duration' => 'nullable|integer|min:1',
        'services' => 'nullable|string',
        'sub_category' => 'nullable|string|max:255',
        'price' => 'nullable|numeric|min:0',
        'total_price' => 'nullable|numeric|min:0',
        'status' => 'sometimes|string|max:50',
        'message' => 'nullable|string',
        'notes' => 'nullable|string',
        'branch_id' => 'sometimes|integer',
    ]);

    $services = trim((string) ($validated['services'] ?? $booking->services ?? ''));
    $subCategory = trim((string) ($validated['sub_category'] ?? ''));

    if ($services === '' && $subCategory !== '') {
        $services = $subCategory;
    } elseif ($services !== '' && $subCategory === '') {
        $parts = array_map('trim', explode(',', $services));
        $subCategory = $parts[0] ?? $services;
    }

    $price = $validated['price'] ?? $validated['total_price'] ?? $booking->price;

    $payload = array_filter([
        'name' => $validated['name'] ?? null,
        'phone' => $validated['phone'] ?? null,
        'email' => array_key_exists('email', $validated) ? $validated['email'] : null,
        'date' => $validated['date'] ?? null,
        'time' => $validated['time'] ?? ($validated['start_time'] ?? null),
        'start_time' => $validated['start_time'] ?? null,
        'end_time' => $validated['end_time'] ?? null,
        'duration' => $validated['duration'] ?? null,
        'services' => $services !== '' ? $services : null,
        'sub_category' => $subCategory !== '' ? $subCategory : null,
        'price' => $price,
        'status' => $validated['status'] ?? null,
        'branch_id' => $validated['branch_id'] ?? null,
    ], static fn ($value) => $value !== null);

    if ($request->exists('message') || $request->exists('notes')) {
        $payload['message'] = trim((string) $request->input('message', $request->input('notes', '')));
    }

    $booking->update($payload);

    return response()->json([
        'success' => true,
        'message' => 'Booking updated successfully.',
        'data' => $booking->fresh(),
    ]);
}
