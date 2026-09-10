#!/usr/bin/env python3
"""
Export Gaji sheet ke Excel mengikuti format referensi.
Dipanggil dari Laravel: python3 export_gaji.py <json_data_file> <output_file>
"""
import sys, json
import openpyxl
from openpyxl.styles import (
    Font, Alignment, PatternFill, Border, Side, numbers
)
from openpyxl.utils import get_column_letter

def fmt_num(v):
    return 0 if v is None else float(v)

def thin():
    s = Side(style='thin')
    return Border(left=s, right=s, top=s, bottom=s)

def medium():
    s = Side(style='medium')
    return Border(left=s, right=s, top=s, bottom=s)

IDR = '#,##0'
IDR0 = '#,##0.##'

HEADER_FILL   = PatternFill('solid', fgColor='1F3864')  # dark blue
DEPT_FILL     = PatternFill('solid', fgColor='D9E1F2')  # light blue
SUBTOTAL_FILL = PatternFill('solid', fgColor='BDD7EE')
TOTAL_FILL    = PatternFill('solid', fgColor='9DC3E6')
HEADER_FONT   = Font(bold=True, color='FFFFFF', name='Arial', size=9)
BOLD_FONT     = Font(bold=True, name='Arial', size=9)
NORMAL_FONT   = Font(name='Arial', size=9)
SMALL_FONT    = Font(name='Arial', size=8)

