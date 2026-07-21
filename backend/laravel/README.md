# Laravel booking update endpoints

The desktop app updates bookings via `PUT`. Add the routes and controller methods below to your Laravel API project (same repo as `ApiLocalDataController` / `ApiBookingController`).

## 1. Routes

Inside the `Route::middleware('auth:sanctum')->group(function () { ... });` block in `routes/api.php`, add:

```php
Route::put('/bookings/admin/{id}', [ApiBookingController::class, 'updateByAdmin'])->name('api.bookings.admin.update');
Route::put('/localdata/bookings/{id}', [ApiLocalDataController::class, 'updateBooking'])->name('api.localdata.bookings.update');
```

Place them near the existing booking routes (`/bookings/admin`, `/localdata/booking-view`, etc.).

## 2. Controller methods

Copy the methods from:

- `ApiBookingController-updateByAdmin.php` → `App\Http\Controllers\Api\ApiBookingController`
- `ApiLocalDataController-updateBooking.php` → `App\Http\Controllers\Api\ApiLocalDataController`

Both controllers use the same update logic inline. You only need **one** route if you prefer; the app tries endpoints in this order:

1. `PUT /api/bookings/admin/{id}`
2. `PUT /api/bookings/{id}` (optional, not registered by default)
3. `PUT /api/localdata/bookings/{id}`

## 3. Model

Ensure your `bookings` table / `Booking` model includes at least:

`name`, `phone`, `email`, `date`, `time`, `start_time`, `end_time`, `duration`, `services`, `sub_category`, `price`, `message`, `status`, `branch_id`

Adjust `$fillable` on `App\Models\Booking` if mass-assignment blocks updates.

## 4. Deploy

After deploying the API changes, retry **Edit Booking** in the desktop app — no frontend rebuild required if you already have the latest `bookingsApi.ts`.
