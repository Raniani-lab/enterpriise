/** @odoo-module */

import { ProductScreen } from "@point_of_sale/../tests/tours/helpers/ProductScreenTourMethods";
import { PaymentScreen } from "@point_of_sale/../tests/tours/helpers/PaymentScreenTourMethods";
import { ReceiptScreen } from "@point_of_sale/../tests/tours/helpers/ReceiptScreenTourMethods";
import { getSteps, startSteps } from "@point_of_sale/../tests/tours/helpers/utils";
import { registry } from "@web/core/registry";


registry
    .category("web_tour.tours")
    .add("PreparationDisplayTour", { 
        test: true, 
        url: "/pos/ui", 
        steps: () => {
            startSteps();
            
            // First order should send these orderlines to preparation:
            // - Letter Tray x10
            ProductScreen.do.confirmOpeningPopup();
            
            ProductScreen.exec.addOrderline("Letter Tray", "10");
            ProductScreen.check.selectedOrderlineHas("Letter Tray", "10.0");
            ProductScreen.exec.addOrderline("Magnetic Board", "5");
            ProductScreen.check.selectedOrderlineHas("Magnetic Board", "5.0");
            ProductScreen.exec.addOrderline("Monitor Stand", "1");
            ProductScreen.check.selectedOrderlineHas("Monitor Stand", "1.0");
            ProductScreen.do.clickPayButton();
            
            PaymentScreen.do.clickPaymentMethod("Bank");
            PaymentScreen.check.changeIs("0.0");
            PaymentScreen.check.validateButtonIsHighlighted(true);
            PaymentScreen.do.clickValidate();
            
            ReceiptScreen.do.clickNextOrder();
            
            // Should not send anything to preparation
            ProductScreen.exec.addOrderline("Magnetic Board", "5");
            ProductScreen.check.selectedOrderlineHas("Magnetic Board", "5.0");
            ProductScreen.exec.addOrderline("Monitor Stand", "1");
            ProductScreen.check.selectedOrderlineHas("Monitor Stand", "1.0");
            ProductScreen.do.clickPayButton();
            
            PaymentScreen.do.clickPaymentMethod("Bank");
            PaymentScreen.check.changeIs("0.0");
            PaymentScreen.check.validateButtonIsHighlighted(true);
            PaymentScreen.do.clickValidate();
            
            ReceiptScreen.do.clickNextOrder();

            return getSteps();
        } 
    });