def export_gaji(data_file: str, output_file: str):
    with open(data_file) as f:
        data = json.load(f)

    payroll = data['payroll']
    slips   = data['slips']   # list of slip per karyawan

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = 'Gaji'

    # ── Column widths ───────────────────────────────────────────
    widths = [5, 8, 8, 28, 14, 13, 16, 8,
              5, 4, 4, 4, 4, 4, 5, 6,
              13, 14,
              8, 14, 8, 14,
              13, 14,
              11, 13, 11, 10, 11,
              15]
    for i, w in enumerate(widths, 1):
        ws.column_dimensions[get_column_letter(i)].width = w

    # ── Row 1: Company header ────────────────────────────────────
    ws.row_dimensions[1].height = 18
    ws['A1'] = payroll.get('company_name', '')
    ws['A1'].font = Font(bold=True, name='Arial', size=11)
    ws.merge_cells('A1:AD1')

    # ── Row 2: Division ─────────────────────────────────────────
    ws['A2'] = f"PERIODE: {payroll.get('date_from', '')} s/d {payroll.get('date_to', '')}"
    ws['A2'].font = Font(bold=True, name='Arial', size=10)
    ws.merge_cells('A2:AD2')

    # ── Row 4: Column headers ────────────────────────────────────
    headers1 = [
        'NO.', 'NIK', 'Dept.', 'NAMA', 'DEPT.', 'Tanggal Masuk', 'tgl. Gaji', 'Masa\nKerja',
        '(H)', '(M)', '(I)', '(X)', '(O)', '(S)', 'PA/\nTD', 'Absent',
        'Upah Per\nHari', 'Upah',
        'Lb Biasa\n(Jam)', 'Lb Biasa\n(Rp)', 'Lb Merah\n(Jam)', 'Lb Merah\n(Rp)',
        'Potongan', 'TOTAL UPAH',
        'BPJS TK', 'Outsorcing\nFEE', 'PPn', 'PPh 23', 'Premi\nHadir',
        'Grand Total',
    ]
    ws.row_dimensions[4].height = 28
    for col, h in enumerate(headers1, 1):
        cell = ws.cell(row=4, column=col, value=h)
        cell.font = HEADER_FONT
        cell.fill = HEADER_FILL
        cell.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)
        cell.border = thin()

    # ── Data rows ────────────────────────────────────────────────
    current_row = 5
    dept_groups = {}
    for slip in slips:
        dept = slip.get('department') or 'Lainnya'
        if dept not in dept_groups:
            dept_groups[dept] = []
        dept_groups[dept].append(slip)

    grand_totals = {k: 0 for k in ['hadir', 'absent', 'upah', 'lb_biasa_jam', 'lb_biasa_rp',
                                     'lb_merah_jam', 'lb_merah_rp', 'potongan', 'total_upah',
                                     'bpjs', 'fee', 'ppn', 'pph', 'premi', 'grand']}
    no = 1

    for dept, members in dept_groups.items():
        # Dept header
        ws.row_dimensions[current_row].height = 14
        dept_cell = ws.cell(row=current_row, column=1, value=dept.upper())
        dept_cell.font = BOLD_FONT
        dept_cell.fill = DEPT_FILL
        ws.merge_cells(f'A{current_row}:AD{current_row}')
        current_row += 1

        dept_totals = {k: 0 for k in grand_totals}

        for slip in members:
            ws.row_dimensions[current_row].height = 14
            b = slip.get('breakdown', {})

            hadir       = fmt_num(slip.get('total_work_days'))
            absent      = fmt_num(b.get('absent', 0))
            upah_hari   = fmt_num(b.get('daily_wage', 0))
            upah        = fmt_num(b.get('attendance_earning', slip.get('gross_salary', 0)))
            lb_biasa_j  = fmt_num(b.get('overtime_regular_hours', 0))
            lb_biasa_rp = fmt_num(b.get('overtime_regular', 0))
            lb_merah_j  = fmt_num(b.get('overtime_holiday_hours', 0))
            lb_merah_rp = fmt_num(b.get('overtime_holiday', 0))
            potongan    = fmt_num(b.get('absence_deduction', 0))
            total_upah  = fmt_num(slip.get('gross_salary', 0))
            bpjs        = fmt_num(b.get('bpjs_tk', 0))
            fee         = fmt_num(b.get('outsourcing_fee', 0))
            ppn         = fmt_num(b.get('ppn', 0))
            pph         = fmt_num(b.get('pph23', 0))
            premi       = fmt_num(b.get('premi_hadir', 0))
            grand       = fmt_num(slip.get('net_salary', 0))

            row_data = [
                no, slip.get('nik', ''), '', slip.get('employee_name', ''),
                dept, slip.get('join_date', ''), payroll.get('period_label', ''), '',
                hadir, None, None, None, None, None, None, absent,
                upah_hari, upah,
                lb_biasa_j, lb_biasa_rp, lb_merah_j, lb_merah_rp,
                potongan if potongan < 0 else -potongan,
                total_upah, bpjs, fee, ppn, pph, premi, grand,
            ]

            for col, val in enumerate(row_data, 1):
                cell = ws.cell(row=current_row, column=col, value=val)
                cell.font = NORMAL_FONT
                cell.border = thin()
                # Number formatting
                if col in [17, 18, 20, 22, 23, 24, 25, 26, 27, 28, 29, 30]:
                    cell.number_format = IDR
                elif col in [19, 21]:
                    cell.number_format = IDR0
                elif col in [9, 10, 11, 12, 13, 14, 15, 16]:
                    cell.alignment = Alignment(horizontal='center')

            # Accumulate dept totals
            dept_totals['hadir']       += hadir
            dept_totals['absent']      += absent
            dept_totals['upah']        += upah
            dept_totals['lb_biasa_jam']+= lb_biasa_j
            dept_totals['lb_biasa_rp'] += lb_biasa_rp
            dept_totals['lb_merah_jam']+= lb_merah_j
            dept_totals['lb_merah_rp'] += lb_merah_rp
            dept_totals['potongan']    += potongan
            dept_totals['total_upah']  += total_upah
            dept_totals['bpjs']        += bpjs
            dept_totals['fee']         += fee
            dept_totals['ppn']         += ppn
            dept_totals['pph']         += pph
            dept_totals['premi']       += premi
            dept_totals['grand']       += grand

            no += 1
            current_row += 1

        # Subtotal row per dept
        ws.row_dimensions[current_row].height = 14
        st_data = [
            '', '', '', f'Subtotal {dept}', '', '', '', '',
            dept_totals['hadir'], None, None, None, None, None, None, dept_totals['absent'],
            None, dept_totals['upah'],
            dept_totals['lb_biasa_jam'], dept_totals['lb_biasa_rp'],
            dept_totals['lb_merah_jam'], dept_totals['lb_merah_rp'],
            -abs(dept_totals['potongan']), dept_totals['total_upah'],
            dept_totals['bpjs'], dept_totals['fee'], dept_totals['ppn'],
            dept_totals['pph'], dept_totals['premi'], dept_totals['grand'],
        ]
        for col, val in enumerate(st_data, 1):
            cell = ws.cell(row=current_row, column=col, value=val)
            cell.font = BOLD_FONT
            cell.fill = SUBTOTAL_FILL
            cell.border = thin()
            if col in [17, 18, 20, 22, 23, 24, 25, 26, 27, 28, 29, 30]:
                cell.number_format = IDR

        # Accumulate grand totals
        for k in dept_totals:
            grand_totals[k] += dept_totals[k]

        current_row += 1

    # ── Grand Total row ──────────────────────────────────────────
    ws.row_dimensions[current_row].height = 16
    gt_data = [
        '', '', '', 'GRAND TOTAL', '', '', '', '',
        grand_totals['hadir'], '', '', '', '', '', '', grand_totals['absent'],
        None, grand_totals['upah'],
        grand_totals['lb_biasa_jam'], grand_totals['lb_biasa_rp'],
        grand_totals['lb_merah_jam'], grand_totals['lb_merah_rp'],
        -abs(grand_totals['potongan']), grand_totals['total_upah'],
        grand_totals['bpjs'], grand_totals['fee'], grand_totals['ppn'],
        grand_totals['pph'], grand_totals['premi'], grand_totals['grand'],
    ]
    for col, val in enumerate(gt_data, 1):
        cell = ws.cell(row=current_row, column=col, value=val)
        cell.font = Font(bold=True, name='Arial', size=9, color='FFFFFF')
        cell.fill = TOTAL_FILL
        cell.border = medium()
        if col in [17, 18, 20, 22, 23, 24, 25, 26, 27, 28, 29, 30]:
            cell.number_format = IDR

    # ── Freeze panes & print settings ───────────────────────────
    ws.freeze_panes = 'A5'
    ws.print_title_rows = '1:4'
    ws.page_setup.orientation = 'landscape'
    ws.page_setup.fitToPage = True
    ws.page_setup.fitToWidth = 1

    # ── Row 3: period range label ────────────────────────────────
    ws['A3'] = f"  Periode Gaji: {payroll.get('date_from', '')} s/d {payroll.get('date_to', '')}  |  Hari Kerja Efektif: {payroll.get('effective_work_days', '-')} hari"
    ws['A3'].font = SMALL_FONT
    ws.merge_cells('A3:AD3')

    wb.save(output_file)
    print(f"OK: {output_file}")

if __name__ == '__main__':
    if len(sys.argv) < 3:
        print("Usage: export_gaji.py <data.json> <output.xlsx>")
        sys.exit(1)
    export_gaji(sys.argv[1], sys.argv[2])
