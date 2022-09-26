/** @odoo-module */

import { deserializeDateTime } from "@web/core/l10n/dates";
import { registry } from "@web/core/registry";

const { DateTime, Interval, Duration } = luxon;

class TimerService {
    constructor(orm) {
        this.orm = orm;
        this.clearTimer();
    }

    get toSeconds() {
        return (this.hours * 60 + this.minutes) * 60 + this.seconds;
    }

    get timerFormatted() {
        return Duration.fromObject({
            hours: this.hours,
            minutes: this.minutes,
            seconds: this.seconds,
        }).toISOTime({ suppressMilliseconds: true });
    }

    addHours(hours) {
        this.hours += hours;
    }

    addMinutes(minutes) {
        minutes += this.minutes;
        this.minutes = minutes % 60;
        this.addHours(Math.floor(minutes / 60));
    }

    addSeconds(seconds) {
        seconds += this.seconds;
        this.seconds = seconds % 60;
        this.addMinutes(Math.floor(seconds / 60));
    }

    computeOffset(time) {
        const { seconds } = this.getInterval(DateTime.now(), time)
            .toDuration(["seconds", "milliseconds"])
            .toObject();
        this.offset = seconds;
    }

    setTimer(timeElapsed, timerStart, serverTime) {
        this.clearTimer();
        this.addFloatTime(timeElapsed);
        this.timeElapsed = this.toSeconds;
        if (timerStart && serverTime) {
            const dateStart = timerStart;
            const { hours, minutes, seconds } = this.getInterval(dateStart, serverTime)
                .toDuration(["hours", "minutes", "seconds", "milliseconds"]) // avoid having milliseconds in seconds attribute
                .toObject();
            this.addHours(hours);
            this.addMinutes(minutes);
            this.addSeconds(seconds);
        } else if ((timerStart && !serverTime) || (!timerStart && serverTime)) {
            console.error(
                "Missing parameter: the timerStart or serverTime when one of them is defined."
            );
        }
    }

    getInterval(dateA, dateB) {
        let startDate, endDate;
        if (dateA <= dateB) {
            startDate = dateA;
            endDate = dateB;
        } else {
            startDate = dateB;
            endDate = dateA;
        }
        return Interval.fromDateTimes(startDate, endDate);
    }

    async getServerTime() {
        const serverTime = deserializeDateTime(
            await this.orm.call("timer.timer", "get_server_time")
        );
        return serverTime;
    }

    addFloatTime(timeElapsed) {
        if (timeElapsed === 0) {
            this.hours = this.minutes = this.seconds = 0;
            return;
        }

        const minutes = timeElapsed % 1;
        this.hours = timeElapsed - minutes;
        this.minutes = minutes * 60;
    }

    updateTimer(timerStart) {
        const currentTime = DateTime.now().plus({ seconds: this.offset });
        const timeElapsed = this.getInterval(timerStart, currentTime);
        const { seconds } = timeElapsed.toDuration(["seconds", "milliseconds"]).toObject();
        this.addSeconds(seconds - this.toSeconds + this.timeElapsed);
    }

    clearTimer() {
        this.hours = 0;
        this.minutes = 0;
        this.seconds = 0;
        this.offset = 0;
    }
}

export const timerService = {
    dependencies: ["orm"],
    async: [
        "getServerTime",
    ],
    start(env, { orm }) {
        return new TimerService(orm);
    }
};

registry.category('services').add('timer', timerService);
