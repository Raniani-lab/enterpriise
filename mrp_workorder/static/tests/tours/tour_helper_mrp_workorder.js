odoo.define('mrp_workorder.tourHelper', function (require) {
'use strict';

var tour = require('web_tour.tour');

function fail(errorMessage) {
    tour._consume_tour(tour.running_tour, errorMessage);
}

function assertIn(item, itemList, info) {
    if (!itemList.includes(item)) {
        fail(info + ': "' + item + '" not in "' + itemList + '".');
    }
}
function assert(current, expected, info) {
    if (current !== expected) {
        fail(info + ': "' + current + '" instead of "' + expected + '".');
    }
}

function assertQtyToProduce(qty_producing, qty_remaining) {
    const $qty_producing = $('span[name="qty_producing"]');
    assert($qty_producing.length, 1, `no qty_producing`);
    assert(Number($qty_producing[0].textContent), qty_producing, `wrong quantity done`);
    const $qty_remaining = $('span[name="qty_remaining"]');
    assert($qty_remaining.length, 1, `no qty_remaining`);
    assert(Number($qty_remaining[0].textContent), qty_remaining, `wrong quantity remaining`);
}

function assertComponent(name, style, qty_done, qty_remaining) {
    assertIn(style, ['readonly', 'editable']);
    const $label = $('span[name="component_id"] > span');
    assert($label.length, 1, `no field`);
    assert($label[0].textContent, name, `wrong component name`);
    if (style === 'readonly') {
        const $qty_done = $('span[name="qty_done"]');
        assert($qty_done.length, 1, `no qty_done`);
        assert(Number($qty_done[0].textContent), qty_done, `wrong quantity done`);
    } else {
        const $qty_done = $('input[name="qty_done"]');
        assert($qty_done.length, 1, `no qty_done`);
        assert(Number($qty_done[0].value), qty_done, `wrong quantity done`);
    }
    const $qty_remaining = $('span[name="component_remaining_qty"]');
    assert($qty_remaining.length, 1, `no qty_remaining`);
    assert(Number($qty_remaining[0].textContent), qty_remaining, `wrong quantity remaining`);
}

function assertCurrentCheck(text) {
    const $button = $('.o_selected');
    assert($button.length, 1, `no selected check`);
    assert($button[0].textContent, text, `wrong check title`);
}

function assertCheckLength(length) {
    const button = $('.o_tablet_step');
    assert(button.length, length, `There should be "${length}" steps`);
}
function assertValidatedCheckLength(length) {
    const marks = $('.o_tablet_step_ok');
    assert(marks.length, length, `There should be "${length}" validated steps`);
}

return {
    assert: assert,
    assertCurrentCheck: assertCurrentCheck,
    assertCheckLength: assertCheckLength,
    assertComponent: assertComponent,
    assertValidatedCheckLength: assertValidatedCheckLength,
    assertQtyToProduce: assertQtyToProduce,
    fail: fail,
};

});
