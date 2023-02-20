/** @odoo-module */

import { createTourMethods } from "@point_of_sale/../tests/tours/helpers/utils";
import { Do, Check, Execute } from "@pos_sale/../tests/helpers/ProductScreenTourMethods";

class DoExt extends Do {
        enterSerialNumber(serialNumber) {
            return [
                {
                    content: `click serial number icon'`,
                    trigger: '.line-lot-icon',
                    run: 'click',
                },
                {
                    content: `insert serial number '${serialNumber}'`,
                    trigger: '.popup-input.list-line-input',
                    run: 'text ' + serialNumber,
                },
                {
                    content: `click validate button'`,
                    trigger: '.button.confirm',
                    run: 'click',
                },
            ];
        }
    }

class CheckExt extends Check {}

class ExecuteExt extends Execute {}
// FIXME: this is a horrible hack to export an object as named exports.
// eslint-disable-next-line no-undef
Object.assign(__exports, createTourMethods("ProductScreen", DoExt, CheckExt, ExecuteExt));
