/** @odoo-module */

import { PaymentScreen } from "@point_of_sale/../tests/tours/helpers/PaymentScreenTourMethods";
import { ReceiptScreen } from "@point_of_sale/../tests/tours/helpers/ReceiptScreenTourMethods";
import { Chrome } from "@pos_restaurant/../tests/tours/helpers/ChromeTourMethods";
import { FloorScreen } from "@pos_restaurant/../tests/tours/helpers/FloorScreenTourMethods";
import { ProductScreen } from "@pos_restaurant/../tests/tours/helpers/ProductScreenTourMethods";
import { getSteps, startSteps } from "@point_of_sale/../tests/tours/helpers/utils";
import { registry } from "@web/core/registry";

startSteps();

ProductScreen.do.confirmOpeningPopup();

// Create first order
FloorScreen.do.clickTable("5");
ProductScreen.check.orderBtnIsPresent();
ProductScreen.do.clickDisplayedProduct("Coca-Cola");
ProductScreen.do.clickDisplayedProduct("Water");
ProductScreen.check.orderlineIsToOrder("Water");
ProductScreen.check.orderlineIsToOrder("Coca-Cola");
ProductScreen.do.clickOrderButton();
ProductScreen.check.orderlinesHaveNoChange();
ProductScreen.do.clickPayButton();
PaymentScreen.do.clickPaymentMethod("Cash");
PaymentScreen.do.clickValidate();
ReceiptScreen.check.isShown();
Chrome.do.backToFloor();

// Create second order
FloorScreen.do.clickTable("4");
ProductScreen.check.orderBtnIsPresent();
ProductScreen.do.clickDisplayedProduct("Coca-Cola");
ProductScreen.check.orderlineIsToOrder("Coca-Cola");
ProductScreen.do.clickOrderButton();
ProductScreen.check.orderlinesHaveNoChange();
ProductScreen.do.clickPayButton();
PaymentScreen.do.clickPaymentMethod("Cash");
PaymentScreen.do.clickValidate();
ReceiptScreen.check.isShown();
Chrome.do.backToFloor();

// Create third order
FloorScreen.do.clickTable("4");
ProductScreen.check.orderBtnIsPresent();
ProductScreen.do.clickDisplayedProduct("Coca-Cola");
ProductScreen.do.clickDisplayedProduct("Water");
ProductScreen.do.clickDisplayedProduct("Minute Maid");
ProductScreen.check.orderlineIsToOrder("Coca-Cola");
ProductScreen.check.orderlineIsToOrder("Water");
ProductScreen.check.orderlineIsToOrder("Minute Maid");
ProductScreen.do.clickOrderButton();
ProductScreen.check.orderlinesHaveNoChange();
ProductScreen.check.selectedOrderlineHas("Minute Maid", "1.00");
ProductScreen.do.pressNumpad("Backspace");
ProductScreen.check.selectedOrderlineHas("Minute Maid", "0.00");
ProductScreen.do.clickPayButton();
PaymentScreen.do.clickPaymentMethod("Cash");
PaymentScreen.do.clickValidate();
ReceiptScreen.check.isShown();
Chrome.do.backToFloor();

registry
    .category("web_tour.tours")
    .add("PreparationDisplayTourResto", { test: true, url: "/pos/ui", steps: getSteps() });
