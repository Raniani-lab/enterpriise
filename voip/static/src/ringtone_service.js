/* @odoo-module */

export const ringtoneService = {
    start() {
        const audio = new window.Audio();
        const ringtones = {
            dialTone: {
                source: "/voip/static/src/sounds/dialtone.mp3",
                volume: 0.7,
            },
            incomingCallRingtone: {
                source: "/voip/static/src/sounds/incomingcall.mp3",
            },
            ringbackTone: {
                source: "/voip/static/src/sounds/ringbacktone.mp3",
            },
        };
        function play() {
            audio.currentTime = 0;
            audio.loop = true;
            audio.src = this.source;
            audio.volume = this.volume ?? 1;
            Promise.resolve(audio.play()).catch(() => {});
        }
        Object.values(ringtones).forEach((x) => Object.assign(x, { play }));
        return {
            ...ringtones,
            stopPlaying() {
                audio.pause();
                audio.currentTime = 0;
            },
        };
    },
};
