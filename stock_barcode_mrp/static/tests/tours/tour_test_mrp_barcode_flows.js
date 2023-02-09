/** @odoo-module */

import { registry } from "@web/core/registry";
import { stepUtils } from '@stock_barcode/../tests/tours/tour_step_utils';

registry.category("web_tour.tours").add('test_immediate_receipt_kit_from_scratch_with_tracked_compo', {test: true, steps: [
    {
        trigger: '.o_barcode_client_action',
        run: 'scan kit_lot',
    },
    {
        trigger: '.o_barcode_line:contains("Kit Lot") .o_edit',
    },
    {
        trigger: '.o_digipad_button.o_increase',
    },
    {
        trigger: '.o_save',
    },
    {
        trigger: '.o_barcode_line:contains("Kit Lot") .o_add_quantity'
    },
    {
        extra_trigger: '.o_barcode_line:contains("Kit Lot") .qty-done:contains("3")',
        trigger: '.btn.o_validate_page',
    },
    {
        trigger: '.o_notification.border-danger',
    },
    {
        extra_trigger: '.o_barcode_line:contains("Compo 01")',
        trigger: '.o_barcode_line:contains("Compo Lot")',
    },
    {
        trigger: '.o_selected:contains("Compo Lot")',
        run: 'scan super_lot',
    },
    ...stepUtils.validateBarcodeOperation('.o_line_lot_name:contains("super_lot")'),
]});

registry.category("web_tour.tours").add('test_planned_receipt_kit_from_scratch_with_tracked_compo', {test: true, steps: [
    {
        trigger: '.o_barcode_client_action',
        run: 'scan kit_lot',
    },
    stepUtils.confirmAddingUnreservedProduct(),
    {
        trigger: '.o_barcode_line:contains("Kit Lot") .o_edit',
    },
    {
        trigger: '.o_digipad_button.o_increase',
    },
    {
        trigger: '.o_save',
    },
    {
        trigger: '.o_barcode_line:contains("Kit Lot") .o_add_quantity'
    },
    {
        extra_trigger: '.o_barcode_line:contains("Kit Lot") .qty-done:contains("3")',
        trigger: '.btn.o_validate_page',
    },
    {
        trigger: '.o_notification.border-danger',
    },
    {
        extra_trigger: '.o_barcode_line:contains("Compo 01")',
        trigger: '.o_barcode_line:contains("Compo Lot")',
    },
    {
        trigger: '.o_selected:contains("Compo Lot")',
        run: 'scan super_lot',
    },
    ...stepUtils.validateBarcodeOperation('.o_line_lot_name:contains("super_lot")'),
]});
