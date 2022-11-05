/** @odoo-module **/

import { one, registerModel } from "@mail/model";

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
            default: {
                defaultVolume: 0.7,
                path: "/voip/static/src/sounds/dialtone",
            },
            isCausal: true,
        }),
        incomingCallRingtone: one("SoundEffect", {
            default: {
                path: "/voip/static/src/sounds/incomingcall",
            },
            isCausal: true,
        }),
        ringbackTone: one("SoundEffect", {
            default: {
                path: "/voip/static/src/sounds/ringbacktone",
            },
            isCausal: true,
        }),
    },
});
