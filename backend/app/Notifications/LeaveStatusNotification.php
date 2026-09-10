<?php

namespace App\Notifications;

use Illuminate\Notifications\Notification;
use Illuminate\Notifications\Messages\MailMessage;
use App\Models\LeaveRequest;

class LeaveStatusNotification extends Notification
{
    public function __construct(public LeaveRequest $leave) {}

    public function via($notifiable): array { return ['mail']; }

    public function toMail($notifiable): MailMessage
    {
        $typeLabel   = ['not_present'=>'Tidak Masuk','late'=>'Terlambat','early_leave'=>'Pulang Cepat'][$this->leave->leave_type] ?? $this->leave->leave_type;
        $statusLabel = $this->leave->status === 'approved' ? '✅ Disetujui' : '❌ Ditolak';
        $date        = $this->leave->leave_date?->format('d/m/Y');

        $mail = (new MailMessage)
            ->subject("Izin {$typeLabel} {$statusLabel} — {$date}")
            ->greeting('Halo!')
            ->line("Pengajuan izin Anda telah diproses:")
            ->line("**Tipe:** {$typeLabel}")
            ->line("**Tanggal:** {$date}")
            ->line("**Alasan:** {$this->leave->reason}")
            ->line("**Status:** {$statusLabel}");

        if ($this->leave->notes) $mail->line("**Catatan Approver:** {$this->leave->notes}");

        return $mail->salutation('Sistem HR');
    }
}
