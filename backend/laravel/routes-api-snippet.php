<?php

// Add inside Route::middleware('auth:sanctum')->group(function () { ... });

Route::put('/bookings/admin/{id}', [ApiBookingController::class, 'updateByAdmin'])->name('api.bookings.admin.update');
Route::put('/localdata/bookings/{id}', [ApiLocalDataController::class, 'updateBooking'])->name('api.localdata.bookings.update');
