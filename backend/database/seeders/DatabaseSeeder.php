<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        // User awal untuk login pertama kali. GANTI PASSWORD setelah login pertama.
        User::updateOrCreate(
            ['email' => 'admin@outsourcehr.local'],
            [
                'name' => 'Super Admin',
                'password' => Hash::make('password'),
                'role' => 'coordinator',
                'status' => 'active',
            ]
        );

        $this->command->info('User awal dibuat: admin@outsourcehr.local / password');
        $this->command->warn('Segera ganti password setelah login pertama!');

        // Jalankan import karyawan dari file Fingerspot jika ada:
        // php artisan employees:import-fingerspot imports/datakaryawan.xlsx --device={id}
    }
}
