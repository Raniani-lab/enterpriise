/** @odoo-module **/

import { ProductScreen } from '@pos_sale_stock_renting/../tests/helpers/ProductScreenTourMethods';
import { PaymentScreen } from '@point_of_sale/../tests/tours/helpers/PaymentScreenTourMethods';
import { ReceiptScreen } from '@point_of_sale/../tests/tours/helpers/ReceiptScreenTourMethods';
import { getSteps, startSteps } from '@point_of_sale/../tests/tours/helpers/utils';
import { registry } from "@web/core/registry";

//#region OrderLotsRentalTour
registry
    .category("web_tour.tours")
    .add('OrderLotsRentalTour', { 
        test: true, 
        url: '/pos/ui', 
        steps: () => {
            startSteps();
            ProductScreen.do.clickQuotationButton();
            ProductScreen.do.selectFirstOrder();
            ProductScreen.do.enterSerialNumber('123456789');
            ProductScreen.do.clickPayButton();
            PaymentScreen.do.clickPaymentMethod('Cash');
            PaymentScreen.do.clickValidate();
            ReceiptScreen.check.isShown();
            return getSteps();
        } 
    });
//#endregion
