odoo.define('test_barcode_flows.tour', function(require) {
'use strict';

var helper = require('stock_barcode.tourHelper');
var tour = require('web_tour.tour');

tour.register('test_internal_picking_from_scratch_1', {test: true}, [
    {
        trigger: '.o_barcode_client_action',
        run: function() {
            helper.assertPageSummary('From WH/Stock To WH/Stock');
            helper.assertPreviousVisible(true);
            helper.assertPreviousEnabled(false);
            helper.assertNextVisible(false);
            helper.assertNextEnabled(false);
            helper.assertNextIsHighlighted(false);
            helper.assertLinesCount(0);
            helper.assertScanMessage('scan_src');
            helper.assertLocationHighlight(false);
            helper.assertDestinationLocationHighlight(false);
            helper.assertPager('1/1');
            helper.assertValidateVisible(true);
            helper.assertValidateIsHighlighted(false);
            helper.assertValidateEnabled(false);
        }
    },

    //Check show information.
    {
        trigger: '.o_show_information',
    },

    {
        trigger: '.o_form_label:contains("Status")',
    },

    {
        trigger: '.o_close',
    },

    {
        trigger: '.o_barcode_summary_location_dest:contains("Stock")',
    },

    /* We'll create a movement for 2 product1 from shelf1 to shelf2. The flow for this to happen is
     * to scan shelf1, product1, shelf2.
     */
    {
        trigger: '.o_barcode_client_action',
        run: 'scan LOC-01-01-00'
    },

    {
        trigger: '.o_barcode_client_action',
        run: function () {
            helper.assertPageSummary('From WH/Stock/Shelf 1 To WH/Stock');
            helper.assertPreviousVisible(true);
            helper.assertPreviousEnabled(false);
            helper.assertNextVisible(false);
            helper.assertNextEnabled(false);
            helper.assertNextIsHighlighted(false);
            helper.assertLinesCount(0);
            helper.assertScanMessage('scan_products');
            helper.assertLocationHighlight(true);
            helper.assertDestinationLocationHighlight(false);
            helper.assertPager('1/1');
            helper.assertValidateVisible(true);
            helper.assertValidateIsHighlighted(false);
            helper.assertValidateEnabled(false);
        }
    },

    {
        trigger: '.o_barcode_client_action',
        run: 'scan product1'
    },

    {
        trigger: '.o_barcode_client_action',
        run: function() {
            helper.assertPageSummary('From WH/Stock/Shelf 1 To WH/Stock');
            helper.assertPreviousVisible(true);
            helper.assertPreviousEnabled(false);
            helper.assertNextVisible(false);
            helper.assertNextEnabled(false);
            helper.assertNextIsHighlighted(false);
            helper.assertLinesCount(1);
            helper.assertScanMessage('scan_more_dest');
            helper.assertLocationHighlight(true);
            helper.assertDestinationLocationHighlight(false);
            helper.assertPager('1/1');
            helper.assertValidateVisible(true);
            helper.assertValidateIsHighlighted(true);
            helper.assertValidateEnabled(true);
            var $line = helper.getLine({barcode: 'product1'});
            helper.assertLineIsHighlighted($line, true);
        }
    },

    {
        trigger: '.o_barcode_client_action',
        run: 'scan product1'
    },

    {
        trigger: '.o_barcode_client_action',
        run: function() {
            helper.assertPageSummary('From WH/Stock/Shelf 1 To WH/Stock');
            helper.assertPreviousVisible(true);
            helper.assertPreviousEnabled(false);
            helper.assertNextVisible(false);
            helper.assertNextEnabled(false);
            helper.assertNextIsHighlighted(false);
            helper.assertLinesCount(1);
            helper.assertScanMessage('scan_more_dest');
            helper.assertLocationHighlight(true);
            helper.assertDestinationLocationHighlight(false);
            helper.assertPager('1/1');
            helper.assertValidateVisible(true);
            helper.assertValidateIsHighlighted(true);
            helper.assertValidateEnabled(true);
            var $line = helper.getLine({barcode: 'product1'});
            helper.assertLineIsHighlighted($line, true);
            helper.assertLineQty($line, "2");
        }
    },

    {
        trigger: '.o_barcode_client_action',
        run: 'scan LOC-01-02-00'
    },

    {
        trigger: '.o_current_dest_location:contains("WH/Stock/Shelf 2")',
        run: function() {
            helper.assertPageSummary('From WH/Stock/Shelf 1 To WH/Stock/Shelf 2');
            helper.assertPreviousVisible(true);
            helper.assertPreviousEnabled(false);
            helper.assertNextVisible(false);
            helper.assertNextEnabled(false);
            helper.assertNextIsHighlighted(false);
            helper.assertLinesCount(1);
            helper.assertScanMessage('scan_src');
            helper.assertLocationHighlight(true);
            helper.assertDestinationLocationHighlight(true);
            helper.assertPager('1/1');
            helper.assertValidateVisible(true);
            helper.assertValidateIsHighlighted(true);
            helper.assertValidateEnabled(true);
            var $line = helper.getLine({barcode: 'product1'});
            helper.assertLineIsHighlighted($line, false);
        }
    },

    /* We'll create a movement for product2 from shelf1 to shelf3. The flow for this to happen is
     * to scan shelf1, product2, shelf3.
     */
    {
        trigger: '.o_barcode_client_action',
        run: 'scan LOC-01-01-00'
    },

    {
        trigger: '.o_barcode_client_action',
        run: function() {
            helper.assertPageSummary('From WH/Stock/Shelf 1 To WH/Stock/Shelf 2');
            helper.assertPreviousVisible(true);
            helper.assertPreviousEnabled(false);
            helper.assertNextVisible(false);
            helper.assertNextEnabled(false);
            helper.assertNextIsHighlighted(false);
            helper.assertLinesCount(1);
            helper.assertScanMessage('scan_products');
            helper.assertLocationHighlight(true);
            helper.assertDestinationLocationHighlight(false);
            helper.assertPager('1/1');
            helper.assertValidateVisible(true);
            helper.assertValidateIsHighlighted(true);
            helper.assertValidateEnabled(true);
            var $line = helper.getLine({barcode: 'product1'});
            helper.assertLineIsHighlighted($line, false);
        }
    },

    {
        trigger: '.o_barcode_client_action',
        run: 'scan product2'
    },

    {
        trigger: '.o_barcode_client_action',
        run: function() {
            helper.assertPageSummary('From WH/Stock/Shelf 1 To WH/Stock/Shelf 2');
            helper.assertPreviousVisible(true);
            helper.assertPreviousEnabled(false);
            helper.assertNextVisible(false);
            helper.assertNextEnabled(false);
            helper.assertNextIsHighlighted(false);
            helper.assertLinesCount(2);
            helper.assertScanMessage('scan_more_dest');
            helper.assertLocationHighlight(true);
            helper.assertDestinationLocationHighlight(false);
            helper.assertPager('1/1');
            helper.assertValidateVisible(true);
            helper.assertValidateIsHighlighted(true);
            helper.assertValidateEnabled(true);
            var $lineproduct1 = helper.getLine({barcode: 'product1'});
            helper.assertLineIsHighlighted($lineproduct1, false);
            var $lineproduct2 = helper.getLine({barcode: 'product2'});
            helper.assertLineIsHighlighted($lineproduct2, true);
        }
    },

    {
        trigger: '.o_barcode_client_action',
        run: 'scan shelf3'
    },

    {
        trigger: '.o_current_dest_location:contains("WH/Stock/Shelf 3")',
        run: function() {
            helper.assertPageSummary('From WH/Stock/Shelf 1 To WH/Stock/Shelf 3');
            helper.assertPreviousVisible(true);
            helper.assertPreviousEnabled(true);
            helper.assertNextVisible(false);
            helper.assertNextEnabled(false);
            helper.assertNextIsHighlighted(false);
            helper.assertLinesCount(1);
            helper.assertScanMessage('scan_src');
            helper.assertLocationHighlight(true);
            helper.assertDestinationLocationHighlight(true);
            helper.assertPager('2/2');
            helper.assertValidateVisible(true);
            helper.assertValidateIsHighlighted(true);
            helper.assertValidateEnabled(true);
            var $lineproduct2 = helper.getLine({barcode: 'product2'});
            helper.assertLineIsHighlighted($lineproduct2, false);
        }
    },

    /* We'll now move a product2 from shelf1 to shelf2. As we're still on the shel1 to shelf3 page
     * where a product2 was processed, we make sure the newly scanned product will be added in a
     * new move line that will change page at the time we scan shelf2.
     */
    {
        trigger: '.o_barcode_client_action',
        run: 'scan LOC-01-01-00'
    },

    {
        trigger: '.o_barcode_client_action',
        run: function() {
            helper.assertPageSummary('From WH/Stock/Shelf 1 To WH/Stock/Shelf 3');
            helper.assertPreviousVisible(true);
            helper.assertPreviousEnabled(true);
            helper.assertNextVisible(false);
            helper.assertNextEnabled(false);
            helper.assertNextIsHighlighted(false);
            helper.assertLinesCount(1);
            helper.assertScanMessage('scan_products');
            helper.assertLocationHighlight(true);
            helper.assertDestinationLocationHighlight(false);
            helper.assertPager('2/2');
            helper.assertValidateVisible(true);
            helper.assertValidateIsHighlighted(true);
            helper.assertValidateEnabled(true);
            var $lineproduct2 = helper.getLine({barcode: 'product2'});
            helper.assertLineIsHighlighted($lineproduct2, false);
        }
    },

    {
        trigger: '.o_barcode_client_action',
        run: 'scan product2'
    },

    {
        trigger: '.o_barcode_client_action',
        run: function() {
            helper.assertPageSummary('From WH/Stock/Shelf 1 To WH/Stock/Shelf 3');
            helper.assertPreviousVisible(true);
            helper.assertPreviousEnabled(true);
            helper.assertNextVisible(false);
            helper.assertNextEnabled(false);
            helper.assertNextIsHighlighted(false);
            helper.assertLinesCount(2);
            helper.assertScanMessage('scan_more_dest');
            helper.assertLocationHighlight(true);
            helper.assertDestinationLocationHighlight(false);
            helper.assertPager('2/2');
            helper.assertValidateVisible(true);
            helper.assertValidateIsHighlighted(true);
            helper.assertValidateEnabled(true);
            var $lines = helper.getLine({barcode: 'product2'});
            if ($lines.filter('.o_highlight').length !== 1) {
                helper.fail('one of the two lins of product2 should be highlighted.');
            }
        }
    },

    {
        trigger: '.o_barcode_client_action',
        run: 'scan LOC-01-02-00'
    },

    {
        trigger: '.o_current_dest_location:contains("WH/Stock/Shelf 2")',
        run: function() {
            helper.assertPageSummary('From WH/Stock/Shelf 1 To WH/Stock/Shelf 2');
            helper.assertPreviousVisible(true);
            helper.assertPreviousEnabled(true);
            helper.assertNextVisible(true);
            helper.assertNextEnabled(true);
            helper.assertNextIsHighlighted(true);
            helper.assertLinesCount(2);
            helper.assertScanMessage('scan_src');
            helper.assertLocationHighlight(true);
            helper.assertDestinationLocationHighlight(true);
            helper.assertPager('1/2');
            helper.assertValidateVisible(false);
            helper.assertValidateIsHighlighted(false);
            helper.assertValidateEnabled(false);
            var $line = helper.getLine({barcode: 'product1'});
            helper.assertLineIsHighlighted($line, false);
        }
    },
]);

tour.register('test_internal_picking_from_scratch_2', {test: true}, [
    /* Move 2 product1 from WH/Stock/Shelf 1 to WH/Stock/Shelf 2.
     */
    {
        trigger: '.o_add_line',
    },

    {
        extra_trigger: '.o_field_widget[name="product_id"]',
        trigger: "input.o_field_widget[name=qty_done]",
        run: 'text 2',
    },

    {
        trigger: ".o_field_widget[name=product_id] input",
        run: 'text product1',
    },

    {
        trigger: ".ui-menu-item > a:contains('product1')",
    },

    {
        trigger: ".o_field_widget[name=location_id] input",
        run: 'text Shelf 1',
    },

    {
        trigger: ".ui-menu-item > a:contains('Shelf 1')",
    },

    {
        trigger: ".o_field_widget[name=location_dest_id] input",
        run: 'text Shelf 2',
    },

    {
        trigger: ".ui-menu-item > a:contains('Shelf 2')",
    },

    {
        trigger: '.o_save',
    },

    {
        trigger: '.o_current_dest_location:contains("Shelf 2")',
        run: function() {
            helper.assertLinesCount(1);
        },
    },

    /* Move 1 product2 from WH/Stock/Shelf 1 to WH/Stock/Shelf 3.
     */
    {
        trigger: '.o_add_line',
    },

    {
        extra_trigger: '.o_field_widget[name="product_id"]',
        trigger: ".o_field_widget[name=product_id] input",
        run: 'text product2',
    },

    {
        trigger: ".ui-menu-item > a:contains('product2')",
    },

    {
        trigger: ".o_field_widget[name=location_id] input",
        run: 'text Shelf 1',
    },

    {
        trigger: ".ui-menu-item > a:contains('Shelf 1')",
    },

    {
        trigger: ".o_field_widget[name=location_dest_id] input",
        run: 'text WH/Stock/Shelf 3',
    },

    {
        trigger: ".ui-menu-item > a:contains('Shelf 3')",
    },

    {
        trigger: '.o_save',
    },

    {
        trigger: '.o_current_dest_location:contains("Shelf 3")',
        run: function() {
            helper.assertLinesCount(1);
        },
    },
    /*
    * Go back to the previous page and edit the first line. We check the transaction
    * doesn't crash and the form view is correctly filled.
    */

    {
        trigger: '.o_previous_page',
    },

    {
        trigger: '.o_barcode_summary_location_dest:contains("Shelf 2")',
        run: function() {
            helper.assertPager('1/2');
            helper.assertPageSummary('From WH/Stock/Shelf 1 To WH/Stock/Shelf 2');
            helper.assertLinesCount(1);
            helper.assertPreviousVisible(true);
            helper.assertPreviousEnabled(true);
            helper.assertNextVisible(true);
            helper.assertNextEnabled(true);
            helper.assertNextIsHighlighted(true);
            var $line = helper.getLine({barcode: 'product1'});
            helper.assertLineIsHighlighted($line, false);
        },
    },

    {
        trigger: '.o_edit',
    },

    {
        trigger: '.o_field_widget[name="product_id"]',
        run: function() {
            helper.assertFormLocationSrc("WH/Stock/Shelf 1");
            helper.assertFormLocationDest("WH/Stock/Shelf 2");
            helper.assertFormQuantity("2");
        },
    },

    {
        trigger: '.o_save',
    },

    /* Move 1 product2 from WH/Stock/Shelf 1 to WH/Stock/Shelf 2.
     */
    {
        trigger: '.o_add_line',
    },

    {
        extra_trigger: '.o_field_widget[name="product_id"]',
        trigger: ".o_field_widget[name=product_id] input",
        run: 'text product2',
    },

    {
        trigger: ".ui-menu-item > a:contains('product2')",
    },

    {
        trigger: ".o_field_widget[name=location_id] input",
        run: 'text Shelf 1',
    },

    {
        trigger: ".ui-menu-item > a:contains('Shelf 1')",
    },

    {
        trigger: ".o_field_widget[name=location_dest_id] input",
        run: 'text Shelf 2',
    },

    {
        trigger: ".ui-menu-item > a:contains('Shelf 2')",
    },

    {
        trigger: '.o_save',
    },

    {
        trigger: '.o_barcode_summary_location_dest:contains("Shelf 2")',
        run: function() {
            helper.assertLinesCount(2);
        },
    },
    /* on this page, scan a product and then edit it through with the form view without explicitly saving it first.
    */
    {
        trigger: '.o_next_page',
    },

    {
        trigger: '.o_barcode_client_action',
        run: 'scan LOC-01-01-00'
    },

    {
        trigger: '.o_barcode_client_action',
        run: 'scan product1'
    },

    {
        trigger: '.o_edit',
    },

    {
        trigger: '.o_field_widget[name="product_id"]',
    },

    {
        trigger :'.o_save',
    },

    {
        trigger: '.o_validate_page',
    }
]);

tour.register('test_internal_picking_reserved_1', {test: true}, [
    {
        trigger: '.o_barcode_client_action',
        run: function() {
            helper.assertPageSummary('From WH/Stock/Shelf 1 To WH/Stock/Shelf 2');
            helper.assertPreviousVisible(true);
            helper.assertPreviousEnabled(true);
            helper.assertNextVisible(true);
            helper.assertNextEnabled(true);
            helper.assertNextIsHighlighted(false);
            helper.assertLinesCount(2);
            helper.assertScanMessage('scan_src');
            helper.assertLocationHighlight(false);
            helper.assertDestinationLocationHighlight(false);
            helper.assertPager('1/2');
            helper.assertValidateVisible(false);
            helper.assertValidateIsHighlighted(false);
            helper.assertValidateEnabled(false);
            var $lineproduct1 = helper.getLine({barcode: 'product1'});
            helper.assertLineIsHighlighted($lineproduct1, false);
            var $lineproduct2 = helper.getLine({barcode: 'product2'});
            helper.assertLineIsHighlighted($lineproduct2, false);
        }
    },

    /* We first move a product1 fro shef3 to shelf2.
     */
    {
        trigger: '.o_barcode_client_action',
        run: 'scan shelf3'
    },

    {
        trigger: '.o_barcode_client_action',
        run: function() {
            helper.assertPageSummary('From WH/Stock/Shelf 3 To WH/Stock');
            helper.assertPreviousVisible(true);
            helper.assertPreviousEnabled(true);
            helper.assertNextVisible(false);
            helper.assertNextEnabled(false);
            helper.assertNextIsHighlighted(false);
            helper.assertLinesCount(0);
            helper.assertScanMessage('scan_products');
            helper.assertLocationHighlight(true);
            helper.assertDestinationLocationHighlight(false);
            helper.assertPager('3/3');
            helper.assertValidateVisible(true);
            helper.assertValidateIsHighlighted(false);
            helper.assertValidateEnabled(false);
        }
    },

    {
        trigger: '.o_barcode_client_action',
        run: 'scan product1'
    },

    {
        trigger: '.o_barcode_client_action',
        run: function() {
            helper.assertPageSummary('From WH/Stock/Shelf 3 To WH/Stock');
            helper.assertPreviousVisible(true);
            helper.assertPreviousEnabled(true);
            helper.assertNextVisible(false);
            helper.assertNextEnabled(false);
            helper.assertNextIsHighlighted(false);
            helper.assertLinesCount(1);
            helper.assertScanMessage('scan_more_dest');
            helper.assertLocationHighlight(true);
            helper.assertDestinationLocationHighlight(false);
            helper.assertPager('3/3');
            helper.assertValidateVisible(true);
            helper.assertValidateIsHighlighted(true);
            helper.assertValidateEnabled(true);
            var $lineproduct1 = helper.getLine({barcode: 'product1'});
            helper.assertLineIsHighlighted($lineproduct1, true);
        }
    },

    {
        trigger: '.o_barcode_client_action',
        run: 'scan LOC-01-02-00'
    },

    {
        trigger: '.o_current_dest_location:contains("WH/Stock/Shelf 2")',
        run: function() {
            helper.assertPageSummary('From WH/Stock/Shelf 3 To WH/Stock/Shelf 2');
            helper.assertPreviousVisible(true);
            helper.assertPreviousEnabled(true);
            helper.assertNextVisible(false);
            helper.assertNextEnabled(false);
            helper.assertNextIsHighlighted(false);
            helper.assertLinesCount(1);
            helper.assertScanMessage('scan_src');
            helper.assertLocationHighlight(true);
            helper.assertDestinationLocationHighlight(true);
            helper.assertPager('3/3');
            helper.assertValidateVisible(true);
            helper.assertValidateIsHighlighted(true);
            helper.assertValidateEnabled(true);
            var $lineproduct1 = helper.getLine({barcode: 'product1'});
            helper.assertLineIsHighlighted($lineproduct1, false);
        }
    },

    /* Hit two times previous to get to the shelf1 to fhel2 page.
     */
    {
        'trigger': '.o_previous_page',
    },

    {
        'trigger': '.o_previous_page',
    },

    {
        trigger: '.o_barcode_client_action',
        run: function() {
            helper.assertPageSummary('From WH/Stock/Shelf 1 To WH/Stock/Shelf 2');
            helper.assertPreviousVisible(true);
            helper.assertPreviousEnabled(true);
            helper.assertNextVisible(true);
            helper.assertNextEnabled(true);
            helper.assertNextIsHighlighted(false);
            helper.assertLinesCount(2);
            helper.assertScanMessage('scan_src');
            helper.assertLocationHighlight(false);
            helper.assertDestinationLocationHighlight(false);
            helper.assertPager('1/3');
            helper.assertValidateVisible(false);
            helper.assertValidateIsHighlighted(false);
            helper.assertValidateVisible(false);
            var $lineproduct1 = helper.getLine({barcode: 'product1'});
            helper.assertLineIsHighlighted($lineproduct1, false);
            var $lineproduct2 = helper.getLine({barcode: 'product2'});
            helper.assertLineIsHighlighted($lineproduct2, false);
        }
    },

    /* Process the reservation.
     */
    {
        trigger: '.o_barcode_client_action',
        run: 'scan LOC-01-01-00'
    },

    {
        trigger: '.o_barcode_client_action',
        run: function() {
            helper.assertPageSummary('From WH/Stock/Shelf 1 To WH/Stock/Shelf 2');
            helper.assertPreviousVisible(true);
            helper.assertPreviousEnabled(true);
            helper.assertNextVisible(true);
            helper.assertNextEnabled(true);
            helper.assertNextIsHighlighted(false);
            helper.assertLinesCount(2);
            helper.assertScanMessage('scan_products');
            helper.assertLocationHighlight(true);
            helper.assertDestinationLocationHighlight(false);
            helper.assertPager('1/3');
            helper.assertValidateVisible(false);
            helper.assertValidateIsHighlighted(false);
            helper.assertValidateEnabled(false);
            var $lineproduct1 = helper.getLine({barcode: 'product1'});
            helper.assertLineIsHighlighted($lineproduct1, false);
            var $lineproduct2 = helper.getLine({barcode: 'product2'});
            helper.assertLineIsHighlighted($lineproduct2, false);
        }
    },

    {
        trigger: '.o_barcode_client_action',
        run: 'scan product1'
    },

    {
        trigger: '.o_barcode_client_action',
        run: function() {
            helper.assertPageSummary('From WH/Stock/Shelf 1 To WH/Stock/Shelf 2');
            helper.assertPreviousVisible(true);
            helper.assertPreviousEnabled(true);
            helper.assertNextVisible(true);
            helper.assertNextEnabled(true);
            helper.assertNextIsHighlighted(false);
            helper.assertLinesCount(2);
            helper.assertScanMessage('scan_more_dest');
            helper.assertLocationHighlight(true);
            helper.assertDestinationLocationHighlight(false);
            helper.assertPager('1/3');
            helper.assertValidateVisible(false);
            helper.assertValidateIsHighlighted(false);
            helper.assertValidateEnabled(false);
            var $lineproduct1 = helper.getLine({barcode: 'product1'});
            helper.assertLineIsHighlighted($lineproduct1, true);
            var $lineproduct2 = helper.getLine({barcode: 'product2'});
            helper.assertLineIsHighlighted($lineproduct2, false);
        }
    },

    {
        trigger: '.o_barcode_client_action',
        run: 'scan product2'
    },

    {
        trigger: '.o_barcode_client_action',
        run: function() {
            helper.assertPageSummary('From WH/Stock/Shelf 1 To WH/Stock/Shelf 2');
            helper.assertPreviousVisible(true);
            helper.assertPreviousEnabled(true);
            helper.assertNextVisible(true);
            helper.assertNextEnabled(true);
            helper.assertNextIsHighlighted(true);
            helper.assertLinesCount(2);
            helper.assertScanMessage('scan_more_dest');
            helper.assertLocationHighlight(true);
            helper.assertDestinationLocationHighlight(false);
            helper.assertPager('1/3');
            helper.assertValidateVisible(false);
            helper.assertValidateIsHighlighted(false);
            helper.assertValidateEnabled(false);
            var $lineproduct1 = helper.getLine({barcode: 'product1'});
            helper.assertLineIsHighlighted($lineproduct1, false);
            var $lineproduct2 = helper.getLine({barcode: 'product2'});
            helper.assertLineIsHighlighted($lineproduct2, true);
        }
    },

    {
        trigger: '.o_barcode_client_action',
        run: 'scan LOC-01-02-00'
    },

    {
        trigger: '.o_barcode_client_action',
        run: function() {
            helper.assertPageSummary('From WH/Stock/Shelf 1 To WH/Stock/Shelf 2');
            helper.assertPreviousVisible(true);
            helper.assertPreviousEnabled(true);
            helper.assertNextVisible(true);
            helper.assertNextEnabled(true);
            helper.assertNextIsHighlighted(true);
            helper.assertLinesCount(2);
            helper.assertScanMessage('scan_src');
            helper.assertLocationHighlight(true);
            helper.assertDestinationLocationHighlight(true);
            helper.assertPager('1/3');
            helper.assertValidateVisible(false);
            helper.assertValidateIsHighlighted(false);
            helper.assertValidateEnabled(false);

            $('.o_barcode_line .fa-cubes').parent().each(function() {
                var qty = $(this).text().trim();
                if (qty !== '1 / 1') {
                    helper.fail();
                }
            });

            var $lineproduct1 = helper.getLine({barcode: 'product1'});
            helper.assertLineIsHighlighted($lineproduct1, false);
            var $lineproduct2 = helper.getLine({barcode: 'product2'});
            helper.assertLineIsHighlighted($lineproduct2, false);
        }
    },

    /* Hit next. The write should happen.
     */
    {
        'trigger': '.o_next_page',
    },

    {
        trigger: '.o_current_dest_location:contains("WH/Stock/Shelf 4")',
        run: function() {
            helper.assertPageSummary('From WH/Stock/Shelf 3 To WH/Stock/Shelf 4');
            helper.assertPreviousVisible(true);
            helper.assertPreviousEnabled(true);
            helper.assertNextVisible(true);
            helper.assertNextEnabled(true);
            helper.assertNextIsHighlighted(false);
            helper.assertLinesCount(1);
            helper.assertScanMessage('scan_src');
            helper.assertLocationHighlight(false);
            helper.assertDestinationLocationHighlight(false);
            helper.assertPager('2/3');
            helper.assertValidateVisible(false);
            helper.assertValidateIsHighlighted(false);
            helper.assertValidateEnabled(false);

            $('.o_barcode_line .fa-cubes').parent().each(function() {
                var qty = $(this).text().trim();
                if (qty !== '0 / 1') {
                    helper.fail();
                }
            });

            var $line = helper.getLine({barcode: 'product2'});
            helper.assertLineIsHighlighted($line, false);
        }
    },
]);

tour.register('test_internal_change_location', {test: true}, [
    {
        trigger: '.o_barcode_client_action',
        run: function () {
            helper.assertPageSummary('From Stock House/Abandonned Ground Floor To Stock House');
            helper.assertPreviousVisible(true);
            helper.assertPreviousEnabled(true);
            helper.assertNextVisible(true);
            helper.assertNextEnabled(true);
            helper.assertNextIsHighlighted(false);
            helper.assertLinesCount(1);
            helper.assertScanMessage('scan_src');
            helper.assertLocationHighlight(false);
            helper.assertDestinationLocationHighlight(false);
            helper.assertPager('1/2');
            helper.assertValidateVisible(false);
            helper.assertValidateIsHighlighted(false);
            helper.assertValidateEnabled(false);
            const $lineproduct1 = helper.getLine({barcode: 'product1'});
            helper.assertLineIsHighlighted($lineproduct1, false);
        }
    },
    // Clicks on the source location and checks the locations list is correclty displayed.
    {
        trigger: '.o_barcode_summary_location_src',
    },
    {
        trigger: '.o_barcode_client_action',
        run: function () {
            const $src_loc_list = $('.o_barcode_list_locations.o_source_locations');
            helper.assert($src_loc_list.css('display'), 'block');
            helper.assert($src_loc_list.find('li').length, 3);
            const $dest_loc_list = $('.o_barcode_list_locations.o_destination_locations');
            helper.assert($dest_loc_list.css('display'), 'none');
        }
    },
    // Clicks on the destination location and checks the locations list is correclty displayed.
    {
        trigger: '.o_barcode_summary_location_dest',
    },
    {
        trigger: '.o_barcode_client_action',
        run: function () {
            const $src_loc_list = $('.o_barcode_list_locations.o_source_locations');
            helper.assert($src_loc_list.css('display'), 'none');
            const $dest_loc_list = $('.o_barcode_list_locations.o_destination_locations');
            helper.assert($dest_loc_list.css('display'), 'block');
            helper.assert($dest_loc_list.find('li').length, 3);
        }
    },
    // Changes the destination location for 'Poorly lit floor'...
    {
        trigger: '.o_destination_locations li:contains("Poorly lit floor")',
    },
    {
        trigger: '.o_current_dest_location:contains("Poorly lit floor")',
        run: function () {
            helper.assertPageSummary('From Stock House/Abandonned Ground Floor To Stock House/Poorly lit floor');
            helper.assertPreviousVisible(true);
            helper.assertPreviousEnabled(true);
            helper.assertNextVisible(true);
            helper.assertNextEnabled(true);
            helper.assertNextIsHighlighted(false);
            helper.assertLinesCount(1);
            helper.assertScanMessage('scan_src');
            helper.assertLocationHighlight(false);
            helper.assertDestinationLocationHighlight(false);
            helper.assertPager('1/2');
            helper.assertValidateVisible(false);
            helper.assertValidateIsHighlighted(false);
            helper.assertValidateEnabled(false);
            const $lineproduct1 = helper.getLine({barcode: 'product1'});
            helper.assertLineIsHighlighted($lineproduct1, false);
        }
    },
    // ... then checks the dest location is really updated on the move line.
    {
        trigger: '.o_edit i',
    },
    {
        trigger: '.o_field_widget[name="location_dest_id"]',
        run: function () {
            helper.assert(
                $('.o_field_widget[name="location_dest_id"] input').val(),
                'Stock House/Poorly lit floor'
            );
        },
    },
    {
        trigger: '.o_save',
    },
    // Scans the product1 then changes the page.
    {
        trigger: '.o_barcode_lines',
        run: 'scan product1',
    },
    {
        trigger: '.o_next_page.btn-primary',
        run: function () {
            const $lineproduct1 = helper.getLine({barcode: 'product1'});
            helper.assertLineIsHighlighted($lineproduct1, true);
            helper.assertLineQty($lineproduct1, "1");
        }
    },
    {
        trigger: '.o_next_page',
    },
    {
        trigger: '.o_barcode_client_action:contains("product2")',
        run: function () {
            helper.assertPageSummary('From Stock House/Poorly lit floor To Stock House');
            helper.assertPreviousVisible(true);
            helper.assertPreviousEnabled(true);
            helper.assertNextVisible(false);
            helper.assertNextEnabled(false);
            helper.assertNextIsHighlighted(false);
            helper.assertLinesCount(1);
            helper.assertScanMessage('scan_src');
            helper.assertLocationHighlight(false);
            helper.assertDestinationLocationHighlight(false);
            helper.assertPager('2/2');
            helper.assertValidateVisible(true);
            helper.assertValidateIsHighlighted(false);
            helper.assertValidateEnabled(true);
            const $lineproduct2 = helper.getLine({barcode: 'product2'});
            helper.assertLineIsHighlighted($lineproduct2, false);
        }
    },
    // Clicks on the destination location and checks the locations list is correclty displayed.
    {
        trigger: '.o_barcode_summary_location_dest',
    },
    {
        trigger: '.o_barcode_client_action',
        run: function () {
            const $src_loc_list = $('.o_barcode_list_locations.o_source_locations');
            helper.assert($src_loc_list.css('display'), 'none');
            const $dest_loc_list = $('.o_barcode_list_locations.o_destination_locations');
            helper.assert($dest_loc_list.css('display'), 'block');
            helper.assert($dest_loc_list.find('li').length, 3);
        }
    },
    // Scans product2 and changes the destination location for 'Poorly lit floor'...
    {
        trigger: '.o_barcode_client_action',
        run: 'scan product2',
    },
    {
        trigger: '.o_destination_locations li:contains("Poorly lit floor")',
    },
    // ... then checks the dest location is really updated on the move line.
    {
        trigger: '.o_edit i',
    },
    {
        trigger: '.o_field_widget[name="location_dest_id"]',
        run: function () {
            helper.assert(
                $('.o_field_widget[name="location_dest_id"] input').val(),
                'Stock House/Poorly lit floor'
            );
        },
    },
    {
        trigger: '.o_save',
    },
    // Now, changes the source location for 'Abandonned Ground Floor'.
    // The purpose of this operation is to get the 2 lines on the same page.
    {
        trigger: '.o_barcode_summary_location_src',
    },
    {
        trigger: '.o_source_locations li:contains("Abandonned Ground Floor")',
    },
    {
        trigger: '.o_current_location:contains("Abandonned Ground Floor")',
        run: function () {
            helper.assertPageSummary('From Stock House/Abandonned Ground Floor To Stock House/Poorly lit floor');
            helper.assertPreviousVisible(true);
            helper.assertPreviousEnabled(false);
            helper.assertNextVisible(false);
            helper.assertNextEnabled(false);
            helper.assertNextIsHighlighted(false);
            helper.assertLinesCount(2);
            helper.assertScanMessage('scan_src');
            helper.assertLocationHighlight(false);
            helper.assertDestinationLocationHighlight(false);
            helper.assertPager('1/1');
            helper.assertValidateVisible(true);
            helper.assertValidateIsHighlighted(true);
            helper.assertValidateEnabled(true);
            const $lineproduct1 = helper.getLine({barcode: 'product1'});
            helper.assertLineIsHighlighted($lineproduct1, false);
            const $lineproduct2 = helper.getLine({barcode: 'product2'});
            helper.assertLineIsHighlighted($lineproduct2, false);
        }
    },
    // Changes the destination location for 'Stock House'...
    {
        trigger: '.o_barcode_summary_location_dest',
    },
    {
        trigger: '.o_destination_locations li:first-child()',
    },
    {
        trigger: '.o_current_dest_location:contains("Stock House"):not(:contains("/"))',
        run: function () {
            helper.assertPageSummary('From Stock House/Abandonned Ground Floor To Stock House');
        }
    },
    // ... then checks the dest location is really updated on the two move lines.
    {
        trigger: '.o_barcode_line:first-child() .o_edit i',
    },
    {
        trigger: '.o_field_widget[name="location_id"]',
        run: function () {
            helper.assert(
                $('.o_field_widget[name="location_id"] input').val(),
                'Stock House/Abandonned Ground Floor'
            );
            helper.assert(
                $('.o_field_widget[name="location_dest_id"] input').val(),
                'Stock House'
            );
        },
    },
    {
        trigger: '.o_save',
    },
    {
        trigger: '.o_barcode_line:last-child() .o_edit i',
    },
    {
        trigger: '.o_field_widget[name="location_id"]',
        run: function () {
            helper.assert(
                $('.o_field_widget[name="location_id"] input').val(),
                'Stock House/Abandonned Ground Floor'
            );
            helper.assert(
                $('.o_field_widget[name="location_dest_id"] input').val(),
                'Stock House'
            );
        },
    },
    {
        trigger: '.o_save',
    },
    // Validate the delivery.
    {
        trigger: '.o_validate_page'
    },
    {
        trigger: '.o_notification_title:contains("Success")',
    },
]);

tour.register('test_receipt_reserved_1', {test: true}, [
    {
        trigger: '.o_barcode_client_action',
        run: function() {
            helper.assertPageSummary(' To WH/Stock');
            helper.assertPreviousVisible(true);
            helper.assertPreviousEnabled(false);
            helper.assertNextVisible(false);
            helper.assertNextEnabled(false);
            helper.assertNextIsHighlighted(false);
            helper.assertLinesCount(2);
            helper.assertScanMessage('scan_products');
            helper.assertLocationHighlight(false);
            helper.assertDestinationLocationHighlight(false);
            helper.assertPager('1/1');
            helper.assertValidateVisible(true);
            helper.assertValidateIsHighlighted(false);
            helper.assertValidateEnabled(true);
        }
    },

    {
        trigger: '.o_barcode_client_action',
        run: 'scan product2'
    },

    {
        trigger: '.o_barcode_client_action',
        run: 'scan product2'
    },

    {
        trigger: '.o_barcode_client_action',
        run: 'scan product2'
    },

    {
        trigger: '.o_barcode_client_action',
        run: 'scan product2'
    },

    {
        trigger: '.o_barcode_client_action',
        run: 'scan product1'
    },

    {
        trigger: '.o_barcode_client_action',
        run: 'scan product1'
    },

    {
        trigger: '.o_barcode_client_action',
        run: 'scan product1'
    },

    {
        trigger: '.o_barcode_client_action',
        run: function() {
            helper.assertValidateIsHighlighted(false);
        }
    },

    {
        trigger: '.o_barcode_client_action',
        run: 'scan product1'
    },

    {
        trigger: '.o_barcode_client_action',
        run: function() {
            helper.assertValidateIsHighlighted(true);
        }
    },

    {
        trigger: '.o_barcode_client_action',
        run: 'scan LOC-01-01-00'
    },

    {
        trigger: '.o_current_dest_location:contains("WH/Stock/Shelf 1")',
        run: function() {
            helper.assertPageSummary(' To WH/Stock/Shelf 1');
            helper.assertPreviousVisible(true);
            helper.assertPreviousEnabled(false);
            helper.assertNextVisible(false);
            helper.assertNextEnabled(false);
            helper.assertNextIsHighlighted(false);
            helper.assertLinesCount(2);
            helper.assertScanMessage('scan_products');
            // not relevant in receipt mode
            // helper.assertLocationHighlight(false);
            helper.assertDestinationLocationHighlight(true);
            helper.assertPager('1/1');
            helper.assertValidateVisible(true);
            helper.assertValidateIsHighlighted(true);
            helper.assertValidateEnabled(true);

            $('.o_barcode_line .fa-cubes').parent().each(function() {
                var qty = $(this).text().trim();
                if (qty !== '1 / 4') {
                    helper.fail();
                }
            });
        }
    },

    {
        trigger: '.o_add_line',
    },

    {
        trigger: '.o_field_widget[name="product_id"]',
        run: function() {
            helper.assertFormLocationDest('WH/Stock/Shelf 1');
        },
    },
]);

tour.register('test_delivery_reserved_1', {test: true}, [
    {
        trigger: '.o_barcode_client_action',
        run: function() {
            helper.assertPageSummary('From WH/Stock ');
            helper.assertPreviousVisible(true);
            helper.assertPreviousEnabled(false);
            helper.assertNextVisible(false);
            helper.assertNextEnabled(false);
            helper.assertNextIsHighlighted(false);
            helper.assertLinesCount(2);
            helper.assertScanMessage('scan_src');
            helper.assertLocationHighlight(false);
            // not relevant in delivery mode
            // helper.assertDestinationLocationHighlight(false);
            helper.assertPager('1/1');
            helper.assertValidateVisible(true);
            helper.assertValidateIsHighlighted(false);
            helper.assertValidateEnabled(true);
        }
    },

    {
        trigger: '.o_barcode_client_action',
        run: 'scan LOC-01-00-00'
    },

    {
        trigger: '.o_barcode_client_action',
        run: function() {
            helper.assertPageSummary('From WH/Stock ');
            helper.assertPreviousVisible(true);
            helper.assertPreviousEnabled(false);
            helper.assertNextVisible(false);
            helper.assertNextEnabled(false);
            helper.assertNextIsHighlighted(false);
            helper.assertLinesCount(2);
            helper.assertScanMessage('scan_products');
            helper.assertLocationHighlight(true);
            // not relevant in delivery mode
            // helper.assertDestinationLocationHighlight(false);
            helper.assertPager('1/1');
            helper.assertValidateVisible(true);
            helper.assertValidateIsHighlighted(false);
            helper.assertValidateEnabled(true);
        }
    },

    {
        trigger: '.o_barcode_client_action',
        run: 'scan product1'
    },

    {
        trigger: '.o_barcode_client_action',
        run: 'scan product2'
    },

    {
        trigger: '.o_barcode_client_action',
        run: 'scan LOC-01-01-00'
    },

    {
        trigger: '.o_current_location:contains("WH/Stock/Shelf 1")',
        run: function() {
            helper.assertPageSummary('From WH/Stock/Shelf 1 ');
            helper.assertPreviousVisible(true);
            helper.assertPreviousEnabled(true);
            helper.assertNextVisible(false);
            helper.assertNextEnabled(false);
            helper.assertNextIsHighlighted(false);
            helper.assertLinesCount(0);
            helper.assertScanMessage('scan_products');
            helper.assertLocationHighlight(true);
            // not relevant in delivery mode
            // helper.assertDestinationLocationHighlight(false);
            helper.assertPager('2/2');
            helper.assertValidateVisible(true);
            helper.assertValidateIsHighlighted(false);
            helper.assertValidateEnabled(false);
        }
    },
]);

tour.register('test_delivery_reserved_2', {test: true}, [
    {
        trigger: '.o_barcode_client_action',
        run: function() {
            helper.assertPageSummary('');
            helper.assertPreviousVisible(true);
            helper.assertPreviousEnabled(false);
            helper.assertNextVisible(false);
            helper.assertNextEnabled(false);
            helper.assertNextIsHighlighted(false);
            helper.assertLinesCount(2);
            helper.assertScanMessage('scan_products');
            helper.assertLocationHighlight(false);
            // not relevant in delivery mode
            // helper.assertDestinationLocationHighlight(false);
            helper.assertValidateVisible(true);
            helper.assertValidateIsHighlighted(false);
            helper.assertValidateEnabled(true);
        }
    },

    {
        trigger: '.o_barcode_client_action',
        run: 'scan product1'
    },

    {
        trigger: '.o_barcode_client_action',
        run: 'scan product1'
    },

    {
        trigger: '.o_barcode_client_action',
        run: 'scan product2'
    },

    {
        trigger: '.o_barcode_line_title:contains("product2")',
        run: function() {
            helper.assertPageSummary('');
            helper.assertPreviousVisible(true);
            helper.assertPreviousEnabled(true);
            helper.assertNextVisible(false);
            helper.assertNextEnabled(false);
            helper.assertNextIsHighlighted(false);
            helper.assertLinesCount(3);
            helper.assertScanMessage('scan_products');
            // not relevant in delivery mode
            // helper.assertDestinationLocationHighlight(false);
            helper.assertValidateVisible(true);
            helper.assertValidateIsHighlighted(false);
            helper.assertValidateEnabled(true);
        }
    },

    {
        trigger: '.o_barcode_client_action',
        run: 'scan product1'
    },

    {
        trigger: '.o_barcode_client_action',
        run: 'scan product1'
    },

    {
        trigger: '.o_barcode_line_title:contains("product2")',
        run: function() {
            helper.assertPageSummary('');
            helper.assertPreviousVisible(true);
            helper.assertPreviousEnabled(true);
            helper.assertNextVisible(false);
            helper.assertNextEnabled(false);
            helper.assertNextIsHighlighted(false);
            helper.assertLinesCount(3);
            helper.assertScanMessage('scan_products');
            // not relevant in delivery mode
            // helper.assertDestinationLocationHighlight(false);
            helper.assertValidateVisible(true);
            helper.assertValidateIsHighlighted(true);
            helper.assertValidateEnabled(true);
            var $lines = helper.getLine({barcode: 'product1'});
            for (var i = 0; i < $lines.length; i++) {
                helper.assertLineQty($($lines[i]), "2");
            }

        }
    },

    {
        trigger: '.o_barcode_client_action',
        run: 'scan product1'
    },

    {
        trigger: '.o_barcode_client_action',
        run: function () {
            helper.assertPageSummary('');
            helper.assertPreviousVisible(true);
            helper.assertPreviousEnabled(true);
            helper.assertNextVisible(false);
            helper.assertNextEnabled(false);
            helper.assertNextIsHighlighted(false);
            helper.assertLinesCount(4);
            helper.assertScanMessage('scan_products');
            // not relevant in delivery mode
            // helper.assertDestinationLocationHighlight(false);
            helper.assertValidateVisible(true);
            helper.assertValidateIsHighlighted(true);
            helper.assertValidateEnabled(true);
        }
    },
]);


tour.register('test_delivery_reserved_3', {test: true}, [
    {
        trigger: '.o_barcode_client_action',
        run: function() {
            helper.assertPageSummary('');
            helper.assertPreviousVisible(true);
            helper.assertPreviousEnabled(false);
            helper.assertNextVisible(false);
            helper.assertNextEnabled(false);
            helper.assertNextIsHighlighted(false);
            helper.assertLinesCount(1);
            helper.assertScanMessage('scan_products');
            helper.assertLocationHighlight(false);
            // not relevant in delivery mode
            // helper.assertDestinationLocationHighlight(false);
            helper.assertValidateVisible(true);
            helper.assertValidateIsHighlighted(false);
            helper.assertValidateEnabled(true);
        }
    },

    {
        trigger: '.o_barcode_client_action',
        run: 'scan product1'
    },

    {
        trigger: '.o_barcode_client_action',
        run: 'scan this_is_not_a_barcode_dude'
    },

    {
        trigger: '.o_barcode_client_action',
        run: function() {
            helper.assertPageSummary('');
            helper.assertPreviousVisible(true);
            helper.assertPreviousEnabled(true);
            helper.assertNextVisible(false);
            helper.assertNextEnabled(false);
            helper.assertNextIsHighlighted(false);
            helper.assertLinesCount(1);
            helper.assertScanMessage('scan_products');
            // not relevant in delivery mode
            // helper.assertDestinationLocationHighlight(false);
            helper.assertValidateVisible(true);
            helper.assertValidateIsHighlighted(true);
            helper.assertValidateEnabled(true);
            var $line = helper.getLine({barcode: 'product1'});
            helper.assertLineIsHighlighted($line, true);
            helper.assertLineQty($line, "1");
        }
    },
]);

tour.register('test_delivery_using_buttons', {test: true}, [
    {
        trigger: '.o_barcode_client_action',
        run: function() {
            helper.assertPageSummary('');
            helper.assertPreviousVisible(true);
            helper.assertPreviousEnabled(false);
            helper.assertNextVisible(false);
            helper.assertNextEnabled(false);
            helper.assertNextIsHighlighted(false);
            helper.assertLinesCount(3);
            helper.assertScanMessage('scan_products');
            helper.assertLocationHighlight(false);
            helper.assertValidateVisible(true);
            helper.assertValidateIsHighlighted(false);
            helper.assertValidateEnabled(true);
            helper.assert(
                $('.o_line_button').length, 6,
                "6 buttons must be present in the view (2 by line)"
            );
            helper.assert($('.o_add_reserved').eq(0).text(), '+ 2');
            helper.assert($('.o_add_reserved').eq(1).text(), '+ 3');
            helper.assert($('.o_add_reserved').eq(2).text(), '+ 4');
            helper.assertLineQuantityOnReservedQty(0, '0 / 2');
            helper.assertLineQuantityOnReservedQty(1, '0 / 3');
            helper.assertLineQuantityOnReservedQty(2, '0 / 4');
            helper.assertLineButtonsAreVisible(0, true);
            helper.assertLineButtonsAreVisible(1, true);
            helper.assertLineButtonsAreVisible(2, true);
        }
    },

    // On the first line...
    // Press +1 button , remaining quantity must be updated on the button.
    {
        trigger: '.o_barcode_line:first-child() .o_add_unit'
    },
    {
        trigger: '.o_barcode_client_action',
        run: function() {
            helper.assert($('.o_add_reserved').eq(0).text(), '+ 1');
            helper.assertLineQuantityOnReservedQty(0, '1 / 2');
            helper.assertLineIsHighlighted($('.o_barcode_line:first-child()'), true);
            helper.assertLineIsHighlighted($('.o_barcode_line:nth-child(2)'), false);
            helper.assertLineIsHighlighted($('.o_barcode_line:last-child()'), false);
        }
    },
    // Press +1 button again, now its buttons must be hidden.
    {
        trigger: '.o_barcode_line:first-child() .o_add_unit'
    },
    {
        trigger: '.o_barcode_client_action',
        run: function() {
            helper.assert($('.o_add_reserved').eq(0).text(), '+ 1');
            helper.assertLineButtonsAreVisible(0, false);
            helper.assertLineQuantityOnReservedQty(0, '2 / 2');
        }
    },

    // On the second line...
    {
        trigger: '.o_barcode_client_action',
        run: function() {
            helper.assert($('.o_add_reserved').eq(1).text(), '+ 3');
            helper.assertLineButtonsAreVisible(1, true);
            helper.assertLineQuantityOnReservedQty(1, '0 / 3');
        }
    },
    // Press the add remaining quantity button, now its buttons must be hidden.
    {
        trigger: '.o_barcode_line:nth-child(2) .o_add_reserved'
    },
    {
        trigger: '.o_barcode_client_action',
        run: function() {
            helper.assertLineButtonsAreVisible(1, false);
            helper.assertLineQuantityOnReservedQty(1, '3 / 3');
            helper.assertLineIsHighlighted($('.o_barcode_line:first-child()'), false);
            helper.assertLineIsHighlighted($('.o_barcode_line:nth-child(2)'), true);
            helper.assertLineIsHighlighted($('.o_barcode_line:last-child()'), false);
        }
    },

    // On the third line...
    {
        trigger: '.o_barcode_client_action',
        run: function() {
            helper.assert($('.o_add_reserved').eq(2).text(), '+ 4');
            helper.assertLineButtonsAreVisible(2, true);
            helper.assertLineQuantityOnReservedQty(2, '0 / 4');
        }
    },
    // Scan product3 one time, then checks the quantities.
    {
        trigger: '.o_barcode_client_action',
        run: 'scan product3',
    },
    {
        trigger: '.o_barcode_client_action',
        run: function() {
            helper.assert($('.o_add_reserved').eq(2).text(), '+ 3');
            helper.assertLineButtonsAreVisible(2, true);
            helper.assertLineQuantityOnReservedQty(2, '1 / 4');
            helper.assertLineIsHighlighted($('.o_barcode_line:first-child()'), false);
            helper.assertLineIsHighlighted($('.o_barcode_line:nth-child(2)'), false);
            helper.assertLineIsHighlighted($('.o_barcode_line:last-child()'), true);
        }
    },
    // Press +1 button, then checks the quantities.
    {
        trigger: '.o_barcode_line:last-child() .o_add_unit'
    },
    {
        trigger: '.o_barcode_client_action',
        run: function() {
            helper.assert($('.o_add_reserved').eq(2).text(), '+ 2');
            helper.assertLineButtonsAreVisible(2, true);
            helper.assertLineQuantityOnReservedQty(2, '2 / 4');
        }
    },
    // Press the add remaining quantity button, now its buttons must be hidden.
    {
        trigger: '.o_barcode_line:nth-child(3) .o_add_reserved'
    },
    {
        trigger: '.o_barcode_client_action',
        run: function() {
            helper.assertLineButtonsAreVisible(2, false);
            helper.assertLineQuantityOnReservedQty(2, '4 / 4');
            helper.assertValidateIsHighlighted(true);
        }
    },

    // Now, scan one more time the product3...
    // ... So, a new line must be created and only the +1 button must be visible.
    {
        trigger: '.o_barcode_client_action',
        run: 'scan product3',
    },
    {
        trigger: '.o_barcode_line:nth-child(4)',
        run: function() {
            helper.assertLinesCount(4);
            helper.assertLineIsHighlighted($('.o_barcode_line:first-child()'), true);
            helper.assertLineIsHighlighted($('.o_barcode_line:nth-child(2)'), false);
            helper.assertLineIsHighlighted($('.o_barcode_line:nth-child(3)'), false);
            helper.assertLineIsHighlighted($('.o_barcode_line:last-child()'), false);
            const $line = $('.o_barcode_line:first-child()');
            helper.assertLineQty($line, '1');
            // +1 button must be present on new line.
            helper.assert($line.find('.o_add_unit').length, 1);
            // "Add remaining reserved quantity" button must not be present on new line.
            helper.assert($line.find('.o_add_reserved').length, 0);
        }
    },
    // Press +1 button of the new line.
    {
        trigger: '.o_barcode_line:first-child() .o_add_unit'
    },
    {
        trigger: '.o_barcode_client_action',
        run: function() {
            helper.assertLineIsHighlighted($('.o_barcode_line:first-child()'), true);
            helper.assertLineIsHighlighted($('.o_barcode_line:nth-child(2)'), false);
            helper.assertLineIsHighlighted($('.o_barcode_line:nth-child(3)'), false);
            helper.assertLineIsHighlighted($('.o_barcode_line:last-child()'), false);
            const $line = $('.o_barcode_line:first-child()');
            helper.assertLineQty($line, '2');
            // +1 button must still be present.
            helper.assert($line.find('.o_add_unit').length, 1);
            helper.assert($line.find('.o_add_reserved').length, 0);
        }
    },

    // Validate the delivery.
    {
        trigger: '.o_validate_page'
    },
    {
        trigger: '.o_notification_title:contains("Success")',
    },
]);


tour.register('test_receipt_from_scratch_with_lots_1', {test: true}, [
    {
        trigger: '.o_barcode_client_action',
        run: function() {
            helper.assertPageSummary(' To WH/Stock');
        }
    },

    {
        trigger: '.o_barcode_client_action',
        run: 'scan lot1',
    },

    {
        trigger: '.o_notification_title:contains("Warning")'
    },

    {
        trigger: '.o_barcode_client_action',
        run: function () {
            helper.assertErrorMessage('You are expected to scan one or more products.');
        },
    },

    {
        trigger: '.o_barcode_client_action',
        run: 'scan productserial1'
    },

    {
        trigger: '.o_barcode_client_action',
        run: 'scan lot1',
    },

    {
        trigger: '.o_barcode_client_action',
        run: 'scan LOC-01-00-00'
    },

    {
        trigger: '.o_barcode_client_action',
        run: 'scan productserial1'
    },

    {
        trigger: '.o_barcode_client_action',
        run: 'scan lot2',
    },

    {
        trigger: '.o_barcode_client_action',
        run: 'scan LOC-01-01-00'
    },

    {
        trigger: '.o_current_dest_location:contains("WH/Stock/Shelf 1")',
        run: function() {
            helper.assertPageSummary(' To WH/Stock/Shelf 1');
            helper.assertPreviousVisible(true);
        }
    },
]);

tour.register('test_receipt_from_scratch_with_lots_2', {test: true}, [
    {
        trigger: '.o_barcode_client_action',
        run: function() {
            helper.assertPageSummary(' To WH/Stock');
        }
    },

    {
        trigger: '.o_barcode_client_action',
        run: 'scan productlot1'
    },

    {
        trigger: '.o_barcode_client_action',
        run: 'scan lot1',
    },

    {
        trigger: '.o_barcode_client_action',
        run: 'scan lot1',
    },

    {
        trigger: '.o_barcode_client_action',
        run: 'scan lot2',
    },

    {
        trigger: '.o_barcode_client_action',
        run: 'scan lot2',
    },

    {
        trigger: '.o_barcode_client_action',
        run: 'scan LOC-01-01-00'
    },

    {
        trigger: '.o_current_dest_location:contains("WH/Stock/Shelf 1")',
        run: function() {
            helper.assertPageSummary(' To WH/Stock/Shelf 1');
            helper.assertPreviousVisible(true);
        }
    },
]);

tour.register('test_delivery_from_scratch_with_lots_1', {test: true}, [

    {
        trigger: '.o_barcode_client_action',
        run: 'scan lot1',
    },

    {
        trigger: '.o_barcode_client_action',
        run: 'scan lot1',
    },

    {
        trigger: '.o_barcode_client_action',
        run: 'scan lot2',
    },

    {
        trigger: '.o_barcode_client_action',
        run: 'scan lot2',
    },
    // Open the form view to trigger a save
    {
        trigger: '.o_add_line',
    },

    {
        trigger: '.o_field_widget[name="product_id"]',
    },

]);

tour.register('test_delivery_from_scratch_with_sn_1', {test: true}, [
    /* scan a product tracked by serial number. Then scan 4 a its serial numbers.
    */
    {
        trigger: '.o_barcode_client_action',
        run: 'scan productserial1',
    },

    {
        trigger: '.o_barcode_client_action',
        run: 'scan sn1',
    },

    {
        trigger: '.o_barcode_client_action',
        run: 'scan sn1',
    },

    {
        trigger: '.o_notification_title:contains("Warning")'
    },

    {
        trigger: '.o_barcode_client_action',
        run: function () {
            helper.assertErrorMessage('The scanned serial number is already used.');
        },
    },

    {
        trigger: '.o_barcode_client_action',
        run: 'scan sn2',
    },

    {
        trigger: '.o_barcode_client_action',
        run: 'scan sn3',
    },

    {
        trigger: '.o_barcode_client_action',
        run: 'scan sn4',
    },
    // Open the form view to trigger a save
    {
        trigger: '.o_add_line',
    },

    {
        trigger: '.o_field_widget[name="product_id"]',
    },

]);
tour.register('test_delivery_reserved_lots_1', {test: true}, [

    {
        trigger: '.o_barcode_client_action',
        run: 'scan productlot1',
    },

    {
        trigger: '.o_barcode_client_action',
        run: 'scan lot2',
    },

    {
        trigger: '.o_barcode_client_action',
        run: 'scan lot1',
    },

    {
        trigger: '.o_barcode_client_action',
        run: 'scan lot2',
    },
    // Open the form view to trigger a save
    {
        trigger: '.o_add_line',
    },

    {
        trigger: '.o_field_widget[name="product_id"]',
    },

]);

tour.register('test_delivery_reserved_with_sn_1', {test: true}, [
    /* scan a product tracked by serial number. Then scan 4 a its serial numbers.
    */
    {
        trigger: '.o_barcode_client_action',
        run: 'scan productserial1',
    },

    {
        trigger: '.o_barcode_client_action',
        run: 'scan sn3',
    },

    {
        trigger: '.o_barcode_client_action',
        run: 'scan sn3',
    },

    {
        trigger: '.o_notification_title:contains("Warning")'
    },

    {
        trigger: '.o_barcode_client_action',
        run: function () {
            helper.assertErrorMessage('The scanned serial number is already used.');
        },
    },

    {
        trigger: '.o_barcode_client_action',
        run: 'scan sn1',
    },

    {
        trigger: '.o_barcode_client_action',
        run: 'scan sn4',
    },

    {
        trigger: '.o_barcode_client_action',
        run: 'scan sn2',
    },
    // Open the form view to trigger a save
    {
        trigger: '.o_add_line',
    },

    {
        trigger: '.o_field_widget[name="product_id"]',
    },

]);

tour.register('test_receipt_reserved_lots_multiloc_1', {test: true}, [
    /* Receipt of a product tracked by lots. Open an existing picking with 4
    * units initial demands. Scan 2 units in lot1 in location WH/Stock. Then scan
    * 2 unit in lot2 in location WH/Stock/Shelf 2
    */

    {
        trigger: '.o_barcode_client_action',
        run: 'scan productlot1',
    },

    {
        trigger: '.o_barcode_client_action',
        run: 'scan lot1',
    },

    {
        trigger: '.o_barcode_client_action',
        run: 'scan lot1',
    },

    {
        trigger: '.o_barcode_client_action',
        run: 'scan LOC-01-02-00',
    },

    {
        trigger: '.o_barcode_client_action',
        run: 'scan productlot1',
    },

    {
        trigger: '.o_barcode_client_action',
        run: 'scan lot2',
    },

    {
        trigger: '.o_barcode_client_action',
        run: 'scan lot2',
    },

    {
        trigger: '.o_barcode_client_action',
        run: 'scan LOC-01-01-00',
    },
    // Open the form view to trigger a save
    {
        trigger: '.o_add_line',
    },

    {
        trigger: '.o_field_widget[name="product_id"]',
    },

]);

tour.register('test_receipt_duplicate_serial_number', {test: true}, [
    /* Create a receipt. Try to scan twice the same serial in different
    * locations.
    */
    {
        trigger: '.o_stock_barcode_main_menu:contains("Barcode Scanning")',
    },
    // reception
    {
        trigger: '.o_stock_barcode_main_menu',
        run: 'scan WH-RECEIPTS',
    },

    {
        trigger: '.o_barcode_client_action',
        run: 'scan productserial1',
    },

    {
        trigger: '.o_barcode_client_action',
        run: 'scan sn1',
    },

    {
        trigger: '.o_barcode_client_action',
        run: 'scan LOC-01-01-00',
    },

    {
        trigger: '.o_barcode_client_action',
        run: 'scan productserial1',
    },

    {
        trigger: '.o_barcode_client_action',
        run: 'scan sn1',
    },

    {
        trigger: '.o_notification_title:contains("Warning")'
    },

    {
        trigger: '.o_barcode_client_action',
        run: function () {
            helper.assertErrorMessage('The scanned serial number is already used.');
        },
    },

    {
        trigger: '.o_barcode_client_action',
        run: 'scan sn2',
    },

    {
        trigger: '.o_barcode_client_action',
        run: 'scan LOC-01-02-00',
    },

    {
        trigger: '.o_barcode_client_action',
        run: 'scan O-BTN.validate',
    },

    {
        trigger: '.o_notification_title:contains("Success")'
    },

    {
        trigger: '.o_stock_barcode_main_menu',
        run: function () {
            helper.assertErrorMessage('The transfer has been validated');
        },
    },
]);

tour.register('test_delivery_duplicate_serial_number', {test: true}, [
    /* Create a delivery. Try to scan twice the same serial in different
    * locations.
    */
    {
        trigger: '.o_stock_barcode_main_menu',
        run: 'scan WH-DELIVERY',
    },

    {
        trigger: '.o_barcode_client_action',
        run: 'scan LOC-01-01-00',
    },

    {
        trigger: '.o_barcode_client_action',
        run: 'scan productserial1',
    },

    {
        trigger: '.o_barcode_client_action',
        run: 'scan sn1',
    },

    {
        trigger: '.o_barcode_client_action',
        run: 'scan LOC-01-01-00',
    },

    {
        trigger: '.o_barcode_client_action',
        run: 'scan productserial1',
    },

    {
        trigger: '.o_barcode_client_action',
        run: 'scan sn1',
    },

    {
        trigger: '.o_notification_title:contains("Warning")'
    },

    {
        trigger: '.o_barcode_client_action',
        run: function () {
            helper.assertErrorMessage('The scanned serial number is already used.');
        },
    },

    {
        trigger: '.o_barcode_client_action',
        run: 'scan sn2',
    },

    {
        trigger: '.o_barcode_client_action',
        run: 'scan O-BTN.validate',
    },

    {
        trigger: '.o_notification_title:contains("Success")'
    },

    {
        trigger: '.o_stock_barcode_main_menu',
        run: function () {
            helper.assertErrorMessage('The transfer has been validated');
        },
    },
]);

tour.register('test_bypass_source_scan', {test: true}, [
    /* Scan directly a serial number, a package or a lot in delivery order.
    * It should implicitely trigger the same action than a source location
    * scan with the state location.
    */
    {
        trigger: '.o_barcode_client_action',
        run: function () {
            helper.assertPageSummary('From WH/Stock/Shelf 1');
            helper.assertPreviousVisible(true);
            helper.assertPreviousEnabled(true);
            helper.assertNextVisible(true);
            helper.assertNextEnabled(true);
            helper.assertNextIsHighlighted(false);
            helper.assertLinesCount(1);
            helper.assertScanMessage('scan_src');
            helper.assertLocationHighlight(false);
            helper.assertDestinationLocationHighlight(false);
            helper.assertPager('1/2');
            helper.assertValidateVisible(false);
            helper.assertValidateIsHighlighted(false);
            helper.assertValidateEnabled(false);
        }
    },

    {
        trigger: '.o_barcode_client_action',
        run: 'scan THEPACK',
    },

    {
        trigger: '.o_notification_title:contains("Warning")'
    },

    {
        trigger: '.o_barcode_client_action',
        run: function () {
            helper.assertErrorMessage("You are expected to scan one or more products or a package available at the picking's location");
        },
    },

    {
        trigger: '.o_barcode_client_action',
        run: 'scan serial1',
    },

    {
        trigger: '.o_edit'
    },

    {
        trigger: '.o_field_many2one[name=lot_id]',
        extra_trigger: '.o_field_widget[name="qty_done"]',
        position: "bottom",
        run: function (actions) {
            actions.text("", this.$anchor.find("input"));
        },
    },

    {
        trigger: 'input.o_field_widget[name=qty_done]',
        run: 'text 0',
    },

    {
        trigger: '.o_save'
    },

    {
        trigger: '.o_barcode_client_action',
        extra_trigger: '.o_barcode_line',
        run: 'scan lot1',
    },

    {
        trigger: '.o_barcode_client_action',
        run: 'scan lot1',
    },

    {
        trigger: '.o_barcode_client_action',
        run: 'scan LOC-01-02-00',
    },

    {
        trigger: '.o_barcode_client_action',
        run: 'scan THEPACK',
    },

    {
        trigger: '.o_barcode_client_action',
        run: 'scan productserial1',
    },

    {
        trigger: '.o_barcode_client_action',
        run: 'scan serial1',
    },

    {
        trigger: '.o_barcode_client_action',
        run: 'scan O-BTN.validate',
    },

    {
        trigger: '.o_notification_title:contains("Success")'
    },
]);

tour.register('test_inventory_adjustment', {test: true}, [

    {
        trigger: '.button_inventory',
    },

    {
        trigger: '.o-kanban-button-new',
    },
    //Check show information.
    {
        trigger: '.o_show_information',
    },

    {
        trigger: '.o_form_label:contains("Status")',
    },

    {
        trigger: '.o_close',
    },

    {
        trigger: '.o_barcode_message:contains("Scan products")',
    },

    {
        trigger: '.o_barcode_client_action',
        run: 'scan product1',
    },

    {
        trigger: '.o_barcode_client_action',
        run: 'scan product1',
    },

    {
        trigger: '.o_edit',
    },

    {
        trigger: '.o_field_widget[name="product_qty"]',
        run: function () {
            helper.assertInventoryFormQuantity('2');
        }
    },

    {
        trigger :'.o_save',
    },

    {
        trigger: '.o_add_line',
    },

    {
        trigger: ".o_field_widget[name=product_id] input",
        run: 'text product2',
    },

    {
        trigger: ".ui-menu-item > a:contains('product2')",
    },

    {
        trigger: "input.o_field_widget[name=product_qty]",
        run: 'text 2',
    },

    {
        trigger: '.o_save',
    },

    {
        extra_trigger: '.o_barcode_message:contains("Scan products")',
        trigger: '.o_barcode_client_action',
        run: 'scan O-BTN.validate',
    },

    {
        trigger: '.o_stock_barcode_kanban',
    },

    {
        trigger: '.o_notification_title:contains("Success")',
        run: function () {
            helper.assertErrorMessage('The inventory adjustment has been validated');
        },
    },

    {
        trigger: '.breadcrumb-item:contains("Barcode")',
    },

    {
        trigger: '.o_stock_barcode_main_menu',
    },
]);

tour.register('test_inventory_adjustment_mutli_location', {test: true}, [

    {
        trigger: '.button_inventory',
    },

    {
        trigger: '.o-kanban-button-new',
    },

    {
        trigger: '.o_barcode_client_action',
        run: 'scan LOC-01-00-00'
    },

    {
        trigger: '.o_barcode_summary_location_src:contains("WH/Stock")',
    },

    {
        trigger: '.o_barcode_client_action',
        run: 'scan product1',
    },

    {
        trigger: '.o_barcode_client_action',
        run: 'scan product1',
    },

    {
        trigger: '.o_barcode_client_action',
        run: 'scan product2',
    },

    {
        trigger: '.o_barcode_client_action',
        run: 'scan LOC-01-01-00'
    },

    {
        trigger: '.o_barcode_summary_location_src:contains("WH/Stock/Shelf 1")',
    },

    {
        trigger: '.o_barcode_client_action',
        run: 'scan product2',
    },

    {
        trigger: '.o_barcode_client_action',
        run: 'scan LOC-01-02-00'
    },

    {
        trigger: '.o_barcode_summary_location_src:contains("WH/Stock/Shelf 2")',
    },

    {
        trigger: '.o_barcode_client_action',
        run: 'scan product1',
    },

    {
        trigger: '.o_add_line',
    },

    {
        trigger: '.o_field_widget[name="product_id"]',
    },

]);

tour.register('test_inventory_adjustment_tracked_product', {test: true}, [

    {
        trigger: '.button_inventory',
    },

    {
        trigger: '.o-kanban-button-new',
    },

    {
        trigger: '.o_barcode_client_action',
        run: 'scan productlot1',
    },

    {
        trigger: '.o_barcode_client_action',
        run: 'scan lot1',
    },

    {
        trigger: '.o_barcode_client_action',
        run: 'scan lot1',
    },

    {
        trigger: '.o_barcode_client_action',
        run: 'scan productserial1',
    },

    {
        trigger: '.o_barcode_client_action',
        run: 'scan serial1',
    },

    {
        trigger: '.o_barcode_client_action',
        run: 'scan serial1',
    },

    {
        trigger: '.o_notification_title:contains("Warning")'
    },

    {
        trigger: '.o_barcode_client_action',
        run: function () {
            helper.assertErrorMessage('The scanned serial number is already used.');
        },
    },

    {
        trigger: '.o_barcode_client_action',
        run: 'scan serial2',
    },

    {
        trigger: '.o_barcode_client_action',
        run: 'scan productlot1',
    },

    {
        trigger: '.o_barcode_client_action',
        run: 'scan lot1',
    },

    {
        trigger: '.o_barcode_client_action',
        run: 'scan productserial1',
    },

    {
        trigger: '.o_barcode_client_action',
        run: 'scan serial3',
    },

    {
        trigger: '.o_add_line',
    },

    {
        trigger: '.o_field_widget[name="product_id"]',
    },
]);

tour.register('test_inventory_nomenclature', {test: true}, [

    {
        trigger: '.button_inventory',
    },

    {
        trigger: '.o-kanban-button-new',
    },

    {
        trigger: '.o_barcode_client_action',
        run: function() {
            helper.assertScanMessage('scan_products');
        },
    },

    {
        trigger: '.o_barcode_client_action',
        run: 'scan 2145631123457', // 12.345 kg
    },

    {
        trigger: '.product-label:contains("product_weight")'
    },

    {
        trigger: '.o_barcode_client_action',
        run: 'scan O-BTN.validate',
    },

    {
        trigger: '.o_notification_title:contains("Success")'
    },
    {
        trigger: '.breadcrumb-item:contains("Barcode")',
    },
    {
        trigger: '.o_stock_barcode_main_menu',
        run: function () {
            helper.assertErrorMessage('The inventory adjustment has been validated');
        },
    },
]);

tour.register('test_inventory_package', {test: true}, [

    {
        trigger: '.button_inventory',
    },
    {
        trigger: '.o-kanban-button-new',
    },

    {
        trigger: '.o_barcode_client_action',
        run: 'scan PACK001',
    },

    {
        trigger: '.o_barcode_line:contains("product2") .o_edit',
    },

    {
        trigger: '[name="product_qty"]',
        run: 'text 21'
    },

    {
        trigger: '.o_save',
    },

    {
        trigger: '.o_validate_page',
    },

    {
        trigger: '.o_stock_barcode_kanban',
    },

    {
        trigger: '.o_notification_title:contains("Success")',
        run: function () {
            helper.assertErrorMessage('The inventory adjustment has been validated');
        },
    },

    {
        trigger: '.breadcrumb-item:contains("Barcode")',
    },

    {
        trigger: '.o_stock_barcode_main_menu',
    },
]);

tour.register('test_pack_multiple_scan', {test: true}, [

    {
        trigger: '.o_stock_barcode_main_menu:contains("Barcode Scanning")',
    },
// reception
    {
        trigger: '.o_stock_barcode_main_menu',
        run: 'scan WH-RECEIPTS',
    },

    {
        trigger: '.o_barcode_client_action',
        run: 'scan product1',
    },

    {
        trigger: '.o_barcode_client_action',
        run: 'scan product2',
    },

    {
        trigger: '.o_barcode_client_action',
        run: 'scan O-BTN.pack',
    },

    {
        trigger: '.o_barcode_client_action',
        run: 'scan O-BTN.validate',
    },

    {
        trigger: '.o_notification_title:contains("Success")'
    },

    {
        trigger: '.o_stock_barcode_main_menu',
        run: function () {
            helper.assertErrorMessage('The transfer has been validated');
        },
    },
// Delivery transfer to check the error message
    {
        trigger: '.o_stock_barcode_main_menu',
        run: 'scan WH-DELIVERY',
    },

    {
        trigger: '.o_barcode_client_action',
        run: 'scan PACK0001000',
    },

    {
        trigger: '.o_barcode_client_action',
        run: 'scan PACK0001000',
    },

    {
        trigger: '.o_notification_title:contains("Warning")'
    },

    {
        trigger: '.o_barcode_client_action',
        run: function () {
            helper.assertErrorMessage('This package is already scanned.');
            var $line = helper.getLine({barcode: 'product1'});
            helper.assertLineIsHighlighted($line, true);
            var $line = helper.getLine({barcode: 'product2'});
            helper.assertLineIsHighlighted($line, true);
        },
    },

    {
        trigger: '.o_barcode_client_action',
        run: 'scan O-BTN.validate',
    },

    {
        trigger: '.o_notification_title:contains("Success")'
    },

    {
        trigger: '.o_stock_barcode_main_menu',
        run: function () {
            helper.assertErrorMessage('The transfer has been validated');
        },
    },
]);

tour.register('test_pack_common_content_scan', {test: true}, [
    /* Scan 2 packages PACK1 and PACK2 that contains both product1 and
     * product 2. It also scan a single product1 before scanning both pacakges.
     * the purpose is to check that lines with a same product are not merged
     * together. For product 1, we should have 3 lines. One with PACK 1, one
     * with PACK2 and the last without package.
     */
    {
        trigger: '.o_stock_barcode_main_menu:contains("Barcode Scanning")',
    },

    {
        trigger: '.o_stock_barcode_main_menu',
        run: 'scan WH-DELIVERY',
    },

    {
        trigger: '.o_barcode_client_action',
        run: 'scan product1',
    },

    {
        trigger: '.o_barcode_client_action',
        run: 'scan PACK1',
    },

    {
        trigger: '.o_barcode_client_action',
        run: 'scan PACK2',
    },

    {
        trigger: '.o_barcode_client_action:contains("PACK2")',
        run: function () {
            helper.assertLinesCount(5);
        },
    },

    {
        trigger: '.o_barcode_client_action',
        run: 'scan O-BTN.validate',
    },

    {
        trigger: '.o_notification_title:contains("Success")'
    },

    {
        trigger: '.o_stock_barcode_main_menu',
        run: function () {
            helper.assertErrorMessage('The transfer has been validated');
        },
    },
]);


tour.register('test_pack_multiple_location', {test: true}, [

    {
        trigger: '.o_stock_barcode_main_menu:contains("Barcode Scanning")',
    },

    {
        trigger: '.o_stock_barcode_main_menu',
        run: 'scan WH-INTERNAL',
    },

    {
        trigger: '.o_barcode_client_action',
        run: 'scan LOC-01-01-00'
    },

    {
        trigger: '.o_current_location:contains("WH/Stock/Shelf 1")',
        run: 'scan PACK0000666',
    },

    {
        trigger: '.o_package_content',
    },

    {
        trigger: '.o_kanban_view:contains("product1")',
        run: function () {
            helper.assertQuantsCount(2);
        },
    },

    {
        trigger: '.o_close',
    },

    {
        trigger: '.o_barcode_client_action',
        run: 'scan LOC-01-02-00',
    },

    {
        trigger: '.o_current_dest_location:contains("WH/Stock/Shelf 2")',
        run: 'scan O-BTN.validate',
    },

    {
        trigger: '.o_notification_title:contains("Success")'
    },

    {
        trigger: '.o_stock_barcode_main_menu',
        run: function () {
            helper.assertErrorMessage('The transfer has been validated');
        },
    },
]);

tour.register('test_put_in_pack_from_multiple_pages', {test: true}, [
    {
        trigger: '.o_barcode_client_action',
        run: function () {
            helper.assertPageSummary('From WH/Stock/Shelf 1 To WH/Stock');
            helper.assertPreviousVisible(true);
            helper.assertPreviousEnabled(true);
            helper.assertNextVisible(true);
            helper.assertNextEnabled(true);
            helper.assertNextIsHighlighted(false);
            helper.assertLinesCount(2);
            helper.assertScanMessage('scan_src');
            helper.assertLocationHighlight(false);
            helper.assertDestinationLocationHighlight(false);
            helper.assertPager('1/2');
            helper.assertValidateVisible(false);
            helper.assertValidateIsHighlighted(false);
            helper.assertValidateEnabled(false);
        },
    },

    {
        trigger: '.o_barcode_client_action',
        run: 'scan LOC-01-01-00'
    },

    {
        trigger: '.o_barcode_client_action',
        run: function () {
            helper.assertPageSummary('From WH/Stock/Shelf 1 To WH/Stock');
            helper.assertPreviousVisible(true);
            helper.assertPreviousEnabled(true);
            helper.assertNextVisible(true);
            helper.assertNextEnabled(true);
            helper.assertNextIsHighlighted(false);
            helper.assertLinesCount(2);
            helper.assertScanMessage('scan_products');
            helper.assertLocationHighlight(true);
            helper.assertDestinationLocationHighlight(false);
            helper.assertPager('1/2');
            helper.assertValidateVisible(false);
            helper.assertValidateIsHighlighted(false);
            helper.assertValidateEnabled(false);
        },
    },

    {
        trigger: '.o_barcode_client_action',
        run: 'scan product1',
    },

    {
        trigger: '.o_barcode_client_action',
        run: 'scan product2',
    },

    {
        trigger: '.o_next_page',
    },

    {
        trigger: '.o_barcode_client_action',
        run: 'scan LOC-01-02-00',
    },

    {
        trigger: '.o_barcode_client_action',
        run: 'scan product1',
    },

    {
        trigger: '.o_barcode_client_action',
        run: 'scan product2',
    },

    {
        trigger: '.o_barcode_client_action',
        run: 'scan O-BTN.pack',
    },

    {
        trigger: '.o_barcode_summary_location_src:contains("WH/Stock/Shelf 2")',
        run: 'scan O-BTN.validate',
    },

    {
        trigger: '.o_notification_title:contains("Success")'
    },

]);

tour.register('test_reload_flow', {test: true}, [
    {
        trigger: '.o_stock_barcode_main_menu',
        run: 'scan WH-RECEIPTS'
    },

    {
        trigger: '.o_barcode_client_action',
        run: 'scan product1'
    },

    {
        trigger: '.o_edit',
    },

    {
        extra_trigger: '.o_field_widget[name="product_id"]',
        trigger: 'input.o_field_widget[name=qty_done]',
        run: 'text 2',
    },

    {
        trigger: '.o_save',
    },

    {
        trigger: '.o_add_line',
    },

    {
        trigger: ".o_field_widget[name=product_id] input",
        run: 'text product2',
    },

    {
        trigger: ".ui-menu-item > a:contains('product2')",
    },

    {
        trigger: '.o_save',
    },

    {
        trigger: '.o_barcode_summary_location_dest:contains("WH/Stock")',
        run: function () {
            helper.assertScanMessage('scan_more_dest');
            helper.assertLocationHighlight(false);
            helper.assertDestinationLocationHighlight(true);
        },
    },

    {
        trigger: '.o_barcode_summary_location_dest:contains("WH/Stock")',
        run: 'scan LOC-01-01-00',
    },

    {
        trigger: '.o_barcode_summary_location_dest:contains("WH/Stock/Shelf 1")',
    },

    {
        trigger: '.o_barcode_client_action',
        run: 'scan O-BTN.validate',
    },

    {
        trigger: '.o_notification_title:contains("Success")',
    },

]);

tour.register('test_highlight_packs', {test: true}, [
    {
        trigger: '.o_barcode_client_action',
        run: function () {
            helper.assertLinesCount(1);
            helper.assertScanMessage('scan_products');
            helper.assertValidateVisible(true);
            helper.assertValidateIsHighlighted(false);
            helper.assertValidateEnabled(true);
            var $line = $('.o_barcode_line');
            helper.assertLineIsHighlighted($line, false);

        },
    },

    {
        trigger: '.o_barcode_client_action',
        run: 'scan PACK002',
    },

    {
        trigger: '.o_barcode_client_action:contains("PACK002")',
    },

    {
        trigger: '.o_barcode_client_action',
        run: function () {
            helper.assertLinesCount(2);
            helper.assertScanMessage('scan_products');
            helper.assertValidateVisible(true);
            helper.assertValidateIsHighlighted(false);
            helper.assertValidateEnabled(true);
            var $line = $('.o_barcode_line').eq(1);
            helper.assertLineIsHighlighted($line, true);
        },
    },

]);

tour.register('test_put_in_pack_from_different_location', {test: true}, [
    {
        trigger: '.o_barcode_client_action',
        run: 'scan LOC-01-01-00',
    },

    {
        trigger: '.o_barcode_client_action',
        run: 'scan product1',
    },

    {
        trigger: '.o_next_page',
    },

    {
        trigger: '.o_barcode_client_action',
        run: 'scan shelf3',
    },

    {
        trigger: '.o_barcode_client_action',
        run: 'scan product2',
    },

    {
        trigger: '.o_barcode_client_action',
        run: 'scan O-BTN.pack',
    },

    {
        trigger: '.fa-archive',
    },

    {
        trigger: '.o_barcode_client_action',
        run: 'scan LOC-01-01-00',
    },

    {
        trigger: '.o_barcode_summary_location_src:contains("WH/Stock/Shelf 1")',
    },

    {
        trigger: '.o_barcode_client_action',
        run: function () {
            helper.assertPageSummary('From WH/Stock/Shelf 1 To WH/Stock');
            helper.assertPreviousVisible(true);
            helper.assertPreviousEnabled(true);
            helper.assertNextVisible(false);
            helper.assertNextEnabled(false);
            helper.assertNextIsHighlighted(false);
            helper.assertLinesCount(0);
            helper.assertScanMessage('scan_products');
            helper.assertLocationHighlight(true);
            helper.assertDestinationLocationHighlight(false);
            helper.assertPager('3/3');
            helper.assertValidateVisible(true);
            helper.assertValidateIsHighlighted(false);
            helper.assertValidateEnabled(false);
        },
    },

    {
        trigger: '.o_previous_page',
    },

    {
        trigger: '.o_barcode_client_action',
        run: 'scan O-BTN.validate',
    },

    {
        trigger: '.o_notification_title:contains("Success")',
    },
]);

tour.register('test_put_in_pack_before_dest', {test: true}, [
    {
        trigger: '.o_barcode_client_action',
        run: 'scan LOC-01-01-00',
    },

    {
        trigger: '.o_barcode_client_action',
        run: 'scan product1',
    },

    {
        trigger: '.o_next_page',
    },

    {
        trigger: '.o_barcode_client_action',
        run: 'scan shelf3',
    },

    {
        trigger: '.o_barcode_client_action',
        run: 'scan product2',
    },

    {
        trigger: '.o_barcode_client_action',
        run: 'scan shelf4',
    },

    {
        trigger: '.o_barcode_client_action',
        run: 'scan O-BTN.pack'
    },

    {
        trigger: '.modal-title:contains("Choose destination location")',
    },

    {
        trigger: '.btn-primary',
    },

    {
        trigger: '.o_barcode_client_action',
        run: 'scan O-BTN.validate',
    },

    {
        trigger: '.o_notification_title:contains("Success")',
    },

]);

tour.register('test_picking_owner_scan_package', {test: true}, [
    {
        trigger: '.o_stock_barcode_main_menu:contains("Barcode Scanning")',
    },
    {
        trigger: '.o_stock_barcode_main_menu',
        run: 'scan WH-DELIVERY',
    },
    {
        trigger: '.o_barcode_client_action',
        run: 'scan P00001',
    },
    {
        trigger: '.o_barcode_client_action:contains("P00001")',
    },
    {
        trigger: '.o_barcode_client_action:contains("Azure Interior")',
    },
    {
        trigger: '.o_barcode_client_action',
        run: 'scan O-BTN.validate',
    },
    {
        trigger: '.o_notification_title:contains("Success")',
    },
]);

tour.register('test_inventory_owner_scan_package', {test: true}, [
    {
        trigger: '.button_inventory',
    },
    {
        trigger: '.o-kanban-button-new',
    },
    {
        trigger: '.o_barcode_client_action',
        run: 'scan P00001',
    },
    {
        trigger: '.o_barcode_client_action:contains("P00001")',
    },
    {
        trigger: '.o_barcode_client_action:contains("Azure Interior")',
    },
    {
        trigger: '.o_barcode_client_action',
        run: 'scan O-BTN.validate',
    },
    {
        trigger: '.o_notification_title:contains("Success")',
    },
]);
});
