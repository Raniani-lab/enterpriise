/* @odoo-module */

import { browser } from "@web/core/browser/browser";
import { _t } from "@web/core/l10n/translation";
import Dialog from "@web/legacy/js/core/dialog";

const SelectInputDeviceDialog = Dialog.extend({
    template: "voip.SelectInputDevices",
    /**
     * @constructor
     */
    init(parent, currentInputDeviceId, onChooseDeviceCallback) {
        this.devices = [];
        this.onChooseDeviceCallback = onChooseDeviceCallback;
        this.currentInputDeviceId = currentInputDeviceId;
        const options = {
            title: _t("Input/output audio settings"),
            buttons: [
                {
                    text: _t("Confirm"),
                    classes: "btn-primary",
                    click: this._onConfirm.bind(this),
                    close: true,
                },
                {
                    text: _t("Cancel"),
                    close: true,
                },
            ],
            fullscreen: true,
        };
        this._super(parent, options);
    },

    async willStart() {
        const _super = this._super;
        this.devices = await this.getAudioInputDevices();
        if (!this.currentInputDeviceId) {
            this.currentInputDeviceId = this.devices[0].deviceId;
        }
        return _super.apply(this, arguments);
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------
    /**
     * @private
     * @returns {Promise<{label: string, deviceId: *}[]>}
     */
    async getAudioInputDevices() {
        const devices = await browser.navigator.mediaDevices.enumerateDevices();
        return devices
            .filter((deviceInfo) => deviceInfo.kind === "audioinput")
            .map((device, index) => {
                return {
                    deviceId: device.deviceId,
                    label: device.label ? device.label : `Device ${index}`,
                };
            });
    },

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * @private
     */
    _onConfirm() {
        const selectedDeviceNode = this.el.querySelector(
            "input[name='o_select_input_devices']:checked"
        );
        if (selectedDeviceNode) {
            this.onChooseDeviceCallback(selectedDeviceNode.value);
        }
    },
});

export { SelectInputDeviceDialog };
