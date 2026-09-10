<?php

namespace App\Notifications;

use Illuminate\Notifications\Notification;
use Illuminate\Notifications\Messages\MailMessage;

class TempPasswordNotification extends Notification
{
    public function __construct(
        public string $tempPassword,
        public string $appName = 'OutsourceHR',
    ) {}

    public function via($notifiable): array { return ['mail']; }

    public function toMail($notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject("Akun {$this->appName} Anda Telah Dibuat")
            ->greeting("Halo, {$notifiable->name}!")
            ->line("Akun Anda di sistem **{$this->appName}** telah dibuat.")
            ->line("**Email:** {$notifiable->email}")
            ->line("**Password Sementara:** `{$this->tempPassword}`")
            ->action('Login Sekarang', config('app.url') . '/login')
            ->line('Segera ganti password setelah login pertama melalui menu profil.')
            ->salutation('Salam, Tim ' . $this->appName);
    }
}
