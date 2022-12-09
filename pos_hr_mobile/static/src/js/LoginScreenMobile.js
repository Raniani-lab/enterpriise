/** @odoo-module */

import Registries from "@point_of_sale/js/Registries";
import LoginScreen from "@pos_hr/js/LoginScreen";
import { isBarcodeScannerSupported, scanBarcode } from "@web/webclient/barcode/barcode_scanner";

const LoginScreenMobile = (LoginScreen) =>
    class extends LoginScreen {
        setup() {
            super.setup();
            this.hasMobileScanner = isBarcodeScannerSupported();
        }

        async open_mobile_scanner() {
            let data;
            try {
                data = await scanBarcode();
            } catch (error) {
                if (error.error && error.error.message) {
                    // Here, we know the structure of the error raised by BarcodeScanner.
                    this.showPopup("ErrorPopup", {
                        title: this.env._t("Unable to scan"),
                        body: error.error.message,
                    });
                    return;
                }
                // Just raise the other errors.
                throw error;
            }
            if (data) {
                this.env.barcode_reader.scan(data);
                if ("vibrate" in window.navigator) {
                    window.navigator.vibrate(100);
                }
            } else {
                this.env.services.notification.notify({
                    type: "warning",
                    message: "Please, Scan again !",
                });
            }
        }
    };
Registries.Component.extend(LoginScreen, LoginScreenMobile);

export default LoginScreen;
