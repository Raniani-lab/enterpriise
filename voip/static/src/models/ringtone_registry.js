/** @odoo-module **/

import { registerModel } from "@mail/model/model_core";
import { one } from "@mail/model/model_field";
import { insertAndReplace } from "@mail/model/model_field_command";

registerModel({
    name: "RingtoneRegistry",
    recordMethods: {
        stopAll() {
            this.dialTone.stop();
            this.incomingCallRingtone.stop();
            this.ringbackTone.stop();
        },
    },
    fields: {
        voip: one("Voip", {
            identifying: true,
            inverse: "ringtoneRegistry",
        }),
        dialTone: one("SoundEffect", {
            default: insertAndReplace({
                defaultVolume: 0.7,
                filename: "dialtone",
                path: "/voip/static/src/sounds/",
            }),
            isCausal: true,
        }),
        incomingCallRingtone: one("SoundEffect", {
            default: insertAndReplace({
                filename: "incomingcall",
                path: "/voip/static/src/sounds/",
            }),
            isCausal: true,
        }),
        ringbackTone: one("SoundEffect", {
            default: insertAndReplace({
                filename: "ringbacktone",
                path: "/voip/static/src/sounds/",
            }),
            isCausal: true,
        }),
    },
});
