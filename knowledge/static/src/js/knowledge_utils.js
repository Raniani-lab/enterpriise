/** @odoo-module **/

import { loadEmoji } from "@web/core/emoji_picker/emoji_picker";

// List of icons that should be avoided when adding a random icon
const iconsBlocklist = ["💩", "💀", "☠️", "🤮", "🖕", "🤢", "😒"];

/**
 * Get a random icon (that is not in the icons blocklist)
 * @returns {String} emoji
 */
export async function getRandomIcon() {
    const { emojis } = await loadEmoji();
    const randomEmojis = emojis.filter((emoji) => !iconsBlocklist.includes(emoji.codepoints));
    return randomEmojis[Math.floor(Math.random() * randomEmojis.length)].codepoints;
}

/**
 * Set an intersection observer on the given element. This function will ensure
 * that the given callback function will be called at most once when the given
 * element becomes visible on screen. This function can be used to load
 * components lazily (see: 'EmbeddedViewBehavior').
 * @param {HTMLElement} element
 * @param {Function} callback
 * @returns {IntersectionObserver}
 */
export function setIntersectionObserver (element, callback) {
    const options = {
        root: null,
        rootMargin: '0px'
    };
    const observer = new window.IntersectionObserver(entries => {
        const entry = entries[0];
        if (entry.isIntersecting) {
            observer.unobserve(entry.target);
            callback();
        }
    }, options);
    observer.observe(element);
    return observer;
}

/**
 * Convert the string from a data-behavior-props attribute to an usable object.
 *
 * @param {String} dataBehaviorPropsAttribute utf-8 encoded JSON string
 * @returns {Object} object containing props for a Behavior to store in the
 *                   html_field value of a field
 */
export function decodeDataBehaviorProps(dataBehaviorPropsAttribute) {
    return JSON.parse(decodeURIComponent(dataBehaviorPropsAttribute));
}

/**
 * Convert an object destined to be used as the value of a data-behavior-props
 * attribute to an utf-8 encoded JSON string (so that there is no special
 * character that would be sanitized by i.e. DOMPurify).
 *
 * @param {Object} dataBehaviorPropsObject object containing props for a
 *                 Behavior to store in the html_field value of a field
 * @returns {String} utf-8 encoded JSON string
 */
export function encodeDataBehaviorProps(dataBehaviorPropsObject) {
    return encodeURIComponent(JSON.stringify(dataBehaviorPropsObject));
}

/**
 * @param {string} platform
 * @param {string} videoId
 * @param {Object} params
 * @throws {Error} if the given video config is not recognized
 * @returns {URL}
 */
export function getVideoUrl (platform, videoId, params) {
    let url;
    switch (platform) {
        case "youtube":
            url = new URL(`https://www.youtube.com/embed/${videoId}`);
            break;
        case "vimeo":
            url = new URL(`https://player.vimeo.com/video/${videoId}`);
            break;
        case "dailymotion":
            url = new URL(`https://www.dailymotion.com/embed/video/${videoId}`);
            break;
        case "instagram":
            url = new URL(`https://www.instagram.com/p/${videoId}/embed`);
            break;
        case "youku":
            url = new URL(`https://player.youku.com/embed/${videoId}`);
            break;
        default:
            throw new Error();
    };
    url.search = new URLSearchParams(params);
    return url;
}
