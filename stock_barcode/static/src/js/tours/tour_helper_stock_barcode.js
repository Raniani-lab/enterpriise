odoo.define('stock_barcode.tourHelper', function (require) {
'use strict';

var tour = require('web_tour.tour');

function fail (errorMessage) {
    tour._consume_tour(tour.running_tour, errorMessage);
}

function getLine (description) {
    var $res;
    $('.o_barcode_line').each(function () {
        var $line = $(this);
        var barcode = $line.data('barcode').trim();
        if (description.barcode === barcode) {
            if ($res) {
                $res.add($line);
            } else {
                $res = $line;
            }
        }
    });
    if (! $res) {
        fail('cannot get the line with the barcode ' + description.barcode);
    }
    return $res;
}

function assert (current, expected, info) {
    if (current !== expected) {
        fail(info + ': "' + current + '" instead of "' + expected + '".');
    }
}

function assertPageSummary (expected) {
    // FIXME sle: fix the tests instead of fixing the assert method
    var res = '';
    var $src = $('.o_barcode_summary_location_src');
    if ($src.length) {
        res = "From " + $src.text() + " ";
    }
    var $dest = $('.o_barcode_summary_location_dest');
    if ($dest.length) {
        res += "To " + $dest.text();
    }
    assert(res.trim(), expected.trim(), 'Page summary');
}

function assertPreviousVisible (expected) {
    var $previousButton = $('.o_previous_page');
    var current = (!$previousButton.length && !expected) || $previousButton.hasClass('o_hidden');
    assert(!current, expected, 'Previous visible');
}

function assertPreviousEnabled (expected) {
    var $previousButton = $('.o_previous_page');
    var current = (!$previousButton.length && !expected) || $previousButton.prop('disabled');
    assert(!current, expected, 'Previous button enabled');
}

function assertNextVisible (expected) {
    var $nextButton = $('.o_next_page');
    var current = (!$nextButton.length && !expected) || $nextButton.hasClass('o_hidden');
    assert(!current, expected, 'Next visible');
}

function assertNextEnabled (expected) {
    var $nextButton = $('.o_next_page');
    var current = (!$nextButton.length && !expected) || $nextButton.prop('disabled');
    assert(!current, expected, 'Next button enabled');
}

function assertNextIsHighlighted (expected) {
    var $nextButton = $('.o_next_page');
    var current = $nextButton.hasClass('btn-primary');
    assert(current, expected, 'Next button is highlighted');
}

function assertValidateVisible (expected) {
    var $validate = $('.o_validate_page');
    var current = (!$validate.length && !expected) || $validate.hasClass('o_hidden');
    assert(!current, expected, 'Validate visible');
}

function assertValidateEnabled (expected) {
    var $validate = $('.o_validate_page');
    var current = (!$validate.length && !expected) || $validate.prop('disabled');
    assert(!current, expected, 'Validate enabled');
}

function assertValidateIsHighlighted (expected) {
    var $validate = $('.o_validate_page');
    var current = $validate.hasClass('btn-success');
    assert(current, expected, 'Validte button is highlighted');
}

function assertLinesCount (expected) {
    var $lines = $('.o_barcode_line');
    var current = $lines.length;
    assert(current, expected, "Number of lines");
}

function assertScanMessage (expected) {
    var $helps = $('.o_scan_message');
    var $help = $helps.filter('.o_scan_message_' + expected);
    if (! $help.length || $help.hasClass('o_hidden')) {
        fail('assertScanMessage: "' + expected + '" is not displayed');
    }
}

function assertLocationHighlight (expected) {
    var $locationElem = $('.o_barcode_summary_location_src');
    assert($locationElem.hasClass('o_strong'), expected, 'Location source is not bold');
}

function assertDestinationLocationHighlight (expected) {
    var $locationElem = $('.o_barcode_summary_location_dest');
    assert($locationElem.hasClass('o_strong'), expected, 'Location destination is not bold');
}

function assertPager (expected) {
    var $pager = $('.o_barcode_move_number');
    assert($pager.text(), expected, 'Pager is wrong');
}

function assertLineIsHighlighted ($line, expected) {
    assert($line.hasClass('o_highlight'), expected, 'line should be highlighted');
}

function assertLineQty($line, qty) {
    assert($line.find('.qty-done').text(), qty, 'line quantity is wrong');
}

function assertFormLocationSrc(expected) {
    var $location = $('.o_field_widget[name="location_id"] input');
    assert($location.val(), expected, 'Wrong source location');
}

function assertFormLocationDest(expected) {
    var $location = $('.o_field_widget[name="location_dest_id"] input');
    assert($location.val(), expected, 'Wrong destination location');
}
function assertFormQuantity(expected) {
    var $location = $('.o_field_widget[name="qty_done"]');
    assert($location.val(), expected, 'Wrong destination location');

}

function assertInventoryFormQuantity(expected) {
    var $location = $('.o_field_widget[name="product_qty"]');
    assert($location.val(), expected, 'Wrong quantity');

}

function assertErrorMessage(expected) {
    var $errorMessage = $('.o_notification_content').eq(-1);
    assert($errorMessage[0].innerText, expected, 'wrong or absent error message');
}

function assertQuantsCount(expected) {
    var $quantity = $('.o_kanban_view .o_kanban_record:not(.o_kanban_ghost)').length;
    assert($quantity, expected, 'Wrong number of cards');
}

return {
    assert: assert,
    assertDestinationLocationHighlight: assertDestinationLocationHighlight,
    assertErrorMessage: assertErrorMessage,
    assertFormLocationDest: assertFormLocationDest,
    assertFormLocationSrc: assertFormLocationSrc,
    assertFormQuantity: assertFormQuantity,
    assertInventoryFormQuantity: assertInventoryFormQuantity,
    assertLinesCount: assertLinesCount,
    assertLineIsHighlighted: assertLineIsHighlighted,
    assertLineQty: assertLineQty,
    assertLocationHighlight: assertLocationHighlight,
    assertNextEnabled: assertNextEnabled,
    assertNextIsHighlighted: assertNextIsHighlighted,
    assertNextVisible: assertNextVisible,
    assertPager: assertPager,
    assertPageSummary: assertPageSummary,
    assertPreviousEnabled: assertPreviousEnabled,
    assertPreviousVisible: assertPreviousVisible,
    assertQuantsCount: assertQuantsCount,
    assertScanMessage: assertScanMessage,
    assertValidateEnabled: assertValidateEnabled,
    assertValidateIsHighlighted: assertValidateIsHighlighted,
    assertValidateVisible: assertValidateVisible,
    fail: fail,
    getLine: getLine,
};

});
